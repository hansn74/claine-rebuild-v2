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
 *
 * Story 3.4: Priority-Based Inbox View
 * - Priority view groups emails by priority level with collapsible sections
 * - Chronological view preserved as default
 */

import { useRef, useEffect, useCallback, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useEmails } from '@/hooks/useEmails'
import { useEmailListStore } from '@/store/emailListStore'
import { useAttributeFilterStore } from '@/store/attributeFilterStore'
import { useViewModeStore } from '@/store/viewModeStore'
import { usePriorityGroupedEmails } from '@/hooks/usePriorityGroupedEmails'
import { priorityFeedbackService } from '@/services/ai/priorityFeedbackService'
import { EmailRow } from './EmailRow'
import { PrioritySectionHeader } from './PrioritySectionHeader'
import { ViewModeToggle } from './ViewModeToggle'
import { ActiveFilterChips } from './filters/ActiveFilterChips'
import type { EmailDocument } from '@/services/database/schemas/email.schema'
import type { Priority } from '@/services/ai/priorityDisplay'
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
  selectedEmailId?: string | null // Actual email ID for j/k navigation
  selectedThreadId?: string | null // Thread ID for visual highlight (cyan border)
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

/** Section header height for priority view (36px = h-9) */
const SECTION_HEADER_HEIGHT = 36

/**
 * Number of rows to render outside the visible area (buffer)
 * AC 2: 20-30 rows buffer for smooth scrolling
 */
const OVERSCAN_COUNT = 25

/** Folders that support priority view (inbox-like folders only) */
const NON_PRIORITY_FOLDERS = new Set([
  'sent',
  'sent mail',
  'drafts',
  'draft',
  'trash',
  'deleted',
  'spam',
  'junk',
])

export function VirtualEmailList({
  accountId,
  folder,
  onEmailSelect,
  selectedEmailId,
  selectedThreadId,
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

  // Story 3.4: Priority view state
  const viewMode = useViewModeStore((s) => s.viewMode)
  const collapsedSections = useViewModeStore((s) => s.collapsedSections)
  const toggleSection = useViewModeStore((s) => s.toggleSection)

  // Determine if priority view is available for this folder
  const isPrioritySupported = useMemo(() => {
    if (!folder) return true // "All Emails" supports priority
    return !NON_PRIORITY_FOLDERS.has(folder.toLowerCase())
  }, [folder])

  const isPriorityMode = viewMode === 'priority' && isPrioritySupported

  // Story 2.11: Keyboard navigation uses selection directly (no separate focus state)
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

  // Story 3.4: Group emails by priority when in priority mode
  const priorityItems = usePriorityGroupedEmails(emails, collapsedSections)

  // Email-only items for keyboard navigation in priority mode (skip headers)
  const emailOnlyItems = useMemo(() => {
    if (!isPriorityMode) return emails
    return priorityItems
      .filter((item) => item.type === 'email')
      .map((item) => (item as { type: 'email'; email: EmailDocument }).email)
  }, [isPriorityMode, priorityItems, emails])

  // Configure virtualizer (AC 1, AC 2)
  const virtualizerCount = isPriorityMode ? priorityItems.length : emails.length
  const virtualizer = useVirtualizer({
    count: virtualizerCount,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      if (isPriorityMode && priorityItems[index]?.type === 'header') {
        return SECTION_HEADER_HEIGHT
      }
      return ESTIMATED_ROW_HEIGHT
    },
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

  // Track if selection came from click (internal) vs search/external
  const selectionFromClickRef = useRef(false)

  // Handle email click - just select the email
  const handleEmailClick = useCallback(
    (email: EmailDocument) => {
      selectionFromClickRef.current = true // Mark as click-initiated
      onEmailSelect?.(email)
    },
    [onEmailSelect]
  )

  // Story 3.6: Handle email drop onto priority section header
  const handleEmailDrop = useCallback((priority: Priority | 'uncategorized') => {
    if (priority === 'uncategorized') return
    return (emailId: string) => {
      priorityFeedbackService.recordOverride(emailId, priority)
    }
  }, [])

  // Find current selection index for navigation (uses actual email ID, not threadId)
  // Story 3.4: Use emailOnlyItems so j/k skips headers in priority mode
  const currentIndex = useMemo(() => {
    if (!selectedEmailId || emailOnlyItems.length === 0) return -1
    return emailOnlyItems.findIndex((e) => e.id === selectedEmailId)
  }, [selectedEmailId, emailOnlyItems])

  // Map email-only index to virtualizer index for scrollToIndex in priority mode
  const toVirtualIndex = useCallback(
    (emailIdx: number): number => {
      if (!isPriorityMode) return emailIdx
      const email = emailOnlyItems[emailIdx]
      if (!email) return emailIdx
      return priorityItems.findIndex((item) => item.type === 'email' && item.email.id === email.id)
    },
    [isPriorityMode, emailOnlyItems, priorityItems]
  )

  // Story 2.11: Navigation handlers for j/k shortcuts - directly select next/previous
  const handleMoveDown = useCallback(() => {
    if (emailOnlyItems.length === 0) return
    // If nothing selected, select first; otherwise select next
    const newIndex = currentIndex < 0 ? 0 : Math.min(currentIndex + 1, emailOnlyItems.length - 1)
    const email = emailOnlyItems[newIndex]
    selectionFromClickRef.current = true // Prevent useEffect from also scrolling
    onEmailSelect?.(email)
    virtualizer.scrollToIndex(toVirtualIndex(newIndex), { align: 'auto' })
    logger.debug('shortcuts', 'Navigate down & select', { newIndex, total: emailOnlyItems.length })
  }, [currentIndex, emailOnlyItems, onEmailSelect, virtualizer, toVirtualIndex])

  const handleMoveUp = useCallback(() => {
    if (emailOnlyItems.length === 0) return
    // If nothing selected, select first; otherwise select previous
    const newIndex = currentIndex < 0 ? 0 : Math.max(currentIndex - 1, 0)
    const email = emailOnlyItems[newIndex]
    selectionFromClickRef.current = true // Prevent useEffect from also scrolling
    onEmailSelect?.(email)
    virtualizer.scrollToIndex(toVirtualIndex(newIndex), { align: 'auto' })
    logger.debug('shortcuts', 'Navigate up & select', { newIndex, total: emailOnlyItems.length })
  }, [currentIndex, emailOnlyItems, onEmailSelect, virtualizer, toVirtualIndex])

  // Enter key - no-op since j/k already select (kept for compatibility)
  const handleSelect = useCallback(() => {
    // j/k already select, Enter does nothing extra
  }, [])

  // Vim mode: go to top (gg) - select first email
  const handleGoToTop = useCallback(() => {
    if (emailOnlyItems.length === 0) return
    const email = emailOnlyItems[0]
    onEmailSelect?.(email)
    virtualizer.scrollToIndex(toVirtualIndex(0), { align: 'start' })
    logger.debug('shortcuts', 'Navigate to top & select (gg)')
  }, [emailOnlyItems, onEmailSelect, virtualizer, toVirtualIndex])

  // Vim mode: go to bottom (G) - select last email
  const handleGoToBottom = useCallback(() => {
    if (emailOnlyItems.length === 0) return
    const lastIndex = emailOnlyItems.length - 1
    const email = emailOnlyItems[lastIndex]
    onEmailSelect?.(email)
    virtualizer.scrollToIndex(toVirtualIndex(lastIndex), { align: 'end' })
    logger.debug('shortcuts', 'Navigate to bottom & select (G)')
  }, [emailOnlyItems, onEmailSelect, virtualizer, toVirtualIndex])

  // Story 2.11: Register navigation shortcuts (only when in inbox scope)
  useNavigationShortcuts({
    onMoveDown: handleMoveDown,
    onMoveUp: handleMoveUp,
    onSelect: handleSelect,
    onGoToTop: vimModeEnabled ? handleGoToTop : undefined,
    onGoToBottom: vimModeEnabled ? handleGoToBottom : undefined,
    enabled: emailOnlyItems.length > 0,
    scopes: ['inbox'],
  })

  // Set inbox scope when this component is active AND no email is selected
  // Story 2.23: When an email is selected, ThreadDetailView sets 'reading' scope - don't override
  useEffect(() => {
    if (!selectedEmailId) {
      setActiveScope('inbox')
    }
  }, [setActiveScope, selectedEmailId])

  // Track previous selectedEmailId to only scroll when it actually changes
  const prevSelectedEmailIdRef = useRef<string | null>(null)

  // Scroll to selected email only when selection changes from outside (e.g., from search)
  // Don't scroll when user clicks an email or when email data changes (e.g., mark read/unread)
  // Story 3.4: Use priority items index when in priority mode
  useEffect(() => {
    const selectionActuallyChanged = selectedEmailId !== prevSelectedEmailIdRef.current
    prevSelectedEmailIdRef.current = selectedEmailId

    if (
      selectedEmailId &&
      emails.length > 0 &&
      selectionActuallyChanged &&
      !selectionFromClickRef.current
    ) {
      let scrollIndex: number
      if (isPriorityMode) {
        scrollIndex = priorityItems.findIndex(
          (item) => item.type === 'email' && item.email.id === selectedEmailId
        )
      } else {
        scrollIndex = emails.findIndex((e) => e.id === selectedEmailId)
      }
      if (scrollIndex >= 0) {
        // Use requestAnimationFrame to ensure virtualizer has updated measurements
        // Use align: 'auto' so it only scrolls if item is outside visible area
        requestAnimationFrame(() => {
          virtualizer.scrollToIndex(scrollIndex, { align: 'auto' })
        })
      }
    }
    // Reset the flag after processing
    selectionFromClickRef.current = false
  }, [selectedEmailId, emails, virtualizer, isPriorityMode, priorityItems])

  // Scroll to top when folder changes (but not when email is selected)
  useEffect(() => {
    if (parentRef.current && !selectedEmailId) {
      parentRef.current.scrollTop = 0
    }
  }, [folder, selectedEmailId])

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
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-slate-700 capitalize">{folder || 'All Emails'}</h2>
          {isPrioritySupported && <ViewModeToggle />}
        </div>
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
            if (isPriorityMode) {
              const item = priorityItems[virtualRow.index]
              if (!item) return null

              if (item.type === 'header') {
                return (
                  <div
                    key={`header-${item.sectionKey}`}
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
                    <PrioritySectionHeader
                      sectionKey={item.sectionKey}
                      priority={item.priority}
                      count={item.count}
                      isCollapsed={item.isCollapsed}
                      onToggle={toggleSection}
                      onEmailDrop={handleEmailDrop(item.priority)}
                    />
                  </div>
                )
              }

              const email = item.email
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
                    isSelected={email.threadId === selectedThreadId}
                    onClick={() => handleEmailClick(email)}
                    draggable
                  />
                </div>
              )
            }

            // Chronological mode (default)
            const email = emails[virtualRow.index]
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
                  isSelected={email.threadId === selectedThreadId}
                  onClick={() => handleEmailClick(email)}
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
