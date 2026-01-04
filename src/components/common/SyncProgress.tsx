/**
 * SyncProgress Component
 *
 * Story 2.12: Empty States & Onboarding UX
 * Task 3.2-3.5: Sync progress component with estimated time
 *
 * Shows sync status with progress bar and estimated time remaining.
 *
 * Usage:
 *   <SyncProgress current={250} total={1000} />
 *   <SyncProgress isIndeterminate message="Starting sync..." />
 */

import { RefreshCw } from 'lucide-react'
import { cn } from '@shared/utils/cn'

export interface SyncProgressProps {
  /** Current number of items synced */
  current?: number
  /** Total number of items to sync */
  total?: number
  /** Whether the progress is indeterminate */
  isIndeterminate?: boolean
  /** Custom message to display */
  message?: string
  /** Estimated time remaining in seconds */
  estimatedSeconds?: number
  /** Additional className */
  className?: string
  /** Whether to show compact version */
  compact?: boolean
}

/**
 * Format seconds into human-readable time
 */
function formatTimeRemaining(seconds: number): string {
  if (seconds < 60) {
    return `${Math.ceil(seconds)} seconds`
  }
  const minutes = Math.ceil(seconds / 60)
  if (minutes === 1) {
    return '1 minute'
  }
  return `${minutes} minutes`
}

/**
 * Calculate estimated time remaining based on sync rate
 */
export function calculateEstimatedTime(
  current: number,
  total: number,
  elapsedMs: number
): number | null {
  if (current === 0 || elapsedMs === 0) {
    return null
  }

  const rate = current / (elapsedMs / 1000) // items per second
  const remaining = total - current
  return remaining / rate
}

/**
 * SyncProgress - Display sync progress with estimated time
 *
 * Features:
 * - Determinate and indeterminate progress modes
 * - Estimated time remaining calculation
 * - Animated progress bar
 * - Compact variant for inline use
 */
export function SyncProgress({
  current,
  total,
  isIndeterminate = false,
  message,
  estimatedSeconds,
  className,
  compact = false,
}: SyncProgressProps) {
  const progress =
    !isIndeterminate && current !== undefined && total !== undefined && total > 0
      ? Math.round((current / total) * 100)
      : null

  const displayMessage =
    message ??
    (!isIndeterminate && current !== undefined && total !== undefined
      ? `Syncing emails... ${current.toLocaleString()}/${total.toLocaleString()}`
      : 'Syncing...')

  const timeEstimate =
    estimatedSeconds !== undefined && estimatedSeconds > 0
      ? formatTimeRemaining(estimatedSeconds)
      : null

  if (compact) {
    return (
      <div
        className={cn('flex items-center gap-2 text-sm text-slate-600', className)}
        role="status"
        aria-live="polite"
      >
        <RefreshCw className="w-4 h-4 animate-spin text-cyan-500" />
        <span>{displayMessage}</span>
        {progress !== null && <span className="text-slate-400">({progress}%)</span>}
      </div>
    )
  }

  return (
    <div
      className={cn('w-full max-w-md', className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      {/* Message and icon */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-cyan-50 flex items-center justify-center">
          <RefreshCw className="w-5 h-5 animate-spin text-cyan-500" />
        </div>
        <div className="flex-1">
          <p className="font-medium text-slate-900">{displayMessage}</p>
          {timeEstimate && <p className="text-sm text-slate-500">Estimated time: {timeEstimate}</p>}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        {isIndeterminate || progress === null ? (
          <div
            className="h-full bg-cyan-500 rounded-full animate-pulse"
            style={{ width: '100%' }}
          />
        ) : (
          <div
            className="h-full bg-cyan-500 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        )}
      </div>

      {/* Progress percentage */}
      {progress !== null && <p className="text-xs text-slate-400 mt-2 text-right">{progress}%</p>}
    </div>
  )
}

/**
 * ProgressBar - Standalone progress bar component
 *
 * A simpler version for use in other contexts.
 */
export interface ProgressBarProps {
  /** Progress value 0-100 */
  value?: number
  /** Whether indeterminate */
  isIndeterminate?: boolean
  /** Additional className */
  className?: string
  /** Height variant */
  size?: 'sm' | 'md' | 'lg'
}

export function ProgressBar({
  value,
  isIndeterminate = false,
  className,
  size = 'md',
}: ProgressBarProps) {
  const heights = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  }

  return (
    <div
      className={cn('bg-slate-100 rounded-full overflow-hidden', heights[size], className)}
      role="progressbar"
      aria-valuenow={isIndeterminate ? undefined : value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {isIndeterminate ? (
        <div
          className={cn(
            'h-full bg-cyan-500 rounded-full',
            'animate-[indeterminate_1.5s_ease-in-out_infinite]'
          )}
          style={{ width: '40%' }}
        />
      ) : (
        <div
          className="h-full bg-cyan-500 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${value ?? 0}%` }}
        />
      )}
    </div>
  )
}

export default SyncProgress
