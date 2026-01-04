import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createRxDatabase, addRxPlugin } from 'rxdb'
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie'
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv'
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode'
import type { RxDatabase, RxCollection } from 'rxdb'
import { BackupService } from '../backup'

// Add required plugins
addRxPlugin(RxDBDevModePlugin)

describe('BackupService', () => {
  let db: RxDatabase
  let backupService: BackupService
  let dbName: string

  beforeEach(async () => {
    dbName = 'testbackup' + Date.now() + Math.random().toString().replace('.', '')

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
          },
          required: ['id', 'version'],
        },
      },
      test: {
        schema: {
          version: 0,
          primaryKey: 'id',
          type: 'object',
          properties: {
            id: { type: 'string', maxLength: 100 },
            name: { type: 'string' },
            value: { type: 'number' },
          },
          required: ['id', 'name', 'value'],
        },
      },
    })

    // Insert test data
    await (db.collections.metadata as RxCollection).insert({
      id: 'db-version',
      version: 1,
      lastMigration: new Date().toISOString(),
    })

    await (db.collections.test as RxCollection).insert({
      id: 'test-1',
      name: 'Test Item 1',
      value: 100,
    })

    await (db.collections.test as RxCollection).insert({
      id: 'test-2',
      name: 'Test Item 2',
      value: 200,
    })

    backupService = new BackupService()
  })

  afterEach(async () => {
    if (db) {
      await db.remove()
    }
  })

  describe('createBackup', () => {
    it('should create a backup with metadata', async () => {
      const backup = await backupService.createBackup(db)

      expect(backup.metadata).toBeDefined()
      expect(backup.metadata.id).toMatch(/^backup_/)
      expect(backup.metadata.timestamp).toBeDefined()
      expect(backup.metadata.version).toBe(1)
      expect(backup.metadata.collections).toContain('metadata')
      expect(backup.metadata.collections).toContain('test')
    })

    it('should backup all collection data', async () => {
      const backup = await backupService.createBackup(db)

      expect(backup.data.metadata).toHaveLength(1)
      expect(backup.data.test).toHaveLength(2)

      const testItem = backup.data.test.find(
        (item: Record<string, unknown>) => item.id === 'test-1'
      )
      expect(testItem).toBeDefined()
      expect(testItem.name).toBe('Test Item 1')
      expect(testItem.value).toBe(100)
    })
  })

  describe('exportToJSON', () => {
    it('should export backup to JSON string', async () => {
      const jsonString = await backupService.exportToJSON(db)

      expect(typeof jsonString).toBe('string')

      const parsed = JSON.parse(jsonString)
      expect(parsed.metadata).toBeDefined()
      expect(parsed.data).toBeDefined()
    })
  })

  describe('importFromJSON', () => {
    it('should import backup from JSON string', async () => {
      // Create backup
      const jsonString = await backupService.exportToJSON(db)

      // Clear test collection
      await (db.collections.test as RxCollection).find().remove()

      // Verify data is cleared
      const beforeImport = await (db.collections.test as RxCollection).find().exec()
      expect(beforeImport).toHaveLength(0)

      // Import backup
      await backupService.importFromJSON(db, jsonString)

      // Verify data is restored
      const afterImport = await (db.collections.test as RxCollection).find().exec()
      expect(afterImport).toHaveLength(2)

      const testItem = afterImport.find((item: Record<string, unknown>) => item.id === 'test-1')
      expect(testItem.name).toBe('Test Item 1')
    })
  })

  describe('restoreBackup', () => {
    it('should restore database from backup', async () => {
      // Create backup
      const backup = await backupService.createBackup(db)

      // Modify data
      await (db.collections.test as RxCollection).insert({
        id: 'test-3',
        name: 'Test Item 3',
        value: 300,
      })

      // Verify modification
      const beforeRestore = await (db.collections.test as RxCollection).find().exec()
      expect(beforeRestore).toHaveLength(3)

      // Restore backup
      await backupService.restoreBackup(db, backup)

      // Verify restoration
      const afterRestore = await (db.collections.test as RxCollection).find().exec()
      expect(afterRestore).toHaveLength(2)

      const item3 = afterRestore.find((item: Record<string, unknown>) => item.id === 'test-3')
      expect(item3).toBeUndefined()
    })

    it('should handle empty collections', async () => {
      // Clear test collection
      await (db.collections.test as RxCollection).find().remove()

      // Create backup with empty collection
      const backup = await backupService.createBackup(db)

      // Add data
      await (db.collections.test as RxCollection).insert({
        id: 'test-new',
        name: 'New Item',
        value: 999,
      })

      // Restore backup
      await backupService.restoreBackup(db, backup)

      // Verify collection is empty
      const docs = await (db.collections.test as RxCollection).find().exec()
      expect(docs).toHaveLength(0)
    })
  })
})
