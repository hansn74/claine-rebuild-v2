import type { AppDatabase } from '../types'

/**
 * Migration interface - all migrations must implement this
 * Naming convention: YYYYMMDD_description.ts
 */
export interface Migration {
  /** Target schema version */
  version: number

  /** Migration name (derived from filename) */
  name: string

  /**
   * Forward migration - upgrade schema from previous version
   * @param db - Typed RxDatabase instance
   */
  up: (db: AppDatabase) => Promise<void>

  /**
   * Backward migration - rollback schema to previous version
   * @param db - Typed RxDatabase instance
   */
  down: (db: AppDatabase) => Promise<void>
}

/**
 * Migration result from execution
 */
export interface MigrationResult {
  version: number
  name: string
  success: boolean
  duration: number // milliseconds
  error?: string
}
