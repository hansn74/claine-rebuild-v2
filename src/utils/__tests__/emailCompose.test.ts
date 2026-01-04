/**
 * Email Compose Utilities Tests
 *
 * Story 2.3: Compose & Reply Interface
 * Task 10: Testing
 *
 * Tests for reply/forward context creation and subject formatting
 */

import { describe, it, expect } from 'vitest'
import {
  createReplyContext,
  createReplyAllContext,
  createForwardContext,
  formatReplySubject,
  formatForwardSubject,
  formatQuotedMessage,
  formatForwardedMessage,
  type EmailForCompose,
} from '../emailCompose'

describe('emailCompose utilities', () => {
  // Test email fixture
  const testEmail: EmailForCompose = {
    id: 'email-123',
    threadId: 'thread-456',
    from: { name: 'John Doe', email: 'john@example.com' },
    to: [
      { name: 'Jane Smith', email: 'jane@example.com' },
      { name: 'Bob Wilson', email: 'bob@example.com' },
    ],
    cc: [{ name: 'Carol Davis', email: 'carol@example.com' }],
    subject: 'Original Subject',
    body: {
      html: '<p>Hello, this is the message body.</p>',
      text: 'Hello, this is the message body.',
    },
    timestamp: 1701417600000, // Dec 1, 2023
  }

  describe('createReplyContext', () => {
    it('should create reply context with sender as recipient', () => {
      const context = createReplyContext(testEmail)

      expect(context.type).toBe('reply')
      expect(context.to).toEqual([testEmail.from])
      expect(context.cc).toEqual([])
      expect(context.replyToEmailId).toBe('email-123')
      expect(context.threadId).toBe('thread-456')
    })

    it('should format subject with Re: prefix', () => {
      const context = createReplyContext(testEmail)

      expect(context.subject).toBe('Re: Original Subject')
    })

    it('should include quoted content', () => {
      const context = createReplyContext(testEmail)

      expect(context.quotedContent).toContain('John Doe')
      expect(context.quotedContent).toContain('john@example.com')
      expect(context.quotedContent).toContain('wrote:')
      expect(context.quotedContent).toContain('blockquote')
    })
  })

  describe('createReplyAllContext', () => {
    it('should include sender and all recipients in To field', () => {
      const context = createReplyAllContext(testEmail)

      expect(context.type).toBe('reply-all')
      // Should include original sender + original To recipients
      expect(context.to.length).toBe(3)
      expect(context.to.map((a) => a.email)).toContain('john@example.com')
      expect(context.to.map((a) => a.email)).toContain('jane@example.com')
      expect(context.to.map((a) => a.email)).toContain('bob@example.com')
    })

    it('should include original Cc recipients in Cc field', () => {
      const context = createReplyAllContext(testEmail)

      expect(context.cc.length).toBe(1)
      expect(context.cc[0].email).toBe('carol@example.com')
    })

    it('should exclude current user from recipients', () => {
      const context = createReplyAllContext(testEmail, 'jane@example.com')

      // Jane should be excluded from To
      expect(context.to.map((a) => a.email)).not.toContain('jane@example.com')
      expect(context.to.length).toBe(2)
    })

    it('should remove duplicates from recipients', () => {
      const emailWithDuplicates: EmailForCompose = {
        ...testEmail,
        to: [
          { name: 'John Doe', email: 'john@example.com' }, // Same as sender
          { name: 'Jane Smith', email: 'jane@example.com' },
        ],
      }

      const context = createReplyAllContext(emailWithDuplicates)

      // Should not have duplicate john@example.com
      const johnCount = context.to.filter((a) => a.email === 'john@example.com').length
      expect(johnCount).toBe(1)
    })

    it('should not include Cc recipients that are already in To', () => {
      const emailWithOverlap: EmailForCompose = {
        ...testEmail,
        cc: [{ name: 'Jane Smith', email: 'jane@example.com' }], // Also in To
      }

      const context = createReplyAllContext(emailWithOverlap)

      // Jane should be in To, not Cc
      expect(context.to.map((a) => a.email)).toContain('jane@example.com')
      expect(context.cc.map((a) => a.email)).not.toContain('jane@example.com')
    })
  })

  describe('createForwardContext', () => {
    it('should create forward context with empty recipients', () => {
      const context = createForwardContext(testEmail)

      expect(context.type).toBe('forward')
      expect(context.to).toEqual([])
      expect(context.cc).toEqual([])
    })

    it('should format subject with Fwd: prefix', () => {
      const context = createForwardContext(testEmail)

      expect(context.subject).toBe('Fwd: Original Subject')
    })

    it('should include forwarded message header', () => {
      const context = createForwardContext(testEmail)

      expect(context.quotedContent).toContain('Forwarded message')
      expect(context.quotedContent).toContain('From:')
      expect(context.quotedContent).toContain('Date:')
      expect(context.quotedContent).toContain('Subject:')
      expect(context.quotedContent).toContain('To:')
    })

    it('should preserve replyToEmailId and threadId', () => {
      const context = createForwardContext(testEmail)

      expect(context.replyToEmailId).toBe('email-123')
      expect(context.threadId).toBe('thread-456')
    })
  })

  describe('formatReplySubject', () => {
    it('should add Re: prefix to plain subject', () => {
      expect(formatReplySubject('Hello World')).toBe('Re: Hello World')
    })

    it('should not duplicate Re: prefix', () => {
      expect(formatReplySubject('Re: Hello World')).toBe('Re: Hello World')
    })

    it('should handle case-insensitive Re: prefix', () => {
      expect(formatReplySubject('RE: Hello World')).toBe('RE: Hello World')
      expect(formatReplySubject('re: Hello World')).toBe('re: Hello World')
    })

    it('should replace Fwd: with Re:', () => {
      expect(formatReplySubject('Fwd: Hello World')).toBe('Re: Hello World')
    })

    it('should handle Fw: prefix', () => {
      expect(formatReplySubject('Fw: Hello World')).toBe('Re: Hello World')
    })

    it('should trim whitespace', () => {
      expect(formatReplySubject('  Hello World  ')).toBe('Re: Hello World')
    })
  })

  describe('formatForwardSubject', () => {
    it('should add Fwd: prefix to plain subject', () => {
      expect(formatForwardSubject('Hello World')).toBe('Fwd: Hello World')
    })

    it('should not duplicate Fwd: prefix', () => {
      expect(formatForwardSubject('Fwd: Hello World')).toBe('Fwd: Hello World')
    })

    it('should handle case-insensitive Fwd: prefix', () => {
      expect(formatForwardSubject('FWD: Hello World')).toBe('FWD: Hello World')
      expect(formatForwardSubject('fwd: Hello World')).toBe('fwd: Hello World')
    })

    it('should keep Re: prefix when forwarding', () => {
      expect(formatForwardSubject('Re: Hello World')).toBe('Fwd: Re: Hello World')
    })

    it('should trim whitespace', () => {
      expect(formatForwardSubject('  Hello World  ')).toBe('Fwd: Hello World')
    })
  })

  describe('formatQuotedMessage', () => {
    it('should include sender info in attribution', () => {
      const quoted = formatQuotedMessage(testEmail)

      expect(quoted).toContain('John Doe')
      expect(quoted).toContain('john@example.com')
      expect(quoted).toContain('wrote:')
    })

    it('should include message body in blockquote', () => {
      const quoted = formatQuotedMessage(testEmail)

      expect(quoted).toContain('blockquote')
      expect(quoted).toContain('Hello, this is the message body.')
    })

    it('should use text body if available', () => {
      const quoted = formatQuotedMessage(testEmail)

      // Should use plain text, not include HTML tags from body.html
      expect(quoted).not.toContain('<p>')
    })

    it('should handle email without name', () => {
      const emailNoName: EmailForCompose = {
        ...testEmail,
        from: { name: '', email: 'anonymous@example.com' },
      }

      const quoted = formatQuotedMessage(emailNoName)

      expect(quoted).toContain('anonymous@example.com')
    })
  })

  describe('formatForwardedMessage', () => {
    it('should include forwarded message header', () => {
      const forwarded = formatForwardedMessage(testEmail)

      expect(forwarded).toContain('---------- Forwarded message ---------')
    })

    it('should include all header fields', () => {
      const forwarded = formatForwardedMessage(testEmail)

      expect(forwarded).toContain('From: John Doe <john@example.com>')
      expect(forwarded).toContain('Date:')
      expect(forwarded).toContain('Subject: Original Subject')
      expect(forwarded).toContain('To:')
    })

    it('should include Cc if present', () => {
      const forwarded = formatForwardedMessage(testEmail)

      expect(forwarded).toContain('Cc:')
      expect(forwarded).toContain('carol@example.com')
    })

    it('should not include Cc if empty', () => {
      const emailNoCc: EmailForCompose = {
        ...testEmail,
        cc: undefined,
      }

      const forwarded = formatForwardedMessage(emailNoCc)

      expect(forwarded).not.toContain('Cc:')
    })

    it('should include original message body', () => {
      const forwarded = formatForwardedMessage(testEmail)

      expect(forwarded).toContain('Hello, this is the message body.')
    })
  })
})
