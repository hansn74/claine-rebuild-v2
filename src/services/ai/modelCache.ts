/**
 * Model Cache Service
 *
 * Story 3.1: Local LLM Integration
 * Task 4: Implement model caching (AC: 7)
 *
 * Provides Cache Storage API wrapper for model persistence across sessions.
 * Works alongside Transformers.js built-in IndexedDB caching.
 *
 * Design:
 * - Cache Storage API for model file persistence
 * - Transformers.js handles IndexedDB caching internally
 * - Version migration support for future model updates
 * - Storage quota handling with graceful degradation
 */

import { logger } from '@/services/logger'
import { MODEL_CACHE_NAME } from './types'

/**
 * Cache configuration constants
 */
export { MODEL_CACHE_NAME }
export const MODEL_CACHE_VERSION = 1
export const CACHE_METADATA_KEY = '__cache_metadata__'

/**
 * Cache metadata stored alongside model files
 */
export interface CacheMetadata {
  version: number
  modelId: string
  cachedAt: number
  sizeBytes: number
  provider: 'webgpu' | 'wasm'
}

/**
 * Cache status information
 */
export interface CacheStatus {
  available: boolean
  hasModel: boolean
  metadata: CacheMetadata | null
  estimatedSizeBytes: number
  storageQuota: {
    used: number
    available: number
    percentUsed: number
  } | null
}

/**
 * Model Cache Service
 *
 * Singleton service for managing model cache persistence.
 * Complements Transformers.js built-in caching with metadata tracking.
 */
export class ModelCacheService {
  private static instance: ModelCacheService
  private cache: Cache | null = null
  private cacheAvailable = false

  private constructor() {
    // Singleton - use getInstance()
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ModelCacheService {
    if (!ModelCacheService.instance) {
      ModelCacheService.instance = new ModelCacheService()
    }
    return ModelCacheService.instance
  }

  /**
   * Reset singleton for testing
   * @internal
   */
  static __resetForTesting(): void {
    ModelCacheService.instance = undefined as unknown as ModelCacheService
  }

  /**
   * Initialize cache connection
   * Call this before using other methods
   */
  async initialize(): Promise<boolean> {
    try {
      // Check Cache API availability
      if (typeof caches === 'undefined') {
        logger.warn('ai', 'Cache Storage API not available')
        this.cacheAvailable = false
        return false
      }

      // Open or create cache
      this.cache = await caches.open(MODEL_CACHE_NAME)
      this.cacheAvailable = true

      // Check for version migration
      await this.migrateIfNeeded()

      logger.info('ai', 'Model cache initialized', { cacheName: MODEL_CACHE_NAME })
      return true
    } catch (error) {
      logger.error('ai', 'Failed to initialize model cache', { error })
      this.cacheAvailable = false
      return false
    }
  }

  /**
   * Check if cache is available and initialized
   */
  isAvailable(): boolean {
    return this.cacheAvailable && this.cache !== null
  }

  /**
   * Get comprehensive cache status
   */
  async getStatus(): Promise<CacheStatus> {
    const status: CacheStatus = {
      available: this.cacheAvailable,
      hasModel: false,
      metadata: null,
      estimatedSizeBytes: 0,
      storageQuota: null,
    }

    if (!this.isAvailable()) {
      return status
    }

    try {
      // Get metadata
      status.metadata = await this.getMetadata()
      status.hasModel = status.metadata !== null

      // Estimate cache size
      if (this.cache) {
        const keys = await this.cache.keys()
        let totalSize = 0

        for (const request of keys) {
          const response = await this.cache.match(request)
          if (response) {
            const blob = await response.blob()
            totalSize += blob.size
          }
        }
        status.estimatedSizeBytes = totalSize
      }

      // Get storage quota info
      status.storageQuota = await this.getStorageQuota()
    } catch (error) {
      logger.warn('ai', 'Error getting cache status', { error })
    }

    return status
  }

  /**
   * Store cache metadata for a model
   */
  async setMetadata(metadata: Omit<CacheMetadata, 'version'>): Promise<void> {
    if (!this.isAvailable() || !this.cache) {
      throw new Error('Cache not available')
    }

    const fullMetadata: CacheMetadata = {
      ...metadata,
      version: MODEL_CACHE_VERSION,
    }

    const metadataResponse = new Response(JSON.stringify(fullMetadata), {
      headers: { 'Content-Type': 'application/json' },
    })

    await this.cache.put(CACHE_METADATA_KEY, metadataResponse)
    logger.debug('ai', 'Cache metadata stored', { metadata: fullMetadata })
  }

  /**
   * Get cache metadata
   */
  async getMetadata(): Promise<CacheMetadata | null> {
    if (!this.isAvailable() || !this.cache) {
      return null
    }

    try {
      const response = await this.cache.match(CACHE_METADATA_KEY)
      if (!response) {
        return null
      }

      const metadata = (await response.json()) as CacheMetadata
      return metadata
    } catch (error) {
      logger.warn('ai', 'Error reading cache metadata', { error })
      return null
    }
  }

  /**
   * Clear the model cache
   */
  async clear(): Promise<void> {
    if (!this.cacheAvailable) {
      return
    }

    try {
      await caches.delete(MODEL_CACHE_NAME)
      this.cache = null
      logger.info('ai', 'Model cache cleared')

      // Reinitialize empty cache
      await this.initialize()
    } catch (error) {
      logger.error('ai', 'Error clearing cache', { error })
      throw error
    }
  }

  /**
   * Get storage quota information
   */
  async getStorageQuota(): Promise<CacheStatus['storageQuota']> {
    try {
      if (!('storage' in navigator) || !navigator.storage.estimate) {
        return null
      }

      const estimate = await navigator.storage.estimate()
      const used = estimate.usage || 0
      const total = estimate.quota || 0
      const available = total - used

      return {
        used,
        available,
        percentUsed: total > 0 ? Math.round((used / total) * 100) : 0,
      }
    } catch (error) {
      logger.warn('ai', 'Error getting storage quota', { error })
      return null
    }
  }

  /**
   * Check if there's enough storage for a model
   * @param requiredBytes Minimum bytes needed
   * @returns true if enough space available
   */
  async hasStorageSpace(requiredBytes: number): Promise<boolean> {
    const quota = await this.getStorageQuota()
    if (!quota) {
      // Assume enough space if we can't check
      return true
    }

    // Require at least 10% buffer over needed space
    const requiredWithBuffer = requiredBytes * 1.1
    return quota.available >= requiredWithBuffer
  }

  /**
   * Handle storage quota exceeded error
   * Attempts to free space by clearing old caches
   */
  async handleQuotaExceeded(): Promise<boolean> {
    logger.warn('ai', 'Storage quota exceeded, attempting cleanup')

    try {
      // Get all cache names
      const cacheNames = await caches.keys()

      // Find and delete old model caches (not current version)
      const oldCaches = cacheNames.filter(
        (name) => name.startsWith('claine-models-') && name !== MODEL_CACHE_NAME
      )

      for (const oldCache of oldCaches) {
        await caches.delete(oldCache)
        logger.info('ai', 'Deleted old cache', { cacheName: oldCache })
      }

      return oldCaches.length > 0
    } catch (error) {
      logger.error('ai', 'Error during quota cleanup', { error })
      return false
    }
  }

  /**
   * Migrate cache if version changed
   */
  private async migrateIfNeeded(): Promise<void> {
    if (!this.cache) return

    const metadata = await this.getMetadata()
    if (!metadata) {
      // No existing metadata, nothing to migrate
      return
    }

    if (metadata.version < MODEL_CACHE_VERSION) {
      logger.info('ai', 'Migrating cache from version', {
        from: metadata.version,
        to: MODEL_CACHE_VERSION,
      })

      // Delete old cache and reopen fresh
      // Note: Don't call clear() here as it calls initialize() which would recurse
      await caches.delete(MODEL_CACHE_NAME)
      this.cache = await caches.open(MODEL_CACHE_NAME)
    }
  }

  /**
   * Store a model file in cache
   * Note: Transformers.js handles most caching automatically,
   * this is for additional persistence or custom caching needs
   */
  async cacheFile(url: string, response: Response): Promise<void> {
    if (!this.isAvailable() || !this.cache) {
      throw new Error('Cache not available')
    }

    try {
      // Check storage space (estimate ~1.5GB for model)
      const hasSpace = await this.hasStorageSpace(1.5 * 1024 * 1024 * 1024)
      if (!hasSpace) {
        const freed = await this.handleQuotaExceeded()
        if (!freed) {
          throw new Error('Insufficient storage space for model cache')
        }
      }

      await this.cache.put(url, response.clone())
      logger.debug('ai', 'File cached', { url })
    } catch (error) {
      // DOMException may not extend Error in all environments
      const name = (error as { name?: string })?.name
      const message = (error as { message?: string })?.message ?? ''
      if (name === 'QuotaExceededError' || message.toLowerCase().includes('quota')) {
        logger.warn('ai', 'Quota exceeded while caching', { url })
        throw new Error('Storage quota exceeded')
      }
      throw error
    }
  }

  /**
   * Retrieve a cached file
   */
  async getCachedFile(url: string): Promise<Response | null> {
    if (!this.isAvailable() || !this.cache) {
      return null
    }

    const response = await this.cache.match(url)
    return response || null
  }

  /**
   * Check if a file is cached
   */
  async isCached(url: string): Promise<boolean> {
    if (!this.isAvailable() || !this.cache) {
      return false
    }

    const response = await this.cache.match(url)
    return response !== undefined
  }
}

// Export singleton instance
export const modelCacheService = ModelCacheService.getInstance()
