/**
 * Batched Sync Integration Tests
 *
 * Story 1.18: Batched Reactive Query Triggers
 * Task 8: Integration Tests for Sync Batching (AC: 8-10)
 *
 * These tests simulate bulk operations and verify that reactive emissions
 * are batched correctly. Uses RxJS Subject to simulate RxDB observable behavior
 * and fake timers for timing control.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Subject } from 'rxjs'
import { createBatchedObservable } from '../reactive'
import { BatchModeController } from '../batchMode'

describe('Batched Sync Integration', () => {
  let source$: Subject<number[]>
  let batchController: BatchModeController

  beforeEach(() => {
    vi.useFakeTimers()
    source$ = new Subject<number[]>()
    batchController = new BatchModeController()
  })

  afterEach(() => {
    source$.complete()
    vi.useRealTimers()
  })

  // Subtask 8.1: Simulate initial sync of 500 email inserts (AC 8)
  describe('initial sync batching (AC 8)', () => {
    it('should batch 500 sequential inserts into <10 render cycles', () => {
      batchController.enter()
      let emissionCount = 0
      const sub = createBatchedObservable(source$, {
        batchController,
        debounceMs: 100,
        maxWaitMs: 500,
      }).subscribe(() => {
        emissionCount++
      })

      // Simulate 500 email inserts (1ms apart, realistic for RxDB in-memory writes)
      for (let i = 0; i < 500; i++) {
        source$.next([i])
        vi.advanceTimersByTime(1) // 1ms between inserts (realistic RxDB speed)
      }

      // Flush remaining debounce/audit timers
      vi.advanceTimersByTime(600)

      // With 500 inserts over 500ms at 1ms intervals, maxWait=500ms produces
      // ~1 audit emission + 1 final debounce emission = ~2-3 total. AC 8: <10.
      expect(emissionCount).toBeLessThan(10)
      expect(emissionCount).toBeGreaterThan(0)

      sub.unsubscribe()
      batchController.exit()
    })
  })

  // Subtask 8.2: Simulate bulk archive of 50 emails (AC 9)
  describe('bulk archive batching (AC 9)', () => {
    it('should batch 50 email changes into 1-2 render cycles', () => {
      batchController.enter()
      let emissionCount = 0
      const sub = createBatchedObservable(source$, {
        batchController,
        debounceMs: 100,
        maxWaitMs: 500,
      }).subscribe(() => {
        emissionCount++
      })

      // Simulate 50 rapid archive operations (near-instant, <1ms each)
      for (let i = 0; i < 50; i++) {
        source$.next([i])
      }

      // Flush timers - debounce (100ms) should fire, audit may fire too
      vi.advanceTimersByTime(600)

      // AC 9: 1-2 render cycles
      // All 50 emissions happen within a single debounce window
      // debounceTime fires at +100ms, auditTime might fire at +500ms (but no new data)
      expect(emissionCount).toBeLessThanOrEqual(2)
      expect(emissionCount).toBeGreaterThanOrEqual(1)

      sub.unsubscribe()
      batchController.exit()
    })
  })

  // Subtask 8.3: Single email insert without batch mode (AC 10)
  describe('single email passthrough (AC 10)', () => {
    it('should emit immediately when batch mode is off', () => {
      // batch mode is OFF by default
      let emissionCount = 0
      let emittedValue: number[] | null = null
      const sub = createBatchedObservable(source$, { batchController }).subscribe((v) => {
        emissionCount++
        emittedValue = v
      })

      source$.next([42])

      // Should emit immediately — no timer advance needed
      expect(emissionCount).toBe(1)
      expect(emittedValue).toEqual([42])

      sub.unsubscribe()
    })
  })

  // Subtask 8.4: Batch mode enter/exit doesn't leak
  describe('batch mode safety', () => {
    it('should always exit batch mode even on error', () => {
      // Simulate a sync that throws — the finally block ensures cleanup
      batchController.enter()
      expect(batchController.isActive()).toBe(true)

      try {
        throw new Error('Simulated sync error')
      } catch {
        // Error caught — in production the outer handler catches this
      } finally {
        batchController.exit()
      }

      expect(batchController.isActive()).toBe(false)
    })

    it('should handle nested batch mode from sync and action queue', () => {
      // Simulate sync enters batch mode
      batchController.enter()
      expect(batchController.isActive()).toBe(true)

      // Simulate action queue also enters batch mode
      batchController.enter()
      expect(batchController.isActive()).toBe(true)

      // Sync completes
      batchController.exit()
      expect(batchController.isActive()).toBe(true) // Still active (action queue)

      // Action queue completes
      batchController.exit()
      expect(batchController.isActive()).toBe(false) // Now inactive
    })

    it('should not have active batch mode after all operations complete', () => {
      const sub = createBatchedObservable(source$, { batchController }).subscribe(() => {})

      // Simulate multiple sync cycles
      for (let cycle = 0; cycle < 3; cycle++) {
        batchController.enter()
        for (let i = 0; i < 10; i++) {
          source$.next([i])
        }
        batchController.exit()
      }

      expect(batchController.isActive()).toBe(false)

      sub.unsubscribe()
    })
  })
})
