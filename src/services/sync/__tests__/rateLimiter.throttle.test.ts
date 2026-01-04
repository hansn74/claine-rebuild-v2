/**
 * RateLimiter Proactive Throttling Tests
 *
 * AC 21: Unit test: Rate limit at 80% → requests throttled
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RateLimiter, type ThrottleStatus } from '../rateLimiter'

describe('RateLimiter Proactive Throttling', () => {
  describe('getCurrentUsage', () => {
    it('returns 0% when no tokens consumed', () => {
      const limiter = new RateLimiter({
        maxTokens: 100,
        refillRate: 10,
        tokensPerRequest: 1,
      })

      expect(limiter.getCurrentUsage()).toBe(0)
    })

    it('calculates usage correctly after consuming tokens', async () => {
      const limiter = new RateLimiter({
        maxTokens: 100,
        refillRate: 10,
        tokensPerRequest: 10,
      })

      // Consume 50% of tokens
      await limiter.acquire(50)

      // Use toBeCloseTo to handle floating-point precision due to token refill timing
      expect(limiter.getCurrentUsage()).toBeCloseTo(50, 0)
    })

    it('shows 100% usage when all tokens consumed', async () => {
      const limiter = new RateLimiter({
        maxTokens: 100,
        refillRate: 10,
        tokensPerRequest: 100,
      })

      await limiter.acquire(100)

      expect(limiter.getCurrentUsage()).toBe(100)
    })
  })

  describe('getThrottleStatus', () => {
    it('returns "normal" when under threshold', async () => {
      const limiter = new RateLimiter({
        maxTokens: 100,
        refillRate: 10,
        tokensPerRequest: 1,
        throttleThreshold: 80,
      })

      // Consume 50% of tokens
      await limiter.acquire(50)

      expect(limiter.getThrottleStatus()).toBe('normal')
    })

    /**
     * AC 21: Rate limit at 80% → requests throttled
     */
    it('returns "throttled" when at 80% threshold', async () => {
      const limiter = new RateLimiter({
        maxTokens: 100,
        refillRate: 10,
        tokensPerRequest: 1,
        throttleThreshold: 80,
      })

      // Consume exactly 80% of tokens
      await limiter.acquire(80)

      expect(limiter.getThrottleStatus()).toBe('throttled')
    })

    it('returns "throttled" when above 80% but below 100%', async () => {
      const limiter = new RateLimiter({
        maxTokens: 100,
        refillRate: 10,
        tokensPerRequest: 1,
        throttleThreshold: 80,
      })

      // Consume 90% of tokens
      await limiter.acquire(90)

      expect(limiter.getThrottleStatus()).toBe('throttled')
    })

    it('returns "rate-limited" when at 100%', async () => {
      const limiter = new RateLimiter({
        maxTokens: 100,
        refillRate: 10,
        tokensPerRequest: 1,
        throttleThreshold: 80,
      })

      // Consume all tokens
      await limiter.acquire(100)

      expect(limiter.getThrottleStatus()).toBe('rate-limited')
    })

    it('respects custom throttle threshold', async () => {
      const limiter = new RateLimiter({
        maxTokens: 100,
        refillRate: 10,
        tokensPerRequest: 1,
        throttleThreshold: 50, // Custom threshold
      })

      // Consume 50% of tokens
      await limiter.acquire(50)

      expect(limiter.getThrottleStatus()).toBe('throttled')
    })
  })

  describe('acquireWithThrottling', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('does not delay requests when under threshold', async () => {
      const limiter = new RateLimiter({
        maxTokens: 100,
        refillRate: 10,
        tokensPerRequest: 1,
        throttleThreshold: 80,
      })

      // Start with full bucket (0% usage)
      const resultPromise = limiter.acquireWithThrottling(10)
      await vi.runAllTimersAsync()
      const result = await resultPromise

      expect(result.delayed).toBe(false)
      expect(result.delayMs).toBe(0)
    })

    it('delays requests when at threshold', async () => {
      const limiter = new RateLimiter({
        maxTokens: 100,
        refillRate: 10,
        tokensPerRequest: 1,
        throttleThreshold: 80,
      })

      // Consume to 80% usage
      await limiter.acquire(80)

      // Now acquire with throttling
      const resultPromise = limiter.acquireWithThrottling(5)

      // Advance timers to allow throttle delay
      await vi.runAllTimersAsync()

      const result = await resultPromise

      // Should have added some delay
      expect(result.delayed).toBe(true)
      expect(result.delayMs).toBeGreaterThan(0)
    })

    it('applies progressive delay based on usage level', async () => {
      // Test at exactly threshold
      const limiter1 = new RateLimiter({
        maxTokens: 100,
        refillRate: 100,
        tokensPerRequest: 1,
        throttleThreshold: 80,
      })
      await limiter1.acquire(80)
      const resultPromise1 = limiter1.acquireWithThrottling(1)
      await vi.runAllTimersAsync()
      const result1 = await resultPromise1

      // Test at higher usage
      const limiter2 = new RateLimiter({
        maxTokens: 100,
        refillRate: 100,
        tokensPerRequest: 1,
        throttleThreshold: 80,
      })
      await limiter2.acquire(95)
      const resultPromise2 = limiter2.acquireWithThrottling(1)
      await vi.runAllTimersAsync()
      const result2 = await resultPromise2

      // Higher usage should have longer delay
      expect(result2.delayMs).toBeGreaterThan(result1.delayMs)
    })
  })

  describe('onThrottleChange callback', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    /**
     * AC 10.10: Test onThrottleChange callback fired
     */
    it('fires callback when status changes', async () => {
      const limiter = new RateLimiter({
        maxTokens: 100,
        refillRate: 10,
        tokensPerRequest: 1,
        throttleThreshold: 80,
      })

      const callback = vi.fn()
      limiter.onThrottleChange(callback)

      // Initial callback with current status
      expect(callback).toHaveBeenCalledWith('normal', 0)

      // Trigger status change by consuming tokens
      await limiter.acquire(80)
      const throttlePromise = limiter.acquireWithThrottling(1) // This triggers status check
      await vi.runAllTimersAsync()
      await throttlePromise

      // Should have been called again with 'throttled'
      expect(callback).toHaveBeenCalledWith('throttled', expect.any(Number))
    })

    it('provides current usage percentage in callback', async () => {
      const limiter = new RateLimiter({
        maxTokens: 100,
        refillRate: 10,
        tokensPerRequest: 1,
        throttleThreshold: 80,
      })

      let reportedUsage: number = 0
      limiter.onThrottleChange((_status, usage) => {
        reportedUsage = usage
      })

      await limiter.acquire(85)
      const throttlePromise = limiter.acquireWithThrottling(1)
      await vi.runAllTimersAsync()
      await throttlePromise

      expect(reportedUsage).toBeGreaterThanOrEqual(80)
    })

    it('can be unset by passing null', async () => {
      const limiter = new RateLimiter({
        maxTokens: 100,
        refillRate: 10,
        tokensPerRequest: 1,
        throttleThreshold: 80,
      })

      const callback = vi.fn()
      limiter.onThrottleChange(callback)
      limiter.onThrottleChange(null)

      callback.mockClear()

      await limiter.acquire(85)
      const throttlePromise = limiter.acquireWithThrottling(1)
      await vi.runAllTimersAsync()
      await throttlePromise

      expect(callback).not.toHaveBeenCalled()
    })

    it('only fires on actual status transitions', async () => {
      const limiter = new RateLimiter({
        maxTokens: 100,
        refillRate: 10,
        tokensPerRequest: 1,
        throttleThreshold: 80,
      })

      const callback = vi.fn()
      limiter.onThrottleChange(callback)

      // Initial call
      expect(callback).toHaveBeenCalledTimes(1)

      // Multiple acquires while in same status
      const p1 = limiter.acquireWithThrottling(10)
      await vi.runAllTimersAsync()
      await p1

      const p2 = limiter.acquireWithThrottling(10)
      await vi.runAllTimersAsync()
      await p2

      const p3 = limiter.acquireWithThrottling(10)
      await vi.runAllTimersAsync()
      await p3

      // Should only have initial call (still in 'normal' status)
      expect(callback).toHaveBeenCalledTimes(1)
    })
  })

  describe('status transitions', () => {
    it('transitions from normal to throttled to rate-limited', async () => {
      // Using a very low refill rate to prevent significant refill during test
      const limiter = new RateLimiter({
        maxTokens: 100,
        refillRate: 0.001, // Very slow refill: 0.001 tokens/second
        tokensPerRequest: 1,
        throttleThreshold: 80,
      })

      const statuses: ThrottleStatus[] = []
      limiter.onThrottleChange((status) => {
        if (statuses[statuses.length - 1] !== status) {
          statuses.push(status)
        }
      })

      // Start at normal (initial callback fired immediately)
      expect(limiter.getThrottleStatus()).toBe('normal')
      expect(statuses).toContain('normal')

      // Move to throttled by consuming 80% of tokens
      await limiter.acquire(80)
      expect(limiter.getThrottleStatus()).toBe('throttled')

      // Move to rate-limited by consuming remaining tokens
      await limiter.acquire(20)
      expect(limiter.getThrottleStatus()).toBe('rate-limited')

      // Verify status transitions are detected by getThrottleStatus()
      // Note: The callback only fires from acquireWithThrottling(),
      // so we test the state transitions directly
      expect(limiter.getThrottleStatus()).toBe('rate-limited')
    })

    it('tracks status changes through callback when using acquireWithThrottling', async () => {
      vi.useFakeTimers()

      const limiter = new RateLimiter({
        maxTokens: 100,
        refillRate: 1000, // High refill rate so test is fast
        tokensPerRequest: 1,
        throttleThreshold: 80,
      })

      const statuses: ThrottleStatus[] = []
      limiter.onThrottleChange((status) => {
        if (statuses[statuses.length - 1] !== status) {
          statuses.push(status)
        }
      })

      // Initial status is normal
      expect(statuses).toEqual(['normal'])

      // Consume 85 tokens to reach throttled state
      await limiter.acquire(85)

      // Now call acquireWithThrottling to trigger status check
      const p1 = limiter.acquireWithThrottling(1)
      await vi.runAllTimersAsync()
      await p1

      // Should have recorded the throttled state
      expect(statuses).toContain('throttled')

      vi.useRealTimers()
    })
  })

  describe('getMaxTokens and getRefillRate', () => {
    it('returns configured max tokens', () => {
      const limiter = new RateLimiter({
        maxTokens: 250,
        refillRate: 100,
        tokensPerRequest: 5,
      })

      expect(limiter.getMaxTokens()).toBe(250)
    })

    it('returns configured refill rate', () => {
      const limiter = new RateLimiter({
        maxTokens: 250,
        refillRate: 100,
        tokensPerRequest: 5,
      })

      expect(limiter.getRefillRate()).toBe(100)
    })
  })
})
