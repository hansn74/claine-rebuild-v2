/**
 * Gmail Actions Service
 *
 * Story 2.6: Email Actions (Archive, Delete, Mark Read/Unread)
 * Task 8: Integrate with Gmail API
 *
 * Implements Gmail API calls for email actions.
 * Used by the action queue to sync actions to Gmail.
 *
 * Gmail API Reference:
 * - Archive: Remove INBOX label (labels.add/remove)
 * - Delete: Move to TRASH (trash/untrash)
 * - Mark read: Remove UNREAD label
 * - Mark unread: Add UNREAD label
 *
 * FR007: Full read/write functionality when offline, queueing actions for later sync
 * AC 1-3: Archive, delete, mark read/unread actions
 */

import { logger } from '@/services/logger'
import { tokenStorageService } from '@/services/auth/tokenStorage'
import { gmailOAuthService } from '@/services/auth/gmailOAuth'
import type { ActionQueueDocument } from '@/services/database/schemas/actionQueue.schema'
import type { IActionSyncProvider } from './emailActionQueue'

/**
 * Gmail API base URL
 */
const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me'

/**
 * Gmail Actions Service
 *
 * Implements IActionSyncProvider for Gmail-specific action syncing.
 *
 * Usage:
 * ```typescript
 * import { gmailActionsService, emailActionQueue } from '@/services/email'
 *
 * // Register provider
 * emailActionQueue.registerProvider('gmail', gmailActionsService)
 *
 * // Actions will be synced via Gmail API automatically
 * ```
 */
export class GmailActionsService implements IActionSyncProvider {
  private static instance: GmailActionsService

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): GmailActionsService {
    if (!GmailActionsService.instance) {
      GmailActionsService.instance = new GmailActionsService()
    }
    return GmailActionsService.instance
  }

  /**
   * Sync an action to Gmail API
   * Task 8.1: Implement Gmail API calls for actions
   *
   * @param action - Action to sync
   */
  async syncAction(action: ActionQueueDocument): Promise<void> {
    logger.debug('gmail-actions', 'Syncing action to Gmail', {
      actionId: action.id,
      type: action.type,
      emailId: action.emailId,
    })

    // Get access token for the account
    const tokens = await tokenStorageService.getTokens(action.accountId)
    if (!tokens) {
      throw new Error(`No OAuth tokens found for account: ${action.accountId}`)
    }

    let accessToken = tokens.access_token

    // Execute the appropriate API call
    try {
      switch (action.type) {
        case 'archive':
          await this.archiveEmail(action.emailId, accessToken)
          break
        case 'delete':
          await this.trashEmail(action.emailId, accessToken)
          break
        case 'mark-read':
          await this.markAsRead(action.emailId, accessToken)
          break
        case 'mark-unread':
          await this.markAsUnread(action.emailId, accessToken)
          break
        default:
          throw new Error(`Unknown action type: ${action.type}`)
      }

      logger.info('gmail-actions', 'Action synced successfully', {
        actionId: action.id,
        type: action.type,
      })
    } catch (error) {
      // Check if token expired
      if (error instanceof Error && error.message.includes('401')) {
        try {
          // Attempt token refresh
          logger.debug('gmail-actions', 'Token expired, refreshing...')
          const refreshed = await gmailOAuthService.refreshAccessToken(tokens.refresh_token)
          await tokenStorageService.storeTokens(action.accountId, refreshed)
          accessToken = refreshed.access_token

          // Retry the action with new token
          switch (action.type) {
            case 'archive':
              await this.archiveEmail(action.emailId, accessToken)
              break
            case 'delete':
              await this.trashEmail(action.emailId, accessToken)
              break
            case 'mark-read':
              await this.markAsRead(action.emailId, accessToken)
              break
            case 'mark-unread':
              await this.markAsUnread(action.emailId, accessToken)
              break
          }

          logger.info('gmail-actions', 'Action synced after token refresh', {
            actionId: action.id,
            type: action.type,
          })
          return
        } catch (refreshError) {
          logger.error('gmail-actions', 'Token refresh failed', {
            error: refreshError instanceof Error ? refreshError.message : String(refreshError),
          })
          throw new Error('Authentication failed. Please re-authenticate.')
        }
      }

      throw error
    }
  }

  /**
   * Archive email by removing INBOX label
   * Task 8.2: Implement archive (remove INBOX label)
   *
   * Gmail API: messages.modify with removeLabelIds: ['INBOX']
   *
   * @param emailId - Gmail message ID
   * @param accessToken - OAuth access token
   */
  private async archiveEmail(emailId: string, accessToken: string): Promise<void> {
    const url = `${GMAIL_API_BASE}/messages/${emailId}/modify`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        removeLabelIds: ['INBOX'],
      }),
    })

    if (!response.ok) {
      const error = await this.parseError(response)
      throw new Error(`Gmail API archive failed: ${error}`)
    }

    logger.debug('gmail-actions', 'Email archived via Gmail API', { emailId })
  }

  /**
   * Move email to trash
   * Task 8.3: Implement delete (move to Trash)
   *
   * Gmail API: messages.trash
   *
   * @param emailId - Gmail message ID
   * @param accessToken - OAuth access token
   */
  private async trashEmail(emailId: string, accessToken: string): Promise<void> {
    const url = `${GMAIL_API_BASE}/messages/${emailId}/trash`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      const error = await this.parseError(response)
      throw new Error(`Gmail API trash failed: ${error}`)
    }

    logger.debug('gmail-actions', 'Email trashed via Gmail API', { emailId })
  }

  /**
   * Mark email as read by removing UNREAD label
   * Task 8.4: Implement mark read (remove UNREAD label)
   *
   * Gmail API: messages.modify with removeLabelIds: ['UNREAD']
   *
   * @param emailId - Gmail message ID
   * @param accessToken - OAuth access token
   */
  private async markAsRead(emailId: string, accessToken: string): Promise<void> {
    const url = `${GMAIL_API_BASE}/messages/${emailId}/modify`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        removeLabelIds: ['UNREAD'],
      }),
    })

    if (!response.ok) {
      const error = await this.parseError(response)
      throw new Error(`Gmail API mark read failed: ${error}`)
    }

    logger.debug('gmail-actions', 'Email marked as read via Gmail API', { emailId })
  }

  /**
   * Mark email as unread by adding UNREAD label
   * Task 8.5: Implement mark unread (add UNREAD label)
   *
   * Gmail API: messages.modify with addLabelIds: ['UNREAD']
   *
   * @param emailId - Gmail message ID
   * @param accessToken - OAuth access token
   */
  private async markAsUnread(emailId: string, accessToken: string): Promise<void> {
    const url = `${GMAIL_API_BASE}/messages/${emailId}/modify`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        addLabelIds: ['UNREAD'],
      }),
    })

    if (!response.ok) {
      const error = await this.parseError(response)
      throw new Error(`Gmail API mark unread failed: ${error}`)
    }

    logger.debug('gmail-actions', 'Email marked as unread via Gmail API', { emailId })
  }

  /**
   * Undo archive by adding INBOX label back
   * Task 8.6: Implement undo for archive/delete
   *
   * @param emailId - Gmail message ID
   * @param accessToken - OAuth access token
   */
  async unarchiveEmail(emailId: string, accessToken: string): Promise<void> {
    const url = `${GMAIL_API_BASE}/messages/${emailId}/modify`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        addLabelIds: ['INBOX'],
      }),
    })

    if (!response.ok) {
      const error = await this.parseError(response)
      throw new Error(`Gmail API unarchive failed: ${error}`)
    }

    logger.debug('gmail-actions', 'Email unarchived via Gmail API', { emailId })
  }

  /**
   * Undo trash by restoring email
   * Task 8.6: Implement undo for delete
   *
   * Gmail API: messages.untrash
   *
   * @param emailId - Gmail message ID
   * @param accessToken - OAuth access token
   */
  async untrashEmail(emailId: string, accessToken: string): Promise<void> {
    const url = `${GMAIL_API_BASE}/messages/${emailId}/untrash`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      const error = await this.parseError(response)
      throw new Error(`Gmail API untrash failed: ${error}`)
    }

    logger.debug('gmail-actions', 'Email untrashed via Gmail API', { emailId })
  }

  /**
   * Parse error response from Gmail API
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
    GmailActionsService.instance = null as unknown as GmailActionsService
  }
}

/**
 * Singleton instance export
 */
export const gmailActionsService = GmailActionsService.getInstance()
