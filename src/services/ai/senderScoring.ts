/**
 * Sender Relationship Scoring
 *
 * Story 3.2: Email Analysis Engine
 * Task 2: Sender relationship scoring (AC: 2)
 *
 * Scores sender relationships based on:
 * - Communication frequency
 * - Response rate (how often user replies)
 * - Sender classification (frequent, occasional, first-time, automated)
 */

import { logger } from '@/services/logger'

/**
 * Sender classification
 */
export type SenderCategory =
  | 'frequent' // >10 emails in last 30 days
  | 'regular' // 3-10 emails in last 30 days
  | 'occasional' // 1-2 emails in last 30 days
  | 'first-time' // No previous emails
  | 'automated' // Noreply/system addresses

/**
 * Sender relationship score
 */
export interface SenderScore {
  email: string
  domain: string
  category: SenderCategory
  /** Communication frequency (emails per 30 days) */
  frequency: number
  /** How often user replies to this sender (0-1) */
  responseRate: number
  /** Relationship score (0-100, higher = more important) */
  relationshipScore: number
  /** Context string for LLM prompt */
  contextSummary: string
}

/**
 * Email stats needed for sender scoring
 */
export interface SenderStats {
  /** Total emails received from this sender */
  receivedCount: number
  /** Total replies sent to this sender */
  repliedCount: number
  /** Most recent email timestamp */
  lastEmailAt: number
  /** Whether this is an automated/noreply address */
  isAutomated: boolean
}

/**
 * Calculate sender relationship score from stats
 */
export function calculateSenderScore(
  email: string,
  stats: SenderStats,
  dayRange: number = 30
): SenderScore {
  const domain = email.split('@')[1] || ''

  // Automated senders always score low
  if (stats.isAutomated) {
    return {
      email,
      domain,
      category: 'automated',
      frequency: stats.receivedCount,
      responseRate: 0,
      relationshipScore: 5,
      contextSummary: 'Automated/noreply sender',
    }
  }

  // Calculate frequency (per 30 days)
  const frequency = stats.receivedCount

  // Calculate response rate
  const responseRate =
    stats.receivedCount > 0 ? Math.min(1, stats.repliedCount / stats.receivedCount) : 0

  // Classify sender
  const category = classifySender(frequency, stats)

  // Calculate composite score
  const relationshipScore = computeRelationshipScore(
    frequency,
    responseRate,
    category,
    stats.lastEmailAt
  )

  const contextSummary = buildContextSummary(category, frequency, responseRate, dayRange)

  logger.debug('ai', 'Sender score calculated', {
    email,
    category,
    frequency,
    responseRate: Math.round(responseRate * 100),
    score: relationshipScore,
  })

  return {
    email,
    domain,
    category,
    frequency,
    responseRate,
    relationshipScore,
    contextSummary,
  }
}

/**
 * Create a default score for an unknown sender
 */
export function createDefaultSenderScore(email: string): SenderScore {
  const domain = email.split('@')[1] || ''
  return {
    email,
    domain,
    category: 'first-time',
    frequency: 0,
    responseRate: 0,
    relationshipScore: 30,
    contextSummary: 'First-time sender (no prior communication)',
  }
}

// ============================================================================
// Internal helpers
// ============================================================================

function classifySender(frequency: number, stats: SenderStats): SenderCategory {
  if (stats.isAutomated) return 'automated'
  if (stats.receivedCount === 0) return 'first-time'
  if (frequency > 10) return 'frequent'
  if (frequency >= 3) return 'regular'
  if (frequency >= 1) return 'occasional'
  return 'first-time'
}

function computeRelationshipScore(
  frequency: number,
  responseRate: number,
  category: SenderCategory,
  lastEmailAt: number
): number {
  let score = 0

  // Base score by category
  switch (category) {
    case 'frequent':
      score = 70
      break
    case 'regular':
      score = 50
      break
    case 'occasional':
      score = 30
      break
    case 'first-time':
      score = 30
      break
    case 'automated':
      return 5
  }

  // Response rate bonus (high response = important sender)
  score += responseRate * 20

  // Frequency bonus (capped)
  score += Math.min(10, frequency)

  // Recency: penalize if last email was long ago
  const daysSinceLastEmail = (Date.now() - lastEmailAt) / (1000 * 60 * 60 * 24)
  if (daysSinceLastEmail > 90) {
    score -= 10
  }

  return Math.max(0, Math.min(100, Math.round(score)))
}

function buildContextSummary(
  category: SenderCategory,
  frequency: number,
  responseRate: number,
  dayRange: number
): string {
  const parts: string[] = []

  switch (category) {
    case 'frequent':
      parts.push(`Frequent contact (${frequency} emails in ${dayRange} days)`)
      break
    case 'regular':
      parts.push(`Regular contact (${frequency} emails in ${dayRange} days)`)
      break
    case 'occasional':
      parts.push(`Occasional contact (${frequency} emails in ${dayRange} days)`)
      break
    case 'first-time':
      parts.push('First-time sender (no prior communication)')
      break
    case 'automated':
      parts.push('Automated/noreply sender')
      break
  }

  if (responseRate > 0.5 && category !== 'automated') {
    parts.push(`You reply to ${Math.round(responseRate * 100)}% of their emails`)
  }

  return parts.join('. ')
}
