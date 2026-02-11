/**
 * PriorityContextMenu Component
 *
 * Story 3.6: Manual Priority Adjustment & Feedback Loop
 * Task 4: Right-click context menu for priority changes
 *
 * Portal-based menu following the PriorityExplainPopover pattern.
 * Closes on click-outside, Escape, or selection.
 * Supports keyboard navigation with arrow keys.
 */

import { memo, useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Check } from 'lucide-react'
import { cn } from '@/utils/cn'
import { getPriorityDisplay, type Priority } from '@/services/ai/priorityDisplay'
import { priorityFeedbackService } from '@/services/ai/priorityFeedbackService'

export interface PriorityContextMenuProps {
  emailId: string
  currentPriority: Priority | undefined
  position: { x: number; y: number }
  onClose: () => void
  onPriorityChange?: (newPriority: Priority) => void
}

const PRIORITY_OPTIONS: Priority[] = ['high', 'medium', 'low', 'none']
const MENU_WIDTH = 200
const MENU_ITEM_HEIGHT = 32
const MENU_HEADER_HEIGHT = 28
const MENU_HEIGHT = MENU_HEADER_HEIGHT + PRIORITY_OPTIONS.length * MENU_ITEM_HEIGHT + 8

export const PriorityContextMenu = memo(function PriorityContextMenu({
  emailId,
  currentPriority,
  position,
  onClose,
  onPriorityChange,
}: PriorityContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [focusedIndex, setFocusedIndex] = useState(-1)

  // Compute position with viewport clamping
  const menuPosition = useMemo(() => {
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 1024
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 768

    let x = position.x
    let y = position.y

    if (x + MENU_WIDTH > viewportWidth - 8) {
      x = viewportWidth - MENU_WIDTH - 8
    }
    if (y + MENU_HEIGHT > viewportHeight - 8) {
      y = viewportHeight - MENU_HEIGHT - 8
    }

    x = Math.max(8, x)
    y = Math.max(8, y)

    return { x, y }
  }, [position])

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Close on click outside
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [onClose])

  const handleSelect = useCallback(
    async (priority: Priority) => {
      if (priority === currentPriority) {
        onClose()
        return
      }
      await priorityFeedbackService.recordOverride(emailId, priority)
      onPriorityChange?.(priority)
      onClose()
    },
    [emailId, currentPriority, onPriorityChange, onClose]
  )

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setFocusedIndex((prev) => Math.min(prev + 1, PRIORITY_OPTIONS.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setFocusedIndex((prev) => Math.max(prev - 1, 0))
          break
        case 'Enter':
          e.preventDefault()
          if (focusedIndex >= 0 && focusedIndex < PRIORITY_OPTIONS.length) {
            handleSelect(PRIORITY_OPTIONS[focusedIndex])
          }
          break
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [focusedIndex, handleSelect])

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label="Set email priority"
      className={cn(
        'fixed z-[9999] rounded-lg shadow-lg border border-slate-200 bg-white py-1',
        'text-sm animate-in fade-in-0 zoom-in-95 duration-100'
      )}
      style={{
        top: menuPosition.y,
        left: menuPosition.x,
        width: MENU_WIDTH,
      }}
    >
      <div className="px-3 py-1 text-xs font-medium text-slate-400 select-none">
        Set priority to
      </div>
      {PRIORITY_OPTIONS.map((p, index) => {
        const pDisplay = getPriorityDisplay(p)
        if (!pDisplay) return null
        const isCurrent = p === currentPriority
        const isFocused = index === focusedIndex

        return (
          <button
            key={p}
            type="button"
            role="menuitem"
            onClick={() => handleSelect(p)}
            onMouseEnter={() => setFocusedIndex(index)}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors',
              isFocused && 'bg-slate-100',
              !isFocused && 'hover:bg-slate-50'
            )}
          >
            <span
              className={cn('w-2 h-2 rounded-full flex-shrink-0', `bg-${pDisplay.color}`)}
              aria-hidden="true"
            />
            <span className="flex-1 text-slate-700">{pDisplay.label}</span>
            {isCurrent && <Check className="w-4 h-4 text-slate-400 flex-shrink-0" />}
          </button>
        )
      })}
    </div>,
    document.body
  )
})
