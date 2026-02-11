/**
 * View Mode Store
 *
 * Story 3.4: Priority-Based Inbox View
 * Task 1: Manage inbox view mode (chronological vs priority) with localStorage persistence
 *
 * Follows folderStore.ts persistence pattern.
 */

import { create } from 'zustand'

export type ViewMode = 'chronological' | 'priority'

const VIEW_MODE_KEY = 'claine_inbox_view_mode'
const COLLAPSED_SECTIONS_KEY = 'claine_collapsed_sections'

function loadPersistedViewMode(): ViewMode {
  try {
    const stored = localStorage.getItem(VIEW_MODE_KEY)
    if (stored === 'chronological' || stored === 'priority') {
      return stored
    }
  } catch {
    // Ignore localStorage errors
  }
  return 'chronological'
}

function persistViewMode(mode: ViewMode): void {
  try {
    localStorage.setItem(VIEW_MODE_KEY, mode)
  } catch {
    // Ignore localStorage errors
  }
}

function loadPersistedCollapsedSections(): Set<string> {
  try {
    const stored = localStorage.getItem(COLLAPSED_SECTIONS_KEY)
    if (stored) {
      const arr = JSON.parse(stored)
      if (Array.isArray(arr)) {
        return new Set(arr)
      }
    }
  } catch {
    // Ignore localStorage/parse errors
  }
  return new Set()
}

function persistCollapsedSections(sections: Set<string>): void {
  try {
    localStorage.setItem(COLLAPSED_SECTIONS_KEY, JSON.stringify([...sections]))
  } catch {
    // Ignore localStorage errors
  }
}

export interface ViewModeStoreState {
  viewMode: ViewMode
  collapsedSections: Set<string>

  setViewMode: (mode: ViewMode) => void
  toggleViewMode: () => void
  toggleSection: (sectionKey: string) => void
  isSectionCollapsed: (sectionKey: string) => boolean
}

export const useViewModeStore = create<ViewModeStoreState>((set, get) => ({
  viewMode: loadPersistedViewMode(),
  collapsedSections: loadPersistedCollapsedSections(),

  setViewMode: (mode) => {
    set({ viewMode: mode })
    persistViewMode(mode)
  },

  toggleViewMode: () => {
    const newMode = get().viewMode === 'chronological' ? 'priority' : 'chronological'
    set({ viewMode: newMode })
    persistViewMode(newMode)
  },

  toggleSection: (sectionKey) => {
    const current = get().collapsedSections
    const next = new Set(current)
    if (next.has(sectionKey)) {
      next.delete(sectionKey)
    } else {
      next.add(sectionKey)
    }
    set({ collapsedSections: next })
    persistCollapsedSections(next)
  },

  isSectionCollapsed: (sectionKey) => {
    return get().collapsedSections.has(sectionKey)
  },
}))
