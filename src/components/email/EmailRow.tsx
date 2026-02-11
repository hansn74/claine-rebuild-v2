/**
 * EmailRow Component
 * Memoized row component for virtualized email list
 *
 * AC 4: Dynamic row heights supported (varying email preview lengths)
 * AC 3: Contributes to 60 FPS scrolling through React.memo optimization
 *
 * Story 2.14: Apply Attributes to Emails - UI & Interaction
 * Task 6: Display attribute tags inline in inbox list
 *
 * Story 2.17: UX Design System
 * - 48px compact row height
 * - Cyan selection states
 * - Slate color palette
 */

import { memo, useMemo, useCallback, useState, MouseEvent, DragEvent } from 'react'
import { cn } from '@shared/utils/cn'
import { AttributeTagList } from './attributes'
import { PriorityBadge } from './PriorityBadge'
import { PriorityContextMenu } from './PriorityContextMenu'
import { useSelectionStore } from '@/store/selectionStore'
import type { EmailDocument } from '@/services/database/schemas/email.schema'
import type { Priority } from '@/services/ai/priorityDisplay'

interface EmailRowProps {
  email: EmailDocument
  isSelected?: boolean
  onClick?: () => void
  draggable?: boolean
}

/**
 * Format timestamp to readable date
 * Same logic as EmailListItem for consistency
 */
function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  // Today: show time
  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  // Yesterday
  if (diffDays === 1) {
    return 'Yesterday'
  }

  // This week: show day name
  if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' })
  }

  // This year: show month and day
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }

  // Older: show full date
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * Get sender display name or email
 */
function getSenderDisplay(email: EmailDocument): string {
  if (email.from.name && email.from.name.trim()) {
    return email.from.name
  }
  return email.from.email
}

/**
 * Memoized email row for performance optimization
 * Only re-renders when email data, selection, or click handler changes
 *
 * AC 3: React.memo prevents unnecessary re-renders during scroll
 */
export const EmailRow = memo(function EmailRow({
  email,
  isSelected = false,
  onClick,
  draggable = false,
}: EmailRowProps) {
  const isUnread = !email.read
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

  // Multi-selection state from selection store
  // Use threadId for consistency with selectedEmailId in emailStore
  const selectionId = email.threadId || email.id
  const selectedIds = useSelectionStore((state) => state.selectedIds)
  const isChecked = selectedIds.has(selectionId)
  const selectMode = useSelectionStore((state) => state.selectMode)
  const toggleSelect = useSelectionStore((state) => state.toggleSelect)

  // Handle checkbox click without triggering row click
  const handleCheckboxClick = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation()
      toggleSelect(selectionId)
    },
    [selectionId, toggleSelect]
  )

  // Build accessible label for screen readers
  const ariaLabel = `${isUnread ? 'Unread: ' : ''}${getSenderDisplay(email)} - ${email.subject || '(No subject)'}`

  // Context menu handler
  const handleContextMenu = useCallback((e: MouseEvent) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }, [])

  const handleContextMenuClose = useCallback(() => {
    setContextMenu(null)
  }, [])

  const handleContextMenuPriorityChange = useCallback((_newPriority: Priority) => {
    setContextMenu(null)
  }, [])

  // Drag handlers for priority DnD
  const handleDragStart = useCallback(
    (e: DragEvent) => {
      e.dataTransfer.setData('text/plain', email.id)
      e.dataTransfer.effectAllowed = 'move'
    },
    [email.id]
  )

  // Check if email has any non-null attributes for display (avoid rendering empty TagList)
  const hasAttributes = useMemo(() => {
    if (!email.attributes) return false
    return Object.values(email.attributes).some((v) => v !== null && v !== undefined)
  }, [email.attributes])

  return (
    <>
      <div
        role="button"
        tabIndex={isSelected ? 0 : -1}
        onClick={onClick}
        onContextMenu={handleContextMenu}
        draggable={draggable}
        onDragStart={draggable ? handleDragStart : undefined}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onClick?.()
          }
        }}
        aria-label={ariaLabel}
        aria-pressed={isSelected}
        className={cn(
          // Base: 48px height, compact padding (UX spec)
          'group h-12 flex items-center gap-3 py-2 px-3',
          'border-b border-slate-200 cursor-pointer transition-colors',
          // Remove browser focus outline
          'outline-none focus:outline-none',
          // Hover state
          'hover:bg-slate-50',
          // Background based on read state
          !isUnread && !isSelected && !isChecked && 'bg-slate-50/50',
          isUnread && !isSelected && !isChecked && 'bg-white',
          // Selection state: cyan border left (UX spec)
          isSelected && 'bg-cyan-50 border-l-4 border-l-cyan-500',
          // Multi-select checked state
          isChecked && !isSelected && 'bg-cyan-50/50'
        )}
      >
        {/* Selection checkbox - visible on hover or when in select mode */}
        <div
          className={cn(
            'w-5 flex-shrink-0 flex items-center justify-center',
            // Show checkbox on hover or when in select mode
            !selectMode && !isChecked && 'opacity-0 group-hover:opacity-100',
            (selectMode || isChecked) && 'opacity-100'
          )}
        >
          <input
            type="checkbox"
            checked={isChecked}
            onClick={handleCheckboxClick}
            onChange={() => {}} // Click handler manages state
            className="h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
            aria-label={`Select ${email.subject || 'email'}`}
          />
        </div>

        {/* Unread indicator dot */}
        <div className="w-2 flex-shrink-0">
          {isUnread && <div className="w-2 h-2 rounded-full bg-cyan-500" title="Unread" />}
        </div>

        {/* Sender - wider for readability */}
        <span
          className={cn(
            'w-36 flex-shrink-0 text-sm truncate',
            isUnread ? 'font-semibold text-slate-900' : 'text-slate-600'
          )}
          title={getSenderDisplay(email)}
        >
          {getSenderDisplay(email)}
        </span>

        {/* Subject - truncates with ellipsis, fixed width */}
        <span
          className={cn(
            'w-48 flex-shrink-0 text-sm truncate',
            isUnread ? 'font-semibold text-slate-900' : 'text-slate-700'
          )}
          title={email.subject || '(No subject)'}
        >
          {email.subject || '(No subject)'}
        </span>

        {/* Snippet - fills remaining space, truncates */}
        <span
          className="flex-1 min-w-0 text-sm text-slate-500 truncate"
          title={email.snippet || ''}
        >
          {email.snippet || ''}
        </span>

        {/* Indicators: priority, attributes, attachments, starred */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Priority badge (Story 3.3, 3.6) */}
          {email.aiMetadata?.priority && (
            <PriorityBadge
              priority={email.aiMetadata.priority}
              aiMetadata={email.aiMetadata}
              emailId={email.id}
            />
          )}

          {/* Attribute tags (Story 2.14) */}
          {hasAttributes && (
            <AttributeTagList
              attributes={email.attributes}
              showRemove={false}
              maxTags={2}
              size="sm"
            />
          )}

          {/* Attachment indicator */}
          {email.attachments && email.attachments.length > 0 && (
            <span
              className="text-slate-400 text-xs"
              title={`${email.attachments.length} attachment(s)`}
            >
              📎
            </span>
          )}

          {/* Starred indicator */}
          {email.starred && (
            <span className="text-amber-400 text-sm" title="Starred">
              ★
            </span>
          )}
        </div>

        {/* Date - fixed width for alignment */}
        <span className="w-16 text-xs text-slate-500 text-right flex-shrink-0">
          {formatDate(email.timestamp)}
        </span>
      </div>
      {contextMenu && (
        <PriorityContextMenu
          emailId={email.id}
          currentPriority={email.aiMetadata?.priority as Priority | undefined}
          position={contextMenu}
          onClose={handleContextMenuClose}
          onPriorityChange={handleContextMenuPriorityChange}
        />
      )}
    </>
  )
})
