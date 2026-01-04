/**
 * React hook for reactive thread queries from RxDB
 * Provides real-time updates when thread emails change in the database
 *
 * Story 2.2: Thread Detail View with Conversation History
 * - Fetches all emails by threadId
 * - Returns emails sorted chronologically (oldest first)
 * - Includes loading, error states
 * - Reactive subscription (RxDB observable)
 */

import { useState, useEffect } from 'react'
import type { RxDocument } from 'rxdb'
import { getDatabase } from '@/services/database/init'
import type { EmailDocument } from '@/services/database/schemas/email.schema'

export interface UseThreadResult {
  emails: EmailDocument[]
  loading: boolean
  error: Error | null
  threadSubject: string | null
  participantCount: number
  messageCount: number
}

/**
 * Hook to get all emails in a thread from RxDB
 * Updates automatically when emails are added/modified/deleted
 *
 * @param threadId - The thread identifier to query
 * @returns Thread data including emails sorted chronologically
 */
export function useThread(threadId: string | null): UseThreadResult {
  const [emails, setEmails] = useState<EmailDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null

    const setupSubscription = async () => {
      if (!threadId) {
        setEmails([])
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const db = getDatabase()

        // Check if emails collection exists
        if (!db.emails) {
          setEmails([])
          setLoading(false)
          return
        }

        // Create reactive query for thread emails
        // Sort by timestamp ASC (oldest first for chronological order)
        const query = db.emails.find({
          selector: { threadId },
          sort: [{ timestamp: 'asc' }],
        })

        // Subscribe to changes
        subscription = query.$.subscribe({
          next: (results: RxDocument<EmailDocument>[]) => {
            const emailDocs = results.map((doc) => doc.toJSON() as EmailDocument)
            setEmails(emailDocs)
            setLoading(false)
          },
          error: (err: Error) => {
            setError(err)
            setLoading(false)
          },
        })
      } catch (err) {
        setError(err as Error)
        setLoading(false)
      }
    }

    setupSubscription()

    // Cleanup subscription on unmount or threadId change
    return () => {
      if (subscription) {
        subscription.unsubscribe()
      }
    }
  }, [threadId])

  // Derive thread subject from first email
  const threadSubject = emails[0]?.subject || null

  // Count unique participants (from + to + cc addresses)
  const participantCount =
    emails.length > 0
      ? new Set(
          emails.flatMap((email) => [
            email.from.email,
            ...email.to.map((addr) => addr.email),
            ...(email.cc || []).map((addr) => addr.email),
          ])
        ).size
      : 0

  return {
    emails,
    loading,
    error,
    threadSubject,
    participantCount,
    messageCount: emails.length,
  }
}
