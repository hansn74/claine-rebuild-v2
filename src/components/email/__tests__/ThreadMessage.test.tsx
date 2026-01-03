/**
 * ThreadMessage Component Tests
 *
 * Story 2.2: Thread Detail View with Conversation History
 * Task 11: Testing & Performance
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThreadMessage } from '../ThreadMessage'
import type { EmailDocument } from '@/services/database/schemas/email.schema'

// Mock the logger
vi.mock('@/services/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock useAttachmentDownload - needed for attachment download tests
// Return values that make canDownload false so legacy onDownload callback is used
vi.mock('@/hooks/useAttachmentDownload', () => ({
  useAttachmentDownload: vi.fn(() => ({
    downloadAttachment: vi.fn(),
    isDownloading: () => false,
  })),
}))

// Mock useAttachmentPreviews - needed for attachment preview tests
vi.mock('@/hooks/useAttachmentPreviews', () => ({
  useAttachmentPreviews: vi.fn(() => ({
    previews: {},
    isLoading: false,
  })),
}))

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
    timestamp: Date.now() - 3600000, // 1 hour ago
    accountId: 'account-1',
    attachments: [],
    snippet: 'Hello World snippet',
    labels: ['inbox'],
    folder: 'inbox',
    read: true,
    starred: false,
    importance: 'normal',
    attributes: {},
    ...overrides,
  }
}

describe('ThreadMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock Date.now for consistent relative time tests
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Collapsible State', () => {
    it('should be collapsed by default when not last message', () => {
      render(<ThreadMessage email={generateMockEmail()} isLastMessage={false} />)

      // Body content should not be visible when collapsed
      expect(screen.queryByText('Hello World')).not.toBeInTheDocument()
      // Snippet should show in collapsed state
      expect(screen.getByText(/Hello World snippet/)).toBeInTheDocument()
    })

    it('should be expanded by default when is last message', () => {
      render(<ThreadMessage email={generateMockEmail()} isLastMessage={true} />)

      // Body content should be visible when expanded
      expect(screen.getByText('Hello World')).toBeInTheDocument()
    })

    it('should toggle body visibility on click', () => {
      render(<ThreadMessage email={generateMockEmail()} isLastMessage={false} />)

      // Initially collapsed - snippet visible
      expect(screen.getByText(/Hello World snippet/)).toBeInTheDocument()

      // Click to expand
      const header = screen.getByRole('button')
      fireEvent.click(header)

      // Now body should be visible
      expect(screen.getByText('Hello World')).toBeInTheDocument()
    })

    it('should toggle body visibility on Enter key', () => {
      render(<ThreadMessage email={generateMockEmail()} isLastMessage={false} />)

      const header = screen.getByRole('button')
      fireEvent.keyDown(header, { key: 'Enter' })

      // Body should now be visible
      expect(screen.getByText('Hello World')).toBeInTheDocument()
    })

    it('should toggle body visibility on Space key', () => {
      render(<ThreadMessage email={generateMockEmail()} isLastMessage={false} />)

      const header = screen.getByRole('button')
      fireEvent.keyDown(header, { key: ' ' })

      // Body should now be visible
      expect(screen.getByText('Hello World')).toBeInTheDocument()
    })
  })

  describe('Sender Display', () => {
    it('should display sender name', () => {
      render(
        <ThreadMessage
          email={generateMockEmail({ from: { name: 'Alice Johnson', email: 'alice@example.com' } })}
          isLastMessage={false}
        />
      )

      expect(screen.getByText('Alice Johnson')).toBeInTheDocument()
    })

    it('should display email when name is empty', () => {
      render(
        <ThreadMessage
          email={generateMockEmail({ from: { name: '', email: 'noreply@example.com' } })}
          isLastMessage={false}
        />
      )

      expect(screen.getByText('noreply@example.com')).toBeInTheDocument()
    })

    it('should show avatar when isFirstInGroup', () => {
      const { container } = render(
        <ThreadMessage email={generateMockEmail()} isLastMessage={false} isFirstInGroup={true} />
      )

      // Avatar should have initials
      const avatar = container.querySelector('.rounded-full')
      expect(avatar).toBeInTheDocument()
      expect(avatar).toHaveTextContent('JD') // John Doe initials
    })

    it('should hide avatar when not isFirstInGroup', () => {
      const { container } = render(
        <ThreadMessage email={generateMockEmail()} isLastMessage={false} isFirstInGroup={false} />
      )

      // Avatar should not be present
      const avatar = container.querySelector('.rounded-full.w-10')
      expect(avatar).not.toBeInTheDocument()
    })
  })

  describe('Relative Timestamp', () => {
    it('should show "Just now" for recent timestamps', () => {
      const now = Date.now()
      render(
        <ThreadMessage
          email={generateMockEmail({ timestamp: now - 30000 })} // 30 seconds ago
          isLastMessage={false}
        />
      )

      expect(screen.getByText('Just now')).toBeInTheDocument()
    })

    it('should show minutes ago', () => {
      const now = Date.now()
      render(
        <ThreadMessage
          email={generateMockEmail({ timestamp: now - 5 * 60 * 1000 })} // 5 minutes ago
          isLastMessage={false}
        />
      )

      expect(screen.getByText('5m ago')).toBeInTheDocument()
    })

    it('should show hours ago', () => {
      const now = Date.now()
      render(
        <ThreadMessage
          email={generateMockEmail({ timestamp: now - 3 * 60 * 60 * 1000 })} // 3 hours ago
          isLastMessage={false}
        />
      )

      expect(screen.getByText('3h ago')).toBeInTheDocument()
    })

    it('should show days ago', () => {
      const now = Date.now()
      render(
        <ThreadMessage
          email={generateMockEmail({ timestamp: now - 2 * 24 * 60 * 60 * 1000 })} // 2 days ago
          isLastMessage={false}
        />
      )

      expect(screen.getByText('2d ago')).toBeInTheDocument()
    })
  })

  describe('Quoted Text Integration', () => {
    it('should show quoted text toggle when email has quoted content', () => {
      const emailWithQuote = generateMockEmail({
        body: {
          text: 'My response\n\n> Previous message\n> More quoted text',
        },
      })

      render(<ThreadMessage email={emailWithQuote} isLastMessage={true} />)

      // Should show the "Show quoted text" button
      expect(screen.getByText('Show quoted text')).toBeInTheDocument()
    })

    it('should expand quoted text on click', () => {
      const emailWithQuote = generateMockEmail({
        body: {
          text: 'My response\n\n> Previous message\n> More quoted text',
        },
      })

      render(<ThreadMessage email={emailWithQuote} isLastMessage={true} />)

      // Click to show quoted text
      fireEvent.click(screen.getByText('Show quoted text'))

      // Should show "Hide quoted text" after expanding
      expect(screen.getByText('Hide quoted text')).toBeInTheDocument()
    })
  })

  describe('Attachment Rendering', () => {
    it('should display attachments when present', () => {
      const emailWithAttachment = generateMockEmail({
        attachments: [
          {
            id: 'att-1',
            filename: 'document.pdf',
            mimeType: 'application/pdf',
            size: 102400,
            isInline: false,
          },
        ],
      })

      render(<ThreadMessage email={emailWithAttachment} isLastMessage={true} />)

      expect(screen.getByText('document.pdf')).toBeInTheDocument()
      expect(screen.getByText('1 attachment')).toBeInTheDocument()
    })

    it('should display multiple attachments', () => {
      const emailWithAttachments = generateMockEmail({
        attachments: [
          {
            id: 'att-1',
            filename: 'doc1.pdf',
            mimeType: 'application/pdf',
            size: 1024,
            isInline: false,
          },
          {
            id: 'att-2',
            filename: 'image.png',
            mimeType: 'image/png',
            size: 2048,
            isInline: false,
          },
        ],
      })

      render(<ThreadMessage email={emailWithAttachments} isLastMessage={true} />)

      expect(screen.getByText('doc1.pdf')).toBeInTheDocument()
      expect(screen.getByText('image.png')).toBeInTheDocument()
      expect(screen.getByText('2 attachments')).toBeInTheDocument()
    })

    it('should call onDownloadAttachment when download clicked', () => {
      const onDownload = vi.fn()
      const attachment = {
        id: 'att-1',
        filename: 'test.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        isInline: false,
      }
      // Set accountId to undefined to force legacy callback path
      // (canDownload = Boolean(accountId && emailId) will be false)
      const emailWithAttachment = generateMockEmail({
        attachments: [attachment],
        accountId: undefined as unknown as string,
      })

      render(
        <ThreadMessage
          email={emailWithAttachment}
          isLastMessage={true}
          onDownloadAttachment={onDownload}
        />
      )

      const downloadButton = screen.getByLabelText('Download test.pdf')
      fireEvent.click(downloadButton)

      expect(onDownload).toHaveBeenCalledWith(attachment)
    })

    it('should not show inline attachments in attachment list', () => {
      const emailWithInline = generateMockEmail({
        attachments: [
          {
            id: 'att-1',
            filename: 'inline-image.png',
            mimeType: 'image/png',
            size: 1024,
            isInline: true,
          },
          {
            id: 'att-2',
            filename: 'regular.pdf',
            mimeType: 'application/pdf',
            size: 2048,
            isInline: false,
          },
        ],
      })

      render(<ThreadMessage email={emailWithInline} isLastMessage={true} />)

      expect(screen.queryByText('inline-image.png')).not.toBeInTheDocument()
      expect(screen.getByText('regular.pdf')).toBeInTheDocument()
      expect(screen.getByText('1 attachment')).toBeInTheDocument()
    })
  })

  describe('HTML Sanitization', () => {
    it('should render HTML content safely', () => {
      const emailWithHtml = generateMockEmail({
        body: {
          html: '<p>Safe content</p><script>alert("xss")</script>',
          text: 'Safe content',
        },
      })

      render(<ThreadMessage email={emailWithHtml} isLastMessage={true} />)

      // Safe content should be rendered
      expect(screen.getByText('Safe content')).toBeInTheDocument()
    })

    it('should render plain text when no HTML', () => {
      const emailPlainText = generateMockEmail({
        body: { text: 'Plain text message' },
      })

      render(<ThreadMessage email={emailPlainText} isLastMessage={true} />)

      expect(screen.getByText('Plain text message')).toBeInTheDocument()
    })
  })

  describe('Empty Body', () => {
    it('should show "No content" for empty body', () => {
      const emptyEmail = generateMockEmail({
        body: { text: '', html: '' },
      })

      render(<ThreadMessage email={emptyEmail} isLastMessage={true} />)

      expect(screen.getByText('No content')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper aria-expanded attribute', () => {
      render(<ThreadMessage email={generateMockEmail()} isLastMessage={false} />)

      const header = screen.getByRole('button')
      expect(header).toHaveAttribute('aria-expanded', 'false')

      fireEvent.click(header)
      expect(header).toHaveAttribute('aria-expanded', 'true')
    })

    it('should have proper tabIndex for keyboard navigation', () => {
      render(<ThreadMessage email={generateMockEmail()} isLastMessage={false} />)

      const header = screen.getByRole('button')
      expect(header).toHaveAttribute('tabIndex', '0')
    })
  })
})
