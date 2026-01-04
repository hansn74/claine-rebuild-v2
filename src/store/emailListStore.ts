/**
 * Email List Store
 * Manages email list UI state using Zustand
 *
 * AC 5: Scroll position preserved when navigating back to inbox
 *
 * Features:
 * - Persist scroll position across navigation
 * - Handle list size changes and new emails
 */

import { create } from 'zustand'
import { logger } from '@/services/logger'

/**
 * localStorage key for persisting scroll position
 */
const SCROLL_POSITION_KEY = 'claine_email_list_scroll'

/**
 * Email list store state and actions
 */
interface EmailListState {
  scrollOffset: number
  lastEmailCount: number

  // Actions
  setScrollOffset: (offset: number) => void
  resetScrollPosition: () => void
  updateEmailCount: (count: number) => void
}

/**
 * Load scroll position from localStorage
 */
function loadPersistedScrollPosition(): number {
  try {
    const saved = localStorage.getItem(SCROLL_POSITION_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      return parsed.offset ?? 0
    }
  } catch {
    // Ignore localStorage errors
  }
  return 0
}

/**
 * Persist scroll position to localStorage
 */
function persistScrollPosition(offset: number, emailCount: number): void {
  try {
    localStorage.setItem(
      SCROLL_POSITION_KEY,
      JSON.stringify({ offset, emailCount, timestamp: Date.now() })
    )
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Email list store using Zustand
 * Follows project convention from accountStore.ts
 */
export const useEmailListStore = create<EmailListState>((set, get) => ({
  scrollOffset: loadPersistedScrollPosition(),
  lastEmailCount: 0,

  /**
   * Set the scroll offset position
   * Persists to localStorage for restoration on navigation
   */
  setScrollOffset: (offset: number) => {
    const { lastEmailCount } = get()
    set({ scrollOffset: offset })
    persistScrollPosition(offset, lastEmailCount)
    logger.debug('ui', 'Email list scroll position saved', { offset })
  },

  /**
   * Reset scroll position to top
   * Called when navigating to a fresh view or on significant list changes
   */
  resetScrollPosition: () => {
    set({ scrollOffset: 0 })
    persistScrollPosition(0, get().lastEmailCount)
    logger.debug('ui', 'Email list scroll position reset')
  },

  /**
   * Update email count to detect list size changes
   * If count decreases significantly or new emails at top, may need scroll adjustment
   */
  updateEmailCount: (count: number) => {
    const { lastEmailCount, scrollOffset } = get()

    // If the list grew and user was at top, stay at top to see new emails
    if (count > lastEmailCount && scrollOffset < 100) {
      set({ scrollOffset: 0, lastEmailCount: count })
      return
    }

    // If list shrank significantly, reset to prevent showing empty space
    if (count < lastEmailCount * 0.5 && lastEmailCount > 0) {
      set({ scrollOffset: 0, lastEmailCount: count })
      return
    }

    set({ lastEmailCount: count })
  },
}))

/**
 * Expose email list store for E2E testing in development mode
 */
if (import.meta.env.DEV) {
  ;(
    window as unknown as { __TEST_EMAIL_LIST_STORE__: typeof useEmailListStore }
  ).__TEST_EMAIL_LIST_STORE__ = useEmailListStore
}
