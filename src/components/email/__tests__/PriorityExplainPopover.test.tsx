/**
 * PriorityExplainPopover Component Tests
 *
 * Story 3.5: Explainability UI — "Why This Priority?"
 * Task 6: Tests for popover rendering, positioning, and dismissal
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PriorityExplainPopover } from '../PriorityExplainPopover'
import type { Priority } from '@/services/ai/priorityDisplay'

vi.mock('@/services/ai/priorityFeedbackService', () => ({
  priorityFeedbackService: {
    recordOverride: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('@/services/ai/priorityOverride', () => ({
  clearPriorityOverride: vi.fn().mockResolvedValue(undefined),
}))

function createMockAIMetadata(overrides: Record<string, unknown> = {}) {
  return {
    triageScore: 85,
    priority: 'high' as Priority,
    suggestedAttributes: {},
    confidence: 87,
    reasoning: 'Sender is in your VIP list and subject contains deadline keywords.',
    modelVersion: 'llama-3.2-1b-v1',
    processedAt: Date.now() - 2 * 60 * 60 * 1000, // 2 hours ago
    ...overrides,
  }
}

function createMockTriggerRect(overrides: Partial<DOMRect> = {}): DOMRect {
  return {
    top: 100,
    bottom: 120,
    left: 200,
    right: 280,
    width: 80,
    height: 20,
    x: 200,
    y: 100,
    toJSON: () => ({}),
    ...overrides,
  }
}

describe('PriorityExplainPopover', () => {
  const defaultProps = {
    aiMetadata: createMockAIMetadata(),
    priority: 'high' as Priority,
    triggerRect: createMockTriggerRect(),
    onClose: vi.fn(),
    emailId: 'email-1',
    onPriorityChange: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders in a portal on document.body', () => {
    const { baseElement } = render(<PriorityExplainPopover {...defaultProps} />)
    const dialog = baseElement.querySelector('[role="dialog"]')
    expect(dialog).toBeInTheDocument()
    expect(dialog?.parentElement).toBe(document.body)
  })

  it('displays the priority label', () => {
    render(<PriorityExplainPopover {...defaultProps} />)
    const urgentElements = screen.getAllByText('Urgent')
    expect(urgentElements.length).toBeGreaterThanOrEqual(1)
  })

  it('displays the confidence percentage', () => {
    render(<PriorityExplainPopover {...defaultProps} />)
    expect(screen.getByText('87%')).toBeInTheDocument()
  })

  it('displays the reasoning text', () => {
    render(<PriorityExplainPopover {...defaultProps} />)
    expect(
      screen.getByText('Sender is in your VIP list and subject contains deadline keywords.')
    ).toBeInTheDocument()
  })

  it('displays relative timestamp', () => {
    render(<PriorityExplainPopover {...defaultProps} />)
    expect(screen.getByText('Analyzed 2 hours ago')).toBeInTheDocument()
  })

  it('displays model version', () => {
    render(<PriorityExplainPopover {...defaultProps} />)
    expect(screen.getByText('llama-3.2-1b-v1')).toBeInTheDocument()
  })

  it('shows user override message for manual overrides', () => {
    const metadata = createMockAIMetadata({
      modelVersion: 'user-override-v1',
      reasoning: 'Manually set by user',
    })
    render(<PriorityExplainPopover {...defaultProps} aiMetadata={metadata} />)
    expect(screen.getByText('You manually set this priority.')).toBeInTheDocument()
    expect(screen.getByText('Manual')).toBeInTheDocument()
  })

  it('closes on Escape key', () => {
    const onClose = vi.fn()
    render(<PriorityExplainPopover {...defaultProps} onClose={onClose} />)

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on click outside', () => {
    const onClose = vi.fn()
    render(<PriorityExplainPopover {...defaultProps} onClose={onClose} />)

    fireEvent.mouseDown(document.body)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not close on click inside popover', () => {
    const onClose = vi.fn()
    const { baseElement } = render(<PriorityExplainPopover {...defaultProps} onClose={onClose} />)

    const dialog = baseElement.querySelector('[role="dialog"]')!
    fireEvent.mouseDown(dialog)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('has accessible dialog role and label', () => {
    render(<PriorityExplainPopover {...defaultProps} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-label', 'Priority explanation')
  })

  it('renders different priority labels correctly', () => {
    const { rerender } = render(
      <PriorityExplainPopover
        {...defaultProps}
        priority="medium"
        aiMetadata={createMockAIMetadata({ priority: 'medium' })}
      />
    )
    // Header label — current priority button is disabled in the picker
    const importantButtons = screen.getAllByText('Important')
    expect(importantButtons.length).toBeGreaterThanOrEqual(1)

    rerender(
      <PriorityExplainPopover
        {...defaultProps}
        priority="low"
        aiMetadata={createMockAIMetadata({ priority: 'low' })}
      />
    )
    const updatesButtons = screen.getAllByText('Updates')
    expect(updatesButtons.length).toBeGreaterThanOrEqual(1)
  })

  it('shows "Just now" for very recent analysis', () => {
    const metadata = createMockAIMetadata({ processedAt: Date.now() - 10000 })
    render(<PriorityExplainPopover {...defaultProps} aiMetadata={metadata} />)
    expect(screen.getByText('Analyzed Just now')).toBeInTheDocument()
  })

  it('shows fallback reasoning when reasoning is empty', () => {
    const metadata = createMockAIMetadata({ reasoning: '' })
    render(<PriorityExplainPopover {...defaultProps} aiMetadata={metadata} />)
    expect(screen.getByText('No reasoning available.')).toBeInTheDocument()
  })

  it('cleans up event listeners on unmount', () => {
    const addSpy = vi.spyOn(document, 'addEventListener')
    const removeSpy = vi.spyOn(document, 'removeEventListener')

    const { unmount } = render(<PriorityExplainPopover {...defaultProps} />)

    // Should have added keydown and mousedown listeners
    const keydownAdd = addSpy.mock.calls.filter((c) => c[0] === 'keydown')
    const mousedownAdd = addSpy.mock.calls.filter((c) => c[0] === 'mousedown')
    expect(keydownAdd.length).toBeGreaterThanOrEqual(1)
    expect(mousedownAdd.length).toBeGreaterThanOrEqual(1)

    unmount()

    // Should have removed keydown and mousedown listeners
    const keydownRemove = removeSpy.mock.calls.filter((c) => c[0] === 'keydown')
    const mousedownRemove = removeSpy.mock.calls.filter((c) => c[0] === 'mousedown')
    expect(keydownRemove.length).toBeGreaterThanOrEqual(1)
    expect(mousedownRemove.length).toBeGreaterThanOrEqual(1)
  })

  // Story 3.6: Priority picker tests
  describe('Priority picker (Story 3.6)', () => {
    it('renders "Change priority" section', () => {
      render(<PriorityExplainPopover {...defaultProps} />)
      expect(screen.getByText('Change priority')).toBeInTheDocument()
    })

    it('renders all four priority buttons', () => {
      render(<PriorityExplainPopover {...defaultProps} />)
      const buttons = screen.getAllByRole('button')
      // Filter to just the priority picker buttons (aria-label starts with "Set priority to")
      const pickerButtons = buttons.filter((b) =>
        b.getAttribute('aria-label')?.startsWith('Set priority to')
      )
      expect(pickerButtons).toHaveLength(4)
    })

    it('disables the current priority button', () => {
      render(<PriorityExplainPopover {...defaultProps} priority="high" />)
      const urgentButton = screen.getByLabelText('Set priority to Urgent')
      expect(urgentButton).toBeDisabled()
    })

    it('calls recordOverride on priority selection', async () => {
      const { priorityFeedbackService } = await import('@/services/ai/priorityFeedbackService')
      const onPriorityChange = vi.fn()
      render(<PriorityExplainPopover {...defaultProps} onPriorityChange={onPriorityChange} />)

      const updatesButton = screen.getByLabelText('Set priority to Updates')
      fireEvent.click(updatesButton)

      expect(priorityFeedbackService.recordOverride).toHaveBeenCalledWith('email-1', 'low')
    })

    it('shows "Reset to AI" link for user overrides', () => {
      const metadata = createMockAIMetadata({ modelVersion: 'user-override-v1' })
      render(<PriorityExplainPopover {...defaultProps} aiMetadata={metadata} />)
      expect(screen.getByText('Reset to AI')).toBeInTheDocument()
    })

    it('does not show "Reset to AI" for AI-assigned priorities', () => {
      render(<PriorityExplainPopover {...defaultProps} />)
      expect(screen.queryByText('Reset to AI')).not.toBeInTheDocument()
    })
  })
})
