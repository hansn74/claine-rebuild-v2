/**
 * QuotedText Component
 *
 * Story 2.2: Thread Detail View with Conversation History
 * Task 5: Implement Quoted Text Handling
 *
 * Displays collapsible quoted/reply text in emails.
 * Collapsed by default with "Show quoted text" link.
 */

import { useState, memo, type KeyboardEvent } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/utils/cn'
import { sanitizeEmailHtml } from '@/utils/sanitizeHtml'

interface QuotedTextProps {
  /** The quoted content (HTML or plain text) */
  content: string
  /** Whether the content is HTML */
  isHtml: boolean
  /** Optional custom label for the expand button */
  label?: string
  /** Optional className for styling */
  className?: string
}

/**
 * Collapsible quoted text component
 * Shows quoted/reply text in a collapsed state by default
 */
export const QuotedText = memo(function QuotedText({
  content,
  isHtml,
  label = 'Show quoted text',
  className,
}: QuotedTextProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  if (!content || content.trim() === '') {
    return null
  }

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded)
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      toggleExpanded()
    }
  }

  return (
    <div className={cn('border-t border-slate-100 mt-3 pt-2', className)}>
      {/* Expand/Collapse Toggle */}
      <button
        type="button"
        onClick={toggleExpanded}
        onKeyDown={handleKeyDown}
        className={cn(
          'flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700',
          'py-1 px-0 bg-transparent border-none cursor-pointer',
          'transition-colors duration-150'
        )}
        aria-expanded={isExpanded}
        aria-controls="quoted-content"
      >
        {isExpanded ? (
          <>
            <ChevronUp className="w-4 h-4" />
            <span>Hide quoted text</span>
          </>
        ) : (
          <>
            <ChevronDown className="w-4 h-4" />
            <span>{label}</span>
          </>
        )}
      </button>

      {/* Quoted Content */}
      {isExpanded && (
        <div
          id="quoted-content"
          className={cn('mt-2 pl-3 border-l-2 border-slate-200', 'text-slate-600 text-sm')}
        >
          {isHtml ? (
            <div
              className="prose prose-sm max-w-none prose-gray"
              dangerouslySetInnerHTML={{ __html: sanitizeEmailHtml(content) }}
            />
          ) : (
            <pre className="whitespace-pre-wrap font-sans">{content}</pre>
          )}
        </div>
      )}
    </div>
  )
})
