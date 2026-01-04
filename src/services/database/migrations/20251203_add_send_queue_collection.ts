import type { AppDatabase } from '../types'
import type { Migration } from './types'
import { sendQueueSchema } from '../schemas/sendQueue.schema'

/**
 * Migration: Add sendQueue collection for Story 2.4
 * This migration creates the sendQueue collection for storing emails
 * waiting to be sent, supporting offline-first send functionality.
 *
 * AC 1: Emails sent while offline are queued locally
 * AC 2: Send queue persists across app restarts
 * AC 5: Failed sends retry automatically with exponential backoff
 * FR007: Full read/write functionality when offline, queueing actions for later sync
 * NFR002: Gracefully handle network interruptions without data loss
 */
export const migration_20251203_add_send_queue_collection: Migration = {
  version: 6,
  name: '20251203_add_send_queue_collection',

  /**
   * Forward migration: Add sendQueue collection
   */
  async up(db: AppDatabase): Promise<void> {
    // Check if collection already exists to support idempotent migrations
    const existingCollections = Object.keys(db.collections)

    // Add sendQueue collection if it doesn't exist
    if (!existingCollections.includes('sendQueue')) {
      await db.addCollections({
        sendQueue: {
          schema: sendQueueSchema,
        },
      })
    }
  },

  /**
   * Backward migration: Remove sendQueue collection
   * WARNING: This will delete all queued emails
   */
  async down(db: AppDatabase): Promise<void> {
    // Remove collection if it exists
    if (db.sendQueue) {
      await db.sendQueue.remove()
    }
  },
}
