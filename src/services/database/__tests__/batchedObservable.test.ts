/**
 * Batched Observable Unit Tests
 *
 * Story 1.18: Batched Reactive Query Triggers
 * Task 7: Unit Tests for Batched Observable (AC: 1-4, 11-14)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Subject } from 'rxjs'
import { createBatchedObservable } from '../reactive'
import { BatchModeController } from '../batchMode'

describe('createBatchedObservable', () => {
  let source$: Subject<number>
  let batchController: BatchModeController

  beforeEach(() => {
    vi.useFakeTimers()
    source$ = new Subject<number>()
    batchController = new BatchModeController()
  })

  afterEach(() => {
    source$.complete()
    vi.useRealTimers()
  })

  // Subtask 7.1: With batch mode OFF, observable emits immediately (AC 12)
  describe('batch mode OFF (passthrough)', () => {
    it('should emit immediately on each change when batch mode is off', () => {
      const emissions: number[] = []
      const sub = createBatchedObservable(source$, { batchController }).subscribe((v) =>
        emissions.push(v)
      )

      source$.next(1)
      source$.next(2)
      source$.next(3)

      expect(emissions).toEqual([1, 2, 3])

      sub.unsubscribe()
    })
  })

  // Subtask 7.2: With batch mode ON, rapid emissions -> single batched emission (AC 11)
  describe('batch mode ON (batched)', () => {
    it('should batch 100 rapid emissions into a single emission after debounce window', () => {
      batchController.enter()
      const emissions: number[] = []
      const sub = createBatchedObservable(source$, { batchController }).subscribe((v) =>
        emissions.push(v)
      )

      // Emit 100 values rapidly
      for (let i = 0; i < 100; i++) {
        source$.next(i)
      }

      // Nothing emitted yet (within debounce window)
      expect(emissions.length).toBe(0)

      // Advance past debounce window (100ms)
      vi.advanceTimersByTime(100)

      // Should have emitted the last value
      expect(emissions.length).toBe(1)
      expect(emissions[0]).toBe(99)

      sub.unsubscribe()
      batchController.exit()
    })
  })

  // Subtask 7.3: Debounce window resets on each new emission (trailing debounce, AC 3)
  describe('trailing debounce behavior', () => {
    it('should reset debounce window on each new emission', () => {
      batchController.enter()
      const emissions: number[] = []
      const sub = createBatchedObservable(source$, {
        batchController,
        debounceMs: 100,
        maxWaitMs: 500,
      }).subscribe((v) => emissions.push(v))

      source$.next(1)
      vi.advanceTimersByTime(80) // 80ms, still within debounce

      source$.next(2) // resets debounce
      vi.advanceTimersByTime(80) // 160ms total, 80ms since last

      source$.next(3) // resets debounce again
      vi.advanceTimersByTime(80) // 240ms total, 80ms since last

      // Still no emission — debounce keeps resetting
      expect(emissions.length).toBe(0)

      // Advance past debounce window (100ms after last emission)
      vi.advanceTimersByTime(100)

      expect(emissions.length).toBe(1)
      expect(emissions[0]).toBe(3)

      sub.unsubscribe()
      batchController.exit()
    })
  })

  // Subtask 7.4: Maximum wait cap of 500ms (AC 13)
  describe('maximum wait cap', () => {
    it('should emit after 500ms max even with continuous writes', () => {
      batchController.enter()
      const emissions: number[] = []
      const sub = createBatchedObservable(source$, {
        batchController,
        debounceMs: 100,
        maxWaitMs: 500,
      }).subscribe((v) => emissions.push(v))

      // Emit continuously every 50ms for 600ms (keeps resetting debounce)
      for (let i = 0; i < 12; i++) {
        source$.next(i)
        vi.advanceTimersByTime(50)
      }

      // At 600ms total, should have emitted at least once via audit cap
      expect(emissions.length).toBeGreaterThanOrEqual(1)

      sub.unsubscribe()
      batchController.exit()
    })
  })

  // Subtask 7.5: No data loss — all changes reflected in final emission (AC 14)
  describe('no data loss', () => {
    it('should reflect the latest value after batch completes', () => {
      batchController.enter()
      const emissions: number[] = []
      const sub = createBatchedObservable(source$, { batchController }).subscribe((v) =>
        emissions.push(v)
      )

      source$.next(1)
      source$.next(2)
      source$.next(3)
      source$.next(42) // last value

      vi.advanceTimersByTime(600) // past both debounce and audit

      // The last emitted value should be 42
      const lastEmission = emissions[emissions.length - 1]
      expect(lastEmission).toBe(42)

      sub.unsubscribe()
      batchController.exit()
    })
  })

  // Subtask 7.6: Switching batch mode ON mid-stream
  describe('dynamic batch mode switching', () => {
    it('should transition to debounced behavior when batch mode turns ON', () => {
      const emissions: number[] = []
      const sub = createBatchedObservable(source$, { batchController }).subscribe((v) =>
        emissions.push(v)
      )

      // Emit with batch mode OFF — immediate
      source$.next(1)
      expect(emissions).toEqual([1])

      // Turn batch mode ON
      batchController.enter()

      // Emit with batch mode ON — should be debounced
      source$.next(2)
      source$.next(3)
      expect(emissions).toEqual([1]) // Still only the first emission

      vi.advanceTimersByTime(100)
      expect(emissions.length).toBe(2) // Now the debounced emission arrived
      expect(emissions[1]).toBe(3)

      sub.unsubscribe()
      batchController.exit()
    })

    // Subtask 7.7: Switching batch mode OFF mid-stream
    it('should transition back to immediate behavior when batch mode turns OFF', () => {
      batchController.enter()
      const emissions: number[] = []
      const sub = createBatchedObservable(source$, { batchController }).subscribe((v) =>
        emissions.push(v)
      )

      // Emit with batch mode ON
      source$.next(1)
      expect(emissions.length).toBe(0) // debounced

      // Turn batch mode OFF
      batchController.exit()

      // Wait for any pending debounced emissions to flush
      vi.advanceTimersByTime(600)

      const countBeforePassthrough = emissions.length

      // Emit with batch mode OFF — should be immediate
      source$.next(2)
      expect(emissions.length).toBe(countBeforePassthrough + 1)
      expect(emissions[emissions.length - 1]).toBe(2)

      sub.unsubscribe()
    })
  })

  // Subtask 7.8: Custom debounceMs and maxWaitMs options respected
  describe('custom options', () => {
    it('should respect custom debounceMs', () => {
      batchController.enter()
      const emissions: number[] = []
      const sub = createBatchedObservable(source$, {
        batchController,
        debounceMs: 200,
        maxWaitMs: 1000,
      }).subscribe((v) => emissions.push(v))

      source$.next(1)

      vi.advanceTimersByTime(100)
      expect(emissions.length).toBe(0) // 200ms debounce, only 100ms passed

      vi.advanceTimersByTime(100)
      expect(emissions.length).toBe(1) // 200ms debounce elapsed

      sub.unsubscribe()
      batchController.exit()
    })

    it('should respect custom maxWaitMs', () => {
      batchController.enter()
      const emissions: number[] = []
      const sub = createBatchedObservable(source$, {
        batchController,
        debounceMs: 100,
        maxWaitMs: 200,
      }).subscribe((v) => emissions.push(v))

      // Emit continuously every 50ms
      for (let i = 0; i < 10; i++) {
        source$.next(i)
        vi.advanceTimersByTime(50)
      }

      // At 500ms, with maxWaitMs=200, should have emitted at least twice
      expect(emissions.length).toBeGreaterThanOrEqual(2)

      sub.unsubscribe()
      batchController.exit()
    })
  })

  describe('cleanup', () => {
    it('should clean up subscriptions on unsubscribe', () => {
      const emissions: number[] = []
      const sub = createBatchedObservable(source$, { batchController }).subscribe((v) =>
        emissions.push(v)
      )

      source$.next(1)
      sub.unsubscribe()

      source$.next(2)
      expect(emissions).toEqual([1]) // No new emissions after unsubscribe
    })

    it('should clean up internal subscriptions when batch mode changes after unsubscribe', () => {
      const sub = createBatchedObservable(source$, { batchController }).subscribe(() => {})
      sub.unsubscribe()

      // Should not throw when batch mode changes after unsubscribe
      expect(() => batchController.enter()).not.toThrow()
      expect(() => batchController.exit()).not.toThrow()
    })
  })
})
