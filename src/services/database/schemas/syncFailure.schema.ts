import type { RxJsonSchema } from 'rxdb'

/**
 * Error type classification for sync failures
 * - transient: Can be retried (rate limits, server errors, timeouts)
 * - permanent: Should not be retried (404, 403, deleted resources)
 * - unknown: Unknown error type, treated as transient with limited retries
 */
export type SyncErrorType = 'transient' | 'permanent' | 'unknown'

/**
 * Email provider type
 */
export type SyncProvider = 'gmail' | 'outlook'

/**
 * Sync failure status lifecycle
 * - pending: Queued for retry, waiting for nextRetryAt
 * - retrying: Currently being retried
 * - resolved: Successfully synced on retry
 * - exhausted: Max retries reached, needs manual intervention
 * - permanent: Permanent error (404, 403), will never succeed
 * - dismissed: User acknowledged and dismissed the failure
 */
export type SyncFailureStatus =
  | 'pending'
  | 'retrying'
  | 'resolved'
  | 'exhausted'
  | 'permanent'
  | 'dismissed'

/**
 * Sync Failure Document
 * Tracks failed sync operations for retry logic and user visibility
 *
 * AC 1: Sync engine detects when some emails sync successfully but others fail
 * AC 2: Failed email IDs tracked separately from successful ones
 * AC 14: Failed sync state persisted to RxDB (survives app restart)
 */
export interface SyncFailureDocument {
  id: string // UUID - unique failure identifier
  emailId: string // Gmail/Outlook message ID that failed
  accountId: string // Account context for multi-account support
  provider: SyncProvider // Email provider (gmail or outlook)

  // Error details
  errorType: SyncErrorType // Classification of the error
  errorCode: number // HTTP status code
  errorMessage: string // Error description for debugging

  // Retry tracking
  retryCount: number // Current retry attempt (0 = first failure)
  maxRetries: number // Max allowed retries (default: 3)
  lastAttemptAt: number // Unix timestamp ms of last attempt
  nextRetryAt: number | null // Unix timestamp ms for next retry (null if exhausted or permanent)

  // Lifecycle
  status: SyncFailureStatus // Current status in lifecycle
  createdAt: number // Unix timestamp ms when failure was first recorded
  resolvedAt: number | null // Unix timestamp ms when resolved (null if not resolved)
}

/**
 * RxDB schema for SyncFailure collection
 * Version 0 - Initial schema design
 *
 * Indexes:
 * - accountId: For filtering failures by account
 * - status: For finding pending/retrying failures
 * - nextRetryAt: For scheduling retry processing
 * - [accountId, status]: Compound index for account-scoped status queries
 */
export const syncFailureSchema: RxJsonSchema<SyncFailureDocument> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 100,
    },
    emailId: {
      type: 'string',
      maxLength: 200, // Gmail/Outlook message IDs can be long
    },
    accountId: {
      type: 'string',
      maxLength: 100,
    },
    provider: {
      type: 'string',
      enum: ['gmail', 'outlook'],
      maxLength: 10,
    },
    errorType: {
      type: 'string',
      enum: ['transient', 'permanent', 'unknown'],
      maxLength: 20,
    },
    errorCode: {
      type: 'integer',
      minimum: 0,
      maximum: 999,
    },
    errorMessage: {
      type: 'string',
      maxLength: 1000,
    },
    retryCount: {
      type: 'integer',
      minimum: 0,
      maximum: 100,
    },
    maxRetries: {
      type: 'integer',
      minimum: 0,
      maximum: 100,
    },
    lastAttemptAt: {
      type: 'integer',
      minimum: 0,
      maximum: 9999999999999, // Unix timestamp ms
    },
    nextRetryAt: {
      type: ['integer', 'null'],
      minimum: 0,
      maximum: 9999999999999,
    },
    status: {
      type: 'string',
      enum: ['pending', 'retrying', 'resolved', 'exhausted', 'permanent', 'dismissed'],
      maxLength: 20,
    },
    createdAt: {
      type: 'integer',
      minimum: 0,
      maximum: 9999999999999,
    },
    resolvedAt: {
      type: ['integer', 'null'],
      minimum: 0,
      maximum: 9999999999999,
    },
  },
  required: [
    'id',
    'emailId',
    'accountId',
    'provider',
    'errorType',
    'errorCode',
    'errorMessage',
    'retryCount',
    'maxRetries',
    'lastAttemptAt',
    'status',
    'createdAt',
  ],
  indexes: [
    'accountId', // Find failures for specific account
    'status', // Find pending/retrying failures
    // Note: nextRetryAt cannot be indexed because it's nullable (type: ['integer', 'null'])
    // RxDB dev-mode doesn't allow nullable fields as indexes
    // Retry scheduling queries will need to filter in memory after fetching by status
    ['accountId', 'status'], // Account-scoped status queries
  ],
}
