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

import { memo, useMemo } from 'react'
import { cn } from '@shared/utils/cn'
import { AttributeTagList } from './attributes'
import type { EmailDocument } from '@/services/database/schemas/email.schema'

interface EmailRowProps {
  email: EmailDocument
  isSelected?: boolean
  /** Story 2.11: Whether this row is keyboard-focused (j/k navigation) */
  isFocused?: boolean
  onClick?: () => void
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
  isFocused = false,
  onClick,
}: EmailRowProps) {
  const isUnread = !email.read

  // Build accessible label for screen readers
  const ariaLabel = `${isUnread ? 'Unread: ' : ''}${getSenderDisplay(email)} - ${email.subject || '(No subject)'}`

  // Check if email has any non-null attributes for display (avoid rendering empty TagList)
  const hasAttributes = useMemo(() => {
    if (!email.attributes) return false
    return Object.values(email.attributes).some((v) => v !== null && v !== undefined)
  }, [email.attributes])

  return (
    <div
      role="button"
      tabIndex={isFocused ? 0 : -1}
      onClick={onClick}
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
        'h-12 flex items-center gap-3 py-2 px-3',
        'border-b border-slate-200 cursor-pointer transition-colors',
        // Hover state
        'hover:bg-slate-50',
        // Background based on read state
        !isUnread && !isSelected && !isFocused && 'bg-slate-50/50',
        isUnread && !isSelected && !isFocused && 'bg-white',
        // Selection state: cyan border left (UX spec)
        isSelected && 'bg-cyan-50 border-l-4 border-l-cyan-500',
        // Story 2.11: Focused state for keyboard navigation
        isFocused && !isSelected && 'ring-2 ring-cyan-400 ring-inset'
      )}
    >
      {/* Unread indicator dot */}
      <div className="w-2 flex-shrink-0">
        {isUnread && <div className="w-2 h-2 rounded-full bg-cyan-500" title="Unread" />}
      </div>

      {/* Sender - fixed width for alignment */}
      <span
        className={cn(
          'w-32 flex-shrink-0 text-sm truncate',
          isUnread ? 'font-semibold text-slate-900' : 'text-slate-600'
        )}
      >
        {getSenderDisplay(email)}
      </span>

      {/* Subject and snippet - flex grow */}
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <span
          className={cn(
            'text-sm truncate',
            isUnread ? 'font-medium text-slate-900' : 'text-slate-700'
          )}
        >
          {email.subject || '(No subject)'}
        </span>
        <span className="text-xs text-slate-400 truncate hidden sm:inline">
          — {email.snippet || ''}
        </span>
      </div>

      {/* Indicators: attributes, attachments, starred */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
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
  )
})
