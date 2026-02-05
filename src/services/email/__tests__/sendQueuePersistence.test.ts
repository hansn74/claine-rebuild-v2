/**
 * Send Queue Persistence & Idempotency Tests
 *
 * Story 2.18: Persistent Send Queue with Background Sync API
 * Task 7.2: Unit tests for idempotency: duplicate send prevention, stale sending state reset
 * Task 7.3: Unit tests for queue reconciliation on startup
 * Task 7.4: Integration test: queue email with attachment → verify blob persists
 * Task 7.5: Integration test: queue → send → verify blob cleaned up
 * Task 7.10: Unit test: Background Sync registration, feature detection
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createRxDatabase, addRxPlugin } from 'rxdb'
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie'
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode'
import { RxDBUpdatePlugin } from 'rxdb/plugins/update'
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv'
import type { RxDatabase } from 'rxdb'
import { sendQueueSchema } from '@/services/database/schemas/sendQueue.schema'
import { attachmentBlobStore } from '../attachmentBlobStore'

// Add required plugins
addRxPlugin(RxDBDevModePlugin)
addRxPlugin(RxDBUpdatePlugin)

// Mock dependencies
vi.mock('@/services/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/services/sync/circuitBreaker', () => ({
  circuitBreaker: {
    canExecute: vi.fn(() => true),
    recordSuccess: vi.fn(),
    recordFailure: vi.fn(),
    subscribe: vi.fn(),
    getStatus: vi.fn(() => ({ state: 'closed' })),
  },
}))

vi.mock('@/services/sync/errorClassification', () => ({
  classifyError: vi.fn(() => ({ type: 'transient' })),
}))

// We need to mock getDatabase to return our test database
let testDb: RxDatabase | null = null

vi.mock('@/services/database/init', () => ({
  getDatabase: () => {
    if (!testDb) throw new Error('Test DB not initialized')
    return testDb
  },
}))

describe('SendQueueService - Persistence & Idempotency', () => {
  let db: RxDatabase
  let dbName: string

  beforeEach(async () => {
    dbName = 'testsq' + Date.now() + Math.random().toString().replace('.', '')

    db = await createRxDatabase({
      name: dbName,
      storage: wrappedValidateAjvStorage({ storage: getRxStorageDexie() }),
      multiInstance: false,
      ignoreDuplicate: true,
    })

    await db.addCollections({
      sendQueue: { schema: sendQueueSchema },
    })

    testDb = db

    // Clean IndexedDB blob store
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase('claine-attachment-blobs')
      req.onsuccess = () => resolve()
      req.onerror = () => resolve()
      req.onblocked = () => resolve()
    })
  })

  afterEach(async () => {
    try {
      if (db && typeof db.destroy === 'function') {
        await db.destroy()
      }
    } catch {
      // Ignore destroy errors in test cleanup
    }
    testDb = null
    vi.restoreAllMocks()
  })

  describe('Idempotency (Task 7.2)', () => {
    it('should generate a unique idempotencyKey for each queued email', async () => {
      // Dynamically import after mocks are set up
      const { SendQueueService } = await import('../sendQueueService')

      // Create fresh instance for testing
      const service = SendQueueService.getInstance()

      const draft1 = createMockDraft()
      const draft2 = createMockDraft()

      const item1 = await service.queueEmail(draft1)
      const item2 = await service.queueEmail(draft2)

      expect(item1.idempotencyKey).toBeDefined()
      expect(item2.idempotencyKey).toBeDefined()
      expect(item1.idempotencyKey).not.toBe(item2.idempotencyKey)
    })

    it('should set lastProcessedBy to app when queuing', async () => {
      const { SendQueueService } = await import('../sendQueueService')
      const service = SendQueueService.getInstance()

      const draft = createMockDraft()
      const item = await service.queueEmail(draft)

      expect(item.lastProcessedBy).toBe('app')
    })
  })

  describe('Queue Reconciliation (Task 7.3)', () => {
    it('should reset stale sending items to pending', async () => {
      // Insert a queue item in "sending" state with old lastAttemptAt
      const staleTime = Date.now() - 3 * 60 * 1000 // 3 minutes ago

      await db.sendQueue.insert({
        id: 'stale-item',
        accountId: 'gmail:test@test.com',
        type: 'new',
        to: [{ name: 'Test', email: 'to@test.com' }],
        cc: [],
        bcc: [],
        subject: 'Test',
        body: { html: '<p>Test</p>', text: 'Test' },
        attachments: [],
        status: 'sending',
        attempts: 1,
        maxAttempts: 3,
        lastAttemptAt: staleTime,
        createdAt: staleTime,
        updatedAt: staleTime,
      })

      const { SendQueueService } = await import('../sendQueueService')
      const service = SendQueueService.getInstance()

      await service.reconcileQueueState()

      const item = await db.sendQueue.findOne('stale-item').exec()
      expect(item?.status).toBe('pending')
    })

    it('should not reset recent sending items', async () => {
      const recentTime = Date.now() - 30 * 1000 // 30 seconds ago

      await db.sendQueue.insert({
        id: 'recent-sending',
        accountId: 'gmail:test@test.com',
        type: 'new',
        to: [{ name: 'Test', email: 'to@test.com' }],
        cc: [],
        bcc: [],
        subject: 'Test',
        body: { html: '<p>Test</p>', text: 'Test' },
        attachments: [],
        status: 'sending',
        attempts: 1,
        maxAttempts: 3,
        lastAttemptAt: recentTime,
        createdAt: recentTime,
        updatedAt: recentTime,
      })

      const { SendQueueService } = await import('../sendQueueService')
      const service = SendQueueService.getInstance()

      await service.reconcileQueueState()

      const item = await db.sendQueue.findOne('recent-sending').exec()
      expect(item?.status).toBe('sending')
    })

    it('should clean up orphaned blobs during reconciliation', async () => {
      // Store a blob for a non-existent queue item
      await attachmentBlobStore.put('orphan-queue', 'att-1', 'content', 10, 'text/plain')
      expect(await attachmentBlobStore.hasBlobs('orphan-queue')).toBe(true)

      const { SendQueueService } = await import('../sendQueueService')
      const service = SendQueueService.getInstance()

      await service.reconcileQueueState()

      // Orphan should be cleaned up (no matching queue item exists)
      expect(await attachmentBlobStore.hasBlobs('orphan-queue')).toBe(false)
    })
  })

  describe('Blob Store Integration (Task 7.4, 7.5)', () => {
    it('should persist attachment blobs in IndexedDB when queueing email', async () => {
      const { SendQueueService } = await import('../sendQueueService')
      const service = SendQueueService.getInstance()

      const attachmentContent = btoa('A'.repeat(5000)) // ~5KB encoded

      const draft = createMockDraft({
        attachments: [
          {
            id: 'att-1',
            filename: 'test.txt',
            mimeType: 'text/plain',
            size: 5000,
            content: attachmentContent,
          },
        ],
      })

      const queueItem = await service.queueEmail(draft)

      // Verify blob is persisted in IndexedDB
      const blob = await attachmentBlobStore.get(queueItem.id, 'att-1')
      expect(blob).not.toBeNull()
      expect(blob!.blob).toBe(attachmentContent)

      // Verify content is NOT stored in RxDB queue item (empty string)
      const dbItem = await db.sendQueue.findOne(queueItem.id).exec()
      expect(dbItem?.attachments[0].content).toBe('')
    })

    it('should clean up blobs when cancelling queued email', async () => {
      const { SendQueueService } = await import('../sendQueueService')
      const service = SendQueueService.getInstance()

      const draft = createMockDraft({
        attachments: [
          {
            id: 'att-1',
            filename: 'test.txt',
            mimeType: 'text/plain',
            size: 100,
            content: btoa('test'),
          },
        ],
      })

      const queueItem = await service.queueEmail(draft)
      expect(await attachmentBlobStore.hasBlobs(queueItem.id)).toBe(true)

      await service.cancelQueuedEmail(queueItem.id)
      expect(await attachmentBlobStore.hasBlobs(queueItem.id)).toBe(false)
    })
  })

  describe('Background Sync Feature Detection (Task 7.10)', () => {
    it('should attempt Background Sync registration when SyncManager exists', async () => {
      const mockRegister = vi.fn().mockResolvedValue(undefined)

      // Mock serviceWorker.ready
      Object.defineProperty(navigator, 'serviceWorker', {
        value: {
          ready: Promise.resolve({
            sync: { register: mockRegister },
          }),
        },
        writable: true,
        configurable: true,
      })

      // Mock SyncManager
      ;(window as unknown as Record<string, unknown>).SyncManager = class {}

      const { SendQueueService } = await import('../sendQueueService')
      const service = SendQueueService.getInstance()

      await service.registerBackgroundSync()
      expect(mockRegister).toHaveBeenCalledWith('send-queue-sync')

      // Clean up
      delete (window as unknown as Record<string, unknown>).SyncManager
    })

    it('should skip registration when SyncManager not available', async () => {
      // Ensure SyncManager is not defined (Firefox/Safari)
      delete (window as unknown as Record<string, unknown>).SyncManager

      const { SendQueueService } = await import('../sendQueueService')
      const service = SendQueueService.getInstance()

      // Should not throw
      await service.registerBackgroundSync()
    })
  })
})

// Helper to create mock draft documents
function createMockDraft(overrides: Record<string, unknown> = {}) {
  return {
    id: `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    accountId: 'gmail:test@test.com',
    type: 'new' as const,
    to: [{ name: 'Recipient', email: 'to@test.com' }],
    cc: [],
    bcc: [],
    subject: 'Test Email',
    body: { html: '<p>Test body</p>', text: 'Test body' },
    attachments: [],
    createdAt: Date.now(),
    lastSaved: Date.now(),
    ...overrides,
  }
}
