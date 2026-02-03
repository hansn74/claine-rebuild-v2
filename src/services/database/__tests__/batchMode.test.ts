/**
 * Batch Mode Controller Unit Tests
 *
 * Story 1.18: Batched Reactive Query Triggers
 * Task 6: Unit Tests for Batch Mode Controller (AC: 5-7)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { BatchModeController } from '../batchMode'

describe('BatchModeController', () => {
  let controller: BatchModeController

  beforeEach(() => {
    controller = new BatchModeController()
  })

  // Subtask 6.1: isActive() returns false by default
  describe('initial state', () => {
    it('should return false for isActive() by default', () => {
      expect(controller.isActive()).toBe(false)
    })
  })

  // Subtask 6.2: enter() sets active to true, listener called
  describe('enter()', () => {
    it('should set active to true', () => {
      controller.enter()
      expect(controller.isActive()).toBe(true)
    })

    it('should notify listeners when entering batch mode', () => {
      const listener = vi.fn()
      controller.subscribe(listener)

      controller.enter()

      expect(listener).toHaveBeenCalledTimes(1)
    })
  })

  // Subtask 6.3: exit() sets active to false, listener called
  describe('exit()', () => {
    it('should set active to false after single enter/exit', () => {
      controller.enter()
      controller.exit()
      expect(controller.isActive()).toBe(false)
    })

    it('should notify listeners when exiting batch mode', () => {
      const listener = vi.fn()
      controller.enter()
      controller.subscribe(listener)

      controller.exit()

      expect(listener).toHaveBeenCalledTimes(1)
    })
  })

  // Subtask 6.4: subscribe() returns unsubscribe function that works
  describe('subscribe()', () => {
    it('should return an unsubscribe function', () => {
      const listener = vi.fn()
      const unsubscribe = controller.subscribe(listener)

      expect(typeof unsubscribe).toBe('function')
    })

    it('should stop receiving notifications after unsubscribe', () => {
      const listener = vi.fn()
      const unsubscribe = controller.subscribe(listener)

      controller.enter()
      expect(listener).toHaveBeenCalledTimes(1)

      unsubscribe()

      controller.exit()
      // Should still be 1, not 2
      expect(listener).toHaveBeenCalledTimes(1)
    })

    it('should support multiple listeners', () => {
      const listener1 = vi.fn()
      const listener2 = vi.fn()
      controller.subscribe(listener1)
      controller.subscribe(listener2)

      controller.enter()

      expect(listener1).toHaveBeenCalledTimes(1)
      expect(listener2).toHaveBeenCalledTimes(1)
    })
  })

  // Subtask 6.5: Nested enter() calls use reference counting
  describe('nested enter/exit (reference counting)', () => {
    it('should stay active after nested enter calls until all exits complete', () => {
      controller.enter() // refCount = 1
      controller.enter() // refCount = 2

      expect(controller.isActive()).toBe(true)

      controller.exit() // refCount = 1
      expect(controller.isActive()).toBe(true)

      controller.exit() // refCount = 0
      expect(controller.isActive()).toBe(false)
    })

    it('should not go below zero on extra exit calls', () => {
      controller.exit() // Should not throw or go negative
      expect(controller.isActive()).toBe(false)
    })

    it('should notify listeners only on transitions', () => {
      const listener = vi.fn()
      controller.subscribe(listener)

      controller.enter() // inactive -> active: notify
      expect(listener).toHaveBeenCalledTimes(1)

      controller.enter() // still active: no notify
      expect(listener).toHaveBeenCalledTimes(1)

      controller.exit() // still active (refCount=1): no notify
      expect(listener).toHaveBeenCalledTimes(1)

      controller.exit() // active -> inactive: notify
      expect(listener).toHaveBeenCalledTimes(2)
    })
  })

  describe('listener error handling', () => {
    it('should not throw when a listener throws', () => {
      const badListener = vi.fn(() => {
        throw new Error('listener error')
      })
      const goodListener = vi.fn()

      controller.subscribe(badListener)
      controller.subscribe(goodListener)

      expect(() => controller.enter()).not.toThrow()
      expect(goodListener).toHaveBeenCalled()
    })
  })
})
