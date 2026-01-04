/**
 * Outlook OAuth E2E Tests
 *
 * AC2: OAuth E2E test for Outlook flow (deferred technical debt from Story 1.5)
 *
 * Note: These tests verify OAuth infrastructure without requiring real OAuth flows.
 * Real OAuth testing requires test Microsoft accounts and manual consent screen interaction.
 */

import { test, expect } from '@playwright/test'
import { waitForDatabaseReady } from './helpers/database'

/**
 * Mock OAuth callback URL params
 */
const MOCK_AUTH_CODE = 'mock_authorization_code_outlook_12345'
const MOCK_STATE = 'mock_state_value_outlook'

test.describe('Outlook OAuth E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForDatabaseReady(page)
  })

  test('should load app successfully for Outlook OAuth flow', async ({ page }) => {
    // Verify the app loads and is ready for OAuth
    await expect(page.getByText('Claine')).toBeVisible()
    await expect(page.getByText('Database Ready')).toBeVisible()
  })

  test('should handle Outlook OAuth callback route without crashing', async ({ page }) => {
    // Simulate OAuth callback by navigating to callback URL
    const callbackUrl = `/auth/callback?code=${MOCK_AUTH_CODE}&state=${MOCK_STATE}`

    const response = await page.goto(callbackUrl)

    // Page should load (even if OAuth fails)
    expect(response?.status()).toBeLessThan(500)
  })

  test('should handle callback with error parameter gracefully', async ({ page }) => {
    // Navigate to callback with error - should handle gracefully
    const callbackUrl = `/auth/callback?error=consent_required&state=${MOCK_STATE}`

    const response = await page.goto(callbackUrl)
    expect(response?.status()).toBeLessThan(500)
  })
})

test.describe('Outlook OAuth Integration Tests', () => {
  test.skip('should complete full Outlook OAuth flow with real credentials', async ({ page }) => {
    // This test is skipped by default as it requires:
    // 1. Valid VITE_MICROSOFT_* environment variables
    // 2. A test Microsoft account
    // 3. Manual interaction with Microsoft consent screen
    //
    // To run manually:
    // VITE_MICROSOFT_CLIENT_ID=xxx npx playwright test outlook-oauth.spec.ts --headed --grep "full Outlook OAuth flow"

    await page.goto('/')
    await waitForDatabaseReady(page)

    // Would need to:
    // 1. Click "Connect Outlook" button
    // 2. Wait for redirect to Microsoft
    // 3. Complete consent screen (potentially multi-factor)
    // 4. Handle callback
    // 5. Verify tokens stored
  })
})
