/* eslint-disable no-console */
/**
 * Logger Service
 *
 * Provides structured logging with configurable log levels,
 * category filtering, and automatic PII sanitization.
 *
 * Features:
 * - Log levels (debug, info, warn, error)
 * - Category-based filtering (auth, sync, db, ui, general)
 * - Environment-aware log level defaults
 * - Automatic context sanitization
 * - Persistence to IndexedDB (via logStore)
 *
 * Usage:
 *   import { logger } from '@/services/logger'
 *
 *   logger.debug('auth', 'OAuth flow started', { provider: 'gmail' })
 *   logger.info('sync', 'Email sync completed', { count: 50 })
 *   logger.warn('db', 'Migration fallback used')
 *   logger.error('ui', 'Component failed to render', { component: 'EmailList' })
 */

import type { LogLevel, LogCategory, LogEntry } from './types'
import { LOG_LEVEL_PRIORITY } from './types'
import { sanitizeForLogging } from './sanitizer'
import { logStore } from './logStore'

/**
 * Determine the configured log level
 * Priority: VITE_LOG_LEVEL env var > production default (warn) > development default (debug)
 */
function getConfiguredLogLevel(): LogLevel {
  // Check for explicit environment variable
  const envLevel = import.meta.env.VITE_LOG_LEVEL as LogLevel | undefined
  if (envLevel && LOG_LEVEL_PRIORITY.includes(envLevel)) {
    return envLevel
  }

  // Default based on environment
  return import.meta.env.PROD ? 'warn' : 'debug'
}

/**
 * Logger class providing structured logging with level and category filtering
 */
class Logger {
  private level: LogLevel

  constructor() {
    this.level = getConfiguredLogLevel()
  }

  /**
   * Log a debug message (detailed debugging information)
   */
  debug(category: LogCategory, message: string, context?: Record<string, unknown>): void {
    this.log('debug', category, message, context)
  }

  /**
   * Log an info message (general operational information)
   */
  info(category: LogCategory, message: string, context?: Record<string, unknown>): void {
    this.log('info', category, message, context)
  }

  /**
   * Log a warning message (conditions that may need attention)
   */
  warn(category: LogCategory, message: string, context?: Record<string, unknown>): void {
    this.log('warn', category, message, context)
  }

  /**
   * Log an error message (error conditions requiring attention)
   */
  error(category: LogCategory, message: string, context?: Record<string, unknown>): void {
    this.log('error', category, message, context)
  }

  /**
   * Get the current log level
   */
  getLevel(): LogLevel {
    return this.level
  }

  /**
   * Set the log level dynamically
   */
  setLevel(level: LogLevel): void {
    this.level = level
  }

  /**
   * Internal logging implementation
   */
  private log(
    level: LogLevel,
    category: LogCategory,
    message: string,
    context?: Record<string, unknown>
  ): void {
    // Check if this level should be logged
    if (!this.shouldLog(level)) {
      return
    }

    // Sanitize context to remove PII
    const sanitizedContext = context
      ? (sanitizeForLogging(context) as Record<string, unknown>)
      : undefined

    // Create structured log entry
    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      category,
      message,
      context: sanitizedContext,
    }

    // Output to console with formatting
    this.consoleOutput(entry)

    // Persist to IndexedDB (async, non-blocking)
    logStore.addEntry(entry).catch(() => {
      // Silently fail - don't want logging to break the app
    })
  }

  /**
   * Check if a log level should be output based on current configuration
   */
  private shouldLog(level: LogLevel): boolean {
    const currentLevelIndex = LOG_LEVEL_PRIORITY.indexOf(this.level)
    const messageLevelIndex = LOG_LEVEL_PRIORITY.indexOf(level)
    return messageLevelIndex >= currentLevelIndex
  }

  /**
   * Output log entry to console with appropriate formatting
   */
  private consoleOutput(entry: LogEntry): void {
    const prefix = `[${entry.category.toUpperCase()}]`
    const args: unknown[] = [prefix, entry.message]

    if (entry.context) {
      args.push(entry.context)
    }

    switch (entry.level) {
      case 'debug':
        console.debug(...args)
        break
      case 'info':
        console.info(...args)
        break
      case 'warn':
        console.warn(...args)
        break
      case 'error':
        console.error(...args)
        break
    }
  }
}

/**
 * Singleton logger instance
 * Use this throughout the application for consistent logging
 */
export const logger = new Logger()
