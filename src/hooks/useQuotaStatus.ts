/**
 * useQuotaStatus Hook
 * Provides reactive access to storage quota status
 *
 * AC 15: Storage widget in settings shows real-time usage with progress bar visual
 * AC 17: User can manually trigger storage quota check from settings
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  getQuotaMonitorService,
  type QuotaState,
  type QuotaThresholdStatus,
} from '@/services/quota'

/**
 * Hook result interface
 */
export interface UseQuotaStatusResult {
  /** Current storage usage in bytes */
  usage: number
  /** Total available quota in bytes */
  quota: number
  /** Usage percentage (0-100) */
  percentage: number
  /** Threshold status: 'normal', 'warning', or 'critical' */
  status: QuotaThresholdStatus
  /** Whether quota data is currently loading */
  isLoading: boolean
  /** Error message if quota check failed */
  error: string | null
  /** Whether the Storage API is available */
  isStorageApiAvailable: boolean
  /** Last time the quota was checked (unix timestamp) */
  lastChecked: number | null
  /** Manually refresh the quota status */
  refresh: () => Promise<void>
}

/**
 * React hook for monitoring storage quota status
 * Automatically subscribes to quota changes and provides refresh capability
 *
 * @param autoRefresh - Whether to start periodic monitoring (default: true)
 * @returns Quota status and control functions
 *
 * @example
 * ```tsx
 * function StorageWidget() {
 *   const { usage, quota, percentage, status, refresh, isLoading } = useQuotaStatus()
 *
 *   return (
 *     <div>
 *       <p>Using {formatBytes(usage)} of {formatBytes(quota)} ({percentage}%)</p>
 *       <button onClick={refresh} disabled={isLoading}>
 *         {isLoading ? 'Checking...' : 'Check Storage'}
 *       </button>
 *     </div>
 *   )
 * }
 * ```
 */
export function useQuotaStatus(autoRefresh: boolean = true): UseQuotaStatusResult {
  const [state, setState] = useState<QuotaState | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const quotaMonitor = getQuotaMonitorService()
  const isStorageApiAvailable = quotaMonitor.isStorageApiAvailable()

  // Refresh function for manual quota checks (AC 17)
  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const newState = await quotaMonitor.checkStorageQuota()
      setState(newState)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to check storage quota'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [quotaMonitor])

  // Subscribe to quota changes and optionally start monitoring
  useEffect(() => {
    // Subscribe to state changes
    const unsubscribe = quotaMonitor.subscribe((newState) => {
      setState(newState)
      setIsLoading(false)
      setError(null)
    })

    // Start monitoring if autoRefresh is enabled
    if (autoRefresh) {
      quotaMonitor.startMonitoring()
    } else {
      // Just do a single check
      refresh()
    }

    // Cleanup
    return () => {
      unsubscribe()
      // Note: We don't stop monitoring here as other components may still need it
    }
  }, [quotaMonitor, autoRefresh, refresh])

  return {
    usage: state?.usage ?? 0,
    quota: state?.quota ?? 0,
    percentage: state?.percentage ?? 0,
    status: state?.status ?? 'normal',
    isLoading,
    error,
    isStorageApiAvailable,
    lastChecked: state?.lastChecked ?? null,
    refresh,
  }
}

/**
 * Hook to track threshold crossings for triggering warnings/wizards
 *
 * @param onWarning - Callback when warning threshold (80%) is reached
 * @param onCritical - Callback when critical threshold (90%) is reached
 *
 * @example
 * ```tsx
 * function App() {
 *   useQuotaThresholdAlerts({
 *     onWarning: () => setShowWarningBanner(true),
 *     onCritical: () => setShowCleanupWizard(true),
 *   })
 *
 *   return <div>...</div>
 * }
 * ```
 */
export function useQuotaThresholdAlerts(handlers: {
  onWarning?: () => void
  onCritical?: () => void
}): void {
  const previousStatusRef = useRef<QuotaThresholdStatus | null>(null)
  const { status } = useQuotaStatus()

  useEffect(() => {
    const previousStatus = previousStatusRef.current

    // Only trigger on status transitions (not on first load)
    if (previousStatus !== null) {
      // Detect transitions to warning or critical
      if (previousStatus === 'normal' && status === 'warning') {
        handlers.onWarning?.()
      } else if (
        (previousStatus === 'normal' || previousStatus === 'warning') &&
        status === 'critical'
      ) {
        handlers.onCritical?.()
      }
    }

    // Update ref after checking (doesn't cause re-render)
    previousStatusRef.current = status
  }, [status, handlers])
}
