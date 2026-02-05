/**
 * useCommandUsage Hook
 *
 * Story 2.23: Keyboard Shortcut Discoverability
 * Task 4: Context-aware command palette ranking
 *
 * Tracks command usage for context-aware ranking in the command palette.
 * Persists usage data to localStorage.
 */

import { useCallback, useMemo } from 'react'

const STORAGE_KEY = 'claine-command-usage'
const MAX_RECENT_COMMANDS = 10

interface CommandUsageData {
  /** Usage count per command ID */
  counts: Record<string, number>
  /** Recent command IDs in order (most recent first) */
  recent: string[]
}

/**
 * Load command usage data from localStorage
 */
function loadUsageData(): CommandUsageData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const data = JSON.parse(stored) as CommandUsageData
      return {
        counts: data.counts || {},
        recent: data.recent || [],
      }
    }
  } catch {
    // Ignore parse errors
  }
  return { counts: {}, recent: [] }
}

/**
 * Save command usage data to localStorage
 */
function saveUsageData(data: CommandUsageData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Ignore storage errors
  }
}

/**
 * useCommandUsage - Track and retrieve command usage for ranking
 *
 * Usage:
 * ```tsx
 * function CommandPalette() {
 *   const { recordCommandUsage, getRecentCommands, getUsageCount } = useCommandUsage()
 *
 *   const handleCommandExecute = (commandId: string) => {
 *     recordCommandUsage(commandId)
 *     // ... execute command
 *   }
 *
 *   const recentCommands = getRecentCommands()
 * }
 * ```
 */
export function useCommandUsage() {
  /**
   * Record a command usage
   */
  const recordCommandUsage = useCallback((commandId: string) => {
    const data = loadUsageData()

    // Increment usage count
    data.counts[commandId] = (data.counts[commandId] || 0) + 1

    // Update recent list (move to front, maintain max size)
    data.recent = data.recent.filter((id) => id !== commandId)
    data.recent.unshift(commandId)
    if (data.recent.length > MAX_RECENT_COMMANDS) {
      data.recent = data.recent.slice(0, MAX_RECENT_COMMANDS)
    }

    saveUsageData(data)
  }, [])

  /**
   * Get recent commands (last 10 used)
   */
  const getRecentCommands = useCallback((): string[] => {
    const data = loadUsageData()
    return data.recent
  }, [])

  /**
   * Get usage count for a specific command
   */
  const getUsageCount = useCallback((commandId: string): number => {
    const data = loadUsageData()
    return data.counts[commandId] || 0
  }, [])

  /**
   * Clear all usage data
   */
  const clearUsageData = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Ignore errors
    }
  }, [])

  return useMemo(
    () => ({
      recordCommandUsage,
      getRecentCommands,
      getUsageCount,
      clearUsageData,
    }),
    [recordCommandUsage, getRecentCommands, getUsageCount, clearUsageData]
  )
}
