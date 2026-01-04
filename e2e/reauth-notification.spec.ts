/**
 * Re-Auth Notification E2E Tests
 *
 * AC9: Notification appears when token refresh fails (tested)
 *
 * These tests verify the re-authentication notification UI works correctly
 * when users need to re-authenticate due to expired tokens.
 *
 * Note: These tests use window.__TEST_NOTIFICATION_STORE__ which is exposed
 * in development mode for E2E testing purposes.
 */

import { test, expect } from '@playwright/test'
import { waitForDatabaseReady } from './helpers/database'

/**
 * Helper to trigger a re-auth notification via the exposed test helper
 */
async function triggerNotification(
  page: import('@playwright/test').Page,
  accountId: string,
  provider: 'gmail' | 'outlook',
  error: string
) {
  await page.evaluate(
    ({ accountId, provider, error }) => {
      // The notification store is exposed on window for E2E testing
      const store = (
        window as unknown as {
          __TEST_NOTIFICATION_STORE__?: {
            addReAuthNotification: (a: string, p: 'gmail' | 'outlook', e: string) => void
          }
        }
      ).__TEST_NOTIFICATION_STORE__
      if (store) {
        store.addReAuthNotification(accountId, provider, error)
      } else {
        throw new Error('Notification store not exposed for testing')
      }
    },
    { accountId, provider, error }
  )
}

test.describe('Re-Auth Notification E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForDatabaseReady(page)
  })

  test('should show re-auth notification container when notification exists (AC9)', async ({
    page,
  }) => {
    await triggerNotification(page, 'user@gmail.com', 'gmail', 'Token expired')

    // Wait for the notification to appear
    const notification = page.getByTestId('reauth-notification-container')
    await expect(notification).toBeVisible({ timeout: 5000 })
  })

  test('should display Gmail re-auth notification with correct content', async ({ page }) => {
    await triggerNotification(page, 'user@gmail.com', 'gmail', 'Session expired')

    // Verify notification appears
    const notification = page.getByTestId('reauth-notification-user@gmail.com')
    await expect(notification).toBeVisible({ timeout: 5000 })

    // Verify content
    await expect(page.getByText('Gmail Re-authentication Required')).toBeVisible()
    await expect(page.getByText('user@gmail.com')).toBeVisible()
    await expect(page.getByText('Session expired')).toBeVisible()
  })

  test('should display Outlook re-auth notification with correct content', async ({ page }) => {
    await triggerNotification(page, 'user@outlook.com', 'outlook', 'Token invalid')

    // Verify notification appears
    const notification = page.getByTestId('reauth-notification-user@outlook.com')
    await expect(notification).toBeVisible({ timeout: 5000 })

    // Verify Outlook-specific content
    await expect(page.getByText('Outlook Re-authentication Required')).toBeVisible()
    await expect(page.getByText('user@outlook.com')).toBeVisible()
  })

  test('should dismiss notification when dismiss button clicked', async ({ page }) => {
    await triggerNotification(page, 'user@gmail.com', 'gmail', 'Token expired')

    // Wait for notification
    const notification = page.getByTestId('reauth-notification-user@gmail.com')
    await expect(notification).toBeVisible({ timeout: 5000 })

    // Click dismiss
    await page.getByTestId('dismiss-button').click()

    // Notification should disappear
    await expect(notification).not.toBeVisible()
  })

  test('should dismiss notification when close button clicked', async ({ page }) => {
    await triggerNotification(page, 'user@gmail.com', 'gmail', 'Token expired')

    // Wait for notification
    const notification = page.getByTestId('reauth-notification-user@gmail.com')
    await expect(notification).toBeVisible({ timeout: 5000 })

    // Click the close (X) button
    await page.getByLabel('Close notification').click()

    // Notification should disappear
    await expect(notification).not.toBeVisible()
  })

  test('should show multiple notifications for different accounts', async ({ page }) => {
    await triggerNotification(page, 'user@gmail.com', 'gmail', 'Gmail token expired')
    await triggerNotification(page, 'user@outlook.com', 'outlook', 'Outlook token expired')

    // Both notifications should be visible
    await expect(page.getByTestId('reauth-notification-user@gmail.com')).toBeVisible({
      timeout: 5000,
    })
    await expect(page.getByTestId('reauth-notification-user@outlook.com')).toBeVisible()

    // Both provider titles should be shown
    await expect(page.getByText('Gmail Re-authentication Required')).toBeVisible()
    await expect(page.getByText('Outlook Re-authentication Required')).toBeVisible()
  })

  test('should have Re-authenticate button that is clickable', async ({ page }) => {
    await triggerNotification(page, 'user@gmail.com', 'gmail', 'Token expired')

    // Wait for notification
    await expect(page.getByTestId('reauth-notification-user@gmail.com')).toBeVisible({
      timeout: 5000,
    })

    // Verify Re-authenticate button exists and is enabled
    const reAuthButton = page.getByTestId('reauth-button')
    await expect(reAuthButton).toBeVisible()
    await expect(reAuthButton).toBeEnabled()
    await expect(reAuthButton).toHaveText('Re-authenticate')
  })

  test('should remove notification when re-authenticate button clicked', async ({ page }) => {
    await triggerNotification(page, 'user@gmail.com', 'gmail', 'Token expired')

    // Wait for notification
    const notification = page.getByTestId('reauth-notification-user@gmail.com')
    await expect(notification).toBeVisible({ timeout: 5000 })

    // Click re-authenticate (this will try to initiate OAuth, which may fail in test env)
    // But the notification should still be removed
    await page.getByTestId('reauth-button').click()

    // Notification should be removed after clicking re-authenticate
    await expect(notification).not.toBeVisible({ timeout: 3000 })
  })

  test('should not show container when all notifications are dismissed', async ({ page }) => {
    await triggerNotification(page, 'user@gmail.com', 'gmail', 'Token expired')

    // Wait for notification
    await expect(page.getByTestId('reauth-notification-user@gmail.com')).toBeVisible({
      timeout: 5000,
    })

    // Dismiss the notification
    await page.getByTestId('dismiss-button').click()

    // Container should not be visible when no active notifications
    await expect(page.getByTestId('reauth-notification-container')).not.toBeVisible()
  })

  test('should have proper accessibility attributes', async ({ page }) => {
    await triggerNotification(page, 'user@gmail.com', 'gmail', 'Token expired')

    // Wait for notification
    await expect(page.getByTestId('reauth-notification-user@gmail.com')).toBeVisible({
      timeout: 5000,
    })

    // Check accessibility attributes
    const container = page.getByTestId('reauth-notification-container')
    await expect(container).toHaveAttribute('role', 'region')
    await expect(container).toHaveAttribute('aria-label', 'Re-authentication notifications')

    // Check notification alert role
    const notification = page.getByTestId('reauth-notification-user@gmail.com')
    await expect(notification).toHaveAttribute('role', 'alert')
  })
})
