/**
 * Test Helpers for E2E Testing
 *
 * These helpers are exposed on window.testHelpers for Playwright E2E tests
 * to interact with the database. Only included in development builds.
 */

import { getDatabase } from '@/services/database/init'
import { versionTracker, type MigrationLog } from '@/services/database/versionTracker'
import type { MetadataDocument } from '@/services/database/schemas'

export interface TestHelpers {
  isDatabaseReady: () => boolean
  setVersion: (version: number) => Promise<void>
  getVersion: () => Promise<number>
  logMigration: (
    name: string,
    status: 'success' | 'start' | 'failure',
    duration: number
  ) => Promise<void>
  getMigrationHistory: () => Promise<MigrationLog[]>
  insertMetadata: (data: MetadataDocument) => Promise<void>
  queryMetadata: (selector: Record<string, unknown>) => Promise<MetadataDocument[]>
  clearTestData: () => Promise<void>
}

export const testHelpers: TestHelpers = {
  isDatabaseReady() {
    try {
      getDatabase()
      return true
    } catch {
      return false
    }
  },

  async setVersion(version: number) {
    const db = getDatabase()
    if (!db) throw new Error('Database not initialized')
    await versionTracker.setVersion(db, version)
  },

  async getVersion() {
    const db = getDatabase()
    if (!db) throw new Error('Database not initialized')
    return await versionTracker.getCurrentVersion(db)
  },

  async logMigration(name: string, status: 'success' | 'start' | 'failure', duration: number) {
    const db = getDatabase()
    if (!db) throw new Error('Database not initialized')
    await versionTracker.logMigration(db, name, status, { duration })
  },

  async getMigrationHistory() {
    const db = getDatabase()
    if (!db) throw new Error('Database not initialized')
    return await versionTracker.getMigrationHistory(db)
  },

  async insertMetadata(data: MetadataDocument) {
    const db = getDatabase()
    if (!db) throw new Error('Database not initialized')
    await db.metadata.insert(data)
  },

  async queryMetadata(selector: Record<string, unknown>) {
    const db = getDatabase()
    if (!db) throw new Error('Database not initialized')
    const results = await db.metadata.find({ selector }).exec()
    return results.map((doc) => doc.toJSON() as MetadataDocument)
  },

  async clearTestData() {
    const db = getDatabase()
    if (!db) throw new Error('Database not initialized')

    // Remove test migration logs
    const testLogs = await db.metadata
      .find({
        selector: {
          migrationName: { $regex: '^migration_00' },
        },
      })
      .exec()

    for (const log of testLogs) {
      await log.remove()
    }
  },
}

// Expose to window for E2E tests (only in development)
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  ;(window as unknown as { testHelpers: TestHelpers }).testHelpers = testHelpers
}
