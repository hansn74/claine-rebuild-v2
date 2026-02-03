/**
 * Circuit Breaker Unit Tests
 *
 * Story 1.19: Circuit Breaker for Provider APIs
 * Task 7: Unit Tests (AC 18-23)
 *
 * @circuit-breaker
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { CircuitBreaker, DEFAULT_CIRCUIT_CONFIG } from '../circuitBreaker'

describe('CircuitBreaker', () => {
  let breaker: CircuitBreaker

  beforeEach(() => {
    vi.useFakeTimers()
    breaker = new CircuitBreaker()
  })

  afterEach(() => {
    breaker.resetAll()
    vi.useRealTimers()
  })

  // Subtask 7.1: Test circuit starts in Closed state
  describe('initial state', () => {
    it('should start in closed state for any provider', () => {
      expect(breaker.getState('gmail')).toBe('closed')
      expect(breaker.getState('outlook')).toBe('closed')
    })

    it('should allow execution in closed state', () => {
      expect(breaker.canExecute('gmail')).toBe(true)
      expect(breaker.canExecute('outlook')).toBe(true)
    })
  })

  // Subtask 7.2: Test 5 consecutive failures → open (AC 18)
  describe('consecutive failure threshold', () => {
    it('should open circuit after 5 consecutive failures', () => {
      for (let i = 0; i < 5; i++) {
        breaker.recordFailure('gmail')
      }

      expect(breaker.getState('gmail')).toBe('open')
      expect(breaker.canExecute('gmail')).toBe(false)
    })

    it('should not open circuit with fewer than 5 consecutive failures when spread outside window', () => {
      // Spread 4 failures so only 2 are within any 60s window
      breaker.recordFailure('gmail')
      vi.advanceTimersByTime(25_000)
      breaker.recordFailure('gmail')
      vi.advanceTimersByTime(40_000) // 65s from first failure, 40s from second
      breaker.recordFailure('gmail')
      vi.advanceTimersByTime(40_000) // 105s from first, only 2 in window
      breaker.recordFailure('gmail')

      // 4 total but never 5 consecutive, and never 3 within a 60s window
      expect(breaker.getState('gmail')).toBe('closed')
      expect(breaker.canExecute('gmail')).toBe(true)
    })

    it('should reset consecutive count on success', () => {
      breaker.recordFailure('gmail')
      breaker.recordFailure('gmail')
      breaker.recordSuccess('gmail')
      breaker.recordFailure('gmail')
      breaker.recordFailure('gmail')

      // 2 failures, reset, 2 more = never reaches 5 consecutive
      expect(breaker.getState('gmail')).toBe('closed')
    })
  })

  // Subtask 7.3: Test 3 failures within 60s window → open (AC 18)
  describe('windowed failure threshold', () => {
    it('should open circuit after 3 failures within 60s', () => {
      breaker.recordFailure('gmail')
      vi.advanceTimersByTime(10_000) // 10s later
      breaker.recordFailure('gmail')
      vi.advanceTimersByTime(10_000) // 20s later
      breaker.recordFailure('gmail')

      expect(breaker.getState('gmail')).toBe('open')
    })

    // Subtask 7.13: Test failure window expiry
    it('should NOT trip breaker if 3 failures spread across >60s', () => {
      breaker.recordFailure('gmail')
      vi.advanceTimersByTime(25_000) // 25s
      breaker.recordFailure('gmail')
      vi.advanceTimersByTime(40_000) // 65s total from first failure
      breaker.recordFailure('gmail')

      // First failure is outside the 60s window, only 2 within window
      expect(breaker.getState('gmail')).toBe('closed')
    })
  })

  // Subtask 7.4: Test Open state blocks execution
  describe('open state', () => {
    it('should block all operations when open', () => {
      // Trip the breaker
      for (let i = 0; i < 5; i++) {
        breaker.recordFailure('gmail')
      }

      expect(breaker.canExecute('gmail')).toBe(false)
      expect(breaker.canExecute('gmail')).toBe(false) // Multiple checks
    })

    it('should not track additional failures when already open', () => {
      for (let i = 0; i < 5; i++) {
        breaker.recordFailure('gmail')
      }
      expect(breaker.getState('gmail')).toBe('open')

      // Additional failures should be ignored
      breaker.recordFailure('gmail')
      expect(breaker.getState('gmail')).toBe('open')
    })
  })

  // Subtask 7.5: Test cooldown → half-open, single probe (AC 19)
  describe('cooldown and half-open', () => {
    it('should transition to half-open after cooldown expires', () => {
      for (let i = 0; i < 5; i++) {
        breaker.recordFailure('gmail')
      }
      expect(breaker.getState('gmail')).toBe('open')

      // Advance past cooldown
      vi.advanceTimersByTime(60_001)

      expect(breaker.getState('gmail')).toBe('half-open')
    })

    it('should allow a single probe request in half-open', () => {
      for (let i = 0; i < 5; i++) {
        breaker.recordFailure('gmail')
      }
      vi.advanceTimersByTime(60_001)
      expect(breaker.getState('gmail')).toBe('half-open')

      // First call should be allowed (probe)
      expect(breaker.canExecute('gmail')).toBe(true)
      // Second call should be blocked (probe already in flight)
      expect(breaker.canExecute('gmail')).toBe(false)
    })
  })

  // Subtask 7.6: Test Half-Open + success → Closed (AC 19)
  describe('half-open recovery', () => {
    it('should close circuit when probe succeeds', () => {
      for (let i = 0; i < 5; i++) {
        breaker.recordFailure('gmail')
      }
      vi.advanceTimersByTime(60_001)
      expect(breaker.getState('gmail')).toBe('half-open')

      breaker.canExecute('gmail') // Start probe
      breaker.recordSuccess('gmail')

      expect(breaker.getState('gmail')).toBe('closed')
      expect(breaker.canExecute('gmail')).toBe(true)
    })
  })

  // Subtask 7.7: Test Half-Open + failure → Open (AC 20)
  describe('half-open probe failure', () => {
    it('should reopen circuit when probe fails and reset cooldown', () => {
      for (let i = 0; i < 5; i++) {
        breaker.recordFailure('gmail')
      }
      vi.advanceTimersByTime(60_001)
      expect(breaker.getState('gmail')).toBe('half-open')

      breaker.canExecute('gmail') // Start probe
      breaker.recordFailure('gmail')

      expect(breaker.getState('gmail')).toBe('open')
      expect(breaker.canExecute('gmail')).toBe(false)

      // Cooldown resets — need to wait full 60s again
      vi.advanceTimersByTime(59_999)
      expect(breaker.getState('gmail')).toBe('open')

      vi.advanceTimersByTime(2)
      expect(breaker.getState('gmail')).toBe('half-open')
    })
  })

  // Subtask 7.8: Test provider isolation (AC 21)
  describe('provider isolation', () => {
    it('should not affect outlook when gmail circuit opens', () => {
      for (let i = 0; i < 5; i++) {
        breaker.recordFailure('gmail')
      }

      expect(breaker.getState('gmail')).toBe('open')
      expect(breaker.canExecute('gmail')).toBe(false)
      expect(breaker.getState('outlook')).toBe('closed')
      expect(breaker.canExecute('outlook')).toBe(true)
    })

    it('should not affect gmail when outlook circuit opens', () => {
      for (let i = 0; i < 5; i++) {
        breaker.recordFailure('outlook')
      }

      expect(breaker.getState('outlook')).toBe('open')
      expect(breaker.getState('gmail')).toBe('closed')
    })

    it('should track failures independently per provider', () => {
      breaker.recordFailure('gmail')
      breaker.recordFailure('gmail')
      breaker.recordFailure('outlook')

      const gmailStatus = breaker.getStatus('gmail')
      const outlookStatus = breaker.getStatus('outlook')

      expect(gmailStatus.failureCount).toBe(2)
      expect(outlookStatus.failureCount).toBe(1)
    })
  })

  // Subtask 7.9: Test forceProbe bypasses cooldown
  describe('forceProbe', () => {
    it('should transition to half-open immediately', () => {
      for (let i = 0; i < 5; i++) {
        breaker.recordFailure('gmail')
      }
      expect(breaker.getState('gmail')).toBe('open')

      breaker.forceProbe('gmail')

      expect(breaker.getState('gmail')).toBe('half-open')
      expect(breaker.canExecute('gmail')).toBe(true) // Probe allowed
    })

    it('should do nothing if circuit is not open', () => {
      breaker.forceProbe('gmail')
      expect(breaker.getState('gmail')).toBe('closed')
    })
  })

  // Subtask 7.10: Test reset returns to closed (AC 23)
  describe('reset', () => {
    it('should reset circuit to closed state', () => {
      for (let i = 0; i < 5; i++) {
        breaker.recordFailure('gmail')
      }
      expect(breaker.getState('gmail')).toBe('open')

      breaker.reset('gmail')

      expect(breaker.getState('gmail')).toBe('closed')
      expect(breaker.canExecute('gmail')).toBe(true)
    })

    it('should not affect other providers', () => {
      for (let i = 0; i < 5; i++) {
        breaker.recordFailure('gmail')
        breaker.recordFailure('outlook')
      }

      breaker.reset('gmail')

      expect(breaker.getState('gmail')).toBe('closed')
      expect(breaker.getState('outlook')).toBe('open')
    })
  })

  // Subtask 7.11: Test getCooldownRemaining
  describe('getCooldownRemaining', () => {
    it('should return correct remaining cooldown', () => {
      for (let i = 0; i < 5; i++) {
        breaker.recordFailure('gmail')
      }

      expect(breaker.getCooldownRemaining('gmail')).toBe(60_000)

      vi.advanceTimersByTime(15_000)
      expect(breaker.getCooldownRemaining('gmail')).toBe(45_000)

      vi.advanceTimersByTime(30_000)
      expect(breaker.getCooldownRemaining('gmail')).toBe(15_000)
    })

    it('should return 0 for closed circuit', () => {
      expect(breaker.getCooldownRemaining('gmail')).toBe(0)
    })

    it('should return 0 for half-open circuit', () => {
      for (let i = 0; i < 5; i++) {
        breaker.recordFailure('gmail')
      }
      vi.advanceTimersByTime(60_001)
      expect(breaker.getCooldownRemaining('gmail')).toBe(0)
    })
  })

  // Subtask 7.14: Test event listener receives state transitions
  describe('event system', () => {
    it('should notify listeners on state transitions', () => {
      const listener = vi.fn()
      breaker.subscribe(listener)

      for (let i = 0; i < 5; i++) {
        breaker.recordFailure('gmail')
      }

      // Listener called when circuit opens
      expect(listener).toHaveBeenCalled()
    })

    it('should notify on cooldown → half-open transition', () => {
      const listener = vi.fn()

      for (let i = 0; i < 5; i++) {
        breaker.recordFailure('gmail')
      }

      breaker.subscribe(listener)
      listener.mockClear()

      vi.advanceTimersByTime(60_001)

      expect(listener).toHaveBeenCalled()
    })

    it('should return unsubscribe function', () => {
      const listener = vi.fn()
      const unsubscribe = breaker.subscribe(listener)

      unsubscribe()

      for (let i = 0; i < 5; i++) {
        breaker.recordFailure('gmail')
      }

      expect(listener).not.toHaveBeenCalled()
    })

    it('should handle listener errors gracefully', () => {
      const errorListener = vi.fn(() => {
        throw new Error('listener error')
      })
      const normalListener = vi.fn()

      breaker.subscribe(errorListener)
      breaker.subscribe(normalListener)

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      for (let i = 0; i < 5; i++) {
        breaker.recordFailure('gmail')
      }

      // Both listeners should be called, error should be caught
      expect(errorListener).toHaveBeenCalled()
      expect(normalListener).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })
  })

  // Subtask 7.15: Test getStatus returns correct aggregate status
  describe('getStatus', () => {
    it('should return correct status for closed circuit', () => {
      const status = breaker.getStatus('gmail')
      expect(status.state).toBe('closed')
      expect(status.cooldownRemainingMs).toBe(0)
      expect(status.failureCount).toBe(0)
      expect(status.lastFailureTime).toBeNull()
    })

    it('should return correct status for open circuit', () => {
      for (let i = 0; i < 5; i++) {
        breaker.recordFailure('gmail')
      }

      const status = breaker.getStatus('gmail')
      expect(status.state).toBe('open')
      expect(status.cooldownRemainingMs).toBe(60_000)
    })

    it('should return correct status for half-open circuit', () => {
      for (let i = 0; i < 5; i++) {
        breaker.recordFailure('gmail')
      }
      vi.advanceTimersByTime(60_001)

      const status = breaker.getStatus('gmail')
      expect(status.state).toBe('half-open')
      expect(status.cooldownRemainingMs).toBe(0)
    })
  })

  // Subtask 7.12: Test only transient errors trip the breaker
  // Note: This test validates the concept - actual error classification
  // integration is tested in integration tests. The CircuitBreaker itself
  // doesn't classify errors; callers must only call recordFailure for transient errors.
  describe('default config', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_CIRCUIT_CONFIG).toEqual({
        failureThreshold: 3,
        failureWindowMs: 60_000,
        cooldownMs: 60_000,
        consecutiveFailureThreshold: 5,
      })
    })
  })

  // Custom configuration
  describe('custom configuration', () => {
    it('should respect custom cooldown duration', () => {
      const customBreaker = new CircuitBreaker({
        ...DEFAULT_CIRCUIT_CONFIG,
        cooldownMs: 30_000,
        consecutiveFailureThreshold: 2,
      })

      customBreaker.recordFailure('gmail')
      customBreaker.recordFailure('gmail')
      expect(customBreaker.getState('gmail')).toBe('open')
      expect(customBreaker.getCooldownRemaining('gmail')).toBe(30_000)

      vi.advanceTimersByTime(30_001)
      expect(customBreaker.getState('gmail')).toBe('half-open')

      customBreaker.resetAll()
    })
  })
})
