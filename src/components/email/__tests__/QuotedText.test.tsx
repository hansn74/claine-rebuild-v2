/**
 * QuotedText Component Tests
 *
 * Story 2.2: Thread Detail View with Conversation History
 * Task 11: Testing & Performance
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QuotedText } from '../QuotedText'

// Mock DOMPurify
vi.mock('dompurify', () => ({
  default: {
    sanitize: vi.fn((html) => html),
    addHook: vi.fn(),
  },
}))

describe('QuotedText', () => {
  describe('Rendering', () => {
    it('should render nothing when content is empty', () => {
      const { container } = render(<QuotedText content="" isHtml={false} />)
      expect(container.firstChild).toBeNull()
    })

    it('should render collapsed by default with toggle button', () => {
      render(<QuotedText content="Some quoted text" isHtml={false} />)

      expect(screen.getByRole('button')).toHaveTextContent('Show quoted text')
      expect(screen.queryByText('Some quoted text')).not.toBeInTheDocument()
    })

    it('should expand when toggle button is clicked', () => {
      render(<QuotedText content="Some quoted text" isHtml={false} />)

      const toggleButton = screen.getByRole('button')
      fireEvent.click(toggleButton)

      expect(screen.getByText('Hide quoted text')).toBeInTheDocument()
      expect(screen.getByText('Some quoted text')).toBeInTheDocument()
    })

    it('should collapse when toggle button is clicked again', () => {
      render(<QuotedText content="Some quoted text" isHtml={false} />)

      const toggleButton = screen.getByRole('button')
      fireEvent.click(toggleButton) // Expand
      fireEvent.click(toggleButton) // Collapse

      expect(screen.getByText('Show quoted text')).toBeInTheDocument()
      expect(screen.queryByText('Some quoted text')).not.toBeInTheDocument()
    })
  })

  describe('HTML Content', () => {
    it('should render HTML content when isHtml is true', () => {
      render(<QuotedText content="<p>HTML content</p>" isHtml={true} />)

      fireEvent.click(screen.getByRole('button'))

      // HTML is rendered in a prose div
      expect(screen.getByText('HTML content')).toBeInTheDocument()
    })
  })

  describe('Plain Text Content', () => {
    it('should render plain text content in pre tag when isHtml is false', () => {
      render(<QuotedText content="Plain text content" isHtml={false} />)

      fireEvent.click(screen.getByRole('button'))

      const preElement = screen.getByText('Plain text content').closest('pre')
      expect(preElement).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have aria-expanded attribute', () => {
      render(<QuotedText content="Some quoted text" isHtml={false} />)

      const toggleButton = screen.getByRole('button')
      expect(toggleButton).toHaveAttribute('aria-expanded', 'false')

      fireEvent.click(toggleButton)
      expect(toggleButton).toHaveAttribute('aria-expanded', 'true')
    })

    it('should handle keyboard navigation', () => {
      render(<QuotedText content="Some quoted text" isHtml={false} />)

      const toggleButton = screen.getByRole('button')
      fireEvent.keyDown(toggleButton, { key: 'Enter' })

      expect(screen.getByText('Hide quoted text')).toBeInTheDocument()
    })

    it('should handle space key', () => {
      render(<QuotedText content="Some quoted text" isHtml={false} />)

      const toggleButton = screen.getByRole('button')
      fireEvent.keyDown(toggleButton, { key: ' ' })

      expect(screen.getByText('Hide quoted text')).toBeInTheDocument()
    })
  })

  describe('Custom Label', () => {
    it('should use custom label when provided', () => {
      render(
        <QuotedText content="Some quoted text" isHtml={false} label="Show previous messages" />
      )

      expect(screen.getByText('Show previous messages')).toBeInTheDocument()
    })
  })
})
