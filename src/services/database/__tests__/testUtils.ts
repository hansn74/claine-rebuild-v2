/**
 * Test utilities for database testing
 * Provides helper functions for creating and destroying test databases
 */

import { initDatabase, closeDatabase, __resetDatabaseForTesting } from '../init'
import type { AppDatabase } from '../types'
// Import OPEN_COLLECTIONS to manually clear it when tests leak collections
// This is needed because RxDB free version has a 16-collection limit
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - OPEN_COLLECTIONS is exported from rxdb but not in TypeScript types
import { OPEN_COLLECTIONS } from 'rxdb'

// Counter to ensure truly unique database names even in parallel test execution
let dbCounter = 0

/**
 * Create a test database with a unique name
 * @param prefix - Prefix for the database name (default: 'test')
 * @returns Initialized test database
 */
export async function createTestDatabase(prefix: string = 'test'): Promise<AppDatabase> {
  // Use unique database name to avoid conflicts in parallel test execution
  // Combine timestamp, random value, and counter for maximum uniqueness
  // Must start with lowercase letter and contain only lowercase, digits, and hyphens
  const uniqueId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}-${++dbCounter}`
  const testDbName = `${prefix}-${uniqueId}`

  const db = await initDatabase(testDbName)
  return db
}

/**
 * Destroy a test database and clean up
 * @param db - Database to destroy
 */
export async function destroyTestDatabase(_db: AppDatabase): Promise<void> {
  try {
    // Close and remove the database completely from storage
    // closeDatabase now handles collection removal to work around RxDB 16-collection limit
    await closeDatabase(true)

    // Reset singleton for clean state
    __resetDatabaseForTesting()

    // Force clear OPEN_COLLECTIONS to prevent 16-collection limit issues
    // This is a workaround for RxDB free version limitations in test environments
    if (OPEN_COLLECTIONS && OPEN_COLLECTIONS instanceof Set) {
      OPEN_COLLECTIONS.clear()
    }
  } catch (error) {
    // Log but don't throw - allow tests to continue
    console.warn('Error cleaning up test database:', error)

    // Force reset even on error
    __resetDatabaseForTesting()

    // Still try to clear OPEN_COLLECTIONS
    if (OPEN_COLLECTIONS && OPEN_COLLECTIONS instanceof Set) {
      OPEN_COLLECTIONS.clear()
    }
  }
}
