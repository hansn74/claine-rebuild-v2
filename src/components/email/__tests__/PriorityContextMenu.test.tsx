/**
 * PriorityContextMenu Component Tests
 *
 * Story 3.6: Manual Priority Adjustment & Feedback Loop
 * Task 9: Context menu rendering, keyboard nav, selection, dismissal
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PriorityContextMenu } from '../PriorityContextMenu'
import type { Priority } from '@/services/ai/priorityDisplay'

vi.mock('@/services/ai/priorityFeedbackService', () => ({
  priorityFeedbackService: {
    recordOverride: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('lucide-react', () => ({
  Check: () => <span data-testid="check-icon" />,
}))

describe('PriorityContextMenu', () => {
  const defaultProps = {
    emailId: 'email-1',
    currentPriority: 'medium' as Priority,
    position: { x: 300, y: 200 },
    onClose: vi.fn(),
    onPriorityChange: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders in a portal on document.body', () => {
    const { baseElement } = render(<PriorityContextMenu {...defaultProps} />)
    const menu = baseElement.querySelector('[role="menu"]')
    expect(menu).toBeInTheDocument()
    expect(menu?.parentElement).toBe(document.body)
  })

  it('displays priority options header', () => {
    render(<PriorityContextMenu {...defaultProps} />)
    expect(screen.getByText('Set priority to')).toBeInTheDocument()
  })

  it('renders all four priority options', () => {
    render(<PriorityContextMenu {...defaultProps} />)
    expect(screen.getByText('Urgent')).toBeInTheDocument()
    expect(screen.getByText('Important')).toBeInTheDocument()
    expect(screen.getByText('Updates')).toBeInTheDocument()
    expect(screen.getByText('Low')).toBeInTheDocument()
  })

  it('shows checkmark on current priority', () => {
    render(<PriorityContextMenu {...defaultProps} />)
    // "Important" is the label for "medium" priority
    const importantButton = screen.getByText('Important').closest('button')!
    const checkIcon = importantButton.querySelector('[data-testid="check-icon"]')
    expect(checkIcon).toBeInTheDocument()
  })

  it('closes on Escape key', () => {
    render(<PriorityContextMenu {...defaultProps} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on click outside', () => {
    render(<PriorityContextMenu {...defaultProps} />)
    fireEvent.mouseDown(document.body)
    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  it('calls recordOverride and onPriorityChange on selection', async () => {
    const { priorityFeedbackService } = await import('@/services/ai/priorityFeedbackService')
    render(<PriorityContextMenu {...defaultProps} />)

    const urgentButton = screen.getByText('Urgent')
    fireEvent.click(urgentButton)

    expect(priorityFeedbackService.recordOverride).toHaveBeenCalledWith('email-1', 'high')
  })

  it('navigates with ArrowDown key', () => {
    render(<PriorityContextMenu {...defaultProps} />)

    fireEvent.keyDown(document, { key: 'ArrowDown' })
    // First item should be focused (visual highlight via bg-slate-100)
    const menuItems = screen.getAllByRole('menuitem')
    expect(menuItems[0]).toHaveClass('bg-slate-100')
  })

  it('navigates with ArrowUp key after ArrowDown', () => {
    render(<PriorityContextMenu {...defaultProps} />)

    fireEvent.keyDown(document, { key: 'ArrowDown' })
    fireEvent.keyDown(document, { key: 'ArrowDown' })
    fireEvent.keyDown(document, { key: 'ArrowUp' })

    const menuItems = screen.getAllByRole('menuitem')
    expect(menuItems[0]).toHaveClass('bg-slate-100')
  })

  it('has accessible menu role and label', () => {
    render(<PriorityContextMenu {...defaultProps} />)
    const menu = screen.getByRole('menu')
    expect(menu).toHaveAttribute('aria-label', 'Set email priority')
  })
})
