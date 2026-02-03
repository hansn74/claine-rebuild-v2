/**
 * Circuit Breaker Integration Tests
 *
 * Story 1.19: Circuit Breaker for Provider APIs
 * Task 8: Integration Tests (AC 22)
 *
 * Tests the circuit breaker's integration patterns as implemented in:
 * - syncOrchestrator.ts (skips sync when circuit open, records success/failure)
 * - emailActionQueue.ts (defers actions when circuit open, drains on recovery)
 * - sendQueueService.ts (forceSend bypasses open circuit, drains on recovery)
 *
 * @circuit-breaker
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { CircuitBreaker } from '../circuitBreaker'
import { classifyError } from '../errorClassification'
import type { ProviderId } from '../circuitBreakerTypes'

describe('CircuitBreaker Integration', () => {
  let breaker: CircuitBreaker

  beforeEach(() => {
    vi.useFakeTimers()
    breaker = new CircuitBreaker()
  })

  afterEach(() => {
    breaker.resetAll()
    vi.useRealTimers()
  })

  /**
   * Subtask 8.1: Test send queue forceSend bypass (AC 22)
   *
   * Mirrors the exact check from sendQueueService.ts#sendQueuedEmail:
   *   if (!forceSend && providerId && !circuitBreaker.canExecute(providerId)) { return }
   */
  describe('send queue force-send bypass', () => {
    function simulateSendQueueCheck(
      cb: CircuitBreaker,
      accountId: string,
      forceSend: boolean
    ): 'proceed' | 'deferred' {
      const providerType = accountId.split(':')[0]
      const providerId: ProviderId | null =
        providerType === 'gmail' || providerType === 'outlook' ? providerType : null

      if (!forceSend && providerId && !cb.canExecute(providerId)) {
        return 'deferred'
      }
      return 'proceed'
    }

    it('should allow force-send to bypass open circuit (AC 17)', () => {
      for (let i = 0; i < 5; i++) {
        breaker.recordFailure('gmail')
      }
      expect(breaker.getState('gmail')).toBe('open')

      // User-initiated retry with forceSend=true bypasses circuit
      expect(simulateSendQueueCheck(breaker, 'gmail:user@test.com', true)).toBe('proceed')
    })

    it('should block non-forced send when circuit is open', () => {
      for (let i = 0; i < 5; i++) {
        breaker.recordFailure('gmail')
      }

      expect(simulateSendQueueCheck(breaker, 'gmail:user@test.com', false)).toBe('deferred')
    })

    it('should allow non-forced send when circuit is closed', () => {
      expect(simulateSendQueueCheck(breaker, 'gmail:user@test.com', false)).toBe('proceed')
    })

    it('should allow send for unknown provider regardless of circuit state', () => {
      for (let i = 0; i < 5; i++) {
        breaker.recordFailure('gmail')
      }
      // Unknown provider returns null, so circuit check is skipped
      expect(simulateSendQueueCheck(breaker, 'yahoo:user@test.com', false)).toBe('proceed')
    })
  })

  /**
   * Subtask 8.2: Test action queue defers and drains
   *
   * Mirrors the exact check from emailActionQueue.ts#processAction:
   *   const providerId = this.getProviderForAccount(item.providerType)
   *   if (providerId && !circuitBreaker.canExecute(providerId)) { return }
   *
   * And the recovery drain subscription (subscribeToCircuitRecovery).
   */
  describe('action queue circuit integration', () => {
    function simulateActionQueueCheck(
      cb: CircuitBreaker,
      providerType: string
    ): 'proceed' | 'deferred' {
      const providerId: ProviderId | null =
        providerType === 'gmail' || providerType === 'outlook' ? providerType : null

      if (providerId && !cb.canExecute(providerId)) {
        return 'deferred'
      }
      return 'proceed'
    }

    it('should defer actions when circuit is open and resume after close', () => {
      expect(simulateActionQueueCheck(breaker, 'gmail')).toBe('proceed')

      for (let i = 0; i < 5; i++) {
        breaker.recordFailure('gmail')
      }
      expect(simulateActionQueueCheck(breaker, 'gmail')).toBe('deferred')

      // Cooldown + probe success
      vi.advanceTimersByTime(60_001)
      expect(breaker.getState('gmail')).toBe('half-open')
      expect(breaker.canExecute('gmail')).toBe(true) // probe allowed
      breaker.recordSuccess('gmail')
      expect(breaker.getState('gmail')).toBe('closed')

      expect(simulateActionQueueCheck(breaker, 'gmail')).toBe('proceed')
    })

    it('should trigger queue drain when circuit recovers', () => {
      const drainCalled = vi.fn()
      let previousStates: Record<string, string> = {}

      // Replicate subscribeToCircuitRecovery logic
      breaker.subscribe(() => {
        const gmailState = breaker.getStatus('gmail').state
        const outlookState = breaker.getStatus('outlook').state

        const gmailRecovered =
          (previousStates['gmail'] === 'open' || previousStates['gmail'] === 'half-open') &&
          gmailState === 'closed'
        const outlookRecovered =
          (previousStates['outlook'] === 'open' || previousStates['outlook'] === 'half-open') &&
          outlookState === 'closed'

        if (gmailRecovered || outlookRecovered) {
          drainCalled()
        }

        previousStates = { gmail: gmailState, outlook: outlookState }
      })

      // Trip Gmail circuit
      for (let i = 0; i < 5; i++) {
        breaker.recordFailure('gmail')
      }
      expect(drainCalled).not.toHaveBeenCalled()

      // Recover Gmail circuit
      vi.advanceTimersByTime(60_001)
      breaker.canExecute('gmail') // start probe
      breaker.recordSuccess('gmail')

      expect(drainCalled).toHaveBeenCalledTimes(1)
    })
  })

  /**
   * Subtask 8.3: Test sync orchestrator skip/resume
   *
   * Mirrors the exact pattern from syncOrchestrator.ts#syncAccount:
   *   const provider = progress.provider as 'gmail' | 'outlook'
   *   if (provider && !circuitBreaker.canExecute(provider)) { return }
   *   try { ... circuitBreaker.recordSuccess(provider) }
   *   catch { classifyError → recordFailure for transient }
   */
  describe('sync orchestrator circuit integration', () => {
    function simulateSyncAccount(
      cb: CircuitBreaker,
      provider: ProviderId,
      syncResult: 'success' | 'transient-error' | 'permanent-error'
    ): 'skipped' | 'synced' | 'failed' {
      if (!cb.canExecute(provider)) {
        return 'skipped'
      }

      if (syncResult === 'success') {
        cb.recordSuccess(provider)
        return 'synced'
      }

      // Simulate error classification + recording
      const status = syncResult === 'transient-error' ? 503 : 404
      const classified = classifyError(new Response(null, { status }))
      if (classified.type === 'transient' || classified.type === 'unknown') {
        cb.recordFailure(provider)
      }
      return 'failed'
    }

    it('should skip sync when circuit is open and resume after recovery', () => {
      expect(simulateSyncAccount(breaker, 'gmail', 'success')).toBe('synced')

      // 5 transient errors trip the breaker
      for (let i = 0; i < 5; i++) {
        simulateSyncAccount(breaker, 'gmail', 'transient-error')
      }
      expect(breaker.getState('gmail')).toBe('open')
      expect(simulateSyncAccount(breaker, 'gmail', 'success')).toBe('skipped')

      // Recover via cooldown + probe
      vi.advanceTimersByTime(60_001)
      breaker.canExecute('gmail')
      breaker.recordSuccess('gmail')

      expect(simulateSyncAccount(breaker, 'gmail', 'success')).toBe('synced')
    })

    it('should not trip breaker for permanent errors', () => {
      for (let i = 0; i < 10; i++) {
        simulateSyncAccount(breaker, 'gmail', 'permanent-error')
      }
      // Permanent errors never trip the breaker
      expect(breaker.getState('gmail')).toBe('closed')
    })
  })

  // Error classification integration (unchanged — already good)
  describe('error classification integration', () => {
    it('should classify transient errors correctly for circuit breaker', () => {
      const transientErrors = [
        new Response(null, { status: 429 }),
        new Response(null, { status: 500 }),
        new Response(null, { status: 502 }),
        new Response(null, { status: 503 }),
        new Response(null, { status: 504 }),
      ]

      for (const error of transientErrors) {
        const classified = classifyError(error)
        expect(classified.type).toBe('transient')
      }
    })

    it('should classify permanent errors correctly — should NOT trip breaker', () => {
      const permanentErrors = [
        new Response(null, { status: 400 }),
        new Response(null, { status: 401 }),
        new Response(null, { status: 403 }),
        new Response(null, { status: 404 }),
      ]

      for (const error of permanentErrors) {
        const classified = classifyError(error)
        expect(classified.type).toBe('permanent')
      }
    })

    it('should only trip breaker for transient/unknown errors', () => {
      // Record 5 permanent errors — should NOT trip
      for (let i = 0; i < 5; i++) {
        const classified = classifyError(new Response(null, { status: 404 }))
        if (classified.type === 'transient' || classified.type === 'unknown') {
          breaker.recordFailure('gmail')
        }
      }
      expect(breaker.getState('gmail')).toBe('closed')

      // Record 5 transient errors — SHOULD trip
      for (let i = 0; i < 5; i++) {
        const classified = classifyError(new Response(null, { status: 503 }))
        if (classified.type === 'transient' || classified.type === 'unknown') {
          breaker.recordFailure('gmail')
        }
      }
      expect(breaker.getState('gmail')).toBe('open')
    })
  })
})
