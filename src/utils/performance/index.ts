/**
 * Performance Utilities
 *
 * Story 2.10: Performance Optimization & Benchmarking
 * Task 1: Establish Performance Benchmark Infrastructure (AC: 1)
 *
 * Re-exports all performance utilities for convenient importing.
 *
 * @example
 * ```typescript
 * import {
 *   benchmark,
 *   startMeasure,
 *   endMeasure,
 *   metricsService,
 *   DEFAULT_THRESHOLDS
 * } from '@/utils/performance'
 * ```
 */

// Benchmark utilities
export {
  startMeasure,
  endMeasure,
  isMeasuring,
  cancelMeasure,
  benchmark,
  benchmarkSync,
  mark,
  getPerformanceEntries,
  clearPerformanceEntries,
  measureFirstPaint,
  measureLCP,
  type MeasurementResult,
  type ExtendedMeasurementResult,
  type BenchmarkOptions,
} from './benchmark'

// Metrics service
export {
  MetricsService,
  metricsService,
  DEFAULT_THRESHOLDS,
  type MetricCategory,
  type MetricEntry,
  type MetricStats,
  type PerformanceThreshold,
  type ThresholdViolation,
} from './metrics'
