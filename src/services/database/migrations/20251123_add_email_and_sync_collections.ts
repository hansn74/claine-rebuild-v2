import type { AppDatabase } from '../types'
import type { Migration } from './types'
import { emailSchema } from '../schemas/email.schema'
import { syncStateSchema } from '../schemas/syncState.schema'

/**
 * Migration: Add email and syncState collections for Story 1.6
 * This migration creates the foundational collections for email sync:
 * 1. emails collection for storing synced emails
 * 2. syncState collection for tracking sync progress per account
 */
export const migration_20251123_add_email_and_sync_collections: Migration = {
  version: 2,
  name: '20251123_add_email_and_sync_collections',

  /**
   * Forward migration: Add email and syncState collections
   */
  async up(db: AppDatabase): Promise<void> {
    // Check if collections already exist to support idempotent migrations
    const existingCollections = Object.keys(db.collections)

    // Add emails collection if it doesn't exist
    if (!existingCollections.includes('emails')) {
      await db.addCollections({
        emails: {
          schema: emailSchema,
        },
      })
    }

    // Add syncState collection if it doesn't exist
    if (!existingCollections.includes('syncState')) {
      await db.addCollections({
        syncState: {
          schema: syncStateSchema,
        },
      })
    }
  },

  /**
   * Backward migration: Remove email and syncState collections
   * WARNING: This will delete all emails and sync state data
   */
  async down(db: AppDatabase): Promise<void> {
    // Remove collections if they exist
    if (db.emails) {
      await db.emails.remove()
    }

    if (db.syncState) {
      await db.syncState.remove()
    }
  },
}
