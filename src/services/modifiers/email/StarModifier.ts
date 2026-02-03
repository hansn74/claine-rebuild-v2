/**
 * Star Modifier
 *
 * Epic 3: Offline-First Modifier Architecture
 * Story 3.2: Email Action Modifiers
 *
 * Modifier for starring and unstarring emails.
 * - Gmail: Add/remove STARRED label
 * - Outlook: Set flag property
 */

import { logger } from '@/services/logger'
import type { EmailDocument } from '@/services/database/schemas/email.schema'
import type { StarModifierParams, ProviderType } from '../types'
import { BaseEmailModifier } from './BaseEmailModifier'

/**
 * Star Modifier
 *
 * Stars an email.
 * - Gmail: Adds STARRED label
 * - Outlook: Sets flag.flagStatus = flagged
 */
export class StarModifier extends BaseEmailModifier {
  readonly type = 'star' as const
  private readonly currentLabels: string[]

  constructor(params: StarModifierParams) {
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
  ): StarModifier {
    const modifier = new StarModifier({
      entityId,
      accountId,
      provider,
      currentLabels: payload.currentLabels,
      star: true,
    })
    if (id) Object.assign(modifier, { id })
    if (createdAt) Object.assign(modifier, { createdAt })
    return modifier
  }

  /**
   * Transform email state to starred
   */
  modify(email: EmailDocument): EmailDocument {
    // Add STARRED to labels if not present
    const newLabels = email.labels.includes('STARRED') ? email.labels : [...email.labels, 'STARRED']

    return {
      ...email,
      starred: true,
      labels: newLabels,
    }
  }

  /**
   * Sync star action to backend
   */
  async persist(): Promise<void> {
    if (this.provider === 'gmail') {
      await this.persistGmail()
    } else {
      await this.persistOutlook()
    }
  }

  /**
   * Gmail: Add STARRED label
   */
  private async persistGmail(): Promise<void> {
    const response = await this.executeGmailRequest('POST', `/messages/${this.entityId}/modify`, {
      addLabelIds: ['STARRED'],
    })

    if (!response.ok) {
      const error = await this.parseApiError(response)
      throw new Error(`Gmail star failed: ${error}`)
    }

    logger.debug('star-modifier', 'Email starred via Gmail API', {
      entityId: this.entityId,
    })
  }

  /**
   * Outlook: Set flag status to flagged
   */
  private async persistOutlook(): Promise<void> {
    const response = await this.executeOutlookRequest('PATCH', `/messages/${this.entityId}`, {
      flag: {
        flagStatus: 'flagged',
      },
    })

    if (!response.ok) {
      const error = await this.parseApiError(response)
      throw new Error(`Outlook star failed: ${error}`)
    }

    logger.debug('star-modifier', 'Email starred via Outlook API', {
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
 * Unstar Modifier
 *
 * Removes star from an email.
 * - Gmail: Removes STARRED label
 * - Outlook: Sets flag.flagStatus = notFlagged
 */
export class UnstarModifier extends BaseEmailModifier {
  readonly type = 'unstar' as const
  private readonly currentLabels: string[]

  constructor(params: StarModifierParams) {
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
  ): UnstarModifier {
    const modifier = new UnstarModifier({
      entityId,
      accountId,
      provider,
      currentLabels: payload.currentLabels,
      star: false,
    })
    if (id) Object.assign(modifier, { id })
    if (createdAt) Object.assign(modifier, { createdAt })
    return modifier
  }

  /**
   * Transform email state to unstarred
   */
  modify(email: EmailDocument): EmailDocument {
    // Remove STARRED from labels
    const newLabels = email.labels.filter((l) => l !== 'STARRED')

    return {
      ...email,
      starred: false,
      labels: newLabels,
    }
  }

  /**
   * Sync unstar action to backend
   */
  async persist(): Promise<void> {
    if (this.provider === 'gmail') {
      await this.persistGmail()
    } else {
      await this.persistOutlook()
    }
  }

  /**
   * Gmail: Remove STARRED label
   */
  private async persistGmail(): Promise<void> {
    const response = await this.executeGmailRequest('POST', `/messages/${this.entityId}/modify`, {
      removeLabelIds: ['STARRED'],
    })

    if (!response.ok) {
      const error = await this.parseApiError(response)
      throw new Error(`Gmail unstar failed: ${error}`)
    }

    logger.debug('star-modifier', 'Email unstarred via Gmail API', {
      entityId: this.entityId,
    })
  }

  /**
   * Outlook: Set flag status to not flagged
   */
  private async persistOutlook(): Promise<void> {
    const response = await this.executeOutlookRequest('PATCH', `/messages/${this.entityId}`, {
      flag: {
        flagStatus: 'notFlagged',
      },
    })

    if (!response.ok) {
      const error = await this.parseApiError(response)
      throw new Error(`Outlook unstar failed: ${error}`)
    }

    logger.debug('star-modifier', 'Email unstarred via Outlook API', {
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
