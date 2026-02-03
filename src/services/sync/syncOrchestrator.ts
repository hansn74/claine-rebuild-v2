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

import type { Subscription } from 'rxjs'
import type { AppDatabase } from '../database/types'
import { GmailSyncService } from './gmailSync'
import { OutlookSyncService } from './outlookSync'
import { SyncProgressService } from './syncProgress'
import { circuitBreaker } from './circuitBreaker'
import { adaptiveInterval } from './adaptiveInterval'
import { classifyError } from './errorClassification'
import { logger } from '@/services/logger'

/**
 * Sync Orchestrator
 * Manages sync scheduling and timing for all email accounts
 */
export class SyncOrchestratorService {
  private gmailSyncService: GmailSyncService
  private outlookSyncService: OutlookSyncService
  private progressService: SyncProgressService
  private syncInterval: number
  private syncTimers: Map<string, ReturnType<typeof setTimeout>> = new Map()
  private actionSubscriptions: Subscription[] = []
  private started = false

  constructor(db: AppDatabase) {
    this.gmailSyncService = new GmailSyncService(db)
    this.outlookSyncService = new OutlookSyncService(db)
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
      logger.debug('sync-orchestrator', 'Already started')
      return
    }

    this.started = true
    logger.info('sync-orchestrator', 'Starting', { intervalMs: this.syncInterval })

    // Get all accounts with sync state
    const allProgress = await this.progressService.getAllProgress()

    // Schedule sync for each account
    for (const progress of allProgress) {
      if (progress.provider === 'gmail' || progress.provider === 'outlook') {
        await this.scheduleSync(progress.accountId)
      }
    }
  }

  /**
   * Get the sync progress service instance
   * Used by health registry to poll sync progress
   */
  getProgressService(): SyncProgressService {
    return this.progressService
  }

  /**
   * Stop sync orchestrator
   * Cancels all pending sync timers
   */
  stop(): void {
    if (!this.started) {
      return
    }

    logger.info('sync-orchestrator', 'Stopping')
    this.started = false

    // Clear all timers
    for (const [accountId, timer] of this.syncTimers.entries()) {
      clearTimeout(timer)
      this.syncTimers.delete(accountId)
    }

    // Story 1.15: Unsubscribe from action event streams (Task 4.4)
    for (const sub of this.actionSubscriptions) {
      sub.unsubscribe()
    }
    this.actionSubscriptions = []
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
      logger.error('sync-orchestrator', 'Initial sync failed', { accountId, error })
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

    // Story 1.15: Use adaptive interval when enabled, otherwise fixed (AC 1-4, 9)
    const intervalMs = adaptiveInterval.isEnabled()
      ? adaptiveInterval.getInterval(accountId)
      : this.syncInterval

    logger.debug('sync-orchestrator', 'Scheduled next sync', {
      accountId,
      intervalMs,
      adaptiveEnabled: adaptiveInterval.isEnabled(),
    })

    const timer = setTimeout(async () => {
      try {
        await this.syncAccount(accountId)
      } catch (error) {
        logger.error('sync-orchestrator', 'Sync failed', { accountId, error })
      }

      // Schedule next sync after completion
      this.scheduleNextSync(accountId)
    }, intervalMs)

    this.syncTimers.set(accountId, timer)
  }

  /**
   * Perform sync for a single account
   * @param accountId - Account identifier
   */
  private async syncAccount(accountId: string): Promise<void> {
    // Check network before syncing
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      logger.debug('sync-orchestrator', 'Offline - skipping sync', { accountId })
      return
    }

    const progress = await this.progressService.getProgress(accountId)
    if (!progress) {
      logger.warn('sync-orchestrator', 'No sync state found', { accountId })
      return
    }

    // Story 1.19: Check circuit breaker before sync (Task 4, AC 16)
    const provider = progress.provider as 'gmail' | 'outlook'
    if (provider && !circuitBreaker.canExecute(provider)) {
      logger.info('sync', 'Circuit open, skipping sync', { accountId, provider })
      return
    }

    // Story 1.15: Capture emailsSynced before sync for activity detection (AC 2-4)
    const beforeCount = progress.emailsSynced

    try {
      // Determine provider and delegate to appropriate sync service
      if (provider === 'gmail') {
        await this.gmailSyncService.startSync(accountId)
      } else if (provider === 'outlook') {
        await this.outlookSyncService.startSync(accountId)
      }

      // Story 1.19: Record success (Task 4.4)
      if (provider) {
        circuitBreaker.recordSuccess(provider)
      }

      // Story 1.15: Record sync result for adaptive interval (AC 2-4)
      const afterProgress = await this.progressService.getProgress(accountId)
      const afterCount = afterProgress?.emailsSynced ?? beforeCount
      adaptiveInterval.recordSyncResult(accountId, afterCount > beforeCount)
    } catch (error) {
      // Story 1.19: Record failure for transient errors only (Task 4.3)
      if (provider) {
        const classified = classifyError(error)
        if (classified.type === 'transient' || classified.type === 'unknown') {
          circuitBreaker.recordFailure(provider)
        }
      }
      throw error
    }
  }

  /**
   * Manually trigger sync for a specific account
   * Useful for user-initiated sync or testing
   * @param accountId - Account identifier
   */
  async triggerSync(accountId: string): Promise<void> {
    logger.info('sync-orchestrator', 'Manual sync triggered', { accountId })
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

  /**
   * Story 1.15: Subscribe to action events for adaptive interval reset (AC 5)
   * Called with event observables from emailActionsService and sendQueueService
   */
  subscribeToActionEvents(
    actionEvents$: import('rxjs').Observable<{
      action?: { accountId: string }
      item?: { accountId: string }
    }>
  ): void {
    const sub = actionEvents$.subscribe((event) => {
      const accountId = event.action?.accountId ?? event.item?.accountId
      if (accountId) {
        adaptiveInterval.recordUserAction(accountId)
        // Reschedule with shorter interval
        this.rescheduleSync(accountId)
      }
    })
    this.actionSubscriptions.push(sub)
  }

  /**
   * Story 1.15: Handle account switch — immediate sync (AC 8)
   */
  async onAccountSwitch(accountId: string): Promise<void> {
    if (!this.started) return

    logger.info('sync-orchestrator', 'Account switch — immediate sync', { accountId })

    // Cancel pending timer and sync immediately
    const existingTimer = this.syncTimers.get(accountId)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    try {
      await this.syncAccount(accountId)
    } catch (error) {
      logger.error('sync-orchestrator', 'Account switch sync failed', { accountId, error })
    }

    this.scheduleNextSync(accountId)
  }

  /**
   * Reschedule sync for an account with updated adaptive interval
   */
  private rescheduleSync(accountId: string): void {
    if (!this.started) return

    const existingTimer = this.syncTimers.get(accountId)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }
    this.scheduleNextSync(accountId)
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
    logger.warn('sync-orchestrator', 'Already initialized')
    return syncOrchestratorService
  }

  syncOrchestratorService = new SyncOrchestratorService(db)
  return syncOrchestratorService
}
