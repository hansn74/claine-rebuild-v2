/**
 * Priority Feedback Service
 *
 * Story 3.6: Manual Priority Adjustment & Feedback Loop
 * Task 2: Records user priority corrections and detects learning patterns
 *
 * Captures original AI predictions before overrides, enabling
 * sender-pattern detection for feedback-aware heuristic scoring.
 */

import { logger } from '@/services/logger'
import { getDatabase } from '@/services/database/init'
import { setEmailPriority } from './priorityOverride'
import { getPriorityDisplay } from './priorityDisplay'
import { useFeedbackToastStore } from '@/store/feedbackToastStore'
import type { Priority } from './priorityDisplay'
import type { PriorityFeedbackDocument } from '@/services/database/schemas/priorityFeedback.schema'

export interface SenderPriorityPattern {
  preferredPriority: Priority
  overrideCount: number
  confidence: number
}

export interface LearningInsight {
  type: 'sender_pattern'
  senderEmail: string
  fromPriority: Priority | null
  toPriority: Priority
  count: number
}

class PriorityFeedbackService {
  private static instance: PriorityFeedbackService

  private constructor() {
    logger.debug('ai', 'PriorityFeedbackService instance created')
  }

  static getInstance(): PriorityFeedbackService {
    if (!PriorityFeedbackService.instance) {
      PriorityFeedbackService.instance = new PriorityFeedbackService()
    }
    return PriorityFeedbackService.instance
  }

  static __resetForTesting(): void {
    PriorityFeedbackService.instance = undefined as unknown as PriorityFeedbackService
  }

  /**
   * Record a user override — captures original AI prediction, stores feedback,
   * then applies the override via setEmailPriority.
   */
  async recordOverride(emailId: string, newPriority: Priority): Promise<void> {
    const db = getDatabase()
    const doc = await db.emails.findOne(emailId).exec()

    if (!doc) {
      logger.warn('ai', 'Cannot record override: email not found', { emailId })
      return
    }

    const email = doc.toJSON()
    const aiMetadata = email.aiMetadata

    // Insert feedback entry
    const feedbackId = `pf-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const entry: PriorityFeedbackDocument = {
      id: feedbackId,
      emailId,
      accountId: email.accountId,
      senderEmail: email.from.email,
      originalPriority: (aiMetadata?.priority as Priority) ?? null,
      originalScore: aiMetadata?.triageScore ?? null,
      originalConfidence: aiMetadata?.confidence ?? null,
      originalModelVersion: aiMetadata?.modelVersion ?? null,
      newPriority,
      feedbackType: 'override',
      createdAt: Date.now(),
    }

    await db.priorityFeedback.insert(entry)

    // Apply the override
    await setEmailPriority(emailId, newPriority)

    logger.info('ai', 'Priority override recorded', {
      emailId,
      from: aiMetadata?.priority ?? 'unscored',
      to: newPriority,
    })

    // Check for new learning insights and show toast
    try {
      const insights = await this.detectLearningInsights(email.accountId)
      const senderInsight = insights.find((i) => i.senderEmail === email.from.email)
      if (senderInsight && senderInsight.count === 3) {
        const displayInfo = getPriorityDisplay(senderInsight.toPriority)
        const label = displayInfo?.label ?? senderInsight.toPriority
        useFeedbackToastStore
          .getState()
          .showToast(
            `AI learned: emails from ${senderInsight.senderEmail} are now prioritized as ${label}`,
            senderInsight.senderEmail
          )
      }
    } catch {
      // Non-critical — don't fail the override if toast logic errors
    }
  }

  /**
   * Record a user confirmation — "thumbs up" on the current priority.
   */
  async recordConfirmation(emailId: string): Promise<void> {
    const db = getDatabase()
    const doc = await db.emails.findOne(emailId).exec()

    if (!doc) {
      logger.warn('ai', 'Cannot record confirmation: email not found', { emailId })
      return
    }

    const email = doc.toJSON()
    const aiMetadata = email.aiMetadata

    if (!aiMetadata?.priority) {
      logger.warn('ai', 'Cannot confirm: no priority set', { emailId })
      return
    }

    const feedbackId = `pf-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const entry: PriorityFeedbackDocument = {
      id: feedbackId,
      emailId,
      accountId: email.accountId,
      senderEmail: email.from.email,
      originalPriority: aiMetadata.priority as Priority,
      originalScore: aiMetadata.triageScore,
      originalConfidence: aiMetadata.confidence,
      originalModelVersion: aiMetadata.modelVersion,
      newPriority: aiMetadata.priority as Priority,
      feedbackType: 'confirm',
      createdAt: Date.now(),
    }

    await db.priorityFeedback.insert(entry)

    logger.info('ai', 'Priority confirmation recorded', {
      emailId,
      priority: aiMetadata.priority,
    })
  }

  /**
   * Get sender-specific priority patterns for scoring adjustments.
   * Returns a pattern if the user has consistently moved a sender's emails
   * to a specific priority level.
   */
  async getSenderPatterns(
    senderEmail: string,
    accountId: string
  ): Promise<SenderPriorityPattern | null> {
    const db = getDatabase()

    const entries = await db.priorityFeedback
      .find({
        selector: {
          senderEmail,
          accountId,
          feedbackType: 'override',
        },
      })
      .exec()

    if (entries.length < 2) return null

    // Count overrides by target priority
    const counts: Partial<Record<Priority, number>> = {}
    for (const entry of entries) {
      const p = entry.newPriority as Priority
      counts[p] = (counts[p] || 0) + 1
    }

    // Find the most common target priority
    let maxCount = 0
    let preferredPriority: Priority = 'none'
    for (const [priority, count] of Object.entries(counts)) {
      if (count! > maxCount) {
        maxCount = count!
        preferredPriority = priority as Priority
      }
    }

    // Confidence based on consistency: what fraction of overrides agree
    const confidence = Math.round((maxCount / entries.length) * 100)

    return {
      preferredPriority,
      overrideCount: maxCount,
      confidence,
    }
  }

  /**
   * Get total feedback count for an account.
   */
  async getFeedbackCount(accountId: string): Promise<number> {
    const db = getDatabase()

    const entries = await db.priorityFeedback
      .find({
        selector: { accountId },
      })
      .exec()

    return entries.length
  }

  /**
   * Detect learning insights — patterns where the user has consistently
   * corrected priority for a specific sender (3+ overrides).
   */
  async detectLearningInsights(accountId: string): Promise<LearningInsight[]> {
    const db = getDatabase()

    const entries = await db.priorityFeedback
      .find({
        selector: {
          accountId,
          feedbackType: 'override',
        },
      })
      .exec()

    // Group by senderEmail
    const bySender = new Map<string, typeof entries>()
    for (const entry of entries) {
      const sender = entry.senderEmail
      if (!bySender.has(sender)) {
        bySender.set(sender, [])
      }
      bySender.get(sender)!.push(entry)
    }

    const insights: LearningInsight[] = []
    for (const [senderEmail, senderEntries] of bySender) {
      if (senderEntries.length < 3) continue

      // Find the most common target priority
      const counts: Partial<Record<Priority, number>> = {}
      for (const entry of senderEntries) {
        const p = entry.newPriority as Priority
        counts[p] = (counts[p] || 0) + 1
      }

      let maxCount = 0
      let toPriority: Priority = 'none'
      for (const [priority, count] of Object.entries(counts)) {
        if (count! > maxCount) {
          maxCount = count!
          toPriority = priority as Priority
        }
      }

      // Use the most common original priority as "from"
      const origCounts: Partial<Record<string, number>> = {}
      for (const entry of senderEntries) {
        const key = entry.originalPriority ?? 'null'
        origCounts[key] = (origCounts[key] || 0) + 1
      }
      let maxOrigCount = 0
      let fromPriority: Priority | null = null
      for (const [priority, count] of Object.entries(origCounts)) {
        if (count! > maxOrigCount) {
          maxOrigCount = count!
          fromPriority = priority === 'null' ? null : (priority as Priority)
        }
      }

      insights.push({
        type: 'sender_pattern',
        senderEmail,
        fromPriority,
        toPriority,
        count: senderEntries.length,
      })
    }

    return insights
  }
}

export const priorityFeedbackService = PriorityFeedbackService.getInstance()
