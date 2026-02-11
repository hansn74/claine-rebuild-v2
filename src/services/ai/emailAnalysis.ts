/**
 * Email Analysis - Feature Extraction
 *
 * Story 3.2: Email Analysis Engine
 * Task 1: Feature extraction from emails (AC: 1, 3)
 *
 * Extracts structured features from email content for AI scoring:
 * - Sender info, subject, body analysis
 * - Urgency keyword detection
 * - Content signal classification (deadlines, questions, requests, FYI)
 * - Prompt building for LLM inference
 */

import { logger } from '@/services/logger'
import type { EmailDocument } from '@/services/database/schemas/email.schema'

/**
 * Content signal types detected in email body
 */
export type ContentSignal =
  | 'deadline'
  | 'question'
  | 'request'
  | 'fyi'
  | 'newsletter'
  | 'automated'
  | 'meeting'
  | 'approval'

/**
 * Extracted features from an email
 */
export interface EmailFeatures {
  emailId: string
  /** Sender email address (lowercase) */
  senderEmail: string
  /** Sender domain */
  senderDomain: string
  /** Whether sender is a noreply/automated address */
  isAutomatedSender: boolean
  /** Subject line (cleaned) */
  subject: string
  /** Whether subject has Re:/Fwd: prefix */
  isReply: boolean
  isForward: boolean
  /** Plain text body (truncated to limit) */
  bodyText: string
  /** Body word count */
  wordCount: number
  /** Detected urgency keywords */
  urgencyKeywords: string[]
  /** Urgency score based on keyword density (0-1) */
  urgencyScore: number
  /** Content signals detected */
  contentSignals: ContentSignal[]
  /** Whether email has attachments */
  hasAttachments: boolean
  /** Number of recipients (to + cc) */
  recipientCount: number
  /** Thread ID for context */
  threadId: string
  /** Email timestamp */
  timestamp: number
  /** Account ID */
  accountId: string
}

/**
 * Maximum body text length sent to LLM (tokens are expensive)
 */
const MAX_BODY_LENGTH = 2000

/**
 * Urgency keywords grouped by severity
 */
const URGENCY_KEYWORDS_HIGH = [
  'urgent',
  'asap',
  'immediately',
  'critical',
  'emergency',
  'time-sensitive',
  'time sensitive',
]

const URGENCY_KEYWORDS_MEDIUM = [
  'deadline',
  'due date',
  'eod',
  'end of day',
  'eob',
  'end of business',
  'by tomorrow',
  'by friday',
  'by monday',
  'action required',
  'action needed',
  'please respond',
  'waiting on',
  'waiting for',
  'follow up',
  'follow-up',
  'reminder',
]

const AUTOMATED_SENDER_PATTERNS = [
  'noreply',
  'no-reply',
  'donotreply',
  'do-not-reply',
  'notifications',
  'mailer-daemon',
  'postmaster',
  'bounce',
  'automated',
  'system',
  'alert',
  'digest',
]

const NEWSLETTER_PATTERNS = [
  'unsubscribe',
  'email preferences',
  'manage your subscription',
  'opt out',
  'view in browser',
  'view online',
  'email newsletter',
]

/**
 * Extract features from an email document
 */
export function extractEmailFeatures(email: EmailDocument): EmailFeatures {
  const senderEmail = email.from.email.toLowerCase()
  const senderDomain = senderEmail.split('@')[1] || ''
  const bodyText = getPlainText(email).slice(0, MAX_BODY_LENGTH)
  const bodyLower = bodyText.toLowerCase()
  const subjectLower = email.subject.toLowerCase()
  const combinedText = `${subjectLower} ${bodyLower}`

  const urgencyKeywords = detectUrgencyKeywords(combinedText)
  const contentSignals = detectContentSignals(combinedText, senderEmail)

  return {
    emailId: email.id,
    senderEmail,
    senderDomain,
    isAutomatedSender: isAutomatedAddress(senderEmail),
    subject: email.subject,
    isReply: /^re:/i.test(email.subject),
    isForward: /^fwd?:/i.test(email.subject),
    bodyText,
    wordCount: bodyText.split(/\s+/).filter(Boolean).length,
    urgencyKeywords,
    urgencyScore: calculateUrgencyScore(urgencyKeywords),
    contentSignals,
    hasAttachments: email.attachments.length > 0,
    recipientCount: email.to.length + (email.cc?.length || 0),
    threadId: email.threadId,
    timestamp: email.timestamp,
    accountId: email.accountId,
  }
}

/**
 * Build a structured prompt for LLM inference from email features
 */
export function buildAnalysisPrompt(
  features: EmailFeatures,
  senderContext?: string,
  threadContext?: string
): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = `Classify this email's priority. Most emails are low priority. Respond with ONLY a JSON object, no other text.

Rules:
- "none" (score 0-20): newsletters, marketing, automated notifications, promotions, spam, noreply senders
- "low" (score 21-40): FYI updates, receipts, shipping notices, account alerts, social media notifications
- "medium" (score 41-70): messages from real people that need a response, meeting invites, work discussions
- "high" (score 71-100): urgent deadlines, direct requests needing immediate action, time-sensitive from known contacts

Format: {"priority":"none","score":10,"reasoning":"why","signals":["fyi"]}`

  const parts: string[] = []

  parts.push(`From: ${features.senderEmail}`)
  parts.push(`Subject: ${features.subject}`)
  parts.push(`Recipients: ${features.recipientCount}`)

  // Strong hints for the small model
  if (features.isAutomatedSender) {
    parts.push(
      'NOTE: This is from an automated/noreply sender. Priority should be "none" or "low".'
    )
  }
  if (features.contentSignals.includes('newsletter')) {
    parts.push('NOTE: This appears to be a newsletter/marketing email. Priority should be "none".')
  }

  if (features.hasAttachments) {
    parts.push('Has attachments: yes')
  }

  if (senderContext) {
    parts.push(`Sender context: ${senderContext}`)
  }

  if (threadContext) {
    parts.push(`Thread context: ${threadContext}`)
  }

  if (features.urgencyKeywords.length > 0) {
    parts.push(`Urgency keywords detected: ${features.urgencyKeywords.join(', ')}`)
  }

  // Truncate body for prompt
  const bodyPreview = features.bodyText.slice(0, 1000)
  parts.push(`\nBody:\n${bodyPreview}`)

  return {
    systemPrompt,
    userPrompt: parts.join('\n'),
  }
}

/**
 * Parse LLM response into structured analysis result
 */
export function parseAnalysisResponse(text: string): {
  priority: 'high' | 'medium' | 'low' | 'none'
  score: number
  reasoning: string
  signals: ContentSignal[]
} | null {
  // Log raw response for debugging (truncated)
  logger.debug('ai', 'Raw inference response', { text: text.slice(0, 500) })

  // Try JSON parsing first, then fall back to regex extraction
  const jsonResult = tryParseJson(text)
  if (jsonResult) return jsonResult

  const regexResult = tryRegexExtraction(text)
  if (regexResult) return regexResult

  logger.warn('ai', 'Could not extract analysis from response', { text: text.slice(0, 300) })
  return null
}

/**
 * Extract JSON object using brace-counting (avoids greedy regex issues)
 */
function extractJsonObject(text: string): string | null {
  const start = text.indexOf('{')
  if (start === -1) return null

  let depth = 0
  let inString = false
  let escape = false

  for (let i = start; i < text.length; i++) {
    const ch = text[i]

    if (escape) {
      escape = false
      continue
    }
    if (ch === '\\' && inString) {
      escape = true
      continue
    }
    if (ch === '"' && !escape) {
      inString = !inString
      continue
    }
    if (inString) continue

    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) {
        return text.slice(start, i + 1)
      }
    }
  }

  // If braces never balanced, return what we have (truncated output)
  return text.slice(start)
}

/**
 * Fix common LLM JSON mistakes and parse
 */
function tryParseJson(text: string): ReturnType<typeof parseAnalysisResponse> {
  try {
    const jsonStr = extractJsonObject(text)
    if (!jsonStr) return null

    let fixed = jsonStr
    // Fix unquoted keys: { priority: "high" } → { "priority": "high" }
    fixed = fixed.replace(/([{,])\s*([a-zA-Z_]\w*)\s*:/g, '$1 "$2":')
    // Fix single-quoted strings: 'high' → "high"
    fixed = fixed.replace(/'/g, '"')
    // Fix trailing commas: {..."signals": ["a",] } → {..."signals": ["a"] }
    fixed = fixed.replace(/,\s*([\]}])/g, '$1')
    // Remove control characters inside strings
    // eslint-disable-next-line no-control-regex
    fixed = fixed.replace(/[\u0000-\u001f]/g, (ch) => (ch === '\n' || ch === '\t' ? ' ' : ''))

    const parsed = JSON.parse(fixed)
    return normalizeResult(parsed)
  } catch {
    return null
  }
}

/**
 * Regex fallback: extract priority/score/reasoning directly from text
 */
function tryRegexExtraction(text: string): ReturnType<typeof parseAnalysisResponse> {
  const lower = text.toLowerCase()

  // Extract priority
  const priorityMatch = lower.match(/["']?priority["']?\s*[:=]\s*["']?(high|medium|low|none)["']?/i)
  const priority = priorityMatch
    ? (priorityMatch[1].toLowerCase() as 'high' | 'medium' | 'low' | 'none')
    : null

  if (!priority) return null // Need at least a priority

  // Extract score
  const scoreMatch = lower.match(/["']?score["']?\s*[:=]\s*(\d+)/)
  const score = scoreMatch ? Math.max(0, Math.min(100, parseInt(scoreMatch[1], 10))) : 50

  // Extract reasoning
  const reasoningMatch = text.match(/["']?reasoning["']?\s*[:=]\s*["']([^"']*?)["']/i)
  const reasoning = reasoningMatch ? reasoningMatch[1].slice(0, 5000) : ''

  // Extract signals
  const validSignals: ContentSignal[] = [
    'deadline',
    'question',
    'request',
    'fyi',
    'newsletter',
    'automated',
    'meeting',
    'approval',
  ]
  const signals: ContentSignal[] = validSignals.filter(
    (s) => lower.includes(`"${s}"`) || lower.includes(`'${s}'`)
  )

  logger.debug('ai', 'Used regex fallback for parsing', { priority, score })
  return { priority, score, reasoning, signals }
}

/**
 * Normalize a parsed JSON object into a valid result
 */
function normalizeResult(
  parsed: Record<string, unknown>
): ReturnType<typeof parseAnalysisResponse> {
  const priority = ['high', 'medium', 'low', 'none'].includes(parsed.priority as string)
    ? (parsed.priority as 'high' | 'medium' | 'low' | 'none')
    : 'none'

  const score =
    typeof parsed.score === 'number' ? Math.max(0, Math.min(100, Math.round(parsed.score))) : 50

  const reasoning = typeof parsed.reasoning === 'string' ? parsed.reasoning.slice(0, 5000) : ''

  const validSignals: ContentSignal[] = [
    'deadline',
    'question',
    'request',
    'fyi',
    'newsletter',
    'automated',
    'meeting',
    'approval',
  ]
  const signals = Array.isArray(parsed.signals)
    ? parsed.signals.filter((s: unknown) => validSignals.includes(s as ContentSignal))
    : []

  return { priority, score, reasoning, signals }
}

// ============================================================================
// Internal helpers
// ============================================================================

function getPlainText(email: EmailDocument): string {
  if (email.body.text) {
    return email.body.text
  }
  if (email.body.html) {
    // Basic HTML stripping
    return email.body.html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim()
  }
  return email.snippet || ''
}

function detectUrgencyKeywords(text: string): string[] {
  const found: string[] = []

  for (const keyword of URGENCY_KEYWORDS_HIGH) {
    if (text.includes(keyword)) {
      found.push(keyword)
    }
  }

  for (const keyword of URGENCY_KEYWORDS_MEDIUM) {
    if (text.includes(keyword)) {
      found.push(keyword)
    }
  }

  return found
}

function calculateUrgencyScore(keywords: string[]): number {
  if (keywords.length === 0) return 0

  let score = 0
  for (const kw of keywords) {
    if (URGENCY_KEYWORDS_HIGH.includes(kw)) {
      score += 0.4
    } else {
      score += 0.2
    }
  }

  return Math.min(1, score)
}

function isAutomatedAddress(email: string): boolean {
  const local = email.split('@')[0] || ''
  return AUTOMATED_SENDER_PATTERNS.some((pattern) => local.includes(pattern))
}

function detectContentSignals(text: string, senderEmail: string): ContentSignal[] {
  const signals: ContentSignal[] = []

  // Deadline detection
  if (
    /\b(deadline|due date|due by|by (jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec))/i.test(
      text
    ) ||
    /\b(eod|eob|end of (day|business|week))\b/i.test(text) ||
    /\bby (tomorrow|friday|monday|next week)\b/i.test(text)
  ) {
    signals.push('deadline')
  }

  // Question detection
  if (
    /\?\s*$/m.test(text) ||
    /\b(can you|could you|would you|do you|what|when|where|how|why)\b.*\?/i.test(text)
  ) {
    signals.push('question')
  }

  // Request/action detection
  if (
    /\b(please|kindly|could you|can you|need you to|action required|action needed)\b/i.test(text)
  ) {
    signals.push('request')
  }

  // Meeting detection
  if (/\b(meeting|calendar|invite|schedule|call|zoom|teams|google meet)\b/i.test(text)) {
    signals.push('meeting')
  }

  // Approval detection
  if (/\b(approve|approval|sign off|review and approve|needs? your approval)\b/i.test(text)) {
    signals.push('approval')
  }

  // Newsletter/automated detection
  if (isAutomatedAddress(senderEmail)) {
    signals.push('automated')
  }

  if (NEWSLETTER_PATTERNS.some((p) => text.includes(p))) {
    signals.push('newsletter')
  }

  // FYI detection (informational, no action needed)
  if (
    /\b(fyi|for your information|for your reference|just letting you know|no action needed|no action required)\b/i.test(
      text
    ) ||
    (signals.length === 0 && !text.includes('?'))
  ) {
    signals.push('fyi')
  }

  return signals
}
