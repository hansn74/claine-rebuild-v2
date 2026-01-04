/**
 * Logger Service Module
 *
 * Provides structured logging infrastructure for the application.
 *
 * Usage:
 *   import { logger } from '@/services/logger'
 *
 *   // Log with category and optional context
 *   logger.debug('auth', 'OAuth flow started', { provider: 'gmail' })
 *   logger.info('sync', 'Email sync completed', { count: 50 })
 *   logger.warn('db', 'Migration fallback used')
 *   logger.error('ui', 'Component failed to render', { component: 'EmailList' })
 *
 *   // Export logs for debugging
 *   import { logStore } from '@/services/logger'
 *   const logsJson = await logStore.exportAsJson()
 */

// Main logger instance
export { logger } from './logger'

// Type definitions
export type { LogLevel, LogCategory, LogEntry } from './types'
export { LOG_LEVEL_PRIORITY } from './types'

// Log persistence
export { logStore } from './logStore'

// PII sanitization
export { sanitizeForLogging, containsPII } from './sanitizer'

// Sentry integration
export { initSentry, captureException, captureMessage } from './sentry'
