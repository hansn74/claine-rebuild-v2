/**
 * Circuit Breaker E2E Tests
 *
 * Story 1.19: Circuit Breaker for Provider APIs
 *
 * Tests the circuit breaker UI notification lifecycle:
 * - AC 11: Provider-specific status banner with countdown
 * - AC 12: Countdown timer visible
 * - AC 13: "Retry Now" button to force probe
 * - AC 14: Success notification when circuit closes
 *
 * Uses window.__TEST_CIRCUIT_BREAKER__ exposed in dev mode
 * by src/utils/debugHelpers.ts.
 */

import { test, expect } from '@playwright/test'

/** Type for the circuit breaker exposed on window */
interface TestCircuitBreaker {
  recordFailure: (provider: 'gmail' | 'outlook') => void
  recordSuccess: (provider: 'gmail' | 'outlook') => void
  canExecute: (provider: 'gmail' | 'outlook') => boolean
  getState: (provider: 'gmail' | 'outlook') => 'closed' | 'open' | 'half-open'
  forceProbe: (provider: 'gmail' | 'outlook') => void
  reset: (provider: 'gmail' | 'outlook') => void
  resetAll: () => void
}

/**
 * Trip the circuit breaker for a provider by recording 5 consecutive failures.
 */
async function tripCircuit(page: import('@playwright/test').Page, provider: 'gmail' | 'outlook') {
  await page.evaluate(
    ({ provider }) => {
      const cb = (window as unknown as { __TEST_CIRCUIT_BREAKER__?: TestCircuitBreaker })
        .__TEST_CIRCUIT_BREAKER__
      if (!cb) throw new Error('Circuit breaker not exposed for testing')
      for (let i = 0; i < 5; i++) {
        cb.recordFailure(provider)
      }
    },
    { provider }
  )
}

/**
 * Get the current circuit state for a provider.
 */
async function getCircuitState(
  page: import('@playwright/test').Page,
  provider: 'gmail' | 'outlook'
): Promise<string> {
  return page.evaluate(
    ({ provider }) => {
      const cb = (window as unknown as { __TEST_CIRCUIT_BREAKER__?: TestCircuitBreaker })
        .__TEST_CIRCUIT_BREAKER__
      if (!cb) throw new Error('Circuit breaker not exposed for testing')
      return cb.getState(provider)
    },
    { provider }
  )
}

/**
 * Reset all circuits to closed state.
 */
async function resetCircuits(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    const cb = (window as unknown as { __TEST_CIRCUIT_BREAKER__?: TestCircuitBreaker })
      .__TEST_CIRCUIT_BREAKER__
    if (cb) cb.resetAll()
  })
}

/**
 * Record a success for a provider (used to close circuit from half-open).
 */
async function recordSuccess(page: import('@playwright/test').Page, provider: 'gmail' | 'outlook') {
  await page.evaluate(
    ({ provider }) => {
      const cb = (window as unknown as { __TEST_CIRCUIT_BREAKER__?: TestCircuitBreaker })
        .__TEST_CIRCUIT_BREAKER__
      if (!cb) throw new Error('Circuit breaker not exposed for testing')
      cb.recordSuccess(provider)
    },
    { provider }
  )
}

/**
 * Wait for the app to initialize and skip past the Welcome Screen.
 *
 * The app shows WelcomeScreen when no accounts are connected.
 * CircuitBreakerNotification only renders in the main UI,
 * so we must click "Skip for now" to get there.
 */
async function waitForAppReady(page: import('@playwright/test').Page) {
  // Wait for welcome screen to appear (means DB is initialized)
  const skipLink = page.getByText('Skip for now')
  await expect(skipLink).toBeVisible({ timeout: 20000 })

  // Dismiss welcome screen to reach main UI
  await skipLink.click()

  // Wait for main UI header to appear
  await expect(page.getByRole('heading', { name: 'Claine' })).toBeVisible({ timeout: 5000 })
}

test.describe('Circuit Breaker E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await waitForAppReady(page)
  })

  test.afterEach(async ({ page }) => {
    await resetCircuits(page)
  })

  test('should show notification banner when Gmail circuit opens (AC 11)', async ({ page }) => {
    await tripCircuit(page, 'gmail')

    // Verify state
    expect(await getCircuitState(page, 'gmail')).toBe('open')

    // Banner should appear
    const banner = page.getByTestId('circuit-breaker-gmail')
    await expect(banner).toBeVisible({ timeout: 5000 })

    // Container should be visible
    await expect(page.getByTestId('circuit-breaker-notifications')).toBeVisible()
  })

  test('should show notification banner when Outlook circuit opens (AC 11)', async ({ page }) => {
    await tripCircuit(page, 'outlook')

    expect(await getCircuitState(page, 'outlook')).toBe('open')

    const banner = page.getByTestId('circuit-breaker-outlook')
    await expect(banner).toBeVisible({ timeout: 5000 })
  })

  test('should display provider name and countdown text (AC 12)', async ({ page }) => {
    await tripCircuit(page, 'gmail')

    // Check the "temporarily unavailable" text
    await expect(page.getByText(/Gmail temporarily unavailable/)).toBeVisible({ timeout: 5000 })

    // Check countdown format (e.g. "1m 0s" or "59s")
    await expect(page.getByText(/retrying in/)).toBeVisible()
  })

  test('should have accessible alert role on banner', async ({ page }) => {
    await tripCircuit(page, 'gmail')

    const banner = page.getByTestId('circuit-breaker-gmail')
    await expect(banner).toBeVisible({ timeout: 5000 })
    await expect(banner).toHaveAttribute('role', 'alert')
    await expect(banner).toHaveAttribute('aria-live', 'polite')
  })

  test('should show Retry Now button (AC 13)', async ({ page }) => {
    await tripCircuit(page, 'gmail')

    const retryButton = page.getByTestId('circuit-breaker-retry-gmail')
    await expect(retryButton).toBeVisible({ timeout: 5000 })
    await expect(retryButton).toBeEnabled()
    await expect(retryButton).toHaveText('Retry Now')
  })

  test('should transition to half-open when Retry Now is clicked (AC 13)', async ({ page }) => {
    await tripCircuit(page, 'gmail')

    await expect(page.getByTestId('circuit-breaker-retry-gmail')).toBeVisible({ timeout: 5000 })

    // Click Retry Now — this calls forceProbe which transitions open → half-open
    await page.getByTestId('circuit-breaker-retry-gmail').click()

    // Circuit should be half-open now
    expect(await getCircuitState(page, 'gmail')).toBe('half-open')
  })

  test('should show recovery toast when circuit closes after probe (AC 14)', async ({ page }) => {
    await tripCircuit(page, 'gmail')
    await expect(page.getByTestId('circuit-breaker-gmail')).toBeVisible({ timeout: 5000 })

    // Force probe → half-open
    await page.getByTestId('circuit-breaker-retry-gmail').click()
    expect(await getCircuitState(page, 'gmail')).toBe('half-open')

    // Simulate probe success → closed
    await recordSuccess(page, 'gmail')
    expect(await getCircuitState(page, 'gmail')).toBe('closed')

    // Recovery toast should appear
    const toast = page.getByTestId('circuit-breaker-recovered-gmail')
    await expect(toast).toBeVisible({ timeout: 5000 })
    await expect(page.getByText(/Gmail connection restored/)).toBeVisible()
  })

  test('should auto-dismiss recovery toast after 3 seconds (AC 14)', async ({ page }) => {
    await tripCircuit(page, 'gmail')
    await expect(page.getByTestId('circuit-breaker-gmail')).toBeVisible({ timeout: 5000 })

    // Recover
    await page.getByTestId('circuit-breaker-retry-gmail').click()
    await recordSuccess(page, 'gmail')

    const toast = page.getByTestId('circuit-breaker-recovered-gmail')
    await expect(toast).toBeVisible({ timeout: 5000 })

    // Should auto-dismiss after ~3s
    await expect(toast).not.toBeVisible({ timeout: 5000 })
  })

  test('should hide banner when circuit closes', async ({ page }) => {
    await tripCircuit(page, 'gmail')

    const banner = page.getByTestId('circuit-breaker-gmail')
    await expect(banner).toBeVisible({ timeout: 5000 })

    // Recover: force probe + success
    await page.getByTestId('circuit-breaker-retry-gmail').click()
    await recordSuccess(page, 'gmail')

    // Banner should disappear
    await expect(banner).not.toBeVisible({ timeout: 5000 })
  })

  test('should show both provider banners simultaneously', async ({ page }) => {
    await tripCircuit(page, 'gmail')
    await tripCircuit(page, 'outlook')

    await expect(page.getByTestId('circuit-breaker-gmail')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('circuit-breaker-outlook')).toBeVisible()

    await expect(page.getByText(/Gmail temporarily unavailable/)).toBeVisible()
    await expect(page.getByText(/Outlook temporarily unavailable/)).toBeVisible()
  })

  test('should isolate provider circuits (AC 8)', async ({ page }) => {
    // Trip only Gmail
    await tripCircuit(page, 'gmail')

    // Gmail banner visible, Outlook not
    await expect(page.getByTestId('circuit-breaker-gmail')).toBeVisible({ timeout: 5000 })
    await expect(page.getByTestId('circuit-breaker-outlook')).not.toBeVisible()

    // Outlook circuit should still be closed
    expect(await getCircuitState(page, 'outlook')).toBe('closed')
  })

  test('should not show banner when circuit is closed', async ({ page }) => {
    // No failures — both circuits closed
    await expect(page.getByTestId('circuit-breaker-notifications')).not.toBeVisible()
  })

  test('full lifecycle: closed → open → half-open → closed', async ({ page }) => {
    // 1. Closed — no banner
    expect(await getCircuitState(page, 'gmail')).toBe('closed')
    await expect(page.getByTestId('circuit-breaker-notifications')).not.toBeVisible()

    // 2. Trip → Open — banner appears
    await tripCircuit(page, 'gmail')
    expect(await getCircuitState(page, 'gmail')).toBe('open')
    await expect(page.getByTestId('circuit-breaker-gmail')).toBeVisible({ timeout: 5000 })

    // 3. Retry Now → Half-Open
    await page.getByTestId('circuit-breaker-retry-gmail').click()
    expect(await getCircuitState(page, 'gmail')).toBe('half-open')

    // 4. Success → Closed — banner gone, recovery toast shown
    await recordSuccess(page, 'gmail')
    expect(await getCircuitState(page, 'gmail')).toBe('closed')
    await expect(page.getByTestId('circuit-breaker-gmail')).not.toBeVisible()
    await expect(page.getByTestId('circuit-breaker-recovered-gmail')).toBeVisible({ timeout: 5000 })
  })
})
