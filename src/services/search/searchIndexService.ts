/**
 * Search Index Service
 *
 * Provides full-text search functionality using MiniSearch.
 * Implements singleton pattern for global index access.
 * Supports incremental index updates (add/discard/replace).
 *
 * Performance Targets (per NFR001, FR008):
 * - Index build: <5s for 100K emails
 * - Search: <100ms for 100K emails
 * - Incremental add: <1ms per document
 */

import MiniSearch from 'minisearch'
import { logger } from '@/services/logger'
import type { EmailDocument } from '@/services/database/schemas/email.schema'
import type {
  SearchResult,
  SearchableDocument,
  SearchIndexStats,
  SearchPerformanceMetrics,
} from './types'

const MINISEARCH_FIELDS = [
  'subject',
  'fromName',
  'fromEmail',
  'toNames',
  'toEmails',
  'ccNames',
  'ccEmails',
  'bodyText',
] as const

const MINISEARCH_OPTIONS = {
  fields: [...MINISEARCH_FIELDS],
  storeFields: ['id'],
  searchOptions: {
    boost: {
      subject: 10,
      fromName: 5,
      fromEmail: 5,
      toNames: 2,
      toEmails: 2,
      ccNames: 2,
      ccEmails: 2,
      bodyText: 1,
    },
    prefix: true,
    fuzzy: (term: string) => (term.length <= 4 ? 1 : 2),
    maxFuzzy: 2,
  },
}

/**
 * SearchIndexService - Singleton service for full-text email search
 *
 * Usage:
 * ```typescript
 * import { searchIndexService } from '@/services/search'
 *
 * // Build index from emails
 * searchIndexService.buildIndex(emails)
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
  private index: MiniSearch<SearchableDocument> | null = null
  private documents: Map<string, EmailDocument> = new Map()
  private lastBuilt: number | null = null

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
   * Get the MiniSearch options used for index construction.
   * Required for loadJSON deserialization.
   */
  static getMiniSearchOptions() {
    return MINISEARCH_OPTIONS
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
    emails.forEach((email) => this.documents.set(email.id, email))

    // Build MiniSearch index
    this.index = new MiniSearch<SearchableDocument>(MINISEARCH_OPTIONS)

    const docs = emails.map((email) => this.emailToSearchable(email))
    this.index.addAll(docs)

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
   * MiniSearch query features:
   * - Prefix search enabled by default
   * - Fuzzy matching with adaptive edit distance
   * - BM25 scoring for relevance ranking
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
        id: String(result.id),
        score: result.score,
        match: result.match,
        terms: result.terms,
      }))
    } catch (error) {
      logger.error('search', 'Search failed', { query, error })
      return []
    }
  }

  /**
   * Get original email document by ID
   * O(1) retrieval from Map
   *
   * @param id - Email ID
   * @returns Email document or undefined if not found
   */
  getDocument(id: string): EmailDocument | undefined {
    return this.documents.get(id)
  }

  /**
   * Add single document to index incrementally
   * MiniSearch supports native incremental add — no rebuild needed.
   *
   * @param email - Email document to add
   */
  addDocument(email: EmailDocument): void {
    if (!this.index) {
      logger.warn('search', 'Cannot add document - index not initialized', { id: email.id })
      return
    }

    this.documents.set(email.id, email)
    const doc = this.emailToSearchable(email)
    this.index.add(doc)
    logger.debug('search', 'Document added to index', { id: email.id })
  }

  /**
   * Remove document from index using discard (lazy vacuuming)
   * Faster than remove() — marks document as discarded without modifying index structure.
   *
   * @param emailId - Email ID to remove
   */
  removeDocument(emailId: string): void {
    if (!this.index) {
      logger.warn('search', 'Cannot remove document - index not initialized', { id: emailId })
      return
    }

    this.documents.delete(emailId)
    this.index.discard(emailId)
    logger.debug('search', 'Document discarded from index', { id: emailId })
  }

  /**
   * Update document in index using replace
   *
   * @param email - Updated email document
   */
  updateDocument(email: EmailDocument): void {
    if (!this.index) {
      logger.warn('search', 'Cannot update document - index not initialized', { id: email.id })
      return
    }

    this.documents.set(email.id, email)
    const doc = this.emailToSearchable(email)
    this.index.replace(doc)
    logger.debug('search', 'Document replaced in index', { id: email.id })
  }

  /**
   * Get all document IDs in the index
   * Used for operator-only queries where MiniSearch can't rank results.
   */
  getDocumentIds(): string[] {
    return Array.from(this.documents.keys())
  }

  /**
   * Get index statistics
   */
  getStats(): SearchIndexStats {
    return {
      documentCount: this.documents.size,
      indexBuilt: this.index !== null,
      lastBuilt: this.lastBuilt,
    }
  }

  /**
   * Get the underlying MiniSearch instance for serialization
   */
  getIndex(): MiniSearch<SearchableDocument> | null {
    return this.index
  }

  /**
   * Set the index from a deserialized MiniSearch instance
   * Used when loading a persisted index.
   *
   * @param index - Deserialized MiniSearch instance
   * @param documents - Map of email documents
   */
  setIndex(index: MiniSearch<SearchableDocument>, documents: Map<string, EmailDocument>): void {
    this.index = index
    this.documents = documents
    this.lastBuilt = Date.now()
    logger.info('search', 'Index restored from persistence', {
      documentCount: documents.size,
    })
  }

  /**
   * Clear the index and all documents
   * Useful for testing or when user logs out
   */
  clear(): void {
    this.index = null
    this.documents.clear()
    this.lastBuilt = null
    logger.info('search', 'Search index cleared')
  }

  /**
   * Convert EmailDocument to SearchableDocument for indexing
   * Flattens nested structures for MiniSearch indexing
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
