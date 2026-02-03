/**
 * Health Indicator Component
 *
 * Story 1.20: Subsystem Health Tracking
 * Task 9: Health Indicator UI Component (AC 10-14)
 *
 * Shows aggregate subsystem health in the app header.
 * - Healthy: nothing rendered (AC 11)
 * - Degraded: yellow dot with tooltip (AC 12)
 * - Unavailable: red dot with expandable detail panel (AC 13-14)
 */

import { useState, useEffect, useCallback, useSyncExternalStore } from 'react'
import { Activity } from 'lucide-react'
import { healthRegistry } from '@/services/sync/healthRegistry'
import type { HealthSnapshot, HealthState, SubsystemId } from '@/services/sync/healthTypes'

/** Human-readable subsystem display names (Subtask 9.9) */
const SUBSYSTEM_NAMES: Record<SubsystemId, string> = {
  'sync-gmail': 'Gmail sync',
  'sync-outlook': 'Outlook sync',
  'action-queue': 'Email actions',
  'send-queue': 'Send queue',
  'search-index': 'Search',
  database: 'Database',
}

/** State badge color classes */
const STATE_COLORS: Record<HealthState, string> = {
  healthy: 'bg-green-500',
  degraded: 'bg-amber-400',
  unavailable: 'bg-red-500',
}

const STATE_TEXT_COLORS: Record<HealthState, string> = {
  healthy: 'text-green-700',
  degraded: 'text-amber-700',
  unavailable: 'text-red-700',
}

/**
 * Hook using useSyncExternalStore for health state (Subtask 9.1)
 * Same pattern as CircuitBreakerNotification.tsx
 */
function useHealthState(): HealthSnapshot {
  const subscribe = useCallback(
    (onStoreChange: () => void) => healthRegistry.subscribe(onStoreChange),
    []
  )
  const getSnapshot = useCallback(() => healthRegistry.getSnapshot(), [])

  return useSyncExternalStore(subscribe, getSnapshot)
}

/**
 * Format next retry time as relative string
 */
function formatRetryTime(nextRetryAt: number | undefined): string | null {
  if (!nextRetryAt) return null
  const remaining = nextRetryAt - Date.now()
  if (remaining <= 0) return 'retrying...'
  const seconds = Math.ceil(remaining / 1000)
  if (seconds < 60) return `retry in ${seconds}s`
  const minutes = Math.ceil(seconds / 60)
  return `retry in ${minutes}m`
}

/**
 * Health Indicator Component (Subtask 9.2-9.9)
 */
export function HealthIndicator() {
  const snapshot = useHealthState()
  const [showDetail, setShowDetail] = useState(false)

  // Click outside to close detail panel (Subtask 9.8)
  useEffect(() => {
    if (!showDetail) return

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-health-indicator]')) {
        setShowDetail(false)
      }
    }

    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [showDetail])

  // AC 11: Healthy state — no indicator shown
  if (snapshot.overallState === 'healthy') {
    return null
  }

  // Collect non-healthy subsystems for display
  const degradedSubsystems: Array<{
    id: SubsystemId
    name: string
    state: HealthState
    reason?: string
    nextRetryAt?: number
  }> = []

  for (const [id, health] of snapshot.subsystems) {
    if (health.state !== 'healthy') {
      degradedSubsystems.push({
        id,
        name: SUBSYSTEM_NAMES[id],
        state: health.state,
        reason: health.reason,
        nextRetryAt: health.nextRetryAt,
      })
    }
  }

  const isUnavailable = snapshot.overallState === 'unavailable'
  const indicatorColor = isUnavailable ? 'bg-red-500' : 'bg-amber-400'
  const tooltipText = degradedSubsystems
    .map((s) => `${s.name}: ${s.state}${s.reason ? ` (${s.reason})` : ''}`)
    .join(', ')

  return (
    <div className="relative" data-health-indicator>
      <button
        type="button"
        onClick={() => setShowDetail(!showDetail)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1"
        title={tooltipText}
        aria-roledescription="status"
        aria-live="polite"
        aria-label={`System health: ${snapshot.overallState}. ${tooltipText}`}
        data-testid="health-indicator"
      >
        <Activity className="w-4 h-4 text-slate-500" aria-hidden="true" />
        <span className={`w-2 h-2 rounded-full ${indicatorColor}`} aria-hidden="true" />
      </button>

      {/* Detail panel (Subtask 9.5) */}
      {showDetail && (
        <div
          className="absolute right-0 top-full mt-2 w-72 bg-white rounded-lg shadow-lg border border-slate-200 z-50 p-3"
          data-testid="health-detail-panel"
        >
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            System Health
          </h3>
          <ul className="space-y-2">
            {degradedSubsystems.map((sub) => (
              <li key={sub.id} className="flex items-start gap-2">
                <span
                  className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${STATE_COLORS[sub.state]}`}
                  aria-hidden="true"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-slate-800">{sub.name}</span>
                    <span className={`text-xs font-medium ${STATE_TEXT_COLORS[sub.state]}`}>
                      {sub.state}
                    </span>
                  </div>
                  {sub.reason && <p className="text-xs text-slate-500 mt-0.5">{sub.reason}</p>}
                  {sub.nextRetryAt && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      {formatRetryTime(sub.nextRetryAt)}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
