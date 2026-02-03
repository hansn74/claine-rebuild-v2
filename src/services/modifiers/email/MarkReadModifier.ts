/**
 * Mark Read/Unread Modifier
 *
 * Epic 3: Offline-First Modifier Architecture
 * Story 3.2: Email Action Modifiers
 *
 * Modifier for marking emails as read or unread.
 * - Gmail: Remove/add UNREAD label
 * - Outlook: Set isRead property
 */

import { logger } from '@/services/logger'
import type { EmailDocument } from '@/services/database/schemas/email.schema'
import type { MarkReadModifierParams, ProviderType } from '../types'
import { BaseEmailModifier } from './BaseEmailModifier'

/**
 * Mark Read Modifier
 *
 * Marks an email as read.
 * - Gmail: Removes UNREAD label
 * - Outlook: Sets isRead = true
 */
export class MarkReadModifier extends BaseEmailModifier {
  readonly type = 'mark-read' as const
  private readonly currentLabels: string[]

  constructor(params: MarkReadModifierParams) {
    super(params.entityId, params.accountId, params.provider)
    this.currentLabels = params.currentLabels
  }

  /**
   * Static factory for reconstruction from document
   */
  static fromPayload(
    entityId: string,
    accountId: string,
    provider: ProviderType,
    payload: { currentLabels: string[] },
    id?: string,
    createdAt?: number
  ): MarkReadModifier {
    const modifier = new MarkReadModifier({
      entityId,
      accountId,
      provider,
      currentLabels: payload.currentLabels,
      markAsRead: true,
    })
    if (id) Object.assign(modifier, { id })
    if (createdAt) Object.assign(modifier, { createdAt })
    return modifier
  }

  /**
   * Transform email state to read
   */
  modify(email: EmailDocument): EmailDocument {
    // Remove UNREAD from labels
    const newLabels = email.labels.filter((l) => l !== 'UNREAD')

    return {
      ...email,
      read: true,
      labels: newLabels,
    }
  }

  /**
   * Sync mark read action to backend
   */
  async persist(): Promise<void> {
    if (this.provider === 'gmail') {
      await this.persistGmail()
    } else {
      await this.persistOutlook()
    }
  }

  /**
   * Gmail: Remove UNREAD label
   */
  private async persistGmail(): Promise<void> {
    const response = await this.executeGmailRequest('POST', `/messages/${this.entityId}/modify`, {
      removeLabelIds: ['UNREAD'],
    })

    if (!response.ok) {
      const error = await this.parseApiError(response)
      throw new Error(`Gmail mark read failed: ${error}`)
    }

    logger.debug('mark-read-modifier', 'Email marked read via Gmail API', {
      entityId: this.entityId,
    })
  }

  /**
   * Outlook: Set isRead = true
   */
  private async persistOutlook(): Promise<void> {
    const response = await this.executeOutlookRequest('PATCH', `/messages/${this.entityId}`, {
      isRead: true,
    })

    if (!response.ok) {
      const error = await this.parseApiError(response)
      throw new Error(`Outlook mark read failed: ${error}`)
    }

    logger.debug('mark-read-modifier', 'Email marked read via Outlook API', {
      entityId: this.entityId,
    })
  }

  /**
   * Get payload for serialization
   */
  getPayload(): Record<string, unknown> {
    return {
      currentLabels: this.currentLabels,
    }
  }
}

/**
 * Mark Unread Modifier
 *
 * Marks an email as unread.
 * - Gmail: Adds UNREAD label
 * - Outlook: Sets isRead = false
 */
export class MarkUnreadModifier extends BaseEmailModifier {
  readonly type = 'mark-unread' as const
  private readonly currentLabels: string[]

  constructor(params: MarkReadModifierParams) {
    super(params.entityId, params.accountId, params.provider)
    this.currentLabels = params.currentLabels
  }

  /**
   * Static factory for reconstruction from document
   */
  static fromPayload(
    entityId: string,
    accountId: string,
    provider: ProviderType,
    payload: { currentLabels: string[] },
    id?: string,
    createdAt?: number
  ): MarkUnreadModifier {
    const modifier = new MarkUnreadModifier({
      entityId,
      accountId,
      provider,
      currentLabels: payload.currentLabels,
      markAsRead: false,
    })
    if (id) Object.assign(modifier, { id })
    if (createdAt) Object.assign(modifier, { createdAt })
    return modifier
  }

  /**
   * Transform email state to unread
   */
  modify(email: EmailDocument): EmailDocument {
    // Add UNREAD to labels if not present
    const newLabels = email.labels.includes('UNREAD') ? email.labels : [...email.labels, 'UNREAD']

    return {
      ...email,
      read: false,
      labels: newLabels,
    }
  }

  /**
   * Sync mark unread action to backend
   */
  async persist(): Promise<void> {
    if (this.provider === 'gmail') {
      await this.persistGmail()
    } else {
      await this.persistOutlook()
    }
  }

  /**
   * Gmail: Add UNREAD label
   */
  private async persistGmail(): Promise<void> {
    const response = await this.executeGmailRequest('POST', `/messages/${this.entityId}/modify`, {
      addLabelIds: ['UNREAD'],
    })

    if (!response.ok) {
      const error = await this.parseApiError(response)
      throw new Error(`Gmail mark unread failed: ${error}`)
    }

    logger.debug('mark-read-modifier', 'Email marked unread via Gmail API', {
      entityId: this.entityId,
    })
  }

  /**
   * Outlook: Set isRead = false
   */
  private async persistOutlook(): Promise<void> {
    const response = await this.executeOutlookRequest('PATCH', `/messages/${this.entityId}`, {
      isRead: false,
    })

    if (!response.ok) {
      const error = await this.parseApiError(response)
      throw new Error(`Outlook mark unread failed: ${error}`)
    }

    logger.debug('mark-read-modifier', 'Email marked unread via Outlook API', {
      entityId: this.entityId,
    })
  }

  /**
   * Get payload for serialization
   */
  getPayload(): Record<string, unknown> {
    return {
      currentLabels: this.currentLabels,
    }
  }
}
