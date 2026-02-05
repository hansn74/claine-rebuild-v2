/**
 * Archive Modifier
 *
 * Epic 3: Offline-First Modifier Architecture
 * Story 3.2: Email Action Modifiers
 *
 * Modifier for archiving and unarchiving emails.
 * - Gmail: Remove/add INBOX label
 * - Outlook: Move to/from Archive folder
 */

import { logger } from '@/services/logger'
import type { EmailDocument } from '@/services/database/schemas/email.schema'
import type { ArchiveModifierParams, ProviderType } from '../types'
import { BaseEmailModifier } from './BaseEmailModifier'

/**
 * Archive Modifier
 *
 * Archives an email by removing it from the inbox.
 * - Gmail: Removes INBOX label
 * - Outlook: Moves to Archive folder
 */
export class ArchiveModifier extends BaseEmailModifier {
  readonly type = 'archive' as const
  private readonly currentLabels: string[]
  private readonly currentFolder: string

  constructor(params: ArchiveModifierParams) {
    super(params.entityId, params.accountId, params.provider, undefined, undefined, params.threadId)
    this.currentLabels = params.currentLabels
    this.currentFolder = params.currentFolder
  }

  /**
   * Static factory for reconstruction from document
   */
  static fromPayload(
    entityId: string,
    accountId: string,
    provider: ProviderType,
    payload: { currentLabels: string[]; currentFolder: string },
    id?: string,
    createdAt?: number,
    threadId?: string
  ): ArchiveModifier {
    const modifier = new ArchiveModifier({
      entityId,
      accountId,
      provider,
      currentLabels: payload.currentLabels,
      currentFolder: payload.currentFolder,
      threadId,
    })
    if (id) Object.assign(modifier, { id })
    if (createdAt) Object.assign(modifier, { createdAt })
    return modifier
  }

  /**
   * Transform email state to archived
   */
  modify(email: EmailDocument): EmailDocument {
    // Remove INBOX from labels
    const newLabels = email.labels.filter((l) => l !== 'INBOX')

    return {
      ...email,
      folder: 'archive',
      labels: newLabels,
    }
  }

  /**
   * Sync archive action to backend
   */
  async persist(): Promise<void> {
    if (this.provider === 'gmail') {
      await this.persistGmail()
    } else {
      await this.persistOutlook()
    }
  }

  /**
   * Gmail: Remove INBOX label
   */
  private async persistGmail(): Promise<void> {
    const response = await this.executeGmailRequest('POST', `/messages/${this.entityId}/modify`, {
      removeLabelIds: ['INBOX'],
    })

    if (!response.ok) {
      const error = await this.parseApiError(response)
      throw new Error(`Gmail archive failed: ${error}`)
    }

    logger.debug('archive-modifier', 'Email archived via Gmail API', {
      entityId: this.entityId,
    })
  }

  /**
   * Outlook: Move to archive folder
   */
  private async persistOutlook(): Promise<void> {
    const response = await this.executeOutlookRequest('POST', `/messages/${this.entityId}/move`, {
      destinationId: 'archive',
    })

    if (!response.ok) {
      const error = await this.parseApiError(response)
      throw new Error(`Outlook archive failed: ${error}`)
    }

    logger.debug('archive-modifier', 'Email archived via Outlook API', {
      entityId: this.entityId,
    })
  }

  /**
   * Get payload for serialization
   */
  getPayload(): Record<string, unknown> {
    return {
      currentLabels: this.currentLabels,
      currentFolder: this.currentFolder,
    }
  }
}

/**
 * Unarchive Modifier
 *
 * Restores an archived email to the inbox.
 * - Gmail: Adds INBOX label
 * - Outlook: Moves back to Inbox folder
 */
export class UnarchiveModifier extends BaseEmailModifier {
  readonly type = 'unarchive' as const
  private readonly currentLabels: string[]
  private readonly currentFolder: string

  constructor(params: ArchiveModifierParams) {
    super(params.entityId, params.accountId, params.provider, undefined, undefined, params.threadId)
    this.currentLabels = params.currentLabels
    this.currentFolder = params.currentFolder
  }

  /**
   * Static factory for reconstruction from document
   */
  static fromPayload(
    entityId: string,
    accountId: string,
    provider: ProviderType,
    payload: { currentLabels: string[]; currentFolder: string },
    id?: string,
    createdAt?: number,
    threadId?: string
  ): UnarchiveModifier {
    const modifier = new UnarchiveModifier({
      entityId,
      accountId,
      provider,
      currentLabels: payload.currentLabels,
      currentFolder: payload.currentFolder,
      threadId,
    })
    if (id) Object.assign(modifier, { id })
    if (createdAt) Object.assign(modifier, { createdAt })
    return modifier
  }

  /**
   * Transform email state to inbox
   */
  modify(email: EmailDocument): EmailDocument {
    // Add INBOX to labels if not present
    const newLabels = email.labels.includes('INBOX') ? email.labels : [...email.labels, 'INBOX']

    return {
      ...email,
      folder: 'inbox',
      labels: newLabels,
    }
  }

  /**
   * Sync unarchive action to backend
   */
  async persist(): Promise<void> {
    if (this.provider === 'gmail') {
      await this.persistGmail()
    } else {
      await this.persistOutlook()
    }
  }

  /**
   * Gmail: Add INBOX label
   */
  private async persistGmail(): Promise<void> {
    const response = await this.executeGmailRequest('POST', `/messages/${this.entityId}/modify`, {
      addLabelIds: ['INBOX'],
    })

    if (!response.ok) {
      const error = await this.parseApiError(response)
      throw new Error(`Gmail unarchive failed: ${error}`)
    }

    logger.debug('archive-modifier', 'Email unarchived via Gmail API', {
      entityId: this.entityId,
    })
  }

  /**
   * Outlook: Move back to inbox
   */
  private async persistOutlook(): Promise<void> {
    const response = await this.executeOutlookRequest('POST', `/messages/${this.entityId}/move`, {
      destinationId: 'inbox',
    })

    if (!response.ok) {
      const error = await this.parseApiError(response)
      throw new Error(`Outlook unarchive failed: ${error}`)
    }

    logger.debug('archive-modifier', 'Email unarchived via Outlook API', {
      entityId: this.entityId,
    })
  }

  /**
   * Get payload for serialization
   */
  getPayload(): Record<string, unknown> {
    return {
      currentLabels: this.currentLabels,
      currentFolder: this.currentFolder,
    }
  }
}
