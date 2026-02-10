/**
 * PriorityBadge Component
 *
 * Story 3.3: Priority Scoring Model
 * Task 2: Small badge for email rows showing AI-assigned priority
 *
 * Follows the AttributeTag pattern for consistency.
 */

import { memo } from 'react'
import { cn } from '@/utils/cn'
import { getPriorityDisplay, type Priority } from '@/services/ai/priorityDisplay'

export interface PriorityBadgeProps {
  priority: Priority | undefined | null
  className?: string
}

/**
 * Compact priority badge for email list rows.
 * Renders nothing when priority is undefined/null.
 */
export const PriorityBadge = memo(function PriorityBadge({
  priority,
  className,
}: PriorityBadgeProps) {
  const display = getPriorityDisplay(priority)
  if (!display) return null

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full text-xs px-1.5 py-0.5 font-medium',
        display.bgClass,
        display.textClass,
        className
      )}
      aria-label={`Priority: ${display.label}`}
      title={display.description}
    >
      {display.label}
    </span>
  )
})
