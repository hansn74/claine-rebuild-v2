/**
 * useDerivedEmailState Hook
 *
 * Epic 3: Offline-First Modifier Architecture
 * Story 3.4: State Derivation Layer
 *
 * Derives email state by applying pending modifiers to cached data.
 * This is the core of the Superhuman-style modifier pattern:
 *
 * displayState = cache + pendingModifiers
 *
 * Benefits:
 * - UI shows immediate feedback (optimistic updates)
 * - State automatically reverts if modifier removed (undo)
 * - Consistent state even with pending sync operations
 *
 * Usage:
 * ```typescript
 * function EmailItem({ emailId }: { emailId: string }) {
 *   const email = useDerivedEmailState(emailId)
 *
 *   // `email` includes all pending modifications
 *   // Changes appear immediately when modifiers are added
 *   // State reverts automatically when modifiers are removed
 *
 *   return <div className={email.read ? '' : 'font-bold'}>{email.subject}</div>
 * }
 * ```
 */

import { useState, useEffect, useMemo } from 'react'
import { getDatabase, isDatabaseInitialized } from '@/services/database/init'
import { modifierQueue } from '@/services/modifiers'
import { emailModifierFromDocument } from '@/services/modifiers/email'
import { logger } from '@/services/logger'
import type { EmailDocument } from '@/services/database/schemas/email.schema'
import type { ModifierDocument } from '@/services/modifiers/types'

/**
 * Apply modifiers to an email to derive current state
 */
function applyModifiers(email: EmailDocument, modifiers: ModifierDocument[]): EmailDocument {
  if (modifiers.length === 0) return email

  return modifiers.reduce((currentState, modDoc) => {
    try {
      const modifier = emailModifierFromDocument(modDoc)
      return modifier.modify(currentState)
    } catch (error) {
      logger.warn('derived-state', 'Failed to apply modifier', {
        modifierId: modDoc.id,
        error: error instanceof Error ? error.message : String(error),
      })
      return currentState
    }
  }, email)
}

/**
 * Hook to get derived email state with pending modifiers applied
 *
 * @param emailId - Email ID to get derived state for
 * @returns Derived email state or null if not found
 */
export function useDerivedEmailState(emailId: string | null): EmailDocument | null {
  const [cachedEmail, setCachedEmail] = useState<EmailDocument | null>(null)
  const [pendingModifiers, setPendingModifiers] = useState<ModifierDocument[]>([])

  // Subscribe to email changes from database
  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null

    const setup = async () => {
      if (!emailId || !isDatabaseInitialized()) {
        setCachedEmail(null)
        return
      }

      const db = getDatabase()
      if (!db.emails) {
        setCachedEmail(null)
        return
      }

      // Subscribe to changes (subscription callback is allowed)
      subscription = db.emails.findOne(emailId).$.subscribe((doc) => {
        if (doc) {
          setCachedEmail(doc.toJSON() as EmailDocument)
        } else {
          setCachedEmail(null)
        }
      })
    }

    setup()

    return () => {
      if (subscription) subscription.unsubscribe()
    }
  }, [emailId])

  // Get and subscribe to pending modifiers
  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null

    const setup = () => {
      if (!emailId) {
        setPendingModifiers([])
        return
      }

      // Initial fetch
      setPendingModifiers(modifierQueue.getModifiersForEntity(emailId))

      // Subscribe to queue events
      subscription = modifierQueue.getEvents$().subscribe((event) => {
        if (
          (event.type === 'added' && event.modifier.entityId === emailId) ||
          (event.type === 'removed' && event.entityId === emailId) ||
          (event.type === 'completed' && event.modifier.entityId === emailId) ||
          (event.type === 'failed' && event.modifier.entityId === emailId)
        ) {
          // Refetch modifiers for this entity (callback is allowed)
          setPendingModifiers(modifierQueue.getModifiersForEntity(emailId))
        }
      })
    }

    setup()

    return () => {
      if (subscription) subscription.unsubscribe()
    }
  }, [emailId])

  // Derive final state
  const derivedEmail = useMemo(() => {
    if (!cachedEmail) return null
    return applyModifiers(cachedEmail, pendingModifiers)
  }, [cachedEmail, pendingModifiers])

  return derivedEmail
}

/**
 * Hook to get derived state for multiple emails
 *
 * @param emailIds - Array of email IDs
 * @returns Map of email ID to derived state
 */
export function useDerivedEmailStates(emailIds: string[]): Map<string, EmailDocument> {
  const [cachedEmails, setCachedEmails] = useState<Map<string, EmailDocument>>(new Map())
  const [modifiersByEntity, setModifiersByEntity] = useState<Map<string, ModifierDocument[]>>(
    new Map()
  )

  // Stable key for dependency tracking
  const emailIdsKey = useMemo(() => emailIds.join(','), [emailIds])

  // Subscribe to email changes
  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null

    const setup = async () => {
      if (emailIds.length === 0 || !isDatabaseInitialized()) {
        setCachedEmails(new Map())
        return
      }

      const db = getDatabase()
      if (!db.emails) {
        setCachedEmails(new Map())
        return
      }

      // Subscribe to changes for all emails
      subscription = db.emails
        .find({
          selector: { id: { $in: emailIds } },
        })
        .$.subscribe((docs) => {
          const newMap = new Map<string, EmailDocument>()
          for (const doc of docs) {
            newMap.set(doc.id, doc.toJSON() as EmailDocument)
          }
          setCachedEmails(newMap)
        })
    }

    setup()

    return () => {
      if (subscription) subscription.unsubscribe()
    }
  }, [emailIds, emailIdsKey])

  // Get modifiers for all emails
  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null

    const setup = () => {
      if (emailIds.length === 0) {
        setModifiersByEntity(new Map())
        return
      }

      // Initial fetch
      const newMap = new Map<string, ModifierDocument[]>()
      for (const id of emailIds) {
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

        if (entityId && emailIds.includes(entityId)) {
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
  }, [emailIds, emailIdsKey])

  // Derive final states
  const derivedEmails = useMemo(() => {
    const result = new Map<string, EmailDocument>()

    for (const [id, email] of cachedEmails) {
      const modifiers = modifiersByEntity.get(id) || []
      result.set(id, applyModifiers(email, modifiers))
    }

    return result
  }, [cachedEmails, modifiersByEntity])

  return derivedEmails
}

/**
 * Hook to check if an email has pending modifiers
 */
export function useHasPendingModifiers(emailId: string | null): boolean {
  const [hasPending, setHasPending] = useState(false)

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null

    const setup = () => {
      if (!emailId) {
        setHasPending(false)
        return
      }

      // Initial check
      setHasPending(modifierQueue.hasPendingModifiers(emailId))

      // Subscribe to changes
      subscription = modifierQueue.getEvents$().subscribe((event) => {
        const entityId =
          event.type === 'removed'
            ? event.entityId
            : (event as { modifier: ModifierDocument }).modifier?.entityId

        if (entityId === emailId) {
          setHasPending(modifierQueue.hasPendingModifiers(emailId))
        }
      })
    }

    setup()

    return () => {
      if (subscription) subscription.unsubscribe()
    }
  }, [emailId])

  return hasPending
}
