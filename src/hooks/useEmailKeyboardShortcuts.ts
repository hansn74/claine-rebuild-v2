/**
 * useEmailKeyboardShortcuts Hook
 *
 * Story 2.6: Email Actions (Archive, Delete, Mark Read/Unread)
 * Task 6: Implement Keyboard Shortcuts
 *
 * Story 2.11: Keyboard Shortcuts & Power User Features
 * Task 4: Implement Action Shortcuts (e, #, r, f)
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
 */

import { useCallback, useMemo } from 'react'
import { useEmailStore } from '@/store/emailStore'
import { useSelectionStore } from '@/store/selectionStore'
import { useActionShortcuts } from './useEmailShortcut'
import { logger } from '@/services/logger'

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
}: UseEmailKeyboardShortcutsOptions = {}) {
  const {
    selectedEmailId,
    archiveEmail,
    deleteEmail,
    toggleReadStatus,
    archiveEmails,
    deleteEmails,
  } = useEmailStore()

  // Select values individually to avoid creating new object references
  const selectedIds = useSelectionStore((state) => state.selectedIds)
  const hasSelection = useMemo(() => selectedIds.size > 0, [selectedIds])

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
   */
  const handleArchive = useCallback(async () => {
    const targetIds = getTargetIds()
    if (targetIds.length === 0) return

    logger.info('keyboard', 'Archive shortcut triggered', { count: targetIds.length })

    if (targetIds.length === 1) {
      await archiveEmail(targetIds[0])
    } else {
      await archiveEmails(targetIds)
    }
  }, [getTargetIds, archiveEmail, archiveEmails])

  /**
   * Handle delete shortcut (# key)
   */
  const handleDelete = useCallback(async () => {
    const targetIds = getTargetIds()
    if (targetIds.length === 0) return

    logger.info('keyboard', 'Delete shortcut triggered', { count: targetIds.length })

    if (targetIds.length === 1) {
      await deleteEmail(targetIds[0])
    } else {
      await deleteEmails(targetIds)
    }
  }, [getTargetIds, deleteEmail, deleteEmails])

  /**
   * Handle toggle read shortcut (u key)
   */
  const handleToggleRead = useCallback(async () => {
    const targetIds = getTargetIds()
    if (targetIds.length === 0) return

    logger.info('keyboard', 'Toggle read shortcut triggered', { count: targetIds.length })

    for (const id of targetIds) {
      await toggleReadStatus(id)
    }
  }, [getTargetIds, toggleReadStatus])

  /**
   * Handle reply shortcut (r key)
   * Story 2.11 Task 4: Reply triggers callback with email ID
   */
  const handleReply = useCallback(() => {
    const targetIds = getTargetIds()
    if (targetIds.length === 0) return

    logger.info('keyboard', 'Reply shortcut triggered', { emailId: targetIds[0] })
    onReply?.(targetIds[0])
  }, [getTargetIds, onReply])

  /**
   * Handle forward shortcut (f key)
   * Story 2.11 Task 4: Forward triggers callback with email ID
   */
  const handleForward = useCallback(() => {
    const targetIds = getTargetIds()
    if (targetIds.length === 0) return

    logger.info('keyboard', 'Forward shortcut triggered', { emailId: targetIds[0] })
    onForward?.(targetIds[0])
  }, [getTargetIds, onForward])

  /**
   * Handle select shortcut (x key)
   */
  const handleSelect = useCallback(() => {
    const targetIds = getTargetIds()
    if (targetIds.length === 0) return

    const { toggleSelection } = useSelectionStore.getState()
    toggleSelection(targetIds[0])
    logger.info('keyboard', 'Select shortcut triggered', { emailId: targetIds[0] })
  }, [getTargetIds])

  // Register action shortcuts using the new hook system (Story 2.11)
  useActionShortcuts({
    onArchive: handleArchive,
    onDelete: handleDelete,
    onReply: onReply ? handleReply : undefined,
    onForward: onForward ? handleForward : undefined,
    onMarkRead: handleToggleRead,
    onSelect: handleSelect,
    enabled,
    scopes,
  })

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
    { key: '?', description: 'Show keyboard shortcuts' },
    { key: '/', description: 'Open search' },
    { key: 'c', description: 'Compose new email' },
    { key: '⌘K', description: 'Quick search' },
  ]
}
