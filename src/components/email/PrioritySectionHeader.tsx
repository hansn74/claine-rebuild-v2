/**
 * PrioritySectionHeader Component
 *
 * Story 3.4: Priority-Based Inbox View
 * Task 3: Collapsible section header for priority groups
 *
 * Story 3.6: Manual Priority Adjustment & Feedback Loop
 * Task 5: Drop zone for drag-and-drop priority changes
 *
 * Follows the collapsible pattern from AttributeFilterPanel.tsx.
 */

import { memo, useCallback, useState, type KeyboardEvent, type DragEvent } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/utils/cn'
import { getPriorityDisplay, type Priority } from '@/services/ai/priorityDisplay'

export interface PrioritySectionHeaderProps {
  sectionKey: string
  priority: Priority | 'uncategorized'
  count: number
  isCollapsed: boolean
  onToggle: (sectionKey: string) => void
  onEmailDrop?: (emailId: string) => void
}

const UNCATEGORIZED_DISPLAY = {
  label: 'Uncategorized',
  dotClass: 'bg-slate-400',
  textClass: 'text-slate-600',
}

export const PrioritySectionHeader = memo(function PrioritySectionHeader({
  sectionKey,
  priority,
  count,
  isCollapsed,
  onToggle,
  onEmailDrop,
}: PrioritySectionHeaderProps) {
  const [isDragOver, setIsDragOver] = useState(false)

  const handleClick = useCallback(() => {
    onToggle(sectionKey)
  }, [onToggle, sectionKey])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onToggle(sectionKey)
      }
    },
    [onToggle, sectionKey]
  )

  const handleDragOver = useCallback(
    (e: DragEvent) => {
      if (!onEmailDrop) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      setIsDragOver(true)
    },
    [onEmailDrop]
  )

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault()
      setIsDragOver(false)
      if (!onEmailDrop) return
      const emailId = e.dataTransfer.getData('text/plain')
      if (emailId) {
        onEmailDrop(emailId)
      }
    },
    [onEmailDrop]
  )

  const display = priority === 'uncategorized' ? null : getPriorityDisplay(priority)
  const label = display?.label ?? UNCATEGORIZED_DISPLAY.label
  const dotColorClass = display ? `bg-${display.color}` : UNCATEGORIZED_DISPLAY.dotClass
  const textColorClass = display?.textClass ?? UNCATEGORIZED_DISPLAY.textClass

  const ChevronIcon = isCollapsed ? ChevronRight : ChevronDown

  return (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={!isCollapsed}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'flex items-center gap-2 h-9 px-3 cursor-pointer select-none',
        'bg-slate-50 border-b border-slate-200 hover:bg-slate-100 transition-colors',
        isDragOver && 'ring-2 ring-cyan-400 ring-inset bg-cyan-50'
      )}
    >
      <ChevronIcon className="h-4 w-4 text-slate-400 flex-shrink-0" />
      <span className={cn('h-2.5 w-2.5 rounded-full flex-shrink-0', dotColorClass)} />
      <span className={cn('text-sm font-medium', textColorClass)}>{label}</span>
      <span className="text-xs text-slate-400 ml-1">({count})</span>
    </div>
  )
})
