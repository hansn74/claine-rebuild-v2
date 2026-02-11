/**
 * Thread Context Tests
 *
 * Story 3.2: Email Analysis Engine
 * Task 3: Thread context analysis tests
 */

import { describe, it, expect } from 'vitest'
import { analyzeThreadContext, createSingleMessageContext } from '../threadContext'
import type { EmailDocument } from '@/services/database/schemas/email.schema'

function createEmail(overrides?: Partial<EmailDocument>): EmailDocument {
  return {
    id: 'email-1',
    threadId: 'thread-1',
    from: { name: 'Alice', email: 'alice@example.com' },
    to: [{ name: 'Bob', email: 'bob@example.com' }],
    subject: 'Test subject',
    body: { text: 'Test body content.' },
    timestamp: Date.now(),
    accountId: 'account-1',
    attachments: [],
    snippet: 'Test body content.',
    labels: [],
    folder: 'inbox',
    read: false,
    starred: false,
    importance: 'normal' as const,
    attributes: {},
    ...overrides,
  }
}

describe('analyzeThreadContext', () => {
  it('should analyze first message in thread', () => {
    const email1 = createEmail({ id: 'e1', timestamp: 1000 })
    const email2 = createEmail({
      id: 'e2',
      timestamp: 2000,
      from: { name: 'Bob', email: 'bob@example.com' },
    })

    const context = analyzeThreadContext(email1, [email1, email2])

    expect(context.messageCount).toBe(2)
    expect(context.position).toBe(1)
    expect(context.isFirstMessage).toBe(true)
    expect(context.isLatestMessage).toBe(false)
    expect(context.participantCount).toBe(2)
  })

  it('should analyze latest message in thread', () => {
    const email1 = createEmail({ id: 'e1', timestamp: 1000 })
    const email2 = createEmail({
      id: 'e2',
      timestamp: 2000,
      from: { name: 'Bob', email: 'bob@example.com' },
    })

    const context = analyzeThreadContext(email2, [email1, email2])

    expect(context.position).toBe(2)
    expect(context.isFirstMessage).toBe(false)
    expect(context.isLatestMessage).toBe(true)
  })

  it('should count unique participants', () => {
    const emails = [
      createEmail({
        id: 'e1',
        timestamp: 1000,
        from: { name: 'Alice', email: 'alice@example.com' },
        to: [{ name: 'Bob', email: 'bob@example.com' }],
      }),
      createEmail({
        id: 'e2',
        timestamp: 2000,
        from: { name: 'Bob', email: 'bob@example.com' },
        to: [
          { name: 'Alice', email: 'alice@example.com' },
          { name: 'Charlie', email: 'charlie@example.com' },
        ],
      }),
    ]

    const context = analyzeThreadContext(emails[0], emails)

    expect(context.participantCount).toBe(3)
    expect(context.participants).toContain('alice@example.com')
    expect(context.participants).toContain('bob@example.com')
    expect(context.participants).toContain('charlie@example.com')
  })

  it('should detect urgency escalation', () => {
    const emails = [
      createEmail({
        id: 'e1',
        timestamp: 1000,
        body: { text: 'Here is the document for review.' },
      }),
      createEmail({
        id: 'e2',
        timestamp: 2000,
        body: { text: 'Any update on this?' },
      }),
      createEmail({
        id: 'e3',
        timestamp: 3000,
        body: { text: 'Still waiting for your response. This is urgent now, please respond ASAP.' },
      }),
    ]

    const context = analyzeThreadContext(emails[2], emails)

    expect(context.urgencyEscalated).toBe(true)
    expect(context.contextSummary).toContain('escalated')
  })

  it('should not flag escalation for first message', () => {
    const emails = [
      createEmail({
        id: 'e1',
        timestamp: 1000,
        body: { text: 'This is urgent!' },
      }),
    ]

    const context = analyzeThreadContext(emails[0], emails)

    expect(context.urgencyEscalated).toBe(false)
  })

  it('should handle unsorted thread emails', () => {
    const emails = [
      createEmail({ id: 'e3', timestamp: 3000 }),
      createEmail({ id: 'e1', timestamp: 1000 }),
      createEmail({ id: 'e2', timestamp: 2000 }),
    ]

    const context = analyzeThreadContext(emails[1], emails) // e1 (oldest)

    expect(context.position).toBe(1)
    expect(context.isFirstMessage).toBe(true)
    expect(context.messageCount).toBe(3)
  })

  it('should include sender info in summary for multi-sender threads', () => {
    const emails = [
      createEmail({
        id: 'e1',
        timestamp: 1000,
        from: { name: 'Alice', email: 'alice@example.com' },
      }),
      createEmail({
        id: 'e2',
        timestamp: 2000,
        from: { name: 'Bob', email: 'bob@example.com' },
      }),
    ]

    const context = analyzeThreadContext(emails[0], emails)

    expect(context.contextSummary).toContain('alice@example.com')
    expect(context.contextSummary).toContain('bob@example.com')
  })
})

describe('createSingleMessageContext', () => {
  it('should create context for standalone email', () => {
    const email = createEmail()
    const context = createSingleMessageContext(email)

    expect(context.messageCount).toBe(1)
    expect(context.position).toBe(1)
    expect(context.isFirstMessage).toBe(true)
    expect(context.isLatestMessage).toBe(true)
    expect(context.urgencyEscalated).toBe(false)
    expect(context.contextSummary).toContain('Single message')
  })

  it('should count participants from to/from', () => {
    const email = createEmail({
      from: { name: 'Alice', email: 'alice@example.com' },
      to: [
        { name: 'Bob', email: 'bob@example.com' },
        { name: 'Charlie', email: 'charlie@example.com' },
      ],
    })

    const context = createSingleMessageContext(email)

    expect(context.participantCount).toBe(3)
  })
})
