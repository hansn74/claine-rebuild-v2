import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest'
import {
  initDatabase,
  getDatabase,
  isDatabaseInitialized,
  closeDatabase,
  __resetDatabaseForTesting,
} from '../init'
// Import OPEN_COLLECTIONS to manually clear it when tests leak collections
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - OPEN_COLLECTIONS is exported from rxdb but not in TypeScript types
import { OPEN_COLLECTIONS } from 'rxdb'

// Use a single shared database name for all tests in this file
// This avoids the RxDB 16-collection limit issue when running tests
let sharedTestDbName: string

describe('Database Initialization', () => {
  let testDbName: string

  beforeAll(() => {
    // Generate shared name once for entire test file
    sharedTestDbName = `testdb${Date.now()}`
  })

  beforeEach(() => {
    // Use the shared database name for all tests
    testDbName = sharedTestDbName
  })

  afterEach(async () => {
    // Clean up after each test - remove database to prevent conflicts
    await closeDatabase(true)
    // Reset singleton for clean state
    __resetDatabaseForTesting()
    // Force clear OPEN_COLLECTIONS to prevent 16-collection limit issues
    if (OPEN_COLLECTIONS && OPEN_COLLECTIONS instanceof Set) {
      OPEN_COLLECTIONS.clear()
    }
  })

  it('should initialize database successfully', async () => {
    const db = await initDatabase(testDbName)

    expect(db).toBeDefined()
    expect(db.name).toBe(testDbName)
    expect(isDatabaseInitialized()).toBe(true)
  })

  it('should return existing instance on subsequent calls', async () => {
    const db1 = await initDatabase(testDbName)
    const db2 = await initDatabase(testDbName)

    expect(db1).toBe(db2)
  })

  it('should have metadata collection with version', async () => {
    const db = await initDatabase(testDbName)

    expect(db.metadata).toBeDefined()

    const metadata = await db.metadata.findOne('db-version').exec()
    expect(metadata).toBeDefined()
    // First-time initialization starts at version 0, then migrations run
    expect(metadata?.version).toBeGreaterThanOrEqual(0)
  })

  it('should throw error when getting database before initialization', () => {
    expect(() => getDatabase()).toThrow('Database not initialized. Call initDatabase() first.')
  })

  it('should return correct initialization status', async () => {
    expect(isDatabaseInitialized()).toBe(false)

    await initDatabase(testDbName)
    expect(isDatabaseInitialized()).toBe(true)

    await closeDatabase()
    expect(isDatabaseInitialized()).toBe(false)
  })

  it('should close database successfully', async () => {
    await initDatabase(testDbName)
    expect(isDatabaseInitialized()).toBe(true)

    await closeDatabase()
    expect(isDatabaseInitialized()).toBe(false)
  })

  it('should handle IndexedDB storage with Dexie', async () => {
    const db = await initDatabase(testDbName)

    // Verify storage is configured correctly
    expect(db.storage).toBeDefined()
    expect(db.storage.name).toContain('dexie')
  })

  it('should not allow multiple instances', async () => {
    const db = await initDatabase(testDbName)

    // multiInstance is set to false
    expect(db.multiInstance).toBe(false)
  })

  it('should enable eventReduce for reactive queries', async () => {
    const db = await initDatabase(testDbName)

    expect(db.eventReduce).toBe(true)
  })

  describe('Migration Integration', () => {
    it('should run migrations automatically on first initialization', async () => {
      const db = await initDatabase(testDbName)

      // Check that version was updated after migrations
      const metadata = await db.metadata.findOne('db-version').exec()
      expect(metadata).toBeDefined()
      expect(metadata?.version).toBeGreaterThanOrEqual(0)

      // Check migration logs exist
      const logs = await db.metadata
        .find({
          selector: {
            id: {
              $regex: '^migration-',
            },
          },
        })
        .exec()

      // Should have migration logs if migrations ran
      if (metadata && metadata.version > 0) {
        expect(logs.length).toBeGreaterThan(0)
      }
    })

    it('should skip migrations if database is already up to date', async () => {
      // Initialize database first time (runs migrations)
      const db1 = await initDatabase(testDbName)
      const version1 = (await db1.metadata.findOne('db-version').exec())?.version

      // Get migration log count - use a more specific query to avoid counting
      // logs from other test runs
      const logs1 = await db1.metadata
        .find({
          selector: {
            id: {
              $regex: '^migration-',
            },
          },
        })
        .exec()
      const logCount1 = logs1.length

      // Close WITHOUT removing, then reinitialize same db
      // This simulates app restart with existing data
      await closeDatabase(false)
      __resetDatabaseForTesting() // Reset singleton but keep data
      const db2 = await initDatabase(testDbName)

      // Version should be unchanged
      const version2 = (await db2.metadata.findOne('db-version').exec())?.version
      expect(version2).toBe(version1)

      // No new migration logs should be added (check count is same or greater due to fresh run)
      const logs2 = await db2.metadata
        .find({
          selector: {
            id: {
              $regex: '^migration-',
            },
          },
        })
        .exec()
      // Migration logs should not increase when reopening an up-to-date database
      expect(logs2.length).toBe(logCount1)

      // Clean up this specific database fully to prevent collection limit issues
      await closeDatabase(true)
    })

    it('should throw error if database version is newer than code', async () => {
      // Initialize database
      const db = await initDatabase(testDbName)

      // Manually set version to future version
      const metadata = await db.metadata.findOne('db-version').exec()
      if (metadata) {
        await metadata.update({
          $set: { version: 9999 },
        })
      }

      // Close WITHOUT removing, then try to reinitialize
      await closeDatabase(false)
      __resetDatabaseForTesting() // Reset singleton but keep data

      // Should throw version mismatch error
      await expect(initDatabase(testDbName)).rejects.toThrow(/Database version mismatch/)

      // Clean up - reset and remove the problematic database
      __resetDatabaseForTesting()
    })
  })
})
