/* eslint-disable no-console */
/**
 * Logger Service Tests
 * @logging
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock logStore to avoid IndexedDB issues in tests
vi.mock('../logStore', () => ({
  logStore: {
    addEntry: vi.fn().mockResolvedValue(undefined),
  },
}))

// Mock sanitizer
vi.mock('../sanitizer', () => ({
  sanitizeForLogging: vi.fn((obj) => obj),
}))

describe('Logger @logging', () => {
  // Store original console methods
  const originalConsole = {
    debug: console.debug,
    info: console.info,
    warn: console.warn,
    error: console.error,
  }

  beforeEach(() => {
    // Mock console methods
    console.debug = vi.fn()
    console.info = vi.fn()
    console.warn = vi.fn()
    console.error = vi.fn()

    // Reset modules to get fresh logger instance
    vi.resetModules()
  })

  afterEach(() => {
    // Restore console methods
    console.debug = originalConsole.debug
    console.info = originalConsole.info
    console.warn = originalConsole.warn
    console.error = originalConsole.error
  })

  describe('log level filtering', () => {
    it('should have debug as default level in development', async () => {
      vi.stubEnv('DEV', true)
      vi.stubEnv('PROD', false)
      vi.stubEnv('VITE_LOG_LEVEL', undefined)

      const { logger } = await import('../logger')
      expect(logger.getLevel()).toBe('debug')
    })

    it('should use VITE_LOG_LEVEL when set', async () => {
      vi.stubEnv('VITE_LOG_LEVEL', 'warn')

      const { logger } = await import('../logger')
      expect(logger.getLevel()).toBe('warn')
    })

    it('should allow dynamic level changes', async () => {
      const { logger } = await import('../logger')

      logger.setLevel('error')
      expect(logger.getLevel()).toBe('error')

      logger.setLevel('debug')
      expect(logger.getLevel()).toBe('debug')
    })
  })

  describe('logging methods', () => {
    it('should call console.debug for debug logs', async () => {
      vi.stubEnv('VITE_LOG_LEVEL', 'debug')

      const { logger } = await import('../logger')
      logger.debug('auth', 'Test debug message')

      expect(console.debug).toHaveBeenCalledWith('[AUTH]', 'Test debug message')
    })

    it('should call console.info for info logs', async () => {
      vi.stubEnv('VITE_LOG_LEVEL', 'debug')

      const { logger } = await import('../logger')
      logger.info('sync', 'Test info message', { count: 5 })

      expect(console.info).toHaveBeenCalledWith('[SYNC]', 'Test info message', { count: 5 })
    })

    it('should call console.warn for warn logs', async () => {
      vi.stubEnv('VITE_LOG_LEVEL', 'debug')

      const { logger } = await import('../logger')
      logger.warn('db', 'Test warning')

      expect(console.warn).toHaveBeenCalledWith('[DB]', 'Test warning')
    })

    it('should call console.error for error logs', async () => {
      vi.stubEnv('VITE_LOG_LEVEL', 'debug')

      const { logger } = await import('../logger')
      logger.error('ui', 'Test error', { component: 'App' })

      expect(console.error).toHaveBeenCalledWith('[UI]', 'Test error', { component: 'App' })
    })
  })

  describe('log level filtering behavior', () => {
    it('should not output debug logs when level is info', async () => {
      vi.stubEnv('VITE_LOG_LEVEL', 'info')

      const { logger } = await import('../logger')
      logger.debug('auth', 'Debug message')

      expect(console.debug).not.toHaveBeenCalled()
    })

    it('should output warn logs when level is warn', async () => {
      vi.stubEnv('VITE_LOG_LEVEL', 'warn')

      const { logger } = await import('../logger')
      logger.warn('sync', 'Warning message')

      expect(console.warn).toHaveBeenCalled()
    })

    it('should output error logs when level is error', async () => {
      vi.stubEnv('VITE_LOG_LEVEL', 'error')

      const { logger } = await import('../logger')
      logger.error('db', 'Error message')

      expect(console.error).toHaveBeenCalled()
    })

    it('should not output info when level is warn', async () => {
      vi.stubEnv('VITE_LOG_LEVEL', 'warn')

      const { logger } = await import('../logger')
      logger.info('auth', 'Info message')

      expect(console.info).not.toHaveBeenCalled()
    })
  })

  describe('log persistence', () => {
    it('should call logStore.addEntry when logging', async () => {
      vi.stubEnv('VITE_LOG_LEVEL', 'debug')

      const { logStore } = await import('../logStore')
      const { logger } = await import('../logger')

      logger.info('general', 'Test message')

      expect(logStore.addEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'info',
          category: 'general',
          message: 'Test message',
        })
      )
    })
  })

  describe('categories', () => {
    it('should support all log categories', async () => {
      vi.stubEnv('VITE_LOG_LEVEL', 'debug')

      const { logger } = await import('../logger')
      const categories = ['auth', 'sync', 'db', 'ui', 'general'] as const

      for (const category of categories) {
        logger.info(category, `Test ${category}`)
        expect(console.info).toHaveBeenCalledWith(`[${category.toUpperCase()}]`, `Test ${category}`)
      }
    })
  })
})
