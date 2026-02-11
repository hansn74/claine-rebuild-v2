/**
 * Thread Context Analysis
 *
 * Story 3.2: Email Analysis Engine
 * Task 3: Thread context analysis (AC: 4)
 *
 * Extracts conversation context from email threads:
 * - Thread position (first message, reply, follow-up)
 * - Urgency escalation detection
 * - Thread summary for LLM prompt
 */

import type { EmailDocument } from '@/services/database/schemas/email.schema'

/**
 * Thread context for a specific email within its thread
 */
export interface ThreadContext {
  /** Thread ID */
  threadId: string
  /** Total messages in thread */
  messageCount: number
  /** Position of this email in thread (1-based) */
  position: number
  /** Whether this is the first message in thread */
  isFirstMessage: boolean
  /** Whether this is the latest message */
  isLatestMessage: boolean
  /** Unique participants in thread */
  participantCount: number
  /** Participants (email addresses) */
  participants: string[]
  /** Whether urgency escalated in recent messages */
  urgencyEscalated: boolean
  /** Context summary string for LLM prompt */
  contextSummary: string
}

/**
 * Analyze thread context for a specific email
 *
 * @param email The email being analyzed
 * @param threadEmails All emails in the thread, sorted by timestamp ASC
 */
export function analyzeThreadContext(
  email: EmailDocument,
  threadEmails: EmailDocument[]
): ThreadContext {
  const sorted = [...threadEmails].sort((a, b) => a.timestamp - b.timestamp)
  const position = sorted.findIndex((e) => e.id === email.id) + 1
  const messageCount = sorted.length

  // Collect unique participants
  const participantSet = new Set<string>()
  for (const e of sorted) {
    participantSet.add(e.from.email.toLowerCase())
    for (const to of e.to) {
      participantSet.add(to.email.toLowerCase())
    }
  }
  const participants = Array.from(participantSet)

  // Detect urgency escalation
  const urgencyEscalated = detectUrgencyEscalation(sorted, position)

  const contextSummary = buildThreadSummary(
    messageCount,
    position,
    participants.length,
    urgencyEscalated,
    sorted
  )

  return {
    threadId: email.threadId,
    messageCount,
    position,
    isFirstMessage: position === 1,
    isLatestMessage: position === messageCount,
    participantCount: participants.length,
    participants,
    urgencyEscalated,
    contextSummary,
  }
}

/**
 * Create a minimal context for single-message threads
 */
export function createSingleMessageContext(email: EmailDocument): ThreadContext {
  const participants = new Set<string>()
  participants.add(email.from.email.toLowerCase())
  for (const to of email.to) {
    participants.add(to.email.toLowerCase())
  }

  return {
    threadId: email.threadId,
    messageCount: 1,
    position: 1,
    isFirstMessage: true,
    isLatestMessage: true,
    participantCount: participants.size,
    participants: Array.from(participants),
    urgencyEscalated: false,
    contextSummary: 'Single message (not part of a conversation)',
  }
}

// ============================================================================
// Internal helpers
// ============================================================================

const ESCALATION_KEYWORDS = [
  'urgent',
  'asap',
  'immediately',
  'still waiting',
  'following up',
  'follow up',
  'reminder',
  'second request',
  'third request',
  'no response',
  'please respond',
  "haven't heard",
  "haven't received",
]

function detectUrgencyEscalation(sorted: EmailDocument[], currentPosition: number): boolean {
  if (sorted.length < 2 || currentPosition <= 1) return false

  // Check if recent messages (last 2-3) contain escalation keywords
  // that weren't in earlier messages
  const recentStart = Math.max(0, currentPosition - 3)
  const recentEmails = sorted.slice(recentStart, currentPosition)
  const earlierEmails = sorted.slice(0, recentStart)

  const recentText = recentEmails
    .map((e) => `${e.subject} ${e.body.text || e.snippet || ''}`.toLowerCase())
    .join(' ')

  const earlierText = earlierEmails
    .map((e) => `${e.subject} ${e.body.text || e.snippet || ''}`.toLowerCase())
    .join(' ')

  // Escalation = urgency keywords appear in recent but not earlier messages
  for (const keyword of ESCALATION_KEYWORDS) {
    if (recentText.includes(keyword) && !earlierText.includes(keyword)) {
      return true
    }
  }

  return false
}

function buildThreadSummary(
  messageCount: number,
  position: number,
  participantCount: number,
  urgencyEscalated: boolean,
  sorted: EmailDocument[]
): string {
  if (messageCount === 1) {
    return 'Single message (not part of a conversation)'
  }

  const parts: string[] = []

  parts.push(`Thread with ${messageCount} messages, ${participantCount} participants`)

  if (position === 1) {
    parts.push('This is the first message in the thread')
  } else if (position === messageCount) {
    parts.push(`This is the latest message (#${position} of ${messageCount})`)
  } else {
    parts.push(`This is message #${position} of ${messageCount}`)
  }

  if (urgencyEscalated) {
    parts.push('Urgency has escalated in recent messages')
  }

  // Brief summary of thread progression
  if (messageCount > 1 && sorted.length > 1) {
    const firstSender = sorted[0].from.email
    const latestSender = sorted[sorted.length - 1].from.email
    if (firstSender !== latestSender) {
      parts.push(`Started by ${firstSender}, latest from ${latestSender}`)
    }
  }

  return parts.join('. ')
}
