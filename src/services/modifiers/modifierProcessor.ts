/**
 * Modifier Processor Service
 *
 * Epic 3: Offline-First Modifier Architecture
 * Story 3.1: Core Modifier Infrastructure
 *
 * Processes pending modifiers when online with retry logic.
 *
 * Key Features:
 * - Online/offline detection
 * - Exponential backoff retry (1s, 5s, 30s, 60s)
 * - Per-entity queue processing (maintains ordering)
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
import { RETRY_DELAYS, MAX_ATTEMPTS } from './types'

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

/**
 * Modifier Processor Service
 *
 * Singleton service that processes modifiers when online.
 * Handles retry logic with exponential backoff.
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
   * @param maxConcurrent - Maximum number of concurrent syncs per entity
   */
  async processQueue(maxConcurrent = 1): Promise<void> {
    if (!this.online) {
      logger.debug('modifier-processor', 'Skipping processing - offline')
      return
    }

    if (this.processing) {
      logger.debug('modifier-processor', 'Already processing')
      return
    }

    this.processing = true
    const pending = modifierQueue.getAllPendingModifiers()

    if (pending.length === 0) {
      this.processing = false
      return
    }

    logger.info('modifier-processor', 'Processing queue', { count: pending.length })
    this.events$.next({ type: 'processing-started', count: pending.length })

    let successful = 0
    let failed = 0

    // Group modifiers by entity to maintain per-entity ordering
    const byEntity = new Map<string, ModifierDocument[]>()
    for (const mod of pending) {
      const existing = byEntity.get(mod.entityId) || []
      existing.push(mod)
      byEntity.set(mod.entityId, existing)
    }

    // Process each entity's queue
    const processingPromises: Promise<void>[] = []

    for (const modifiers of byEntity.values()) {
      // Process modifiers for this entity sequentially (to maintain order)
      const entityPromise = (async () => {
        for (const modifier of modifiers) {
          // Skip if already processing
          if (this.processingIds.has(modifier.id)) continue

          try {
            await this.processModifier(modifier)
            successful++
          } catch {
            failed++
          }
        }
      })()

      processingPromises.push(entityPromise)

      // Limit concurrent entity processing
      if (processingPromises.length >= maxConcurrent * 5) {
        await Promise.race(processingPromises)
      }
    }

    // Wait for all processing to complete
    await Promise.all(processingPromises)

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
}

/**
 * Singleton instance export
 */
export const modifierProcessor = ModifierProcessor.getInstance()
