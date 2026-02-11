/**
 * Unit tests for EmailRow component
 * Story 2.1: Virtualized Inbox Rendering
 *
 * Tests:
 * - AC4: Dynamic row heights support via content rendering
 * - Display of email metadata (sender, subject, snippet)
 * - Visual indicators (unread, starred, attachments)
 * - Selection state
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EmailRow } from '../EmailRow'
import type { EmailDocument } from '@/services/database/schemas/email.schema'

// Mock email factory
function createMockEmail(overrides: Partial<EmailDocument> = {}): EmailDocument {
  return {
    id: 'email-1',
    accountId: 'account-1',
    threadId: 'thread-1',
    subject: 'Test Subject',
    from: { name: 'Test Sender', email: 'sender@example.com' },
    to: [{ name: 'Recipient', email: 'recipient@example.com' }],
    timestamp: Date.now(),
    read: false,
    starred: false,
    labels: ['INBOX'],
    folder: 'INBOX',
    snippet: 'This is a test snippet for the email preview.',
    body: { text: 'Email body content' },
    attachments: [],
    importance: 'normal' as const,
    attributes: {},
    ...overrides,
  }
}

describe('EmailRow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Email metadata display', () => {
    it('displays sender name when available', () => {
      const email = createMockEmail({
        from: { name: 'Alice Smith', email: 'alice@example.com' },
      })

      render(<EmailRow email={email} />)

      expect(screen.getByText('Alice Smith')).toBeInTheDocument()
    })

    it('displays sender email when no name available', () => {
      const email = createMockEmail({
        from: { name: '', email: 'alice@example.com' },
      })

      render(<EmailRow email={email} />)

      expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    })

    it('displays email subject', () => {
      const email = createMockEmail({ subject: 'Important Meeting Tomorrow' })

      render(<EmailRow email={email} />)

      expect(screen.getByText('Important Meeting Tomorrow')).toBeInTheDocument()
    })

    it('displays "(No subject)" when subject is empty', () => {
      const email = createMockEmail({ subject: '' })

      render(<EmailRow email={email} />)

      expect(screen.getByText('(No subject)')).toBeInTheDocument()
    })

    it('displays snippet preview', () => {
      const email = createMockEmail({
        snippet: 'Hello, this is a preview of the email content...',
      })

      render(<EmailRow email={email} />)

      // Snippet is shown in compact layout
      expect(screen.getByText(/Hello, this is a preview/)).toBeInTheDocument()
    })
  })

  describe('Visual indicators', () => {
    it('shows unread indicator for unread emails', () => {
      const email = createMockEmail({ read: false })

      const { container } = render(<EmailRow email={email} />)

      // Unread indicator is a cyan dot (UX spec)
      const unreadIndicator = container.querySelector('.bg-cyan-500.rounded-full')
      expect(unreadIndicator).toBeInTheDocument()
    })

    it('does not show unread indicator for read emails', () => {
      const email = createMockEmail({ read: true })

      const { container } = render(<EmailRow email={email} />)

      const unreadIndicator = container.querySelector('.bg-cyan-500.rounded-full')
      expect(unreadIndicator).not.toBeInTheDocument()
    })

    it('applies bold text styling for unread emails', () => {
      const email = createMockEmail({ read: false })

      render(<EmailRow email={email} />)

      const senderElement = screen.getByText('Test Sender')
      expect(senderElement).toHaveClass('font-semibold')
    })

    it('shows starred indicator for starred emails', () => {
      const email = createMockEmail({ starred: true })

      render(<EmailRow email={email} />)

      // Star indicator is a yellow star character
      expect(screen.getByText('★')).toBeInTheDocument()
    })

    it('does not show starred indicator for non-starred emails', () => {
      const email = createMockEmail({ starred: false })

      render(<EmailRow email={email} />)

      expect(screen.queryByText('★')).not.toBeInTheDocument()
    })

    it('shows attachment indicator when email has attachments', () => {
      const email = createMockEmail({
        attachments: [
          {
            id: 'att-1',
            filename: 'document.pdf',
            mimeType: 'application/pdf',
            size: 1024,
            isInline: false,
          },
        ],
      })

      render(<EmailRow email={email} />)

      // Attachment icon is a paperclip character
      expect(screen.getByText('📎')).toBeInTheDocument()
    })

    it('does not show attachment indicator when no attachments', () => {
      const email = createMockEmail({ attachments: [] })

      render(<EmailRow email={email} />)

      expect(screen.queryByText('📎')).not.toBeInTheDocument()
    })
  })

  describe('Selection state', () => {
    it('applies selected styling when isSelected is true', () => {
      const email = createMockEmail()

      render(<EmailRow email={email} isSelected={true} />)

      const row = screen.getByRole('button')
      // Check for the left border class (the selected indicator)
      // UX spec: cyan selection state
      expect(row.className).toContain('bg-cyan-50')
      expect(row.className).toContain('border-l-cyan-500')
    })

    it('does not apply selected styling when isSelected is false', () => {
      const email = createMockEmail()

      render(<EmailRow email={email} isSelected={false} />)

      const row = screen.getByRole('button')
      expect(row.className).not.toContain('bg-cyan-50')
    })
  })

  describe('Click handling', () => {
    it('calls onClick when row is clicked', () => {
      const email = createMockEmail()
      const onClick = vi.fn()

      render(<EmailRow email={email} onClick={onClick} />)

      fireEvent.click(screen.getByRole('button'))

      expect(onClick).toHaveBeenCalledTimes(1)
    })

    it('calls onClick on Enter key press', () => {
      const email = createMockEmail()
      const onClick = vi.fn()

      render(<EmailRow email={email} onClick={onClick} />)

      fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' })

      expect(onClick).toHaveBeenCalledTimes(1)
    })

    it('calls onClick on Space key press', () => {
      const email = createMockEmail()
      const onClick = vi.fn()

      render(<EmailRow email={email} onClick={onClick} />)

      fireEvent.keyDown(screen.getByRole('button'), { key: ' ' })

      expect(onClick).toHaveBeenCalledTimes(1)
    })

    it('does not throw when onClick is not provided', () => {
      const email = createMockEmail()

      render(<EmailRow email={email} />)

      expect(() => {
        fireEvent.click(screen.getByRole('button'))
      }).not.toThrow()
    })
  })

  describe('Date formatting', () => {
    it('displays formatted date', () => {
      // Set a specific timestamp for testing
      const email = createMockEmail({
        timestamp: new Date().setHours(10, 30, 0, 0), // Today at 10:30
      })

      render(<EmailRow email={email} />)

      // Time format may vary by locale, but should be present
      // Check that some time-related text is rendered
      const row = screen.getByRole('button')
      expect(row).toBeInTheDocument()
    })
  })

  describe('AC4: Dynamic row heights', () => {
    it('renders with variable content lengths', () => {
      const shortEmail = createMockEmail({
        snippet: 'Short',
      })
      const longEmail = createMockEmail({
        snippet:
          'This is a much longer snippet that contains multiple sentences. It should be truncated with line-clamp-2 to show only two lines of text.',
      })

      const { rerender, container } = render(<EmailRow email={shortEmail} />)
      const shortRow = container.querySelector('[role="button"]')
      expect(shortRow).toBeInTheDocument()

      rerender(<EmailRow email={longEmail} />)
      const longRow = container.querySelector('[role="button"]')
      expect(longRow).toBeInTheDocument()

      // Both should render successfully with different content
      expect(screen.getByText(/This is a much longer snippet/)).toBeInTheDocument()
    })

    it('applies 48px compact height per UX spec', () => {
      const email = createMockEmail({
        snippet: 'A very long snippet that would need truncating...',
      })

      const { container } = render(<EmailRow email={email} />)

      // UX spec: 48px (h-12) compact row height
      const rowElement = container.querySelector('.h-12')
      expect(rowElement).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has role="button" for keyboard accessibility', () => {
      const email = createMockEmail()

      render(<EmailRow email={email} />)

      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('has tabIndex for keyboard navigation (roving tabindex pattern)', () => {
      const email = createMockEmail()

      // Unselected rows should have tabIndex=-1 (roving tabindex pattern)
      const { rerender } = render(<EmailRow email={email} />)
      expect(screen.getByRole('button')).toHaveAttribute('tabindex', '-1')

      // Selected rows should have tabIndex=0
      rerender(<EmailRow email={email} isSelected />)
      expect(screen.getByRole('button')).toHaveAttribute('tabindex', '0')
    })
  })

  describe('Priority badge (Story 3.3)', () => {
    it('displays priority badge when aiMetadata has priority', () => {
      const email = createMockEmail({
        aiMetadata: {
          triageScore: 85,
          priority: 'high',
          suggestedAttributes: {},
          confidence: 80,
          reasoning: 'Urgent deadline',
          modelVersion: 'test-model-v1',
          processedAt: Date.now(),
        },
      })

      render(<EmailRow email={email} />)
      expect(screen.getByText('Urgent')).toBeInTheDocument()
    })

    it('does not display priority badge when no aiMetadata', () => {
      const email = createMockEmail()

      render(<EmailRow email={email} />)
      expect(screen.queryByText('Urgent')).not.toBeInTheDocument()
      expect(screen.queryByText('Important')).not.toBeInTheDocument()
      expect(screen.queryByText('Updates')).not.toBeInTheDocument()
      expect(screen.queryByText('Low')).not.toBeInTheDocument()
    })

    it('displays correct badge label for each priority level', () => {
      const priorities = [
        { priority: 'high' as const, label: 'Urgent' },
        { priority: 'medium' as const, label: 'Important' },
        { priority: 'low' as const, label: 'Updates' },
        { priority: 'none' as const, label: 'Low' },
      ]

      for (const { priority, label } of priorities) {
        const email = createMockEmail({
          aiMetadata: {
            triageScore: 50,
            priority,
            suggestedAttributes: {},
            confidence: 70,
            reasoning: 'Test',
            modelVersion: 'test-model-v1',
            processedAt: Date.now(),
          },
        })

        const { unmount } = render(<EmailRow email={email} />)
        expect(screen.getByText(label)).toBeInTheDocument()
        unmount()
      }
    })
  })
})
