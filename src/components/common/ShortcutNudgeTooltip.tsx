/**
 * ShortcutNudgeTooltip Component
 *
 * Story 2.23: Keyboard Shortcut Discoverability
 * Task 5.7: Create ShortcutNudgeTooltip component
 *
 * One-time tooltip that suggests using a keyboard shortcut
 * after repeated mouse usage. Auto-dismisses after 5 seconds.
 */

import { memo, useEffect, useState } from 'react'
import { Lightbulb, X } from 'lucide-react'
import { cn } from '@/utils/cn'

const AUTO_DISMISS_MS = 5000

export interface ShortcutNudgeTooltipProps {
  /** The shortcut key to suggest (e.g., "e") */
  shortcutKey: string
  /** Action description (e.g., "archive") */
  actionName: string
  /** Called when the tooltip is dismissed */
  onDismiss: () => void
  /** Position relative to trigger element */
  position?: 'top' | 'bottom' | 'left' | 'right'
  /** Additional CSS classes */
  className?: string
}

/**
 * ShortcutNudgeTooltip - Suggests keyboard shortcut after mouse usage
 *
 * Usage:
 * ```tsx
 * {showNudge && (
 *   <ShortcutNudgeTooltip
 *     shortcutKey="e"
 *     actionName="archive"
 *     onDismiss={() => markNudgeShown('archive')}
 *   />
 * )}
 * ```
 */
export const ShortcutNudgeTooltip = memo(function ShortcutNudgeTooltip({
  shortcutKey,
  actionName,
  onDismiss,
  position = 'top',
  className,
}: ShortcutNudgeTooltipProps) {
  const [isVisible, setIsVisible] = useState(true)

  // Auto-dismiss after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false)
      onDismiss()
    }, AUTO_DISMISS_MS)

    return () => clearTimeout(timer)
  }, [onDismiss])

  // Handle manual dismiss
  const handleDismiss = () => {
    setIsVisible(false)
    onDismiss()
  }

  if (!isVisible) {
    return null
  }

  const positionClasses = {
    top: 'bottom-full mb-2 left-1/2 -translate-x-1/2',
    bottom: 'top-full mt-2 left-1/2 -translate-x-1/2',
    left: 'right-full mr-2 top-1/2 -translate-y-1/2',
    right: 'left-full ml-2 top-1/2 -translate-y-1/2',
  }

  return (
    <div
      className={cn(
        'absolute z-50 px-3 py-2 rounded-lg shadow-lg',
        'bg-slate-800 text-white text-sm',
        'animate-in fade-in zoom-in-95 duration-200',
        'flex items-center gap-2 whitespace-nowrap',
        positionClasses[position],
        className
      )}
      role="tooltip"
    >
      <Lightbulb className="w-4 h-4 text-yellow-400 flex-shrink-0" />
      <span>
        Tip: press{' '}
        <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-xs font-mono">{shortcutKey}</kbd> to{' '}
        {actionName} faster
      </span>
      <button
        type="button"
        onClick={handleDismiss}
        className="ml-1 p-0.5 hover:bg-slate-700 rounded transition-colors"
        aria-label="Dismiss tip"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
})
