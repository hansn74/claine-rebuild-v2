/**
 * Unit tests for ViewModeToggle component
 *
 * Story 3.4: Priority-Based Inbox View
 * Task 7: Tests for render, toggle, tooltip, active state
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ViewModeToggle } from '../ViewModeToggle'
import { useViewModeStore } from '@/store/viewModeStore'

// Mock the viewModeStore
vi.mock('@/store/viewModeStore', () => ({
  useViewModeStore: vi.fn(),
}))

describe('ViewModeToggle', () => {
  const mockToggleViewMode = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  function setupMock(viewMode: 'chronological' | 'priority') {
    vi.mocked(useViewModeStore).mockImplementation((selector) => {
      const state = {
        viewMode,
        toggleViewMode: mockToggleViewMode,
      }
      return selector(state as never)
    })
  }

  it('renders a button', () => {
    setupMock('chronological')
    render(<ViewModeToggle />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('shows "Switch to priority view" label in chronological mode', () => {
    setupMock('chronological')
    render(<ViewModeToggle />)
    expect(screen.getByLabelText('Switch to priority view')).toBeInTheDocument()
  })

  it('shows "Switch to chronological view" label in priority mode', () => {
    setupMock('priority')
    render(<ViewModeToggle />)
    expect(screen.getByLabelText('Switch to chronological view')).toBeInTheDocument()
  })

  it('calls toggleViewMode when clicked', () => {
    setupMock('chronological')
    render(<ViewModeToggle />)
    fireEvent.click(screen.getByRole('button'))
    expect(mockToggleViewMode).toHaveBeenCalledOnce()
  })

  it('applies active styling in priority mode', () => {
    setupMock('priority')
    render(<ViewModeToggle />)
    const button = screen.getByRole('button')
    expect(button.className).toContain('text-cyan-600')
    expect(button.className).toContain('bg-cyan-50')
  })

  it('applies inactive styling in chronological mode', () => {
    setupMock('chronological')
    render(<ViewModeToggle />)
    const button = screen.getByRole('button')
    expect(button.className).toContain('text-slate-400')
    expect(button.className).not.toContain('text-cyan-600')
  })
})
