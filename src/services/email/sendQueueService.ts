/**
 * Send Queue Service
 *
 * Manages the offline-first email send queue.
 * Queues emails locally for sending, processes queue when online,
 * and handles retry logic with exponential backoff.
 *
 * AC 1: Emails sent while offline are queued locally and sent automatically when online
 * AC 2: Send queue persists across app restarts
 * AC 5: Failed sends retry automatically with exponential backoff (max 3 retries)
 * AC 6: User can cancel queued email before it's sent
 *
 * FR007: Full read/write functionality when offline, queueing actions for later sync
 * NFR002: Gracefully handle network interruptions without data loss
 */

import { Subject, Observable } from 'rxjs'
import { getDatabase } from '@/services/database/init'
import { logger } from '@/services/logger'
import type { DraftDocument } from '@/services/database/schemas/draft.schema'
import type {
  SendQueueDocument,
  SendQueueStatus,
} from '@/services/database/schemas/sendQueue.schema'

/**
 * Retry delay configuration (exponential backoff)
 * AC 5: 1s, 5s, 30s backoff pattern
 */
const RETRY_DELAYS = [1000, 5000, 30000] // 1s, 5s, 30s
const MAX_ATTEMPTS = 3

/**
 * Event types emitted by the send queue service
 */
export type SendQueueEvent =
  | { type: 'queued'; item: SendQueueDocument }
  | { type: 'sending'; item: SendQueueDocument }
  | { type: 'sent'; item: SendQueueDocument; messageId: string }
  | { type: 'failed'; item: SendQueueDocument; error: string }
  | { type: 'cancelled'; item: SendQueueDocument }
  | { type: 'retry-scheduled'; item: SendQueueDocument; delayMs: number }

/**
 * Send provider interface - must be implemented by Gmail/Outlook send services
 */
export interface ISendProvider {
  /**
   * Send an email via the provider's API
   * @param item - Queue item containing email data
   * @returns Provider's message ID for the sent email
   * @throws Error if send fails
   */
  sendEmail(item: SendQueueDocument): Promise<string>
}

/**
 * Send Queue Service
 *
 * Singleton service that manages the email send queue.
 * Provides methods for queueing, processing, and cancelling emails.
 */
export class SendQueueService {
  private static instance: SendQueueService
  private events$ = new Subject<SendQueueEvent>()
  private providers: Map<string, ISendProvider> = new Map()
  private processingIds = new Set<string>()
  private initialized = false

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): SendQueueService {
    if (!SendQueueService.instance) {
      SendQueueService.instance = new SendQueueService()
    }
    return SendQueueService.instance
  }

  /**
   * Get observable for queue events
   * Used by UI components to react to queue status changes
   */
  getEvents$(): Observable<SendQueueEvent> {
    return this.events$.asObservable()
  }

  /**
   * Register a send provider for an account type
   * @param accountType - Provider type (e.g., 'gmail', 'outlook')
   * @param provider - Provider implementation
   */
  registerProvider(accountType: string, provider: ISendProvider): void {
    this.providers.set(accountType, provider)
    logger.debug('sendQueue', 'Provider registered', { accountType })
  }

  /**
   * Get the provider for an account
   * @param accountId - Account identifier (format: 'provider:email')
   * @returns The send provider or undefined
   */
  private getProviderForAccount(accountId: string): ISendProvider | undefined {
    // Extract provider type from accountId (e.g., 'gmail:user@example.com' -> 'gmail')
    const providerType = accountId.split(':')[0]
    return this.providers.get(providerType)
  }

  /**
   * Queue an email for sending
   * AC 1: Emails sent while offline are queued locally
   *
   * @param draft - Draft document to send
   * @returns Created queue item
   */
  async queueEmail(draft: DraftDocument): Promise<SendQueueDocument> {
    const db = getDatabase()
    const now = Date.now()

    const queueItem: SendQueueDocument = {
      id: `send-${now}-${Math.random().toString(36).slice(2, 11)}`,
      accountId: draft.accountId,
      draftId: draft.id,
      threadId: draft.threadId,
      replyToEmailId: draft.replyToEmailId,
      type: draft.type,
      to: draft.to,
      cc: draft.cc,
      bcc: draft.bcc,
      subject: draft.subject,
      body: draft.body,
      attachments: [], // Attachments handled separately
      status: 'pending',
      attempts: 0,
      maxAttempts: MAX_ATTEMPTS,
      createdAt: now,
      updatedAt: now,
    }

    await db.sendQueue?.insert(queueItem)
    logger.info('sendQueue', 'Email queued', {
      id: queueItem.id,
      to: queueItem.to.map((t) => t.email).join(', '),
    })

    this.events$.next({ type: 'queued', item: queueItem })

    return queueItem
  }

  /**
   * Process all pending emails in the queue
   * AC 1: Sent automatically when online
   *
   * @param maxConcurrent - Maximum number of parallel sends (default: 2)
   */
  async processQueue(maxConcurrent: number = 2): Promise<void> {
    const db = getDatabase()
    const sendQueue = db.sendQueue
    if (!sendQueue) {
      logger.warn('sendQueue', 'SendQueue collection not initialized')
      return
    }

    // Find pending items ordered by creation time
    const pendingItems = await sendQueue
      .find({
        selector: { status: 'pending' },
        sort: [{ createdAt: 'asc' }],
      })
      .exec()

    logger.debug('sendQueue', `Processing ${pendingItems.length} queued emails`)

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
      const promise = this.sendQueuedEmail(item.toJSON() as SendQueueDocument)
        .catch((error) => {
          logger.error('sendQueue', 'Failed to process queue item', {
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
   * Send a single queued email
   *
   * @param item - Queue item to send
   */
  private async sendQueuedEmail(item: SendQueueDocument): Promise<void> {
    const db = getDatabase()
    const sendQueue = db.sendQueue
    if (!sendQueue) return

    // Mark as sending
    this.processingIds.add(item.id)
    await sendQueue.findOne(item.id).update({
      $set: { status: 'sending' as SendQueueStatus, updatedAt: Date.now() },
    })
    this.events$.next({ type: 'sending', item: { ...item, status: 'sending' } })

    try {
      // Get provider for this account
      const provider = this.getProviderForAccount(item.accountId)
      if (!provider) {
        throw new Error(`No send provider registered for account: ${item.accountId}`)
      }

      // Send via provider
      const sentMessageId = await provider.sendEmail(item)

      // Update status to sent
      const now = Date.now()
      await sendQueue.findOne(item.id).update({
        $set: {
          status: 'sent' as SendQueueStatus,
          sentAt: now,
          sentMessageId,
          updatedAt: now,
        },
      })

      logger.info('sendQueue', 'Email sent successfully', {
        id: item.id,
        sentMessageId,
      })

      const sentItem = { ...item, status: 'sent' as const, sentAt: now, sentMessageId }
      this.events$.next({ type: 'sent', item: sentItem, messageId: sentMessageId })
    } catch (error) {
      await this.handleSendError(item, error)
    } finally {
      this.processingIds.delete(item.id)
    }
  }

  /**
   * Handle send error with retry logic
   * AC 5: Failed sends retry automatically with exponential backoff
   *
   * @param item - Queue item that failed
   * @param error - The error that occurred
   */
  private async handleSendError(item: SendQueueDocument, error: unknown): Promise<void> {
    const db = getDatabase()
    const sendQueue = db.sendQueue
    if (!sendQueue) return

    const attempts = item.attempts + 1
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // Determine if we should retry
    const shouldRetry = attempts < MAX_ATTEMPTS
    const status: SendQueueStatus = shouldRetry ? 'pending' : 'failed'

    // Update queue item
    await sendQueue.findOne(item.id).update({
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

      logger.warn('sendQueue', 'Send failed, scheduling retry', {
        id: item.id,
        attempts,
        delayMs,
        error: errorMessage,
      })

      this.events$.next({ type: 'retry-scheduled', item: updatedItem, delayMs })

      // Schedule the retry
      setTimeout(() => {
        this.sendQueuedEmail({ ...updatedItem, status: 'pending' })
      }, delayMs)
    } else {
      logger.error('sendQueue', 'Send failed permanently after max attempts', {
        id: item.id,
        attempts,
        error: errorMessage,
      })

      this.events$.next({ type: 'failed', item: updatedItem, error: errorMessage })
    }
  }

  /**
   * Cancel a queued email
   * AC 6: User can cancel queued email before it's sent
   *
   * @param id - Queue item ID to cancel
   * @returns true if cancelled, false if not found or not cancellable
   */
  async cancelQueuedEmail(id: string): Promise<boolean> {
    const db = getDatabase()
    const sendQueue = db.sendQueue
    if (!sendQueue) return false

    const item = await sendQueue.findOne(id).exec()
    if (!item) {
      logger.warn('sendQueue', 'Cannot cancel - item not found', { id })
      return false
    }

    // Only pending items can be cancelled
    if (item.status !== 'pending') {
      logger.warn('sendQueue', 'Cannot cancel - item not pending', {
        id,
        status: item.status,
      })
      return false
    }

    // Check if currently being processed
    if (this.processingIds.has(id)) {
      logger.warn('sendQueue', 'Cannot cancel - item is being sent', { id })
      return false
    }

    // Update status to cancelled
    await item.update({
      $set: { status: 'cancelled' as SendQueueStatus, updatedAt: Date.now() },
    })

    logger.info('sendQueue', 'Email cancelled', { id })
    this.events$.next({ type: 'cancelled', item: { ...item.toJSON(), status: 'cancelled' } })

    return true
  }

  /**
   * Retry a failed email manually
   *
   * @param id - Queue item ID to retry
   * @returns true if retry started, false if not found or not retryable
   */
  async retryFailedEmail(id: string): Promise<boolean> {
    const db = getDatabase()
    const sendQueue = db.sendQueue
    if (!sendQueue) return false

    const item = await sendQueue.findOne(id).exec()
    if (!item) {
      logger.warn('sendQueue', 'Cannot retry - item not found', { id })
      return false
    }

    // Only failed items can be retried
    if (item.status !== 'failed') {
      logger.warn('sendQueue', 'Cannot retry - item not failed', {
        id,
        status: item.status,
      })
      return false
    }

    // Reset status to pending and reset attempts
    await item.update({
      $set: {
        status: 'pending' as SendQueueStatus,
        attempts: 0,
        error: undefined,
        updatedAt: Date.now(),
      },
    })

    logger.info('sendQueue', 'Email queued for retry', { id })

    // Process immediately
    const updatedItem = await sendQueue.findOne(id).exec()
    if (updatedItem) {
      this.sendQueuedEmail(updatedItem.toJSON() as SendQueueDocument)
    }

    return true
  }

  /**
   * Get reactive observable of all queue items
   * AC 4: User can view all queued emails
   */
  getQueueItems$(): Promise<Observable<SendQueueDocument[]>> {
    return this.getQueueItemsObservable()
  }

  private async getQueueItemsObservable(): Promise<Observable<SendQueueDocument[]>> {
    const db = getDatabase()
    const sendQueue = db.sendQueue
    if (!sendQueue) {
      return new Observable((subscriber) => {
        subscriber.next([])
        subscriber.complete()
      })
    }

    return sendQueue.find().sort({ createdAt: 'desc' }).$
  }

  /**
   * Get all pending items count
   * Used for badge display on Outbox link
   */
  async getPendingCount(): Promise<number> {
    const db = getDatabase()
    const sendQueue = db.sendQueue
    if (!sendQueue) return 0

    const pending = await sendQueue
      .find({
        selector: { status: { $in: ['pending', 'sending'] } },
      })
      .exec()

    return pending.length
  }

  /**
   * Get failed items count
   */
  async getFailedCount(): Promise<number> {
    const db = getDatabase()
    const sendQueue = db.sendQueue
    if (!sendQueue) return 0

    const failed = await sendQueue
      .find({
        selector: { status: 'failed' },
      })
      .exec()

    return failed.length
  }

  /**
   * Clean up old sent/cancelled items
   * @param maxAgeMs - Maximum age of items to keep (default: 5 minutes)
   */
  async cleanupOldItems(maxAgeMs: number = 5 * 60 * 1000): Promise<number> {
    const db = getDatabase()
    const sendQueue = db.sendQueue
    if (!sendQueue) return 0

    const cutoffTime = Date.now() - maxAgeMs

    const oldItems = await sendQueue
      .find({
        selector: {
          status: { $in: ['sent', 'cancelled'] },
          updatedAt: { $lt: cutoffTime },
        },
      })
      .exec()

    for (const item of oldItems) {
      await item.remove()
    }

    if (oldItems.length > 0) {
      logger.debug('sendQueue', 'Cleaned up old items', { count: oldItems.length })
    }

    return oldItems.length
  }

  /**
   * Initialize the service
   * Called on app startup to restore any pending items
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    logger.info('sendQueue', 'Initializing send queue service')

    // Clean up old sent/cancelled items
    await this.cleanupOldItems()

    // Log pending items count
    const pendingCount = await this.getPendingCount()
    if (pendingCount > 0) {
      logger.info('sendQueue', 'Found pending items from previous session', {
        count: pendingCount,
      })
    }

    this.initialized = true
  }
}

// Export singleton instance getter
export const sendQueueService = SendQueueService.getInstance()
