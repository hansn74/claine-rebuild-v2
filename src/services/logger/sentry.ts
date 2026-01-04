/* eslint-disable no-console */
/**
 * Sentry Error Tracking Integration
 *
 * Provides production error tracking with privacy controls.
 *
 * Features:
 * - Automatic exception and rejection tracking
 * - Environment-aware (disabled in development)
 * - Privacy opt-out support
 * - PII sanitization before sending
 *
 * Usage:
 *   import { initSentry, captureException } from '@/services/logger'
 *
 *   // Initialize in main.tsx
 *   initSentry()
 *
 *   // Capture errors manually
 *   try { ... } catch (error) {
 *     captureException(error)
 *   }
 */

import * as Sentry from '@sentry/react'
import { sanitizeForLogging } from './sanitizer'

/**
 * Settings store accessor for privacy opt-out
 * Lazy-loaded to avoid circular dependencies
 */
let getErrorTrackingEnabled: (() => boolean) | null = null

/**
 * Register settings accessor for privacy controls
 * Called from settingsStore to avoid circular imports
 */
export function registerSettingsAccessor(accessor: () => boolean): void {
  getErrorTrackingEnabled = accessor
}

/**
 * Check if error tracking is enabled
 * Returns true by default if settings not registered yet
 */
function isErrorTrackingEnabled(): boolean {
  if (getErrorTrackingEnabled) {
    return getErrorTrackingEnabled()
  }
  // Default to enabled if settings not loaded yet
  return true
}

/**
 * Sanitize Sentry event data for privacy
 */
function sanitizeEvent(
  event: Sentry.ErrorEvent,
  _hint?: Sentry.EventHint
): Sentry.ErrorEvent | null {
  // Respect privacy opt-out
  if (!isErrorTrackingEnabled()) {
    return null
  }

  // Sanitize exception values and messages
  if (event.exception?.values) {
    for (const exception of event.exception.values) {
      if (exception.value) {
        exception.value = sanitizeForLogging(exception.value) as string
      }
    }
  }

  // Sanitize breadcrumb data
  if (event.breadcrumbs) {
    for (const breadcrumb of event.breadcrumbs) {
      if (breadcrumb.data) {
        breadcrumb.data = sanitizeForLogging(breadcrumb.data) as Record<string, unknown>
      }
      if (breadcrumb.message) {
        breadcrumb.message = sanitizeForLogging(breadcrumb.message) as string
      }
    }
  }

  // Sanitize user data (if present)
  if (event.user) {
    event.user = sanitizeForLogging(event.user) as Sentry.User
  }

  // Sanitize extra data
  if (event.extra) {
    event.extra = sanitizeForLogging(event.extra) as Record<string, unknown>
  }

  return event
}

/**
 * Initialize Sentry error tracking
 *
 * Should be called early in app initialization (main.tsx).
 * Only activates in production when DSN is configured.
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN

  if (!dsn) {
    if (import.meta.env.DEV) {
      console.info('[Sentry] DSN not configured, error tracking disabled')
    }
    return
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // Only enable in production
    enabled: import.meta.env.PROD,
    // Sanitize all events before sending
    beforeSend: sanitizeEvent,
    // Disable in development
    debug: false,
    // Sample rate for performance monitoring (disabled for now)
    tracesSampleRate: 0,
    // Ignore common non-actionable errors
    ignoreErrors: [
      // Browser extensions
      /ResizeObserver loop/,
      // User cancellations
      /AbortError/,
      // Network errors handled by app
      /NetworkError/,
      /Failed to fetch/,
    ],
    // Configure integrations
    integrations: [
      Sentry.browserTracingIntegration({
        // Only trace API calls
        tracePropagationTargets: [
          'localhost',
          /^https:\/\/gmail\.googleapis\.com/,
          /^https:\/\/graph\.microsoft\.com/,
        ],
      }),
    ],
  })

  // Setup global error handlers
  setupGlobalErrorHandlers()
}

/**
 * Setup global error handlers for uncaught exceptions
 */
function setupGlobalErrorHandlers(): void {
  // Handle uncaught exceptions
  window.onerror = (message, source, lineno, colno, error): boolean => {
    if (!isErrorTrackingEnabled()) {
      return false
    }

    Sentry.captureException(error ?? new Error(String(message)), {
      extra: {
        source,
        lineno,
        colno,
      },
    })

    // Return false to allow default error handling
    return false
  }

  // Handle unhandled promise rejections
  window.onunhandledrejection = (event: PromiseRejectionEvent): void => {
    if (!isErrorTrackingEnabled()) {
      return
    }

    const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason))

    Sentry.captureException(error, {
      extra: {
        type: 'unhandledRejection',
        reason: sanitizeForLogging(event.reason),
      },
    })
  }
}

/**
 * Manually capture an exception
 *
 * @param error - Error to capture
 * @param context - Optional additional context
 */
export function captureException(error: Error | unknown, context?: Record<string, unknown>): void {
  if (!isErrorTrackingEnabled()) {
    return
  }

  const sanitizedContext = context
    ? (sanitizeForLogging(context) as Record<string, unknown>)
    : undefined

  Sentry.captureException(error, {
    extra: sanitizedContext,
  })
}

/**
 * Manually capture a message
 *
 * @param message - Message to capture
 * @param level - Sentry severity level
 * @param context - Optional additional context
 */
export function captureMessage(
  message: string,
  level: 'info' | 'warning' | 'error' = 'info',
  context?: Record<string, unknown>
): void {
  if (!isErrorTrackingEnabled()) {
    return
  }

  const sanitizedContext = context
    ? (sanitizeForLogging(context) as Record<string, unknown>)
    : undefined

  Sentry.captureMessage(sanitizeForLogging(message) as string, {
    level,
    extra: sanitizedContext,
  })
}

/**
 * Add user context to Sentry events
 * Only includes non-PII identifiers
 *
 * @param userId - Anonymized user ID (not email)
 */
export function setUser(userId: string | null): void {
  if (userId) {
    Sentry.setUser({ id: userId })
  } else {
    Sentry.setUser(null)
  }
}
