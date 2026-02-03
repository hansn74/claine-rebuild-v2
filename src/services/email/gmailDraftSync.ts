/**
 * Gmail Draft Sync Service
 *
 * Syncs local drafts to Gmail server
 * - Creates new drafts on Gmail
 * - Updates existing drafts
 * - Deletes drafts when discarded
 */

import { tokenStorageService } from '../auth/tokenStorage'
import { gmailOAuthService } from '../auth/gmailOAuth'
import { logger } from '@/services/logger'
import type { DraftDocument } from '@/services/database/schemas/draft.schema'

const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me'

/**
 * Build RFC 2822 email message from draft data
 */
function buildRfc2822Message(draft: DraftDocument): string {
  const lines: string[] = []

  // To header
  if (draft.to.length > 0) {
    const toAddresses = draft.to
      .map((addr) => (addr.name ? `"${addr.name}" <${addr.email}>` : addr.email))
      .join(', ')
    lines.push(`To: ${toAddresses}`)
  }

  // Cc header
  if (draft.cc.length > 0) {
    const ccAddresses = draft.cc
      .map((addr) => (addr.name ? `"${addr.name}" <${addr.email}>` : addr.email))
      .join(', ')
    lines.push(`Cc: ${ccAddresses}`)
  }

  // Subject header
  lines.push(`Subject: ${draft.subject || '(No subject)'}`)

  // Content-Type for HTML
  lines.push('Content-Type: text/html; charset=utf-8')
  lines.push('MIME-Version: 1.0')

  // Empty line before body
  lines.push('')

  // Body
  lines.push(draft.body?.html || draft.body?.text || '')

  return lines.join('\r\n')
}

/**
 * Encode string to base64url (Gmail API format)
 */
function base64UrlEncode(str: string): string {
  // Convert to base64
  const base64 = btoa(unescape(encodeURIComponent(str)))
  // Convert to base64url
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Gmail Draft Sync Service
 */
export const gmailDraftSyncService = {
  /**
   * Create or update a draft on Gmail
   * @returns The remote draft ID
   */
  async syncDraft(accountId: string, draft: DraftDocument): Promise<string | null> {
    // Skip if offline
    if (!navigator.onLine) {
      logger.debug('draft-sync', 'Offline - skipping draft sync', { draftId: draft.id })
      return null
    }

    // Get access token
    const tokens = await tokenStorageService.getTokens(accountId)
    if (!tokens) {
      logger.warn('draft-sync', 'No tokens found for account', { accountId })
      return null
    }

    try {
      // Build the message
      const message = buildRfc2822Message(draft)
      const encodedMessage = base64UrlEncode(message)

      let response: Response
      let remoteDraftId: string

      if (draft.remoteDraftId) {
        // Update existing draft
        logger.debug('draft-sync', 'Updating draft on Gmail', {
          draftId: draft.id,
          remoteDraftId: draft.remoteDraftId,
        })

        response = await fetch(`${GMAIL_API_BASE}/drafts/${draft.remoteDraftId}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: draft.remoteDraftId,
            message: {
              raw: encodedMessage,
            },
          }),
        })

        remoteDraftId = draft.remoteDraftId
      } else {
        // Create new draft
        logger.debug('draft-sync', 'Creating draft on Gmail', { draftId: draft.id })

        response = await fetch(`${GMAIL_API_BASE}/drafts`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              raw: encodedMessage,
              threadId: draft.threadId, // Link to existing thread if replying
            },
          }),
        })

        if (response.ok) {
          const data = await response.json()
          remoteDraftId = data.id
          logger.info('draft-sync', 'Draft created on Gmail', {
            draftId: draft.id,
            remoteDraftId,
          })
        } else {
          throw new Error(`Failed to create draft: ${response.status}`)
        }
      }

      // Handle 401 (token expired)
      if (response.status === 401) {
        if (!tokens.refresh_token) {
          throw new Error('No refresh token available')
        }
        const refreshed = await gmailOAuthService.refreshAccessToken(tokens.refresh_token)
        await tokenStorageService.storeTokens(accountId, refreshed)
        // Retry with new token
        return this.syncDraft(accountId, draft)
      }

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Gmail API error: ${response.status} - ${errorText}`)
      }

      return remoteDraftId
    } catch (error) {
      logger.error('draft-sync', 'Failed to sync draft to Gmail', {
        draftId: draft.id,
        error: error instanceof Error ? error.message : error,
      })
      return null
    }
  },

  /**
   * Delete a draft from Gmail
   */
  async deleteDraft(accountId: string, remoteDraftId: string): Promise<boolean> {
    // Skip if offline
    if (!navigator.onLine) {
      logger.debug('draft-sync', 'Offline - skipping draft delete', { remoteDraftId })
      return false
    }

    // Get access token
    const tokens = await tokenStorageService.getTokens(accountId)
    if (!tokens) {
      logger.warn('draft-sync', 'No tokens found for account', { accountId })
      return false
    }

    try {
      logger.debug('draft-sync', 'Deleting draft from Gmail', { remoteDraftId })

      const response = await fetch(`${GMAIL_API_BASE}/drafts/${remoteDraftId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      })

      // Handle 401 (token expired)
      if (response.status === 401) {
        if (!tokens.refresh_token) {
          throw new Error('No refresh token available')
        }
        const refreshed = await gmailOAuthService.refreshAccessToken(tokens.refresh_token)
        await tokenStorageService.storeTokens(accountId, refreshed)
        // Retry with new token
        return this.deleteDraft(accountId, remoteDraftId)
      }

      // 404 is OK - draft may have been deleted from another device
      if (response.status === 404) {
        logger.debug('draft-sync', 'Draft not found on Gmail (already deleted)', { remoteDraftId })
        return true
      }

      if (!response.ok) {
        throw new Error(`Gmail API error: ${response.status}`)
      }

      logger.info('draft-sync', 'Draft deleted from Gmail', { remoteDraftId })
      return true
    } catch (error) {
      logger.error('draft-sync', 'Failed to delete draft from Gmail', {
        remoteDraftId,
        error: error instanceof Error ? error.message : error,
      })
      return false
    }
  },
}
