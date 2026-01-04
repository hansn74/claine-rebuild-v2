/**
 * Compose Store
 *
 * Story 2.3: Compose & Reply Interface
 * Task 8: Create Compose Button in Header
 *
 * Zustand store for global compose dialog state
 * Manages:
 * - Dialog open/close state
 * - Compose context (new, reply, reply-all, forward)
 * - Active draft ID
 */

import { create } from 'zustand'
import type { ComposeContext } from '@/components/compose/ComposeDialog'

interface ComposeState {
  /** Whether compose dialog is open */
  isOpen: boolean
  /** Context for reply/forward (null for new message) */
  context: ComposeContext | null
  /** Draft ID for existing draft */
  draftId: string | null

  /** Open compose dialog for new message */
  openCompose: () => void
  /** Open compose dialog with context (reply/forward) */
  openComposeWithContext: (context: ComposeContext) => void
  /** Open compose dialog for existing draft */
  openDraft: (draftId: string) => void
  /** Close compose dialog */
  closeCompose: () => void
}

export const useComposeStore = create<ComposeState>((set) => ({
  isOpen: false,
  context: null,
  draftId: null,

  openCompose: () => {
    set({
      isOpen: true,
      context: null,
      draftId: null,
    })
  },

  openComposeWithContext: (context) => {
    set({
      isOpen: true,
      context,
      draftId: null,
    })
  },

  openDraft: (draftId) => {
    set({
      isOpen: true,
      context: null,
      draftId,
    })
  },

  closeCompose: () => {
    set({
      isOpen: false,
      context: null,
      draftId: null,
    })
  },
}))
