/**
 * Optimistic Updates Service
 *
 * Story 2.6: Email Actions (Archive, Delete, Mark Read/Unread)
 * Task 3: Implement Optimistic UI Updates
 *
 * Provides optimistic update patterns for email actions.
 * Actions update the UI immediately while syncing in background.
 *
 * Features:
 * - Immediate UI feedback (<50ms target per NFR001)
 * - Rollback capability for failed actions (Task 3.2)
 * - Sync state tracking (Task 3.4)
 * - Loading states for in-progress actions (Task 3.5)
 *
 * FR032: Provide immediate visual feedback for offline actions with optimistic UI patterns
 */

import { logger } from '@/services/logger'
import { getDatabase } from '@/services/database/init'
import type { EmailDocument } from '@/services/database/schemas/email.schema'
import type { EmailAction } from './emailActionsService'

/**
 * Optimistic update state for an email
 */
export interface OptimisticState {
  /** Whether the email is currently being acted upon */
  isPending: boolean
  /** The type of action in progress */
  actionType?: EmailAction['type']
  /** Timestamp when action started */
  startedAt?: number
  /** Whether the action failed */
  failed?: boolean
  /** Error message if failed */
  error?: string
}

/**
 * Map of email IDs to their optimistic states
 */
const optimisticStates = new Map<string, OptimisticState>()

/**
 * Listeners for state changes
 */
type StateChangeListener = (emailId: string, state: OptimisticState | null) => void
const stateChangeListeners = new Set<StateChangeListener>()

/**
 * Subscribe to optimistic state changes
 *
 * @param listener - Callback when state changes
 * @returns Unsubscribe function
 */
export function subscribeToOptimisticState(listener: StateChangeListener): () => void {
  stateChangeListeners.add(listener)
  return () => stateChangeListeners.delete(listener)
}

/**
 * Notify listeners of state change
 */
function notifyStateChange(emailId: string, state: OptimisticState | null): void {
  stateChangeListeners.forEach((listener) => {
    try {
      listener(emailId, state)
    } catch (error) {
      logger.error('optimistic-updates', 'Listener error', {
        error: error instanceof Error ? error.message : String(error),
      })
    }
  })
}

/**
 * Get the optimistic state for an email
 *
 * @param emailId - Email ID
 * @returns The optimistic state or undefined
 */
export function getOptimisticState(emailId: string): OptimisticState | undefined {
  return optimisticStates.get(emailId)
}

/**
 * Check if an email has a pending action
 *
 * @param emailId - Email ID
 * @returns Whether the email has a pending action
 */
export function hasPendingAction(emailId: string): boolean {
  const state = optimisticStates.get(emailId)
  return state?.isPending ?? false
}

/**
 * Set optimistic state for an action starting
 * Task 3.5: Add loading states for in-progress actions
 *
 * @param action - The action being performed
 */
export function setActionPending(action: EmailAction): void {
  const state: OptimisticState = {
    isPending: true,
    actionType: action.type,
    startedAt: Date.now(),
    failed: false,
  }

  optimisticStates.set(action.emailId, state)
  notifyStateChange(action.emailId, state)

  logger.debug('optimistic-updates', 'Action pending', {
    emailId: action.emailId,
    type: action.type,
  })
}

/**
 * Mark an action as completed
 *
 * @param action - The completed action
 */
export function setActionCompleted(action: EmailAction): void {
  optimisticStates.delete(action.emailId)
  notifyStateChange(action.emailId, null)

  logger.debug('optimistic-updates', 'Action completed', {
    emailId: action.emailId,
    type: action.type,
  })
}

/**
 * Mark an action as failed
 * Task 3.4: Handle sync confirmation/rollback states
 *
 * @param action - The failed action
 * @param error - Error message
 */
export function setActionFailed(action: EmailAction, error: string): void {
  const state: OptimisticState = {
    isPending: false,
    actionType: action.type,
    failed: true,
    error,
  }

  optimisticStates.set(action.emailId, state)
  notifyStateChange(action.emailId, state)

  logger.warn('optimistic-updates', 'Action failed', {
    emailId: action.emailId,
    type: action.type,
    error,
  })

  // Auto-clear failed state after 5 seconds
  setTimeout(() => {
    const currentState = optimisticStates.get(action.emailId)
    if (currentState?.failed && currentState.actionType === action.type) {
      optimisticStates.delete(action.emailId)
      notifyStateChange(action.emailId, null)
    }
  }, 5000)
}

/**
 * Rollback an action by restoring previous state
 * Task 3.2: Add rollback capability for failed actions
 *
 * @param action - The action to rollback
 */
export async function rollbackAction(action: EmailAction): Promise<void> {
  const db = getDatabase()
  const emailDoc = await db.emails?.findOne(action.emailId).exec()

  if (!emailDoc) {
    logger.warn('optimistic-updates', 'Cannot rollback - email not found', {
      emailId: action.emailId,
    })
    return
  }

  try {
    // Restore previous state
    const updateFields: Record<string, unknown> = {}

    if (action.previousState.folder !== undefined) {
      updateFields.folder = action.previousState.folder
    }
    if (action.previousState.labels !== undefined) {
      updateFields.labels = action.previousState.labels
    }
    if (action.previousState.read !== undefined) {
      updateFields.read = action.previousState.read
    }

    await emailDoc.update({
      $set: updateFields,
    })

    // Clear optimistic state
    optimisticStates.delete(action.emailId)
    notifyStateChange(action.emailId, null)

    logger.info('optimistic-updates', 'Action rolled back', {
      emailId: action.emailId,
      type: action.type,
    })
  } catch (error) {
    logger.error('optimistic-updates', 'Rollback failed', {
      emailId: action.emailId,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

/**
 * Clear all optimistic states
 * Useful for cleanup or testing
 */
export function clearAllOptimisticStates(): void {
  const emailIds = Array.from(optimisticStates.keys())
  optimisticStates.clear()

  // Notify all cleared
  emailIds.forEach((emailId) => notifyStateChange(emailId, null))

  logger.debug('optimistic-updates', 'All optimistic states cleared', {
    count: emailIds.length,
  })
}

/**
 * Get all emails with pending actions
 *
 * @returns Array of email IDs with pending actions
 */
export function getPendingEmailIds(): string[] {
  const pending: string[] = []
  optimisticStates.forEach((state, emailId) => {
    if (state.isPending) {
      pending.push(emailId)
    }
  })
  return pending
}

/**
 * Apply optimistic state to email document for display
 * Task 3.3: Update email list UI immediately on action
 *
 * This function applies pending optimistic changes to an email
 * for display purposes, without modifying the actual database.
 *
 * @param email - The email document
 * @returns Email with optimistic state applied (for display)
 */
export function applyOptimisticState(
  email: EmailDocument
): EmailDocument & { _optimistic?: OptimisticState } {
  const state = optimisticStates.get(email.id)

  if (!state) {
    return email
  }

  // Return email with optimistic metadata attached
  return {
    ...email,
    _optimistic: state,
  }
}

/**
 * Filter emails based on optimistic state
 * Removes archived/deleted emails from inbox view immediately
 *
 * @param emails - Array of emails
 * @param folder - Current folder view
 * @returns Filtered emails
 */
export function filterByOptimisticState(emails: EmailDocument[], folder: string): EmailDocument[] {
  return emails.filter((email) => {
    const state = optimisticStates.get(email.id)

    if (!state?.isPending) {
      return true
    }

    // If archiving from inbox, hide from inbox immediately
    if (state.actionType === 'archive' && folder === 'INBOX') {
      return false
    }

    // If deleting, hide from all non-trash views immediately
    if (state.actionType === 'delete' && folder !== 'TRASH') {
      return false
    }

    return true
  })
}
