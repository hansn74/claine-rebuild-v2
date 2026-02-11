/**
 * Unit tests for PrioritySectionHeader component
 *
 * Story 3.4: Priority-Based Inbox View
 * Task 7: Tests for render, collapse toggle, accessibility, uncategorized style
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PrioritySectionHeader } from '../PrioritySectionHeader'

describe('PrioritySectionHeader', () => {
  const defaultProps = {
    sectionKey: 'high',
    priority: 'high' as const,
    count: 5,
    isCollapsed: false,
    onToggle: vi.fn(),
  }

  it('renders the priority label', () => {
    render(<PrioritySectionHeader {...defaultProps} />)
    expect(screen.getByText('Urgent')).toBeInTheDocument()
  })

  it('renders the email count', () => {
    render(<PrioritySectionHeader {...defaultProps} />)
    expect(screen.getByText('(5)')).toBeInTheDocument()
  })

  it('renders medium priority label as Important', () => {
    render(<PrioritySectionHeader {...defaultProps} priority="medium" sectionKey="medium" />)
    expect(screen.getByText('Important')).toBeInTheDocument()
  })

  it('renders low priority label as Updates', () => {
    render(<PrioritySectionHeader {...defaultProps} priority="low" sectionKey="low" />)
    expect(screen.getByText('Updates')).toBeInTheDocument()
  })

  it('renders none priority label as Low', () => {
    render(<PrioritySectionHeader {...defaultProps} priority="none" sectionKey="none" />)
    expect(screen.getByText('Low')).toBeInTheDocument()
  })

  it('renders uncategorized label', () => {
    render(
      <PrioritySectionHeader
        {...defaultProps}
        priority="uncategorized"
        sectionKey="uncategorized"
      />
    )
    expect(screen.getByText('Uncategorized')).toBeInTheDocument()
  })

  it('calls onToggle with sectionKey when clicked', () => {
    const onToggle = vi.fn()
    render(<PrioritySectionHeader {...defaultProps} onToggle={onToggle} />)

    fireEvent.click(screen.getByRole('button'))
    expect(onToggle).toHaveBeenCalledWith('high')
  })

  it('calls onToggle on Enter keydown', () => {
    const onToggle = vi.fn()
    render(<PrioritySectionHeader {...defaultProps} onToggle={onToggle} />)

    fireEvent.keyDown(screen.getByRole('button'), { key: 'Enter' })
    expect(onToggle).toHaveBeenCalledWith('high')
  })

  it('calls onToggle on Space keydown', () => {
    const onToggle = vi.fn()
    render(<PrioritySectionHeader {...defaultProps} onToggle={onToggle} />)

    fireEvent.keyDown(screen.getByRole('button'), { key: ' ' })
    expect(onToggle).toHaveBeenCalledWith('high')
  })

  describe('accessibility', () => {
    it('has role="button"', () => {
      render(<PrioritySectionHeader {...defaultProps} />)
      expect(screen.getByRole('button')).toBeInTheDocument()
    })

    it('has aria-expanded=true when not collapsed', () => {
      render(<PrioritySectionHeader {...defaultProps} isCollapsed={false} />)
      expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'true')
    })

    it('has aria-expanded=false when collapsed', () => {
      render(<PrioritySectionHeader {...defaultProps} isCollapsed={true} />)
      expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false')
    })

    it('has tabIndex=0 for keyboard focus', () => {
      render(<PrioritySectionHeader {...defaultProps} />)
      expect(screen.getByRole('button')).toHaveAttribute('tabindex', '0')
    })
  })

  // Story 3.6: Drop zone tests
  describe('Drop zone (Story 3.6)', () => {
    it('calls onEmailDrop when email is dropped', () => {
      const onEmailDrop = vi.fn()
      render(<PrioritySectionHeader {...defaultProps} onEmailDrop={onEmailDrop} />)

      const header = screen.getByRole('button')

      fireEvent.dragOver(header, {
        dataTransfer: { dropEffect: '' },
        preventDefault: vi.fn(),
      })

      fireEvent.drop(header, {
        dataTransfer: { getData: () => 'email-42' },
        preventDefault: vi.fn(),
      })

      expect(onEmailDrop).toHaveBeenCalledWith('email-42')
    })

    it('shows visual feedback during dragover', () => {
      const onEmailDrop = vi.fn()
      render(<PrioritySectionHeader {...defaultProps} onEmailDrop={onEmailDrop} />)

      const header = screen.getByRole('button')

      fireEvent.dragOver(header, {
        dataTransfer: { dropEffect: '' },
        preventDefault: vi.fn(),
      })

      expect(header.className).toContain('ring-2')
    })

    it('removes visual feedback on dragleave', () => {
      const onEmailDrop = vi.fn()
      render(<PrioritySectionHeader {...defaultProps} onEmailDrop={onEmailDrop} />)

      const header = screen.getByRole('button')

      fireEvent.dragOver(header, {
        dataTransfer: { dropEffect: '' },
        preventDefault: vi.fn(),
      })

      fireEvent.dragLeave(header)

      expect(header.className).not.toContain('ring-2')
    })

    it('does not show drop indicator when onEmailDrop is not provided', () => {
      render(<PrioritySectionHeader {...defaultProps} />)

      const header = screen.getByRole('button')

      fireEvent.dragOver(header, {
        dataTransfer: { dropEffect: '' },
        preventDefault: vi.fn(),
      })

      expect(header.className).not.toContain('ring-2')
    })
  })
})
