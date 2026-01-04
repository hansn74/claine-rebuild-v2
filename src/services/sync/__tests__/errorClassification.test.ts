import { describe, it, expect } from 'vitest'
import {
  classifyError,
  classifyHttpError,
  shouldRetry,
  getFailureStatus,
  type ClassifiedError,
} from '../errorClassification'

/**
 * Tests for Error Classification Service
 *
 * AC 8: Transient errors classified: network timeout, rate limit (429), server error (5xx)
 * AC 9: Permanent errors classified: not found (404), forbidden (403), invalid (400)
 * AC 10: Unknown errors default to transient with limited retries
 */

describe('Error Classification Service', () => {
  describe('classifyHttpError', () => {
    describe('AC 8: Transient errors', () => {
      it('should classify 429 (rate limit) as transient', () => {
        const result = classifyHttpError(429)

        expect(result.type).toBe('transient')
        expect(result.httpStatus).toBe(429)
        expect(result.message).toContain('Rate limit')
      })

      it('should classify 500 (internal server error) as transient', () => {
        const result = classifyHttpError(500)

        expect(result.type).toBe('transient')
        expect(result.httpStatus).toBe(500)
      })

      it('should classify 502 (bad gateway) as transient', () => {
        const result = classifyHttpError(502)

        expect(result.type).toBe('transient')
        expect(result.httpStatus).toBe(502)
      })

      it('should classify 503 (service unavailable) as transient', () => {
        const result = classifyHttpError(503)

        expect(result.type).toBe('transient')
        expect(result.httpStatus).toBe(503)
      })

      it('should classify 504 (gateway timeout) as transient', () => {
        const result = classifyHttpError(504)

        expect(result.type).toBe('transient')
        expect(result.httpStatus).toBe(504)
      })

      it('should classify 408 (request timeout) as transient', () => {
        const result = classifyHttpError(408)

        expect(result.type).toBe('transient')
        expect(result.httpStatus).toBe(408)
      })

      it('should extract Retry-After header in seconds', () => {
        const headers = new Headers()
        headers.set('Retry-After', '60')

        const result = classifyHttpError(429, headers)

        expect(result.type).toBe('transient')
        expect(result.retryAfterMs).toBe(60000) // 60 seconds in ms
      })
    })

    describe('AC 9: Permanent errors', () => {
      it('should classify 404 (not found) as permanent', () => {
        const result = classifyHttpError(404)

        expect(result.type).toBe('permanent')
        expect(result.httpStatus).toBe(404)
        expect(result.message).toContain('Not found')
      })

      it('should classify 403 (forbidden) as permanent', () => {
        const result = classifyHttpError(403)

        expect(result.type).toBe('permanent')
        expect(result.httpStatus).toBe(403)
        expect(result.message).toContain('Forbidden')
      })

      it('should classify 400 (bad request) as permanent', () => {
        const result = classifyHttpError(400)

        expect(result.type).toBe('permanent')
        expect(result.httpStatus).toBe(400)
      })

      it('should classify 401 (unauthorized) as permanent', () => {
        const result = classifyHttpError(401)

        expect(result.type).toBe('permanent')
        expect(result.httpStatus).toBe(401)
      })

      it('should classify 410 (gone) as permanent', () => {
        const result = classifyHttpError(410)

        expect(result.type).toBe('permanent')
        expect(result.httpStatus).toBe(410)
      })
    })

    describe('AC 10: Unknown errors', () => {
      it('should classify unknown status codes as unknown', () => {
        const result = classifyHttpError(418) // I'm a teapot

        expect(result.type).toBe('unknown')
        expect(result.httpStatus).toBe(418)
      })

      it('should classify 201 (created) as unknown', () => {
        const result = classifyHttpError(201)

        expect(result.type).toBe('unknown')
        expect(result.httpStatus).toBe(201)
      })
    })
  })

  describe('classifyError', () => {
    it('should classify network errors as transient', () => {
      const error = new TypeError('Failed to fetch')

      const result = classifyError(error)

      expect(result.type).toBe('transient')
      expect(result.message).toContain('Network error')
    })

    it('should classify errors with response objects', () => {
      const error = {
        response: {
          status: 429,
        },
      }

      const result = classifyError(error)

      expect(result.type).toBe('transient')
      expect(result.httpStatus).toBe(429)
    })

    it('should classify rate limit message errors as transient', () => {
      const error = new Error('Rate limit exceeded for API')

      const result = classifyError(error)

      expect(result.type).toBe('transient')
      expect(result.httpStatus).toBe(429)
    })

    it('should classify "not found" message errors as permanent', () => {
      const error = new Error('Resource not found')

      const result = classifyError(error)

      expect(result.type).toBe('permanent')
      expect(result.httpStatus).toBe(404)
    })

    it('should classify auth errors as permanent', () => {
      const error = new Error('Unauthorized access - token invalid')

      const result = classifyError(error)

      expect(result.type).toBe('permanent')
      expect(result.httpStatus).toBe(401)
    })

    it('should classify unknown errors as unknown', () => {
      const error = new Error('Something weird happened')

      const result = classifyError(error)

      expect(result.type).toBe('unknown')
      expect(result.message).toBe('Something weird happened')
    })

    it('should handle non-Error objects', () => {
      const error = 'String error'

      const result = classifyError(error)

      expect(result.type).toBe('unknown')
      expect(result.message).toBe('String error')
    })
  })

  describe('shouldRetry', () => {
    describe('AC 7: Permanent failures not retried', () => {
      it('should return false for permanent errors', () => {
        const classification: ClassifiedError = {
          type: 'permanent',
          httpStatus: 404,
          message: 'Not found',
        }

        const result = shouldRetry(classification, 0, 3)

        expect(result).toBe(false)
      })

      it('should return false for permanent errors even with 0 retries', () => {
        const classification: ClassifiedError = {
          type: 'permanent',
          httpStatus: 403,
          message: 'Forbidden',
        }

        const result = shouldRetry(classification, 0, 10)

        expect(result).toBe(false)
      })
    })

    it('should return true for transient errors under max retries', () => {
      const classification: ClassifiedError = {
        type: 'transient',
        httpStatus: 429,
        message: 'Rate limit',
      }

      const result = shouldRetry(classification, 1, 3)

      expect(result).toBe(true)
    })

    it('should return false for transient errors at max retries', () => {
      const classification: ClassifiedError = {
        type: 'transient',
        httpStatus: 429,
        message: 'Rate limit',
      }

      const result = shouldRetry(classification, 3, 3)

      expect(result).toBe(false)
    })

    it('should return true for unknown errors under max retries', () => {
      const classification: ClassifiedError = {
        type: 'unknown',
        message: 'Unknown error',
      }

      const result = shouldRetry(classification, 2, 3)

      expect(result).toBe(true)
    })

    it('should return false for unknown errors at max retries', () => {
      const classification: ClassifiedError = {
        type: 'unknown',
        message: 'Unknown error',
      }

      const result = shouldRetry(classification, 3, 3)

      expect(result).toBe(false)
    })
  })

  describe('getFailureStatus', () => {
    it('should return permanent for permanent errors', () => {
      const classification: ClassifiedError = {
        type: 'permanent',
        httpStatus: 404,
        message: 'Not found',
      }

      const result = getFailureStatus(classification, 0, 3)

      expect(result).toBe('permanent')
    })

    it('should return exhausted when max retries reached', () => {
      const classification: ClassifiedError = {
        type: 'transient',
        httpStatus: 429,
        message: 'Rate limit',
      }

      const result = getFailureStatus(classification, 3, 3)

      expect(result).toBe('exhausted')
    })

    it('should return pending for retryable transient errors', () => {
      const classification: ClassifiedError = {
        type: 'transient',
        httpStatus: 500,
        message: 'Server error',
      }

      const result = getFailureStatus(classification, 1, 3)

      expect(result).toBe('pending')
    })
  })
})
