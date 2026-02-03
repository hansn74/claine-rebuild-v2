/**
 * Health Registry Integration Tests
 *
 * Story 1.20: Subsystem Health Tracking
 * Task 14: Integration Tests (AC 18, 19, 20)
 *
 * Wires real CircuitBreaker instances to verify health state propagation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Subject } from 'rxjs'

// Mock logger before anything else
vi.mock('@/services/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// For integration tests, don't mock the circuit breaker — instead, use the
// HealthRegistry's direct API methods that don't depend on the singleton.
// The real integration is tested by using updateHealth, connectNetworkStatus, etc.

import { CircuitBreaker, DEFAULT_CIRCUIT_CONFIG } from '../circuitBreaker'
import { HealthRegistry } from '../healthRegistry'

describe('HealthRegistry Integration', () => {
  let registry: HealthRegistry
  let breaker: CircuitBreaker

  beforeEach(() => {
    vi.useFakeTimers()
    breaker = new CircuitBreaker({
      ...DEFAULT_CIRCUIT_CONFIG,
      consecutiveFailureThreshold: 5,
      failureThreshold: 3,
      failureWindowMs: 60_000,
      cooldownMs: 60_000,
    })
    registry = new HealthRegistry()
  })

  afterEach(() => {
    registry.dispose()
    registry.reset()
    breaker.resetAll()
    vi.useRealTimers()
  })

  // Subtask 14.1: Wire real CircuitBreaker → record failures → Unavailable (AC 18)
  describe('circuit breaker integration', () => {
    it('should show sync-gmail Unavailable when circuit opens after 5 failures (AC 18)', () => {
      // Manually subscribe to the test breaker and propagate to health registry
      breaker.subscribe(() => {
        const status = breaker.getStatus('gmail')
        const state =
          status.state === 'open'
            ? 'unavailable'
            : status.state === 'half-open'
              ? 'degraded'
              : 'healthy'
        registry.updateHealth(
          'sync-gmail',
          state,
          state !== 'healthy' ? `Circuit ${status.state}` : undefined
        )
      })

      // Record 5 consecutive failures to open the circuit
      for (let i = 0; i < 5; i++) {
        breaker.recordFailure('gmail')
      }

      // Circuit should be open
      expect(breaker.getState('gmail')).toBe('open')

      // Health registry should reflect this
      const snapshot = registry.getSnapshot()
      expect(snapshot.subsystems.get('sync-gmail')?.state).toBe('unavailable')
    })

    // Subtask 14.2: Circuit probe → success → Healthy (AC 20 recovery)
    it('should show sync-gmail Healthy after circuit recovers (AC 20)', () => {
      // Wire breaker to registry
      breaker.subscribe(() => {
        const status = breaker.getStatus('gmail')
        const state =
          status.state === 'open'
            ? 'unavailable'
            : status.state === 'half-open'
              ? 'degraded'
              : 'healthy'
        registry.updateHealth(
          'sync-gmail',
          state,
          state !== 'healthy' ? `Circuit ${status.state}` : undefined
        )
      })

      // Open circuit
      for (let i = 0; i < 5; i++) {
        breaker.recordFailure('gmail')
      }
      expect(registry.getSnapshot().subsystems.get('sync-gmail')?.state).toBe('unavailable')

      // Advance past cooldown to transition to half-open
      vi.advanceTimersByTime(61_000)
      expect(breaker.getState('gmail')).toBe('half-open')

      // Health should show degraded during probe
      // Note: half-open → degraded is debounced from unavailable (immediate since from unavailable)
      expect(registry.getSnapshot().subsystems.get('sync-gmail')?.state).toBe('degraded')

      // Probe success → closed
      breaker.recordSuccess('gmail')
      expect(breaker.getState('gmail')).toBe('closed')

      // Degraded → Healthy is debounced
      vi.advanceTimersByTime(2100)
      expect(registry.getSnapshot().subsystems.get('sync-gmail')?.state).toBe('healthy')
    })

    it('should isolate providers — outlook unaffected by gmail circuit', () => {
      // Wire breaker to registry for both providers
      breaker.subscribe(() => {
        for (const provider of ['gmail', 'outlook'] as const) {
          const status = breaker.getStatus(provider)
          const subsystem = provider === 'gmail' ? 'sync-gmail' : 'sync-outlook'
          const state =
            status.state === 'open'
              ? 'unavailable'
              : status.state === 'half-open'
                ? 'degraded'
                : 'healthy'
          registry.updateHealth(subsystem as 'sync-gmail' | 'sync-outlook', state)
        }
      })

      // Open gmail circuit
      for (let i = 0; i < 5; i++) {
        breaker.recordFailure('gmail')
      }

      const snapshot = registry.getSnapshot()
      expect(snapshot.subsystems.get('sync-gmail')?.state).toBe('unavailable')
      expect(snapshot.subsystems.get('sync-outlook')?.state).toBe('healthy')
    })
  })

  // Subtask 14.3: Action queue failure rate → Degraded (AC 7)
  describe('action queue integration', () => {
    it('should show action-queue Degraded on >50% failure rate (AC 7)', () => {
      const events$ = new Subject<{ type: string }>()
      registry.connectActionQueue({ getEvents$: () => events$.asObservable() })

      // Emit events with high failure rate (3 out of 4 = 75%)
      events$.next({ type: 'failed' })
      events$.next({ type: 'failed' })
      events$.next({ type: 'failed' })
      events$.next({ type: 'synced' })

      // Wait for debounce
      vi.advanceTimersByTime(2100)

      const snapshot = registry.getSnapshot()
      expect(snapshot.subsystems.get('action-queue')?.state).toBe('degraded')
    })

    it('should recover action-queue to Healthy when failures drop', () => {
      const events$ = new Subject<{ type: string }>()
      registry.connectActionQueue({ getEvents$: () => events$.asObservable() })

      // Start with 100% failure rate → Unavailable
      events$.next({ type: 'failed' })
      events$.next({ type: 'failed' })
      events$.next({ type: 'failed' })
      vi.advanceTimersByTime(2100)
      expect(registry.getSnapshot().subsystems.get('action-queue')?.state).toBe('unavailable')

      // Add many successes
      for (let i = 0; i < 10; i++) {
        events$.next({ type: 'synced' })
      }
      vi.advanceTimersByTime(2100)

      expect(registry.getSnapshot().subsystems.get('action-queue')?.state).toBe('healthy')
    })
  })

  // Subtask 14.4: Multiple subsystem degradation (AC 21)
  describe('multiple subsystem degradation', () => {
    it('should list all degraded subsystems in snapshot (AC 21)', () => {
      // Go offline first (degrades remote subsystems via signal system)
      registry.connectNetworkStatus(false)
      vi.advanceTimersByTime(2100)

      // Set search index degraded via signal API
      registry.setSearchIndexHealth('degraded', 'Index build slow')
      vi.advanceTimersByTime(2100)

      // Set database unavailable via signal API
      registry.setDatabaseHealth(false, 'DB init failed')

      const snapshot = registry.getSnapshot()

      // database should be unavailable
      expect(snapshot.subsystems.get('database')?.state).toBe('unavailable')

      // sync-gmail should be degraded (network offline via signal)
      expect(snapshot.subsystems.get('sync-gmail')?.state).toBe('degraded')

      // outlook should be degraded (network offline via signal)
      expect(snapshot.subsystems.get('sync-outlook')?.state).toBe('degraded')

      // action-queue and send-queue should be degraded (network offline via signal)
      expect(snapshot.subsystems.get('action-queue')?.state).toBe('degraded')
      expect(snapshot.subsystems.get('send-queue')?.state).toBe('degraded')

      // search-index should be degraded (from setSearchIndexHealth signal)
      expect(snapshot.subsystems.get('search-index')?.state).toBe('degraded')

      // Overall should be unavailable (worst-of due to database)
      expect(snapshot.overallState).toBe('unavailable')

      // Count non-healthy subsystems — all 6 should be non-healthy
      let nonHealthyCount = 0
      for (const [, health] of snapshot.subsystems) {
        if (health.state !== 'healthy') nonHealthyCount++
      }
      expect(nonHealthyCount).toBe(6)
    })
  })

  // Send queue integration
  describe('send queue integration', () => {
    it('should track send queue failure rate independently', () => {
      const actionEvents$ = new Subject<{ type: string }>()
      const sendEvents$ = new Subject<{ type: string }>()

      registry.connectActionQueue({ getEvents$: () => actionEvents$.asObservable() })
      registry.connectSendQueue({ getEvents$: () => sendEvents$.asObservable() })

      // Action queue has 100% failure rate → Unavailable
      actionEvents$.next({ type: 'failed' })
      actionEvents$.next({ type: 'failed' })
      actionEvents$.next({ type: 'failed' })
      vi.advanceTimersByTime(2100)

      // Send queue is fine
      sendEvents$.next({ type: 'sent' })
      sendEvents$.next({ type: 'sent' })
      sendEvents$.next({ type: 'sent' })
      vi.advanceTimersByTime(2100)

      const snapshot = registry.getSnapshot()
      expect(snapshot.subsystems.get('action-queue')?.state).toBe('unavailable')
      expect(snapshot.subsystems.get('send-queue')?.state).toBe('healthy')
    })
  })
})
