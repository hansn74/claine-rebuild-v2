/* eslint-disable @typescript-eslint/no-explicit-any */
import type { RxDocument } from 'rxdb'
import type { AppDatabase } from './types'

export interface BackupMetadata {
  id: string
  timestamp: string
  version: number
  collections: string[]
}

/**
 * Backup Service for RxDB
 * Handles database backup and restore operations for safe migrations
 */
export class BackupService {
  /**
   * Create a full database backup
   * @param db - Typed RxDatabase instance
   * @returns Backup data as JSON object with metadata
   */
  async createBackup(db: AppDatabase): Promise<{
    metadata: BackupMetadata
    data: Record<string, unknown[]>
  }> {
    const timestamp = new Date().toISOString()
    const backupId = `backup_${timestamp.replace(/[:.]/g, '-')}`

    // Get current version
    const versionDoc = await db.metadata.findOne('db-version').exec()
    const version = versionDoc?.version ?? 0

    // Get all collection names
    const collectionNames = Object.keys(db.collections)

    // Export data from all collections
    const data: Record<string, unknown[]> = {}

    for (const collectionName of collectionNames) {
      const collection = (db.collections as any)[collectionName]
      if (collection) {
        const docs = await collection.find().exec()
        // Use RxDocument<unknown> since we're iterating over different collection types dynamically
        data[collectionName] = docs.map((doc: RxDocument<unknown>) => doc.toJSON())
      }
    }

    const metadata: BackupMetadata = {
      id: backupId,
      timestamp,
      version,
      collections: collectionNames,
    }

    return {
      metadata,
      data,
    }
  }

  /**
   * Restore database from backup
   * WARNING: This will clear all existing data
   * @param db - Typed RxDatabase instance
   * @param backup - Backup data to restore
   */
  async restoreBackup(
    db: AppDatabase,
    backup: { metadata: BackupMetadata; data: Record<string, unknown[]> }
  ): Promise<void> {
    // Clear all existing documents from collections
    for (const collectionName of backup.metadata.collections) {
      const collection = (db.collections as any)[collectionName]
      if (collection) {
        // Remove all documents, not the collection itself
        await collection.find().remove()
      }
    }

    // Restore data to each collection
    for (const [collectionName, docs] of Object.entries(backup.data)) {
      const collection = (db.collections as any)[collectionName]
      if (collection && docs.length > 0) {
        // Insert documents in bulk
        await collection.bulkInsert(docs)
      }
    }
  }

  /**
   * Export database to JSON string
   * Useful for saving backups to localStorage or file
   * @param db - Typed RxDatabase instance
   * @returns JSON string of backup data
   */
  async exportToJSON(db: AppDatabase): Promise<string> {
    const backup = await this.createBackup(db)
    return JSON.stringify(backup, null, 2)
  }

  /**
   * Import database from JSON string
   * @param db - Typed RxDatabase instance
   * @param jsonString - JSON backup string
   */
  async importFromJSON(db: AppDatabase, jsonString: string): Promise<void> {
    const backup = JSON.parse(jsonString)
    await this.restoreBackup(db, backup)
  }

  /**
   * Save backup to browser localStorage
   * @param db - Typed RxDatabase instance
   * @returns Backup ID
   */
  async saveToLocalStorage(db: AppDatabase): Promise<string> {
    const backup = await this.createBackup(db)
    const key = `rxdb-backup-${backup.metadata.id}`

    // Store in localStorage (if available)
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(backup))
    }

    return backup.metadata.id
  }

  /**
   * Restore backup from browser localStorage
   * @param db - Typed RxDatabase instance
   * @param backupId - Backup ID to restore
   */
  async restoreFromLocalStorage(db: AppDatabase, backupId: string): Promise<void> {
    if (typeof localStorage === 'undefined') {
      throw new Error('localStorage not available')
    }

    const key = `rxdb-backup-${backupId}`
    const backupString = localStorage.getItem(key)

    if (!backupString) {
      throw new Error(`Backup ${backupId} not found in localStorage`)
    }

    const backup = JSON.parse(backupString)
    await this.restoreBackup(db, backup)
  }

  /**
   * List available backups in localStorage
   * @returns Array of backup metadata
   */
  listLocalStorageBackups(): BackupMetadata[] {
    if (typeof localStorage === 'undefined') {
      return []
    }

    const backups: BackupMetadata[] = []

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith('rxdb-backup-')) {
        try {
          const backupString = localStorage.getItem(key)
          if (backupString) {
            const backup = JSON.parse(backupString)
            backups.push(backup.metadata)
          }
        } catch {
          // Skip invalid backups
          continue
        }
      }
    }

    // Sort by timestamp (newest first)
    return backups.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }
}

/**
 * Singleton instance of BackupService
 */
export const backupService = new BackupService()
