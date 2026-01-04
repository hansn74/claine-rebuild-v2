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
 * Legacy ACs (Story 1.7):
 * - AC1: Displays sender, subject, date, read/unread status
 * - AC2: List sorted by date (newest first)
 * - AC5: Empty state when no emails synced
 * - AC6: Loading state during sync
 */

import { useState, useCallback, useMemo } from 'react'
import { VirtualEmailList } from './VirtualEmailList'
import { ThreadDetailView } from './ThreadDetailView'
import { BulkActionBar } from './BulkActionBar'
import { useEmailStore } from '@/store/emailStore'
import { useSelectionStore } from '@/store/selectionStore'
import { useFolderStore } from '@/store/folderStore'
import { useEmails } from '@/hooks/useEmails'
import { useEmailKeyboardShortcuts } from '@/hooks/useEmailKeyboardShortcuts'
import { useUndoAction } from '@/hooks/useUndoAction'
import type { EmailDocument } from '@/services/database/schemas/email.schema'

interface EmailListProps {
  accountId?: string
}

export function EmailList({ accountId }: EmailListProps) {
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null)

  // Get selected folder from store (Story 2.9)
  const selectedFolder = useFolderStore((state) => state.selectedFolder)

  // Get emails for selection, filtered by folder
  const { emails } = useEmails({ accountId, folder: selectedFolder, sortOrder: 'desc' })
  const emailIds = useMemo(() => emails.map((e) => e.id), [emails])

  // Store actions
  const { archiveEmails, deleteEmails, markAsRead, markAsUnread, isActionLoading } = useEmailStore()

  // Selection state
  const { selectedIds, selectAll, clearSelection } = useSelectionStore()
  const selectedCount = selectedIds.size
  const hasSelection = selectedCount > 0
  const allSelected = selectedCount > 0 && selectedCount === emailIds.length

  // Keyboard shortcuts
  useEmailKeyboardShortcuts({ enabled: true })

  // Undo functionality
  useUndoAction()

  // Handle email selection - now selects by threadId for thread view
  const handleEmailSelect = useCallback((email: EmailDocument) => {
    setSelectedThreadId(email.threadId)
  }, [])

  // Handle back action from thread view
  const handleBack = useCallback(() => {
    setSelectedThreadId(null)
  }, [])

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

      <div className="flex flex-1 overflow-hidden min-w-0">
        {/* Virtualized email list sidebar */}
        <div className="w-96 flex-shrink-0 border-r border-slate-200 flex flex-col">
          <VirtualEmailList
            accountId={accountId}
            folder={selectedFolder} // Filter by selected folder (Story 2.9)
            onEmailSelect={handleEmailSelect}
            selectedEmailId={selectedThreadId} // Using threadId for selection highlight
          />
        </div>

        {/* Thread detail panel */}
        <ThreadDetailView threadId={selectedThreadId} onBack={handleBack} />
      </div>
    </div>
  )
}
