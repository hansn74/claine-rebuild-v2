/**
 * Modifier Processor Service
 *
 * Epic 3: Offline-First Modifier Architecture
 * Story 3.1: Core Modifier Infrastructure
 * Story 2.19: Parallel Action Queue Processing
 *
 * Processes pending modifiers when online with retry logic.
 *
 * Key Features:
 * - Online/offline detection
 * - Exponential backoff retry (1s, 5s, 30s, 60s)
 * - Per-thread queue processing (maintains ordering within thread)
 * - Configurable parallel processing across independent threads (default: 4)
 * - Rate limiter integration with dynamic concurrency reduction
 * - Error isolation — failures in one worker don't affect others
 * - Automatic retry on network recovery
 * - Rollback on permanent failure
 *
 * Data Flow:
 * 1. User action → Create Modifier → Add to Queue
 * 2. modify() runs synchronously → UI updates immediately
 * 3. persist() runs async when online
 * 4. On success: refresh cache from server
 * 5. On failure: retry or rollback (remove modifier)
 */

import { Subject, Observable, Subscription } from 'rxjs'
import { logger } from '@/services/logger'
import { modifierQueue } from './modifierQueue'
import { modifierFactory } from './modifierFactory'
import type { ModifierDocument, ModifierQueueEvent } from './types'
import { RETRY_DELAYS, MAX_ATTEMPTS, PARALLEL_ACTION_CONCURRENCY } from './types'
import { circuitBreaker } from '@/services/sync/circuitBreaker'
import {
  createGmailRateLimiter,
  createOutlookRateLimiter,
  type RateLimiter,
} from '@/services/sync/rateLimiter'

/**
 * Processor event types
 */
export type ProcessorEvent =
  | { type: 'online' }
  | { type: 'offline' }
  | { type: 'processing-started'; count: number }
  | { type: 'processing-completed'; successful: number; failed: number }
  | { type: 'modifier-synced'; modifierId: string }
  | { type: 'modifier-failed'; modifierId: string; error: string }
  | { type: 'throttle-change'; concurrency: number; reason: string }

/**
 * Modifier Processor Service
 *
 * Singleton service that processes modifiers when online.
 * Handles retry logic with exponential backoff.
 * Story 2.19: Supports configurable parallel processing with thread-level grouping.
 */
export class ModifierProcessor {
  private static instance: ModifierProcessor
  private events$ = new Subject<ProcessorEvent>()
  private online = typeof navigator !== 'undefined' ? navigator.onLine : true
  private processing = false
  private processingIds = new Set<string>()
  private retryTimers = new Map<string, ReturnType<typeof setTimeout>>()
  private queueSubscription: Subscription | null = null
  private initialized = false

  /** Configurable max concurrency (Story 2.19) */
  private _maxConcurrency: number = PARALLEL_ACTION_CONCURRENCY

  /** Current effective concurrency (may be reduced by rate limiter) */
  private _effectiveConcurrency: number = PARALLEL_ACTION_CONCURRENCY

  /** Per-provider rate limiters (Story 2.19 Task 4) */
  private rateLimiters: Map<string, RateLimiter> = new Map()

  private constructor() {
    // Set up network listeners
    this.setupNetworkListeners()
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): ModifierProcessor {
    if (!ModifierProcessor.instance) {
      ModifierProcessor.instance = new ModifierProcessor()
    }
    return ModifierProcessor.instance
  }

  /**
   * Get observable for processor events
   */
  getEvents$(): Observable<ProcessorEvent> {
    return this.events$.asObservable()
  }

  /**
   * Check if online
   */
  isOnline(): boolean {
    return this.online
  }

  /**
   * Check if currently processing
   */
  isProcessing(): boolean {
    return this.processing
  }

  /**
   * Get the current concurrency level (Story 2.19 Task 1.5)
   */
  get concurrencyLevel(): number {
    return this._effectiveConcurrency
  }

  /**
   * Get the number of currently active processing operations
   */
  get activeCount(): number {
    return this.processingIds.size
  }

  /**
   * Get the rate limiter for a provider (Task 4.1)
   * Creates one lazily if it doesn't exist.
   */
  private getRateLimiter(provider: string): RateLimiter {
    let limiter = this.rateLimiters.get(provider)
    if (!limiter) {
      limiter = provider === 'outlook' ? createOutlookRateLimiter() : createGmailRateLimiter()
      this.rateLimiters.set(provider, limiter)
    }
    return limiter
  }

  /**
   * Check and adjust concurrency based on rate limiter usage (Task 4.2, 4.3)
   */
  private adjustConcurrencyForRateLimit(provider: string): void {
    const limiter = this.getRateLimiter(provider)
    const usage = limiter.getCurrentUsage()

    if (usage > 80 && this._effectiveConcurrency === this._maxConcurrency) {
      // Reduce concurrency when rate limit is high
      this._effectiveConcurrency = Math.max(2, Math.floor(this._maxConcurrency / 2))
      this.events$.next({
        type: 'throttle-change',
        concurrency: this._effectiveConcurrency,
        reason: `Rate limit at ${usage.toFixed(0)}%, reducing concurrency`,
      })
      logger.warn('modifier-processor', 'Reducing concurrency due to rate limit', {
        usage,
        newConcurrency: this._effectiveConcurrency,
      })
    } else if (usage < 60 && this._effectiveConcurrency < this._maxConcurrency) {
      // Restore concurrency when usage drops
      this._effectiveConcurrency = this._maxConcurrency
      this.events$.next({
        type: 'throttle-change',
        concurrency: this._effectiveConcurrency,
        reason: `Rate limit at ${usage.toFixed(0)}%, restoring concurrency`,
      })
      logger.info('modifier-processor', 'Restoring concurrency', {
        usage,
        restoredConcurrency: this._effectiveConcurrency,
      })
    }
  }

  /**
   * Initialize the processor
   * Call this on app startup after database is initialized
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    // Initialize the queue first
    await modifierQueue.initialize()

    // Subscribe to queue events
    this.queueSubscription = modifierQueue.getEvents$().subscribe((event) => {
      this.handleQueueEvent(event)
    })

    // Process any pending modifiers if online
    if (this.online) {
      this.processQueue()
    }

    logger.info('modifier-processor', 'Processor initialized', { online: this.online })
    this.initialized = true
  }

  /**
   * Process all pending modifiers
   *
   * Story 2.19: Groups by threadId (falling back to entityId) and processes
   * independent groups in parallel up to maxConcurrency.
   *
   * @param maxConcurrency - Maximum number of concurrent group processing (default: PARALLEL_ACTION_CONCURRENCY)
   */
  async processQueue(maxConcurrency?: number): Promise<void> {
    if (!this.online) {
      logger.debug('modifier-processor', 'Skipping processing - offline')
      return
    }

    if (this.processing) {
      logger.debug('modifier-processor', 'Already processing')
      return
    }

    // Apply provided concurrency or use configured value
    if (maxConcurrency !== undefined) {
      this._maxConcurrency = maxConcurrency
      this._effectiveConcurrency = maxConcurrency
    }

    this.processing = true
    const pending = modifierQueue.getAllPendingModifiers()

    if (pending.length === 0) {
      this.processing = false
      return
    }

    logger.info('modifier-processor', 'Processing queue', {
      count: pending.length,
      concurrency: this._effectiveConcurrency,
    })
    this.events$.next({ type: 'processing-started', count: pending.length })

    let successful = 0
    let failed = 0

    // Group modifiers by thread (Story 2.19 Task 2.3, 2.4)
    // Use threadId for grouping; fall back to entityId if threadId is not set
    const byGroup = new Map<string, ModifierDocument[]>()
    for (const mod of pending) {
      const groupKey = mod.threadId ?? mod.entityId
      const existing = byGroup.get(groupKey) || []
      existing.push(mod)
      byGroup.set(groupKey, existing)
    }

    // Process groups with bounded concurrency using a semaphore pattern (Task 1.3)
    const groupEntries = Array.from(byGroup.values())
    let groupIndex = 0

    const worker = async () => {
      while (groupIndex < groupEntries.length) {
        const idx = groupIndex++
        const modifiers = groupEntries[idx]

        // Process modifiers for this group sequentially (Task 1.4 — FIFO within group)
        for (const modifier of modifiers) {
          // Skip if already processing
          if (this.processingIds.has(modifier.id)) continue

          // Check rate limit and adjust concurrency (Task 4.2, 4.3)
          this.adjustConcurrencyForRateLimit(modifier.provider)

          // Check circuit breaker before processing (Task 5.4)
          if (!circuitBreaker.canExecute(modifier.provider)) {
            logger.warn('modifier-processor', 'Circuit breaker open, skipping modifier', {
              id: modifier.id,
              provider: modifier.provider,
            })
            failed++
            continue
          }

          try {
            // Acquire rate limiter token before persist (Task 4.1)
            const limiter = this.getRateLimiter(modifier.provider)
            await limiter.acquireAndWait(1)

            await this.processModifier(modifier)
            circuitBreaker.recordSuccess(modifier.provider)
            successful++
          } catch {
            circuitBreaker.recordFailure(modifier.provider)
            failed++
            // Error is handled inside processModifier — do not propagate (Task 5.1)
          }
        }
      }
    }

    // Spawn workers up to effective concurrency (Task 1.3)
    const workerCount = Math.min(this._effectiveConcurrency, groupEntries.length)
    const workers = Array.from({ length: workerCount }, () => worker())
    await Promise.all(workers)

    this.processing = false
    this.events$.next({ type: 'processing-completed', successful, failed })

    logger.info('modifier-processor', 'Queue processing completed', { successful, failed })
  }

  /**
   * Process a single modifier
   *
   * @param modifierDoc - Modifier document to process
   */
  private async processModifier(modifierDoc: ModifierDocument): Promise<void> {
    if (this.processingIds.has(modifierDoc.id)) {
      return
    }

    this.processingIds.add(modifierDoc.id)

    try {
      // Mark as processing
      await modifierQueue.updateStatus(modifierDoc.id, 'processing')

      // Reconstruct the modifier instance
      const modifier = modifierFactory.fromDocument(modifierDoc)

      // Call persist()
      await modifier.persist()

      // Mark as completed
      await modifierQueue.markCompleted(modifierDoc.id)

      this.events$.next({ type: 'modifier-synced', modifierId: modifierDoc.id })

      logger.info('modifier-processor', 'Modifier synced', {
        id: modifierDoc.id,
        type: modifierDoc.type,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      // Determine if this is a permanent failure
      const isPermanent = this.isPermanentError(error)
      const shouldRetry = !isPermanent && modifierDoc.attempts < MAX_ATTEMPTS

      if (shouldRetry) {
        // Schedule retry
        await this.scheduleRetry(modifierDoc, errorMessage)
      } else {
        // Mark as permanently failed
        await modifierQueue.markFailed(modifierDoc.id, errorMessage, true)
        this.events$.next({
          type: 'modifier-failed',
          modifierId: modifierDoc.id,
          error: errorMessage,
        })
      }

      throw error
    } finally {
      this.processingIds.delete(modifierDoc.id)
    }
  }

  /**
   * Schedule a retry with exponential backoff
   *
   * @param modifierDoc - Modifier document to retry
   * @param error - Error message from previous attempt
   */
  private async scheduleRetry(modifierDoc: ModifierDocument, error: string): Promise<void> {
    // Mark as pending (not failed yet)
    await modifierQueue.markFailed(modifierDoc.id, error, false)

    // Calculate delay
    const attemptIndex = Math.min(modifierDoc.attempts, RETRY_DELAYS.length - 1)
    const delayMs = RETRY_DELAYS[attemptIndex]

    logger.warn('modifier-processor', 'Scheduling retry', {
      id: modifierDoc.id,
      attempts: modifierDoc.attempts + 1,
      delayMs,
      error,
    })

    // Cancel any existing retry timer
    const existingTimer = this.retryTimers.get(modifierDoc.id)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    // Schedule retry
    const timer = setTimeout(() => {
      this.retryTimers.delete(modifierDoc.id)
      if (this.online) {
        // Refetch the latest state and retry
        const currentModifiers = modifierQueue.getModifiersForEntity(modifierDoc.entityId)
        const currentDoc = currentModifiers.find((m) => m.id === modifierDoc.id)
        if (currentDoc && currentDoc.status === 'pending') {
          this.processModifier(currentDoc).catch(() => {
            // Error handled in processModifier
          })
        }
      }
    }, delayMs)

    this.retryTimers.set(modifierDoc.id, timer)
  }

  /**
   * Check if an error is permanent (should not be retried)
   *
   * @param error - Error to check
   */
  private isPermanentError(error: unknown): boolean {
    if (!(error instanceof Error)) return false

    const message = error.message.toLowerCase()

    // Permanent errors that shouldn't be retried
    return (
      message.includes('not found') ||
      message.includes('404') ||
      message.includes('invalid') ||
      message.includes('unauthorized') ||
      message.includes('forbidden') ||
      message.includes('403') ||
      message.includes('400')
    )
  }

  /**
   * Handle queue events
   */
  private handleQueueEvent(event: ModifierQueueEvent): void {
    switch (event.type) {
      case 'added':
        // Process immediately if online
        if (this.online && !this.processingIds.has(event.modifier.id)) {
          this.processModifier(event.modifier).catch(() => {
            // Error handled in processModifier
          })
        }
        break
    }
  }

  /**
   * Set up network status listeners
   */
  private setupNetworkListeners(): void {
    if (typeof window === 'undefined') return

    window.addEventListener('online', () => {
      this.online = true
      logger.info('modifier-processor', 'Network online, processing queue')
      this.events$.next({ type: 'online' })
      this.processQueue()
    })

    window.addEventListener('offline', () => {
      this.online = false
      logger.info('modifier-processor', 'Network offline')
      this.events$.next({ type: 'offline' })
    })
  }

  /**
   * Cancel all pending retries
   */
  cancelAllRetries(): void {
    for (const timer of this.retryTimers.values()) {
      clearTimeout(timer)
    }
    this.retryTimers.clear()
  }

  /**
   * Shutdown the processor
   */
  shutdown(): void {
    this.cancelAllRetries()
    if (this.queueSubscription) {
      this.queueSubscription.unsubscribe()
      this.queueSubscription = null
    }
    this.processing = false
    this.processingIds.clear()
    this.initialized = false
  }

  /**
   * Reset singleton instance (for testing)
   * @internal
   */
  static __resetForTesting(): void {
    if (ModifierProcessor.instance) {
      ModifierProcessor.instance.shutdown()
      ModifierProcessor.instance.events$.complete()
    }
    ModifierProcessor.instance = null as unknown as ModifierProcessor
  }

  /**
   * Expose internals for testing and dev mode (Story 2.19 Task 7.2)
   * @internal
   */
  __getTestState(): {
    concurrency: number
    activeCount: number
    queueLength: number
  } {
    return {
      concurrency: this._effectiveConcurrency,
      activeCount: this.processingIds.size,
      queueLength: modifierQueue.getPendingCount(),
    }
  }
}

/**
 * Singleton instance export
 */
export const modifierProcessor = ModifierProcessor.getInstance()
