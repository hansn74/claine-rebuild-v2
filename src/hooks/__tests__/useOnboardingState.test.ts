/**
 * useOnboardingState Hook Tests
 *
 * Story 2.12: Empty States & Onboarding UX
 * Task 2.4: First-launch state hook tests
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useOnboardingState } from '../useOnboardingState'

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
    // Helper to get internal store for testing
    _getStore: () => store,
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

describe('useOnboardingState', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('isFirstLaunch', () => {
    it('should return true when welcome has not been seen', () => {
      const { result } = renderHook(() => useOnboardingState())

      expect(result.current.isFirstLaunch).toBe(true)
    })

    it('should return false after welcome is dismissed', () => {
      localStorageMock.setItem('claine_welcome_dismissed', 'true')

      const { result } = renderHook(() => useOnboardingState())

      expect(result.current.isFirstLaunch).toBe(false)
    })
  })

  describe('hasSeenWelcome', () => {
    it('should return false initially', () => {
      const { result } = renderHook(() => useOnboardingState())

      expect(result.current.hasSeenWelcome).toBe(false)
    })

    it('should return true after welcome is dismissed in localStorage', () => {
      localStorageMock.setItem('claine_welcome_dismissed', 'true')

      const { result } = renderHook(() => useOnboardingState())

      expect(result.current.hasSeenWelcome).toBe(true)
    })
  })

  describe('dismissWelcome', () => {
    it('should mark welcome as seen', () => {
      const { result } = renderHook(() => useOnboardingState())

      act(() => {
        result.current.dismissWelcome()
      })

      expect(localStorageMock.setItem).toHaveBeenCalledWith('claine_welcome_dismissed', 'true')
      expect(result.current.hasSeenWelcome).toBe(true)
      expect(result.current.isFirstLaunch).toBe(false)
    })
  })

  describe('hasCompletedOnboarding', () => {
    it('should return false initially', () => {
      const { result } = renderHook(() => useOnboardingState())

      expect(result.current.hasCompletedOnboarding).toBe(false)
    })

    it('should return true when onboarding is complete in localStorage', () => {
      localStorageMock.setItem('claine_onboarding_completed', 'true')

      const { result } = renderHook(() => useOnboardingState())

      expect(result.current.hasCompletedOnboarding).toBe(true)
    })
  })

  describe('completeOnboarding', () => {
    it('should mark onboarding as complete', () => {
      const { result } = renderHook(() => useOnboardingState())

      act(() => {
        result.current.completeOnboarding()
      })

      expect(localStorageMock.setItem).toHaveBeenCalledWith('claine_onboarding_completed', 'true')
      expect(result.current.hasCompletedOnboarding).toBe(true)
    })
  })

  describe('firstLaunchDate', () => {
    it('should auto-set first launch date on first render', async () => {
      const { result } = renderHook(() => useOnboardingState())

      // Wait for useEffect to run
      await waitFor(() => {
        expect(result.current.firstLaunchDate).not.toBeNull()
      })

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'claine_first_launch_date',
        expect.any(String)
      )
    })

    it('should not overwrite existing first launch date', async () => {
      const existingDate = '1234567890'
      localStorageMock.setItem('claine_first_launch_date', existingDate)

      const { result } = renderHook(() => useOnboardingState())

      expect(result.current.firstLaunchDate).toBe(1234567890)
    })
  })

  describe('resetOnboarding', () => {
    it('should clear all onboarding data from localStorage', async () => {
      localStorageMock.setItem('claine_welcome_dismissed', 'true')
      localStorageMock.setItem('claine_onboarding_completed', 'true')
      localStorageMock.setItem('claine_first_launch_date', '1234567890')

      const { result } = renderHook(() => useOnboardingState())

      act(() => {
        result.current.resetOnboarding()
      })

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('claine_welcome_dismissed')
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('claine_onboarding_completed')
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('claine_first_launch_date')

      expect(result.current.hasSeenWelcome).toBe(false)
      expect(result.current.hasCompletedOnboarding).toBe(false)
      // Note: firstLaunchDate gets re-set by useEffect after reset because
      // the hook auto-records first launch date when null
      // This is expected behavior - reset puts the hook back to "first launch" state
    })
  })

  describe('state persistence', () => {
    it('should persist welcome dismissal across renders', () => {
      const { result, rerender } = renderHook(() => useOnboardingState())

      act(() => {
        result.current.dismissWelcome()
      })

      rerender()

      expect(result.current.hasSeenWelcome).toBe(true)
    })

    it('should persist onboarding completion across renders', () => {
      const { result, rerender } = renderHook(() => useOnboardingState())

      act(() => {
        result.current.completeOnboarding()
      })

      rerender()

      expect(result.current.hasCompletedOnboarding).toBe(true)
    })
  })
})
