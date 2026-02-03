/**
 * Circuit Breaker Service
 *
 * Story 1.19: Circuit Breaker for Provider APIs
 * Implements the circuit breaker pattern to prevent hammering failing email providers.
 *
 * State Machine:
 *   CLOSED  ---(failure threshold)---> OPEN
 *   OPEN    ---(cooldown expires)----> HALF-OPEN
 *   HALF-OPEN ---(probe success)-----> CLOSED
 *   HALF-OPEN ---(probe failure)-----> OPEN (reset cooldown)
 *
 * AC 1-7: Circuit states and transitions
 * AC 8-10: Provider isolation, in-memory state
 * AC 11, 14: Event system for UI notifications
 * AC 15: Wraps existing rate limiter and retry engine
 */

import { logger } from '@/services/logger'
import type {
  CircuitState,
  CircuitBreakerConfig,
  ProviderCircuit,
  ProviderId,
  CircuitStatus,
} from './circuitBreakerTypes'

/** Default configuration (AC 2: 5 consecutive or 3 within 60s, AC 4: 60s cooldown) */
export const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 3,
  failureWindowMs: 60_000,
  cooldownMs: 60_000,
  consecutiveFailureThreshold: 5,
}

/**
 * Create a fresh provider circuit in the closed (healthy) state
 */
function createProviderCircuit(): ProviderCircuit {
  return {
    state: 'closed',
    failureTimestamps: [],
    consecutiveFailureCount: 0,
    lastStateChangeTime: Date.now(),
    cooldownTimer: null,
    probeInFlight: false,
  }
}

/**
 * Circuit Breaker
 *
 * Tracks per-provider circuit state and manages transitions.
 * Uses the listener pattern (matching notificationStore.ts) for UI subscriptions.
 *
 * Subtask 1.4: Map<string, ProviderCircuit> keyed by provider
 * Subtask 1.14: Singleton export
 */
export class CircuitBreaker {
  private circuits: Map<string, ProviderCircuit> = new Map()
  private config: CircuitBreakerConfig
  private listeners: Set<() => void> = new Set()
  /** Cached snapshots for useSyncExternalStore referential stability */
  private statusCache: Map<string, CircuitStatus> = new Map()

  constructor(config: CircuitBreakerConfig = DEFAULT_CIRCUIT_CONFIG) {
    this.config = config
  }

  /**
   * Get or create the circuit for a provider
   */
  private getCircuit(provider: ProviderId): ProviderCircuit {
    let circuit = this.circuits.get(provider)
    if (!circuit) {
      circuit = createProviderCircuit()
      this.circuits.set(provider, circuit)
    }
    return circuit
  }

  /**
   * Record a failure for a provider (Subtask 1.5)
   *
   * Pushes failure timestamp, increments consecutive count, checks thresholds.
   * AC 2: Closed → Open after 5 consecutive failures or 3 failures within 60s
   */
  recordFailure(provider: ProviderId): void {
    const circuit = this.getCircuit(provider)
    const now = Date.now()

    // In half-open state, a failure means probe failed → back to open (AC 7)
    if (circuit.state === 'half-open') {
      circuit.probeInFlight = false
      this.transitionTo(provider, circuit, 'open')
      logger.warn('sync', 'Circuit breaker probe failed', {
        provider,
        cooldownMs: this.config.cooldownMs,
      })
      return
    }

    // Only track failures in closed state
    if (circuit.state !== 'closed') {
      return
    }

    circuit.consecutiveFailureCount++
    circuit.failureTimestamps.push(now)

    // Clean up old timestamps outside the failure window
    const windowStart = now - this.config.failureWindowMs
    circuit.failureTimestamps = circuit.failureTimestamps.filter((t) => t > windowStart)

    // Check consecutive failure threshold (AC 2: 5 consecutive)
    if (circuit.consecutiveFailureCount >= this.config.consecutiveFailureThreshold) {
      const count = circuit.consecutiveFailureCount
      this.transitionTo(provider, circuit, 'open')
      logger.info('sync', 'Circuit breaker opened (consecutive failures)', {
        provider,
        failureCount: count,
        cooldownMs: this.config.cooldownMs,
      })
      return
    }

    // Check windowed failure threshold (AC 2: 3 within 60s)
    if (circuit.failureTimestamps.length >= this.config.failureThreshold) {
      const windowedCount = circuit.failureTimestamps.length
      this.transitionTo(provider, circuit, 'open')
      logger.info('sync', 'Circuit breaker opened (windowed failures)', {
        provider,
        failureCount: windowedCount,
        windowMs: this.config.failureWindowMs,
        cooldownMs: this.config.cooldownMs,
      })
    }
  }

  /**
   * Record a success for a provider (Subtask 1.6)
   *
   * Resets consecutive count and clears failure window.
   * In Half-Open state, transitions to Closed (AC 6).
   */
  recordSuccess(provider: ProviderId): void {
    const circuit = this.getCircuit(provider)

    if (circuit.state === 'half-open') {
      // Probe succeeded → close circuit (AC 6)
      circuit.probeInFlight = false
      this.transitionTo(provider, circuit, 'closed')
      logger.info('sync', 'Circuit breaker closed (recovered)', { provider })
      return
    }

    if (circuit.state === 'closed') {
      // Reset failure tracking on success
      circuit.consecutiveFailureCount = 0
      circuit.failureTimestamps = []
    }
  }

  /**
   * Check if operations can be executed for a provider (Subtask 1.7)
   *
   * Returns true for Closed, false for Open, allows single probe for Half-Open.
   */
  canExecute(provider: ProviderId): boolean {
    const circuit = this.getCircuit(provider)

    switch (circuit.state) {
      case 'closed':
        return true
      case 'open':
        return false
      case 'half-open':
        // Only allow one probe request at a time
        if (!circuit.probeInFlight) {
          circuit.probeInFlight = true
          logger.info('sync', 'Circuit breaker probe started', { provider })
          return true
        }
        return false
      default:
        return false
    }
  }

  /**
   * Get the current state for a provider (Subtask 1.9)
   */
  getState(provider: ProviderId): CircuitState {
    return this.getCircuit(provider).state
  }

  /**
   * Get remaining cooldown in ms for a provider (Subtask 1.10)
   *
   * Returns 0 if not in open state or cooldown has expired.
   */
  getCooldownRemaining(provider: ProviderId): number {
    const circuit = this.getCircuit(provider)

    if (circuit.state !== 'open') {
      return 0
    }

    const elapsed = Date.now() - circuit.lastStateChangeTime
    const remaining = this.config.cooldownMs - elapsed
    return Math.max(0, remaining)
  }

  /**
   * Force a probe attempt, bypassing cooldown (Subtask 1.11)
   *
   * Transitions Open → Half-Open immediately (AC 13).
   */
  forceProbe(provider: ProviderId): void {
    const circuit = this.getCircuit(provider)

    if (circuit.state !== 'open') {
      return
    }

    // Clear existing cooldown timer
    if (circuit.cooldownTimer) {
      clearTimeout(circuit.cooldownTimer)
      circuit.cooldownTimer = null
    }

    this.transitionTo(provider, circuit, 'half-open')
    logger.info('sync', 'Circuit breaker force probe initiated', { provider })
  }

  /**
   * Reset a provider's circuit to Closed state (Subtask 1.12)
   *
   * For testing and app restart (AC 23).
   */
  reset(provider: ProviderId): void {
    const circuit = this.circuits.get(provider)

    if (circuit) {
      // Clear any active cooldown timer to prevent memory leaks
      if (circuit.cooldownTimer) {
        clearTimeout(circuit.cooldownTimer)
      }
    }

    // Replace with fresh circuit
    this.circuits.set(provider, createProviderCircuit())
    this.statusCache.delete(provider)
    this.notifyListeners()
  }

  /**
   * Reset all providers' circuits to Closed state
   */
  resetAll(): void {
    for (const [, circuit] of this.circuits) {
      if (circuit.cooldownTimer) {
        clearTimeout(circuit.cooldownTimer)
      }
    }
    this.circuits.clear()
    this.statusCache.clear()
    this.notifyListeners()
  }

  // --- Event System (Task 2) ---

  /**
   * Subscribe to circuit state changes (Subtask 2.1)
   *
   * Follows notificationStore.ts listener pattern.
   * Returns unsubscribe function.
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * Get comprehensive status for a provider (Subtask 2.3)
   *
   * Used by UI components via useSyncExternalStore.
   * Returns a cached reference when values are unchanged for referential stability.
   */
  getStatus(provider: ProviderId): CircuitStatus {
    const circuit = this.getCircuit(provider)
    const cooldownRemainingMs = this.getCooldownRemaining(provider)
    const failureCount = circuit.consecutiveFailureCount
    const lastFailureTime =
      circuit.failureTimestamps.length > 0
        ? circuit.failureTimestamps[circuit.failureTimestamps.length - 1]
        : null

    const cached = this.statusCache.get(provider)
    if (
      cached &&
      cached.state === circuit.state &&
      cached.cooldownRemainingMs === cooldownRemainingMs &&
      cached.failureCount === failureCount &&
      cached.lastFailureTime === lastFailureTime
    ) {
      return cached
    }

    const status: CircuitStatus = {
      state: circuit.state,
      cooldownRemainingMs,
      failureCount,
      lastFailureTime,
    }
    this.statusCache.set(provider, status)
    return status
  }

  // --- Internal ---

  /**
   * Transition a circuit to a new state (Subtask 1.8, Subtask 2.2)
   *
   * Handles cooldown timer setup/teardown and notifies listeners.
   */
  private transitionTo(
    provider: ProviderId,
    circuit: ProviderCircuit,
    newState: CircuitState
  ): void {
    const previousState = circuit.state
    // Capture pre-reset failure count for accurate logging
    const preTransitionFailureCount = circuit.consecutiveFailureCount

    // Clear existing cooldown timer
    if (circuit.cooldownTimer) {
      clearTimeout(circuit.cooldownTimer)
      circuit.cooldownTimer = null
    }

    // Update state
    circuit.state = newState
    circuit.lastStateChangeTime = Date.now()

    // Handle state-specific logic
    if (newState === 'open') {
      // Reset failure tracking for the new open period
      circuit.consecutiveFailureCount = 0
      circuit.failureTimestamps = []

      // Start cooldown timer → transition to half-open (Subtask 1.8)
      circuit.cooldownTimer = setTimeout(() => {
        if (circuit.state === 'open') {
          this.transitionTo(provider, circuit, 'half-open')
          logger.info('sync', 'Circuit breaker cooldown expired, entering half-open', {
            provider,
          })
        }
      }, this.config.cooldownMs)
    }

    if (newState === 'closed') {
      // Reset all failure tracking
      circuit.consecutiveFailureCount = 0
      circuit.failureTimestamps = []
      circuit.probeInFlight = false
    }

    // Emit state transition event (Subtask 2.2, 2.4)
    logger.info('sync', `Circuit breaker [${provider}] state: ${previousState} → ${newState}`, {
      provider,
      previousState,
      newState,
      failureCount: preTransitionFailureCount,
    })

    // Notify UI subscribers
    this.notifyListeners()
  }

  /**
   * Notify all listeners of state change (Subtask 2.1)
   */
  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener()
      } catch (error) {
        console.error('Error in circuit breaker listener:', error)
      }
    })
  }
}

/** Singleton instance (Subtask 1.14) */
export const circuitBreaker = new CircuitBreaker()
