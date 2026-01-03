/**
 * Sync Progress Tracker
 * Manages sync progress state in RxDB for persistence across restarts
 * Provides ±10% accurate time estimation based on sync rate
 */

import type { AppDatabase } from '../database/types'
import type { SyncStateDocument } from '../database/schemas/syncState.schema'

export interface SyncProgressUpdate {
  emailsSynced?: number
  totalEmailsToSync?: number
  status?: 'idle' | 'syncing' | 'paused' | 'error'
  syncToken?: string
  pageToken?: string
  error?: string
  lastError?: string
  // AC 3: Partial success tracking
  failedCount?: number
}

export interface SyncProgress {
  accountId: string
  provider: 'gmail' | 'outlook'
  status: 'idle' | 'syncing' | 'paused' | 'error'
  progressPercentage: number
  emailsSynced: number
  totalEmailsToSync: number
  estimatedTimeRemaining: number // milliseconds
  lastSyncAt: number
  nextSyncAt: number
  error?: string
  syncToken?: string // deltaLink for Outlook, historyId for Gmail
  pageToken?: string // Pagination token for resuming sync
  // AC 3, 12: Partial success tracking
  failedCount?: number
}

/**
 * Sync Progress Service
 * Tracks and persists sync progress in RxDB
 */
export class SyncProgressService {
  constructor(private db: AppDatabase) {
    if (!db.syncState) {
      throw new Error('SyncState collection not initialized')
    }
  }

  /**
   * Initialize sync state for a new account
   * Creates initial sync state document in RxDB
   */
  async initializeSyncState(accountId: string, provider: 'gmail' | 'outlook'): Promise<void> {
    if (!this.db.syncState) {
      throw new Error('SyncState collection not initialized')
    }

    // Check if sync state already exists
    const existing = await this.db.syncState.findOne(accountId).exec()
    if (existing) {
      return // Already initialized
    }

    const now = Date.now()
    await this.db.syncState.insert({
      id: accountId,
      provider,
      status: 'idle',
      lastSyncAt: now,
      nextSyncAt: now,
      initialSyncComplete: false,
      totalEmailsToSync: 0,
      emailsSynced: 0,
      progressPercentage: 0,
      estimatedTimeRemaining: 0,
      errorCount: 0,
      lastRequestAt: 0,
      requestCount: 0,
      averageSyncRate: 0,
    })
  }

  /**
   * Update sync progress with new metrics
   * Calculates progress percentage and estimated time remaining
   *
   * @param accountId - Account identifier
   * @param update - Progress update data
   * @returns Updated progress metrics
   */
  async updateProgress(accountId: string, update: SyncProgressUpdate): Promise<SyncProgress> {
    if (!this.db.syncState) {
      throw new Error('SyncState collection not initialized')
    }

    const syncState = await this.db.syncState.findOne(accountId).exec()
    if (!syncState) {
      throw new Error(`Sync state not found for account: ${accountId}`)
    }

    const now = Date.now()

    // Use current emailsSynced or fallback to existing value
    const emailsSynced = update.emailsSynced ?? syncState.emailsSynced

    // Calculate average sync rate (emails/second)
    let averageSyncRate = syncState.averageSyncRate
    if (syncState.syncStartedAt && syncState.syncStartedAt > 0) {
      const elapsedSeconds = (now - syncState.syncStartedAt) / 1000
      if (elapsedSeconds > 0) {
        averageSyncRate = emailsSynced / elapsedSeconds
      }
    }

    // Calculate progress percentage
    const totalEmails = update.totalEmailsToSync ?? syncState.totalEmailsToSync
    const progressPercentage =
      totalEmails > 0 ? Math.min((emailsSynced / totalEmails) * 100, 100) : 0

    // Estimate time remaining based on sync rate (±10% accuracy target)
    const emailsRemaining = totalEmails - emailsSynced
    const estimatedTimeRemaining =
      averageSyncRate > 0 ? (emailsRemaining / averageSyncRate) * 1000 : 0

    // Build update object - only include fields that have valid values
    const updateData: Partial<SyncStateDocument> = {}

    // Only update progress metrics if emailsSynced is provided
    if (update.emailsSynced !== undefined) {
      updateData.emailsSynced = update.emailsSynced
      updateData.progressPercentage = Math.round(progressPercentage * 10) / 10 // Round to 1 decimal
      updateData.estimatedTimeRemaining = Math.round(estimatedTimeRemaining)
      // Only update rate if it's a valid number
      if (Number.isFinite(averageSyncRate)) {
        updateData.averageSyncRate = averageSyncRate
      }
    }

    if (update.totalEmailsToSync !== undefined) {
      updateData.totalEmailsToSync = update.totalEmailsToSync
    }

    if (update.status) {
      updateData.status = update.status
      if (update.status === 'syncing' && !syncState.syncStartedAt) {
        updateData.syncStartedAt = now
      }
    }

    if (update.syncToken !== undefined) {
      updateData.syncToken = update.syncToken
    }

    if (update.pageToken !== undefined) {
      updateData.pageToken = update.pageToken
    }

    if (update.error) {
      updateData.lastError = update.error
      updateData.lastErrorAt = now
      updateData.errorCount = syncState.errorCount + 1
    } else if (update.status === 'syncing') {
      // Reset error count on successful sync
      updateData.errorCount = 0
    }

    // Update last request timestamp
    updateData.lastRequestAt = now

    // Perform atomic update
    await syncState.update({
      $set: updateData,
    })

    // Fetch updated document
    const updated = await this.db.syncState.findOne(accountId).exec()
    if (!updated) {
      throw new Error('Failed to fetch updated sync state')
    }

    return this.toSyncProgress(updated)
  }

  /**
   * Mark sync as complete for an account
   * Updates initial sync flag and resets progress
   * @param accountId - Account identifier
   * @param syncToken - Optional historyId or syncToken to save for incremental sync
   */
  async markSyncComplete(accountId: string, syncToken?: string): Promise<void> {
    if (!this.db.syncState) {
      throw new Error('SyncState collection not initialized')
    }

    const syncState = await this.db.syncState.findOne(accountId).exec()
    if (!syncState) {
      throw new Error(`Sync state not found for account: ${accountId}`)
    }

    const now = Date.now()
    const updateData: Partial<SyncStateDocument> = {
      status: 'idle',
      initialSyncComplete: true,
      lastSyncAt: now,
      progressPercentage: 100,
      estimatedTimeRemaining: 0,
      syncStartedAt: undefined,
    }

    // Store syncToken (historyId) for incremental sync if provided
    if (syncToken) {
      updateData.syncToken = syncToken
    }

    await syncState.update({
      $set: updateData,
    })
  }

  /**
   * Schedule next sync based on interval
   * @param accountId - Account identifier
   * @param intervalMs - Interval in milliseconds (default: 3 minutes)
   */
  async scheduleNextSync(accountId: string, intervalMs: number = 180000): Promise<void> {
    if (!this.db.syncState) {
      throw new Error('SyncState collection not initialized')
    }

    const syncState = await this.db.syncState.findOne(accountId).exec()
    if (!syncState) {
      throw new Error(`Sync state not found for account: ${accountId}`)
    }

    const nextSyncAt = Date.now() + intervalMs
    await syncState.update({
      $set: {
        nextSyncAt,
      },
    })
  }

  /**
   * Get current sync progress for an account
   */
  async getProgress(accountId: string): Promise<SyncProgress | null> {
    if (!this.db.syncState) {
      throw new Error('SyncState collection not initialized')
    }

    const syncState = await this.db.syncState.findOne(accountId).exec()
    if (!syncState) {
      return null
    }

    return this.toSyncProgress(syncState)
  }

  /**
   * Get all sync states (for multi-account monitoring)
   */
  async getAllProgress(): Promise<SyncProgress[]> {
    if (!this.db.syncState) {
      throw new Error('SyncState collection not initialized')
    }

    const syncStates = await this.db.syncState.find().exec()
    return syncStates.map((state) => this.toSyncProgress(state))
  }

  /**
   * Convert SyncStateDocument to SyncProgress interface
   */
  private toSyncProgress(doc: SyncStateDocument): SyncProgress {
    return {
      accountId: doc.id,
      provider: doc.provider,
      status: doc.status,
      progressPercentage: doc.progressPercentage,
      emailsSynced: doc.emailsSynced,
      totalEmailsToSync: doc.totalEmailsToSync,
      estimatedTimeRemaining: doc.estimatedTimeRemaining,
      lastSyncAt: doc.lastSyncAt,
      nextSyncAt: doc.nextSyncAt,
      error: doc.lastError,
      syncToken: doc.syncToken,
      pageToken: doc.pageToken,
    }
  }
}
