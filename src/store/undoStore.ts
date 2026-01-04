/**
 * Undo Store
 *
 * Story 2.6: Email Actions (Archive, Delete, Mark Read/Unread)
 * Task 7.1: Create undoStore with action history
 *
 * Global state management for undo functionality using Zustand.
 * Tracks pending actions that can be undone within a time window.
 *
 * AC 6: Undo option for destructive actions (5-second toast notification)
 */

import { create } from 'zustand'
import { logger } from '@/services/logger'
import type { EmailAction } from '@/services/email/emailActionsService'

/**
 * Undoable action with additional metadata
 */
export interface UndoableAction {
  /** Original action */
  action: EmailAction
  /** When the undo window expires */
  expiresAt: number
  /** Whether undo has been triggered */
  undone: boolean
}

/**
 * Undo store state and actions
 */
interface UndoState {
  /** Queue of pending undoable actions */
  pendingActions: UndoableAction[]
  /** Undo window duration in milliseconds (default: 5000ms) */
  undoWindowMs: number

  // Actions
  addAction: (action: EmailAction) => void
  undoAction: (actionId: string) => EmailAction | null
  removeAction: (actionId: string) => void
  clearExpiredActions: () => void
  getLatestAction: () => UndoableAction | null
  hasPendingActions: () => boolean
}

/**
 * Default undo window: 5 seconds per PRD FR022
 */
const DEFAULT_UNDO_WINDOW_MS = 5000

/**
 * Zustand store for undo state
 *
 * Usage:
 * ```tsx
 * function UndoToast() {
 *   const { pendingActions, undoAction } = useUndoStore()
 *   const latestAction = pendingActions[0]
 *
 *   if (!latestAction) return null
 *
 *   return (
 *     <div>
 *       <span>Email {latestAction.action.type}d</span>
 *       <button onClick={() => undoAction(latestAction.action.id)}>
 *         Undo
 *       </button>
 *     </div>
 *   )
 * }
 * ```
 */
export const useUndoStore = create<UndoState>((set, get) => ({
  pendingActions: [],
  undoWindowMs: DEFAULT_UNDO_WINDOW_MS,

  /**
   * Add an action to the undo queue
   * Task 7.3: Implement 5-second undo window
   */
  addAction: (action) => {
    const now = Date.now()
    const expiresAt = now + get().undoWindowMs

    const undoableAction: UndoableAction = {
      action,
      expiresAt,
      undone: false,
    }

    set((state) => ({
      pendingActions: [undoableAction, ...state.pendingActions],
    }))

    logger.debug('undo', 'Action added to undo queue', {
      actionId: action.id,
      type: action.type,
      expiresIn: get().undoWindowMs,
    })

    // Schedule auto-removal after undo window
    setTimeout(() => {
      get().removeAction(action.id)
    }, get().undoWindowMs)
  },

  /**
   * Undo an action and return it for processing
   * Task 7.5: Handle undo for archive, delete, mark read actions
   */
  undoAction: (actionId) => {
    const { pendingActions } = get()
    const actionToUndo = pendingActions.find((ua) => ua.action.id === actionId && !ua.undone)

    if (!actionToUndo) {
      logger.warn('undo', 'Action not found or already undone', { actionId })
      return null
    }

    // Check if undo window has expired
    if (Date.now() > actionToUndo.expiresAt) {
      logger.warn('undo', 'Undo window expired', { actionId })
      return null
    }

    // Mark as undone
    set((state) => ({
      pendingActions: state.pendingActions.map((ua) =>
        ua.action.id === actionId ? { ...ua, undone: true } : ua
      ),
    }))

    logger.info('undo', 'Action undone', {
      actionId,
      type: actionToUndo.action.type,
    })

    return actionToUndo.action
  },

  /**
   * Remove an action from the queue
   * Task 7.6: Auto-dismiss toast after 5 seconds
   */
  removeAction: (actionId) => {
    set((state) => ({
      pendingActions: state.pendingActions.filter((ua) => ua.action.id !== actionId),
    }))

    logger.debug('undo', 'Action removed from undo queue', { actionId })
  },

  /**
   * Clear all expired actions
   */
  clearExpiredActions: () => {
    const now = Date.now()
    set((state) => ({
      pendingActions: state.pendingActions.filter((ua) => ua.expiresAt > now),
    }))
  },

  /**
   * Get the most recent undoable action
   */
  getLatestAction: () => {
    const { pendingActions } = get()
    return pendingActions.find((ua) => !ua.undone) ?? null
  },

  /**
   * Check if there are pending actions
   */
  hasPendingActions: () => {
    const { pendingActions } = get()
    return pendingActions.some((ua) => !ua.undone)
  },
}))

/**
 * Expose undo store for E2E testing in development mode
 */
if (import.meta.env.DEV) {
  ;(window as unknown as { __TEST_UNDO_STORE__: typeof useUndoStore }).__TEST_UNDO_STORE__ =
    useUndoStore
}
