import { describe, it, expect, beforeEach } from 'vitest'
import {
  ConflictDetectionService,
  conflictDetectionService,
  type ConflictEmailData,
} from '../conflictDetection'

/**
 * Tests for Conflict Detection Service
 *
 * AC1: Conflict detected when local change timestamp > server change timestamp
 * AC2: Conflict detection runs on every sync operation
 * AC13: Test: Read status conflict → last-write-wins
 * AC14: Test: Labels conflict → merge (union)
 * AC15: Test: Body conflict → user prompt shown
 */

describe('ConflictDetectionService', () => {
  let service: ConflictDetectionService

  beforeEach(() => {
    service = new ConflictDetectionService()
  })

  const createEmailData = (overrides: Partial<ConflictEmailData> = {}): ConflictEmailData => ({
    id: 'test-email-1',
    timestamp: 1700000000000,
    subject: 'Test Subject',
    body: {
      html: '<p>Test body</p>',
      text: 'Test body',
    },
    read: false,
    starred: false,
    importance: 'normal',
    labels: ['INBOX'],
    attributes: {},
    ...overrides,
  })

  describe('detect', () => {
    it('should return "none" when server is newer and no local modifications', () => {
      const localEmail = createEmailData({ timestamp: 1700000000000 })
      const serverEmail = createEmailData({ timestamp: 1700000001000 })

      const result = service.detect(localEmail, serverEmail)

      expect(result.type).toBe('none')
    })

    it('should return "none" when local has no localModifiedAt', () => {
      const localEmail = createEmailData({ timestamp: 1700000000000 })
      const serverEmail = createEmailData({ timestamp: 1700000000000 })

      const result = service.detect(localEmail, serverEmail)

      expect(result.type).toBe('none')
    })

    it('should return "none" when server timestamp >= localModifiedAt', () => {
      const localEmail = createEmailData({
        timestamp: 1700000000000,
        localModifiedAt: 1700000001000,
      })
      const serverEmail = createEmailData({ timestamp: 1700000001000 })

      const result = service.detect(localEmail, serverEmail)

      expect(result.type).toBe('none')
    })

    describe('AC13: Metadata conflicts (read status)', () => {
      it('should detect metadata conflict when read status differs and local is newer', () => {
        const localEmail = createEmailData({
          read: true,
          localModifiedAt: 1700000002000,
        })
        const serverEmail = createEmailData({
          read: false,
          timestamp: 1700000001000,
        })

        const result = service.detect(localEmail, serverEmail)

        expect(result.type).toBe('metadata')
        expect(result.conflictingFields).toContain('read')
      })

      it('should detect metadata conflict when starred status differs', () => {
        const localEmail = createEmailData({
          starred: true,
          localModifiedAt: 1700000002000,
        })
        const serverEmail = createEmailData({
          starred: false,
          timestamp: 1700000001000,
        })

        const result = service.detect(localEmail, serverEmail)

        expect(result.type).toBe('metadata')
        expect(result.conflictingFields).toContain('starred')
      })

      it('should detect metadata conflict when importance differs', () => {
        const localEmail = createEmailData({
          importance: 'high',
          localModifiedAt: 1700000002000,
        })
        const serverEmail = createEmailData({
          importance: 'low',
          timestamp: 1700000001000,
        })

        const result = service.detect(localEmail, serverEmail)

        expect(result.type).toBe('metadata')
        expect(result.conflictingFields).toContain('importance')
      })

      it('should include multiple metadata fields when several differ', () => {
        const localEmail = createEmailData({
          read: true,
          starred: true,
          importance: 'high',
          localModifiedAt: 1700000002000,
        })
        const serverEmail = createEmailData({
          read: false,
          starred: false,
          importance: 'low',
          timestamp: 1700000001000,
        })

        const result = service.detect(localEmail, serverEmail)

        expect(result.type).toBe('metadata')
        expect(result.conflictingFields).toContain('read')
        expect(result.conflictingFields).toContain('starred')
        expect(result.conflictingFields).toContain('importance')
      })
    })

    describe('AC14: Label conflicts', () => {
      it('should detect label conflict when labels differ', () => {
        const localEmail = createEmailData({
          labels: ['INBOX', 'IMPORTANT'],
          localModifiedAt: 1700000002000,
        })
        const serverEmail = createEmailData({
          labels: ['INBOX', 'STARRED'],
          timestamp: 1700000001000,
        })

        const result = service.detect(localEmail, serverEmail)

        expect(result.type).toBe('labels')
        expect(result.conflictingFields).toContain('labels')
      })

      it('should detect label conflict when label count differs', () => {
        const localEmail = createEmailData({
          labels: ['INBOX', 'IMPORTANT', 'STARRED'],
          localModifiedAt: 1700000002000,
        })
        const serverEmail = createEmailData({
          labels: ['INBOX'],
          timestamp: 1700000001000,
        })

        const result = service.detect(localEmail, serverEmail)

        expect(result.type).toBe('labels')
      })

      it('should NOT detect label conflict when labels are identical', () => {
        const localEmail = createEmailData({
          labels: ['INBOX', 'IMPORTANT'],
          localModifiedAt: 1700000002000,
        })
        const serverEmail = createEmailData({
          labels: ['INBOX', 'IMPORTANT'],
          timestamp: 1700000001000,
        })

        const result = service.detect(localEmail, serverEmail)

        // No label conflict, but also no other conflicts, so 'none'
        expect(result.type).toBe('none')
      })
    })

    describe('AC15: Content conflicts (body/subject)', () => {
      it('should detect content conflict when subject differs', () => {
        const localEmail = createEmailData({
          subject: 'Local Subject',
          localModifiedAt: 1700000002000,
        })
        const serverEmail = createEmailData({
          subject: 'Server Subject',
          timestamp: 1700000001000,
        })

        const result = service.detect(localEmail, serverEmail)

        expect(result.type).toBe('content')
        expect(result.conflictingFields).toContain('subject')
      })

      it('should detect content conflict when body text differs', () => {
        const localEmail = createEmailData({
          body: { text: 'Local body text', html: '<p>Local body text</p>' },
          localModifiedAt: 1700000002000,
        })
        const serverEmail = createEmailData({
          body: { text: 'Server body text', html: '<p>Server body text</p>' },
          timestamp: 1700000001000,
        })

        const result = service.detect(localEmail, serverEmail)

        expect(result.type).toBe('content')
        expect(result.conflictingFields).toContain('body')
      })

      it('should detect content conflict when only HTML body differs', () => {
        const localEmail = createEmailData({
          body: { text: 'Same text', html: '<p>Local HTML</p>' },
          localModifiedAt: 1700000002000,
        })
        const serverEmail = createEmailData({
          body: { text: 'Same text', html: '<p>Server HTML</p>' },
          timestamp: 1700000001000,
        })

        const result = service.detect(localEmail, serverEmail)

        expect(result.type).toBe('content')
        expect(result.conflictingFields).toContain('body')
      })

      it('should prioritize content conflicts over metadata/label conflicts', () => {
        const localEmail = createEmailData({
          subject: 'Local Subject',
          read: true,
          labels: ['INBOX', 'LOCAL-LABEL'],
          localModifiedAt: 1700000002000,
        })
        const serverEmail = createEmailData({
          subject: 'Server Subject',
          read: false,
          labels: ['INBOX', 'SERVER-LABEL'],
          timestamp: 1700000001000,
        })

        const result = service.detect(localEmail, serverEmail)

        // Content conflicts take priority
        expect(result.type).toBe('content')
      })
    })

    it('should return correct timestamps in result', () => {
      const localEmail = createEmailData({
        timestamp: 1700000000000,
        localModifiedAt: 1700000002000,
        read: true,
      })
      const serverEmail = createEmailData({
        timestamp: 1700000001000,
        read: false,
      })

      const result = service.detect(localEmail, serverEmail)

      expect(result.localTimestamp).toBe(1700000002000)
      expect(result.serverTimestamp).toBe(1700000001000)
    })
  })

  describe('detectBatch', () => {
    it('should detect conflicts for multiple email pairs', () => {
      const pairs = [
        {
          local: createEmailData({ id: 'email-1', read: true, localModifiedAt: 1700000002000 }),
          server: createEmailData({ id: 'email-1', read: false, timestamp: 1700000001000 }),
        },
        {
          local: createEmailData({ id: 'email-2', timestamp: 1700000000000 }),
          server: createEmailData({ id: 'email-2', timestamp: 1700000001000 }),
        },
        {
          local: createEmailData({
            id: 'email-3',
            subject: 'Local',
            localModifiedAt: 1700000002000,
          }),
          server: createEmailData({ id: 'email-3', subject: 'Server', timestamp: 1700000001000 }),
        },
      ]

      const results = service.detectBatch(pairs)

      expect(results).toHaveLength(3)
      expect(results[0].emailId).toBe('email-1')
      expect(results[0].result.type).toBe('metadata')
      expect(results[1].emailId).toBe('email-2')
      expect(results[1].result.type).toBe('none')
      expect(results[2].emailId).toBe('email-3')
      expect(results[2].result.type).toBe('content')
    })
  })

  describe('toConflictData', () => {
    it('should convert EmailDocument to ConflictEmailData', () => {
      const emailDoc = {
        id: 'test-id',
        threadId: 'thread-1',
        from: { name: 'Test', email: 'test@example.com' },
        to: [],
        subject: 'Test Subject',
        body: { html: '<p>Test</p>', text: 'Test' },
        timestamp: 1700000000000,
        accountId: 'account-1',
        attachments: [],
        snippet: 'Test',
        labels: ['INBOX'],
        folder: 'INBOX',
        read: false,
        starred: true,
        importance: 'high' as const,
        attributes: { custom: 'value' },
      }

      const result = ConflictDetectionService.toConflictData(emailDoc, 1700000001000)

      expect(result.id).toBe('test-id')
      expect(result.subject).toBe('Test Subject')
      expect(result.read).toBe(false)
      expect(result.starred).toBe(true)
      expect(result.importance).toBe('high')
      expect(result.labels).toEqual(['INBOX'])
      expect(result.localModifiedAt).toBe(1700000001000)
    })
  })

  describe('singleton instance', () => {
    it('should export singleton instance', () => {
      expect(conflictDetectionService).toBeInstanceOf(ConflictDetectionService)
    })
  })
})
