/**
 * useEmailKeyboardShortcuts Hook
 *
 * Story 2.6: Email Actions (Archive, Delete, Mark Read/Unread)
 * Task 6: Implement Keyboard Shortcuts
 *
 * Story 2.11: Keyboard Shortcuts & Power User Features
 * Task 4: Implement Action Shortcuts (e, #, r, f)
 *
 * Story 2.23: Keyboard Shortcut Discoverability
 * Task 6: Integrate tracking into action handlers
 *
 * Custom hook for email action keyboard shortcuts.
 * Now integrated with react-hotkeys-hook via useActionShortcuts.
 *
 * AC 3: Action shortcuts implemented:
 *   - `e` for archive
 *   - `#` for delete
 *   - `r` for reply
 *   - `f` for forward
 *   - `u` for toggle read/unread
 *
 * Features:
 * - Scope-aware (inbox/reading scopes)
 * - Uses react-hotkeys-hook for consistent behavior
 * - Integrates with ShortcutContext
 * - Tracks keyboard vs mouse usage for nudge tooltips
 */

import { useCallback, useEffect, useMemo } from 'react'
import { useEmailStore } from '@/store/emailStore'
import { useSelectionStore } from '@/store/selectionStore'
import { useActionShortcuts } from './useEmailShortcut'
import { useShortcutNudge } from './useShortcutNudge'
import { logger } from '@/services/logger'
import type { EmailDocument } from '@/services/database/schemas/email.schema'

interface UseEmailKeyboardShortcutsOptions {
  /** Whether shortcuts are enabled */
  enabled?: boolean
  /** Currently focused/selected email ID for reply/forward */
  focusedEmailId?: string | null
  /** Scopes to activate shortcuts in */
  scopes?: ('inbox' | 'reading')[]
  /** Callback for reply action (provides emailId) */
  onReply?: (emailId: string) => void
  /** Callback for forward action (provides emailId) */
  onForward?: (emailId: string) => void
  /** Callback for star/unstar action (provides emailId) */
  onStar?: (emailId: string) => void
  /** Email list for auto-advancing to next email after archive/delete */
  emails?: EmailDocument[]
}

/**
 * Keyboard shortcut definitions
 */
export const EMAIL_SHORTCUTS = {
  archive: { key: 'e', description: 'Archive email', action: 'archive' },
  delete: { key: '#', description: 'Delete email', action: 'delete' },
  toggleRead: { key: 'u', description: 'Toggle read/unread', action: 'toggleRead' },
  reply: { key: 'r', description: 'Reply to email', action: 'reply' },
  forward: { key: 'f', description: 'Forward email', action: 'forward' },
  move: { key: 'v', description: 'Move to folder', action: 'move' },
  help: { key: '?', description: 'Show keyboard shortcuts', action: 'help' },
} as const

/**
 * useEmailKeyboardShortcuts - Hook for email action shortcuts
 *
 * Story 2.11: Now uses react-hotkeys-hook via useActionShortcuts
 * for better scope management and consistency.
 *
 * Usage:
 * ```tsx
 * function EmailView() {
 *   useEmailKeyboardShortcuts({
 *     enabled: true,
 *     scopes: ['inbox', 'reading'],
 *     onReply: (emailId) => openReplyDialog(emailId),
 *     onForward: (emailId) => openForwardDialog(emailId),
 *   })
 *
 *   // ... rest of component
 * }
 * ```
 */
export function useEmailKeyboardShortcuts({
  enabled = true,
  focusedEmailId,
  scopes = ['inbox', 'reading'],
  onReply,
  onForward,
  onStar,
  emails = [],
}: UseEmailKeyboardShortcutsOptions = {}) {
  const {
    selectedEmailId,
    selectedThreadId,
    archiveEmail,
    deleteEmail,
    toggleReadStatus,
    archiveEmails,
    deleteEmails,
    markAsRead,
    markAsUnread,
    setSelectedEmail,
  } = useEmailStore()

  // Select values individually to avoid creating new object references
  const selectedIds = useSelectionStore((state) => state.selectedIds)
  const hasSelection = useMemo(() => selectedIds.size > 0, [selectedIds])

  // Story 2.23: Track keyboard usage for nudge system
  const { recordKeyboardAction } = useShortcutNudge()

  /**
   * Get the IDs to act on (selected or focused)
   */
  const getTargetIds = useCallback((): string[] => {
    // If multiple selected, use selection
    if (hasSelection && selectedIds.size > 0) {
      return Array.from(selectedIds)
    }

    // Use explicitly provided focused email ID
    if (focusedEmailId) {
      return [focusedEmailId]
    }

    // Fall back to store's selected email
    if (selectedEmailId) {
      return [selectedEmailId]
    }

    return []
  }, [hasSelection, selectedIds, focusedEmailId, selectedEmailId])

  /**
   * Handle archive shortcut (e key)
   * Auto-advances to next email after archiving single email
   */
  const handleArchive = useCallback(async () => {
    const targetIds = getTargetIds()
    if (targetIds.length === 0) return

    // Story 2.23: Track keyboard usage
    recordKeyboardAction('archive')
    logger.info('keyboard', 'Archive shortcut triggered', { count: targetIds.length })

    if (targetIds.length === 1) {
      // Find current index and determine next email before archiving
      const currentId = targetIds[0]
      const currentIndex = emails.findIndex((e) => e.id === currentId)
      const nextEmail = emails[currentIndex + 1] || emails[currentIndex - 1]

      // Set selection to next email BEFORE archive to avoid race conditions
      if (nextEmail) {
        setSelectedEmail(nextEmail.id, nextEmail.threadId)
      }

      await archiveEmail(currentId)
    } else {
      await archiveEmails(targetIds)
    }
  }, [getTargetIds, archiveEmail, archiveEmails, emails, setSelectedEmail, recordKeyboardAction])

  /**
   * Handle delete shortcut (# key)
   * Auto-advances to next email after deleting single email
   */
  const handleDelete = useCallback(async () => {
    const targetIds = getTargetIds()
    if (targetIds.length === 0) return

    // Story 2.23: Track keyboard usage
    recordKeyboardAction('delete')
    logger.info('keyboard', 'Delete shortcut triggered', { count: targetIds.length })

    if (targetIds.length === 1) {
      // Find current index and determine next email before deleting
      const currentId = targetIds[0]
      const currentIndex = emails.findIndex((e) => e.id === currentId)
      const nextEmail = emails[currentIndex + 1] || emails[currentIndex - 1]

      // Set selection to next email BEFORE delete to avoid race conditions
      if (nextEmail) {
        setSelectedEmail(nextEmail.id, nextEmail.threadId)
      }

      await deleteEmail(currentId)
    } else {
      await deleteEmails(targetIds)
    }
  }, [getTargetIds, deleteEmail, deleteEmails, emails, setSelectedEmail, recordKeyboardAction])

  /**
   * Handle toggle read shortcut (u key)
   */
  const handleToggleRead = useCallback(async () => {
    const targetIds = getTargetIds()
    if (targetIds.length === 0) return

    // Story 2.23: Track keyboard usage
    recordKeyboardAction('toggleRead')
    logger.info('keyboard', 'Toggle read shortcut triggered', { count: targetIds.length })

    for (const id of targetIds) {
      await toggleReadStatus(id)
    }
  }, [getTargetIds, toggleReadStatus, recordKeyboardAction])

  /**
   * Handle mark as read shortcut (Shift+I)
   */
  const handleMarkRead = useCallback(async () => {
    const targetIds = getTargetIds()
    if (targetIds.length === 0) return

    // Story 2.23: Track keyboard usage
    recordKeyboardAction('markRead')
    logger.info('keyboard', 'Mark read shortcut triggered', { count: targetIds.length })
    await markAsRead(targetIds)
  }, [getTargetIds, markAsRead, recordKeyboardAction])

  /**
   * Handle mark as unread shortcut (Shift+U)
   */
  const handleMarkUnread = useCallback(async () => {
    const targetIds = getTargetIds()
    if (targetIds.length === 0) return

    // Story 2.23: Track keyboard usage
    recordKeyboardAction('markUnread')
    logger.info('keyboard', 'Mark unread shortcut triggered', { count: targetIds.length })
    await markAsUnread(targetIds)
  }, [getTargetIds, markAsUnread, recordKeyboardAction])

  /**
   * Handle reply shortcut (r key)
   * Story 2.11 Task 4: Reply triggers callback with email ID
   */
  const handleReply = useCallback(() => {
    const targetIds = getTargetIds()
    if (targetIds.length === 0) return

    // Story 2.23: Track keyboard usage
    recordKeyboardAction('reply')
    logger.info('keyboard', 'Reply shortcut triggered', { emailId: targetIds[0] })
    onReply?.(targetIds[0])
  }, [getTargetIds, onReply, recordKeyboardAction])

  /**
   * Handle forward shortcut (f key)
   * Story 2.11 Task 4: Forward triggers callback with email ID
   */
  const handleForward = useCallback(() => {
    const targetIds = getTargetIds()
    if (targetIds.length === 0) return

    // Story 2.23: Track keyboard usage
    recordKeyboardAction('forward')
    logger.info('keyboard', 'Forward shortcut triggered', { emailId: targetIds[0] })
    onForward?.(targetIds[0])
  }, [getTargetIds, onForward, recordKeyboardAction])

  /**
   * Handle star shortcut (s key)
   */
  const handleStar = useCallback(() => {
    const targetIds = getTargetIds()
    if (targetIds.length === 0) return

    // Story 2.23: Track keyboard usage
    recordKeyboardAction('star')
    logger.info('keyboard', 'Star shortcut triggered', { emailId: targetIds[0] })
    onStar?.(targetIds[0])
  }, [getTargetIds, onStar, recordKeyboardAction])

  /**
   * Handle select shortcut (x key)
   * Uses threadId for selection to match EmailRow which uses email.threadId || email.id
   */
  const handleSelect = useCallback(() => {
    // For selection, use threadId to match EmailRow's selectionId (email.threadId || email.id)
    const selectionId = selectedThreadId || selectedEmailId
    if (!selectionId) return

    const { toggleSelect } = useSelectionStore.getState()
    toggleSelect(selectionId)
    logger.info('keyboard', 'Select shortcut triggered', {
      selectionId,
      threadId: selectedThreadId,
      emailId: selectedEmailId,
    })
  }, [selectedThreadId, selectedEmailId])

  // Register action shortcuts using the new hook system (Story 2.11)
  // Note: r, f, s are handled via direct event listener below (react-hotkeys-hook workaround)
  useActionShortcuts({
    onArchive: handleArchive,
    onDelete: handleDelete,
    // onReply, onForward, onStar removed - handled by direct event listener
    onToggleRead: handleToggleRead,
    onMarkRead: handleMarkRead,
    onMarkUnread: handleMarkUnread,
    onSelect: handleSelect,
    enabled,
    scopes,
  })

  // Direct event listener for r, f, s shortcuts (react-hotkeys-hook workaround)
  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger in form fields
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }

      // Don't trigger with modifier keys
      if (e.ctrlKey || e.metaKey || e.altKey) return

      const key = e.key.toLowerCase()

      switch (key) {
        case 'r':
          if (onReply) {
            e.preventDefault()
            handleReply()
          }
          break
        case 'f':
          if (onForward) {
            e.preventDefault()
            handleForward()
          }
          break
        case 's':
          if (onStar) {
            e.preventDefault()
            handleStar()
          }
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [enabled, onReply, onForward, onStar, handleReply, handleForward, handleStar])

  // Return shortcut info for UI
  return {
    shortcuts: EMAIL_SHORTCUTS,
    isEnabled: enabled,
  }
}

/**
 * Get all keyboard shortcuts for help display
 */
export function getEmailShortcutsForHelp() {
  return [
    { key: 'e', description: 'Archive email' },
    { key: '#', description: 'Delete email' },
    { key: 'u', description: 'Toggle read/unread' },
    { key: 'v', description: 'Move to folder' },
    { key: '?', description: 'Show keyboard shortcuts' },
    { key: '/', description: 'Open search' },
    { key: 'c', description: 'Compose new email' },
    { key: '⌘K', description: 'Quick search' },
  ]
}
