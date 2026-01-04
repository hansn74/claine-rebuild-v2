import type { AppDatabase } from '../types'
import type { Migration } from './types'
import { attributeSchema } from '../schemas/attribute.schema'

/**
 * Migration: Add attributes collection for Story 2.13
 * This migration creates the attributes collection for storing custom
 * attribute definitions used to organize emails.
 *
 * AC 1: RxDB schema extended with attributes collection
 * AC 2: Supports enum, text, date, boolean, number types
 * AC 4: Built-in presets (Status, Priority, Context)
 * AC 7: Attributes persist in RxDB
 */
export const migration_20251215_add_attributes_collection: Migration = {
  version: 7,
  name: '20251215_add_attributes_collection',

  /**
   * Forward migration: Add attributes collection
   */
  async up(db: AppDatabase): Promise<void> {
    // Check if collection already exists to support idempotent migrations
    const existingCollections = Object.keys(db.collections)

    // Add attributes collection if it doesn't exist
    if (!existingCollections.includes('attributes')) {
      await db.addCollections({
        attributes: {
          schema: attributeSchema,
        },
      })
    }
  },

  /**
   * Backward migration: Remove attributes collection
   * WARNING: This will delete all custom attribute definitions
   */
  async down(db: AppDatabase): Promise<void> {
    // Remove collection if it exists
    if (db.attributes) {
      await db.attributes.remove()
    }
  },
}
