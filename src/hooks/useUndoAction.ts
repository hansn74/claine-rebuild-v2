/**
 * useUndoAction Hook
 *
 * Story 2.6: Email Actions (Archive, Delete, Mark Read/Unread)
 * Task 7.4: Create useUndoAction hook for triggering undo
 *
 * Custom hook for integrating undo functionality with email actions.
 * Automatically adds actions to undo queue and handles undo execution.
 *
 * AC 6: Undo option for destructive actions (5-second toast notification)
 */

import { useCallback, useEffect } from 'react'
import { useUndoStore } from '@/store/undoStore'
import { useEmailStore } from '@/store/emailStore'
import { emailActionsService, type EmailAction } from '@/services/email/emailActionsService'
import { logger } from '@/services/logger'

export interface UseUndoActionReturn {
  /** Add an action to the undo queue */
  addToUndoQueue: (action: EmailAction) => void
  /** Undo the last action */
  undoLastAction: () => Promise<void>
  /** Check if there are pending undoable actions */
  hasPendingUndo: boolean
  /** Get the latest undoable action */
  latestAction: EmailAction | null
}

/**
 * useUndoAction - Hook for undo functionality
 *
 * Usage:
 * ```tsx
 * function EmailActions() {
 *   const { addToUndoQueue, undoLastAction, hasPendingUndo } = useUndoAction()
 *
 *   const handleArchive = async () => {
 *     const action = await archiveEmail(emailId)
 *     if (action) {
 *       addToUndoQueue(action)
 *     }
 *   }
 *
 *   return (
 *     <>
 *       <button onClick={handleArchive}>Archive</button>
 *       {hasPendingUndo && (
 *         <button onClick={undoLastAction}>Undo</button>
 *       )}
 *     </>
 *   )
 * }
 * ```
 */
export function useUndoAction(): UseUndoActionReturn {
  const { addAction, undoAction, getLatestAction, hasPendingActions } = useUndoStore()
  const { undoAction: performUndo } = useEmailStore()

  /**
   * Subscribe to email action events and auto-add to undo queue
   */
  useEffect(() => {
    const subscription = emailActionsService.getEvents$().subscribe((event) => {
      if (event.type === 'action-completed') {
        // Add completed actions to undo queue
        addAction(event.action)
        logger.debug('undo-hook', 'Action added to undo queue', {
          actionId: event.action.id,
          type: event.action.type,
        })
      }
    })

    return () => subscription.unsubscribe()
  }, [addAction])

  /**
   * Undo the last action
   * Task 7.5: Handle undo for archive, delete, mark read actions
   */
  const undoLastAction = useCallback(async () => {
    const latestUndoable = getLatestAction()
    if (!latestUndoable) {
      logger.debug('undo-hook', 'No action to undo')
      return
    }

    const action = undoAction(latestUndoable.action.id)
    if (action) {
      await performUndo(action)
      logger.info('undo-hook', 'Action undone', {
        actionId: action.id,
        type: action.type,
      })
    }
  }, [getLatestAction, undoAction, performUndo])

  /**
   * Cmd+Z keyboard shortcut for undo
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+Z (Mac) or Ctrl+Z (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        // Don't intercept in text inputs (let them handle their own undo)
        const target = e.target as HTMLElement
        if (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable
        ) {
          return
        }

        e.preventDefault()
        undoLastAction()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [undoLastAction])

  /**
   * Add an action to the undo queue manually
   */
  const addToUndoQueue = useCallback(
    (action: EmailAction) => {
      addAction(action)
    },
    [addAction]
  )

  /**
   * Check if there are pending undoable actions
   */
  const hasPendingUndo = hasPendingActions()

  /**
   * Get the latest undoable action
   */
  const latestAction = getLatestAction()?.action ?? null

  return {
    addToUndoQueue,
    undoLastAction,
    hasPendingUndo,
    latestAction,
  }
}
