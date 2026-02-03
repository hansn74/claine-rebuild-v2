/**
 * Adaptive Sync Polling Interval Service
 *
 * Story 1.15: Adaptive Sync Polling Intervals
 * Tasks 1-2: Core logic + persistence
 *
 * Dynamically adjusts sync polling intervals per account based on activity:
 * - Active inbox (new messages) → 60s
 * - Default baseline → 180s
 * - Idle 3+ syncs → 300s
 * - Idle 10+ syncs → 600s
 * - User action (send/archive/label) → reset to 60s
 */

import { logger } from '@/services/logger'

const STORAGE_KEY = 'claine:adaptive-polling-state'
const ENABLED_KEY = 'claine:adaptive-polling-enabled'

// Interval tiers (ms)
const ACTIVE_INTERVAL = 60_000 // 1 minute — recent activity
const DEFAULT_INTERVAL = 180_000 // 3 minutes — baseline
const IDLE_3_INTERVAL = 300_000 // 5 minutes — idle 3+ syncs
const IDLE_10_INTERVAL = 600_000 // 10 minutes — idle 10+ syncs

// Thresholds
const IDLE_TIER_1_THRESHOLD = 3
const IDLE_TIER_2_THRESHOLD = 10

export interface AccountSyncActivity {
  consecutiveIdleSyncs: number
  lastSyncHadActivity: boolean
  lastUserActionAt: number
  currentInterval: number
}

export class AdaptiveIntervalService {
  private accountStates: Map<string, AccountSyncActivity> = new Map()
  private minInterval: number
  private maxInterval: number
  private enabledCache: boolean | null = null

  constructor() {
    const parsedMin = parseInt(
      import.meta.env.VITE_ADAPTIVE_MIN_INTERVAL_MS || String(ACTIVE_INTERVAL),
      10
    )
    const parsedMax = parseInt(
      import.meta.env.VITE_ADAPTIVE_MAX_INTERVAL_MS || String(IDLE_10_INTERVAL),
      10
    )
    // H3 fix: Guard against NaN from invalid env var values
    this.minInterval = Number.isFinite(parsedMin) ? parsedMin : ACTIVE_INTERVAL
    this.maxInterval = Number.isFinite(parsedMax) ? parsedMax : IDLE_10_INTERVAL
    this.load()
  }

  /**
   * Get the adaptive interval for an account (AC 1-4)
   */
  getInterval(accountId: string): number {
    if (!this.isEnabled()) {
      return DEFAULT_INTERVAL
    }

    const state = this.accountStates.get(accountId)
    if (!state) {
      return this.clamp(DEFAULT_INTERVAL)
    }

    let interval: number

    if (state.lastSyncHadActivity) {
      interval = ACTIVE_INTERVAL // AC 2
    } else if (state.consecutiveIdleSyncs >= IDLE_TIER_2_THRESHOLD) {
      interval = IDLE_10_INTERVAL // AC 4
    } else if (state.consecutiveIdleSyncs >= IDLE_TIER_1_THRESHOLD) {
      interval = IDLE_3_INTERVAL // AC 3
    } else {
      interval = DEFAULT_INTERVAL // AC 1
    }

    return this.clamp(interval)
  }

  /**
   * Record the result of a sync (AC 2-4)
   * Called after each sync completes with whether new messages were found
   */
  recordSyncResult(accountId: string, hadNewMessages: boolean): void {
    const state = this.getOrCreateState(accountId)

    if (hadNewMessages) {
      state.consecutiveIdleSyncs = 0
      state.lastSyncHadActivity = true
    } else {
      state.consecutiveIdleSyncs++
      state.lastSyncHadActivity = false
    }

    state.currentInterval = this.getInterval(accountId)
    this.save()

    logger.debug('adaptive-interval', 'Recorded sync result', {
      accountId,
      hadNewMessages,
      consecutiveIdleSyncs: state.consecutiveIdleSyncs,
      nextInterval: state.currentInterval,
    })
  }

  /**
   * Record a user action (send, archive, label) — resets interval to active (AC 5)
   */
  recordUserAction(accountId: string): void {
    const state = this.getOrCreateState(accountId)
    state.lastUserActionAt = Date.now()
    state.consecutiveIdleSyncs = 0
    state.lastSyncHadActivity = true
    state.currentInterval = this.getInterval(accountId)
    this.save()

    logger.debug('adaptive-interval', 'User action reset', {
      accountId,
      nextInterval: state.currentInterval,
    })
  }

  /**
   * Check if adaptive polling is enabled (AC 9)
   * M2 fix: Cached to avoid hitting localStorage on every getInterval() call
   */
  isEnabled(): boolean {
    if (this.enabledCache !== null) {
      return this.enabledCache
    }
    try {
      const stored = localStorage.getItem(ENABLED_KEY)
      this.enabledCache = stored !== 'false' // Default to true
      return this.enabledCache
    } catch {
      this.enabledCache = true
      return true
    }
  }

  /**
   * Enable or disable adaptive polling (AC 9)
   */
  setEnabled(enabled: boolean): void {
    this.enabledCache = enabled
    try {
      localStorage.setItem(ENABLED_KEY, String(enabled))
    } catch {
      // localStorage unavailable — setting is ephemeral
    }
  }

  /**
   * Get current state for an account (for testing/debugging)
   * M1 fix: Returns a copy to prevent external mutation bypassing persistence
   */
  getState(accountId: string): AccountSyncActivity | undefined {
    const state = this.accountStates.get(accountId)
    return state ? { ...state } : undefined
  }

  /**
   * Reset state for a specific account or all accounts
   */
  reset(accountId?: string): void {
    if (accountId) {
      this.accountStates.delete(accountId)
    } else {
      this.accountStates.clear()
      this.enabledCache = null
    }
    this.save()
  }

  /**
   * Persist state to localStorage (AC 7)
   */
  private save(): void {
    try {
      const data: Record<string, AccountSyncActivity> = {}
      for (const [key, value] of this.accountStates) {
        data[key] = value
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch {
      // localStorage unavailable or full — continue with in-memory only
    }
  }

  /**
   * Restore state from localStorage (AC 7)
   */
  private load(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return

      const data = JSON.parse(stored) as Record<string, AccountSyncActivity>
      for (const [key, value] of Object.entries(data)) {
        if (
          typeof value.consecutiveIdleSyncs === 'number' &&
          typeof value.lastSyncHadActivity === 'boolean'
        ) {
          this.accountStates.set(key, value)
        }
      }
    } catch {
      // localStorage unavailable or corrupted — start fresh
    }
  }

  private getOrCreateState(accountId: string): AccountSyncActivity {
    let state = this.accountStates.get(accountId)
    if (!state) {
      state = {
        consecutiveIdleSyncs: 0,
        lastSyncHadActivity: false,
        lastUserActionAt: 0,
        currentInterval: DEFAULT_INTERVAL,
      }
      this.accountStates.set(accountId, state)
    }
    return state
  }

  private clamp(interval: number): number {
    return Math.max(this.minInterval, Math.min(this.maxInterval, interval))
  }
}

export const adaptiveInterval = new AdaptiveIntervalService()
