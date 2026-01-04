/**
 * Performance Metrics Service Tests
 *
 * Story 2.10: Performance Optimization & Benchmarking
 * Task 1.5: Write unit tests for benchmark utilities
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  MetricsService,
  metricsService,
  DEFAULT_THRESHOLDS,
  type ThresholdViolation,
} from '../metrics'
import type { MeasurementResult } from '../benchmark'

describe('MetricsService', () => {
  beforeEach(() => {
    MetricsService.__resetForTesting()
  })

  describe('singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = MetricsService.getInstance()
      const instance2 = MetricsService.getInstance()
      expect(instance1).toBe(instance2)
    })

    it('should export singleton as metricsService', () => {
      // metricsService is imported at the top of the file
      // Note: After __resetForTesting(), getInstance() returns a new instance
      // but metricsService still holds the original exported singleton
      expect(metricsService).toBeDefined()
      expect(metricsService).toBeInstanceOf(MetricsService)
    })
  })

  describe('record', () => {
    it('should record a metric entry', () => {
      const service = MetricsService.getInstance()

      service.record('test-metric', 42)

      const entries = service.getEntries('test-metric')
      expect(entries).toHaveLength(1)
      expect(entries[0].name).toBe('test-metric')
      expect(entries[0].duration).toBe(42)
      expect(entries[0].timestamp).toBeDefined()
    })

    it('should record multiple entries for same metric', () => {
      const service = MetricsService.getInstance()

      service.record('multi-metric', 10)
      service.record('multi-metric', 20)
      service.record('multi-metric', 30)

      const entries = service.getEntries('multi-metric')
      expect(entries).toHaveLength(3)
      expect(entries.map((e) => e.duration)).toEqual([10, 20, 30])
    })

    it('should infer category from metric name', () => {
      const service = MetricsService.getInstance()

      service.record('email-list-render', 50)
      service.record('db-query-emails', 20)
      service.record('api-fetch-threads', 100)
      service.record('search-index-build', 500)
      service.record('click-handler', 5)
      service.record('worker-processing', 200)
      service.record('misc-operation', 10)

      expect(service.getEntries('email-list-render')[0].category).toBe('render')
      expect(service.getEntries('db-query-emails')[0].category).toBe('database')
      expect(service.getEntries('api-fetch-threads')[0].category).toBe('network')
      expect(service.getEntries('search-index-build')[0].category).toBe('search')
      expect(service.getEntries('click-handler')[0].category).toBe('interaction')
      expect(service.getEntries('worker-processing')[0].category).toBe('worker')
      expect(service.getEntries('misc-operation')[0].category).toBe('other')
    })

    it('should accept explicit category', () => {
      const service = MetricsService.getInstance()

      service.record('custom-metric', 100, { category: 'database' })

      expect(service.getEntries('custom-metric')[0].category).toBe('database')
    })

    it('should accept metadata', () => {
      const service = MetricsService.getInstance()

      service.record('with-metadata', 50, {
        metadata: { itemCount: 100, query: 'inbox' },
      })

      const entry = service.getEntries('with-metadata')[0]
      expect(entry.metadata).toEqual({ itemCount: 100, query: 'inbox' })
    })
  })

  describe('recordMeasurement', () => {
    it('should record MeasurementResult', () => {
      const service = MetricsService.getInstance()

      const measurement: MeasurementResult = {
        name: 'measurement-test',
        duration: 75.5,
        startTime: 1000,
        endTime: 1075.5,
        timestamp: Date.now(),
      }

      service.recordMeasurement(measurement)

      const entries = service.getEntries('measurement-test')
      expect(entries).toHaveLength(1)
      expect(entries[0].duration).toBe(75.5)
    })
  })

  describe('getStats', () => {
    it('should return null for non-existent metric', () => {
      const service = MetricsService.getInstance()
      expect(service.getStats('nonexistent')).toBeNull()
    })

    it('should calculate correct statistics', () => {
      const service = MetricsService.getInstance()

      // Add values: 10, 20, 30, 40, 50, 60, 70, 80, 90, 100
      for (let i = 1; i <= 10; i++) {
        service.record('stats-test', i * 10)
      }

      const stats = service.getStats('stats-test')

      expect(stats).not.toBeNull()
      expect(stats!.name).toBe('stats-test')
      expect(stats!.count).toBe(10)
      expect(stats!.min).toBe(10)
      expect(stats!.max).toBe(100)
      expect(stats!.avg).toBe(55)
      expect(stats!.median).toBeCloseTo(55, 1) // p50
      expect(stats!.p95).toBeCloseTo(95.5, 1)
      expect(stats!.p99).toBeCloseTo(99.1, 1)
      expect(stats!.stdDev).toBeGreaterThan(0)
    })

    it('should handle single entry', () => {
      const service = MetricsService.getInstance()

      service.record('single-entry', 42)

      const stats = service.getStats('single-entry')

      expect(stats!.count).toBe(1)
      expect(stats!.min).toBe(42)
      expect(stats!.max).toBe(42)
      expect(stats!.avg).toBe(42)
      expect(stats!.median).toBe(42)
    })
  })

  describe('getAllStats', () => {
    it('should return stats for all metrics', () => {
      const service = MetricsService.getInstance()

      service.record('metric-a', 10)
      service.record('metric-b', 20)
      service.record('metric-c', 30)

      const allStats = service.getAllStats()

      expect(allStats.size).toBe(3)
      expect(allStats.has('metric-a')).toBe(true)
      expect(allStats.has('metric-b')).toBe(true)
      expect(allStats.has('metric-c')).toBe(true)
    })
  })

  describe('getStatsByCategory', () => {
    it('should group stats by category', () => {
      const service = MetricsService.getInstance()

      service.record('render-1', 10, { category: 'render' })
      service.record('render-2', 20, { category: 'render' })
      service.record('db-query', 30, { category: 'database' })

      const byCategory = service.getStatsByCategory()

      expect(byCategory.has('render')).toBe(true)
      expect(byCategory.get('render')).toHaveLength(2)
      expect(byCategory.has('database')).toBe(true)
      expect(byCategory.get('database')).toHaveLength(1)
    })
  })

  describe('thresholds', () => {
    it('should have default thresholds', () => {
      expect(DEFAULT_THRESHOLDS['email-list-render']).toBeDefined()
      expect(DEFAULT_THRESHOLDS['email-list-render'].warn).toBe(30)
      expect(DEFAULT_THRESHOLDS['email-list-render'].critical).toBe(50)
    })

    it('should set custom threshold', () => {
      const service = MetricsService.getInstance()

      service.setThreshold('custom', { warn: 100, critical: 200 })

      expect(service.getThreshold('custom')).toEqual({ warn: 100, critical: 200 })
    })

    it('should trigger violation callback on warn threshold', () => {
      const service = MetricsService.getInstance()
      const violations: ThresholdViolation[] = []

      service.setThreshold('warn-test', { warn: 50, critical: 100 })
      service.onViolation((v) => violations.push(v))

      service.record('warn-test', 75) // Above warn, below critical

      expect(violations).toHaveLength(1)
      expect(violations[0].severity).toBe('warn')
      expect(violations[0].value).toBe(75)
    })

    it('should trigger violation callback on critical threshold', () => {
      const service = MetricsService.getInstance()
      const violations: ThresholdViolation[] = []

      service.setThreshold('critical-test', { warn: 50, critical: 100 })
      service.onViolation((v) => violations.push(v))

      service.record('critical-test', 150) // Above critical

      expect(violations).toHaveLength(1)
      expect(violations[0].severity).toBe('critical')
      expect(violations[0].value).toBe(150)
    })

    it('should not trigger violation below threshold', () => {
      const service = MetricsService.getInstance()
      const violations: ThresholdViolation[] = []

      service.setThreshold('below-test', { warn: 50, critical: 100 })
      service.onViolation((v) => violations.push(v))

      service.record('below-test', 25) // Below both

      expect(violations).toHaveLength(0)
    })

    it('should allow unsubscribing from violations', () => {
      const service = MetricsService.getInstance()
      const violations: ThresholdViolation[] = []

      service.setThreshold('unsub-test', { warn: 10, critical: 20 })
      const unsubscribe = service.onViolation((v) => violations.push(v))

      service.record('unsub-test', 15)
      expect(violations).toHaveLength(1)

      unsubscribe()
      service.record('unsub-test', 15)
      expect(violations).toHaveLength(1) // No new violation
    })

    it('should handle errors in violation listeners', () => {
      const service = MetricsService.getInstance()
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      service.setThreshold('error-listener', { warn: 10, critical: 20 })
      service.onViolation(() => {
        throw new Error('Listener error')
      })

      // Should not throw
      expect(() => service.record('error-listener', 15)).not.toThrow()
      expect(errorSpy).toHaveBeenCalled()

      errorSpy.mockRestore()
    })
  })

  describe('export', () => {
    it('should export all metrics and stats', () => {
      const service = MetricsService.getInstance()

      service.record('export-metric-1', 10)
      service.record('export-metric-1', 20)
      service.record('export-metric-2', 30)

      const exported = service.export()

      expect(exported.metrics['export-metric-1']).toHaveLength(2)
      expect(exported.metrics['export-metric-2']).toHaveLength(1)
      expect(exported.stats['export-metric-1']).toBeDefined()
      expect(exported.stats['export-metric-2']).toBeDefined()
      expect(exported.exportedAt).toBeDefined()
    })

    it('should export as JSON string', () => {
      const service = MetricsService.getInstance()

      service.record('json-metric', 42)

      const json = service.exportJSON()
      const parsed = JSON.parse(json)

      expect(parsed.metrics['json-metric']).toHaveLength(1)
    })

    it('should export as pretty JSON when requested', () => {
      const service = MetricsService.getInstance()

      service.record('pretty-metric', 42)

      const json = service.exportJSON(true)

      expect(json).toContain('\n')
      expect(json).toContain('  ')
    })
  })

  describe('clear', () => {
    it('should clear all metrics', () => {
      const service = MetricsService.getInstance()

      service.record('clear-metric-1', 10)
      service.record('clear-metric-2', 20)

      service.clear()

      expect(service.getMetricNames()).toHaveLength(0)
    })

    it('should clear specific metric', () => {
      const service = MetricsService.getInstance()

      service.record('keep-metric', 10)
      service.record('clear-metric', 20)

      service.clearMetric('clear-metric')

      expect(service.getMetricNames()).toHaveLength(1)
      expect(service.getMetricNames()).toContain('keep-metric')
    })
  })

  describe('getMetricNames', () => {
    it('should return all metric names', () => {
      const service = MetricsService.getInstance()

      service.record('name-a', 10)
      service.record('name-b', 20)
      service.record('name-c', 30)

      const names = service.getMetricNames()

      expect(names).toContain('name-a')
      expect(names).toContain('name-b')
      expect(names).toContain('name-c')
    })
  })

  describe('auto-record', () => {
    it('should enable/disable auto-record', () => {
      const service = MetricsService.getInstance()

      expect(service.isAutoRecordEnabled()).toBe(true)

      service.setAutoRecord(false)
      expect(service.isAutoRecordEnabled()).toBe(false)

      service.setAutoRecord(true)
      expect(service.isAutoRecordEnabled()).toBe(true)
    })
  })
})
