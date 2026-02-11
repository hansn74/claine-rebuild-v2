/**
 * Unit tests for usePriorityGroupedEmails hook
 *
 * Story 3.4: Priority-Based Inbox View
 * Task 7: Tests for grouping, ordering, collapse, empty sections, uncategorized
 */

import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { usePriorityGroupedEmails } from '../usePriorityGroupedEmails'
import type { EmailDocument } from '@/services/database/schemas/email.schema'

function makeEmail(overrides: Partial<EmailDocument> & { id: string }): EmailDocument {
  return {
    accountId: 'account-1',
    threadId: `thread-${overrides.id}`,
    subject: `Subject ${overrides.id}`,
    from: { name: 'Sender', email: 'sender@example.com' },
    to: [{ name: 'Recipient', email: 'recipient@example.com' }],
    timestamp: Date.now(),
    read: false,
    starred: false,
    labels: ['INBOX'],
    folder: 'INBOX',
    snippet: 'snippet',
    body: { text: 'body' },
    attachments: [],
    importance: 'normal' as const,
    attributes: {},
    ...overrides,
  }
}

describe('usePriorityGroupedEmails', () => {
  it('returns empty array for empty emails', () => {
    const { result } = renderHook(() => usePriorityGroupedEmails([], new Set()))
    expect(result.current).toEqual([])
  })

  it('groups emails by priority in correct section order', () => {
    const emails = [
      makeEmail({
        id: '1',
        aiMetadata: {
          triageScore: 90,
          priority: 'high',
          suggestedAttributes: {},
          confidence: 90,
          reasoning: '',
          modelVersion: 'v1',
          processedAt: Date.now(),
        },
      }),
      makeEmail({
        id: '2',
        aiMetadata: {
          triageScore: 60,
          priority: 'medium',
          suggestedAttributes: {},
          confidence: 60,
          reasoning: '',
          modelVersion: 'v1',
          processedAt: Date.now(),
        },
      }),
      makeEmail({
        id: '3',
        aiMetadata: {
          triageScore: 30,
          priority: 'low',
          suggestedAttributes: {},
          confidence: 30,
          reasoning: '',
          modelVersion: 'v1',
          processedAt: Date.now(),
        },
      }),
      makeEmail({
        id: '4',
        aiMetadata: {
          triageScore: 10,
          priority: 'none',
          suggestedAttributes: {},
          confidence: 10,
          reasoning: '',
          modelVersion: 'v1',
          processedAt: Date.now(),
        },
      }),
    ]

    const { result } = renderHook(() => usePriorityGroupedEmails(emails, new Set()))

    const headers = result.current.filter((i) => i.type === 'header')
    expect(headers.map((h) => h.priority)).toEqual(['high', 'medium', 'low', 'none'])
  })

  it('puts emails without aiMetadata into uncategorized', () => {
    const emails = [
      makeEmail({ id: '1' }), // no aiMetadata
      makeEmail({
        id: '2',
        aiMetadata: {
          triageScore: 90,
          priority: 'high',
          suggestedAttributes: {},
          confidence: 90,
          reasoning: '',
          modelVersion: 'v1',
          processedAt: Date.now(),
        },
      }),
    ]

    const { result } = renderHook(() => usePriorityGroupedEmails(emails, new Set()))

    const headers = result.current.filter((i) => i.type === 'header')
    expect(headers.map((h) => h.priority)).toEqual(['high', 'uncategorized'])

    // Uncategorized header has correct count
    const uncategorizedHeader = headers.find((h) => h.priority === 'uncategorized')
    expect(uncategorizedHeader?.count).toBe(1)
  })

  it('omits empty sections', () => {
    const emails = [
      makeEmail({
        id: '1',
        aiMetadata: {
          triageScore: 90,
          priority: 'high',
          suggestedAttributes: {},
          confidence: 90,
          reasoning: '',
          modelVersion: 'v1',
          processedAt: Date.now(),
        },
      }),
    ]

    const { result } = renderHook(() => usePriorityGroupedEmails(emails, new Set()))

    const headers = result.current.filter((i) => i.type === 'header')
    expect(headers).toHaveLength(1)
    expect(headers[0].priority).toBe('high')
  })

  it('sorts emails within section by timestamp descending', () => {
    const now = Date.now()
    const emails = [
      makeEmail({
        id: '1',
        timestamp: now - 3000,
        aiMetadata: {
          triageScore: 90,
          priority: 'high',
          suggestedAttributes: {},
          confidence: 90,
          reasoning: '',
          modelVersion: 'v1',
          processedAt: now,
        },
      }),
      makeEmail({
        id: '2',
        timestamp: now - 1000,
        aiMetadata: {
          triageScore: 85,
          priority: 'high',
          suggestedAttributes: {},
          confidence: 85,
          reasoning: '',
          modelVersion: 'v1',
          processedAt: now,
        },
      }),
      makeEmail({
        id: '3',
        timestamp: now - 2000,
        aiMetadata: {
          triageScore: 80,
          priority: 'high',
          suggestedAttributes: {},
          confidence: 80,
          reasoning: '',
          modelVersion: 'v1',
          processedAt: now,
        },
      }),
    ]

    const { result } = renderHook(() => usePriorityGroupedEmails(emails, new Set()))

    const emailItems = result.current.filter((i) => i.type === 'email')
    expect(emailItems.map((i) => i.type === 'email' && i.email.id)).toEqual(['2', '3', '1'])
  })

  it('collapses sections: emits header only, skips email items', () => {
    const emails = [
      makeEmail({
        id: '1',
        aiMetadata: {
          triageScore: 90,
          priority: 'high',
          suggestedAttributes: {},
          confidence: 90,
          reasoning: '',
          modelVersion: 'v1',
          processedAt: Date.now(),
        },
      }),
      makeEmail({
        id: '2',
        aiMetadata: {
          triageScore: 85,
          priority: 'high',
          suggestedAttributes: {},
          confidence: 85,
          reasoning: '',
          modelVersion: 'v1',
          processedAt: Date.now(),
        },
      }),
    ]

    const { result } = renderHook(() => usePriorityGroupedEmails(emails, new Set(['high'])))

    // Only the header, no emails
    expect(result.current).toHaveLength(1)
    expect(result.current[0].type).toBe('header')
    if (result.current[0].type === 'header') {
      expect(result.current[0].isCollapsed).toBe(true)
      expect(result.current[0].count).toBe(2)
    }
  })

  it('handles multiple sections with some collapsed', () => {
    const emails = [
      makeEmail({
        id: '1',
        aiMetadata: {
          triageScore: 90,
          priority: 'high',
          suggestedAttributes: {},
          confidence: 90,
          reasoning: '',
          modelVersion: 'v1',
          processedAt: Date.now(),
        },
      }),
      makeEmail({
        id: '2',
        aiMetadata: {
          triageScore: 60,
          priority: 'medium',
          suggestedAttributes: {},
          confidence: 60,
          reasoning: '',
          modelVersion: 'v1',
          processedAt: Date.now(),
        },
      }),
      makeEmail({
        id: '3',
        aiMetadata: {
          triageScore: 55,
          priority: 'medium',
          suggestedAttributes: {},
          confidence: 55,
          reasoning: '',
          modelVersion: 'v1',
          processedAt: Date.now(),
        },
      }),
    ]

    const { result } = renderHook(() => usePriorityGroupedEmails(emails, new Set(['medium'])))

    // high header + 1 email + medium header (collapsed, no emails)
    expect(result.current).toHaveLength(3)
    expect(result.current[0].type).toBe('header')
    expect(result.current[1].type).toBe('email')
    expect(result.current[2].type).toBe('header')
    if (result.current[2].type === 'header') {
      expect(result.current[2].isCollapsed).toBe(true)
    }
  })

  it('header count reflects total emails in section regardless of collapse', () => {
    const emails = [
      makeEmail({
        id: '1',
        aiMetadata: {
          triageScore: 90,
          priority: 'high',
          suggestedAttributes: {},
          confidence: 90,
          reasoning: '',
          modelVersion: 'v1',
          processedAt: Date.now(),
        },
      }),
      makeEmail({
        id: '2',
        aiMetadata: {
          triageScore: 85,
          priority: 'high',
          suggestedAttributes: {},
          confidence: 85,
          reasoning: '',
          modelVersion: 'v1',
          processedAt: Date.now(),
        },
      }),
      makeEmail({
        id: '3',
        aiMetadata: {
          triageScore: 80,
          priority: 'high',
          suggestedAttributes: {},
          confidence: 80,
          reasoning: '',
          modelVersion: 'v1',
          processedAt: Date.now(),
        },
      }),
    ]

    const { result: collapsed } = renderHook(() =>
      usePriorityGroupedEmails(emails, new Set(['high']))
    )
    const { result: expanded } = renderHook(() => usePriorityGroupedEmails(emails, new Set()))

    const collapsedHeader = collapsed.current[0]
    const expandedHeader = expanded.current[0]
    if (collapsedHeader.type === 'header' && expandedHeader.type === 'header') {
      expect(collapsedHeader.count).toBe(3)
      expect(expandedHeader.count).toBe(3)
    }
  })

  it('sectionKey matches priority for email items', () => {
    const emails = [
      makeEmail({
        id: '1',
        aiMetadata: {
          triageScore: 90,
          priority: 'high',
          suggestedAttributes: {},
          confidence: 90,
          reasoning: '',
          modelVersion: 'v1',
          processedAt: Date.now(),
        },
      }),
      makeEmail({
        id: '2',
        aiMetadata: {
          triageScore: 60,
          priority: 'medium',
          suggestedAttributes: {},
          confidence: 60,
          reasoning: '',
          modelVersion: 'v1',
          processedAt: Date.now(),
        },
      }),
    ]

    const { result } = renderHook(() => usePriorityGroupedEmails(emails, new Set()))

    const emailItems = result.current.filter((i) => i.type === 'email')
    expect(emailItems[0].sectionKey).toBe('high')
    expect(emailItems[1].sectionKey).toBe('medium')
  })
})
