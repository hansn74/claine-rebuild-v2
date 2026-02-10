/**
 * PriorityBadge Component Tests
 *
 * Story 3.3: Priority Scoring Model
 * Task 9: PriorityBadge render tests
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PriorityBadge } from '../PriorityBadge'

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
})
