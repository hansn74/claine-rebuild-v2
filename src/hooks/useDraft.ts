/**
 * useDraft Hook
 *
 * Story 2.3: Compose & Reply Interface
 * Task 7: Implement Draft Auto-Save
 *
 * Features:
 * - Create, load, save, and delete drafts
 * - Auto-save every 30 seconds (AC6)
 * - Debounced save on content change
 * - Draft persistence in RxDB
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { getDatabase, isDatabaseInitialized } from '@/services/database/init'
import { logger } from '@/services/logger'
import { gmailDraftSyncService } from '@/services/email/gmailDraftSync'
import { outlookDraftSyncService } from '@/services/email/outlookDraftSync'
import { useAccountStore } from '@/store/accountStore'
import type { DraftDocument, DraftType } from '@/services/database/schemas/draft.schema'
import type { EmailAddress, EmailBody } from '@/services/database/schemas/email.schema'

/**
 * Get the appropriate draft sync service based on account provider
 */
function getDraftSyncService(provider: 'gmail' | 'outlook') {
  return provider === 'outlook' ? outlookDraftSyncService : gmailDraftSyncService
}

const AUTO_SAVE_INTERVAL = 30000 // 30 seconds
const DEBOUNCE_DELAY = 1000 // 1 second debounce for immediate changes

/**
 * Draft data for creating/updating
 */
export interface DraftData {
  type: DraftType
  to: EmailAddress[]
  cc: EmailAddress[]
  bcc: EmailAddress[]
  subject: string
  body: EmailBody
  replyToEmailId?: string
  threadId?: string
}

/**
 * Result interface for useDraft hook
 */
export interface UseDraftResult {
  /** Current draft data (null if not loaded) */
  draft: DraftDocument | null
  /** Draft ID (useful for new drafts) */
  draftId: string | null
  /** Whether the draft is currently being saved */
  isSaving: boolean
  /** Timestamp of last successful save */
  lastSaved: Date | null
  /** Whether the draft is being loaded */
  isLoading: boolean
  /** Error if any operation failed */
  error: Error | null
  /** Create a new draft */
  createDraft: (accountId: string, data: DraftData) => Promise<string>
  /** Update the current draft */
  updateDraft: (updates: Partial<DraftData>) => void
  /** Save immediately (for send/close operations) */
  saveNow: () => Promise<void>
  /** Delete the current draft */
  deleteDraft: () => Promise<void>
}

/**
 * Generate a unique draft ID
 */
function generateDraftId(): string {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

/**
 * useDraft hook
 * Manages draft lifecycle with auto-save functionality
 *
 * @param draftId - Optional draft ID to load existing draft
 * @returns Draft management functions and state
 */
export function useDraft(draftId: string | null = null): UseDraftResult {
  const [draft, setDraft] = useState<DraftDocument | null>(null)
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(draftId)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [isLoading, setIsLoading] = useState(!!draftId)
  const [error, setError] = useState<Error | null>(null)

  // Refs for managing auto-save
  const pendingChangesRef = useRef<Partial<DraftData> | null>(null)
  const autoSaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load existing draft
  useEffect(() => {
    if (!draftId) {
      setDraft(null)
      setCurrentDraftId(null)
      setIsLoading(false)
      return
    }

    const loadDraft = async () => {
      if (!isDatabaseInitialized()) {
        logger.warn('compose', 'Database not initialized, skipping draft load')
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        const db = getDatabase()
        if (!db.drafts) {
          logger.warn('compose', 'Drafts collection not available')
          setIsLoading(false)
          return
        }

        const doc = await db.drafts.findOne(draftId).exec()
        if (doc) {
          const draftData = doc.toJSON() as DraftDocument
          setDraft(draftData)
          setCurrentDraftId(draftData.id)
          setLastSaved(new Date(draftData.lastSaved))
          logger.debug('compose', 'Draft loaded', { draftId })
        } else {
          logger.warn('compose', 'Draft not found', { draftId })
        }
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error('Failed to load draft')
        setError(errorObj)
        logger.error('compose', 'Failed to load draft', { draftId, error: errorObj.message })
      } finally {
        setIsLoading(false)
      }
    }

    loadDraft()
  }, [draftId])

  // Get accounts from store to determine provider
  const accounts = useAccountStore((state) => state.accounts)

  // Save draft to database and sync to server
  const saveDraftToDb = useCallback(async () => {
    if (!draft || !isDatabaseInitialized()) return

    setIsSaving(true)

    try {
      const db = getDatabase()
      if (!db.drafts) {
        throw new Error('Drafts collection not available')
      }

      const now = Date.now()
      let updatedDraft: DraftDocument = {
        ...draft,
        ...pendingChangesRef.current,
        lastSaved: now,
      }

      // Save locally first
      await db.drafts.upsert(updatedDraft)

      // Sync to server - determine which service based on account provider
      const account = accounts.find((a) => a.id === draft.accountId)
      const provider = account?.provider || 'gmail'
      const syncService = getDraftSyncService(provider)
      const remoteDraftId = await syncService.syncDraft(draft.accountId, updatedDraft)

      // If we got a new remote ID, update the local draft
      if (remoteDraftId && remoteDraftId !== draft.remoteDraftId) {
        updatedDraft = {
          ...updatedDraft,
          remoteDraftId,
          syncedAt: now,
        }
        await db.drafts.upsert(updatedDraft)
        logger.debug('compose', 'Draft synced to server', {
          draftId: draft.id,
          remoteDraftId,
          provider,
        })
      }

      setDraft(updatedDraft)
      setLastSaved(new Date(now))
      pendingChangesRef.current = null
      setError(null)

      logger.debug('compose', 'Draft saved', { draftId: draft.id })
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Failed to save draft')
      setError(errorObj)
      logger.error('compose', 'Failed to save draft', { error: errorObj.message })
    } finally {
      setIsSaving(false)
    }
  }, [draft, accounts])

  // Set up auto-save interval
  useEffect(() => {
    if (!draft) return

    autoSaveTimerRef.current = setInterval(async () => {
      if (pendingChangesRef.current) {
        await saveDraftToDb()
      }
    }, AUTO_SAVE_INTERVAL)

    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current)
      }
    }
  }, [draft, saveDraftToDb])

  // Create a new draft
  const createDraft = useCallback(async (accountId: string, data: DraftData): Promise<string> => {
    if (!isDatabaseInitialized()) {
      throw new Error('Database not initialized')
    }

    const db = getDatabase()
    if (!db.drafts) {
      throw new Error('Drafts collection not available')
    }

    const newDraftId = generateDraftId()
    const now = Date.now()

    const newDraft: DraftDocument = {
      id: newDraftId,
      accountId,
      type: data.type,
      to: data.to,
      cc: data.cc,
      bcc: data.bcc,
      subject: data.subject,
      body: data.body,
      replyToEmailId: data.replyToEmailId,
      threadId: data.threadId,
      createdAt: now,
      lastSaved: now,
    }

    await db.drafts.insert(newDraft)

    setDraft(newDraft)
    setCurrentDraftId(newDraftId)
    setLastSaved(new Date(now))

    logger.info('compose', 'Draft created', { draftId: newDraftId, type: data.type })

    return newDraftId
  }, [])

  // Update draft (debounced)
  const updateDraft = useCallback(
    (updates: Partial<DraftData>) => {
      if (!draft) return

      // Merge with pending changes
      pendingChangesRef.current = {
        ...pendingChangesRef.current,
        ...updates,
      }

      // Update local state immediately for UI responsiveness
      setDraft((prev) =>
        prev
          ? {
              ...prev,
              ...updates,
            }
          : null
      )

      // Debounce the actual save
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }

      debounceTimerRef.current = setTimeout(() => {
        saveDraftToDb()
      }, DEBOUNCE_DELAY)
    },
    [draft, saveDraftToDb]
  )

  // Save immediately
  const saveNow = useCallback(async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    if (pendingChangesRef.current || draft) {
      await saveDraftToDb()
    }
  }, [draft, saveDraftToDb])

  // Delete draft (local and server)
  const deleteDraft = useCallback(async () => {
    if (!draft || !isDatabaseInitialized()) return

    try {
      const db = getDatabase()
      if (!db.drafts) {
        throw new Error('Drafts collection not available')
      }

      // Delete from server if synced
      if (draft.remoteDraftId) {
        const account = accounts.find((a) => a.id === draft.accountId)
        const provider = account?.provider || 'gmail'
        const syncService = getDraftSyncService(provider)
        await syncService.deleteDraft(draft.accountId, draft.remoteDraftId)
      }

      // Delete locally
      const doc = await db.drafts.findOne(draft.id).exec()
      if (doc) {
        await doc.remove()
      }

      // Clear timers
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current)
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }

      setDraft(null)
      setCurrentDraftId(null)
      setLastSaved(null)
      pendingChangesRef.current = null

      logger.info('compose', 'Draft deleted', {
        draftId: draft.id,
        remoteDraftId: draft.remoteDraftId,
      })
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Failed to delete draft')
      setError(errorObj)
      logger.error('compose', 'Failed to delete draft', { error: errorObj.message })
    }
  }, [draft, accounts])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearInterval(autoSaveTimerRef.current)
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  return {
    draft,
    draftId: currentDraftId,
    isSaving,
    lastSaved,
    isLoading,
    error,
    createDraft,
    updateDraft,
    saveNow,
    deleteDraft,
  }
}
