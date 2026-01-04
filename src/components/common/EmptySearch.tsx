/**
 * EmptySearch Component
 *
 * Story 2.12: Empty States & Onboarding UX
 * Task 1.3: Create EmptySearch.tsx variant: "No results found" with search tips
 *
 * Specialized empty state for when search returns no results.
 * Provides helpful tips to improve search queries.
 *
 * Usage:
 *   <EmptySearch query="meeting notes" />
 */

import { Search } from 'lucide-react'
import { cn } from '@shared/utils/cn'
import { EmptyState, type EmptyStateProps } from './EmptyState'

export interface EmptySearchProps extends Omit<EmptyStateProps, 'icon' | 'title' | 'description'> {
  /** The search query that returned no results */
  query?: string
  /** Whether to show search tips */
  showTips?: boolean
  /** Override title */
  title?: string
  /** Override description */
  description?: string
}

/**
 * EmptySearch - Empty state for search with no results
 *
 * Features:
 * - Shows the attempted query
 * - Optional search tips for better queries
 * - Search icon for context
 */
export function EmptySearch({
  query,
  showTips = true,
  title,
  description,
  className,
  ...props
}: EmptySearchProps) {
  const defaultTitle = query ? `No results for "${query}"` : 'No results found'

  const defaultDescription = showTips ? 'Try different keywords or check your spelling' : undefined

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <EmptyState
        icon={<Search className="w-8 h-8 text-slate-400" strokeWidth={1.5} aria-hidden="true" />}
        title={title ?? defaultTitle}
        description={description ?? defaultDescription}
        testId="empty-search"
        {...props}
      />

      {showTips && (
        <div className="mt-4 text-sm text-slate-500 max-w-sm text-left">
          <p className="font-medium text-slate-600 mb-2">Search tips:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Use keywords from the email subject or body</li>
            <li>Search for sender names or email addresses</li>
            <li>Try broader terms if specific ones fail</li>
          </ul>
        </div>
      )}
    </div>
  )
}

export default EmptySearch
