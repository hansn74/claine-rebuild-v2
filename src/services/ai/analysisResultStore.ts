/**
 * Analysis Result Store
 *
 * Story 3.2: Email Analysis Engine
 * Task 5: RxDB result caching (AC: 6)
 *
 * Stores AI analysis results in email aiMetadata fields and provides
 * concrete implementations of AnalysisDependencies for the orchestrator.
 */

import { logger } from '@/services/logger'
import { getDatabase } from '@/services/database/init'
import type { AnalysisResult, AnalysisDependencies } from './analysisOrchestrator'
import type { SenderStats } from './senderScoring'
import type { EmailDocument } from '@/services/database/schemas/email.schema'

/**
 * Store a single analysis result in the email's aiMetadata field
 */
export async function storeAnalysisResult(emailId: string, result: AnalysisResult): Promise<void> {
  const db = getDatabase()
  const doc = await db.emails.findOne(emailId).exec()

  if (!doc) {
    logger.warn('ai', 'Cannot store analysis result: email not found', { emailId })
    return
  }

  await doc.patch({
    aiMetadata: {
      triageScore: result.triageScore,
      priority: result.priority,
      suggestedAttributes: {},
      confidence: result.confidence,
      reasoning: result.reasoning,
      modelVersion: result.modelVersion,
      processedAt: result.processedAt,
    },
  })

  logger.debug('ai', 'Analysis result stored', { emailId, priority: result.priority })
}

/**
 * Store multiple analysis results in a batch
 */
export async function storeAnalysisResultsBatch(
  results: AnalysisResult[]
): Promise<{ stored: number; failed: number }> {
  let stored = 0
  let failed = 0

  for (const result of results) {
    try {
      await storeAnalysisResult(result.emailId, result)
      stored++
    } catch (error) {
      failed++
      logger.error('ai', 'Failed to store batch result', {
        emailId: result.emailId,
        error: error instanceof Error ? error.message : 'Unknown',
      })
    }
  }

  logger.info('ai', 'Batch store complete', { stored, failed })
  return { stored, failed }
}

/**
 * Get sender statistics for scoring from the database
 */
export async function getSenderStats(
  senderEmail: string,
  accountId: string
): Promise<SenderStats | null> {
  const db = getDatabase()

  const received = await db.emails
    .find({
      selector: {
        accountId,
        'from.email': senderEmail,
      },
    })
    .exec()

  if (received.length === 0) return null

  // Count emails where the user has sent a reply (exists in sent folder to same thread)
  const threadIds = new Set(received.map((e) => e.threadId))
  const sentEmails = await db.emails
    .find({
      selector: {
        accountId,
        folder: 'sent',
        threadId: { $in: Array.from(threadIds) },
      },
    })
    .exec()

  // A reply exists if there's a sent email in the same thread
  const repliedThreads = new Set(sentEmails.map((e) => e.threadId))
  const repliedCount = received.filter((e) => repliedThreads.has(e.threadId)).length

  const lastEmail = received.reduce(
    (latest, e) => (e.timestamp > latest.timestamp ? e : latest),
    received[0]
  )

  const localPart = senderEmail.split('@')[0] || ''
  const automatedPatterns = ['noreply', 'no-reply', 'donotreply', 'notifications', 'mailer-daemon']
  const isAutomated = automatedPatterns.some((p) => localPart.includes(p))

  return {
    receivedCount: received.length,
    repliedCount,
    lastEmailAt: lastEmail.timestamp,
    isAutomated,
  }
}

/**
 * Get all emails in a thread
 */
export async function getThreadEmails(threadId: string): Promise<EmailDocument[]> {
  const db = getDatabase()

  const docs = await db.emails
    .find({
      selector: { threadId },
      sort: [{ timestamp: 'asc' }],
    })
    .exec()

  return docs.map((doc) => doc.toJSON() as EmailDocument)
}

/**
 * Check if an email needs (re-)analysis
 */
export function needsAnalysis(
  email: EmailDocument,
  maxAgeMs: number = 24 * 60 * 60 * 1000
): boolean {
  if (!email.aiMetadata) return true
  return Date.now() - email.aiMetadata.processedAt > maxAgeMs
}

/**
 * Create concrete AnalysisDependencies wired to RxDB
 */
export function createAnalysisDependencies(): AnalysisDependencies {
  return {
    getSenderStats,
    getThreadEmails,
    storeResult: storeAnalysisResult,
  }
}
