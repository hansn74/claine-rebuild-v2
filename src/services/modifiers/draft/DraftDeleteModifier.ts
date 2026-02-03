/**
 * Draft Delete Modifier
 *
 * Epic 3: Offline-First Modifier Architecture
 * Story 3.3: Draft Modifiers
 *
 * Modifier for deleting drafts.
 * - Gmail: Delete draft via drafts API
 * - Outlook: Delete message from drafts folder
 */

import { logger } from '@/services/logger'
import type { DraftDocument } from '@/services/database/schemas/draft.schema'
import type { DraftDeleteModifierParams, ProviderType } from '../types'
import { BaseDraftModifier } from './BaseDraftModifier'

/**
 * Draft Delete Modifier
 *
 * Deletes a draft from the server.
 */
export class DraftDeleteModifier extends BaseDraftModifier {
  readonly type = 'draft-delete' as const
  private readonly remoteDraftId?: string

  constructor(params: DraftDeleteModifierParams) {
    super(params.entityId, params.accountId, params.provider)
    this.remoteDraftId = params.remoteDraftId
  }

  /**
   * Static factory for reconstruction from document
   */
  static fromPayload(
    entityId: string,
    accountId: string,
    provider: ProviderType,
    payload: { remoteDraftId?: string },
    id?: string,
    createdAt?: number
  ): DraftDeleteModifier {
    const modifier = new DraftDeleteModifier({
      entityId,
      accountId,
      provider,
      remoteDraftId: payload.remoteDraftId,
    })
    if (id) Object.assign(modifier, { id })
    if (createdAt) Object.assign(modifier, { createdAt })
    return modifier
  }

  /**
   * Transform draft state - marks it as deleted
   * Note: The actual draft removal from DB should happen after this
   */
  modify(draft: DraftDocument): DraftDocument {
    // Return draft unchanged - deletion is handled at the queue level
    return draft
  }

  /**
   * Sync draft deletion to backend
   */
  async persist(): Promise<void> {
    // Skip if no remote draft ID
    if (!this.remoteDraftId) {
      logger.debug('draft-delete-modifier', 'No remote draft ID, skipping server delete', {
        entityId: this.entityId,
      })
      return
    }

    if (this.provider === 'gmail') {
      await this.persistGmail()
    } else {
      await this.persistOutlook()
    }
  }

  /**
   * Gmail: Delete draft
   */
  private async persistGmail(): Promise<void> {
    const response = await this.executeGmailRequest(
      'DELETE',
      `/drafts/${this.remoteDraftId}`,
      undefined
    )

    // 404 is OK - draft may have been deleted from another device
    if (response.status === 404) {
      logger.debug('draft-delete-modifier', 'Draft not found on Gmail (already deleted)', {
        remoteDraftId: this.remoteDraftId,
      })
      return
    }

    if (!response.ok) {
      const error = await this.parseApiError(response)
      throw new Error(`Gmail draft delete failed: ${error}`)
    }

    logger.info('draft-delete-modifier', 'Draft deleted via Gmail API', {
      entityId: this.entityId,
      remoteDraftId: this.remoteDraftId,
    })
  }

  /**
   * Outlook: Delete draft
   */
  private async persistOutlook(): Promise<void> {
    const response = await this.executeOutlookRequest(
      'DELETE',
      `/messages/${this.remoteDraftId}`,
      undefined
    )

    // 404 is OK - draft may have been deleted from another device
    if (response.status === 404) {
      logger.debug('draft-delete-modifier', 'Draft not found on Outlook (already deleted)', {
        remoteDraftId: this.remoteDraftId,
      })
      return
    }

    if (!response.ok) {
      const error = await this.parseApiError(response)
      throw new Error(`Outlook draft delete failed: ${error}`)
    }

    logger.info('draft-delete-modifier', 'Draft deleted via Outlook API', {
      entityId: this.entityId,
      remoteDraftId: this.remoteDraftId,
    })
  }

  /**
   * Get payload for serialization
   */
  getPayload(): Record<string, unknown> {
    return {
      remoteDraftId: this.remoteDraftId,
    }
  }
}
