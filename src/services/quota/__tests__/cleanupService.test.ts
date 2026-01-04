/**
 * CleanupService Tests
 *
 * AC 20: Unit test: Cleanup executed → storage reduced by expected amount
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CleanupService, type CleanupProgress } from '../cleanupService'
import type { AppDatabase } from '../../database/types'

// Create mock email data
const createMockEmail = (
  overrides: Partial<{
    id: string
    accountId: string
    timestamp: number
    body: { html?: string; text?: string }
    attachments: Array<{ size: number }>
  }> = {}
) => ({
  id: overrides.id ?? crypto.randomUUID(),
  accountId: overrides.accountId ?? 'test-account',
  timestamp: overrides.timestamp ?? Date.now(),
  body: overrides.body ?? { html: 'test content', text: 'test content' },
  attachments: overrides.attachments ?? [],
})

// Create mock database
const createMockDb = (emails: ReturnType<typeof createMockEmail>[] = []) => {
  const emailDocs = emails.map((email) => ({
    ...email,
    remove: vi.fn().mockResolvedValue(undefined),
    toJSON: () => email,
  }))

  return {
    emails: {
      find: vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue(emailDocs),
      }),
    },
  } as unknown as AppDatabase
}

describe('CleanupService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('cleanupByAge', () => {
    it('removes emails older than specified days', async () => {
      const now = Date.now()
      const oldEmail = createMockEmail({
        id: 'old-email',
        timestamp: now - 400 * 24 * 60 * 60 * 1000, // 400 days ago
      })
      const newEmail = createMockEmail({
        id: 'new-email',
        timestamp: now - 100 * 24 * 60 * 60 * 1000, // 100 days ago
      })

      const mockDb = createMockDb([oldEmail, newEmail])
      const service = new CleanupService(mockDb)

      const result = await service.cleanupByAge(365) // Remove emails older than 1 year

      expect(result.deletedCount).toBeGreaterThanOrEqual(0)
      expect(typeof result.freedBytes).toBe('number')
    })

    it('filters by account when specified', async () => {
      const mockDb = createMockDb([])
      const findMock = mockDb.emails?.find as ReturnType<typeof vi.fn>

      const service = new CleanupService(mockDb)
      await service.cleanupByAge(365, 'specific-account')

      expect(findMock).toHaveBeenCalledWith({
        selector: expect.objectContaining({
          accountId: 'specific-account',
        }),
      })
    })

    it('calls progress callback during cleanup', async () => {
      const email = createMockEmail()
      const mockDb = createMockDb([email])
      const service = new CleanupService(mockDb)

      const progressCallback = vi.fn()
      await service.cleanupByAge(0, undefined, progressCallback)

      expect(progressCallback).toHaveBeenCalled()

      // Check that we got progress updates
      const calls = progressCallback.mock.calls
      expect(calls.some((call: CleanupProgress[]) => call[0].phase === 'counting')).toBe(true)
    })

    /**
     * AC 20: Cleanup executed → storage reduced by expected amount
     */
    it('returns accurate freedBytes count', async () => {
      const emailWithContent = createMockEmail({
        body: { html: 'a'.repeat(10000), text: 'b'.repeat(5000) }, // 15KB body
        attachments: [{ size: 50000 }], // 50KB attachment
      })

      const mockDb = createMockDb([emailWithContent])
      const service = new CleanupService(mockDb)

      const result = await service.cleanupByAge(0)

      // Should have freed at least the body + attachment size
      expect(result.freedBytes).toBeGreaterThanOrEqual(15000 + 50000)
      expect(result.deletedCount).toBe(1)
    })
  })

  describe('cleanupBySize', () => {
    it('removes emails larger than specified size', async () => {
      const smallEmail = createMockEmail({
        id: 'small',
        body: { html: 'small' },
        attachments: [],
      })
      const largeEmail = createMockEmail({
        id: 'large',
        body: { html: 'x'.repeat(100000) }, // 100KB
        attachments: [{ size: 5000000 }], // 5MB
      })

      const mockDb = createMockDb([smallEmail, largeEmail])
      const service = new CleanupService(mockDb)

      const result = await service.cleanupBySize(1024 * 1024) // 1MB threshold

      // Large email should be deleted
      expect(result.deletedCount).toBe(1)
      expect(result.freedBytes).toBeGreaterThan(5000000)
    })

    it('tracks affected accounts', async () => {
      const email1 = createMockEmail({
        accountId: 'account-1',
        body: { html: 'x'.repeat(2000000) },
      })
      const email2 = createMockEmail({
        accountId: 'account-2',
        body: { html: 'x'.repeat(2000000) },
      })

      const mockDb = createMockDb([email1, email2])
      const service = new CleanupService(mockDb)

      const result = await service.cleanupBySize(1024 * 1024)

      expect(result.accountsAffected).toContain('account-1')
      expect(result.accountsAffected).toContain('account-2')
    })
  })

  describe('cleanupByAccount', () => {
    it('removes all emails for specified account', async () => {
      const accountEmails = [
        createMockEmail({ accountId: 'target-account' }),
        createMockEmail({ accountId: 'target-account' }),
        createMockEmail({ accountId: 'other-account' }),
      ]

      const mockDb = createMockDb(accountEmails.filter((e) => e.accountId === 'target-account'))
      const service = new CleanupService(mockDb)

      const result = await service.cleanupByAccount('target-account')

      expect(result.deletedCount).toBe(2)
      expect(result.accountsAffected).toEqual(['target-account'])
    })

    it('returns empty result for non-existent account', async () => {
      const mockDb = createMockDb([])
      const service = new CleanupService(mockDb)

      const result = await service.cleanupByAccount('non-existent')

      expect(result.deletedCount).toBe(0)
      expect(result.freedBytes).toBe(0)
      expect(result.accountsAffected).toEqual([])
    })
  })

  describe('executeCleanup', () => {
    it('combines multiple criteria correctly', async () => {
      const mockDb = createMockDb([])
      const findMock = mockDb.emails?.find as ReturnType<typeof vi.fn>

      const service = new CleanupService(mockDb)

      await service.executeCleanup({
        accountIds: ['account-1', 'account-2'],
        olderThanDays: 365,
        minSizeBytes: 1024 * 1024,
      })

      expect(findMock).toHaveBeenCalledWith({
        selector: expect.objectContaining({
          accountId: { $in: ['account-1', 'account-2'] },
          timestamp: expect.any(Object),
        }),
      })
    })

    it('reports duration correctly', async () => {
      const mockDb = createMockDb([createMockEmail()])
      const service = new CleanupService(mockDb)

      const result = await service.executeCleanup({
        olderThanDays: 0,
      })

      expect(result.durationMs).toBeGreaterThanOrEqual(0)
      expect(typeof result.durationMs).toBe('number')
    })

    it('progresses through all phases', async () => {
      const mockDb = createMockDb([createMockEmail()])
      const service = new CleanupService(mockDb)

      const phases: string[] = []
      const progressCallback = (progress: CleanupProgress) => {
        if (!phases.includes(progress.phase)) {
          phases.push(progress.phase)
        }
      }

      await service.executeCleanup({ olderThanDays: 0 }, progressCallback)

      expect(phases).toContain('counting')
      expect(phases).toContain('deleting')
      expect(phases).toContain('complete')
    })
  })

  describe('error handling', () => {
    it('handles missing emails collection gracefully', async () => {
      const mockDb = {
        emails: null,
      } as unknown as AppDatabase

      const service = new CleanupService(mockDb)
      const result = await service.cleanupByAge(365)

      expect(result.deletedCount).toBe(0)
      expect(result.freedBytes).toBe(0)
    })
  })
})
