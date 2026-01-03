import { createRxDatabase, removeRxDatabase, addRxPlugin } from 'rxdb'
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie'
import { RxDBUpdatePlugin } from 'rxdb/plugins/update'
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder'
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode'
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv'
import type { AppDatabase } from './types'
import { metadataSchema } from './schemas/metadata.schema'

// Add required plugins (must be synchronous)
addRxPlugin(RxDBUpdatePlugin)
addRxPlugin(RxDBQueryBuilderPlugin)

// Enable dev-mode in development for better error messages and schema validation
// Note: Dev-mode + AJV caused hangs with Dexie storage, but works with memory storage
if (import.meta.env.DEV) {
  addRxPlugin(RxDBDevModePlugin)
}

export const DATABASE_NAME = 'claine-email-v4' // Fresh start with migration system
export const DATABASE_VERSION = 0 // Initial version - bump when adding migrations

let dbInstance: AppDatabase | null = null
let initPromise: Promise<AppDatabase> | null = null
let isInitializing = false // Synchronous lock to prevent race conditions

// Create storage ONCE at module load to ensure consistent reference
// Dev: Dexie with AJV validation for schema checking + persistence
// Prod: Dexie without AJV (validated at build time, smaller bundle)
const baseStorage = getRxStorageDexie()
const storage = import.meta.env.DEV
  ? wrappedValidateAjvStorage({ storage: baseStorage })
  : baseStorage

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
    if (dbInstance && dbInstance.name === dbName && !dbInstance.destroyed) {
      console.log('[DB] Returning existing database instance')
      return dbInstance
    }

    // If initialization is in progress, wait for it
    if (initPromise) {
      console.log('[DB] Waiting for existing initialization...')
      return await initPromise
    }

    // Synchronous lock check (prevents React StrictMode race condition)
    if (isInitializing) {
      console.log('[DB] Already initializing, waiting...')
      // Wait for initialization to complete
      await new Promise((resolve) => setTimeout(resolve, 100))
      if (dbInstance && !dbInstance.destroyed) {
        return dbInstance
      }
      if (initPromise) {
        return await initPromise
      }
    }

    // Set synchronous lock AND promise immediately (before any async work)
    // This prevents React StrictMode race conditions
    isInitializing = true
    console.log('[DB] Starting database initialization...')

    // Create the promise immediately so concurrent calls can wait on it
    initPromise = (async () => {
      // Double-check after acquiring lock
      if (dbInstance && dbInstance.name === dbName && !dbInstance.destroyed) {
        return dbInstance
      }

      // Close existing instance if different name or if destroyed
      if (dbInstance && (dbInstance.name !== dbName || dbInstance.destroyed)) {
        if (!dbInstance.destroyed && typeof dbInstance.destroy === 'function') {
          await dbInstance.destroy()
        }
        dbInstance = null
      }

      // Create database with Dexie/IndexedDB storage
      // Dev: with AJV validation for schema checking
      // Prod: without AJV (smaller bundle, validated at build time)
      console.log(
        `[DB] Creating RxDatabase: ${dbName} (storage: dexie, validation: ${import.meta.env.DEV ? 'ajv' : 'none'})`
      )
      const db = await createRxDatabase({
        name: dbName,
        storage,
        multiInstance: false, // Single instance for PWA
        eventReduce: true, // Optimize for reactive queries
        // Note: ignoreDuplicate is only allowed in dev-mode
        // Use closeDuplicates instead to handle StrictMode double-mounting
        closeDuplicates: true,
      })
      console.log('[DB] RxDatabase created successfully')

      // Create metadata collection for version tracking and migrations
      // Check if collection already exists (database might have been reopened)
      const typedDb = db as unknown as AppDatabase
      if (!typedDb.metadata) {
        console.log('[DB] Creating metadata collection...')
        await db.addCollections({
          metadata: { schema: metadataSchema },
        })
        console.log('[DB] Metadata collection created')
      } else {
        console.log('[DB] Metadata collection already exists')
      }

      // Check version and initialize if needed
      const existingVersion = await typedDb.metadata.findOne('db-version').exec()
      if (!existingVersion) {
        console.log('[DB] Initializing version document...')
        await typedDb.metadata.insert({
          id: 'db-version',
          version: DATABASE_VERSION,
          lastMigration: new Date().toISOString(),
        })
        console.log(`[DB] Version document created (v${DATABASE_VERSION})`)
      } else {
        console.log(`[DB] Existing database version: ${existingVersion.version}`)

        // Check for version mismatch (database newer than code)
        if (existingVersion.version > DATABASE_VERSION) {
          throw new Error(
            `Database version mismatch: database is v${existingVersion.version} but code expects v${DATABASE_VERSION}. ` +
              `Please update the application or reset the database.`
          )
        }
      }

      console.log('[DB] Database initialization complete!')
      dbInstance = typedDb
      return typedDb
    })()

    // Wait for initialization and clear promise
    try {
      const result = await initPromise
      return result
    } finally {
      initPromise = null
      isInitializing = false
    }
  } catch (error) {
    // Clear promise and lock on error
    initPromise = null
    isInitializing = false

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
 * @param remove - If true, also removes the database from storage (and collections from RxDB registry)
 */
export async function closeDatabase(remove: boolean = false): Promise<void> {
  if (dbInstance) {
    try {
      const db = dbInstance
      const dbName = db.name
      const storage = db.storage

      // Important: RxDB open-source has a limit of 16 collections in parallel
      // We must properly remove collections from RxDB's internal registry
      // by calling collection.remove() before destroying the database
      // ONLY do this when remove=true, otherwise data is preserved for reconnection
      if (remove && !db.destroyed) {
        const collections = Object.keys(db.collections)
        for (const collectionName of collections) {
          const collection = db.collections[collectionName]
          if (collection && !collection.destroyed && !collection.closed) {
            try {
              await collection.remove()
            } catch (removeError) {
              // Log but continue - collection might already be closed
              console.warn(`Error removing collection ${collectionName}:`, removeError)
            }
          }
        }
      }

      // Clear the singleton BEFORE destroying to prevent race conditions
      dbInstance = null
      initPromise = null

      // Check if destroy method exists and instance is valid
      if (db && typeof db.destroy === 'function' && !db.destroyed) {
        await db.destroy()
      }

      // Remove database from storage if requested
      if (remove) {
        try {
          await removeRxDatabase(dbName, storage)
        } catch {
          // Ignore - storage might already be removed
        }
      }
    } catch (error) {
      // Ensure instance is nulled even if destroy fails
      dbInstance = null
      initPromise = null
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
