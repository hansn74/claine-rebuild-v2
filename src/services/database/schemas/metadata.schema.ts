/**
 * Metadata Schema for RxDB
 * Stores database version and migration history
 */

import type { RxJsonSchema } from 'rxdb'

/**
 * Metadata Document Interface
 * Used for version tracking and migration logging
 */
export interface MetadataDocument {
  /** Document ID (e.g., 'db-version' or 'migration-{timestamp}') */
  id: string

  /** Schema version number */
  version: number

  /** ISO timestamp of last migration */
  lastMigration: string

  /** Migration name (for migration log entries) */
  migrationName?: string

  /** Migration status (for migration log entries) */
  status?: 'start' | 'success' | 'failure'

  /** ISO timestamp (for migration log entries) */
  timestamp?: string

  /** Migration duration in ms (for migration log entries) */
  duration?: number

  /** Error message (for failed migrations) */
  error?: string
}

/**
 * RxDB Schema for Metadata
 * Version 0: Initial schema for version tracking
 */
export const metadataSchema: RxJsonSchema<MetadataDocument> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 255,
    },
    version: {
      type: 'number',
    },
    lastMigration: {
      type: 'string',
      maxLength: 100,
    },
    migrationName: {
      type: 'string',
      maxLength: 255,
    },
    status: {
      type: 'string',
      enum: ['start', 'success', 'failure'],
      maxLength: 20,
    },
    timestamp: {
      type: 'string',
      maxLength: 100,
    },
    duration: {
      type: 'number',
    },
    error: {
      type: 'string',
      maxLength: 10000,
    },
  },
  required: ['id', 'version', 'lastMigration'],
}
