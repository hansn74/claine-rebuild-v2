/**
 * EmailActionBar Component
 *
 * Story 2.6: Email Actions (Archive, Delete, Mark Read/Unread)
 * Task 4.1: Create EmailActionBar with archive, delete, read/unread buttons
 *
 * Story 2.3: Compose & Reply Interface
 * AC 2: Reply/Reply-all/Forward actions available in thread view
 *
 * Story 2.9: Email Folders & Labels
 * AC 4: Move to folder dropdown integration
 *
 * Action bar displayed in email list and thread detail view.
 * Provides buttons for reply, archive, delete, and mark read/unread actions.
 */

import { Archive, Trash2, Mail, MailOpen, Reply, ReplyAll, Forward } from 'lucide-react'
import { cn } from '@/utils/cn'
import { EmailActionButton } from './EmailActionButton'
import { MoveToFolderDropdown } from './MoveToFolderDropdown'

interface EmailActionBarProps {
  /** Whether the email is currently read */
  isRead: boolean
  /** Handler for archive action */
  onArchive: () => void
  /** Handler for delete action */
  onDelete: () => void
  /** Handler for toggle read/unread action */
  onToggleRead: () => void
  /** Handler for reply action */
  onReply?: () => void
  /** Handler for reply-all action */
  onReplyAll?: () => void
  /** Handler for forward action */
  onForward?: () => void
  /** Whether actions are currently loading */
  isLoading?: boolean
  /** Whether to show in compact mode (icon only) */
  compact?: boolean
  /** Additional className */
  className?: string
  /** Email ID(s) for move-to-folder functionality (AC 4) */
  emailIds?: string | string[]
  /** Current folder for move-to-folder (to disable current option) */
  currentFolder?: string
  /** Callback when move completes (for auto-advance) */
  onMoveComplete?: () => void
}

/**
 * EmailActionBar - Actions for a single email
 *
 * Usage:
 * ```tsx
 * <EmailActionBar
 *   isRead={email.read}
 *   onArchive={() => archiveEmail(email.id)}
 *   onDelete={() => deleteEmail(email.id)}
 *   onToggleRead={() => toggleReadStatus(email.id)}
 * />
 * ```
 */
export function EmailActionBar({
  isRead,
  onArchive,
  onDelete,
  onToggleRead,
  onReply,
  onReplyAll,
  onForward,
  isLoading = false,
  compact = false,
  className,
  emailIds,
  currentFolder,
  onMoveComplete,
}: EmailActionBarProps) {
  return (
    <div
      className={cn('flex items-center gap-1', compact ? 'gap-0.5' : 'gap-1', className)}
      role="toolbar"
      aria-label="Email actions"
    >
      {/* Reply button */}
      {onReply && (
        <EmailActionButton
          icon={<Reply className={compact ? 'w-4 h-4' : 'w-4 h-4'} />}
          label={compact ? '' : 'Reply'}
          tooltip="Reply (r)"
          onClick={onReply}
          disabled={isLoading}
          variant="ghost"
          size={compact ? 'icon' : 'sm'}
        />
      )}

      {/* Reply All button */}
      {onReplyAll && (
        <EmailActionButton
          icon={<ReplyAll className={compact ? 'w-4 h-4' : 'w-4 h-4'} />}
          label={compact ? '' : 'Reply All'}
          tooltip="Reply All (Shift+r)"
          onClick={onReplyAll}
          disabled={isLoading}
          variant="ghost"
          size={compact ? 'icon' : 'sm'}
        />
      )}

      {/* Forward button */}
      {onForward && (
        <EmailActionButton
          icon={<Forward className={compact ? 'w-4 h-4' : 'w-4 h-4'} />}
          label={compact ? '' : 'Forward'}
          tooltip="Forward (f)"
          onClick={onForward}
          disabled={isLoading}
          variant="ghost"
          size={compact ? 'icon' : 'sm'}
        />
      )}

      {/* Separator between reply and organize actions */}
      {(onReply || onReplyAll || onForward) && (
        <div className="w-px h-5 bg-slate-200 mx-1" aria-hidden="true" />
      )}

      {/* Archive button */}
      <EmailActionButton
        icon={<Archive className={compact ? 'w-4 h-4' : 'w-4 h-4'} />}
        label={compact ? '' : 'Archive'}
        tooltip="Archive (e)"
        onClick={onArchive}
        disabled={isLoading}
        variant="ghost"
        size={compact ? 'icon' : 'sm'}
      />

      {/* Delete button */}
      <EmailActionButton
        icon={<Trash2 className={compact ? 'w-4 h-4' : 'w-4 h-4'} />}
        label={compact ? '' : 'Delete'}
        tooltip="Delete (#)"
        onClick={onDelete}
        disabled={isLoading}
        variant="ghost"
        size={compact ? 'icon' : 'sm'}
        destructive
      />

      {/* Move to folder dropdown (AC 4) */}
      {emailIds && (
        <MoveToFolderDropdown
          emailIds={emailIds}
          currentFolder={currentFolder}
          onMoveComplete={onMoveComplete}
          variant="icon"
          disabled={isLoading}
        />
      )}

      {/* Toggle read/unread button */}
      <EmailActionButton
        icon={
          isRead ? (
            <MailOpen className={compact ? 'w-4 h-4' : 'w-4 h-4'} />
          ) : (
            <Mail className={compact ? 'w-4 h-4' : 'w-4 h-4'} />
          )
        }
        label={compact ? '' : isRead ? 'Mark unread' : 'Mark read'}
        tooltip={isRead ? 'Mark as unread (u)' : 'Mark as read (u)'}
        onClick={onToggleRead}
        disabled={isLoading}
        variant="ghost"
        size={compact ? 'icon' : 'sm'}
      />
    </div>
  )
}
