import type { RxJsonSchema } from 'rxdb'

/**
 * Search Index Document for persisting Lunr.js index in RxDB
 *
 * Stores serialized Lunr index and metadata for:
 * - Faster startup (load existing index instead of rebuilding)
 * - Persistence across sessions
 * - Background rebuild scheduling
 *
 * Uses singleton pattern - only one index document with id='search-index'
 */
export interface SearchIndexDocument {
  /** Primary key - always 'search-index' for singleton */
  id: string
  /** Serialized Lunr index (JSON string) */
  serializedIndex: string
  /** Schema version for migration compatibility */
  version: number
  /** Timestamp when index was last built (Unix ms) */
  lastBuilt: number
  /** Number of documents in the index */
  documentCount: number
  /** Approximate size of index in bytes */
  indexSizeBytes: number
  /** Account IDs included in this index (for multi-account support) */
  accountIds: string[]
}

/**
 * RxDB schema for SearchIndex collection
 *
 * Notes:
 * - Single document collection (id='search-index')
 * - serializedIndex can be large (100MB+ for 100K emails)
 * - lastBuilt used to determine if rebuild is needed
 */
export const searchIndexSchema: RxJsonSchema<SearchIndexDocument> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 50,
    },
    serializedIndex: {
      type: 'string',
      // Large string for serialized index - no maxLength as it can be substantial
    },
    version: {
      type: 'number',
      minimum: 0,
      multipleOf: 1,
    },
    lastBuilt: {
      type: 'number',
      minimum: 0,
      maximum: 9999999999999, // Year 2286
      multipleOf: 1,
    },
    documentCount: {
      type: 'number',
      minimum: 0,
      multipleOf: 1,
    },
    indexSizeBytes: {
      type: 'number',
      minimum: 0,
      multipleOf: 1,
    },
    accountIds: {
      type: 'array',
      items: {
        type: 'string',
        maxLength: 100,
      },
      default: [],
    },
  },
  required: [
    'id',
    'serializedIndex',
    'version',
    'lastBuilt',
    'documentCount',
    'indexSizeBytes',
    'accountIds',
  ],
}

/**
 * Current schema version for search index
 * Increment when making breaking changes to schema
 */
export const SEARCH_INDEX_SCHEMA_VERSION = 1

/**
 * Default search index document ID (singleton)
 */
export const SEARCH_INDEX_DOCUMENT_ID = 'search-index'
