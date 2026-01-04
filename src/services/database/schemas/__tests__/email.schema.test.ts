import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createRxDatabase, addRxPlugin, type RxDatabase } from 'rxdb'
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie'
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv'
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode'
import { emailSchema, type EmailDocument } from '../email.schema'

// Add dev mode plugin for validation
addRxPlugin(RxDBDevModePlugin)

describe('Email Schema', () => {
  let db: RxDatabase

  beforeEach(async () => {
    // Create a test database with validation
    db = await createRxDatabase({
      name: `test-email-schema-${Date.now()}`,
      storage: wrappedValidateAjvStorage({ storage: getRxStorageDexie() }),
      multiInstance: false,
      ignoreDuplicate: true,
    })

    // Add email collection
    await db.addCollections({
      emails: {
        schema: emailSchema,
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
      const validEmail: EmailDocument = {
        id: 'test-email-1',
        threadId: 'test-thread-1',
        from: { name: 'Test Sender', email: 'sender@example.com' },
        to: [{ name: 'Test Recipient', email: 'recipient@example.com' }],
        subject: 'Test Subject',
        body: { html: '<p>Test body content</p>', text: 'Test body content' },
        timestamp: Date.now(),
        accountId: 'account-1',
        attachments: [],
        snippet: 'Test body content',
        labels: ['INBOX'],
        folder: 'INBOX',
        read: false,
        starred: false,
        importance: 'normal',
        attributes: {},
      }

      const doc = await db.emails.insert(validEmail)
      expect(doc.id).toBe('test-email-1')
      expect(doc.from.email).toBe('sender@example.com')
      expect(doc.from.name).toBe('Test Sender')
    })

    it('should reject email missing required field (from)', async () => {
      const invalidEmail = {
        id: 'test-email-2',
        threadId: 'test-thread-1',
        // Missing 'from' field
        to: [{ name: 'Recipient', email: 'recipient@example.com' }],
        subject: 'Test Subject',
        body: { text: 'Test body' },
        timestamp: Date.now(),
        accountId: 'account-1',
        attachments: [],
        snippet: 'Test body',
        labels: [],
        folder: 'INBOX',
        read: false,
        starred: false,
        importance: 'normal',
        attributes: {},
      }

      await expect(db.emails.insert(invalidEmail)).rejects.toThrow()
    })
  })

  describe('Structured Email Addresses', () => {
    it('should validate EmailAddress objects with name and email', async () => {
      const email: EmailDocument = {
        id: 'test-email-3',
        threadId: 'test-thread-1',
        from: { name: 'John Doe', email: 'john.doe@example.com' },
        to: [
          { name: 'Jane Smith', email: 'jane@example.com' },
          { name: 'Bob Johnson', email: 'bob@company.com' },
        ],
        cc: [{ name: 'Manager', email: 'manager@example.com' }],
        bcc: [{ name: 'BCC User', email: 'bcc@example.com' }],
        subject: 'Test Subject',
        body: { html: '<p>Test</p>', text: 'Test' },
        timestamp: Date.now(),
        accountId: 'account-1',
        attachments: [],
        snippet: 'Test',
        labels: [],
        folder: 'INBOX',
        read: false,
        starred: false,
        importance: 'normal',
        attributes: {},
      }

      const doc = await db.emails.insert(email)
      expect(doc.from).toEqual({ name: 'John Doe', email: 'john.doe@example.com' })
      expect(doc.to.length).toBe(2)
      expect(doc.to[0]).toEqual({ name: 'Jane Smith', email: 'jane@example.com' })
      expect(doc.cc).toBeDefined()
      expect(doc.cc![0]).toEqual({ name: 'Manager', email: 'manager@example.com' })
    })

    it('should reject invalid EmailAddress object (missing email)', async () => {
      const invalidEmail = {
        id: 'test-email-4',
        threadId: 'test-thread-1',
        from: { name: 'Test' }, // Missing email field
        to: [{ name: 'Recipient', email: 'recipient@example.com' }],
        subject: 'Test',
        body: { text: 'Test' },
        timestamp: Date.now(),
        accountId: 'account-1',
        attachments: [],
        snippet: 'Test',
        labels: [],
        folder: 'INBOX',
        read: false,
        starred: false,
        importance: 'normal',
        attributes: {},
      }

      await expect(db.emails.insert(invalidEmail)).rejects.toThrow()
    })
  })

  describe('Email Body Structure', () => {
    it('should accept both HTML and text body formats', async () => {
      const email: EmailDocument = {
        id: 'test-email-5',
        threadId: 'test-thread-1',
        from: { name: 'Sender', email: 'sender@example.com' },
        to: [{ name: 'Recipient', email: 'recipient@example.com' }],
        subject: 'Test',
        body: {
          html: '<html><body><h1>Hello</h1><p>World</p></body></html>',
          text: 'Hello\nWorld',
        },
        timestamp: Date.now(),
        accountId: 'account-1',
        attachments: [],
        snippet: 'Hello World',
        labels: [],
        folder: 'INBOX',
        read: false,
        starred: false,
        importance: 'normal',
        attributes: {},
      }

      const doc = await db.emails.insert(email)
      expect(doc.body.html).toContain('<h1>Hello</h1>')
      expect(doc.body.text).toBe('Hello\nWorld')
    })

    it('should accept HTML-only body', async () => {
      const email: EmailDocument = {
        id: 'test-email-6',
        threadId: 'test-thread-1',
        from: { name: 'Sender', email: 'sender@example.com' },
        to: [{ name: 'Recipient', email: 'recipient@example.com' }],
        subject: 'Test',
        body: { html: '<p>HTML only</p>' },
        timestamp: Date.now(),
        accountId: 'account-1',
        attachments: [],
        snippet: 'HTML only',
        labels: [],
        folder: 'INBOX',
        read: false,
        starred: false,
        importance: 'normal',
        attributes: {},
      }

      const doc = await db.emails.insert(email)
      expect(doc.body.html).toBe('<p>HTML only</p>')
      expect(doc.body.text).toBeUndefined()
    })
  })

  describe('Attachments', () => {
    it('should accept attachment metadata', async () => {
      const email: EmailDocument = {
        id: 'test-email-7',
        threadId: 'test-thread-1',
        from: { name: 'Sender', email: 'sender@example.com' },
        to: [{ name: 'Recipient', email: 'recipient@example.com' }],
        subject: 'Test',
        body: { text: 'See attachment' },
        timestamp: Date.now(),
        accountId: 'account-1',
        attachments: [
          {
            id: 'attach-1',
            filename: 'document.pdf',
            mimeType: 'application/pdf',
            size: 1024000,
            isInline: false,
          },
          {
            id: 'attach-2',
            filename: 'image.png',
            mimeType: 'image/png',
            size: 50000,
            isInline: true,
            contentId: 'image001',
          },
        ],
        snippet: 'See attachment',
        labels: [],
        folder: 'INBOX',
        read: false,
        starred: false,
        importance: 'normal',
        attributes: {},
      }

      const doc = await db.emails.insert(email)
      expect(doc.attachments.length).toBe(2)
      expect(doc.attachments[0].filename).toBe('document.pdf')
      expect(doc.attachments[0].size).toBe(1024000)
      expect(doc.attachments[1].isInline).toBe(true)
      expect(doc.attachments[1].contentId).toBe('image001')
    })
  })

  describe('Custom Attributes', () => {
    it('should accept arbitrary key-value pairs in attributes', async () => {
      const email: EmailDocument = {
        id: 'test-email-8',
        threadId: 'test-thread-1',
        from: { name: 'Sender', email: 'sender@example.com' },
        to: [{ name: 'Recipient', email: 'recipient@example.com' }],
        subject: 'Test',
        body: { text: 'Test' },
        timestamp: Date.now(),
        accountId: 'account-1',
        attachments: [],
        snippet: 'Test',
        labels: [],
        folder: 'INBOX',
        read: false,
        starred: false,
        importance: 'normal',
        attributes: {
          Project: 'Alpha',
          Priority: 'High',
          Status: 'To-Do',
          DueDate: '2025-12-31',
          BillableHours: 5.5,
          IsUrgent: true,
          CustomNull: null,
        },
      }

      const doc = await db.emails.insert(email)
      expect(doc.attributes.Project).toBe('Alpha')
      expect(doc.attributes.Priority).toBe('High')
      expect(doc.attributes.BillableHours).toBe(5.5)
      expect(doc.attributes.IsUrgent).toBe(true)
      expect(doc.attributes.CustomNull).toBe(null)
    })
  })

  describe('AI Metadata', () => {
    it('should accept optional aiMetadata field', async () => {
      const email: EmailDocument = {
        id: 'test-email-9',
        threadId: 'test-thread-1',
        from: { name: 'Sender', email: 'sender@example.com' },
        to: [{ name: 'Recipient', email: 'recipient@example.com' }],
        subject: 'Test',
        body: { text: 'Test' },
        timestamp: Date.now(),
        accountId: 'account-1',
        attachments: [],
        snippet: 'Test',
        labels: [],
        folder: 'INBOX',
        read: false,
        starred: false,
        importance: 'normal',
        attributes: {},
        aiMetadata: {
          triageScore: 85,
          priority: 'high',
          suggestedAttributes: {
            Project: { value: 'Alpha', confidence: 90 },
          },
          confidence: 85,
          reasoning: 'Important project-related email',
          modelVersion: 'v1.0',
          processedAt: Date.now(),
        },
      }

      const doc = await db.emails.insert(email)
      expect(doc.aiMetadata?.triageScore).toBe(85)
      expect(doc.aiMetadata?.priority).toBe('high')
    })
  })

  describe('Provider-Specific Fields', () => {
    it('should accept optional historyId for Gmail sync', async () => {
      const email: EmailDocument = {
        id: 'test-email-10',
        threadId: 'test-thread-1',
        from: { name: 'Sender', email: 'sender@example.com' },
        to: [{ name: 'Recipient', email: 'recipient@example.com' }],
        subject: 'Test',
        body: { text: 'Test' },
        timestamp: Date.now(),
        accountId: 'account-1',
        attachments: [],
        snippet: 'Test',
        labels: [],
        folder: 'INBOX',
        read: false,
        starred: false,
        importance: 'normal',
        attributes: {},
        historyId: '12345',
      }

      const doc = await db.emails.insert(email)
      expect(doc.historyId).toBe('12345')
    })
  })

  describe('Indexes', () => {
    it('should have timestamp index for sorting', () => {
      const indexes = emailSchema.indexes || []
      expect(indexes).toContain('timestamp')
    })

    it('should have folder index for filtering', () => {
      const indexes = emailSchema.indexes || []
      expect(indexes).toContain('folder')
    })

    it('should have compound index for multi-account', () => {
      const indexes = emailSchema.indexes || []
      const hasCompoundIndex = indexes.some(
        (idx) => Array.isArray(idx) && idx.includes('accountId') && idx.includes('timestamp')
      )
      expect(hasCompoundIndex).toBe(true)
    })

    it('should have threadId index for thread grouping', () => {
      const indexes = emailSchema.indexes || []
      expect(indexes).toContain('threadId')
    })
  })
})
