/**
 * useContacts Hook
 *
 * Story 2.3: Compose & Reply Interface
 * Task 9: Contact Storage and Extraction
 *
 * Features:
 * - Fetch contacts from RxDB for autocomplete
 * - Sort by frequency then recency
 * - Update contact usage when used in compose
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { getDatabase, isDatabaseInitialized } from '@/services/database/init'
import { logger } from '@/services/logger'
import type { ContactDocument } from '@/services/database/schemas/contact.schema'
import type { EmailAddress } from '@/services/database/schemas/email.schema'

/**
 * Result interface for useContacts hook
 */
export interface UseContactsResult {
  /** List of contacts sorted by frequency/recency */
  contacts: EmailAddress[]
  /** Whether contacts are loading */
  isLoading: boolean
  /** Error if fetching failed */
  error: Error | null
  /** Update contact usage when used in compose */
  markContactUsed: (email: string) => Promise<void>
  /** Search contacts by query */
  searchContacts: (query: string) => EmailAddress[]
}

/**
 * Convert ContactDocument to EmailAddress
 */
function contactToEmailAddress(contact: ContactDocument): EmailAddress {
  return {
    email: contact.email,
    name: contact.name,
  }
}

/**
 * useContacts hook
 * Fetches and manages contacts for autocomplete
 *
 * @param accountId - Account ID to filter contacts
 * @returns Contacts list and management functions
 */
export function useContacts(accountId: string | null): UseContactsResult {
  const [contacts, setContacts] = useState<ContactDocument[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  // Load contacts from database
  useEffect(() => {
    if (!accountId) {
      setContacts([])
      setIsLoading(false)
      return
    }

    if (!isDatabaseInitialized()) {
      logger.warn('compose', 'Database not initialized, skipping contacts load')
      setIsLoading(false)
      return
    }

    const loadContacts = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const db = getDatabase()

        // Check if contacts collection exists
        if (!db.contacts) {
          logger.debug('compose', 'Contacts collection not available yet')
          setContacts([])
          setIsLoading(false)
          return
        }

        // Query contacts for this account, sorted by frequency descending
        const docs = await db.contacts
          .find({
            selector: {
              accountId,
            },
            sort: [{ frequency: 'desc' }, { lastUsed: 'desc' }],
            limit: 100, // Limit to most relevant contacts
          })
          .exec()

        const contactDocs = docs.map((doc) => doc.toJSON() as ContactDocument)
        setContacts(contactDocs)

        logger.debug('compose', 'Contacts loaded', {
          accountId,
          count: contactDocs.length,
        })
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error('Failed to load contacts')
        setError(errorObj)
        logger.error('compose', 'Failed to load contacts', { error: errorObj.message })
      } finally {
        setIsLoading(false)
      }
    }

    loadContacts()
  }, [accountId])

  // Convert to EmailAddress format for UI
  const emailAddresses = useMemo(() => contacts.map(contactToEmailAddress), [contacts])

  // Mark contact as used (increment frequency, update lastUsed)
  const markContactUsed = useCallback(
    async (email: string) => {
      if (!accountId || !isDatabaseInitialized()) return

      try {
        const db = getDatabase()

        if (!db.contacts) {
          logger.debug('compose', 'Contacts collection not available')
          return
        }

        const contactId = email.toLowerCase()
        const existingDoc = await db.contacts.findOne(contactId).exec()

        if (existingDoc) {
          // Update existing contact
          await existingDoc.update({
            $inc: { frequency: 1 },
            $set: { lastUsed: Date.now() },
          })

          // Update local state
          setContacts((prev) =>
            prev.map((c) =>
              c.id === contactId ? { ...c, frequency: c.frequency + 1, lastUsed: Date.now() } : c
            )
          )

          logger.debug('compose', 'Contact usage updated', { email })
        }
      } catch (err) {
        logger.error('compose', 'Failed to update contact usage', {
          email,
          error: err instanceof Error ? err.message : String(err),
        })
      }
    },
    [accountId]
  )

  // Search contacts by query (filters local list)
  const searchContacts = useCallback(
    (query: string): EmailAddress[] => {
      if (!query.trim()) {
        return emailAddresses.slice(0, 10)
      }

      const lowerQuery = query.toLowerCase()
      return emailAddresses.filter(
        (contact) =>
          contact.email.toLowerCase().includes(lowerQuery) ||
          contact.name.toLowerCase().includes(lowerQuery)
      )
    },
    [emailAddresses]
  )

  return {
    contacts: emailAddresses,
    isLoading,
    error,
    markContactUsed,
    searchContacts,
  }
}

/**
 * Extract contacts from email addresses and save to database
 * Called during email sync to populate contact list
 *
 * @param accountId - Account ID
 * @param addresses - Email addresses to extract contacts from
 * @param source - Source of the contact ('sent' or 'received')
 */
export async function extractAndSaveContacts(
  accountId: string,
  addresses: EmailAddress[],
  source: 'sent' | 'received'
): Promise<void> {
  if (!isDatabaseInitialized()) return

  const db = getDatabase()

  if (!db.contacts) {
    logger.debug('compose', 'Contacts collection not available')
    return
  }

  const now = Date.now()

  for (const address of addresses) {
    const contactId = address.email.toLowerCase()

    try {
      const existingDoc = await db.contacts.findOne(contactId).exec()

      if (existingDoc) {
        // Update name if we have a better one (non-empty)
        if (address.name && !existingDoc.name) {
          await existingDoc.update({
            $set: { name: address.name },
          })
        }
      } else {
        // Create new contact
        await db.contacts.insert({
          id: contactId,
          email: address.email.toLowerCase(),
          name: address.name || '',
          frequency: 0,
          lastUsed: now,
          accountId,
          source,
          firstSeen: now,
        })
      }
    } catch (err) {
      // Ignore duplicate key errors (race condition between concurrent syncs)
      if (
        err instanceof Error &&
        !err.message.includes('duplicate') &&
        !err.message.includes('conflict')
      ) {
        logger.warn('compose', 'Failed to save contact', {
          email: address.email,
          error: err.message,
        })
      }
    }
  }
}
