/**
 * useOnboardingState Hook
 *
 * Story 2.12: Empty States & Onboarding UX
 * Task 2.4: Create hook to track first-launch status in localStorage
 *
 * Manages onboarding state including:
 * - First-launch detection
 * - Welcome screen dismissal
 * - Feature tour completion
 *
 * Usage:
 *   const { isFirstLaunch, dismissWelcome, hasCompletedTour } = useOnboardingState()
 */

import { useState, useCallback, useEffect } from 'react'

const STORAGE_KEYS = {
  WELCOME_DISMISSED: 'claine_welcome_dismissed',
  ONBOARDING_COMPLETED: 'claine_onboarding_completed',
  FIRST_LAUNCH_DATE: 'claine_first_launch_date',
} as const

export interface OnboardingState {
  /** Whether this is the user's first launch */
  isFirstLaunch: boolean
  /** Whether the welcome screen has been dismissed */
  hasSeenWelcome: boolean
  /** Whether the user has completed the onboarding tour */
  hasCompletedOnboarding: boolean
  /** Timestamp of first launch */
  firstLaunchDate: number | null
  /** Dismiss the welcome screen */
  dismissWelcome: () => void
  /** Mark onboarding as complete */
  completeOnboarding: () => void
  /** Reset onboarding state (for testing) */
  resetOnboarding: () => void
}

/**
 * Read boolean flag from localStorage
 */
function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === 'true'
  } catch {
    return false
  }
}

/**
 * Read timestamp from localStorage
 */
function readTimestamp(key: string): number | null {
  try {
    const value = localStorage.getItem(key)
    return value ? parseInt(value, 10) : null
  } catch {
    return null
  }
}

/**
 * Write boolean flag to localStorage
 */
function writeFlag(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, String(value))
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Write timestamp to localStorage
 */
function writeTimestamp(key: string, value: number): void {
  try {
    localStorage.setItem(key, String(value))
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Remove key from localStorage
 */
function removeKey(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * useOnboardingState - Manage user onboarding state
 *
 * Features:
 * - Persists state to localStorage
 * - Detects first-time users
 * - Tracks welcome screen dismissal
 * - Tracks onboarding completion
 */
export function useOnboardingState(): OnboardingState {
  const [hasSeenWelcome, setHasSeenWelcome] = useState(() =>
    readFlag(STORAGE_KEYS.WELCOME_DISMISSED)
  )
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(() =>
    readFlag(STORAGE_KEYS.ONBOARDING_COMPLETED)
  )
  const [firstLaunchDate, setFirstLaunchDate] = useState<number | null>(() =>
    readTimestamp(STORAGE_KEYS.FIRST_LAUNCH_DATE)
  )

  // Record first launch date if not already set
  useEffect(() => {
    if (!firstLaunchDate) {
      const now = Date.now()
      writeTimestamp(STORAGE_KEYS.FIRST_LAUNCH_DATE, now)
      // Queue state update to avoid synchronous setState in effect
      queueMicrotask(() => {
        setFirstLaunchDate(now)
      })
    }
  }, [firstLaunchDate])

  // Compute isFirstLaunch: not seen welcome AND no accounts (handled by consumer)
  const isFirstLaunch = !hasSeenWelcome

  const dismissWelcome = useCallback(() => {
    writeFlag(STORAGE_KEYS.WELCOME_DISMISSED, true)
    setHasSeenWelcome(true)
  }, [])

  const completeOnboarding = useCallback(() => {
    writeFlag(STORAGE_KEYS.ONBOARDING_COMPLETED, true)
    setHasCompletedOnboarding(true)
  }, [])

  const resetOnboarding = useCallback(() => {
    removeKey(STORAGE_KEYS.WELCOME_DISMISSED)
    removeKey(STORAGE_KEYS.ONBOARDING_COMPLETED)
    removeKey(STORAGE_KEYS.FIRST_LAUNCH_DATE)
    setHasSeenWelcome(false)
    setHasCompletedOnboarding(false)
    setFirstLaunchDate(null)
  }, [])

  return {
    isFirstLaunch,
    hasSeenWelcome,
    hasCompletedOnboarding,
    firstLaunchDate,
    dismissWelcome,
    completeOnboarding,
    resetOnboarding,
  }
}

export default useOnboardingState
