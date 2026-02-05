/**
 * Background Sync Results Tests
 *
 * Story 2.18: Persistent Send Queue with Background Sync API
 * Task 4: Background Send Notifications
 *
 * Tests the send result storage and acknowledgment for Background Sync notifications.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { backgroundSyncResults, type SendResult } from '../backgroundSyncResults'

// Mock logger
vi.mock('@/services/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe('backgroundSyncResults', () => {
  const DB_NAME = 'claine-send-results'

  beforeEach(async () => {
    // Clean up database between tests
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase(DB_NAME)
      req.onsuccess = () => resolve()
      req.onerror = () => resolve()
      req.onblocked = () => resolve()
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getUnacknowledgedResults', () => {
    it('should return empty array when no results stored', async () => {
      const results = await backgroundSyncResults.getUnacknowledgedResults()
      expect(results).toEqual([])
    })

    it('should return stored send results', async () => {
      // Manually store a result
      await storeTestResult({
        queueItemId: 'send-1',
        status: 'sent',
        sentAt: Date.now(),
        recipients: 'to@test.com',
        subject: 'Test',
        processedBy: 'sw',
        processedAt: Date.now(),
      })

      const results = await backgroundSyncResults.getUnacknowledgedResults()
      expect(results).toHaveLength(1)
      expect(results[0].queueItemId).toBe('send-1')
      expect(results[0].status).toBe('sent')
    })

    it('should not return acknowledged results', async () => {
      await storeTestResult({
        queueItemId: 'send-1',
        status: 'sent',
        recipients: 'to@test.com',
        subject: 'Test',
        processedBy: 'sw',
        processedAt: Date.now(),
        acknowledged: true,
      })

      const results = await backgroundSyncResults.getUnacknowledgedResults()
      expect(results).toHaveLength(0)
    })
  })

  describe('acknowledgeResults', () => {
    it('should remove acknowledged results from store', async () => {
      await storeTestResult({
        queueItemId: 'send-1',
        status: 'sent',
        recipients: 'to@test.com',
        subject: 'Test',
        processedBy: 'sw',
        processedAt: Date.now(),
      })
      await storeTestResult({
        queueItemId: 'send-2',
        status: 'failed',
        error: 'Network error',
        recipients: 'to2@test.com',
        subject: 'Test 2',
        processedBy: 'sw',
        processedAt: Date.now(),
      })

      await backgroundSyncResults.acknowledgeResults(['send-1'])

      const remaining = await backgroundSyncResults.getUnacknowledgedResults()
      expect(remaining).toHaveLength(1)
      expect(remaining[0].queueItemId).toBe('send-2')
    })

    it('should handle empty array gracefully', async () => {
      await backgroundSyncResults.acknowledgeResults([])
      // Should not throw
    })
  })

  describe('onSendResult', () => {
    it('should set up message listener for SW results', () => {
      const callback = vi.fn()

      // Mock serviceWorker
      const addEventListenerMock = vi.fn()
      const removeEventListenerMock = vi.fn()

      Object.defineProperty(navigator, 'serviceWorker', {
        value: {
          addEventListener: addEventListenerMock,
          removeEventListener: removeEventListenerMock,
        },
        writable: true,
        configurable: true,
      })

      const cleanup = backgroundSyncResults.onSendResult(callback)
      expect(addEventListenerMock).toHaveBeenCalledWith('message', expect.any(Function))

      cleanup()
      expect(removeEventListenerMock).toHaveBeenCalledWith('message', expect.any(Function))
    })
  })
})

// Helper to store a test result directly in IndexedDB
async function storeTestResult(result: SendResult): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('claine-send-results', 1)
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains('results')) {
        db.createObjectStore('results', { keyPath: 'queueItemId' })
      }
    }
    request.onsuccess = () => {
      const db = request.result
      const tx = db.transaction('results', 'readwrite')
      const store = tx.objectStore('results')
      store.put(result)
      tx.oncomplete = () => {
        db.close()
        resolve()
      }
      tx.onerror = () => {
        db.close()
        reject(tx.error)
      }
    }
    request.onerror = () => reject(request.error)
  })
}
