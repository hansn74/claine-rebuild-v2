/**
 * Search Service Types
 *
 * Type definitions for the full-text search functionality.
 * Uses MiniSearch for client-side full-text search with BM25 scoring.
 */

import type { EmailDocument } from '@/services/database/schemas/email.schema'

/**
 * Search result from MiniSearch with relevance score
 */
export interface SearchResult {
  /** Document ID (email ID) */
  id: string
  /** Relevance score from MiniSearch BM25 (higher = more relevant) */
  score: number
  /** Match data: field name → matched terms in that field */
  match: Record<string, string[]>
  /** Terms that matched the query */
  terms: string[]
}

/**
 * Enriched search result with email data and highlights
 */
export interface EnrichedSearchResult {
  /** Full email document */
  email: EmailDocument
  /** Relevance score from MiniSearch */
  score: number
  /** Highlighted snippets for matched fields */
  highlights: SearchHighlights
}

/**
 * Highlighted text snippets for search results
 */
export interface SearchHighlights {
  /** Highlighted subject (contains <mark> tags) */
  subject?: string
  /** Highlighted body snippet with context */
  body?: string
  /** Highlighted sender name/email */
  from?: string
}

/**
 * Document format for indexing in MiniSearch
 * Flattened structure for efficient search
 */
export interface SearchableDocument {
  /** Email ID (used as document ID in MiniSearch) */
  id: string
  /** Email subject (boost: 10) */
  subject: string
  /** Sender display name (boost: 5) */
  fromName: string
  /** Sender email address (boost: 5) */
  fromEmail: string
  /** Recipient names concatenated (boost: 2) */
  toNames: string
  /** Recipient emails concatenated (boost: 2) */
  toEmails: string
  /** CC recipient names concatenated (boost: 2) */
  ccNames: string
  /** CC recipient emails concatenated (boost: 2) */
  ccEmails: string
  /** Plain text body content (boost: 1) */
  bodyText: string
}

/**
 * Search index metadata for persistence
 */
export interface SearchIndexMetadata {
  /** Unique identifier for the index */
  id: string
  /** Schema version for migration compatibility */
  version: number
  /** Timestamp when index was last built */
  lastBuilt: number
  /** Number of documents in the index */
  documentCount: number
  /** Total size of index in bytes (approximate) */
  indexSizeBytes: number
}

/**
 * Search index statistics
 */
export interface SearchIndexStats {
  /** Number of documents in index */
  documentCount: number
  /** Whether index has been built */
  indexBuilt: boolean
  /** Timestamp of last build */
  lastBuilt: number | null
}

/**
 * Search performance metrics
 */
export interface SearchPerformanceMetrics {
  /** Query string */
  query: string
  /** Time to execute search in milliseconds */
  searchTimeMs: number
  /** Number of results returned */
  resultCount: number
  /** Timestamp of search */
  timestamp: number
  /** Index signature for logger compatibility */
  [key: string]: unknown
}

/**
 * Configuration for search index rebuild
 */
export interface IndexRebuildConfig {
  /** Maximum age of index before forced rebuild (ms) - default 7 days */
  maxAge?: number
  /** Force rebuild regardless of age */
  force?: boolean
}

/**
 * Default index rebuild configuration
 */
export const DEFAULT_REBUILD_CONFIG: Required<IndexRebuildConfig> = {
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  force: false,
}
