/**
 * Outlook Draft Sync Service
 *
 * Syncs local drafts to Microsoft Graph API (Outlook)
 * - Creates new drafts on Outlook
 * - Updates existing drafts
 * - Deletes drafts when discarded
 */

import { tokenStorageService } from '../auth/tokenStorage'
import { outlookOAuthService } from '../auth/outlookOAuth'
import { logger } from '@/services/logger'
import type { DraftDocument } from '@/services/database/schemas/draft.schema'

const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0/me'

/**
 * Build Microsoft Graph message object from draft data
 */
function buildGraphMessage(draft: DraftDocument): Record<string, unknown> {
  const message: Record<string, unknown> = {
    subject: draft.subject || '(No subject)',
    body: {
      contentType: 'HTML',
      content: draft.body?.html || draft.body?.text || '',
    },
    toRecipients: draft.to.map((addr) => ({
      emailAddress: {
        name: addr.name || addr.email,
        address: addr.email,
      },
    })),
  }

  // Add CC recipients
  if (draft.cc.length > 0) {
    message.ccRecipients = draft.cc.map((addr) => ({
      emailAddress: {
        name: addr.name || addr.email,
        address: addr.email,
      },
    }))
  }

  // Add BCC recipients
  if (draft.bcc.length > 0) {
    message.bccRecipients = draft.bcc.map((addr) => ({
      emailAddress: {
        name: addr.name || addr.email,
        address: addr.email,
      },
    }))
  }

  return message
}

/**
 * Outlook Draft Sync Service
 */
export const outlookDraftSyncService = {
  /**
   * Create or update a draft on Outlook
   * @returns The remote draft ID
   */
  async syncDraft(accountId: string, draft: DraftDocument): Promise<string | null> {
    // Skip if offline
    if (!navigator.onLine) {
      logger.debug('draft-sync', 'Offline - skipping Outlook draft sync', { draftId: draft.id })
      return null
    }

    // Get access token
    const tokens = await tokenStorageService.getTokens(accountId)
    if (!tokens) {
      logger.warn('draft-sync', 'No tokens found for account', { accountId })
      return null
    }

    try {
      const message = buildGraphMessage(draft)
      let response: Response
      let remoteDraftId: string

      if (draft.remoteDraftId) {
        // Update existing draft
        logger.debug('draft-sync', 'Updating draft on Outlook', {
          draftId: draft.id,
          remoteDraftId: draft.remoteDraftId,
        })

        response = await fetch(`${GRAPH_API_BASE}/messages/${draft.remoteDraftId}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(message),
        })

        remoteDraftId = draft.remoteDraftId
      } else {
        // Create new draft (POST to /messages creates a draft by default)
        logger.debug('draft-sync', 'Creating draft on Outlook', { draftId: draft.id })

        response = await fetch(`${GRAPH_API_BASE}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(message),
        })

        if (response.ok) {
          const data = await response.json()
          remoteDraftId = data.id
          logger.info('draft-sync', 'Draft created on Outlook', {
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
        const refreshed = await outlookOAuthService.refreshAccessToken(tokens.refresh_token)
        await tokenStorageService.storeTokens(accountId, refreshed)
        // Retry with new token
        return this.syncDraft(accountId, draft)
      }

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Graph API error: ${response.status} - ${errorText}`)
      }

      return remoteDraftId
    } catch (error) {
      logger.error('draft-sync', 'Failed to sync draft to Outlook', {
        draftId: draft.id,
        error: error instanceof Error ? error.message : error,
      })
      return null
    }
  },

  /**
   * Delete a draft from Outlook
   */
  async deleteDraft(accountId: string, remoteDraftId: string): Promise<boolean> {
    // Skip if offline
    if (!navigator.onLine) {
      logger.debug('draft-sync', 'Offline - skipping Outlook draft delete', { remoteDraftId })
      return false
    }

    // Get access token
    const tokens = await tokenStorageService.getTokens(accountId)
    if (!tokens) {
      logger.warn('draft-sync', 'No tokens found for account', { accountId })
      return false
    }

    try {
      logger.debug('draft-sync', 'Deleting draft from Outlook', { remoteDraftId })

      const response = await fetch(`${GRAPH_API_BASE}/messages/${remoteDraftId}`, {
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
        const refreshed = await outlookOAuthService.refreshAccessToken(tokens.refresh_token)
        await tokenStorageService.storeTokens(accountId, refreshed)
        // Retry with new token
        return this.deleteDraft(accountId, remoteDraftId)
      }

      // 404 is OK - draft may have been deleted from another device
      if (response.status === 404) {
        logger.debug('draft-sync', 'Draft not found on Outlook (already deleted)', {
          remoteDraftId,
        })
        return true
      }

      if (!response.ok) {
        throw new Error(`Graph API error: ${response.status}`)
      }

      logger.info('draft-sync', 'Draft deleted from Outlook', { remoteDraftId })
      return true
    } catch (error) {
      logger.error('draft-sync', 'Failed to delete draft from Outlook', {
        remoteDraftId,
        error: error instanceof Error ? error.message : error,
      })
      return false
    }
  },
}
