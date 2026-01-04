import type { AppDatabase } from '../types'
import type { Migration } from './types'
import { syncFailureSchema } from '../schemas/syncFailure.schema'

/**
 * Migration: Add syncFailures collection for Story 1.10
 * This migration creates the sync failure collection for tracking
 * partial sync failures and retry state.
 *
 * AC 1: Sync engine detects when some emails sync successfully but others fail
 * AC 2: Failed email IDs tracked separately from successful ones
 * AC 14: Failed sync state persisted to RxDB (survives app restart)
 */
export const migration_20251127_add_sync_failure_collection: Migration = {
  version: 4,
  name: '20251127_add_sync_failure_collection',

  /**
   * Forward migration: Add syncFailures collection
   */
  async up(db: AppDatabase): Promise<void> {
    // Check if collection already exists to support idempotent migrations
    const existingCollections = Object.keys(db.collections)

    // Add syncFailures collection if it doesn't exist
    if (!existingCollections.includes('syncFailures')) {
      await db.addCollections({
        syncFailures: {
          schema: syncFailureSchema,
        },
      })
    }
  },

  /**
   * Backward migration: Remove syncFailures collection
   * WARNING: This will delete all sync failure history
   */
  async down(db: AppDatabase): Promise<void> {
    // Remove collection if it exists
    if (db.syncFailures) {
      await db.syncFailures.remove()
    }
  },
}
