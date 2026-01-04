/**
 * Shortcut Context
 *
 * Story 2.11: Keyboard Shortcuts & Power User Features
 * Task 1.2: Create ShortcutContext with ShortcutProvider
 * Task 2: Implement Scope-Based Shortcut Management
 *
 * Central context provider for keyboard shortcut management.
 * Manages active scope, registered shortcuts, and Vim mode state.
 */

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react'
import type {
  ShortcutScope,
  ShortcutCategory,
  RegisteredShortcut,
  ShortcutContextValue,
} from '@/types/shortcuts'
import { SCOPE_PRIORITY } from '@/types/shortcuts'
import { logger } from '@/services/logger'

/**
 * Local storage key for shortcut preferences
 */
const STORAGE_KEY = 'claine-shortcut-preferences'

/**
 * Load vim mode preference from localStorage
 */
function loadVimModePreference(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const prefs = JSON.parse(stored)
      return prefs.vimModeEnabled ?? false
    }
  } catch {
    // Ignore parse errors
  }
  return false
}

/**
 * Save vim mode preference to localStorage
 */
function saveVimModePreference(enabled: boolean): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    const prefs = stored ? JSON.parse(stored) : {}
    prefs.vimModeEnabled = enabled
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // Ignore storage errors
  }
}

/**
 * Default context value (throws if used outside provider)
 */
const defaultContextValue: ShortcutContextValue = {
  activeScope: 'global',
  shortcuts: new Map(),
  vimModeEnabled: false,
  enabled: true,
  setActiveScope: () => {
    throw new Error('ShortcutContext not initialized')
  },
  registerShortcut: () => {
    throw new Error('ShortcutContext not initialized')
  },
  unregisterShortcut: () => {
    throw new Error('ShortcutContext not initialized')
  },
  setVimMode: () => {
    throw new Error('ShortcutContext not initialized')
  },
  setEnabled: () => {
    throw new Error('ShortcutContext not initialized')
  },
  getShortcutsForScope: () => [],
  getShortcutsByCategory: () => [],
  getAllShortcuts: () => [],
}

/**
 * Shortcut context
 */
const ShortcutContext = createContext<ShortcutContextValue>(defaultContextValue)

/**
 * Props for ShortcutProvider
 */
interface ShortcutProviderProps {
  children: ReactNode
  /** Initial scope (defaults to 'global') */
  initialScope?: ShortcutScope
}

/**
 * ShortcutProvider - Provides keyboard shortcut context to the app
 *
 * Usage:
 * ```tsx
 * function App() {
 *   return (
 *     <ShortcutProvider>
 *       <YourApp />
 *     </ShortcutProvider>
 *   )
 * }
 * ```
 */
export function ShortcutProvider({ children, initialScope = 'global' }: ShortcutProviderProps) {
  const [activeScope, setActiveScopeState] = useState<ShortcutScope>(initialScope)
  const [shortcuts, setShortcuts] = useState<Map<string, RegisteredShortcut>>(new Map())
  const [vimModeEnabled, setVimModeState] = useState(() => loadVimModePreference())
  const [enabled, setEnabledState] = useState(true)

  /**
   * Set the active scope
   * Task 2.2: Implement scope switching logic
   */
  const setActiveScope = useCallback((scope: ShortcutScope) => {
    setActiveScopeState((prev) => {
      if (prev !== scope) {
        logger.debug('shortcuts', 'Scope changed', { from: prev, to: scope })
      }
      return scope
    })
  }, [])

  /**
   * Register a shortcut
   */
  const registerShortcut = useCallback((shortcut: RegisteredShortcut) => {
    setShortcuts((prev) => {
      const next = new Map(prev)
      next.set(shortcut.id, shortcut)
      return next
    })
    logger.debug('shortcuts', 'Shortcut registered', {
      id: shortcut.id,
      keys: shortcut.keys,
      scopes: shortcut.scopes,
    })
  }, [])

  /**
   * Unregister a shortcut by ID
   */
  const unregisterShortcut = useCallback((id: string) => {
    setShortcuts((prev) => {
      const next = new Map(prev)
      next.delete(id)
      return next
    })
    logger.debug('shortcuts', 'Shortcut unregistered', { id })
  }, [])

  /**
   * Enable or disable Vim mode
   * Task 8: Vim-style navigation option
   */
  const setVimMode = useCallback((enabled: boolean) => {
    setVimModeState(enabled)
    saveVimModePreference(enabled)
    logger.info('shortcuts', 'Vim mode changed', { enabled })
  }, [])

  /**
   * Enable or disable all shortcuts
   */
  const setEnabled = useCallback((enabled: boolean) => {
    setEnabledState(enabled)
    logger.debug('shortcuts', 'Shortcuts enabled changed', { enabled })
  }, [])

  /**
   * Get shortcuts for a specific scope
   * Task 2.4: Conflict resolution - higher priority scopes win
   */
  const getShortcutsForScope = useCallback(
    (scope: ShortcutScope): RegisteredShortcut[] => {
      const result: RegisteredShortcut[] = []

      shortcuts.forEach((shortcut) => {
        // Check if shortcut is active in this scope
        if (!shortcut.scopes.includes(scope)) return

        // Check if shortcut requires Vim mode
        if (shortcut.requiresVimMode && !vimModeEnabled) return

        // Check if enabled
        if (!shortcut.enabled) return

        result.push(shortcut)
      })

      // Sort by scope priority for consistent ordering
      return result.sort((a, b) => {
        const aPriority = Math.max(...a.scopes.map((s) => SCOPE_PRIORITY[s]))
        const bPriority = Math.max(...b.scopes.map((s) => SCOPE_PRIORITY[s]))
        return bPriority - aPriority
      })
    },
    [shortcuts, vimModeEnabled]
  )

  /**
   * Get shortcuts by category
   */
  const getShortcutsByCategory = useCallback(
    (category: ShortcutCategory): RegisteredShortcut[] => {
      const result: RegisteredShortcut[] = []

      shortcuts.forEach((shortcut) => {
        if (shortcut.category !== category) return
        if (shortcut.requiresVimMode && !vimModeEnabled) return
        if (!shortcut.enabled) return
        result.push(shortcut)
      })

      return result
    },
    [shortcuts, vimModeEnabled]
  )

  /**
   * Get all shortcuts for help display
   */
  const getAllShortcuts = useCallback((): RegisteredShortcut[] => {
    const result: RegisteredShortcut[] = []

    shortcuts.forEach((shortcut) => {
      // Include all shortcuts, but filter vim shortcuts if not enabled
      if (shortcut.requiresVimMode && !vimModeEnabled) return
      result.push(shortcut)
    })

    // Sort by category then by keys
    return result.sort((a, b) => {
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category)
      }
      return a.keys.localeCompare(b.keys)
    })
  }, [shortcuts, vimModeEnabled])

  /**
   * Context value (memoized to prevent unnecessary re-renders)
   */
  const contextValue = useMemo<ShortcutContextValue>(
    () => ({
      activeScope,
      shortcuts,
      vimModeEnabled,
      enabled,
      setActiveScope,
      registerShortcut,
      unregisterShortcut,
      setVimMode,
      setEnabled,
      getShortcutsForScope,
      getShortcutsByCategory,
      getAllShortcuts,
    }),
    [
      activeScope,
      shortcuts,
      vimModeEnabled,
      enabled,
      setActiveScope,
      registerShortcut,
      unregisterShortcut,
      setVimMode,
      setEnabled,
      getShortcutsForScope,
      getShortcutsByCategory,
      getAllShortcuts,
    ]
  )

  return <ShortcutContext.Provider value={contextValue}>{children}</ShortcutContext.Provider>
}

/**
 * Hook to access shortcut context
 *
 * Task 1.5: Create useShortcuts for accessing context
 *
 * Usage:
 * ```tsx
 * function MyComponent() {
 *   const { activeScope, setActiveScope, vimModeEnabled } = useShortcuts()
 *   // ...
 * }
 * ```
 */
export function useShortcuts(): ShortcutContextValue {
  const context = useContext(ShortcutContext)
  if (!context) {
    throw new Error('useShortcuts must be used within a ShortcutProvider')
  }
  return context
}

/**
 * Hook to get the active scope
 */
export function useActiveScope(): ShortcutScope {
  const { activeScope } = useShortcuts()
  return activeScope
}

/**
 * Hook to check if we're in a specific scope
 */
export function useIsInScope(scope: ShortcutScope): boolean {
  const { activeScope } = useShortcuts()
  return activeScope === scope
}

/**
 * Hook to check if Vim mode is enabled
 */
export function useVimMode(): [boolean, (enabled: boolean) => void] {
  const { vimModeEnabled, setVimMode } = useShortcuts()
  return [vimModeEnabled, setVimMode]
}
