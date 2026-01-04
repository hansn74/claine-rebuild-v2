/**
 * EmailActionBar Component
 *
 * Story 2.6: Email Actions (Archive, Delete, Mark Read/Unread)
 * Task 4.1: Create EmailActionBar with archive, delete, read/unread buttons
 *
 * Action bar displayed in email list and thread detail view.
 * Provides buttons for archive, delete, and mark read/unread actions.
 *
 * AC 1: Archive button removes email from inbox
 * AC 2: Delete button moves email to Trash
 * AC 3: Mark as read/unread toggles unread status
 */

import { Archive, Trash2, Mail, MailOpen } from 'lucide-react'
import { cn } from '@/utils/cn'
import { EmailActionButton } from './EmailActionButton'

interface EmailActionBarProps {
  /** Whether the email is currently read */
  isRead: boolean
  /** Handler for archive action */
  onArchive: () => void
  /** Handler for delete action */
  onDelete: () => void
  /** Handler for toggle read/unread action */
  onToggleRead: () => void
  /** Whether actions are currently loading */
  isLoading?: boolean
  /** Whether to show in compact mode (icon only) */
  compact?: boolean
  /** Additional className */
  className?: string
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
  isLoading = false,
  compact = false,
  className,
}: EmailActionBarProps) {
  return (
    <div
      className={cn('flex items-center gap-1', compact ? 'gap-0.5' : 'gap-1', className)}
      role="toolbar"
      aria-label="Email actions"
    >
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
