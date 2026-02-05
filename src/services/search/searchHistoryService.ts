/**
 * Search History Service
 *
 * Story 2.21: Replace Lunr.js with MiniSearch
 * Task 7: Implement recent search history
 *
 * Persists last 20 unique searches in localStorage.
 * Recent searches shown when search is empty.
 */

const STORAGE_KEY = 'claine-search-history'
const MAX_HISTORY = 20

class SearchHistoryService {
  /**
   * Get search history (most recent first)
   */
  getHistory(): string[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      return parsed.filter((item: unknown) => typeof item === 'string')
    } catch {
      return []
    }
  }

  /**
   * Add a search query to history
   * Deduplicates and keeps most recent first, max 20 entries
   */
  addToHistory(query: string): void {
    const trimmed = query.trim()
    if (!trimmed) return

    const history = this.getHistory()

    // Remove duplicate if exists
    const filtered = history.filter((item) => item !== trimmed)

    // Add to front
    filtered.unshift(trimmed)

    // Limit to max entries
    const limited = filtered.slice(0, MAX_HISTORY)

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(limited))
    } catch {
      // localStorage may be full or unavailable
    }
  }

  /**
   * Clear all search history
   */
  clearHistory(): void {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // localStorage may be unavailable
    }
  }
}

/**
 * Singleton instance
 */
export const searchHistoryService = new SearchHistoryService()
