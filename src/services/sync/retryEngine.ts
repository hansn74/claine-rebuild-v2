/**
 * Retry Engine - Exponential Backoff Logic
 *
 * Implements exponential backoff with configurable parameters for
 * handling transient sync failures.
 *
 * AC 4: Exponential backoff retry for transient failures (rate limits, network timeouts)
 * AC 5: Maximum retry attempts configurable (default: 3 attempts)
 * AC 6: Delay between retries increases exponentially (1s -> 2s -> 4s)
 * AC 7: Permanent failures (deleted emails, auth errors) not retried
 */

/**
 * Configuration for retry behavior
 */
export interface RetryConfig {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries: number
  /** Base delay in milliseconds (default: 1000 = 1 second) */
  baseDelayMs: number
  /** Maximum delay cap in milliseconds (default: 30000 = 30 seconds) */
  maxDelayMs: number
  /** Multiplier for exponential backoff (default: 2) */
  multiplier: number
}

/**
 * Default retry configuration
 * AC 5: Maximum retry attempts configurable (default: 3 attempts)
 * AC 6: Delay between retries increases exponentially (1s -> 2s -> 4s)
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000, // 1 second
  maxDelayMs: 30000, // 30 seconds max
  multiplier: 2,
}

/**
 * Calculate the retry delay using exponential backoff
 *
 * Formula: delay = baseDelay * (multiplier ^ retryCount)
 * Example with defaults: 1s -> 2s -> 4s -> 8s (capped at maxDelay)
 *
 * AC 6: Delay between retries increases exponentially (1s -> 2s -> 4s)
 *
 * @param retryCount - Current retry attempt (0-indexed, 0 = first retry)
 * @param config - Optional partial config to override defaults
 * @returns Delay in milliseconds before next retry
 */
export function calculateRetryDelay(retryCount: number, config?: Partial<RetryConfig>): number {
  const mergedConfig = { ...DEFAULT_RETRY_CONFIG, ...config }

  // Calculate exponential delay: baseDelay * (multiplier ^ retryCount)
  const delay = mergedConfig.baseDelayMs * Math.pow(mergedConfig.multiplier, retryCount)

  // Cap at maximum delay
  return Math.min(delay, mergedConfig.maxDelayMs)
}

/**
 * Calculate the retry delay, honoring Retry-After header if provided
 *
 * AC 6: Delay between retries increases exponentially (1s -> 2s -> 4s)
 * AC 4: Honor Retry-After header from rate limit responses
 *
 * @param retryCount - Current retry attempt (0-indexed)
 * @param retryAfterMs - Optional delay from Retry-After header (in ms)
 * @param config - Optional partial config to override defaults
 * @returns Delay in milliseconds before next retry
 */
export function calculateRetryDelayWithHeader(
  retryCount: number,
  retryAfterMs?: number,
  config?: Partial<RetryConfig>
): number {
  // Calculate exponential backoff delay
  const exponentialDelay = calculateRetryDelay(retryCount, config)

  // If Retry-After header provided, use the larger of the two delays
  if (retryAfterMs !== undefined && retryAfterMs > 0) {
    return Math.max(exponentialDelay, retryAfterMs)
  }

  return exponentialDelay
}

/**
 * Get the Unix timestamp (ms) for when the next retry should occur
 *
 * @param retryCount - Current retry attempt (0-indexed)
 * @param retryAfterMs - Optional delay from Retry-After header (in ms)
 * @param config - Optional partial config to override defaults
 * @returns Unix timestamp in milliseconds for next retry
 */
export function getNextRetryAt(
  retryCount: number,
  retryAfterMs?: number,
  config?: Partial<RetryConfig>
): number {
  const delay = calculateRetryDelayWithHeader(retryCount, retryAfterMs, config)
  return Date.now() + delay
}

/**
 * Check if retry attempts have been exhausted
 *
 * AC 5: Maximum retry attempts configurable (default: 3 attempts)
 *
 * @param retryCount - Current retry attempt count
 * @param maxRetries - Maximum allowed retries
 * @returns true if no more retries should be attempted
 */
export function isRetryExhausted(retryCount: number, maxRetries: number): boolean {
  return retryCount >= maxRetries
}

/**
 * Get the remaining retry attempts
 *
 * @param retryCount - Current retry attempt count
 * @param maxRetries - Maximum allowed retries
 * @returns Number of remaining retry attempts
 */
export function getRemainingRetries(retryCount: number, maxRetries: number): number {
  return Math.max(0, maxRetries - retryCount)
}

/**
 * Create a promise that resolves after the retry delay
 * Useful for implementing retry logic with async/await
 *
 * @param retryCount - Current retry attempt (0-indexed)
 * @param retryAfterMs - Optional delay from Retry-After header (in ms)
 * @param config - Optional partial config to override defaults
 * @returns Promise that resolves after the calculated delay
 */
export function waitForRetry(
  retryCount: number,
  retryAfterMs?: number,
  config?: Partial<RetryConfig>
): Promise<void> {
  const delay = calculateRetryDelayWithHeader(retryCount, retryAfterMs, config)
  return new Promise((resolve) => setTimeout(resolve, delay))
}

/**
 * Execute a function with automatic retry on failure
 *
 * @param fn - Async function to execute
 * @param shouldRetry - Function to determine if error should be retried
 * @param config - Optional partial config to override defaults
 * @returns Result of the function or throws the last error
 */
export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  shouldRetry: (error: unknown, retryCount: number) => boolean,
  config?: Partial<RetryConfig>
): Promise<T> {
  const mergedConfig = { ...DEFAULT_RETRY_CONFIG, ...config }
  let lastError: unknown

  for (let attempt = 0; attempt <= mergedConfig.maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      // Check if we should retry
      if (attempt < mergedConfig.maxRetries && shouldRetry(error, attempt)) {
        await waitForRetry(attempt, undefined, mergedConfig)
        continue
      }

      // No more retries or shouldn't retry
      throw error
    }
  }

  // Should never reach here, but TypeScript needs this
  throw lastError
}
