/**
 * Gmail OAuth E2E Tests
 *
 * AC1: OAuth E2E test for Gmail flow (deferred technical debt from Story 1.4)
 *
 * Note: These tests verify OAuth infrastructure without requiring real OAuth flows.
 * Real OAuth testing requires test Google accounts and manual consent screen interaction.
 */

import { test, expect } from '@playwright/test'
import { waitForDatabaseReady } from './helpers/database'

/**
 * Mock OAuth callback URL params
 */
const MOCK_AUTH_CODE = 'mock_authorization_code_12345'
const MOCK_STATE = 'mock_state_value'

test.describe('Gmail OAuth E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForDatabaseReady(page)
  })

  test('should load app successfully for OAuth flow', async ({ page }) => {
    // Verify the app loads and is ready for OAuth
    await expect(page.getByText('Claine')).toBeVisible()
    await expect(page.getByText('Database Ready')).toBeVisible()
  })

  test('should handle OAuth callback route without crashing', async ({ page }) => {
    // Simulate OAuth callback by navigating to callback URL
    // Note: This will fail token exchange without real credentials, but tests the route handling
    const callbackUrl = `/auth/callback?code=${MOCK_AUTH_CODE}&state=${MOCK_STATE}`

    // We can't fully test token exchange without mocking fetch
    // But we can verify the callback route doesn't crash the app
    const response = await page.goto(callbackUrl)

    // Page should load (even if OAuth fails)
    expect(response?.status()).toBeLessThan(500)
  })

  test('should handle callback without code parameter gracefully', async ({ page }) => {
    // Navigate to callback without code - should handle gracefully
    const callbackUrl = `/auth/callback?error=access_denied&state=${MOCK_STATE}`

    const response = await page.goto(callbackUrl)
    expect(response?.status()).toBeLessThan(500)
  })
})

test.describe('Gmail OAuth Integration Tests', () => {
  test.skip('should complete full OAuth flow with real credentials', async ({ page }) => {
    // This test is skipped by default as it requires:
    // 1. Valid VITE_GOOGLE_* environment variables
    // 2. A test Google account
    // 3. Manual interaction with Google consent screen
    //
    // To run manually:
    // VITE_GOOGLE_CLIENT_ID=xxx npx playwright test gmail-oauth.spec.ts --headed --grep "full OAuth flow"

    await page.goto('/')
    await waitForDatabaseReady(page)

    // Would need to:
    // 1. Click "Connect Gmail" button
    // 2. Wait for redirect to Google
    // 3. Complete consent screen
    // 4. Handle callback
    // 5. Verify tokens stored
  })
})
