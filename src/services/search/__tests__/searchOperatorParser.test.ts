/**
 * Search Operator Parser Tests
 *
 * Story 2.22: Search Operators for Structured Queries
 * Task 7: Comprehensive tests for operator parsing and filtering
 */

import { describe, it, expect } from 'vitest'
import {
  parseSearchOperators,
  matchesOperatorFilters,
  getOperatorSearchHints,
  KNOWN_OPERATORS,
} from '../searchOperatorParser'
import type { EmailDocument } from '@/services/database/schemas/email.schema'

/**
 * Helper to create a minimal EmailDocument for testing
 */
function createTestEmail(overrides: Partial<EmailDocument> = {}): EmailDocument {
  return {
    id: 'test-email-1',
    threadId: 'thread-1',
    from: { name: 'John Doe', email: 'john@example.com' },
    to: [{ name: 'Jane Smith', email: 'jane@example.com' }],
    subject: 'Test Email Subject',
    body: { text: 'Test email body content', html: '<p>Test email body content</p>' },
    timestamp: new Date('2025-06-15T10:00:00Z').getTime(),
    accountId: 'account-1',
    attachments: [],
    snippet: 'Test email body content',
    labels: ['important'],
    folder: 'inbox',
    read: false,
    starred: false,
    importance: 'normal' as const,
    attributes: {},
    ...overrides,
  }
}

describe('searchOperatorParser', () => {
  describe('parseSearchOperators', () => {
    it('parses from: operator', () => {
      const result = parseSearchOperators('from:john')
      expect(result.operators).toHaveLength(1)
      expect(result.operators[0]).toEqual({ type: 'from', value: 'john' })
      expect(result.textQuery).toBe('')
    })

    it('parses to: operator', () => {
      const result = parseSearchOperators('to:jane')
      expect(result.operators).toHaveLength(1)
      expect(result.operators[0]).toEqual({ type: 'to', value: 'jane' })
      expect(result.textQuery).toBe('')
    })

    it('parses has:attachment operator', () => {
      const result = parseSearchOperators('has:attachment')
      expect(result.operators).toHaveLength(1)
      expect(result.operators[0]).toEqual({ type: 'has', value: 'attachment' })
      expect(result.textQuery).toBe('')
    })

    it('parses before: date operator', () => {
      const result = parseSearchOperators('before:2025-01-01')
      expect(result.operators).toHaveLength(1)
      expect(result.operators[0]).toEqual({ type: 'before', value: '2025-01-01' })
      expect(result.textQuery).toBe('')
    })

    it('parses after: date operator', () => {
      const result = parseSearchOperators('after:2024-06-01')
      expect(result.operators).toHaveLength(1)
      expect(result.operators[0]).toEqual({ type: 'after', value: '2024-06-01' })
      expect(result.textQuery).toBe('')
    })

    it('parses in: folder operator', () => {
      const result = parseSearchOperators('in:inbox')
      expect(result.operators).toHaveLength(1)
      expect(result.operators[0]).toEqual({ type: 'in', value: 'inbox' })
      expect(result.textQuery).toBe('')
    })

    it('extracts remaining text query after operators (AC 3)', () => {
      const result = parseSearchOperators('from:john budget meeting')
      expect(result.operators).toHaveLength(1)
      expect(result.operators[0]).toEqual({ type: 'from', value: 'john' })
      expect(result.textQuery).toBe('budget meeting')
    })

    it('handles multiple operators combined with AND logic (AC 4)', () => {
      const result = parseSearchOperators('from:john has:attachment budget')
      expect(result.operators).toHaveLength(2)
      expect(result.operators[0]).toEqual({ type: 'from', value: 'john' })
      expect(result.operators[1]).toEqual({ type: 'has', value: 'attachment' })
      expect(result.textQuery).toBe('budget')
    })

    it('is case-insensitive for operator names (AC 5)', () => {
      const result = parseSearchOperators('FROM:john')
      expect(result.operators).toHaveLength(1)
      expect(result.operators[0]).toEqual({ type: 'from', value: 'john' })
      expect(result.textQuery).toBe('')
    })

    it('handles mixed case operators', () => {
      const result = parseSearchOperators('From:john To:jane')
      expect(result.operators).toHaveLength(2)
      expect(result.operators[0]).toEqual({ type: 'from', value: 'john' })
      expect(result.operators[1]).toEqual({ type: 'to', value: 'jane' })
    })

    it('supports quoted values for multi-word matches (AC 6)', () => {
      const result = parseSearchOperators('from:"John Smith"')
      expect(result.operators).toHaveLength(1)
      expect(result.operators[0]).toEqual({ type: 'from', value: 'John Smith' })
      expect(result.textQuery).toBe('')
    })

    it('supports single-quoted values', () => {
      const result = parseSearchOperators("from:'John Smith'")
      expect(result.operators).toHaveLength(1)
      expect(result.operators[0]).toEqual({ type: 'from', value: 'John Smith' })
    })

    it('treats unknown operators as regular keywords (AC 7)', () => {
      const result = parseSearchOperators('unknownop:value')
      expect(result.operators).toHaveLength(0)
      expect(result.textQuery).toBe('unknownop:value')
    })

    it('treats unknown operators alongside known ones correctly', () => {
      const result = parseSearchOperators('from:john unknownop:value budget')
      expect(result.operators).toHaveLength(1)
      expect(result.operators[0]).toEqual({ type: 'from', value: 'john' })
      expect(result.textQuery).toBe('unknownop:value budget')
    })

    it('handles empty query', () => {
      const result = parseSearchOperators('')
      expect(result.operators).toHaveLength(0)
      expect(result.textQuery).toBe('')
      expect(result.hasOperators).toBe(false)
    })

    it('handles text-only query (no operators)', () => {
      const result = parseSearchOperators('budget meeting Q4')
      expect(result.operators).toHaveLength(0)
      expect(result.textQuery).toBe('budget meeting Q4')
      expect(result.hasOperators).toBe(false)
    })

    it('sets hasOperators flag correctly', () => {
      const withOps = parseSearchOperators('from:john')
      expect(withOps.hasOperators).toBe(true)

      const withoutOps = parseSearchOperators('plain text')
      expect(withoutOps.hasOperators).toBe(false)
    })

    it('handles operator-only queries (no text)', () => {
      const result = parseSearchOperators('from:john has:attachment')
      expect(result.operators).toHaveLength(2)
      expect(result.textQuery).toBe('')
      expect(result.hasOperators).toBe(true)
    })

    it('handles before: and after: date range (AC 16)', () => {
      const result = parseSearchOperators('before:2025-01-01 after:2024-06-01')
      expect(result.operators).toHaveLength(2)
      expect(result.operators[0]).toEqual({ type: 'before', value: '2025-01-01' })
      expect(result.operators[1]).toEqual({ type: 'after', value: '2024-06-01' })
      expect(result.textQuery).toBe('')
    })

    it('handles invalid date as unknown operator (falls through as text)', () => {
      const result = parseSearchOperators('before:not-a-date')
      // Invalid dates should cause the operator to be treated as unknown
      expect(result.operators).toHaveLength(0)
      expect(result.textQuery).toBe('before:not-a-date')
    })

    it('rejects non-YYYY-MM-DD date formats (strict validation)', () => {
      // Year-only should be rejected
      const yearOnly = parseSearchOperators('before:2025')
      expect(yearOnly.operators).toHaveLength(0)
      expect(yearOnly.textQuery).toBe('before:2025')

      // Month name should be rejected
      const monthName = parseSearchOperators('after:January')
      expect(monthName.operators).toHaveLength(0)
      expect(monthName.textQuery).toBe('after:January')

      // Partial date should be rejected
      const partial = parseSearchOperators('before:2025-01')
      expect(partial.operators).toHaveLength(0)
      expect(partial.textQuery).toBe('before:2025-01')
    })

    it('handles multiple operators of same type', () => {
      const result = parseSearchOperators('from:john from:jane')
      expect(result.operators).toHaveLength(2)
      expect(result.operators[0]).toEqual({ type: 'from', value: 'john' })
      expect(result.operators[1]).toEqual({ type: 'from', value: 'jane' })
    })
  })

  describe('matchesOperatorFilters', () => {
    it('matches from: by sender name (partial, case-insensitive)', () => {
      const email = createTestEmail({ from: { name: 'John Doe', email: 'john@example.com' } })
      expect(matchesOperatorFilters(email, [{ type: 'from', value: 'john' }])).toBe(true)
      expect(matchesOperatorFilters(email, [{ type: 'from', value: 'John' }])).toBe(true)
      expect(matchesOperatorFilters(email, [{ type: 'from', value: 'doe' }])).toBe(true)
    })

    it('matches from: by sender email (partial, case-insensitive)', () => {
      const email = createTestEmail({ from: { name: 'John Doe', email: 'john@example.com' } })
      expect(matchesOperatorFilters(email, [{ type: 'from', value: 'john@' }])).toBe(true)
      expect(matchesOperatorFilters(email, [{ type: 'from', value: 'example.com' }])).toBe(true)
    })

    it('does not match from: when no match', () => {
      const email = createTestEmail({ from: { name: 'John Doe', email: 'john@example.com' } })
      expect(matchesOperatorFilters(email, [{ type: 'from', value: 'alice' }])).toBe(false)
    })

    it('matches from: with full name (quoted value, AC 19)', () => {
      const email = createTestEmail({ from: { name: 'John Smith', email: 'john@example.com' } })
      expect(matchesOperatorFilters(email, [{ type: 'from', value: 'John Smith' }])).toBe(true)
    })

    it('matches to: by recipient name or email', () => {
      const email = createTestEmail({
        to: [
          { name: 'Jane Smith', email: 'jane@example.com' },
          { name: 'Bob Jones', email: 'bob@example.com' },
        ],
      })
      expect(matchesOperatorFilters(email, [{ type: 'to', value: 'jane' }])).toBe(true)
      expect(matchesOperatorFilters(email, [{ type: 'to', value: 'bob@' }])).toBe(true)
      expect(matchesOperatorFilters(email, [{ type: 'to', value: 'alice' }])).toBe(false)
    })

    it('matches has:attachment when email has attachments (AC 14)', () => {
      const withAttachments = createTestEmail({
        attachments: [
          {
            id: 'att-1',
            filename: 'doc.pdf',
            mimeType: 'application/pdf',
            size: 1024,
            isInline: false,
          },
        ],
      })
      const withoutAttachments = createTestEmail({ attachments: [] })

      expect(matchesOperatorFilters(withAttachments, [{ type: 'has', value: 'attachment' }])).toBe(
        true
      )
      expect(
        matchesOperatorFilters(withoutAttachments, [{ type: 'has', value: 'attachment' }])
      ).toBe(false)
    })

    it('matches before: date filter (AC 16)', () => {
      const email = createTestEmail({ timestamp: new Date('2024-08-15').getTime() })
      expect(matchesOperatorFilters(email, [{ type: 'before', value: '2025-01-01' }])).toBe(true)
      expect(matchesOperatorFilters(email, [{ type: 'before', value: '2024-01-01' }])).toBe(false)
    })

    it('matches after: date filter (AC 16)', () => {
      const email = createTestEmail({ timestamp: new Date('2024-08-15').getTime() })
      expect(matchesOperatorFilters(email, [{ type: 'after', value: '2024-06-01' }])).toBe(true)
      expect(matchesOperatorFilters(email, [{ type: 'after', value: '2025-01-01' }])).toBe(false)
    })

    it('matches in: by folder (case-insensitive)', () => {
      const email = createTestEmail({ folder: 'inbox', labels: ['important'] })
      expect(matchesOperatorFilters(email, [{ type: 'in', value: 'inbox' }])).toBe(true)
      expect(matchesOperatorFilters(email, [{ type: 'in', value: 'Inbox' }])).toBe(true)
      expect(matchesOperatorFilters(email, [{ type: 'in', value: 'sent' }])).toBe(false)
    })

    it('matches in: by label', () => {
      const email = createTestEmail({ folder: 'inbox', labels: ['important', 'work'] })
      expect(matchesOperatorFilters(email, [{ type: 'in', value: 'important' }])).toBe(true)
      expect(matchesOperatorFilters(email, [{ type: 'in', value: 'work' }])).toBe(true)
      expect(matchesOperatorFilters(email, [{ type: 'in', value: 'personal' }])).toBe(false)
    })

    it('combines multiple operators with AND logic (AC 4)', () => {
      const email = createTestEmail({
        from: { name: 'John Doe', email: 'john@example.com' },
        attachments: [
          {
            id: 'att-1',
            filename: 'doc.pdf',
            mimeType: 'application/pdf',
            size: 1024,
            isInline: false,
          },
        ],
      })

      // Both should match
      expect(
        matchesOperatorFilters(email, [
          { type: 'from', value: 'john' },
          { type: 'has', value: 'attachment' },
        ])
      ).toBe(true)

      // from matches but no attachment
      const noAttachEmail = createTestEmail({
        from: { name: 'John Doe', email: 'john@example.com' },
        attachments: [],
      })
      expect(
        matchesOperatorFilters(noAttachEmail, [
          { type: 'from', value: 'john' },
          { type: 'has', value: 'attachment' },
        ])
      ).toBe(false)
    })

    it('returns true for empty operators (no filters)', () => {
      const email = createTestEmail()
      expect(matchesOperatorFilters(email, [])).toBe(true)
    })
  })

  describe('KNOWN_OPERATORS', () => {
    it('contains all expected operators', () => {
      expect(KNOWN_OPERATORS).toContain('from')
      expect(KNOWN_OPERATORS).toContain('to')
      expect(KNOWN_OPERATORS).toContain('has')
      expect(KNOWN_OPERATORS).toContain('before')
      expect(KNOWN_OPERATORS).toContain('after')
      expect(KNOWN_OPERATORS).toContain('in')
    })
  })

  describe('getOperatorSearchHints', () => {
    it('returns hints for all known operators', () => {
      const hints = getOperatorSearchHints()
      expect(hints.length).toBeGreaterThanOrEqual(6)

      const labels = hints.map((h) => h.label)
      expect(labels).toContain('from:')
      expect(labels).toContain('to:')
      expect(labels).toContain('has:attachment')
      expect(labels).toContain('before:')
      expect(labels).toContain('after:')
      expect(labels).toContain('in:')
    })

    it('returns hints with correct structure', () => {
      const hints = getOperatorSearchHints()
      for (const hint of hints) {
        expect(hint).toHaveProperty('label')
        expect(hint).toHaveProperty('value')
        expect(hint).toHaveProperty('description')
      }
    })
  })
})
