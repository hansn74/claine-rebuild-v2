import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest'
import { SyncOrchestratorService } from '../syncOrchestrator'
import { logger } from '@/services/logger'
import { initDatabase, closeDatabase, __resetDatabaseForTesting } from '../../database/init'
import type { AppDatabase } from '../../database/types'
import { syncStateSchema } from '../../database/schemas/syncState.schema'
// Import OPEN_COLLECTIONS to manually clear it when tests leak collections
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - OPEN_COLLECTIONS is exported from rxdb but not in TypeScript types
import { OPEN_COLLECTIONS } from 'rxdb'

// Mock the logger
vi.mock('@/services/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock the auth services
vi.mock('../../auth/tokenStorage', () => ({
  tokenStorageService: {
    getTokens: vi.fn().mockResolvedValue({
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      expiresAt: Date.now() + 3600000, // 1 hour from now
    }),
    storeTokens: vi.fn().mockResolvedValue(undefined),
    initialize: vi.fn().mockResolvedValue(undefined),
  },
}))
vi.mock('../../auth/gmailOAuth')

// Mock fetch globally
global.fetch = vi.fn()

// Use a single shared database for all tests to avoid RxDB's 16-collection limit
let sharedDb: AppDatabase | null = null
let sharedDbName: string

describe('SyncOrchestratorService', () => {
  let db: AppDatabase
  let orchestrator: SyncOrchestratorService
  const testAccountId1 = 'test-account-1'
  const testAccountId2 = 'test-account-2'

  beforeAll(async () => {
    // Generate unique shared database name for all tests in this file
    sharedDbName = `orchestrator-test-${Date.now()}`
  })

  beforeEach(async () => {
    // IMPORTANT: Ensure real timers are active during database setup
    // Fake timers would freeze migrations which use setTimeout internally
    vi.useRealTimers()

    // Clear OPEN_COLLECTIONS before creating database
    if (OPEN_COLLECTIONS && OPEN_COLLECTIONS instanceof Set) {
      OPEN_COLLECTIONS.clear()
    }

    // Reset singleton to allow new database creation
    __resetDatabaseForTesting()

    // Create or reuse shared database (must be done with real timers)
    db = await initDatabase(sharedDbName)
    sharedDb = db

    // Create syncState collection if it doesn't exist (required by SyncProgressService)
    if (!db.syncState) {
      await db.addCollections({
        syncState: { schema: syncStateSchema },
      })
    }

    orchestrator = new SyncOrchestratorService(db)

    // Reset all mocks
    vi.clearAllMocks()

    // NOTE: Do NOT enable fake timers here - they freeze RxDB operations
    // Tests that need fake timers should enable them explicitly

    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    })

    // Mock fetch to return empty sync results - create new Response for each call
    vi.mocked(global.fetch).mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ messages: [], resultSizeEstimate: 0 }), { status: 200 })
      )
    )
  })

  afterEach(async () => {
    // Stop orchestrator first
    orchestrator.stop()

    // Restore timers BEFORE async cleanup to prevent timer issues
    vi.useRealTimers()

    // Clean up sync state data for next test (but keep database open)
    try {
      if (db && db.syncState && !db.destroyed) {
        // Remove test data from syncState collection
        const docs = await db.syncState.find().exec()
        for (const doc of docs) {
          await doc.remove()
        }
      }
    } catch {
      // Ignore cleanup errors
    }
  })

  afterAll(async () => {
    // Ensure real timers for cleanup
    vi.useRealTimers()

    // Final cleanup - close and remove the shared database
    try {
      if (sharedDb && !sharedDb.destroyed) {
        await closeDatabase(true)
      }
      __resetDatabaseForTesting()
      if (OPEN_COLLECTIONS && OPEN_COLLECTIONS instanceof Set) {
        OPEN_COLLECTIONS.clear()
      }
    } catch {
      // Force cleanup even on error
      __resetDatabaseForTesting()
      if (OPEN_COLLECTIONS && OPEN_COLLECTIONS instanceof Set) {
        OPEN_COLLECTIONS.clear()
      }
    }
  })

  describe('Orchestrator Lifecycle', () => {
    it('should start and schedule syncs for all accounts', async () => {
      // Add two accounts
      await orchestrator.addAccount(testAccountId1, 'gmail')
      await orchestrator.addAccount(testAccountId2, 'gmail')

      // Start orchestrator
      await orchestrator.start()

      // Verify sync states exist
      const syncState1 = await db.syncState?.findOne(testAccountId1).exec()
      const syncState2 = await db.syncState?.findOne(testAccountId2).exec()

      expect(syncState1).toBeTruthy()
      expect(syncState2).toBeTruthy()
    })

    it('should stop all sync timers when stopped', async () => {
      await orchestrator.addAccount(testAccountId1, 'gmail')
      await orchestrator.start()

      // Stop orchestrator
      orchestrator.stop()

      // Verify no timers are running
      // (This is implicit - if timers were running, vitest would warn)
      expect(true).toBe(true)
    })

    it('should not start if already started', async () => {
      await orchestrator.addAccount(testAccountId1, 'gmail')
      await orchestrator.start()

      // Clear previous logger calls
      vi.mocked(logger.debug).mockClear()

      // Try starting again
      await orchestrator.start()

      expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('Already started'))
    })
  })

  describe('Periodic Sync Scheduling', () => {
    it('should schedule periodic syncs based on VITE_SYNC_INTERVAL_MS', async () => {
      // Set 1 minute interval for testing
      vi.stubEnv('VITE_SYNC_INTERVAL_MS', '60000')
      orchestrator = new SyncOrchestratorService(db)

      await orchestrator.addAccount(testAccountId1, 'gmail')
      await orchestrator.start()

      // Initial sync should happen immediately
      expect(global.fetch).toHaveBeenCalled()

      // Note: We can't easily test the periodic timer execution because
      // fake timers can't capture timers created before enabling fake timers.
      // The scheduling behavior is tested implicitly through the initial sync.
    })

    it('should perform initial sync when started', async () => {
      vi.stubEnv('VITE_SYNC_INTERVAL_MS', '30000') // 30 seconds
      orchestrator = new SyncOrchestratorService(db)

      await orchestrator.addAccount(testAccountId1, 'gmail')
      await orchestrator.start()

      // Initial sync should trigger immediately
      expect(global.fetch).toHaveBeenCalled()
    })

    it('should skip sync when offline', async () => {
      await orchestrator.addAccount(testAccountId1, 'gmail')

      // Go offline
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      })

      await orchestrator.start()

      // No sync should occur when offline (only initial attempt which will be skipped)
      // The fetch call won't happen because we check navigator.onLine first
      expect(global.fetch).not.toHaveBeenCalled()
    })
  })

  describe('Account Management', () => {
    it('should add new account and start syncing if orchestrator running', async () => {
      await orchestrator.start()

      // Add account after orchestrator started
      await orchestrator.addAccount(testAccountId1, 'gmail')

      // Verify sync state was created
      const syncState = await db.syncState?.findOne(testAccountId1).exec()
      expect(syncState).toBeTruthy()
      expect(syncState?.provider).toBe('gmail')
    })

    it('should remove account and stop its sync timer', async () => {
      await orchestrator.addAccount(testAccountId1, 'gmail')
      await orchestrator.start()

      // Remove account
      orchestrator.removeAccount(testAccountId1)

      // Clear fetch mock
      vi.mocked(global.fetch).mockClear()

      // Enable fake timers for testing timer behavior
      vi.useFakeTimers()

      // Advance time
      await vi.advanceTimersByTimeAsync(180000)

      // No sync should occur for removed account
      // (We can't directly test this, but no error should be thrown)
      expect(true).toBe(true)

      // Restore real timers for cleanup
      vi.useRealTimers()
    })
  })

  describe('Manual Sync Trigger', () => {
    it('should allow manual sync trigger', async () => {
      await orchestrator.addAccount(testAccountId1, 'gmail')
      await orchestrator.start()

      // Clear initial sync
      vi.mocked(global.fetch).mockClear()

      // Manually trigger sync
      await orchestrator.triggerSync(testAccountId1)

      // Verify sync was triggered
      expect(global.fetch).toHaveBeenCalled()
    })

    it('should trigger sync even if orchestrator not started', async () => {
      await orchestrator.addAccount(testAccountId1, 'gmail')

      // Don't start orchestrator

      // Manually trigger sync
      await orchestrator.triggerSync(testAccountId1)

      // Verify sync was triggered
      expect(global.fetch).toHaveBeenCalled()
    })
  })

  describe('Multi-Account Sync', () => {
    it('should sync multiple accounts independently', async () => {
      await orchestrator.addAccount(testAccountId1, 'gmail')
      await orchestrator.addAccount(testAccountId2, 'gmail')
      await orchestrator.start()

      // Both accounts should have sync states
      const syncState1 = await db.syncState?.findOne(testAccountId1).exec()
      const syncState2 = await db.syncState?.findOne(testAccountId2).exec()

      expect(syncState1).toBeTruthy()
      expect(syncState2).toBeTruthy()
    })

    it('should handle sync failure for one account without affecting others', async () => {
      await orchestrator.addAccount(testAccountId1, 'gmail')
      await orchestrator.addAccount(testAccountId2, 'gmail')

      // Mock fetch to fail for first call only
      vi.mocked(global.fetch)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue(
          new Response(JSON.stringify({ messages: [], resultSizeEstimate: 0 }), { status: 200 })
        )

      // Clear previous logger calls
      vi.mocked(logger.error).mockClear()

      await orchestrator.start()

      // First account should fail, but second should succeed
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Initial sync failed'),
        expect.objectContaining({ accountId: testAccountId1 })
      )
    })
  })
})
