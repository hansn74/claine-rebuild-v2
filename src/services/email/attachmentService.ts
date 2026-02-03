/**
 * Attachment Service
 *
 * Story 2.8: Attachment Handling
 * Task 1: Attachment Download Service (AC: 2, 3)
 *
 * Provides attachment fetching and download functionality for Gmail and Outlook.
 * Features:
 * - Lazy loading: Attachments fetched on-demand, not during initial sync (AC3)
 * - Click to download attachment to user's Downloads folder (AC2)
 * - Caching layer to avoid re-fetching same attachment
 * - Provider-agnostic interface
 *
 * Gmail API Reference:
 * - messages.attachments.get: Returns base64url encoded attachment data
 * - Max attachment size: 25 MB total per message
 *
 * Microsoft Graph API Reference:
 * - GET /me/messages/{id}/attachments/{attachmentId}
 * - Returns base64 encoded content in contentBytes field
 */

import { logger } from '@/services/logger'
import { tokenStorageService } from '@/services/auth/tokenStorage'
import { gmailOAuthService } from '@/services/auth/gmailOAuth'
import { outlookOAuthService } from '@/services/auth/outlookOAuth'
import type { Attachment } from '@/services/database/schemas/email.schema'

/**
 * Gmail API base URL
 */
const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me'

/**
 * Microsoft Graph API base URL
 */
const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0/me'

/**
 * Gmail attachment response structure
 */
interface GmailAttachmentResponse {
  attachmentId: string
  size: number
  data: string // base64url encoded
}

/**
 * Microsoft Graph attachment response structure
 */
interface GraphAttachmentResponse {
  '@odata.type': string
  id: string
  name: string
  contentType: string
  size: number
  contentBytes: string // base64 encoded
}

/**
 * Cache entry with metadata
 */
interface CacheEntry {
  blob: Blob
  timestamp: number
}

/**
 * Attachment Service
 *
 * Handles attachment fetching for both Gmail and Outlook.
 * Implements lazy loading and caching for performance.
 *
 * Usage:
 * ```typescript
 * import { attachmentService } from '@/services/email'
 *
 * // Fetch attachment (lazy loaded)
 * const blob = await attachmentService.fetchAttachment(
 *   'accountId',
 *   'messageId',
 *   'attachmentId',
 *   'gmail'
 * )
 *
 * // Download to user's device
 * attachmentService.downloadBlob(blob, 'document.pdf')
 * ```
 */
export class AttachmentService {
  private static instance: AttachmentService

  // In-memory cache: key = `${accountId}:${emailId}:${attachmentId}`
  private cache: Map<string, CacheEntry> = new Map()

  // Cache TTL: 30 minutes
  private readonly CACHE_TTL_MS = 30 * 60 * 1000

  // Max cache size: 100 entries
  private readonly MAX_CACHE_SIZE = 100

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): AttachmentService {
    if (!AttachmentService.instance) {
      AttachmentService.instance = new AttachmentService()
    }
    return AttachmentService.instance
  }

  /**
   * Fetch an attachment from the email provider
   * Task 1.2-1.4: Implement Gmail and Outlook API attachment fetch with lazy-loading
   *
   * @param accountId - Account identifier
   * @param emailId - Email message ID (without provider prefix)
   * @param attachmentId - Attachment ID from email metadata
   * @param provider - 'gmail' or 'outlook'
   * @returns Blob containing the attachment data
   * @throws Error if fetch fails or authentication fails
   */
  async fetchAttachment(
    accountId: string,
    emailId: string,
    attachmentId: string,
    provider: 'gmail' | 'outlook'
  ): Promise<Blob> {
    const cacheKey = `${accountId}:${emailId}:${attachmentId}`

    // Check cache first (Task 1.6)
    const cached = this.getFromCache(cacheKey)
    if (cached) {
      logger.debug('attachment', 'Returning cached attachment', {
        accountId,
        emailId: emailId.slice(0, 20),
        attachmentId: attachmentId.slice(0, 20),
      })
      return cached
    }

    logger.debug('attachment', 'Fetching attachment', {
      accountId,
      emailId: emailId.slice(0, 20),
      attachmentId: attachmentId.slice(0, 20),
      provider,
    })

    // Get access token
    const tokens = await tokenStorageService.getTokens(accountId)
    if (!tokens) {
      throw new Error(`No OAuth tokens found for account: ${accountId}`)
    }

    let blob: Blob

    try {
      if (provider === 'gmail') {
        blob = await this.fetchGmailAttachment(emailId, attachmentId, tokens.access_token)
      } else {
        blob = await this.fetchOutlookAttachment(emailId, attachmentId, tokens.access_token)
      }
    } catch (error) {
      // Check if token expired
      if (error instanceof Error && error.message.includes('401')) {
        logger.debug('attachment', 'Token expired, refreshing...')
        if (!tokens.refresh_token) {
          throw new Error('No refresh token available for re-authentication')
        }
        try {
          // Attempt token refresh
          const oauthService = provider === 'gmail' ? gmailOAuthService : outlookOAuthService
          const refreshed = await oauthService.refreshAccessToken(tokens.refresh_token)
          await tokenStorageService.storeTokens(accountId, refreshed)

          // Retry with new token
          if (provider === 'gmail') {
            blob = await this.fetchGmailAttachment(emailId, attachmentId, refreshed.access_token)
          } else {
            blob = await this.fetchOutlookAttachment(emailId, attachmentId, refreshed.access_token)
          }

          logger.info('attachment', 'Attachment fetched after token refresh')
        } catch (refreshError) {
          logger.error('attachment', 'Token refresh failed', {
            error: refreshError instanceof Error ? refreshError.message : String(refreshError),
          })
          throw new Error('Authentication failed. Please re-authenticate.')
        }
      } else {
        throw error
      }
    }

    // Add to cache
    this.addToCache(cacheKey, blob)

    logger.info('attachment', 'Attachment fetched successfully', {
      accountId,
      provider,
      size: blob.size,
    })

    return blob
  }

  /**
   * Fetch attachment from Gmail API
   * Task 1.2: Implement Gmail API attachment fetch
   *
   * Gmail returns base64url encoded data that needs to be decoded
   *
   * @param messageId - Gmail message ID
   * @param attachmentId - Attachment ID
   * @param accessToken - OAuth access token
   * @returns Blob containing attachment data
   */
  private async fetchGmailAttachment(
    messageId: string,
    attachmentId: string,
    accessToken: string
  ): Promise<Blob> {
    const url = `${GMAIL_API_BASE}/messages/${messageId}/attachments/${attachmentId}`

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      const error = await this.parseError(response)
      throw new Error(`Gmail API attachment fetch failed: ${response.status} ${error}`)
    }

    const data: GmailAttachmentResponse = await response.json()

    // Gmail returns base64url encoded data - convert to standard base64 then decode
    const base64 = data.data.replace(/-/g, '+').replace(/_/g, '/')
    const binaryString = atob(base64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }

    return new Blob([bytes])
  }

  /**
   * Fetch attachment from Microsoft Graph API
   * Task 1.3: Implement Outlook API attachment fetch
   *
   * @param messageId - Outlook message ID (without 'outlook-' prefix)
   * @param attachmentId - Attachment ID
   * @param accessToken - OAuth access token
   * @returns Blob containing attachment data
   */
  private async fetchOutlookAttachment(
    messageId: string,
    attachmentId: string,
    accessToken: string
  ): Promise<Blob> {
    // For Outlook, we need to get the $value endpoint for binary content
    // or use contentBytes from the attachment response
    const url = `${GRAPH_API_BASE}/messages/${messageId}/attachments/${attachmentId}`

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      const error = await this.parseError(response)
      throw new Error(`Microsoft Graph attachment fetch failed: ${response.status} ${error}`)
    }

    const data: GraphAttachmentResponse = await response.json()

    // Microsoft Graph returns base64 encoded content in contentBytes
    const binaryString = atob(data.contentBytes)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }

    return new Blob([bytes], { type: data.contentType })
  }

  /**
   * Download a blob to the user's device
   * Task 1.5: Implement download to browser with correct filename
   *
   * Creates a temporary link element, triggers click, then cleans up.
   * The browser will save the file to the user's Downloads folder.
   *
   * @param blob - File data as Blob
   * @param filename - Filename for the download
   */
  downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    logger.debug('attachment', 'Triggered download', {
      filename,
      size: blob.size,
    })
  }

  /**
   * Convenience method to fetch and download an attachment in one call
   *
   * @param accountId - Account identifier
   * @param emailId - Email message ID
   * @param attachment - Attachment metadata
   * @param provider - 'gmail' or 'outlook'
   */
  async downloadAttachment(
    accountId: string,
    emailId: string,
    attachment: Attachment,
    provider: 'gmail' | 'outlook'
  ): Promise<void> {
    const blob = await this.fetchAttachment(accountId, emailId, attachment.id, provider)
    this.downloadBlob(blob, attachment.filename)
  }

  /**
   * Get cached attachment if available and not expired
   * Task 1.6: Caching layer
   *
   * @param key - Cache key
   * @returns Blob if cached and valid, undefined otherwise
   */
  private getFromCache(key: string): Blob | undefined {
    const entry = this.cache.get(key)
    if (!entry) return undefined

    // Check if expired
    if (Date.now() - entry.timestamp > this.CACHE_TTL_MS) {
      this.cache.delete(key)
      return undefined
    }

    return entry.blob
  }

  /**
   * Add attachment to cache with LRU eviction
   * Task 1.6: Caching layer
   *
   * @param key - Cache key
   * @param blob - Attachment data
   */
  private addToCache(key: string, blob: Blob): void {
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = this.cache.keys().next().value
      if (oldestKey) {
        this.cache.delete(oldestKey)
      }
    }

    this.cache.set(key, {
      blob,
      timestamp: Date.now(),
    })
  }

  /**
   * Clear the attachment cache
   * Useful for memory management or testing
   */
  clearCache(): void {
    this.cache.clear()
    logger.debug('attachment', 'Cache cleared')
  }

  /**
   * Get cache statistics for debugging/monitoring
   */
  getCacheStats(): { size: number; maxSize: number; ttlMs: number } {
    return {
      size: this.cache.size,
      maxSize: this.MAX_CACHE_SIZE,
      ttlMs: this.CACHE_TTL_MS,
    }
  }

  /**
   * Parse error response from API
   */
  private async parseError(response: Response): Promise<string> {
    try {
      const data = await response.json()
      return data.error?.message || response.statusText
    } catch {
      return `${response.status} ${response.statusText}`
    }
  }

  /**
   * Reset singleton instance (for testing only)
   * @internal
   */
  static __resetForTesting(): void {
    if (AttachmentService.instance) {
      AttachmentService.instance.clearCache()
    }
    AttachmentService.instance = null as unknown as AttachmentService
  }
}

/**
 * Singleton instance export
 */
export const attachmentService = AttachmentService.getInstance()
