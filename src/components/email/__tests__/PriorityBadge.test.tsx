/**
 * PriorityBadge Component Tests
 *
 * Story 3.3: Priority Scoring Model
 * Task 9: PriorityBadge render tests
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PriorityBadge } from '../PriorityBadge'
import type { Priority } from '@/services/ai/priorityDisplay'

function createMockAIMetadata(overrides: Record<string, unknown> = {}) {
  return {
    triageScore: 85,
    priority: 'high' as Priority,
    suggestedAttributes: {},
    confidence: 87,
    reasoning: 'Test reasoning',
    modelVersion: 'test-model-v1',
    processedAt: Date.now() - 3600000,
    ...overrides,
  }
}

describe('PriorityBadge', () => {
  it('renders high priority as "Urgent"', () => {
    render(<PriorityBadge priority="high" />)
    expect(screen.getByText('Urgent')).toBeInTheDocument()
  })

  it('renders medium priority as "Important"', () => {
    render(<PriorityBadge priority="medium" />)
    expect(screen.getByText('Important')).toBeInTheDocument()
  })

  it('renders low priority as "Updates"', () => {
    render(<PriorityBadge priority="low" />)
    expect(screen.getByText('Updates')).toBeInTheDocument()
  })

  it('renders none priority as "Low"', () => {
    render(<PriorityBadge priority="none" />)
    expect(screen.getByText('Low')).toBeInTheDocument()
  })

  it('renders nothing for undefined priority', () => {
    const { container } = render(<PriorityBadge priority={undefined} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing for null priority', () => {
    const { container } = render(<PriorityBadge priority={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('has aria-label for accessibility', () => {
    render(<PriorityBadge priority="high" />)
    expect(screen.getByLabelText('Priority: Urgent')).toBeInTheDocument()
  })

  it('has title with description', () => {
    render(<PriorityBadge priority="high" />)
    const badge = screen.getByText('Urgent')
    expect(badge).toHaveAttribute('title', 'Requires immediate attention')
  })

  it('applies custom className', () => {
    render(<PriorityBadge priority="high" className="ml-2" />)
    const badge = screen.getByText('Urgent')
    expect(badge.className).toContain('ml-2')
  })

  it('applies correct Tailwind classes for each priority', () => {
    const { rerender } = render(<PriorityBadge priority="high" />)
    expect(screen.getByText('Urgent').className).toContain('bg-red-100')
    expect(screen.getByText('Urgent').className).toContain('text-red-600')

    rerender(<PriorityBadge priority="medium" />)
    expect(screen.getByText('Important').className).toContain('bg-amber-100')

    rerender(<PriorityBadge priority="low" />)
    expect(screen.getByText('Updates').className).toContain('bg-blue-100')

    rerender(<PriorityBadge priority="none" />)
    expect(screen.getByText('Low').className).toContain('bg-gray-100')
  })

  describe('Interactive mode (with aiMetadata)', () => {
    it('renders as a span when aiMetadata is not provided', () => {
      render(<PriorityBadge priority="high" />)
      const badge = screen.getByText('Urgent')
      expect(badge.tagName).toBe('SPAN')
    })

    it('renders as a button when aiMetadata is provided', () => {
      render(<PriorityBadge priority="high" aiMetadata={createMockAIMetadata()} />)
      const badge = screen.getByText('Urgent')
      expect(badge.tagName).toBe('BUTTON')
    })

    it('has interactive aria-label when aiMetadata provided', () => {
      render(<PriorityBadge priority="high" aiMetadata={createMockAIMetadata()} />)
      expect(screen.getByLabelText('Priority: Urgent. Click for details')).toBeInTheDocument()
    })

    it('opens popover on click', () => {
      render(<PriorityBadge priority="high" aiMetadata={createMockAIMetadata()} />)
      const badge = screen.getByText('Urgent')
      fireEvent.click(badge)
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('opens popover on Enter key', () => {
      render(<PriorityBadge priority="high" aiMetadata={createMockAIMetadata()} />)
      const badge = screen.getByText('Urgent')
      fireEvent.keyDown(badge, { key: 'Enter' })
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('opens popover on Space key', () => {
      render(<PriorityBadge priority="high" aiMetadata={createMockAIMetadata()} />)
      const badge = screen.getByText('Urgent')
      fireEvent.keyDown(badge, { key: ' ' })
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('calls stopPropagation on click to prevent EmailRow click', () => {
      const parentClickHandler = vi.fn()
      render(
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
        <div onClick={parentClickHandler}>
          <PriorityBadge priority="high" aiMetadata={createMockAIMetadata()} />
        </div>
      )
      const badge = screen.getByText('Urgent')
      fireEvent.click(badge)
      expect(parentClickHandler).not.toHaveBeenCalled()
    })

    it('has aria-expanded and aria-haspopup attributes', () => {
      render(<PriorityBadge priority="high" aiMetadata={createMockAIMetadata()} />)
      const badge = screen.getByText('Urgent')
      expect(badge).toHaveAttribute('aria-expanded', 'false')
      expect(badge).toHaveAttribute('aria-haspopup', 'dialog')

      fireEvent.click(badge)
      expect(badge).toHaveAttribute('aria-expanded', 'true')
    })
  })
})
