/**
 * PII Sanitizer
 *
 * Sanitizes potentially sensitive information from log entries
 * to ensure privacy compliance and prevent accidental PII leakage.
 *
 * Detects and masks:
 * - Email addresses
 * - Bearer tokens
 * - Access tokens
 * - OAuth credentials
 * - Sensitive field names (password, token, body, content, etc.)
 */

/**
 * Regex patterns for detecting PII
 */
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g

const TOKEN_REGEX = /Bearer\s+[A-Za-z0-9\-_=]+\.[A-Za-z0-9\-_=]+\.?[A-Za-z0-9\-_.+/=]*/g

const ACCESS_TOKEN_REGEX = /access_token["']?\s*[:=]\s*["']?[A-Za-z0-9\-_=.]+/gi

const REFRESH_TOKEN_REGEX = /refresh_token["']?\s*[:=]\s*["']?[A-Za-z0-9\-_=./]+/gi

const CODE_REGEX = /code["']?\s*[:=]\s*["']?[A-Za-z0-9\-_=.]+/gi

/**
 * Field names that should always be redacted
 */
const SENSITIVE_FIELDS = new Set([
  'password',
  'token',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'idToken',
  'id_token',
  'secret',
  'clientSecret',
  'client_secret',
  'apiKey',
  'api_key',
  'authorization',
  'body',
  'content',
  'html',
  'text',
  'snippet',
  'raw',
])

/**
 * Sanitize a string value by masking PII patterns
 */
function sanitizeString(value: string): string {
  return value
    .replace(EMAIL_REGEX, '[EMAIL_REDACTED]')
    .replace(TOKEN_REGEX, 'Bearer [TOKEN_REDACTED]')
    .replace(ACCESS_TOKEN_REGEX, 'access_token=[REDACTED]')
    .replace(REFRESH_TOKEN_REGEX, 'refresh_token=[REDACTED]')
    .replace(CODE_REGEX, 'code=[REDACTED]')
}

/**
 * Sanitize any value for logging
 *
 * Recursively processes objects and arrays to:
 * - Mask PII patterns in strings
 * - Redact sensitive field values
 * - Preserve structure for debugging
 *
 * @param obj - Any value to sanitize
 * @returns Sanitized copy of the value
 *
 * @example
 * ```ts
 * sanitizeForLogging({ email: 'user@example.com', token: 'abc123' })
 * // => { email: '[EMAIL_REDACTED]', token: '[REDACTED]' }
 *
 * sanitizeForLogging('Bearer eyJ...')
 * // => 'Bearer [TOKEN_REDACTED]'
 * ```
 */
export function sanitizeForLogging(obj: unknown): unknown {
  // Handle null/undefined
  if (obj === null || obj === undefined) {
    return obj
  }

  // Handle strings
  if (typeof obj === 'string') {
    return sanitizeString(obj)
  }

  // Handle primitives (number, boolean)
  if (typeof obj !== 'object') {
    return obj
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeForLogging(item))
  }

  // Handle objects
  const sanitized: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    // Check if this is a sensitive field
    const lowerKey = key.toLowerCase()
    if (
      SENSITIVE_FIELDS.has(key) ||
      SENSITIVE_FIELDS.has(lowerKey) ||
      lowerKey.includes('password') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('token') ||
      lowerKey.includes('credential')
    ) {
      sanitized[key] = '[REDACTED]'
    } else {
      sanitized[key] = sanitizeForLogging(value)
    }
  }

  return sanitized
}

/**
 * Check if a value contains potential PII
 * Useful for validation without modifying the value
 *
 * @param value - Value to check
 * @returns true if potential PII was detected
 */
export function containsPII(value: unknown): boolean {
  if (typeof value === 'string') {
    return EMAIL_REGEX.test(value) || TOKEN_REGEX.test(value) || ACCESS_TOKEN_REGEX.test(value)
  }

  if (typeof value === 'object' && value !== null) {
    for (const key of Object.keys(value as Record<string, unknown>)) {
      if (SENSITIVE_FIELDS.has(key) || SENSITIVE_FIELDS.has(key.toLowerCase())) {
        return true
      }
    }
  }

  return false
}
