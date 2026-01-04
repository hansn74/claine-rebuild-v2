/**
 * Email Attribute Service Tests
 *
 * Story 2.14: Apply Attributes to Emails - UI & Interaction
 * Task 2.4: Write unit tests for email attribute service
 *
 * Tests for setting, getting, and removing attributes on emails.
 * Follows patterns from attributeService.test.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createRxDatabase, addRxPlugin, type RxDatabase } from 'rxdb'
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie'
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv'
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode'
import { RxDBUpdatePlugin } from 'rxdb/plugins/update'
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder'
import { emailSchema, type EmailDocument } from '@/services/database/schemas/email.schema'
import { attributeSchema } from '@/services/database/schemas/attribute.schema'
import { EmailAttributeService } from '../emailAttributeService'

// Add required plugins
addRxPlugin(RxDBDevModePlugin)
addRxPlugin(RxDBUpdatePlugin)
addRxPlugin(RxDBQueryBuilderPlugin)

// Mock the database getter
vi.mock('@/services/database/init', () => ({
  getDatabase: vi.fn(),
}))

// Get the mocked function
import { getDatabase } from '@/services/database/init'
const mockGetDatabase = vi.mocked(getDatabase)

/**
 * Create a valid test email document
 */
function createTestEmail(overrides: Partial<EmailDocument> = {}): EmailDocument {
  return {
    id: `email-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    threadId: 'thread-1',
    from: { name: 'Sender', email: 'sender@example.com' },
    to: [{ name: 'Recipient', email: 'recipient@example.com' }],
    subject: 'Test Email',
    body: { text: 'Test body', html: '<p>Test body</p>' },
    timestamp: Date.now(),
    accountId: 'account-1',
    attachments: [],
    snippet: 'Test body',
    labels: ['INBOX'],
    folder: 'INBOX',
    read: false,
    starred: false,
    importance: 'normal',
    attributes: {},
    ...overrides,
  }
}

describe('EmailAttributeService', () => {
  let db: RxDatabase
  let service: EmailAttributeService

  beforeEach(async () => {
    // Reset singleton for clean test
    EmailAttributeService.__resetForTesting()

    // Create a fresh test database
    db = await createRxDatabase({
      name: `test-email-attr-service-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      storage: wrappedValidateAjvStorage({ storage: getRxStorageDexie() }),
      multiInstance: false,
      ignoreDuplicate: true,
    })

    // Add collections
    await db.addCollections({
      emails: { schema: emailSchema },
      attributes: { schema: attributeSchema },
    })

    // Mock getDatabase to return our test database
    mockGetDatabase.mockReturnValue(db as ReturnType<typeof getDatabase>)

    // Get fresh service instance
    service = EmailAttributeService.getInstance()
  })

  afterEach(async () => {
    vi.clearAllMocks()
    if (db && !db.destroyed) {
      await db.remove()
    }
  })

  describe('setEmailAttribute', () => {
    it('should set a single attribute on an email', async () => {
      const email = createTestEmail()
      await db.emails.insert(email)

      const result = await service.setEmailAttribute(email.id, 'priority', 'high')

      expect(result.success).toBe(true)
      expect(result.attributes['priority']).toBe('high')
      expect(result.previousAttributes).toEqual({})
    })

    it('should set string attribute value', async () => {
      const email = createTestEmail()
      await db.emails.insert(email)

      const result = await service.setEmailAttribute(email.id, 'project', 'Alpha')

      expect(result.success).toBe(true)
      expect(result.attributes['project']).toBe('Alpha')
    })

    it('should set number attribute value', async () => {
      const email = createTestEmail()
      await db.emails.insert(email)

      const result = await service.setEmailAttribute(email.id, 'hours', 5.5)

      expect(result.success).toBe(true)
      expect(result.attributes['hours']).toBe(5.5)
    })

    it('should set boolean attribute value', async () => {
      const email = createTestEmail()
      await db.emails.insert(email)

      const result = await service.setEmailAttribute(email.id, 'urgent', true)

      expect(result.success).toBe(true)
      expect(result.attributes['urgent']).toBe(true)
    })

    it('should set null attribute value', async () => {
      const email = createTestEmail({ attributes: { priority: 'high' } })
      await db.emails.insert(email)

      const result = await service.setEmailAttribute(email.id, 'priority', null)

      expect(result.success).toBe(true)
      expect(result.attributes['priority']).toBe(null)
    })

    it('should preserve existing attributes when adding new one', async () => {
      const email = createTestEmail({ attributes: { existing: 'value' } })
      await db.emails.insert(email)

      const result = await service.setEmailAttribute(email.id, 'new', 'attribute')

      expect(result.success).toBe(true)
      expect(result.attributes['existing']).toBe('value')
      expect(result.attributes['new']).toBe('attribute')
    })

    it('should update existing attribute value', async () => {
      const email = createTestEmail({ attributes: { priority: 'low' } })
      await db.emails.insert(email)

      const result = await service.setEmailAttribute(email.id, 'priority', 'high')

      expect(result.success).toBe(true)
      expect(result.attributes['priority']).toBe('high')
      expect(result.previousAttributes['priority']).toBe('low')
    })

    it('should fail for non-existent email', async () => {
      const result = await service.setEmailAttribute('non-existent', 'attr', 'value')

      expect(result.success).toBe(false)
      expect(result.error).toContain('not found')
    })

    it('should persist attribute to database', async () => {
      const email = createTestEmail()
      await db.emails.insert(email)

      await service.setEmailAttribute(email.id, 'priority', 'high')

      // Verify by reading directly from database
      const doc = await db.emails.findOne(email.id).exec()
      expect(doc?.attributes['priority']).toBe('high')
    })
  })

  describe('setEmailAttributes', () => {
    it('should set multiple attributes at once', async () => {
      const email = createTestEmail()
      await db.emails.insert(email)

      const result = await service.setEmailAttributes(email.id, {
        priority: 'high',
        status: 'in-progress',
        hours: 3,
      })

      expect(result.success).toBe(true)
      expect(result.attributes['priority']).toBe('high')
      expect(result.attributes['status']).toBe('in-progress')
      expect(result.attributes['hours']).toBe(3)
    })

    it('should merge with existing attributes', async () => {
      const email = createTestEmail({ attributes: { existing: 'keep' } })
      await db.emails.insert(email)

      const result = await service.setEmailAttributes(email.id, {
        new1: 'value1',
        new2: 'value2',
      })

      expect(result.success).toBe(true)
      expect(result.attributes['existing']).toBe('keep')
      expect(result.attributes['new1']).toBe('value1')
      expect(result.attributes['new2']).toBe('value2')
    })

    it('should override existing values', async () => {
      const email = createTestEmail({ attributes: { priority: 'low', status: 'todo' } })
      await db.emails.insert(email)

      const result = await service.setEmailAttributes(email.id, {
        priority: 'high',
      })

      expect(result.success).toBe(true)
      expect(result.attributes['priority']).toBe('high')
      expect(result.attributes['status']).toBe('todo')
      expect(result.previousAttributes['priority']).toBe('low')
    })

    it('should fail for non-existent email', async () => {
      const result = await service.setEmailAttributes('non-existent', { attr: 'value' })

      expect(result.success).toBe(false)
      expect(result.error).toContain('not found')
    })
  })

  describe('removeEmailAttribute', () => {
    it('should remove an attribute from email', async () => {
      const email = createTestEmail({ attributes: { priority: 'high', status: 'todo' } })
      await db.emails.insert(email)

      const result = await service.removeEmailAttribute(email.id, 'priority')

      expect(result.success).toBe(true)
      expect(result.attributes['priority']).toBeUndefined()
      expect(result.attributes['status']).toBe('todo')
    })

    it('should preserve other attributes when removing one', async () => {
      const email = createTestEmail({
        attributes: { attr1: 'v1', attr2: 'v2', attr3: 'v3' },
      })
      await db.emails.insert(email)

      const result = await service.removeEmailAttribute(email.id, 'attr2')

      expect(result.success).toBe(true)
      expect(result.attributes['attr1']).toBe('v1')
      expect(result.attributes['attr2']).toBeUndefined()
      expect(result.attributes['attr3']).toBe('v3')
    })

    it('should succeed when attribute does not exist', async () => {
      const email = createTestEmail({ attributes: {} })
      await db.emails.insert(email)

      const result = await service.removeEmailAttribute(email.id, 'nonexistent')

      expect(result.success).toBe(true)
    })

    it('should fail for non-existent email', async () => {
      const result = await service.removeEmailAttribute('non-existent', 'attr')

      expect(result.success).toBe(false)
      expect(result.error).toContain('not found')
    })

    it('should provide previous attributes in result', async () => {
      const email = createTestEmail({ attributes: { priority: 'high' } })
      await db.emails.insert(email)

      const result = await service.removeEmailAttribute(email.id, 'priority')

      expect(result.previousAttributes!['priority']).toBe('high')
    })
  })

  describe('getEmailAttributes', () => {
    it('should return all attributes for an email', async () => {
      const email = createTestEmail({
        attributes: { priority: 'high', status: 'todo', hours: 5 },
      })
      await db.emails.insert(email)

      const result = await service.getEmailAttributes(email.id)

      expect(result['priority']).toBe('high')
      expect(result['status']).toBe('todo')
      expect(result['hours']).toBe(5)
    })

    it('should return empty object for email without attributes', async () => {
      const email = createTestEmail({ attributes: {} })
      await db.emails.insert(email)

      const result = await service.getEmailAttributes(email.id)

      expect(result).toEqual({})
    })

    it('should return empty object for non-existent email', async () => {
      const result = await service.getEmailAttributes('non-existent')

      expect(result).toEqual({})
    })
  })

  describe('getEmailsByAttribute', () => {
    it('should find emails with matching attribute value', async () => {
      const email1 = createTestEmail({ id: 'email-1', attributes: { priority: 'high' } })
      const email2 = createTestEmail({ id: 'email-2', attributes: { priority: 'high' } })
      const email3 = createTestEmail({ id: 'email-3', attributes: { priority: 'low' } })
      await db.emails.bulkInsert([email1, email2, email3])

      const result = await service.getEmailsByAttribute('priority', 'high')

      expect(result).toHaveLength(2)
      expect(result).toContain('email-1')
      expect(result).toContain('email-2')
      expect(result).not.toContain('email-3')
    })

    it('should return empty array when no matches', async () => {
      const email = createTestEmail({ attributes: { priority: 'low' } })
      await db.emails.insert(email)

      const result = await service.getEmailsByAttribute('priority', 'high')

      expect(result).toEqual([])
    })

    it('should match boolean values', async () => {
      const email1 = createTestEmail({ id: 'email-1', attributes: { urgent: true } })
      const email2 = createTestEmail({ id: 'email-2', attributes: { urgent: false } })
      await db.emails.bulkInsert([email1, email2])

      const result = await service.getEmailsByAttribute('urgent', true)

      expect(result).toHaveLength(1)
      expect(result).toContain('email-1')
    })

    it('should match number values', async () => {
      const email1 = createTestEmail({ id: 'email-1', attributes: { hours: 5 } })
      const email2 = createTestEmail({ id: 'email-2', attributes: { hours: 10 } })
      await db.emails.bulkInsert([email1, email2])

      const result = await service.getEmailsByAttribute('hours', 5)

      expect(result).toHaveLength(1)
      expect(result).toContain('email-1')
    })
  })

  describe('getEmailsWithAttribute', () => {
    it('should find all emails that have an attribute set', async () => {
      const email1 = createTestEmail({ id: 'email-1', attributes: { priority: 'high' } })
      const email2 = createTestEmail({ id: 'email-2', attributes: { priority: 'low' } })
      const email3 = createTestEmail({ id: 'email-3', attributes: { status: 'todo' } })
      await db.emails.bulkInsert([email1, email2, email3])

      const result = await service.getEmailsWithAttribute('priority')

      expect(result).toHaveLength(2)
      expect(result).toContain('email-1')
      expect(result).toContain('email-2')
      expect(result).not.toContain('email-3')
    })

    it('should exclude emails with null attribute value', async () => {
      const email1 = createTestEmail({ id: 'email-1', attributes: { priority: 'high' } })
      const email2 = createTestEmail({ id: 'email-2', attributes: { priority: null } })
      await db.emails.bulkInsert([email1, email2])

      const result = await service.getEmailsWithAttribute('priority')

      expect(result).toHaveLength(1)
      expect(result).toContain('email-1')
    })
  })

  describe('clearEmailAttributes', () => {
    it('should remove all attributes from email', async () => {
      const email = createTestEmail({
        attributes: { priority: 'high', status: 'todo', hours: 5 },
      })
      await db.emails.insert(email)

      const result = await service.clearEmailAttributes(email.id)

      expect(result.success).toBe(true)
      expect(result.attributes).toEqual({})
      expect(result.previousAttributes).toEqual({ priority: 'high', status: 'todo', hours: 5 })
    })

    it('should succeed when email has no attributes', async () => {
      const email = createTestEmail({ attributes: {} })
      await db.emails.insert(email)

      const result = await service.clearEmailAttributes(email.id)

      expect(result.success).toBe(true)
      expect(result.attributes).toEqual({})
    })

    it('should fail for non-existent email', async () => {
      const result = await service.clearEmailAttributes('non-existent')

      expect(result.success).toBe(false)
      expect(result.error).toContain('not found')
    })
  })

  describe('rollbackAttributes', () => {
    it('should restore previous attributes', async () => {
      const email = createTestEmail({ attributes: { modified: 'value' } })
      await db.emails.insert(email)

      const previousAttributes = { original: 'value' }
      const result = await service.rollbackAttributes(email.id, previousAttributes)

      expect(result.success).toBe(true)
      expect(result.attributes).toEqual(previousAttributes)

      // Verify in database
      const doc = await db.emails.findOne(email.id).exec()
      expect(doc?.attributes).toEqual(previousAttributes)
    })

    it('should fail for non-existent email', async () => {
      const result = await service.rollbackAttributes('non-existent', {})

      expect(result.success).toBe(false)
      expect(result.error).toContain('not found')
    })
  })

  describe('events', () => {
    it('should emit attribute-set event', async () => {
      const email = createTestEmail()
      await db.emails.insert(email)

      const events: unknown[] = []
      const subscription = service.getEvents$().subscribe((event) => events.push(event))

      await service.setEmailAttribute(email.id, 'priority', 'high')

      subscription.unsubscribe()

      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        type: 'attribute-set',
        emailId: email.id,
        attributeId: 'priority',
        value: 'high',
      })
    })

    it('should emit attribute-removed event', async () => {
      const email = createTestEmail({ attributes: { priority: 'high' } })
      await db.emails.insert(email)

      const events: unknown[] = []
      const subscription = service.getEvents$().subscribe((event) => events.push(event))

      await service.removeEmailAttribute(email.id, 'priority')

      subscription.unsubscribe()

      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        type: 'attribute-removed',
        emailId: email.id,
        attributeId: 'priority',
      })
    })

    it('should emit attributes-set event for bulk update', async () => {
      const email = createTestEmail()
      await db.emails.insert(email)

      const events: unknown[] = []
      const subscription = service.getEvents$().subscribe((event) => events.push(event))

      await service.setEmailAttributes(email.id, { a: '1', b: '2' })

      subscription.unsubscribe()

      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        type: 'attributes-set',
        emailId: email.id,
      })
    })

    it('should emit attribute-error event on failure', async () => {
      const events: unknown[] = []
      const subscription = service.getEvents$().subscribe((event) => events.push(event))

      await service.setEmailAttribute('non-existent', 'attr', 'value')

      subscription.unsubscribe()

      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        type: 'attribute-error',
        emailId: 'non-existent',
      })
    })
  })

  describe('singleton', () => {
    it('should return same instance', () => {
      const instance1 = EmailAttributeService.getInstance()
      const instance2 = EmailAttributeService.getInstance()

      expect(instance1).toBe(instance2)
    })
  })
})
