/**
 * Search Service Module
 *
 * Provides full-text search functionality using MiniSearch.
 *
 * Usage:
 *   import { searchIndexService } from '@/services/search'
 *
 *   // Build index from emails
 *   searchIndexService.buildIndex(emails)
 *
 *   // Search
 *   const results = searchIndexService.search('budget meeting')
 *
 *   // Get original document
 *   const email = searchIndexService.getDocument(results[0].id)
 */

// Main search index service
export { searchIndexService, SearchIndexService } from './searchIndexService'

// Index persistence
export { indexStorageService } from './indexStorage'

// Search history
export { searchHistoryService } from './searchHistoryService'

// Type definitions
export type {
  SearchResult,
  EnrichedSearchResult,
  SearchHighlights,
  SearchableDocument,
  SearchIndexMetadata,
  SearchIndexStats,
  SearchPerformanceMetrics,
  IndexRebuildConfig,
} from './types'

export { DEFAULT_REBUILD_CONFIG } from './types'

// Search operator parser (Story 2.22)
export {
  parseSearchOperators,
  matchesOperatorFilters,
  getOperatorSearchHints,
  KNOWN_OPERATORS,
} from './searchOperatorParser'

export type { SearchOperator, ParsedOperatorQuery, OperatorType } from './searchOperatorParser'
