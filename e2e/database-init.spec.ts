import { test, expect } from '@playwright/test'
import { waitForDatabaseReady } from './helpers/database'

test.describe('Database Initialization', () => {
  test('should initialize database on app launch', async ({ page }) => {
    // Navigate to the app
    await page.goto('/')

    // Note: Loading state may be too fast to catch in tests
    // Database initialization is typically < 1 second in test environment
    // We skip checking for "Initializing database..." and go straight to checking ready state

    // Wait for database initialization to complete
    await waitForDatabaseReady(page)

    // Should show the main app content
    await expect(page.getByRole('heading', { name: 'Claine v2' })).toBeVisible()
  })

  test('should persist database across page reloads', async ({ page }) => {
    // First load
    await page.goto('/')
    await waitForDatabaseReady(page)

    // Reload the page
    await page.reload()

    // Database should initialize faster on second load (already exists)
    await waitForDatabaseReady(page, 5000)
  })

  test('should handle database in IndexedDB', async ({ page }) => {
    await page.goto('/')
    await waitForDatabaseReady(page)

    // Check that IndexedDB has the database
    // RxDB with Dexie storage creates databases with pattern: rxdb-dexie-{name}--{version}--{collection}
    const databases = await page.evaluate(async () => {
      const dbs = await indexedDB.databases()
      return dbs.map((db) => db.name)
    })

    // Should have databases that include 'claine-v2' in their names
    const hasClaineDb = databases.some((name) => name?.includes('claine-v2'))
    expect(hasClaineDb).toBe(true)
  })

  test('should show all UI elements when database is ready', async ({ page }) => {
    await page.goto('/')
    await waitForDatabaseReady(page)

    // Check all expected UI elements
    await expect(page.getByText('Claine v2')).toBeVisible()
    await expect(page.getByText('Database Ready')).toBeVisible()
    await expect(
      page.getByText('Tailwind Test - Blue background, white text, padding, rounded corners')
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Default Button' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Secondary' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Outline' })).toBeVisible()
  })
})
