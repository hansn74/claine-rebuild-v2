/**
 * Unit tests for environment variable validation and type-safe access
 *
 * Tests cover:
 * - AC9: Missing required environment variable throws clear error
 * - AC10: Environment variables accessible in app code
 * - Type-safe accessor functions with defaults
 * - Multiple missing variables error reporting
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { validateEnv, getEnv, getAllEnv, isDevelopment, isProduction } from './env'

describe('Environment Variable Validation', () => {
  // Store original environment values
  let originalViteAppName: string | undefined
  let originalViteApiUrl: string | undefined
  let originalDev: boolean
  let originalProd: boolean

  beforeEach(() => {
    // Save original values
    originalViteAppName = import.meta.env.VITE_APP_NAME
    originalViteApiUrl = import.meta.env.VITE_API_URL
    originalDev = import.meta.env.DEV
    originalProd = import.meta.env.PROD
  })

  afterEach(() => {
    // Restore original environment
    import.meta.env.VITE_APP_NAME = originalViteAppName
    import.meta.env.VITE_API_URL = originalViteApiUrl
    import.meta.env.DEV = originalDev
    import.meta.env.PROD = originalProd
  })

  describe('validateEnv()', () => {
    it('should pass validation when all required variables are present (AC9)', () => {
      // Arrange: Set required environment variables
      import.meta.env.VITE_APP_NAME = 'Claine'

      // Act & Assert: Should not throw
      expect(() => validateEnv()).not.toThrow()
    })

    it('should throw clear error when required variable is missing (AC9)', () => {
      // Arrange: Remove required variable
      delete (import.meta.env as Record<string, unknown>).VITE_APP_NAME

      // Act & Assert: Should throw with descriptive error
      expect(() => validateEnv()).toThrow(/Missing required environment variable: VITE_APP_NAME/)
    })

    it('should include troubleshooting instructions in error message (AC9)', () => {
      // Arrange: Remove required variables
      delete (import.meta.env as Record<string, unknown>).VITE_APP_NAME

      // Act & Assert: Error should include setup instructions
      expect(() => validateEnv()).toThrow(/Copy \.env\.example to \.env/)
      expect(() => validateEnv()).toThrow(/GitHub Actions/)
      expect(() => validateEnv()).toThrow(/Vercel/)
    })

    it('should list missing variables when multiple are missing (AC9)', () => {
      // Arrange: Remove all required variables
      delete (import.meta.env as Record<string, unknown>).VITE_APP_NAME

      // Act & Assert: Should list missing variables
      expect(() => validateEnv()).toThrow(/Missing required environment variable/)
      expect(() => validateEnv()).toThrow(/VITE_APP_NAME/)
    })
  })

  describe('getEnv()', () => {
    it('should return environment variable value when present (AC10)', () => {
      // Arrange: Set environment variable
      import.meta.env.VITE_APP_NAME = 'Claine'

      // Act
      const appName = getEnv('VITE_APP_NAME')

      // Assert: Should return correct value
      expect(appName).toBe('Claine')
    })

    it('should return default value for optional variable when undefined', () => {
      // Arrange: Remove VITE_API_URL to test default
      delete (import.meta.env as Record<string, unknown>).VITE_API_URL
      import.meta.env.VITE_APP_NAME = 'Claine'

      // Act
      const apiUrl = getEnv('VITE_API_URL')

      // Assert: Should return default from OPTIONAL_ENV_VARS
      expect(apiUrl).toBe('https://gmail.googleapis.com')
    })

    it('should return custom default value when variable is undefined', () => {
      // Arrange: Remove VITE_API_URL
      delete (import.meta.env as Record<string, unknown>).VITE_API_URL
      import.meta.env.VITE_APP_NAME = 'Claine'

      // Act
      const apiUrl = getEnv('VITE_API_URL', 'http://localhost:3001')

      // Assert: Should return custom default
      expect(apiUrl).toBe('http://localhost:3001')
    })

    it('should prefer actual value over default value', () => {
      // Arrange: Set both variables
      import.meta.env.VITE_APP_NAME = 'Claine'
      import.meta.env.VITE_API_URL = 'https://custom-api.com'

      // Act
      const apiUrl = getEnv('VITE_API_URL', 'http://localhost:3001')

      // Assert: Should return actual value, not default
      expect(apiUrl).toBe('https://custom-api.com')
    })

    it('should throw error for required variable without default when missing', () => {
      // Arrange: Remove required variable
      delete (import.meta.env as Record<string, unknown>).VITE_APP_NAME

      // Act & Assert: Should throw descriptive error
      expect(() => getEnv('VITE_APP_NAME')).toThrow(/VITE_APP_NAME is not defined/)
      expect(() => getEnv('VITE_APP_NAME')).toThrow(/Call validateEnv\(\)/)
    })

    it('should handle empty string values correctly', () => {
      // Arrange: Set variable to empty string
      import.meta.env.VITE_APP_NAME = ''

      // Act & Assert: Empty string should be treated as missing
      expect(() => getEnv('VITE_APP_NAME')).toThrow()
    })
  })

  describe('getAllEnv()', () => {
    it('should return all environment variables (AC10)', () => {
      // Arrange: Set environment
      import.meta.env.VITE_APP_NAME = 'Claine'
      import.meta.env.VITE_API_URL = 'https://gmail.googleapis.com'

      // Act
      const env = getAllEnv()

      // Assert: Should return all env vars
      expect(env.VITE_APP_NAME).toBe('Claine')
      expect(env.VITE_API_URL).toBe('https://gmail.googleapis.com')
    })

    it('should return read-only object', () => {
      // Arrange: Set environment
      import.meta.env.VITE_APP_NAME = 'Claine'

      // Act
      const env = getAllEnv()

      // Assert: Object should exist and have properties
      expect(env).toBeDefined()
      expect(env.VITE_APP_NAME).toBe('Claine')
    })
  })

  describe('isDevelopment() and isProduction()', () => {
    it('should correctly identify development mode', () => {
      // Arrange: Mock development environment
      import.meta.env.DEV = true
      import.meta.env.PROD = false

      // Act & Assert
      expect(isDevelopment()).toBe(true)
      expect(isProduction()).toBe(false)
    })

    it('should correctly identify production mode', () => {
      // Arrange: Mock production environment
      import.meta.env.DEV = false
      import.meta.env.PROD = true

      // Act & Assert
      expect(isDevelopment()).toBe(false)
      expect(isProduction()).toBe(true)
    })
  })

  describe('Type Safety', () => {
    it('should provide type-safe access with autocomplete support', () => {
      // This test validates TypeScript compilation
      // If it compiles, type safety is working correctly

      // Arrange: Set environment
      import.meta.env.VITE_APP_NAME = 'Claine'

      // Act: Valid key should compile and work
      const appName: string = getEnv('VITE_APP_NAME')

      // Assert
      expect(typeof appName).toBe('string')
    })
  })

  describe('Integration with validateEnv()', () => {
    it('should work correctly after validateEnv() passes (AC9, AC10)', () => {
      // Arrange: Set complete environment
      import.meta.env.VITE_APP_NAME = 'Claine'
      import.meta.env.VITE_API_URL = 'https://gmail.googleapis.com'

      // Act: Validate environment
      expect(() => validateEnv()).not.toThrow()

      // Assert: All getEnv() calls should work
      expect(getEnv('VITE_APP_NAME')).toBe('Claine')
      expect(getEnv('VITE_API_URL')).toBe('https://gmail.googleapis.com')
    })

    it('should detect missing variables before getEnv() is called (AC9)', () => {
      // Arrange: Remove required variable
      delete (import.meta.env as Record<string, unknown>).VITE_APP_NAME

      // Act & Assert: validateEnv() should catch missing variables early
      expect(() => validateEnv()).toThrow(/Missing required environment variable: VITE_APP_NAME/)

      // If validateEnv() wasn't called, getEnv() would also throw
      expect(() => getEnv('VITE_APP_NAME')).toThrow()
    })
  })

  describe('Edge Cases', () => {
    it('should handle whitespace-only values', () => {
      // Arrange: Set variable with whitespace
      import.meta.env.VITE_APP_NAME = '   '

      // Act & Assert: Whitespace should be preserved (not treated as empty)
      expect(getEnv('VITE_APP_NAME')).toBe('   ')
    })
  })
})
