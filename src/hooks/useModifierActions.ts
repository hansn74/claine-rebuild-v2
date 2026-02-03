/**
 * useModifierActions Hook
 *
 * Epic 3: Offline-First Modifier Architecture
 * Story 3.4: State Derivation Layer
 *
 * Provides action methods that create and queue modifiers.
 * This is the main API for UI components to perform email actions.
 *
 * Usage:
 * ```typescript
 * function EmailToolbar({ email }: { email: EmailDocument }) {
 *   const { archive, deleteEmail, markRead, move, undo } = useModifierActions()
 *
 *   return (
 *     <div>
 *       <button onClick={() => archive(email)}>Archive</button>
 *       <button onClick={() => deleteEmail(email)}>Delete</button>
 *       <button onClick={() => markRead(email)}>Mark Read</button>
 *     </div>
 *   )
 * }
 * ```
 */

import { useCallback, useRef, useState } from 'react'
import { modifierQueue } from '@/services/modifiers'
import {
  ArchiveModifier,
  UnarchiveModifier,
  DeleteModifier,
  MarkReadModifier,
  MarkUnreadModifier,
  MoveModifier,
  StarModifier,
  UnstarModifier,
} from '@/services/modifiers/email'
import { DraftUpdateModifier, DraftDeleteModifier } from '@/services/modifiers/draft'
import { logger } from '@/services/logger'
import type { EmailDocument } from '@/services/database/schemas/email.schema'
import type { DraftDocument } from '@/services/database/schemas/draft.schema'
import type { ProviderType } from '@/services/modifiers/types'

/**
 * Get provider type from account ID
 */
function getProviderType(accountId: string): ProviderType {
  if (accountId.startsWith('gmail:')) return 'gmail'
  if (accountId.startsWith('outlook:') || accountId.startsWith('microsoft:')) return 'outlook'

  const lower = accountId.toLowerCase()
  if (lower.includes('@gmail.com') || lower.includes('@googlemail.com')) return 'gmail'
  if (
    lower.includes('@outlook.') ||
    lower.includes('@hotmail.') ||
    lower.includes('@live.') ||
    lower.includes('@msn.')
  )
    return 'outlook'

  return 'gmail' // Default
}

/**
 * Undo entry for tracking actions
 */
interface UndoEntry {
  modifierId: string
  entityId: string
  type: string
  timestamp: number
}

/**
 * Result of an action
 */
export interface ActionResult {
  success: boolean
  modifierId: string
  undo: () => Promise<void>
}

/**
 * Hook for modifier-based email actions
 */
export function useModifierActions() {
  const undoStackRef = useRef<UndoEntry[]>([])
  const [lastAction, setLastAction] = useState<UndoEntry | null>(null)

  /**
   * Archive an email
   */
  const archive = useCallback(async (email: EmailDocument): Promise<ActionResult> => {
    const provider = getProviderType(email.accountId)

    const modifier = new ArchiveModifier({
      entityId: email.id,
      accountId: email.accountId,
      provider,
      currentLabels: [...email.labels],
      currentFolder: email.folder,
    })

    const doc = await modifierQueue.add(modifier)

    const undoEntry: UndoEntry = {
      modifierId: doc.id,
      entityId: email.id,
      type: 'archive',
      timestamp: Date.now(),
    }
    undoStackRef.current.push(undoEntry)
    setLastAction(undoEntry)

    logger.info('modifier-actions', 'Email archived', { emailId: email.id })

    return {
      success: true,
      modifierId: doc.id,
      undo: async () => {
        await modifierQueue.remove(doc.id)
        // Add unarchive modifier
        const unarchive = new UnarchiveModifier({
          entityId: email.id,
          accountId: email.accountId,
          provider,
          currentLabels: [...email.labels],
          currentFolder: 'archive',
        })
        await modifierQueue.add(unarchive)
      },
    }
  }, [])

  /**
   * Delete (trash) an email
   */
  const deleteEmail = useCallback(async (email: EmailDocument): Promise<ActionResult> => {
    const provider = getProviderType(email.accountId)

    const modifier = new DeleteModifier({
      entityId: email.id,
      accountId: email.accountId,
      provider,
      currentFolder: email.folder,
      currentLabels: [...email.labels],
    })

    const doc = await modifierQueue.add(modifier)

    const undoEntry: UndoEntry = {
      modifierId: doc.id,
      entityId: email.id,
      type: 'delete',
      timestamp: Date.now(),
    }
    undoStackRef.current.push(undoEntry)
    setLastAction(undoEntry)

    logger.info('modifier-actions', 'Email deleted', { emailId: email.id })

    return {
      success: true,
      modifierId: doc.id,
      undo: async () => {
        await modifierQueue.remove(doc.id)
      },
    }
  }, [])

  /**
   * Mark email as read
   */
  const markRead = useCallback(async (email: EmailDocument): Promise<ActionResult> => {
    const provider = getProviderType(email.accountId)

    const modifier = new MarkReadModifier({
      entityId: email.id,
      accountId: email.accountId,
      provider,
      currentLabels: [...email.labels],
      markAsRead: true,
    })

    const doc = await modifierQueue.add(modifier)

    logger.info('modifier-actions', 'Email marked read', { emailId: email.id })

    return {
      success: true,
      modifierId: doc.id,
      undo: async () => {
        await modifierQueue.remove(doc.id)
        const unread = new MarkUnreadModifier({
          entityId: email.id,
          accountId: email.accountId,
          provider,
          currentLabels: [...email.labels],
          markAsRead: false,
        })
        await modifierQueue.add(unread)
      },
    }
  }, [])

  /**
   * Mark email as unread
   */
  const markUnread = useCallback(async (email: EmailDocument): Promise<ActionResult> => {
    const provider = getProviderType(email.accountId)

    const modifier = new MarkUnreadModifier({
      entityId: email.id,
      accountId: email.accountId,
      provider,
      currentLabels: [...email.labels],
      markAsRead: false,
    })

    const doc = await modifierQueue.add(modifier)

    logger.info('modifier-actions', 'Email marked unread', { emailId: email.id })

    return {
      success: true,
      modifierId: doc.id,
      undo: async () => {
        await modifierQueue.remove(doc.id)
        const read = new MarkReadModifier({
          entityId: email.id,
          accountId: email.accountId,
          provider,
          currentLabels: [...email.labels],
          markAsRead: true,
        })
        await modifierQueue.add(read)
      },
    }
  }, [])

  /**
   * Toggle read status
   */
  const toggleRead = useCallback(
    async (email: EmailDocument): Promise<ActionResult> => {
      if (email.read) {
        return markUnread(email)
      } else {
        return markRead(email)
      }
    },
    [markRead, markUnread]
  )

  /**
   * Move email to a folder
   */
  const move = useCallback(
    async (email: EmailDocument, targetFolder: string): Promise<ActionResult> => {
      const provider = getProviderType(email.accountId)

      const modifier = new MoveModifier({
        entityId: email.id,
        accountId: email.accountId,
        provider,
        targetFolder,
        sourceFolder: email.folder,
        currentLabels: [...email.labels],
      })

      const doc = await modifierQueue.add(modifier)

      const undoEntry: UndoEntry = {
        modifierId: doc.id,
        entityId: email.id,
        type: 'move',
        timestamp: Date.now(),
      }
      undoStackRef.current.push(undoEntry)
      setLastAction(undoEntry)

      logger.info('modifier-actions', 'Email moved', {
        emailId: email.id,
        from: email.folder,
        to: targetFolder,
      })

      return {
        success: true,
        modifierId: doc.id,
        undo: async () => {
          await modifierQueue.remove(doc.id)
          // Move back
          const moveBack = new MoveModifier({
            entityId: email.id,
            accountId: email.accountId,
            provider,
            targetFolder: email.folder,
            sourceFolder: targetFolder,
            currentLabels: [...email.labels],
          })
          await modifierQueue.add(moveBack)
        },
      }
    },
    []
  )

  /**
   * Star an email
   */
  const star = useCallback(async (email: EmailDocument): Promise<ActionResult> => {
    const provider = getProviderType(email.accountId)

    const modifier = new StarModifier({
      entityId: email.id,
      accountId: email.accountId,
      provider,
      currentLabels: [...email.labels],
      star: true,
    })

    const doc = await modifierQueue.add(modifier)

    logger.info('modifier-actions', 'Email starred', { emailId: email.id })

    return {
      success: true,
      modifierId: doc.id,
      undo: async () => {
        await modifierQueue.remove(doc.id)
        const unstarMod = new UnstarModifier({
          entityId: email.id,
          accountId: email.accountId,
          provider,
          currentLabels: [...email.labels],
          star: false,
        })
        await modifierQueue.add(unstarMod)
      },
    }
  }, [])

  /**
   * Unstar an email
   */
  const unstar = useCallback(async (email: EmailDocument): Promise<ActionResult> => {
    const provider = getProviderType(email.accountId)

    const modifier = new UnstarModifier({
      entityId: email.id,
      accountId: email.accountId,
      provider,
      currentLabels: [...email.labels],
      star: false,
    })

    const doc = await modifierQueue.add(modifier)

    logger.info('modifier-actions', 'Email unstarred', { emailId: email.id })

    return {
      success: true,
      modifierId: doc.id,
      undo: async () => {
        await modifierQueue.remove(doc.id)
        const starMod = new StarModifier({
          entityId: email.id,
          accountId: email.accountId,
          provider,
          currentLabels: [...email.labels],
          star: true,
        })
        await modifierQueue.add(starMod)
      },
    }
  }, [])

  /**
   * Toggle star status
   */
  const toggleStar = useCallback(
    async (email: EmailDocument): Promise<ActionResult> => {
      if (email.starred) {
        return unstar(email)
      } else {
        return star(email)
      }
    },
    [star, unstar]
  )

  /**
   * Undo the last action
   */
  const undoLast = useCallback(async (): Promise<boolean> => {
    const entry = undoStackRef.current.pop()
    if (!entry) return false

    const success = await modifierQueue.remove(entry.modifierId)
    setLastAction(undoStackRef.current[undoStackRef.current.length - 1] || null)

    logger.info('modifier-actions', 'Action undone', {
      type: entry.type,
      entityId: entry.entityId,
    })

    return success
  }, [])

  /**
   * Update a draft
   */
  const updateDraft = useCallback(
    async (draft: DraftDocument, updates: Partial<DraftDocument>): Promise<ActionResult> => {
      const provider = getProviderType(draft.accountId)

      const modifier = new DraftUpdateModifier({
        entityId: draft.id,
        accountId: draft.accountId,
        provider,
        updates,
        remoteDraftId: draft.remoteDraftId,
      })

      const doc = await modifierQueue.add(modifier)

      logger.info('modifier-actions', 'Draft update queued', { draftId: draft.id })

      return {
        success: true,
        modifierId: doc.id,
        undo: async () => {
          await modifierQueue.remove(doc.id)
        },
      }
    },
    []
  )

  /**
   * Delete a draft
   */
  const deleteDraft = useCallback(async (draft: DraftDocument): Promise<ActionResult> => {
    const provider = getProviderType(draft.accountId)

    const modifier = new DraftDeleteModifier({
      entityId: draft.id,
      accountId: draft.accountId,
      provider,
      remoteDraftId: draft.remoteDraftId,
    })

    const doc = await modifierQueue.add(modifier)

    logger.info('modifier-actions', 'Draft delete queued', { draftId: draft.id })

    return {
      success: true,
      modifierId: doc.id,
      undo: async () => {
        await modifierQueue.remove(doc.id)
      },
    }
  }, [])

  return {
    // Email actions
    archive,
    deleteEmail,
    markRead,
    markUnread,
    toggleRead,
    move,
    star,
    unstar,
    toggleStar,

    // Draft actions
    updateDraft,
    deleteDraft,

    // Undo
    undoLast,
    lastAction,
  }
}

/**
 * Hook for bulk email actions
 */
export function useBulkModifierActions() {
  const { archive, deleteEmail, markRead, markUnread, move } = useModifierActions()

  const archiveAll = useCallback(
    async (emails: EmailDocument[]): Promise<ActionResult[]> => {
      const results = await Promise.all(emails.map((email) => archive(email)))
      return results
    },
    [archive]
  )

  const deleteAll = useCallback(
    async (emails: EmailDocument[]): Promise<ActionResult[]> => {
      const results = await Promise.all(emails.map((email) => deleteEmail(email)))
      return results
    },
    [deleteEmail]
  )

  const markReadAll = useCallback(
    async (emails: EmailDocument[]): Promise<ActionResult[]> => {
      const results = await Promise.all(
        emails.filter((e) => !e.read).map((email) => markRead(email))
      )
      return results
    },
    [markRead]
  )

  const markUnreadAll = useCallback(
    async (emails: EmailDocument[]): Promise<ActionResult[]> => {
      const results = await Promise.all(
        emails.filter((e) => e.read).map((email) => markUnread(email))
      )
      return results
    },
    [markUnread]
  )

  const moveAll = useCallback(
    async (emails: EmailDocument[], targetFolder: string): Promise<ActionResult[]> => {
      const results = await Promise.all(emails.map((email) => move(email, targetFolder)))
      return results
    },
    [move]
  )

  return {
    archiveAll,
    deleteAll,
    markReadAll,
    markUnreadAll,
    moveAll,
  }
}
