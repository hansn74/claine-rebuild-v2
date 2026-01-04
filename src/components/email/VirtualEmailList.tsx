/**
 * VirtualEmailList Component
 * High-performance virtualized list for rendering large email collections
 *
 * Uses @tanstack/react-virtual for efficient rendering of 10,000+ emails
 *
 * AC 1: @tanstack/react-virtual implemented for inbox list
 * AC 2: Only visible emails rendered in DOM (20-30 rows buffer)
 * AC 3: Smooth 60 FPS scrolling with 10,000+ emails
 * AC 4: Dynamic row heights supported
 * AC 5: Scroll position preserved when navigating back to inbox
 * AC 6: Performance benchmarked: <50ms scroll interaction time
 *
 * Story 2.11: Keyboard Shortcuts & Power User Features
 * - AC 2: j/k navigation shortcuts integrated with virtualizer
 * - AC 3: Enter to open selected email
 */

import { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useEmails } from '@/hooks/useEmails'
import { useEmailListStore } from '@/store/emailListStore'
import { useAttributeFilterStore } from '@/store/attributeFilterStore'
import { EmailRow } from './EmailRow'
import { ActiveFilterChips } from './filters/ActiveFilterChips'
import type { EmailDocument } from '@/services/database/schemas/email.schema'
import { logger } from '@/services/logger'
import { useNavigationShortcuts } from '@/hooks/useEmailShortcut'
import { useShortcuts } from '@/context/ShortcutContext'
import { EmptyInbox } from '@/components/common/EmptyInbox'
import { EmptyFolder, type FolderType } from '@/components/common/EmptyFolder'
import { EmptyFilteredResults } from '@/components/common/EmptyFilteredResults'
import { ErrorState as ErrorStateComponent } from '@/components/common/ErrorState'
import { LoadingSpinner } from '@/components/common/LoadingFallback'

interface VirtualEmailListProps {
  accountId?: string
  folder?: string // Filter by folder (Task 5.1)
  onEmailSelect?: (email: EmailDocument) => void
  selectedEmailId?: string | null
}

/**
 * Map folder names to FolderType for EmptyFolder component
 * Story 2.12: Task 6.3
 */
function getFolderType(folder: string | undefined): FolderType {
  if (!folder) return 'generic'
  const normalized = folder.toLowerCase()
  if (normalized === 'sent' || normalized === 'sent mail') return 'sent'
  if (normalized === 'drafts' || normalized === 'draft') return 'drafts'
  if (normalized === 'archive' || normalized === 'all mail') return 'archive'
  if (normalized === 'trash' || normalized === 'deleted') return 'trash'
  return 'generic'
}

/**
 * Default estimated row height in pixels
 * Story 2.17: UX spec defines 48px compact row height
 */
const ESTIMATED_ROW_HEIGHT = 48

/**
 * Number of rows to render outside the visible area (buffer)
 * AC 2: 20-30 rows buffer for smooth scrolling
 */
const OVERSCAN_COUNT = 25

export function VirtualEmailList({
  accountId,
  folder,
  onEmailSelect,
  selectedEmailId,
}: VirtualEmailListProps) {
  const parentRef = useRef<HTMLDivElement>(null)

  // Get scroll position from store for persistence (AC 5)
  const { scrollOffset, setScrollOffset } = useEmailListStore()

  // Story 2.15: Get attribute filters from store
  // Get activeFilters directly - it's a Map that only changes when filters change
  const activeFilters = useAttributeFilterStore((state) => state.activeFilters)

  // Determine if we have active filters based on the Map size
  const hasFilters = activeFilters.size > 0

  // Memoize the filter map to avoid unnecessary re-renders
  const attributeFilters = useMemo(() => {
    return hasFilters ? activeFilters : undefined
  }, [activeFilters, hasFilters])

  // Story 2.11: Keyboard navigation state
  const [focusedIndex, setFocusedIndex] = useState<number>(0)
  const { setActiveScope, vimModeEnabled } = useShortcuts()

  // Fetch emails reactively from RxDB
  // Story 2.16: Enable progressive loading for performance
  // Task 5.1: Filter by folder when provided
  // Story 2.15: Filter by attributes when provided
  const { emails, loading, error, count, loadMore, hasMore, loadingMore } = useEmails({
    accountId,
    folder: folder || undefined, // Filter by folder (Story 2.9)
    sortOrder: 'desc', // Newest first
    attributeFilters, // Story 2.15: Attribute filters
    enablePagination: true, // Story 2.16: Progressive loading
  })

  // Configure virtualizer (AC 1, AC 2)
  const virtualizer = useVirtualizer({
    count: emails.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT, // Estimated row height
    overscan: OVERSCAN_COUNT, // Buffer rows for smooth scrolling
    measureElement: (element) => {
      // Dynamic height measurement for varying content (AC 4)
      return element.getBoundingClientRect().height
    },
  })

  // Restore scroll position on mount (AC 5)
  useEffect(() => {
    if (parentRef.current && scrollOffset > 0 && emails.length > 0) {
      parentRef.current.scrollTop = scrollOffset
      logger.debug('ui', 'VirtualEmailList scroll position restored', {
        scrollOffset,
        emailCount: emails.length,
      })
    }
  }, [scrollOffset, emails.length])

  // Save scroll position on scroll (AC 5) and trigger infinite scroll (Story 2.16)
  const handleScroll = useCallback(() => {
    if (!parentRef.current) return

    const { scrollTop, scrollHeight, clientHeight } = parentRef.current

    // Debounce: only update scroll offset if changed significantly
    if (Math.abs(scrollTop - scrollOffset) > 50) {
      setScrollOffset(scrollTop)
    }

    // Story 2.16: Infinite scroll - load more when near bottom
    // Trigger when user is within 200px of bottom
    const scrollThreshold = 200
    const isNearBottom = scrollHeight - scrollTop - clientHeight < scrollThreshold

    if (isNearBottom && hasMore && !loadingMore) {
      logger.debug('ui', 'VirtualEmailList: Loading more emails', {
        scrollTop,
        scrollHeight,
        clientHeight,
        currentCount: emails.length,
      })
      loadMore()
    }
  }, [scrollOffset, setScrollOffset, hasMore, loadingMore, loadMore, emails.length])

  // Handle email click
  const handleEmailClick = useCallback(
    (email: EmailDocument, index: number) => {
      setFocusedIndex(index)
      onEmailSelect?.(email)
    },
    [onEmailSelect]
  )

  // Story 2.11: Navigation handlers for j/k shortcuts
  const handleMoveDown = useCallback(() => {
    if (emails.length === 0) return
    const newIndex = Math.min(focusedIndex + 1, emails.length - 1)
    setFocusedIndex(newIndex)
    // Scroll the focused item into view
    virtualizer.scrollToIndex(newIndex, { align: 'auto' })
    logger.debug('shortcuts', 'Navigate down', { newIndex, total: emails.length })
  }, [focusedIndex, emails.length, virtualizer])

  const handleMoveUp = useCallback(() => {
    if (emails.length === 0) return
    const newIndex = Math.max(focusedIndex - 1, 0)
    setFocusedIndex(newIndex)
    // Scroll the focused item into view
    virtualizer.scrollToIndex(newIndex, { align: 'auto' })
    logger.debug('shortcuts', 'Navigate up', { newIndex, total: emails.length })
  }, [focusedIndex, emails.length, virtualizer])

  const handleSelect = useCallback(() => {
    if (emails.length === 0 || focusedIndex < 0 || focusedIndex >= emails.length) return
    const email = emails[focusedIndex]
    onEmailSelect?.(email)
    logger.debug('shortcuts', 'Select email via Enter', { emailId: email.id, index: focusedIndex })
  }, [emails, focusedIndex, onEmailSelect])

  // Vim mode: go to top (gg)
  const handleGoToTop = useCallback(() => {
    if (emails.length === 0) return
    setFocusedIndex(0)
    virtualizer.scrollToIndex(0, { align: 'start' })
    logger.debug('shortcuts', 'Navigate to top (gg)')
  }, [emails.length, virtualizer])

  // Vim mode: go to bottom (G)
  const handleGoToBottom = useCallback(() => {
    if (emails.length === 0) return
    const lastIndex = emails.length - 1
    setFocusedIndex(lastIndex)
    virtualizer.scrollToIndex(lastIndex, { align: 'end' })
    logger.debug('shortcuts', 'Navigate to bottom (G)')
  }, [emails.length, virtualizer])

  // Story 2.11: Register navigation shortcuts (only when in inbox scope)
  useNavigationShortcuts({
    onMoveDown: handleMoveDown,
    onMoveUp: handleMoveUp,
    onSelect: handleSelect,
    onGoToTop: vimModeEnabled ? handleGoToTop : undefined,
    onGoToBottom: vimModeEnabled ? handleGoToBottom : undefined,
    enabled: emails.length > 0,
    scopes: ['inbox'],
  })

  // Set inbox scope when this component is active
  useEffect(() => {
    setActiveScope('inbox')
  }, [setActiveScope])

  // Reset focused index when emails change
  useEffect(() => {
    if (emails.length > 0 && focusedIndex >= emails.length) {
      setFocusedIndex(Math.max(0, emails.length - 1))
    }
  }, [emails.length, focusedIndex])

  // Loading state - Story 2.12: Task 6
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  // Error state - Story 2.12: Task 6
  if (error) {
    return <ErrorStateComponent type="sync" description={error.message} />
  }

  // Empty state - Story 2.12: Task 6.1-6.3
  // Story 2.15: Show filtered empty state when filters are active (AC 9)
  if (count === 0) {
    // If filters are active, show filtered empty state
    if (hasFilters) {
      return <EmptyFilteredResults />
    }
    // Use appropriate empty state based on folder
    if (folder && folder.toLowerCase() !== 'inbox') {
      const folderType = getFolderType(folder)
      return <EmptyFolder folder={folderType} folderName={folder} />
    }
    // Default inbox empty state
    return <EmptyInbox />
  }

  // Get virtual items for rendering
  // Story 2.10: Task 3.5 - Virtual list already provides optimized rendering
  const virtualRows = virtualizer.getVirtualItems()
  const totalSize = virtualizer.getTotalSize()

  // Only log in development and debounce to avoid performance impact
  if (import.meta.env.DEV && emails.length > 0) {
    logger.debug('ui', 'VirtualEmailList render', {
      totalEmails: emails.length,
      visibleRows: virtualRows.length,
      totalSize,
    })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-slate-200 bg-slate-50 flex-shrink-0">
        <h2 className="font-semibold text-slate-700 capitalize">{folder || 'All Emails'}</h2>
        <span className="text-sm text-slate-500">{count} emails</span>
      </div>

      {/* Story 2.15: Active filter chips (AC 5) - positioned below folder header */}
      <ActiveFilterChips />

      {/* Virtualized scrollable area */}
      <div ref={parentRef} className="flex-1 overflow-auto" onScroll={handleScroll}>
        {/* Spacer div to maintain scroll height */}
        <div
          style={{
            height: `${totalSize}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {/* Render only visible rows + overscan buffer */}
          {virtualRows.map((virtualRow) => {
            const email = emails[virtualRow.index]
            const isFocused = virtualRow.index === focusedIndex
            return (
              <div
                key={virtualRow.key}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <EmailRow
                  email={email}
                  isSelected={email.id === selectedEmailId}
                  isFocused={isFocused}
                  onClick={() => handleEmailClick(email, virtualRow.index)}
                />
              </div>
            )
          })}

          {/* Story 2.16: Loading indicator for infinite scroll */}
          {loadingMore && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${totalSize}px)`,
              }}
              className="flex items-center justify-center py-4"
            >
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-500" />
                <span>Loading more emails...</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
