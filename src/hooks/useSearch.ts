/**
 * useSearch Hook
 *
 * Story 2.5: Local Full-Text Search
 * Task 5: Create Search Hook
 *
 * React hook for performing full-text search with debounced input.
 * Returns enriched results with relevance scores and highlighted snippets.
 *
 * Performance Targets:
 * - Search completes in <100ms (FR008)
 * - Debounced input (300ms delay)
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { searchIndexService } from '@/services/search'
import type { EnrichedSearchResult, SearchHighlights } from '@/services/search'
import type { EmailDocument } from '@/services/database/schemas/email.schema'
import {
  parseSearchTerms,
  highlightMatches,
  generateSnippet,
  containsSearchTerms,
} from '@/utils/searchHighlight'
import { logger } from '@/services/logger'

/**
 * Return type for useSearch hook
 */
export interface UseSearchResult {
  /** Current search query */
  query: string
  /** Update search query (triggers debounced search) */
  setQuery: (query: string) => void
  /** Search results with email data and highlights */
  results: EnrichedSearchResult[]
  /** Whether search is in progress */
  isSearching: boolean
  /** Last search execution time in milliseconds */
  searchTime: number | null
  /** Error message if search failed */
  error: string | null
  /** Clear search results and query */
  clear: () => void
}

/**
 * Configuration options for useSearch
 */
export interface UseSearchOptions {
  /** Debounce delay in ms (default: 300) */
  debounceMs?: number
  /** Maximum results to return (default: 50) */
  maxResults?: number
  /** Enable performance logging (default: true in dev) */
  logPerformance?: boolean
}

const DEFAULT_OPTIONS: Required<UseSearchOptions> = {
  debounceMs: 300,
  maxResults: 50,
  logPerformance: import.meta.env.DEV,
}

/**
 * Generate highlight snippets for an email based on search terms
 */
function generateHighlights(email: EmailDocument, terms: string[]): SearchHighlights {
  const highlights: SearchHighlights = {}

  // Highlight subject
  if (email.subject && containsSearchTerms(email.subject, terms)) {
    highlights.subject = highlightMatches(email.subject, terms)
  }

  // Generate body snippet with highlights
  const bodyText = email.body?.text || email.snippet || ''
  if (bodyText && containsSearchTerms(bodyText, terms)) {
    highlights.body = generateSnippet(bodyText, terms, 50)
  } else if (bodyText) {
    // Show start of body even without match
    highlights.body = bodyText.length > 100 ? bodyText.slice(0, 100) + '...' : bodyText
  }

  // Highlight sender
  const fromStr = email.from?.name
    ? `${email.from.name} <${email.from.email}>`
    : email.from?.email || ''
  if (fromStr && containsSearchTerms(fromStr, terms)) {
    highlights.from = highlightMatches(fromStr, terms)
  }

  return highlights
}

/**
 * useSearch - Full-text search hook with debouncing
 *
 * @param options - Configuration options
 * @returns Search state and controls
 *
 * @example
 * ```tsx
 * function SearchComponent() {
 *   const { query, setQuery, results, isSearching, searchTime } = useSearch()
 *
 *   return (
 *     <div>
 *       <input
 *         value={query}
 *         onChange={(e) => setQuery(e.target.value)}
 *         placeholder="Search emails..."
 *       />
 *       {isSearching && <span>Searching...</span>}
 *       {searchTime && <span>{searchTime}ms</span>}
 *       {results.map((result) => (
 *         <SearchResultItem key={result.email.id} result={result} />
 *       ))}
 *     </div>
 *   )
 * }
 * ```
 */
export function useSearch(options: UseSearchOptions = {}): UseSearchResult {
  const { debounceMs, maxResults, logPerformance } = {
    ...DEFAULT_OPTIONS,
    ...options,
  }

  const [query, setQueryInternal] = useState('')
  const [results, setResults] = useState<EnrichedSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchTime, setSearchTime] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Ref to track debounce timeout
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Ref to track latest query for stale result prevention
  const latestQueryRef = useRef('')

  /**
   * Perform the actual search
   */
  const performSearch = useCallback(
    (searchQuery: string) => {
      // Skip empty queries
      if (!searchQuery.trim()) {
        setResults([])
        setIsSearching(false)
        setSearchTime(null)
        setError(null)
        return
      }

      setIsSearching(true)
      setError(null)

      const startTime = performance.now()

      try {
        // Execute search
        const searchResults = searchIndexService.search(searchQuery)
        const duration = performance.now() - startTime

        // Check if this is still the latest query (prevent stale results)
        if (searchQuery !== latestQueryRef.current) {
          return
        }

        // Parse search terms for highlighting
        const terms = parseSearchTerms(searchQuery)

        // Enrich results with email data and highlights
        const enrichedResults: EnrichedSearchResult[] = searchResults
          .slice(0, maxResults)
          .map((result) => {
            const email = searchIndexService.getDocument(result.id)
            if (!email) return null
            return {
              email,
              score: result.score,
              highlights: generateHighlights(email, terms),
            }
          })
          .filter((r): r is EnrichedSearchResult => r !== null)

        setResults(enrichedResults)
        setSearchTime(duration)

        // Log performance
        if (logPerformance) {
          logger.debug('search', `useSearch completed in ${duration.toFixed(0)}ms`, {
            query: searchQuery,
            resultCount: enrichedResults.length,
            duration,
          })

          // Warn if exceeding 100ms target
          if (duration > 100) {
            logger.warn('search', `Search exceeded 100ms target: ${duration.toFixed(0)}ms`, {
              query: searchQuery,
            })
          }
        }
      } catch (err) {
        // Check if this is still the latest query
        if (searchQuery !== latestQueryRef.current) {
          return
        }

        const errorMessage = err instanceof Error ? err.message : 'Search failed'
        setError(errorMessage)
        setResults([])
        logger.error('search', 'useSearch failed', { query: searchQuery, error: err })
      } finally {
        // Only update loading state if this is the latest query
        if (searchQuery === latestQueryRef.current) {
          setIsSearching(false)
        }
      }
    },
    [maxResults, logPerformance]
  )

  /**
   * Set query with debouncing
   */
  const setQuery = useCallback(
    (newQuery: string) => {
      setQueryInternal(newQuery)
      latestQueryRef.current = newQuery

      // Clear existing debounce
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }

      // Handle empty query immediately
      if (!newQuery.trim()) {
        setResults([])
        setIsSearching(false)
        setSearchTime(null)
        setError(null)
        return
      }

      // Set searching state immediately for UI feedback
      setIsSearching(true)

      // Debounce the actual search
      debounceRef.current = setTimeout(() => {
        performSearch(newQuery)
      }, debounceMs)
    },
    [debounceMs, performSearch]
  )

  /**
   * Clear search state
   */
  const clear = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    setQueryInternal('')
    latestQueryRef.current = ''
    setResults([])
    setIsSearching(false)
    setSearchTime(null)
    setError(null)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  return {
    query,
    setQuery,
    results,
    isSearching,
    searchTime,
    error,
    clear,
  }
}
