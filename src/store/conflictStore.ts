/**
 * Conflict Store
 * Manages sync conflict state using Zustand
 *
 * Features:
 * - Track pending conflicts requiring user resolution
 * - Store conflict resolution preferences
 * - Provide conflict statistics
 *
 * AC9: Conflict resolution decisions saved for similar future conflicts
 */

import { create } from 'zustand'
import type {
  ConflictEmailData,
  PendingConflict,
  ConflictType,
} from '../services/sync/conflictDetection'
import type { ResolutionResult } from '../services/sync/resolutionStrategies'
import {
  resolveKeepLocal,
  resolveKeepServer,
  resolveMerged,
} from '../services/sync/resolutionStrategies'

/**
 * User preference for conflict resolution
 */
export type ConflictPreference = 'always-local' | 'always-server' | 'always-ask'

/**
 * Preferences per conflict type
 */
export interface ConflictPreferences {
  metadata: ConflictPreference
  labels: ConflictPreference
  content: ConflictPreference
}

/**
 * Resolution action for a conflict
 */
export type Resolution = 'local' | 'server' | 'merged'

/**
 * localStorage keys for persistence
 */
const PREFERENCES_KEY = 'claine_conflict_preferences'

/**
 * Default preferences - always ask for all conflict types
 */
const DEFAULT_PREFERENCES: ConflictPreferences = {
  metadata: 'always-ask',
  labels: 'always-ask',
  content: 'always-ask',
}

/**
 * Conflict store state and actions
 */
interface ConflictState {
  // State
  pendingConflicts: PendingConflict[]
  preferences: ConflictPreferences
  loading: boolean

  // Actions
  addPendingConflict: (conflict: PendingConflict) => void
  removePendingConflict: (id: string) => void
  resolveConflict: (
    id: string,
    resolution: Resolution,
    mergedData?: ConflictEmailData
  ) => ResolutionResult | null
  clearPendingConflicts: () => void

  // Preference actions
  setPreference: (type: ConflictType, preference: ConflictPreference) => void
  loadPreferences: () => void
  savePreferences: () => void

  // Getters
  getPendingCount: () => number
  getPendingConflict: (id: string) => PendingConflict | undefined
  getConflictsForAccount: (accountId: string) => PendingConflict[]
  shouldAutoResolve: (type: ConflictType) => boolean
  getAutoResolutionStrategy: (type: ConflictType) => 'local' | 'server' | null
}

/**
 * Load preferences from localStorage
 */
function loadPersistedPreferences(): ConflictPreferences {
  try {
    const stored = localStorage.getItem(PREFERENCES_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      return {
        ...DEFAULT_PREFERENCES,
        ...parsed,
      }
    }
  } catch {
    // Ignore parse errors, use defaults
  }
  return DEFAULT_PREFERENCES
}

/**
 * Save preferences to localStorage
 */
function persistPreferences(preferences: ConflictPreferences): void {
  try {
    localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences))
  } catch {
    // Ignore storage errors
  }
}

/**
 * Conflict store using Zustand
 * Follows pattern from accountStore.ts
 */
export const useConflictStore = create<ConflictState>((set, get) => ({
  pendingConflicts: [],
  preferences: loadPersistedPreferences(),
  loading: false,

  /**
   * Add a pending conflict that requires user resolution
   */
  addPendingConflict: (conflict: PendingConflict) => {
    const { pendingConflicts } = get()

    // Don't add duplicates
    if (pendingConflicts.some((c) => c.id === conflict.id)) {
      return
    }

    set({ pendingConflicts: [...pendingConflicts, conflict] })
  },

  /**
   * Remove a pending conflict (after resolution)
   */
  removePendingConflict: (id: string) => {
    const { pendingConflicts } = get()
    set({ pendingConflicts: pendingConflicts.filter((c) => c.id !== id) })
  },

  /**
   * Resolve a conflict and return the resolution result
   */
  resolveConflict: (
    id: string,
    resolution: Resolution,
    mergedData?: ConflictEmailData
  ): ResolutionResult | null => {
    const { pendingConflicts } = get()
    const conflict = pendingConflicts.find((c) => c.id === id)

    if (!conflict) {
      return null
    }

    let result: ResolutionResult

    switch (resolution) {
      case 'local':
        result = resolveKeepLocal(conflict.localVersion)
        break
      case 'server':
        result = resolveKeepServer(conflict.serverVersion)
        break
      case 'merged':
        if (!mergedData) {
          return null
        }
        result = resolveMerged(mergedData)
        break
      default:
        return null
    }

    // Remove from pending
    get().removePendingConflict(id)

    return result
  },

  /**
   * Clear all pending conflicts
   */
  clearPendingConflicts: () => {
    set({ pendingConflicts: [] })
  },

  /**
   * Set preference for a conflict type
   */
  setPreference: (type: ConflictType, preference: ConflictPreference) => {
    const { preferences } = get()
    const newPreferences = {
      ...preferences,
      [type]: preference,
    }
    set({ preferences: newPreferences })
    persistPreferences(newPreferences)
  },

  /**
   * Load preferences from localStorage
   */
  loadPreferences: () => {
    set({ preferences: loadPersistedPreferences() })
  },

  /**
   * Save current preferences to localStorage
   */
  savePreferences: () => {
    const { preferences } = get()
    persistPreferences(preferences)
  },

  /**
   * Get count of pending conflicts
   */
  getPendingCount: () => {
    return get().pendingConflicts.length
  },

  /**
   * Get a specific pending conflict by ID
   */
  getPendingConflict: (id: string) => {
    return get().pendingConflicts.find((c) => c.id === id)
  },

  /**
   * Get all pending conflicts for an account
   */
  getConflictsForAccount: (accountId: string) => {
    return get().pendingConflicts.filter((c) => c.accountId === accountId)
  },

  /**
   * Check if a conflict type should be auto-resolved based on preferences
   * Note: 'content' conflicts are never auto-resolved regardless of preference
   */
  shouldAutoResolve: (type: ConflictType) => {
    // Content conflicts always require manual resolution
    if (type === 'content') {
      return false
    }

    const { preferences } = get()
    const preference = preferences[type]
    return preference !== 'always-ask'
  },

  /**
   * Get the auto-resolution strategy for a conflict type
   * Returns null if should ask user
   */
  getAutoResolutionStrategy: (type: ConflictType): 'local' | 'server' | null => {
    // Content conflicts never auto-resolve
    if (type === 'content') {
      return null
    }

    const { preferences } = get()
    const preference = preferences[type]

    switch (preference) {
      case 'always-local':
        return 'local'
      case 'always-server':
        return 'server'
      case 'always-ask':
      default:
        return null
    }
  },
}))

/**
 * Expose conflict store for E2E testing in development mode
 */
if (import.meta.env.DEV) {
  ;(
    window as unknown as { __TEST_CONFLICT_STORE__: typeof useConflictStore }
  ).__TEST_CONFLICT_STORE__ = useConflictStore
}
