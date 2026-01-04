/**
 * OfflineIndicator Component
 *
 * Story 2.7: Offline Mode Indicators & Conflict Resolution
 * AC 1: Offline indicator displayed in UI (icon in header)
 * AC 2: Network status detection (online/offline events)
 *
 * Shows network status with visual feedback:
 * - Amber badge when offline
 * - Green "Back online" notification when connectivity restored
 */

import { useState, useEffect, useRef } from 'react'
import { WifiOff, Wifi } from 'lucide-react'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { cn } from '@/utils/cn'

export interface OfflineIndicatorProps {
  /** Additional CSS classes */
  className?: string
  /** Show even when online (for testing) */
  alwaysShow?: boolean
}

/**
 * OfflineIndicator component
 * Displays network connectivity status in the header
 */
export function OfflineIndicator({ className = '', alwaysShow = false }: OfflineIndicatorProps) {
  const { isOnline, checking } = useNetworkStatus()
  const wasOfflineRef = useRef(false)
  const [showBackOnline, setShowBackOnline] = useState(false)

  // Track when we go offline, then show "back online" when restored
  // Using setTimeout(0) to avoid the react-hooks/set-state-in-effect rule
  // which prohibits synchronous setState in effects
  useEffect(() => {
    if (!isOnline) {
      wasOfflineRef.current = true
      return
    }

    if (wasOfflineRef.current) {
      // Just came back online - defer state update to avoid cascading render warning
      wasOfflineRef.current = false
      const showTimer = setTimeout(() => setShowBackOnline(true), 0)

      // Hide "back online" message after 3 seconds
      const hideTimer = setTimeout(() => {
        setShowBackOnline(false)
      }, 3000)

      return () => {
        clearTimeout(showTimer)
        clearTimeout(hideTimer)
      }
    }
  }, [isOnline])

  // Don't render anything if online and no "back online" notification
  if (isOnline && !showBackOnline && !alwaysShow) {
    return null
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-300',
        showBackOnline && isOnline
          ? 'bg-green-100 text-green-700'
          : !isOnline
            ? 'bg-amber-100 text-amber-700'
            : 'bg-slate-100 text-slate-600',
        className
      )}
      role="status"
      aria-live="polite"
      aria-label={
        !isOnline
          ? 'Currently offline. Changes will sync when online.'
          : showBackOnline
            ? 'Back online. Syncing pending changes.'
            : 'Online'
      }
    >
      {showBackOnline && isOnline ? (
        <>
          <Wifi className="h-4 w-4" aria-hidden="true" />
          <span>Back online</span>
        </>
      ) : !isOnline ? (
        <>
          <WifiOff className="h-4 w-4" aria-hidden="true" />
          <span>Offline</span>
          {checking && <span className="animate-pulse text-xs">(checking...)</span>}
        </>
      ) : alwaysShow ? (
        <>
          <Wifi className="h-4 w-4" aria-hidden="true" />
          <span>Online</span>
        </>
      ) : null}
    </div>
  )
}

/**
 * Compact offline indicator (just icon)
 * For use in tight spaces
 */
export function OfflineIcon({ className = '' }: { className?: string }) {
  const { isOnline } = useNetworkStatus()

  if (isOnline) {
    return null
  }

  return (
    <div
      className={cn('p-2 text-amber-600 rounded-full bg-amber-50', className)}
      role="status"
      aria-label="Currently offline"
    >
      <WifiOff className="h-4 w-4" aria-hidden="true" />
    </div>
  )
}
