/**
 * Attribute Filter Store Tests
 *
 * Story 2.15: Attribute-Based Filtering & Search
 * Task 1.3: Unit tests for filter store operations
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useAttributeFilterStore } from '../attributeFilterStore'

describe('attributeFilterStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useAttributeFilterStore.getState().clearAllFilters()
  })

  describe('setFilter', () => {
    it('should set filter values for an attribute', () => {
      const store = useAttributeFilterStore.getState()

      store.setFilter('status', ['to-do', 'in-progress'])

      expect(store.getFilterValues('status')).toEqual(['to-do', 'in-progress'])
    })

    it('should replace existing filter values', () => {
      const store = useAttributeFilterStore.getState()

      store.setFilter('priority', ['high'])
      store.setFilter('priority', ['low', 'medium'])

      expect(store.getFilterValues('priority')).toEqual(['low', 'medium'])
    })

    it('should remove filter when empty array is passed', () => {
      const store = useAttributeFilterStore.getState()

      store.setFilter('status', ['to-do'])
      store.setFilter('status', [])

      expect(store.getFilterValues('status')).toEqual([])
      expect(store.hasActiveFilters()).toBe(false)
    })

    it('should support multiple attribute filters (AND logic)', () => {
      const store = useAttributeFilterStore.getState()

      store.setFilter('status', ['to-do'])
      store.setFilter('priority', ['high'])

      expect(store.getFilterValues('status')).toEqual(['to-do'])
      expect(store.getFilterValues('priority')).toEqual(['high'])
      expect(store.getActiveFilterCount()).toBe(2)
    })
  })

  describe('addFilterValue', () => {
    it('should add a value to existing filter', () => {
      const store = useAttributeFilterStore.getState()

      store.setFilter('status', ['to-do'])
      store.addFilterValue('status', 'in-progress')

      expect(store.getFilterValues('status')).toEqual(['to-do', 'in-progress'])
    })

    it('should create new filter if none exists', () => {
      const store = useAttributeFilterStore.getState()

      store.addFilterValue('project', 'alpha')

      expect(store.getFilterValues('project')).toEqual(['alpha'])
    })

    it('should not add duplicate values', () => {
      const store = useAttributeFilterStore.getState()

      store.setFilter('status', ['to-do'])
      store.addFilterValue('status', 'to-do')

      expect(store.getFilterValues('status')).toEqual(['to-do'])
    })

    it('should support boolean values', () => {
      const store = useAttributeFilterStore.getState()

      store.addFilterValue('urgent', true)

      expect(store.getFilterValues('urgent')).toEqual([true])
    })

    it('should support number values', () => {
      const store = useAttributeFilterStore.getState()

      store.addFilterValue('priority-score', 5)

      expect(store.getFilterValues('priority-score')).toEqual([5])
    })
  })

  describe('removeFilterValue', () => {
    it('should remove a specific value from filter', () => {
      const store = useAttributeFilterStore.getState()

      store.setFilter('status', ['to-do', 'in-progress', 'done'])
      store.removeFilterValue('status', 'in-progress')

      expect(store.getFilterValues('status')).toEqual(['to-do', 'done'])
    })

    it('should remove filter entirely when last value removed', () => {
      const store = useAttributeFilterStore.getState()

      store.setFilter('status', ['to-do'])
      store.removeFilterValue('status', 'to-do')

      expect(store.getFilterValues('status')).toEqual([])
      expect(store.hasActiveFilters()).toBe(false)
    })

    it('should not error when removing from non-existent filter', () => {
      const store = useAttributeFilterStore.getState()

      // Should not throw
      store.removeFilterValue('non-existent', 'value')

      expect(store.getFilterValues('non-existent')).toEqual([])
    })
  })

  describe('clearFilter', () => {
    it('should clear filter for specific attribute', () => {
      const store = useAttributeFilterStore.getState()

      store.setFilter('status', ['to-do'])
      store.setFilter('priority', ['high'])
      store.clearFilter('status')

      expect(store.getFilterValues('status')).toEqual([])
      expect(store.getFilterValues('priority')).toEqual(['high'])
    })
  })

  describe('clearAllFilters', () => {
    it('should clear all active filters', () => {
      const store = useAttributeFilterStore.getState()

      store.setFilter('status', ['to-do'])
      store.setFilter('priority', ['high'])
      store.setFilter('project', ['alpha'])
      store.clearAllFilters()

      expect(store.hasActiveFilters()).toBe(false)
      expect(store.getActiveFilterCount()).toBe(0)
    })
  })

  describe('getActiveFilterCount', () => {
    it('should return 0 when no filters', () => {
      const store = useAttributeFilterStore.getState()

      expect(store.getActiveFilterCount()).toBe(0)
    })

    it('should count number of attributes with filters', () => {
      const store = useAttributeFilterStore.getState()

      store.setFilter('status', ['to-do', 'in-progress'])
      store.setFilter('priority', ['high'])

      expect(store.getActiveFilterCount()).toBe(2)
    })
  })

  describe('hasActiveFilters', () => {
    it('should return false when no filters', () => {
      const store = useAttributeFilterStore.getState()

      expect(store.hasActiveFilters()).toBe(false)
    })

    it('should return true when filters exist', () => {
      const store = useAttributeFilterStore.getState()

      store.setFilter('status', ['to-do'])

      expect(store.hasActiveFilters()).toBe(true)
    })
  })

  describe('getActiveFilterEntries', () => {
    it('should return empty array when no filters', () => {
      const store = useAttributeFilterStore.getState()

      expect(store.getActiveFilterEntries()).toEqual([])
    })

    it('should return all filter entries as array', () => {
      const store = useAttributeFilterStore.getState()

      store.setFilter('status', ['to-do'])
      store.setFilter('priority', ['high', 'medium'])

      const entries = store.getActiveFilterEntries()

      expect(entries).toHaveLength(2)
      expect(entries).toContainEqual(['status', ['to-do']])
      expect(entries).toContainEqual(['priority', ['high', 'medium']])
    })
  })

  describe('store reactivity', () => {
    it('should update subscribers when filters change', () => {
      const store = useAttributeFilterStore

      const states: boolean[] = []
      const unsubscribe = store.subscribe(
        (state) => state.hasActiveFilters(),
        (hasFilters) => {
          states.push(hasFilters)
        }
      )

      store.getState().setFilter('status', ['to-do'])
      store.getState().clearAllFilters()

      unsubscribe()

      expect(states).toEqual([true, false])
    })
  })
})
