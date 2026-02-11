/**
 * Unit tests for viewModeStore
 *
 * Story 3.4: Priority-Based Inbox View
 * Task 7: Tests for view mode state, toggle, persistence, Set serialization
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useViewModeStore } from '../viewModeStore'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
    get length() {
      return Object.keys(store).length
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  }
})()

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

describe('viewModeStore', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
    // Reset store to defaults
    useViewModeStore.setState({
      viewMode: 'chronological',
      collapsedSections: new Set(),
    })
  })

  describe('default state', () => {
    it('defaults to chronological view mode', () => {
      const state = useViewModeStore.getState()
      expect(state.viewMode).toBe('chronological')
    })

    it('defaults to empty collapsed sections', () => {
      const state = useViewModeStore.getState()
      expect(state.collapsedSections.size).toBe(0)
    })
  })

  describe('setViewMode', () => {
    it('sets view mode to priority', () => {
      useViewModeStore.getState().setViewMode('priority')
      expect(useViewModeStore.getState().viewMode).toBe('priority')
    })

    it('persists view mode to localStorage', () => {
      useViewModeStore.getState().setViewMode('priority')
      expect(localStorageMock.setItem).toHaveBeenCalledWith('claine_inbox_view_mode', 'priority')
    })
  })

  describe('toggleViewMode', () => {
    it('toggles from chronological to priority', () => {
      useViewModeStore.getState().toggleViewMode()
      expect(useViewModeStore.getState().viewMode).toBe('priority')
    })

    it('toggles from priority back to chronological', () => {
      useViewModeStore.getState().setViewMode('priority')
      useViewModeStore.getState().toggleViewMode()
      expect(useViewModeStore.getState().viewMode).toBe('chronological')
    })

    it('persists toggled mode to localStorage', () => {
      useViewModeStore.getState().toggleViewMode()
      expect(localStorageMock.setItem).toHaveBeenCalledWith('claine_inbox_view_mode', 'priority')
    })
  })

  describe('toggleSection', () => {
    it('collapses a section', () => {
      useViewModeStore.getState().toggleSection('high')
      expect(useViewModeStore.getState().collapsedSections.has('high')).toBe(true)
    })

    it('expands a previously collapsed section', () => {
      useViewModeStore.getState().toggleSection('high')
      useViewModeStore.getState().toggleSection('high')
      expect(useViewModeStore.getState().collapsedSections.has('high')).toBe(false)
    })

    it('persists collapsed sections as JSON array', () => {
      useViewModeStore.getState().toggleSection('high')
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'claine_collapsed_sections',
        JSON.stringify(['high'])
      )
    })
  })

  describe('isSectionCollapsed', () => {
    it('returns false for non-collapsed section', () => {
      expect(useViewModeStore.getState().isSectionCollapsed('high')).toBe(false)
    })

    it('returns true for collapsed section', () => {
      useViewModeStore.getState().toggleSection('medium')
      expect(useViewModeStore.getState().isSectionCollapsed('medium')).toBe(true)
    })
  })
})
