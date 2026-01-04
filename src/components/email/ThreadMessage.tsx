/**
 * ThreadMessage Component
 *
 * Story 2.2: Thread Detail View with Conversation History
 * Task 3: Create ThreadMessage Component
 *
 * Displays a single message within a thread.
 * Features:
 * - Sender avatar and display name
 * - Collapsible message body (collapsed by default except last message)
 * - Relative timestamp
 * - Quoted text handling
 * - Attachments display
 */

import { useState, memo, useMemo, type KeyboardEvent, type MouseEvent } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/utils/cn'
import { sanitizeEmailHtml } from '@/utils/sanitizeHtml'
import { parseQuotedText } from '@/utils/quotedTextParser'
import { getSenderInitials, getSenderDisplayName } from '@/utils/threadGrouping'
import { buildContentIdMap, replaceCidReferences } from '@/utils/inlineImageHandler'
import { ExpandableHeader } from './ExpandableHeader'
import { QuotedText } from './QuotedText'
import { AttachmentList } from './AttachmentList'
import { InlineImageRenderer } from './InlineImageRenderer'
import type { EmailDocument, Attachment } from '@/services/database/schemas/email.schema'

interface ThreadMessageProps {
  /** The email document to display */
  email: EmailDocument
  /** Whether this is the last message in the thread (expanded by default) */
  isLastMessage: boolean
  /** Whether this message is the first in its group (show full header) */
  isFirstInGroup?: boolean
  /** Optional handler for attachment download */
  onDownloadAttachment?: (attachment: Attachment) => void
  /** Optional className for styling */
  className?: string
}

/**
 * Format relative timestamp
 */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp

  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`

  // More than a week, show date
  return new Date(timestamp).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: days > 365 ? 'numeric' : undefined,
  })
}

/**
 * Single message in a thread
 */
export const ThreadMessage = memo(function ThreadMessage({
  email,
  isLastMessage,
  isFirstInGroup = true,
  onDownloadAttachment,
  className,
}: ThreadMessageProps) {
  // Body is expanded by default only for the last message
  const [isBodyExpanded, setIsBodyExpanded] = useState(isLastMessage)
  const [isHeaderExpanded, setIsHeaderExpanded] = useState(false)

  // Determine if content is HTML
  const isHtml = Boolean(email.body.html)
  const rawContent = email.body.html || email.body.text || ''

  // Parse quoted text
  const parsedContent = useMemo(() => {
    return parseQuotedText(rawContent, isHtml)
  }, [rawContent, isHtml])

  // Get inline attachments (those with contentId)
  const inlineAttachments = useMemo(() => {
    return (email.attachments || []).filter((att) => att.isInline && att.contentId)
  }, [email.attachments])

  // Check if we have inline images to fetch
  const hasInlineImages = inlineAttachments.length > 0 && isHtml

  // Build content ID map for inline images (fallback placeholder URLs)
  const contentIdMap = useMemo(() => {
    return buildContentIdMap(email.attachments)
  }, [email.attachments])

  // Process HTML content with inline image replacements (non-fetched fallback)
  const processedContent = useMemo(() => {
    if (!isHtml) return parsedContent.mainContent

    // If we have inline images, let InlineImageRenderer handle them
    if (hasInlineImages) {
      return parsedContent.mainContent
    }

    let html = parsedContent.mainContent
    // Replace cid: references with actual URLs (placeholder URLs)
    html = replaceCidReferences(html, contentIdMap)
    // Sanitize for XSS
    return sanitizeEmailHtml(html)
  }, [parsedContent.mainContent, contentIdMap, isHtml, hasInlineImages])

  const toggleBody = () => {
    setIsBodyExpanded(!isBodyExpanded)
  }

  const toggleHeader = () => {
    setIsHeaderExpanded(!isHeaderExpanded)
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      toggleBody()
    }
  }

  // Get avatar color based on sender email
  const avatarColor = useMemo(() => {
    const colors = [
      'bg-cyan-500',
      'bg-emerald-500',
      'bg-violet-500',
      'bg-amber-500',
      'bg-rose-500',
      'bg-teal-500',
      'bg-indigo-500',
      'bg-slate-500',
    ]
    const hash = email.from.email.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    return colors[hash % colors.length]
  }, [email.from.email])

  return (
    <div
      className={cn('rounded-lg border border-slate-200 bg-white', 'overflow-hidden', className)}
    >
      {/* Message Header - clickable to expand/collapse */}
      <div
        role="button"
        tabIndex={0}
        onClick={toggleBody}
        onKeyDown={handleKeyDown}
        className={cn(
          'flex items-start gap-3 p-4',
          'cursor-pointer hover:bg-slate-50 transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-inset focus:ring-cyan-500'
        )}
        aria-expanded={isBodyExpanded}
      >
        {/* Avatar */}
        {isFirstInGroup && (
          <div
            className={cn(
              'w-10 h-10 rounded-full flex-shrink-0',
              'flex items-center justify-center',
              'text-white font-medium text-sm',
              avatarColor
            )}
            aria-hidden="true"
          >
            {getSenderInitials(email.from)}
          </div>
        )}

        {/* Header content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-medium text-slate-900 truncate">
                {getSenderDisplayName(email.from)}
              </span>
              {!isBodyExpanded && email.snippet && (
                <span className="text-slate-500 truncate text-sm">- {email.snippet}</span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-sm text-slate-500">{formatRelativeTime(email.timestamp)}</span>
              {isBodyExpanded ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </div>
          </div>

          {/* Expanded header details */}
          {isBodyExpanded && (
            <div
              className="mt-2"
              onClick={(e: MouseEvent) => e.stopPropagation()}
              onKeyDown={(e: KeyboardEvent) => e.stopPropagation()}
              role="presentation"
            >
              <ExpandableHeader
                from={email.from}
                to={email.to}
                cc={email.cc}
                bcc={email.bcc}
                timestamp={email.timestamp}
                isExpanded={isHeaderExpanded}
                onToggle={toggleHeader}
              />
            </div>
          )}
        </div>
      </div>

      {/* Message Body - collapsible */}
      {isBodyExpanded && (
        <div className="px-4 pb-4 border-t border-slate-100">
          {/* Main content */}
          <div className="pt-3">
            {isHtml && hasInlineImages ? (
              // Use InlineImageRenderer to fetch and display inline images
              <InlineImageRenderer
                html={parsedContent.mainContent}
                inlineAttachments={inlineAttachments}
                accountId={email.accountId}
                emailId={email.id}
              />
            ) : isHtml ? (
              <div
                className="prose prose-sm max-w-none prose-slate"
                dangerouslySetInnerHTML={{ __html: processedContent }}
              />
            ) : processedContent ? (
              <pre className="whitespace-pre-wrap font-sans text-slate-800 text-sm">
                {processedContent}
              </pre>
            ) : (
              <p className="text-slate-500 italic text-sm">No content</p>
            )}
          </div>

          {/* Quoted text (collapsible) */}
          {parsedContent.hasQuotedText && parsedContent.quotedContent && (
            <QuotedText content={parsedContent.quotedContent} isHtml={isHtml} />
          )}

          {/* Attachments */}
          {email.attachments && email.attachments.length > 0 && (
            <AttachmentList
              attachments={email.attachments}
              accountId={email.accountId}
              emailId={email.id}
              onDownload={onDownloadAttachment}
            />
          )}
        </div>
      )}
    </div>
  )
})
