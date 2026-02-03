/**
 * Search Store
 *
 * Story 2.5: Local Full-Text Search
 * Task 8.2: Create searchStore for global search state
 *
 * Global state management for search UI using Zustand.
 * Manages command palette visibility and search state.
 */

import { create } from 'zustand'
import { logger } from '@/services/logger'

/**
 * Mode for command palette
 * - 'search': Email search only (opened with /)
 * - 'actions': Quick actions only (opened with Cmd+K)
 */
export type PaletteMode = 'search' | 'actions'

/**
 * Search store state and actions
 */
interface SearchState {
  /** Whether command palette is open */
  isOpen: boolean
  /** Which mode the palette is in */
  mode: PaletteMode
  /** Current search query (for URL persistence) */
  currentQuery: string
  /** Whether search is active (showing results view) */
  isSearchActive: boolean

  // Actions
  openSearch: (mode?: PaletteMode) => void
  closeSearch: () => void
  toggleSearch: (mode?: PaletteMode) => void
  setCurrentQuery: (query: string) => void
  clearSearch: () => void
}

/**
 * Zustand store for search state
 *
 * Usage:
 * ```tsx
 * function Header() {
 *   const { openSearch, isOpen } = useSearchStore()
 *
 *   return (
 *     <button onClick={openSearch}>
 *       Search
 *     </button>
 *   )
 * }
 * ```
 */
export const useSearchStore = create<SearchState>((set, get) => ({
  isOpen: false,
  mode: 'search',
  currentQuery: '',
  isSearchActive: false,

  /**
   * Open the command palette in specified mode
   */
  openSearch: (mode: PaletteMode = 'search') => {
    set({ isOpen: true, mode })
    logger.debug('search', `Command palette opened in ${mode} mode`)
  },

  /**
   * Close the command palette
   */
  closeSearch: () => {
    set({ isOpen: false })
    logger.debug('search', 'Command palette closed')
  },

  /**
   * Toggle command palette visibility
   */
  toggleSearch: (mode: PaletteMode = 'search') => {
    const { isOpen, mode: currentMode } = get()
    // If already open in same mode, close. Otherwise open in new mode.
    if (isOpen && currentMode === mode) {
      set({ isOpen: false })
      logger.debug('search', 'Command palette closed')
    } else {
      set({ isOpen: true, mode })
      logger.debug('search', `Command palette opened in ${mode} mode`)
    }
  },

  /**
   * Set current search query
   * Used for URL persistence and state tracking
   */
  setCurrentQuery: (query: string) => {
    set({
      currentQuery: query,
      isSearchActive: query.length > 0,
    })
  },

  /**
   * Clear search state
   */
  clearSearch: () => {
    set({
      currentQuery: '',
      isSearchActive: false,
    })
    logger.debug('search', 'Search cleared')
  },
}))

/**
 * Expose search store for E2E testing in development mode
 */
if (import.meta.env.DEV) {
  ;(window as unknown as { __TEST_SEARCH_STORE__: typeof useSearchStore }).__TEST_SEARCH_STORE__ =
    useSearchStore
}
