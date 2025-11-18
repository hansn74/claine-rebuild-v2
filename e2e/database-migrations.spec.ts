import { test, expect } from '@playwright/test'

// Configure tests to run serially to avoid database conflicts
test.describe.configure({ mode: 'serial' })

// Define Window interface extension for test helpers
interface TestHelpers {
  setVersion: (version: number) => Promise<void>
  getVersion: () => Promise<number>
  insertMetadata: (data: Record<string, unknown>) => Promise<void>
  queryMetadata: (query: Record<string, unknown>) => Promise<unknown[]>
  clearTestData: () => Promise<void>
}

declare global {
  interface Window {
    testHelpers?: TestHelpers
  }
}

/**
 * E2E Tests for Database Migration Persistence
 *
 * These tests validate that RxDB migrations work correctly with real IndexedDB
 * across browser sessions (database close/reopen cycles via page reloads).
 * They complement unit tests which use fake-indexeddb.
 *
 * Test Coverage:
 * - Version persistence across page reloads (simulates browser sessions)
 * - Migration log persistence across sessions
 * - Data integrity after migrations persist
 * - Real IndexedDB validation
 *
 * Related:
 * - Story: docs/stories/1-3f-add-migration-e2e-tests.md
 * - Skipped unit test: src/services/database/__tests__/versionTracker.test.ts:228
 * - Migration docs: docs/database-migrations.md
 */

test.describe('Database Migration Persistence', () => {
  test.beforeEach(async ({ page, context }) => {
    // Start fresh - clear everything and navigate
    await context.clearCookies()

    // Delete all IndexedDB databases before starting
    await page.goto('/')
    await page.waitForTimeout(1000) // Wait for page to fully load

    await page.evaluate(async () => {
      // Get all databases
      const dbs = await indexedDB.databases()

      // Delete each one and wait for completion
      const deletions = dbs.map((db) => {
        return new Promise((resolve) => {
          if (db.name) {
            const request = indexedDB.deleteDatabase(db.name)
            request.onsuccess = () => resolve(true)
            request.onerror = () => resolve(false)
            request.onblocked = () => {
              // Force close any open connections
              setTimeout(() => resolve(false), 1000)
            }
          } else {
            resolve(true)
          }
        })
      })

      await Promise.all(deletions)

      // Wait a bit to ensure deletion is complete
      await new Promise((resolve) => setTimeout(resolve, 500))
    })

    // Force reload to start completely fresh
    await page.goto('/', { waitUntil: 'networkidle' })

    // Wait for database to be ready with a more flexible matcher
    await expect(page.getByText(/Database Ready/i)).toBeVisible({
      timeout: 20000,
    })

    // Verify test helpers are available
    const helpersAvailable = await page.evaluate(() => {
      return typeof window.testHelpers !== 'undefined'
    })

    if (!helpersAvailable) {
      throw new Error('Test helpers not available on window object')
    }
  })

  test.afterEach(async ({ page }) => {
    // Clean up test data after each test
    try {
      await page.evaluate(async () => {
        const helpers = window.testHelpers
        if (helpers) {
          await helpers.clearTestData()
        }
      })
    } catch (error) {
      // Ignore cleanup errors
      // eslint-disable-next-line no-console
      console.log('Test cleanup warning:', error)
    }
  })

  test.describe('Version Persistence (AC 2)', () => {
    test('should persist version metadata across page reloads', async ({ page }) => {
      // Set version to 1 (valid version within LATEST_SCHEMA_VERSION)
      await page.evaluate(async () => {
        const helpers = window.testHelpers!
        await helpers.setVersion(1)
      })

      // Verify version was set
      const initialVersion = await page.evaluate(async () => {
        const helpers = window.testHelpers!
        return await helpers.getVersion()
      })

      expect(initialVersion).toBe(1)

      // Reload page (simulates browser session end/restart)
      await page.reload()

      // Wait for database to be ready again
      await expect(page.getByText(/Database Ready/i)).toBeVisible({
        timeout: 10000,
      })

      // Verify version persisted
      const persistedVersion = await page.evaluate(async () => {
        const helpers = window.testHelpers!
        return await helpers.getVersion()
      })

      expect(persistedVersion).toBe(1)
    })

    test('should persist version updates through multiple reloads', async ({ page }) => {
      // Session 1: Verify initial version is 1 (after auto-migration from 0)
      const initialVersion = await page.evaluate(async () => {
        const helpers = window.testHelpers!
        return await helpers.getVersion()
      })
      expect(initialVersion).toBe(1)

      // Reload 1: Verify version persists
      await page.reload()
      await expect(page.getByText(/Database Ready/i)).toBeVisible({
        timeout: 10000,
      })

      const version1 = await page.evaluate(async () => {
        const helpers = window.testHelpers!
        return await helpers.getVersion()
      })
      expect(version1).toBe(1)

      // Reload 2: Verify version persists through second reload
      await page.reload()
      await expect(page.getByText(/Database Ready/i)).toBeVisible({
        timeout: 10000,
      })

      const version2 = await page.evaluate(async () => {
        const helpers = window.testHelpers!
        return await helpers.getVersion()
      })
      expect(version2).toBe(1)
    })
  })

  test.describe('Migration Log Persistence (AC 3)', () => {
    test('should persist migration logs across page reloads', async ({ page }) => {
      // Create 3 migration log entries
      await page.evaluate(async () => {
        const helpers = window.testHelpers!

        await helpers.insertMetadata({
          id: `migration-log-001-${Date.now()}`,
          version: 0,
          migrationName: 'migration_001_init',
          status: 'success',
          timestamp: new Date().toISOString(),
          duration: 100,
        })

        await helpers.insertMetadata({
          id: `migration-log-002-${Date.now()}`,
          version: 0,
          migrationName: 'migration_002_add_field',
          status: 'success',
          timestamp: new Date().toISOString(),
          duration: 150,
        })

        await helpers.insertMetadata({
          id: `migration-log-003-${Date.now()}`,
          version: 0,
          migrationName: 'migration_003_update_index',
          status: 'success',
          timestamp: new Date().toISOString(),
          duration: 200,
        })
      })

      // Reload page
      await page.reload()
      await expect(page.getByText(/Database Ready/i)).toBeVisible({
        timeout: 10000,
      })

      // Query migration logs
      const logs = await page.evaluate(async () => {
        const helpers = window.testHelpers!
        return await helpers.queryMetadata({
          migrationName: { $exists: true },
        })
      })

      // Verify logs persisted
      expect(logs.length).toBeGreaterThanOrEqual(3)

      // Verify specific logs exist
      const log1 = logs.find(
        (l: Record<string, unknown>) => l.migrationName === 'migration_001_init'
      )
      const log2 = logs.find(
        (l: Record<string, unknown>) => l.migrationName === 'migration_002_add_field'
      )
      const log3 = logs.find(
        (l: Record<string, unknown>) => l.migrationName === 'migration_003_update_index'
      )

      expect(log1).toBeDefined()
      expect(log1?.status).toBe('success')
      expect(log1?.duration).toBe(100)

      expect(log2).toBeDefined()
      expect(log2?.status).toBe('success')
      expect(log2?.duration).toBe(150)

      expect(log3).toBeDefined()
      expect(log3?.status).toBe('success')
      expect(log3?.duration).toBe(200)
    })
  })

  test.describe('IndexedDB Persistence Validation (AC 5)', () => {
    test('should use real IndexedDB in browser context', async ({ page }) => {
      // Verify we're using real IndexedDB
      const hasIndexedDB = await page.evaluate(() => {
        return typeof indexedDB !== 'undefined' && indexedDB !== null
      })

      expect(hasIndexedDB).toBe(true)

      // Verify database exists in IndexedDB
      // RxDB with Dexie storage creates databases with pattern: rxdb-dexie-{name}--{version}--{collection}
      const dbInfo = await page.evaluate(async () => {
        const dbs = await indexedDB.databases()
        const dbNames = dbs.map((db) => db.name)
        const exists = dbs.some((db) => db.name?.includes('claine-v2'))
        return { exists, dbNames, count: dbs.length }
      })

      expect(dbInfo.exists).toBe(true)
      expect(dbInfo.count).toBeGreaterThan(0)
    })

    test('should have test helpers available', async ({ page }) => {
      const helpersAvailable = await page.evaluate(() => {
        const helpers = window.testHelpers
        return (
          helpers &&
          typeof helpers.setVersion === 'function' &&
          typeof helpers.getVersion === 'function' &&
          typeof helpers.insertMetadata === 'function' &&
          typeof helpers.queryMetadata === 'function'
        )
      })

      expect(helpersAvailable).toBe(true)
    })
  })
})
