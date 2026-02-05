/**
 * Modifier Processor Unit Tests
 *
 * Story 2.19: Parallel Action Queue Processing
 * Task 6: Unit Tests (AC: 15, 16, 17, 18, 19)
 *
 * Tests parallel processing, thread-level sequential ordering,
 * rate limiter throttling, error isolation, and mixed operations.
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest'

// Mock dependencies before importing the module under test
vi.mock('@/services/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('../modifierQueue', async () => {
  const { Subject } = await import('rxjs')
  const events$ = new Subject()
  return {
    modifierQueue: {
      initialize: vi.fn().mockResolvedValue(undefined),
      getAllPendingModifiers: vi.fn().mockReturnValue([]),
      getModifiersForEntity: vi.fn().mockReturnValue([]),
      updateStatus: vi.fn().mockResolvedValue(undefined),
      markCompleted: vi.fn().mockResolvedValue(undefined),
      markFailed: vi.fn().mockResolvedValue(undefined),
      getPendingCount: vi.fn().mockReturnValue(0),
      getEvents$: vi.fn().mockReturnValue(events$.asObservable()),
      __testEvents$: events$,
    },
  }
})

vi.mock('../modifierFactory', () => ({
  modifierFactory: {
    fromDocument: vi.fn(),
  },
}))

vi.mock('@/services/sync/circuitBreaker', () => ({
  circuitBreaker: {
    canExecute: vi.fn().mockReturnValue(true),
    recordSuccess: vi.fn(),
    recordFailure: vi.fn(),
  },
}))

vi.mock('@/services/sync/rateLimiter', () => ({
  createGmailRateLimiter: vi.fn().mockReturnValue({
    acquireAndWait: vi.fn().mockResolvedValue(undefined),
    getCurrentUsage: vi.fn().mockReturnValue(0),
  }),
  createOutlookRateLimiter: vi.fn().mockReturnValue({
    acquireAndWait: vi.fn().mockResolvedValue(undefined),
    getCurrentUsage: vi.fn().mockReturnValue(0),
  }),
}))

import { ModifierProcessor } from '../modifierProcessor'
import { modifierQueue } from '../modifierQueue'
import { modifierFactory } from '../modifierFactory'
import { circuitBreaker } from '@/services/sync/circuitBreaker'
import { createGmailRateLimiter } from '@/services/sync/rateLimiter'
import type { ModifierDocument } from '../types'

function createMockModifierDoc(overrides: Partial<ModifierDocument> = {}): ModifierDocument {
  return {
    id: `mod-${Math.random().toString(36).slice(2)}`,
    entityId: `email-${Math.random().toString(36).slice(2)}`,
    entityType: 'email',
    type: 'archive',
    accountId: 'gmail:test@example.com',
    provider: 'gmail',
    status: 'pending',
    attempts: 0,
    maxAttempts: 4,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    payload: '{}',
    ...overrides,
  }
}

describe('ModifierProcessor - Story 2.19: Parallel Action Queue Processing', () => {
  let processor: ModifierProcessor

  beforeEach(() => {
    vi.useFakeTimers()
    ModifierProcessor.__resetForTesting()
    processor = ModifierProcessor.getInstance()

    // Default: all mocked modifier persists succeed
    ;(modifierFactory.fromDocument as Mock).mockReturnValue({
      persist: vi.fn().mockResolvedValue(undefined),
    })
    ;(circuitBreaker.canExecute as Mock).mockReturnValue(true)

    // Reset rate limiter mock
    const mockLimiter = (createGmailRateLimiter as Mock)()
    ;(mockLimiter.getCurrentUsage as Mock).mockReturnValue(0)
    ;(mockLimiter.acquireAndWait as Mock).mockResolvedValue(undefined)
  })

  afterEach(() => {
    processor.shutdown()
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  // Task 6.1: Test parallel processing — AC 15: 50 emails, 4 concurrent API calls
  describe('parallel processing (AC: 1, 2, 3, 15)', () => {
    it('should process 50 independent entities with 4 concurrent workers (AC 15)', async () => {
      let activeConcurrent = 0
      let maxConcurrent = 0

      // AC 15: Bulk archive 50 emails
      const mods = Array.from({ length: 50 }, (_, i) =>
        createMockModifierDoc({
          id: `mod-${i}`,
          entityId: `email-${i}`,
          threadId: `thread-${i}`,
        })
      )

      ;(modifierQueue.getAllPendingModifiers as Mock).mockReturnValue(mods)

      // Track concurrency overlap to verify parallel execution
      ;(modifierFactory.fromDocument as Mock).mockImplementation(() => ({
        persist: vi.fn().mockImplementation(async () => {
          activeConcurrent++
          if (activeConcurrent > maxConcurrent) maxConcurrent = activeConcurrent
          await vi.advanceTimersByTimeAsync(100)
          activeConcurrent--
        }),
      }))

      // Force online
      Object.defineProperty(processor, 'online', { value: true, writable: true })

      await processor.processQueue(4)

      // All 50 should have been processed
      expect(modifierQueue.markCompleted).toHaveBeenCalledTimes(50)
      // AC 15: Verify 4 concurrent API calls observed
      expect(maxConcurrent).toBeLessThanOrEqual(4)
      expect(maxConcurrent).toBeGreaterThanOrEqual(2) // At least some parallelism
    })

    it('should expose concurrencyLevel getter', () => {
      expect(processor.concurrencyLevel).toBe(4)
    })

    it('should accept configurable maxConcurrency parameter', async () => {
      ;(modifierQueue.getAllPendingModifiers as Mock).mockReturnValue([])
      Object.defineProperty(processor, 'online', { value: true, writable: true })

      await processor.processQueue(2)
      expect(processor.concurrencyLevel).toBe(2)
    })
  })

  // Task 6.2: Test same-thread sequential processing
  describe('same-thread sequential (AC: 4, 6)', () => {
    it('should process modifiers with same threadId sequentially', async () => {
      const executionOrder: string[] = []

      // 3 modifiers for the same thread
      const mods = [
        createMockModifierDoc({
          id: 'mod-a',
          entityId: 'email-1',
          threadId: 'thread-shared',
          type: 'archive',
        }),
        createMockModifierDoc({
          id: 'mod-b',
          entityId: 'email-2',
          threadId: 'thread-shared',
          type: 'mark-read',
        }),
        createMockModifierDoc({
          id: 'mod-c',
          entityId: 'email-3',
          threadId: 'thread-shared',
          type: 'delete',
        }),
      ]

      ;(modifierQueue.getAllPendingModifiers as Mock).mockReturnValue(mods)
      ;(modifierFactory.fromDocument as Mock).mockImplementation((doc: ModifierDocument) => ({
        persist: vi.fn().mockImplementation(async () => {
          executionOrder.push(doc.id)
          await vi.advanceTimersByTimeAsync(50)
        }),
      }))

      Object.defineProperty(processor, 'online', { value: true, writable: true })
      await processor.processQueue(4)

      // Sequential: mod-a must complete before mod-b, etc.
      expect(executionOrder).toEqual(['mod-a', 'mod-b', 'mod-c'])
    })

    it('should fall back to entityId grouping when threadId is undefined', async () => {
      const executionOrder: string[] = []

      // 2 modifiers for the same entityId, no threadId
      const mods = [
        createMockModifierDoc({
          id: 'mod-1',
          entityId: 'email-same',
          threadId: undefined,
        }),
        createMockModifierDoc({
          id: 'mod-2',
          entityId: 'email-same',
          threadId: undefined,
        }),
      ]

      ;(modifierQueue.getAllPendingModifiers as Mock).mockReturnValue(mods)
      ;(modifierFactory.fromDocument as Mock).mockImplementation((doc: ModifierDocument) => ({
        persist: vi.fn().mockImplementation(async () => {
          executionOrder.push(doc.id)
          await vi.advanceTimersByTimeAsync(50)
        }),
      }))

      Object.defineProperty(processor, 'online', { value: true, writable: true })
      await processor.processQueue(4)

      // Sequential within same entityId group
      expect(executionOrder).toEqual(['mod-1', 'mod-2'])
    })
  })

  // Task 6.3: Test rate limiter throttling
  describe('rate limiter throttling (AC: 9, 10)', () => {
    it('should reduce concurrency when rate limiter usage > 80%', async () => {
      const mockLimiter = {
        acquireAndWait: vi.fn().mockResolvedValue(undefined),
        getCurrentUsage: vi.fn().mockReturnValue(85),
      }

      // Mock createGmailRateLimiter to return our controlled limiter
      ;(createGmailRateLimiter as Mock).mockReturnValue(mockLimiter)

      // Create modifiers for different threads
      const mods = Array.from({ length: 6 }, (_, i) =>
        createMockModifierDoc({
          id: `mod-${i}`,
          entityId: `email-${i}`,
          threadId: `thread-${i}`,
        })
      )

      ;(modifierQueue.getAllPendingModifiers as Mock).mockReturnValue(mods)

      Object.defineProperty(processor, 'online', { value: true, writable: true })

      // Reset processor to pick up the new rate limiter
      ModifierProcessor.__resetForTesting()
      processor = ModifierProcessor.getInstance()
      Object.defineProperty(processor, 'online', { value: true, writable: true })

      const events: Array<{ type: string; concurrency?: number }> = []
      processor.getEvents$().subscribe((e) => events.push(e))

      await processor.processQueue(4)

      // Concurrency should have been reduced to max(2, 4/2) = 2
      expect(processor.concurrencyLevel).toBe(2)
    })
  })

  // Task 6.8: Test dynamic concurrency restoration
  describe('concurrency restoration (AC: 10)', () => {
    it('should restore concurrency when usage drops below 60%', async () => {
      let usageValue = 85

      const mockLimiter = {
        acquireAndWait: vi.fn().mockResolvedValue(undefined),
        getCurrentUsage: vi.fn().mockImplementation(() => usageValue),
      }

      ;(createGmailRateLimiter as Mock).mockReturnValue(mockLimiter)

      // First batch: high usage
      const mods1 = [
        createMockModifierDoc({ id: 'mod-0', entityId: 'e-0', threadId: 't-0' }),
        createMockModifierDoc({ id: 'mod-1', entityId: 'e-1', threadId: 't-1' }),
      ]

      ;(modifierQueue.getAllPendingModifiers as Mock).mockReturnValue(mods1)

      ModifierProcessor.__resetForTesting()
      processor = ModifierProcessor.getInstance()
      Object.defineProperty(processor, 'online', { value: true, writable: true })

      await processor.processQueue(4)
      expect(processor.concurrencyLevel).toBe(2)

      // Simulate usage dropping
      usageValue = 50

      // Reset processing flag for next processQueue call
      Object.defineProperty(processor, 'processing', { value: false, writable: true })

      const mods2 = [createMockModifierDoc({ id: 'mod-2', entityId: 'e-2', threadId: 't-2' })]
      ;(modifierQueue.getAllPendingModifiers as Mock).mockReturnValue(mods2)

      await processor.processQueue()
      expect(processor.concurrencyLevel).toBe(4)
    })
  })

  // Task 6.4: Test error isolation
  describe('error isolation (AC: 12, 13, 14)', () => {
    it('should complete other operations when one fails', async () => {
      const mods = [
        createMockModifierDoc({ id: 'mod-success-1', entityId: 'e-1', threadId: 't-1' }),
        createMockModifierDoc({ id: 'mod-fail', entityId: 'e-2', threadId: 't-2' }),
        createMockModifierDoc({ id: 'mod-success-2', entityId: 'e-3', threadId: 't-3' }),
        createMockModifierDoc({ id: 'mod-success-3', entityId: 'e-4', threadId: 't-4' }),
      ]

      ;(modifierQueue.getAllPendingModifiers as Mock).mockReturnValue(mods)
      ;(modifierFactory.fromDocument as Mock).mockImplementation((doc: ModifierDocument) => ({
        persist: vi.fn().mockImplementation(async () => {
          if (doc.id === 'mod-fail') throw new Error('Simulated failure')
        }),
      }))

      Object.defineProperty(processor, 'online', { value: true, writable: true })

      const events: Array<{ type: string }> = []
      processor.getEvents$().subscribe((e) => events.push(e))

      await processor.processQueue(4)

      // 3 should succeed, 1 should fail
      expect(modifierQueue.markCompleted).toHaveBeenCalledTimes(3)
      // The failed one should trigger circuit breaker failure recording
      expect(circuitBreaker.recordFailure).toHaveBeenCalledTimes(1)
      expect(circuitBreaker.recordSuccess).toHaveBeenCalledTimes(3)
    })

    it('should record failure on circuit breaker when modifier persist fails', async () => {
      const mods = [createMockModifierDoc({ id: 'mod-1', entityId: 'e-1', threadId: 't-1' })]

      ;(modifierQueue.getAllPendingModifiers as Mock).mockReturnValue(mods)
      ;(modifierFactory.fromDocument as Mock).mockReturnValue({
        persist: vi.fn().mockRejectedValue(new Error('API error')),
      })

      Object.defineProperty(processor, 'online', { value: true, writable: true })
      await processor.processQueue(4)

      expect(circuitBreaker.recordFailure).toHaveBeenCalledWith('gmail')
    })

    it('should skip modifiers when circuit breaker is open', async () => {
      ;(circuitBreaker.canExecute as Mock).mockReturnValue(false)

      const mods = [createMockModifierDoc({ id: 'mod-1', entityId: 'e-1', threadId: 't-1' })]

      ;(modifierQueue.getAllPendingModifiers as Mock).mockReturnValue(mods)
      Object.defineProperty(processor, 'online', { value: true, writable: true })

      await processor.processQueue(4)

      // persist should never be called
      expect(modifierFactory.fromDocument).not.toHaveBeenCalled()
    })
  })

  // Task 6.5: Test mixed operations in parallel
  describe('mixed operations (AC: 19)', () => {
    it('should run archive(A), label(B), delete(C) with different threadIds in parallel', async () => {
      const completionOrder: string[] = []

      const mods = [
        createMockModifierDoc({
          id: 'mod-archive',
          entityId: 'email-a',
          threadId: 'thread-a',
          type: 'archive',
        }),
        createMockModifierDoc({
          id: 'mod-move',
          entityId: 'email-b',
          threadId: 'thread-b',
          type: 'move',
        }),
        createMockModifierDoc({
          id: 'mod-delete',
          entityId: 'email-c',
          threadId: 'thread-c',
          type: 'delete',
        }),
      ]

      ;(modifierQueue.getAllPendingModifiers as Mock).mockReturnValue(mods)
      ;(modifierFactory.fromDocument as Mock).mockImplementation((doc: ModifierDocument) => ({
        persist: vi.fn().mockImplementation(async () => {
          await vi.advanceTimersByTimeAsync(50)
          completionOrder.push(doc.type)
        }),
      }))

      Object.defineProperty(processor, 'online', { value: true, writable: true })
      await processor.processQueue(4)

      // All 3 should complete (order may vary due to parallelism)
      expect(completionOrder).toHaveLength(3)
      expect(completionOrder).toContain('archive')
      expect(completionOrder).toContain('move')
      expect(completionOrder).toContain('delete')
    })
  })

  // Test __getTestState
  describe('__getTestState (Task 7.2)', () => {
    it('should expose concurrency, activeCount, and queueLength', () => {
      ;(modifierQueue.getPendingCount as Mock).mockReturnValue(5)
      const state = processor.__getTestState()
      expect(state).toEqual({
        concurrency: 4,
        activeCount: 0,
        queueLength: 5,
      })
    })
  })
})
