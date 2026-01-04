/**
 * Action Queue Schema
 *
 * Story 2.6: Email Actions (Archive, Delete, Mark Read/Unread)
 * Task 2.1: Create ActionQueue RxDB schema
 *
 * Stores email actions for offline-first sync.
 * Actions are queued locally and synced to provider APIs when online.
 *
 * FR007: Full read/write functionality when offline, queueing actions for later sync
 */

import type { RxJsonSchema } from 'rxdb'

/**
 * Status of an action in the queue
 */
export type ActionQueueStatus = 'pending' | 'processing' | 'completed' | 'failed'

/**
 * Type of email action
 */
export type ActionType = 'archive' | 'delete' | 'mark-read' | 'mark-unread'

/**
 * Action Queue Document
 *
 * Represents a queued email action waiting for sync
 */
export interface ActionQueueDocument {
  /** Unique action ID */
  id: string
  /** Type of action */
  type: ActionType
  /** Email ID the action applies to */
  emailId: string
  /** Account ID for API sync */
  accountId: string
  /** Provider type (gmail, outlook) */
  providerType: string
  /** Current status */
  status: ActionQueueStatus
  /** Number of sync attempts */
  attempts: number
  /** Maximum attempts before marking as failed */
  maxAttempts: number
  /** Timestamp when action was created (for ordering) */
  createdAt: number
  /** Timestamp of last update */
  updatedAt: number
  /** Timestamp of last attempt */
  lastAttemptAt?: number
  /** Error message if failed */
  error?: string
  /** Previous state for undo capability (JSON serialized) */
  previousState: string
}

/**
 * RxDB schema for Action Queue collection
 * Version 0 - Initial schema design
 *
 * Indexes:
 * - status: For finding pending actions to process
 * - createdAt: For processing in order (FIFO)
 * - ['status', 'createdAt']: Compound index for efficient queue processing
 */
export const actionQueueSchema: RxJsonSchema<ActionQueueDocument> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 100,
    },
    type: {
      type: 'string',
      enum: ['archive', 'delete', 'mark-read', 'mark-unread'],
      maxLength: 20,
    },
    emailId: {
      type: 'string',
      maxLength: 200,
    },
    accountId: {
      type: 'string',
      maxLength: 100,
    },
    providerType: {
      type: 'string',
      maxLength: 20,
    },
    status: {
      type: 'string',
      enum: ['pending', 'processing', 'completed', 'failed'],
      maxLength: 20,
    },
    attempts: {
      type: 'number',
      minimum: 0,
      maximum: 100,
      multipleOf: 1,
    },
    maxAttempts: {
      type: 'number',
      minimum: 1,
      maximum: 10,
      multipleOf: 1,
    },
    createdAt: {
      type: 'number',
      minimum: 0,
      maximum: 9999999999999,
      multipleOf: 1,
    },
    updatedAt: {
      type: 'number',
      minimum: 0,
      maximum: 9999999999999,
      multipleOf: 1,
    },
    lastAttemptAt: {
      type: 'number',
      minimum: 0,
      maximum: 9999999999999,
      multipleOf: 1,
    },
    error: {
      type: 'string',
      maxLength: 2000,
    },
    previousState: {
      type: 'string',
      maxLength: 10000,
    },
  },
  required: [
    'id',
    'type',
    'emailId',
    'accountId',
    'providerType',
    'status',
    'attempts',
    'maxAttempts',
    'createdAt',
    'updatedAt',
    'previousState',
  ],
  indexes: ['status', 'createdAt', ['status', 'createdAt']],
}
