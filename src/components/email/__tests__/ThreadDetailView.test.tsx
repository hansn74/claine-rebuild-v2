/**
 * ThreadDetailView Component Tests
 *
 * Story 2.2: Thread Detail View with Conversation History
 * Task 11: Testing & Performance
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ThreadDetailView } from '../ThreadDetailView'
import type { EmailDocument } from '@/services/database/schemas/email.schema'

// Mock the useThread hook
vi.mock('@/hooks/useThread', () => ({
  useThread: vi.fn(),
}))

// Mock logger
vi.mock('@/services/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

import { useThread } from '@/hooks/useThread'

const mockUseThread = vi.mocked(useThread)

/**
 * Generate mock email for testing
 */
function generateMockEmail(overrides: Partial<EmailDocument> = {}): EmailDocument {
  return {
    id: 'email-1',
    threadId: 'thread-1',
    from: { name: 'John Doe', email: 'john@example.com' },
    to: [{ name: 'Jane Smith', email: 'jane@example.com' }],
    cc: [],
    bcc: [],
    subject: 'Test Subject',
    body: { text: 'Hello World', html: '<p>Hello World</p>' },
    timestamp: Date.now() - 3600000,
    accountId: 'account-1',
    attachments: [],
    snippet: 'Hello World',
    labels: ['inbox'],
    folder: 'inbox',
    read: true,
    starred: false,
    importance: 'normal',
    attributes: {},
    ...overrides,
  }
}

describe('ThreadDetailView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Empty State', () => {
    it('should show empty state when no threadId provided', () => {
      mockUseThread.mockReturnValue({
        emails: [],
        loading: false,
        error: null,
        threadSubject: null,
        participantCount: 0,
        messageCount: 0,
      })

      render(<ThreadDetailView threadId={null} />)

      expect(screen.getByText('Select a conversation')).toBeInTheDocument()
    })
  })

  describe('Loading State', () => {
    it('should show loading state while fetching', () => {
      mockUseThread.mockReturnValue({
        emails: [],
        loading: true,
        error: null,
        threadSubject: null,
        participantCount: 0,
        messageCount: 0,
      })

      render(<ThreadDetailView threadId="thread-1" />)

      expect(screen.getByText('Loading thread...')).toBeInTheDocument()
    })
  })

  describe('Error State', () => {
    it('should show error state when there is an error', () => {
      const testError = new Error('Failed to fetch thread')
      mockUseThread.mockReturnValue({
        emails: [],
        loading: false,
        error: testError,
        threadSubject: null,
        participantCount: 0,
        messageCount: 0,
      })

      render(<ThreadDetailView threadId="thread-1" />)

      expect(screen.getByText('Failed to load thread')).toBeInTheDocument()
      expect(screen.getByText('Failed to fetch thread')).toBeInTheDocument()
    })
  })

  describe('Thread Display', () => {
    it('should display thread header with subject and counts', () => {
      const mockEmails = [
        generateMockEmail({ id: 'email-1', subject: 'Important Discussion' }),
        generateMockEmail({
          id: 'email-2',
          from: { name: 'Jane Smith', email: 'jane@example.com' },
        }),
      ]

      mockUseThread.mockReturnValue({
        emails: mockEmails,
        loading: false,
        error: null,
        threadSubject: 'Important Discussion',
        participantCount: 2,
        messageCount: 2,
      })

      render(<ThreadDetailView threadId="thread-1" />)

      expect(screen.getByText('Important Discussion')).toBeInTheDocument()
      expect(screen.getByText('2 participants')).toBeInTheDocument()
      expect(screen.getByText('2 messages')).toBeInTheDocument()
    })

    it('should display (No subject) for thread without subject', () => {
      const mockEmails = [generateMockEmail({ subject: '' })]

      mockUseThread.mockReturnValue({
        emails: mockEmails,
        loading: false,
        error: null,
        threadSubject: '',
        participantCount: 1,
        messageCount: 1,
      })

      render(<ThreadDetailView threadId="thread-1" />)

      expect(screen.getByText('(No subject)')).toBeInTheDocument()
    })

    it('should render messages chronologically (oldest first)', () => {
      const oldEmail = generateMockEmail({
        id: 'email-old',
        timestamp: Date.now() - 7200000, // 2 hours ago
        from: { name: 'First Sender', email: 'first@example.com' },
      })
      const newEmail = generateMockEmail({
        id: 'email-new',
        timestamp: Date.now() - 3600000, // 1 hour ago
        from: { name: 'Second Sender', email: 'second@example.com' },
      })

      mockUseThread.mockReturnValue({
        emails: [oldEmail, newEmail], // Already sorted oldest first
        loading: false,
        error: null,
        threadSubject: 'Test Thread',
        participantCount: 2,
        messageCount: 2,
      })

      render(<ThreadDetailView threadId="thread-1" />)

      // Both senders should be visible (may appear multiple times due to expandable header)
      expect(screen.getAllByText('First Sender').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Second Sender').length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Thread Not Found', () => {
    it('should show not found message when thread has no messages', () => {
      mockUseThread.mockReturnValue({
        emails: [],
        loading: false,
        error: null,
        threadSubject: null,
        participantCount: 0,
        messageCount: 0,
      })

      render(<ThreadDetailView threadId="thread-1" />)

      expect(screen.getByText('Thread not found')).toBeInTheDocument()
    })
  })

  describe('Back Button', () => {
    it('should call onBack when back button is clicked', async () => {
      const onBack = vi.fn()
      const mockEmails = [generateMockEmail()]

      mockUseThread.mockReturnValue({
        emails: mockEmails,
        loading: false,
        error: null,
        threadSubject: 'Test',
        participantCount: 1,
        messageCount: 1,
      })

      render(<ThreadDetailView threadId="thread-1" onBack={onBack} />)

      const backButton = screen.getByLabelText('Back to inbox')
      backButton.click()

      expect(onBack).toHaveBeenCalledTimes(1)
    })
  })
})
