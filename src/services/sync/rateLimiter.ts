/**
 * Token Bucket Rate Limiter
 * Implements token bucket algorithm for API rate limiting
 *
 * Algorithm:
 * 1. Bucket starts with max tokens
 * 2. Tokens are consumed when making requests
 * 3. Tokens are refilled at a constant rate
 * 4. If bucket is empty, requests must wait
 *
 * Use Cases:
 * - Gmail API: 250 quota units/second (1 message.get = 5 units, 1 batch = 25 units)
 * - Microsoft Graph: 10 requests/second
 */

/**
 * Rate limiter configuration
 */
export interface RateLimiterConfig {
  maxTokens: number // Maximum tokens in bucket
  refillRate: number // Tokens added per second
  tokensPerRequest: number // Tokens consumed per request (default 1)
  throttleThreshold?: number // Percentage (0-100) to start proactive throttling (default 80)
}

/**
 * Throttle status for UI display
 * AC 12: API calls throttled proactively when approaching 80% of rate limit
 */
export type ThrottleStatus = 'normal' | 'throttled' | 'rate-limited'

/**
 * Throttle change callback type
 */
export type OnThrottleChangeCallback = (status: ThrottleStatus, usagePercent: number) => void

/**
 * Token bucket rate limiter with proactive throttling
 *
 * AC 11: Gmail API quota tracked
 * AC 12: API calls throttled proactively when approaching 80% of rate limit
 * AC 13: Rate limit queue delays requests when limit approaching
 */
export class RateLimiter {
  private tokens: number
  private lastRefill: number
  private readonly config: RateLimiterConfig
  private readonly throttleThreshold: number
  private previousStatus: ThrottleStatus = 'normal'
  private onThrottleChangeCallback: OnThrottleChangeCallback | null = null

  constructor(config: RateLimiterConfig) {
    this.config = config
    this.tokens = config.maxTokens
    this.lastRefill = Date.now()
    this.throttleThreshold = config.throttleThreshold ?? 80
  }

  /**
   * Attempts to acquire tokens for a request
   * If insufficient tokens, returns time to wait in milliseconds
   *
   * @param tokensNeeded - Number of tokens to acquire (default: 1)
   * @returns 0 if tokens acquired, or milliseconds to wait if rate limited
   */
  async acquire(tokensNeeded: number = this.config.tokensPerRequest): Promise<number> {
    this.refillTokens()

    if (this.tokens >= tokensNeeded) {
      this.tokens -= tokensNeeded
      return 0 // No wait needed
    }

    // Calculate wait time based on refill rate
    const tokensShort = tokensNeeded - this.tokens
    const waitMs = Math.ceil((tokensShort / this.config.refillRate) * 1000)
    return waitMs
  }

  /**
   * Waits until tokens are available, then acquires them
   * Automatically handles waiting based on refill rate
   *
   * @param tokensNeeded - Number of tokens to acquire
   * @returns Promise that resolves when tokens are acquired
   */
  async acquireAndWait(tokensNeeded: number = this.config.tokensPerRequest): Promise<void> {
    const waitMs = await this.acquire(tokensNeeded)
    if (waitMs > 0) {
      await this.sleep(waitMs)
      // After waiting, try again (tokens should be refilled)
      await this.acquireAndWait(tokensNeeded)
    }
  }

  /**
   * Refills tokens based on time elapsed since last refill
   * Implements constant-rate token replenishment
   */
  private refillTokens(): void {
    const now = Date.now()
    const elapsedSeconds = (now - this.lastRefill) / 1000

    const tokensToAdd = elapsedSeconds * this.config.refillRate
    this.tokens = Math.min(this.tokens + tokensToAdd, this.config.maxTokens)

    this.lastRefill = now
  }

  /**
   * Gets current token count (for debugging/monitoring)
   */
  getAvailableTokens(): number {
    this.refillTokens()
    return Math.floor(this.tokens)
  }

  /**
   * Resets the rate limiter to initial state
   */
  reset(): void {
    this.tokens = this.config.maxTokens
    this.lastRefill = Date.now()
  }

  /**
   * Utility sleep function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Get current usage percentage (tokens consumed as % of max)
   *
   * AC 11: Gmail API quota tracked
   *
   * @returns Usage percentage 0-100 (100 = all tokens consumed)
   */
  getCurrentUsage(): number {
    this.refillTokens()
    // Usage is inverse of available tokens
    const available = this.tokens / this.config.maxTokens
    const usage = (1 - available) * 100
    return Math.round(usage * 100) / 100 // Round to 2 decimal places
  }

  /**
   * Get throttle status based on current usage
   *
   * AC 12: API calls throttled proactively when approaching 80% of rate limit
   *
   * @returns Current throttle status
   */
  getThrottleStatus(): ThrottleStatus {
    const usage = this.getCurrentUsage()

    if (usage >= 100) {
      return 'rate-limited'
    }

    if (usage >= this.throttleThreshold) {
      return 'throttled'
    }

    return 'normal'
  }

  /**
   * Acquire tokens with proactive throttling
   * Adds artificial delay when approaching threshold to prevent hitting hard limit
   *
   * AC 12: API calls throttled proactively when approaching 80% of rate limit
   * AC 13: Rate limit queue delays requests when limit approaching
   *
   * @param tokensNeeded - Number of tokens to acquire
   * @returns Promise that resolves with delay applied if needed
   */
  async acquireWithThrottling(
    tokensNeeded: number = this.config.tokensPerRequest
  ): Promise<{ delayed: boolean; delayMs: number }> {
    const status = this.getThrottleStatus()
    let delayMs = 0

    // Check for status change and notify
    this.checkAndNotifyStatusChange()

    // Apply proactive throttling when approaching threshold
    if (status === 'throttled') {
      // Add progressive delay based on how close to limit
      const usage = this.getCurrentUsage()
      const overThreshold = usage - this.throttleThreshold
      const maxOverThreshold = 100 - this.throttleThreshold

      // Scale delay from 50ms to 500ms based on how far over threshold
      const delayScale = overThreshold / maxOverThreshold
      delayMs = Math.ceil(50 + delayScale * 450)

      await this.sleep(delayMs)
    }

    // Now acquire tokens normally
    const waitMs = await this.acquire(tokensNeeded)

    if (waitMs > 0) {
      await this.sleep(waitMs)
      delayMs += waitMs
    }

    return { delayed: delayMs > 0, delayMs }
  }

  /**
   * Set callback for throttle status changes
   *
   * AC 8.4: Add onThrottleChange callback for UI notification
   *
   * @param callback - Function to call when status changes
   */
  onThrottleChange(callback: OnThrottleChangeCallback | null): void {
    this.onThrottleChangeCallback = callback

    // Immediately notify of current status if callback is set
    if (callback) {
      const status = this.getThrottleStatus()
      const usage = this.getCurrentUsage()
      callback(status, usage)
    }
  }

  /**
   * Check for status change and notify callback
   */
  private checkAndNotifyStatusChange(): void {
    const currentStatus = this.getThrottleStatus()

    if (currentStatus !== this.previousStatus) {
      this.previousStatus = currentStatus

      if (this.onThrottleChangeCallback) {
        const usage = this.getCurrentUsage()
        this.onThrottleChangeCallback(currentStatus, usage)
      }
    }
  }

  /**
   * Get the max tokens configuration
   */
  getMaxTokens(): number {
    return this.config.maxTokens
  }

  /**
   * Get the refill rate configuration
   */
  getRefillRate(): number {
    return this.config.refillRate
  }
}

/**
 * Pre-configured rate limiters for common APIs
 */

/**
 * Gmail API Rate Limiter
 * Limit: 250 quota units/second per user
 * Note: 1 message.get = 5 units, 1 batch request = 25 units
 */
export const createGmailRateLimiter = (): RateLimiter => {
  return new RateLimiter({
    maxTokens: 250,
    refillRate: 250, // 250 tokens per second
    tokensPerRequest: 5, // Default: 1 message.get = 5 units
  })
}

/**
 * Microsoft Graph Rate Limiter
 * Limit: 10 requests/second (tenant-level throttling)
 */
export const createOutlookRateLimiter = (): RateLimiter => {
  return new RateLimiter({
    maxTokens: 10,
    refillRate: 10, // 10 tokens per second
    tokensPerRequest: 1, // 1 token per request
  })
}
