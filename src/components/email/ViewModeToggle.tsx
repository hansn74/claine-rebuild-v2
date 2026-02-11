/**
 * ViewModeToggle Component
 *
 * Story 3.4: Priority-Based Inbox View
 * Task 4: Icon button to toggle between chronological and priority view
 */

import { memo, useCallback } from 'react'
import { List, Layers } from 'lucide-react'
import { cn } from '@/utils/cn'
import { useViewModeStore } from '@/store/viewModeStore'
import { HoverTooltip } from '@/components/common/HoverTooltip'

export const ViewModeToggle = memo(function ViewModeToggle() {
  const viewMode = useViewModeStore((s) => s.viewMode)
  const toggleViewMode = useViewModeStore((s) => s.toggleViewMode)

  const handleClick = useCallback(() => {
    toggleViewMode()
  }, [toggleViewMode])

  const isPriority = viewMode === 'priority'
  const Icon = isPriority ? Layers : List
  const tooltip = isPriority ? 'Switch to chronological view' : 'Switch to priority view'

  return (
    <HoverTooltip content={tooltip}>
      <button
        type="button"
        onClick={handleClick}
        aria-label={tooltip}
        className={cn(
          'p-1 rounded transition-colors',
          isPriority
            ? 'text-cyan-600 bg-cyan-50 hover:bg-cyan-100'
            : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
        )}
      >
        <Icon className="h-4 w-4" />
      </button>
    </HoverTooltip>
  )
})
