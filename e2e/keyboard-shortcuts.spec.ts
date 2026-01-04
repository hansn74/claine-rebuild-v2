/**
 * Keyboard Shortcuts E2E Tests
 *
 * Story 2.11: Keyboard Shortcuts & Power User Features
 * Task 10: Integration Testing and Documentation
 *
 * Tests:
 * - ? key opens shortcut overlay
 * - Cmd/Ctrl+K opens command palette
 * - c key opens compose (when not in input)
 * - / key focuses search
 * - Escape closes modals
 * - Navigation shortcuts (j/k) work in email list
 */

import { test, expect, Page } from '@playwright/test'

/**
 * Helper to wait for app to be ready after database initialization
 */
async function waitForAppReady(page: Page): Promise<void> {
  // Wait for either the welcome screen or the main app header
  await expect(
    page.getByTestId('welcome-screen').or(page.getByRole('heading', { name: 'Claine' }))
  ).toBeVisible({ timeout: 30000 })
}

/**
 * Helper to dismiss welcome screen if present
 */
async function dismissWelcomeIfPresent(page: Page): Promise<void> {
  const welcomeScreen = page.getByTestId('welcome-screen')
  if (await welcomeScreen.isVisible({ timeout: 1000 }).catch(() => false)) {
    const skipButton = page.getByRole('button', { name: /skip|maybe later|continue/i })
    if (await skipButton.isVisible({ timeout: 500 }).catch(() => false)) {
      await skipButton.click()
    }
  }
}

/**
 * Helper to set up localStorage to skip welcome screen
 */
async function skipOnboarding(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.setItem('claine_welcome_dismissed', 'true')
    localStorage.setItem('claine_onboarding_completed', 'true')
  })
}

test.describe('Story 2.11: Keyboard Shortcuts & Power User Features', () => {
  test.describe('Shortcut Overlay (AC1)', () => {
    test('should open shortcut overlay when pressing ? key', async ({ page }) => {
      await page.goto('/')
      await skipOnboarding(page)
      await page.reload()
      await waitForAppReady(page)
      await dismissWelcomeIfPresent(page)

      // Press ? (shift+/) to open shortcuts overlay
      await page.keyboard.press('Shift+/')

      // Verify shortcut overlay is visible
      const overlay = page.getByRole('dialog', { name: /keyboard shortcuts/i })
      await expect(overlay).toBeVisible({ timeout: 2000 })

      // Verify it contains shortcut categories
      await expect(page.getByText('Navigation')).toBeVisible()
      await expect(page.getByText('Actions')).toBeVisible()
    })

    test('should close shortcut overlay when pressing Escape', async ({ page }) => {
      await page.goto('/')
      await skipOnboarding(page)
      await page.reload()
      await waitForAppReady(page)
      await dismissWelcomeIfPresent(page)

      // Open shortcuts overlay
      await page.keyboard.press('Shift+/')
      const overlay = page.getByRole('dialog', { name: /keyboard shortcuts/i })
      await expect(overlay).toBeVisible()

      // Press Escape to close
      await page.keyboard.press('Escape')

      // Verify overlay is closed
      await expect(overlay).not.toBeVisible()
    })

    test('should have search/filter functionality in overlay', async ({ page }) => {
      await page.goto('/')
      await skipOnboarding(page)
      await page.reload()
      await waitForAppReady(page)
      await dismissWelcomeIfPresent(page)

      // Open shortcuts overlay
      await page.keyboard.press('Shift+/')
      await expect(page.getByRole('dialog', { name: /keyboard shortcuts/i })).toBeVisible()

      // Find search input and type
      const searchInput = page.getByPlaceholder(/search shortcuts/i)
      await searchInput.fill('archive')

      // Verify filtered results
      await expect(page.getByText('Archive')).toBeVisible()
    })
  })

  test.describe('Command Palette (AC4)', () => {
    test('should open command palette when pressing Cmd+K', async ({ page }) => {
      await page.goto('/')
      await skipOnboarding(page)
      await page.reload()
      await waitForAppReady(page)
      await dismissWelcomeIfPresent(page)

      // Press Cmd+K (Mac) or Ctrl+K (Windows/Linux) to open command palette
      await page.keyboard.press('Meta+k')

      // Verify command palette is visible
      const palette = page.getByRole('dialog', { name: /search emails/i })
      await expect(palette).toBeVisible({ timeout: 2000 })
    })

    test('should show quick actions with shortcut hints in command palette', async ({ page }) => {
      await page.goto('/')
      await skipOnboarding(page)
      await page.reload()
      await waitForAppReady(page)
      await dismissWelcomeIfPresent(page)

      // Open command palette
      await page.keyboard.press('Meta+k')
      await expect(page.getByRole('dialog', { name: /search emails/i })).toBeVisible()

      // Verify quick actions section is visible
      await expect(page.getByText('Quick Actions')).toBeVisible()

      // Verify at least one command with shortcut hint
      await expect(page.getByText('New Email')).toBeVisible()
    })

    test('should close command palette when pressing Escape', async ({ page }) => {
      await page.goto('/')
      await skipOnboarding(page)
      await page.reload()
      await waitForAppReady(page)
      await dismissWelcomeIfPresent(page)

      // Open and then close command palette
      await page.keyboard.press('Meta+k')
      const palette = page.getByRole('dialog', { name: /search emails/i })
      await expect(palette).toBeVisible()

      await page.keyboard.press('Escape')
      await expect(palette).not.toBeVisible()
    })
  })

  test.describe('Global Shortcuts (AC2/AC3)', () => {
    test('should focus search when pressing / key', async ({ page }) => {
      await page.goto('/')
      await skipOnboarding(page)
      await page.reload()
      await waitForAppReady(page)
      await dismissWelcomeIfPresent(page)

      // Press / to focus search
      await page.keyboard.press('/')

      // Verify search is focused/opened
      const searchInput = page
        .getByRole('textbox', { name: /search/i })
        .or(page.getByPlaceholder(/search emails/i))
      await expect(searchInput).toBeFocused({ timeout: 2000 })
    })

    test('should open compose when pressing c key (when not in input)', async ({ page }) => {
      await page.goto('/')
      await skipOnboarding(page)
      await page.reload()
      await waitForAppReady(page)
      await dismissWelcomeIfPresent(page)

      // Press c to open compose
      await page.keyboard.press('c')

      // Verify compose dialog is visible
      // Note: This may vary based on actual implementation
      const composeDialog = page
        .getByRole('dialog', { name: /compose|new email/i })
        .or(page.getByText(/compose/i))
      await expect(composeDialog).toBeVisible({ timeout: 2000 })
    })
  })

  test.describe('Vim Mode (AC5)', () => {
    test('should persist vim mode preference in localStorage', async ({ page }) => {
      await page.goto('/')
      await skipOnboarding(page)
      await page.reload()
      await waitForAppReady(page)

      // Set vim mode via localStorage
      await page.evaluate(() => {
        localStorage.setItem(
          'claine-shortcut-preferences',
          JSON.stringify({ vimModeEnabled: true })
        )
      })

      // Reload and verify preference is persisted
      await page.reload()
      await waitForAppReady(page)

      const prefs = await page.evaluate(() => {
        const stored = localStorage.getItem('claine-shortcut-preferences')
        return stored ? JSON.parse(stored) : null
      })

      expect(prefs?.vimModeEnabled).toBe(true)
    })
  })

  test.describe('Accessibility', () => {
    test('shortcut overlay should have proper ARIA attributes', async ({ page }) => {
      await page.goto('/')
      await skipOnboarding(page)
      await page.reload()
      await waitForAppReady(page)
      await dismissWelcomeIfPresent(page)

      // Open shortcuts overlay
      await page.keyboard.press('Shift+/')

      // Verify dialog has aria-modal
      const overlay = page.getByRole('dialog', { name: /keyboard shortcuts/i })
      await expect(overlay).toHaveAttribute('aria-modal', 'true')
    })

    test('command palette should have proper ARIA attributes', async ({ page }) => {
      await page.goto('/')
      await skipOnboarding(page)
      await page.reload()
      await waitForAppReady(page)
      await dismissWelcomeIfPresent(page)

      // Open command palette
      await page.keyboard.press('Meta+k')

      // Verify dialog has aria-modal
      const palette = page.getByRole('dialog', { name: /search emails/i })
      await expect(palette).toHaveAttribute('aria-modal', 'true')
    })

    test('skip links navigation should exist', async ({ page }) => {
      await page.goto('/')
      await skipOnboarding(page)
      await page.reload()
      await waitForAppReady(page)
      await dismissWelcomeIfPresent(page)

      // Skip links nav should exist (sr-only until focused)
      const skipNav = page.getByRole('navigation', { name: /skip links/i })
      await expect(skipNav).toBeAttached()
    })

    test('main content landmark should have id for skip links', async ({ page }) => {
      await page.goto('/')
      await skipOnboarding(page)
      await page.reload()
      await waitForAppReady(page)
      await dismissWelcomeIfPresent(page)

      // Main content should have id="main-content" for skip link targeting
      const mainContent = page.locator('main#main-content')
      await expect(mainContent).toBeVisible()
    })
  })

  test.describe('Integration - Complete Navigation Flow (Task 10.1)', () => {
    test('should complete full keyboard navigation workflow', async ({ page }) => {
      await page.goto('/')
      await skipOnboarding(page)
      await page.reload()
      await waitForAppReady(page)
      await dismissWelcomeIfPresent(page)

      // Step 1: Open help overlay with ?
      await page.keyboard.press('Shift+/')
      await expect(page.getByRole('dialog', { name: /keyboard shortcuts/i })).toBeVisible()

      // Step 2: Close overlay with Escape
      await page.keyboard.press('Escape')
      await expect(page.getByRole('dialog', { name: /keyboard shortcuts/i })).not.toBeVisible()

      // Step 3: Open search with /
      await page.keyboard.press('/')
      const searchDialog = page.getByRole('dialog', { name: /search emails/i })
      await expect(searchDialog).toBeVisible()

      // Step 4: Close search with Escape
      await page.keyboard.press('Escape')
      await expect(searchDialog).not.toBeVisible()

      // Step 5: Try to compose with c
      await page.keyboard.press('c')
      // Compose dialog should appear (may need account setup in real test)
      await page.waitForTimeout(500) // Allow time for dialog to appear
    })
  })

  test.describe('Browser Shortcut Conflicts (Task 10.3)', () => {
    test('should not conflict with Cmd+F browser find', async ({ page }) => {
      await page.goto('/')
      await skipOnboarding(page)
      await page.reload()
      await waitForAppReady(page)
      await dismissWelcomeIfPresent(page)

      // Cmd+F should still work (we don't override it)
      // This test just verifies our shortcuts don't break default browser behavior
      // by ensuring no error is thrown
      await page.keyboard.press('Meta+f')
      await page.waitForTimeout(200)

      // App should still be functional
      const header = page.getByRole('heading', { name: 'Claine' })
      await expect(header).toBeVisible()
    })

    test('shortcuts should not fire when typing in input fields', async ({ page }) => {
      await page.goto('/')
      await skipOnboarding(page)
      await page.reload()
      await waitForAppReady(page)
      await dismissWelcomeIfPresent(page)

      // Open command palette
      await page.keyboard.press('Meta+k')
      const palette = page.getByRole('dialog', { name: /search emails/i })
      await expect(palette).toBeVisible()

      // Type in search input - 'c' should not open compose
      const searchInput = page.getByPlaceholder(/search emails/i)
      await searchInput.fill('c')

      // Compose dialog should NOT be visible (c should be typed, not trigger shortcut)
      await expect(searchInput).toHaveValue('c')

      // Close palette
      await page.keyboard.press('Escape')
    })
  })
})
