/**
 * Query Result Cache for RxDB
 *
 * Story 2.10: Performance Optimization & Benchmarking
 * Task 4.4: Implement query result caching with TTL
 *
 * Provides in-memory caching for database query results to reduce
 * repeated expensive queries. Cache is invalidated on database mutations.
 *
 * @example
 * ```typescript
 * import { queryCache } from '@/services/database/queryCache'
 *
 * // Cache a query result
 * const emails = await queryCache.get(
 *   'emails-inbox',
 *   () => db.emails.find({ selector: { folder: 'inbox' } }).exec(),
 *   { ttl: 5000 } // 5 second TTL
 * )
 *
 * // Invalidate on mutation
 * queryCache.invalidate('emails-inbox')
 * // Or invalidate all email caches
 * queryCache.invalidatePattern('emails-')
 * ```
 */

/**
 * Cache entry with metadata
 */
interface CacheEntry<T> {
  /** Cached value */
  value: T
  /** When the entry was cached */
  cachedAt: number
  /** Time-to-live in milliseconds */
  ttl: number
  /** Number of times this entry was accessed */
  hits: number
}

/**
 * Cache options
 */
export interface CacheOptions {
  /** Time-to-live in milliseconds (default: 30000 = 30s) */
  ttl?: number
  /** Force refresh even if cached */
  forceRefresh?: boolean
}

/**
 * Default TTL in milliseconds
 */
const DEFAULT_TTL = 30000

/**
 * Maximum number of cache entries to prevent memory bloat
 */
const MAX_CACHE_ENTRIES = 100

/**
 * Query Cache Service
 *
 * Singleton service for caching database query results.
 * Uses LRU (Least Recently Used) eviction when cache is full.
 */
export class QueryCache {
  private static instance: QueryCache

  /** Cache storage */
  private cache = new Map<string, CacheEntry<unknown>>()

  /** Pending fetches to prevent duplicate requests */
  private pendingFetches = new Map<string, Promise<unknown>>()

  /** Statistics for monitoring */
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
  }

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): QueryCache {
    if (!QueryCache.instance) {
      QueryCache.instance = new QueryCache()
    }
    return QueryCache.instance
  }

  /**
   * Get a cached value or fetch it
   *
   * @param key - Unique cache key
   * @param fetcher - Function to fetch the value if not cached
   * @param options - Cache options
   * @returns Cached or freshly fetched value
   */
  async get<T>(key: string, fetcher: () => Promise<T>, options?: CacheOptions): Promise<T> {
    const ttl = options?.ttl ?? DEFAULT_TTL
    const forceRefresh = options?.forceRefresh ?? false

    // Check cache unless force refresh
    if (!forceRefresh) {
      const entry = this.cache.get(key) as CacheEntry<T> | undefined
      if (entry && this.isValid(entry)) {
        entry.hits++
        this.stats.hits++
        return entry.value
      }
    }

    // Check for pending fetch
    const pending = this.pendingFetches.get(key)
    if (pending) {
      return pending as Promise<T>
    }

    // Fetch and cache
    this.stats.misses++
    const fetchPromise = fetcher()
      .then((value) => {
        // Evict if cache is full
        if (this.cache.size >= MAX_CACHE_ENTRIES) {
          this.evictLRU()
        }

        // Store in cache
        this.cache.set(key, {
          value,
          cachedAt: Date.now(),
          ttl,
          hits: 0,
        })

        // Remove from pending
        this.pendingFetches.delete(key)

        return value
      })
      .catch((error) => {
        this.pendingFetches.delete(key)
        throw error
      })

    this.pendingFetches.set(key, fetchPromise)
    return fetchPromise
  }

  /**
   * Check if a cache entry is still valid
   */
  private isValid<T>(entry: CacheEntry<T>): boolean {
    const age = Date.now() - entry.cachedAt
    return age < entry.ttl
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let oldestKey: string | null = null
    let oldestTime = Infinity
    let lowestHits = Infinity

    for (const [key, entry] of this.cache.entries()) {
      // Prefer evicting entries with fewer hits and older cache time
      const score = entry.cachedAt + entry.hits * 10000
      if (score < oldestTime || entry.hits < lowestHits) {
        oldestKey = key
        oldestTime = entry.cachedAt
        lowestHits = entry.hits
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey)
      this.stats.evictions++
    }
  }

  /**
   * Invalidate a specific cache entry
   *
   * @param key - Cache key to invalidate
   */
  invalidate(key: string): void {
    this.cache.delete(key)
  }

  /**
   * Invalidate all entries matching a pattern
   *
   * @param pattern - Prefix pattern to match
   */
  invalidatePattern(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(pattern)) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Invalidate all cache entries
   */
  invalidateAll(): void {
    this.cache.clear()
  }

  /**
   * Check if a key is cached and valid
   *
   * @param key - Cache key to check
   * @returns true if cached and valid
   */
  has(key: string): boolean {
    const entry = this.cache.get(key)
    return entry !== undefined && this.isValid(entry)
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number
    hits: number
    misses: number
    evictions: number
    hitRate: number
  } {
    const total = this.stats.hits + this.stats.misses
    return {
      size: this.cache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      evictions: this.stats.evictions,
      hitRate: total > 0 ? this.stats.hits / total : 0,
    }
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
    }
  }

  /**
   * Get current cache size
   */
  get size(): number {
    return this.cache.size
  }

  /**
   * Reset singleton instance (for testing only)
   * @internal
   */
  static __resetForTesting(): void {
    if (QueryCache.instance) {
      QueryCache.instance.cache.clear()
      QueryCache.instance.pendingFetches.clear()
      QueryCache.instance.resetStats()
    }
    QueryCache.instance = null as unknown as QueryCache
  }
}

/**
 * Singleton instance export
 */
export const queryCache = QueryCache.getInstance()

/**
 * Generate a cache key from query parameters
 *
 * @param collection - Collection name
 * @param selector - Query selector object
 * @param options - Additional query options
 * @returns Unique cache key
 */
export function generateCacheKey(
  collection: string,
  selector: Record<string, unknown>,
  options?: { sort?: unknown; limit?: number }
): string {
  const selectorStr = JSON.stringify(selector, Object.keys(selector).sort())
  const optionsStr = options ? JSON.stringify(options) : ''
  return `${collection}:${selectorStr}:${optionsStr}`
}
