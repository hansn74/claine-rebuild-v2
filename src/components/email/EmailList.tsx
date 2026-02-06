/**
 * EmailList Component
 * Displays a virtualized, scrollable list of emails with selection support
 *
 * Story 2.1: Virtualized Inbox Rendering
 * - AC1: @tanstack/react-virtual implemented for inbox list
 * - AC2: Only visible emails rendered in DOM (20-30 rows buffer)
 * - AC3: Smooth 60 FPS scrolling with 10,000+ emails
 * - AC4: Dynamic row heights supported
 * - AC5: Scroll position preserved when navigating back to inbox
 * - AC6: Performance benchmarked: <50ms scroll interaction time
 *
 * Story 2.2: Thread Detail View with Conversation History
 * - Updated to use ThreadDetailView for full conversation display
 * - Selection now passes threadId to detail view
 *
 * Story 2.6: Email Actions (Archive, Delete, Mark Read/Unread)
 * - AC1-3: Archive, delete, mark read/unread actions
 * - AC4: Keyboard shortcuts (e, #, u)
 * - AC5: Bulk actions with multi-select
 * - AC6: Undo for destructive actions
 *
 * Story 2.20: Pre-Render Adjacent Email Thread Views
 * - AC1-7: Pre-render engine with resource management
 * - AC11-14: Integration with keyboard/click/search navigation
 * - AC15-17: Performance targets (<5ms swap time)
 *
 * Legacy ACs (Story 1.7):
 * - AC1: Displays sender, subject, date, read/unread status
 * - AC2: List sorted by date (newest first)
 * - AC5: Empty state when no emails synced
 * - AC6: Loading state during sync
 */

import { useCallback, useMemo, memo, useEffect, useRef } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { VirtualEmailList } from './VirtualEmailList'
import { ThreadDetailView } from './ThreadDetailView'
import { BulkActionBar } from './BulkActionBar'
import { useEmailStore } from '@/store/emailStore'
import { useSelectionStore } from '@/store/selectionStore'
import { useFolderStore } from '@/store/folderStore'
import { useComposeStore } from '@/store/composeStore'
import { useEmails } from '@/hooks/useEmails'
import { useEmailKeyboardShortcuts } from '@/hooks/useEmailKeyboardShortcuts'
import { useUndoAction } from '@/hooks/useUndoAction'
import { usePreRenderManager } from '@/hooks/usePreRenderManager'
import { getDatabase } from '@/services/database/init'
import { logger } from '@/services/logger'
import type { EmailDocument } from '@/services/database/schemas/email.schema'
import type { ComposeContext } from '@/components/compose/ComposeDialog'

/**
 * Hidden pre-render container for off-screen ThreadDetailView rendering.
 * Renders the ThreadDetailView in DOM but positioned off-screen so React
 * processes the component tree without the user seeing it.
 *
 * Story 2.20: Task 3.3 — Wrapped in React.memo to prevent re-renders
 * when only the visible thread changes.
 */
const PreRenderContainer = memo(function PreRenderContainer({
  threadId,
  onReady,
  label,
}: {
  threadId: string | null
  onReady: () => void
  label: 'next' | 'prev'
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Notify parent when ThreadDetailView has loaded actual content.
  // Uses MutationObserver to detect when the loading spinner is replaced
  // by real thread content (sticky header), ensuring the pre-rendered
  // view is truly ready for an instant swap.
  useEffect(() => {
    if (!threadId || !containerRef.current) return

    const checkReady = (): boolean => {
      const el = containerRef.current
      if (!el) return false
      // ThreadDetailView shows .animate-spin during loading
      const hasSpinner = el.querySelector('.animate-spin')
      // Actual thread content has a sticky header
      const hasContent = el.querySelector('.sticky')
      return !hasSpinner && !!hasContent
    }

    // Already loaded (cached data)
    if (checkReady()) {
      onReady()
      return
    }

    const observer = new MutationObserver(() => {
      if (checkReady()) {
        observer.disconnect()
        onReady()
      }
    })

    observer.observe(containerRef.current, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [threadId, onReady])

  if (!threadId) return null

  return (
    <div
      ref={containerRef}
      data-prerender={label}
      aria-hidden="true"
      // @ts-expect-error -- inert is a valid HTML attribute but not yet in React types
      inert=""
      style={{
        position: 'absolute',
        left: '-9999px',
        width: 'calc(100% - 1040px)',
        height: '100%',
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      <ThreadDetailView threadId={threadId} />
    </div>
  )
})

interface EmailListProps {
  accountId?: string
}

export function EmailList({ accountId }: EmailListProps) {
  // Use store for selected email/thread so it can be set from search
  const selectedEmailId = useEmailStore((state) => state.selectedEmailId)
  const selectedThreadId = useEmailStore((state) => state.selectedThreadId)
  const setSelectedEmail = useEmailStore((state) => state.setSelectedEmail)

  // Get selected folder from store (Story 2.9)
  const selectedFolder = useFolderStore((state) => state.selectedFolder)

  // Get emails for selection, filtered by folder
  const { emails } = useEmails({ accountId, folder: selectedFolder, sortOrder: 'desc' })

  // Story 2.20: Single-pass mapping for both email IDs and pre-render items
  const { emailIds, emailItems } = useMemo(() => {
    const ids: string[] = []
    const items: { id: string; threadId: string }[] = []
    for (const e of emails) {
      ids.push(e.id)
      items.push({ id: e.id, threadId: e.threadId })
    }
    return { emailIds: ids, emailItems: items }
  }, [emails])
  const preRender = usePreRenderManager(selectedEmailId, emailItems)

  // Store actions
  const { archiveEmails, deleteEmails, markAsRead, markAsUnread, isActionLoading } = useEmailStore()

  // Compose store for reply/forward
  const openComposeWithContext = useComposeStore((state) => state.openComposeWithContext)

  // Selection state
  const { selectedIds, selectAll, clearSelection } = useSelectionStore()
  const selectedCount = selectedIds.size
  const hasSelection = selectedCount > 0
  const allSelected = selectedCount > 0 && selectedCount === emailIds.length

  // Keyboard shortcut handlers
  const handleReply = useCallback(
    async (emailId: string) => {
      try {
        const db = getDatabase()
        const emailDoc = await db.emails.findOne(emailId).exec()
        if (emailDoc) {
          const email = emailDoc.toJSON()
          const context: ComposeContext = {
            type: 'reply',
            to: [email.from],
            cc: [],
            subject: email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`,
            quotedContent: `<br><br><div style="border-left: 2px solid #ccc; padding-left: 10px; margin-left: 10px;">On ${new Date(email.timestamp).toLocaleString()}, ${email.from.name || email.from.email} wrote:<br>${email.body?.html || email.body?.text || ''}</div>`,
            replyToEmailId: email.id,
            threadId: email.threadId,
          }
          openComposeWithContext(context)
        }
      } catch (err) {
        logger.error('keyboard', 'Failed to initiate reply', { error: err })
      }
    },
    [openComposeWithContext]
  )

  const handleForward = useCallback(
    async (emailId: string) => {
      try {
        const db = getDatabase()
        const emailDoc = await db.emails.findOne(emailId).exec()
        if (emailDoc) {
          const email = emailDoc.toJSON()
          const context: ComposeContext = {
            type: 'forward',
            to: [],
            cc: [],
            subject: email.subject.startsWith('Fwd:') ? email.subject : `Fwd: ${email.subject}`,
            quotedContent: `<br><br><div style="border-left: 2px solid #ccc; padding-left: 10px; margin-left: 10px;">---------- Forwarded message ---------<br>From: ${email.from.name || email.from.email}<br>Date: ${new Date(email.timestamp).toLocaleString()}<br>Subject: ${email.subject}<br><br>${email.body?.html || email.body?.text || ''}</div>`,
            replyToEmailId: email.id,
            threadId: email.threadId,
          }
          openComposeWithContext(context)
        }
      } catch (err) {
        logger.error('keyboard', 'Failed to initiate forward', { error: err })
      }
    },
    [openComposeWithContext]
  )

  const handleStar = useCallback(async (emailId: string) => {
    try {
      const db = getDatabase()
      const emailDoc = await db.emails.findOne(emailId).exec()
      if (emailDoc) {
        const email = emailDoc.toJSON()
        const newStarred = !email.starred
        const newLabels = newStarred
          ? [...email.labels.filter((l: string) => l !== 'STARRED'), 'STARRED']
          : email.labels.filter((l: string) => l !== 'STARRED')
        await emailDoc.patch({
          starred: newStarred,
          labels: newLabels,
        })
        logger.info('keyboard', `Email ${newStarred ? 'starred' : 'unstarred'}`, { emailId })
      }
    } catch (err) {
      logger.error('keyboard', 'Failed to toggle star', { error: err })
    }
  }, [])

  // Keyboard shortcuts - pass emails for auto-advance after archive/delete
  useEmailKeyboardShortcuts({
    enabled: true,
    onReply: handleReply,
    onForward: handleForward,
    onStar: handleStar,
    emails,
  })

  // Undo functionality
  useUndoAction()

  // Get openDraft from compose store
  const openDraft = useComposeStore((state) => state.openDraft)

  // Story 2.20: Destructure pre-render values for stable useCallback dependencies
  const {
    nextReady: preNextReady,
    prevReady: prePrevReady,
    nextThreadId: preNextThreadId,
    prevThreadId: prePrevThreadId,
    consumeNext: preConsumeNext,
    consumePrev: preConsumePrev,
  } = preRender

  // Handle email selection - now selects by threadId for thread view
  // Story 2.20: Check pre-rendered views before setting state (Task 4.1, 4.3, 4.4)
  // Special handling for drafts folder: open compose dialog instead
  const handleEmailSelect = useCallback(
    (email: EmailDocument) => {
      // If viewing drafts folder, open the draft in compose dialog
      if (selectedFolder === 'drafts' && email.folder === 'drafts') {
        openDraft(email.id)
        return
      }

      // Story 2.20 Task 5.1: Performance measurement for thread swap
      const isPreRenderedNext = preNextReady && preNextThreadId === email.threadId
      const isPreRenderedPrev = prePrevReady && prePrevThreadId === email.threadId

      if (isPreRenderedNext || isPreRenderedPrev) {
        // Pre-rendered view available — instant swap
        setSelectedEmail(email.id, email.threadId)

        // Task 5.1: Measure swap time (dev only)
        if (import.meta.env.DEV) {
          performance.mark('thread-swap-start')
          requestAnimationFrame(() => {
            performance.mark('thread-swap-end')
            performance.measure('thread-swap', 'thread-swap-start', 'thread-swap-end')
            const measure = performance.getEntriesByName('thread-swap').pop()
            if (measure) {
              logger.debug('performance', 'Pre-render swap completed', {
                duration: measure.duration.toFixed(2) + 'ms',
                direction: isPreRenderedNext ? 'next' : 'prev',
              })
            }
            performance.clearMarks('thread-swap-start')
            performance.clearMarks('thread-swap-end')
            performance.clearMeasures('thread-swap')
          })
        }

        // Task 4.4: Consume the pre-rendered view to trigger new adjacent computation
        if (isPreRenderedNext) {
          preConsumeNext()
        } else {
          preConsumePrev()
        }
      } else {
        // Task 4.3: Fallback — no pre-rendered view available
        logger.debug('performance', 'Pre-render miss, falling back to normal render', {
          targetThreadId: email.threadId,
          nextThreadId: preNextThreadId,
          prevThreadId: prePrevThreadId,
        })
        setSelectedEmail(email.id, email.threadId)
      }
    },
    [
      setSelectedEmail,
      selectedFolder,
      openDraft,
      preNextReady,
      prePrevReady,
      preNextThreadId,
      prePrevThreadId,
      preConsumeNext,
      preConsumePrev,
    ]
  )

  // Handle back action from thread view
  const handleBack = useCallback(() => {
    setSelectedEmail(null, null)
  }, [setSelectedEmail])

  // Story 2.11: Escape key to deselect/go back to list view
  useHotkeys(
    'escape',
    () => {
      if (selectedThreadId) {
        handleBack()
      }
    },
    { enabled: !!selectedThreadId },
    [selectedThreadId, handleBack]
  )

  // Bulk action handlers
  const handleBulkArchive = useCallback(async () => {
    if (selectedCount === 0) return
    await archiveEmails(Array.from(selectedIds))
    clearSelection()
  }, [selectedIds, selectedCount, archiveEmails, clearSelection])

  const handleBulkDelete = useCallback(async () => {
    if (selectedCount === 0) return
    await deleteEmails(Array.from(selectedIds))
    clearSelection()
  }, [selectedIds, selectedCount, deleteEmails, clearSelection])

  const handleBulkMarkRead = useCallback(async () => {
    if (selectedCount === 0) return
    await markAsRead(Array.from(selectedIds))
    clearSelection()
  }, [selectedIds, selectedCount, markAsRead, clearSelection])

  const handleBulkMarkUnread = useCallback(async () => {
    if (selectedCount === 0) return
    await markAsUnread(Array.from(selectedIds))
    clearSelection()
  }, [selectedIds, selectedCount, markAsUnread, clearSelection])

  const handleSelectAll = useCallback(() => {
    selectAll(emailIds)
  }, [emailIds, selectAll])

  // Story 2.20 Task 7.5: Expose pre-render state for E2E testing
  useEffect(() => {
    if (import.meta.env.DEV) {
      ;(window as Record<string, unknown>).__TEST_PRERENDER__ = {
        nextThreadId: preRender.nextThreadId,
        prevThreadId: preRender.prevThreadId,
        nextReady: preRender.nextReady,
        prevReady: preRender.prevReady,
      }
    }
    return () => {
      if (import.meta.env.DEV) {
        delete (window as Record<string, unknown>).__TEST_PRERENDER__
      }
    }
  }, [preRender.nextThreadId, preRender.prevThreadId, preRender.nextReady, preRender.prevReady])

  // Email list with thread detail view
  return (
    <div className="flex h-full flex-col">
      {/* Bulk action bar - shown when emails are selected */}
      {hasSelection && (
        <BulkActionBar
          selectedCount={selectedCount}
          totalCount={emailIds.length}
          onArchive={handleBulkArchive}
          onDelete={handleBulkDelete}
          onMarkRead={handleBulkMarkRead}
          onMarkUnread={handleBulkMarkUnread}
          onSelectAll={handleSelectAll}
          onClearSelection={clearSelection}
          allSelected={allSelected}
          isLoading={isActionLoading}
        />
      )}

      <div className="flex flex-1 overflow-hidden min-w-0 relative">
        {/* Virtualized email list sidebar */}
        <div className="w-[1040px] flex-shrink-0 border-r border-slate-200 flex flex-col">
          <VirtualEmailList
            accountId={accountId}
            folder={selectedFolder} // Filter by selected folder (Story 2.9)
            onEmailSelect={handleEmailSelect}
            selectedEmailId={selectedEmailId} // Actual email ID for j/k navigation
            selectedThreadId={selectedThreadId} // Thread ID for visual highlight
          />
        </div>

        {/* Thread detail panel */}
        <ThreadDetailView threadId={selectedThreadId} onBack={handleBack} />

        {/* Story 2.20: Hidden pre-render containers (Task 3.1, 3.2) */}
        <PreRenderContainer
          threadId={preRender.nextThreadId}
          onReady={preRender.setNextReady}
          label="next"
        />
        <PreRenderContainer
          threadId={preRender.prevThreadId}
          onReady={preRender.setPrevReady}
          label="prev"
        />
      </div>
    </div>
  )
}
