/**
 * HighlightedText Component
 *
 * Story 2.5: Local Full-Text Search
 * Task 9.2: Create HighlightedText component for rendering matched terms
 *
 * Renders text with <mark> tags highlighted visually.
 * Safely handles HTML content using DOMPurify sanitization.
 */

import { memo } from 'react'
import DOMPurify from 'dompurify'
import { cn } from '@shared/utils/cn'

export interface HighlightedTextProps {
  /** Text content with <mark> tags for highlights */
  text: string
  /** Additional className for the container */
  className?: string
  /** Truncate text with ellipsis */
  truncate?: boolean
  /** Maximum lines before truncation (requires truncate=true) */
  maxLines?: number
}

/**
 * HighlightedText - Renders text with highlighted matches
 *
 * Accepts text containing <mark> tags and renders them as highlighted spans.
 * Sanitizes HTML to prevent XSS attacks.
 *
 * @example
 * ```tsx
 * <HighlightedText text="Meeting about the <mark>budget</mark> review" />
 * ```
 */
export const HighlightedText = memo(function HighlightedText({
  text,
  className,
  truncate = false,
  maxLines = 1,
}: HighlightedTextProps) {
  // Sanitize HTML to only allow <mark> tags
  const sanitizedHtml = DOMPurify.sanitize(text || '', {
    ALLOWED_TAGS: ['mark'],
    ALLOWED_ATTR: [],
  })

  // Add custom styles for <mark> tags
  const styledHtml = sanitizedHtml.replace(
    /<mark>/g,
    '<mark class="bg-yellow-200 text-yellow-900 px-0.5 rounded">'
  )

  return (
    <span
      className={cn(
        truncate && maxLines === 1 && 'truncate block',
        truncate && maxLines === 2 && 'line-clamp-2',
        truncate && maxLines === 3 && 'line-clamp-3',
        className
      )}
      dangerouslySetInnerHTML={{ __html: styledHtml }}
    />
  )
})
