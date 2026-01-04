import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createRxDatabase, addRxPlugin, type RxDatabase } from 'rxdb'
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie'
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv'
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode'
import {
  sendQueueSchema,
  type SendQueueDocument,
  type SendQueueStatus,
  type SendQueueType,
} from '../sendQueue.schema'

// Add dev mode plugin for validation
addRxPlugin(RxDBDevModePlugin)

describe('Send Queue Schema', () => {
  let db: RxDatabase

  beforeEach(async () => {
    // Create a test database with validation
    db = await createRxDatabase({
      name: `test-sendqueue-schema-${Date.now()}`,
      storage: wrappedValidateAjvStorage({ storage: getRxStorageDexie() }),
      multiInstance: false,
      ignoreDuplicate: true,
    })

    // Add sendQueue collection
    await db.addCollections({
      sendQueue: {
        schema: sendQueueSchema,
      },
    })
  })

  afterEach(async () => {
    if (db) {
      await db.remove()
    }
  })

  /**
   * Helper to create a valid send queue item
   */
  function createValidQueueItem(overrides: Partial<SendQueueDocument> = {}): SendQueueDocument {
    return {
      id: `send-${Date.now()}`,
      accountId: 'gmail:test@example.com',
      type: 'new' as SendQueueType,
      to: [{ name: 'Recipient', email: 'recipient@example.com' }],
      cc: [],
      bcc: [],
      subject: 'Test Subject',
      body: { html: '<p>Test body</p>', text: 'Test body' },
      attachments: [],
      status: 'pending' as SendQueueStatus,
      attempts: 0,
      maxAttempts: 3,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...overrides,
    }
  }

  describe('Required Fields', () => {
    it('should validate required fields are present', async () => {
      const validItem = createValidQueueItem()

      const doc = await db.sendQueue.insert(validItem)
      expect(doc.id).toBe(validItem.id)
      expect(doc.accountId).toBe('gmail:test@example.com')
      expect(doc.status).toBe('pending')
    })

    it('should reject item missing required field (accountId)', async () => {
      const invalidItem = {
        id: 'test-send-1',
        // Missing accountId
        type: 'new',
        to: [{ name: 'Recipient', email: 'recipient@example.com' }],
        cc: [],
        bcc: [],
        subject: 'Test Subject',
        body: { text: 'Test body' },
        attachments: [],
        status: 'pending',
        attempts: 0,
        maxAttempts: 3,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      await expect(db.sendQueue.insert(invalidItem)).rejects.toThrow()
    })
  })

  describe('Status Enum', () => {
    it('should accept valid status values', async () => {
      const statuses: SendQueueStatus[] = ['pending', 'sending', 'sent', 'failed', 'cancelled']

      for (const status of statuses) {
        const item = createValidQueueItem({
          id: `send-status-${status}-${Date.now()}`,
          status,
        })
        const doc = await db.sendQueue.insert(item)
        expect(doc.status).toBe(status)
      }
    })

    it('should reject invalid status value', async () => {
      const invalidItem = createValidQueueItem({
        status: 'invalid' as SendQueueStatus,
      })

      await expect(db.sendQueue.insert(invalidItem)).rejects.toThrow()
    })
  })

  describe('Type Enum', () => {
    it('should accept valid type values', async () => {
      const types: SendQueueType[] = ['new', 'reply', 'reply-all', 'forward']

      for (const type of types) {
        const item = createValidQueueItem({
          id: `send-type-${type}-${Date.now()}`,
          type,
        })
        const doc = await db.sendQueue.insert(item)
        expect(doc.type).toBe(type)
      }
    })
  })

  describe('Recipients', () => {
    it('should accept multiple recipients', async () => {
      const item = createValidQueueItem({
        to: [
          { name: 'Recipient 1', email: 'r1@example.com' },
          { name: 'Recipient 2', email: 'r2@example.com' },
        ],
        cc: [{ name: 'CC Recipient', email: 'cc@example.com' }],
        bcc: [{ name: 'BCC Recipient', email: 'bcc@example.com' }],
      })

      const doc = await db.sendQueue.insert(item)
      expect(doc.to.length).toBe(2)
      expect(doc.cc.length).toBe(1)
      expect(doc.bcc.length).toBe(1)
    })

    it('should accept empty recipient arrays', async () => {
      const item = createValidQueueItem({
        to: [],
        cc: [],
        bcc: [],
      })

      const doc = await db.sendQueue.insert(item)
      expect(doc.to.length).toBe(0)
    })
  })

  describe('Retry Tracking', () => {
    it('should track retry attempts', async () => {
      const item = createValidQueueItem({
        attempts: 2,
        maxAttempts: 3,
        lastAttemptAt: Date.now() - 5000,
        error: 'Network error',
      })

      const doc = await db.sendQueue.insert(item)
      expect(doc.attempts).toBe(2)
      expect(doc.maxAttempts).toBe(3)
      expect(doc.error).toBe('Network error')
    })
  })

  describe('Sent Message Tracking', () => {
    it('should store sent message details', async () => {
      const sentAt = Date.now()
      const item = createValidQueueItem({
        status: 'sent',
        sentAt,
        sentMessageId: 'gmail-message-123',
      })

      const doc = await db.sendQueue.insert(item)
      expect(doc.sentAt).toBe(sentAt)
      expect(doc.sentMessageId).toBe('gmail-message-123')
    })
  })

  describe('Attachments', () => {
    it('should store attachment metadata', async () => {
      const item = createValidQueueItem({
        attachments: [
          {
            id: 'attach-1',
            filename: 'document.pdf',
            mimeType: 'application/pdf',
            size: 12345,
          },
          {
            id: 'attach-2',
            filename: 'image.jpg',
            mimeType: 'image/jpeg',
            size: 54321,
            content: 'base64encodedcontent',
          },
        ],
      })

      const doc = await db.sendQueue.insert(item)
      expect(doc.attachments.length).toBe(2)
      expect(doc.attachments[0].filename).toBe('document.pdf')
      expect(doc.attachments[1].content).toBe('base64encodedcontent')
    })
  })

  describe('Indexes', () => {
    it('should query by status efficiently', async () => {
      // Insert items with different statuses
      const items = [
        createValidQueueItem({ id: 'q-1', status: 'pending' }),
        createValidQueueItem({ id: 'q-2', status: 'pending' }),
        createValidQueueItem({ id: 'q-3', status: 'sent' }),
        createValidQueueItem({ id: 'q-4', status: 'failed' }),
      ]

      for (const item of items) {
        await db.sendQueue.insert(item)
      }

      // Query pending items
      const pending = await db.sendQueue.find({ selector: { status: 'pending' } }).exec()
      expect(pending.length).toBe(2)

      // Query sent items
      const sent = await db.sendQueue.find({ selector: { status: 'sent' } }).exec()
      expect(sent.length).toBe(1)
    })

    it('should query by accountId efficiently', async () => {
      const items = [
        createValidQueueItem({ id: 'q-a1', accountId: 'gmail:user1@example.com' }),
        createValidQueueItem({ id: 'q-a2', accountId: 'gmail:user1@example.com' }),
        createValidQueueItem({ id: 'q-a3', accountId: 'outlook:user2@example.com' }),
      ]

      for (const item of items) {
        await db.sendQueue.insert(item)
      }

      const gmailItems = await db.sendQueue
        .find({ selector: { accountId: 'gmail:user1@example.com' } })
        .exec()
      expect(gmailItems.length).toBe(2)
    })
  })
})
