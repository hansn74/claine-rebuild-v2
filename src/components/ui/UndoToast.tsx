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
import { createPortal } from 'react-dom'
import { X, Undo2, Archive, Trash2, Mail, MailOpen } from 'lucide-react'
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
      return <Archive style={{ width: 16, height: 16 }} />
    case 'delete':
      return <Trash2 style={{ width: 16, height: 16 }} />
    case 'mark-read':
      return <Mail style={{ width: 16, height: 16 }} />
    case 'mark-unread':
      return <MailOpen style={{ width: 16, height: 16 }} />
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
 * Single undo toast item - using inline styles for debugging
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
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 16px',
        backgroundColor: '#0f172a',
        color: 'white',
        borderRadius: '8px',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        minHeight: '48px',
        minWidth: '300px',
      }}
      role="alert"
      aria-live="polite"
    >
      {/* Icon */}
      <span style={{ flexShrink: 0, color: '#94a3b8' }}>{getActionIcon(action.type)}</span>

      {/* Message */}
      <span style={{ flex: 1, fontSize: '14px' }}>Email {getActionText(action.type)}</span>

      {/* Undo button */}
      <button
        type="button"
        onClick={onUndo}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 12px',
          borderRadius: '4px',
          fontSize: '14px',
          fontWeight: 500,
          backgroundColor: '#334155',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
        }}
        aria-label="Undo action"
      >
        <Undo2 style={{ width: 14, height: 14 }} />
        Undo
      </button>

      {/* Dismiss button */}
      <button
        type="button"
        onClick={onDismiss}
        style={{
          padding: '4px',
          borderRadius: '4px',
          color: '#94a3b8',
          backgroundColor: 'transparent',
          border: 'none',
          cursor: 'pointer',
        }}
        aria-label="Dismiss notification"
      >
        <X style={{ width: 16, height: 16 }} />
      </button>

      {/* Progress bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '4px',
          backgroundColor: '#334155',
          borderBottomLeftRadius: '8px',
          borderBottomRightRadius: '8px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            backgroundColor: '#06b6d4',
            width: `${progress * 100}%`,
            transition: 'width 100ms linear',
          }}
        />
      </div>
    </div>
  )
}

/**
 * UndoToast - Container for undo notifications
 */
export function UndoToast({ className: _className }: UndoToastProps) {
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

  const toastContent = (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        width: '340px',
      }}
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
        <div style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center' }}>
          +{visibleActions.length - 3} more
        </div>
      )}
    </div>
  )

  // Use portal to render at document.body level, avoiding any parent transform/overflow issues
  return createPortal(toastContent, document.body)
}
