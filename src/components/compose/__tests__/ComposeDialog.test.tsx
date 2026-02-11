/**
 * ComposeDialog Component Tests
 *
 * Story 2.3: Compose & Reply Interface
 * Task 10: Testing
 *
 * Tests for compose dialog modes, keyboard shortcuts, and form submission
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ComposeDialog, type ComposeContext } from '../ComposeDialog'

// Mock the RichTextEditor component
vi.mock('../RichTextEditor', () => ({
  RichTextEditor: ({
    onChange,
    placeholder,
  }: {
    content: string
    onChange: (html: string, text: string) => void
    placeholder?: string
  }) => (
    <div data-testid="rich-text-editor">
      <textarea
        placeholder={placeholder}
        onChange={(e) => onChange(`<p>${e.target.value}</p>`, e.target.value)}
        data-testid="editor-textarea"
      />
    </div>
  ),
}))

// Mock the RecipientInput component
vi.mock('../RecipientInput', () => ({
  RecipientInput: ({
    label,
    value,
    onChange,
    placeholder,
  }: {
    label: string
    value: Array<{ name: string; email: string }>
    onChange: (recipients: Array<{ name: string; email: string }>) => void
    placeholder?: string
    autoFocus?: boolean
  }) => (
    <div data-testid={`recipient-input-${label.toLowerCase()}`}>
      <label>{label}</label>
      <input
        placeholder={placeholder}
        data-testid={`recipient-${label.toLowerCase()}-input`}
        onChange={(e) => {
          if (e.target.value.includes('@')) {
            onChange([...value, { name: '', email: e.target.value }])
            e.target.value = ''
          }
        }}
      />
      {value.map((v, i) => (
        <span key={i} data-testid={`chip-${v.email}`}>
          {v.name || v.email}
        </span>
      ))}
    </div>
  ),
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

// Mock useDraft hook
vi.mock('@/hooks/useDraft', () => ({
  useDraft: vi.fn(() => ({
    draft: null,
    draftId: null,
    isLoading: false,
    createDraft: vi.fn().mockResolvedValue('mock-draft-id'),
    updateDraft: vi.fn().mockResolvedValue(undefined),
    deleteDraft: vi.fn().mockResolvedValue(undefined),
  })),
}))

describe('ComposeDialog', () => {
  const mockOnClose = vi.fn()
  const mockOnSend = vi.fn()
  const mockOnDeleteDraft = vi.fn()

  const defaultProps = {
    open: true,
    onClose: mockOnClose,
    accountId: 'account-123',
    onSend: mockOnSend,
    onDeleteDraft: mockOnDeleteDraft,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockOnSend.mockResolvedValue(undefined)
  })

  afterEach(() => {
    cleanup()
  })

  describe('rendering', () => {
    it('should not render when closed', () => {
      render(<ComposeDialog {...defaultProps} open={false} />)

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    it('should render when open', () => {
      render(<ComposeDialog {...defaultProps} />)

      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('should show "New Message" title for new compose', () => {
      render(<ComposeDialog {...defaultProps} />)

      expect(screen.getByText('New Message')).toBeInTheDocument()
    })

    it('should show "Reply" title for reply context', () => {
      const replyContext: ComposeContext = {
        type: 'reply',
        to: [{ name: 'John', email: 'john@example.com' }],
        cc: [],
        subject: 'Re: Test',
        quotedContent: '',
      }

      render(<ComposeDialog {...defaultProps} initialContext={replyContext} />)

      expect(screen.getByText('Reply')).toBeInTheDocument()
    })

    it('should show "Reply All" title for reply-all context', () => {
      const replyAllContext: ComposeContext = {
        type: 'reply-all',
        to: [{ name: 'John', email: 'john@example.com' }],
        cc: [{ name: 'Jane', email: 'jane@example.com' }],
        subject: 'Re: Test',
        quotedContent: '',
      }

      render(<ComposeDialog {...defaultProps} initialContext={replyAllContext} />)

      expect(screen.getByText('Reply All')).toBeInTheDocument()
    })

    it('should show "Forward" title for forward context', () => {
      const forwardContext: ComposeContext = {
        type: 'forward',
        to: [],
        cc: [],
        subject: 'Fwd: Test',
        quotedContent: '',
      }

      render(<ComposeDialog {...defaultProps} initialContext={forwardContext} />)

      expect(screen.getByText('Forward')).toBeInTheDocument()
    })

    it('should render recipient input', () => {
      render(<ComposeDialog {...defaultProps} />)

      expect(screen.getByTestId('recipient-input-to')).toBeInTheDocument()
    })

    it('should render subject input', () => {
      render(<ComposeDialog {...defaultProps} />)

      expect(screen.getByPlaceholderText('Subject')).toBeInTheDocument()
    })

    it('should render Send button', () => {
      render(<ComposeDialog {...defaultProps} />)

      expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument()
    })

    it('should render discard button', () => {
      render(<ComposeDialog {...defaultProps} />)

      expect(screen.getByRole('button', { name: /discard draft/i })).toBeInTheDocument()
    })
  })

  describe('mode controls', () => {
    it('should have minimize button', () => {
      render(<ComposeDialog {...defaultProps} />)

      expect(screen.getByRole('button', { name: /minimize/i })).toBeInTheDocument()
    })

    it('should have fullscreen button', () => {
      render(<ComposeDialog {...defaultProps} />)

      expect(screen.getByRole('button', { name: /fullscreen/i })).toBeInTheDocument()
    })

    it('should have close button', () => {
      render(<ComposeDialog {...defaultProps} />)

      const closeButtons = screen.getAllByRole('button', { name: /close/i })
      expect(closeButtons.length).toBeGreaterThan(0)
    })

    it('should show minimized state when minimize clicked', async () => {
      const user = userEvent.setup()
      render(<ComposeDialog {...defaultProps} />)

      await user.click(screen.getByRole('button', { name: /minimize/i }))

      // In minimized state, should show subject as title
      expect(screen.getByText('New Message')).toBeInTheDocument()
    })

    it('should call onClose when close button clicked', async () => {
      const user = userEvent.setup()
      render(<ComposeDialog {...defaultProps} />)

      const closeButtons = screen.getAllByRole('button', { name: /close/i })
      await user.click(closeButtons[0])

      expect(mockOnClose).toHaveBeenCalled()
    })
  })

  describe('keyboard shortcuts', () => {
    it('should close on Escape key', async () => {
      const user = userEvent.setup()
      render(<ComposeDialog {...defaultProps} />)

      await user.keyboard('{Escape}')

      expect(mockOnClose).toHaveBeenCalled()
    })
  })

  describe('form state', () => {
    it('should populate subject from initial context', () => {
      const context: ComposeContext = {
        type: 'reply',
        to: [{ name: 'John Doe', email: 'john@example.com' }],
        cc: [],
        subject: 'Re: Test Subject',
        quotedContent: '<p>Quoted content</p>',
      }

      render(<ComposeDialog {...defaultProps} initialContext={context} />)

      expect(screen.getByDisplayValue('Re: Test Subject')).toBeInTheDocument()
    })

    it('should show Cc/Bcc button when no cc recipients', () => {
      render(<ComposeDialog {...defaultProps} />)

      expect(screen.getByText('Cc/Bcc')).toBeInTheDocument()
    })

    it('should show Cc/Bcc fields when button clicked', async () => {
      const user = userEvent.setup()
      render(<ComposeDialog {...defaultProps} />)

      await user.click(screen.getByText('Cc/Bcc'))

      expect(screen.getByTestId('recipient-input-cc')).toBeInTheDocument()
      expect(screen.getByTestId('recipient-input-bcc')).toBeInTheDocument()
    })

    it('should show Cc/Bcc fields when context has cc recipients', () => {
      const context: ComposeContext = {
        type: 'reply-all',
        to: [{ name: 'John', email: 'john@example.com' }],
        cc: [{ name: 'Jane', email: 'jane@example.com' }],
        subject: 'Test',
        quotedContent: '',
      }

      render(<ComposeDialog {...defaultProps} initialContext={context} />)

      expect(screen.getByTestId('recipient-input-cc')).toBeInTheDocument()
    })
  })

  describe('send functionality', () => {
    it('should disable Send button when no recipients', () => {
      render(<ComposeDialog {...defaultProps} />)

      const sendButton = screen.getByRole('button', { name: /send/i })
      expect(sendButton).toBeDisabled()
    })
  })

  describe('delete draft', () => {
    it('should call onDeleteDraft and onClose when discard clicked', async () => {
      const user = userEvent.setup()
      render(<ComposeDialog {...defaultProps} />)

      const discardButton = screen.getByRole('button', { name: /discard draft/i })
      await user.click(discardButton)

      expect(mockOnDeleteDraft).toHaveBeenCalled()
      expect(mockOnClose).toHaveBeenCalled()
    })
  })

  describe('saving indicator', () => {
    it('should not show "Saving..." without user edits', () => {
      // Saving indicator only shows after user has edited
      render(<ComposeDialog {...defaultProps} isSaving={true} />)

      // Saving text should not appear when no edits have been made
      expect(screen.queryByText('Saving...')).not.toBeInTheDocument()
    })

    it('should not show last saved time without user edits', () => {
      const lastSaved = new Date()
      render(<ComposeDialog {...defaultProps} lastSaved={lastSaved} />)

      // Saved text should not appear when no edits have been made
      expect(screen.queryByText(/saved/i)).not.toBeInTheDocument()
    })
  })

  describe('backdrop', () => {
    it('should render backdrop in floating mode', () => {
      render(<ComposeDialog {...defaultProps} />)

      // Check backdrop exists (has aria-hidden="true")
      const backdrop = document.querySelector('[aria-hidden="true"]')
      expect(backdrop).toBeInTheDocument()
    })

    it('should close when backdrop clicked', async () => {
      const user = userEvent.setup()
      render(<ComposeDialog {...defaultProps} />)

      const backdrop = document.querySelector('[aria-hidden="true"]')
      if (backdrop) {
        await user.click(backdrop)
      }

      expect(mockOnClose).toHaveBeenCalled()
    })
  })

  describe('keyboard shortcut hint', () => {
    it('should show keyboard shortcut for send', () => {
      render(<ComposeDialog {...defaultProps} />)

      // Should show +Enter in the UI
      const shortcutText = screen.getByText(/\+Enter/i)
      expect(shortcutText).toBeInTheDocument()
    })
  })

  describe('rich text editor', () => {
    it('should render rich text editor', () => {
      render(<ComposeDialog {...defaultProps} />)

      expect(screen.getByTestId('rich-text-editor')).toBeInTheDocument()
    })
  })
})
