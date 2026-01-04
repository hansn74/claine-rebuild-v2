import type { AppDatabase } from '../types'
import type { Migration } from './types'
import { conflictAuditSchema } from '../schemas/conflictAudit.schema'

/**
 * Migration: Add conflictAudit collection for Story 1.9
 * This migration creates the conflict audit collection for tracking
 * sync conflicts and their resolutions.
 *
 * AC3: Conflicts logged to RxDB audit table with details
 * AC11: All conflicts logged to RxDB with resolution strategy used
 */
export const migration_20251126_add_conflict_audit_collection: Migration = {
  version: 3,
  name: '20251126_add_conflict_audit_collection',

  /**
   * Forward migration: Add conflictAudit collection
   */
  async up(db: AppDatabase): Promise<void> {
    // Check if collection already exists to support idempotent migrations
    const existingCollections = Object.keys(db.collections)

    // Add conflictAudit collection if it doesn't exist
    if (!existingCollections.includes('conflictAudit')) {
      await db.addCollections({
        conflictAudit: {
          schema: conflictAuditSchema,
        },
      })
    }
  },

  /**
   * Backward migration: Remove conflictAudit collection
   * WARNING: This will delete all conflict audit history
   */
  async down(db: AppDatabase): Promise<void> {
    // Remove collection if it exists
    if (db.conflictAudit) {
      await db.conflictAudit.remove()
    }
  },
}
