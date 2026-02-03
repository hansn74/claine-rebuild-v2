import type { RxDocument } from 'rxdb'
import type { AppDatabase } from './types'
import type { MetadataDocument } from './types'

export interface MigrationLog {
  id: string // 'migration-{timestamp}'
  version: number
  migrationName: string
  status: 'start' | 'success' | 'failure'
  timestamp: string
  duration?: number // in milliseconds
  error?: string
}

/**
 * Input type for creating migration log documents
 * Extends MetadataDocument but makes some fields required for logging
 */
type MigrationLogInput = Pick<MetadataDocument, 'id' | 'version' | 'lastMigration'> & {
  migrationName: string
  status: 'start' | 'success' | 'failure'
  timestamp: string
  duration?: number
  error?: string
}

/**
 * Service for tracking database schema version and migration history
 * Uses the metadata collection created in init.ts
 */
export class VersionTracker {
  /**
   * Get the current schema version from the database
   * @param db - Typed RxDatabase instance
   * @returns Current schema version number
   */
  async getCurrentVersion(db: AppDatabase): Promise<number> {
    const metadata = await db.metadata.findOne('db-version').exec()
    if (!metadata) {
      throw new Error('Database version not found in metadata')
    }
    return metadata.version
  }

  /**
   * Set the schema version in the database
   * @param db - Typed RxDatabase instance
   * @param version - New schema version number
   */
  async setVersion(db: AppDatabase, version: number): Promise<void> {
    const metadata = await db.metadata.findOne('db-version').exec()
    if (!metadata) {
      throw new Error('Database version not found in metadata')
    }

    await metadata.update({
      $set: {
        version,
        lastMigration: new Date().toISOString(),
      },
    })
  }

  /**
   * Log a migration event to the metadata collection
   * @param db - Typed RxDatabase instance
   * @param migration - Migration name
   * @param status - Migration status (start, success, failure)
   * @param details - Optional details (error message, etc.)
   * @param duration - Optional duration in milliseconds
   */
  async logMigration(
    db: AppDatabase,
    migrationName: string,
    status: 'start' | 'success' | 'failure',
    details?: { error?: string; duration?: number; version?: number }
  ): Promise<void> {
    const timestamp = new Date().toISOString()
    // Create unique ID with timestamp, status, and random component
    const id = `migration-${Date.now()}-${status}-${Math.random().toString(36).substring(7)}`

    const log: MigrationLogInput = {
      id,
      version: details?.version ?? 0,
      migrationName,
      status,
      timestamp,
      lastMigration: timestamp,
    }

    if (details?.duration !== undefined) {
      log.duration = details.duration
    }

    if (details?.error) {
      log.error = details.error
    }

    await db.metadata.insert(log)
  }

  /**
   * Get migration history from the metadata collection
   * @param db - Typed RxDatabase instance
   * @returns Array of migration logs, sorted by timestamp (newest first)
   */
  async getMigrationHistory(db: AppDatabase): Promise<MigrationLog[]> {
    const logs = await db.metadata
      .find({
        selector: {
          id: {
            $regex: '^migration-',
          },
        },
      })
      .exec()

    return logs
      .map((doc: RxDocument<MetadataDocument>) => ({
        id: doc.id,
        version: doc.version,
        migrationName: doc.migrationName || doc.id,
        status: doc.status as 'start' | 'success' | 'failure',
        timestamp: doc.timestamp || doc.lastMigration,
        duration: doc.duration,
        error: doc.error,
      }))
      .filter((log) => log.status !== undefined)
      .sort(
        (a: MigrationLog, b: MigrationLog) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
  }
}

/**
 * Singleton instance of VersionTracker
 */
export const versionTracker = new VersionTracker()
