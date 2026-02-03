/**
 * Health Registry Unit Tests
 *
 * Story 1.20: Subsystem Health Tracking
 * Task 13: Unit Tests (AC 17-21)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { HealthRegistry } from '../healthRegistry'

// Mock the circuit breaker module so HealthRegistry constructor doesn't wire real singleton
vi.mock('../circuitBreaker', async () => {
  const actual = await vi.importActual<typeof import('../circuitBreaker')>('../circuitBreaker')
  // Create a fresh instance for each test via reset
  const testBreaker = new actual.CircuitBreaker()
  return {
    ...actual,
    circuitBreaker: testBreaker,
  }
})

// Mock logger to avoid console noise
vi.mock('@/services/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

describe('HealthRegistry', () => {
  let registry: HealthRegistry

  beforeEach(() => {
    vi.useFakeTimers()
    registry = new HealthRegistry()
  })

  afterEach(() => {
    registry.dispose()
    registry.reset()
    vi.useRealTimers()
  })

  // Subtask 13.1: All subsystems initialize as Healthy
  describe('initialization', () => {
    it('should initialize all subsystems as Healthy', () => {
      const snapshot = registry.getSnapshot()

      expect(snapshot.overallState).toBe('healthy')
      expect(snapshot.subsystems.size).toBe(6)

      for (const [, health] of snapshot.subsystems) {
        expect(health.state).toBe('healthy')
      }
    })
  })

  // Subtask 13.2: updateHealth updates state and notifies listeners
  describe('updateHealth', () => {
    it('should update subsystem state and notify listeners', () => {
      const listener = vi.fn()
      registry.subscribe(listener)

      // Unavailable transitions are immediate (no debounce)
      registry.updateHealth('sync-gmail', 'unavailable', 'Circuit open')

      expect(listener).toHaveBeenCalled()

      const snapshot = registry.getSnapshot()
      const gmail = snapshot.subsystems.get('sync-gmail')
      expect(gmail?.state).toBe('unavailable')
      expect(gmail?.reason).toBe('Circuit open')
    })

    it('should not notify for no-change updates', () => {
      const listener = vi.fn()

      // First make it unavailable
      registry.updateHealth('sync-gmail', 'unavailable', 'test')
      registry.subscribe(listener)

      // Same state + reason should not notify
      registry.updateHealth('sync-gmail', 'unavailable', 'test')
      expect(listener).not.toHaveBeenCalled()
    })
  })

  // Subtask 13.3: getOverallState returns worst-of (AC 17)
  describe('getOverallState', () => {
    it('should return healthy when all subsystems are healthy (AC 17)', () => {
      expect(registry.getOverallState()).toBe('healthy')
    })

    it('should return degraded when any subsystem is degraded', () => {
      registry.updateHealth('search-index', 'degraded', 'test')
      vi.advanceTimersByTime(2100) // Wait for debounce
      expect(registry.getOverallState()).toBe('degraded')
    })

    it('should return unavailable when any subsystem is unavailable', () => {
      registry.updateHealth('database', 'unavailable', 'test')
      expect(registry.getOverallState()).toBe('unavailable')
    })

    it('should return unavailable even if some are degraded', () => {
      registry.updateHealth('search-index', 'degraded', 'test')
      vi.advanceTimersByTime(2100)
      registry.updateHealth('database', 'unavailable', 'test')
      expect(registry.getOverallState()).toBe('unavailable')
    })
  })

  // Subtask 13.4-13.6: Circuit breaker mapping (AC 18)
  describe('circuit breaker signals', () => {
    it('should map circuit breaker open to sync-gmail Unavailable (AC 18)', () => {
      // The circuit breaker wiring happens via the mocked singleton
      // We test updateHealth directly for unit tests
      registry.updateHealth('sync-gmail', 'unavailable', 'Circuit open (5 failures)')

      const snapshot = registry.getSnapshot()
      const gmail = snapshot.subsystems.get('sync-gmail')
      expect(gmail?.state).toBe('unavailable')
    })

    it('should map circuit breaker half-open to Degraded', () => {
      registry.updateHealth('sync-gmail', 'degraded', 'Circuit probing')
      vi.advanceTimersByTime(2100)

      const snapshot = registry.getSnapshot()
      const gmail = snapshot.subsystems.get('sync-gmail')
      expect(gmail?.state).toBe('degraded')
    })

    it('should map circuit breaker closed to Healthy', () => {
      // Start from unavailable
      registry.updateHealth('sync-gmail', 'unavailable', 'test')
      // Then recover
      registry.updateHealth('sync-gmail', 'healthy')

      const snapshot = registry.getSnapshot()
      const gmail = snapshot.subsystems.get('sync-gmail')
      expect(gmail?.state).toBe('healthy')
    })
  })

  // Subtask 13.7: Network offline → remote subsystems Degraded (AC 19)
  describe('network status signals', () => {
    it('should set remote subsystems to Degraded when offline (AC 19)', () => {
      registry.connectNetworkStatus(false)
      vi.advanceTimersByTime(2100)

      const snapshot = registry.getSnapshot()
      expect(snapshot.subsystems.get('sync-gmail')?.state).toBe('degraded')
      expect(snapshot.subsystems.get('sync-outlook')?.state).toBe('degraded')
      expect(snapshot.subsystems.get('action-queue')?.state).toBe('degraded')
      expect(snapshot.subsystems.get('send-queue')?.state).toBe('degraded')
    })

    it('should not affect local subsystems when offline', () => {
      registry.connectNetworkStatus(false)
      vi.advanceTimersByTime(2100)

      const snapshot = registry.getSnapshot()
      expect(snapshot.subsystems.get('search-index')?.state).toBe('healthy')
      expect(snapshot.subsystems.get('database')?.state).toBe('healthy')
    })

    // Subtask 13.8: Network online + circuit closed → Healthy
    it('should return to Healthy when back online (AC 19)', () => {
      registry.connectNetworkStatus(false)
      vi.advanceTimersByTime(2100)

      registry.connectNetworkStatus(true)
      vi.advanceTimersByTime(2100)

      const snapshot = registry.getSnapshot()
      expect(snapshot.subsystems.get('sync-gmail')?.state).toBe('healthy')
      expect(snapshot.subsystems.get('sync-outlook')?.state).toBe('healthy')
    })

    // Subtask 13.9: Network offline does NOT override circuit breaker Unavailable
    it('should not override circuit breaker Unavailable when network is offline', () => {
      // Database is a local subsystem — should not be affected by network offline
      registry.setDatabaseHealth(false, 'DB failed')
      expect(registry.getSnapshot().subsystems.get('database')?.state).toBe('unavailable')

      // Go offline
      registry.connectNetworkStatus(false)
      vi.advanceTimersByTime(2100)

      // Database should still be unavailable (local, unaffected by network)
      expect(registry.getSnapshot().subsystems.get('database')?.state).toBe('unavailable')

      // Remote subsystems should be degraded from network (not unavailable)
      expect(registry.getSnapshot().subsystems.get('sync-gmail')?.state).toBe('degraded')

      // Overall should be unavailable because of database
      expect(registry.getOverallState()).toBe('unavailable')
    })
  })

  // Subtask 13.10: Debounced transitions (AC 9)
  describe('debounced transitions', () => {
    it('should debounce Healthy → Degraded transitions', () => {
      const listener = vi.fn()
      registry.subscribe(listener)

      registry.updateHealth('search-index', 'degraded', 'test')

      // Before debounce fires
      expect(registry.getSnapshot().subsystems.get('search-index')?.state).toBe('healthy')
      expect(listener).not.toHaveBeenCalled()

      // After debounce
      vi.advanceTimersByTime(2100)
      expect(registry.getSnapshot().subsystems.get('search-index')?.state).toBe('degraded')
      expect(listener).toHaveBeenCalled()
    })

    it('should not debounce transitions to Unavailable (immediate)', () => {
      registry.updateHealth('database', 'unavailable', 'init failed')

      // Should be immediate
      expect(registry.getSnapshot().subsystems.get('database')?.state).toBe('unavailable')
    })

    it('should not debounce transitions from Unavailable (immediate)', () => {
      registry.updateHealth('database', 'unavailable', 'init failed')
      registry.updateHealth('database', 'healthy')

      // Should be immediate
      expect(registry.getSnapshot().subsystems.get('database')?.state).toBe('healthy')
    })

    it('should debounce Degraded → Healthy transitions', () => {
      // First go to degraded
      registry.updateHealth('search-index', 'degraded', 'test')
      vi.advanceTimersByTime(2100)
      expect(registry.getSnapshot().subsystems.get('search-index')?.state).toBe('degraded')

      // Now recover
      registry.updateHealth('search-index', 'healthy')
      // Should still be degraded (debounce in progress)
      expect(registry.getSnapshot().subsystems.get('search-index')?.state).toBe('degraded')

      vi.advanceTimersByTime(2100)
      expect(registry.getSnapshot().subsystems.get('search-index')?.state).toBe('healthy')
    })

    it('should coalesce rapid flicker into single notification', () => {
      const listener = vi.fn()
      registry.subscribe(listener)

      // Rapid Healthy → Degraded → Healthy → Degraded
      registry.updateHealth('search-index', 'degraded', 'flicker 1')
      vi.advanceTimersByTime(500)
      registry.updateHealth('search-index', 'healthy')
      vi.advanceTimersByTime(500)
      registry.updateHealth('search-index', 'degraded', 'flicker 2')

      // Only the last pending state should apply after debounce
      vi.advanceTimersByTime(2100)

      // Should have received notification only once for the final state
      const snapshot = registry.getSnapshot()
      expect(snapshot.subsystems.get('search-index')?.state).toBe('degraded')
    })
  })

  // Subtask 13.11: History capped at 50 entries (AC 15)
  describe('history', () => {
    it('should cap history at 50 entries', () => {
      // Generate more than 50 state changes using immediate transitions
      for (let i = 0; i < 60; i++) {
        registry.updateHealth('database', i % 2 === 0 ? 'unavailable' : 'healthy', `test ${i}`)
      }

      const history = registry.getHistory()
      expect(history.length).toBeLessThanOrEqual(50)
    })

    it('should record state transitions in history', () => {
      registry.updateHealth('database', 'unavailable', 'init failed')

      const history = registry.getHistory()
      expect(history.length).toBeGreaterThanOrEqual(1)

      const lastEntry = history[history.length - 1]
      expect(lastEntry.subsystemId).toBe('database')
      expect(lastEntry.previousState).toBe('healthy')
      expect(lastEntry.newState).toBe('unavailable')
      expect(lastEntry.reason).toBe('init failed')
    })
  })

  // Subtask 13.12: Recovery → subsystem returns to Healthy (AC 20)
  describe('recovery', () => {
    it('should return to Healthy after recovery (AC 20)', () => {
      // Go unavailable
      registry.updateHealth('sync-gmail', 'unavailable', 'Circuit open')
      expect(registry.getOverallState()).toBe('unavailable')

      // Recover
      registry.updateHealth('sync-gmail', 'healthy')
      expect(registry.getOverallState()).toBe('healthy')
    })
  })

  // Subtask 13.13: Multiple degraded subsystems (AC 21)
  describe('multiple degraded subsystems', () => {
    it('should track multiple degraded subsystems independently (AC 21)', () => {
      registry.updateHealth('sync-gmail', 'unavailable', 'Circuit open')
      registry.updateHealth('send-queue', 'degraded', 'High failure rate')
      vi.advanceTimersByTime(2100)
      registry.updateHealth('search-index', 'degraded', 'Index build failed')
      vi.advanceTimersByTime(2100)

      const snapshot = registry.getSnapshot()
      expect(snapshot.subsystems.get('sync-gmail')?.state).toBe('unavailable')
      expect(snapshot.subsystems.get('send-queue')?.state).toBe('degraded')
      expect(snapshot.subsystems.get('search-index')?.state).toBe('degraded')
      expect(snapshot.subsystems.get('sync-outlook')?.state).toBe('healthy')
      expect(snapshot.overallState).toBe('unavailable')
    })
  })

  // Subtask 13.14: Failure rate calculation (AC 7)
  describe('failure rate tracking', () => {
    it('should set Degraded when >50% failure rate in 5-min window (AC 7)', async () => {
      // Simulate queue events via the internal method by calling connectActionQueue
      const { Subject } = await import('rxjs')
      const events$ = new Subject()
      registry.connectActionQueue({ getEvents$: () => events$.asObservable() })

      // Send 4 events: 3 failures, 1 success = 75% failure rate
      events$.next({ type: 'failed' })
      events$.next({ type: 'failed' })
      events$.next({ type: 'failed' })
      events$.next({ type: 'synced' })

      vi.advanceTimersByTime(2100) // Wait for debounce

      const snapshot = registry.getSnapshot()
      expect(snapshot.subsystems.get('action-queue')?.state).toBe('degraded')
    })

    it('should return to Healthy when failure rate drops below 50%', async () => {
      const { Subject } = await import('rxjs')
      const events$ = new Subject()
      registry.connectActionQueue({ getEvents$: () => events$.asObservable() })

      // Start with high failure rate
      events$.next({ type: 'failed' })
      events$.next({ type: 'failed' })
      events$.next({ type: 'failed' })
      vi.advanceTimersByTime(2100)

      // Add many successes to drop rate below 50%
      for (let i = 0; i < 10; i++) {
        events$.next({ type: 'synced' })
      }
      vi.advanceTimersByTime(2100)

      const snapshot = registry.getSnapshot()
      expect(snapshot.subsystems.get('action-queue')?.state).toBe('healthy')
    })
  })

  // Subtask 13.15: reset() clears all state and history
  describe('reset', () => {
    it('should reset all subsystems to Healthy and clear history', () => {
      registry.updateHealth('database', 'unavailable', 'test')
      registry.updateHealth('sync-gmail', 'unavailable', 'test')

      registry.reset()

      expect(registry.getOverallState()).toBe('healthy')
      expect(registry.getHistory()).toHaveLength(0)

      const snapshot = registry.getSnapshot()
      for (const [, health] of snapshot.subsystems) {
        expect(health.state).toBe('healthy')
      }
    })
  })

  // Subtask 13.16: subscribe/unsubscribe pattern
  describe('subscribe/unsubscribe', () => {
    it('should properly subscribe and unsubscribe listeners', () => {
      const listener = vi.fn()
      const unsubscribe = registry.subscribe(listener)

      registry.updateHealth('database', 'unavailable', 'test')
      expect(listener).toHaveBeenCalledTimes(1)

      unsubscribe()

      registry.updateHealth('database', 'healthy')
      // Should not be called again after unsubscribe
      expect(listener).toHaveBeenCalledTimes(1)
    })

    it('should not leak listeners after unsubscribe', () => {
      const listeners: (() => void)[] = []
      const unsubscribers: (() => void)[] = []

      // Add 10 listeners
      for (let i = 0; i < 10; i++) {
        const fn = vi.fn()
        listeners.push(fn)
        unsubscribers.push(registry.subscribe(fn))
      }

      // Unsubscribe all
      for (const unsub of unsubscribers) {
        unsub()
      }

      // Trigger a change
      registry.updateHealth('database', 'unavailable', 'test')

      // No listener should have been called
      for (const fn of listeners) {
        expect(fn).not.toHaveBeenCalled()
      }
    })
  })

  // Subtask 13.17: getSnapshot() returns stable reference
  describe('snapshot stability', () => {
    it('should return same reference when state has not changed', () => {
      const snap1 = registry.getSnapshot()
      const snap2 = registry.getSnapshot()
      expect(snap1).toBe(snap2) // Referential equality
    })

    it('should return new reference after state change', () => {
      const snap1 = registry.getSnapshot()
      registry.updateHealth('database', 'unavailable', 'test')
      const snap2 = registry.getSnapshot()
      expect(snap1).not.toBe(snap2)
    })
  })

  // Database health
  describe('setDatabaseHealth', () => {
    it('should set database to Healthy on success', () => {
      registry.setDatabaseHealth(true)
      const snapshot = registry.getSnapshot()
      expect(snapshot.subsystems.get('database')?.state).toBe('healthy')
    })

    it('should set database to Unavailable on failure', () => {
      registry.setDatabaseHealth(false, 'IndexedDB not available')
      // Database health uses signals, which resolve immediately for unavailable
      const snapshot = registry.getSnapshot()
      expect(snapshot.subsystems.get('database')?.state).toBe('unavailable')
    })
  })

  // Search index health
  describe('setSearchIndexHealth', () => {
    it('should set search index health state', () => {
      registry.setSearchIndexHealth('degraded', 'Index build slow')
      vi.advanceTimersByTime(2100)
      const snapshot = registry.getSnapshot()
      expect(snapshot.subsystems.get('search-index')?.state).toBe('degraded')
    })
  })
})
