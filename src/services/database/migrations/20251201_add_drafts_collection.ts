import type { AppDatabase } from '../types'
import type { Migration } from './types'
import { draftSchema } from '../schemas/draft.schema'
import { contactSchema } from '../schemas/contact.schema'

/**
 * Migration: Add drafts and contacts collections for Story 2.3
 * This migration creates the drafts collection for storing email drafts
 * with auto-save support, and the contacts collection for recipient autocomplete.
 *
 * AC 4: To/Cc/Bcc fields with autocomplete from contacts
 * AC 6: Draft auto-save every 30 seconds to RxDB
 * FR006: Offline-first data storage (drafts stored locally)
 * FR007: Full read/write functionality offline
 */
export const migration_20251201_add_drafts_collection: Migration = {
  version: 5,
  name: '20251201_add_drafts_collection',

  /**
   * Forward migration: Add drafts and contacts collections
   */
  async up(db: AppDatabase): Promise<void> {
    // Check if collections already exist to support idempotent migrations
    const existingCollections = Object.keys(db.collections)

    // Add drafts collection if it doesn't exist
    if (!existingCollections.includes('drafts')) {
      await db.addCollections({
        drafts: {
          schema: draftSchema,
        },
      })
    }

    // Add contacts collection if it doesn't exist
    if (!existingCollections.includes('contacts')) {
      await db.addCollections({
        contacts: {
          schema: contactSchema,
        },
      })
    }
  },

  /**
   * Backward migration: Remove drafts and contacts collections
   * WARNING: This will delete all draft and contact data
   */
  async down(db: AppDatabase): Promise<void> {
    // Remove collections if they exist
    if (db.drafts) {
      await db.drafts.remove()
    }
    if (db.contacts) {
      await db.contacts.remove()
    }
  },
}
