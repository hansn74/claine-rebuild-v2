/**
 * PriorityBadge Component
 *
 * Story 3.3: Priority Scoring Model
 * Task 2: Small badge for email rows showing AI-assigned priority
 *
 * Story 3.5: Explainability UI — "Why This Priority?"
 * Task 2: Interactive badge that opens PriorityExplainPopover on click
 *
 * Follows the AttributeTag pattern for consistency.
 */

import { memo, useState, useCallback, type MouseEvent, type KeyboardEvent } from 'react'
import { cn } from '@/utils/cn'
import { getPriorityDisplay, type Priority } from '@/services/ai/priorityDisplay'
import { PriorityExplainPopover } from './PriorityExplainPopover'
import type { EmailDocument } from '@/services/database/schemas/email.schema'

export interface PriorityBadgeProps {
  priority: Priority | undefined | null
  aiMetadata?: EmailDocument['aiMetadata']
  className?: string
}

/**
 * Compact priority badge for email list rows.
 * Renders nothing when priority is undefined/null.
 * When aiMetadata is provided, becomes clickable and opens an explanation popover.
 */
export const PriorityBadge = memo(function PriorityBadge({
  priority,
  aiMetadata,
  className,
}: PriorityBadgeProps) {
  const display = getPriorityDisplay(priority)
  const [isOpen, setIsOpen] = useState(false)
  const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null)

  const isInteractive = !!aiMetadata

  const handleClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      if (!isInteractive) return
      e.stopPropagation()
      const rect = e.currentTarget.getBoundingClientRect()
      setTriggerRect(rect)
      setIsOpen((prev) => !prev)
    },
    [isInteractive]
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>) => {
      if (!isInteractive) return
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        e.stopPropagation()
        const rect = e.currentTarget.getBoundingClientRect()
        setTriggerRect(rect)
        setIsOpen((prev) => !prev)
      }
    },
    [isInteractive]
  )

  const handleClose = useCallback(() => {
    setIsOpen(false)
  }, [])

  if (!display) return null

  const ariaLabel = isInteractive
    ? `Priority: ${display.label}. Click for details`
    : `Priority: ${display.label}`

  const sharedClasses = cn(
    'inline-flex items-center rounded-full text-xs px-1.5 py-0.5 font-medium',
    display.bgClass,
    display.textClass,
    isInteractive && 'cursor-pointer hover:opacity-80',
    className
  )

  if (!isInteractive) {
    return (
      <span className={sharedClasses} aria-label={ariaLabel} title={display.description}>
        {display.label}
      </span>
    )
  }

  return (
    <>
      <button
        type="button"
        className={sharedClasses}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        title={display.description}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        {display.label}
      </button>
      {isOpen && triggerRect && priority && (
        <PriorityExplainPopover
          aiMetadata={aiMetadata}
          priority={priority}
          triggerRect={triggerRect}
          onClose={handleClose}
        />
      )}
    </>
  )
})
