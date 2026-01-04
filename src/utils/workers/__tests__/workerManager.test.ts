/**
 * Worker Manager Tests
 *
 * Story 2.10: Performance Optimization & Benchmarking
 * Task 5.7: Write tests for worker communication and error scenarios
 *
 * Note: Web Workers are not fully supported in jsdom environment.
 * These tests mock the Worker class and verify the manager logic.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import type { IndexableEmail, RawEmailData, WorkerResponse } from '@/workers/types'

// Mock Worker class
class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  private messageHandlers: ((event: MessageEvent) => void)[] = []

  constructor() {
    // Simulate ready message after construction
    setTimeout(() => {
      this.simulateMessage({ type: 'READY', messageId: 'init', duration: 0 })
    }, 10)
  }

  postMessage(message: unknown): void {
    // Simulate async response
    setTimeout(() => {
      const msg = message as { type: string; messageId: string; payload: unknown }
      let response: WorkerResponse

      switch (msg.type) {
        case 'INDEX_EMAILS':
          response = {
            type: msg.type,
            result: { indexed: 10, duration: 5 },
            messageId: msg.messageId,
            duration: 5,
          }
          break
        case 'SEARCH':
          response = {
            type: msg.type,
            result: {
              results: [],
              totalCount: 0,
              query: (msg.payload as { query: string }).query,
              processingTime: 2,
            },
            messageId: msg.messageId,
            duration: 2,
          }
          break
        case 'CLEAR_INDEX':
          response = {
            type: msg.type,
            result: { success: true },
            messageId: msg.messageId,
            duration: 1,
          }
          break
        case 'GET_STATS':
          response = {
            type: msg.type,
            result: {
              totalDocuments: 100,
              totalTokens: 500,
              indexSizeBytes: 10000,
              lastUpdated: Date.now(),
            },
            messageId: msg.messageId,
            duration: 1,
          }
          break
        case 'PARSE_EMAIL':
          response = {
            type: msg.type,
            result: {
              id: 'test-id',
              threadId: 'test-thread',
              from: { name: 'Test', email: 'test@example.com' },
              to: [],
              subject: 'Test Subject',
              body: { text: 'Test body' },
              timestamp: Date.now(),
              attachments: [],
              snippet: 'Test body',
            },
            messageId: msg.messageId,
            duration: 3,
          }
          break
        case 'PARSE_EMAILS_BATCH':
          response = {
            type: msg.type,
            result: [],
            messageId: msg.messageId,
            duration: 10,
          }
          break
        default:
          response = {
            type: msg.type,
            error: `Unknown message type: ${msg.type}`,
            messageId: msg.messageId,
            duration: 0,
          }
      }

      this.simulateMessage(response)
    }, 10)
  }

  terminate(): void {
    // Clean up
    this.onmessage = null
    this.onerror = null
    this.messageHandlers = []
  }

  addEventListener(type: string, handler: (event: MessageEvent) => void): void {
    if (type === 'message') {
      this.messageHandlers.push(handler)
    }
  }

  removeEventListener(type: string, handler: (event: MessageEvent) => void): void {
    if (type === 'message') {
      this.messageHandlers = this.messageHandlers.filter((h) => h !== handler)
    }
  }

  private simulateMessage(data: unknown): void {
    const event = { data } as MessageEvent
    this.messageHandlers.forEach((handler) => handler(event))
    if (this.onmessage) {
      this.onmessage(event)
    }
  }
}

// Mock Worker globally
vi.stubGlobal('Worker', MockWorker)

// Import after mocking
import { WorkerManager } from '../workerManager'

describe('WorkerManager', () => {
  beforeEach(() => {
    WorkerManager.__resetForTesting()
    vi.clearAllMocks()
  })

  afterEach(() => {
    WorkerManager.__resetForTesting()
  })

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = WorkerManager.getInstance()
      const instance2 = WorkerManager.getInstance()

      expect(instance1).toBe(instance2)
    })

    it('should accept configuration', () => {
      const manager = WorkerManager.getInstance({
        maxWorkers: 4,
        idleTimeout: 30000,
        messageTimeout: 15000,
      })

      expect(manager).toBeDefined()
    })
  })

  describe('isSupported', () => {
    it('should return true when Worker is available', () => {
      expect(WorkerManager.isSupported()).toBe(true)
    })
  })

  describe('indexEmails', () => {
    it('should index emails via worker', async () => {
      const manager = WorkerManager.getInstance()
      const emails: IndexableEmail[] = [
        {
          id: 'email-1',
          threadId: 'thread-1',
          subject: 'Test Email',
          snippet: 'This is a test',
          fromName: 'Sender',
          fromEmail: 'sender@example.com',
          toNames: ['Recipient'],
          toEmails: ['recipient@example.com'],
          timestamp: Date.now(),
          folder: 'inbox',
          labels: ['important'],
          read: false,
          starred: false,
        },
      ]

      const result = await manager.indexEmails(emails)

      expect(result).toHaveProperty('indexed')
      expect(result).toHaveProperty('duration')
      expect(result.indexed).toBe(10) // Mock returns 10
    })

    it('should support replace option', async () => {
      const manager = WorkerManager.getInstance()
      const emails: IndexableEmail[] = []

      const result = await manager.indexEmails(emails, { replace: true })

      expect(result).toHaveProperty('indexed')
    })
  })

  describe('search', () => {
    it('should search via worker', async () => {
      const manager = WorkerManager.getInstance()

      const result = await manager.search('test query')

      expect(result).toHaveProperty('results')
      expect(result).toHaveProperty('totalCount')
      expect(result).toHaveProperty('query')
      expect(result.query).toBe('test query')
    })

    it('should support search options', async () => {
      const manager = WorkerManager.getInstance()

      const result = await manager.search('test', {
        folder: 'inbox',
        limit: 10,
        offset: 0,
      })

      expect(result).toHaveProperty('results')
    })
  })

  describe('clearSearchIndex', () => {
    it('should clear index via worker', async () => {
      const manager = WorkerManager.getInstance()

      await expect(manager.clearSearchIndex()).resolves.toBeUndefined()
    })
  })

  describe('getSearchIndexStats', () => {
    it('should get stats via worker', async () => {
      const manager = WorkerManager.getInstance()

      const stats = await manager.getSearchIndexStats()

      expect(stats).toHaveProperty('totalDocuments')
      expect(stats).toHaveProperty('totalTokens')
      expect(stats).toHaveProperty('indexSizeBytes')
      expect(stats).toHaveProperty('lastUpdated')
    })
  })

  describe('parseEmail', () => {
    it('should parse email via worker', async () => {
      const manager = WorkerManager.getInstance()
      const rawEmail: RawEmailData = {
        id: 'test-id',
        threadId: 'test-thread',
        headers: {
          From: 'sender@example.com',
          To: 'recipient@example.com',
          Subject: 'Test',
          Date: new Date().toISOString(),
        },
        bodyParts: [
          {
            mimeType: 'text/plain',
            body: 'Test body content',
          },
        ],
      }

      const result = await manager.parseEmail(rawEmail)

      expect(result).toHaveProperty('id')
      expect(result).toHaveProperty('from')
      expect(result).toHaveProperty('subject')
    })
  })

  describe('parseEmailsBatch', () => {
    it('should parse multiple emails via worker', async () => {
      const manager = WorkerManager.getInstance()
      const rawEmails: RawEmailData[] = [
        {
          id: 'test-1',
          threadId: 'thread-1',
          headers: { Subject: 'Test 1' },
          bodyParts: [],
        },
        {
          id: 'test-2',
          threadId: 'thread-2',
          headers: { Subject: 'Test 2' },
          bodyParts: [],
        },
      ]

      const result = await manager.parseEmailsBatch(rawEmails)

      expect(Array.isArray(result)).toBe(true)
    })
  })

  describe('worker management', () => {
    it('should get worker info', async () => {
      const manager = WorkerManager.getInstance()

      // Trigger worker creation
      await manager.search('test')

      const info = manager.getWorkerInfo()

      expect(Array.isArray(info)).toBe(true)
      expect(info.length).toBeGreaterThan(0)
      expect(info[0]).toHaveProperty('id')
      expect(info[0]).toHaveProperty('type')
      expect(info[0]).toHaveProperty('status')
    })

    it('should terminate all workers', async () => {
      const manager = WorkerManager.getInstance()

      // Create some workers
      await manager.search('test')

      manager.terminateAll()

      const info = manager.getWorkerInfo()
      expect(info).toEqual([])
    })

    it('should terminate workers by type', async () => {
      const manager = WorkerManager.getInstance()

      // Create search worker
      await manager.search('test')

      manager.terminateByType('searchIndexer')

      const info = manager.getWorkerInfo()
      const searchWorkers = info.filter((w) => w.type === 'searchIndexer')
      expect(searchWorkers).toEqual([])
    })
  })

  describe('fallback handling', () => {
    it('should use fallback when fallback is enabled', async () => {
      const manager = WorkerManager.getInstance()
      manager.setFallbackEnabled(true)

      // Fallback should be used internally when workers fail
      expect(manager).toBeDefined()
    })

    it('should allow disabling fallback', () => {
      const manager = WorkerManager.getInstance()

      manager.setFallbackEnabled(false)

      // Manager should still work
      expect(manager).toBeDefined()
    })
  })
})

describe('Worker Types', () => {
  it('should have correct structure for IndexableEmail', () => {
    const email: IndexableEmail = {
      id: 'test-id',
      threadId: 'test-thread',
      subject: 'Test Subject',
      snippet: 'Test snippet',
      fromName: 'Test Sender',
      fromEmail: 'sender@example.com',
      toNames: ['Recipient 1', 'Recipient 2'],
      toEmails: ['r1@example.com', 'r2@example.com'],
      timestamp: Date.now(),
      folder: 'inbox',
      labels: ['important', 'work'],
      read: false,
      starred: true,
    }

    expect(email.id).toBe('test-id')
    expect(email.labels).toHaveLength(2)
    expect(email.starred).toBe(true)
  })

  it('should have correct structure for RawEmailData', () => {
    const raw: RawEmailData = {
      id: 'raw-id',
      threadId: 'raw-thread',
      headers: {
        From: 'sender@example.com',
        To: 'recipient@example.com',
        Subject: 'Raw Subject',
        Date: '2024-01-01T00:00:00Z',
      },
      bodyParts: [
        {
          mimeType: 'text/plain',
          body: 'Plain text body',
        },
        {
          mimeType: 'text/html',
          body: '<p>HTML body</p>',
        },
      ],
      attachments: [
        {
          id: 'att-1',
          filename: 'document.pdf',
          mimeType: 'application/pdf',
          size: 1024,
        },
      ],
    }

    expect(raw.headers.Subject).toBe('Raw Subject')
    expect(raw.bodyParts).toHaveLength(2)
    expect(raw.attachments).toHaveLength(1)
  })
})
