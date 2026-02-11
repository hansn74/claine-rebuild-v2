/**
 * FeedbackToastContainer Component Tests
 *
 * Story 3.6: Manual Priority Adjustment & Feedback Loop
 * Task 9: Tests for toast rendering, auto-dismiss, dismiss button
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { FeedbackToastContainer } from '../FeedbackToastContainer'
import { useFeedbackToastStore } from '@/store/feedbackToastStore'

vi.mock('lucide-react', () => ({
  Sparkles: () => <span data-testid="sparkles-icon" />,
  X: () => <span data-testid="x-icon" />,
}))

describe('FeedbackToastContainer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useFeedbackToastStore.setState({ activeToast: null })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders nothing when no toast is active', () => {
    const { container } = render(<FeedbackToastContainer />)
    expect(container.innerHTML).toBe('')
  })

  it('renders toast content when active', () => {
    useFeedbackToastStore.getState().showToast('AI learned something new', 'alice@test.com')
    render(<FeedbackToastContainer />)

    expect(screen.getByText('AI learned something new')).toBeInTheDocument()
  })

  it('dismisses toast when dismiss button is clicked', () => {
    useFeedbackToastStore.getState().showToast('Test', 'bob@test.com')
    render(<FeedbackToastContainer />)

    const dismissButton = screen.getByLabelText('Dismiss')
    fireEvent.click(dismissButton)

    expect(useFeedbackToastStore.getState().activeToast).toBeNull()
  })

  it('auto-dismisses after 5 seconds', () => {
    useFeedbackToastStore.getState().showToast('Auto dismiss test', 'carol@test.com')
    render(<FeedbackToastContainer />)

    expect(screen.getByText('Auto dismiss test')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(useFeedbackToastStore.getState().activeToast).toBeNull()
  })

  it('has accessible role and aria-live', () => {
    useFeedbackToastStore.getState().showToast('Accessible test', 'dan@test.com')
    const { baseElement } = render(<FeedbackToastContainer />)

    const toastElement = baseElement.querySelector('[role="status"]')
    expect(toastElement).toBeInTheDocument()
    expect(toastElement).toHaveAttribute('aria-live', 'polite')
  })
})
