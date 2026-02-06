/**
 * Nudge Store
 *
 * Story 2.23: Keyboard Shortcut Discoverability
 *
 * Global store for managing nudge tooltip display.
 * Nudges are shown at the App level to survive component unmounts.
 */

import { create } from 'zustand'

export interface NudgeToast {
  id: string
  actionName: string
  shortcutKey: string
  createdAt: number
}

interface NudgeState {
  /** Currently visible nudge (only one at a time) */
  activeNudge: NudgeToast | null
  /** Show a nudge toast */
  showNudge: (actionName: string, shortcutKey: string) => void
  /** Dismiss the active nudge */
  dismissNudge: () => void
}

export const useNudgeStore = create<NudgeState>((set) => ({
  activeNudge: null,

  showNudge: (actionName: string, shortcutKey: string) => {
    const nudge: NudgeToast = {
      id: `nudge-${Date.now()}`,
      actionName,
      shortcutKey,
      createdAt: Date.now(),
    }
    set({ activeNudge: nudge })
  },

  dismissNudge: () => {
    set({ activeNudge: null })
  },
}))
