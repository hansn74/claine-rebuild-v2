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
 * Search store state and actions
 */
interface SearchState {
  /** Whether command palette is open */
  isOpen: boolean
  /** Current search query (for URL persistence) */
  currentQuery: string
  /** Whether search is active (showing results view) */
  isSearchActive: boolean

  // Actions
  openSearch: () => void
  closeSearch: () => void
  toggleSearch: () => void
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
  currentQuery: '',
  isSearchActive: false,

  /**
   * Open the command palette
   */
  openSearch: () => {
    set({ isOpen: true })
    logger.debug('search', 'Command palette opened')
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
  toggleSearch: () => {
    const { isOpen } = get()
    set({ isOpen: !isOpen })
    logger.debug('search', `Command palette ${!isOpen ? 'opened' : 'closed'}`)
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
