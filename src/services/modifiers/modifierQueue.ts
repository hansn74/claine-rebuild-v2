/**
 * Modifier Queue Service
 *
 * Epic 3: Offline-First Modifier Architecture
 * Story 3.1: Core Modifier Infrastructure
 *
 * Manages per-entity modifier queues with IndexedDB persistence.
 *
 * Key Features:
 * - Per-entity queues: Each entity (email/draft) has its own queue
 * - FIFO ordering: Modifiers processed in creation order
 * - Persistence: All modifiers stored in IndexedDB for durability
 * - Event emission: Subscribers notified of queue changes
 *
 * Usage:
 * ```typescript
 * const queue = modifierQueue
 *
 * // Add a modifier
 * await queue.add(archiveModifier)
 *
 * // Get pending modifiers for an entity
 * const modifiers = queue.getModifiersForEntity('email-123')
 *
 * // Remove a modifier (for undo/rollback)
 * await queue.remove('modifier-id')
 * ```
 */

import { Subject, Observable } from 'rxjs'
import { getDatabase, isDatabaseInitialized } from '@/services/database/init'
import { logger } from '@/services/logger'
import type { ModifierDocument, ModifierQueueEvent, ModifierStatus, Modifier } from './types'
import { MAX_ATTEMPTS } from './types'

/**
 * In-memory cache of pending modifiers grouped by entity ID.
 * Used for fast lookups when deriving state.
 *
 * Note: Cache is keyed by entityId (individual email/draft ID), not threadId.
 * The modifierProcessor does its own thread-level grouping via threadId when
 * processing the queue. If thread-level state derivation is needed (e.g.,
 * "are there pending modifiers for any email in this thread?"), callers
 * must aggregate across entityIds themselves or a thread-level index
 * should be added here.
 */
type ModifierCache = Map<string, ModifierDocument[]>

/**
 * Modifier Queue Service
 *
 * Singleton service that manages modifier queues.
 * Provides per-entity queues with persistence and event emission.
 */
export class ModifierQueue {
  private static instance: ModifierQueue
  private events$ = new Subject<ModifierQueueEvent>()
  private cache: ModifierCache = new Map()
  private initialized = false

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): ModifierQueue {
    if (!ModifierQueue.instance) {
      ModifierQueue.instance = new ModifierQueue()
    }
    return ModifierQueue.instance
  }

  /**
   * Get observable for queue events
   */
  getEvents$(): Observable<ModifierQueueEvent> {
    return this.events$.asObservable()
  }

  /**
   * Initialize the queue by loading pending modifiers from database
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    if (!isDatabaseInitialized()) {
      logger.warn('modifier-queue', 'Database not initialized, skipping queue init')
      return
    }

    try {
      const db = getDatabase()
      if (!db.modifiers) {
        logger.debug('modifier-queue', 'Modifiers collection not yet available')
        this.initialized = true
        return
      }

      // Load all pending and processing modifiers into cache
      const pendingModifiers = await db.modifiers
        .find({
          selector: {
            status: { $in: ['pending', 'processing'] },
          },
          sort: [{ createdAt: 'asc' }],
        })
        .exec()

      // Group by entity ID
      for (const doc of pendingModifiers) {
        const modifier = doc.toJSON() as ModifierDocument
        const existing = this.cache.get(modifier.entityId) || []
        existing.push(modifier)
        this.cache.set(modifier.entityId, existing)
      }

      logger.info('modifier-queue', 'Queue initialized', {
        entities: this.cache.size,
        modifiers: pendingModifiers.length,
      })

      this.initialized = true
    } catch (error) {
      logger.error('modifier-queue', 'Failed to initialize queue', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /**
   * Add a modifier to the queue
   *
   * @param modifier - Modifier instance to add
   * @returns The persisted modifier document
   */
  async add<T>(modifier: Modifier<T>): Promise<ModifierDocument> {
    const doc = modifier.toDocument()

    // Persist to database
    if (isDatabaseInitialized()) {
      const db = getDatabase()
      if (db.modifiers) {
        await db.modifiers.upsert(doc)
        logger.debug('modifier-queue', 'Modifier persisted', {
          id: doc.id,
          type: doc.type,
          entityId: doc.entityId,
        })
      }
    }

    // Add to cache
    const existing = this.cache.get(doc.entityId) || []
    existing.push(doc)
    // Sort by createdAt to maintain FIFO order
    existing.sort((a, b) => a.createdAt - b.createdAt)
    this.cache.set(doc.entityId, existing)

    logger.info('modifier-queue', 'Modifier added', {
      id: doc.id,
      type: doc.type,
      entityId: doc.entityId,
    })

    this.events$.next({ type: 'added', modifier: doc })

    return doc
  }

  /**
   * Remove a modifier from the queue
   * Used for undo/rollback operations
   *
   * @param modifierId - ID of modifier to remove
   * @returns true if removed, false if not found
   */
  async remove(modifierId: string): Promise<boolean> {
    // Find modifier in cache
    let found = false
    let entityId = ''

    for (const [entId, modifiers] of this.cache) {
      const index = modifiers.findIndex((m) => m.id === modifierId)
      if (index !== -1) {
        entityId = entId
        modifiers.splice(index, 1)
        if (modifiers.length === 0) {
          this.cache.delete(entId)
        }
        found = true
        break
      }
    }

    // Remove from database
    if (isDatabaseInitialized()) {
      const db = getDatabase()
      if (db.modifiers) {
        const doc = await db.modifiers.findOne(modifierId).exec()
        if (doc) {
          entityId = doc.entityId
          await doc.remove()
          found = true
        }
      }
    }

    if (found) {
      logger.info('modifier-queue', 'Modifier removed', { id: modifierId })
      this.events$.next({ type: 'removed', modifierId, entityId })
    }

    return found
  }

  /**
   * Get all pending modifiers for an entity
   * Returns modifiers in FIFO order (oldest first)
   *
   * @param entityId - Entity ID to get modifiers for
   * @returns Array of modifier documents
   */
  getModifiersForEntity(entityId: string): ModifierDocument[] {
    return this.cache.get(entityId) || []
  }

  /**
   * Get all pending modifiers
   * Returns modifiers in FIFO order (oldest first)
   */
  getAllPendingModifiers(): ModifierDocument[] {
    const all: ModifierDocument[] = []
    for (const modifiers of this.cache.values()) {
      all.push(...modifiers.filter((m) => m.status === 'pending'))
    }
    return all.sort((a, b) => a.createdAt - b.createdAt)
  }

  /**
   * Update modifier status
   *
   * @param modifierId - Modifier ID
   * @param status - New status
   * @param error - Optional error message
   */
  async updateStatus(modifierId: string, status: ModifierStatus, error?: string): Promise<void> {
    const now = Date.now()

    // Find current attempts count from cache
    let currentAttempts = 0
    for (const [, modifiers] of this.cache) {
      const modifier = modifiers.find((m) => m.id === modifierId)
      if (modifier) {
        currentAttempts = modifier.attempts
        // Update in cache
        modifier.status = status
        modifier.updatedAt = now
        if (error) modifier.error = error
        if (status === 'processing' || status === 'failed') {
          modifier.lastAttemptAt = now
          modifier.attempts += 1
        }
        break
      }
    }

    // Update in database using patch (simpler than $set/$inc)
    if (isDatabaseInitialized()) {
      const db = getDatabase()
      if (db.modifiers) {
        const doc = await db.modifiers.findOne(modifierId).exec()
        if (doc) {
          const patchData: Record<string, unknown> = {
            status,
            updatedAt: now,
          }
          if (error !== undefined) patchData.error = error
          if (status === 'processing' || status === 'failed') {
            patchData.lastAttemptAt = now
            patchData.attempts = currentAttempts + 1
          }
          await doc.patch(patchData)
        }
      }
    }
  }

  /**
   * Mark modifier as completed and remove from queue
   *
   * @param modifierId - Modifier ID
   */
  async markCompleted(modifierId: string): Promise<void> {
    await this.updateStatus(modifierId, 'completed')

    // Remove from cache (completed modifiers don't need to be in memory)
    let entityId = ''
    for (const [entId, modifiers] of this.cache) {
      const index = modifiers.findIndex((m) => m.id === modifierId)
      if (index !== -1) {
        entityId = entId
        const [completedModifier] = modifiers.splice(index, 1)
        if (modifiers.length === 0) {
          this.cache.delete(entId)
        }
        this.events$.next({ type: 'completed', modifier: completedModifier })
        break
      }
    }

    // Remove from database after a short delay (for debugging/auditing)
    setTimeout(async () => {
      if (isDatabaseInitialized()) {
        const db = getDatabase()
        if (db.modifiers) {
          const doc = await db.modifiers.findOne(modifierId).exec()
          if (doc) {
            await doc.remove()
          }
        }
      }
    }, 5000)

    logger.info('modifier-queue', 'Modifier completed', { id: modifierId, entityId })
  }

  /**
   * Mark modifier as failed
   *
   * @param modifierId - Modifier ID
   * @param error - Error message
   * @param permanent - If true, won't be retried
   */
  async markFailed(modifierId: string, error: string, permanent = false): Promise<void> {
    // Find modifier
    let modifier: ModifierDocument | undefined
    for (const modifiers of this.cache.values()) {
      modifier = modifiers.find((m) => m.id === modifierId)
      if (modifier) break
    }

    if (!modifier) return

    // Check if should be permanently failed
    const shouldFail = permanent || modifier.attempts >= MAX_ATTEMPTS

    if (shouldFail) {
      await this.updateStatus(modifierId, 'failed', error)

      // Remove from cache
      for (const [entId, modifiers] of this.cache) {
        const index = modifiers.findIndex((m) => m.id === modifierId)
        if (index !== -1) {
          const [failedModifier] = modifiers.splice(index, 1)
          if (modifiers.length === 0) {
            this.cache.delete(entId)
          }
          this.events$.next({ type: 'failed', modifier: failedModifier, error })
          break
        }
      }

      logger.error('modifier-queue', 'Modifier permanently failed', {
        id: modifierId,
        attempts: modifier.attempts,
        error,
      })
    } else {
      // Reset to pending for retry
      await this.updateStatus(modifierId, 'pending', error)
      logger.warn('modifier-queue', 'Modifier failed, will retry', {
        id: modifierId,
        attempts: modifier.attempts + 1,
        error,
      })
    }
  }

  /**
   * Check if an entity has pending modifiers
   *
   * @param entityId - Entity ID to check
   */
  hasPendingModifiers(entityId: string): boolean {
    const modifiers = this.cache.get(entityId)
    return !!modifiers && modifiers.length > 0
  }

  /**
   * Get count of pending modifiers
   */
  getPendingCount(): number {
    let count = 0
    for (const modifiers of this.cache.values()) {
      count += modifiers.filter((m) => m.status === 'pending').length
    }
    return count
  }

  /**
   * Clear all modifiers (for testing)
   */
  async clear(): Promise<void> {
    this.cache.clear()

    if (isDatabaseInitialized()) {
      const db = getDatabase()
      if (db.modifiers) {
        const allDocs = await db.modifiers.find().exec()
        for (const doc of allDocs) {
          await doc.remove()
        }
      }
    }

    logger.info('modifier-queue', 'Queue cleared')
  }

  /**
   * Reset singleton instance (for testing)
   * @internal
   */
  static __resetForTesting(): void {
    if (ModifierQueue.instance) {
      ModifierQueue.instance.events$.complete()
      ModifierQueue.instance.cache.clear()
    }
    ModifierQueue.instance = null as unknown as ModifierQueue
  }
}

/**
 * Singleton instance export
 */
export const modifierQueue = ModifierQueue.getInstance()
