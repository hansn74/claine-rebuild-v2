/**
 * BulkActionBar Component
 *
 * Story 2.6: Email Actions (Archive, Delete, Mark Read/Unread)
 * Task 4.4: Create BulkActionBar for multi-select mode
 *
 * Action bar displayed when multiple emails are selected.
 * Shows selected count and bulk action buttons.
 *
 * AC 5: Bulk actions available (select multiple emails, apply action to all)
 */

import { Archive, Trash2, Mail, MailOpen, X, CheckSquare, Square } from 'lucide-react'
import { cn } from '@/utils/cn'
import { EmailActionButton } from './EmailActionButton'

interface BulkActionBarProps {
  /** Number of selected emails */
  selectedCount: number
  /** Total number of emails in the list */
  totalCount: number
  /** Handler for archive action */
  onArchive: () => void
  /** Handler for delete action */
  onDelete: () => void
  /** Handler for mark as read action */
  onMarkRead: () => void
  /** Handler for mark as unread action */
  onMarkUnread: () => void
  /** Handler for select all */
  onSelectAll: () => void
  /** Handler for clear selection */
  onClearSelection: () => void
  /** Whether all emails are selected */
  allSelected: boolean
  /** Whether actions are currently loading */
  isLoading?: boolean
  /** Additional className */
  className?: string
}

/**
 * BulkActionBar - Actions for multiple selected emails
 *
 * Usage:
 * ```tsx
 * <BulkActionBar
 *   selectedCount={selectedIds.size}
 *   totalCount={emails.length}
 *   onArchive={() => archiveEmails(Array.from(selectedIds))}
 *   onDelete={() => deleteEmails(Array.from(selectedIds))}
 *   onMarkRead={() => markAsRead(Array.from(selectedIds))}
 *   onMarkUnread={() => markAsUnread(Array.from(selectedIds))}
 *   onSelectAll={handleSelectAll}
 *   onClearSelection={clearSelection}
 *   allSelected={selectedIds.size === emails.length}
 * />
 * ```
 */
export function BulkActionBar({
  selectedCount,
  totalCount,
  onArchive,
  onDelete,
  onMarkRead,
  onMarkUnread,
  onSelectAll,
  onClearSelection,
  allSelected,
  isLoading = false,
  className,
}: BulkActionBarProps) {
  if (selectedCount === 0) {
    return null
  }

  return (
    <div
      className={cn(
        'flex items-center justify-between px-4 py-2 bg-cyan-50 border-b border-cyan-200',
        className
      )}
      role="toolbar"
      aria-label="Bulk email actions"
    >
      {/* Left side: Selection info and toggle */}
      <div className="flex items-center gap-3">
        {/* Select all / Deselect all toggle */}
        <button
          type="button"
          onClick={allSelected ? onClearSelection : onSelectAll}
          className={cn(
            'flex items-center gap-2 text-sm text-cyan-700 hover:text-cyan-900',
            'focus:outline-none focus:underline'
          )}
          aria-label={allSelected ? 'Deselect all' : 'Select all'}
        >
          {allSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
        </button>

        {/* Selection count */}
        <span className="text-sm font-medium text-cyan-800">
          {selectedCount} {selectedCount === 1 ? 'email' : 'emails'} selected
          {totalCount > 0 && <span className="text-cyan-600 font-normal"> of {totalCount}</span>}
        </span>
      </div>

      {/* Center: Bulk action buttons */}
      <div className="flex items-center gap-1">
        {/* Archive all */}
        <EmailActionButton
          icon={<Archive className="w-4 h-4" />}
          label="Archive"
          tooltip={`Archive ${selectedCount} ${selectedCount === 1 ? 'email' : 'emails'}`}
          onClick={onArchive}
          disabled={isLoading}
          variant="ghost"
          size="sm"
        />

        {/* Delete all */}
        <EmailActionButton
          icon={<Trash2 className="w-4 h-4" />}
          label="Delete"
          tooltip={`Delete ${selectedCount} ${selectedCount === 1 ? 'email' : 'emails'}`}
          onClick={onDelete}
          disabled={isLoading}
          variant="ghost"
          size="sm"
          destructive
        />

        {/* Divider */}
        <div className="w-px h-5 bg-cyan-200 mx-1" />

        {/* Mark as read */}
        <EmailActionButton
          icon={<Mail className="w-4 h-4" />}
          label="Mark read"
          tooltip="Mark all as read"
          onClick={onMarkRead}
          disabled={isLoading}
          variant="ghost"
          size="sm"
        />

        {/* Mark as unread */}
        <EmailActionButton
          icon={<MailOpen className="w-4 h-4" />}
          label="Mark unread"
          tooltip="Mark all as unread"
          onClick={onMarkUnread}
          disabled={isLoading}
          variant="ghost"
          size="sm"
        />
      </div>

      {/* Right side: Clear selection */}
      <button
        type="button"
        onClick={onClearSelection}
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded text-sm text-cyan-600',
          'hover:bg-cyan-100 focus:outline-none focus:ring-2 focus:ring-cyan-500'
        )}
        aria-label="Clear selection"
      >
        <X className="w-4 h-4" />
        <span className="hidden sm:inline">Clear</span>
      </button>
    </div>
  )
}
