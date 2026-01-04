/**
 * Unit tests for EmailListItem component
 * Tests AC1: sender, subject, date, read/unread
 * Tests AC3: Unread visually distinguished
 * Tests AC4: Click handler works
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EmailListItem } from '../EmailListItem'
import type { EmailDocument } from '@/services/database/schemas/email.schema'

// Mock email data
const mockUnreadEmail: EmailDocument = {
  id: 'email-1',
  accountId: 'account-1',
  gmailId: 'gmail-123',
  threadId: 'thread-1',
  subject: 'Test Subject',
  from: { name: 'John Doe', email: 'john@example.com' },
  to: [{ name: 'Jane Doe', email: 'jane@example.com' }],
  timestamp: Date.now() - 1000 * 60 * 30, // 30 minutes ago
  read: false,
  starred: false,
  labels: ['INBOX'],
  snippet: 'This is a test email snippet...',
  body: { text: 'Full email body text', html: '<p>Full email body</p>' },
}

const mockReadEmail: EmailDocument = {
  ...mockUnreadEmail,
  id: 'email-2',
  gmailId: 'gmail-456',
  read: true,
  starred: true,
  attachments: [{ id: 'att-1', filename: 'document.pdf', mimeType: 'application/pdf', size: 1024 }],
}

const mockOldEmail: EmailDocument = {
  ...mockUnreadEmail,
  id: 'email-3',
  gmailId: 'gmail-789',
  timestamp: Date.now() - 1000 * 60 * 60 * 24 * 10, // 10 days ago
  read: true,
}

describe('EmailListItem', () => {
  describe('AC1: Display sender, subject, date, read/unread status', () => {
    it('displays sender name when available', () => {
      render(<EmailListItem email={mockUnreadEmail} />)
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })

    it('displays sender email when name is not available', () => {
      const emailNoName = { ...mockUnreadEmail, from: { name: '', email: 'test@example.com' } }
      render(<EmailListItem email={emailNoName} />)
      expect(screen.getByText('test@example.com')).toBeInTheDocument()
    })

    it('displays email subject', () => {
      render(<EmailListItem email={mockUnreadEmail} />)
      expect(screen.getByText('Test Subject')).toBeInTheDocument()
    })

    it('displays "(No subject)" when subject is empty', () => {
      const emailNoSubject = { ...mockUnreadEmail, subject: '' }
      render(<EmailListItem email={emailNoSubject} />)
      expect(screen.getByText('(No subject)')).toBeInTheDocument()
    })

    it('displays snippet preview with dash prefix', () => {
      render(<EmailListItem email={mockUnreadEmail} />)
      // UX spec: snippet shown with dash prefix in compact layout
      expect(screen.getByText(/— This is a test email snippet/)).toBeInTheDocument()
    })
  })

  describe('AC3: Unread emails visually distinguished', () => {
    it('shows unread indicator dot for unread emails', () => {
      render(<EmailListItem email={mockUnreadEmail} />)
      const unreadIndicator = screen.getByTitle('Unread')
      expect(unreadIndicator).toBeInTheDocument()
      expect(unreadIndicator).toHaveClass('bg-cyan-500')
    })

    it('does not show unread indicator for read emails', () => {
      render(<EmailListItem email={mockReadEmail} />)
      expect(screen.queryByTitle('Unread')).not.toBeInTheDocument()
    })

    it('applies bold text styling for unread emails', () => {
      render(<EmailListItem email={mockUnreadEmail} />)
      const senderText = screen.getByText('John Doe')
      expect(senderText).toHaveClass('font-semibold')
    })

    it('applies normal text styling for read emails', () => {
      render(<EmailListItem email={mockReadEmail} />)
      const senderText = screen.getByText('John Doe')
      expect(senderText).not.toHaveClass('font-semibold')
    })
  })

  describe('AC4: Click handler for selection', () => {
    it('calls onClick when clicked', () => {
      const handleClick = vi.fn()
      render(<EmailListItem email={mockUnreadEmail} onClick={handleClick} />)

      const listItem = screen.getByRole('button')
      fireEvent.click(listItem)

      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('calls onClick on Enter key press', () => {
      const handleClick = vi.fn()
      render(<EmailListItem email={mockUnreadEmail} onClick={handleClick} />)

      const listItem = screen.getByRole('button')
      fireEvent.keyDown(listItem, { key: 'Enter' })

      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('calls onClick on Space key press', () => {
      const handleClick = vi.fn()
      render(<EmailListItem email={mockUnreadEmail} onClick={handleClick} />)

      const listItem = screen.getByRole('button')
      fireEvent.keyDown(listItem, { key: ' ' })

      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('shows selected styling when isSelected is true', () => {
      // Use a READ email to avoid bg-white overriding bg-cyan-50
      render(<EmailListItem email={mockReadEmail} isSelected={true} />)

      const listItem = screen.getByRole('button')
      // Selected state adds border styling (UX spec: cyan)
      expect(listItem).toHaveClass('border-l-4')
      expect(listItem).toHaveClass('border-l-cyan-500')
    })
  })

  describe('Additional indicators', () => {
    it('shows star indicator for starred emails', () => {
      render(<EmailListItem email={mockReadEmail} />)
      expect(screen.getByText('★')).toBeInTheDocument()
    })

    it('shows attachment indicator when email has attachments', () => {
      render(<EmailListItem email={mockReadEmail} />)
      const attachmentIndicator = screen.getByTitle('1 attachment(s)')
      expect(attachmentIndicator).toBeInTheDocument()
    })

    it('does not show attachment indicator when no attachments', () => {
      render(<EmailListItem email={mockUnreadEmail} />)
      expect(screen.queryByTitle(/attachment/)).not.toBeInTheDocument()
    })
  })

  describe('Date formatting', () => {
    it('formats recent emails with time', () => {
      // Email from 30 minutes ago should show time
      render(<EmailListItem email={mockUnreadEmail} />)
      // We just verify it renders something - exact format depends on locale
      expect(screen.getByText(/\d{1,2}:\d{2}/)).toBeInTheDocument()
    })

    it('formats older emails with date', () => {
      render(<EmailListItem email={mockOldEmail} />)
      // 10 days ago should show month/day format
      // Check it doesn't show just a time
      const dateText = screen.getByText(/Nov|Dec|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct/)
      expect(dateText).toBeInTheDocument()
    })
  })
})
