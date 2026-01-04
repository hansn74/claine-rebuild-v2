import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createRxDatabase, addRxPlugin } from 'rxdb'
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie'
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv'
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode'
import { RxDBUpdatePlugin } from 'rxdb/plugins/update'
import type { RxDatabase, RxCollection } from 'rxdb'
import { MigrationRunner } from '../../migrationRunner'
import { VersionTracker } from '../../versionTracker'
import { migration_20251113_add_sentiment_field } from '../20251113_add_sentiment_field'

// Add required plugins
addRxPlugin(RxDBDevModePlugin)
addRxPlugin(RxDBUpdatePlugin)

describe('Example Migration: Add Sentiment Field', () => {
  let db: RxDatabase
  let migrationRunner: MigrationRunner
  let versionTracker: VersionTracker
  let dbName: string

  beforeEach(async () => {
    dbName = 'testexmigration' + Date.now() + Math.random().toString().replace('.', '')

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

  describe('migration structure', () => {
    it('should have required migration properties', () => {
      expect(migration_20251113_add_sentiment_field.version).toBe(1)
      expect(migration_20251113_add_sentiment_field.name).toBe('20251113_add_sentiment_field')
      expect(typeof migration_20251113_add_sentiment_field.up).toBe('function')
      expect(typeof migration_20251113_add_sentiment_field.down).toBe('function')
    })

    it('should follow naming convention YYYYMMDD_description', () => {
      const namePattern = /^\d{8}_[a-z_]+$/
      expect(migration_20251113_add_sentiment_field.name).toMatch(namePattern)
    })
  })

  describe('migration execution', () => {
    it('should be registered and executed successfully', async () => {
      migrationRunner.registerMigration(migration_20251113_add_sentiment_field)

      const results = await migrationRunner.runMigrations(db, 0, 1)

      expect(results).toHaveLength(1)
      expect(results[0].success).toBe(true)
      expect(results[0].version).toBe(1)
      expect(results[0].name).toBe('20251113_add_sentiment_field')
    })

    it('should update version after successful migration', async () => {
      migrationRunner.registerMigration(migration_20251113_add_sentiment_field)
      await migrationRunner.runMigrations(db, 0, 1)

      const currentVersion = await versionTracker.getCurrentVersion(db)
      expect(currentVersion).toBe(1)
    })

    it('should complete up() without errors', async () => {
      // Execute up() directly
      await expect(migration_20251113_add_sentiment_field.up(db)).resolves.not.toThrow()
    })

    it('should complete down() without errors', async () => {
      // Execute down() directly
      await expect(migration_20251113_add_sentiment_field.down(db)).resolves.not.toThrow()
    })
  })

  describe('rollback', () => {
    it('should rollback successfully', async () => {
      migrationRunner.registerMigration(migration_20251113_add_sentiment_field)

      // Run migration
      await migrationRunner.runMigrations(db, 0, 1)

      // Rollback
      await migrationRunner.rollbackToVersion(db, 0)

      const currentVersion = await versionTracker.getCurrentVersion(db)
      expect(currentVersion).toBe(0)
    })
  })

  describe('migration logging', () => {
    it('should log migration events', async () => {
      migrationRunner.registerMigration(migration_20251113_add_sentiment_field)
      await migrationRunner.runMigrations(db, 0, 1)

      const history = await versionTracker.getMigrationHistory(db)

      const migrationLogs = history.filter(
        (log) => log.migrationName === '20251113_add_sentiment_field'
      )

      expect(migrationLogs.length).toBeGreaterThanOrEqual(2)

      const startLog = migrationLogs.find((log) => log.status === 'start')
      const successLog = migrationLogs.find((log) => log.status === 'success')

      expect(startLog).toBeDefined()
      expect(successLog).toBeDefined()
      expect(successLog?.version).toBe(1)
    })
  })
})
