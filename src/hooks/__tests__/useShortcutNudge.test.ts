/**
 * useShortcutNudge Hook Tests
 *
 * Story 2.23: Keyboard Shortcut Discoverability
 * Task 7: Write comprehensive tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useShortcutNudge } from '../useShortcutNudge'
import { useSettingsStore } from '@/store/settingsStore'

// Mock the settings store
vi.mock('@/store/settingsStore', () => ({
  useSettingsStore: vi.fn((selector) => selector({ showKeyboardHints: true })),
}))

const STORAGE_KEY = 'claine-shortcut-nudges'

describe('useShortcutNudge', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('should return false for shouldShowNudge initially', () => {
    const { result } = renderHook(() => useShortcutNudge())

    expect(result.current.shouldShowNudge('archive')).toBe(false)
  })

  it('should return true for shouldShowNudge after 3 mouse actions', () => {
    const { result } = renderHook(() => useShortcutNudge())

    act(() => {
      result.current.recordMouseAction('archive')
      result.current.recordMouseAction('archive')
      result.current.recordMouseAction('archive')
    })

    expect(result.current.shouldShowNudge('archive')).toBe(true)
  })

  it('should return false after nudge is marked as shown', () => {
    const { result } = renderHook(() => useShortcutNudge())

    act(() => {
      result.current.recordMouseAction('archive')
      result.current.recordMouseAction('archive')
      result.current.recordMouseAction('archive')
    })

    expect(result.current.shouldShowNudge('archive')).toBe(true)

    act(() => {
      result.current.markNudgeShown('archive')
    })

    expect(result.current.shouldShowNudge('archive')).toBe(false)
  })

  it('should reset mouse count when keyboard action is recorded', () => {
    const { result } = renderHook(() => useShortcutNudge())

    act(() => {
      result.current.recordMouseAction('archive')
      result.current.recordMouseAction('archive')
    })

    expect(result.current.getMouseCount('archive')).toBe(2)

    act(() => {
      result.current.recordKeyboardAction('archive')
    })

    expect(result.current.getMouseCount('archive')).toBe(0)
  })

  it('should track actions independently per action ID', () => {
    const { result } = renderHook(() => useShortcutNudge())

    act(() => {
      result.current.recordMouseAction('archive')
      result.current.recordMouseAction('archive')
      result.current.recordMouseAction('archive')
      result.current.recordMouseAction('delete')
    })

    expect(result.current.shouldShowNudge('archive')).toBe(true)
    expect(result.current.shouldShowNudge('delete')).toBe(false)
  })

  it('should persist data to localStorage', () => {
    const { result } = renderHook(() => useShortcutNudge())

    act(() => {
      result.current.recordMouseAction('archive')
      result.current.recordMouseAction('archive')
    })

    const stored = localStorage.getItem(STORAGE_KEY)
    expect(stored).not.toBeNull()

    const data = JSON.parse(stored!)
    expect(data.archive.mouseCount).toBe(2)
  })

  it('should clear data with resetNudgeData', () => {
    const { result } = renderHook(() => useShortcutNudge())

    act(() => {
      result.current.recordMouseAction('archive')
      result.current.recordMouseAction('archive')
      result.current.recordMouseAction('archive')
    })

    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull()

    act(() => {
      result.current.resetNudgeData()
    })

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})

describe('useShortcutNudge with hints disabled', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()

    // Re-mock with hints disabled
    vi.mocked(useSettingsStore).mockImplementation(
      (selector: (state: { showKeyboardHints: boolean }) => boolean) =>
        selector({ showKeyboardHints: false })
    )
  })

  it('should return false for shouldShowNudge when hints are disabled', () => {
    const { result } = renderHook(() => useShortcutNudge())

    act(() => {
      result.current.recordMouseAction('archive')
      result.current.recordMouseAction('archive')
      result.current.recordMouseAction('archive')
    })

    expect(result.current.shouldShowNudge('archive')).toBe(false)
  })
})
