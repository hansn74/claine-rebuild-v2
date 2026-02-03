/**
 * Sync Bankruptcy Service Unit Tests
 *
 * Story 1.16: Sync Bankruptcy Detection
 * Task 5: Unit tests (AC 12-15)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { firstValueFrom, timeout } from 'rxjs'
import { SyncBankruptcyService } from '../syncBankruptcy'

// Hoist mock objects for vi.mock() factories (Story 1.15 pattern)
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}))

const mockBatchMode = vi.hoisted(() => ({
  enter: vi.fn(),
  exit: vi.fn(),
  isActive: vi.fn(() => false),
  subscribe: vi.fn(() => vi.fn()),
}))

const mockAdaptiveInterval = vi.hoisted(() => ({
  reset: vi.fn(),
  getInterval: vi.fn(() => 180_000),
  isEnabled: vi.fn(() => true),
  recordSyncResult: vi.fn(),
  recordUserAction: vi.fn(),
  setEnabled: vi.fn(),
  getState: vi.fn(),
}))

vi.mock('@/services/logger', () => ({
  logger: mockLogger,
}))

vi.mock('../../database/batchMode', () => ({
  batchMode: mockBatchMode,
}))

vi.mock('../adaptiveInterval', () => ({
  adaptiveInterval: mockAdaptiveInterval,
}))

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

describe('SyncBankruptcyService', () => {
  let service: SyncBankruptcyService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new SyncBankruptcyService()
  })

  describe('shouldDeclareBankruptcy()', () => {
    // Subtask 5.1 (AC 12): Recent sync → no bankruptcy
    it('should return bankrupt=false when lastSyncAt is less than 7 days ago', () => {
      const lastSyncAt = Date.now() - 3 * 24 * 60 * 60 * 1000 // 3 days ago
      const decision = service.shouldDeclareBankruptcy('account-1', 'gmail', lastSyncAt)

      expect(decision.bankrupt).toBe(false)
      expect(decision.reason).toContain('Within staleness threshold')
    })

    // Subtask 5.2 (AC 13): Gmail stale → bankruptcy
    it('should return bankrupt=true when lastSyncAt is more than 7 days ago for Gmail', () => {
      const lastSyncAt = Date.now() - 10 * 24 * 60 * 60 * 1000 // 10 days ago
      const decision = service.shouldDeclareBankruptcy('account-1', 'gmail', lastSyncAt)

      expect(decision.bankrupt).toBe(true)
      expect(decision.reason).toContain('Gmail')
      expect(decision.reason).toContain('Fresh sync preferred')
    })

    // Subtask 5.3 (AC 13): Outlook stale → bankruptcy
    it('should return bankrupt=true when lastSyncAt is more than 7 days ago for Outlook', () => {
      const lastSyncAt = Date.now() - 10 * 24 * 60 * 60 * 1000 // 10 days ago
      const decision = service.shouldDeclareBankruptcy('account-1', 'outlook', lastSyncAt)

      expect(decision.bankrupt).toBe(true)
      expect(decision.reason).toContain('Outlook')
      expect(decision.reason).toContain('Fresh sync preferred')
    })

    // Subtask 5.4: Never-synced accounts should not trigger bankruptcy
    it('should return bankrupt=false at exactly the threshold boundary', () => {
      const lastSyncAt = Date.now() - SEVEN_DAYS_MS // exactly 7 days
      const decision = service.shouldDeclareBankruptcy('account-1', 'gmail', lastSyncAt)

      expect(decision.bankrupt).toBe(false)
    })

    // Just past threshold
    it('should return bankrupt=true when slightly past threshold', () => {
      const lastSyncAt = Date.now() - SEVEN_DAYS_MS - 1000 // 7 days + 1 second
      const decision = service.shouldDeclareBankruptcy('account-1', 'gmail', lastSyncAt)

      expect(decision.bankrupt).toBe(true)
    })

    // Subtask 5.5: Custom threshold via env var
    it('should respect custom threshold from constructor config', () => {
      const customService = new SyncBankruptcyService({
        stalenessThresholdMs: 3 * 24 * 60 * 60 * 1000, // 3 days
      })

      // 4 days ago — should be bankrupt with 3-day threshold
      const lastSyncAt = Date.now() - 4 * 24 * 60 * 60 * 1000
      const decision = customService.shouldDeclareBankruptcy('account-1', 'gmail', lastSyncAt)

      expect(decision.bankrupt).toBe(true)
    })

    it('should not declare bankruptcy when within custom threshold', () => {
      const customService = new SyncBankruptcyService({
        stalenessThresholdMs: 14 * 24 * 60 * 60 * 1000, // 14 days
      })

      // 10 days ago — should NOT be bankrupt with 14-day threshold
      const lastSyncAt = Date.now() - 10 * 24 * 60 * 60 * 1000
      const decision = customService.shouldDeclareBankruptcy('account-1', 'gmail', lastSyncAt)

      expect(decision.bankrupt).toBe(false)
    })

    // Subtask 5.9: Bankruptcy decision is logged
    it('should log bankruptcy decision when declared', () => {
      const lastSyncAt = Date.now() - 10 * 24 * 60 * 60 * 1000
      service.shouldDeclareBankruptcy('account-1', 'gmail', lastSyncAt)

      expect(mockLogger.info).toHaveBeenCalledWith(
        'sync-bankruptcy',
        'Bankruptcy declared',
        expect.objectContaining({
          accountId: 'account-1',
          provider: 'gmail',
        })
      )
    })

    it('should not log when bankruptcy is not declared', () => {
      const lastSyncAt = Date.now() - 1 * 24 * 60 * 60 * 1000
      service.shouldDeclareBankruptcy('account-1', 'gmail', lastSyncAt)

      expect(mockLogger.info).not.toHaveBeenCalled()
    })
  })

  describe('performFreshSyncReset()', () => {
    const createMockDb = (emailCount = 5) => {
      const mockEmailDocs = Array.from({ length: emailCount }, (_, i) => ({
        id: `email-${i}`,
        accountId: 'account-1',
      }))

      const mockSyncState = {
        update: vi.fn().mockResolvedValue(undefined),
      }

      return {
        emails: {
          find: vi.fn().mockReturnValue({
            remove: vi.fn().mockResolvedValue(mockEmailDocs),
          }),
        },
        syncState: {
          findOne: vi.fn().mockReturnValue({
            exec: vi.fn().mockResolvedValue(mockSyncState),
          }),
        },
        drafts: {
          find: vi.fn(),
        },
      } as unknown as import('../../database/types').AppDatabase
    }

    // Subtask 5.6 (AC 14): Deletes emails but not drafts
    it('should delete emails for the account', async () => {
      const db = createMockDb(10)
      await service.performFreshSyncReset('account-1', 'gmail', db)

      expect(db.emails!.find).toHaveBeenCalledWith({ selector: { accountId: 'account-1' } })
    })

    it('should NOT touch drafts collection', async () => {
      const db = createMockDb()
      await service.performFreshSyncReset('account-1', 'gmail', db)

      // Drafts should never be accessed
      expect(db.drafts!.find).not.toHaveBeenCalled()
    })

    // Subtask 5.7: Resets sync state fields
    it('should reset sync state fields', async () => {
      const mockSyncState = {
        update: vi.fn().mockResolvedValue(undefined),
      }
      const db = {
        emails: {
          find: vi.fn().mockReturnValue({
            remove: vi.fn().mockResolvedValue([]),
          }),
        },
        syncState: {
          findOne: vi.fn().mockReturnValue({
            exec: vi.fn().mockResolvedValue(mockSyncState),
          }),
        },
      } as unknown as import('../../database/types').AppDatabase

      await service.performFreshSyncReset('account-1', 'gmail', db)

      expect(mockSyncState.update).toHaveBeenCalledWith({
        $set: expect.objectContaining({
          initialSyncComplete: false,
          syncToken: '',
          pageToken: '',
          emailsSynced: 0,
          progressPercentage: 0,
        }),
      })
    })

    it('should reset adaptive interval for the account', async () => {
      const db = createMockDb()
      await service.performFreshSyncReset('account-1', 'gmail', db)

      expect(mockAdaptiveInterval.reset).toHaveBeenCalledWith('account-1')
    })

    it('should use batch mode during email deletion', async () => {
      const db = createMockDb()
      await service.performFreshSyncReset('account-1', 'gmail', db)

      expect(mockBatchMode.enter).toHaveBeenCalled()
      expect(mockBatchMode.exit).toHaveBeenCalled()
    })

    it('should exit batch mode even if deletion fails', async () => {
      const db = {
        emails: {
          find: vi.fn().mockReturnValue({
            remove: vi.fn().mockRejectedValue(new Error('DB error')),
          }),
        },
        syncState: {
          findOne: vi.fn().mockReturnValue({
            exec: vi.fn().mockResolvedValue(null),
          }),
        },
      } as unknown as import('../../database/types').AppDatabase

      await expect(service.performFreshSyncReset('account-1', 'gmail', db)).rejects.toThrow()
      expect(mockBatchMode.exit).toHaveBeenCalled()
    })

    // Subtask 5.8 (AC 15): Bankruptcy event emitted
    it('should emit bankruptcy event after reset with correct provider', async () => {
      const db = createMockDb()

      const eventPromise = firstValueFrom(service.getEvents$().pipe(timeout({ first: 1000 })))

      await service.performFreshSyncReset('account-1', 'gmail', db)

      const event = await eventPromise
      expect(event).toEqual(
        expect.objectContaining({
          accountId: 'account-1',
          provider: 'gmail',
          timestamp: expect.any(Number),
        })
      )
    })

    it('should log the reset', async () => {
      const db = createMockDb(3)
      await service.performFreshSyncReset('account-1', 'gmail', db)

      expect(mockLogger.info).toHaveBeenCalledWith(
        'sync-bankruptcy',
        'Fresh sync reset complete',
        expect.objectContaining({
          accountId: 'account-1',
          emailsDeleted: 3,
        })
      )
    })

    it('should handle missing emails collection gracefully', async () => {
      const mockSyncState = {
        update: vi.fn().mockResolvedValue(undefined),
      }
      const db = {
        emails: undefined,
        syncState: {
          findOne: vi.fn().mockReturnValue({
            exec: vi.fn().mockResolvedValue(mockSyncState),
          }),
        },
      } as unknown as import('../../database/types').AppDatabase

      // Should not throw
      await service.performFreshSyncReset('account-1', 'gmail', db)
    })

    it('should handle missing syncState collection gracefully', async () => {
      const db = {
        emails: {
          find: vi.fn().mockReturnValue({
            remove: vi.fn().mockResolvedValue([]),
          }),
        },
        syncState: undefined,
      } as unknown as import('../../database/types').AppDatabase

      // Should not throw
      await service.performFreshSyncReset('account-1', 'gmail', db)
    })
  })

  describe('getConfig()', () => {
    it('should return a copy of the config', () => {
      const config = service.getConfig()
      expect(config.stalenessThresholdMs).toBe(SEVEN_DAYS_MS)
    })
  })

  describe('getEvents$()', () => {
    it('should return an observable', () => {
      const events$ = service.getEvents$()
      expect(events$).toBeDefined()
      expect(typeof events$.subscribe).toBe('function')
    })
  })
})
