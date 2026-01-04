/**
 * PII Sanitizer Tests
 * @logging
 */

import { describe, it, expect } from 'vitest'
import { sanitizeForLogging, containsPII } from '../sanitizer'

describe('sanitizeForLogging @logging', () => {
  describe('string sanitization', () => {
    it('should mask email addresses', () => {
      const input = 'Contact user@example.com for support'
      const result = sanitizeForLogging(input)
      expect(result).toBe('Contact [EMAIL_REDACTED] for support')
    })

    it('should mask multiple email addresses', () => {
      const input = 'From: sender@gmail.com, To: receiver@outlook.com'
      const result = sanitizeForLogging(input)
      expect(result).toBe('From: [EMAIL_REDACTED], To: [EMAIL_REDACTED]')
    })

    it('should mask Bearer tokens', () => {
      const input =
        'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U'
      const result = sanitizeForLogging(input)
      expect(result).toBe('Bearer [TOKEN_REDACTED]')
    })

    it('should mask access_token values', () => {
      const input = 'access_token=ya29.a0AfH6SMBx...'
      const result = sanitizeForLogging(input)
      expect(result).toBe('access_token=[REDACTED]')
    })

    it('should mask refresh_token values', () => {
      const input = 'refresh_token=1//0gXyz123...'
      const result = sanitizeForLogging(input)
      expect(result).toBe('refresh_token=[REDACTED]')
    })

    it('should handle strings with no PII', () => {
      const input = 'Simple log message'
      const result = sanitizeForLogging(input)
      expect(result).toBe('Simple log message')
    })
  })

  describe('object sanitization', () => {
    it('should redact sensitive field names', () => {
      const input = {
        username: 'john',
        password: 'secret123',
        token: 'abc123',
      }
      const result = sanitizeForLogging(input)
      expect(result).toEqual({
        username: 'john',
        password: '[REDACTED]',
        token: '[REDACTED]',
      })
    })

    it('should redact accessToken and refreshToken', () => {
      const input = {
        accessToken: 'ya29.xxx',
        refreshToken: '1//0gxxx',
        userId: '123',
      }
      const result = sanitizeForLogging(input)
      expect(result).toEqual({
        accessToken: '[REDACTED]',
        refreshToken: '[REDACTED]',
        userId: '123',
      })
    })

    it('should redact body and content fields', () => {
      const input = {
        subject: 'Test Email',
        body: 'Email body with sensitive info',
        content: 'More content',
      }
      const result = sanitizeForLogging(input)
      expect(result).toEqual({
        subject: 'Test Email',
        body: '[REDACTED]',
        content: '[REDACTED]',
      })
    })

    it('should redact secret and apiKey fields', () => {
      const input = {
        apiKey: 'sk-xxx123',
        clientSecret: 'secret123',
        name: 'Test',
      }
      const result = sanitizeForLogging(input)
      expect(result).toEqual({
        apiKey: '[REDACTED]',
        clientSecret: '[REDACTED]',
        name: 'Test',
      })
    })

    it('should recursively sanitize nested objects', () => {
      const input = {
        user: {
          email: 'user@example.com',
          password: 'secret',
        },
        data: {
          message: 'Contact admin@test.com',
        },
      }
      const result = sanitizeForLogging(input) as Record<string, unknown>
      expect((result.user as Record<string, unknown>).email).toBe('[EMAIL_REDACTED]')
      expect((result.user as Record<string, unknown>).password).toBe('[REDACTED]')
      expect((result.data as Record<string, unknown>).message).toBe('Contact [EMAIL_REDACTED]')
    })

    it('should handle null and undefined values', () => {
      expect(sanitizeForLogging(null)).toBeNull()
      expect(sanitizeForLogging(undefined)).toBeUndefined()
    })

    it('should handle primitive types', () => {
      expect(sanitizeForLogging(123)).toBe(123)
      expect(sanitizeForLogging(true)).toBe(true)
      expect(sanitizeForLogging(false)).toBe(false)
    })
  })

  describe('array sanitization', () => {
    it('should sanitize arrays of strings', () => {
      const input = ['user@example.com', 'normal text', 'admin@test.com']
      const result = sanitizeForLogging(input)
      expect(result).toEqual(['[EMAIL_REDACTED]', 'normal text', '[EMAIL_REDACTED]'])
    })

    it('should sanitize arrays of objects', () => {
      const input = [
        { email: 'a@b.com', password: '123' },
        { email: 'c@d.com', password: '456' },
      ]
      const result = sanitizeForLogging(input)
      expect(result).toEqual([
        { email: '[EMAIL_REDACTED]', password: '[REDACTED]' },
        { email: '[EMAIL_REDACTED]', password: '[REDACTED]' },
      ])
    })
  })

  describe('field name matching', () => {
    it('should match case-insensitive sensitive fields', () => {
      const input = {
        PASSWORD: 'secret',
        Token: 'abc',
        AccessToken: 'xyz',
      }
      const result = sanitizeForLogging(input)
      expect(result).toEqual({
        PASSWORD: '[REDACTED]',
        Token: '[REDACTED]',
        AccessToken: '[REDACTED]',
      })
    })

    it('should match fields containing credential keywords', () => {
      const input = {
        userCredential: 'secret',
        authToken: 'abc123',
        myPassword123: 'xyz',
      }
      const result = sanitizeForLogging(input)
      expect(result).toEqual({
        userCredential: '[REDACTED]',
        authToken: '[REDACTED]',
        myPassword123: '[REDACTED]',
      })
    })
  })
})

describe('containsPII @logging', () => {
  it('should detect email addresses in strings', () => {
    expect(containsPII('user@example.com')).toBe(true)
    expect(containsPII('no email here')).toBe(false)
  })

  it('should detect Bearer tokens', () => {
    expect(containsPII('Bearer eyJhbGciOiJIUzI1NiJ9.test.sig')).toBe(true)
  })

  it('should detect sensitive fields in objects', () => {
    expect(containsPII({ password: '123' })).toBe(true)
    expect(containsPII({ username: 'john' })).toBe(false)
    expect(containsPII({ token: 'abc' })).toBe(true)
  })

  it('should return false for non-PII values', () => {
    expect(containsPII('normal text')).toBe(false)
    expect(containsPII(123)).toBe(false)
    expect(containsPII({ count: 5 })).toBe(false)
  })
})
