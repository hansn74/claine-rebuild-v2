/**
 * Accessibility Components Tests
 *
 * Story 2.11: Keyboard Shortcuts & Power User Features
 * Task 9.6: Write accessibility tests (a11y)
 *
 * Tests for SkipLinks and ActionAnnouncer components.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import SkipLinks, { DEFAULT_SKIP_LINKS } from '../SkipLinks'
import ActionAnnouncer, { useAnnouncer } from '../ActionAnnouncer'

// Mock scrollIntoView since jsdom doesn't support it
const mockScrollIntoView = vi.fn()
Element.prototype.scrollIntoView = mockScrollIntoView

describe('SkipLinks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Clean up any target elements created during tests
    document.querySelectorAll('[id]').forEach((el) => {
      if (el.parentElement === document.body && el.tagName === 'DIV') {
        document.body.removeChild(el)
      }
    })
  })

  it('renders all default skip links', () => {
    render(<SkipLinks />)

    DEFAULT_SKIP_LINKS.forEach((link) => {
      const skipLink = screen.getByText(link.label)
      expect(skipLink).toBeInTheDocument()
    })
  })

  it('renders custom skip links when provided', () => {
    const customLinks = [
      { id: 'custom-1', label: 'Skip to custom content', targetId: 'custom-content' },
    ]

    render(<SkipLinks links={customLinks} />)

    expect(screen.getByText('Skip to custom content')).toBeInTheDocument()
    expect(screen.queryByText('Skip to main content')).not.toBeInTheDocument()
  })

  it('has proper navigation role and aria-label', () => {
    render(<SkipLinks />)

    const nav = screen.getByRole('navigation', { name: 'Skip links' })
    expect(nav).toBeInTheDocument()
  })

  it('focuses target element when skip link is clicked', () => {
    // Create a target element
    const targetElement = document.createElement('div')
    targetElement.id = 'main-content'
    document.body.appendChild(targetElement)

    render(<SkipLinks />)

    const skipLink = screen.getByText('Skip to main content')
    fireEvent.click(skipLink)

    expect(document.getElementById('main-content')).toHaveAttribute('tabindex', '-1')
    expect(mockScrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
  })

  it('sets tabindex on target element if not already set', () => {
    const targetElement = document.createElement('div')
    targetElement.id = 'email-list'
    document.body.appendChild(targetElement)

    render(<SkipLinks />)

    const skipLink = screen.getByText('Skip to email list')
    fireEvent.click(skipLink)

    expect(targetElement).toHaveAttribute('tabindex', '-1')
  })

  it('does not throw when target element does not exist', () => {
    render(<SkipLinks />)

    const skipLink = screen.getByText('Skip to main content')

    // Should not throw
    expect(() => {
      fireEvent.click(skipLink)
    }).not.toThrow()
  })

  it('links have proper href attributes', () => {
    render(<SkipLinks />)

    DEFAULT_SKIP_LINKS.forEach((link) => {
      const anchor = screen.getByText(link.label).closest('a')
      expect(anchor).toHaveAttribute('href', `#${link.targetId}`)
    })
  })
})

describe('ActionAnnouncer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders children', () => {
    render(
      <ActionAnnouncer>
        <div data-testid="child">Child content</div>
      </ActionAnnouncer>
    )

    expect(screen.getByTestId('child')).toBeInTheDocument()
  })

  it('renders polite aria-live region', () => {
    render(
      <ActionAnnouncer>
        <div>Content</div>
      </ActionAnnouncer>
    )

    const politeRegion = screen.getByRole('status')
    expect(politeRegion).toHaveAttribute('aria-live', 'polite')
    expect(politeRegion).toHaveAttribute('aria-atomic', 'true')
  })

  it('renders assertive aria-live region', () => {
    render(
      <ActionAnnouncer>
        <div>Content</div>
      </ActionAnnouncer>
    )

    const assertiveRegion = screen.getByRole('alert')
    expect(assertiveRegion).toHaveAttribute('aria-live', 'assertive')
    expect(assertiveRegion).toHaveAttribute('aria-atomic', 'true')
  })
})

describe('useAnnouncer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('announces polite messages', async () => {
    function TestComponent() {
      const { announce } = useAnnouncer()
      return <button onClick={() => announce('Email archived')}>Announce</button>
    }

    render(
      <ActionAnnouncer>
        <TestComponent />
      </ActionAnnouncer>
    )

    const button = screen.getByText('Announce')
    fireEvent.click(button)

    const statusRegion = screen.getByRole('status')
    expect(statusRegion).toHaveTextContent('Email archived')
  })

  it('announces assertive messages', async () => {
    function TestComponent() {
      const { announce } = useAnnouncer()
      return <button onClick={() => announce('Critical error!', 'assertive')}>Announce</button>
    }

    render(
      <ActionAnnouncer>
        <TestComponent />
      </ActionAnnouncer>
    )

    const button = screen.getByText('Announce')
    fireEvent.click(button)

    const alertRegion = screen.getByRole('alert')
    expect(alertRegion).toHaveTextContent('Critical error!')
  })

  it('clears message after timeout', async () => {
    function TestComponent() {
      const { announce } = useAnnouncer()
      return <button onClick={() => announce('Temporary message')}>Announce</button>
    }

    render(
      <ActionAnnouncer>
        <TestComponent />
      </ActionAnnouncer>
    )

    const button = screen.getByText('Announce')
    fireEvent.click(button)

    expect(screen.getByRole('status')).toHaveTextContent('Temporary message')

    // Fast forward past the timeout
    act(() => {
      vi.advanceTimersByTime(1100)
    })

    expect(screen.getByRole('status')).toHaveTextContent('')
  })

  it('returns no-op function when used outside provider', () => {
    function TestComponent() {
      const { announce } = useAnnouncer()
      return <button onClick={() => announce('Should not throw')}>Announce</button>
    }

    render(<TestComponent />)

    const button = screen.getByText('Announce')

    // Should not throw when used outside provider
    expect(() => {
      fireEvent.click(button)
    }).not.toThrow()
  })
})
