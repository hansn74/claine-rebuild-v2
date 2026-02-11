/**
 * PriorityExplainPopover Component
 *
 * Story 3.5: Explainability UI — "Why This Priority?"
 * Task 1: Portal-based popover showing AI reasoning for priority assignment
 *
 * Story 3.6: Manual Priority Adjustment & Feedback Loop
 * Task 3: Priority picker buttons + "Reset to AI" link
 *
 * Lightweight popover using createPortal, positioned relative to trigger.
 * Closes on Escape key or click outside.
 */

import { memo, useEffect, useRef, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/utils/cn'
import { getPriorityDisplay, isUserOverride, type Priority } from '@/services/ai/priorityDisplay'
import { priorityFeedbackService } from '@/services/ai/priorityFeedbackService'
import { clearPriorityOverride } from '@/services/ai/priorityOverride'
import type { EmailDocument } from '@/services/database/schemas/email.schema'

export interface PriorityExplainPopoverProps {
  aiMetadata: NonNullable<EmailDocument['aiMetadata']>
  priority: Priority
  triggerRect: DOMRect
  onClose: () => void
  emailId: string
  onPriorityChange?: (newPriority: Priority) => void
}

const POPOVER_ESTIMATED_HEIGHT = 200
const POPOVER_WIDTH = 300

const PRIORITY_OPTIONS: Priority[] = ['high', 'medium', 'low', 'none']

/**
 * Format a timestamp as a relative time string (e.g., "2 hours ago")
 */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diffMs = now - timestamp
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSeconds < 60) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
  if (diffDays < 30) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
  return new Date(timestamp).toLocaleDateString()
}

/**
 * Portal-based popover showing AI reasoning for a priority assignment.
 * Positions below the trigger element, flipping above if near viewport bottom.
 */
export const PriorityExplainPopover = memo(function PriorityExplainPopover({
  aiMetadata,
  priority,
  triggerRect,
  onClose,
  emailId,
  onPriorityChange,
}: PriorityExplainPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null)

  const display = getPriorityDisplay(priority)
  const userOverride = isUserOverride(aiMetadata)

  // Compute position from triggerRect (pure derivation, no side effects)
  const position = useMemo(() => {
    const gap = 4
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1024

    let top = triggerRect.bottom + gap
    if (top + POPOVER_ESTIMATED_HEIGHT > viewportHeight - 8) {
      top = triggerRect.top - POPOVER_ESTIMATED_HEIGHT - gap
    }

    let left = triggerRect.left + triggerRect.width / 2 - POPOVER_WIDTH / 2
    left = Math.max(8, Math.min(left, viewportWidth - POPOVER_WIDTH - 8))

    return { top, left }
  }, [triggerRect])

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Close on click outside
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [onClose])

  const handlePrioritySelect = useCallback(
    async (newPriority: Priority) => {
      if (newPriority === priority) return
      await priorityFeedbackService.recordOverride(emailId, newPriority)
      onPriorityChange?.(newPriority)
      onClose()
    },
    [emailId, priority, onPriorityChange, onClose]
  )

  const handleResetToAI = useCallback(async () => {
    await clearPriorityOverride(emailId)
    onPriorityChange?.(priority)
    onClose()
  }, [emailId, priority, onPriorityChange, onClose])

  if (!display) return null

  const reasoning = userOverride
    ? 'You manually set this priority.'
    : aiMetadata.reasoning || 'No reasoning available.'

  return createPortal(
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="Priority explanation"
      className={cn(
        'fixed z-[9999] w-[300px] rounded-lg shadow-lg border border-slate-200 bg-white',
        'text-sm animate-in fade-in-0 zoom-in-95 duration-150'
      )}
      style={{ top: position.top, left: position.left }}
    >
      <div className="p-3 space-y-2">
        {/* Header: color dot + label + confidence */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={cn('w-2.5 h-2.5 rounded-full', `bg-${display.color}`)}
              aria-hidden="true"
            />
            <span className="font-medium text-slate-900">{display.label}</span>
          </div>
          <span
            className="text-xs font-medium text-slate-500 bg-slate-100 rounded-full px-2 py-0.5"
            aria-label={`Confidence: ${aiMetadata.confidence}%`}
          >
            {aiMetadata.confidence}%
          </span>
        </div>

        {/* Reasoning text */}
        <p className="text-slate-600 leading-relaxed">{reasoning}</p>

        {/* Priority picker */}
        <div className="pt-1 border-t border-slate-100">
          <p className="text-xs text-slate-400 mb-1.5">Change priority</p>
          <div className="flex gap-1" role="group" aria-label="Priority options">
            {PRIORITY_OPTIONS.map((p) => {
              const pDisplay = getPriorityDisplay(p)
              if (!pDisplay) return null
              const isCurrent = p === priority
              return (
                <button
                  key={p}
                  type="button"
                  disabled={isCurrent}
                  onClick={() => handlePrioritySelect(p)}
                  className={cn(
                    'flex-1 text-xs py-1 px-1.5 rounded font-medium transition-colors',
                    isCurrent
                      ? 'bg-slate-200 text-slate-400 cursor-default'
                      : `${pDisplay.bgClass} ${pDisplay.textClass} hover:opacity-80 cursor-pointer`
                  )}
                  aria-label={`Set priority to ${pDisplay.label}`}
                  aria-pressed={isCurrent}
                >
                  {pDisplay.label}
                </button>
              )
            })}
          </div>
          {userOverride && (
            <button
              type="button"
              onClick={handleResetToAI}
              className="mt-1.5 text-xs text-blue-500 hover:text-blue-700 hover:underline"
            >
              Reset to AI
            </button>
          )}
        </div>

        {/* Footer: timestamp + model */}
        <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-100">
          <span>Analyzed {formatRelativeTime(aiMetadata.processedAt)}</span>
          <span className="truncate ml-2 max-w-[120px]" title={aiMetadata.modelVersion}>
            {userOverride ? 'Manual' : aiMetadata.modelVersion}
          </span>
        </div>
      </div>
    </div>,
    document.body
  )
})
