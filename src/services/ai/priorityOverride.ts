/**
 * Priority Override Service
 *
 * Story 3.3: Priority Scoring Model
 * Task 7: User priority override (manual set/clear)
 *
 * Uses the existing aiMetadata.modelVersion field to flag user overrides.
 * No schema migration needed.
 */

import { logger } from '@/services/logger'
import { getDatabase } from '@/services/database/init'
import { USER_OVERRIDE_MODEL_VERSION, type Priority } from './priorityDisplay'

const PRIORITY_SCORE_MAP: Record<Priority, number> = {
  high: 90,
  medium: 70,
  low: 50,
  none: 20,
}

/**
 * Convert a priority level to a representative triage score.
 */
export function priorityToScore(priority: Priority): number {
  return PRIORITY_SCORE_MAP[priority]
}

/**
 * Set a user-defined priority override on an email.
 * Marks the aiMetadata with modelVersion 'user-override-v1' so the scoring
 * service knows to skip this email.
 */
export async function setEmailPriority(emailId: string, priority: Priority): Promise<void> {
  const db = getDatabase()
  const doc = await db.emails.findOne(emailId).exec()

  if (!doc) {
    logger.warn('ai', 'Cannot set priority: email not found', { emailId })
    return
  }

  await doc.patch({
    aiMetadata: {
      triageScore: priorityToScore(priority),
      priority,
      suggestedAttributes: {},
      confidence: 100,
      reasoning: 'Manually set by user',
      modelVersion: USER_OVERRIDE_MODEL_VERSION,
      processedAt: Date.now(),
    },
  })

  logger.info('ai', 'User priority override set', { emailId, priority })
}

/**
 * Clear a user priority override so the email gets re-scored by AI.
 * Removes aiMetadata entirely.
 */
export async function clearPriorityOverride(emailId: string): Promise<void> {
  const db = getDatabase()
  const doc = await db.emails.findOne(emailId).exec()

  if (!doc) {
    logger.warn('ai', 'Cannot clear priority: email not found', { emailId })
    return
  }

  await doc.patch({
    aiMetadata: undefined,
  })

  logger.info('ai', 'User priority override cleared', { emailId })
}
