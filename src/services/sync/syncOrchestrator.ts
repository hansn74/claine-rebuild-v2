/**
 * Sync Orchestrator Service
 * Coordinates sync timing and scheduling across multiple accounts
 *
 * Features:
 * - Periodic sync scheduling (2-5 minutes configurable)
 * - Per-account sync coordination
 * - Concurrent sync prevention
 * - Automatic sync on app startup
 * - Network-aware sync scheduling
 */

import type { AppDatabase } from '../database/types'
import { GmailSyncService } from './gmailSync'
import { SyncProgressService } from './syncProgress'
import { logger } from '@/services/logger'

/**
 * Sync Orchestrator
 * Manages sync scheduling and timing for all email accounts
 */
export class SyncOrchestratorService {
  private _db: AppDatabase
  private gmailSyncService: GmailSyncService
  private progressService: SyncProgressService
  private syncInterval: number
  private syncTimers: Map<string, ReturnType<typeof setTimeout>> = new Map()
  private started = false

  constructor(db: AppDatabase) {
    this._db = db
    this.gmailSyncService = new GmailSyncService(db)
    this.progressService = new SyncProgressService(db)

    // Load sync interval from environment (2-5 minutes range)
    this.syncInterval = parseInt(import.meta.env.VITE_SYNC_INTERVAL_MS || '180000', 10) // 3 minutes default
  }

  /**
   * Start sync orchestrator
   * Begins periodic syncing for all configured accounts
   */
  async start(): Promise<void> {
    if (this.started) {
      logger.debug('[SyncOrchestrator] Already started')
      return
    }

    this.started = true
    logger.info('[SyncOrchestrator] Starting', { intervalMs: this.syncInterval })

    // Get all accounts with sync state
    const allProgress = await this.progressService.getAllProgress()

    // Schedule sync for each account
    for (const progress of allProgress) {
      if (progress.provider === 'gmail') {
        await this.scheduleSync(progress.accountId)
      }
      // Future: Add Outlook support
      // else if (progress.provider === 'outlook') { ... }
    }
  }

  /**
   * Stop sync orchestrator
   * Cancels all pending sync timers
   */
  stop(): void {
    if (!this.started) {
      return
    }

    logger.info('[SyncOrchestrator] Stopping')
    this.started = false

    // Clear all timers
    for (const [accountId, timer] of this.syncTimers.entries()) {
      clearTimeout(timer)
      this.syncTimers.delete(accountId)
    }
  }

  /**
   * Schedule periodic sync for an account
   * @param accountId - Account identifier
   */
  private async scheduleSync(accountId: string): Promise<void> {
    // Clear existing timer if any
    const existingTimer = this.syncTimers.get(accountId)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    // Perform initial sync immediately
    try {
      await this.syncAccount(accountId)
    } catch (error) {
      logger.error('[SyncOrchestrator] Initial sync failed', { accountId, error })
    }

    // Schedule next sync
    this.scheduleNextSync(accountId)
  }

  /**
   * Schedule next sync for an account
   * @param accountId - Account identifier
   */
  private scheduleNextSync(accountId: string): void {
    if (!this.started) {
      return
    }

    const timer = setTimeout(async () => {
      try {
        await this.syncAccount(accountId)
      } catch (error) {
        logger.error('[SyncOrchestrator] Sync failed', { accountId, error })
      }

      // Schedule next sync after completion
      this.scheduleNextSync(accountId)
    }, this.syncInterval)

    this.syncTimers.set(accountId, timer)
  }

  /**
   * Perform sync for a single account
   * @param accountId - Account identifier
   */
  private async syncAccount(accountId: string): Promise<void> {
    // Check network before syncing
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      logger.debug('[SyncOrchestrator] Offline - skipping sync', { accountId })
      return
    }

    const progress = await this.progressService.getProgress(accountId)
    if (!progress) {
      logger.warn('[SyncOrchestrator] No sync state found', { accountId })
      return
    }

    // Determine provider and delegate to appropriate sync service
    if (progress.provider === 'gmail') {
      await this.gmailSyncService.startSync(accountId)
    }
    // Future: Add Outlook support
    // else if (progress.provider === 'outlook') {
    //   await this.outlookSyncService.startSync(accountId)
    // }
  }

  /**
   * Manually trigger sync for a specific account
   * Useful for user-initiated sync or testing
   * @param accountId - Account identifier
   */
  async triggerSync(accountId: string): Promise<void> {
    logger.info('[SyncOrchestrator] Manual sync triggered', { accountId })
    await this.syncAccount(accountId)
  }

  /**
   * Add a new account to sync rotation
   * @param accountId - Account identifier
   * @param provider - Email provider ('gmail' | 'outlook')
   */
  async addAccount(accountId: string, provider: 'gmail' | 'outlook'): Promise<void> {
    // Initialize sync state
    await this.progressService.initializeSyncState(accountId, provider)

    // Start syncing if orchestrator is running
    if (this.started) {
      await this.scheduleSync(accountId)
    }
  }

  /**
   * Remove account from sync rotation
   * @param accountId - Account identifier
   */
  removeAccount(accountId: string): void {
    const timer = this.syncTimers.get(accountId)
    if (timer) {
      clearTimeout(timer)
      this.syncTimers.delete(accountId)
    }
  }
}

/**
 * Singleton instance (will be initialized with database at app startup)
 */
export let syncOrchestratorService: SyncOrchestratorService | null = null

/**
 * Initialize sync orchestrator service
 * Should be called once at app startup after database is ready
 */
export function initializeSyncOrchestrator(db: AppDatabase): SyncOrchestratorService {
  if (syncOrchestratorService) {
    logger.warn('[SyncOrchestrator] Already initialized')
    return syncOrchestratorService
  }

  syncOrchestratorService = new SyncOrchestratorService(db)
  return syncOrchestratorService
}
