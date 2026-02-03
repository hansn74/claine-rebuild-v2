/**
 * Delete Modifier
 *
 * Epic 3: Offline-First Modifier Architecture
 * Story 3.2: Email Action Modifiers
 *
 * Modifier for deleting (trashing) and restoring emails.
 * - Gmail: Move to TRASH / Restore from TRASH
 * - Outlook: Move to DeletedItems / Restore from DeletedItems
 */

import { logger } from '@/services/logger'
import type { EmailDocument } from '@/services/database/schemas/email.schema'
import type { DeleteModifierParams, ProviderType } from '../types'
import { BaseEmailModifier } from './BaseEmailModifier'

/**
 * Delete Modifier
 *
 * Moves an email to trash (soft delete).
 * - Gmail: Calls messages.trash
 * - Outlook: Moves to DeletedItems folder
 */
export class DeleteModifier extends BaseEmailModifier {
  readonly type = 'delete' as const
  private readonly currentFolder: string
  private readonly currentLabels: string[]

  constructor(params: DeleteModifierParams) {
    super(params.entityId, params.accountId, params.provider)
    this.currentFolder = params.currentFolder
    this.currentLabels = params.currentLabels
  }

  /**
   * Static factory for reconstruction from document
   */
  static fromPayload(
    entityId: string,
    accountId: string,
    provider: ProviderType,
    payload: { currentFolder: string; currentLabels: string[] },
    id?: string,
    createdAt?: number
  ): DeleteModifier {
    const modifier = new DeleteModifier({
      entityId,
      accountId,
      provider,
      currentFolder: payload.currentFolder,
      currentLabels: payload.currentLabels,
    })
    if (id) Object.assign(modifier, { id })
    if (createdAt) Object.assign(modifier, { createdAt })
    return modifier
  }

  /**
   * Transform email state to trashed
   */
  modify(email: EmailDocument): EmailDocument {
    // Add TRASH label, remove other folder labels
    const newLabels = email.labels
      .filter((l) => !['INBOX', 'SENT', 'DRAFT', 'SPAM'].includes(l))
      .concat('TRASH')

    return {
      ...email,
      folder: 'trash',
      labels: newLabels,
    }
  }

  /**
   * Sync delete action to backend
   */
  async persist(): Promise<void> {
    if (this.provider === 'gmail') {
      await this.persistGmail()
    } else {
      await this.persistOutlook()
    }
  }

  /**
   * Gmail: Move to trash
   */
  private async persistGmail(): Promise<void> {
    const response = await this.executeGmailRequest(
      'POST',
      `/messages/${this.entityId}/trash`,
      undefined
    )

    if (!response.ok) {
      const error = await this.parseApiError(response)
      throw new Error(`Gmail trash failed: ${error}`)
    }

    logger.debug('delete-modifier', 'Email trashed via Gmail API', {
      entityId: this.entityId,
    })
  }

  /**
   * Outlook: Move to deleted items
   */
  private async persistOutlook(): Promise<void> {
    const response = await this.executeOutlookRequest('POST', `/messages/${this.entityId}/move`, {
      destinationId: 'deleteditems',
    })

    if (!response.ok) {
      const error = await this.parseApiError(response)
      throw new Error(`Outlook delete failed: ${error}`)
    }

    logger.debug('delete-modifier', 'Email deleted via Outlook API', {
      entityId: this.entityId,
    })
  }

  /**
   * Get payload for serialization
   */
  getPayload(): Record<string, unknown> {
    return {
      currentFolder: this.currentFolder,
      currentLabels: this.currentLabels,
    }
  }
}

/**
 * Undelete Modifier
 *
 * Restores an email from trash.
 * - Gmail: Calls messages.untrash
 * - Outlook: Moves from DeletedItems to Inbox
 */
export class UndeleteModifier extends BaseEmailModifier {
  readonly type = 'undelete' as const
  private readonly currentFolder: string
  private readonly currentLabels: string[]
  private readonly restoreFolder: string

  constructor(params: DeleteModifierParams & { restoreFolder?: string }) {
    super(params.entityId, params.accountId, params.provider)
    this.currentFolder = params.currentFolder
    this.currentLabels = params.currentLabels
    // Default to inbox when restoring
    this.restoreFolder = (params as { restoreFolder?: string }).restoreFolder || 'inbox'
  }

  /**
   * Static factory for reconstruction from document
   */
  static fromPayload(
    entityId: string,
    accountId: string,
    provider: ProviderType,
    payload: { currentFolder: string; currentLabels: string[]; restoreFolder?: string },
    id?: string,
    createdAt?: number
  ): UndeleteModifier {
    const modifier = new UndeleteModifier({
      entityId,
      accountId,
      provider,
      currentFolder: payload.currentFolder,
      currentLabels: payload.currentLabels,
      restoreFolder: payload.restoreFolder,
    })
    if (id) Object.assign(modifier, { id })
    if (createdAt) Object.assign(modifier, { createdAt })
    return modifier
  }

  /**
   * Transform email state to restore from trash
   */
  modify(email: EmailDocument): EmailDocument {
    // Remove TRASH label, restore INBOX
    const newLabels = email.labels
      .filter((l) => l !== 'TRASH')
      .concat(this.restoreFolder === 'inbox' ? 'INBOX' : [])

    return {
      ...email,
      folder: this.restoreFolder,
      labels: newLabels,
    }
  }

  /**
   * Sync undelete action to backend
   */
  async persist(): Promise<void> {
    if (this.provider === 'gmail') {
      await this.persistGmail()
    } else {
      await this.persistOutlook()
    }
  }

  /**
   * Gmail: Restore from trash
   */
  private async persistGmail(): Promise<void> {
    const response = await this.executeGmailRequest(
      'POST',
      `/messages/${this.entityId}/untrash`,
      undefined
    )

    if (!response.ok) {
      const error = await this.parseApiError(response)
      throw new Error(`Gmail untrash failed: ${error}`)
    }

    logger.debug('delete-modifier', 'Email restored via Gmail API', {
      entityId: this.entityId,
    })
  }

  /**
   * Outlook: Move from deleted items to inbox
   */
  private async persistOutlook(): Promise<void> {
    const destinationId = this.restoreFolder === 'inbox' ? 'inbox' : this.restoreFolder
    const response = await this.executeOutlookRequest('POST', `/messages/${this.entityId}/move`, {
      destinationId,
    })

    if (!response.ok) {
      const error = await this.parseApiError(response)
      throw new Error(`Outlook restore failed: ${error}`)
    }

    logger.debug('delete-modifier', 'Email restored via Outlook API', {
      entityId: this.entityId,
    })
  }

  /**
   * Get payload for serialization
   */
  getPayload(): Record<string, unknown> {
    return {
      currentFolder: this.currentFolder,
      currentLabels: this.currentLabels,
      restoreFolder: this.restoreFolder,
    }
  }
}
