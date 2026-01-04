/**
 * Performance Metrics Collection Service
 *
 * Story 2.10: Performance Optimization & Benchmarking
 * Task 1.3: Create metrics.ts for metric collection and aggregation
 *
 * Provides centralized collection, aggregation, and reporting of
 * performance metrics across the application.
 *
 * Features:
 * - Collect and store performance measurements
 * - Aggregate metrics with min/max/avg/p95 statistics
 * - Export metrics for analysis
 * - Integration with Performance Monitor dashboard
 *
 * @example
 * ```typescript
 * import { metricsService } from '@/utils/performance/metrics'
 *
 * // Record a metric
 * metricsService.record('email-list-render', 45.2)
 *
 * // Get aggregated stats
 * const stats = metricsService.getStats('email-list-render')
 * console.log(`Avg: ${stats.avg}ms, P95: ${stats.p95}ms`)
 *
 * // Export all metrics
 * const allMetrics = metricsService.export()
 * ```
 */

import type { MeasurementResult, ExtendedMeasurementResult } from './benchmark'

/**
 * Performance metric categories
 */
export type MetricCategory =
  | 'render' // React component renders
  | 'database' // IndexedDB/RxDB operations
  | 'network' // API calls
  | 'search' // Search operations
  | 'interaction' // User interactions
  | 'worker' // Web Worker operations
  | 'other' // Uncategorized

/**
 * Single metric entry
 */
export interface MetricEntry {
  /** Metric name */
  name: string
  /** Duration in milliseconds */
  duration: number
  /** Timestamp when recorded */
  timestamp: number
  /** Category for grouping */
  category: MetricCategory
  /** Optional metadata */
  metadata?: Record<string, unknown>
}

/**
 * Aggregated statistics for a metric
 */
export interface MetricStats {
  /** Metric name */
  name: string
  /** Number of samples */
  count: number
  /** Minimum duration */
  min: number
  /** Maximum duration */
  max: number
  /** Average duration */
  avg: number
  /** Median duration (p50) */
  median: number
  /** 95th percentile */
  p95: number
  /** 99th percentile */
  p99: number
  /** Standard deviation */
  stdDev: number
  /** First recorded timestamp */
  firstSeen: number
  /** Last recorded timestamp */
  lastSeen: number
  /** Category */
  category: MetricCategory
}

/**
 * Performance thresholds for metrics
 */
export interface PerformanceThreshold {
  /** Warning threshold in ms */
  warn: number
  /** Critical threshold in ms */
  critical: number
}

/**
 * Threshold violation info
 */
export interface ThresholdViolation {
  /** Metric name */
  name: string
  /** Measured value */
  value: number
  /** Threshold that was exceeded */
  threshold: PerformanceThreshold
  /** Severity level */
  severity: 'warn' | 'critical'
  /** Timestamp of violation */
  timestamp: number
}

/**
 * Default performance thresholds based on NFR001
 * (<50ms input latency, 60 FPS scrolling)
 */
export const DEFAULT_THRESHOLDS: Record<string, PerformanceThreshold> = {
  // Render operations
  'email-list-render': { warn: 30, critical: 50 },
  'thread-detail-render': { warn: 30, critical: 50 },
  'search-results-render': { warn: 30, critical: 50 },
  'compose-open': { warn: 100, critical: 200 },

  // Database operations
  'db-query': { warn: 20, critical: 50 },
  'db-write': { warn: 30, critical: 100 },
  'db-sync': { warn: 500, critical: 2000 },

  // Search operations
  'search-query': { warn: 100, critical: 300 },
  'search-index': { warn: 500, critical: 2000 },

  // Interactions
  'input-latency': { warn: 30, critical: 50 },
  'scroll-frame': { warn: 16.67, critical: 33.33 }, // 60 FPS / 30 FPS
}

/**
 * Maximum entries to keep per metric (for memory management)
 */
const MAX_ENTRIES_PER_METRIC = 1000

/**
 * Performance Metrics Service
 *
 * Singleton service for collecting and analyzing performance metrics.
 */
export class MetricsService {
  private static instance: MetricsService

  /** Stored metrics by name */
  private metrics = new Map<string, MetricEntry[]>()

  /** Custom thresholds */
  private thresholds: Record<string, PerformanceThreshold> = { ...DEFAULT_THRESHOLDS }

  /** Violation listeners */
  private violationListeners: Array<(violation: ThresholdViolation) => void> = []

  /** Whether to auto-record measurements */
  private autoRecord = true

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): MetricsService {
    if (!MetricsService.instance) {
      MetricsService.instance = new MetricsService()
    }
    return MetricsService.instance
  }

  /**
   * Record a performance measurement
   *
   * @param name - Metric name
   * @param duration - Duration in milliseconds
   * @param options - Optional category and metadata
   */
  record(
    name: string,
    duration: number,
    options?: {
      category?: MetricCategory
      metadata?: Record<string, unknown>
    }
  ): void {
    const entry: MetricEntry = {
      name,
      duration,
      timestamp: Date.now(),
      category: options?.category ?? this.inferCategory(name),
      metadata: options?.metadata,
    }

    // Add to storage
    if (!this.metrics.has(name)) {
      this.metrics.set(name, [])
    }

    const entries = this.metrics.get(name)!
    entries.push(entry)

    // Trim old entries if needed
    if (entries.length > MAX_ENTRIES_PER_METRIC) {
      entries.splice(0, entries.length - MAX_ENTRIES_PER_METRIC)
    }

    // Check thresholds
    this.checkThreshold(name, duration)
  }

  /**
   * Record a MeasurementResult from the benchmark utilities
   *
   * @param measurement - Measurement result to record
   */
  recordMeasurement(measurement: MeasurementResult | ExtendedMeasurementResult): void {
    const metadata = 'metadata' in measurement ? measurement.metadata : undefined
    const memoryUsed = 'memoryUsed' in measurement ? measurement.memoryUsed : undefined

    this.record(measurement.name, measurement.duration, {
      metadata: { ...metadata, memoryUsed },
    })
  }

  /**
   * Get raw entries for a metric
   *
   * @param name - Metric name
   * @returns Array of metric entries
   */
  getEntries(name: string): MetricEntry[] {
    return this.metrics.get(name) || []
  }

  /**
   * Get aggregated statistics for a metric
   *
   * @param name - Metric name
   * @returns Statistics or null if no data
   */
  getStats(name: string): MetricStats | null {
    const entries = this.metrics.get(name)
    if (!entries || entries.length === 0) {
      return null
    }

    const durations = entries.map((e) => e.duration).sort((a, b) => a - b)
    const count = durations.length
    const sum = durations.reduce((a, b) => a + b, 0)
    const avg = sum / count

    // Calculate standard deviation
    const squaredDiffs = durations.map((d) => Math.pow(d - avg, 2))
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / count
    const stdDev = Math.sqrt(avgSquaredDiff)

    return {
      name,
      count,
      min: durations[0],
      max: durations[count - 1],
      avg,
      median: this.percentile(durations, 50),
      p95: this.percentile(durations, 95),
      p99: this.percentile(durations, 99),
      stdDev,
      firstSeen: entries[0].timestamp,
      lastSeen: entries[entries.length - 1].timestamp,
      category: entries[0].category,
    }
  }

  /**
   * Get statistics for all metrics
   *
   * @returns Map of metric name to statistics
   */
  getAllStats(): Map<string, MetricStats> {
    const allStats = new Map<string, MetricStats>()

    for (const name of this.metrics.keys()) {
      const stats = this.getStats(name)
      if (stats) {
        allStats.set(name, stats)
      }
    }

    return allStats
  }

  /**
   * Get metrics grouped by category
   *
   * @returns Map of category to metric stats
   */
  getStatsByCategory(): Map<MetricCategory, MetricStats[]> {
    const byCategory = new Map<MetricCategory, MetricStats[]>()

    for (const stats of this.getAllStats().values()) {
      if (!byCategory.has(stats.category)) {
        byCategory.set(stats.category, [])
      }
      byCategory.get(stats.category)!.push(stats)
    }

    return byCategory
  }

  /**
   * Get a summary of all metrics as a plain object
   * Useful for dashboard display
   *
   * @returns Object with metric names as keys and summary stats as values
   */
  getMetricsSummary(): Record<string, { avg: number; count: number; min: number; max: number }> {
    const summary: Record<string, { avg: number; count: number; min: number; max: number }> = {}

    for (const [name] of this.metrics.entries()) {
      const stats = this.getStats(name)
      if (stats) {
        summary[name] = {
          avg: stats.avg,
          count: stats.count,
          min: stats.min,
          max: stats.max,
        }
      }
    }

    return summary
  }

  /**
   * Set a custom threshold for a metric
   *
   * @param name - Metric name
   * @param threshold - Threshold values
   */
  setThreshold(name: string, threshold: PerformanceThreshold): void {
    this.thresholds[name] = threshold
  }

  /**
   * Get threshold for a metric
   *
   * @param name - Metric name
   * @returns Threshold or undefined
   */
  getThreshold(name: string): PerformanceThreshold | undefined {
    return this.thresholds[name]
  }

  /**
   * Add a listener for threshold violations
   *
   * @param listener - Callback function
   * @returns Unsubscribe function
   */
  onViolation(listener: (violation: ThresholdViolation) => void): () => void {
    this.violationListeners.push(listener)
    return () => {
      const index = this.violationListeners.indexOf(listener)
      if (index >= 0) {
        this.violationListeners.splice(index, 1)
      }
    }
  }

  /**
   * Export all metrics data
   *
   * @returns Object with all metrics and stats
   */
  export(): {
    metrics: Record<string, MetricEntry[]>
    stats: Record<string, MetricStats>
    exportedAt: number
  } {
    const metrics: Record<string, MetricEntry[]> = {}
    const stats: Record<string, MetricStats> = {}

    for (const [name, entries] of this.metrics.entries()) {
      metrics[name] = entries
      const metricStats = this.getStats(name)
      if (metricStats) {
        stats[name] = metricStats
      }
    }

    return {
      metrics,
      stats,
      exportedAt: Date.now(),
    }
  }

  /**
   * Export metrics as JSON string
   *
   * @param pretty - Whether to format with indentation
   * @returns JSON string
   */
  exportJSON(pretty = false): string {
    return JSON.stringify(this.export(), null, pretty ? 2 : undefined)
  }

  /**
   * Clear all recorded metrics
   */
  clear(): void {
    this.metrics.clear()
  }

  /**
   * Clear metrics for a specific name
   *
   * @param name - Metric name to clear
   */
  clearMetric(name: string): void {
    this.metrics.delete(name)
  }

  /**
   * Get list of all metric names
   *
   * @returns Array of metric names
   */
  getMetricNames(): string[] {
    return Array.from(this.metrics.keys())
  }

  /**
   * Enable or disable auto-recording
   *
   * @param enabled - Whether to enable
   */
  setAutoRecord(enabled: boolean): void {
    this.autoRecord = enabled
  }

  /**
   * Check if auto-recording is enabled
   */
  isAutoRecordEnabled(): boolean {
    return this.autoRecord
  }

  /**
   * Calculate percentile from sorted array
   */
  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0
    if (sorted.length === 1) return sorted[0]

    const index = (p / 100) * (sorted.length - 1)
    const lower = Math.floor(index)
    const upper = Math.ceil(index)

    if (lower === upper) {
      return sorted[lower]
    }

    const weight = index - lower
    return sorted[lower] * (1 - weight) + sorted[upper] * weight
  }

  /**
   * Infer category from metric name
   */
  private inferCategory(name: string): MetricCategory {
    const lowerName = name.toLowerCase()

    if (lowerName.includes('render') || lowerName.includes('component')) {
      return 'render'
    }
    if (lowerName.includes('db') || lowerName.includes('query') || lowerName.includes('rxdb')) {
      return 'database'
    }
    if (lowerName.includes('fetch') || lowerName.includes('api') || lowerName.includes('network')) {
      return 'network'
    }
    if (lowerName.includes('search') || lowerName.includes('index')) {
      return 'search'
    }
    if (
      lowerName.includes('click') ||
      lowerName.includes('input') ||
      lowerName.includes('scroll')
    ) {
      return 'interaction'
    }
    if (lowerName.includes('worker')) {
      return 'worker'
    }

    return 'other'
  }

  /**
   * Check if a value exceeds thresholds
   */
  private checkThreshold(name: string, value: number): void {
    const threshold = this.thresholds[name]
    if (!threshold) return

    let severity: 'warn' | 'critical' | null = null

    if (value >= threshold.critical) {
      severity = 'critical'
    } else if (value >= threshold.warn) {
      severity = 'warn'
    }

    if (severity) {
      const violation: ThresholdViolation = {
        name,
        value,
        threshold,
        severity,
        timestamp: Date.now(),
      }

      // Notify listeners
      for (const listener of this.violationListeners) {
        try {
          listener(violation)
        } catch (e) {
          console.error('Error in violation listener:', e)
        }
      }
    }
  }

  /**
   * Reset singleton instance (for testing only)
   * @internal
   */
  static __resetForTesting(): void {
    if (MetricsService.instance) {
      MetricsService.instance.clear()
      MetricsService.instance.violationListeners = []
    }
    MetricsService.instance = null as unknown as MetricsService
  }
}

/**
 * Singleton instance export
 */
export const metricsService = MetricsService.getInstance()
