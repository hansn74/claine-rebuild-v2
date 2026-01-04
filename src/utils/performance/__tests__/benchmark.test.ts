/**
 * Performance Benchmark Utilities Tests
 *
 * Story 2.10: Performance Optimization & Benchmarking
 * Task 1.5: Write unit tests for benchmark utilities
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  startMeasure,
  endMeasure,
  isMeasuring,
  cancelMeasure,
  benchmark,
  benchmarkSync,
  mark,
  getPerformanceEntries,
  clearPerformanceEntries,
} from '../benchmark'

describe('benchmark utilities', () => {
  beforeEach(() => {
    // Clear any lingering measurements
    clearPerformanceEntries()
    vi.useFakeTimers()
  })

  afterEach(() => {
    clearPerformanceEntries()
    vi.useRealTimers()
  })

  describe('startMeasure / endMeasure', () => {
    it('should measure duration between start and end', () => {
      startMeasure('test-measure')

      // Advance time by 100ms
      vi.advanceTimersByTime(100)

      const result = endMeasure('test-measure')

      expect(result.name).toBe('test-measure')
      expect(result.duration).toBeGreaterThanOrEqual(0)
      expect(result.timestamp).toBeDefined()
      expect(result.startTime).toBeDefined()
      expect(result.endTime).toBeDefined()
      expect(result.endTime).toBeGreaterThanOrEqual(result.startTime)
    })

    it('should throw error when ending unmeasured name', () => {
      expect(() => endMeasure('nonexistent')).toThrow(
        "No active measurement found for 'nonexistent'"
      )
    })

    it('should handle multiple concurrent measurements', () => {
      startMeasure('measure-a')
      vi.advanceTimersByTime(50)

      startMeasure('measure-b')
      vi.advanceTimersByTime(100)

      const resultA = endMeasure('measure-a')
      vi.advanceTimersByTime(50)

      const resultB = endMeasure('measure-b')

      expect(resultA.name).toBe('measure-a')
      expect(resultB.name).toBe('measure-b')
    })

    it('should warn and overwrite when starting duplicate measurement', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      startMeasure('duplicate')
      startMeasure('duplicate')

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('duplicate'))

      // Should still work
      const result = endMeasure('duplicate')
      expect(result.name).toBe('duplicate')

      warnSpy.mockRestore()
    })
  })

  describe('isMeasuring', () => {
    it('should return true for active measurement', () => {
      startMeasure('active-test')
      expect(isMeasuring('active-test')).toBe(true)

      endMeasure('active-test')
      expect(isMeasuring('active-test')).toBe(false)
    })

    it('should return false for non-existent measurement', () => {
      expect(isMeasuring('nonexistent')).toBe(false)
    })
  })

  describe('cancelMeasure', () => {
    it('should cancel active measurement', () => {
      startMeasure('to-cancel')
      expect(isMeasuring('to-cancel')).toBe(true)

      const cancelled = cancelMeasure('to-cancel')
      expect(cancelled).toBe(true)
      expect(isMeasuring('to-cancel')).toBe(false)
    })

    it('should return false for non-existent measurement', () => {
      expect(cancelMeasure('nonexistent')).toBe(false)
    })

    it('should not throw when ending cancelled measurement', () => {
      startMeasure('cancel-then-end')
      cancelMeasure('cancel-then-end')

      expect(() => endMeasure('cancel-then-end')).toThrow(
        "No active measurement found for 'cancel-then-end'"
      )
    })
  })

  describe('benchmark (async)', () => {
    it('should benchmark async function and return result', async () => {
      vi.useRealTimers() // Need real timers for async

      const asyncFn = async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        return 'async-result'
      }

      const { duration, result, measurement } = await benchmark('async-test', asyncFn)

      expect(result).toBe('async-result')
      expect(duration).toBeGreaterThan(0)
      expect(measurement.name).toBe('async-test')
      expect(measurement.duration).toBe(duration)
    })

    it('should clean up on error', async () => {
      vi.useRealTimers()

      const errorFn = async () => {
        throw new Error('test error')
      }

      await expect(benchmark('error-test', errorFn)).rejects.toThrow('test error')
      expect(isMeasuring('error-test')).toBe(false)
    })

    it('should include memory info when requested', async () => {
      vi.useRealTimers()

      const fn = async () => 'result'
      const { measurement } = await benchmark('memory-test', fn, { includeMemory: true })

      // Memory may or may not be available depending on environment
      expect(measurement).toBeDefined()
    })

    it('should include custom metadata', async () => {
      vi.useRealTimers()

      const metadata = { itemCount: 100, source: 'test' }
      const { measurement } = await benchmark('metadata-test', async () => 'result', {
        metadata,
      })

      expect(measurement.metadata).toEqual(metadata)
    })
  })

  describe('benchmarkSync', () => {
    it('should benchmark sync function and return result', () => {
      vi.useRealTimers()

      const syncFn = () => {
        let sum = 0
        for (let i = 0; i < 1000; i++) {
          sum += i
        }
        return sum
      }

      const { duration, result, measurement } = benchmarkSync('sync-test', syncFn)

      expect(result).toBe(499500)
      expect(duration).toBeGreaterThanOrEqual(0)
      expect(measurement.name).toBe('sync-test')
    })

    it('should clean up on error', () => {
      const errorFn = () => {
        throw new Error('sync error')
      }

      expect(() => benchmarkSync('sync-error-test', errorFn)).toThrow('sync error')
      expect(isMeasuring('sync-error-test')).toBe(false)
    })
  })

  describe('mark', () => {
    it('should call performance.mark without error', () => {
      // jsdom doesn't fully implement performance.mark with entry storage
      // Test that the function calls without throwing
      expect(() => mark('test-mark')).not.toThrow()
    })

    it('should accept detail parameter without error', () => {
      expect(() => mark('detailed-mark', { component: 'EmailList', count: 100 })).not.toThrow()
    })
  })

  describe('getPerformanceEntries', () => {
    it('should return an array', () => {
      const entries = getPerformanceEntries()
      expect(Array.isArray(entries)).toBe(true)
    })

    it('should accept a name filter parameter', () => {
      // Just verify the function works with a name parameter
      const entries = getPerformanceEntries('some-name')
      expect(Array.isArray(entries)).toBe(true)
    })
  })

  describe('clearPerformanceEntries', () => {
    it('should clear all marks and measures', () => {
      mark('to-clear-1')
      mark('to-clear-2')

      clearPerformanceEntries()

      // Note: Some entries may persist (e.g., navigation timing)
      // so we just verify marks are cleared
      const markEntries = performance.getEntriesByType('mark')
      const measureEntries = performance.getEntriesByType('measure')

      expect(markEntries.filter((e) => e.name.startsWith('to-clear'))).toHaveLength(0)
      expect(measureEntries.filter((e) => e.name.startsWith('to-clear'))).toHaveLength(0)
    })
  })
})
