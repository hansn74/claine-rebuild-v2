/**
 * Compose Helpers
 *
 * Story 2.3: Compose & Reply Interface
 * Shared utilities for building reply/forward compose context.
 * Used by both keyboard shortcuts and UI buttons.
 */

import type { ComposeContext } from '@/components/compose/ComposeDialog'
import type { EmailDocument } from '@/services/database/schemas/email.schema'

/**
 * Build compose context for replying to an email
 */
export function buildReplyContext(email: EmailDocument): ComposeContext {
  const date = new Date(email.timestamp).toLocaleString()
  const sender = email.from.name || email.from.email
  const body = email.body?.html || email.body?.text || ''

  return {
    type: 'reply',
    to: [email.from],
    cc: [],
    subject: email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`,
    quotedContent: `<br><br><div style="border-left: 2px solid #ccc; padding-left: 10px; margin-left: 10px;">On ${date}, ${sender} wrote:<br>${body}</div>`,
    replyToEmailId: email.id,
    threadId: email.threadId,
  }
}

/**
 * Build compose context for reply-all
 */
export function buildReplyAllContext(email: EmailDocument): ComposeContext {
  const date = new Date(email.timestamp).toLocaleString()
  const sender = email.from.name || email.from.email
  const body = email.body?.html || email.body?.text || ''
  const allRecipients = [...email.to, ...(email.cc || [])]

  return {
    type: 'reply-all',
    to: [email.from],
    cc: allRecipients,
    subject: email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`,
    quotedContent: `<br><br><div style="border-left: 2px solid #ccc; padding-left: 10px; margin-left: 10px;">On ${date}, ${sender} wrote:<br>${body}</div>`,
    replyToEmailId: email.id,
    threadId: email.threadId,
  }
}

/**
 * Build compose context for forwarding an email
 */
export function buildForwardContext(email: EmailDocument): ComposeContext {
  const date = new Date(email.timestamp).toLocaleString()
  const sender = email.from.name || email.from.email
  const body = email.body?.html || email.body?.text || ''

  return {
    type: 'forward',
    to: [],
    cc: [],
    subject: email.subject.startsWith('Fwd:') ? email.subject : `Fwd: ${email.subject}`,
    quotedContent: `<br><br><div style="border-left: 2px solid #ccc; padding-left: 10px; margin-left: 10px;">---------- Forwarded message ---------<br>From: ${sender}<br>Date: ${date}<br>Subject: ${email.subject}<br><br>${body}</div>`,
    replyToEmailId: email.id,
    threadId: email.threadId,
  }
}
