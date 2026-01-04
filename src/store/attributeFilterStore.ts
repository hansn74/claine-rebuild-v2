/**
 * Attribute Filter Store
 * Manages attribute filter state using Zustand
 *
 * Story 2.15: Attribute-Based Filtering & Search
 * Task 1: Create Attribute Filter Store
 *
 * Features:
 * - Track active filters per attribute (attributeId → selected values)
 * - AND logic for combining multiple filters
 * - Session-only persistence (clears on page reload)
 */

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

/**
 * Filter value type - supports multiple value types
 * Stored as strings internally, converted during query
 */
export type FilterValue = string | number | boolean

/**
 * Attribute filter store state and actions
 */
export interface AttributeFilterState {
  // Map of attributeId → array of selected filter values
  activeFilters: Map<string, FilterValue[]>

  // Actions
  setFilter: (attributeId: string, values: FilterValue[]) => void
  addFilterValue: (attributeId: string, value: FilterValue) => void
  removeFilterValue: (attributeId: string, value: FilterValue) => void
  clearFilter: (attributeId: string) => void
  clearAllFilters: () => void

  // Getters
  getActiveFilterCount: () => number
  getFilterValues: (attributeId: string) => FilterValue[]
  hasActiveFilters: () => boolean
  getActiveFilterEntries: () => [string, FilterValue[]][]
}

/**
 * Attribute filter store using Zustand
 * Follows same pattern as attributeStore.ts
 */
export const useAttributeFilterStore = create<AttributeFilterState>()(
  subscribeWithSelector((set, get) => ({
    activeFilters: new Map<string, FilterValue[]>(),

    /**
     * Set filter values for an attribute
     * Replaces existing values for that attribute
     */
    setFilter: (attributeId: string, values: FilterValue[]) => {
      set((state) => {
        const newFilters = new Map(state.activeFilters)
        if (values.length === 0) {
          newFilters.delete(attributeId)
        } else {
          newFilters.set(attributeId, values)
        }
        return { activeFilters: newFilters }
      })
    },

    /**
     * Add a single value to an attribute's filter
     */
    addFilterValue: (attributeId: string, value: FilterValue) => {
      set((state) => {
        const newFilters = new Map(state.activeFilters)
        const existing = newFilters.get(attributeId) ?? []
        // Avoid duplicates
        if (!existing.includes(value)) {
          newFilters.set(attributeId, [...existing, value])
        }
        return { activeFilters: newFilters }
      })
    },

    /**
     * Remove a single value from an attribute's filter
     */
    removeFilterValue: (attributeId: string, value: FilterValue) => {
      set((state) => {
        const newFilters = new Map(state.activeFilters)
        const existing = newFilters.get(attributeId) ?? []
        const updated = existing.filter((v) => v !== value)
        if (updated.length === 0) {
          newFilters.delete(attributeId)
        } else {
          newFilters.set(attributeId, updated)
        }
        return { activeFilters: newFilters }
      })
    },

    /**
     * Clear filter for a specific attribute
     */
    clearFilter: (attributeId: string) => {
      set((state) => {
        const newFilters = new Map(state.activeFilters)
        newFilters.delete(attributeId)
        return { activeFilters: newFilters }
      })
    },

    /**
     * Clear all active filters
     */
    clearAllFilters: () => {
      set({ activeFilters: new Map() })
    },

    /**
     * Get total count of active filters (number of attributes with filters)
     */
    getActiveFilterCount: () => {
      return get().activeFilters.size
    },

    /**
     * Get filter values for a specific attribute
     */
    getFilterValues: (attributeId: string) => {
      return get().activeFilters.get(attributeId) ?? []
    },

    /**
     * Check if any filters are active
     */
    hasActiveFilters: () => {
      return get().activeFilters.size > 0
    },

    /**
     * Get all active filter entries as array for iteration
     */
    getActiveFilterEntries: () => {
      return Array.from(get().activeFilters.entries())
    },
  }))
)

/**
 * Expose filter store for E2E testing in development mode
 */
if (import.meta.env.DEV) {
  ;(
    window as unknown as { __TEST_ATTRIBUTE_FILTER_STORE__: typeof useAttributeFilterStore }
  ).__TEST_ATTRIBUTE_FILTER_STORE__ = useAttributeFilterStore
}
