import type { AppDatabase } from './types'
import { versionTracker } from './versionTracker'
import type { Migration, MigrationResult } from './migrations/types'

/**
 * Migration Runner Service
 * Discovers and executes database migrations
 */
export class MigrationRunner {
  private migrations: Migration[] = []

  /**
   * Register a migration
   * @param migration - Migration to register
   */
  registerMigration(migration: Migration): void {
    this.migrations.push(migration)
    // Sort by version to ensure correct execution order
    this.migrations.sort((a, b) => a.version - b.version)
  }

  /**
   * Register multiple migrations at once
   * @param migrations - Array of migrations to register
   */
  registerMigrations(migrations: Migration[]): void {
    this.migrations.push(...migrations)
    // Sort by version to ensure correct execution order
    this.migrations.sort((a, b) => a.version - b.version)
  }

  /**
   * Get all registered migrations
   */
  getMigrations(): Migration[] {
    return [...this.migrations]
  }

  /**
   * Run all pending migrations from current version to target version
   * @param db - Typed RxDatabase instance
   * @param currentVersion - Current schema version
   * @param targetVersion - Target schema version
   * @returns Array of migration results
   */
  async runMigrations(
    db: AppDatabase,
    currentVersion: number,
    targetVersion: number
  ): Promise<MigrationResult[]> {
    const results: MigrationResult[] = []

    // Find migrations that need to run
    const pendingMigrations = this.migrations.filter(
      (m) => m.version > currentVersion && m.version <= targetVersion
    )

    if (pendingMigrations.length === 0) {
      return results
    }

    // Execute each migration sequentially
    for (const migration of pendingMigrations) {
      const result = await this.executeMigration(db, migration, 'up')
      results.push(result)

      if (!result.success) {
        // Stop on first failure
        throw new Error(`Migration ${migration.name} failed: ${result.error}`)
      }

      // Update version after successful migration
      await versionTracker.setVersion(db, migration.version)
    }

    return results
  }

  /**
   * Rollback to a specific version
   * @param db - Typed RxDatabase instance
   * @param targetVersion - Version to rollback to
   * @returns Array of migration results
   */
  async rollbackToVersion(db: AppDatabase, targetVersion: number): Promise<MigrationResult[]> {
    const currentVersion = await versionTracker.getCurrentVersion(db)
    const results: MigrationResult[] = []

    if (targetVersion >= currentVersion) {
      throw new Error(`Cannot rollback from version ${currentVersion} to ${targetVersion}`)
    }

    // Find migrations to rollback (in reverse order)
    const migrationsToRollback = this.migrations
      .filter((m) => m.version > targetVersion && m.version <= currentVersion)
      .reverse()

    for (const migration of migrationsToRollback) {
      const result = await this.executeMigration(db, migration, 'down')
      results.push(result)

      if (!result.success) {
        throw new Error(`Rollback of ${migration.name} failed: ${result.error}`)
      }

      // Update version after successful rollback
      const previousVersion = migration.version - 1
      await versionTracker.setVersion(db, previousVersion)
    }

    return results
  }

  /**
   * Execute a single migration (up or down)
   * @param db - Typed RxDatabase instance
   * @param migration - Migration to execute
   * @param direction - 'up' or 'down'
   * @returns Migration result
   */
  private async executeMigration(
    db: AppDatabase,
    migration: Migration,
    direction: 'up' | 'down'
  ): Promise<MigrationResult> {
    const startTime = Date.now()

    try {
      // Log migration start
      await versionTracker.logMigration(db, migration.name, 'start', {
        version: migration.version,
      })

      // Execute migration
      if (direction === 'up') {
        await migration.up(db)
      } else {
        await migration.down(db)
      }

      const duration = Date.now() - startTime

      // Log migration success
      await versionTracker.logMigration(db, migration.name, 'success', {
        version: migration.version,
        duration,
      })

      return {
        version: migration.version,
        name: migration.name,
        success: true,
        duration,
      }
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : String(error)

      // Log migration failure
      await versionTracker.logMigration(db, migration.name, 'failure', {
        version: migration.version,
        error: errorMessage,
        duration,
      })

      return {
        version: migration.version,
        name: migration.name,
        success: false,
        duration,
        error: errorMessage,
      }
    }
  }
}

/**
 * Singleton instance of MigrationRunner
 */
export const migrationRunner = new MigrationRunner()
