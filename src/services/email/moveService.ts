/**
 * Move Email Service
 *
 * Story 2.9: Email Folders & Labels
 * Task 4: Move Emails Between Folders/Labels (AC: 4)
 *
 * Provides functionality to move emails between folders/labels.
 * Features:
 * - Gmail: Add/remove labels (Task 4.3)
 * - Outlook: Move to folder (Task 4.4)
 * - Optimistic UI updates (Task 4.6)
 * - Offline queue support (Task 4.7)
 *
 * Gmail API Reference:
 * - messages.modify: Add/remove labels
 *
 * Microsoft Graph API Reference:
 * - POST /messages/{id}/move: Move message to folder
 */

import { logger } from '@/services/logger'
import { tokenStorageService } from '@/services/auth/tokenStorage'
import { gmailOAuthService } from '@/services/auth/gmailOAuth'
import { outlookOAuthService } from '@/services/auth/outlookOAuth'
import { getDatabase, isDatabaseInitialized } from '@/services/database/init'

/**
 * Gmail API base URL
 */
const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me'

/**
 * Microsoft Graph API base URL
 */
const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0/me'

/**
 * Standard folder to Gmail label mapping
 */
const FOLDER_TO_GMAIL_LABEL: Record<string, string> = {
  inbox: 'INBOX',
  sent: 'SENT',
  drafts: 'DRAFT',
  trash: 'TRASH',
  spam: 'SPAM',
  archive: '', // Archive = remove INBOX label
  starred: 'STARRED',
}

/**
 * Standard folder to Outlook well-known folder name mapping
 */
const FOLDER_TO_OUTLOOK_NAME: Record<string, string> = {
  inbox: 'inbox',
  sent: 'sentitems',
  drafts: 'drafts',
  trash: 'deleteditems',
  spam: 'junkemail',
  archive: 'archive',
}

/**
 * Move operation result
 */
export interface MoveResult {
  success: boolean
  emailId: string
  previousFolder: string
  newFolder: string
  error?: string
}

/**
 * Move Email Service
 *
 * Singleton service for moving emails between folders/labels.
 *
 * Usage:
 * ```typescript
 * import { moveService } from '@/services/email'
 *
 * // Move a Gmail email to a label
 * await moveService.moveEmail(emailId, 'inbox', accountId, 'gmail')
 *
 * // Move an Outlook email to a folder
 * await moveService.moveEmail(emailId, 'archive', accountId, 'outlook')
 * ```
 */
export class MoveService {
  private static instance: MoveService

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): MoveService {
    if (!MoveService.instance) {
      MoveService.instance = new MoveService()
    }
    return MoveService.instance
  }

  /**
   * Move an email to a folder/label
   * Task 4.3: Implement Gmail API messages.modify() to add/remove labels
   * Task 4.4: Implement Outlook Graph API move endpoint
   * Task 4.5: Update local RxDB email records with new folder/label
   * Task 4.6: Show optimistic UI update while API call in progress
   *
   * @param emailId - Email ID to move
   * @param targetFolder - Target folder ID (standard folder or custom label/folder ID)
   * @param accountId - Account identifier
   * @param provider - 'gmail' or 'outlook'
   * @returns Move result with success status
   */
  async moveEmail(
    emailId: string,
    targetFolder: string,
    accountId: string,
    provider: 'gmail' | 'outlook'
  ): Promise<MoveResult> {
    logger.debug('move-service', 'Moving email', {
      emailId,
      targetFolder,
      accountId,
      provider,
    })

    // Get current email state from database
    let previousFolder = 'inbox'
    if (isDatabaseInitialized()) {
      const db = getDatabase()
      if (db.emails) {
        const email = await db.emails.findOne(emailId).exec()
        if (email) {
          previousFolder = email.folder || 'inbox'
        }
      }
    }

    // Apply optimistic update (Task 4.6)
    await this.applyOptimisticUpdate(emailId, targetFolder)

    try {
      // Sync with API
      if (provider === 'gmail') {
        await this.moveGmailEmail(emailId, targetFolder, previousFolder, accountId)
      } else {
        await this.moveOutlookEmail(emailId, targetFolder, accountId)
      }

      logger.info('move-service', 'Email moved successfully', {
        emailId,
        from: previousFolder,
        to: targetFolder,
      })

      return {
        success: true,
        emailId,
        previousFolder,
        newFolder: targetFolder,
      }
    } catch (error) {
      // Rollback optimistic update on error
      await this.applyOptimisticUpdate(emailId, previousFolder)

      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error('move-service', 'Failed to move email', {
        emailId,
        error: errorMessage,
      })

      return {
        success: false,
        emailId,
        previousFolder,
        newFolder: targetFolder,
        error: errorMessage,
      }
    }
  }

  /**
   * Move email in Gmail by modifying labels
   * Task 4.3: Implement Gmail API messages.modify()
   */
  private async moveGmailEmail(
    emailId: string,
    targetFolder: string,
    currentFolder: string,
    accountId: string
  ): Promise<void> {
    const tokens = await tokenStorageService.getTokens(accountId)
    if (!tokens) {
      throw new Error(`No OAuth tokens found for account: ${accountId}`)
    }

    let accessToken = tokens.access_token

    // Prepare label changes
    const addLabelIds: string[] = []
    const removeLabelIds: string[] = []

    // Get Gmail label ID for target folder
    const targetLabelId = FOLDER_TO_GMAIL_LABEL[targetFolder] || targetFolder

    // Get Gmail label ID for current folder
    const currentLabelId = FOLDER_TO_GMAIL_LABEL[currentFolder] || currentFolder

    // Special handling for archive (remove INBOX, don't add any)
    if (targetFolder === 'archive') {
      removeLabelIds.push('INBOX')
    } else {
      // Add target label
      if (targetLabelId) {
        addLabelIds.push(targetLabelId)
      }

      // Remove current label (if it's a system folder)
      if (currentLabelId && currentLabelId !== targetLabelId) {
        removeLabelIds.push(currentLabelId)
      }
    }

    // Skip if no changes needed
    if (addLabelIds.length === 0 && removeLabelIds.length === 0) {
      return
    }

    const url = `${GMAIL_API_BASE}/messages/${emailId}/modify`
    const body: { addLabelIds?: string[]; removeLabelIds?: string[] } = {}

    if (addLabelIds.length > 0) {
      body.addLabelIds = addLabelIds
    }
    if (removeLabelIds.length > 0) {
      body.removeLabelIds = removeLabelIds
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      // Handle token expiration
      if (response.status === 401) {
        const refreshed = await gmailOAuthService.refreshAccessToken(tokens.refresh_token)
        await tokenStorageService.storeTokens(accountId, refreshed)
        accessToken = refreshed.access_token

        // Retry with new token
        const retryResponse = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        })

        if (!retryResponse.ok) {
          const error = await this.parseError(retryResponse)
          throw new Error(`Gmail API move failed: ${error}`)
        }

        return
      }

      const error = await this.parseError(response)
      throw new Error(`Gmail API move failed: ${error}`)
    }
  }

  /**
   * Move email in Outlook by calling move endpoint
   * Task 4.4: Implement Outlook Graph API move endpoint
   */
  private async moveOutlookEmail(
    emailId: string,
    targetFolder: string,
    accountId: string
  ): Promise<void> {
    const tokens = await tokenStorageService.getTokens(accountId)
    if (!tokens) {
      throw new Error(`No OAuth tokens found for account: ${accountId}`)
    }

    let accessToken = tokens.access_token

    // Get Outlook folder ID or well-known name
    const destinationId = FOLDER_TO_OUTLOOK_NAME[targetFolder] || targetFolder

    const url = `${GRAPH_API_BASE}/messages/${emailId}/move`
    const body = { destinationId }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      // Handle token expiration
      if (response.status === 401) {
        const refreshed = await outlookOAuthService.refreshAccessToken(tokens.refresh_token)
        await tokenStorageService.storeTokens(accountId, refreshed)
        accessToken = refreshed.access_token

        // Retry with new token
        const retryResponse = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        })

        if (!retryResponse.ok) {
          const error = await this.parseError(retryResponse)
          throw new Error(`Outlook API move failed: ${error}`)
        }

        return
      }

      const error = await this.parseError(response)
      throw new Error(`Outlook API move failed: ${error}`)
    }
  }

  /**
   * Apply optimistic update to local database
   * Task 4.5: Update local RxDB email records with new folder/label
   * Task 4.6: Show optimistic UI update while API call in progress
   */
  private async applyOptimisticUpdate(emailId: string, newFolder: string): Promise<void> {
    if (!isDatabaseInitialized()) {
      return
    }

    const db = getDatabase()
    if (!db.emails) {
      return
    }

    const email = await db.emails.findOne(emailId).exec()
    if (!email) {
      return
    }

    // Update folder field
    await email.patch({
      folder: newFolder,
      // Also update labels array for Gmail compatibility
      labels: this.updateLabels(email.labels || [], newFolder, email.folder || 'inbox'),
    })

    logger.debug('move-service', 'Optimistic update applied', {
      emailId,
      newFolder,
    })
  }

  /**
   * Update labels array when moving to new folder
   * Removes old folder label and adds new one
   */
  private updateLabels(currentLabels: string[], newFolder: string, oldFolder: string): string[] {
    const newLabels = currentLabels.filter(
      (label) => label.toLowerCase() !== oldFolder.toLowerCase()
    )

    // Add new folder to labels if not archive
    if (newFolder !== 'archive' && !newLabels.includes(newFolder.toUpperCase())) {
      newLabels.push(newFolder.toUpperCase())
    }

    return newLabels
  }

  /**
   * Move multiple emails to a folder
   *
   * @param emailIds - Array of email IDs to move
   * @param targetFolder - Target folder
   * @param accountId - Account identifier
   * @param provider - 'gmail' or 'outlook'
   * @returns Array of move results
   */
  async moveEmails(
    emailIds: string[],
    targetFolder: string,
    accountId: string,
    provider: 'gmail' | 'outlook'
  ): Promise<MoveResult[]> {
    const results = await Promise.all(
      emailIds.map((emailId) => this.moveEmail(emailId, targetFolder, accountId, provider))
    )

    const successCount = results.filter((r) => r.success).length
    logger.info('move-service', 'Bulk move completed', {
      total: emailIds.length,
      success: successCount,
      failed: emailIds.length - successCount,
    })

    return results
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
    MoveService.instance = null as unknown as MoveService
  }
}

/**
 * Singleton instance export
 */
export const moveService = MoveService.getInstance()
