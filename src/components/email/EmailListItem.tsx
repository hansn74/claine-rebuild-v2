/**
 * EmailListItem Component
 * Displays a single email in the email list
 *
 * AC1: Displays sender, subject, date, read/unread status
 * AC3: Unread emails visually distinguished (bold text)
 * AC4: Clickable to select/view email
 *
 * Story 2.10: Performance Optimization
 * Task 3.2: React.memo with custom comparison for efficient re-renders
 *
 * Story 2.17: UX Design System
 * - 48px compact row height
 * - Cyan selection states
 * - 8px vertical, 12px horizontal padding
 * - Confidence badges and AI chips support
 */

import React, { memo, useCallback } from 'react'
import { cn } from '@shared/utils/cn'
import type { EmailDocument } from '@/services/database/schemas/email.schema'

interface EmailListItemProps {
  email: EmailDocument
  isSelected?: boolean
  onClick?: () => void
  /** Optional AI confidence score (0-100) for priority badge */
  confidence?: number
  /** Optional AI chip label (e.g., "DRAFT READY", "AI") */
  aiChip?: string
}

/**
 * Format timestamp to readable date
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
 * Confidence Badge Component
 * Displays AI confidence level with color-coded pill
 * UX Spec: 🟢 High (>80), 🟡 Medium (50-80), 🔴 Low (<50)
 */
function ConfidenceBadge({ confidence }: { confidence: number }) {
  const level = confidence >= 80 ? 'high' : confidence >= 50 ? 'medium' : 'low'
  const colors = {
    high: 'bg-green-100 text-green-700',
    medium: 'bg-amber-100 text-amber-700',
    low: 'bg-red-100 text-red-700',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium',
        colors[level]
      )}
      title={`${confidence}% confidence`}
    >
      {confidence}%
    </span>
  )
}

/**
 * AI Chip Component
 * Displays AI-related status (e.g., "DRAFT READY", "AI")
 * UX Spec: Cyan background (#ECFEFF) with cyan text
 */
function AIChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-cyan-50 text-cyan-700">
      {label}
    </span>
  )
}

/**
 * Custom comparison function for React.memo
 * Only re-render when email data or selection actually changes
 */
function arePropsEqual(prevProps: EmailListItemProps, nextProps: EmailListItemProps): boolean {
  // Check selection change
  if (prevProps.isSelected !== nextProps.isSelected) return false

  // Check callback reference stability (should use useCallback in parent)
  if (prevProps.onClick !== nextProps.onClick) return false

  // Check AI-related props
  if (prevProps.confidence !== nextProps.confidence) return false
  if (prevProps.aiChip !== nextProps.aiChip) return false

  // Check email data - only compare fields that affect rendering
  const prevEmail = prevProps.email
  const nextEmail = nextProps.email

  return (
    prevEmail.id === nextEmail.id &&
    prevEmail.read === nextEmail.read &&
    prevEmail.starred === nextEmail.starred &&
    prevEmail.subject === nextEmail.subject &&
    prevEmail.snippet === nextEmail.snippet &&
    prevEmail.timestamp === nextEmail.timestamp &&
    prevEmail.from.email === nextEmail.from.email &&
    prevEmail.from.name === nextEmail.from.name &&
    prevEmail.attachments?.length === nextEmail.attachments?.length
  )
}

/**
 * Memoized EmailListItem component
 * Prevents unnecessary re-renders in virtualized lists
 *
 * UX Spec (Story 2.17):
 * - 48px compact row height
 * - 8px vertical, 12px horizontal padding
 * - Cyan selection state with left border
 * - Read/unread text weight difference
 */
export const EmailListItem = memo(function EmailListItem({
  email,
  isSelected = false,
  onClick,
  confidence,
  aiChip,
}: EmailListItemProps) {
  const isUnread = !email.read

  // Memoize keyboard handler
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        onClick?.()
      }
    },
    [onClick]
  )

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={cn(
        // Base: 48px height, compact padding (8px vertical, 12px horizontal)
        'h-12 flex items-center gap-3 py-2 px-3',
        'border-b border-slate-200 cursor-pointer transition-colors',
        // Hover state
        'hover:bg-slate-50',
        // Selection state: cyan border left (UX spec)
        isSelected && 'bg-cyan-50 border-l-4 border-l-cyan-500',
        // Read/unread background distinction
        isUnread && !isSelected && 'bg-white',
        !isUnread && !isSelected && 'bg-slate-50/50'
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

      {/* Indicators: AI chip, confidence badge, attachments, starred */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {/* AI Chip (Story 2.17: Task 4.3) */}
        {aiChip && <AIChip label={aiChip} />}

        {/* Confidence Badge (Story 2.17: Task 4.2) */}
        {confidence !== undefined && <ConfidenceBadge confidence={confidence} />}

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
}, arePropsEqual)
