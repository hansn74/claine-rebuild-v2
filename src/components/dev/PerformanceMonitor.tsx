/**
 * Performance Monitoring Dashboard
 *
 * Story 2.10: Performance Optimization & Benchmarking
 * Task 7: Create Performance Monitoring Dashboard (AC: 6)
 *
 * Development tool for visualizing performance metrics in real-time.
 * Only visible in development mode.
 */

import { useState, useEffect, useCallback, useRef, memo } from 'react'
import { metricsService } from '@/utils/performance/metrics'
import { queryCache } from '@/services/database/queryCache'
import { cn } from '@/utils/cn'
import { HealthDebugPanel } from './HealthDebugPanel'

/**
 * Position for the monitor panel
 */
type MonitorPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

interface PerformanceMonitorProps {
  /** Initial position of the monitor */
  position?: MonitorPosition
  /** Initial collapsed state */
  collapsed?: boolean
}

/**
 * FPS tracking state
 */
interface FpsState {
  current: number
  min: number
  max: number
  avg: number
  samples: number[]
}

/**
 * Memory tracking state
 */
interface MemoryState {
  usedJSHeapSize: number
  totalJSHeapSize: number
  jsHeapSizeLimit: number
  percentUsed: number
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * FPS Counter component
 */
const FpsCounter = memo(function FpsCounter({ fps }: { fps: FpsState }) {
  const getColor = (current: number) => {
    if (current >= 55) return 'text-green-500'
    if (current >= 30) return 'text-yellow-500'
    return 'text-red-500'
  }

  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-slate-600 uppercase">FPS</div>
      <div className={cn('text-2xl font-mono font-bold', getColor(fps.current))}>{fps.current}</div>
      <div className="flex gap-2 text-xs text-slate-500">
        <span>Min: {fps.min}</span>
        <span>Max: {fps.max}</span>
        <span>Avg: {fps.avg}</span>
      </div>
    </div>
  )
})

/**
 * Memory Usage component
 */
const MemoryUsage = memo(function MemoryUsage({ memory }: { memory: MemoryState | null }) {
  if (!memory) {
    return (
      <div className="space-y-1">
        <div className="text-xs font-medium text-slate-600 uppercase">Memory</div>
        <div className="text-sm text-slate-400">Not available</div>
      </div>
    )
  }

  const getColor = (percent: number) => {
    if (percent < 50) return 'bg-green-500'
    if (percent < 80) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-slate-600 uppercase">Memory</div>
      <div className="text-lg font-mono">{formatBytes(memory.usedJSHeapSize)}</div>
      <div className="w-full h-2 bg-slate-200 rounded overflow-hidden">
        <div
          className={cn('h-full transition-all', getColor(memory.percentUsed))}
          style={{ width: `${Math.min(100, memory.percentUsed)}%` }}
        />
      </div>
      <div className="text-xs text-slate-500">
        {memory.percentUsed.toFixed(1)}% of {formatBytes(memory.jsHeapSizeLimit)}
      </div>
    </div>
  )
})

/**
 * Query Cache Stats component
 */
const QueryCacheStats = memo(function QueryCacheStats() {
  const stats = queryCache.getStats()

  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-slate-600 uppercase">Query Cache</div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-slate-500">Size:</span>{' '}
          <span className="font-mono">{stats.size}</span>
        </div>
        <div>
          <span className="text-slate-500">Hit Rate:</span>{' '}
          <span className="font-mono">{(stats.hitRate * 100).toFixed(1)}%</span>
        </div>
        <div>
          <span className="text-slate-500">Hits:</span>{' '}
          <span className="font-mono text-green-600">{stats.hits}</span>
        </div>
        <div>
          <span className="text-slate-500">Misses:</span>{' '}
          <span className="font-mono text-red-600">{stats.misses}</span>
        </div>
      </div>
    </div>
  )
})

/**
 * Metrics Overview component
 */
const MetricsOverview = memo(function MetricsOverview() {
  const [metrics, setMetrics] = useState(metricsService.getMetricsSummary())

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(metricsService.getMetricsSummary())
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const metricsArray = Object.entries(metrics)
  if (metricsArray.length === 0) {
    return (
      <div className="space-y-1">
        <div className="text-xs font-medium text-slate-600 uppercase">Metrics</div>
        <div className="text-sm text-slate-400">No metrics recorded</div>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-slate-600 uppercase">Metrics</div>
      <div className="space-y-1 max-h-32 overflow-y-auto">
        {metricsArray.slice(0, 5).map(([name, stats]) => (
          <div key={name} className="flex justify-between text-xs">
            <span className="text-slate-600 truncate max-w-[120px]">{name}</span>
            <span className="font-mono">
              {stats.avg.toFixed(1)}ms ({stats.count})
            </span>
          </div>
        ))}
      </div>
    </div>
  )
})

/**
 * Performance Monitor component
 */
export function PerformanceMonitor({
  position = 'bottom-right',
  collapsed: initialCollapsed = true,
}: PerformanceMonitorProps) {
  const [collapsed, setCollapsed] = useState(initialCollapsed)
  const [fps, setFps] = useState<FpsState>({
    current: 60,
    min: 60,
    max: 60,
    avg: 60,
    samples: [],
  })
  const [memory, setMemory] = useState<MemoryState | null>(null)

  const lastFrameTime = useRef(0)
  const frameCount = useRef(0)
  const animationFrameId = useRef<number | undefined>(undefined)

  // Only render in development mode - must be after hooks
  const isDev = import.meta.env.DEV

  // Initialize refs on mount
  useEffect(() => {
    lastFrameTime.current = performance.now()
  }, [])

  // FPS calculation loop
  const measureFps = useCallback(function fpsLoop(_time: number) {
    const now = performance.now()
    frameCount.current++

    // Update FPS every second
    if (now - lastFrameTime.current >= 1000) {
      const currentFps = Math.round((frameCount.current * 1000) / (now - lastFrameTime.current))

      setFps((prev) => {
        const newSamples = [...prev.samples.slice(-59), currentFps]
        return {
          current: currentFps,
          min: Math.min(...newSamples),
          max: Math.max(...newSamples),
          avg: Math.round(newSamples.reduce((a, b) => a + b, 0) / newSamples.length),
          samples: newSamples,
        }
      })

      lastFrameTime.current = now
      frameCount.current = 0
    }

    animationFrameId.current = requestAnimationFrame(fpsLoop)
  }, [])

  // Memory measurement
  const measureMemory = useCallback(() => {
    const perf = performance as Performance & {
      memory?: {
        usedJSHeapSize: number
        totalJSHeapSize: number
        jsHeapSizeLimit: number
      }
    }

    if (perf.memory) {
      setMemory({
        usedJSHeapSize: perf.memory.usedJSHeapSize,
        totalJSHeapSize: perf.memory.totalJSHeapSize,
        jsHeapSizeLimit: perf.memory.jsHeapSizeLimit,
        percentUsed: (perf.memory.usedJSHeapSize / perf.memory.jsHeapSizeLimit) * 100,
      })
    }
  }, [])

  // Start measurements
  useEffect(() => {
    if (!collapsed) {
      animationFrameId.current = requestAnimationFrame(measureFps)
      measureMemory()
      const memoryInterval = setInterval(measureMemory, 2000)

      return () => {
        if (animationFrameId.current) {
          cancelAnimationFrame(animationFrameId.current)
        }
        clearInterval(memoryInterval)
      }
    }
  }, [collapsed, measureFps, measureMemory])

  // Export benchmark results
  const handleExport = useCallback(() => {
    const data = {
      timestamp: new Date().toISOString(),
      fps: fps,
      memory: memory,
      queryCache: queryCache.getStats(),
      metrics: metricsService.getMetricsSummary(),
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `performance-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [fps, memory])

  // Position classes
  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4',
  }

  // Only render in development mode
  if (!isDev) {
    return null
  }

  return (
    <div className={cn('fixed z-[9999]', positionClasses[position], 'font-sans text-sm')}>
      {collapsed ? (
        <button
          onClick={() => setCollapsed(false)}
          className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-800 transition-colors shadow-lg"
        >
          Perf
        </button>
      ) : (
        <div className="bg-white rounded-lg shadow-xl border border-slate-200 w-64">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
            <span className="font-semibold text-slate-700">Performance</span>
            <div className="flex gap-1">
              <button
                onClick={handleExport}
                className="text-slate-400 hover:text-slate-600 p-1"
                title="Export"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
              </button>
              <button
                onClick={() => setCollapsed(true)}
                className="text-slate-400 hover:text-slate-600 p-1"
                title="Collapse"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-3 space-y-4">
            <FpsCounter fps={fps} />
            <MemoryUsage memory={memory} />
            <QueryCacheStats />
            <MetricsOverview />
          </div>

          {/* Health Debug Panel - Story 1.20 */}
          <div className="border-t border-slate-100">
            <HealthDebugPanel />
          </div>
        </div>
      )}
    </div>
  )
}

export default PerformanceMonitor
