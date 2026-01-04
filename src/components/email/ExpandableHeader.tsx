/**
 * ExpandableHeader Component
 *
 * Story 2.2: Thread Detail View with Conversation History
 * Task 8: Implement Expandable Headers
 *
 * Shows email headers in compact or expanded view.
 * Compact: From, Date
 * Expanded: From, To, CC, BCC, Date
 */

import { memo, type KeyboardEvent } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { EmailAddress } from '@/services/database/schemas/email.schema'

interface ExpandableHeaderProps {
  /** Sender address */
  from: EmailAddress
  /** Primary recipients */
  to: EmailAddress[]
  /** CC recipients (optional) */
  cc?: EmailAddress[]
  /** BCC recipients (optional) */
  bcc?: EmailAddress[]
  /** Email timestamp */
  timestamp: number
  /** Whether the header is expanded */
  isExpanded: boolean
  /** Toggle expanded state */
  onToggle: () => void
  /** Optional className for styling */
  className?: string
}

/**
 * Format email address for display
 */
function formatAddress(addr: EmailAddress): string {
  if (addr.name?.trim()) {
    return `${addr.name} <${addr.email}>`
  }
  return addr.email
}

/**
 * Format multiple addresses for display
 */
function formatAddresses(addresses: EmailAddress[]): string {
  return addresses.map(formatAddress).join(', ')
}

/**
 * Format full date for email header
 */
function formatFullDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString([], {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Expandable email header component
 * Shows compact view by default, full details on expand
 */
export const ExpandableHeader = memo(function ExpandableHeader({
  from,
  to,
  cc,
  bcc,
  timestamp,
  isExpanded,
  onToggle,
  className,
}: ExpandableHeaderProps) {
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onToggle()
    }
  }

  const hasExtraRecipients = (cc && cc.length > 0) || (bcc && bcc.length > 0) || to.length > 1

  return (
    <div className={cn('text-sm', className)}>
      {/* Compact view - always visible */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {/* Sender */}
          <span className="font-medium text-slate-900 truncate">
            {from.name?.trim() || from.email}
          </span>

          {/* Expand indicator if there are more details */}
          {hasExtraRecipients && (
            <button
              type="button"
              onClick={onToggle}
              onKeyDown={handleKeyDown}
              className={cn(
                'flex items-center gap-0.5 px-1.5 py-0.5 rounded',
                'text-xs text-slate-500 hover:text-slate-700',
                'hover:bg-slate-100 transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-1'
              )}
              aria-expanded={isExpanded}
              aria-label={isExpanded ? 'Hide email details' : 'Show email details'}
            >
              {isExpanded ? (
                <>
                  <span>less</span>
                  <ChevronUp className="w-3 h-3" />
                </>
              ) : (
                <>
                  <span>more</span>
                  <ChevronDown className="w-3 h-3" />
                </>
              )}
            </button>
          )}
        </div>

        {/* Date */}
        <span className="text-slate-500 flex-shrink-0">{formatFullDate(timestamp)}</span>
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className="mt-2 space-y-1 text-slate-600 pl-0.5">
          {/* From (full) */}
          <div className="flex gap-2">
            <span className="text-slate-400 w-10 flex-shrink-0">From:</span>
            <span className="break-all">{formatAddress(from)}</span>
          </div>

          {/* To */}
          <div className="flex gap-2">
            <span className="text-slate-400 w-10 flex-shrink-0">To:</span>
            <span className="break-all">{formatAddresses(to)}</span>
          </div>

          {/* CC */}
          {cc && cc.length > 0 && (
            <div className="flex gap-2">
              <span className="text-slate-400 w-10 flex-shrink-0">CC:</span>
              <span className="break-all">{formatAddresses(cc)}</span>
            </div>
          )}

          {/* BCC */}
          {bcc && bcc.length > 0 && (
            <div className="flex gap-2">
              <span className="text-slate-400 w-10 flex-shrink-0">BCC:</span>
              <span className="break-all">{formatAddresses(bcc)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
})
