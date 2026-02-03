/**
 * Circuit Breaker Types
 *
 * Story 1.19: Circuit Breaker for Provider APIs
 * Task 1: Subtasks 1.1-1.3
 */

/** Circuit breaker states (AC 1) */
export type CircuitState = 'closed' | 'open' | 'half-open'

/** Provider identifier */
export type ProviderId = 'gmail' | 'outlook'

/** Circuit breaker configuration per provider (AC 2, AC 4) */
export interface CircuitBreakerConfig {
  /** Number of failures within the time window to trip the breaker (AC 2: 3) */
  failureThreshold: number
  /** Time window in ms for counting failures (AC 2: 60000) */
  failureWindowMs: number
  /** Cooldown duration in ms before transitioning to half-open (AC 4: 60000) */
  cooldownMs: number
  /** Number of consecutive failures to trip the breaker (AC 2: 5) */
  consecutiveFailureThreshold: number
}

/** Per-provider circuit state tracking (Subtask 1.3) */
export interface ProviderCircuit {
  state: CircuitState
  failureTimestamps: number[]
  consecutiveFailureCount: number
  lastStateChangeTime: number
  cooldownTimer: ReturnType<typeof setTimeout> | null
  probeInFlight: boolean
}

/** Circuit status for UI consumption */
export interface CircuitStatus {
  state: CircuitState
  cooldownRemainingMs: number
  failureCount: number
  lastFailureTime: number | null
}
