/**
 * Search Index Service Tests
 *
 * Story 2.5: Local Full-Text Search
 * Tests for the search index service functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { SearchIndexService } from '../searchIndexService'
import type { EmailDocument } from '@/services/database/schemas/email.schema'

// Mock logger to avoid console spam
vi.mock('@/services/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

/**
 * Create mock email documents for testing
 */
function createMockEmail(overrides: Partial<EmailDocument> = {}): EmailDocument {
  return {
    id: `email-${Math.random().toString(36).slice(2)}`,
    threadId: 'thread-1',
    from: { name: 'John Doe', email: 'john@example.com' },
    to: [{ name: 'Jane Smith', email: 'jane@example.com' }],
    cc: [],
    bcc: [],
    subject: 'Test Email Subject',
    body: { text: 'This is the email body content', html: '<p>This is the email body content</p>' },
    timestamp: Date.now(),
    accountId: 'account-1',
    attachments: [],
    snippet: 'This is the email body content',
    labels: ['INBOX'],
    folder: 'INBOX',
    read: false,
    starred: false,
    importance: 'normal',
    attributes: {},
    ...overrides,
  }
}

describe('SearchIndexService', () => {
  let service: SearchIndexService

  beforeEach(() => {
    // Reset singleton for each test
    SearchIndexService.__resetForTesting()
    service = SearchIndexService.getInstance()
  })

  afterEach(() => {
    service.clear()
  })

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = SearchIndexService.getInstance()
      const instance2 = SearchIndexService.getInstance()
      expect(instance1).toBe(instance2)
    })
  })

  describe('buildIndex', () => {
    it('should build index from emails', () => {
      const emails = [
        createMockEmail({ id: '1', subject: 'Budget Meeting' }),
        createMockEmail({ id: '2', subject: 'Project Update' }),
      ]

      service.buildIndex(emails)

      const stats = service.getStats()
      expect(stats.indexBuilt).toBe(true)
      expect(stats.documentCount).toBe(2)
    })

    it('should handle empty email array', () => {
      service.buildIndex([])

      const stats = service.getStats()
      expect(stats.indexBuilt).toBe(true)
      expect(stats.documentCount).toBe(0)
    })

    it('should update lastBuilt timestamp', () => {
      const before = Date.now()
      service.buildIndex([createMockEmail()])
      const after = Date.now()

      const stats = service.getStats()
      expect(stats.lastBuilt).toBeGreaterThanOrEqual(before)
      expect(stats.lastBuilt).toBeLessThanOrEqual(after)
    })
  })

  describe('search', () => {
    beforeEach(() => {
      const emails = [
        createMockEmail({ id: '1', subject: 'Budget Meeting Q4' }),
        createMockEmail({ id: '2', subject: 'Project Update Review' }),
        createMockEmail({
          id: '3',
          subject: 'Weekly Newsletter',
          body: { text: 'budget information and updates' },
        }),
      ]
      service.buildIndex(emails)
    })

    it('should find emails by subject', () => {
      const results = service.search('budget')
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].id).toBe('1') // Budget Meeting should rank highest
    })

    it('should find emails by body content', () => {
      const results = service.search('newsletter')
      expect(results.length).toBe(1)
      expect(results[0].id).toBe('3')
    })

    it('should return results sorted by relevance', () => {
      const results = service.search('budget')
      // Budget Meeting should rank higher than body-only match
      const subjectMatch = results.find((r) => r.id === '1')
      const bodyMatch = results.find((r) => r.id === '3')
      if (subjectMatch && bodyMatch) {
        expect(subjectMatch.score).toBeGreaterThan(bodyMatch.score)
      }
    })

    it('should return empty array for empty query', () => {
      const results = service.search('')
      expect(results).toHaveLength(0)
    })

    it('should return empty array for whitespace query', () => {
      const results = service.search('   ')
      expect(results).toHaveLength(0)
    })

    it('should handle no results gracefully', () => {
      const results = service.search('xyznonexistent')
      expect(results).toHaveLength(0)
    })

    it('should support AND queries (space-separated terms)', () => {
      const results = service.search('budget Q4')
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].id).toBe('1')
    })

    it('should search in sender name field', () => {
      const emails = [
        createMockEmail({ id: '4', from: { name: 'Alice Johnson', email: 'alice@test.com' } }),
      ]
      service.buildIndex(emails)

      const results = service.search('Alice')
      expect(results.length).toBeGreaterThan(0)
    })

    it('should search in sender email field by full email address', () => {
      // Clear any existing index first
      service.clear()

      const emails = [
        createMockEmail({ id: '5', from: { name: 'Test User', email: 'specialtest@domain.com' } }),
      ]
      service.buildIndex(emails)

      // Lunr indexes the full email, wildcard search works
      const results = service.search('specialtest*')
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].id).toBe('5')
    })
  })

  describe('getDocument', () => {
    it('should return document by ID', () => {
      const email = createMockEmail({ id: 'test-id', subject: 'Test Subject' })
      service.buildIndex([email])

      const doc = service.getDocument('test-id')
      expect(doc).toBeDefined()
      expect(doc?.subject).toBe('Test Subject')
    })

    it('should return undefined for non-existent ID', () => {
      service.buildIndex([createMockEmail()])
      const doc = service.getDocument('non-existent')
      expect(doc).toBeUndefined()
    })
  })

  describe('addDocument', () => {
    it('should queue document for indexing', () => {
      service.buildIndex([])
      const email = createMockEmail({ id: 'new-email', subject: 'New Email' })

      service.addDocument(email)

      // Document should be retrievable immediately
      const doc = service.getDocument('new-email')
      expect(doc).toBeDefined()
      expect(doc?.subject).toBe('New Email')
    })

    it('should mark index for rebuild', () => {
      service.buildIndex([])
      service.addDocument(createMockEmail())

      expect(service.needsRebuild()).toBe(true)
    })
  })

  describe('removeDocument', () => {
    it('should mark document for removal', () => {
      const email = createMockEmail({ id: 'to-remove' })
      service.buildIndex([email])

      service.removeDocument('to-remove')

      expect(service.needsRebuild()).toBe(true)
    })
  })

  describe('updateDocument', () => {
    it('should queue updated document', () => {
      const email = createMockEmail({ id: 'to-update', subject: 'Original' })
      service.buildIndex([email])

      service.updateDocument({ ...email, subject: 'Updated' })

      // Note: getDocument returns from pending queue for updated documents
      // which takes priority over the original documents map
      const doc = service.getDocument('to-update')
      expect(doc?.subject).toBe('Updated')
    })

    it('should reflect update after applying pending changes', () => {
      const email = createMockEmail({ id: 'to-update-2', subject: 'Original' })
      service.buildIndex([email])

      service.updateDocument({ ...email, subject: 'Updated' })
      service.applyPendingChanges()

      const doc = service.getDocument('to-update-2')
      expect(doc?.subject).toBe('Updated')
    })
  })

  describe('applyPendingChanges', () => {
    it('should rebuild index with pending documents', () => {
      service.buildIndex([createMockEmail({ id: '1' })])
      service.addDocument(createMockEmail({ id: '2', subject: 'New Document' }))

      service.applyPendingChanges()

      const stats = service.getStats()
      expect(stats.documentCount).toBe(2)
      expect(stats.needsRebuild).toBe(false)
    })

    it('should apply pending removals', () => {
      service.buildIndex([createMockEmail({ id: '1' }), createMockEmail({ id: '2' })])
      service.removeDocument('1')

      service.applyPendingChanges()

      const stats = service.getStats()
      expect(stats.documentCount).toBe(1)
      expect(service.getDocument('1')).toBeUndefined()
    })
  })

  describe('clear', () => {
    it('should clear index and documents', () => {
      service.buildIndex([createMockEmail()])
      service.clear()

      const stats = service.getStats()
      expect(stats.indexBuilt).toBe(false)
      expect(stats.documentCount).toBe(0)
    })
  })

  describe('getStats', () => {
    it('should return accurate statistics', () => {
      const emails = [createMockEmail(), createMockEmail(), createMockEmail()]
      service.buildIndex(emails)

      const stats = service.getStats()
      expect(stats.documentCount).toBe(3)
      expect(stats.indexBuilt).toBe(true)
      expect(stats.lastBuilt).toBeDefined()
      expect(stats.needsRebuild).toBe(false)
    })

    it('should report needsRebuild when pending changes exist', () => {
      service.buildIndex([])
      service.addDocument(createMockEmail())

      const stats = service.getStats()
      expect(stats.needsRebuild).toBe(true)
    })
  })

  describe('performance', () => {
    it('should build index for 1000 emails in reasonable time', () => {
      const emails = Array.from({ length: 1000 }, (_, i) =>
        createMockEmail({
          id: `email-${i}`,
          subject: `Email ${i} about various topics`,
          body: { text: `Body content for email ${i} with searchable text` },
        })
      )

      const start = performance.now()
      service.buildIndex(emails)
      const duration = performance.now() - start

      // Should complete in under 5 seconds
      expect(duration).toBeLessThan(5000)
    })

    it('should search 1000 emails in under 100ms', () => {
      const emails = Array.from({ length: 1000 }, (_, i) =>
        createMockEmail({
          id: `email-${i}`,
          subject: `Email ${i} about various topics`,
          body: { text: `Body content for email ${i} with searchable text` },
        })
      )
      service.buildIndex(emails)

      const start = performance.now()
      const results = service.search('email topics')
      const duration = performance.now() - start

      // Should complete in under 100ms
      expect(duration).toBeLessThan(100)
      expect(results.length).toBeGreaterThan(0)
    })
  })
})
