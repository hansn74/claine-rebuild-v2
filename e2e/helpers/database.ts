import { Page, expect } from '@playwright/test'

/**
 * Database Test Helper Functions
 *
 * These helpers provide reusable patterns for E2E tests that interact
 * with the RxDB database initialization flow in the App component.
 *
 * Background:
 * The App component initializes RxDB on mount, which involves:
 * 1. Creating/opening IndexedDB databases
 * 2. Running schema migrations if needed
 * 3. Setting up collections and indexes
 *
 * This process takes 1-2 seconds on first load and is asynchronous.
 * Tests must wait for "Database Ready" indicator before asserting
 * on UI elements that only render after successful initialization.
 *
 * Related:
 * - src/App.tsx - Shows loading/error/ready states
 * - src/services/database/init.ts - Database initialization logic
 * - docs/stories/1-3g-fix-epic-0-e2e-tests.md - This story
 */

/**
 * Wait for the database to complete initialization.
 *
 * This function waits for the "Database Ready" indicator to appear,
 * which signals that:
 * - RxDB has been initialized
 * - All migrations have run successfully
 * - Collections are ready for use
 * - The app UI is fully rendered
 *
 * Usage:
 * ```typescript
 * test('should display app content', async ({ page }) => {
 *   await page.goto('/')
 *   await waitForDatabaseReady(page)
 *   // Now safe to assert on UI elements
 *   await expect(page.getByRole('heading', { name: 'Claine v2' })).toBeVisible()
 * })
 * ```
 *
 * @param page - Playwright Page object
 * @param timeout - Maximum time to wait in milliseconds (default: 20000)
 * @throws Will throw if database doesn't become ready within timeout
 */
export async function waitForDatabaseReady(page: Page, timeout: number = 20000): Promise<void> {
  // Wait for "Database Ready" indicator with case-insensitive match
  await expect(page.getByText(/Database Ready/i)).toBeVisible({
    timeout,
  })
}
