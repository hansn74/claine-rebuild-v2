/**
 * useSearchIndex Hook
 *
 * Story 2.5: Local Full-Text Search
 * Builds and maintains the search index when emails change.
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
 * - Builds index when emails collection changes
 * - Debounces rebuilds to prevent excessive processing
 * - Cleans up subscription on unmount
 */
export function useSearchIndex(): void {
  const initialized = useDatabaseStore((state) => state.initialized)
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null)
  const rebuildTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
            // Debounce rebuilds
            if (rebuildTimeoutRef.current) {
              clearTimeout(rebuildTimeoutRef.current)
            }

            rebuildTimeoutRef.current = setTimeout(() => {
              try {
                const emails = results.map((doc) => doc.toJSON() as EmailDocument)
                logger.debug('search', `Building search index for ${emails.length} emails`)
                searchIndexService.buildIndex(emails)
                healthRegistry.setSearchIndexHealth('healthy')
              } catch (err) {
                logger.error('search', 'Search index build failed', { error: err })
                healthRegistry.setSearchIndexHealth(
                  'degraded',
                  err instanceof Error ? err.message : 'Index build failed'
                )
              }
            }, 500) // 500ms debounce
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
      if (rebuildTimeoutRef.current) {
        clearTimeout(rebuildTimeoutRef.current)
        rebuildTimeoutRef.current = null
      }
    }
  }, [initialized])
}
