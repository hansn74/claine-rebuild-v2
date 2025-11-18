import { createRxDatabase, removeRxDatabase, addRxPlugin } from 'rxdb'
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie'
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode'
import { RxDBUpdatePlugin } from 'rxdb/plugins/update'
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv'
import type { AppDatabase } from './types'
import { migrationRunner } from './migrationRunner'
import { versionTracker } from './versionTracker'
import { allMigrations, LATEST_SCHEMA_VERSION } from './migrations'

// Add required plugins (must be synchronous)
addRxPlugin(RxDBUpdatePlugin)

if (import.meta.env.DEV) {
  addRxPlugin(RxDBDevModePlugin)
}

export const DATABASE_NAME = 'claine-v2'
export const DATABASE_VERSION = 1

let dbInstance: AppDatabase | null = null
let initPromise: Promise<AppDatabase> | null = null

/**
 * Initialize the RxDB database with IndexedDB storage
 * This function should be called once at application startup
 * Includes race condition protection for concurrent calls (e.g., React StrictMode)
 * @param dbName - Optional custom database name (for testing)
 * @returns Typed RxDatabase instance
 */
export async function initDatabase(dbName: string = DATABASE_NAME): Promise<AppDatabase> {
  try {
    // Return existing instance if already initialized
    if (dbInstance && dbInstance.name === dbName) {
      return dbInstance
    }

    // If initialization is in progress, wait for it
    if (initPromise) {
      return await initPromise
    }

    // Start initialization and store promise to prevent concurrent init
    initPromise = (async () => {
      // Double-check after acquiring lock
      if (dbInstance && dbInstance.name === dbName && !dbInstance.destroyed) {
        return dbInstance
      }

      // Close existing instance if different name or if destroyed
      if (dbInstance && (dbInstance.name !== dbName || dbInstance.destroyed)) {
        if (!dbInstance.destroyed) {
          await dbInstance.destroy()
        }
        dbInstance = null
      }

      // Create database with IndexedDB adapter (Dexie)
      // Wrap storage with validation in development mode
      const storage = import.meta.env.DEV
        ? wrappedValidateAjvStorage({ storage: getRxStorageDexie() })
        : getRxStorageDexie()

      const db = await createRxDatabase({
        name: dbName,
        storage,
        multiInstance: false, // Single instance for PWA
        eventReduce: true, // Optimize for reactive queries
        ignoreDuplicate: import.meta.env.DEV, // Prevent duplicate errors in development
      })

      // Store version for future migrations
      // Only add metadata collection if it doesn't already exist
      if (!db.metadata) {
        await db.addCollections({
          metadata: {
            schema: {
              version: 0,
              primaryKey: 'id',
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  maxLength: 100,
                },
                version: {
                  type: 'number',
                },
                lastMigration: {
                  type: 'string',
                },
                // Migration logging fields
                migrationName: {
                  type: 'string',
                },
                status: {
                  type: 'string',
                },
                timestamp: {
                  type: 'string',
                },
                duration: {
                  type: 'number',
                },
                error: {
                  type: 'string',
                },
              },
              required: ['id', 'version'],
            },
          },
        })

        // Initialize metadata if it doesn't exist
        const existingMetadata = await db.metadata.findOne('db-version').exec()
        if (!existingMetadata) {
          await db.metadata.insert({
            id: 'db-version',
            version: 0, // Start at version 0 for fresh databases
            lastMigration: new Date().toISOString(),
          })
        }
      }

      // Register all migrations for auto-discovery
      migrationRunner.registerMigrations(allMigrations)

      // Check current version and run migrations if needed
      const currentVersion = await versionTracker.getCurrentVersion(db)
      const targetVersion = LATEST_SCHEMA_VERSION

      // Detect version regression (database is newer than code)
      if (currentVersion > targetVersion) {
        throw new Error(
          `Database version mismatch: Database is at version ${currentVersion} but code expects version ${targetVersion}. ` +
            `Please update your application or use a compatible database version.`
        )
      }

      // Run pending migrations if schema version changed
      if (currentVersion < targetVersion) {
        try {
          // eslint-disable-next-line no-console
          console.log(`Running migrations from version ${currentVersion} to ${targetVersion}...`)
          await migrationRunner.runMigrations(db, currentVersion, targetVersion)
          // eslint-disable-next-line no-console
          console.log(
            `Migrations completed successfully. Database is now at version ${targetVersion}.`
          )
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown migration error'

          console.error('Migration failed:', errorMessage)
          throw new Error(
            `Database migration failed: ${errorMessage}. ` +
              `The database has been left in a potentially inconsistent state. ` +
              `Please restore from backup or contact support.`
          )
        }
      } else {
        // eslint-disable-next-line no-console
        console.log(`Database is up to date at version ${currentVersion}. No migrations needed.`)
      }

      // TODO: Add collections here once schemas are ready
      // This will be implemented in future stories when schemas are defined

      dbInstance = db
      return db
    })()

    // Wait for initialization and clear promise
    try {
      const result = await initPromise
      return result
    } finally {
      initPromise = null
    }
  } catch (error) {
    // Clear promise on error
    initPromise = null

    // Handle specific database errors
    if (error instanceof Error) {
      if (error.name === 'QuotaExceededError') {
        throw new Error('Storage quota exceeded. Please free up space and try again.')
      }
      if (error.name === 'InvalidStateError') {
        throw new Error('Database initialization failed. Please refresh the page and try again.')
      }
    }
    throw error
  }
}

/**
 * Get the current database instance
 * @throws Error if database is not initialized
 * @returns Typed RxDatabase instance
 */
export function getDatabase(): AppDatabase {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return dbInstance
}

/**
 * Check if the database is initialized
 */
export function isDatabaseInitialized(): boolean {
  return dbInstance !== null
}

/**
 * Close the database connection
 * Useful for cleanup in tests
 * @param remove - If true, also removes the database from storage
 */
export async function closeDatabase(remove: boolean = false): Promise<void> {
  if (dbInstance) {
    try {
      const dbName = dbInstance.name
      const storage = dbInstance.storage

      // Check if destroy method exists and instance is valid
      if (dbInstance && typeof dbInstance.destroy === 'function' && !dbInstance.destroyed) {
        await dbInstance.destroy()
      }

      dbInstance = null
      initPromise = null // Also clear init promise to prevent caching issues

      // Remove database from storage if requested
      if (remove) {
        await removeRxDatabase(dbName, storage)
      }
    } catch (error) {
      // Ensure instance is nulled even if destroy fails
      dbInstance = null
      initPromise = null // Also clear init promise to prevent caching issues
      // Don't throw - allow cleanup to complete
      console.warn('Error during database close:', error)
    }
  }
}

/**
 * Reset database instance (for testing only)
 * @internal
 */
export function __resetDatabaseForTesting(): void {
  dbInstance = null
  initPromise = null
}
