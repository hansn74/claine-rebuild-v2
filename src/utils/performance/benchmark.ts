/**
 * Performance Benchmark Utilities
 *
 * Story 2.10: Performance Optimization & Benchmarking
 * Task 1: Establish Performance Benchmark Infrastructure (AC: 1)
 *
 * Provides Performance API wrappers for measuring:
 * - Render cycles
 * - API calls
 * - Database operations
 * - User interactions
 *
 * Uses the browser's Performance API for accurate timing.
 *
 * @example
 * ```typescript
 * import { benchmark, startMeasure, endMeasure } from '@/utils/performance/benchmark'
 *
 * // Simple timing
 * const duration = await benchmark('email-list-render', async () => {
 *   await renderEmailList()
 * })
 *
 * // Manual marks
 * startMeasure('search-query')
 * await performSearch()
 * const result = endMeasure('search-query')
 * ```
 */

/**
 * Measurement result from a performance benchmark
 */
export interface MeasurementResult {
  /** Name of the measurement */
  name: string
  /** Duration in milliseconds */
  duration: number
  /** Start time (performance.now()) */
  startTime: number
  /** End time (performance.now()) */
  endTime: number
  /** Timestamp when measurement was taken */
  timestamp: number
}

/**
 * Benchmark options
 */
export interface BenchmarkOptions {
  /** Include memory info if available (Chrome only) */
  includeMemory?: boolean
  /** Custom metadata to attach to the result */
  metadata?: Record<string, unknown>
}

/**
 * Extended measurement result with optional memory info
 */
export interface ExtendedMeasurementResult extends MeasurementResult {
  /** Memory usage in bytes (Chrome only) */
  memoryUsed?: number
  /** Custom metadata */
  metadata?: Record<string, unknown>
}

// Track active measurements
const activeMeasurements = new Map<string, number>()

/**
 * Start a performance measurement
 *
 * Creates a performance mark with the given name.
 * Call `endMeasure` with the same name to get the duration.
 *
 * @param name - Unique identifier for this measurement
 * @throws Error if measurement with this name is already active
 */
export function startMeasure(name: string): void {
  if (activeMeasurements.has(name)) {
    console.warn(
      `Performance measurement '${name}' is already active. Previous measurement will be overwritten.`
    )
  }

  const markName = `perf-start-${name}`
  performance.mark(markName)
  activeMeasurements.set(name, performance.now())
}

/**
 * End a performance measurement and get the result
 *
 * @param name - The name used when calling startMeasure
 * @returns Measurement result with duration
 * @throws Error if no measurement with this name was started
 */
export function endMeasure(name: string): MeasurementResult {
  const startTime = activeMeasurements.get(name)
  if (startTime === undefined) {
    throw new Error(`No active measurement found for '${name}'. Call startMeasure first.`)
  }

  const endTime = performance.now()
  const duration = endTime - startTime

  // Create performance measure for DevTools timeline
  const startMarkName = `perf-start-${name}`
  const endMarkName = `perf-end-${name}`
  performance.mark(endMarkName)

  try {
    performance.measure(name, startMarkName, endMarkName)
  } catch {
    // Marks may have been cleared, that's okay
  }

  // Clean up
  activeMeasurements.delete(name)

  // Clean up marks (optional, for memory)
  try {
    performance.clearMarks(startMarkName)
    performance.clearMarks(endMarkName)
  } catch {
    // Ignore errors during cleanup
  }

  return {
    name,
    duration,
    startTime,
    endTime,
    timestamp: Date.now(),
  }
}

/**
 * Check if a measurement is currently active
 *
 * @param name - Measurement name to check
 * @returns true if measurement is active
 */
export function isMeasuring(name: string): boolean {
  return activeMeasurements.has(name)
}

/**
 * Cancel an active measurement without recording it
 *
 * @param name - Measurement name to cancel
 * @returns true if measurement was cancelled, false if not found
 */
export function cancelMeasure(name: string): boolean {
  if (!activeMeasurements.has(name)) {
    return false
  }

  activeMeasurements.delete(name)

  // Clean up performance mark
  try {
    performance.clearMarks(`perf-start-${name}`)
  } catch {
    // Ignore errors
  }

  return true
}

/**
 * Get memory usage in bytes (Chrome only)
 *
 * @returns Memory usage or undefined if not available
 */
function getMemoryUsage(): number | undefined {
  if ('memory' in performance) {
    const memory = (performance as unknown as { memory: { usedJSHeapSize: number } }).memory
    return memory.usedJSHeapSize
  }
  return undefined
}

/**
 * Run a benchmark on an async function
 *
 * Wraps the execution in performance marks and returns
 * the duration along with the function result.
 *
 * @param name - Unique identifier for this benchmark
 * @param fn - Async function to benchmark
 * @param options - Optional benchmark options
 * @returns Object with duration and the function's return value
 *
 * @example
 * ```typescript
 * const { duration, result } = await benchmark('db-query', async () => {
 *   return await db.find({ selector: { folder: 'inbox' } }).exec()
 * })
 * console.log(`Query took ${duration}ms, returned ${result.length} items`)
 * ```
 */
export async function benchmark<T>(
  name: string,
  fn: () => Promise<T>,
  options?: BenchmarkOptions
): Promise<{ duration: number; result: T; measurement: ExtendedMeasurementResult }> {
  const startMemory = options?.includeMemory ? getMemoryUsage() : undefined

  startMeasure(name)

  try {
    const result = await fn()
    const measurement = endMeasure(name)

    const endMemory = options?.includeMemory ? getMemoryUsage() : undefined
    const memoryUsed =
      startMemory !== undefined && endMemory !== undefined ? endMemory - startMemory : undefined

    const extendedMeasurement: ExtendedMeasurementResult = {
      ...measurement,
      memoryUsed,
      metadata: options?.metadata,
    }

    return {
      duration: measurement.duration,
      result,
      measurement: extendedMeasurement,
    }
  } catch (error) {
    // Clean up measurement on error
    cancelMeasure(name)
    throw error
  }
}

/**
 * Run a synchronous benchmark
 *
 * @param name - Unique identifier for this benchmark
 * @param fn - Synchronous function to benchmark
 * @param options - Optional benchmark options
 * @returns Object with duration and the function's return value
 */
export function benchmarkSync<T>(
  name: string,
  fn: () => T,
  options?: BenchmarkOptions
): { duration: number; result: T; measurement: ExtendedMeasurementResult } {
  const startMemory = options?.includeMemory ? getMemoryUsage() : undefined

  startMeasure(name)

  try {
    const result = fn()
    const measurement = endMeasure(name)

    const endMemory = options?.includeMemory ? getMemoryUsage() : undefined
    const memoryUsed =
      startMemory !== undefined && endMemory !== undefined ? endMemory - startMemory : undefined

    const extendedMeasurement: ExtendedMeasurementResult = {
      ...measurement,
      memoryUsed,
      metadata: options?.metadata,
    }

    return {
      duration: measurement.duration,
      result,
      measurement: extendedMeasurement,
    }
  } catch (error) {
    cancelMeasure(name)
    throw error
  }
}

/**
 * Create performance marks for browser DevTools timeline
 *
 * Use this for one-off markers that don't need duration tracking.
 *
 * @param name - Name for the performance mark
 * @param detail - Optional detail object to attach
 */
export function mark(name: string, detail?: Record<string, unknown>): void {
  performance.mark(name, { detail })
}

/**
 * Get all performance entries for a given name
 *
 * @param name - Name to filter by
 * @returns Array of PerformanceEntry objects
 */
export function getPerformanceEntries(name?: string): PerformanceEntry[] {
  if (name) {
    return performance.getEntriesByName(name)
  }
  return performance.getEntries()
}

/**
 * Clear all performance entries
 *
 * Use this periodically to prevent memory buildup.
 */
export function clearPerformanceEntries(): void {
  performance.clearMarks()
  performance.clearMeasures()
}

/**
 * Measure time to first render using Performance Observer
 *
 * @returns Promise that resolves with first paint timing
 */
export function measureFirstPaint(): Promise<number | null> {
  return new Promise((resolve) => {
    // Check if already painted
    const entries = performance.getEntriesByType('paint')
    const firstPaint = entries.find((e) => e.name === 'first-paint')
    if (firstPaint) {
      resolve(firstPaint.startTime)
      return
    }

    // Wait for paint
    if ('PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntriesByName('first-paint')
        if (entries.length > 0) {
          observer.disconnect()
          resolve(entries[0].startTime)
        }
      })

      try {
        observer.observe({ entryTypes: ['paint'] })
      } catch {
        resolve(null)
      }

      // Timeout after 10 seconds
      setTimeout(() => {
        observer.disconnect()
        resolve(null)
      }, 10000)
    } else {
      resolve(null)
    }
  })
}

/**
 * Measure time to largest contentful paint (LCP)
 *
 * @returns Promise that resolves with LCP timing
 */
export function measureLCP(): Promise<number | null> {
  return new Promise((resolve) => {
    if ('PerformanceObserver' in window) {
      let lcpValue: number | null = null

      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        const lastEntry = entries[entries.length - 1]
        if (lastEntry) {
          lcpValue = lastEntry.startTime
        }
      })

      try {
        observer.observe({ type: 'largest-contentful-paint', buffered: true })
      } catch {
        resolve(null)
        return
      }

      // LCP is finalized when user interacts or page becomes hidden
      const finalize = () => {
        observer.disconnect()
        resolve(lcpValue)
      }

      // Listen for user interaction
      const events = ['keydown', 'click', 'scroll']
      const handler = () => {
        events.forEach((e) => document.removeEventListener(e, handler))
        finalize()
      }
      events.forEach((e) => document.addEventListener(e, handler, { once: true }))

      // Also finalize on visibility change
      document.addEventListener(
        'visibilitychange',
        () => {
          if (document.visibilityState === 'hidden') {
            finalize()
          }
        },
        { once: true }
      )

      // Timeout after 30 seconds
      setTimeout(finalize, 30000)
    } else {
      resolve(null)
    }
  })
}
