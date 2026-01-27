/**
 * Email Actions Service
 *
 * Story 2.6: Email Actions (Archive, Delete, Mark Read/Unread)
 * Task 1: Create EmailActionsService class
 *
 * Manages email actions: archive, delete, mark read/unread.
 * Implements singleton pattern for global access.
 * Actions work offline-first with optimistic UI updates.
 *
 * AC 1: Archive button removes email from inbox (moves to Archive folder)
 * AC 2: Delete button moves email to Trash (soft delete)
 * AC 3: Mark as read/unread toggles unread status
 *
 * FR007: Full read/write functionality when offline, queueing actions for later sync
 * NFR001: Sub-50ms input latency for 95% of user interactions
 */

import { Subject, Observable } from 'rxjs'
import { getDatabase } from '@/services/database/init'
import { logger } from '@/services/logger'
import { emailActionQueue } from './emailActionQueue'
import type { EmailDocument } from '@/services/database/schemas/email.schema'

/**
 * Detect provider type from accountId
 * Handles both prefixed format (gmail:user@example.com) and plain email format
 */
function getProviderType(accountId: string): 'gmail' | 'outlook' {
  // Check for prefixed format first (gmail:user@example.com)
  if (accountId.startsWith('gmail:')) {
    return 'gmail'
  }
  if (accountId.startsWith('outlook:') || accountId.startsWith('microsoft:')) {
    return 'outlook'
  }

  // Fallback: Use domain heuristics for plain email format
  const lowerAccountId = accountId.toLowerCase()
  if (lowerAccountId.includes('@gmail.com') || lowerAccountId.includes('@googlemail.com')) {
    return 'gmail'
  }
  if (
    lowerAccountId.includes('@outlook.') ||
    lowerAccountId.includes('@hotmail.') ||
    lowerAccountId.includes('@live.') ||
    lowerAccountId.includes('@msn.')
  ) {
    return 'outlook'
  }

  // Default to gmail if unknown
  return 'gmail'
}

/**
 * Types of email actions that can be performed
 */
export type EmailActionType = 'archive' | 'delete' | 'mark-read' | 'mark-unread'

/**
 * Email action for queue and undo
 */
export interface EmailAction {
  id: string
  type: EmailActionType
  emailId: string
  accountId: string
  previousState: {
    folder?: string
    labels?: string[]
    read?: boolean
  }
  timestamp: number
}

/**
 * Event types emitted by the email actions service
 */
export type EmailActionEvent =
  | { type: 'action-started'; action: EmailAction }
  | { type: 'action-completed'; action: EmailAction }
  | { type: 'action-failed'; action: EmailAction; error: string }
  | { type: 'action-undone'; action: EmailAction }

/**
 * Email Actions Service
 *
 * Singleton service that manages email actions.
 * Provides methods for archiving, deleting, and marking emails read/unread.
 *
 * Usage:
 * ```typescript
 * import { emailActionsService } from '@/services/email/emailActionsService'
 *
 * // Archive a single email
 * await emailActionsService.archiveEmail(emailId)
 *
 * // Delete with undo capability
 * const action = await emailActionsService.deleteEmail(emailId)
 * // Later: await emailActionsService.undoAction(action.id)
 *
 * // Toggle read/unread
 * await emailActionsService.toggleReadStatus(emailId)
 *
 * // Bulk operations
 * await emailActionsService.archiveEmails([id1, id2, id3])
 * ```
 */
export class EmailActionsService {
  private static instance: EmailActionsService
  private events$ = new Subject<EmailActionEvent>()

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): EmailActionsService {
    if (!EmailActionsService.instance) {
      EmailActionsService.instance = new EmailActionsService()
    }
    return EmailActionsService.instance
  }

  /**
   * Get observable for action events
   * Used by UI components (undo toast) to react to action changes
   */
  getEvents$(): Observable<EmailActionEvent> {
    return this.events$.asObservable()
  }

  /**
   * Archive email - moves from Inbox to Archive folder
   * AC 1: Archive button removes email from inbox
   *
   * Optimistic update: immediate local change, queue for sync
   *
   * @param emailId - Email ID to archive
   * @returns The action object (for undo capability)
   */
  async archiveEmail(emailId: string): Promise<EmailAction> {
    const db = getDatabase()
    const emailDoc = await db.emails?.findOne(emailId).exec()

    if (!emailDoc) {
      throw new Error(`Email not found: ${emailId}`)
    }

    const email = emailDoc.toJSON() as EmailDocument

    // Create action for tracking and undo
    const action: EmailAction = {
      id: `action-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      type: 'archive',
      emailId,
      accountId: email.accountId,
      previousState: {
        folder: email.folder,
        labels: [...email.labels],
      },
      timestamp: Date.now(),
    }

    this.events$.next({ type: 'action-started', action })

    try {
      // Optimistic local update
      // Archive = remove INBOX label, keep in Archive folder
      const newLabels = email.labels.filter((l) => l !== 'INBOX')

      await emailDoc.update({
        $set: {
          folder: 'archive',
          labels: newLabels,
        },
      })

      logger.info('email-actions', 'Email archived', { emailId, folder: 'archive' })
      this.events$.next({ type: 'action-completed', action })

      // Queue action for sync to provider (Gmail/Outlook)
      const providerType = getProviderType(email.accountId)
      try {
        await emailActionQueue.queueAction(action, providerType)
      } catch (queueError) {
        logger.warn('email-actions', 'Failed to queue archive action for sync', {
          emailId,
          error: queueError instanceof Error ? queueError.message : String(queueError),
        })
      }

      return action
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('email-actions', 'Archive failed', { emailId, error: errorMessage })
      this.events$.next({ type: 'action-failed', action, error: errorMessage })
      throw error
    }
  }

  /**
   * Archive multiple emails
   * AC 5: Bulk actions available
   *
   * @param emailIds - Array of email IDs to archive
   * @returns Array of action objects
   */
  async archiveEmails(emailIds: string[]): Promise<EmailAction[]> {
    const actions: EmailAction[] = []
    for (const emailId of emailIds) {
      try {
        const action = await this.archiveEmail(emailId)
        actions.push(action)
      } catch (error) {
        logger.warn('email-actions', 'Failed to archive email in bulk', {
          emailId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
    logger.info('email-actions', 'Bulk archive completed', {
      total: emailIds.length,
      successful: actions.length,
    })
    return actions
  }

  /**
   * Delete email - moves to Trash (soft delete)
   * AC 2: Delete button moves email to Trash
   *
   * @param emailId - Email ID to delete
   * @returns The action object (for undo capability)
   */
  async deleteEmail(emailId: string): Promise<EmailAction> {
    const db = getDatabase()
    const emailDoc = await db.emails?.findOne(emailId).exec()

    if (!emailDoc) {
      throw new Error(`Email not found: ${emailId}`)
    }

    const email = emailDoc.toJSON() as EmailDocument

    // Create action for tracking and undo
    const action: EmailAction = {
      id: `action-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      type: 'delete',
      emailId,
      accountId: email.accountId,
      previousState: {
        folder: email.folder,
        labels: [...email.labels],
      },
      timestamp: Date.now(),
    }

    this.events$.next({ type: 'action-started', action })

    try {
      // Move to Trash
      await emailDoc.update({
        $set: {
          folder: 'trash',
        },
      })

      logger.info('email-actions', 'Email deleted (moved to trash)', { emailId })
      this.events$.next({ type: 'action-completed', action })

      // Queue action for sync to provider (Gmail/Outlook)
      const providerType = getProviderType(email.accountId)
      try {
        await emailActionQueue.queueAction(action, providerType)
      } catch (queueError) {
        logger.warn('email-actions', 'Failed to queue delete action for sync', {
          emailId,
          error: queueError instanceof Error ? queueError.message : String(queueError),
        })
      }

      return action
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('email-actions', 'Delete failed', { emailId, error: errorMessage })
      this.events$.next({ type: 'action-failed', action, error: errorMessage })
      throw error
    }
  }

  /**
   * Delete multiple emails
   * AC 5: Bulk actions available
   *
   * @param emailIds - Array of email IDs to delete
   * @returns Array of action objects
   */
  async deleteEmails(emailIds: string[]): Promise<EmailAction[]> {
    const actions: EmailAction[] = []
    for (const emailId of emailIds) {
      try {
        const action = await this.deleteEmail(emailId)
        actions.push(action)
      } catch (error) {
        logger.warn('email-actions', 'Failed to delete email in bulk', {
          emailId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }
    logger.info('email-actions', 'Bulk delete completed', {
      total: emailIds.length,
      successful: actions.length,
    })
    return actions
  }

  /**
   * Toggle read/unread status
   * AC 3: Mark as read/unread toggles unread status
   *
   * @param emailId - Email ID to toggle
   * @returns The action object (for undo capability)
   */
  async toggleReadStatus(emailId: string): Promise<EmailAction> {
    const db = getDatabase()
    const emailDoc = await db.emails?.findOne(emailId).exec()

    if (!emailDoc) {
      throw new Error(`Email not found: ${emailId}`)
    }

    const email = emailDoc.toJSON() as EmailDocument
    const newReadStatus = !email.read
    const actionType: EmailActionType = newReadStatus ? 'mark-read' : 'mark-unread'

    // Create action for tracking and undo
    const action: EmailAction = {
      id: `action-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      type: actionType,
      emailId,
      accountId: email.accountId,
      previousState: {
        read: email.read,
        labels: [...email.labels],
      },
      timestamp: Date.now(),
    }

    this.events$.next({ type: 'action-started', action })

    try {
      // Update labels to reflect read status
      // Gmail uses UNREAD label for unread emails
      let newLabels = [...email.labels]
      if (newReadStatus) {
        // Mark as read: remove UNREAD label
        newLabels = newLabels.filter((l) => l !== 'UNREAD')
      } else {
        // Mark as unread: add UNREAD label if not present
        if (!newLabels.includes('UNREAD')) {
          newLabels.push('UNREAD')
        }
      }

      await emailDoc.update({
        $set: {
          read: newReadStatus,
          labels: newLabels,
        },
      })

      logger.info('email-actions', `Email marked ${newReadStatus ? 'read' : 'unread'}`, {
        emailId,
        read: newReadStatus,
      })
      this.events$.next({ type: 'action-completed', action })

      // Queue action for sync to provider (Gmail/Outlook)
      const providerType = getProviderType(email.accountId)
      try {
        await emailActionQueue.queueAction(action, providerType)
      } catch (queueError) {
        logger.warn('email-actions', 'Failed to queue read status action for sync', {
          emailId,
          error: queueError instanceof Error ? queueError.message : String(queueError),
        })
      }

      return action
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('email-actions', 'Toggle read status failed', { emailId, error: errorMessage })
      this.events$.next({ type: 'action-failed', action, error: errorMessage })
      throw error
    }
  }

  /**
   * Mark multiple emails as read
   * AC 5: Bulk actions available (Task 1.5)
   *
   * @param emailIds - Array of email IDs to mark as read
   * @returns Array of action objects
   */
  async markAsRead(emailIds: string[]): Promise<EmailAction[]> {
    const db = getDatabase()
    const actions: EmailAction[] = []

    for (const emailId of emailIds) {
      try {
        const emailDoc = await db.emails?.findOne(emailId).exec()
        if (!emailDoc) continue

        const email = emailDoc.toJSON() as EmailDocument

        // Skip if already read
        if (email.read) continue

        // Create action
        const action: EmailAction = {
          id: `action-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
          type: 'mark-read',
          emailId,
          accountId: email.accountId,
          previousState: {
            read: email.read,
            labels: [...email.labels],
          },
          timestamp: Date.now(),
        }

        // Update email
        const newLabels = email.labels.filter((l) => l !== 'UNREAD')
        await emailDoc.update({
          $set: {
            read: true,
            labels: newLabels,
          },
        })

        actions.push(action)
        this.events$.next({ type: 'action-completed', action })
      } catch (error) {
        logger.warn('email-actions', 'Failed to mark email as read in bulk', {
          emailId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    logger.info('email-actions', 'Bulk mark as read completed', {
      total: emailIds.length,
      successful: actions.length,
    })

    return actions
  }

  /**
   * Mark multiple emails as unread
   * AC 5: Bulk actions available (Task 1.6)
   *
   * @param emailIds - Array of email IDs to mark as unread
   * @returns Array of action objects
   */
  async markAsUnread(emailIds: string[]): Promise<EmailAction[]> {
    const db = getDatabase()
    const actions: EmailAction[] = []

    for (const emailId of emailIds) {
      try {
        const emailDoc = await db.emails?.findOne(emailId).exec()
        if (!emailDoc) continue

        const email = emailDoc.toJSON() as EmailDocument

        // Skip if already unread
        if (!email.read) continue

        // Create action
        const action: EmailAction = {
          id: `action-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
          type: 'mark-unread',
          emailId,
          accountId: email.accountId,
          previousState: {
            read: email.read,
            labels: [...email.labels],
          },
          timestamp: Date.now(),
        }

        // Update email
        const newLabels = email.labels.includes('UNREAD')
          ? email.labels
          : [...email.labels, 'UNREAD']

        await emailDoc.update({
          $set: {
            read: false,
            labels: newLabels,
          },
        })

        actions.push(action)
        this.events$.next({ type: 'action-completed', action })
      } catch (error) {
        logger.warn('email-actions', 'Failed to mark email as unread in bulk', {
          emailId,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    }

    logger.info('email-actions', 'Bulk mark as unread completed', {
      total: emailIds.length,
      successful: actions.length,
    })

    return actions
  }

  /**
   * Undo an action by restoring the previous state
   * AC 6: Undo option for destructive actions
   *
   * @param action - The action to undo
   */
  async undoAction(action: EmailAction): Promise<void> {
    const db = getDatabase()
    const emailDoc = await db.emails?.findOne(action.emailId).exec()

    if (!emailDoc) {
      logger.warn('email-actions', 'Cannot undo - email not found', { emailId: action.emailId })
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

      logger.info('email-actions', 'Action undone', {
        actionId: action.id,
        type: action.type,
        emailId: action.emailId,
      })

      this.events$.next({ type: 'action-undone', action })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      logger.error('email-actions', 'Undo failed', {
        actionId: action.id,
        error: errorMessage,
      })
      throw error
    }
  }

  /**
   * Reset singleton instance (for testing only)
   * @internal
   */
  static __resetForTesting(): void {
    if (EmailActionsService.instance) {
      EmailActionsService.instance.events$.complete()
    }
    EmailActionsService.instance = null as unknown as EmailActionsService
  }
}

/**
 * Singleton instance export
 */
export const emailActionsService = EmailActionsService.getInstance()
