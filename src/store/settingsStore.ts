/**
 * Settings Store
 * Manages user preferences and settings using Zustand
 *
 * Features:
 * - Persist settings to localStorage
 * - Privacy controls for error tracking
 * - Theme and UI preferences
 * - Integrates with Sentry for privacy opt-out
 */

import { create } from 'zustand'
import { registerSettingsAccessor } from '@/services/logger/sentry'

/**
 * localStorage key for persisting settings
 */
const SETTINGS_KEY = 'claine_settings'

/**
 * Settings state interface
 */
export interface SettingsState {
  /** Whether error tracking (Sentry) is enabled */
  errorTrackingEnabled: boolean
  /** Log level preference (can override VITE_LOG_LEVEL) */
  logLevel: 'debug' | 'info' | 'warn' | 'error' | null
  /** Theme preference */
  theme: 'light' | 'dark' | 'system'

  // Actions
  setErrorTrackingEnabled: (enabled: boolean) => void
  setLogLevel: (level: SettingsState['logLevel']) => void
  setTheme: (theme: SettingsState['theme']) => void
  resetSettings: () => void
}

/**
 * Default settings values
 */
const DEFAULT_SETTINGS: Pick<SettingsState, 'errorTrackingEnabled' | 'logLevel' | 'theme'> = {
  errorTrackingEnabled: true,
  logLevel: null, // Use environment default
  theme: 'system',
}

/**
 * Load persisted settings from localStorage
 */
function loadPersistedSettings(): Partial<SettingsState> {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY)
    if (stored) {
      return JSON.parse(stored) as Partial<SettingsState>
    }
  } catch {
    // Ignore localStorage errors
  }
  return {}
}

/**
 * Persist settings to localStorage
 */
function persistSettings(
  settings: Pick<SettingsState, 'errorTrackingEnabled' | 'logLevel' | 'theme'>
): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Settings store using Zustand
 */
export const useSettingsStore = create<SettingsState>((set, get) => {
  // Load persisted settings
  const persisted = loadPersistedSettings()

  return {
    // Initial state (persisted values override defaults)
    errorTrackingEnabled: persisted.errorTrackingEnabled ?? DEFAULT_SETTINGS.errorTrackingEnabled,
    logLevel: persisted.logLevel ?? DEFAULT_SETTINGS.logLevel,
    theme: persisted.theme ?? DEFAULT_SETTINGS.theme,

    /**
     * Set error tracking enabled/disabled
     * Controls whether errors are sent to Sentry
     */
    setErrorTrackingEnabled: (enabled: boolean) => {
      set({ errorTrackingEnabled: enabled })
      persistSettings({ ...get(), errorTrackingEnabled: enabled })
    },

    /**
     * Set log level preference
     * null means use environment default
     */
    setLogLevel: (level: SettingsState['logLevel']) => {
      set({ logLevel: level })
      persistSettings({ ...get(), logLevel: level })
    },

    /**
     * Set theme preference
     */
    setTheme: (theme: SettingsState['theme']) => {
      set({ theme })
      persistSettings({ ...get(), theme })
    },

    /**
     * Reset all settings to defaults
     */
    resetSettings: () => {
      set(DEFAULT_SETTINGS)
      persistSettings(DEFAULT_SETTINGS)
    },
  }
})

/**
 * Register settings accessor with Sentry
 * This allows Sentry to check privacy opt-out without circular imports
 */
registerSettingsAccessor(() => useSettingsStore.getState().errorTrackingEnabled)

/**
 * Expose settings store for E2E testing in development mode
 */
if (import.meta.env.DEV) {
  ;(
    window as unknown as { __TEST_SETTINGS_STORE__: typeof useSettingsStore }
  ).__TEST_SETTINGS_STORE__ = useSettingsStore
}
