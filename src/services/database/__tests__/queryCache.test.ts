/**
 * Query Cache Tests
 *
 * Story 2.10: Performance Optimization & Benchmarking
 * Task 4.4: Query result caching with TTL
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { QueryCache, queryCache, generateCacheKey } from '../queryCache'

describe('QueryCache', () => {
  beforeEach(() => {
    QueryCache.__resetForTesting()
  })

  describe('get', () => {
    it('should fetch and cache value on first call', async () => {
      const cache = QueryCache.getInstance()
      const fetcher = vi.fn().mockResolvedValue({ data: 'test' })

      const result = await cache.get('test-key', fetcher)

      expect(result).toEqual({ data: 'test' })
      expect(fetcher).toHaveBeenCalledTimes(1)
    })

    it('should return cached value on subsequent calls', async () => {
      const cache = QueryCache.getInstance()
      const fetcher = vi.fn().mockResolvedValue({ data: 'test' })

      await cache.get('test-key', fetcher)
      const result = await cache.get('test-key', fetcher)

      expect(result).toEqual({ data: 'test' })
      expect(fetcher).toHaveBeenCalledTimes(1) // Not called again
    })

    it('should track cache hits and misses', async () => {
      const cache = QueryCache.getInstance()
      const fetcher = vi.fn().mockResolvedValue('value')

      await cache.get('key1', fetcher) // miss
      await cache.get('key1', fetcher) // hit
      await cache.get('key2', fetcher) // miss

      const stats = cache.getStats()
      expect(stats.misses).toBe(2)
      expect(stats.hits).toBe(1)
    })

    it('should respect forceRefresh option', async () => {
      const cache = QueryCache.getInstance()
      const fetcher = vi.fn().mockResolvedValueOnce('first').mockResolvedValueOnce('second')

      await cache.get('key', fetcher)
      const result = await cache.get('key', fetcher, { forceRefresh: true })

      expect(result).toBe('second')
      expect(fetcher).toHaveBeenCalledTimes(2)
    })

    it('should expire entries based on TTL', async () => {
      vi.useFakeTimers()
      const cache = QueryCache.getInstance()
      const fetcher = vi.fn().mockResolvedValueOnce('first').mockResolvedValueOnce('second')

      await cache.get('key', fetcher, { ttl: 1000 })

      // Advance time past TTL
      vi.advanceTimersByTime(1500)

      const result = await cache.get('key', fetcher, { ttl: 1000 })

      expect(result).toBe('second')
      expect(fetcher).toHaveBeenCalledTimes(2)

      vi.useRealTimers()
    })

    it('should prevent duplicate fetches for same key', async () => {
      const cache = QueryCache.getInstance()
      let resolvePromise: (value: string) => void
      const fetcher = vi.fn().mockReturnValue(
        new Promise<string>((resolve) => {
          resolvePromise = resolve
        })
      )

      // Start two fetches for same key
      const promise1 = cache.get('key', fetcher)
      const promise2 = cache.get('key', fetcher)

      // Resolve the single pending fetch
      resolvePromise!('value')

      const [result1, result2] = await Promise.all([promise1, promise2])

      expect(result1).toBe('value')
      expect(result2).toBe('value')
      expect(fetcher).toHaveBeenCalledTimes(1) // Only one fetch
    })
  })

  describe('invalidate', () => {
    it('should invalidate specific cache entry', async () => {
      const cache = QueryCache.getInstance()
      const fetcher = vi.fn().mockResolvedValue('value')

      await cache.get('key', fetcher)
      cache.invalidate('key')
      await cache.get('key', fetcher)

      expect(fetcher).toHaveBeenCalledTimes(2)
    })

    it('should invalidate entries matching pattern', async () => {
      const cache = QueryCache.getInstance()
      const fetcher = vi.fn().mockResolvedValue('value')

      await cache.get('emails-inbox', fetcher)
      await cache.get('emails-sent', fetcher)
      await cache.get('threads-all', fetcher)

      cache.invalidatePattern('emails-')

      // Emails should be invalidated
      await cache.get('emails-inbox', fetcher)
      expect(fetcher).toHaveBeenCalledTimes(4) // 3 initial + 1 refetch

      // Threads should still be cached
      await cache.get('threads-all', fetcher)
      expect(fetcher).toHaveBeenCalledTimes(4) // No additional fetch
    })

    it('should invalidate all entries', async () => {
      const cache = QueryCache.getInstance()
      const fetcher = vi.fn().mockResolvedValue('value')

      await cache.get('key1', fetcher)
      await cache.get('key2', fetcher)

      cache.invalidateAll()

      expect(cache.size).toBe(0)
    })
  })

  describe('has', () => {
    it('should return true for cached and valid entries', async () => {
      const cache = QueryCache.getInstance()
      await cache.get('key', async () => 'value')

      expect(cache.has('key')).toBe(true)
    })

    it('should return false for non-existent entries', () => {
      const cache = QueryCache.getInstance()
      expect(cache.has('nonexistent')).toBe(false)
    })

    it('should return false for expired entries', async () => {
      vi.useFakeTimers()
      const cache = QueryCache.getInstance()

      await cache.get('key', async () => 'value', { ttl: 1000 })
      vi.advanceTimersByTime(1500)

      expect(cache.has('key')).toBe(false)

      vi.useRealTimers()
    })
  })

  describe('LRU eviction', () => {
    it('should evict oldest entries when cache is full', async () => {
      const cache = QueryCache.getInstance()

      // Fill cache to max
      for (let i = 0; i < 100; i++) {
        await cache.get(`key-${i}`, async () => `value-${i}`)
      }

      expect(cache.size).toBe(100)

      // Add one more - should evict oldest
      await cache.get('key-new', async () => 'new-value')

      expect(cache.size).toBe(100)
      expect(cache.getStats().evictions).toBe(1)
    })
  })

  describe('singleton', () => {
    it('should return same instance', () => {
      const instance1 = QueryCache.getInstance()
      const instance2 = QueryCache.getInstance()
      expect(instance1).toBe(instance2)
    })

    it('should export singleton as queryCache', () => {
      expect(queryCache).toBeDefined()
      expect(queryCache).toBeInstanceOf(QueryCache)
    })
  })
})

describe('generateCacheKey', () => {
  it('should generate unique keys for different queries', () => {
    const key1 = generateCacheKey('emails', { folder: 'inbox' })
    const key2 = generateCacheKey('emails', { folder: 'sent' })
    const key3 = generateCacheKey('threads', { folder: 'inbox' })

    expect(key1).not.toBe(key2)
    expect(key1).not.toBe(key3)
  })

  it('should generate same key for same query', () => {
    const key1 = generateCacheKey('emails', { folder: 'inbox', accountId: 'abc' })
    const key2 = generateCacheKey('emails', { accountId: 'abc', folder: 'inbox' })

    expect(key1).toBe(key2) // Order-independent
  })

  it('should include options in key', () => {
    const key1 = generateCacheKey('emails', { folder: 'inbox' }, { limit: 50 })
    const key2 = generateCacheKey('emails', { folder: 'inbox' }, { limit: 100 })

    expect(key1).not.toBe(key2)
  })
})
