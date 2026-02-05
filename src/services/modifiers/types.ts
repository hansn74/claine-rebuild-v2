/**
 * Modifier Types and Interfaces
 *
 * Epic 3: Offline-First Modifier Architecture
 * Story 3.1: Core Modifier Infrastructure
 *
 * Core types for the Superhuman-style modifier pattern.
 * Every user action becomes a Modifier with:
 * - modify(entity): Pure function that transforms local state immediately
 * - persist(): Idempotent function that syncs to backend
 *
 * Key Principles:
 * 1. UI derives state: displayState = cache + pendingModifiers
 * 2. Per-entity queues: One queue per email/thread ensures ordering
 * 3. Pure modify(): No side effects, enables retry/rollback
 * 4. Idempotent persist(): Safe to retry infinitely
 * 5. Automatic rollback: Remove modifier from queue → state reverts
 */

import type { EmailDocument } from '@/services/database/schemas/email.schema'
import type { DraftDocument } from '@/services/database/schemas/draft.schema'

/**
 * Modifier types for email actions
 */
export type EmailModifierType =
  | 'archive'
  | 'unarchive'
  | 'delete'
  | 'undelete'
  | 'mark-read'
  | 'mark-unread'
  | 'move'
  | 'star'
  | 'unstar'

/**
 * Modifier types for draft actions
 */
export type DraftModifierType = 'draft-update' | 'draft-delete'

/**
 * All modifier types
 */
export type ModifierType = EmailModifierType | DraftModifierType

/**
 * Entity types that modifiers can operate on
 */
export type EntityType = 'email' | 'draft'

/**
 * Provider types
 */
export type ProviderType = 'gmail' | 'outlook'

/**
 * Modifier status in the queue
 */
export type ModifierStatus = 'pending' | 'processing' | 'completed' | 'failed'

/**
 * Base modifier interface
 *
 * All modifiers must implement this interface.
 * The generic type T represents the entity type (Email, Draft, etc.)
 */
export interface Modifier<T> {
  /** Unique modifier ID for deduplication */
  id: string

  /** Target entity ID (email ID, draft ID, etc.) */
  entityId: string

  /** Type of entity this modifier operates on */
  entityType: EntityType

  /** Timestamp when modifier was created (for ordering) */
  createdAt: number

  /** Account ID for API sync */
  accountId: string

  /** Provider type (gmail, outlook) */
  provider: ProviderType

  /** Type of modification */
  type: ModifierType

  /** Current status */
  status: ModifierStatus

  /** Number of sync attempts */
  attempts: number

  /** Error message if failed */
  error?: string

  /**
   * Pure function that transforms entity state locally.
   * Must be synchronous and side-effect free.
   * This enables immediate UI updates and rollback.
   *
   * @param entity - Current entity state
   * @returns Transformed entity state
   */
  modify(entity: T): T

  /**
   * Idempotent function that syncs the change to backend.
   * Must be safe to retry infinitely.
   * Called asynchronously when online.
   *
   * @throws Error if sync fails (will be retried)
   */
  persist(): Promise<void>

  /**
   * Serialize modifier for persistence
   */
  toDocument(): ModifierDocument
}

/**
 * Email modifier interface
 */
export interface EmailModifier extends Modifier<EmailDocument> {
  entityType: 'email'
  type: EmailModifierType
}

/**
 * Draft modifier interface
 */
export interface DraftModifier extends Modifier<DraftDocument> {
  entityType: 'draft'
  type: DraftModifierType
}

/**
 * Modifier document for RxDB persistence
 *
 * This is the serialized form of a modifier stored in IndexedDB.
 * Contains all necessary data to reconstruct the modifier.
 */
export interface ModifierDocument {
  /** Unique modifier ID */
  id: string

  /** Target entity ID */
  entityId: string

  /** Thread ID for dependency grouping (Story 2.19) */
  threadId?: string

  /** Entity type (email, draft) */
  entityType: EntityType

  /** Modifier type */
  type: ModifierType

  /** Account ID */
  accountId: string

  /** Provider type */
  provider: ProviderType

  /** Current status */
  status: ModifierStatus

  /** Number of attempts */
  attempts: number

  /** Maximum attempts before permanent failure */
  maxAttempts: number

  /** Creation timestamp */
  createdAt: number

  /** Last update timestamp */
  updatedAt: number

  /** Last attempt timestamp */
  lastAttemptAt?: number

  /** Error message if failed */
  error?: string

  /**
   * Modifier-specific payload (JSON serialized)
   * Contains the data needed to reconstruct the modify() and persist() functions
   */
  payload: string
}

/**
 * Parameters for creating modifiers
 */
export interface BaseModifierParams {
  entityId: string
  accountId: string
  provider: ProviderType
  /** Thread ID for dependency grouping (Story 2.19) */
  threadId?: string
}

/**
 * Archive modifier parameters
 */
export interface ArchiveModifierParams extends BaseModifierParams {
  currentLabels: string[]
  currentFolder: string
}

/**
 * Delete modifier parameters
 */
export interface DeleteModifierParams extends BaseModifierParams {
  currentFolder: string
  currentLabels: string[]
}

/**
 * Move modifier parameters
 */
export interface MoveModifierParams extends BaseModifierParams {
  targetFolder: string
  sourceFolder: string
  currentLabels: string[]
}

/**
 * Mark read/unread modifier parameters
 */
export interface MarkReadModifierParams extends BaseModifierParams {
  markAsRead: boolean
  currentLabels: string[]
}

/**
 * Star/unstar modifier parameters
 */
export interface StarModifierParams extends BaseModifierParams {
  star: boolean
  currentLabels: string[]
}

/**
 * Draft update modifier parameters
 */
export interface DraftUpdateModifierParams extends BaseModifierParams {
  updates: Partial<DraftDocument>
  remoteDraftId?: string
}

/**
 * Draft delete modifier parameters
 */
export interface DraftDeleteModifierParams extends BaseModifierParams {
  remoteDraftId?: string
}

/**
 * Union type for all modifier parameters
 */
export type ModifierParams =
  | ArchiveModifierParams
  | DeleteModifierParams
  | MoveModifierParams
  | MarkReadModifierParams
  | StarModifierParams
  | DraftUpdateModifierParams
  | DraftDeleteModifierParams

/**
 * Modifier queue event types
 */
export type ModifierQueueEvent =
  | { type: 'added'; modifier: ModifierDocument }
  | { type: 'removed'; modifierId: string; entityId: string }
  | { type: 'processing'; modifier: ModifierDocument }
  | { type: 'completed'; modifier: ModifierDocument }
  | { type: 'failed'; modifier: ModifierDocument; error: string }
  | { type: 'retry-scheduled'; modifier: ModifierDocument; delayMs: number }

/**
 * Retry delay configuration for exponential backoff
 * Pattern: 1s, 5s, 30s, 60s
 */
export const RETRY_DELAYS = [1000, 5000, 30000, 60000] as const

/**
 * Maximum number of retry attempts before permanent failure
 */
export const MAX_ATTEMPTS = 4

/**
 * Default concurrency for parallel action queue processing (Story 2.19)
 * Matches Superhuman's proven concurrency level
 */
export const PARALLEL_ACTION_CONCURRENCY = 4

/**
 * Generate a unique modifier ID
 */
export function generateModifierId(): string {
  return `mod-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}
