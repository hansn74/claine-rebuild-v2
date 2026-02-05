/**
 * Attachment Blob Store Tests
 *
 * Story 2.18: Persistent Send Queue with Background Sync API
 * Task 7.1: Unit tests for attachmentBlobStore CRUD + quota check + orphan cleanup
 * Task 7.9: Unit test: storage quota exceeded
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { attachmentBlobStore } from '../attachmentBlobStore'

// Mock logger
vi.mock('@/services/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe('attachmentBlobStore', () => {
  const queueItemId = 'send-12345-abc'
  const attachmentId = 'att-1'
  const blobContent = btoa('Hello, this is test attachment content')
  const mimeType = 'text/plain'
  const size = 38

  // Clean up IndexedDB between tests
  beforeEach(async () => {
    // Delete the database to start fresh
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('claine-attachment-blobs')
      req.onsuccess = () => resolve()
      req.onerror = () => resolve()
      req.onblocked = () => resolve()
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('put and get', () => {
    it('should store and retrieve a blob', async () => {
      await attachmentBlobStore.put(queueItemId, attachmentId, blobContent, size, mimeType)

      const record = await attachmentBlobStore.get(queueItemId, attachmentId)
      expect(record).not.toBeNull()
      expect(record!.queueItemId).toBe(queueItemId)
      expect(record!.attachmentId).toBe(attachmentId)
      expect(record!.blob).toBe(blobContent)
      expect(record!.size).toBe(size)
      expect(record!.mimeType).toBe(mimeType)
      expect(record!.createdAt).toBeGreaterThan(0)
    })

    it('should return null for non-existent blob', async () => {
      const record = await attachmentBlobStore.get('nonexistent', 'nonexistent')
      expect(record).toBeNull()
    })

    it('should overwrite existing blob on put', async () => {
      await attachmentBlobStore.put(queueItemId, attachmentId, 'old-content', 10, mimeType)
      await attachmentBlobStore.put(queueItemId, attachmentId, 'new-content', 20, mimeType)

      const record = await attachmentBlobStore.get(queueItemId, attachmentId)
      expect(record!.blob).toBe('new-content')
      expect(record!.size).toBe(20)
    })

    it('should store multiple attachments for same queue item', async () => {
      await attachmentBlobStore.put(queueItemId, 'att-1', 'content-1', 10, 'text/plain')
      await attachmentBlobStore.put(queueItemId, 'att-2', 'content-2', 20, 'image/png')

      const record1 = await attachmentBlobStore.get(queueItemId, 'att-1')
      const record2 = await attachmentBlobStore.get(queueItemId, 'att-2')

      expect(record1!.blob).toBe('content-1')
      expect(record2!.blob).toBe('content-2')
    })
  })

  describe('getAllForQueueItem', () => {
    it('should return all blobs for a queue item', async () => {
      await attachmentBlobStore.put(queueItemId, 'att-1', 'content-1', 10, 'text/plain')
      await attachmentBlobStore.put(queueItemId, 'att-2', 'content-2', 20, 'image/png')
      await attachmentBlobStore.put('other-queue', 'att-3', 'content-3', 30, 'text/plain')

      const blobs = await attachmentBlobStore.getAllForQueueItem(queueItemId)
      expect(blobs).toHaveLength(2)
      expect(blobs.map((b) => b.attachmentId).sort()).toEqual(['att-1', 'att-2'])
    })

    it('should return empty array for non-existent queue item', async () => {
      const blobs = await attachmentBlobStore.getAllForQueueItem('nonexistent')
      expect(blobs).toHaveLength(0)
    })
  })

  describe('deleteForQueueItem', () => {
    it('should delete all blobs for a queue item', async () => {
      await attachmentBlobStore.put(queueItemId, 'att-1', 'content-1', 10, 'text/plain')
      await attachmentBlobStore.put(queueItemId, 'att-2', 'content-2', 20, 'image/png')

      const deleted = await attachmentBlobStore.deleteForQueueItem(queueItemId)
      expect(deleted).toBe(2)

      const remaining = await attachmentBlobStore.getAllForQueueItem(queueItemId)
      expect(remaining).toHaveLength(0)
    })

    it('should not delete blobs for other queue items', async () => {
      await attachmentBlobStore.put(queueItemId, 'att-1', 'content-1', 10, 'text/plain')
      await attachmentBlobStore.put('other-queue', 'att-2', 'content-2', 20, 'text/plain')

      await attachmentBlobStore.deleteForQueueItem(queueItemId)

      const otherBlobs = await attachmentBlobStore.getAllForQueueItem('other-queue')
      expect(otherBlobs).toHaveLength(1)
    })

    it('should return 0 when deleting non-existent queue item', async () => {
      const deleted = await attachmentBlobStore.deleteForQueueItem('nonexistent')
      expect(deleted).toBe(0)
    })
  })

  describe('checkQuota', () => {
    it('should return sufficient when StorageManager is not available', async () => {
      // StorageManager may not exist in test environment
      const originalStorage = navigator.storage
      Object.defineProperty(navigator, 'storage', {
        value: undefined,
        writable: true,
        configurable: true,
      })

      const result = await attachmentBlobStore.checkQuota(1000)
      expect(result.sufficient).toBe(true)

      Object.defineProperty(navigator, 'storage', {
        value: originalStorage,
        writable: true,
        configurable: true,
      })
    })

    it('should check quota against available storage', async () => {
      const mockEstimate = vi.fn().mockResolvedValue({
        quota: 100 * 1024 * 1024, // 100MB
        usage: 50 * 1024 * 1024, // 50MB used
      })

      Object.defineProperty(navigator, 'storage', {
        value: { estimate: mockEstimate },
        writable: true,
        configurable: true,
      })

      // Small attachment should fit (50MB available, needs ~10MB buffer + small file)
      const result = await attachmentBlobStore.checkQuota(1000)
      expect(result.sufficient).toBe(true)
      expect(result.available).toBe(50 * 1024 * 1024)
    })

    it('should return insufficient when quota exceeded', async () => {
      const mockEstimate = vi.fn().mockResolvedValue({
        quota: 60 * 1024 * 1024, // 60MB
        usage: 55 * 1024 * 1024, // 55MB used (only 5MB free)
      })

      Object.defineProperty(navigator, 'storage', {
        value: { estimate: mockEstimate },
        writable: true,
        configurable: true,
      })

      // Need 10MB buffer + attachment size — 5MB free is not enough
      const result = await attachmentBlobStore.checkQuota(1000)
      expect(result.sufficient).toBe(false)
      expect(result.available).toBe(5 * 1024 * 1024)
    })
  })

  describe('hasBlobs', () => {
    it('should return true when blobs exist', async () => {
      await attachmentBlobStore.put(queueItemId, 'att-1', 'content', 10, 'text/plain')
      expect(await attachmentBlobStore.hasBlobs(queueItemId)).toBe(true)
    })

    it('should return false when no blobs exist', async () => {
      expect(await attachmentBlobStore.hasBlobs('nonexistent')).toBe(false)
    })
  })

  describe('getAllQueueItemIds', () => {
    it('should return all unique queue item IDs with stored blobs', async () => {
      await attachmentBlobStore.put('queue-1', 'att-1', 'content', 10, 'text/plain')
      await attachmentBlobStore.put('queue-1', 'att-2', 'content', 10, 'text/plain')
      await attachmentBlobStore.put('queue-2', 'att-1', 'content', 10, 'text/plain')

      const ids = await attachmentBlobStore.getAllQueueItemIds()
      expect(ids.size).toBe(2)
      expect(ids.has('queue-1')).toBe(true)
      expect(ids.has('queue-2')).toBe(true)
    })
  })

  describe('cleanupOrphanedBlobs', () => {
    it('should remove blobs for queue items not in active set', async () => {
      await attachmentBlobStore.put('active-queue', 'att-1', 'content', 10, 'text/plain')
      await attachmentBlobStore.put('orphan-queue', 'att-1', 'content', 10, 'text/plain')

      const activeIds = new Set(['active-queue'])
      const removed = await attachmentBlobStore.cleanupOrphanedBlobs(activeIds)

      expect(removed).toBe(1)
      expect(await attachmentBlobStore.hasBlobs('active-queue')).toBe(true)
      expect(await attachmentBlobStore.hasBlobs('orphan-queue')).toBe(false)
    })

    it('should return 0 when no orphans exist', async () => {
      await attachmentBlobStore.put('active-queue', 'att-1', 'content', 10, 'text/plain')

      const activeIds = new Set(['active-queue'])
      const removed = await attachmentBlobStore.cleanupOrphanedBlobs(activeIds)
      expect(removed).toBe(0)
    })

    it('should handle empty blob store', async () => {
      const activeIds = new Set(['queue-1'])
      const removed = await attachmentBlobStore.cleanupOrphanedBlobs(activeIds)
      expect(removed).toBe(0)
    })
  })
})
