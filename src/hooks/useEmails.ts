/**
 * React hook for reactive email queries from RxDB
 * Provides real-time updates when emails change in the database
 *
 * Story 2.15: Added attribute filtering support
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import type { RxDocument } from 'rxdb'
import { getDatabase } from '@/services/database/init'
import type { EmailDocument } from '@/services/database/schemas/email.schema'
import type { FilterValue } from '@/store/attributeFilterStore'

export interface UseEmailsOptions {
  accountId?: string // Filter by account (optional)
  folder?: string // Filter by folder (optional)
  limit?: number // Max emails to return per page
  sortOrder?: 'asc' | 'desc' // Sort by timestamp
  attributeFilters?: Map<string, FilterValue[]> // Filter by attribute values (AC 3: AND logic)
  enablePagination?: boolean // Enable infinite scroll pagination (Story 2.16)
}

export interface UseEmailsResult {
  emails: EmailDocument[]
  loading: boolean
  error: Error | null
  count: number
  /** Load more emails (for infinite scroll) */
  loadMore: () => void
  /** Whether there are more emails to load */
  hasMore: boolean
  /** Whether more emails are currently being loaded */
  loadingMore: boolean
}

/**
 * Build attribute filter selector for RxDB query
 * Implements AND logic across all attributes (AC 3)
 *
 * Each attribute filter is OR within values (e.g., Status = "To-Do" OR "In-Progress")
 * Multiple attributes are AND together (e.g., Status=To-Do AND Priority=High)
 */
function buildAttributeSelector(
  attributeFilters: Map<string, FilterValue[]>
): Record<string, unknown> | null {
  if (!attributeFilters || attributeFilters.size === 0) {
    return null
  }

  const conditions: Record<string, unknown>[] = []

  for (const [attributeId, values] of attributeFilters.entries()) {
    if (values.length === 0) continue

    // Handle different filter value formats
    const firstValue = values[0]

    // Date range filter (format: "from:to")
    if (typeof firstValue === 'string' && firstValue.includes(':') && !firstValue.includes('T')) {
      const [from, to] = firstValue.split(':')
      const dateConditions: Record<string, unknown> = {}

      if (from) {
        dateConditions.$gte = from
      }
      if (to) {
        dateConditions.$lte = to
      }

      if (Object.keys(dateConditions).length > 0) {
        conditions.push({ [`attributes.${attributeId}`]: dateConditions })
      }
      continue
    }

    // Number range filter (format: "min:max" where min/max are numbers)
    if (typeof firstValue === 'string' && /^-?\d*\.?\d*:-?\d*\.?\d*$/.test(firstValue)) {
      const [minStr, maxStr] = firstValue.split(':')
      const rangeConditions: Record<string, unknown> = {}

      if (minStr) {
        rangeConditions.$gte = parseFloat(minStr)
      }
      if (maxStr) {
        rangeConditions.$lte = parseFloat(maxStr)
      }

      if (Object.keys(rangeConditions).length > 0) {
        conditions.push({ [`attributes.${attributeId}`]: rangeConditions })
      }
      continue
    }

    // Text contains filter
    if (typeof firstValue === 'string' && values.length === 1) {
      // Use $regex for text contains matching
      conditions.push({
        [`attributes.${attributeId}`]: { $regex: escapeRegex(firstValue), $options: 'i' },
      })
      continue
    }

    // Enum, boolean, or multiple values - use $in for OR within attribute
    if (values.length === 1) {
      conditions.push({ [`attributes.${attributeId}`]: values[0] })
    } else {
      conditions.push({ [`attributes.${attributeId}`]: { $in: values } })
    }
  }

  // Combine all conditions with AND logic
  if (conditions.length === 0) {
    return null
  }

  if (conditions.length === 1) {
    return conditions[0]
  }

  return { $and: conditions }
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Page size for progressive loading (Story 2.16)
 */
const PAGE_SIZE = 50

/**
 * Hook to get reactive email list from RxDB
 * Updates automatically when emails are added/modified/deleted
 *
 * Story 2.15: Extended with attribute filtering support
 * Story 2.16: Added progressive loading / infinite scroll support
 */
export function useEmails(options: UseEmailsOptions = {}): UseEmailsResult {
  const {
    accountId,
    folder,
    limit = PAGE_SIZE,
    sortOrder = 'desc',
    attributeFilters,
    enablePagination = true, // Enable by default for better performance
  } = options

  const [emails, setEmails] = useState<EmailDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [hasMore, setHasMore] = useState(true)
  // Track the number of pages loaded for progressive loading
  const [pagesLoaded, setPagesLoaded] = useState(1)

  // Serialize attributeFilters for dependency comparison
  const attributeFiltersKey = useMemo(() => {
    if (!attributeFilters || attributeFilters.size === 0) return ''
    return JSON.stringify(Array.from(attributeFilters.entries()))
  }, [attributeFilters])

  // Calculate current limit based on pages loaded
  const currentLimit = useMemo(() => limit * pagesLoaded, [limit, pagesLoaded])

  // Load more function for infinite scroll
  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore) return

    setLoadingMore(true)
    setPagesLoaded((prev) => prev + 1)
  }, [hasMore, loadingMore])

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null

    const setupSubscription = async () => {
      try {
        // Only show loading spinner on initial load, not when loading more
        if (emails.length === 0) {
          setLoading(true)
        }
        const db = getDatabase()

        // Check if emails collection exists
        if (!db.emails) {
          setEmails([])
          setLoading(false)
          setLoadingMore(false)
          return
        }

        // Build base query selector
        const selector: Record<string, unknown> = {}
        if (accountId) {
          selector.accountId = accountId
        }
        if (folder) {
          selector.folder = folder
        }

        // Add attribute filter conditions (Story 2.15)
        const attributeSelector = buildAttributeSelector(attributeFilters ?? new Map())
        let finalSelector = selector

        if (attributeSelector) {
          // Merge base selector with attribute conditions
          if (Object.keys(selector).length > 0) {
            finalSelector = {
              $and: [selector, attributeSelector],
            }
          } else {
            finalSelector = attributeSelector
          }
        }

        // Create reactive query with current limit
        // Story 2.16: Use currentLimit for progressive loading
        const query = db.emails.find({
          selector: finalSelector,
          sort: [{ timestamp: sortOrder }],
          limit: enablePagination ? currentLimit : limit,
        })

        // Subscribe to changes
        subscription = query.$.subscribe({
          next: (results: RxDocument<EmailDocument>[]) => {
            const emailDocs = results.map((doc) => doc.toJSON() as EmailDocument)
            setEmails(emailDocs)

            // Determine if there are more emails to load
            // If we got fewer results than the limit, there are no more
            setHasMore(emailDocs.length === currentLimit)

            setLoading(false)
            setLoadingMore(false)
          },
          error: (err: Error) => {
            setError(err)
            setLoading(false)
            setLoadingMore(false)
          },
        })
      } catch (err) {
        setError(err as Error)
        setLoading(false)
        setLoadingMore(false)
      }
    }

    setupSubscription()

    // Cleanup subscription on unmount
    return () => {
      if (subscription) {
        subscription.unsubscribe()
      }
    }
  }, [
    accountId,
    folder,
    currentLimit,
    sortOrder,
    attributeFiltersKey,
    attributeFilters,
    enablePagination,
    limit,
    emails.length,
  ])

  return {
    emails,
    loading,
    error,
    count: emails.length,
    loadMore,
    hasMore,
    loadingMore,
  }
}

/**
 * Hook to get a single email by ID
 */
export function useEmail(emailId: string | null): {
  email: EmailDocument | null
  loading: boolean
  error: Error | null
} {
  const [email, setEmail] = useState<EmailDocument | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null

    const setupSubscription = async () => {
      if (!emailId) {
        setEmail(null)
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        const db = getDatabase()

        if (!db.emails) {
          setEmail(null)
          setLoading(false)
          return
        }

        // Create reactive query for single document
        const query = db.emails.findOne(emailId)

        subscription = query.$.subscribe({
          next: (doc: RxDocument<EmailDocument> | null) => {
            setEmail(doc ? (doc.toJSON() as EmailDocument) : null)
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

    return () => {
      if (subscription) {
        subscription.unsubscribe()
      }
    }
  }, [emailId])

  return { email, loading, error }
}
