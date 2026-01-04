import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createRxDatabase, addRxPlugin } from 'rxdb'
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie'
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv'
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode'
import { RxDBUpdatePlugin } from 'rxdb/plugins/update'
import type { RxDatabase, RxCollection } from 'rxdb'
import { MigrationRunner } from '../migrationRunner'
import { VersionTracker } from '../versionTracker'
import type { Migration } from '../migrations/types'

// Add required plugins
addRxPlugin(RxDBDevModePlugin)
addRxPlugin(RxDBUpdatePlugin)

describe('MigrationRunner', () => {
  let db: RxDatabase
  let migrationRunner: MigrationRunner
  let versionTracker: VersionTracker
  let dbName: string

  beforeEach(async () => {
    // Use unique database name for each test
    dbName = 'testmigrun' + Date.now() + Math.random().toString().replace('.', '')

    // Create test database with metadata collection
    db = await createRxDatabase({
      name: dbName,
      storage: wrappedValidateAjvStorage({ storage: getRxStorageDexie() }),
      multiInstance: false,
      ignoreDuplicate: true,
    })

    await db.addCollections({
      metadata: {
        schema: {
          version: 0,
          primaryKey: 'id',
          type: 'object',
          properties: {
            id: { type: 'string', maxLength: 100 },
            version: { type: 'number' },
            lastMigration: { type: 'string' },
            migrationName: { type: 'string' },
            status: { type: 'string' },
            timestamp: { type: 'string' },
            duration: { type: 'number' },
            error: { type: 'string' },
          },
          required: ['id', 'version'],
        },
      },
    })

    // Initialize version metadata
    await (db.collections.metadata as RxCollection).insert({
      id: 'db-version',
      version: 0,
      lastMigration: new Date().toISOString(),
    })

    migrationRunner = new MigrationRunner()
    versionTracker = new VersionTracker()
  })

  afterEach(async () => {
    if (db) {
      await db.remove()
    }
  })

  describe('registerMigration', () => {
    it('should register a migration', () => {
      const migration: Migration = {
        version: 1,
        name: 'test_migration',
        up: async () => {},
        down: async () => {},
      }

      migrationRunner.registerMigration(migration)
      const migrations = migrationRunner.getMigrations()

      expect(migrations).toHaveLength(1)
      expect(migrations[0]).toEqual(migration)
    })

    it('should sort migrations by version', () => {
      const migration1: Migration = {
        version: 3,
        name: 'migration_3',
        up: async () => {},
        down: async () => {},
      }
      const migration2: Migration = {
        version: 1,
        name: 'migration_1',
        up: async () => {},
        down: async () => {},
      }
      const migration3: Migration = {
        version: 2,
        name: 'migration_2',
        up: async () => {},
        down: async () => {},
      }

      migrationRunner.registerMigration(migration1)
      migrationRunner.registerMigration(migration2)
      migrationRunner.registerMigration(migration3)

      const migrations = migrationRunner.getMigrations()
      expect(migrations).toHaveLength(3)
      expect(migrations[0].version).toBe(1)
      expect(migrations[1].version).toBe(2)
      expect(migrations[2].version).toBe(3)
    })
  })

  describe('runMigrations', () => {
    it('should run pending migrations in order', async () => {
      const executionOrder: number[] = []

      const migration1: Migration = {
        version: 1,
        name: '20251113_migration_1',
        up: async () => {
          executionOrder.push(1)
        },
        down: async () => {},
      }

      const migration2: Migration = {
        version: 2,
        name: '20251113_migration_2',
        up: async () => {
          executionOrder.push(2)
        },
        down: async () => {},
      }

      migrationRunner.registerMigration(migration1)
      migrationRunner.registerMigration(migration2)

      const results = await migrationRunner.runMigrations(db, 0, 2)

      expect(results).toHaveLength(2)
      expect(executionOrder).toEqual([1, 2])
      expect(results[0].success).toBe(true)
      expect(results[1].success).toBe(true)
    })

    it('should update version after each successful migration', async () => {
      const migration: Migration = {
        version: 1,
        name: '20251113_test_migration',
        up: async () => {},
        down: async () => {},
      }

      migrationRunner.registerMigration(migration)
      await migrationRunner.runMigrations(db, 0, 1)

      const currentVersion = await versionTracker.getCurrentVersion(db)
      expect(currentVersion).toBe(1)
    })

    it('should skip already-applied migrations', async () => {
      const migration1: Migration = {
        version: 1,
        name: '20251113_migration_1',
        up: async () => {},
        down: async () => {},
      }

      const migration2: Migration = {
        version: 2,
        name: '20251113_migration_2',
        up: async () => {},
        down: async () => {},
      }

      migrationRunner.registerMigration(migration1)
      migrationRunner.registerMigration(migration2)

      // Set current version to 1 (migration 1 already applied)
      await versionTracker.setVersion(db, 1)

      const results = await migrationRunner.runMigrations(db, 1, 2)

      // Should only run migration 2
      expect(results).toHaveLength(1)
      expect(results[0].version).toBe(2)
    })

    it('should stop on migration failure', async () => {
      const migration1: Migration = {
        version: 1,
        name: '20251113_migration_1',
        up: async () => {
          throw new Error('Migration failed')
        },
        down: async () => {},
      }

      const migration2: Migration = {
        version: 2,
        name: '20251113_migration_2',
        up: async () => {},
        down: async () => {},
      }

      migrationRunner.registerMigration(migration1)
      migrationRunner.registerMigration(migration2)

      await expect(migrationRunner.runMigrations(db, 0, 2)).rejects.toThrow(
        'Migration 20251113_migration_1 failed'
      )

      // Version should still be 0
      const currentVersion = await versionTracker.getCurrentVersion(db)
      expect(currentVersion).toBe(0)
    })

    it('should return empty array when no migrations to run', async () => {
      const results = await migrationRunner.runMigrations(db, 0, 0)
      expect(results).toHaveLength(0)
    })

    it('should log migration events', async () => {
      const migration: Migration = {
        version: 1,
        name: '20251113_test_migration',
        up: async () => {},
        down: async () => {},
      }

      migrationRunner.registerMigration(migration)
      await migrationRunner.runMigrations(db, 0, 1)

      const history = await versionTracker.getMigrationHistory(db)
      expect(history.length).toBeGreaterThanOrEqual(2)

      const startLog = history.find(
        (log) => log.migrationName === '20251113_test_migration' && log.status === 'start'
      )
      const successLog = history.find(
        (log) => log.migrationName === '20251113_test_migration' && log.status === 'success'
      )

      expect(startLog).toBeDefined()
      expect(successLog).toBeDefined()
      expect(successLog?.duration).toBeGreaterThanOrEqual(0)
    })
  })

  describe('rollbackToVersion', () => {
    it('should rollback migrations in reverse order', async () => {
      const executionOrder: string[] = []

      const migration1: Migration = {
        version: 1,
        name: '20251113_migration_1',
        up: async () => {},
        down: async () => {
          executionOrder.push('down_1')
        },
      }

      const migration2: Migration = {
        version: 2,
        name: '20251113_migration_2',
        up: async () => {},
        down: async () => {
          executionOrder.push('down_2')
        },
      }

      migrationRunner.registerMigration(migration1)
      migrationRunner.registerMigration(migration2)

      // First, run migrations to version 2
      await migrationRunner.runMigrations(db, 0, 2)

      // Now rollback to version 0
      await migrationRunner.rollbackToVersion(db, 0)

      // Should execute down() in reverse order: 2, then 1
      expect(executionOrder).toEqual(['down_2', 'down_1'])
    })

    it('should update version after successful rollback', async () => {
      const migration: Migration = {
        version: 1,
        name: '20251113_test_migration',
        up: async () => {},
        down: async () => {},
      }

      migrationRunner.registerMigration(migration)

      // Run migration to version 1
      await migrationRunner.runMigrations(db, 0, 1)

      // Rollback to version 0
      await migrationRunner.rollbackToVersion(db, 0)

      const currentVersion = await versionTracker.getCurrentVersion(db)
      expect(currentVersion).toBe(0)
    })

    it('should throw error when rolling back to higher version', async () => {
      await versionTracker.setVersion(db, 1)

      await expect(migrationRunner.rollbackToVersion(db, 2)).rejects.toThrow(
        'Cannot rollback from version 1 to 2'
      )
    })

    it('should stop on rollback failure', async () => {
      const migration1: Migration = {
        version: 1,
        name: '20251113_migration_1',
        up: async () => {},
        down: async () => {},
      }

      const migration2: Migration = {
        version: 2,
        name: '20251113_migration_2',
        up: async () => {},
        down: async () => {
          throw new Error('Rollback failed')
        },
      }

      migrationRunner.registerMigration(migration1)
      migrationRunner.registerMigration(migration2)

      // Run migrations to version 2
      await migrationRunner.runMigrations(db, 0, 2)

      // Attempt rollback should fail
      await expect(migrationRunner.rollbackToVersion(db, 0)).rejects.toThrow(
        'Rollback of 20251113_migration_2 failed'
      )
    })
  })
})
