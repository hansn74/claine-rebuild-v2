/**
 * Sync Failure Service
 * Manages failed sync operations, retry scheduling, and failure persistence
 *
 * AC 1: Sync engine detects when some emails sync successfully but others fail
 * AC 2: Failed email IDs tracked separately from successful ones
 * AC 3: Sync progress accurately reflects partial success
 * AC 14: Failed sync state persisted to RxDB (survives app restart)
 * AC 15: App startup checks for pending retries and resumes
 */

import type { AppDatabase } from '../database/types'
import type {
  SyncFailureDocument,
  SyncProvider,
  SyncFailureStatus,
} from '../database/schemas/syncFailure.schema'
import { classifyError, getFailureStatus } from './errorClassification'
import type { ClassifiedError } from './errorClassification'
import {
  getNextRetryAt,
  calculateRetryDelayWithHeader,
  DEFAULT_RETRY_CONFIG,
  type RetryConfig,
} from './retryEngine'

/**
 * Sync failure tracking stats for progress reporting
 * AC 3: Sync progress accurately reflects partial success
 */
export interface SyncFailureStats {
  pendingCount: number
  retryingCount: number
  exhaustedCount: number
  permanentCount: number
  resolvedCount: number
  totalFailureCount: number
}

/**
 * Result of recording a sync failure
 */
export interface RecordFailureResult {
  failure: SyncFailureDocument
  shouldRetry: boolean
  nextRetryAt: number | null
  retryDelayMs: number
}

/**
 * Sync Failure Service
 * Manages the full lifecycle of sync failures from detection through resolution
 */
export class SyncFailureService {
  private retryConfig: RetryConfig

  constructor(
    private db: AppDatabase,
    config?: Partial<RetryConfig>
  ) {
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config }
  }

  /**
   * Record a new sync failure for an email
   *
   * AC 1: Sync engine detects when some emails sync successfully but others fail
   * AC 2: Failed email IDs tracked separately from successful ones
   * AC 14: Failed sync state persisted to RxDB
   */
  async recordFailure(
    emailId: string,
    accountId: string,
    provider: SyncProvider,
    error: unknown
  ): Promise<RecordFailureResult> {
    if (!this.db.syncFailures) {
      throw new Error('SyncFailures collection not initialized')
    }

    // Classify the error
    const classification = classifyError(error)

    // Check if this failure already exists (e.g., from a previous attempt)
    const existing = await this.db.syncFailures
      .findOne({
        selector: {
          emailId,
          accountId,
          status: { $in: ['pending', 'retrying'] },
        },
      })
      .exec()

    if (existing) {
      // Update existing failure with new retry attempt
      return this.updateExistingFailure(existing, classification)
    }

    // Create new failure record
    return this.createNewFailure(emailId, accountId, provider, classification)
  }

  /**
   * Create a new failure record
   */
  private async createNewFailure(
    emailId: string,
    accountId: string,
    provider: SyncProvider,
    classification: ClassifiedError
  ): Promise<RecordFailureResult> {
    const now = Date.now()
    const status = getFailureStatus(classification, 0, this.retryConfig.maxRetries)
    const shouldRetry = status === 'pending'

    // Calculate next retry time
    const nextRetryAt = shouldRetry
      ? getNextRetryAt(0, classification.retryAfterMs, this.retryConfig)
      : null

    const retryDelayMs = shouldRetry
      ? calculateRetryDelayWithHeader(0, classification.retryAfterMs, this.retryConfig)
      : 0

    const failure: SyncFailureDocument = {
      id: crypto.randomUUID(),
      emailId,
      accountId,
      provider,
      errorType: classification.type,
      errorCode: classification.httpStatus || 0,
      errorMessage: classification.message,
      retryCount: 0,
      maxRetries: this.retryConfig.maxRetries,
      lastAttemptAt: now,
      nextRetryAt,
      status,
      createdAt: now,
      resolvedAt: null,
    }

    await this.db.syncFailures!.insert(failure)

    return {
      failure,
      shouldRetry,
      nextRetryAt,
      retryDelayMs,
    }
  }

  /**
   * Update existing failure with new retry information
   */
  private async updateExistingFailure(
    existing: SyncFailureDocument,
    classification: ClassifiedError
  ): Promise<RecordFailureResult> {
    const now = Date.now()
    const newRetryCount = existing.retryCount + 1
    const status = getFailureStatus(classification, newRetryCount, this.retryConfig.maxRetries)
    const shouldRetry = status === 'pending'

    const nextRetryAt = shouldRetry
      ? getNextRetryAt(newRetryCount, classification.retryAfterMs, this.retryConfig)
      : null

    const retryDelayMs = shouldRetry
      ? calculateRetryDelayWithHeader(newRetryCount, classification.retryAfterMs, this.retryConfig)
      : 0

    // Type assertion to access the document methods
    const doc = existing as unknown as {
      update: (arg: { $set: Partial<SyncFailureDocument> }) => Promise<void>
    }

    await doc.update({
      $set: {
        errorType: classification.type,
        errorCode: classification.httpStatus || existing.errorCode,
        errorMessage: classification.message,
        retryCount: newRetryCount,
        lastAttemptAt: now,
        nextRetryAt,
        status,
      },
    })

    // Get the updated document
    const updated = await this.db.syncFailures!.findOne(existing.id).exec()
    const updatedFailure = updated || existing

    return {
      failure: {
        ...updatedFailure,
        retryCount: newRetryCount,
        status,
        nextRetryAt,
        lastAttemptAt: now,
      } as SyncFailureDocument,
      shouldRetry,
      nextRetryAt,
      retryDelayMs,
    }
  }

  /**
   * Mark a failure as resolved (email successfully synced on retry)
   */
  async markResolved(failureId: string): Promise<void> {
    if (!this.db.syncFailures) {
      throw new Error('SyncFailures collection not initialized')
    }

    const failure = await this.db.syncFailures.findOne(failureId).exec()
    if (!failure) {
      return // Already deleted or doesn't exist
    }

    const doc = failure as unknown as {
      update: (arg: { $set: Partial<SyncFailureDocument> }) => Promise<void>
    }

    await doc.update({
      $set: {
        status: 'resolved' as SyncFailureStatus,
        resolvedAt: Date.now(),
        nextRetryAt: null,
      },
    })
  }

  /**
   * Mark a failure by email ID as resolved
   */
  async markResolvedByEmailId(emailId: string, accountId: string): Promise<void> {
    if (!this.db.syncFailures) {
      throw new Error('SyncFailures collection not initialized')
    }

    const failures = await this.db.syncFailures
      .find({
        selector: {
          emailId,
          accountId,
          status: { $in: ['pending', 'retrying'] },
        },
      })
      .exec()

    for (const failure of failures) {
      await this.markResolved(failure.id)
    }
  }

  /**
   * Mark a failure as currently retrying
   */
  async markRetrying(failureId: string): Promise<void> {
    if (!this.db.syncFailures) {
      throw new Error('SyncFailures collection not initialized')
    }

    const failure = await this.db.syncFailures.findOne(failureId).exec()
    if (!failure) {
      return
    }

    const doc = failure as unknown as {
      update: (arg: { $set: Partial<SyncFailureDocument> }) => Promise<void>
    }

    await doc.update({
      $set: {
        status: 'retrying' as SyncFailureStatus,
      },
    })
  }

  /**
   * Dismiss a failure (user acknowledged and dismissed it)
   * AC 13: Failed emails accessible via "Sync Issues" panel in settings
   */
  async dismissFailure(failureId: string): Promise<void> {
    if (!this.db.syncFailures) {
      throw new Error('SyncFailures collection not initialized')
    }

    const failure = await this.db.syncFailures.findOne(failureId).exec()
    if (!failure) {
      return
    }

    const doc = failure as unknown as {
      update: (arg: { $set: Partial<SyncFailureDocument> }) => Promise<void>
    }

    await doc.update({
      $set: {
        status: 'dismissed' as SyncFailureStatus,
        nextRetryAt: null,
      },
    })
  }

  /**
   * Get all pending retries for an account that are due
   *
   * AC 15: App startup checks for pending retries and resumes
   */
  async getPendingRetries(accountId?: string): Promise<SyncFailureDocument[]> {
    if (!this.db.syncFailures) {
      throw new Error('SyncFailures collection not initialized')
    }

    const now = Date.now()

    const selector: Record<string, unknown> = {
      status: 'pending',
      nextRetryAt: { $lte: now },
    }

    if (accountId) {
      selector.accountId = accountId
    }

    const failures = await this.db.syncFailures.find({ selector }).exec()
    return failures as unknown as SyncFailureDocument[]
  }

  /**
   * Get all failures for an account
   */
  async getFailuresByAccount(accountId: string): Promise<SyncFailureDocument[]> {
    if (!this.db.syncFailures) {
      throw new Error('SyncFailures collection not initialized')
    }

    const failures = await this.db.syncFailures
      .find({
        selector: { accountId },
      })
      .exec()

    return failures as unknown as SyncFailureDocument[]
  }

  /**
   * Get failures that need attention (exhausted, permanent)
   * AC 13: Failed emails accessible via "Sync Issues" panel in settings
   */
  async getActionableFailures(accountId?: string): Promise<SyncFailureDocument[]> {
    if (!this.db.syncFailures) {
      throw new Error('SyncFailures collection not initialized')
    }

    const selector: Record<string, unknown> = {
      status: { $in: ['exhausted', 'permanent'] },
    }

    if (accountId) {
      selector.accountId = accountId
    }

    const failures = await this.db.syncFailures.find({ selector }).exec()
    return failures as unknown as SyncFailureDocument[]
  }

  /**
   * Get failure statistics for an account
   *
   * AC 3: Sync progress accurately reflects partial success
   * AC 12: Final sync report shows: successful count, failed count, retry count
   */
  async getStats(accountId?: string): Promise<SyncFailureStats> {
    if (!this.db.syncFailures) {
      throw new Error('SyncFailures collection not initialized')
    }

    const selector: Record<string, unknown> = {}
    if (accountId) {
      selector.accountId = accountId
    }

    const allFailures = await this.db.syncFailures.find({ selector }).exec()

    const stats: SyncFailureStats = {
      pendingCount: 0,
      retryingCount: 0,
      exhaustedCount: 0,
      permanentCount: 0,
      resolvedCount: 0,
      totalFailureCount: allFailures.length,
    }

    for (const failure of allFailures) {
      switch (failure.status) {
        case 'pending':
          stats.pendingCount++
          break
        case 'retrying':
          stats.retryingCount++
          break
        case 'exhausted':
          stats.exhaustedCount++
          break
        case 'permanent':
          stats.permanentCount++
          break
        case 'resolved':
          stats.resolvedCount++
          break
      }
    }

    return stats
  }

  /**
   * Retry all exhausted failures for an account
   * AC 16: Manual "Retry All Failed" button in sync issues panel
   */
  async retryAllExhausted(accountId: string): Promise<number> {
    if (!this.db.syncFailures) {
      throw new Error('SyncFailures collection not initialized')
    }

    const failures = await this.db.syncFailures
      .find({
        selector: {
          accountId,
          status: 'exhausted',
        },
      })
      .exec()

    const now = Date.now()
    let count = 0

    for (const failure of failures) {
      const doc = failure as unknown as {
        update: (arg: { $set: Partial<SyncFailureDocument> }) => Promise<void>
      }

      await doc.update({
        $set: {
          status: 'pending' as SyncFailureStatus,
          retryCount: 0,
          nextRetryAt: now, // Retry immediately
        },
      })
      count++
    }

    return count
  }

  /**
   * Clean up resolved and dismissed failures older than specified age
   */
  async cleanupOldFailures(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
    if (!this.db.syncFailures) {
      throw new Error('SyncFailures collection not initialized')
    }

    const cutoffTime = Date.now() - maxAgeMs

    const oldFailures = await this.db.syncFailures
      .find({
        selector: {
          status: { $in: ['resolved', 'dismissed'] },
          resolvedAt: { $lt: cutoffTime },
        },
      })
      .exec()

    let count = 0
    for (const failure of oldFailures) {
      const doc = failure as unknown as { remove: () => Promise<void> }
      await doc.remove()
      count++
    }

    return count
  }
}

/**
 * Create a singleton instance for global use
 */
let _syncFailureService: SyncFailureService | null = null

export function getSyncFailureService(db: AppDatabase): SyncFailureService {
  if (!_syncFailureService) {
    _syncFailureService = new SyncFailureService(db)
  }
  return _syncFailureService
}

export function resetSyncFailureService(): void {
  _syncFailureService = null
}
