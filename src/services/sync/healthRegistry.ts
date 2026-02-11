/**
 * Health Registry Service
 *
 * Story 1.20: Subsystem Health Tracking
 * Task 2: Health Registry Service (AC 1-5, 9, 15-16)
 * Task 3: Circuit Breaker Signals (AC 6)
 * Task 4: Sync Progress Signals (AC 7 partial)
 * Task 5: Network Status Signals (AC 8)
 * Task 6: Action/Send Queue Signals (AC 7)
 * Task 7: Database Health Signal (AC 1, 5)
 * Task 8: Search Index Health Signal (AC 1)
 *
 * Follows the circuitBreaker.ts singleton pattern:
 * - Plain class (NOT Zustand)
 * - Set<() => void> listener pattern
 * - subscribe(listener): () => void
 * - Snapshot caching for useSyncExternalStore referential stability
 */

import { logger } from '@/services/logger'
import { circuitBreaker } from './circuitBreaker'
import type { ProviderId } from './circuitBreakerTypes'
import type {
  HealthState,
  SubsystemId,
  SubsystemHealth,
  HealthStateChange,
  HealthSnapshot,
} from './healthTypes'
import type { Observable, Subscription } from 'rxjs'

/** All subsystem IDs for initialization */
const ALL_SUBSYSTEMS: SubsystemId[] = [
  'sync-gmail',
  'sync-outlook',
  'action-queue',
  'send-queue',
  'search-index',
  'database',
  'ai',
]

/** Remote subsystems affected by network status (AC 8) */
const REMOTE_SUBSYSTEMS: SubsystemId[] = [
  'sync-gmail',
  'sync-outlook',
  'action-queue',
  'send-queue',
]

/** Debounce window in ms for Healthy ↔ Degraded transitions (AC 9) */
const DEBOUNCE_MS = 2000

/** Maximum history entries (AC 15) */
const MAX_HISTORY = 50

/** Sync progress polling interval in ms */
const SYNC_PROGRESS_POLL_MS = 30_000

/** Minimum events needed before calculating failure rate */
const MIN_FAILURE_EVENTS = 3

/** Failure rate threshold for degraded state (AC 7) */
const FAILURE_RATE_THRESHOLD = 0.5

/** Failure rate sliding window in ms (5 minutes) */
const FAILURE_WINDOW_MS = 5 * 60 * 1000

/**
 * Signal source for multi-signal subsystem state resolution.
 * When multiple signals affect the same subsystem, worst-of logic applies.
 */
interface SignalEntry {
  source: string
  state: HealthState
  reason?: string
  lastError?: string
  nextRetryAt?: number
}

/**
 * Health Registry
 *
 * Central registry tracking the health of each subsystem.
 * Aggregates signals from circuit breaker, network status, failure rates,
 * and manual health setters into per-subsystem health states.
 */
export class HealthRegistry {
  private subsystems = new Map<SubsystemId, SubsystemHealth>()
  private history: HealthStateChange[] = []
  private listeners = new Set<() => void>()
  private snapshotCache: HealthSnapshot | null = null
  private historyCache: HealthStateChange[] | null = null

  /** Debounce timers for Healthy ↔ Degraded transitions (AC 9) */
  private debounceTimers = new Map<SubsystemId, ReturnType<typeof setTimeout>>()

  /** Signal sources per subsystem for worst-of resolution */
  private signals = new Map<SubsystemId, Map<string, SignalEntry>>()

  /** Failure rate tracking for action/send queues (AC 7) */
  private failureWindows = new Map<SubsystemId, { timestamp: number; failed: boolean }[]>()

  /** Circuit breaker unsubscribe function */
  private circuitBreakerUnsubscribe: (() => void) | null = null

  /** Sync progress polling interval */
  private syncProgressInterval: ReturnType<typeof setInterval> | null = null

  /** RxJS subscriptions for queue events */
  private queueSubscriptions: Subscription[] = []

  /** Network offline tracking */
  private networkOffline = false

  constructor() {
    // Initialize all subsystems as Healthy (Subtask 2.9)
    for (const id of ALL_SUBSYSTEMS) {
      this.subsystems.set(id, {
        id,
        state: 'healthy',
        lastStateChange: Date.now(),
      })
      this.signals.set(id, new Map())
    }

    // Wire circuit breaker signals (Task 3)
    this.wireCircuitBreaker()
  }

  // --- Public API ---

  /**
   * Subscribe to health state changes (Subtask 2.1)
   * Returns unsubscribe function.
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * Get current health snapshot (Subtask 2.5)
   * Returns cached reference for useSyncExternalStore referential stability.
   */
  getSnapshot(): HealthSnapshot {
    if (!this.snapshotCache) {
      this.snapshotCache = {
        subsystems: new Map(this.subsystems),
        overallState: this.getOverallState(),
        lastUpdated: Date.now(),
      }
    }
    return this.snapshotCache
  }

  /**
   * Get overall health state — worst-of across all subsystems (Subtask 2.6)
   */
  getOverallState(): HealthState {
    let worst: HealthState = 'healthy'
    for (const [, health] of this.subsystems) {
      if (health.state === 'unavailable') return 'unavailable'
      if (health.state === 'degraded') worst = 'degraded'
    }
    return worst
  }

  /**
   * Get health state change history (Subtask 2.7, AC 15)
   */
  getHistory(): HealthStateChange[] {
    if (!this.historyCache) {
      this.historyCache = [...this.history]
    }
    return this.historyCache
  }

  /**
   * Update a subsystem's health state (Subtask 2.3)
   * Applies debounce for Healthy ↔ Degraded transitions (AC 9).
   */
  updateHealth(
    subsystemId: SubsystemId,
    state: HealthState,
    reason?: string,
    lastError?: string,
    nextRetryAt?: number
  ): void {
    const current = this.subsystems.get(subsystemId)
    if (!current) return
    if (current.state === state && current.reason === reason) return // No effective change

    // Immediate transitions: anything → Unavailable, Unavailable → anything (AC 9)
    if (state === 'unavailable' || current.state === 'unavailable') {
      this.applyStateChange(subsystemId, state, reason, lastError, nextRetryAt)
      return
    }

    // Debounced: Healthy ↔ Degraded (2-second window) (AC 9)
    const existingTimer = this.debounceTimers.get(subsystemId)
    if (existingTimer !== undefined) {
      clearTimeout(existingTimer)
    }
    this.debounceTimers.set(
      subsystemId,
      setTimeout(() => {
        this.applyStateChange(subsystemId, state, reason, lastError, nextRetryAt)
        this.debounceTimers.delete(subsystemId)
      }, DEBOUNCE_MS)
    )
  }

  /**
   * Reset all subsystems to Healthy, clear history (Subtask 2.11)
   */
  reset(): void {
    // Clear debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer)
    }
    this.debounceTimers.clear()

    // Reset all subsystems
    for (const id of ALL_SUBSYSTEMS) {
      this.subsystems.set(id, {
        id,
        state: 'healthy',
        lastStateChange: Date.now(),
      })
      this.signals.set(id, new Map())
    }

    // Clear history and failure windows
    this.history = []
    this.failureWindows.clear()
    this.networkOffline = false

    // Invalidate caches and notify
    this.snapshotCache = null
    this.historyCache = null
    this.notify()
  }

  /**
   * Dispose all subscriptions and timers for cleanup (Task 3.4, 4.3, 6.6)
   */
  dispose(): void {
    // Unsubscribe from circuit breaker
    if (this.circuitBreakerUnsubscribe) {
      this.circuitBreakerUnsubscribe()
      this.circuitBreakerUnsubscribe = null
    }

    // Clear sync progress polling
    if (this.syncProgressInterval) {
      clearInterval(this.syncProgressInterval)
      this.syncProgressInterval = null
    }

    // Unsubscribe from queue observables
    for (const sub of this.queueSubscriptions) {
      sub.unsubscribe()
    }
    this.queueSubscriptions = []

    // Clear debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer)
    }
    this.debounceTimers.clear()
  }

  // --- Signal Connectors ---

  /**
   * Connect sync progress service for health monitoring (Task 4, AC 7 partial)
   * Polls sync progress on a 30-second interval.
   */
  connectSyncProgress(syncProgressService: {
    getAllProgress: () => Promise<Array<{ provider: string; status: string; errorCount?: number }>>
  }): void {
    // Clear any existing interval
    if (this.syncProgressInterval) {
      clearInterval(this.syncProgressInterval)
    }

    const checkProgress = async () => {
      try {
        const progressList = await syncProgressService.getAllProgress()
        for (const progress of progressList) {
          const subsystemId = this.mapProviderToSubsystem(progress.provider)
          if (!subsystemId) continue

          // Circuit breaker takes priority — only update from sync progress if CB shows Healthy
          const cbSignal = this.signals.get(subsystemId)?.get('circuit-breaker')
          if (cbSignal && cbSignal.state !== 'healthy') continue

          if (progress.status === 'error' && (progress.errorCount ?? 0) > 2) {
            this.setSignal(
              subsystemId,
              'sync-progress',
              'degraded',
              `Sync errors (${progress.errorCount})`
            )
          } else {
            this.clearSignal(subsystemId, 'sync-progress')
          }
        }
      } catch {
        // Silently ignore polling errors
      }
    }

    // Initial check
    checkProgress()
    this.syncProgressInterval = setInterval(checkProgress, SYNC_PROGRESS_POLL_MS)
  }

  /**
   * Connect network status signal (Task 5, AC 8)
   */
  connectNetworkStatus(isOnline: boolean): void {
    const wasOffline = this.networkOffline
    this.networkOffline = !isOnline

    if (!isOnline) {
      // Offline: set all remote subsystems to Degraded (AC 8)
      for (const id of REMOTE_SUBSYSTEMS) {
        this.setSignal(id, 'network', 'degraded', 'Network offline')
      }
    } else if (wasOffline) {
      // Back online: clear network degradation
      for (const id of REMOTE_SUBSYSTEMS) {
        this.clearSignal(id, 'network')
      }
    }
  }

  /**
   * Connect action queue events (Task 6.1-6.2, AC 7)
   */
  connectActionQueue(actionQueue: { getEvents$: () => Observable<{ type: string }> }): void {
    const sub = actionQueue.getEvents$().subscribe((event) => {
      const failed = event.type === 'failed'
      this.updateFailureRate('action-queue', failed)
    })
    this.queueSubscriptions.push(sub)
  }

  /**
   * Connect send queue events (Task 6.3-6.4, AC 7)
   */
  connectSendQueue(sendQueue: { getEvents$: () => Observable<{ type: string }> }): void {
    const sub = sendQueue.getEvents$().subscribe((event) => {
      const failed = event.type === 'failed'
      this.updateFailureRate('send-queue', failed)
    })
    this.queueSubscriptions.push(sub)
  }

  /**
   * Set database health (Task 7, AC 1, 5)
   * Simple setter — database health determined at init time.
   */
  setDatabaseHealth(healthy: boolean, error?: string): void {
    if (healthy) {
      this.setSignal('database', 'init', 'healthy')
    } else {
      this.setSignal(
        'database',
        'init',
        'unavailable',
        error || 'Database initialization failed',
        error
      )
    }
  }

  /**
   * Set search index health (Task 8, AC 1)
   */
  setSearchIndexHealth(state: HealthState, reason?: string): void {
    this.setSignal('search-index', 'init', state, reason)
  }

  /**
   * Set AI subsystem health (Story 3.1)
   */
  setAIHealth(state: HealthState, reason?: string): void {
    this.setSignal('ai', 'init', state, reason)
  }

  // --- Private Methods ---

  /**
   * Wire circuit breaker signals (Task 3, AC 6)
   */
  private wireCircuitBreaker(): void {
    const updateFromCircuitBreaker = () => {
      this.updateCircuitBreakerSignal('gmail', 'sync-gmail')
      this.updateCircuitBreakerSignal('outlook', 'sync-outlook')
    }

    this.circuitBreakerUnsubscribe = circuitBreaker.subscribe(updateFromCircuitBreaker)
    // Initial read
    updateFromCircuitBreaker()
  }

  /**
   * Map circuit breaker state to health state for a provider (AC 6)
   */
  private updateCircuitBreakerSignal(provider: ProviderId, subsystemId: SubsystemId): void {
    const status = circuitBreaker.getStatus(provider)

    let state: HealthState
    let reason: string
    let nextRetryAt: number | undefined

    switch (status.state) {
      case 'open':
        state = 'unavailable'
        reason = `Circuit open (${status.failureCount} failures)`
        nextRetryAt = Date.now() + status.cooldownRemainingMs
        break
      case 'half-open':
        state = 'degraded'
        reason = 'Circuit probing'
        break
      case 'closed':
      default:
        state = 'healthy'
        reason = ''
        break
    }

    if (state === 'healthy') {
      this.clearSignal(subsystemId, 'circuit-breaker')
    } else {
      this.setSignal(subsystemId, 'circuit-breaker', state, reason, undefined, nextRetryAt)
    }
  }

  /**
   * Set a signal source for a subsystem and resolve effective state
   */
  private setSignal(
    subsystemId: SubsystemId,
    source: string,
    state: HealthState,
    reason?: string,
    lastError?: string,
    nextRetryAt?: number
  ): void {
    const subsystemSignals = this.signals.get(subsystemId)
    if (!subsystemSignals) return

    subsystemSignals.set(source, { source, state, reason, lastError, nextRetryAt })
    this.resolveEffectiveState(subsystemId)
  }

  /**
   * Clear a signal source and resolve effective state
   */
  private clearSignal(subsystemId: SubsystemId, source: string): void {
    const subsystemSignals = this.signals.get(subsystemId)
    if (!subsystemSignals) return

    subsystemSignals.delete(source)
    this.resolveEffectiveState(subsystemId)
  }

  /**
   * Resolve effective state from all active signals using worst-of logic
   */
  private resolveEffectiveState(subsystemId: SubsystemId): void {
    const subsystemSignals = this.signals.get(subsystemId)
    if (!subsystemSignals || subsystemSignals.size === 0) {
      this.updateHealth(subsystemId, 'healthy')
      return
    }

    let worstState: HealthState = 'healthy'
    let worstReason: string | undefined
    let worstLastError: string | undefined
    let worstNextRetryAt: number | undefined

    for (const [, signal] of subsystemSignals) {
      if (
        signal.state === 'unavailable' ||
        (signal.state === 'degraded' && worstState === 'healthy')
      ) {
        worstState = signal.state
        worstReason = signal.reason
        worstLastError = signal.lastError
        worstNextRetryAt = signal.nextRetryAt
      }
      if (worstState === 'unavailable') break // Can't get worse
    }

    this.updateHealth(subsystemId, worstState, worstReason, worstLastError, worstNextRetryAt)
  }

  /**
   * Apply a state change immediately (bypasses debounce)
   */
  private applyStateChange(
    subsystemId: SubsystemId,
    state: HealthState,
    reason?: string,
    lastError?: string,
    nextRetryAt?: number
  ): void {
    const current = this.subsystems.get(subsystemId)
    if (!current) return

    const previousState = current.state
    if (previousState === state && current.reason === reason) return // No actual change

    // Update subsystem
    this.subsystems.set(subsystemId, {
      id: subsystemId,
      state,
      reason,
      lastError,
      nextRetryAt,
      lastStateChange: Date.now(),
    })

    // Record history (AC 15)
    if (previousState !== state) {
      this.history.push({
        subsystemId,
        previousState,
        newState: state,
        reason: reason || '',
        timestamp: Date.now(),
      })

      // Cap history at 50 entries
      if (this.history.length > MAX_HISTORY) {
        this.history = this.history.slice(-MAX_HISTORY)
      }

      // Log state transitions in dev mode (AC 16)
      if (import.meta.env.DEV) {
        logger.info('sync', `Health: [${subsystemId}] ${previousState} → ${state}`, {
          subsystemId,
          reason,
        })
      }
    }

    this.notify()
  }

  /**
   * Notify all listeners and invalidate snapshot cache
   */
  private notify(): void {
    this.snapshotCache = null
    this.historyCache = null
    this.listeners.forEach((l) => {
      try {
        l()
      } catch (error) {
        console.error('Error in health registry listener:', error)
      }
    })
  }

  /**
   * Update failure rate tracking for queue subsystems (AC 7)
   */
  private updateFailureRate(subsystemId: SubsystemId, failed: boolean): void {
    const window = this.failureWindows.get(subsystemId) ?? []
    const now = Date.now()
    const cutoff = now - FAILURE_WINDOW_MS

    // Add new entry, prune old entries
    window.push({ timestamp: now, failed })
    const recent = window.filter((e) => e.timestamp > cutoff)
    this.failureWindows.set(subsystemId, recent)

    // Need minimum events for meaningful rate
    if (recent.length < MIN_FAILURE_EVENTS) return

    const failCount = recent.filter((e) => e.failed).length
    const failRate = failCount / recent.length
    if (failRate >= 1.0) {
      // All recent operations failed → Unavailable (Subtask 6.2)
      this.setSignal(
        subsystemId,
        'failure-rate',
        'unavailable',
        `All operations failing (${failCount}/${recent.length})`
      )
    } else if (failRate > FAILURE_RATE_THRESHOLD) {
      this.setSignal(
        subsystemId,
        'failure-rate',
        'degraded',
        `High failure rate (${Math.round(failRate * 100)}%)`
      )
    } else {
      this.clearSignal(subsystemId, 'failure-rate')
    }
  }

  /**
   * Map provider string to subsystem ID
   */
  private mapProviderToSubsystem(provider: string): SubsystemId | null {
    if (provider === 'gmail') return 'sync-gmail'
    if (provider === 'outlook') return 'sync-outlook'
    return null
  }
}

/** Singleton instance (Subtask 2.10) */
export const healthRegistry = new HealthRegistry()
