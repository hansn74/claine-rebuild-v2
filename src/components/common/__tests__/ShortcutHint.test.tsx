/**
 * ShortcutHint Component Tests
 *
 * Story 2.23: Keyboard Shortcut Discoverability
 * Task 7: Write comprehensive tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ShortcutHint } from '../ShortcutHint'
import { useSettingsStore } from '@/store/settingsStore'

// Mock the settings store
vi.mock('@/store/settingsStore', () => ({
  useSettingsStore: vi.fn(),
}))

// Mock the ShortcutContext
vi.mock('@/context/ShortcutContext', () => ({
  useActiveScope: vi.fn(() => 'inbox'),
}))

import { useActiveScope } from '@/context/ShortcutContext'

describe('ShortcutHint', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders shortcut key when hints are enabled and scope matches', () => {
    vi.mocked(useSettingsStore).mockImplementation((selector) =>
      selector({ showKeyboardHints: true } as ReturnType<typeof useSettingsStore.getState>)
    )
    vi.mocked(useActiveScope).mockReturnValue('inbox')

    render(<ShortcutHint shortcutKey="e" scopes={['inbox', 'reading']} />)

    expect(screen.getByText('(e)')).toBeInTheDocument()
  })

  it('returns null when showKeyboardHints is false', () => {
    vi.mocked(useSettingsStore).mockImplementation((selector) =>
      selector({ showKeyboardHints: false } as ReturnType<typeof useSettingsStore.getState>)
    )
    vi.mocked(useActiveScope).mockReturnValue('inbox')

    const { container } = render(<ShortcutHint shortcutKey="e" scopes={['inbox']} />)

    expect(container.firstChild).toBeNull()
  })

  it('returns null when activeScope does not include target scope', () => {
    vi.mocked(useSettingsStore).mockImplementation((selector) =>
      selector({ showKeyboardHints: true } as ReturnType<typeof useSettingsStore.getState>)
    )
    vi.mocked(useActiveScope).mockReturnValue('compose')

    const { container } = render(<ShortcutHint shortcutKey="e" scopes={['inbox', 'reading']} />)

    expect(container.firstChild).toBeNull()
  })

  it('renders when no scopes specified (always visible)', () => {
    vi.mocked(useSettingsStore).mockImplementation((selector) =>
      selector({ showKeyboardHints: true } as ReturnType<typeof useSettingsStore.getState>)
    )
    vi.mocked(useActiveScope).mockReturnValue('compose')

    render(<ShortcutHint shortcutKey="c" />)

    expect(screen.getByText('(c)')).toBeInTheDocument()
  })

  it('has aria-hidden attribute for accessibility', () => {
    vi.mocked(useSettingsStore).mockImplementation((selector) =>
      selector({ showKeyboardHints: true } as ReturnType<typeof useSettingsStore.getState>)
    )
    vi.mocked(useActiveScope).mockReturnValue('inbox')

    render(<ShortcutHint shortcutKey="e" />)

    const hint = screen.getByText('(e)')
    expect(hint).toHaveAttribute('aria-hidden', 'true')
  })

  it('applies custom className', () => {
    vi.mocked(useSettingsStore).mockImplementation((selector) =>
      selector({ showKeyboardHints: true } as ReturnType<typeof useSettingsStore.getState>)
    )
    vi.mocked(useActiveScope).mockReturnValue('inbox')

    render(<ShortcutHint shortcutKey="e" className="custom-class" />)

    const hint = screen.getByText('(e)')
    expect(hint).toHaveClass('custom-class')
  })
})
