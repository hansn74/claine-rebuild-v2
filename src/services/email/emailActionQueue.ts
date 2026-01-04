/**
 * Email Action Queue Service
 *
 * Story 2.6: Email Actions (Archive, Delete, Mark Read/Unread)
 * Task 2: Implement Offline Action Queue
 *
 * Manages the offline-first email action queue.
 * Queues actions locally and syncs to provider APIs when online.
 *
 * Features:
 * - Queue actions for offline-first operation (AC 1-3)
 * - Process queue when online (Task 2.3)
 * - Exponential backoff retry logic (Task 2.4)
 * - Network status detection (Task 2.5)
 *
 * FR007: Full read/write functionality when offline, queueing actions for later sync
 * NFR002: Gracefully handle network interruptions without data loss
 */

import { Subject, Observable } from 'rxjs'
import { getDatabase } from '@/services/database/init'
import { logger } from '@/services/logger'
import type {
  ActionQueueDocument,
  ActionQueueStatus,
} from '@/services/database/schemas/actionQueue.schema'
import type { EmailAction } from './emailActionsService'

/**
 * Retry delay configuration (exponential backoff)
 * Pattern: 1s, 5s, 30s, 60s
 */
const RETRY_DELAYS = [1000, 5000, 30000, 60000]
const MAX_ATTEMPTS = 4

/**
 * Action sync provider interface
 * Must be implemented by Gmail/Outlook action services
 */
export interface IActionSyncProvider {
  /**
   * Sync an action to the provider API
   * @param action - Action to sync
   * @throws Error if sync fails
   */
  syncAction(action: ActionQueueDocument): Promise<void>
}

/**
 * Event types emitted by the action queue service
 */
export type ActionQueueEvent =
  | { type: 'queued'; item: ActionQueueDocument }
  | { type: 'processing'; item: ActionQueueDocument }
  | { type: 'synced'; item: ActionQueueDocument }
  | { type: 'failed'; item: ActionQueueDocument; error: string }
  | { type: 'retry-scheduled'; item: ActionQueueDocument; delayMs: number }

/**
 * Email Action Queue Service
 *
 * Singleton service that manages the email action queue.
 * Provides methods for queueing, processing, and managing actions.
 *
 * Usage:
 * ```typescript
 * import { emailActionQueue } from '@/services/email/emailActionQueue'
 *
 * // Queue an action
 * await emailActionQueue.queueAction(action)
 *
 * // Process pending actions
 * await emailActionQueue.processQueue()
 *
 * // Check online status
 * const isOnline = emailActionQueue.isOnline()
 * ```
 */
export class EmailActionQueue {
  private static instance: EmailActionQueue
  private events$ = new Subject<ActionQueueEvent>()
  private providers: Map<string, IActionSyncProvider> = new Map()
  private processingIds = new Set<string>()
  private initialized = false
  private online = navigator.onLine

  private constructor() {
    // Set up network status listeners
    this.setupNetworkListeners()
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): EmailActionQueue {
    if (!EmailActionQueue.instance) {
      EmailActionQueue.instance = new EmailActionQueue()
    }
    return EmailActionQueue.instance
  }

  /**
   * Get observable for queue events
   */
  getEvents$(): Observable<ActionQueueEvent> {
    return this.events$.asObservable()
  }

  /**
   * Check if online
   */
  isOnline(): boolean {
    return this.online
  }

  /**
   * Register a sync provider for an account type
   * @param providerType - Provider type (e.g., 'gmail', 'outlook')
   * @param provider - Provider implementation
   */
  registerProvider(providerType: string, provider: IActionSyncProvider): void {
    this.providers.set(providerType, provider)
    logger.debug('action-queue', 'Provider registered', { providerType })
  }

  /**
   * Queue an email action for sync
   * Task 2.2: Implement queueAction(action) method
   *
   * @param action - Email action to queue
   * @param providerType - Provider type (gmail, outlook)
   * @returns Created queue item
   */
  async queueAction(action: EmailAction, providerType: string): Promise<ActionQueueDocument> {
    const db = getDatabase()

    // Ensure actionQueue collection exists
    if (!db.actionQueue) {
      logger.warn('action-queue', 'ActionQueue collection not initialized, skipping queue')
      throw new Error('ActionQueue collection not initialized')
    }

    const now = Date.now()

    const queueItem: ActionQueueDocument = {
      id: action.id,
      type: action.type as ActionQueueDocument['type'],
      emailId: action.emailId,
      accountId: action.accountId,
      providerType,
      status: 'pending',
      attempts: 0,
      maxAttempts: MAX_ATTEMPTS,
      createdAt: now,
      updatedAt: now,
      previousState: JSON.stringify(action.previousState),
    }

    await db.actionQueue.insert(queueItem)

    logger.info('action-queue', 'Action queued', {
      id: queueItem.id,
      type: queueItem.type,
      emailId: queueItem.emailId,
    })

    this.events$.next({ type: 'queued', item: queueItem })

    // If online, try to process immediately
    if (this.online) {
      this.processAction(queueItem).catch((error) => {
        logger.warn('action-queue', 'Immediate processing failed, will retry later', {
          id: queueItem.id,
          error: error instanceof Error ? error.message : String(error),
        })
      })
    }

    return queueItem
  }

  /**
   * Process all pending actions in the queue
   * Task 2.3: Implement processQueue() method
   *
   * @param maxConcurrent - Maximum number of parallel syncs (default: 2)
   */
  async processQueue(maxConcurrent: number = 2): Promise<void> {
    if (!this.online) {
      logger.debug('action-queue', 'Skipping queue processing - offline')
      return
    }

    const db = getDatabase()
    const actionQueue = db.actionQueue
    if (!actionQueue) {
      logger.warn('action-queue', 'ActionQueue collection not initialized')
      return
    }

    // Find pending items ordered by creation time (FIFO)
    const pendingItems = await actionQueue
      .find({
        selector: { status: 'pending' },
        sort: [{ createdAt: 'asc' }],
      })
      .exec()

    logger.debug('action-queue', `Processing ${pendingItems.length} pending actions`)

    // Process items with concurrency limit
    const processingPromises: Promise<void>[] = []

    for (const item of pendingItems) {
      // Check if already processing
      if (this.processingIds.has(item.id)) {
        continue
      }

      // Wait for slot if at max concurrent
      if (processingPromises.length >= maxConcurrent) {
        await Promise.race(processingPromises)
      }

      // Start processing
      const promise = this.processAction(item.toJSON() as ActionQueueDocument)
        .catch((error) => {
          logger.error('action-queue', 'Failed to process action', {
            id: item.id,
            error: error instanceof Error ? error.message : String(error),
          })
        })
        .finally(() => {
          const index = processingPromises.indexOf(promise)
          if (index > -1) {
            processingPromises.splice(index, 1)
          }
        })

      processingPromises.push(promise)
    }

    // Wait for all remaining items
    await Promise.all(processingPromises)
  }

  /**
   * Process a single action
   *
   * @param item - Action queue item to process
   */
  private async processAction(item: ActionQueueDocument): Promise<void> {
    const db = getDatabase()
    const actionQueue = db.actionQueue
    if (!actionQueue) return

    // Mark as processing
    this.processingIds.add(item.id)
    await actionQueue.findOne(item.id).update({
      $set: { status: 'processing' as ActionQueueStatus, updatedAt: Date.now() },
    })
    this.events$.next({ type: 'processing', item: { ...item, status: 'processing' } })

    try {
      // Get provider for this action
      const provider = this.providers.get(item.providerType)
      if (!provider) {
        throw new Error(`No sync provider registered for: ${item.providerType}`)
      }

      // Sync via provider
      await provider.syncAction(item)

      // Update status to completed
      const now = Date.now()
      await actionQueue.findOne(item.id).update({
        $set: {
          status: 'completed' as ActionQueueStatus,
          updatedAt: now,
        },
      })

      logger.info('action-queue', 'Action synced successfully', {
        id: item.id,
        type: item.type,
      })

      const syncedItem = { ...item, status: 'completed' as const }
      this.events$.next({ type: 'synced', item: syncedItem })

      // Remove completed action after a short delay
      setTimeout(async () => {
        try {
          const doc = await actionQueue.findOne(item.id).exec()
          if (doc) {
            await doc.remove()
          }
        } catch {
          // Ignore cleanup errors
        }
      }, 5000)
    } catch (error) {
      await this.handleSyncError(item, error)
    } finally {
      this.processingIds.delete(item.id)
    }
  }

  /**
   * Handle sync error with retry logic
   * Task 2.4: Add retry logic with exponential backoff
   *
   * @param item - Action queue item that failed
   * @param error - The error that occurred
   */
  private async handleSyncError(item: ActionQueueDocument, error: unknown): Promise<void> {
    const db = getDatabase()
    const actionQueue = db.actionQueue
    if (!actionQueue) return

    const attempts = item.attempts + 1
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // Determine if we should retry
    const shouldRetry = attempts < MAX_ATTEMPTS
    const status: ActionQueueStatus = shouldRetry ? 'pending' : 'failed'

    // Update queue item
    await actionQueue.findOne(item.id).update({
      $set: {
        status,
        attempts,
        lastAttemptAt: Date.now(),
        error: errorMessage,
        updatedAt: Date.now(),
      },
    })

    const updatedItem = { ...item, status, attempts, error: errorMessage }

    if (shouldRetry) {
      // Schedule retry with exponential backoff
      const delayMs = RETRY_DELAYS[attempts - 1] || RETRY_DELAYS[RETRY_DELAYS.length - 1]

      logger.warn('action-queue', 'Sync failed, scheduling retry', {
        id: item.id,
        attempts,
        delayMs,
        error: errorMessage,
      })

      this.events$.next({ type: 'retry-scheduled', item: updatedItem, delayMs })

      // Schedule the retry
      setTimeout(() => {
        if (this.online) {
          this.processAction({ ...updatedItem, status: 'pending' })
        }
      }, delayMs)
    } else {
      logger.error('action-queue', 'Sync failed permanently after max attempts', {
        id: item.id,
        attempts,
        error: errorMessage,
      })

      this.events$.next({ type: 'failed', item: updatedItem, error: errorMessage })
    }
  }

  /**
   * Remove an action from the queue
   * Used when action is undone before sync
   *
   * @param actionId - Action ID to remove
   * @returns true if removed, false if not found
   */
  async removeAction(actionId: string): Promise<boolean> {
    const db = getDatabase()
    const actionQueue = db.actionQueue
    if (!actionQueue) return false

    const item = await actionQueue.findOne(actionId).exec()
    if (!item) {
      return false
    }

    // Only pending items can be removed
    if (item.status !== 'pending') {
      logger.warn('action-queue', 'Cannot remove action - not pending', {
        id: actionId,
        status: item.status,
      })
      return false
    }

    await item.remove()
    logger.info('action-queue', 'Action removed from queue', { id: actionId })
    return true
  }

  /**
   * Get pending action count
   */
  async getPendingCount(): Promise<number> {
    const db = getDatabase()
    const actionQueue = db.actionQueue
    if (!actionQueue) return 0

    const pending = await actionQueue
      .find({
        selector: { status: 'pending' },
      })
      .exec()

    return pending.length
  }

  /**
   * Get failed action count
   */
  async getFailedCount(): Promise<number> {
    const db = getDatabase()
    const actionQueue = db.actionQueue
    if (!actionQueue) return 0

    const failed = await actionQueue
      .find({
        selector: { status: 'failed' },
      })
      .exec()

    return failed.length
  }

  /**
   * Initialize the service
   * Called on app startup
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    logger.info('action-queue', 'Initializing email action queue service')

    // Log pending items count
    const pendingCount = await this.getPendingCount()
    if (pendingCount > 0) {
      logger.info('action-queue', 'Found pending actions from previous session', {
        count: pendingCount,
      })

      // Process pending actions if online
      if (this.online) {
        this.processQueue()
      }
    }

    this.initialized = true
  }

  /**
   * Set up network status listeners
   * Task 2.5: Handle network status detection
   */
  private setupNetworkListeners(): void {
    window.addEventListener('online', () => {
      this.online = true
      logger.info('action-queue', 'Network online, processing pending actions')
      this.processQueue()
    })

    window.addEventListener('offline', () => {
      this.online = false
      logger.info('action-queue', 'Network offline')
    })
  }

  /**
   * Reset singleton instance (for testing only)
   * @internal
   */
  static __resetForTesting(): void {
    if (EmailActionQueue.instance) {
      EmailActionQueue.instance.events$.complete()
    }
    EmailActionQueue.instance = null as unknown as EmailActionQueue
  }
}

/**
 * Singleton instance export
 */
export const emailActionQueue = EmailActionQueue.getInstance()
