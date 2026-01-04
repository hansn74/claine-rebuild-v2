/**
 * useEmailSelection Hook
 *
 * Story 2.6: Email Actions (Archive, Delete, Mark Read/Unread)
 * Task 5.2: Create useEmailSelection hook
 *
 * Custom hook for managing email selection with keyboard modifiers.
 * Handles single-click, Shift+click range, and Ctrl/Cmd+click toggle.
 *
 * AC 5: Bulk actions available (select multiple emails, apply action to all)
 */

import { useCallback, useMemo } from 'react'
import { useSelectionStore } from '@/store/selectionStore'

import type { MouseEvent } from 'react'

interface UseEmailSelectionOptions {
  /** Ordered list of email IDs for range selection */
  emailIds: string[]
}

export interface UseEmailSelectionReturn {
  /** Set of selected email IDs */
  selectedIds: Set<string>
  /** Number of selected emails */
  selectedCount: number
  /** Whether any emails are selected */
  hasSelection: boolean
  /** Whether all emails are selected */
  allSelected: boolean
  /** Whether selection mode is active */
  selectMode: boolean
  /** Check if a specific email is selected */
  isSelected: (id: string) => boolean
  /** Handle click on an email (respects keyboard modifiers) */
  handleClick: (id: string, event: MouseEvent) => void
  /** Handle checkbox change */
  handleCheckboxChange: (id: string, checked: boolean) => void
  /** Select a single email */
  selectSingle: (id: string) => void
  /** Toggle selection of an email */
  toggleSelect: (id: string) => void
  /** Select all emails */
  selectAll: () => void
  /** Clear all selections */
  clearSelection: () => void
  /** Get array of selected IDs */
  getSelectedArray: () => string[]
}

/**
 * useEmailSelection - Hook for managing email selection
 *
 * Usage:
 * ```tsx
 * function EmailList({ emails }) {
 *   const {
 *     selectedIds,
 *     handleClick,
 *     handleCheckboxChange,
 *     isSelected,
 *     selectAll,
 *     clearSelection
 *   } = useEmailSelection({ emailIds: emails.map(e => e.id) })
 *
 *   return (
 *     <div>
 *       {emails.map(email => (
 *         <EmailListItem
 *           key={email.id}
 *           email={email}
 *           isSelected={isSelected(email.id)}
 *           onClick={(e) => handleClick(email.id, e)}
 *           onCheckboxChange={(checked) => handleCheckboxChange(email.id, checked)}
 *         />
 *       ))}
 *     </div>
 *   )
 * }
 * ```
 */
export function useEmailSelection({ emailIds }: UseEmailSelectionOptions): UseEmailSelectionReturn {
  const {
    selectedIds,
    selectMode,
    selectSingle: storeSelectSingle,
    selectRange,
    toggleSelect: storeToggleSelect,
    selectAll: storeSelectAll,
    clearSelection: storeClearSelection,
    setEmailIdOrder,
  } = useSelectionStore()

  // Keep email ID order in sync
  useMemo(() => {
    setEmailIdOrder(emailIds)
  }, [emailIds, setEmailIdOrder])

  // Derived state
  const selectedCount = selectedIds.size
  const hasSelection = selectedCount > 0
  const allSelected = selectedCount > 0 && selectedCount === emailIds.length

  /**
   * Check if a specific email is selected
   */
  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds])

  /**
   * Handle click on an email with keyboard modifiers
   * Task 5.3: Single-click selection
   * Task 5.4: Shift+click range selection
   * Task 5.5: Ctrl/Cmd+click toggle selection
   */
  const handleClick = useCallback(
    (id: string, event: MouseEvent) => {
      // Shift+click: Range selection
      if (event.shiftKey) {
        selectRange(id, emailIds)
        return
      }

      // Ctrl/Cmd+click: Toggle selection
      if (event.ctrlKey || event.metaKey) {
        storeToggleSelect(id)
        return
      }

      // Regular click: Select single (or view email if not in select mode)
      if (selectMode) {
        storeToggleSelect(id)
      } else {
        storeSelectSingle(id)
      }
    },
    [emailIds, selectMode, selectRange, storeToggleSelect, storeSelectSingle]
  )

  /**
   * Handle checkbox change for direct selection
   */
  const handleCheckboxChange = useCallback(
    (id: string, checked: boolean) => {
      if (checked) {
        if (!selectedIds.has(id)) {
          storeToggleSelect(id)
        }
      } else {
        if (selectedIds.has(id)) {
          storeToggleSelect(id)
        }
      }
    },
    [selectedIds, storeToggleSelect]
  )

  /**
   * Select a single email
   */
  const selectSingle = useCallback(
    (id: string) => {
      storeSelectSingle(id)
    },
    [storeSelectSingle]
  )

  /**
   * Toggle selection of an email
   */
  const toggleSelect = useCallback(
    (id: string) => {
      storeToggleSelect(id)
    },
    [storeToggleSelect]
  )

  /**
   * Select all emails
   * Task 5.6: Add "Select All" functionality
   */
  const selectAll = useCallback(() => {
    storeSelectAll(emailIds)
  }, [emailIds, storeSelectAll])

  /**
   * Clear all selections
   * Task 5.6: Add "Deselect All" functionality
   */
  const clearSelection = useCallback(() => {
    storeClearSelection()
  }, [storeClearSelection])

  /**
   * Get array of selected IDs
   */
  const getSelectedArray = useCallback(() => {
    return Array.from(selectedIds)
  }, [selectedIds])

  return {
    selectedIds,
    selectedCount,
    hasSelection,
    allSelected,
    selectMode,
    isSelected,
    handleClick,
    handleCheckboxChange,
    selectSingle,
    toggleSelect,
    selectAll,
    clearSelection,
    getSelectedArray,
  }
}
