import type { RxJsonSchema } from 'rxdb'

/**
 * Sync state document for tracking email sync progress per account
 * Persists sync progress to enable resumption after interruptions
 */
export interface SyncStateDocument {
  id: string // accountId (primary key)
  provider: 'gmail' | 'outlook' // Email provider type
  status: 'idle' | 'syncing' | 'paused' | 'error' // Current sync status
  lastSyncAt: number // Unix timestamp of last successful sync
  nextSyncAt: number // Unix timestamp when next sync should run

  // Initial sync progress
  initialSyncComplete: boolean // Whether initial sync (90 days) is done
  totalEmailsToSync: number // Total emails to sync (estimated)
  emailsSynced: number // Emails synced so far
  progressPercentage: number // Progress percentage (0-100)
  estimatedTimeRemaining: number // Estimated milliseconds remaining

  // Provider-specific sync tokens
  syncToken?: string // Gmail: historyId, Outlook: deltaLink
  pageToken?: string // Pagination token for resuming mid-sync

  // Error tracking
  errorCount: number // Number of consecutive errors
  lastError?: string // Last error message
  lastErrorAt?: number // Unix timestamp of last error

  // Rate limiting
  lastRequestAt: number // Unix timestamp of last API request
  requestCount: number // Requests made in current time window

  // Statistics
  syncStartedAt?: number // Unix timestamp when current sync started
  averageSyncRate: number // Average emails per second
}

/**
 * RxDB schema for SyncState collection
 * Version 0 - Initial schema design
 */
export const syncStateSchema: RxJsonSchema<SyncStateDocument> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 100,
    },
    provider: {
      type: 'string',
      enum: ['gmail', 'outlook'],
    },
    status: {
      type: 'string',
      enum: ['idle', 'syncing', 'paused', 'error'],
      maxLength: 20, // Required for indexed string fields in RxDB
    },
    lastSyncAt: {
      type: 'number',
      minimum: 0,
      maximum: 9999999999999,
      multipleOf: 1,
    },
    nextSyncAt: {
      type: 'number',
      minimum: 0,
      maximum: 9999999999999,
      multipleOf: 1,
    },
    initialSyncComplete: {
      type: 'boolean',
    },
    totalEmailsToSync: {
      type: 'number',
      minimum: 0,
      multipleOf: 1,
    },
    emailsSynced: {
      type: 'number',
      minimum: 0,
      multipleOf: 1,
    },
    progressPercentage: {
      type: 'number',
      minimum: 0,
      maximum: 100,
    },
    estimatedTimeRemaining: {
      type: 'number',
      minimum: 0,
      multipleOf: 1,
    },
    syncToken: {
      type: 'string',
      maxLength: 500,
    },
    pageToken: {
      type: 'string',
      maxLength: 500,
    },
    errorCount: {
      type: 'number',
      minimum: 0,
      multipleOf: 1,
    },
    lastError: {
      type: 'string',
      maxLength: 1000,
    },
    lastErrorAt: {
      type: 'number',
      minimum: 0,
      maximum: 9999999999999,
      multipleOf: 1,
    },
    lastRequestAt: {
      type: 'number',
      minimum: 0,
      maximum: 9999999999999,
      multipleOf: 1,
    },
    requestCount: {
      type: 'number',
      minimum: 0,
      multipleOf: 1,
    },
    syncStartedAt: {
      type: 'number',
      minimum: 0,
      maximum: 9999999999999,
      multipleOf: 1,
    },
    averageSyncRate: {
      type: 'number',
      minimum: 0,
    },
  },
  required: [
    'id',
    'provider',
    'status',
    'lastSyncAt',
    'nextSyncAt',
    'initialSyncComplete',
    'totalEmailsToSync',
    'emailsSynced',
    'progressPercentage',
    'estimatedTimeRemaining',
    'errorCount',
    'lastRequestAt',
    'requestCount',
    'averageSyncRate',
  ],
  indexes: ['status', 'nextSyncAt'],
}
