/**
 * Priority Scoring Service
 *
 * Story 3.3: Priority Scoring Model
 * Task 4: Singleton service coordinating when/how emails get scored
 *
 * Delegates to analysisOrchestrator for actual analysis.
 * Handles filtering, deduplication, and concurrency control.
 */

import { logger } from '@/services/logger'
import { analysisOrchestrator } from './analysisOrchestrator'
import { needsAnalysis } from './analysisResultStore'
import { isUserOverride } from './priorityDisplay'
import type { EmailDocument } from '@/services/database/schemas/email.schema'

export interface ScoreResult {
  scored: number
  skipped: number
}

export interface ScoreBatchOptions {
  concurrency?: number
}

export class PriorityScoringService {
  private static instance: PriorityScoringService

  private constructor() {
    logger.debug('ai', 'PriorityScoringService instance created')
  }

  static getInstance(): PriorityScoringService {
    if (!PriorityScoringService.instance) {
      PriorityScoringService.instance = new PriorityScoringService()
    }
    return PriorityScoringService.instance
  }

  static __resetForTesting(): void {
    PriorityScoringService.instance = undefined as unknown as PriorityScoringService
  }

  /**
   * Score a single email. Skips user overrides and recently scored emails.
   */
  async scoreEmail(email: EmailDocument): Promise<boolean> {
    if (isUserOverride(email.aiMetadata)) {
      logger.debug('ai', 'Skipping user-overridden email', { emailId: email.id })
      return false
    }

    if (!needsAnalysis(email)) {
      logger.debug('ai', 'Skipping recently scored email', { emailId: email.id })
      return false
    }

    try {
      await analysisOrchestrator.analyzeEmail(email)
      return true
    } catch (error) {
      logger.error('ai', 'Failed to score email', {
        emailId: email.id,
        error: error instanceof Error ? error.message : 'Unknown',
      })
      return false
    }
  }

  /**
   * Score a batch of emails with concurrency control.
   */
  async scoreBatch(emails: EmailDocument[], options?: ScoreBatchOptions): Promise<ScoreResult> {
    const concurrency = options?.concurrency ?? 3
    let scored = 0
    let skipped = 0

    // Filter to emails that need scoring
    const toScore = emails.filter((email) => {
      if (isUserOverride(email.aiMetadata)) {
        skipped++
        return false
      }
      if (!needsAnalysis(email)) {
        skipped++
        return false
      }
      return true
    })

    // Process in batches with concurrency control
    for (let i = 0; i < toScore.length; i += concurrency) {
      const batch = toScore.slice(i, i + concurrency)
      const results = await Promise.allSettled(
        batch.map((email) => analysisOrchestrator.analyzeEmail(email))
      )

      for (const result of results) {
        if (result.status === 'fulfilled') {
          scored++
        } else {
          logger.error('ai', 'Batch scoring failed for email', {
            error: result.reason instanceof Error ? result.reason.message : 'Unknown',
          })
          skipped++
        }
      }
    }

    logger.info('ai', 'Batch scoring complete', { scored, skipped })
    return { scored, skipped }
  }
}

export const priorityScoringService = PriorityScoringService.getInstance()
