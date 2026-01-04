/**
 * RecipientInput Component Tests
 *
 * Story 2.3: Compose & Reply Interface
 * Task 10: Testing
 *
 * Tests for email recipient input with validation and autocomplete
 */

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RecipientInput } from '../RecipientInput'
import type { EmailAddress } from '@/services/database/schemas/email.schema'

// Mock logger
vi.mock('@/services/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe('RecipientInput', () => {
  const mockOnChange = vi.fn()
  const defaultProps = {
    label: 'To',
    value: [] as EmailAddress[],
    onChange: mockOnChange,
    placeholder: 'Add recipients',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('should render with label', () => {
      render(<RecipientInput {...defaultProps} />)

      expect(screen.getByText('To')).toBeInTheDocument()
    })

    it('should render placeholder when empty', () => {
      render(<RecipientInput {...defaultProps} />)

      expect(screen.getByPlaceholderText('Add recipients')).toBeInTheDocument()
    })

    it('should render existing recipients as chips', () => {
      const recipients: EmailAddress[] = [
        { name: 'John Doe', email: 'john@example.com' },
        { name: '', email: 'jane@example.com' },
      ]

      render(<RecipientInput {...defaultProps} value={recipients} />)

      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('jane@example.com')).toBeInTheDocument()
    })

    it('should display email in chip when name is empty', () => {
      const recipients: EmailAddress[] = [{ name: '', email: 'test@example.com' }]

      render(<RecipientInput {...defaultProps} value={recipients} />)

      expect(screen.getByText('test@example.com')).toBeInTheDocument()
    })
  })

  describe('email validation', () => {
    it('should accept valid email on Enter', async () => {
      const user = userEvent.setup()
      render(<RecipientInput {...defaultProps} />)

      const input = screen.getByPlaceholderText('Add recipients')
      await user.type(input, 'valid@example.com')
      await user.keyboard('{Enter}')

      expect(mockOnChange).toHaveBeenCalledWith([{ name: '', email: 'valid@example.com' }])
    })

    it('should accept valid email on Tab', async () => {
      const user = userEvent.setup()
      render(<RecipientInput {...defaultProps} />)

      const input = screen.getByPlaceholderText('Add recipients')
      await user.type(input, 'valid@example.com')
      await user.keyboard('{Tab}')

      expect(mockOnChange).toHaveBeenCalledWith([{ name: '', email: 'valid@example.com' }])
    })

    it('should accept valid email on comma', async () => {
      const user = userEvent.setup()
      render(<RecipientInput {...defaultProps} />)

      const input = screen.getByPlaceholderText('Add recipients')
      await user.type(input, 'valid@example.com,')

      expect(mockOnChange).toHaveBeenCalledWith([{ name: '', email: 'valid@example.com' }])
    })

    it('should show error for invalid email', async () => {
      const user = userEvent.setup()
      render(<RecipientInput {...defaultProps} />)

      const input = screen.getByPlaceholderText('Add recipients')
      await user.type(input, 'invalid-email@')
      await user.keyboard('{Enter}')

      expect(screen.getByText('Invalid email address')).toBeInTheDocument()
      expect(mockOnChange).not.toHaveBeenCalled()
    })

    it('should accept "Name <email>" format', async () => {
      const user = userEvent.setup()
      render(<RecipientInput {...defaultProps} />)

      const input = screen.getByPlaceholderText('Add recipients')
      await user.type(input, 'John Doe <john@example.com>')
      await user.keyboard('{Enter}')

      expect(mockOnChange).toHaveBeenCalledWith([{ name: 'John Doe', email: 'john@example.com' }])
    })

    it('should convert email to lowercase', async () => {
      const user = userEvent.setup()
      render(<RecipientInput {...defaultProps} />)

      const input = screen.getByPlaceholderText('Add recipients')
      await user.type(input, 'John@EXAMPLE.COM')
      await user.keyboard('{Enter}')

      expect(mockOnChange).toHaveBeenCalledWith([{ name: '', email: 'john@example.com' }])
    })

    it('should prevent duplicate recipients', async () => {
      const user = userEvent.setup()
      const existingRecipients: EmailAddress[] = [{ name: 'John', email: 'john@example.com' }]

      render(<RecipientInput {...defaultProps} value={existingRecipients} />)

      const input = screen.getByRole('textbox')
      await user.type(input, 'john@example.com')
      await user.keyboard('{Enter}')

      expect(screen.getByText('Recipient already added')).toBeInTheDocument()
    })
  })

  describe('chip removal', () => {
    it('should remove recipient when clicking X button', async () => {
      const user = userEvent.setup()
      const recipients: EmailAddress[] = [{ name: 'John Doe', email: 'john@example.com' }]

      render(<RecipientInput {...defaultProps} value={recipients} />)

      const removeButton = screen.getByRole('button', { name: /remove john doe/i })
      await user.click(removeButton)

      expect(mockOnChange).toHaveBeenCalledWith([])
    })

    it('should remove last recipient on Backspace with empty input', async () => {
      const user = userEvent.setup()
      const recipients: EmailAddress[] = [
        { name: 'John', email: 'john@example.com' },
        { name: 'Jane', email: 'jane@example.com' },
      ]

      render(<RecipientInput {...defaultProps} value={recipients} />)

      const input = screen.getByRole('textbox')
      await user.click(input)
      await user.keyboard('{Backspace}')

      expect(mockOnChange).toHaveBeenCalledWith([{ name: 'John', email: 'john@example.com' }])
    })
  })

  describe('autocomplete', () => {
    const contacts: EmailAddress[] = [
      { name: 'Alice Anderson', email: 'alice@example.com' },
      { name: 'Bob Baker', email: 'bob@example.com' },
      { name: 'Carol Chen', email: 'carol@example.com' },
    ]

    it('should show filtered contacts in dropdown', async () => {
      const user = userEvent.setup()
      render(<RecipientInput {...defaultProps} contacts={contacts} />)

      const input = screen.getByPlaceholderText('Add recipients')
      await user.type(input, 'alice')

      await waitFor(() => {
        expect(screen.getByText('Alice Anderson')).toBeInTheDocument()
      })
    })

    it('should filter contacts by email', async () => {
      const user = userEvent.setup()
      render(<RecipientInput {...defaultProps} contacts={contacts} />)

      const input = screen.getByPlaceholderText('Add recipients')
      await user.type(input, 'bob@')

      await waitFor(() => {
        expect(screen.getByText('Bob Baker')).toBeInTheDocument()
      })
    })

    it('should select contact with keyboard navigation', async () => {
      const user = userEvent.setup()
      render(<RecipientInput {...defaultProps} contacts={contacts} />)

      const input = screen.getByPlaceholderText('Add recipients')
      await user.type(input, 'a')
      await user.keyboard('{ArrowDown}')
      await user.keyboard('{Enter}')

      expect(mockOnChange).toHaveBeenCalled()
    })

    it('should close dropdown on Escape', async () => {
      const user = userEvent.setup()
      render(<RecipientInput {...defaultProps} contacts={contacts} />)

      const input = screen.getByPlaceholderText('Add recipients')
      await user.type(input, 'alice')

      await waitFor(() => {
        expect(screen.getByText('Alice Anderson')).toBeInTheDocument()
      })

      await user.keyboard('{Escape}')

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /alice/i })).not.toBeInTheDocument()
      })
    })
  })

  describe('accessibility', () => {
    it('should have accessible remove buttons', () => {
      const recipients: EmailAddress[] = [{ name: 'John Doe', email: 'john@example.com' }]

      render(<RecipientInput {...defaultProps} value={recipients} />)

      const removeButton = screen.getByRole('button', { name: /remove john doe/i })
      expect(removeButton).toBeInTheDocument()
    })

    it('should auto-focus input when autoFocus is true', async () => {
      // eslint-disable-next-line jsx-a11y/no-autofocus -- Testing autoFocus behavior
      render(<RecipientInput {...defaultProps} autoFocus />)

      await waitFor(() => {
        expect(screen.getByRole('textbox')).toHaveFocus()
      })
    })
  })
})
