/**
 * Cleanup Service
 * Executes email cleanup operations to free IndexedDB storage
 *
 * AC 7: User can select cleanup criteria
 * AC 9: Cleanup executes with user confirmation, showing progress indicator
 * AC 10: Cleanup reduces IndexedDB storage usage by at least the previewed amount
 */

import type { AppDatabase } from '../database/types'

/**
 * Progress callback for cleanup operations
 */
export type CleanupProgressCallback = (progress: CleanupProgress) => void

/**
 * Cleanup progress information
 */
export interface CleanupProgress {
  phase: 'counting' | 'deleting' | 'complete'
  current: number
  total: number
  deletedCount: number
  freedBytes: number
}

/**
 * Cleanup result
 */
export interface CleanupResult {
  freedBytes: number
  deletedCount: number
  accountsAffected: string[]
  durationMs: number
}

/**
 * Cleanup Service
 * Handles execution of storage cleanup operations
 */
export class CleanupService {
  constructor(private db: AppDatabase) {}

  /**
   * Clean up emails older than a specified number of days
   *
   * AC 7: Delete local emails older than N years/days
   *
   * @param olderThanDays - Delete emails older than this many days
   * @param accountId - Optional: limit to specific account
   * @param onProgress - Optional progress callback
   * @returns Cleanup result
   */
  async cleanupByAge(
    olderThanDays: number,
    accountId?: string,
    onProgress?: CleanupProgressCallback
  ): Promise<CleanupResult> {
    const startTime = Date.now()

    if (!this.db.emails) {
      return {
        freedBytes: 0,
        deletedCount: 0,
        accountsAffected: [],
        durationMs: Date.now() - startTime,
      }
    }

    const cutoffTime = Date.now() - olderThanDays * 24 * 60 * 60 * 1000

    // Build query selector
    type EmailSelector = {
      timestamp: { $lt: number }
      accountId?: string
    }
    const selector: EmailSelector = {
      timestamp: { $lt: cutoffTime },
    }

    if (accountId) {
      selector.accountId = accountId
    }

    // Count phase
    onProgress?.({
      phase: 'counting',
      current: 0,
      total: 0,
      deletedCount: 0,
      freedBytes: 0,
    })

    const emails = await this.db.emails.find({ selector }).exec()
    const total = emails.length

    // Delete phase
    let deletedCount = 0
    let freedBytes = 0
    const accountsAffected = new Set<string>()

    for (const email of emails) {
      // Estimate size before deletion
      const bodySize = (email.body?.html?.length || 0) + (email.body?.text?.length || 0)
      const attachmentSize = email.attachments?.reduce((sum, att) => sum + (att.size || 0), 0) || 0
      const estimatedSize = Math.max(bodySize + attachmentSize, 50 * 1024) // 50KB minimum

      // Delete the email
      const doc = email as unknown as { remove: () => Promise<void> }
      await doc.remove()

      deletedCount++
      freedBytes += estimatedSize
      accountsAffected.add(email.accountId)

      onProgress?.({
        phase: 'deleting',
        current: deletedCount,
        total,
        deletedCount,
        freedBytes,
      })
    }

    // Complete
    const result: CleanupResult = {
      freedBytes,
      deletedCount,
      accountsAffected: Array.from(accountsAffected),
      durationMs: Date.now() - startTime,
    }

    onProgress?.({
      phase: 'complete',
      current: total,
      total,
      deletedCount: result.deletedCount,
      freedBytes: result.freedBytes,
    })

    return result
  }

  /**
   * Clean up emails larger than a specified size
   *
   * AC 7: Delete emails with large attachments
   *
   * @param minSizeBytes - Delete emails larger than this size in bytes
   * @param accountId - Optional: limit to specific account
   * @param onProgress - Optional progress callback
   * @returns Cleanup result
   */
  async cleanupBySize(
    minSizeBytes: number,
    accountId?: string,
    onProgress?: CleanupProgressCallback
  ): Promise<CleanupResult> {
    const startTime = Date.now()

    if (!this.db.emails) {
      return {
        freedBytes: 0,
        deletedCount: 0,
        accountsAffected: [],
        durationMs: Date.now() - startTime,
      }
    }

    // Build query selector
    type EmailSelector = {
      accountId?: string
    }
    const selector: EmailSelector = {}

    if (accountId) {
      selector.accountId = accountId
    }

    // Count phase - need to filter by size in application since it's calculated
    onProgress?.({
      phase: 'counting',
      current: 0,
      total: 0,
      deletedCount: 0,
      freedBytes: 0,
    })

    const emails = await this.db.emails.find({ selector }).exec()

    // Filter to large emails
    const largeEmails = emails.filter((email) => {
      const bodySize = (email.body?.html?.length || 0) + (email.body?.text?.length || 0)
      const attachmentSize = email.attachments?.reduce((sum, att) => sum + (att.size || 0), 0) || 0
      return bodySize + attachmentSize >= minSizeBytes
    })

    const total = largeEmails.length

    // Delete phase
    let deletedCount = 0
    let freedBytes = 0
    const accountsAffected = new Set<string>()

    for (const email of largeEmails) {
      // Estimate size before deletion
      const bodySize = (email.body?.html?.length || 0) + (email.body?.text?.length || 0)
      const attachmentSize = email.attachments?.reduce((sum, att) => sum + (att.size || 0), 0) || 0
      const estimatedSize = bodySize + attachmentSize

      // Delete the email
      const doc = email as unknown as { remove: () => Promise<void> }
      await doc.remove()

      deletedCount++
      freedBytes += estimatedSize
      accountsAffected.add(email.accountId)

      onProgress?.({
        phase: 'deleting',
        current: deletedCount,
        total,
        deletedCount,
        freedBytes,
      })
    }

    // Complete
    const result: CleanupResult = {
      freedBytes,
      deletedCount,
      accountsAffected: Array.from(accountsAffected),
      durationMs: Date.now() - startTime,
    }

    onProgress?.({
      phase: 'complete',
      current: total,
      total,
      deletedCount: result.deletedCount,
      freedBytes: result.freedBytes,
    })

    return result
  }

  /**
   * Clean up all emails for a specific account
   *
   * AC 7: Delete all local emails for an account
   *
   * @param accountId - Account ID to clean up
   * @param onProgress - Optional progress callback
   * @returns Cleanup result
   */
  async cleanupByAccount(
    accountId: string,
    onProgress?: CleanupProgressCallback
  ): Promise<CleanupResult> {
    const startTime = Date.now()

    if (!this.db.emails) {
      return {
        freedBytes: 0,
        deletedCount: 0,
        accountsAffected: [],
        durationMs: Date.now() - startTime,
      }
    }

    // Count phase
    onProgress?.({
      phase: 'counting',
      current: 0,
      total: 0,
      deletedCount: 0,
      freedBytes: 0,
    })

    const emails = await this.db.emails
      .find({
        selector: { accountId },
      })
      .exec()

    const total = emails.length

    // Delete phase
    let deletedCount = 0
    let freedBytes = 0

    for (const email of emails) {
      // Estimate size before deletion
      const bodySize = (email.body?.html?.length || 0) + (email.body?.text?.length || 0)
      const attachmentSize = email.attachments?.reduce((sum, att) => sum + (att.size || 0), 0) || 0
      const estimatedSize = Math.max(bodySize + attachmentSize, 50 * 1024) // 50KB minimum

      // Delete the email
      const doc = email as unknown as { remove: () => Promise<void> }
      await doc.remove()

      deletedCount++
      freedBytes += estimatedSize

      onProgress?.({
        phase: 'deleting',
        current: deletedCount,
        total,
        deletedCount,
        freedBytes,
      })
    }

    // Complete
    const result: CleanupResult = {
      freedBytes,
      deletedCount,
      accountsAffected: deletedCount > 0 ? [accountId] : [],
      durationMs: Date.now() - startTime,
    }

    onProgress?.({
      phase: 'complete',
      current: total,
      total,
      deletedCount: result.deletedCount,
      freedBytes: result.freedBytes,
    })

    return result
  }

  /**
   * Execute cleanup with combined criteria
   *
   * @param criteria - Cleanup criteria
   * @param onProgress - Optional progress callback
   * @returns Cleanup result
   */
  async executeCleanup(
    criteria: {
      accountIds?: string[]
      olderThanDays?: number
      minSizeBytes?: number
    },
    onProgress?: CleanupProgressCallback
  ): Promise<CleanupResult> {
    const startTime = Date.now()

    if (!this.db.emails) {
      return {
        freedBytes: 0,
        deletedCount: 0,
        accountsAffected: [],
        durationMs: Date.now() - startTime,
      }
    }

    // Build base query
    type EmailSelector = {
      accountId?: { $in: string[] }
      timestamp?: { $lt: number }
    }
    const selector: EmailSelector = {}

    if (criteria.accountIds && criteria.accountIds.length > 0) {
      selector.accountId = { $in: criteria.accountIds }
    }

    if (criteria.olderThanDays) {
      const cutoffTime = Date.now() - criteria.olderThanDays * 24 * 60 * 60 * 1000
      selector.timestamp = { $lt: cutoffTime }
    }

    // Count phase
    onProgress?.({
      phase: 'counting',
      current: 0,
      total: 0,
      deletedCount: 0,
      freedBytes: 0,
    })

    let emails = await this.db.emails.find({ selector }).exec()

    // Filter by size in application if specified
    if (criteria.minSizeBytes) {
      emails = emails.filter((email) => {
        const bodySize = (email.body?.html?.length || 0) + (email.body?.text?.length || 0)
        const attachmentSize =
          email.attachments?.reduce((sum, att) => sum + (att.size || 0), 0) || 0
        return bodySize + attachmentSize >= criteria.minSizeBytes!
      })
    }

    const total = emails.length

    // Delete phase
    let deletedCount = 0
    let freedBytes = 0
    const accountsAffected = new Set<string>()

    for (const email of emails) {
      // Estimate size before deletion
      const bodySize = (email.body?.html?.length || 0) + (email.body?.text?.length || 0)
      const attachmentSize = email.attachments?.reduce((sum, att) => sum + (att.size || 0), 0) || 0
      const estimatedSize = Math.max(bodySize + attachmentSize, 50 * 1024) // 50KB minimum

      // Delete the email
      const doc = email as unknown as { remove: () => Promise<void> }
      await doc.remove()

      deletedCount++
      freedBytes += estimatedSize
      accountsAffected.add(email.accountId)

      onProgress?.({
        phase: 'deleting',
        current: deletedCount,
        total,
        deletedCount,
        freedBytes,
      })
    }

    // Complete
    const result: CleanupResult = {
      freedBytes,
      deletedCount,
      accountsAffected: Array.from(accountsAffected),
      durationMs: Date.now() - startTime,
    }

    onProgress?.({
      phase: 'complete',
      current: total,
      total,
      deletedCount: result.deletedCount,
      freedBytes: result.freedBytes,
    })

    return result
  }
}

/**
 * Singleton instance management
 */
let _cleanupService: CleanupService | null = null

/**
 * Get the cleanup service instance
 *
 * @param db - RxDB database instance
 * @returns CleanupService instance
 */
export function getCleanupService(db: AppDatabase): CleanupService {
  if (!_cleanupService) {
    _cleanupService = new CleanupService(db)
  }
  return _cleanupService
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetCleanupService(): void {
  _cleanupService = null
}
