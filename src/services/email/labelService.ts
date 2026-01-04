/**
 * Label Service
 *
 * Story 2.9: Email Folders & Labels
 * Task 2: Gmail Labels Sync (AC: 2)
 * Task 3: Outlook Folders Sync (AC: 3)
 *
 * Provides label/folder fetching functionality for Gmail and Outlook.
 * Features:
 * - Fetch Gmail labels via labels.list() API (Task 2.2)
 * - Fetch Outlook folders via /mailFolders endpoint (Task 3.1)
 * - Map system labels/folders to standard folders (Task 2.3, 3.2)
 * - Handle Gmail label colors (Task 2.6)
 * - Support Outlook nested folders (Task 3.4)
 *
 * Gmail API Reference:
 * - labels.list: Returns all labels for the user
 * - Label types: system (INBOX, SENT, etc.) or user-created
 *
 * Microsoft Graph API Reference:
 * - GET /me/mailFolders: Returns all mail folders
 * - Includes wellKnownName for system folders
 */

import { logger } from '@/services/logger'
import { tokenStorageService } from '@/services/auth/tokenStorage'
import { gmailOAuthService } from '@/services/auth/gmailOAuth'
import { outlookOAuthService } from '@/services/auth/outlookOAuth'
import type { FolderItem } from '@/store/folderStore'

/**
 * Gmail API base URL
 */
const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me'

/**
 * Microsoft Graph API base URL
 */
const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0/me'

/**
 * Gmail label response structure
 */
interface GmailLabel {
  id: string
  name: string
  type: 'system' | 'user'
  labelListVisibility?: 'labelShow' | 'labelShowIfUnread' | 'labelHide'
  messageListVisibility?: 'show' | 'hide'
  color?: {
    textColor: string
    backgroundColor: string
  }
  messagesTotal?: number
  messagesUnread?: number
  threadsTotal?: number
  threadsUnread?: number
}

/**
 * Gmail labels list response
 */
interface GmailLabelsResponse {
  labels: GmailLabel[]
}

/**
 * Outlook mail folder response structure
 */
interface OutlookFolder {
  id: string
  displayName: string
  parentFolderId?: string
  childFolderCount: number
  unreadItemCount: number
  totalItemCount: number
  isHidden?: boolean
  wellKnownName?: string // inbox, sentItems, drafts, etc.
}

/**
 * Outlook folders list response
 */
interface OutlookFoldersResponse {
  value: OutlookFolder[]
  '@odata.nextLink'?: string
}

/**
 * Gmail system label to standard folder mapping
 */
const GMAIL_SYSTEM_LABEL_MAP: Record<string, string> = {
  INBOX: 'inbox',
  SENT: 'sent',
  DRAFT: 'drafts',
  TRASH: 'trash',
  SPAM: 'spam',
  STARRED: 'starred',
  IMPORTANT: 'important',
  UNREAD: 'unread',
  CATEGORY_PERSONAL: 'personal',
  CATEGORY_SOCIAL: 'social',
  CATEGORY_PROMOTIONS: 'promotions',
  CATEGORY_UPDATES: 'updates',
  CATEGORY_FORUMS: 'forums',
}

/**
 * Gmail system labels that should be hidden from the sidebar
 */
const GMAIL_HIDDEN_LABELS = new Set([
  'CHAT',
  'UNREAD',
  'STARRED',
  'IMPORTANT',
  'CATEGORY_PERSONAL',
  'CATEGORY_SOCIAL',
  'CATEGORY_PROMOTIONS',
  'CATEGORY_UPDATES',
  'CATEGORY_FORUMS',
])

/**
 * Outlook well-known folder to standard folder mapping
 */
const OUTLOOK_WELL_KNOWN_MAP: Record<string, string> = {
  inbox: 'inbox',
  sentItems: 'sent',
  drafts: 'drafts',
  deletedItems: 'trash',
  junkemail: 'spam',
  archive: 'archive',
  outbox: 'outbox',
}

/**
 * Outlook folders that should be hidden from the sidebar
 */
const OUTLOOK_HIDDEN_FOLDERS = new Set([
  'searchFolders',
  'clutter',
  'conflicts',
  'localfailures',
  'serverfailures',
  'syncIssues',
])

/**
 * Label Service
 *
 * Fetches and manages labels/folders for Gmail and Outlook accounts.
 *
 * Usage:
 * ```typescript
 * import { labelService } from '@/services/email'
 *
 * // Fetch Gmail labels
 * const labels = await labelService.fetchGmailLabels(accountId)
 *
 * // Fetch Outlook folders
 * const folders = await labelService.fetchOutlookFolders(accountId)
 * ```
 */
export class LabelService {
  private static instance: LabelService

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): LabelService {
    if (!LabelService.instance) {
      LabelService.instance = new LabelService()
    }
    return LabelService.instance
  }

  /**
   * Fetch Gmail labels for an account
   * Task 2.2: Implement Gmail API labels.list() to fetch user labels
   *
   * @param accountId - Account identifier
   * @returns Array of FolderItem objects
   */
  async fetchGmailLabels(accountId: string): Promise<FolderItem[]> {
    logger.debug('label-service', 'Fetching Gmail labels', { accountId })

    // Get access token
    const tokens = await tokenStorageService.getTokens(accountId)
    if (!tokens) {
      throw new Error(`No OAuth tokens found for account: ${accountId}`)
    }

    let accessToken = tokens.access_token

    try {
      const response = await fetch(`${GMAIL_API_BASE}/labels`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (!response.ok) {
        // Check if token expired
        if (response.status === 401) {
          logger.debug('label-service', 'Token expired, refreshing...')
          const refreshed = await gmailOAuthService.refreshAccessToken(tokens.refresh_token)
          await tokenStorageService.storeTokens(accountId, refreshed)
          accessToken = refreshed.access_token

          // Retry with new token
          const retryResponse = await fetch(`${GMAIL_API_BASE}/labels`, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          })

          if (!retryResponse.ok) {
            const error = await this.parseError(retryResponse)
            throw new Error(`Gmail API labels fetch failed: ${error}`)
          }

          const data: GmailLabelsResponse = await retryResponse.json()
          return this.mapGmailLabels(data.labels)
        }

        const error = await this.parseError(response)
        throw new Error(`Gmail API labels fetch failed: ${error}`)
      }

      const data: GmailLabelsResponse = await response.json()
      const labels = this.mapGmailLabels(data.labels)

      logger.info('label-service', 'Gmail labels fetched', {
        accountId,
        count: labels.length,
      })

      return labels
    } catch (error) {
      logger.error('label-service', 'Failed to fetch Gmail labels', {
        accountId,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Map Gmail labels to FolderItem format
   * Task 2.3: Map Gmail system labels to standard folders
   * Task 2.5: Display user-created Gmail labels
   * Task 2.6: Handle label colors from Gmail API
   */
  private mapGmailLabels(labels: GmailLabel[]): FolderItem[] {
    const folderItems: FolderItem[] = []

    for (const label of labels) {
      // Skip hidden labels
      if (GMAIL_HIDDEN_LABELS.has(label.id)) {
        continue
      }

      // Skip labels set to hide in list
      if (label.labelListVisibility === 'labelHide') {
        continue
      }

      const standardFolder = GMAIL_SYSTEM_LABEL_MAP[label.id]
      const isSystem = label.type === 'system'

      // Skip system labels that don't map to standard folders (they're already shown)
      if (isSystem && !standardFolder) {
        continue
      }

      // Skip system labels that map to standard folders (already in sidebar)
      if (
        isSystem &&
        standardFolder &&
        ['inbox', 'sent', 'drafts', 'trash', 'spam'].includes(standardFolder)
      ) {
        continue
      }

      const folderItem: FolderItem = {
        id: label.id,
        name: label.name,
        type: 'gmail-label',
        unreadCount: label.messagesUnread || 0,
        color: label.color?.backgroundColor,
      }

      folderItems.push(folderItem)
    }

    // Sort labels alphabetically
    folderItems.sort((a, b) => a.name.localeCompare(b.name))

    return folderItems
  }

  /**
   * Fetch Outlook folders for an account
   * Task 3.1: Implement Outlook Graph API /mailFolders endpoint fetch
   *
   * @param accountId - Account identifier
   * @returns Array of FolderItem objects
   */
  async fetchOutlookFolders(accountId: string): Promise<FolderItem[]> {
    logger.debug('label-service', 'Fetching Outlook folders', { accountId })

    // Get access token
    const tokens = await tokenStorageService.getTokens(accountId)
    if (!tokens) {
      throw new Error(`No OAuth tokens found for account: ${accountId}`)
    }

    let accessToken = tokens.access_token

    try {
      // Fetch all folders including child folders
      const response = await fetch(`${GRAPH_API_BASE}/mailFolders?$top=100&$expand=childFolders`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })

      if (!response.ok) {
        // Check if token expired
        if (response.status === 401) {
          logger.debug('label-service', 'Token expired, refreshing...')
          const refreshed = await outlookOAuthService.refreshAccessToken(tokens.refresh_token)
          await tokenStorageService.storeTokens(accountId, refreshed)
          accessToken = refreshed.access_token

          // Retry with new token
          const retryResponse = await fetch(
            `${GRAPH_API_BASE}/mailFolders?$top=100&$expand=childFolders`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            }
          )

          if (!retryResponse.ok) {
            const error = await this.parseError(retryResponse)
            throw new Error(`Outlook API folders fetch failed: ${error}`)
          }

          const data: OutlookFoldersResponse = await retryResponse.json()
          return this.mapOutlookFolders(data.value)
        }

        const error = await this.parseError(response)
        throw new Error(`Outlook API folders fetch failed: ${error}`)
      }

      const data: OutlookFoldersResponse = await response.json()
      const folders = this.mapOutlookFolders(data.value)

      logger.info('label-service', 'Outlook folders fetched', {
        accountId,
        count: folders.length,
      })

      return folders
    } catch (error) {
      logger.error('label-service', 'Failed to fetch Outlook folders', {
        accountId,
        error: error instanceof Error ? error.message : String(error),
      })
      throw error
    }
  }

  /**
   * Map Outlook folders to FolderItem format
   * Task 3.2: Map Outlook well-known folders to standard folders
   * Task 3.3: Store Outlook folders in same structure as Gmail labels
   * Task 3.4: Display Outlook folders with proper hierarchy
   */
  private mapOutlookFolders(folders: OutlookFolder[]): FolderItem[] {
    const folderItems: FolderItem[] = []

    const processFolder = (folder: OutlookFolder, parentId?: string) => {
      // Skip hidden folders
      if (folder.isHidden) {
        return
      }

      // Skip well-known folders that are hidden
      if (folder.wellKnownName && OUTLOOK_HIDDEN_FOLDERS.has(folder.wellKnownName)) {
        return
      }

      // Skip system folders that map to standard folders (already in sidebar)
      const standardFolder = folder.wellKnownName && OUTLOOK_WELL_KNOWN_MAP[folder.wellKnownName]
      if (
        standardFolder &&
        ['inbox', 'sent', 'drafts', 'trash', 'spam', 'archive'].includes(standardFolder)
      ) {
        return
      }

      const folderItem: FolderItem = {
        id: folder.id,
        name: folder.displayName,
        type: 'outlook-folder',
        unreadCount: folder.unreadItemCount,
        parentId: parentId,
      }

      folderItems.push(folderItem)
    }

    // Process top-level folders
    for (const folder of folders) {
      processFolder(folder)

      // Process child folders recursively
      if ((folder as unknown as { childFolders?: OutlookFolder[] }).childFolders) {
        const childFolders = (folder as unknown as { childFolders: OutlookFolder[] }).childFolders
        for (const child of childFolders) {
          processFolder(child, folder.id)
        }
      }
    }

    // Sort folders alphabetically
    folderItems.sort((a, b) => a.name.localeCompare(b.name))

    return folderItems
  }

  /**
   * Fetch labels/folders for an account based on provider type
   *
   * @param accountId - Account identifier
   * @param provider - 'gmail' or 'outlook'
   * @returns Array of FolderItem objects
   */
  async fetchLabels(accountId: string, provider: 'gmail' | 'outlook'): Promise<FolderItem[]> {
    if (provider === 'gmail') {
      return this.fetchGmailLabels(accountId)
    }
    return this.fetchOutlookFolders(accountId)
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
    LabelService.instance = null as unknown as LabelService
  }
}

/**
 * Singleton instance export
 */
export const labelService = LabelService.getInstance()
