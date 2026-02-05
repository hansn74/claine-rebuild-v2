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
import { circuitBreaker } from '@/services/sync/circuitBreaker'
import { classifyError } from '@/services/sync/errorClassification'
import { attachmentBlobStore } from '@/services/email/attachmentBlobStore'
import { logger } from '@/services/logger'
import type { ProviderId } from '@/services/sync/circuitBreakerTypes'
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
  /**
   * In-memory fallback cache for attachment content when IndexedDB quota is exceeded.
   * Story 2.18: Primary storage moved to attachmentBlobStore (IndexedDB).
   * This cache is only used when quota check fails — content here is lost on page refresh.
   */
  private attachmentContentCache = new Map<string, string>()

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
   * Extract provider ID from accountId for circuit breaker (Task 6)
   * @param accountId - Account identifier (format: 'provider:email')
   * @returns ProviderId or null
   */
  private getProviderIdForAccount(accountId: string): ProviderId | null {
    const providerType = accountId.split(':')[0]
    if (providerType === 'gmail' || providerType === 'outlook') {
      return providerType
    }
    return null
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
    const queueId = `send-${now}-${Math.random().toString(36).slice(2, 11)}`

    // Story 2.18 (Task 1.3, 1.7): Store attachment content in IndexedDB blob store
    // Falls back to in-memory cache if quota is insufficient
    const attachments = await Promise.all(
      (draft.attachments || []).map(async (att) => {
        if (att.content && att.content.length > 0) {
          // AC 4: Check quota before persisting large attachments
          const quota = await attachmentBlobStore.checkQuota(att.size)
          if (quota.sufficient) {
            await attachmentBlobStore.put(queueId, att.id, att.content, att.size, att.mimeType)
          } else {
            // Quota insufficient — fall back to in-memory cache and warn
            logger.warn('sendQueue', 'Storage quota insufficient, using memory cache', {
              queueId,
              attachmentId: att.id,
              filename: att.filename,
              required: quota.required,
              available: quota.available,
            })
            this.attachmentContentCache.set(`${queueId}:${att.id}`, att.content)
          }
        }
        return {
          id: att.id,
          filename: att.filename,
          mimeType: att.mimeType,
          size: att.size,
          content: '',
        }
      })
    )

    logger.info('sendQueue', 'Attachment storage', {
      draftAttachmentCount: draft.attachments?.length || 0,
      queueAttachmentCount: attachments.length,
    })

    const queueItem: SendQueueDocument = {
      id: queueId,
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
      attachments,
      status: 'pending',
      attempts: 0,
      maxAttempts: MAX_ATTEMPTS,
      // Story 2.18 (Task 3.1): Idempotency key for duplicate send prevention
      idempotencyKey: crypto.randomUUID(),
      lastProcessedBy: 'app',
      createdAt: now,
      updatedAt: now,
    }

    await db.sendQueue?.insert(queueItem)
    logger.info('sendQueue', 'Email queued', {
      id: queueItem.id,
      to: queueItem.to.map((t) => t.email).join(', '),
    })

    // Story 2.18 (Task 6.1): Register Background Sync if available
    await this.registerBackgroundSync()

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
   * Story 1.19: Added forceSend parameter (Task 6, AC 17)
   * @param item - Queue item to send
   * @param forceSend - If true, bypasses circuit breaker check (for user-initiated sends)
   */
  private async sendQueuedEmail(item: SendQueueDocument, forceSend = false): Promise<void> {
    const db = getDatabase()
    const sendQueue = db.sendQueue
    if (!sendQueue) return

    // Story 2.18 (Task 3.2): Check if already sent (idempotency)
    if (item.sentMessageId) {
      logger.debug('sendQueue', 'Skipping already-sent item', { id: item.id })
      return
    }

    // Story 2.18 (Task 3.3): Skip if already being processed
    if (item.status === 'sending' || item.status === 'sent') {
      logger.debug('sendQueue', 'Skipping item in non-pending state', {
        id: item.id,
        status: item.status,
      })
      return
    }

    // Story 1.19: Check circuit breaker before sending (Task 6.2, AC 17)
    const providerId = this.getProviderIdForAccount(item.accountId)
    if (!forceSend && providerId && !circuitBreaker.canExecute(providerId)) {
      logger.debug('sync', 'Circuit open, deferring send', {
        queueId: item.id,
        provider: providerId,
      })
      return // Leave as pending, will be processed when circuit closes
    }

    // Mark as sending with app ownership (Task 3.5: atomic lock via update)
    this.processingIds.add(item.id)
    await sendQueue.findOne(item.id).update({
      $set: {
        status: 'sending' as SendQueueStatus,
        lastProcessedBy: 'app',
        lastAttemptAt: Date.now(),
        updatedAt: Date.now(),
      },
    })
    this.events$.next({ type: 'sending', item: { ...item, status: 'sending' } })

    try {
      // Get provider for this account
      const provider = this.getProviderForAccount(item.accountId)
      if (!provider) {
        throw new Error(`No send provider registered for account: ${item.accountId}`)
      }

      // Hydrate attachment content from blob store / cache before sending
      const hydratedItem = await this.hydrateAttachmentContent(item)

      logger.debug('sendQueue', 'Sending with hydrated attachments', {
        id: item.id,
        attachmentCount: hydratedItem.attachments.length,
        hasContent: hydratedItem.attachments.map((a) => ({
          filename: a.filename,
          hasContent: !!a.content && a.content.length > 0,
          contentLength: a.content?.length || 0,
        })),
      })

      // Send via provider
      const sentMessageId = await provider.sendEmail(hydratedItem)

      // Story 1.19: Record success (Task 6.5)
      if (providerId) {
        circuitBreaker.recordSuccess(providerId)
      }

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

      // Clean up attachment content from blob store and cache after successful send
      await this.cleanupAttachmentStorage(item.id, item.attachments)

      const sentItem = { ...item, status: 'sent' as const, sentAt: now, sentMessageId }
      this.events$.next({ type: 'sent', item: sentItem, messageId: sentMessageId })
    } catch (error) {
      // Story 1.19: Record failure for transient errors (Task 6.4)
      if (providerId) {
        const classified = classifyError(error)
        if (classified.type === 'transient' || classified.type === 'unknown') {
          circuitBreaker.recordFailure(providerId)
        }
      }
      await this.handleSendError(item, error)
    } finally {
      this.processingIds.delete(item.id)
    }
  }

  /**
   * Hydrate attachment content from IndexedDB blob store or fallback memory cache.
   * Story 2.18 (Task 1.4): Primary source is attachmentBlobStore (persists across refresh).
   * Falls back to in-memory cache for items stored there due to quota limits.
   *
   * @param item - Queue item with empty attachment content
   * @returns Queue item with hydrated attachment content
   */
  private async hydrateAttachmentContent(item: SendQueueDocument): Promise<SendQueueDocument> {
    if (!item.attachments || item.attachments.length === 0) {
      return item
    }

    const hydratedAttachments = await Promise.all(
      item.attachments.map(async (att) => {
        // Try IndexedDB blob store first (persistent)
        const blobRecord = await attachmentBlobStore.get(item.id, att.id)
        if (blobRecord) {
          logger.debug('sendQueue', 'Hydrated attachment from blob store', {
            filename: att.filename,
            contentLength: blobRecord.blob.length,
          })
          return { ...att, content: blobRecord.blob }
        }

        // Fallback to in-memory cache (non-persistent, used when quota exceeded)
        const cacheKey = `${item.id}:${att.id}`
        const cachedContent = this.attachmentContentCache.get(cacheKey)
        if (cachedContent) {
          logger.debug('sendQueue', 'Hydrated attachment from memory cache', {
            filename: att.filename,
            contentLength: cachedContent.length,
          })
          return { ...att, content: cachedContent }
        }

        // Content not available — lost after page refresh when only in memory
        logger.warn('sendQueue', 'Attachment content not available', {
          queueId: item.id,
          attachmentId: att.id,
          filename: att.filename,
        })
        return att
      })
    )

    return { ...item, attachments: hydratedAttachments }
  }

  /**
   * Clean up attachment content from blob store and memory cache after successful send.
   * Story 2.18 (Task 1.5): Cleans both IndexedDB blob store and in-memory fallback cache.
   *
   * AC 3: Attachment storage cleaned up after successful send (no orphaned blobs)
   *
   * @param queueId - Queue item ID
   * @param attachments - Attachments to clean up
   */
  private async cleanupAttachmentStorage(
    queueId: string,
    attachments: SendQueueDocument['attachments']
  ): Promise<void> {
    // Clean IndexedDB blob store
    try {
      const deleted = await attachmentBlobStore.deleteForQueueItem(queueId)
      if (deleted > 0) {
        logger.debug('sendQueue', 'Cleaned up blobs from store', { queueId, count: deleted })
      }
    } catch (err) {
      logger.warn('sendQueue', 'Failed to clean blob store', { queueId, error: err })
    }

    // Clean in-memory fallback cache
    if (attachments && attachments.length > 0) {
      for (const att of attachments) {
        this.attachmentContentCache.delete(`${queueId}:${att.id}`)
      }
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

    // Story 2.18 (Task 1.6): Clean up attachment blobs on cancel
    await this.cleanupAttachmentStorage(id, item.toJSON().attachments)

    logger.info('sendQueue', 'Email cancelled', { id })
    this.events$.next({
      type: 'cancelled',
      item: { ...item.toJSON(), status: 'cancelled' as SendQueueStatus } as SendQueueDocument,
    })

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

    // Story 2.18 (Task 6.3): Re-register Background Sync on retry
    await this.registerBackgroundSync()

    // Process immediately — user-initiated retry bypasses circuit breaker (AC 17)
    const updatedItem = await sendQueue.findOne(id).exec()
    if (updatedItem) {
      this.sendQueuedEmail(updatedItem.toJSON() as SendQueueDocument, true)
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
   * Called on app startup to restore any pending items.
   * Story 2.18: Now includes queue state reconciliation and orphan blob cleanup.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    logger.info('sendQueue', 'Initializing send queue service')

    // Subscribe to circuit breaker recovery to drain deferred sends (AC 6)
    this.subscribeToCircuitRecovery()

    // Clean up old sent/cancelled items
    await this.cleanupOldItems()

    // Story 2.18 (Task 5): Reconcile queue state on startup
    await this.reconcileQueueState()

    // Log pending items count
    const pendingCount = await this.getPendingCount()
    if (pendingCount > 0) {
      logger.info('sendQueue', 'Found pending items from previous session', {
        count: pendingCount,
      })
    }

    this.initialized = true
  }

  /**
   * Reconcile queue state after app restart.
   * Story 2.18 (Task 5): Handles stale states, orphaned blobs, missing attachments.
   *
   * AC 9: Queue survives page refresh, tab closure, browser restart
   * AC 12: Queue status accurately reflects actual state after app restart
   */
  async reconcileQueueState(): Promise<void> {
    const db = getDatabase()
    const sendQueue = db.sendQueue
    if (!sendQueue) return

    const STALE_THRESHOLD_MS = 2 * 60 * 1000 // 2 minutes

    // Task 5.2: Reset stale 'sending' items back to 'pending'
    const sendingItems = await sendQueue.find({ selector: { status: 'sending' } }).exec()

    for (const item of sendingItems) {
      const lastAttempt = item.lastAttemptAt || item.updatedAt
      if (Date.now() - lastAttempt > STALE_THRESHOLD_MS) {
        await item.update({
          $set: {
            status: 'pending' as SendQueueStatus,
            updatedAt: Date.now(),
          },
        })
        logger.info('sendQueue', 'Reset stale sending item to pending', { id: item.id })
      }
    }

    // Task 5.3: Verify attachment blobs exist for pending items
    const pendingItems = await sendQueue.find({ selector: { status: 'pending' } }).exec()

    for (const item of pendingItems) {
      const doc = item.toJSON() as SendQueueDocument
      if (doc.attachments && doc.attachments.length > 0) {
        const hasBlobs = await attachmentBlobStore.hasBlobs(doc.id)
        const hasMemCache = doc.attachments.some((att) =>
          this.attachmentContentCache.has(`${doc.id}:${att.id}`)
        )

        if (!hasBlobs && !hasMemCache) {
          logger.warn('sendQueue', 'Pending item missing attachment blobs', {
            id: doc.id,
            attachmentCount: doc.attachments.length,
          })
        }
      }
    }

    // Task 5.4: Clean up orphaned blobs (blobs for queue items that no longer exist)
    const allItems = await sendQueue.find().exec()
    const activeIds = new Set(allItems.map((item) => item.id))
    const orphansRemoved = await attachmentBlobStore.cleanupOrphanedBlobs(activeIds)
    if (orphansRemoved > 0) {
      logger.info('sendQueue', 'Removed orphaned attachment blobs', { count: orphansRemoved })
    }
  }

  /**
   * Register a Background Sync event with the service worker.
   * Story 2.18 (Task 6.1, AC 5): Enables send queue processing even after tab closure.
   * Only works on Chromium browsers with SyncManager support (Task 2.7).
   */
  async registerBackgroundSync(): Promise<void> {
    try {
      if (!('serviceWorker' in navigator) || !('SyncManager' in window)) {
        return // Not supported — fallback handled by useQueueProcessor
      }

      const registration = await navigator.serviceWorker.ready
      await registration.sync.register('send-queue-sync')
      logger.debug('sendQueue', 'Background Sync registered')
    } catch (err) {
      // Background Sync registration failure is not critical
      logger.warn('sendQueue', 'Failed to register Background Sync', { error: err })
    }
  }

  /**
   * Subscribe to circuit breaker state changes to drain deferred sends
   * when a provider's circuit recovers (AC 6: drain queued items on close)
   */
  private subscribeToCircuitRecovery(): void {
    let previousStates: Record<string, string> = {}

    circuitBreaker.subscribe(() => {
      const gmailState = circuitBreaker.getStatus('gmail').state
      const outlookState = circuitBreaker.getStatus('outlook').state

      const gmailRecovered =
        (previousStates['gmail'] === 'open' || previousStates['gmail'] === 'half-open') &&
        gmailState === 'closed'
      const outlookRecovered =
        (previousStates['outlook'] === 'open' || previousStates['outlook'] === 'half-open') &&
        outlookState === 'closed'

      if (gmailRecovered || outlookRecovered) {
        logger.info('sendQueue', 'Circuit recovered, draining deferred sends')
        this.processQueue()
      }

      previousStates = { gmail: gmailState, outlook: outlookState }
    })
  }
}

// Export singleton instance getter
export const sendQueueService = SendQueueService.getInstance()
