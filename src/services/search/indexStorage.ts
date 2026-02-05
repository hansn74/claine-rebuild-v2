/**
 * Index Storage Service
 *
 * Handles persistence of MiniSearch index to RxDB.
 * Enables faster startup by loading existing index instead of rebuilding.
 *
 * Features:
 * - Save/load serialized MiniSearch index to IndexedDB via RxDB
 * - Index metadata tracking (version, lastBuilt, documentCount)
 * - Rebuild decision logic based on age
 */

import MiniSearch from 'minisearch'
import { logger } from '@/services/logger'
import { getDatabase, isDatabaseInitialized } from '@/services/database/init'
import {
  searchIndexSchema,
  SEARCH_INDEX_DOCUMENT_ID,
  SEARCH_INDEX_SCHEMA_VERSION,
} from '@/services/database/schemas/searchIndex.schema'
import type { SearchIndexDocument } from '@/services/database/schemas/searchIndex.schema'
import type { SearchableDocument } from './types'
import type { IndexRebuildConfig } from './types'
import { DEFAULT_REBUILD_CONFIG } from './types'
import { SearchIndexService } from './searchIndexService'

/**
 * IndexStorageService - Handles persistence of search index
 *
 * Usage:
 * ```typescript
 * import { indexStorageService } from '@/services/search/indexStorage'
 *
 * // Save index
 * await indexStorageService.saveIndex(documentCount, accountIds)
 *
 * // Load index
 * const { index, metadata } = await indexStorageService.loadIndex()
 *
 * // Check if rebuild is needed
 * const shouldRebuild = await indexStorageService.shouldRebuild()
 * ```
 */
class IndexStorageService {
  private collectionInitialized = false

  /**
   * Ensure searchIndex collection exists in database
   */
  private async ensureCollection(): Promise<void> {
    if (this.collectionInitialized) {
      return
    }

    if (!isDatabaseInitialized()) {
      throw new Error('Database not initialized. Cannot access search index storage.')
    }

    const db = getDatabase()

    // Add searchIndex collection if it doesn't exist
    if (!db.searchIndex) {
      await db.addCollections({
        searchIndex: {
          schema: searchIndexSchema,
        },
      })
      logger.debug('search', 'SearchIndex collection created')
    }

    this.collectionInitialized = true
  }

  /**
   * Save MiniSearch index to RxDB
   *
   * @param documentCount - Number of documents in the index
   * @param accountIds - Account IDs included in the index
   */
  async saveIndex(documentCount: number, accountIds: string[] = []): Promise<void> {
    const startTime = performance.now()

    try {
      await this.ensureCollection()
      const db = getDatabase()

      const index = SearchIndexService.getInstance().getIndex()
      if (!index) {
        logger.warn('search', 'Cannot save index - no index to serialize')
        return
      }

      // MiniSearch is JSON-serializable
      const serializedIndex = JSON.stringify(index)
      const indexSizeBytes = new Blob([serializedIndex]).size

      const doc: SearchIndexDocument = {
        id: SEARCH_INDEX_DOCUMENT_ID,
        serializedIndex,
        version: SEARCH_INDEX_SCHEMA_VERSION,
        lastBuilt: Date.now(),
        documentCount,
        indexSizeBytes,
        accountIds,
      }

      // Upsert the index document
      await db.searchIndex!.upsert(doc)

      const duration = performance.now() - startTime
      logger.info('search', `Search index saved in ${duration.toFixed(0)}ms`, {
        documentCount,
        indexSizeBytes,
        accountIds,
      })
    } catch (error) {
      logger.error('search', 'Failed to save search index', { error })
      throw error
    }
  }

  /**
   * Load MiniSearch index from RxDB
   *
   * @returns Deserialized MiniSearch index and metadata, or null if not found
   */
  async loadIndex(): Promise<{
    index: MiniSearch<SearchableDocument>
    metadata: Omit<SearchIndexDocument, 'serializedIndex' | 'id'>
  } | null> {
    const startTime = performance.now()

    try {
      await this.ensureCollection()
      const db = getDatabase()

      const doc = await db.searchIndex!.findOne(SEARCH_INDEX_DOCUMENT_ID).exec()

      if (!doc) {
        logger.debug('search', 'No persisted search index found')
        return null
      }

      const indexDoc = doc.toJSON() as SearchIndexDocument

      // Check schema version compatibility
      if (indexDoc.version !== SEARCH_INDEX_SCHEMA_VERSION) {
        logger.warn('search', 'Search index schema version mismatch, rebuild required', {
          storedVersion: indexDoc.version,
          currentVersion: SEARCH_INDEX_SCHEMA_VERSION,
        })
        return null
      }

      // Deserialize MiniSearch index — must pass same options used during construction
      const index = MiniSearch.loadJSON<SearchableDocument>(
        indexDoc.serializedIndex,
        SearchIndexService.getMiniSearchOptions()
      )

      const duration = performance.now() - startTime
      logger.info('search', `Search index loaded in ${duration.toFixed(0)}ms`, {
        documentCount: indexDoc.documentCount,
        lastBuilt: new Date(indexDoc.lastBuilt).toISOString(),
      })

      return {
        index,
        metadata: {
          version: indexDoc.version,
          lastBuilt: indexDoc.lastBuilt,
          documentCount: indexDoc.documentCount,
          indexSizeBytes: indexDoc.indexSizeBytes,
          accountIds: indexDoc.accountIds,
        },
      }
    } catch (error) {
      logger.error('search', 'Failed to load search index', { error })
      return null
    }
  }

  /**
   * Check if index should be rebuilt
   *
   * With MiniSearch incremental updates, the only rebuild trigger is age (7 days safety net).
   *
   * @param config - Rebuild configuration (optional)
   * @returns true if rebuild is recommended
   */
  async shouldRebuild(config: IndexRebuildConfig = {}): Promise<boolean> {
    const { maxAge, force } = { ...DEFAULT_REBUILD_CONFIG, ...config }

    // Force rebuild if requested
    if (force) {
      return true
    }

    try {
      await this.ensureCollection()
      const db = getDatabase()

      const doc = await db.searchIndex!.findOne(SEARCH_INDEX_DOCUMENT_ID).exec()

      // No index exists - rebuild needed
      if (!doc) {
        logger.debug('search', 'No persisted index found, rebuild needed')
        return true
      }

      const indexDoc = doc.toJSON() as SearchIndexDocument

      // Check schema version
      if (indexDoc.version !== SEARCH_INDEX_SCHEMA_VERSION) {
        logger.debug('search', 'Schema version mismatch, rebuild needed')
        return true
      }

      // Check age
      const age = Date.now() - indexDoc.lastBuilt
      if (age > maxAge) {
        logger.debug('search', 'Index too old, rebuild needed', {
          ageMs: age,
          maxAgeMs: maxAge,
        })
        return true
      }

      return false
    } catch (error) {
      logger.warn('search', 'Error checking rebuild status, defaulting to rebuild', { error })
      return true
    }
  }

  /**
   * Get index metadata without loading the full index
   */
  async getMetadata(): Promise<Omit<SearchIndexDocument, 'serializedIndex'> | null> {
    try {
      await this.ensureCollection()
      const db = getDatabase()

      const doc = await db.searchIndex!.findOne(SEARCH_INDEX_DOCUMENT_ID).exec()

      if (!doc) {
        return null
      }

      const indexDoc = doc.toJSON() as SearchIndexDocument
      // Return metadata without the large serializedIndex
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { serializedIndex: _unused, ...metadata } = indexDoc
      return metadata
    } catch (error) {
      logger.error('search', 'Failed to get index metadata', { error })
      return null
    }
  }

  /**
   * Delete persisted index
   */
  async deleteIndex(): Promise<void> {
    try {
      await this.ensureCollection()
      const db = getDatabase()

      const doc = await db.searchIndex!.findOne(SEARCH_INDEX_DOCUMENT_ID).exec()
      if (doc) {
        await doc.remove()
        logger.info('search', 'Search index deleted from storage')
      }
    } catch (error) {
      logger.error('search', 'Failed to delete search index', { error })
    }
  }

  /**
   * Reset collection initialized state (for testing)
   * @internal
   */
  __resetForTesting(): void {
    this.collectionInitialized = false
  }
}

/**
 * Singleton instance
 */
export const indexStorageService = new IndexStorageService()
