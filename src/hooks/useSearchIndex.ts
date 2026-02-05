/**
 * useSearchIndex Hook
 *
 * Story 2.21: Replace Lunr.js with MiniSearch
 * Builds and maintains the search index when emails change.
 * Uses MiniSearch incremental updates (add/discard/replace) instead of full rebuilds.
 *
 * This hook should be used at the app level to ensure the search
 * index is always up-to-date with the email collection.
 */

import { useEffect, useRef } from 'react'
import { getDatabase } from '@/services/database/init'
import { useDatabaseStore } from '@/store/database'
import { searchIndexService } from '@/services/search'
import type { EmailDocument } from '@/services/database/schemas/email.schema'
import { logger } from '@/services/logger'
import { healthRegistry } from '@/services/sync/healthRegistry'

/**
 * Hook to build and maintain the search index
 * Should be called once at the app level (e.g., in App.tsx)
 *
 * Features:
 * - Full build on initial load and sync bankruptcy
 * - Incremental add/discard/replace for email changes
 * - Health registry integration
 * - Cleans up subscription on unmount
 */
export function useSearchIndex(): void {
  const initialized = useDatabaseStore((state) => state.initialized)
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null)
  const indexedRevsRef = useRef<Map<string, string>>(new Map())
  const initialBuildDoneRef = useRef(false)

  useEffect(() => {
    // Wait for database to be initialized
    if (!initialized) {
      return
    }

    const setupSubscription = async () => {
      try {
        const db = getDatabase()

        if (!db.emails) {
          logger.debug('search', 'Emails collection not available for search index')
          return
        }

        // Subscribe to all emails for search indexing
        const query = db.emails.find({
          sort: [{ timestamp: 'desc' }],
        })

        subscriptionRef.current = query.$.subscribe({
          next: (results) => {
            try {
              const currentRevs = new Map<string, string>()
              const emails: EmailDocument[] = []

              for (const doc of results) {
                const email = doc.toJSON() as EmailDocument
                emails.push(email)
                // Use RxDB revision to detect modifications
                currentRevs.set(email.id, doc.revision)
              }

              if (!initialBuildDoneRef.current) {
                // Full build on initial load
                logger.debug('search', `Building search index for ${emails.length} emails`)
                searchIndexService.buildIndex(emails)
                indexedRevsRef.current = currentRevs
                initialBuildDoneRef.current = true
                healthRegistry.setSearchIndexHealth('healthy')
                return
              }

              // Incremental updates
              const previousRevs = indexedRevsRef.current

              // Find new and updated emails
              for (const email of emails) {
                const prevRev = previousRevs.get(email.id)
                if (!prevRev) {
                  // New email — add to index
                  searchIndexService.addDocument(email)
                } else if (prevRev !== currentRevs.get(email.id)) {
                  // Modified email — replace in index
                  searchIndexService.updateDocument(email)
                }
              }

              // Find removed emails (discarded)
              for (const id of previousRevs.keys()) {
                if (!currentRevs.has(id)) {
                  searchIndexService.removeDocument(id)
                }
              }

              indexedRevsRef.current = currentRevs
              healthRegistry.setSearchIndexHealth('healthy')
            } catch (err) {
              logger.error('search', 'Search index update failed', { error: err })
              healthRegistry.setSearchIndexHealth(
                'degraded',
                err instanceof Error ? err.message : 'Index update failed'
              )
            }
          },
          error: (err) => {
            logger.error('search', 'Error subscribing to emails for search index', { error: err })
          },
        })

        logger.info('search', 'Search index subscription established')
      } catch (err) {
        logger.error('search', 'Failed to setup search index subscription', { error: err })
      }
    }

    setupSubscription()

    // Cleanup on unmount
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe()
        subscriptionRef.current = null
      }
      initialBuildDoneRef.current = false
      indexedRevsRef.current = new Map()
    }
  }, [initialized])
}
