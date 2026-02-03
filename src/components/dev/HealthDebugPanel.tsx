/**
 * Health Debug Panel
 *
 * Story 1.20: Subsystem Health Tracking
 * Task 12: Debug Health Panel (AC 15)
 *
 * Displays health state change history for debugging.
 * Only renders in development mode.
 */

import { useSyncExternalStore, useCallback } from 'react'
import { healthRegistry } from '@/services/sync/healthRegistry'
import type { HealthStateChange, SubsystemId } from '@/services/sync/healthTypes'

/** Human-readable subsystem names */
const SUBSYSTEM_NAMES: Record<SubsystemId, string> = {
  'sync-gmail': 'Gmail sync',
  'sync-outlook': 'Outlook sync',
  'action-queue': 'Email actions',
  'send-queue': 'Send queue',
  'search-index': 'Search',
  database: 'Database',
}

/** Format timestamp for display */
function formatTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

/** State arrow with color */
function StateTransition({ from, to }: { from: string; to: string }) {
  const toColor =
    to === 'unavailable' ? 'text-red-600' : to === 'degraded' ? 'text-amber-600' : 'text-green-600'

  return (
    <span className="text-xs font-mono">
      <span className="text-slate-400">{from}</span>
      <span className="text-slate-300"> → </span>
      <span className={toColor}>{to}</span>
    </span>
  )
}

/**
 * Health Debug Panel Component (Subtask 12.1-12.4)
 */
export function HealthDebugPanel() {
  // Hooks must be called unconditionally (React Rules of Hooks)
  const isDev = import.meta.env.DEV

  const subscribe = useCallback(
    (onStoreChange: () => void) => healthRegistry.subscribe(onStoreChange),
    []
  )
  const getHistory = useCallback(() => healthRegistry.getHistory(), [])
  const history: HealthStateChange[] = useSyncExternalStore(subscribe, getHistory)

  // Only render in development mode (Subtask 12.3)
  if (!isDev) return null

  if (history.length === 0) {
    return <div className="p-3 text-xs text-slate-400">No health state changes recorded yet.</div>
  }

  // Display in reverse chronological order
  const reversedHistory = [...history].reverse()

  return (
    <div className="p-3">
      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
        Health History ({history.length}/50)
      </h4>
      <div className="max-h-64 overflow-y-auto space-y-1.5">
        {reversedHistory.map((entry, i) => (
          <div
            key={`${entry.timestamp}-${entry.subsystemId}-${i}`}
            className="flex items-start gap-2 text-xs"
          >
            <span className="text-slate-400 font-mono flex-shrink-0">
              {formatTime(entry.timestamp)}
            </span>
            <span className="text-slate-600 font-medium flex-shrink-0 w-20 truncate">
              {SUBSYSTEM_NAMES[entry.subsystemId] || entry.subsystemId}
            </span>
            <StateTransition from={entry.previousState} to={entry.newState} />
            {entry.reason && <span className="text-slate-400 truncate">{entry.reason}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
