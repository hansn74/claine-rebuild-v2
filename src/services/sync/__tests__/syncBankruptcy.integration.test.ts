/**
 * Sync Bankruptcy Integration Tests
 *
 * Story 1.16: Sync Bankruptcy Detection
 * Task 6: Integration tests (AC 12-13)
 *
 * Tests SyncOrchestratorService with bankruptcy detection.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

// Use vi.hoisted for mock objects referenced in vi.mock factories
const { mockProgressData, mockGmailStartSync, mockOutlookStartSync, mockSyncBankruptcy } =
  vi.hoisted(() => ({
    mockProgressData: {} as Record<
      string,
      {
        accountId: string
        provider: string
        emailsSynced: number
        lastSyncAt: number
        initialSyncComplete: boolean
        syncToken?: string
      }
    >,
    mockGmailStartSync: vi.fn().mockResolvedValue(undefined),
    mockOutlookStartSync: vi.fn().mockResolvedValue(undefined),
    mockSyncBankruptcy: {
      shouldDeclareBankruptcy: vi.fn().mockReturnValue({ bankrupt: false, reason: 'OK' }),
      performFreshSyncReset: vi.fn().mockResolvedValue(undefined),
      getEvents$: vi.fn().mockReturnValue({ subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })) }),
    },
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
    startSync = mockOutlookStartSync
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

// Mock adaptive interval
vi.mock('../adaptiveInterval', () => ({
  adaptiveInterval: {
    isEnabled: vi.fn().mockReturnValue(false),
    getInterval: vi.fn().mockReturnValue(180_000),
    recordSyncResult: vi.fn(),
    recordUserAction: vi.fn(),
  },
}))

// Mock error classification
vi.mock('../errorClassification', () => ({
  classifyError: vi.fn().mockReturnValue({ type: 'transient' }),
}))

// Mock sync bankruptcy
vi.mock('../syncBankruptcy', () => ({
  syncBankruptcy: mockSyncBankruptcy,
}))

// Mock sync progress
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

describe('SyncOrchestrator Bankruptcy Integration', () => {
  let orchestrator: SyncOrchestratorService
  const mockDb = {} as import('../../database/types').AppDatabase

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()

    mockGmailStartSync.mockResolvedValue(undefined)
    mockOutlookStartSync.mockResolvedValue(undefined)
    mockSyncBankruptcy.shouldDeclareBankruptcy.mockReturnValue({ bankrupt: false, reason: 'OK' })
    mockSyncBankruptcy.performFreshSyncReset.mockResolvedValue(undefined)

    // Clear progress data
    for (const key of Object.keys(mockProgressData)) {
      delete mockProgressData[key]
    }
  })

  afterEach(() => {
    orchestrator?.stop()
    vi.useRealTimers()
  })

  // Subtask 6.1 (AC 12): Recent lastSyncAt → no bankruptcy
  it('should not trigger bankruptcy when lastSyncAt is recent', async () => {
    mockProgressData['gmail:test@example.com'] = {
      accountId: 'gmail:test@example.com',
      provider: 'gmail',
      emailsSynced: 100,
      lastSyncAt: Date.now() - 1 * 24 * 60 * 60 * 1000, // 1 day ago
      initialSyncComplete: true,
      syncToken: 'history-123',
    }

    orchestrator = new SyncOrchestratorService(mockDb)
    await orchestrator.start()

    // Bankruptcy check should have been called but returned false
    expect(mockSyncBankruptcy.shouldDeclareBankruptcy).toHaveBeenCalledWith(
      'gmail:test@example.com',
      'gmail',
      expect.any(Number)
    )

    // performFreshSyncReset should NOT have been called
    expect(mockSyncBankruptcy.performFreshSyncReset).not.toHaveBeenCalled()

    // Normal sync should proceed
    expect(mockGmailStartSync).toHaveBeenCalledWith('gmail:test@example.com')
  })

  // Subtask 6.2 (AC 13): Stale lastSyncAt → bankruptcy triggered
  it('should trigger bankruptcy when lastSyncAt is stale (>7 days)', async () => {
    mockProgressData['gmail:test@example.com'] = {
      accountId: 'gmail:test@example.com',
      provider: 'gmail',
      emailsSynced: 500,
      lastSyncAt: Date.now() - 10 * 24 * 60 * 60 * 1000, // 10 days ago
      initialSyncComplete: true,
      syncToken: 'old-history-id',
    }

    mockSyncBankruptcy.shouldDeclareBankruptcy.mockReturnValue({
      bankrupt: true,
      reason: 'Stale for 10 days',
    })

    orchestrator = new SyncOrchestratorService(mockDb)
    await orchestrator.start()

    // Bankruptcy should be declared
    expect(mockSyncBankruptcy.shouldDeclareBankruptcy).toHaveBeenCalled()
    expect(mockSyncBankruptcy.performFreshSyncReset).toHaveBeenCalledWith(
      'gmail:test@example.com',
      'gmail',
      mockDb
    )

    // Normal sync should still proceed (fresh initial sync)
    expect(mockGmailStartSync).toHaveBeenCalled()
  })

  // Subtask 6.3: After bankruptcy reset, next sync performs initial sync
  it('should perform initial sync after bankruptcy reset', async () => {
    mockProgressData['gmail:test@example.com'] = {
      accountId: 'gmail:test@example.com',
      provider: 'gmail',
      emailsSynced: 500,
      lastSyncAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
      initialSyncComplete: true,
      syncToken: 'old-token',
    }

    mockSyncBankruptcy.shouldDeclareBankruptcy.mockReturnValue({
      bankrupt: true,
      reason: 'Stale',
    })

    orchestrator = new SyncOrchestratorService(mockDb)
    await orchestrator.start()

    // After reset, the sync should still be called (the sync service
    // will see initialSyncComplete=false and do a full sync)
    expect(mockGmailStartSync).toHaveBeenCalledWith('gmail:test@example.com')
  })

  // Subtask 6.4: Bankruptcy does not affect other accounts
  it('should not affect other accounts when one declares bankruptcy', async () => {
    // Account A: stale (should trigger bankruptcy)
    mockProgressData['gmail:stale@example.com'] = {
      accountId: 'gmail:stale@example.com',
      provider: 'gmail',
      emailsSynced: 500,
      lastSyncAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
      initialSyncComplete: true,
      syncToken: 'old-token',
    }

    // Account B: recent (should NOT trigger bankruptcy)
    mockProgressData['gmail:recent@example.com'] = {
      accountId: 'gmail:recent@example.com',
      provider: 'gmail',
      emailsSynced: 200,
      lastSyncAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
      initialSyncComplete: true,
      syncToken: 'fresh-token',
    }

    mockSyncBankruptcy.shouldDeclareBankruptcy.mockImplementation(
      (_accountId: string, _provider: string, lastSyncAt: number) => {
        const staleness = Date.now() - lastSyncAt
        if (staleness > SEVEN_DAYS_MS) {
          return { bankrupt: true, reason: 'Stale' }
        }
        return { bankrupt: false, reason: 'OK' }
      }
    )

    orchestrator = new SyncOrchestratorService(mockDb)
    await orchestrator.start()

    // Only stale account should trigger fresh sync reset
    expect(mockSyncBankruptcy.performFreshSyncReset).toHaveBeenCalledWith(
      'gmail:stale@example.com',
      'gmail',
      mockDb
    )
    expect(mockSyncBankruptcy.performFreshSyncReset).not.toHaveBeenCalledWith(
      'gmail:recent@example.com',
      expect.anything(),
      expect.anything()
    )

    // Both accounts should still have synced
    expect(mockGmailStartSync).toHaveBeenCalledWith('gmail:stale@example.com')
    expect(mockGmailStartSync).toHaveBeenCalledWith('gmail:recent@example.com')
  })

  it('should not check bankruptcy for accounts that have not completed initial sync', async () => {
    mockProgressData['gmail:new@example.com'] = {
      accountId: 'gmail:new@example.com',
      provider: 'gmail',
      emailsSynced: 0,
      lastSyncAt: 0,
      initialSyncComplete: false, // Never completed initial sync
    }

    orchestrator = new SyncOrchestratorService(mockDb)
    await orchestrator.start()

    // Should NOT check bankruptcy for accounts that haven't completed initial sync
    expect(mockSyncBankruptcy.shouldDeclareBankruptcy).not.toHaveBeenCalled()
    expect(mockSyncBankruptcy.performFreshSyncReset).not.toHaveBeenCalled()

    // Normal sync should proceed (initial sync)
    expect(mockGmailStartSync).toHaveBeenCalledWith('gmail:new@example.com')
  })

  it('should work correctly for Outlook accounts', async () => {
    mockProgressData['outlook:test@outlook.com'] = {
      accountId: 'outlook:test@outlook.com',
      provider: 'outlook',
      emailsSynced: 300,
      lastSyncAt: Date.now() - 14 * 24 * 60 * 60 * 1000, // 14 days ago
      initialSyncComplete: true,
      syncToken: 'old-delta-link',
    }

    mockSyncBankruptcy.shouldDeclareBankruptcy.mockReturnValue({
      bankrupt: true,
      reason: 'Outlook stale',
    })

    orchestrator = new SyncOrchestratorService(mockDb)
    await orchestrator.start()

    expect(mockSyncBankruptcy.shouldDeclareBankruptcy).toHaveBeenCalledWith(
      'outlook:test@outlook.com',
      'outlook',
      expect.any(Number)
    )
    expect(mockSyncBankruptcy.performFreshSyncReset).toHaveBeenCalledWith(
      'outlook:test@outlook.com',
      'outlook',
      mockDb
    )
    expect(mockOutlookStartSync).toHaveBeenCalledWith('outlook:test@outlook.com')
  })
})
