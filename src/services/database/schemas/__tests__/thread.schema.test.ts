import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createRxDatabase, addRxPlugin, type RxDatabase } from 'rxdb'
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie'
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv'
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode'
import { threadSchema, type ThreadDocument } from '../thread.schema'

addRxPlugin(RxDBDevModePlugin)

describe('Thread Schema', () => {
  let db: RxDatabase

  beforeEach(async () => {
    db = await createRxDatabase({
      name: `test-thread-schema-${Date.now()}`,
      storage: wrappedValidateAjvStorage({ storage: getRxStorageDexie() }),
      multiInstance: false,
      ignoreDuplicate: true,
    })

    await db.addCollections({
      threads: {
        schema: threadSchema,
      },
    })
  })

  afterEach(async () => {
    if (db) {
      await db.remove()
    }
  })

  describe('Required Fields', () => {
    it('should validate required fields are present', async () => {
      const validThread: ThreadDocument = {
        id: 'test-thread-1',
        subject: 'Test Conversation',
        participants: [
          { name: 'User One', email: 'user1@example.com' },
          { name: 'User Two', email: 'user2@example.com' },
        ],
        messageCount: 5,
        lastMessageDate: Date.now(),
        snippet: 'Latest message preview',
        read: false,
        accountId: 'account-1',
      }

      const doc = await db.threads.insert(validThread)
      expect(doc.id).toBe('test-thread-1')
      expect(doc.participants.length).toBe(2)
      expect(doc.participants[0].email).toBe('user1@example.com')
    })

    it('should reject thread missing required field (subject)', async () => {
      const invalidThread = {
        id: 'test-thread-2',
        // Missing 'subject'
        participants: [{ name: 'User', email: 'user1@example.com' }],
        messageCount: 1,
        lastMessageDate: Date.now(),
        snippet: 'Test',
        read: false,
        accountId: 'account-1',
      }

      await expect(db.threads.insert(invalidThread)).rejects.toThrow()
    })
  })

  describe('Participants Array', () => {
    it('should accept multiple EmailAddress objects in participants', async () => {
      const thread: ThreadDocument = {
        id: 'test-thread-3',
        subject: 'Group Discussion',
        participants: [
          { name: 'Alice Smith', email: 'alice@example.com' },
          { name: 'Bob Jones', email: 'bob@example.com' },
          { name: 'Charlie Brown', email: 'charlie@example.com' },
          { name: 'Dave Wilson', email: 'dave@example.com' },
        ],
        messageCount: 12,
        lastMessageDate: Date.now(),
        snippet: 'Recent message',
        read: true,
        accountId: 'account-1',
      }

      const doc = await db.threads.insert(thread)
      expect(doc.participants.length).toBe(4)
      expect(doc.participants[0]).toEqual({ name: 'Alice Smith', email: 'alice@example.com' })
    })

    it('should accept single participant', async () => {
      const thread: ThreadDocument = {
        id: 'test-thread-4',
        subject: 'Solo Thread',
        participants: [{ name: 'Single User', email: 'single@example.com' }],
        messageCount: 1,
        lastMessageDate: Date.now(),
        snippet: 'Solo message',
        read: false,
        accountId: 'account-1',
      }

      const doc = await db.threads.insert(thread)
      expect(doc.participants.length).toBe(1)
      expect(doc.participants[0].name).toBe('Single User')
    })
  })

  describe('Field Constraints', () => {
    it('should enforce messageCount minimum of 1', async () => {
      const invalidThread = {
        id: 'test-thread-5',
        subject: 'Test',
        participants: [{ name: 'User', email: 'user@example.com' }],
        messageCount: 0, // Invalid: minimum is 1
        lastMessageDate: Date.now(),
        snippet: 'Test',
        read: false,
        accountId: 'account-1',
      }

      await expect(db.threads.insert(invalidThread)).rejects.toThrow()
    })

    it('should accept valid read boolean values', async () => {
      const thread1: ThreadDocument = {
        id: 'test-thread-6',
        subject: 'Read Thread',
        participants: [{ name: 'User', email: 'user@example.com' }],
        messageCount: 3,
        lastMessageDate: Date.now(),
        snippet: 'Test',
        read: true,
        accountId: 'account-1',
      }

      const thread2: ThreadDocument = {
        id: 'test-thread-7',
        subject: 'Unread Thread',
        participants: [{ name: 'User', email: 'user@example.com' }],
        messageCount: 2,
        lastMessageDate: Date.now(),
        snippet: 'Test',
        read: false,
        accountId: 'account-1',
      }

      const doc1 = await db.threads.insert(thread1)
      const doc2 = await db.threads.insert(thread2)

      expect(doc1.read).toBe(true)
      expect(doc2.read).toBe(false)
    })
  })

  describe('Provider-Specific Fields', () => {
    it('should accept optional historyId for Gmail sync', async () => {
      const thread: ThreadDocument = {
        id: 'test-thread-8',
        subject: 'Thread with historyId',
        participants: [{ name: 'User', email: 'user@example.com' }],
        messageCount: 3,
        lastMessageDate: Date.now(),
        snippet: 'Test',
        read: false,
        accountId: 'account-1',
        historyId: '54321',
      }

      const doc = await db.threads.insert(thread)
      expect(doc.historyId).toBe('54321')
    })
  })

  describe('Indexes', () => {
    it('should have lastMessageDate index for sorting', () => {
      const indexes = threadSchema.indexes || []
      expect(indexes).toContain('lastMessageDate')
    })

    it('should have compound index for multi-account', () => {
      const indexes = threadSchema.indexes || []
      const hasCompoundIndex = indexes.some(
        (idx) => Array.isArray(idx) && idx.includes('accountId') && idx.includes('lastMessageDate')
      )
      expect(hasCompoundIndex).toBe(true)
    })
  })
})
