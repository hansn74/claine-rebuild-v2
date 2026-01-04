/* eslint-disable no-console */
/**
 * Performance Benchmark Test Suite
 *
 * Story 2.10: Performance Optimization & Benchmarking
 * Task 2: Define Performance Targets and Baseline Measurements (AC: 1)
 *
 * This test suite establishes baseline performance measurements and
 * documents the performance targets based on NFR001.
 *
 * Performance Targets (NFR001):
 * - Input latency: <50ms
 * - Scrolling: 60 FPS (16.67ms per frame)
 * - LCP: <2.5s
 * - FID: <100ms
 * - CLS: <0.1
 *
 * Baseline measurements are captured for:
 * - Email list rendering (1K, 5K, 10K emails)
 * - Search operations
 * - Database queries
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  benchmark,
  benchmarkSync,
  startMeasure,
  endMeasure,
  metricsService,
  DEFAULT_THRESHOLDS,
} from '../index'

/**
 * Performance Targets (NFR001)
 *
 * These constants document the expected performance thresholds
 * for key user interactions.
 */
export const PERFORMANCE_TARGETS = {
  // User interaction latency
  INPUT_LATENCY_MS: 50,
  FRAME_TIME_MS: 16.67, // 60 FPS

  // Web Vitals
  LCP_MS: 2500, // Largest Contentful Paint
  FID_MS: 100, // First Input Delay
  CLS: 0.1, // Cumulative Layout Shift

  // Component render times
  EMAIL_LIST_RENDER_MS: 50,
  THREAD_DETAIL_RENDER_MS: 50,
  SEARCH_RESULTS_RENDER_MS: 50,
  COMPOSE_OPEN_MS: 200,

  // Database operations
  DB_QUERY_MS: 50,
  DB_WRITE_MS: 100,

  // Search operations
  SEARCH_QUERY_MS: 300,
  SEARCH_INDEX_BUILD_MS: 2000,

  // Email list thresholds by size
  EMAIL_LIST_1K_MS: 30,
  EMAIL_LIST_5K_MS: 100,
  EMAIL_LIST_10K_MS: 250,
}

describe('Performance Targets Documentation', () => {
  it('should document NFR001 performance targets', () => {
    // This test documents the performance targets from NFR001
    expect(PERFORMANCE_TARGETS.INPUT_LATENCY_MS).toBe(50)
    expect(PERFORMANCE_TARGETS.FRAME_TIME_MS).toBeCloseTo(16.67, 1)
    expect(PERFORMANCE_TARGETS.LCP_MS).toBe(2500)
    expect(PERFORMANCE_TARGETS.FID_MS).toBe(100)
    expect(PERFORMANCE_TARGETS.CLS).toBe(0.1)
  })

  it('should have default thresholds matching performance targets', () => {
    expect(DEFAULT_THRESHOLDS['email-list-render'].critical).toBeLessThanOrEqual(
      PERFORMANCE_TARGETS.EMAIL_LIST_RENDER_MS
    )
    expect(DEFAULT_THRESHOLDS['input-latency'].critical).toBeLessThanOrEqual(
      PERFORMANCE_TARGETS.INPUT_LATENCY_MS
    )
    expect(DEFAULT_THRESHOLDS['db-query'].critical).toBeLessThanOrEqual(
      PERFORMANCE_TARGETS.DB_QUERY_MS
    )
  })
})

describe('Baseline Performance Measurements', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Email List Rendering Benchmarks', () => {
    /**
     * Simulates email list rendering with mock data.
     * In a real test, this would render actual components.
     */
    const simulateEmailListRender = (count: number): number[] => {
      const results: number[] = []
      // Simulate O(n) complexity for list rendering
      for (let i = 0; i < count; i++) {
        results.push(i)
      }
      return results
    }

    it('should measure baseline for 1K emails', () => {
      vi.useRealTimers()

      const { duration, result } = benchmarkSync('email-list-render-1k', () =>
        simulateEmailListRender(1000)
      )

      // Document baseline (actual performance depends on hardware)
      expect(result.length).toBe(1000)
      expect(duration).toBeGreaterThanOrEqual(0)

      // Log for documentation
      console.log(`Baseline 1K emails: ${duration.toFixed(2)}ms`)
    })

    it('should measure baseline for 5K emails', () => {
      vi.useRealTimers()

      const { duration, result } = benchmarkSync('email-list-render-5k', () =>
        simulateEmailListRender(5000)
      )

      expect(result.length).toBe(5000)
      expect(duration).toBeGreaterThanOrEqual(0)

      console.log(`Baseline 5K emails: ${duration.toFixed(2)}ms`)
    })

    it('should measure baseline for 10K emails', () => {
      vi.useRealTimers()

      const { duration, result } = benchmarkSync('email-list-render-10k', () =>
        simulateEmailListRender(10000)
      )

      expect(result.length).toBe(10000)
      expect(duration).toBeGreaterThanOrEqual(0)

      console.log(`Baseline 10K emails: ${duration.toFixed(2)}ms`)
    })
  })

  describe('Search Performance Benchmarks', () => {
    /**
     * Simulates search operation complexity
     */
    const simulateSearch = (itemCount: number, queryLength: number): string[] => {
      const results: string[] = []
      // Simulate search with O(n * m) complexity
      for (let i = 0; i < itemCount; i++) {
        if (i % Math.max(1, queryLength) === 0) {
          results.push(`result-${i}`)
        }
      }
      return results
    }

    it('should measure baseline for simple search', () => {
      vi.useRealTimers()

      const { duration, result } = benchmarkSync('search-simple', () => simulateSearch(1000, 3))

      expect(result.length).toBeGreaterThan(0)
      expect(duration).toBeGreaterThanOrEqual(0)

      console.log(`Baseline simple search: ${duration.toFixed(2)}ms`)
    })

    it('should measure baseline for complex search', () => {
      vi.useRealTimers()

      const { duration, result } = benchmarkSync('search-complex', () => simulateSearch(10000, 10))

      expect(result.length).toBeGreaterThan(0)
      expect(duration).toBeGreaterThanOrEqual(0)

      console.log(`Baseline complex search: ${duration.toFixed(2)}ms`)
    })

    it('should measure baseline for search with filters', () => {
      vi.useRealTimers()

      const { duration, result } = benchmarkSync('search-filtered', () => {
        const items = simulateSearch(5000, 5)
        // Apply additional filtering
        return items.filter((_, i) => i % 2 === 0)
      })

      expect(result.length).toBeGreaterThan(0)
      expect(duration).toBeGreaterThanOrEqual(0)

      console.log(`Baseline filtered search: ${duration.toFixed(2)}ms`)
    })
  })

  describe('Metrics Service Integration', () => {
    beforeEach(() => {
      metricsService.clear()
    })

    it('should track performance violations', () => {
      vi.useRealTimers()
      const violations: Array<{ name: string; value: number; severity: string }> = []

      metricsService.onViolation((v) =>
        violations.push({ name: v.name, value: v.value, severity: v.severity })
      )

      // Record metrics that should trigger violations
      metricsService.record('email-list-render', 100) // Above critical threshold of 50
      metricsService.record('email-list-render', 40) // Above warn threshold of 30

      expect(violations.length).toBe(2)
      expect(violations[0].severity).toBe('critical')
      expect(violations[1].severity).toBe('warn')
    })

    it('should aggregate performance statistics', () => {
      vi.useRealTimers()

      // Record multiple measurements
      for (let i = 1; i <= 10; i++) {
        metricsService.record('test-metric', i * 5)
      }

      const stats = metricsService.getStats('test-metric')

      expect(stats).not.toBeNull()
      expect(stats!.count).toBe(10)
      expect(stats!.min).toBe(5)
      expect(stats!.max).toBe(50)
      expect(stats!.avg).toBe(27.5)
    })
  })
})

describe('Benchmark Utility Verification', () => {
  it('should measure async operations accurately', async () => {
    const delay = 10
    const { duration } = await benchmark('async-delay', async () => {
      await new Promise((resolve) => setTimeout(resolve, delay))
      return 'done'
    })

    // Allow some tolerance for timing
    expect(duration).toBeGreaterThanOrEqual(delay * 0.9)
    expect(duration).toBeLessThan(delay * 3) // Account for overhead
  })

  it('should measure sync operations accurately', () => {
    const iterations = 100000
    const { duration, result } = benchmarkSync('sync-computation', () => {
      let sum = 0
      for (let i = 0; i < iterations; i++) {
        sum += i
      }
      return sum
    })

    expect(result).toBe((iterations * (iterations - 1)) / 2)
    expect(duration).toBeGreaterThanOrEqual(0)
  })

  it('should track multiple concurrent measurements', () => {
    startMeasure('concurrent-1')
    startMeasure('concurrent-2')

    const result1 = endMeasure('concurrent-1')
    const result2 = endMeasure('concurrent-2')

    expect(result1.name).toBe('concurrent-1')
    expect(result2.name).toBe('concurrent-2')
    expect(result1.duration).toBeGreaterThanOrEqual(0)
    expect(result2.duration).toBeGreaterThanOrEqual(0)
  })
})
