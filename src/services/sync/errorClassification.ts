import type { SyncErrorType } from '../database/schemas/syncFailure.schema'

/**
 * Classified error with details for retry logic
 */
export interface ClassifiedError {
  type: SyncErrorType
  httpStatus?: number
  retryAfterMs?: number // From Retry-After header (converted to ms)
  message: string
  originalError?: unknown
}

/**
 * HTTP status codes that indicate transient (retryable) errors
 * AC 8: Transient errors classified: network timeout, rate limit (429), server error (5xx)
 */
const TRANSIENT_HTTP_CODES = [
  408, // Request Timeout
  429, // Too Many Requests (rate limit)
  500, // Internal Server Error
  502, // Bad Gateway
  503, // Service Unavailable
  504, // Gateway Timeout
]

/**
 * HTTP status codes that indicate permanent (non-retryable) errors
 * AC 9: Permanent errors classified: not found (404), forbidden (403), invalid (400)
 */
const PERMANENT_HTTP_CODES = [
  400, // Bad Request
  401, // Unauthorized (handled separately with token refresh)
  403, // Forbidden
  404, // Not Found
  410, // Gone (resource deleted)
]

/**
 * Parse Retry-After header value to milliseconds
 * Supports both delay-seconds and HTTP-date formats
 */
function parseRetryAfterHeader(headerValue: string | null): number | undefined {
  if (!headerValue) return undefined

  // Try parsing as seconds (e.g., "5")
  const seconds = parseInt(headerValue, 10)
  if (!isNaN(seconds)) {
    return seconds * 1000
  }

  // Try parsing as HTTP-date (e.g., "Wed, 21 Oct 2015 07:28:00 GMT")
  const date = new Date(headerValue)
  if (!isNaN(date.getTime())) {
    const delayMs = date.getTime() - Date.now()
    return Math.max(0, delayMs)
  }

  return undefined
}

/**
 * Classify an HTTP error by status code
 *
 * AC 8: Transient errors classified: network timeout, rate limit (429), server error (5xx)
 * AC 9: Permanent errors classified: not found (404), forbidden (403), invalid (400)
 * AC 10: Unknown errors default to transient with limited retries
 */
export function classifyHttpError(
  status: number,
  headers?: Headers | Record<string, string>
): ClassifiedError {
  // Extract Retry-After header if present
  let retryAfterMs: number | undefined
  if (headers) {
    const retryAfterValue =
      headers instanceof Headers ? headers.get('Retry-After') : headers['Retry-After']
    retryAfterMs = parseRetryAfterHeader(retryAfterValue || null)
  }

  // Classify by HTTP status code
  if (TRANSIENT_HTTP_CODES.includes(status)) {
    return {
      type: 'transient',
      httpStatus: status,
      retryAfterMs,
      message: getHttpErrorMessage(status),
    }
  }

  if (PERMANENT_HTTP_CODES.includes(status)) {
    return {
      type: 'permanent',
      httpStatus: status,
      message: getHttpErrorMessage(status),
    }
  }

  // AC 10: Unknown errors default to transient with limited retries
  return {
    type: 'unknown',
    httpStatus: status,
    retryAfterMs,
    message: `Unknown HTTP error: ${status}`,
  }
}

/**
 * Get human-readable message for HTTP status codes
 */
function getHttpErrorMessage(status: number): string {
  const messages: Record<number, string> = {
    400: 'Bad request - Invalid request format',
    401: 'Unauthorized - Authentication required',
    403: 'Forbidden - Access denied',
    404: 'Not found - Resource does not exist',
    408: 'Request timeout - Server took too long to respond',
    410: 'Gone - Resource has been permanently deleted',
    429: 'Rate limit exceeded - Too many requests',
    500: 'Internal server error - Server encountered an error',
    502: 'Bad gateway - Invalid response from upstream server',
    503: 'Service unavailable - Server temporarily unavailable',
    504: 'Gateway timeout - Upstream server took too long',
  }
  return messages[status] || `HTTP error ${status}`
}

/**
 * Check if an error is a network error (no HTTP response)
 */
function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) {
    const message = error.message.toLowerCase()
    return (
      message.includes('network') ||
      message.includes('fetch') ||
      message.includes('failed to fetch') ||
      message.includes('network request failed')
    )
  }
  return false
}

/**
 * Check if error has HTTP response information
 */
interface ErrorWithResponse {
  response?: {
    status?: number
    headers?: Headers | Record<string, string>
  }
  status?: number
}

function hasHttpResponse(error: unknown): error is ErrorWithResponse {
  return typeof error === 'object' && error !== null && ('response' in error || 'status' in error)
}

/**
 * Classify any error type
 *
 * Handles:
 * - Response objects from fetch
 * - Errors with response property (axios-style)
 * - Network errors (TypeError from fetch failures)
 * - Gmail API specific errors
 * - Outlook Graph API specific errors
 * - Unknown error types
 */
export function classifyError(error: unknown): ClassifiedError {
  // Handle Response object directly
  if (error instanceof Response) {
    return classifyHttpError(error.status, error.headers)
  }

  // Handle network errors (no HTTP response)
  if (isNetworkError(error)) {
    return {
      type: 'transient',
      message: 'Network error - Connection failed',
      originalError: error,
    }
  }

  // Handle errors with HTTP response information
  if (hasHttpResponse(error)) {
    const status = error.response?.status ?? error.status
    if (typeof status === 'number') {
      const headers = error.response?.headers
      return {
        ...classifyHttpError(status, headers),
        originalError: error,
      }
    }
  }

  // Handle Error objects with messages that indicate specific conditions
  if (error instanceof Error) {
    const message = error.message.toLowerCase()

    // Gmail API specific errors
    if (message.includes('quota exceeded') || message.includes('rate limit')) {
      return {
        type: 'transient',
        httpStatus: 429,
        message: 'Rate limit exceeded',
        originalError: error,
      }
    }

    if (message.includes('not found') || message.includes('does not exist')) {
      return {
        type: 'permanent',
        httpStatus: 404,
        message: 'Resource not found',
        originalError: error,
      }
    }

    if (message.includes('unauthorized') || message.includes('auth') || message.includes('token')) {
      return {
        type: 'permanent',
        httpStatus: 401,
        message: 'Authentication error',
        originalError: error,
      }
    }

    if (message.includes('forbidden') || message.includes('permission')) {
      return {
        type: 'permanent',
        httpStatus: 403,
        message: 'Access denied',
        originalError: error,
      }
    }
  }

  // AC 10: Unknown errors default to transient with limited retries
  const errorMessage =
    error instanceof Error ? error.message : String(error) || 'Unknown error occurred'

  return {
    type: 'unknown',
    message: errorMessage,
    originalError: error,
  }
}

/**
 * Determine if an error should be retried based on classification and retry count
 *
 * AC 7: Permanent failures (deleted emails, auth errors) not retried
 */
export function shouldRetry(
  classification: ClassifiedError,
  retryCount: number,
  maxRetries: number
): boolean {
  // Permanent errors should never be retried
  if (classification.type === 'permanent') {
    return false
  }

  // Check if max retries exceeded
  if (retryCount >= maxRetries) {
    return false
  }

  // Transient and unknown errors can be retried
  return true
}

/**
 * Get the status to assign to a sync failure based on error classification
 */
export function getFailureStatus(
  classification: ClassifiedError,
  retryCount: number,
  maxRetries: number
): 'pending' | 'permanent' | 'exhausted' {
  // Permanent errors go directly to permanent status
  if (classification.type === 'permanent') {
    return 'permanent'
  }

  // Check if retries are exhausted
  if (retryCount >= maxRetries) {
    return 'exhausted'
  }

  // Otherwise, pending for retry
  return 'pending'
}
