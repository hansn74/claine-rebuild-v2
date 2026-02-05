/**
 * useShortcutNudge Hook
 *
 * Story 2.23: Keyboard Shortcut Discoverability
 * Task 5: Create nudge tooltip system
 *
 * Tracks mouse vs keyboard action usage and triggers one-time nudge tooltips
 * after a user performs the same mouse action 3+ times without using the shortcut.
 */

import { useCallback, useMemo } from 'react'
import { useSettingsStore } from '@/store/settingsStore'

const STORAGE_KEY = 'claine-shortcut-nudges'
const MOUSE_THRESHOLD = 3

interface ActionUsage {
  /** Number of times action performed via mouse */
  mouseCount: number
  /** Number of times action performed via keyboard */
  keyboardCount: number
  /** Whether the nudge has been shown for this action */
  nudgeShown: boolean
}

interface NudgeData {
  [actionId: string]: ActionUsage
}

/**
 * Load nudge data from localStorage
 */
function loadNudgeData(): NudgeData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored) as NudgeData
    }
  } catch {
    // Ignore parse errors
  }
  return {}
}

/**
 * Save nudge data to localStorage
 */
function saveNudgeData(data: NudgeData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Ignore storage errors
  }
}

/**
 * Get or create action usage entry
 */
function getActionUsage(data: NudgeData, actionId: string): ActionUsage {
  return data[actionId] || { mouseCount: 0, keyboardCount: 0, nudgeShown: false }
}

/**
 * useShortcutNudge - Track action usage and manage nudge tooltips
 *
 * Usage:
 * ```tsx
 * function ArchiveButton() {
 *   const { recordMouseAction, shouldShowNudge, markNudgeShown } = useShortcutNudge()
 *
 *   const handleClick = () => {
 *     recordMouseAction('archive')
 *     // ... perform action
 *   }
 *
 *   const showNudge = shouldShowNudge('archive')
 *
 *   return (
 *     <>
 *       <button onClick={handleClick}>Archive</button>
 *       {showNudge && <NudgeTooltip onDismiss={() => markNudgeShown('archive')} />}
 *     </>
 *   )
 * }
 * ```
 */
export function useShortcutNudge() {
  const showKeyboardHints = useSettingsStore((state) => state.showKeyboardHints)

  /**
   * Record a mouse action (click)
   */
  const recordMouseAction = useCallback((actionId: string) => {
    const data = loadNudgeData()
    const usage = getActionUsage(data, actionId)

    usage.mouseCount += 1
    data[actionId] = usage

    saveNudgeData(data)
  }, [])

  /**
   * Record a keyboard action (shortcut)
   * Resets mouse count since user is using shortcuts
   */
  const recordKeyboardAction = useCallback((actionId: string) => {
    const data = loadNudgeData()
    const usage = getActionUsage(data, actionId)

    usage.keyboardCount += 1
    usage.mouseCount = 0 // Reset mouse count when keyboard is used

    data[actionId] = usage
    saveNudgeData(data)
  }, [])

  /**
   * Check if a nudge should be shown for an action
   */
  const shouldShowNudge = useCallback(
    (actionId: string): boolean => {
      // Don't show nudges if hints are disabled
      if (!showKeyboardHints) {
        return false
      }

      const data = loadNudgeData()
      const usage = getActionUsage(data, actionId)

      // Show nudge if: mouse count >= threshold AND nudge not already shown
      return usage.mouseCount >= MOUSE_THRESHOLD && !usage.nudgeShown
    },
    [showKeyboardHints]
  )

  /**
   * Mark a nudge as shown (don't show again)
   */
  const markNudgeShown = useCallback((actionId: string) => {
    const data = loadNudgeData()
    const usage = getActionUsage(data, actionId)

    usage.nudgeShown = true
    usage.mouseCount = 0 // Reset mouse count after nudge

    data[actionId] = usage
    saveNudgeData(data)
  }, [])

  /**
   * Get current mouse count for an action (for debugging)
   */
  const getMouseCount = useCallback((actionId: string): number => {
    const data = loadNudgeData()
    return getActionUsage(data, actionId).mouseCount
  }, [])

  /**
   * Reset all nudge data (for testing)
   */
  const resetNudgeData = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Ignore errors
    }
  }, [])

  return useMemo(
    () => ({
      recordMouseAction,
      recordKeyboardAction,
      shouldShowNudge,
      markNudgeShown,
      getMouseCount,
      resetNudgeData,
    }),
    [
      recordMouseAction,
      recordKeyboardAction,
      shouldShowNudge,
      markNudgeShown,
      getMouseCount,
      resetNudgeData,
    ]
  )
}
