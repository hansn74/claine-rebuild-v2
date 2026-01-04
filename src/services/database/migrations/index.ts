/**
 * Migration Registry
 * Central export point for all database migrations
 *
 * How to add a new migration:
 * 1. Create migration file: YYYYMMDD_description.ts
 * 2. Export it here with a descriptive name
 * 3. Update LATEST_SCHEMA_VERSION to match highest migration version
 */

import { migration_20251113_add_sentiment_field } from './20251113_add_sentiment_field'
import { migration_20251123_add_email_and_sync_collections } from './20251123_add_email_and_sync_collections'
import { migration_20251126_add_conflict_audit_collection } from './20251126_add_conflict_audit_collection'
import { migration_20251127_add_sync_failure_collection } from './20251127_add_sync_failure_collection'
import { migration_20251201_add_drafts_collection } from './20251201_add_drafts_collection'
import { migration_20251203_add_send_queue_collection } from './20251203_add_send_queue_collection'
import { migration_20251215_add_attributes_collection } from './20251215_add_attributes_collection'
import type { Migration } from './types'

/**
 * Latest schema version
 * Update this when adding new migrations to match the highest version number
 */
export const LATEST_SCHEMA_VERSION = 7

/**
 * All registered migrations in chronological order
 * These will be auto-registered by the migration runner
 */
export const allMigrations: Migration[] = [
  migration_20251113_add_sentiment_field,
  migration_20251123_add_email_and_sync_collections,
  migration_20251126_add_conflict_audit_collection,
  migration_20251127_add_sync_failure_collection,
  migration_20251201_add_drafts_collection,
  migration_20251203_add_send_queue_collection,
  migration_20251215_add_attributes_collection,
  // Add new migrations here in chronological order
]

// Export individual migrations for direct access if needed
export {
  migration_20251113_add_sentiment_field,
  migration_20251123_add_email_and_sync_collections,
  migration_20251126_add_conflict_audit_collection,
  migration_20251127_add_sync_failure_collection,
  migration_20251201_add_drafts_collection,
  migration_20251203_add_send_queue_collection,
  migration_20251215_add_attributes_collection,
}
