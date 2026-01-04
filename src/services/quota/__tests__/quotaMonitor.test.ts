/**
 * QuotaMonitorService Tests
 *
 * AC 18: Unit test: 80% quota reached → warning banner shown
 * AC 19: Unit test: 90% quota reached → cleanup wizard triggered
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { QuotaMonitorService, resetQuotaMonitorService, type QuotaState } from '../quotaMonitor'

// Mock navigator.storage.estimate
const mockEstimate = vi.fn()

describe('QuotaMonitorService', () => {
  beforeEach(() => {
    // Reset singleton
    resetQuotaMonitorService()

    // Mock storage API
    Object.defineProperty(global.navigator, 'storage', {
      value: {
        estimate: mockEstimate,
      },
      writable: true,
      configurable: true,
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('checkStorageQuota', () => {
    it('returns correct usage and quota from StorageManager API', async () => {
      mockEstimate.mockResolvedValue({
        usage: 500 * 1024 * 1024, // 500 MB
        quota: 2 * 1024 * 1024 * 1024, // 2 GB
      })

      const service = new QuotaMonitorService()
      const state = await service.checkStorageQuota()

      expect(state.usage).toBe(500 * 1024 * 1024)
      expect(state.quota).toBe(2 * 1024 * 1024 * 1024)
      expect(mockEstimate).toHaveBeenCalled()
    })

    it('handles missing storage API gracefully', async () => {
      // Remove storage API
      Object.defineProperty(global.navigator, 'storage', {
        value: undefined,
        writable: true,
        configurable: true,
      })

      const service = new QuotaMonitorService()
      const state = await service.checkStorageQuota()

      expect(state.usage).toBe(0)
      expect(state.quota).toBe(0)
      expect(state.status).toBe('normal')
    })
  })

  describe('getUsagePercentage', () => {
    it('calculates percentage correctly', async () => {
      mockEstimate.mockResolvedValue({
        usage: 1 * 1024 * 1024 * 1024, // 1 GB
        quota: 2 * 1024 * 1024 * 1024, // 2 GB
      })

      const service = new QuotaMonitorService()
      await service.checkStorageQuota()

      const percentage = service.getUsagePercentage()
      expect(percentage).toBe(50)
    })

    it('returns 0 when quota is 0', () => {
      const service = new QuotaMonitorService()
      const percentage = service.getUsagePercentage(100, 0)
      expect(percentage).toBe(0)
    })

    it('handles edge cases correctly', () => {
      const service = new QuotaMonitorService()

      expect(service.getUsagePercentage(0, 100)).toBe(0)
      expect(service.getUsagePercentage(100, 100)).toBe(100)
      expect(service.getUsagePercentage(50, 100)).toBe(50)
    })
  })

  describe('getThresholdStatus', () => {
    /**
     * AC 18: 80% quota reached → warning status
     */
    it('returns "warning" when usage reaches 80%', async () => {
      mockEstimate.mockResolvedValue({
        usage: 800,
        quota: 1000,
      })

      const service = new QuotaMonitorService()
      await service.checkStorageQuota()

      expect(service.getThresholdStatus()).toBe('warning')
    })

    /**
     * AC 19: 90% quota reached → critical status
     */
    it('returns "critical" when usage reaches 90%', async () => {
      mockEstimate.mockResolvedValue({
        usage: 900,
        quota: 1000,
      })

      const service = new QuotaMonitorService()
      await service.checkStorageQuota()

      expect(service.getThresholdStatus()).toBe('critical')
    })

    it('returns "normal" when usage is below 80%', async () => {
      mockEstimate.mockResolvedValue({
        usage: 500,
        quota: 1000,
      })

      const service = new QuotaMonitorService()
      await service.checkStorageQuota()

      expect(service.getThresholdStatus()).toBe('normal')
    })

    it('respects custom thresholds', async () => {
      mockEstimate.mockResolvedValue({
        usage: 600,
        quota: 1000,
      })

      const service = new QuotaMonitorService({
        warningThreshold: 50,
        criticalThreshold: 70,
      })
      await service.checkStorageQuota()

      expect(service.getThresholdStatus()).toBe('warning')
    })
  })

  describe('periodic monitoring', () => {
    it('triggers at configured interval', async () => {
      vi.useFakeTimers()

      mockEstimate.mockResolvedValue({
        usage: 100,
        quota: 1000,
      })

      const service = new QuotaMonitorService({
        checkIntervalMs: 1000,
      })

      service.startMonitoring()

      // Initial call
      expect(mockEstimate).toHaveBeenCalledTimes(1)

      // Advance time by 1 second
      vi.advanceTimersByTime(1000)
      await Promise.resolve() // Allow async to resolve

      expect(mockEstimate).toHaveBeenCalledTimes(2)

      // Advance time by another second
      vi.advanceTimersByTime(1000)
      await Promise.resolve()

      expect(mockEstimate).toHaveBeenCalledTimes(3)

      service.stopMonitoring()
      vi.useRealTimers()
    })

    it('stops monitoring when requested', async () => {
      vi.useFakeTimers()

      mockEstimate.mockResolvedValue({
        usage: 100,
        quota: 1000,
      })

      const service = new QuotaMonitorService({
        checkIntervalMs: 1000,
      })

      service.startMonitoring()
      expect(mockEstimate).toHaveBeenCalledTimes(1)

      service.stopMonitoring()

      // Advance time - should not trigger more calls
      vi.advanceTimersByTime(5000)
      await Promise.resolve()

      expect(mockEstimate).toHaveBeenCalledTimes(1)

      vi.useRealTimers()
    })
  })

  describe('subscriptions', () => {
    it('notifies subscribers when state changes', async () => {
      mockEstimate.mockResolvedValue({
        usage: 500,
        quota: 1000,
      })

      const service = new QuotaMonitorService()
      const listener = vi.fn()

      service.subscribe(listener)
      await service.checkStorageQuota()

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          usage: 500,
          quota: 1000,
          percentage: 50,
          status: 'normal',
        })
      )
    })

    it('sends current state immediately on subscribe', async () => {
      mockEstimate.mockResolvedValue({
        usage: 500,
        quota: 1000,
      })

      const service = new QuotaMonitorService()
      await service.checkStorageQuota()

      const listener = vi.fn()
      service.subscribe(listener)

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          percentage: 50,
        })
      )
    })

    it('allows unsubscribing', async () => {
      mockEstimate.mockResolvedValue({
        usage: 500,
        quota: 1000,
      })

      const service = new QuotaMonitorService()
      const listener = vi.fn()

      const unsubscribe = service.subscribe(listener)
      unsubscribe()

      await service.checkStorageQuota()

      // Only called once from initial subscribe, not from checkStorageQuota
      expect(listener).toHaveBeenCalledTimes(0)
    })
  })

  describe('threshold transitions', () => {
    it('detects transition from normal to warning', async () => {
      const service = new QuotaMonitorService()
      const listener = vi.fn()
      service.subscribe(listener)

      // First check - normal
      mockEstimate.mockResolvedValue({ usage: 500, quota: 1000 })
      await service.checkStorageQuota()

      // Second check - warning
      mockEstimate.mockResolvedValue({ usage: 850, quota: 1000 })
      await service.checkStorageQuota()

      const lastCall = listener.mock.calls[listener.mock.calls.length - 1][0] as QuotaState
      expect(lastCall.status).toBe('warning')
    })

    it('detects transition from warning to critical', async () => {
      const service = new QuotaMonitorService()
      const listener = vi.fn()
      service.subscribe(listener)

      // First check - warning
      mockEstimate.mockResolvedValue({ usage: 850, quota: 1000 })
      await service.checkStorageQuota()

      // Second check - critical
      mockEstimate.mockResolvedValue({ usage: 950, quota: 1000 })
      await service.checkStorageQuota()

      const lastCall = listener.mock.calls[listener.mock.calls.length - 1][0] as QuotaState
      expect(lastCall.status).toBe('critical')
    })
  })

  describe('isStorageApiAvailable', () => {
    it('returns true when API is available', () => {
      const service = new QuotaMonitorService()
      expect(service.isStorageApiAvailable()).toBe(true)
    })

    it('returns false when API is not available', () => {
      Object.defineProperty(global.navigator, 'storage', {
        value: undefined,
        writable: true,
        configurable: true,
      })

      const service = new QuotaMonitorService()
      expect(service.isStorageApiAvailable()).toBe(false)
    })
  })
})
