/**
 * Cleanup Flow Integration Tests
 *
 * AC 22: Integration test: Full cleanup flow from warning to storage freed
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { QuotaMonitorService, resetQuotaMonitorService } from '../quotaMonitor'
import { getStorageBreakdown, estimateStorageReduction } from '../storageBreakdown'
import { CleanupService } from '../cleanupService'
import type { AppDatabase } from '../../database/types'

// Mock navigator.storage.estimate
const mockEstimate = vi.fn()

// Create mock email documents
const createMockEmailDoc = (
  overrides: Partial<{
    id: string
    accountId: string
    timestamp: number
    body: { html?: string; text?: string }
    attachments: Array<{ size: number }>
  }> = {}
) => {
  const email = {
    id: overrides.id ?? crypto.randomUUID(),
    accountId: overrides.accountId ?? 'test-account',
    timestamp: overrides.timestamp ?? Date.now(),
    body: overrides.body ?? { html: 'test content', text: 'test content' },
    attachments: overrides.attachments ?? [],
  }

  return {
    ...email,
    remove: vi.fn().mockResolvedValue(undefined),
    toJSON: () => email,
  }
}

// Create mock database with configurable email data
const createMockDb = (emailDocs: ReturnType<typeof createMockEmailDoc>[] = []) => {
  return {
    emails: {
      find: vi.fn().mockImplementation((query?: { selector?: Record<string, unknown> }) => ({
        exec: vi.fn().mockImplementation(async () => {
          let results = [...emailDocs]

          // Apply basic filtering based on selector
          if (query?.selector) {
            const sel = query.selector

            // Filter by accountId
            if (sel.accountId && typeof sel.accountId === 'object' && '$in' in sel.accountId) {
              const accounts = sel.accountId.$in as string[]
              results = results.filter((e) => accounts.includes(e.accountId))
            } else if (typeof sel.accountId === 'string') {
              results = results.filter((e) => e.accountId === sel.accountId)
            }

            // Filter by timestamp
            if (sel.timestamp && typeof sel.timestamp === 'object' && '$lt' in sel.timestamp) {
              const cutoff = sel.timestamp.$lt as number
              results = results.filter((e) => e.timestamp < cutoff)
            }
          }

          return results
        }),
      })),
    },
  } as unknown as AppDatabase
}

describe('Cleanup Flow Integration', () => {
  beforeEach(() => {
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

  /**
   * AC 22: Integration test: Full cleanup flow from 90% threshold → wizard → execution → storage freed
   */
  describe('Full cleanup flow', () => {
    it('detects critical threshold, estimates cleanup, and executes', async () => {
      // Step 1: Set up quota at 90% (critical threshold)
      const initialUsage = 1.8 * 1024 * 1024 * 1024 // 1.8 GB
      const totalQuota = 2 * 1024 * 1024 * 1024 // 2 GB
      mockEstimate.mockResolvedValue({
        usage: initialUsage,
        quota: totalQuota,
      })

      // Step 2: Monitor detects critical status
      const quotaMonitor = new QuotaMonitorService()
      const initialState = await quotaMonitor.checkStorageQuota()

      expect(initialState.status).toBe('critical')
      expect(initialState.percentage).toBe(90)

      // Step 3: Set up mock database with old emails
      const now = Date.now()
      const twoYearsAgo = now - 2 * 365 * 24 * 60 * 60 * 1000
      const threeYearsAgo = now - 3 * 365 * 24 * 60 * 60 * 1000

      const oldEmails = [
        createMockEmailDoc({
          id: 'old-1',
          timestamp: threeYearsAgo,
          body: { html: 'x'.repeat(100000), text: 'y'.repeat(50000) },
        }),
        createMockEmailDoc({
          id: 'old-2',
          timestamp: twoYearsAgo,
          body: { html: 'x'.repeat(200000), text: 'y'.repeat(100000) },
        }),
        createMockEmailDoc({
          id: 'recent',
          timestamp: now - 30 * 24 * 60 * 60 * 1000, // 30 days ago
          body: { html: 'small content' },
        }),
      ]

      const mockDb = createMockDb(oldEmails)

      // Step 4: Get storage breakdown (wizard overview)
      const breakdown = await getStorageBreakdown(mockDb)

      expect(breakdown.totalEmails).toBe(3)
      expect(breakdown.totalEstimatedSize).toBeGreaterThan(0)
      expect(breakdown.byAge.length).toBeGreaterThan(0)

      // Step 5: Estimate cleanup for emails older than 1 year
      const estimate = await estimateStorageReduction(mockDb, {
        olderThanDays: 365,
      })

      expect(estimate.emailCount).toBe(2) // Two emails older than 1 year
      expect(estimate.estimatedFreedBytes).toBeGreaterThan(0)

      // Step 6: Execute cleanup
      const cleanupService = new CleanupService(mockDb)
      const result = await cleanupService.cleanupByAge(365)

      expect(result.deletedCount).toBe(2)
      expect(result.freedBytes).toBeGreaterThan(0)
      expect(result.accountsAffected).toContain('test-account')

      // Step 7: Verify quota should be lower after cleanup
      // (In real scenario, IndexedDB usage would decrease)
      const newUsage = initialUsage - result.freedBytes
      mockEstimate.mockResolvedValue({
        usage: newUsage,
        quota: totalQuota,
      })

      const newState = await quotaMonitor.checkStorageQuota()

      // If enough was freed, status should improve
      expect(newState.usage).toBeLessThan(initialState.usage)
    })

    it('handles complete flow from warning through cleanup completion', async () => {
      // Set up at 85% (warning threshold)
      mockEstimate.mockResolvedValue({
        usage: 850,
        quota: 1000,
      })

      // Monitor detects warning
      const quotaMonitor = new QuotaMonitorService()
      const state = await quotaMonitor.checkStorageQuota()
      expect(state.status).toBe('warning')

      // Set up emails
      const emails = [
        createMockEmailDoc({
          id: '1',
          accountId: 'account-a',
          body: { html: 'content'.repeat(1000) },
        }),
        createMockEmailDoc({
          id: '2',
          accountId: 'account-b',
          body: { html: 'content'.repeat(2000) },
        }),
      ]

      const mockDb = createMockDb(emails)

      // Get breakdown
      const breakdown = await getStorageBreakdown(mockDb)
      expect(breakdown.byAccount.length).toBe(2)

      // Estimate for specific account
      const estimate = await estimateStorageReduction(mockDb, {
        accountIds: ['account-a'],
      })
      expect(estimate.emailCount).toBe(1)

      // Execute cleanup
      const cleanupService = new CleanupService(mockDb)
      const progressUpdates: string[] = []

      const result = await cleanupService.executeCleanup(
        { accountIds: ['account-a'] },
        (progress) => progressUpdates.push(progress.phase)
      )

      expect(result.deletedCount).toBe(1)
      expect(progressUpdates).toContain('counting')
      expect(progressUpdates).toContain('deleting')
      expect(progressUpdates).toContain('complete')
    })
  })

  describe('Mock navigator.storage.estimate behavior', () => {
    it('correctly mocks storage estimate', async () => {
      mockEstimate.mockResolvedValue({
        usage: 500 * 1024 * 1024,
        quota: 1024 * 1024 * 1024,
      })

      const estimate = await navigator.storage.estimate()

      expect(estimate.usage).toBe(500 * 1024 * 1024)
      expect(estimate.quota).toBe(1024 * 1024 * 1024)
    })
  })

  describe('Multi-step cleanup scenarios', () => {
    it('handles cleanup by multiple criteria', async () => {
      const now = Date.now()

      const emails = [
        // Old and large - should be cleaned
        createMockEmailDoc({
          id: 'old-large',
          timestamp: now - 400 * 24 * 60 * 60 * 1000,
          body: { html: 'x'.repeat(2000000) }, // ~2MB
        }),
        // Old but small - should not be cleaned (below size threshold)
        createMockEmailDoc({
          id: 'old-small',
          timestamp: now - 400 * 24 * 60 * 60 * 1000,
          body: { html: 'small' },
        }),
        // Recent and large - should not be cleaned (not old enough)
        createMockEmailDoc({
          id: 'recent-large',
          timestamp: now - 30 * 24 * 60 * 60 * 1000,
          body: { html: 'x'.repeat(2000000) },
        }),
      ]

      const mockDb = createMockDb(emails)

      // Estimate with both age and size criteria
      const estimate = await estimateStorageReduction(mockDb, {
        olderThanDays: 365,
        minSizeBytes: 1024 * 1024, // 1MB
      })

      expect(estimate.emailCount).toBe(1) // Only old-large
    })

    it('tracks account distribution during cleanup', async () => {
      const emails = [
        createMockEmailDoc({ id: '1', accountId: 'account-1' }),
        createMockEmailDoc({ id: '2', accountId: 'account-1' }),
        createMockEmailDoc({ id: '3', accountId: 'account-2' }),
      ]

      const mockDb = createMockDb(emails)

      const breakdown = await getStorageBreakdown(mockDb)

      // Should have two accounts in breakdown
      expect(breakdown.byAccount.length).toBe(2)

      const account1 = breakdown.byAccount.find((a) => a.accountId === 'account-1')
      const account2 = breakdown.byAccount.find((a) => a.accountId === 'account-2')

      expect(account1?.emailCount).toBe(2)
      expect(account2?.emailCount).toBe(1)
    })
  })

  describe('Error handling in flow', () => {
    it('gracefully handles empty database', async () => {
      const mockDb = createMockDb([])

      const breakdown = await getStorageBreakdown(mockDb)
      expect(breakdown.totalEmails).toBe(0)
      expect(breakdown.byAccount).toEqual([])
      expect(breakdown.byAge).toEqual([])
      expect(breakdown.bySize).toEqual([])

      const estimate = await estimateStorageReduction(mockDb, {
        olderThanDays: 365,
      })
      expect(estimate.emailCount).toBe(0)
      expect(estimate.estimatedFreedBytes).toBe(0)
    })

    it('handles cleanup when no emails match criteria', async () => {
      const recentEmails = [
        createMockEmailDoc({
          timestamp: Date.now() - 10 * 24 * 60 * 60 * 1000, // 10 days ago
        }),
      ]

      const mockDb = createMockDb(recentEmails)
      const cleanupService = new CleanupService(mockDb)

      // Try to clean emails older than 1 year (none exist)
      const result = await cleanupService.cleanupByAge(365)

      expect(result.deletedCount).toBe(0)
      expect(result.freedBytes).toBe(0)
    })
  })
})
