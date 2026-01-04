/**
 * Outlook Send Service
 *
 * Implements the ISendProvider interface for sending emails via Microsoft Graph API.
 * Uses OAuth 2.0 tokens and the sendMail endpoint.
 *
 * Story 2.4: Offline-First Send Queue
 * Task 5: Implement Outlook Send Integration
 *
 * References:
 * - Microsoft Graph sendMail: https://learn.microsoft.com/en-us/graph/api/user-sendmail
 */

import { outlookOAuthService } from '@/services/auth/outlookOAuth'
import { tokenStorageService } from '@/services/auth/tokenStorage'
import { logger } from '@/services/logger'
import type { ISendProvider } from './sendQueueService'
import type { SendQueueDocument } from '@/services/database/schemas/sendQueue.schema'
import type { EmailAddress } from '@/services/database/schemas/email.schema'

/**
 * Microsoft Graph API endpoints
 */
const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0'
const GRAPH_SEND_ENDPOINT = `${GRAPH_API_BASE}/me/sendMail`

/**
 * Microsoft Graph recipient format
 */
interface GraphEmailAddress {
  emailAddress: {
    name?: string
    address: string
  }
}

/**
 * Microsoft Graph attachment format
 */
interface GraphAttachment {
  '@odata.type': '#microsoft.graph.fileAttachment'
  name: string
  contentType: string
  contentBytes: string // base64 encoded
}

/**
 * Microsoft Graph message format
 */
interface GraphMessage {
  subject: string
  body: {
    contentType: 'HTML' | 'Text'
    content: string
  }
  toRecipients: GraphEmailAddress[]
  ccRecipients?: GraphEmailAddress[]
  bccRecipients?: GraphEmailAddress[]
  conversationId?: string
  replyTo?: GraphEmailAddress[]
  attachments?: GraphAttachment[]
}

/**
 * Microsoft Graph sendMail request body
 */
interface GraphSendMailRequest {
  message: GraphMessage
  saveToSentItems: boolean
}

/**
 * Outlook Send Service
 *
 * Implements email sending via Microsoft Graph API with OAuth 2.0 authentication.
 */
export class OutlookSendService implements ISendProvider {
  private static instance: OutlookSendService

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): OutlookSendService {
    if (!OutlookSendService.instance) {
      OutlookSendService.instance = new OutlookSendService()
    }
    return OutlookSendService.instance
  }

  /**
   * Send an email via Microsoft Graph API
   *
   * @param item - Queue item containing email data
   * @returns Message ID (generated locally since Graph API doesn't return one for sendMail)
   * @throws Error if send fails
   */
  async sendEmail(item: SendQueueDocument): Promise<string> {
    logger.debug('sendQueue', 'Sending email via Outlook', {
      id: item.id,
      accountId: item.accountId,
    })

    // Get access token (with refresh if needed)
    const accessToken = await this.getValidAccessToken(item.accountId)

    // Format message for Graph API
    const requestBody = this.formatGraphMessage(item)

    // Send via Microsoft Graph API
    const response = await fetch(GRAPH_SEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage =
        errorData.error?.message ||
        `Microsoft Graph API error: ${response.status} ${response.statusText}`

      logger.error('sendQueue', 'Outlook send failed', {
        id: item.id,
        status: response.status,
        error: errorMessage,
        errorCode: errorData.error?.code,
      })

      // Handle specific Graph API errors
      if (response.status === 401) {
        throw new Error('Authentication failed. Token may have expired.')
      }
      if (response.status === 403) {
        throw new Error('Permission denied. User may not have Mail.Send permission.')
      }
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.')
      }

      throw new Error(errorMessage)
    }

    // sendMail returns 202 Accepted with no body
    // Generate a message ID for tracking
    const messageId = `outlook-${item.id}-${Date.now()}`

    logger.info('sendQueue', 'Outlook send successful', {
      id: item.id,
      messageId,
    })

    return messageId
  }

  /**
   * Get a valid access token, refreshing if necessary
   *
   * @param accountId - Account identifier (e.g., 'outlook:user@example.com')
   * @returns Valid access token
   * @throws Error if tokens not found or refresh fails
   */
  private async getValidAccessToken(accountId: string): Promise<string> {
    // Extract email from accountId (format: 'outlook:user@example.com')
    const email = accountId.replace('outlook:', '')

    // Get stored tokens
    const tokens = await tokenStorageService.getTokens(email)
    if (!tokens) {
      throw new Error(`No tokens found for account: ${accountId}`)
    }

    // Check if token is expired or about to expire (5 minute buffer)
    const expiresAt = new Date(tokens.expires_at)
    const buffer = 5 * 60 * 1000 // 5 minutes
    const isExpired = expiresAt.getTime() - Date.now() < buffer

    if (!isExpired) {
      return tokens.access_token
    }

    // Token is expired, refresh it
    logger.debug('sendQueue', 'Refreshing expired Outlook token', { accountId })

    if (!tokens.refresh_token) {
      throw new Error(`No refresh token available for account: ${accountId}`)
    }

    try {
      const newTokens = await outlookOAuthService.refreshAccessToken(tokens.refresh_token)

      // Store new tokens
      await tokenStorageService.storeTokens(email, newTokens)

      logger.info('sendQueue', 'Outlook token refreshed successfully', { accountId })

      return newTokens.access_token
    } catch (error) {
      logger.error('sendQueue', 'Outlook token refresh failed', {
        accountId,
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      throw new Error(
        `Token refresh failed for ${accountId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Format queue item as Microsoft Graph sendMail request
   *
   * @param item - Queue item containing email data
   * @returns GraphSendMailRequest object
   */
  private formatGraphMessage(item: SendQueueDocument): GraphSendMailRequest {
    const message: GraphMessage = {
      subject: item.subject,
      body: {
        contentType: 'HTML',
        content: item.body.html || item.body.text || '',
      },
      toRecipients: this.convertToGraphRecipients(item.to),
    }

    // Add CC recipients if present
    if (item.cc.length > 0) {
      message.ccRecipients = this.convertToGraphRecipients(item.cc)
    }

    // Add BCC recipients if present
    if (item.bcc.length > 0) {
      message.bccRecipients = this.convertToGraphRecipients(item.bcc)
    }

    // Add conversation ID for replies (if available)
    // Note: Graph API uses conversationId differently than threadId
    // For proper threading, we'd need to use the reply endpoint instead
    if (item.threadId && (item.type === 'reply' || item.type === 'reply-all')) {
      message.conversationId = item.threadId
    }

    // Add attachments if present
    if (item.attachments && item.attachments.length > 0) {
      message.attachments = item.attachments
        .filter((att) => att.content) // Only include attachments with content
        .map((att) => ({
          '@odata.type': '#microsoft.graph.fileAttachment' as const,
          name: att.filename,
          contentType: att.mimeType,
          contentBytes: att.content!, // base64 encoded content
        }))
    }

    return {
      message,
      saveToSentItems: true, // Always save to Sent Items folder
    }
  }

  /**
   * Convert EmailAddress array to Microsoft Graph format
   *
   * @param addresses - Array of EmailAddress objects
   * @returns Array of GraphEmailAddress objects
   */
  private convertToGraphRecipients(addresses: EmailAddress[]): GraphEmailAddress[] {
    return addresses.map((addr) => ({
      emailAddress: {
        name: addr.name || undefined,
        address: addr.email,
      },
    }))
  }
}

// Export singleton instance
export const outlookSendService = OutlookSendService.getInstance()
