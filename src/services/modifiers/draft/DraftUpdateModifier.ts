/**
 * Draft Update Modifier
 *
 * Epic 3: Offline-First Modifier Architecture
 * Story 3.3: Draft Modifiers
 *
 * Modifier for updating drafts.
 * - Gmail: Create/update draft via drafts API
 * - Outlook: Create/update message in drafts folder
 */

import { logger } from '@/services/logger'
import { getDatabase, isDatabaseInitialized } from '@/services/database/init'
import type { DraftDocument } from '@/services/database/schemas/draft.schema'
import type { DraftUpdateModifierParams, ProviderType } from '../types'
import { BaseDraftModifier, GMAIL_API_BASE, GRAPH_API_BASE } from './BaseDraftModifier'

/**
 * Build RFC 2822 email message from draft data (for Gmail)
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
 * Draft Update Modifier
 *
 * Syncs draft updates to the server.
 * Creates a new remote draft if one doesn't exist.
 */
export class DraftUpdateModifier extends BaseDraftModifier {
  readonly type = 'draft-update' as const
  private readonly updates: Partial<DraftDocument>
  private remoteDraftId?: string

  constructor(params: DraftUpdateModifierParams) {
    super(params.entityId, params.accountId, params.provider)
    this.updates = params.updates
    this.remoteDraftId = params.remoteDraftId
  }

  /**
   * Static factory for reconstruction from document
   */
  static fromPayload(
    entityId: string,
    accountId: string,
    provider: ProviderType,
    payload: { updates: Partial<DraftDocument>; remoteDraftId?: string },
    id?: string,
    createdAt?: number
  ): DraftUpdateModifier {
    const modifier = new DraftUpdateModifier({
      entityId,
      accountId,
      provider,
      updates: payload.updates,
      remoteDraftId: payload.remoteDraftId,
    })
    if (id) Object.assign(modifier, { id })
    if (createdAt) Object.assign(modifier, { createdAt })
    return modifier
  }

  /**
   * Transform draft state with updates
   */
  modify(draft: DraftDocument): DraftDocument {
    return {
      ...draft,
      ...this.updates,
      lastSaved: Date.now(),
    }
  }

  /**
   * Sync draft update to backend
   */
  async persist(): Promise<void> {
    // Get the full draft from the database
    const draft = await this.getDraftFromDb()
    if (!draft) {
      throw new Error(`Draft not found: ${this.entityId}`)
    }

    let newRemoteDraftId: string | undefined

    if (this.provider === 'gmail') {
      newRemoteDraftId = await this.persistGmail(draft)
    } else {
      newRemoteDraftId = await this.persistOutlook(draft)
    }

    // Update the draft with the new remote ID if we got one
    if (newRemoteDraftId && newRemoteDraftId !== draft.remoteDraftId) {
      await this.updateDraftRemoteId(newRemoteDraftId)
    }
  }

  /**
   * Get draft from database
   */
  private async getDraftFromDb(): Promise<DraftDocument | null> {
    if (!isDatabaseInitialized()) return null

    const db = getDatabase()
    if (!db.drafts) return null

    const doc = await db.drafts.findOne(this.entityId).exec()
    if (!doc) return null

    return doc.toJSON() as DraftDocument
  }

  /**
   * Update draft's remote ID in database
   */
  private async updateDraftRemoteId(remoteDraftId: string): Promise<void> {
    if (!isDatabaseInitialized()) return

    const db = getDatabase()
    if (!db.drafts) return

    const doc = await db.drafts.findOne(this.entityId).exec()
    if (doc) {
      await doc.patch({
        remoteDraftId,
        syncedAt: Date.now(),
      })
    }
  }

  /**
   * Gmail: Create or update draft
   */
  private async persistGmail(draft: DraftDocument): Promise<string | undefined> {
    const message = buildRfc2822Message(draft)
    const encodedMessage = base64UrlEncode(message)

    if (draft.remoteDraftId) {
      // Update existing draft
      const response = await this.executeGmailRequest('PUT', `/drafts/${draft.remoteDraftId}`, {
        id: draft.remoteDraftId,
        message: {
          raw: encodedMessage,
        },
      })

      if (!response.ok) {
        // If 404, the draft was deleted - create a new one
        if (response.status === 404) {
          return this.createGmailDraft(draft, encodedMessage)
        }
        const error = await this.parseApiError(response)
        throw new Error(`Gmail draft update failed: ${error}`)
      }

      logger.debug('draft-update-modifier', 'Draft updated via Gmail API', {
        entityId: this.entityId,
        remoteDraftId: draft.remoteDraftId,
      })

      return draft.remoteDraftId
    } else {
      // Create new draft
      return this.createGmailDraft(draft, encodedMessage)
    }
  }

  /**
   * Create a new Gmail draft
   */
  private async createGmailDraft(draft: DraftDocument, encodedMessage: string): Promise<string> {
    const accessToken = await this.getAccessToken()
    const url = `${GMAIL_API_BASE}/drafts`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          raw: encodedMessage,
          threadId: draft.threadId,
        },
      }),
    })

    if (!response.ok) {
      const error = await this.parseApiError(response)
      throw new Error(`Gmail draft create failed: ${error}`)
    }

    const data = await response.json()
    const remoteDraftId = data.id

    logger.info('draft-update-modifier', 'Draft created via Gmail API', {
      entityId: this.entityId,
      remoteDraftId,
    })

    return remoteDraftId
  }

  /**
   * Outlook: Create or update draft
   */
  private async persistOutlook(draft: DraftDocument): Promise<string | undefined> {
    const message = buildGraphMessage(draft)

    if (draft.remoteDraftId) {
      // Update existing draft
      const response = await this.executeOutlookRequest(
        'PATCH',
        `/messages/${draft.remoteDraftId}`,
        message
      )

      if (!response.ok) {
        // If 404, the draft was deleted - create a new one
        if (response.status === 404) {
          return this.createOutlookDraft(message)
        }
        const error = await this.parseApiError(response)
        throw new Error(`Outlook draft update failed: ${error}`)
      }

      logger.debug('draft-update-modifier', 'Draft updated via Outlook API', {
        entityId: this.entityId,
        remoteDraftId: draft.remoteDraftId,
      })

      return draft.remoteDraftId
    } else {
      // Create new draft
      return this.createOutlookDraft(message)
    }
  }

  /**
   * Create a new Outlook draft
   */
  private async createOutlookDraft(message: Record<string, unknown>): Promise<string> {
    const accessToken = await this.getAccessToken()
    const url = `${GRAPH_API_BASE}/messages`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    })

    if (!response.ok) {
      const error = await this.parseApiError(response)
      throw new Error(`Outlook draft create failed: ${error}`)
    }

    const data = await response.json()
    const remoteDraftId = data.id

    logger.info('draft-update-modifier', 'Draft created via Outlook API', {
      entityId: this.entityId,
      remoteDraftId,
    })

    return remoteDraftId
  }

  /**
   * Get payload for serialization
   */
  getPayload(): Record<string, unknown> {
    return {
      updates: this.updates,
      remoteDraftId: this.remoteDraftId,
    }
  }
}
