/**
 * SearchResults Component
 *
 * Story 2.5: Local Full-Text Search
 * Task 6.2: Create SearchResults container with virtualized list for performance
 *
 * Story 2.12: Empty States & Onboarding UX
 * Task 6.2: Integrated EmptySearch component for no results state
 *
 * Container component for displaying search results.
 * Supports both regular list and virtualized rendering for large result sets.
 */

import { memo, useCallback, useRef, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { cn } from '@shared/utils/cn'
import { SearchResultItem } from './SearchResultItem'
import { EmptySearch } from '@/components/common/EmptySearch'
import type { EnrichedSearchResult } from '@/services/search'

export interface SearchResultsProps {
  /** Array of search results */
  results: EnrichedSearchResult[]
  /** Index of currently selected result */
  selectedIndex?: number
  /** Called when selection changes */
  onSelect?: (index: number) => void
  /** Called when a result is clicked */
  onClick?: (emailId: string) => void
  /** Whether to use virtualization (recommended for >20 results) */
  virtualize?: boolean
  /** Maximum height of results container */
  maxHeight?: number
  /** Additional className */
  className?: string
  /** Empty state message */
  emptyMessage?: string
  /** Search query for empty state display (Story 2.12) */
  searchQuery?: string
  /** Whether search is currently in progress */
  isSearching?: boolean
}

/**
 * SearchResults - Displays search results list
 *
 * Features:
 * - Optional virtualization for large result sets
 * - Keyboard navigation support
 * - Selection highlighting
 * - Empty state display
 */
export const SearchResults = memo(function SearchResults({
  results,
  selectedIndex = -1,
  onSelect,
  onClick,
  virtualize = true,
  maxHeight = 400,
  className,
  emptyMessage = 'No results found',
  searchQuery,
  isSearching = false,
}: SearchResultsProps) {
  const parentRef = useRef<HTMLDivElement>(null)

  // Virtual list configuration
  const virtualizer = useVirtualizer({
    count: results.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100, // Estimated row height
    overscan: 5,
  })

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && selectedIndex < results.length) {
      virtualizer.scrollToIndex(selectedIndex, { align: 'auto' })
    }
  }, [selectedIndex, results.length, virtualizer])

  // Handle click on result
  const handleClick = useCallback(
    (emailId: string, index: number) => {
      onSelect?.(index)
      onClick?.(emailId)
    },
    [onSelect, onClick]
  )

  // Empty state - Story 2.12: Use EmptySearch component
  if (results.length === 0) {
    // Show loading message if still searching
    if (isSearching) {
      return (
        <div
          className={cn('flex items-center justify-center p-8 text-slate-500 text-sm', className)}
        >
          {emptyMessage}
        </div>
      )
    }

    // Show enhanced empty search component (AC3: helpful tips)
    return <EmptySearch query={searchQuery} showTips className={className} compact />
  }

  // Virtualized rendering for large result sets
  if (virtualize && results.length > 20) {
    return (
      <div
        ref={parentRef}
        className={cn('overflow-auto', className)}
        style={{ maxHeight }}
        role="listbox"
        aria-label="Search results"
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const result = results[virtualRow.index]
            return (
              <div
                key={result.email.id}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <SearchResultItem
                  result={result}
                  isSelected={virtualRow.index === selectedIndex}
                  onClick={() => handleClick(result.email.id, virtualRow.index)}
                />
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Regular list rendering for smaller result sets
  return (
    <div
      ref={parentRef}
      className={cn('overflow-auto', className)}
      style={{ maxHeight }}
      role="listbox"
      aria-label="Search results"
    >
      {results.map((result, index) => (
        <SearchResultItem
          key={result.email.id}
          result={result}
          isSelected={index === selectedIndex}
          onClick={() => handleClick(result.email.id, index)}
        />
      ))}
    </div>
  )
})
