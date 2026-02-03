/**
 * Bankruptcy Notification Component
 *
 * Story 1.16: Sync Bankruptcy Detection
 * Task 4: Bankruptcy Notification UI (AC 9)
 *
 * Shows a toast notification when sync bankruptcy is triggered,
 * informing the user that a fresh sync is in progress.
 * Auto-dismisses after initial sync completes.
 *
 * Follows the pattern from CircuitBreakerNotification.tsx.
 */

import { useState, useEffect, useCallback } from 'react'
import { syncBankruptcy, type BankruptcyEvent } from '@/services/sync/syncBankruptcy'

const AUTO_DISMISS_MS = 15_000

/**
 * Bankruptcy Notification Container
 *
 * Mounted in App.tsx alongside CircuitBreakerNotification.
 * Shows toast when sync bankruptcy is triggered.
 */
export function BankruptcyNotification() {
  const [event, setEvent] = useState<BankruptcyEvent | null>(null)

  useEffect(() => {
    const sub = syncBankruptcy.getEvents$().subscribe((e) => {
      setEvent(e)
    })
    return () => sub.unsubscribe()
  }, [])

  // Auto-dismiss after timeout
  useEffect(() => {
    if (!event) return

    const timer = setTimeout(() => {
      setEvent(null)
    }, AUTO_DISMISS_MS)

    return () => clearTimeout(timer)
  }, [event])

  const dismiss = useCallback(() => {
    setEvent(null)
  }, [])

  if (!event) return null

  return (
    <div
      className="fixed top-16 left-1/2 -translate-x-1/2 z-40 flex flex-col gap-2"
      data-testid="bankruptcy-notification"
    >
      <div
        className="flex items-center gap-3 px-4 py-2.5 bg-white border border-slate-200 rounded-xl shadow-md animate-in fade-in slide-in-from-top-2"
        role="status"
        aria-live="polite"
      >
        <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" aria-hidden="true" />

        <span className="text-sm text-slate-700">
          Syncing fresh copy of your emails (you were offline for a while)
        </span>

        <button
          onClick={dismiss}
          className="flex-shrink-0 px-2 py-1 text-xs text-slate-500 hover:text-slate-700 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 rounded"
          aria-label="Dismiss notification"
          data-testid="bankruptcy-notification-dismiss"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
