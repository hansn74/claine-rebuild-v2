/**
 * Selection Store
 *
 * Story 2.6: Email Actions (Archive, Delete, Mark Read/Unread)
 * Task 5.1: Create selectionStore with Zustand
 *
 * Global state management for email selection using Zustand.
 * Supports single, range, and toggle selection modes.
 *
 * AC 5: Bulk actions available (select multiple emails, apply action to all)
 */

import { create } from 'zustand'
import { logger } from '@/services/logger'

/**
 * Selection store state and actions
 */
interface SelectionState {
  /** Set of selected email IDs */
  selectedIds: Set<string>
  /** Whether selection mode is active */
  selectMode: boolean
  /** Last selected email ID (for range selection) */
  lastSelectedId: string | null
  /** Ordered list of all email IDs (for range selection) */
  emailIdOrder: string[]

  // Actions
  setSelectedIds: (ids: Set<string>) => void
  toggleSelect: (id: string) => void
  selectSingle: (id: string) => void
  selectRange: (id: string, orderedIds: string[]) => void
  toggleSelectMode: () => void
  selectAll: (ids: string[]) => void
  clearSelection: () => void
  setEmailIdOrder: (ids: string[]) => void
  isSelected: (id: string) => boolean
}

/**
 * Zustand store for email selection
 *
 * Usage:
 * ```tsx
 * function EmailList() {
 *   const { selectedIds, toggleSelect, selectMode } = useSelectionStore()
 *
 *   return (
 *     <div>
 *       {emails.map(email => (
 *         <EmailListItem
 *           key={email.id}
 *           email={email}
 *           isSelected={selectedIds.has(email.id)}
 *           onSelect={() => toggleSelect(email.id)}
 *         />
 *       ))}
 *     </div>
 *   )
 * }
 * ```
 */
export const useSelectionStore = create<SelectionState>((set, get) => ({
  selectedIds: new Set<string>(),
  selectMode: false,
  lastSelectedId: null,
  emailIdOrder: [],

  /**
   * Set the selected IDs directly
   */
  setSelectedIds: (ids) => {
    set({
      selectedIds: ids,
      selectMode: ids.size > 0,
    })
    logger.debug('selection', 'Selection set', { count: ids.size })
  },

  /**
   * Toggle selection of a single email (Ctrl/Cmd+click)
   * Task 5.5: Implement Ctrl/Cmd+click toggle selection
   */
  toggleSelect: (id) => {
    const { selectedIds } = get()
    const newSelection = new Set(selectedIds)

    if (newSelection.has(id)) {
      newSelection.delete(id)
    } else {
      newSelection.add(id)
    }

    set({
      selectedIds: newSelection,
      selectMode: newSelection.size > 0,
      lastSelectedId: id,
    })

    logger.debug('selection', 'Selection toggled', {
      id,
      selected: !selectedIds.has(id),
      count: newSelection.size,
    })
  },

  /**
   * Select a single email (replaces current selection)
   * Task 5.3: Implement single-click selection
   */
  selectSingle: (id) => {
    set({
      selectedIds: new Set([id]),
      selectMode: true,
      lastSelectedId: id,
    })
    logger.debug('selection', 'Single selection', { id })
  },

  /**
   * Select a range of emails (Shift+click)
   * Task 5.4: Implement Shift+click range selection
   */
  selectRange: (id, orderedIds) => {
    const { lastSelectedId, selectedIds } = get()

    if (!lastSelectedId || orderedIds.length === 0) {
      // No previous selection, just select the clicked email
      set({
        selectedIds: new Set([id]),
        selectMode: true,
        lastSelectedId: id,
      })
      return
    }

    // Find indices of last selected and current
    const lastIndex = orderedIds.indexOf(lastSelectedId)
    const currentIndex = orderedIds.indexOf(id)

    if (lastIndex === -1 || currentIndex === -1) {
      // IDs not found in order, just select the clicked email
      set({
        selectedIds: new Set([id]),
        selectMode: true,
        lastSelectedId: id,
      })
      return
    }

    // Select all emails between last and current (inclusive)
    const startIndex = Math.min(lastIndex, currentIndex)
    const endIndex = Math.max(lastIndex, currentIndex)
    const rangeIds = orderedIds.slice(startIndex, endIndex + 1)

    // Add to existing selection
    const newSelection = new Set(selectedIds)
    rangeIds.forEach((rangeId) => newSelection.add(rangeId))

    set({
      selectedIds: newSelection,
      selectMode: true,
      // Keep lastSelectedId for next range selection
    })

    logger.debug('selection', 'Range selection', {
      from: lastSelectedId,
      to: id,
      count: rangeIds.length,
      total: newSelection.size,
    })
  },

  /**
   * Toggle selection mode
   */
  toggleSelectMode: () => {
    const { selectMode } = get()
    if (selectMode) {
      // Exiting select mode - clear selection
      set({
        selectedIds: new Set(),
        selectMode: false,
        lastSelectedId: null,
      })
    } else {
      set({ selectMode: true })
    }
    logger.debug('selection', 'Select mode toggled', { active: !selectMode })
  },

  /**
   * Select all emails
   * Task 5.6: Add "Select All" / "Deselect All" functionality
   */
  selectAll: (ids) => {
    set({
      selectedIds: new Set(ids),
      selectMode: true,
    })
    logger.debug('selection', 'All selected', { count: ids.length })
  },

  /**
   * Clear all selections
   * Task 5.6: Add "Select All" / "Deselect All" functionality
   */
  clearSelection: () => {
    set({
      selectedIds: new Set(),
      selectMode: false,
      lastSelectedId: null,
    })
    logger.debug('selection', 'Selection cleared')
  },

  /**
   * Set the ordered list of email IDs for range selection
   */
  setEmailIdOrder: (ids) => {
    set({ emailIdOrder: ids })
  },

  /**
   * Check if an email is selected
   */
  isSelected: (id) => {
    return get().selectedIds.has(id)
  },
}))

/**
 * Expose selection store for E2E testing in development mode
 */
if (import.meta.env.DEV) {
  ;(
    window as unknown as { __TEST_SELECTION_STORE__: typeof useSelectionStore }
  ).__TEST_SELECTION_STORE__ = useSelectionStore
}
