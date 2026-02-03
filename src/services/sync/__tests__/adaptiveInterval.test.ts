/**
 * Adaptive Interval Service Unit Tests
 *
 * Story 1.15: Adaptive Sync Polling Intervals
 * Task 7: Unit tests (AC 1-14)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AdaptiveIntervalService } from '../adaptiveInterval'

// Mock logger
vi.mock('@/services/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// Mock import.meta.env
vi.stubGlobal('import', { meta: { env: {} } })

describe('AdaptiveIntervalService', () => {
  let service: AdaptiveIntervalService
  let mockStorage: Map<string, string>

  beforeEach(() => {
    // Mock localStorage
    mockStorage = new Map()
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => mockStorage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => mockStorage.set(key, value)),
      removeItem: vi.fn((key: string) => mockStorage.delete(key)),
    })

    service = new AdaptiveIntervalService(() => 0.5)
  })

  describe('getInterval()', () => {
    // Subtask 7.1 (AC 1)
    it('should return 180_000ms default interval when no activity recorded', () => {
      expect(service.getInterval('account-1')).toBe(180_000)
    })

    // Subtask 7.2 (AC 2, AC 11)
    it('should return 60_000ms after sync with new messages', () => {
      service.recordSyncResult('account-1', true)
      expect(service.getInterval('account-1')).toBe(60_000)
    })

    // Subtask 7.3 (AC 3)
    it('should return 300_000ms after 3 consecutive idle syncs', () => {
      service.recordSyncResult('account-1', false)
      service.recordSyncResult('account-1', false)
      service.recordSyncResult('account-1', false)
      expect(service.getInterval('account-1')).toBe(300_000)
    })

    // Subtask 7.4 (AC 4, AC 12)
    it('should return 600_000ms after 10 consecutive idle syncs', () => {
      for (let i = 0; i < 10; i++) {
        service.recordSyncResult('account-1', false)
      }
      expect(service.getInterval('account-1')).toBe(600_000)
    })

    it('should stay at 300_000ms between 3 and 9 idle syncs', () => {
      for (let i = 0; i < 5; i++) {
        service.recordSyncResult('account-1', false)
      }
      expect(service.getInterval('account-1')).toBe(300_000)
    })

    it('should return 180_000ms between 1-2 idle syncs', () => {
      service.recordSyncResult('account-1', false)
      service.recordSyncResult('account-1', false)
      expect(service.getInterval('account-1')).toBe(180_000)
    })
  })

  describe('recordSyncResult()', () => {
    it('should reset idle counter when new messages found', () => {
      // Build up idle syncs
      for (let i = 0; i < 5; i++) {
        service.recordSyncResult('account-1', false)
      }
      expect(service.getInterval('account-1')).toBe(300_000)

      // New messages found — reset
      service.recordSyncResult('account-1', true)
      expect(service.getInterval('account-1')).toBe(60_000)
      expect(service.getState('account-1')?.consecutiveIdleSyncs).toBe(0)
    })

    it('should increment idle counter on no new messages', () => {
      service.recordSyncResult('account-1', false)
      expect(service.getState('account-1')?.consecutiveIdleSyncs).toBe(1)

      service.recordSyncResult('account-1', false)
      expect(service.getState('account-1')?.consecutiveIdleSyncs).toBe(2)
    })
  })

  // Subtask 7.5 (AC 5, AC 13)
  describe('recordUserAction()', () => {
    it('should reset interval to 60_000ms on user action', () => {
      // Build up idle syncs
      for (let i = 0; i < 10; i++) {
        service.recordSyncResult('account-1', false)
      }
      expect(service.getInterval('account-1')).toBe(600_000)

      // User performs action — reset to active
      service.recordUserAction('account-1')
      expect(service.getInterval('account-1')).toBe(60_000)
    })

    it('should reset consecutive idle counter', () => {
      for (let i = 0; i < 5; i++) {
        service.recordSyncResult('account-1', false)
      }

      service.recordUserAction('account-1')
      expect(service.getState('account-1')?.consecutiveIdleSyncs).toBe(0)
    })

    it('should set lastUserActionAt timestamp', () => {
      const before = Date.now()
      service.recordUserAction('account-1')
      const after = Date.now()

      const state = service.getState('account-1')
      expect(state?.lastUserActionAt).toBeGreaterThanOrEqual(before)
      expect(state?.lastUserActionAt).toBeLessThanOrEqual(after)
    })
  })

  // Subtask 7.6
  describe('after user action, idle syncs resume normally', () => {
    it('should return 180_000ms after user action + 1 idle sync', () => {
      service.recordUserAction('account-1')
      expect(service.getInterval('account-1')).toBe(60_000)

      // One idle sync — back to default
      service.recordSyncResult('account-1', false)
      expect(service.getInterval('account-1')).toBe(180_000)
    })
  })

  // Subtask 7.7 (AC 6, AC 14)
  describe('per-account independence', () => {
    it('should track accounts independently', () => {
      // Account A goes idle
      for (let i = 0; i < 10; i++) {
        service.recordSyncResult('account-a', false)
      }

      // Account B is active
      service.recordSyncResult('account-b', true)

      expect(service.getInterval('account-a')).toBe(600_000)
      expect(service.getInterval('account-b')).toBe(60_000)
    })

    it('should not affect other accounts when recording user action', () => {
      for (let i = 0; i < 5; i++) {
        service.recordSyncResult('account-a', false)
        service.recordSyncResult('account-b', false)
      }

      // User action on account A only
      service.recordUserAction('account-a')

      expect(service.getInterval('account-a')).toBe(60_000)
      expect(service.getInterval('account-b')).toBe(300_000)
    })
  })

  // Subtask 7.8 (AC 10)
  describe('min/max clamping', () => {
    it('should clamp interval to min/max bounds', () => {
      // The default min is 60_000 and max is 600_000
      // Active interval (60_000) should equal min
      service.recordSyncResult('account-1', true)
      expect(service.getInterval('account-1')).toBe(60_000)

      // Max idle interval (600_000) should equal max
      for (let i = 0; i < 10; i++) {
        service.recordSyncResult('account-1', false)
      }
      expect(service.getInterval('account-1')).toBe(600_000)
    })
  })

  // M3: Custom env var bounds (AC 10)
  describe('custom env var bounds', () => {
    it('should clamp to custom min/max from env vars', () => {
      import.meta.env.VITE_ADAPTIVE_MIN_INTERVAL_MS = '120000'
      import.meta.env.VITE_ADAPTIVE_MAX_INTERVAL_MS = '300000'

      const customService = new AdaptiveIntervalService(() => 0.5)

      // Active interval (60_000) should be clamped up to min (120_000)
      customService.recordSyncResult('account-1', true)
      expect(customService.getInterval('account-1')).toBe(120_000)

      // 10+ idle interval (600_000) should be clamped down to max (300_000)
      for (let i = 0; i < 10; i++) {
        customService.recordSyncResult('account-1', false)
      }
      expect(customService.getInterval('account-1')).toBe(300_000)

      delete import.meta.env.VITE_ADAPTIVE_MIN_INTERVAL_MS
      delete import.meta.env.VITE_ADAPTIVE_MAX_INTERVAL_MS
    })

    // H3: NaN guard for invalid env var values
    it('should fallback to defaults when env vars are invalid', () => {
      import.meta.env.VITE_ADAPTIVE_MIN_INTERVAL_MS = 'not-a-number'
      import.meta.env.VITE_ADAPTIVE_MAX_INTERVAL_MS = 'invalid'

      const customService = new AdaptiveIntervalService(() => 0.5)

      // Should use default min (60_000) and max (600_000)
      customService.recordSyncResult('account-1', true)
      expect(customService.getInterval('account-1')).toBe(60_000)

      for (let i = 0; i < 10; i++) {
        customService.recordSyncResult('account-1', false)
      }
      expect(customService.getInterval('account-1')).toBe(600_000)

      delete import.meta.env.VITE_ADAPTIVE_MIN_INTERVAL_MS
      delete import.meta.env.VITE_ADAPTIVE_MAX_INTERVAL_MS
    })
  })

  // Subtask 7.9 (AC 9)
  describe('isEnabled() / setEnabled()', () => {
    it('should return true by default', () => {
      expect(service.isEnabled()).toBe(true)
    })

    it('should return false when disabled', () => {
      service.setEnabled(false)
      expect(service.isEnabled()).toBe(false)
    })

    it('should return default interval when disabled', () => {
      service.setEnabled(false)
      service.recordSyncResult('account-1', true)
      expect(service.getInterval('account-1')).toBe(180_000)
    })

    it('should resume adaptive intervals when re-enabled', () => {
      service.recordSyncResult('account-1', true)
      service.setEnabled(false)
      expect(service.getInterval('account-1')).toBe(180_000)

      service.setEnabled(true)
      expect(service.getInterval('account-1')).toBe(60_000)
    })
  })

  // Subtask 7.10 (AC 7)
  describe('persistence', () => {
    it('should save state to localStorage on recordSyncResult', () => {
      service.recordSyncResult('account-1', true)
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'claine:adaptive-polling-state',
        expect.any(String)
      )
    })

    it('should save state to localStorage on recordUserAction', () => {
      service.recordUserAction('account-1')
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'claine:adaptive-polling-state',
        expect.any(String)
      )
    })

    it('should restore state from localStorage on construction', () => {
      // Pre-populate storage
      const data = {
        'account-1': {
          consecutiveIdleSyncs: 5,
          lastSyncHadActivity: false,
          lastUserActionAt: 0,
          currentInterval: 300_000,
        },
      }
      mockStorage.set('claine:adaptive-polling-state', JSON.stringify(data))

      const newService = new AdaptiveIntervalService(() => 0.5)
      expect(newService.getInterval('account-1')).toBe(300_000)
    })
  })

  // Subtask 7.11
  describe('reset()', () => {
    it('should clear specific account state', () => {
      service.recordSyncResult('account-1', true)
      service.recordSyncResult('account-2', true)

      service.reset('account-1')

      expect(service.getState('account-1')).toBeUndefined()
      expect(service.getState('account-2')).toBeDefined()
    })

    it('should clear all state when no accountId provided', () => {
      service.recordSyncResult('account-1', true)
      service.recordSyncResult('account-2', true)

      service.reset()

      expect(service.getState('account-1')).toBeUndefined()
      expect(service.getState('account-2')).toBeUndefined()
    })

    it('should update localStorage on reset', () => {
      service.recordSyncResult('account-1', true)
      vi.mocked(localStorage.setItem).mockClear()

      service.reset()

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'claine:adaptive-polling-state',
        expect.any(String)
      )
    })
  })

  // Subtask 7.12
  describe('localStorage failure handling', () => {
    it('should handle localStorage.getItem throwing', () => {
      vi.mocked(localStorage.getItem).mockImplementation(() => {
        throw new Error('localStorage unavailable')
      })

      // Should not throw — falls back to in-memory
      const newService = new AdaptiveIntervalService(() => 0.5)
      expect(newService.getInterval('account-1')).toBe(180_000)
    })

    it('should handle localStorage.setItem throwing', () => {
      vi.mocked(localStorage.setItem).mockImplementation(() => {
        throw new Error('QuotaExceededError')
      })

      // Should not throw — continues with in-memory only
      expect(() => service.recordSyncResult('account-1', true)).not.toThrow()
      expect(service.getInterval('account-1')).toBe(60_000)
    })

    it('should handle corrupted localStorage data', () => {
      mockStorage.set('claine:adaptive-polling-state', 'not-json')

      // Should not throw — starts fresh
      const newService = new AdaptiveIntervalService(() => 0.5)
      expect(newService.getInterval('account-1')).toBe(180_000)
    })

    it('should handle isEnabled with localStorage failure', () => {
      vi.mocked(localStorage.getItem).mockImplementation(() => {
        throw new Error('unavailable')
      })
      // Should default to true
      expect(service.isEnabled()).toBe(true)
    })
  })

  // Story 1.17: Jitter tests (AC 10-12)
  describe('jitter', () => {
    // Subtask 2.1 (AC 10): randomFn=0.5 → midpoint → no jitter effect
    it('should return exact base interval when randomFn returns 0.5 (midpoint)', () => {
      const svc = new AdaptiveIntervalService(() => 0.5)
      // Default tier for unknown account
      expect(svc.getInterval('account-1')).toBe(180_000)
    })

    // Subtask 2.2 (AC 10): randomFn=0 → base * 0.85 (-15%)
    it('should return base * 0.85 when randomFn returns 0', () => {
      const svc = new AdaptiveIntervalService(() => 0)
      // Default tier 180_000 * 0.85 = 153_000
      expect(svc.getInterval('account-1')).toBe(153_000)
    })

    // Subtask 2.3 (AC 10): randomFn=1 → base * 1.15 (+15%)
    it('should return base * 1.15 when randomFn returns 1', () => {
      const svc = new AdaptiveIntervalService(() => 1)
      // Default tier 180_000 * 1.15 = 207_000 (toBeCloseTo handles floating-point)
      expect(svc.getInterval('account-1')).toBeCloseTo(207_000, 0)
    })

    // Subtask 2.4 (AC 7): Jittered interval is clamped to [min, max]
    it('should clamp jittered interval to min/max bounds', () => {
      // Use randomFn=0 (-15%) with active interval (60_000 * 0.85 = 51_000)
      // Default min is 60_000, so 51_000 should be clamped to 60_000
      const svc = new AdaptiveIntervalService(() => 0)
      svc.recordSyncResult('account-1', true) // Set to active tier (60_000)
      expect(svc.getInterval('account-1')).toBe(60_000) // Clamped to min
    })

    // Subtask 2.5 (AC 11): Different random values produce different intervals
    it('should produce different intervals with different randomFn values', () => {
      const svc1 = new AdaptiveIntervalService(() => 0.2)
      const svc2 = new AdaptiveIntervalService(() => 0.8)
      expect(svc1.getInterval('account-1')).not.toBe(svc2.getInterval('account-1'))
    })

    // Subtask 2.6 (AC 12): Jitter disabled via env var returns exact tier value
    describe('with VITE_SYNC_JITTER_ENABLED=false', () => {
      afterEach(() => {
        delete import.meta.env.VITE_SYNC_JITTER_ENABLED
      })

      it('should return exact tier value when jitter is disabled via env var', () => {
        import.meta.env.VITE_SYNC_JITTER_ENABLED = 'false'

        const svc = new AdaptiveIntervalService(() => 0) // Would apply -15% if jitter enabled
        expect(svc.getInterval('account-1')).toBe(180_000) // Exact, no jitter

        svc.recordSyncResult('account-1', true)
        expect(svc.getInterval('account-1')).toBe(60_000) // Exact active tier
      })

      // Subtask 2.7 complement: Adaptive disabled + jitter disabled → exact default
      it('should return exact default when both adaptive and jitter are disabled', () => {
        import.meta.env.VITE_SYNC_JITTER_ENABLED = 'false'

        const svc = new AdaptiveIntervalService(() => 0)
        svc.setEnabled(false)

        expect(svc.getInterval('account-1')).toBe(180_000) // Exact default
      })
    })

    // Subtask 2.7 (AC 6): Adaptive disabled + jitter enabled → default interval still jittered
    it('should jitter default interval when adaptive is disabled but jitter is enabled', () => {
      const svc = new AdaptiveIntervalService(() => 0) // -15%
      svc.setEnabled(false) // Disable adaptive polling

      // Should return DEFAULT_INTERVAL * 0.85 = 153_000 (jitter applied)
      expect(svc.getInterval('account-1')).toBe(153_000)
    })

    // Subtask 2.8: Verify existing tests still pass (covered by running the full suite)
  })
})
