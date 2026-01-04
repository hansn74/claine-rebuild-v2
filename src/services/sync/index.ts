/**
 * Sync Services Index
 * Exports all sync-related services and utilities
 */

// Core sync services
export { GmailSyncService } from './gmailSync'
export { OutlookSyncService } from './outlookSync'

// Progress tracking
export { SyncProgressService, type SyncProgress, type SyncProgressUpdate } from './syncProgress'

// Failure handling and retry
export {
  SyncFailureService,
  getSyncFailureService,
  resetSyncFailureService,
} from './syncFailureService'
export type { SyncFailureStats, RecordFailureResult } from './syncFailureService'

// Error classification
export {
  classifyError,
  classifyHttpError,
  shouldRetry,
  getFailureStatus,
  type ClassifiedError,
} from './errorClassification'

// Retry engine
export {
  calculateRetryDelay,
  calculateRetryDelayWithHeader,
  getNextRetryAt,
  isRetryExhausted,
  getRemainingRetries,
  waitForRetry,
  executeWithRetry,
  DEFAULT_RETRY_CONFIG,
  type RetryConfig,
} from './retryEngine'

// Rate limiting
export { createGmailRateLimiter, createOutlookRateLimiter, type RateLimiter } from './rateLimiter'
