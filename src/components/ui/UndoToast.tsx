/**
 * UndoToast Component
 *
 * Story 2.6: Email Actions (Archive, Delete, Mark Read/Unread)
 * Task 7.2: Create UndoToast component with countdown timer
 *
 * Toast notification for undoable actions with countdown timer.
 * Appears after destructive actions (archive, delete) and auto-dismisses.
 *
 * AC 6: Undo option for destructive actions (5-second toast notification)
 */

import { useEffect, useState, useCallback } from 'react'
import { X, Undo2, Archive, Trash2, Mail, MailOpen } from 'lucide-react'
import { cn } from '@/utils/cn'
import { useUndoStore, type UndoableAction } from '@/store/undoStore'
import { useEmailStore } from '@/store/emailStore'
import type { EmailActionType } from '@/services/email/emailActionsService'

interface UndoToastProps {
  /** Additional className */
  className?: string
}

/**
 * Get icon for action type
 */
function getActionIcon(type: EmailActionType) {
  switch (type) {
    case 'archive':
      return <Archive className="w-4 h-4" />
    case 'delete':
      return <Trash2 className="w-4 h-4" />
    case 'mark-read':
      return <Mail className="w-4 h-4" />
    case 'mark-unread':
      return <MailOpen className="w-4 h-4" />
    default:
      return null
  }
}

/**
 * Get human-readable action text
 */
function getActionText(type: EmailActionType): string {
  switch (type) {
    case 'archive':
      return 'archived'
    case 'delete':
      return 'moved to trash'
    case 'mark-read':
      return 'marked as read'
    case 'mark-unread':
      return 'marked as unread'
    default:
      return 'updated'
  }
}

/**
 * Single undo toast item
 */
function UndoToastItem({
  undoableAction,
  onUndo,
  onDismiss,
}: {
  undoableAction: UndoableAction
  onUndo: () => void
  onDismiss: () => void
}) {
  // Calculate initial time remaining on first render only
  const [timeRemaining, setTimeRemaining] = useState(() =>
    Math.max(0, undoableAction.expiresAt - Date.now())
  )

  // Countdown timer - updates in interval callback (not synchronously)
  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = Math.max(0, undoableAction.expiresAt - Date.now())
      setTimeRemaining(remaining)

      if (remaining === 0) {
        clearInterval(interval)
      }
    }, 100)

    return () => clearInterval(interval)
  }, [undoableAction.expiresAt])

  // Don't show if undone or expired
  if (undoableAction.undone || timeRemaining === 0) {
    return null
  }

  const { action } = undoableAction
  const progress = timeRemaining / 5000 // Assuming 5s window

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3 bg-slate-900 text-white rounded-lg shadow-lg',
        'animate-in slide-in-from-bottom-4 fade-in duration-200'
      )}
      role="alert"
      aria-live="polite"
    >
      {/* Icon */}
      <span className="flex-shrink-0 text-slate-400">{getActionIcon(action.type)}</span>

      {/* Message */}
      <span className="flex-1 text-sm">Email {getActionText(action.type)}</span>

      {/* Undo button */}
      <button
        type="button"
        onClick={onUndo}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1 rounded text-sm font-medium',
          'bg-slate-700 hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-white/50',
          'transition-colors'
        )}
        aria-label="Undo action"
      >
        <Undo2 className="w-3.5 h-3.5" />
        Undo
      </button>

      {/* Dismiss button */}
      <button
        type="button"
        onClick={onDismiss}
        className={cn(
          'p-1 rounded text-slate-400 hover:text-white',
          'focus:outline-none focus:ring-2 focus:ring-white/50'
        )}
        aria-label="Dismiss notification"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-700 rounded-b-lg overflow-hidden">
        <div
          className="h-full bg-cyan-500 transition-all duration-100 ease-linear"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  )
}

/**
 * UndoToast - Container for undo notifications
 *
 * Usage:
 * ```tsx
 * function App() {
 *   return (
 *     <>
 *       <MainContent />
 *       <UndoToast />
 *     </>
 *   )
 * }
 * ```
 */
export function UndoToast({ className }: UndoToastProps) {
  const { pendingActions, undoAction, removeAction } = useUndoStore()
  const { undoAction: performUndo } = useEmailStore()

  // Filter to only show non-undone actions
  const visibleActions = pendingActions.filter((ua) => !ua.undone)

  /**
   * Handle undo button click
   * Task 7.5: Handle undo for archive, delete, mark read actions
   */
  const handleUndo = useCallback(
    async (actionId: string) => {
      const action = undoAction(actionId)
      if (action) {
        await performUndo(action)
      }
    },
    [undoAction, performUndo]
  )

  /**
   * Handle dismiss button click
   */
  const handleDismiss = useCallback(
    (actionId: string) => {
      removeAction(actionId)
    },
    [removeAction]
  )

  if (visibleActions.length === 0) {
    return null
  }

  return (
    <div
      className={cn('fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm', className)}
      role="region"
      aria-label="Undo notifications"
    >
      {visibleActions.slice(0, 3).map((undoableAction) => (
        <UndoToastItem
          key={undoableAction.action.id}
          undoableAction={undoableAction}
          onUndo={() => handleUndo(undoableAction.action.id)}
          onDismiss={() => handleDismiss(undoableAction.action.id)}
        />
      ))}

      {/* Show count if more than 3 */}
      {visibleActions.length > 3 && (
        <div className="text-xs text-slate-400 text-center">+{visibleActions.length - 3} more</div>
      )}
    </div>
  )
}
