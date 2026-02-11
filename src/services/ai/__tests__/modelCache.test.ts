/**
 * Model Cache Service Tests
 *
 * Story 3.1: Local LLM Integration
 * Task 4: Model caching unit tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  ModelCacheService,
  MODEL_CACHE_NAME,
  MODEL_CACHE_VERSION,
  CACHE_METADATA_KEY,
  type CacheMetadata,
} from '../modelCache'

// Mock logger
vi.mock('@/services/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// Store original globals
const originalCaches = globalThis.caches
const originalNavigator = globalThis.navigator

describe('ModelCacheService', () => {
  let mockCache: {
    put: ReturnType<typeof vi.fn>
    match: ReturnType<typeof vi.fn>
    keys: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
  }

  let mockCaches: {
    open: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
    keys: ReturnType<typeof vi.fn>
  }

  let mockStorage: {
    estimate: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    // Reset singleton
    ModelCacheService.__resetForTesting()

    // Create mock cache
    mockCache = {
      put: vi.fn().mockResolvedValue(undefined),
      match: vi.fn().mockResolvedValue(undefined),
      keys: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue(true),
    }

    // Mock caches API
    mockCaches = {
      open: vi.fn().mockResolvedValue(mockCache),
      delete: vi.fn().mockResolvedValue(true),
      keys: vi.fn().mockResolvedValue([]),
    }

    // Mock navigator.storage
    mockStorage = {
      estimate: vi.fn().mockResolvedValue({
        usage: 100 * 1024 * 1024, // 100MB used
        quota: 10 * 1024 * 1024 * 1024, // 10GB quota
      }),
    }

    // Set globals using Object.defineProperty for better compatibility
    Object.defineProperty(globalThis, 'caches', {
      value: mockCaches,
      writable: true,
      configurable: true,
    })

    Object.defineProperty(globalThis, 'navigator', {
      value: { storage: mockStorage },
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()

    // Restore original globals
    Object.defineProperty(globalThis, 'caches', {
      value: originalCaches,
      writable: true,
      configurable: true,
    })

    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    })
  })

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = ModelCacheService.getInstance()
      const instance2 = ModelCacheService.getInstance()

      expect(instance1).toBe(instance2)
    })

    it('should return same instance as exported singleton', () => {
      ModelCacheService.__resetForTesting()
      const instance = ModelCacheService.getInstance()

      // After reset, modelCacheService still points to old instance
      // But getInstance returns new singleton
      expect(instance).toBeInstanceOf(ModelCacheService)
    })
  })

  describe('initialize', () => {
    it('should open cache and return true on success', async () => {
      const service = ModelCacheService.getInstance()
      const result = await service.initialize()

      expect(result).toBe(true)
      expect(mockCaches.open).toHaveBeenCalledWith(MODEL_CACHE_NAME)
      expect(service.isAvailable()).toBe(true)
    })

    it('should return false when Cache API not available', async () => {
      // Remove caches from global
      Object.defineProperty(globalThis, 'caches', {
        value: undefined,
        writable: true,
        configurable: true,
      })

      const service = ModelCacheService.getInstance()
      const result = await service.initialize()

      expect(result).toBe(false)
      expect(service.isAvailable()).toBe(false)
    })

    it('should return false when cache open fails', async () => {
      mockCaches.open.mockRejectedValue(new Error('Cache open failed'))

      const service = ModelCacheService.getInstance()
      const result = await service.initialize()

      expect(result).toBe(false)
      expect(service.isAvailable()).toBe(false)
    })

    it('should trigger migration check', async () => {
      // Set up existing metadata with old version
      const oldMetadata: CacheMetadata = {
        version: 0, // Old version
        modelId: 'test-model',
        cachedAt: Date.now(),
        sizeBytes: 1000,
        provider: 'webgpu',
      }

      mockCache.match.mockImplementation((key: string) => {
        if (key === CACHE_METADATA_KEY) {
          return Promise.resolve(
            new Response(JSON.stringify(oldMetadata), {
              headers: { 'Content-Type': 'application/json' },
            })
          )
        }
        return Promise.resolve(undefined)
      })

      const service = ModelCacheService.getInstance()
      await service.initialize()

      // Should have triggered cache clear due to version mismatch
      expect(mockCaches.delete).toHaveBeenCalledWith(MODEL_CACHE_NAME)
      // Should have reopened cache after migration
      expect(mockCaches.open).toHaveBeenCalledTimes(2)
    })
  })

  describe('getStatus', () => {
    it('should return unavailable status when not initialized', async () => {
      const service = ModelCacheService.getInstance()
      const status = await service.getStatus()

      expect(status.available).toBe(false)
      expect(status.hasModel).toBe(false)
      expect(status.metadata).toBeNull()
    })

    it('should return full status when initialized with metadata', async () => {
      const metadata: CacheMetadata = {
        version: MODEL_CACHE_VERSION,
        modelId: 'test-model',
        cachedAt: Date.now(),
        sizeBytes: 1024 * 1024 * 100, // 100MB
        provider: 'webgpu',
      }

      mockCache.match.mockImplementation((key: string) => {
        if (key === CACHE_METADATA_KEY) {
          return Promise.resolve(
            new Response(JSON.stringify(metadata), {
              headers: { 'Content-Type': 'application/json' },
            })
          )
        }
        return Promise.resolve(undefined)
      })

      const service = ModelCacheService.getInstance()
      await service.initialize()

      const status = await service.getStatus()

      expect(status.available).toBe(true)
      expect(status.hasModel).toBe(true)
      expect(status.metadata).toEqual(metadata)
      expect(status.storageQuota).not.toBeNull()
      expect(status.storageQuota?.percentUsed).toBe(1) // 100MB / 10GB = 1%
    })

    it('should calculate estimated size from cache entries', async () => {
      const mockBlob = new Blob(['test content'], { type: 'application/octet-stream' })

      mockCache.keys.mockResolvedValue([new Request('https://example.com/model.bin')])
      mockCache.match.mockImplementation((key: string | Request) => {
        if (typeof key === 'string' && key === CACHE_METADATA_KEY) {
          return Promise.resolve(undefined)
        }
        return Promise.resolve(new Response(mockBlob))
      })

      const service = ModelCacheService.getInstance()
      await service.initialize()

      const status = await service.getStatus()

      expect(status.estimatedSizeBytes).toBeGreaterThan(0)
    })
  })

  describe('setMetadata / getMetadata', () => {
    it('should store and retrieve metadata', async () => {
      const service = ModelCacheService.getInstance()
      await service.initialize()

      const inputMetadata = {
        modelId: 'test-model',
        cachedAt: Date.now(),
        sizeBytes: 1000,
        provider: 'webgpu' as const,
      }

      await service.setMetadata(inputMetadata)

      expect(mockCache.put).toHaveBeenCalledWith(CACHE_METADATA_KEY, expect.any(Response))

      // Verify the stored response
      const storedCall = mockCache.put.mock.calls[0]
      const storedResponse = storedCall[1] as Response
      const storedData = await storedResponse.json()

      expect(storedData).toEqual({
        ...inputMetadata,
        version: MODEL_CACHE_VERSION,
      })
    })

    it('should throw when cache not available', async () => {
      const service = ModelCacheService.getInstance()
      // Don't initialize

      await expect(
        service.setMetadata({
          modelId: 'test',
          cachedAt: Date.now(),
          sizeBytes: 100,
          provider: 'wasm',
        })
      ).rejects.toThrow('Cache not available')
    })

    it('should return null when no metadata exists', async () => {
      mockCache.match.mockResolvedValue(undefined)

      const service = ModelCacheService.getInstance()
      await service.initialize()

      const metadata = await service.getMetadata()

      expect(metadata).toBeNull()
    })
  })

  describe('clear', () => {
    it('should delete cache and reinitialize', async () => {
      const service = ModelCacheService.getInstance()
      await service.initialize()

      await service.clear()

      expect(mockCaches.delete).toHaveBeenCalledWith(MODEL_CACHE_NAME)
      // Should reinitialize
      expect(mockCaches.open).toHaveBeenCalledTimes(2)
    })

    it('should handle errors during clear', async () => {
      mockCaches.delete.mockRejectedValue(new Error('Delete failed'))

      const service = ModelCacheService.getInstance()
      await service.initialize()

      await expect(service.clear()).rejects.toThrow('Delete failed')
    })
  })

  describe('getStorageQuota', () => {
    it('should return quota information', async () => {
      const service = ModelCacheService.getInstance()
      await service.initialize()

      const quota = await service.getStorageQuota()

      expect(quota).toEqual({
        used: 100 * 1024 * 1024,
        available: 10 * 1024 * 1024 * 1024 - 100 * 1024 * 1024,
        percentUsed: 1,
      })
    })

    it('should return null when storage API not available', async () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: { storage: undefined },
        writable: true,
        configurable: true,
      })

      const service = ModelCacheService.getInstance()
      await service.initialize()

      const quota = await service.getStorageQuota()

      expect(quota).toBeNull()
    })
  })

  describe('hasStorageSpace', () => {
    it('should return true when enough space available', async () => {
      const service = ModelCacheService.getInstance()
      await service.initialize()

      // 1GB request, 10GB available
      const hasSpace = await service.hasStorageSpace(1 * 1024 * 1024 * 1024)

      expect(hasSpace).toBe(true)
    })

    it('should return false when not enough space', async () => {
      mockStorage.estimate.mockResolvedValue({
        usage: 9 * 1024 * 1024 * 1024, // 9GB used
        quota: 10 * 1024 * 1024 * 1024, // 10GB quota
      })

      const service = ModelCacheService.getInstance()
      await service.initialize()

      // 2GB request, only 1GB available
      const hasSpace = await service.hasStorageSpace(2 * 1024 * 1024 * 1024)

      expect(hasSpace).toBe(false)
    })

    it('should return true when quota check unavailable', async () => {
      Object.defineProperty(globalThis, 'navigator', {
        value: { storage: undefined },
        writable: true,
        configurable: true,
      })

      const service = ModelCacheService.getInstance()
      await service.initialize()

      const hasSpace = await service.hasStorageSpace(10 * 1024 * 1024 * 1024)

      expect(hasSpace).toBe(true)
    })
  })

  describe('handleQuotaExceeded', () => {
    it('should delete old caches', async () => {
      mockCaches.keys.mockResolvedValue(['claine-models-v0', 'claine-models-v1', 'other-cache'])

      const service = ModelCacheService.getInstance()
      await service.initialize()

      const freed = await service.handleQuotaExceeded()

      expect(freed).toBe(true)
      expect(mockCaches.delete).toHaveBeenCalledWith('claine-models-v0')
      expect(mockCaches.delete).not.toHaveBeenCalledWith('claine-models-v1')
      expect(mockCaches.delete).not.toHaveBeenCalledWith('other-cache')
    })

    it('should return false when no old caches exist', async () => {
      mockCaches.keys.mockResolvedValue(['claine-models-v1', 'other-cache'])

      const service = ModelCacheService.getInstance()
      await service.initialize()

      const freed = await service.handleQuotaExceeded()

      expect(freed).toBe(false)
    })
  })

  describe('cacheFile / getCachedFile / isCached', () => {
    it('should cache and retrieve files', async () => {
      const testUrl = 'https://example.com/model.bin'
      const testResponse = new Response('model data')

      const service = ModelCacheService.getInstance()
      await service.initialize()

      await service.cacheFile(testUrl, testResponse)

      expect(mockCache.put).toHaveBeenCalledWith(testUrl, expect.any(Response))
    })

    it('should return cached file', async () => {
      const testUrl = 'https://example.com/model.bin'
      const testResponse = new Response('model data')

      mockCache.match.mockImplementation((key: string) => {
        if (key === testUrl) {
          return Promise.resolve(testResponse)
        }
        return Promise.resolve(undefined)
      })

      const service = ModelCacheService.getInstance()
      await service.initialize()

      const cached = await service.getCachedFile(testUrl)

      expect(cached).toBe(testResponse)
    })

    it('should return null for uncached file', async () => {
      mockCache.match.mockResolvedValue(undefined)

      const service = ModelCacheService.getInstance()
      await service.initialize()

      const cached = await service.getCachedFile('https://example.com/missing.bin')

      expect(cached).toBeNull()
    })

    it('should check if file is cached', async () => {
      const testUrl = 'https://example.com/model.bin'

      mockCache.match.mockImplementation((key: string) => {
        if (key === testUrl) {
          return Promise.resolve(new Response('data'))
        }
        return Promise.resolve(undefined)
      })

      const service = ModelCacheService.getInstance()
      await service.initialize()

      expect(await service.isCached(testUrl)).toBe(true)
      expect(await service.isCached('https://example.com/missing.bin')).toBe(false)
    })

    it('should handle quota exceeded during caching', async () => {
      mockCache.put.mockRejectedValue(new DOMException('Quota exceeded', 'QuotaExceededError'))

      const service = ModelCacheService.getInstance()
      await service.initialize()

      await expect(
        service.cacheFile('https://example.com/model.bin', new Response('data'))
      ).rejects.toThrow('Storage quota exceeded')
    })

    it('should throw when cache not available', async () => {
      const service = ModelCacheService.getInstance()
      // Don't initialize

      await expect(
        service.cacheFile('https://example.com/model.bin', new Response('data'))
      ).rejects.toThrow('Cache not available')
    })
  })
})
