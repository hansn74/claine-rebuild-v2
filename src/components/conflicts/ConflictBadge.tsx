/**
 * ConflictBadge Component
 * Shows pending conflicts indicator in the UI
 *
 * Features:
 * - Badge showing count of pending conflicts
 * - Visual indicator (warning color when conflicts exist)
 * - Click handler to open conflict list
 */

import { useConflictStore } from '@/store/conflictStore'

export interface ConflictBadgeProps {
  /** Called when badge is clicked */
  onClick?: () => void
  /** Show badge even when count is zero */
  showZero?: boolean
  /** Additional class names */
  className?: string
}

/**
 * ConflictBadge component
 * Displays count of pending conflicts
 */
export function ConflictBadge({ onClick, showZero = false, className = '' }: ConflictBadgeProps) {
  const pendingCount = useConflictStore((state) => state.getPendingCount())

  // Don't render if no conflicts and showZero is false
  if (pendingCount === 0 && !showZero) {
    return null
  }

  const hasConflicts = pendingCount > 0

  return (
    <button
      onClick={onClick}
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
        transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2
        ${
          hasConflicts
            ? 'bg-amber-100 text-amber-800 hover:bg-amber-200 focus:ring-amber-500'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 focus:ring-gray-500'
        }
        ${className}
      `}
      aria-label={`${pendingCount} sync conflicts pending`}
    >
      {hasConflicts && <WarningIcon />}
      <span>
        {pendingCount} {pendingCount === 1 ? 'Conflict' : 'Conflicts'}
      </span>
    </button>
  )
}

/**
 * Minimal conflict indicator (just the icon and count)
 * For use in tight spaces like toolbars
 */
export function ConflictIndicator({ onClick }: { onClick?: () => void }) {
  const pendingCount = useConflictStore((state) => state.getPendingCount())

  if (pendingCount === 0) {
    return null
  }

  return (
    <button
      onClick={onClick}
      className="relative p-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50 rounded-full"
      aria-label={`${pendingCount} sync conflicts pending - click to resolve`}
    >
      <WarningIcon className="w-5 h-5" />
      {/* Count badge */}
      <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-amber-600 rounded-full">
        {pendingCount > 9 ? '9+' : pendingCount}
      </span>
    </button>
  )
}

/**
 * Warning icon component
 */
function WarningIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  )
}
