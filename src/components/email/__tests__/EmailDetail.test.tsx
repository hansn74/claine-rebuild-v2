/**
 * Unit tests for EmailDetail component
 * Tests AC4: Shows basic detail view of email
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EmailDetail } from '../EmailDetail'
import type { EmailDocument } from '@/services/database/schemas/email.schema'

// Mock ShortcutContext (Story 2.23: EmailDetail now sets activeScope)
vi.mock('@/context/ShortcutContext', () => ({
  useShortcuts: () => ({
    setActiveScope: vi.fn(),
  }),
}))

const mockEmail: EmailDocument = {
  id: 'email-1',
  accountId: 'account-1',
  gmailId: 'gmail-123',
  threadId: 'thread-1',
  subject: 'Important Meeting Tomorrow',
  from: { name: 'John Smith', email: 'john@example.com' },
  to: [{ name: 'Jane Doe', email: 'jane@example.com' }],
  cc: [{ name: 'Bob Wilson', email: 'bob@example.com' }],
  timestamp: Date.now(),
  read: true,
  starred: false,
  labels: ['INBOX'],
  snippet: 'Please review the attached document...',
  body: {
    text: 'Please review the attached document before the meeting.',
    html: '<p>Please review the attached document before the meeting.</p>',
  },
  attachments: [
    { id: 'att-1', filename: 'agenda.pdf', mimeType: 'application/pdf', size: 2048 },
    { id: 'att-2', filename: 'notes.docx', mimeType: 'application/docx', size: 1024 },
  ],
}

const mockEmailNoHtml: EmailDocument = {
  ...mockEmail,
  id: 'email-2',
  body: {
    text: 'Plain text email body content.',
  },
}

const mockEmailNoBody: EmailDocument = {
  ...mockEmail,
  id: 'email-3',
  body: {},
}

describe('EmailDetail', () => {
  describe('AC4: Basic detail view', () => {
    it('shows "Select an email" when no email selected', () => {
      render(<EmailDetail email={null} />)

      expect(screen.getByText('Select an email to read')).toBeInTheDocument()
    })

    it('displays email subject', () => {
      render(<EmailDetail email={mockEmail} />)

      expect(screen.getByText('Important Meeting Tomorrow')).toBeInTheDocument()
    })

    it('displays "(No subject)" when subject is empty', () => {
      const emailNoSubject = { ...mockEmail, subject: '' }
      render(<EmailDetail email={emailNoSubject} />)

      expect(screen.getByText('(No subject)')).toBeInTheDocument()
    })

    it('displays sender name and email', () => {
      render(<EmailDetail email={mockEmail} />)

      expect(screen.getByText('John Smith')).toBeInTheDocument()
      expect(screen.getByText('john@example.com')).toBeInTheDocument()
    })

    it('displays sender avatar with initial', () => {
      render(<EmailDetail email={mockEmail} />)

      // Avatar should show first letter of sender name
      expect(screen.getByText('J')).toBeInTheDocument()
    })

    it('displays To recipients', () => {
      render(<EmailDetail email={mockEmail} />)

      expect(screen.getByText(/To:/)).toBeInTheDocument()
      expect(screen.getByText(/Jane Doe/)).toBeInTheDocument()
    })

    it('displays CC recipients when present', () => {
      render(<EmailDetail email={mockEmail} />)

      expect(screen.getByText(/Cc:/)).toBeInTheDocument()
      expect(screen.getByText(/Bob Wilson/)).toBeInTheDocument()
    })

    it('does not show CC section when no CC recipients', () => {
      const emailNoCc = { ...mockEmail, cc: [] }
      render(<EmailDetail email={emailNoCc} />)

      expect(screen.queryByText(/Cc:/)).not.toBeInTheDocument()
    })

    it('displays formatted date', () => {
      render(<EmailDetail email={mockEmail} />)

      // Check for date components (format varies by locale)
      const dateText = screen.getAllByText(
        /\d{1,2}:\d{2}|Mon|Tue|Wed|Thu|Fri|Sat|Sun|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/
      )
      expect(dateText.length).toBeGreaterThan(0)
    })
  })

  describe('Email body rendering', () => {
    it('renders HTML body when available', () => {
      render(<EmailDetail email={mockEmail} />)

      // HTML body should be rendered
      const bodyContainer = document.querySelector('.prose')
      expect(bodyContainer).toBeInTheDocument()
    })

    it('renders plain text when no HTML available', () => {
      render(<EmailDetail email={mockEmailNoHtml} />)

      expect(screen.getByText('Plain text email body content.')).toBeInTheDocument()
    })

    it('shows "No content" when no body', () => {
      render(<EmailDetail email={mockEmailNoBody} />)

      expect(screen.getByText('No content')).toBeInTheDocument()
    })
  })

  describe('Attachments', () => {
    it('displays attachment list when attachments exist', () => {
      render(<EmailDetail email={mockEmail} />)

      expect(screen.getByText('agenda.pdf')).toBeInTheDocument()
      expect(screen.getByText('notes.docx')).toBeInTheDocument()
    })

    it('shows attachment size', () => {
      render(<EmailDetail email={mockEmail} />)

      expect(screen.getByText('(2KB)')).toBeInTheDocument()
      expect(screen.getByText('(1KB)')).toBeInTheDocument()
    })

    it('does not show attachments section when no attachments', () => {
      const emailNoAttachments = { ...mockEmail, attachments: [] }
      render(<EmailDetail email={emailNoAttachments} />)

      expect(screen.queryByText('agenda.pdf')).not.toBeInTheDocument()
    })
  })

  describe('Edge cases', () => {
    it('handles email with no sender name', () => {
      const emailNoName = {
        ...mockEmail,
        from: { name: '', email: 'unknown@example.com' },
      }
      render(<EmailDetail email={emailNoName} />)

      // Email appears twice (once as display name, once as email address)
      const emailTexts = screen.getAllByText('unknown@example.com')
      expect(emailTexts.length).toBeGreaterThanOrEqual(1)
      // Avatar should show first letter of email
      expect(screen.getByText('U')).toBeInTheDocument()
    })

    it('handles multiple To recipients', () => {
      const emailMultipleTo = {
        ...mockEmail,
        to: [
          { name: 'Alice', email: 'alice@example.com' },
          { name: 'David', email: 'david@example.com' },
        ],
        cc: [], // Clear CC to avoid conflicts
      }
      render(<EmailDetail email={emailMultipleTo} />)

      expect(screen.getByText(/Alice/)).toBeInTheDocument()
      expect(screen.getByText(/David/)).toBeInTheDocument()
    })
  })
})
