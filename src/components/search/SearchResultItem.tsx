/**
 * SearchResultItem Component
 *
 * Story 2.5: Local Full-Text Search
 * Task 6.3: Create SearchResultItem with highlighted matches and preview snippet
 *
 * Individual search result with sender, subject, and body snippet highlighting.
 */

import React, { memo } from 'react'
import { cn } from '@shared/utils/cn'
import { HighlightedText } from './HighlightedText'
import type { EnrichedSearchResult } from '@/services/search'

export interface SearchResultItemProps {
  /** Search result with email and highlights */
  result: EnrichedSearchResult
  /** Whether this item is selected/highlighted */
  isSelected?: boolean
  /** Called when item is clicked */
  onClick?: (emailId: string) => void
  /** Additional className */
  className?: string
}

/**
 * Format timestamp to readable date
 */
function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  if (diffDays === 1) {
    return 'Yesterday'
  }
  if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' })
  }
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * SearchResultItem - Individual search result display
 *
 * Features:
 * - Highlighted subject line
 * - Highlighted body snippet with context
 * - Sender display with optional highlighting
 * - Selection state
 */
export const SearchResultItem = memo(function SearchResultItem({
  result,
  isSelected = false,
  onClick,
  className,
}: SearchResultItemProps) {
  const { email, highlights, score } = result
  const isUnread = !email.read

  const handleClick = () => {
    onClick?.(email.id)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick?.(email.id)
    }
  }

  // Get sender display
  const senderDisplay = highlights.from || email.from?.name || email.from?.email || 'Unknown'
  const subjectDisplay = highlights.subject || email.subject || '(No subject)'
  const snippetDisplay = highlights.body || email.snippet || ''

  return (
    <div
      role="option"
      aria-selected={isSelected}
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'flex flex-col gap-1 p-3 cursor-pointer transition-colors',
        'border-b border-slate-200',
        'hover:bg-slate-50',
        isSelected && 'bg-cyan-50',
        !isUnread && !isSelected && 'bg-slate-50/50',
        className
      )}
    >
      {/* Top row: Sender and Date */}
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            'text-sm truncate flex-1',
            isUnread ? 'font-semibold text-slate-900' : 'text-slate-600'
          )}
        >
          <HighlightedText text={senderDisplay} truncate />
        </span>
        <span className="text-xs text-slate-500 flex-shrink-0">{formatDate(email.timestamp)}</span>
      </div>

      {/* Subject line with highlights */}
      <div className={cn('text-sm', isUnread ? 'font-medium text-slate-900' : 'text-slate-700')}>
        <HighlightedText text={subjectDisplay} truncate />
      </div>

      {/* Body snippet with highlights */}
      {snippetDisplay && (
        <div className="text-xs text-slate-500">
          <HighlightedText text={snippetDisplay} truncate maxLines={2} />
        </div>
      )}

      {/* Indicators row */}
      <div className="flex items-center gap-2 mt-0.5">
        {/* Unread indicator */}
        {isUnread && <div className="w-2 h-2 rounded-full bg-cyan-500" title="Unread" />}

        {/* Starred indicator */}
        {email.starred && <span className="text-yellow-500 text-xs">&#9733;</span>}

        {/* Attachment indicator */}
        {email.attachments && email.attachments.length > 0 && (
          <span
            className="text-slate-400 text-xs"
            title={`${email.attachments.length} attachment(s)`}
          >
            &#128206;
          </span>
        )}

        {/* Relevance score (debug info, hidden by default) */}
        {import.meta.env.DEV && (
          <span className="text-slate-300 text-[10px] ml-auto">score: {score.toFixed(2)}</span>
        )}
      </div>
    </div>
  )
})
