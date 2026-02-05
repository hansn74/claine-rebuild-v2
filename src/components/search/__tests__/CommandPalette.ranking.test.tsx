/**
 * CommandPalette Context-Aware Ranking Tests
 *
 * Story 2.23: Keyboard Shortcut Discoverability
 * Task 7: Write comprehensive tests
 * AC 15: Thread view command palette shows Reply/Forward/Archive at top
 * AC 16: List view command palette shows navigation actions at top
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CommandPalette } from '../CommandPalette'

// Mock scrollIntoView for JSDOM environment
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

// Mock dependencies
vi.mock('@/hooks/useSearch', () => ({
  useSearch: vi.fn(() => ({
    query: '',
    setQuery: vi.fn(),
    results: [],
    isSearching: false,
    searchTime: null,
    clear: vi.fn(),
    activeOperators: [],
  })),
}))

vi.mock('@/services/search', () => ({
  searchHistoryService: {
    getHistory: vi.fn(() => []),
    addToHistory: vi.fn(),
    clearHistory: vi.fn(),
  },
}))

vi.mock('@/services/search/searchOperatorParser', () => ({
  getOperatorSearchHints: vi.fn(() => []),
}))

vi.mock('@/services/search/attributeSearchParser', () => ({
  getAttributeSearchHints: vi.fn(() => []),
}))

// Mock ShortcutContext with controllable activeScope
const mockActiveScope = vi.fn(() => 'inbox')
vi.mock('@/context/ShortcutContext', () => ({
  useActiveScope: () => mockActiveScope(),
}))

// Mock useCommandUsage with controllable recent commands
const mockGetRecentCommands = vi.fn(() => [])
const mockRecordCommandUsage = vi.fn()
vi.mock('@/hooks/useCommandUsage', () => ({
  useCommandUsage: () => ({
    getRecentCommands: mockGetRecentCommands,
    recordCommandUsage: mockRecordCommandUsage,
  }),
}))

describe('CommandPalette Context-Aware Ranking', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetRecentCommands.mockReturnValue([])
  })

  describe('AC 15: Thread view (reading scope) ranking', () => {
    it('shows Reply/Forward/Archive at top when in reading scope', () => {
      mockActiveScope.mockReturnValue('reading')

      render(<CommandPalette open={true} onClose={vi.fn()} mode="actions" />)

      // Get all command buttons
      const buttons = screen
        .getAllByRole('button')
        .filter((btn) => btn.getAttribute('data-index') !== null)

      // First few commands should be reading-scope relevant (Reply, Forward, Archive, etc.)
      const firstCommandNames = buttons.slice(0, 5).map((btn) => {
        const nameDiv = btn.querySelector('.font-medium')
        return nameDiv?.textContent
      })

      // Reply, Forward should be in the top commands for reading scope
      expect(firstCommandNames).toContain('Reply')
      expect(firstCommandNames).toContain('Forward')
    })

    it('ranks reading-scope actions above global-only actions', () => {
      mockActiveScope.mockReturnValue('reading')

      render(<CommandPalette open={true} onClose={vi.fn()} mode="actions" />)

      const buttons = screen
        .getAllByRole('button')
        .filter((btn) => btn.getAttribute('data-index') !== null)

      // Find indices of Reply (reading scope) and Keyboard Shortcuts (global scope)
      let replyIndex = -1
      let shortcutsIndex = -1

      buttons.forEach((btn, index) => {
        const nameDiv = btn.querySelector('.font-medium')
        const name = nameDiv?.textContent
        if (name === 'Reply') replyIndex = index
        if (name === 'Keyboard Shortcuts') shortcutsIndex = index
      })

      // Reply (reading scope relevant) should come before Keyboard Shortcuts (global only)
      expect(replyIndex).toBeLessThan(shortcutsIndex)
    })
  })

  describe('AC 16: List view (inbox scope) ranking', () => {
    it('shows navigation actions at top when in inbox scope', () => {
      mockActiveScope.mockReturnValue('inbox')

      render(<CommandPalette open={true} onClose={vi.fn()} mode="actions" />)

      const buttons = screen
        .getAllByRole('button')
        .filter((btn) => btn.getAttribute('data-index') !== null)

      // Get first several command names
      const firstCommandNames = buttons.slice(0, 6).map((btn) => {
        const nameDiv = btn.querySelector('.font-medium')
        return nameDiv?.textContent
      })

      // Navigation commands should be present in top commands for inbox scope
      // Go to Inbox, Go to Sent, Go to Drafts are navigation commands with inbox scope
      const hasNavigationCommands = firstCommandNames.some((name) => name?.startsWith('Go to'))
      expect(hasNavigationCommands).toBe(true)
    })

    it('ranks inbox-scope actions above compose-only actions', () => {
      mockActiveScope.mockReturnValue('inbox')

      render(<CommandPalette open={true} onClose={vi.fn()} mode="actions" />)

      const buttons = screen
        .getAllByRole('button')
        .filter((btn) => btn.getAttribute('data-index') !== null)

      // Find indices of Archive (inbox scope) and Reply (reading scope only)
      let archiveIndex = -1
      let replyIndex = -1

      buttons.forEach((btn, index) => {
        const nameDiv = btn.querySelector('.font-medium')
        const name = nameDiv?.textContent
        if (name === 'Archive') archiveIndex = index
        if (name === 'Reply') replyIndex = index
      })

      // Archive (inbox scope relevant) should come before Reply (reading scope only)
      expect(archiveIndex).toBeLessThan(replyIndex)
    })
  })

  describe('Recent commands ranking', () => {
    it('shows recent commands before scope-relevant commands', () => {
      mockActiveScope.mockReturnValue('inbox')
      // Simulate 'show-shortcuts' was recently used (which is global scope only)
      mockGetRecentCommands.mockReturnValue(['show-shortcuts'])

      render(<CommandPalette open={true} onClose={vi.fn()} mode="actions" />)

      const buttons = screen
        .getAllByRole('button')
        .filter((btn) => btn.getAttribute('data-index') !== null)

      // First command should be the recently used one
      const firstCommandName = buttons[0]?.querySelector('.font-medium')?.textContent
      expect(firstCommandName).toBe('Keyboard Shortcuts')
    })

    it('shows Recent section header when recent commands exist', () => {
      mockActiveScope.mockReturnValue('inbox')
      mockGetRecentCommands.mockReturnValue(['archive'])

      render(<CommandPalette open={true} onClose={vi.fn()} mode="actions" />)

      // Should show "Recent" header
      expect(screen.getByText('Recent')).toBeInTheDocument()
      // Should also show "All Actions" header for non-recent commands
      expect(screen.getByText('All Actions')).toBeInTheDocument()
    })
  })
})
