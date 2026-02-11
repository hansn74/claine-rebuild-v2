/**
 * Logger Types
 *
 * Type definitions for the structured logging system.
 * Provides consistent log entry format across the application.
 */

/**
 * Log severity levels in order of priority
 * - debug: Detailed debugging information
 * - info: General operational information
 * - warn: Warning conditions that may need attention
 * - error: Error conditions that require immediate attention
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/**
 * Log categories for filtering and organization
 * - auth: Authentication and OAuth related logs
 * - sync: Email synchronization logs
 * - db: Database operations logs
 * - ui: User interface and component logs
 * - workers: Web Worker related logs
 * - general: Uncategorized or application-wide logs
 * - navigation: Navigation and routing logs
 * - search: Search functionality logs
 * - compose: Email composition logs
 * - outbox: Send queue and outbox logs
 * - shortcuts: Keyboard shortcuts logs
 * - email-store: Email store operations logs
 * - folder-store: Folder store operations logs
 * - selection: Email selection logs
 * - undo: Undo/redo operations logs
 * - email-actions: Email action operations logs
 * - attributes: Attribute system logs
 */
export type LogCategory =
  | 'auth'
  | 'sync'
  | 'db'
  | 'ui'
  | 'workers'
  | 'general'
  | 'navigation'
  | 'search'
  | 'compose'
  | 'outbox'
  | 'shortcuts'
  | 'email-store'
  | 'folder-store'
  | 'selection'
  | 'undo'
  | 'email-actions'
  | 'attributes'
  | 'attachment-hook'
  | 'attachment-preview'
  | 'keyboard'
  | 'folder-counts'
  | 'label-sync'
  | 'use-move-to-folder'
  | 'sendQueue'
  | 'search-store'
  | 'attributeStore'
  | 'gmail'
  | 'outlook'
  | 'sync-orchestrator'
  | 'email-actions-bulk'
  | 'email-actions-conflict'
  | 'queue-processor'
  | 'drafts'
  | 'use-drafts'
  | 'use-emails'
  | 'email-folders'
  | 'action-queue'
  | 'attachment'
  | 'email-attributes'
  | 'gmail-actions'
  | 'label-service'
  | 'move-service'
  | 'optimistic-updates'
  | 'presets'
  | 'queueProcessor'
  | 'undo-hook'
  | 'ai'

/**
 * Structured log entry with metadata
 * All logs follow this consistent format for searchability
 */
export interface LogEntry {
  /** Unix timestamp when the log was created */
  timestamp: number
  /** Severity level of the log */
  level: LogLevel
  /** Category for filtering */
  category: LogCategory
  /** Human-readable log message */
  message: string
  /** Optional structured context data (sanitized before storage) */
  context?: Record<string, unknown>
}

/**
 * Log level priority order for filtering
 * Lower index = lower priority (more verbose)
 */
export const LOG_LEVEL_PRIORITY: readonly LogLevel[] = ['debug', 'info', 'warn', 'error'] as const
