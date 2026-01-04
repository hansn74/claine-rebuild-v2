import type { AppDatabase } from '../types'
import type { Migration } from './types'

/**
 * Example migration: Add sentiment field to email schema
 * This demonstrates how to:
 * 1. Modify existing schemas
 * 2. Set default values for existing documents
 * 3. Implement rollback logic
 *
 * Naming convention: YYYYMMDD_description.ts
 */
export const migration_20251113_add_sentiment_field: Migration = {
  version: 1,
  name: '20251113_add_sentiment_field',

  /**
   * Forward migration: Add sentiment field to email schema
   * Sets default value of 'neutral' for all existing emails
   */
  async up(db: AppDatabase): Promise<void> {
    // Note: In a real migration, we would:
    // 1. Update the schema version in the schema file
    // 2. Update existing documents with default values
    // For this example, we're just demonstrating the pattern

    // If emails collection exists, set default sentiment for existing documents
    if (db.emails) {
      const emails = await db.emails.find().exec()

      for (const email of emails) {
        await email.update({
          $set: {
            'aiMetadata.sentiment': 'neutral',
          },
        })
      }
    }
  },

  /**
   * Backward migration: Remove sentiment field
   */
  async down(db: AppDatabase): Promise<void> {
    // Remove sentiment field from all emails
    if (db.emails) {
      const emails = await db.emails.find().exec()

      for (const email of emails) {
        await email.update({
          $unset: {
            'aiMetadata.sentiment': '',
          },
        })
      }
    }
  },
}
