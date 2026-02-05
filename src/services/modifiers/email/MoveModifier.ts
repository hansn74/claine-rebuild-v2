/**
 * Move Modifier
 *
 * Epic 3: Offline-First Modifier Architecture
 * Story 3.2: Email Action Modifiers
 *
 * Modifier for moving emails between folders/labels.
 * - Gmail: Add/remove labels
 * - Outlook: Move to folder
 */

import { logger } from '@/services/logger'
import type { EmailDocument } from '@/services/database/schemas/email.schema'
import type { MoveModifierParams, ProviderType } from '../types'
import { BaseEmailModifier } from './BaseEmailModifier'

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
 * Move Modifier
 *
 * Moves an email to a different folder/label.
 * - Gmail: Add target label, remove source label
 * - Outlook: Move message to folder
 */
export class MoveModifier extends BaseEmailModifier {
  readonly type = 'move' as const
  private readonly targetFolder: string
  private readonly sourceFolder: string
  private readonly currentLabels: string[]

  constructor(params: MoveModifierParams) {
    super(params.entityId, params.accountId, params.provider, undefined, undefined, params.threadId)
    this.targetFolder = params.targetFolder
    this.sourceFolder = params.sourceFolder
    this.currentLabels = params.currentLabels
  }

  /**
   * Static factory for reconstruction from document
   */
  static fromPayload(
    entityId: string,
    accountId: string,
    provider: ProviderType,
    payload: { targetFolder: string; sourceFolder: string; currentLabels: string[] },
    id?: string,
    createdAt?: number,
    threadId?: string
  ): MoveModifier {
    const modifier = new MoveModifier({
      entityId,
      accountId,
      provider,
      targetFolder: payload.targetFolder,
      sourceFolder: payload.sourceFolder,
      currentLabels: payload.currentLabels,
      threadId,
    })
    if (id) Object.assign(modifier, { id })
    if (createdAt) Object.assign(modifier, { createdAt })
    return modifier
  }

  /**
   * Transform email state to new folder
   */
  modify(email: EmailDocument): EmailDocument {
    // Update folder
    let newLabels = [...email.labels]

    // Remove source folder label
    const sourceLabelId = FOLDER_TO_GMAIL_LABEL[this.sourceFolder] || this.sourceFolder
    if (sourceLabelId) {
      newLabels = newLabels.filter((l) => l !== sourceLabelId)
    }

    // Add target folder label (unless archive)
    if (this.targetFolder !== 'archive') {
      const targetLabelId = FOLDER_TO_GMAIL_LABEL[this.targetFolder] || this.targetFolder
      if (targetLabelId && !newLabels.includes(targetLabelId)) {
        newLabels.push(targetLabelId)
      }
    }

    return {
      ...email,
      folder: this.targetFolder,
      labels: newLabels,
    }
  }

  /**
   * Sync move action to backend
   */
  async persist(): Promise<void> {
    if (this.provider === 'gmail') {
      await this.persistGmail()
    } else {
      await this.persistOutlook()
    }
  }

  /**
   * Gmail: Modify labels
   */
  private async persistGmail(): Promise<void> {
    const addLabelIds: string[] = []
    const removeLabelIds: string[] = []

    // Get Gmail label ID for target folder
    const targetLabelId = FOLDER_TO_GMAIL_LABEL[this.targetFolder] || this.targetFolder

    // Get Gmail label ID for source folder
    const sourceLabelId = FOLDER_TO_GMAIL_LABEL[this.sourceFolder] || this.sourceFolder

    // Special handling for archive (remove INBOX, don't add any)
    if (this.targetFolder === 'archive') {
      removeLabelIds.push('INBOX')
    } else {
      // Add target label
      if (targetLabelId) {
        addLabelIds.push(targetLabelId)
      }

      // Remove source label (if it's a system folder)
      if (sourceLabelId && sourceLabelId !== targetLabelId) {
        removeLabelIds.push(sourceLabelId)
      }
    }

    // Skip if no changes needed
    if (addLabelIds.length === 0 && removeLabelIds.length === 0) {
      logger.debug('move-modifier', 'No label changes needed', {
        entityId: this.entityId,
      })
      return
    }

    const body: { addLabelIds?: string[]; removeLabelIds?: string[] } = {}
    if (addLabelIds.length > 0) {
      body.addLabelIds = addLabelIds
    }
    if (removeLabelIds.length > 0) {
      body.removeLabelIds = removeLabelIds
    }

    const response = await this.executeGmailRequest(
      'POST',
      `/messages/${this.entityId}/modify`,
      body
    )

    if (!response.ok) {
      const error = await this.parseApiError(response)
      throw new Error(`Gmail move failed: ${error}`)
    }

    logger.debug('move-modifier', 'Email moved via Gmail API', {
      entityId: this.entityId,
      from: this.sourceFolder,
      to: this.targetFolder,
    })
  }

  /**
   * Outlook: Move message to folder
   */
  private async persistOutlook(): Promise<void> {
    // Get Outlook folder ID or well-known name
    const destinationId = FOLDER_TO_OUTLOOK_NAME[this.targetFolder] || this.targetFolder

    const response = await this.executeOutlookRequest('POST', `/messages/${this.entityId}/move`, {
      destinationId,
    })

    if (!response.ok) {
      const error = await this.parseApiError(response)
      throw new Error(`Outlook move failed: ${error}`)
    }

    logger.debug('move-modifier', 'Email moved via Outlook API', {
      entityId: this.entityId,
      from: this.sourceFolder,
      to: this.targetFolder,
    })
  }

  /**
   * Get payload for serialization
   */
  getPayload(): Record<string, unknown> {
    return {
      targetFolder: this.targetFolder,
      sourceFolder: this.sourceFolder,
      currentLabels: this.currentLabels,
    }
  }
}
