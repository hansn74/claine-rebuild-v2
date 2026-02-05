/**
 * Search Index Service Tests
 *
 * Story 2.21: Replace Lunr.js with MiniSearch
 * Tests for the search index service functionality with MiniSearch
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
      // Budget Meeting should rank highest (subject boost: 10 vs body boost: 1)
      expect(results[0].id).toBe('1')
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

    it('should search in sender email field', () => {
      service.clear()

      const emails = [
        createMockEmail({ id: '5', from: { name: 'Test User', email: 'specialtest@domain.com' } }),
      ]
      service.buildIndex(emails)

      // MiniSearch prefix search matches "specialtest" prefix
      const results = service.search('specialtest')
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].id).toBe('5')
    })

    it('should return match and terms in results', () => {
      const results = service.search('budget')
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].match).toBeDefined()
      expect(results[0].terms).toBeDefined()
      expect(results[0].terms.length).toBeGreaterThan(0)
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

  describe('addDocument (incremental)', () => {
    it('should add document to index incrementally', () => {
      service.buildIndex([])
      const email = createMockEmail({ id: 'new-email', subject: 'New Email' })

      service.addDocument(email)

      // Document should be retrievable immediately
      const doc = service.getDocument('new-email')
      expect(doc).toBeDefined()
      expect(doc?.subject).toBe('New Email')

      // Document should be searchable immediately (no rebuild needed)
      const results = service.search('New Email')
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].id).toBe('new-email')
    })

    it('should add 50 documents incrementally without rebuild', () => {
      service.buildIndex([])

      for (let i = 0; i < 50; i++) {
        service.addDocument(createMockEmail({ id: `inc-${i}`, subject: `Incremental Email ${i}` }))
      }

      const stats = service.getStats()
      expect(stats.documentCount).toBe(50)

      // All should be searchable
      const results = service.search('Incremental')
      expect(results.length).toBe(50)
    })

    it('should not add document when index not initialized', () => {
      // No buildIndex called
      service.addDocument(createMockEmail({ id: 'no-index' }))
      expect(service.getDocument('no-index')).toBeUndefined()
    })
  })

  describe('removeDocument (discard)', () => {
    it('should remove document from index', () => {
      const email = createMockEmail({ id: 'to-remove', subject: 'Remove Me' })
      service.buildIndex([email])

      service.removeDocument('to-remove')

      // Document should no longer be retrievable
      expect(service.getDocument('to-remove')).toBeUndefined()
      expect(service.getStats().documentCount).toBe(0)

      // Document should no longer be searchable
      const results = service.search('Remove Me')
      expect(results).toHaveLength(0)
    })
  })

  describe('updateDocument (replace)', () => {
    it('should update document in index', () => {
      const email = createMockEmail({ id: 'to-update', subject: 'Original Subject' })
      service.buildIndex([email])

      service.updateDocument({ ...email, subject: 'Updated Subject' })

      const doc = service.getDocument('to-update')
      expect(doc?.subject).toBe('Updated Subject')

      // Should find by new subject
      const results = service.search('Updated Subject')
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].id).toBe('to-update')
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
    })
  })

  describe('fuzzy matching', () => {
    it('should find "meeting" when searching for "meetng" (typo)', () => {
      const emails = [
        createMockEmail({ id: 'meeting-email', subject: 'Important Meeting Tomorrow' }),
      ]
      service.buildIndex(emails)

      const results = service.search('meetng')
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].id).toBe('meeting-email')
    })

    it('should find "received" when searching for "recieved" (typo)', () => {
      const emails = [
        createMockEmail({
          id: 'received-email',
          body: { text: 'I received your email yesterday' },
        }),
      ]
      service.buildIndex(emails)

      const results = service.search('recieved')
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].id).toBe('received-email')
    })

    it('should rank exact matches above fuzzy matches', () => {
      const emails = [
        createMockEmail({ id: 'exact', subject: 'budget review' }),
        createMockEmail({ id: 'fuzzy', subject: 'budge review' }),
      ]
      service.buildIndex(emails)

      const results = service.search('budget')
      expect(results.length).toBe(2)
      // Exact match should score higher
      const exactMatch = results.find((r) => r.id === 'exact')
      const fuzzyMatch = results.find((r) => r.id === 'fuzzy')
      expect(exactMatch).toBeDefined()
      expect(fuzzyMatch).toBeDefined()
      if (exactMatch && fuzzyMatch) {
        expect(exactMatch.score).toBeGreaterThan(fuzzyMatch.score)
      }
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

    it('should search 10000 emails in under 100ms', () => {
      const emails = Array.from({ length: 10000 }, (_, i) =>
        createMockEmail({
          id: `email-${i}`,
          subject: `Email ${i} about various topics like budget and planning`,
          body: { text: `Body content for email ${i} discussing quarterly reviews and meetings` },
        })
      )
      service.buildIndex(emails)

      const start = performance.now()
      const results = service.search('budget quarterly')
      const duration = performance.now() - start

      expect(duration).toBeLessThan(100)
      expect(results.length).toBeGreaterThan(0)
    })
  })

  describe('regression: search results equivalent to Lunr for exact keywords', () => {
    it('should find exact keyword in subject', () => {
      const emails = [
        createMockEmail({ id: '1', subject: 'Budget Meeting Q4' }),
        createMockEmail({ id: '2', subject: 'Project Update' }),
      ]
      service.buildIndex(emails)

      const results = service.search('Budget')
      expect(results.length).toBe(1)
      expect(results[0].id).toBe('1')
    })

    it('should find exact keyword in body', () => {
      const emails = [
        createMockEmail({ id: '1', body: { text: 'quarterly financial report' } }),
        createMockEmail({ id: '2', body: { text: 'weekly status update' } }),
      ]
      service.buildIndex(emails)

      const results = service.search('financial')
      expect(results.length).toBe(1)
      expect(results[0].id).toBe('1')
    })

    it('should apply field boosts correctly (subject > body)', () => {
      const emails = [
        createMockEmail({
          id: 'subject-match',
          subject: 'Budget',
          body: { text: 'unrelated content' },
        }),
        createMockEmail({
          id: 'body-match',
          subject: 'Unrelated',
          body: { text: 'budget discussion' },
        }),
      ]
      service.buildIndex(emails)

      const results = service.search('budget')
      expect(results.length).toBe(2)
      expect(results[0].id).toBe('subject-match')
    })
  })
})
