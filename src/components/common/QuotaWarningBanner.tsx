/**
 * QuotaWarningBanner Component
 * Displays a dismissible warning banner when storage quota is approaching limits
 *
 * AC 4: Warning banner shown when usage reaches 80% quota
 * AC 5: Cleanup wizard triggered automatically when usage reaches 90% quota
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@shared/components/ui/button'
import { useQuotaStatus } from '@/hooks/useQuotaStatus'
import { formatBytes } from '@/services/quota'

// LocalStorage key for dismissal timestamp
const DISMISSAL_KEY = 'quota-warning-dismissed-at'
// Re-show banner after 24 hours
const DISMISSAL_DURATION_MS = 24 * 60 * 60 * 1000

export interface QuotaWarningBannerProps {
  /** Callback when "Manage Storage" button is clicked */
  onManageStorage?: () => void
  /** Whether to automatically trigger cleanup wizard at critical (90%) threshold */
  autoTriggerCleanup?: boolean
  /** Callback when cleanup should be triggered (at 90% threshold) */
  onTriggerCleanup?: () => void
}

/**
 * QuotaWarningBanner component
 * Shows a dismissible banner when storage is approaching limits
 */
export function QuotaWarningBanner({
  onManageStorage,
  autoTriggerCleanup = true,
  onTriggerCleanup,
}: QuotaWarningBannerProps) {
  const { percentage, status, usage, quota, isStorageApiAvailable } = useQuotaStatus()
  const [isDismissed, setIsDismissed] = useState(() => {
    // Initialize from localStorage - check if recently dismissed
    const stored = localStorage.getItem(DISMISSAL_KEY)
    if (stored) {
      const timestamp = parseInt(stored, 10)
      const elapsed = Date.now() - timestamp
      if (elapsed < DISMISSAL_DURATION_MS) {
        return true
      }
      // Clear old dismissal
      localStorage.removeItem(DISMISSAL_KEY)
    }
    return false
  })
  const hasTriggeredCleanupRef = useRef(false)
  const previousStatusRef = useRef(status)

  // Handle status transitions and side effects
  useEffect(() => {
    const previousStatus = previousStatusRef.current

    // When returning to normal, clear localStorage and reset state
    if (previousStatus !== 'normal' && status === 'normal') {
      localStorage.removeItem(DISMISSAL_KEY)
      hasTriggeredCleanupRef.current = false
      // This setState is acceptable as it's conditional on external status change
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsDismissed(false)
    }

    // Auto-trigger cleanup at critical threshold (AC 5)
    if (
      status === 'critical' &&
      autoTriggerCleanup &&
      !hasTriggeredCleanupRef.current &&
      onTriggerCleanup
    ) {
      hasTriggeredCleanupRef.current = true
      onTriggerCleanup()
    }

    // Update previous status ref
    previousStatusRef.current = status
  }, [status, autoTriggerCleanup, onTriggerCleanup])

  // Handle dismiss
  const handleDismiss = useCallback(() => {
    setIsDismissed(true)
    localStorage.setItem(DISMISSAL_KEY, Date.now().toString())
  }, [])

  // Don't show if:
  // - Storage API not available
  // - Status is normal
  // - Banner is dismissed (for warning only, critical cannot be dismissed)
  if (!isStorageApiAvailable) {
    return null
  }

  if (status === 'normal') {
    return null
  }

  // Warning can be dismissed, critical cannot
  if (status === 'warning' && isDismissed) {
    return null
  }

  // Styling based on status
  const isWarning = status === 'warning'
  const isCritical = status === 'critical'

  const bgColor = isWarning ? 'bg-yellow-50' : 'bg-red-50'
  const borderColor = isWarning ? 'border-yellow-200' : 'border-red-200'
  const textColor = isWarning ? 'text-yellow-800' : 'text-red-800'
  const iconColor = isWarning ? 'text-yellow-500' : 'text-red-500'

  return (
    <div
      className={`${bgColor} ${borderColor} border rounded-lg p-4 mb-4`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        {/* Warning/Error icon */}
        <div className={`flex-shrink-0 ${iconColor}`}>
          {isWarning ? <WarningIcon /> : <AlertIcon />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className={`text-sm font-medium ${textColor}`}>
            {isWarning
              ? 'Storage almost full - cleanup recommended'
              : 'Storage critically low - cleanup required'}
          </h3>

          <p className={`mt-1 text-sm ${textColor} opacity-80`}>
            You&apos;re using {formatBytes(usage)} of {formatBytes(quota)} ({percentage.toFixed(1)}
            %).
            {isWarning
              ? ' Consider cleaning up old emails to free space.'
              : ' Email sync may fail if storage runs out.'}
          </p>

          {/* Action buttons */}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant={isCritical ? 'destructive' : 'default'}
              size="sm"
              onClick={onManageStorage}
            >
              Manage Storage
            </Button>

            {/* Only show dismiss for warning, not critical */}
            {isWarning && (
              <Button variant="ghost" size="sm" onClick={handleDismiss}>
                Dismiss for 24 hours
              </Button>
            )}
          </div>
        </div>

        {/* Close button for warning only */}
        {isWarning && (
          <button
            onClick={handleDismiss}
            className={`flex-shrink-0 ${textColor} opacity-50 hover:opacity-100`}
            aria-label="Dismiss warning"
          >
            <XIcon />
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Warning icon (triangle with exclamation)
 */
function WarningIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  )
}

/**
 * Alert/Error icon (circle with exclamation)
 */
function AlertIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  )
}

/**
 * X icon for close button
 */
function XIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}
