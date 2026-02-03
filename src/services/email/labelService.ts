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
 * Note: Microsoft Graph API may return different casing, so we normalize to lowercase
 */
const OUTLOOK_WELL_KNOWN_MAP: Record<string, string> = {
  inbox: 'inbox',
  sentitems: 'sent',
  drafts: 'drafts',
  deleteditems: 'trash',
  junkemail: 'spam',
  archive: 'archive',
  outbox: 'outbox',
}

/**
 * Normalize wellKnownName to lowercase for consistent lookup
 */
function normalizeWellKnownName(name: string | undefined): string | undefined {
  return name?.toLowerCase()
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
          if (!tokens.refresh_token) {
            throw new Error('No refresh token available for re-authentication')
          }
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
   * AC 2: Support hierarchical labels (Parent/Child structure)
   */
  private mapGmailLabels(labels: GmailLabel[]): FolderItem[] {
    const folderItems: FolderItem[] = []
    // Map full label name to label info for hierarchy resolution
    const labelsByFullName = new Map<string, { id: string; label: GmailLabel }>()

    // First pass: collect all valid labels
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

      labelsByFullName.set(label.name, { id: label.id, label })
    }

    // Second pass: create folder items with hierarchy
    for (const [fullName, { id, label }] of labelsByFullName) {
      // Parse hierarchy from label name (Gmail uses "/" for hierarchy)
      const nameParts = fullName.split('/')
      let displayName = fullName
      let parentId: string | undefined

      if (nameParts.length > 1) {
        // Check if parent label exists
        const parentPath = nameParts.slice(0, -1).join('/')
        const parentInfo = labelsByFullName.get(parentPath)

        if (parentInfo) {
          // Parent exists - show just the last part and set parentId
          displayName = nameParts[nameParts.length - 1]
          parentId = parentInfo.id
        }
        // If parent doesn't exist, keep full name and no parentId
      }

      const folderItem: FolderItem = {
        id,
        name: displayName,
        type: 'gmail-label',
        unreadCount: label.messagesUnread || 0,
        color: label.color?.backgroundColor,
        parentId,
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
          if (!tokens.refresh_token) {
            throw new Error('No refresh token available for re-authentication')
          }
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
    // Track which folder IDs were added (for parent reference)
    const addedFolderIds = new Set<string>()

    const processFolder = (folder: OutlookFolder, parentId?: string): boolean => {
      // Skip hidden folders
      if (folder.isHidden) {
        return false
      }

      // Normalize wellKnownName for consistent lookup
      const normalizedWellKnown = normalizeWellKnownName(folder.wellKnownName)

      // Skip well-known folders that are hidden
      if (normalizedWellKnown && OUTLOOK_HIDDEN_FOLDERS.has(normalizedWellKnown)) {
        return false
      }

      // Skip system folders that map to standard folders (already in sidebar)
      const standardFolder = normalizedWellKnown && OUTLOOK_WELL_KNOWN_MAP[normalizedWellKnown]
      if (
        standardFolder &&
        ['inbox', 'sent', 'drafts', 'trash', 'spam', 'archive'].includes(standardFolder)
      ) {
        return false
      }

      // Only set parentId if parent was actually added to the list
      const effectiveParentId = parentId && addedFolderIds.has(parentId) ? parentId : undefined

      const folderItem: FolderItem = {
        id: folder.id,
        name: folder.displayName,
        type: 'outlook-folder',
        unreadCount: folder.unreadItemCount,
        parentId: effectiveParentId,
      }

      folderItems.push(folderItem)
      addedFolderIds.add(folder.id)
      return true
    }

    // Recursive function to process folder and children
    const processFolderWithChildren = (folder: OutlookFolder, parentId?: string) => {
      const wasAdded = processFolder(folder, parentId)

      // Process child folders - use folder.id as parent only if this folder was added
      const childParentId = wasAdded ? folder.id : parentId
      if ((folder as unknown as { childFolders?: OutlookFolder[] }).childFolders) {
        const childFolders = (folder as unknown as { childFolders: OutlookFolder[] }).childFolders
        for (const child of childFolders) {
          processFolderWithChildren(child, childParentId)
        }
      }
    }

    // Process all top-level folders
    for (const folder of folders) {
      processFolderWithChildren(folder)
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
