/**
 * BankruptcyNotification Component Tests
 *
 * Story 1.16: Sync Bankruptcy Detection
 * AC 15: User notification shown during bankruptcy recovery
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { Subject } from 'rxjs'
import type { BankruptcyEvent } from '@/services/sync/syncBankruptcy'

const mockEvents$ = new Subject<BankruptcyEvent>()

vi.mock('@/services/sync/syncBankruptcy', () => ({
  syncBankruptcy: {
    getEvents$: () => mockEvents$.asObservable(),
  },
}))

import { BankruptcyNotification } from '../BankruptcyNotification'

describe('BankruptcyNotification', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should render nothing when no event has fired', () => {
    const { container } = render(<BankruptcyNotification />)
    expect(container.innerHTML).toBe('')
  })

  it('should show notification when bankruptcy event fires', () => {
    render(<BankruptcyNotification />)

    act(() => {
      mockEvents$.next({
        accountId: 'gmail:test@example.com',
        provider: 'gmail',
        reason: 'Fresh sync reset: 500 emails cleared',
        timestamp: Date.now(),
      })
    })

    expect(screen.getByTestId('bankruptcy-notification')).toBeInTheDocument()
    expect(screen.getByText(/Syncing fresh copy/)).toBeInTheDocument()
  })

  it('should dismiss when dismiss button is clicked', () => {
    render(<BankruptcyNotification />)

    act(() => {
      mockEvents$.next({
        accountId: 'gmail:test@example.com',
        provider: 'gmail',
        reason: 'test',
        timestamp: Date.now(),
      })
    })

    expect(screen.getByTestId('bankruptcy-notification')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('bankruptcy-notification-dismiss'))

    expect(screen.queryByTestId('bankruptcy-notification')).not.toBeInTheDocument()
  })

  it('should auto-dismiss after 15 seconds', () => {
    render(<BankruptcyNotification />)

    act(() => {
      mockEvents$.next({
        accountId: 'gmail:test@example.com',
        provider: 'gmail',
        reason: 'test',
        timestamp: Date.now(),
      })
    })

    expect(screen.getByTestId('bankruptcy-notification')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(15_000)
    })

    expect(screen.queryByTestId('bankruptcy-notification')).not.toBeInTheDocument()
  })

  it('should have correct accessibility attributes', () => {
    render(<BankruptcyNotification />)

    act(() => {
      mockEvents$.next({
        accountId: 'gmail:test@example.com',
        provider: 'gmail',
        reason: 'test',
        timestamp: Date.now(),
      })
    })

    const statusElement = screen.getByRole('status')
    expect(statusElement).toHaveAttribute('aria-live', 'polite')

    const dismissButton = screen.getByTestId('bankruptcy-notification-dismiss')
    expect(dismissButton).toHaveAttribute('aria-label', 'Dismiss notification')
  })
})
