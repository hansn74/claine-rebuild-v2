/**
 * Adaptive Interval Integration Tests
 *
 * Story 1.15: Adaptive Sync Polling Intervals
 * Task 8: Integration tests (AC 1-4, 6, 8)
 *
 * Tests the SyncOrchestratorService with adaptive intervals.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Subject } from 'rxjs'

// Use vi.hoisted for mock objects referenced in vi.mock factories
const { mockAdaptiveInterval, mockProgressData, mockGmailStartSync } = vi.hoisted(() => ({
  mockAdaptiveInterval: {
    isEnabled: vi.fn().mockReturnValue(true),
    getInterval: vi.fn().mockReturnValue(60_000),
    recordSyncResult: vi.fn(),
    recordUserAction: vi.fn(),
  },
  mockProgressData: {} as Record<
    string,
    { accountId: string; provider: string; emailsSynced: number }
  >,
  mockGmailStartSync: vi.fn().mockResolvedValue(undefined),
}))

// Mock logger
vi.mock('@/services/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// Mock sync services
vi.mock('../gmailSync', () => ({
  GmailSyncService: class {
    startSync = mockGmailStartSync
  },
}))

vi.mock('../outlookSync', () => ({
  OutlookSyncService: class {
    startSync = vi.fn().mockResolvedValue(undefined)
  },
}))

// Mock circuit breaker
vi.mock('../circuitBreaker', () => ({
  circuitBreaker: {
    canExecute: vi.fn().mockReturnValue(true),
    recordSuccess: vi.fn(),
    recordFailure: vi.fn(),
  },
}))

// Mock error classification
vi.mock('../errorClassification', () => ({
  classifyError: vi.fn().mockReturnValue({ type: 'transient' }),
}))

vi.mock('../adaptiveInterval', () => ({
  adaptiveInterval: mockAdaptiveInterval,
}))

vi.mock('../syncProgress', () => ({
  SyncProgressService: class {
    getAllProgress = vi.fn().mockImplementation(async () => Object.values(mockProgressData))
    getProgress = vi
      .fn()
      .mockImplementation(async (accountId: string) => mockProgressData[accountId] ?? null)
    initializeSyncState = vi.fn().mockResolvedValue(undefined)
    updateProgress = vi.fn().mockResolvedValue(undefined)
    scheduleNextSync = vi.fn().mockResolvedValue(undefined)
  },
}))

import { SyncOrchestratorService } from '../syncOrchestrator'

describe('SyncOrchestrator Adaptive Interval Integration', () => {
  let orchestrator: SyncOrchestratorService
  const mockDb = {} as import('../../database/types').AppDatabase

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()

    mockAdaptiveInterval.isEnabled.mockReturnValue(true)
    mockAdaptiveInterval.getInterval.mockReturnValue(60_000)
    mockGmailStartSync.mockResolvedValue(undefined)

    // Setup test account
    mockProgressData['gmail:test@example.com'] = {
      accountId: 'gmail:test@example.com',
      provider: 'gmail',
      emailsSynced: 100,
    }

    // Mock navigator.onLine
    vi.stubGlobal('navigator', { onLine: true })

    orchestrator = new SyncOrchestratorService(mockDb)
  })

  afterEach(() => {
    orchestrator.stop()
    vi.useRealTimers()

    // Clean up mock data
    for (const key of Object.keys(mockProgressData)) {
      delete mockProgressData[key]
    }
  })

  // Subtask 8.1
  describe('adaptive interval scheduling', () => {
    it('should use adaptive interval when scheduling next sync', async () => {
      mockAdaptiveInterval.getInterval.mockReturnValue(60_000)

      await orchestrator.start()

      // After initial sync, scheduleNextSync should query adaptive interval
      expect(mockAdaptiveInterval.getInterval).toHaveBeenCalledWith('gmail:test@example.com')
    })

    // Subtask 8.5
    it('should use fixed interval when adaptive polling disabled', async () => {
      mockAdaptiveInterval.isEnabled.mockReturnValue(false)

      await orchestrator.start()

      // Should NOT use adaptive interval
      expect(mockAdaptiveInterval.getInterval).not.toHaveBeenCalled()
    })
  })

  // Subtask 8.2
  describe('sync result recording', () => {
    it('should record sync result with activity when emailsSynced increases', async () => {
      // Make startSync simulate finding new messages by mutating the mock data
      mockGmailStartSync.mockImplementation(async () => {
        mockProgressData['gmail:test@example.com'].emailsSynced = 105
      })

      mockProgressData['gmail:test@example.com'].emailsSynced = 100

      await orchestrator.start()

      expect(mockAdaptiveInterval.recordSyncResult).toHaveBeenCalledWith(
        'gmail:test@example.com',
        true // afterCount (105) > beforeCount (100)
      )
    })

    it('should record sync result without activity when emailsSynced stays same', async () => {
      // Before and after sync: same count
      mockProgressData['gmail:test@example.com'].emailsSynced = 100

      await orchestrator.start()

      expect(mockAdaptiveInterval.recordSyncResult).toHaveBeenCalledWith(
        'gmail:test@example.com',
        false // afterCount (100) === beforeCount (100)
      )
    })
  })

  // Subtask 8.3
  describe('interval tier progression', () => {
    it('should use longer interval after multiple idle syncs', async () => {
      // First call returns default, subsequent calls return longer intervals
      mockAdaptiveInterval.getInterval
        .mockReturnValueOnce(180_000) // Initial schedule
        .mockReturnValueOnce(300_000) // After timer fires

      await orchestrator.start()

      // Advance past first interval (180s) and flush microtasks
      await vi.advanceTimersByTimeAsync(180_000)

      // Second scheduling should get new interval
      expect(mockAdaptiveInterval.getInterval).toHaveBeenCalledTimes(2)
    })
  })

  // Subtask 8.4
  describe('onAccountSwitch()', () => {
    it('should trigger immediate sync on account switch', async () => {
      await orchestrator.start()
      vi.clearAllMocks()

      await orchestrator.onAccountSwitch('gmail:test@example.com')

      // Should have synced immediately (recordSyncResult called)
      expect(mockAdaptiveInterval.recordSyncResult).toHaveBeenCalledWith(
        'gmail:test@example.com',
        expect.any(Boolean)
      )
    })

    it('should reschedule sync after account switch', async () => {
      await orchestrator.start()
      vi.clearAllMocks()

      await orchestrator.onAccountSwitch('gmail:test@example.com')

      // Should have called getInterval to schedule next sync
      expect(mockAdaptiveInterval.getInterval).toHaveBeenCalledWith('gmail:test@example.com')
    })
  })

  // Subtask 8.6
  describe('user action event subscription', () => {
    it('should record user action and reschedule on action event', async () => {
      const actionEvents$ = new Subject<{ action?: { accountId: string } }>()

      await orchestrator.start()
      orchestrator.subscribeToActionEvents(actionEvents$)

      actionEvents$.next({ action: { accountId: 'gmail:test@example.com' } })

      expect(mockAdaptiveInterval.recordUserAction).toHaveBeenCalledWith('gmail:test@example.com')
    })

    it('should handle send queue events with item.accountId', async () => {
      const sendEvents$ = new Subject<{ item?: { accountId: string } }>()

      await orchestrator.start()
      orchestrator.subscribeToActionEvents(sendEvents$)

      sendEvents$.next({ item: { accountId: 'gmail:test@example.com' } })

      expect(mockAdaptiveInterval.recordUserAction).toHaveBeenCalledWith('gmail:test@example.com')
    })

    it('should clean up subscriptions on stop', async () => {
      const actionEvents$ = new Subject<{ action?: { accountId: string } }>()

      await orchestrator.start()
      orchestrator.subscribeToActionEvents(actionEvents$)
      orchestrator.stop()

      // After stop, events should not trigger anything
      vi.clearAllMocks()
      actionEvents$.next({ action: { accountId: 'gmail:test@example.com' } })

      expect(mockAdaptiveInterval.recordUserAction).not.toHaveBeenCalled()
    })
  })

  // Multiple accounts (AC 14)
  describe('multiple account independence', () => {
    it('should track intervals independently per account', async () => {
      mockProgressData['outlook:other@example.com'] = {
        accountId: 'outlook:other@example.com',
        provider: 'outlook',
        emailsSynced: 50,
      }

      await orchestrator.start()

      // Both accounts should have their own getInterval calls
      expect(mockAdaptiveInterval.getInterval).toHaveBeenCalledWith('gmail:test@example.com')
      expect(mockAdaptiveInterval.getInterval).toHaveBeenCalledWith('outlook:other@example.com')
    })
  })

  // Story 1.17: Jitter integration tests (AC 8-9)
  describe('jitter integration', () => {
    // Subtask 3.1 (AC 8): Manual sync bypasses jitter — executes immediately
    it('should execute manual sync immediately without timer-based scheduling', async () => {
      await orchestrator.start()
      vi.clearAllMocks()

      // triggerSync calls syncAccount directly — no setTimeout/getInterval for timing
      await orchestrator.triggerSync('gmail:test@example.com')

      // Sync completed immediately — no vi.advanceTimersByTime() was needed
      // This proves the sync bypassed the timer-based scheduling path (and jitter)
      expect(mockAdaptiveInterval.recordSyncResult).toHaveBeenCalledWith(
        'gmail:test@example.com',
        expect.any(Boolean)
      )

      // Verify ordering: recordSyncResult (sync happened) before any getInterval
      // call (rescheduling). getInterval MAY be called 0-1 times for rescheduling
      // the NEXT automatic sync, but the manual trigger itself was immediate.
      const syncCallOrder = mockAdaptiveInterval.recordSyncResult.mock.invocationCallOrder[0]
      if (mockAdaptiveInterval.getInterval.mock.calls.length > 0) {
        const getIntervalCallOrder = mockAdaptiveInterval.getInterval.mock.invocationCallOrder[0]
        expect(syncCallOrder).toBeLessThan(getIntervalCallOrder)
      }
    })

    // Subtask 3.2 (AC 9): Two accounts with same tier get different jittered intervals
    it('should return different intervals for two accounts with same tier using real random', async () => {
      // Use vi.importActual to get the real (unmocked) AdaptiveIntervalService
      const { AdaptiveIntervalService } =
        await vi.importActual<typeof import('../adaptiveInterval')>('../adaptiveInterval')
      const realService = new AdaptiveIntervalService() // Uses real Math.random

      // Get intervals for multiple accounts (all default tier — no state recorded)
      const results = new Set<number>()
      for (let i = 0; i < 20; i++) {
        results.add(realService.getInterval(`account-${i}`))
      }

      // With real randomness and 20 calls, we should get more than 1 unique value
      // (probability of all 20 being identical is astronomically low)
      expect(results.size).toBeGreaterThan(1)
    })
  })
})
