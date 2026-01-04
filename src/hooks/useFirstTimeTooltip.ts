/**
 * useFirstTimeTooltip Hook
 *
 * Story 2.12: Empty States & Onboarding UX
 * Task 5.1, 5.3: Hook for managing first-time tooltip state
 *
 * Manages which tooltips have been dismissed and persists to localStorage.
 *
 * Usage:
 *   const { shouldShow, dismiss } = useFirstTimeTooltip('keyboard-shortcuts')
 */

import { useState, useCallback, useEffect } from 'react'

const STORAGE_KEY = 'claine_dismissed_tooltips'

/**
 * Predefined tooltip IDs for key features
 */
export const TOOLTIP_IDS = {
  KEYBOARD_SHORTCUTS: 'keyboard-shortcuts',
  SEARCH: 'search',
  ARCHIVE: 'archive',
  COMPOSE: 'compose',
  FOLDERS: 'folders',
  OFFLINE_MODE: 'offline-mode',
} as const

export type TooltipId = (typeof TOOLTIP_IDS)[keyof typeof TOOLTIP_IDS] | string

/**
 * Load dismissed tooltip IDs from localStorage
 */
function loadDismissedTooltips(): Set<string> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return new Set(JSON.parse(stored) as string[])
    }
  } catch {
    // Ignore parse errors
  }
  return new Set()
}

/**
 * Save dismissed tooltip IDs to localStorage
 */
function saveDismissedTooltips(dismissed: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...dismissed]))
  } catch {
    // Ignore storage errors
  }
}

export interface FirstTimeTooltipState {
  /** Whether the tooltip should be shown */
  shouldShow: boolean
  /** Dismiss the tooltip permanently */
  dismiss: () => void
  /** Check if a specific tooltip has been dismissed */
  isDismissed: boolean
}

/**
 * useFirstTimeTooltip - Manage individual tooltip visibility
 *
 * @param tooltipId - Unique ID for the tooltip
 * @returns State and functions for managing tooltip visibility
 */
export function useFirstTimeTooltip(tooltipId: TooltipId): FirstTimeTooltipState {
  const [dismissedTooltips, setDismissedTooltips] = useState<Set<string>>(() =>
    loadDismissedTooltips()
  )

  const isDismissed = dismissedTooltips.has(tooltipId)
  const shouldShow = !isDismissed

  const dismiss = useCallback(() => {
    setDismissedTooltips((prev) => {
      const next = new Set(prev)
      next.add(tooltipId)
      saveDismissedTooltips(next)
      return next
    })
  }, [tooltipId])

  return {
    shouldShow,
    dismiss,
    isDismissed,
  }
}

/**
 * useFirstTimeTooltips - Manage multiple tooltips
 *
 * Provides a centralized way to manage multiple first-time tooltips.
 *
 * Usage:
 *   const tooltips = useFirstTimeTooltips()
 *   tooltips.shouldShow('keyboard-shortcuts')
 *   tooltips.dismiss('keyboard-shortcuts')
 */
export interface FirstTimeTooltipsManager {
  /** Check if a tooltip should be shown */
  shouldShow: (tooltipId: TooltipId) => boolean
  /** Dismiss a tooltip */
  dismiss: (tooltipId: TooltipId) => void
  /** Dismiss all tooltips */
  dismissAll: () => void
  /** Reset all tooltips (show them again) */
  resetAll: () => void
  /** Get set of dismissed tooltip IDs */
  dismissedIds: ReadonlySet<string>
}

export function useFirstTimeTooltips(): FirstTimeTooltipsManager {
  const [dismissedTooltips, setDismissedTooltips] = useState<Set<string>>(() =>
    loadDismissedTooltips()
  )

  // Sync with localStorage on mount
  useEffect(() => {
    // Queue state update to avoid synchronous setState in effect
    queueMicrotask(() => {
      const stored = loadDismissedTooltips()
      setDismissedTooltips(stored)
    })
  }, [])

  const shouldShow = useCallback(
    (tooltipId: TooltipId) => !dismissedTooltips.has(tooltipId),
    [dismissedTooltips]
  )

  const dismiss = useCallback((tooltipId: TooltipId) => {
    setDismissedTooltips((prev) => {
      const next = new Set(prev)
      next.add(tooltipId)
      saveDismissedTooltips(next)
      return next
    })
  }, [])

  const dismissAll = useCallback(() => {
    const allIds = new Set(Object.values(TOOLTIP_IDS))
    saveDismissedTooltips(allIds)
    setDismissedTooltips(allIds)
  }, [])

  const resetAll = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Ignore storage errors
    }
    setDismissedTooltips(new Set())
  }, [])

  return {
    shouldShow,
    dismiss,
    dismissAll,
    resetAll,
    dismissedIds: dismissedTooltips,
  }
}

export default useFirstTimeTooltip
