/**
 * Search Index Service
 *
 * Provides full-text search functionality using Lunr.js.
 * Implements singleton pattern for global index access.
 *
 * Performance Targets (per NFR001, FR008):
 * - Index build: <5s for 100K emails
 * - Search: <100ms for 100K emails
 *
 * Architecture Notes:
 * - Uses Lunr.js as specified in architecture.md cross-cutting concerns
 * - Index is rebuilt on significant changes (Lunr doesn't support incremental updates)
 * - Documents stored in Map for O(1) retrieval
 */

import lunr from 'lunr'
import { logger } from '@/services/logger'
import type { EmailDocument } from '@/services/database/schemas/email.schema'
import type {
  SearchResult,
  SearchableDocument,
  SearchIndexStats,
  SearchPerformanceMetrics,
} from './types'

/**
 * SearchIndexService - Singleton service for full-text email search
 *
 * Usage:
 * ```typescript
 * import { searchIndexService } from '@/services/search'
 *
 * // Build index from emails
 * await searchIndexService.buildIndex(emails)
 *
 * // Search
 * const results = searchIndexService.search('budget meeting')
 *
 * // Get original document
 * const email = searchIndexService.getDocument(results[0].id)
 * ```
 */
export class SearchIndexService {
  private static instance: SearchIndexService
  private index: lunr.Index | null = null
  private documents: Map<string, EmailDocument> = new Map()
  private lastBuilt: number | null = null
  private pendingDocuments: Map<string, EmailDocument> = new Map()
  private pendingRemovals: Set<string> = new Set()
  private rebuildScheduled: boolean = false
  private rebuildTimeout: ReturnType<typeof setTimeout> | null = null

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  static getInstance(): SearchIndexService {
    if (!SearchIndexService.instance) {
      SearchIndexService.instance = new SearchIndexService()
    }
    return SearchIndexService.instance
  }

  /**
   * Build search index from emails
   * Should complete in <5s for 100K emails
   *
   * @param emails - Array of email documents to index
   */
  buildIndex(emails: EmailDocument[]): void {
    const startTime = performance.now()

    // Store documents for retrieval
    this.documents.clear()
    this.pendingDocuments.clear()
    this.pendingRemovals.clear()
    emails.forEach((email) => this.documents.set(email.id, email))

    // Build Lunr index with configured field boosts
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const service = this

    this.index = lunr(function () {
      // Configure reference field
      this.ref('id')

      // Configure fields with boosts per story spec:
      // subject (boost 10), from.name/email (boost 5), to/cc names/emails (boost 2), body (boost 1)
      this.field('subject', { boost: 10 })
      this.field('fromName', { boost: 5 })
      this.field('fromEmail', { boost: 5 })
      this.field('toNames', { boost: 2 })
      this.field('toEmails', { boost: 2 })
      this.field('ccNames', { boost: 2 })
      this.field('ccEmails', { boost: 2 })
      this.field('bodyText', { boost: 1 })

      // Add all documents to index
      emails.forEach((email) => {
        const doc = service.emailToSearchable(email)
        this.add(doc)
      })
    })

    this.lastBuilt = Date.now()

    const duration = performance.now() - startTime
    logger.info('search', `Index built in ${duration.toFixed(0)}ms for ${emails.length} emails`, {
      documentCount: emails.length,
      buildTimeMs: duration,
    })
  }

  /**
   * Search the index
   * Target: <100ms for 100K emails
   *
   * Lunr.js query syntax:
   * - AND (default): "budget meeting" matches emails with both terms
   * - OR: "budget OR meeting" matches emails with either term
   * - Exact phrase: "\"budget meeting\"" matches exact phrase
   * - Field search: "subject:budget" searches only subject field
   * - Wildcard: "bud*" matches terms starting with "bud"
   *
   * @param query - Search query string
   * @returns Array of search results sorted by relevance
   */
  search(query: string): SearchResult[] {
    if (!this.index || !query.trim()) {
      return []
    }

    const startTime = performance.now()

    try {
      // Lunr.js handles the query parsing including:
      // - AND (space-separated terms)
      // - OR (explicit OR operator)
      // - Exact phrases (quoted strings)
      const results = this.index.search(query)

      const duration = performance.now() - startTime

      const metrics: SearchPerformanceMetrics = {
        query,
        searchTimeMs: duration,
        resultCount: results.length,
        timestamp: Date.now(),
      }

      logger.debug('search', `Search completed in ${duration.toFixed(0)}ms`, metrics)

      // Warn if search exceeds 100ms target
      if (duration > 100) {
        logger.warn('search', `Search exceeded 100ms target: ${duration.toFixed(0)}ms`, {
          query,
          resultCount: results.length,
        })
      }

      return results.map((result) => ({
        id: result.ref,
        score: result.score,
        matchData: result.matchData,
      }))
    } catch (error) {
      // Lunr throws on invalid query syntax
      logger.error('search', 'Search failed', { query, error })
      return []
    }
  }

  /**
   * Get original email document by ID
   * O(1) retrieval from Map
   * Pending documents take priority (for recent updates)
   *
   * @param id - Email ID
   * @returns Email document or undefined if not found
   */
  getDocument(id: string): EmailDocument | undefined {
    // Check pending first (for recent updates/adds)
    return this.pendingDocuments.get(id) || this.documents.get(id)
  }

  /**
   * Add single document for indexing
   * Note: Lunr.js doesn't support incremental updates natively.
   * Document is added to pending queue and index is marked for rebuild.
   *
   * @param email - Email document to add
   */
  addDocument(email: EmailDocument): void {
    this.pendingDocuments.set(email.id, email)
    this.pendingRemovals.delete(email.id)
    this.scheduleRebuild()
    logger.debug('search', 'Document queued for indexing', { id: email.id })
  }

  /**
   * Remove document from index
   * Note: Lunr.js doesn't support removal natively.
   * Document is marked for removal and index is marked for rebuild.
   *
   * @param emailId - Email ID to remove
   */
  removeDocument(emailId: string): void {
    this.pendingRemovals.add(emailId)
    this.pendingDocuments.delete(emailId)
    this.scheduleRebuild()
    logger.debug('search', 'Document queued for removal', { id: emailId })
  }

  /**
   * Update document in index
   * Equivalent to remove + add
   *
   * @param email - Updated email document
   */
  updateDocument(email: EmailDocument): void {
    this.addDocument(email)
  }

  /**
   * Apply pending changes by rebuilding the index
   * Called automatically after debounce period or can be called manually
   */
  applyPendingChanges(): void {
    if (this.pendingDocuments.size === 0 && this.pendingRemovals.size === 0) {
      return
    }

    // Merge pending documents
    this.pendingDocuments.forEach((email, id) => {
      this.documents.set(id, email)
    })

    // Apply removals
    this.pendingRemovals.forEach((id) => {
      this.documents.delete(id)
    })

    // Clear pending queues
    this.pendingDocuments.clear()
    this.pendingRemovals.clear()

    // Rebuild index with all documents
    const allEmails = Array.from(this.documents.values())
    this.buildIndex(allEmails)

    logger.info('search', 'Index rebuilt with pending changes')
  }

  /**
   * Check if index needs rebuild
   * @returns true if index is null or has pending changes
   */
  needsRebuild(): boolean {
    return this.index === null || this.pendingDocuments.size > 0 || this.pendingRemovals.size > 0
  }

  /**
   * Get index statistics
   */
  getStats(): SearchIndexStats {
    return {
      documentCount: this.documents.size,
      indexBuilt: this.index !== null,
      lastBuilt: this.lastBuilt,
      needsRebuild: this.needsRebuild(),
    }
  }

  /**
   * Clear the index and all documents
   * Useful for testing or when user logs out
   */
  clear(): void {
    this.index = null
    this.documents.clear()
    this.pendingDocuments.clear()
    this.pendingRemovals.clear()
    this.lastBuilt = null
    if (this.rebuildTimeout) {
      clearTimeout(this.rebuildTimeout)
      this.rebuildTimeout = null
    }
    this.rebuildScheduled = false
    logger.info('search', 'Search index cleared')
  }

  /**
   * Convert EmailDocument to SearchableDocument for indexing
   * Flattens nested structures for Lunr indexing
   */
  private emailToSearchable(email: EmailDocument): SearchableDocument {
    return {
      id: email.id,
      subject: email.subject || '',
      fromName: email.from?.name || '',
      fromEmail: email.from?.email || '',
      toNames:
        email.to
          ?.map((t) => t.name)
          .filter(Boolean)
          .join(' ') || '',
      toEmails:
        email.to
          ?.map((t) => t.email)
          .filter(Boolean)
          .join(' ') || '',
      ccNames:
        email.cc
          ?.map((c) => c.name)
          .filter(Boolean)
          .join(' ') || '',
      ccEmails:
        email.cc
          ?.map((c) => c.email)
          .filter(Boolean)
          .join(' ') || '',
      bodyText: email.body?.text || '',
    }
  }

  /**
   * Schedule index rebuild with debounce
   * Prevents excessive rebuilds during rapid document additions
   */
  private scheduleRebuild(): void {
    if (this.rebuildScheduled) {
      return
    }

    this.rebuildScheduled = true

    // Debounce rebuild by 1 second
    this.rebuildTimeout = setTimeout(() => {
      this.rebuildScheduled = false
      this.rebuildTimeout = null
      this.applyPendingChanges()
    }, 1000)
  }

  /**
   * Reset singleton instance (for testing only)
   * @internal
   */
  static __resetForTesting(): void {
    if (SearchIndexService.instance) {
      SearchIndexService.instance.clear()
    }
    SearchIndexService.instance = null as unknown as SearchIndexService
  }
}

/**
 * Singleton instance export
 */
export const searchIndexService = SearchIndexService.getInstance()
