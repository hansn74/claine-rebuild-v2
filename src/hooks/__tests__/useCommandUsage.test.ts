/**
 * useCommandUsage Hook Tests
 *
 * Story 2.23: Keyboard Shortcut Discoverability
 * Task 7: Write comprehensive tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCommandUsage } from '../useCommandUsage'

const STORAGE_KEY = 'claine-command-usage'

describe('useCommandUsage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('should return empty array for getRecentCommands initially', () => {
    const { result } = renderHook(() => useCommandUsage())

    expect(result.current.getRecentCommands()).toEqual([])
  })

  it('should record command usage and return in recent commands', () => {
    const { result } = renderHook(() => useCommandUsage())

    act(() => {
      result.current.recordCommandUsage('archive')
    })

    expect(result.current.getRecentCommands()).toEqual(['archive'])
  })

  it('should return commands in order of recency (most recent first)', () => {
    const { result } = renderHook(() => useCommandUsage())

    act(() => {
      result.current.recordCommandUsage('archive')
      result.current.recordCommandUsage('delete')
      result.current.recordCommandUsage('reply')
    })

    expect(result.current.getRecentCommands()).toEqual(['reply', 'delete', 'archive'])
  })

  it('should move repeated command to front of recent list', () => {
    const { result } = renderHook(() => useCommandUsage())

    act(() => {
      result.current.recordCommandUsage('archive')
      result.current.recordCommandUsage('delete')
      result.current.recordCommandUsage('archive') // Use archive again
    })

    expect(result.current.getRecentCommands()).toEqual(['archive', 'delete'])
  })

  it('should limit recent commands to 10', () => {
    const { result } = renderHook(() => useCommandUsage())

    act(() => {
      for (let i = 0; i < 15; i++) {
        result.current.recordCommandUsage(`command-${i}`)
      }
    })

    const recent = result.current.getRecentCommands()
    expect(recent).toHaveLength(10)
    expect(recent[0]).toBe('command-14') // Most recent
    expect(recent[9]).toBe('command-5') // Oldest in list (command-0 through command-4 dropped)
  })

  it('should track usage counts correctly', () => {
    const { result } = renderHook(() => useCommandUsage())

    act(() => {
      result.current.recordCommandUsage('archive')
      result.current.recordCommandUsage('archive')
      result.current.recordCommandUsage('delete')
    })

    expect(result.current.getUsageCount('archive')).toBe(2)
    expect(result.current.getUsageCount('delete')).toBe(1)
    expect(result.current.getUsageCount('unknown')).toBe(0)
  })

  it('should persist data to localStorage', () => {
    const { result } = renderHook(() => useCommandUsage())

    act(() => {
      result.current.recordCommandUsage('archive')
    })

    const stored = localStorage.getItem(STORAGE_KEY)
    expect(stored).not.toBeNull()

    const data = JSON.parse(stored!)
    expect(data.counts.archive).toBe(1)
    expect(data.recent).toContain('archive')
  })

  it('should clear usage data with clearUsageData', () => {
    const { result } = renderHook(() => useCommandUsage())

    act(() => {
      result.current.recordCommandUsage('archive')
      result.current.recordCommandUsage('delete')
    })

    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull()

    act(() => {
      result.current.clearUsageData()
    })

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('should load existing data from localStorage', () => {
    // Pre-populate localStorage
    const existingData = {
      counts: { archive: 5, delete: 3 },
      recent: ['delete', 'archive'],
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existingData))

    const { result } = renderHook(() => useCommandUsage())

    expect(result.current.getUsageCount('archive')).toBe(5)
    expect(result.current.getRecentCommands()).toEqual(['delete', 'archive'])
  })
})
