/**
 * Email Store
 *
 * Story 2.6: Email Actions (Archive, Delete, Mark Read/Unread)
 * Task 3: Implement Optimistic UI Updates
 *
 * Global state management for email UI using Zustand.
 * Manages selected email, email actions, and optimistic UI state.
 *
 * Features:
 * - Selected email tracking
 * - Optimistic UI update integration (Task 3.1)
 * - Action state management
 * - Sync with RxDB reactive queries
 *
 * FR032: Provide immediate visual feedback for offline actions with optimistic UI patterns
 */

import { create } from 'zustand'
import { logger } from '@/services/logger'
import { emailActionsService, type EmailAction } from '@/services/email/emailActionsService'
import {
  setActionPending,
  setActionCompleted,
  rollbackAction,
  hasPendingAction,
} from '@/services/email/optimisticUpdates'

/**
 * Email store state and actions
 */
interface EmailStoreState {
  /** Currently selected/focused email ID */
  selectedEmailId: string | null
  /** Currently selected thread ID */
  selectedThreadId: string | null
  /** Current folder view */
  currentFolder: string
  /** Loading state for email actions */
  isActionLoading: boolean
  /** Error message from last action */
  actionError: string | null
  /** Recent actions for undo capability */
  recentActions: EmailAction[]

  // Actions
  setSelectedEmail: (emailId: string | null, threadId?: string | null) => void
  setCurrentFolder: (folder: string) => void
  archiveEmail: (emailId: string) => Promise<EmailAction | null>
  deleteEmail: (emailId: string) => Promise<EmailAction | null>
  toggleReadStatus: (emailId: string) => Promise<EmailAction | null>
  archiveEmails: (emailIds: string[]) => Promise<EmailAction[]>
  deleteEmails: (emailIds: string[]) => Promise<EmailAction[]>
  markAsRead: (emailIds: string[]) => Promise<EmailAction[]>
  markAsUnread: (emailIds: string[]) => Promise<EmailAction[]>
  undoAction: (action: EmailAction) => Promise<void>
  clearActionError: () => void
  isEmailPending: (emailId: string) => boolean
}

/**
 * Maximum recent actions to keep for undo
 */
const MAX_RECENT_ACTIONS = 10

/**
 * Zustand store for email state
 *
 * Usage:
 * ```tsx
 * function EmailView() {
 *   const { selectedEmailId, archiveEmail, isActionLoading } = useEmailStore()
 *
 *   return (
 *     <button
 *       onClick={() => selectedEmailId && archiveEmail(selectedEmailId)}
 *       disabled={isActionLoading}
 *     >
 *       Archive
 *     </button>
 *   )
 * }
 * ```
 */
export const useEmailStore = create<EmailStoreState>((set, get) => ({
  selectedEmailId: null,
  selectedThreadId: null,
  currentFolder: 'INBOX',
  isActionLoading: false,
  actionError: null,
  recentActions: [],

  /**
   * Set the selected email and optionally the thread
   */
  setSelectedEmail: (emailId, threadId = null) => {
    set({
      selectedEmailId: emailId,
      selectedThreadId: threadId,
    })
    logger.debug('email-store', 'Email selected', { emailId, threadId })
  },

  /**
   * Set the current folder view
   */
  setCurrentFolder: (folder) => {
    set({ currentFolder: folder })
    logger.debug('email-store', 'Folder changed', { folder })
  },

  /**
   * Archive a single email with optimistic UI
   * Task 3.1: Implement optimistic update pattern in emailStore
   */
  archiveEmail: async (emailId) => {
    set({ isActionLoading: true, actionError: null })

    try {
      // Create action first to get ID for tracking
      const action = await emailActionsService.archiveEmail(emailId)

      // Set optimistic state for immediate UI feedback
      setActionPending(action)

      // Add to recent actions for undo
      set((state) => ({
        recentActions: [action, ...state.recentActions].slice(0, MAX_RECENT_ACTIONS),
        isActionLoading: false,
      }))

      // Mark as completed (optimistic was already applied in service)
      setActionCompleted(action)

      // Note: Selection is handled by useEmailKeyboardShortcuts which auto-advances to next email

      logger.info('email-store', 'Email archived', { emailId })
      return action
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to archive email'
      set({ isActionLoading: false, actionError: errorMessage })
      logger.error('email-store', 'Archive failed', { emailId, error: errorMessage })
      return null
    }
  },

  /**
   * Delete a single email with optimistic UI
   */
  deleteEmail: async (emailId) => {
    set({ isActionLoading: true, actionError: null })

    try {
      const action = await emailActionsService.deleteEmail(emailId)
      setActionPending(action)

      set((state) => ({
        recentActions: [action, ...state.recentActions].slice(0, MAX_RECENT_ACTIONS),
        isActionLoading: false,
      }))

      setActionCompleted(action)

      // Note: Selection is handled by useEmailKeyboardShortcuts which auto-advances to next email

      logger.info('email-store', 'Email deleted', { emailId })
      return action
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete email'
      set({ isActionLoading: false, actionError: errorMessage })
      logger.error('email-store', 'Delete failed', { emailId, error: errorMessage })
      return null
    }
  },

  /**
   * Toggle read/unread status with optimistic UI
   */
  toggleReadStatus: async (emailId) => {
    set({ isActionLoading: true, actionError: null })

    try {
      const action = await emailActionsService.toggleReadStatus(emailId)
      setActionPending(action)

      set((state) => ({
        recentActions: [action, ...state.recentActions].slice(0, MAX_RECENT_ACTIONS),
        isActionLoading: false,
      }))

      setActionCompleted(action)

      logger.info('email-store', 'Read status toggled', { emailId, type: action.type })
      return action
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to toggle read status'
      set({ isActionLoading: false, actionError: errorMessage })
      logger.error('email-store', 'Toggle read failed', { emailId, error: errorMessage })
      return null
    }
  },

  /**
   * Archive multiple emails (bulk action)
   * AC 5: Bulk actions available
   */
  archiveEmails: async (emailIds) => {
    set({ isActionLoading: true, actionError: null })

    try {
      const actions = await emailActionsService.archiveEmails(emailIds)

      // Set all as pending
      actions.forEach(setActionPending)

      set((state) => ({
        recentActions: [...actions, ...state.recentActions].slice(0, MAX_RECENT_ACTIONS),
        isActionLoading: false,
      }))

      // Mark all as completed
      actions.forEach(setActionCompleted)

      // Clear selection if any archived email was selected
      const { selectedEmailId } = get()
      if (selectedEmailId && emailIds.includes(selectedEmailId)) {
        set({ selectedEmailId: null, selectedThreadId: null })
      }

      logger.info('email-store', 'Emails archived', { count: actions.length })
      return actions
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to archive emails'
      set({ isActionLoading: false, actionError: errorMessage })
      logger.error('email-store', 'Bulk archive failed', {
        count: emailIds.length,
        error: errorMessage,
      })
      return []
    }
  },

  /**
   * Delete multiple emails (bulk action)
   */
  deleteEmails: async (emailIds) => {
    set({ isActionLoading: true, actionError: null })

    try {
      const actions = await emailActionsService.deleteEmails(emailIds)
      actions.forEach(setActionPending)

      set((state) => ({
        recentActions: [...actions, ...state.recentActions].slice(0, MAX_RECENT_ACTIONS),
        isActionLoading: false,
      }))

      actions.forEach(setActionCompleted)

      const { selectedEmailId } = get()
      if (selectedEmailId && emailIds.includes(selectedEmailId)) {
        set({ selectedEmailId: null, selectedThreadId: null })
      }

      logger.info('email-store', 'Emails deleted', { count: actions.length })
      return actions
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete emails'
      set({ isActionLoading: false, actionError: errorMessage })
      logger.error('email-store', 'Bulk delete failed', {
        count: emailIds.length,
        error: errorMessage,
      })
      return []
    }
  },

  /**
   * Mark multiple emails as read
   */
  markAsRead: async (emailIds) => {
    set({ isActionLoading: true, actionError: null })

    try {
      const actions = await emailActionsService.markAsRead(emailIds)
      actions.forEach(setActionPending)

      set((state) => ({
        recentActions: [...actions, ...state.recentActions].slice(0, MAX_RECENT_ACTIONS),
        isActionLoading: false,
      }))

      actions.forEach(setActionCompleted)

      logger.info('email-store', 'Emails marked as read', { count: actions.length })
      return actions
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to mark as read'
      set({ isActionLoading: false, actionError: errorMessage })
      return []
    }
  },

  /**
   * Mark multiple emails as unread
   */
  markAsUnread: async (emailIds) => {
    set({ isActionLoading: true, actionError: null })

    try {
      const actions = await emailActionsService.markAsUnread(emailIds)
      actions.forEach(setActionPending)

      set((state) => ({
        recentActions: [...actions, ...state.recentActions].slice(0, MAX_RECENT_ACTIONS),
        isActionLoading: false,
      }))

      actions.forEach(setActionCompleted)

      logger.info('email-store', 'Emails marked as unread', { count: actions.length })
      return actions
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to mark as unread'
      set({ isActionLoading: false, actionError: errorMessage })
      return []
    }
  },

  /**
   * Undo a recent action
   * AC 6: Undo option for destructive actions
   */
  undoAction: async (action) => {
    try {
      // Roll back the database change
      await rollbackAction(action)

      // Remove from recent actions
      set((state) => ({
        recentActions: state.recentActions.filter((a) => a.id !== action.id),
      }))

      logger.info('email-store', 'Action undone', { actionId: action.id, type: action.type })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to undo action'
      set({ actionError: errorMessage })
      logger.error('email-store', 'Undo failed', { actionId: action.id, error: errorMessage })
    }
  },

  /**
   * Clear action error
   */
  clearActionError: () => {
    set({ actionError: null })
  },

  /**
   * Check if an email has a pending action
   */
  isEmailPending: (emailId) => {
    return hasPendingAction(emailId)
  },
}))

/**
 * Expose email store for E2E testing in development mode
 */
if (import.meta.env.DEV) {
  ;(window as unknown as { __TEST_EMAIL_STORE__: typeof useEmailStore }).__TEST_EMAIL_STORE__ =
    useEmailStore
}
