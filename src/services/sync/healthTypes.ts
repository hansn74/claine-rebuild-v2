/**
 * Health Registry Types
 *
 * Story 1.20: Subsystem Health Tracking
 * Task 1: Health Registry Types (AC 1-5)
 */

/** Health state for a subsystem (AC 2-5) */
export type HealthState = 'healthy' | 'degraded' | 'unavailable'

/** Subsystem identifiers tracked by the health registry (AC 1) */
export type SubsystemId =
  | 'sync-gmail'
  | 'sync-outlook'
  | 'action-queue'
  | 'send-queue'
  | 'search-index'
  | 'database'
  | 'ai'

/** Current health status of a subsystem (AC 1-5) */
export interface SubsystemHealth {
  id: SubsystemId
  state: HealthState
  reason?: string
  lastError?: string
  nextRetryAt?: number
  lastStateChange: number
}

/** Record of a health state transition (AC 15) */
export interface HealthStateChange {
  subsystemId: SubsystemId
  previousState: HealthState
  newState: HealthState
  reason: string
  timestamp: number
}

/** Snapshot of all subsystem health at a point in time */
export interface HealthSnapshot {
  subsystems: Map<SubsystemId, SubsystemHealth>
  overallState: HealthState
  lastUpdated: number
}
