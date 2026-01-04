/**
 * useFirstTimeTooltip Hook Tests
 *
 * Story 2.12: Empty States & Onboarding UX
 * Task 5.6: Tooltip visibility and dismiss logic tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useFirstTimeTooltip, useFirstTimeTooltips, TOOLTIP_IDS } from '../useFirstTimeTooltip'

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
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

describe('useFirstTimeTooltip', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  describe('shouldShow', () => {
    it('should return true for undismissed tooltip', () => {
      const { result } = renderHook(() => useFirstTimeTooltip(TOOLTIP_IDS.KEYBOARD_SHORTCUTS))

      expect(result.current.shouldShow).toBe(true)
    })

    it('should return false for dismissed tooltip', () => {
      // Pre-set dismissed tooltips in localStorage
      localStorageMock.setItem(
        'claine_dismissed_tooltips',
        JSON.stringify([TOOLTIP_IDS.KEYBOARD_SHORTCUTS])
      )

      const { result } = renderHook(() => useFirstTimeTooltip(TOOLTIP_IDS.KEYBOARD_SHORTCUTS))

      expect(result.current.shouldShow).toBe(false)
    })
  })

  describe('dismiss', () => {
    it('should dismiss tooltip and persist to localStorage', () => {
      const { result } = renderHook(() => useFirstTimeTooltip(TOOLTIP_IDS.SEARCH))

      expect(result.current.shouldShow).toBe(true)

      act(() => {
        result.current.dismiss()
      })

      expect(result.current.shouldShow).toBe(false)
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'claine_dismissed_tooltips',
        expect.stringContaining(TOOLTIP_IDS.SEARCH)
      )
    })

    it('should not dismiss other tooltips', () => {
      const { result: searchResult } = renderHook(() => useFirstTimeTooltip(TOOLTIP_IDS.SEARCH))
      const { result: archiveResult } = renderHook(() => useFirstTimeTooltip(TOOLTIP_IDS.ARCHIVE))

      act(() => {
        searchResult.current.dismiss()
      })

      expect(searchResult.current.shouldShow).toBe(false)
      // Archive tooltip should still be visible (fresh render)
      expect(archiveResult.current.shouldShow).toBe(true)
    })
  })

  describe('isDismissed', () => {
    it('should return false for undismissed tooltip', () => {
      const { result } = renderHook(() => useFirstTimeTooltip(TOOLTIP_IDS.COMPOSE))

      expect(result.current.isDismissed).toBe(false)
    })

    it('should return true after dismissing', () => {
      const { result } = renderHook(() => useFirstTimeTooltip(TOOLTIP_IDS.COMPOSE))

      act(() => {
        result.current.dismiss()
      })

      expect(result.current.isDismissed).toBe(true)
    })
  })
})

describe('useFirstTimeTooltips (manager)', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  describe('shouldShow', () => {
    it('should return true for any undismissed tooltip', () => {
      const { result } = renderHook(() => useFirstTimeTooltips())

      expect(result.current.shouldShow(TOOLTIP_IDS.KEYBOARD_SHORTCUTS)).toBe(true)
      expect(result.current.shouldShow(TOOLTIP_IDS.SEARCH)).toBe(true)
      expect(result.current.shouldShow(TOOLTIP_IDS.ARCHIVE)).toBe(true)
    })
  })

  describe('dismiss', () => {
    it('should dismiss a specific tooltip', () => {
      const { result } = renderHook(() => useFirstTimeTooltips())

      act(() => {
        result.current.dismiss(TOOLTIP_IDS.SEARCH)
      })

      expect(result.current.shouldShow(TOOLTIP_IDS.SEARCH)).toBe(false)
      expect(result.current.shouldShow(TOOLTIP_IDS.ARCHIVE)).toBe(true)
    })
  })

  describe('dismissAll', () => {
    it('should dismiss all predefined tooltips', () => {
      const { result } = renderHook(() => useFirstTimeTooltips())

      act(() => {
        result.current.dismissAll()
      })

      // All predefined tooltips should be dismissed
      Object.values(TOOLTIP_IDS).forEach((id) => {
        expect(result.current.shouldShow(id)).toBe(false)
      })
    })
  })

  describe('resetAll', () => {
    it('should reset all tooltips to show again', () => {
      const { result } = renderHook(() => useFirstTimeTooltips())

      // First dismiss all
      act(() => {
        result.current.dismissAll()
      })

      // Then reset
      act(() => {
        result.current.resetAll()
      })

      // All should be visible again
      Object.values(TOOLTIP_IDS).forEach((id) => {
        expect(result.current.shouldShow(id)).toBe(true)
      })
    })

    it('should remove localStorage data', () => {
      const { result } = renderHook(() => useFirstTimeTooltips())

      act(() => {
        result.current.dismissAll()
      })

      act(() => {
        result.current.resetAll()
      })

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('claine_dismissed_tooltips')
    })
  })

  describe('dismissedIds', () => {
    it('should return empty set initially', () => {
      const { result } = renderHook(() => useFirstTimeTooltips())

      expect(result.current.dismissedIds.size).toBe(0)
    })

    it('should contain dismissed tooltip IDs', () => {
      const { result } = renderHook(() => useFirstTimeTooltips())

      act(() => {
        result.current.dismiss(TOOLTIP_IDS.SEARCH)
        result.current.dismiss(TOOLTIP_IDS.ARCHIVE)
      })

      expect(result.current.dismissedIds.has(TOOLTIP_IDS.SEARCH)).toBe(true)
      expect(result.current.dismissedIds.has(TOOLTIP_IDS.ARCHIVE)).toBe(true)
      expect(result.current.dismissedIds.has(TOOLTIP_IDS.COMPOSE)).toBe(false)
    })
  })
})

describe('TOOLTIP_IDS constants', () => {
  it('should have expected predefined tooltip IDs', () => {
    expect(TOOLTIP_IDS.KEYBOARD_SHORTCUTS).toBe('keyboard-shortcuts')
    expect(TOOLTIP_IDS.SEARCH).toBe('search')
    expect(TOOLTIP_IDS.ARCHIVE).toBe('archive')
    expect(TOOLTIP_IDS.COMPOSE).toBe('compose')
    expect(TOOLTIP_IDS.FOLDERS).toBe('folders')
    expect(TOOLTIP_IDS.OFFLINE_MODE).toBe('offline-mode')
  })
})
