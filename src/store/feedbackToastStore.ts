/**
 * Feedback Toast Store
 *
 * Story 3.6: Manual Priority Adjustment & Feedback Loop
 * Task 7: Zustand store for "AI learned" toast notifications
 *
 * Follows the nudgeStore pattern.
 */

import { create } from 'zustand'

interface FeedbackToastState {
  activeToast: { message: string; senderEmail: string } | null
  showToast: (message: string, senderEmail: string) => void
  dismissToast: () => void
}

export const useFeedbackToastStore = create<FeedbackToastState>((set) => ({
  activeToast: null,

  showToast: (message: string, senderEmail: string) => {
    set({ activeToast: { message, senderEmail } })
  },

  dismissToast: () => {
    set({ activeToast: null })
  },
}))
