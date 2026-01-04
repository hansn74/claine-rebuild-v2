/**
 * Email Compose Utilities
 *
 * Story 2.3: Compose & Reply Interface
 * Task 5: Implement Reply/Reply-All/Forward Actions
 * Task 6: Implement Subject Line Auto-Population
 *
 * Features:
 * - Reply context creation with sender as recipient (AC2)
 * - Reply-all with all participants (AC2)
 * - Forward context with forwarded message format
 * - Subject line auto-population with Re:/Fwd: prefixes (AC5)
 * - Quoted content formatting
 */

import type { EmailAddress, EmailBody } from '@/services/database/schemas/email.schema'
import type { DraftType } from '@/services/database/schemas/draft.schema'

/**
 * Context for composing a new email or reply/forward
 */
export interface ComposeContext {
  type: DraftType
  to: EmailAddress[]
  cc: EmailAddress[]
  subject: string
  quotedContent: string
  replyToEmailId?: string
  threadId?: string
}

/**
 * Email data structure for creating compose context
 */
export interface EmailForCompose {
  id: string
  threadId: string
  from: EmailAddress
  to: EmailAddress[]
  cc?: EmailAddress[]
  subject: string
  body: EmailBody
  timestamp: number
}

/**
 * Create reply context for a single email
 * Pre-populates To field with original sender
 *
 * @param email - Original email to reply to
 * @param currentUserEmail - Current user's email to exclude from recipients
 * @returns ComposeContext for reply
 */
export function createReplyContext(
  email: EmailForCompose,
  _currentUserEmail?: string
): ComposeContext {
  // Reply to sender
  const to: EmailAddress[] = [email.from]

  // Subject with Re: prefix (avoid duplicates)
  const subject = formatReplySubject(email.subject)

  // Quoted content
  const quotedContent = formatQuotedMessage(email)

  return {
    type: 'reply',
    to,
    cc: [],
    subject,
    quotedContent,
    replyToEmailId: email.id,
    threadId: email.threadId,
  }
}

/**
 * Create reply-all context
 * Pre-populates To with sender and original To recipients,
 * Cc with original Cc recipients (excluding current user)
 *
 * @param email - Original email to reply to
 * @param currentUserEmail - Current user's email to exclude from recipients
 * @returns ComposeContext for reply-all
 */
export function createReplyAllContext(
  email: EmailForCompose,
  currentUserEmail?: string
): ComposeContext {
  // Start with original sender
  const allRecipients = [email.from]

  // Add original To recipients
  allRecipients.push(...email.to)

  // Filter out current user from recipients
  const filteredTo = currentUserEmail
    ? allRecipients.filter((addr) => addr.email.toLowerCase() !== currentUserEmail.toLowerCase())
    : allRecipients

  // Remove duplicates by email
  const uniqueTo = removeDuplicateEmails(filteredTo)

  // CC: Include original CC recipients (excluding current user and anyone in To)
  const toEmails = new Set(uniqueTo.map((addr) => addr.email.toLowerCase()))
  const filteredCc = (email.cc || []).filter(
    (addr) =>
      (!currentUserEmail || addr.email.toLowerCase() !== currentUserEmail.toLowerCase()) &&
      !toEmails.has(addr.email.toLowerCase())
  )

  // Subject with Re: prefix
  const subject = formatReplySubject(email.subject)

  // Quoted content
  const quotedContent = formatQuotedMessage(email)

  return {
    type: 'reply-all',
    to: uniqueTo,
    cc: filteredCc,
    subject,
    quotedContent,
    replyToEmailId: email.id,
    threadId: email.threadId,
  }
}

/**
 * Create forward context
 * No recipients pre-populated, subject with Fwd: prefix
 *
 * @param email - Original email to forward
 * @returns ComposeContext for forward
 */
export function createForwardContext(email: EmailForCompose): ComposeContext {
  // Forward: no recipients pre-populated
  const to: EmailAddress[] = []
  const cc: EmailAddress[] = []

  // Subject with Fwd: prefix
  const subject = formatForwardSubject(email.subject)

  // Forwarded content with header info
  const quotedContent = formatForwardedMessage(email)

  return {
    type: 'forward',
    to,
    cc,
    subject,
    quotedContent,
    replyToEmailId: email.id,
    threadId: email.threadId,
  }
}

/**
 * Format subject for reply (adds Re: prefix if not already present)
 * Handles nested Re: prefixes (doesn't duplicate)
 *
 * @param originalSubject - Original email subject
 * @returns Formatted subject with Re: prefix
 */
export function formatReplySubject(originalSubject: string): string {
  const trimmed = originalSubject.trim()

  // Check if already has Re: or RE: or re: prefix
  if (/^re:/i.test(trimmed)) {
    return trimmed
  }

  // Check for Fwd: prefix and remove it for replies
  if (/^fwd?:/i.test(trimmed)) {
    const withoutFwd = trimmed.replace(/^fwd?:\s*/i, '')
    return `Re: ${withoutFwd}`
  }

  return `Re: ${trimmed}`
}

/**
 * Format subject for forward (adds Fwd: prefix if not already present)
 * Handles nested Fwd: prefixes (doesn't duplicate)
 *
 * @param originalSubject - Original email subject
 * @returns Formatted subject with Fwd: prefix
 */
export function formatForwardSubject(originalSubject: string): string {
  const trimmed = originalSubject.trim()

  // Check if already has Fwd: or FWD: or fwd: prefix
  if (/^fwd?:/i.test(trimmed)) {
    return trimmed
  }

  // Keep Re: prefix if present, but add Fwd:
  return `Fwd: ${trimmed}`
}

/**
 * Format quoted message for reply
 * Creates "On [date], [sender] wrote:" format
 *
 * @param email - Original email to quote
 * @returns HTML-formatted quoted content
 */
export function formatQuotedMessage(email: EmailForCompose): string {
  const date = formatDate(email.timestamp)
  const sender = email.from.name || email.from.email
  const bodyText = email.body.text || stripHtml(email.body.html || '')

  return `
<br/><br/>
<div class="gmail_quote">
  <div class="gmail_attr">On ${date}, ${sender} &lt;${email.from.email}&gt; wrote:</div>
  <blockquote class="gmail_quote" style="margin:0 0 0 .8ex;border-left:1px solid #ccc;padding-left:1ex">
    ${escapeHtml(bodyText).replace(/\n/g, '<br/>')}
  </blockquote>
</div>
`
}

/**
 * Format forwarded message with full header info
 *
 * @param email - Original email to forward
 * @returns HTML-formatted forwarded content
 */
export function formatForwardedMessage(email: EmailForCompose): string {
  const date = formatDate(email.timestamp)
  const toList = email.to.map((t) => formatEmailAddress(t)).join(', ')
  const ccList = email.cc?.map((c) => formatEmailAddress(c)).join(', ')

  return `
<br/><br/>
<div class="gmail_forward">
  ---------- Forwarded message ---------<br/>
  From: ${formatEmailAddress(email.from)}<br/>
  Date: ${date}<br/>
  Subject: ${escapeHtml(email.subject)}<br/>
  To: ${escapeHtml(toList)}<br/>
  ${ccList ? `Cc: ${escapeHtml(ccList)}<br/>` : ''}
  <br/>
  ${email.body.html || escapeHtml(email.body.text || '').replace(/\n/g, '<br/>')}
</div>
`
}

/**
 * Remove duplicate email addresses from array
 */
function removeDuplicateEmails(addresses: EmailAddress[]): EmailAddress[] {
  const seen = new Set<string>()
  return addresses.filter((addr) => {
    const email = addr.email.toLowerCase()
    if (seen.has(email)) return false
    seen.add(email)
    return true
  })
}

/**
 * Format date for display in quoted message
 */
function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Format email address for display
 */
function formatEmailAddress(address: EmailAddress): string {
  if (address.name) {
    return `${address.name} <${address.email}>`
  }
  return address.email
}

/**
 * Strip HTML tags for plain text version
 */
function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return doc.body.textContent || ''
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}
