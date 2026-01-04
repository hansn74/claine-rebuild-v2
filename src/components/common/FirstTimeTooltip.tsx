/**
 * FirstTimeTooltip Component
 *
 * Story 2.12: Empty States & Onboarding UX
 * Task 5.2, 5.4-5.6: First-time tooltip with dismiss functionality
 *
 * Shows helpful hints for first-time users that can be dismissed.
 *
 * Usage:
 *   <FirstTimeTooltip
 *     id="keyboard-shortcuts"
 *     title="Quick tip"
 *     description="Press ? to see keyboard shortcuts"
 *   >
 *     <button>?</button>
 *   </FirstTimeTooltip>
 */

import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react'
import { X, Lightbulb } from 'lucide-react'
import { cn } from '@shared/utils/cn'
import { useFirstTimeTooltip, type TooltipId } from '@/hooks/useFirstTimeTooltip'

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right'

export interface FirstTimeTooltipProps {
  /** Unique tooltip ID for persistence */
  id: TooltipId
  /** Content title */
  title?: string
  /** Content description */
  description: string
  /** Keyboard shortcut to highlight */
  shortcutKey?: string
  /** Position relative to target */
  position?: TooltipPosition
  /** Target element */
  children: ReactNode
  /** Whether tooltip is enabled */
  enabled?: boolean
  /** Additional className for tooltip */
  className?: string
  /** Delay before showing (ms) */
  showDelay?: number
  /** Callback when dismissed */
  onDismiss?: () => void
}

/**
 * Position styles for tooltip
 */
const positionStyles: Record<TooltipPosition, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
}

/**
 * Arrow styles for tooltip
 */
const arrowStyles: Record<TooltipPosition, string> = {
  top: 'top-full left-1/2 -translate-x-1/2 border-t-slate-800',
  bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-slate-800',
  left: 'left-full top-1/2 -translate-y-1/2 border-l-slate-800',
  right: 'right-full top-1/2 -translate-y-1/2 border-r-slate-800',
}

/**
 * FirstTimeTooltip - Dismissible first-time user tooltip
 *
 * Features:
 * - Persists dismissal to localStorage
 * - Accessible focus management
 * - Multiple positioning options
 * - Keyboard shortcut highlighting
 * - Animation on appear
 */
export function FirstTimeTooltip({
  id,
  title,
  description,
  shortcutKey,
  position = 'bottom',
  children,
  enabled = true,
  className,
  showDelay = 500,
  onDismiss,
}: FirstTimeTooltipProps) {
  const { shouldShow, dismiss } = useFirstTimeTooltip(id)
  const [isVisible, setIsVisible] = useState(false)
  const [hasShown, setHasShown] = useState(false)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Show tooltip after delay
  useEffect(() => {
    if (!enabled || !shouldShow || hasShown) return

    const timer = setTimeout(() => {
      setIsVisible(true)
      setHasShown(true)
    }, showDelay)

    return () => clearTimeout(timer)
  }, [enabled, shouldShow, showDelay, hasShown])

  const handleDismiss = useCallback(() => {
    setIsVisible(false)
    dismiss()
    onDismiss?.()
  }, [dismiss, onDismiss])

  // Handle Escape key
  useEffect(() => {
    if (!isVisible) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleDismiss()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isVisible, handleDismiss])

  if (!enabled || !shouldShow) {
    return <>{children}</>
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      {children}

      {isVisible && (
        <div
          ref={tooltipRef}
          className={cn(
            'absolute z-50 w-64 p-3 rounded-lg shadow-lg',
            'bg-slate-800 text-white',
            'animate-in fade-in-0 zoom-in-95 duration-200',
            positionStyles[position],
            className
          )}
          role="tooltip"
          aria-live="polite"
        >
          {/* Arrow */}
          <div
            className={cn('absolute w-0 h-0 border-4 border-transparent', arrowStyles[position])}
          />

          {/* Content */}
          <div className="flex items-start gap-2">
            <Lightbulb
              className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div className="flex-1">
              {title && <h4 className="font-medium text-sm mb-1">{title}</h4>}
              <p className="text-sm text-slate-300">{description}</p>
              {shortcutKey && (
                <kbd className="inline-block mt-2 px-2 py-1 text-xs font-mono bg-slate-700 rounded">
                  {shortcutKey}
                </kbd>
              )}
            </div>
            <button
              onClick={handleDismiss}
              className="p-1 text-slate-400 hover:text-white rounded transition-colors"
              aria-label="Dismiss tip"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Got it button */}
          <button
            onClick={handleDismiss}
            className="w-full mt-3 px-3 py-1.5 text-xs font-medium bg-slate-700 hover:bg-slate-600 rounded transition-colors"
          >
            Got it
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * Predefined tooltips for common features
 */
export const FeatureTooltips = {
  KeyboardShortcuts: (props: Omit<FirstTimeTooltipProps, 'id' | 'description'>) => (
    <FirstTimeTooltip
      id="keyboard-shortcuts"
      title="Quick tip"
      description="Press ? to see all keyboard shortcuts"
      shortcutKey="?"
      {...props}
    />
  ),
  Search: (props: Omit<FirstTimeTooltipProps, 'id' | 'description'>) => (
    <FirstTimeTooltip
      id="search"
      title="Quick tip"
      description="Press / to quickly search your emails"
      shortcutKey="/"
      {...props}
    />
  ),
  Archive: (props: Omit<FirstTimeTooltipProps, 'id' | 'description'>) => (
    <FirstTimeTooltip
      id="archive"
      title="Quick tip"
      description="Press e to archive the selected email"
      shortcutKey="e"
      {...props}
    />
  ),
  Compose: (props: Omit<FirstTimeTooltipProps, 'id' | 'description'>) => (
    <FirstTimeTooltip
      id="compose"
      title="Quick tip"
      description="Press c to compose a new email"
      shortcutKey="c"
      {...props}
    />
  ),
}

export default FirstTimeTooltip
