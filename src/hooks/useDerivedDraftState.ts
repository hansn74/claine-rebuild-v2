/**
 * useDerivedDraftState Hook
 *
 * Epic 3: Offline-First Modifier Architecture
 * Story 3.4: State Derivation Layer
 *
 * Derives draft state by applying pending modifiers to cached data.
 *
 * displayState = cache + pendingModifiers
 *
 * Usage:
 * ```typescript
 * function DraftEditor({ draftId }: { draftId: string }) {
 *   const draft = useDerivedDraftState(draftId)
 *
 *   // `draft` includes all pending modifications
 *   // Changes appear immediately when modifiers are added
 *
 *   return <RichTextEditor content={draft.body.html} />
 * }
 * ```
 */

import { useState, useEffect, useMemo } from 'react'
import { getDatabase, isDatabaseInitialized } from '@/services/database/init'
import { modifierQueue } from '@/services/modifiers'
import { draftModifierFromDocument } from '@/services/modifiers/draft'
import { logger } from '@/services/logger'
import type { DraftDocument } from '@/services/database/schemas/draft.schema'
import type { ModifierDocument } from '@/services/modifiers/types'

/**
 * Apply modifiers to a draft to derive current state
 */
function applyModifiers(draft: DraftDocument, modifiers: ModifierDocument[]): DraftDocument {
  if (modifiers.length === 0) return draft

  return modifiers.reduce((currentState, modDoc) => {
    try {
      const modifier = draftModifierFromDocument(modDoc)
      return modifier.modify(currentState)
    } catch (error) {
      logger.warn('derived-draft-state', 'Failed to apply modifier', {
        modifierId: modDoc.id,
        error: error instanceof Error ? error.message : String(error),
      })
      return currentState
    }
  }, draft)
}

/**
 * Hook to get derived draft state with pending modifiers applied
 *
 * @param draftId - Draft ID to get derived state for
 * @returns Derived draft state or null if not found
 */
export function useDerivedDraftState(draftId: string | null): DraftDocument | null {
  const [cachedDraft, setCachedDraft] = useState<DraftDocument | null>(null)
  const [pendingModifiers, setPendingModifiers] = useState<ModifierDocument[]>([])

  // Subscribe to draft changes from database
  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null

    const setup = async () => {
      if (!draftId || !isDatabaseInitialized()) {
        setCachedDraft(null)
        return
      }

      const db = getDatabase()
      if (!db.drafts) {
        setCachedDraft(null)
        return
      }

      // Subscribe to changes (subscription callback is allowed)
      subscription = db.drafts.findOne(draftId).$.subscribe((doc) => {
        if (doc) {
          setCachedDraft(doc.toJSON() as DraftDocument)
        } else {
          setCachedDraft(null)
        }
      })
    }

    setup()

    return () => {
      if (subscription) subscription.unsubscribe()
    }
  }, [draftId])

  // Get and subscribe to pending modifiers
  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null

    const setup = () => {
      if (!draftId) {
        setPendingModifiers([])
        return
      }

      // Initial fetch
      setPendingModifiers(modifierQueue.getModifiersForEntity(draftId))

      // Subscribe to queue events
      subscription = modifierQueue.getEvents$().subscribe((event) => {
        if (
          (event.type === 'added' && event.modifier.entityId === draftId) ||
          (event.type === 'removed' && event.entityId === draftId) ||
          (event.type === 'completed' && event.modifier.entityId === draftId) ||
          (event.type === 'failed' && event.modifier.entityId === draftId)
        ) {
          // Refetch modifiers for this entity (callback is allowed)
          setPendingModifiers(modifierQueue.getModifiersForEntity(draftId))
        }
      })
    }

    setup()

    return () => {
      if (subscription) subscription.unsubscribe()
    }
  }, [draftId])

  // Derive final state
  const derivedDraft = useMemo(() => {
    if (!cachedDraft) return null
    return applyModifiers(cachedDraft, pendingModifiers)
  }, [cachedDraft, pendingModifiers])

  return derivedDraft
}

/**
 * Hook to get derived state for multiple drafts
 *
 * @param draftIds - Array of draft IDs
 * @returns Map of draft ID to derived state
 */
export function useDerivedDraftStates(draftIds: string[]): Map<string, DraftDocument> {
  const [cachedDrafts, setCachedDrafts] = useState<Map<string, DraftDocument>>(new Map())
  const [modifiersByEntity, setModifiersByEntity] = useState<Map<string, ModifierDocument[]>>(
    new Map()
  )

  // Stable key for dependency tracking
  const draftIdsKey = useMemo(() => draftIds.join(','), [draftIds])

  // Subscribe to draft changes
  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null

    const setup = async () => {
      if (draftIds.length === 0 || !isDatabaseInitialized()) {
        setCachedDrafts(new Map())
        return
      }

      const db = getDatabase()
      if (!db.drafts) {
        setCachedDrafts(new Map())
        return
      }

      // Subscribe to changes for all drafts
      subscription = db.drafts
        .find({
          selector: { id: { $in: draftIds } },
        })
        .$.subscribe((docs) => {
          const newMap = new Map<string, DraftDocument>()
          for (const doc of docs) {
            newMap.set(doc.id, doc.toJSON() as DraftDocument)
          }
          setCachedDrafts(newMap)
        })
    }

    setup()

    return () => {
      if (subscription) subscription.unsubscribe()
    }
  }, [draftIds, draftIdsKey])

  // Get modifiers for all drafts
  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null

    const setup = () => {
      if (draftIds.length === 0) {
        setModifiersByEntity(new Map())
        return
      }

      // Initial fetch
      const newMap = new Map<string, ModifierDocument[]>()
      for (const id of draftIds) {
        const modifiers = modifierQueue.getModifiersForEntity(id)
        if (modifiers.length > 0) {
          newMap.set(id, modifiers)
        }
      }
      setModifiersByEntity(newMap)

      // Subscribe to queue events
      subscription = modifierQueue.getEvents$().subscribe((event) => {
        const entityId =
          event.type === 'removed'
            ? event.entityId
            : (event as { modifier: ModifierDocument }).modifier?.entityId

        if (entityId && draftIds.includes(entityId)) {
          const modifiers = modifierQueue.getModifiersForEntity(entityId)
          setModifiersByEntity((prev) => {
            const next = new Map(prev)
            if (modifiers.length > 0) {
              next.set(entityId, modifiers)
            } else {
              next.delete(entityId)
            }
            return next
          })
        }
      })
    }

    setup()

    return () => {
      if (subscription) subscription.unsubscribe()
    }
  }, [draftIds, draftIdsKey])

  // Derive final states
  const derivedDrafts = useMemo(() => {
    const result = new Map<string, DraftDocument>()

    for (const [id, draft] of cachedDrafts) {
      const modifiers = modifiersByEntity.get(id) || []
      result.set(id, applyModifiers(draft, modifiers))
    }

    return result
  }, [cachedDrafts, modifiersByEntity])

  return derivedDrafts
}

/**
 * Hook to check if a draft has pending modifiers
 */
export function useHasPendingDraftModifiers(draftId: string | null): boolean {
  const [hasPending, setHasPending] = useState(false)

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null

    const setup = () => {
      if (!draftId) {
        setHasPending(false)
        return
      }

      // Initial check
      setHasPending(modifierQueue.hasPendingModifiers(draftId))

      // Subscribe to changes
      subscription = modifierQueue.getEvents$().subscribe((event) => {
        const entityId =
          event.type === 'removed'
            ? event.entityId
            : (event as { modifier: ModifierDocument }).modifier?.entityId

        if (entityId === draftId) {
          setHasPending(modifierQueue.hasPendingModifiers(draftId))
        }
      })
    }

    setup()

    return () => {
      if (subscription) subscription.unsubscribe()
    }
  }, [draftId])

  return hasPending
}

/**
 * Hook to check if a draft is syncing (has processing modifiers)
 */
export function useIsDraftSyncing(draftId: string | null): boolean {
  const [isSyncing, setIsSyncing] = useState(false)

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null

    const setup = () => {
      if (!draftId) {
        setIsSyncing(false)
        return
      }

      // Initial check
      const modifiers = modifierQueue.getModifiersForEntity(draftId)
      setIsSyncing(modifiers.some((m) => m.status === 'processing'))

      // Subscribe to changes
      subscription = modifierQueue.getEvents$().subscribe((event) => {
        const entityId =
          event.type === 'removed'
            ? event.entityId
            : (event as { modifier: ModifierDocument }).modifier?.entityId

        if (entityId === draftId) {
          const updated = modifierQueue.getModifiersForEntity(draftId)
          setIsSyncing(updated.some((m) => m.status === 'processing'))
        }
      })
    }

    setup()

    return () => {
      if (subscription) subscription.unsubscribe()
    }
  }, [draftId])

  return isSyncing
}
