import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  calculateRetryDelay,
  calculateRetryDelayWithHeader,
  getNextRetryAt,
  isRetryExhausted,
  getRemainingRetries,
  waitForRetry,
  executeWithRetry,
  DEFAULT_RETRY_CONFIG,
  type RetryConfig,
} from '../retryEngine'

/**
 * Tests for Retry Engine
 *
 * AC 4: Exponential backoff retry for transient failures
 * AC 5: Maximum retry attempts configurable (default: 3 attempts)
 * AC 6: Delay between retries increases exponentially (1s -> 2s -> 4s)
 */

describe('Retry Engine', () => {
  describe('DEFAULT_RETRY_CONFIG', () => {
    it('should have default maxRetries of 3', () => {
      expect(DEFAULT_RETRY_CONFIG.maxRetries).toBe(3)
    })

    it('should have default baseDelayMs of 1000', () => {
      expect(DEFAULT_RETRY_CONFIG.baseDelayMs).toBe(1000)
    })

    it('should have default multiplier of 2', () => {
      expect(DEFAULT_RETRY_CONFIG.multiplier).toBe(2)
    })

    it('should have default maxDelayMs of 30000', () => {
      expect(DEFAULT_RETRY_CONFIG.maxDelayMs).toBe(30000)
    })
  })

  describe('calculateRetryDelay', () => {
    describe('AC 6: Exponential backoff', () => {
      it('should return 1000ms for retry count 0', () => {
        const delay = calculateRetryDelay(0)

        expect(delay).toBe(1000) // 1s
      })

      it('should return 2000ms for retry count 1', () => {
        const delay = calculateRetryDelay(1)

        expect(delay).toBe(2000) // 2s
      })

      it('should return 4000ms for retry count 2', () => {
        const delay = calculateRetryDelay(2)

        expect(delay).toBe(4000) // 4s
      })

      it('should return 8000ms for retry count 3', () => {
        const delay = calculateRetryDelay(3)

        expect(delay).toBe(8000) // 8s
      })

      it('should cap at maxDelayMs', () => {
        const delay = calculateRetryDelay(10) // Would be 1024s without cap

        expect(delay).toBe(30000) // Capped at 30s
      })
    })

    it('should use custom config', () => {
      const config: Partial<RetryConfig> = {
        baseDelayMs: 500,
        multiplier: 3,
      }

      const delay = calculateRetryDelay(1, config)

      expect(delay).toBe(1500) // 500 * 3^1 = 1500
    })
  })

  describe('calculateRetryDelayWithHeader', () => {
    it('should use exponential backoff when no Retry-After header', () => {
      const delay = calculateRetryDelayWithHeader(1)

      expect(delay).toBe(2000) // Normal exponential backoff
    })

    it('should honor Retry-After header when larger than backoff', () => {
      const delay = calculateRetryDelayWithHeader(0, 5000) // 5s Retry-After

      expect(delay).toBe(5000) // Retry-After wins
    })

    it('should use exponential backoff when larger than Retry-After', () => {
      const delay = calculateRetryDelayWithHeader(2, 1000) // 1s Retry-After

      expect(delay).toBe(4000) // Exponential backoff wins (4s > 1s)
    })

    it('should ignore zero Retry-After', () => {
      const delay = calculateRetryDelayWithHeader(1, 0)

      expect(delay).toBe(2000) // Normal backoff
    })
  })

  describe('getNextRetryAt', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should return timestamp in future', () => {
      const now = Date.now()
      const nextRetry = getNextRetryAt(0)

      expect(nextRetry).toBe(now + 1000) // 1s from now
    })

    it('should include Retry-After in calculation', () => {
      const now = Date.now()
      const nextRetry = getNextRetryAt(0, 5000)

      expect(nextRetry).toBe(now + 5000) // 5s from now (Retry-After wins)
    })
  })

  describe('isRetryExhausted', () => {
    describe('AC 5: Maximum retry attempts', () => {
      it('should return false when under max retries', () => {
        expect(isRetryExhausted(0, 3)).toBe(false)
        expect(isRetryExhausted(1, 3)).toBe(false)
        expect(isRetryExhausted(2, 3)).toBe(false)
      })

      it('should return true when at max retries', () => {
        expect(isRetryExhausted(3, 3)).toBe(true)
      })

      it('should return true when over max retries', () => {
        expect(isRetryExhausted(5, 3)).toBe(true)
      })
    })
  })

  describe('getRemainingRetries', () => {
    it('should return correct remaining count', () => {
      expect(getRemainingRetries(0, 3)).toBe(3)
      expect(getRemainingRetries(1, 3)).toBe(2)
      expect(getRemainingRetries(2, 3)).toBe(1)
      expect(getRemainingRetries(3, 3)).toBe(0)
    })

    it('should not return negative', () => {
      expect(getRemainingRetries(5, 3)).toBe(0)
    })
  })

  describe('waitForRetry', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should resolve after delay', async () => {
      const promise = waitForRetry(0)

      // Fast-forward time
      await vi.advanceTimersByTimeAsync(1000)

      await expect(promise).resolves.toBeUndefined()
    })

    it('should use exponential delay', async () => {
      const promise = waitForRetry(2) // 4s delay

      // Advance 4 seconds
      await vi.advanceTimersByTimeAsync(4000)

      await expect(promise).resolves.toBeUndefined()
    })
  })

  describe('executeWithRetry', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should return result on first success', async () => {
      const fn = vi.fn().mockResolvedValue('success')

      const result = await executeWithRetry(fn, () => true)

      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should retry on failure when shouldRetry returns true', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValue('success')

      const promise = executeWithRetry(fn, () => true)

      // Wait for first retry
      await vi.advanceTimersByTimeAsync(1000)
      // Wait for second retry
      await vi.advanceTimersByTimeAsync(2000)

      const result = await promise

      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(3)
    })

    it('should throw immediately when shouldRetry returns false', async () => {
      const error = new Error('permanent error')
      const fn = vi.fn().mockRejectedValue(error)

      await expect(executeWithRetry(fn, () => false)).rejects.toThrow('permanent error')
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should throw after max retries', async () => {
      const error = new Error('transient error')
      const fn = vi.fn().mockRejectedValue(error)

      const promise = executeWithRetry(fn, () => true, { maxRetries: 2 })

      // Set up the rejection assertion BEFORE advancing timers to catch the rejection
      const assertionPromise = expect(promise).rejects.toThrow('transient error')

      // Use runAllTimersAsync to handle all timer callbacks
      await vi.runAllTimersAsync()

      await assertionPromise
      expect(fn).toHaveBeenCalledTimes(3) // Initial + 2 retries
    })

    it('should respect custom config', async () => {
      const fn = vi.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValue('success')

      const config: Partial<RetryConfig> = {
        baseDelayMs: 500,
      }

      const promise = executeWithRetry(fn, () => true, config)

      // Wait with custom delay
      await vi.advanceTimersByTimeAsync(500)

      const result = await promise

      expect(result).toBe('success')
    })
  })
})
