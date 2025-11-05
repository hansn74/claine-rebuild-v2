import { test, expect } from '@playwright/test'

test.describe('App Component E2E Tests', () => {
  test('should load app and display heading', async ({ page }) => {
    // Navigate to the app
    await page.goto('/')

    // Wait for the page to load
    await page.waitForLoadState('networkidle')

    // Assert h1 element contains "Claine v2"
    const heading = page.getByRole('heading', { name: /Claine v2/i, level: 1 })
    await expect(heading).toBeVisible()
    await expect(heading).toContainText('Claine v2')
  })

  test('should display Tailwind styled elements', async ({ page }) => {
    // Navigate to the app
    await page.goto('/')

    // Wait for the page to load
    await page.waitForLoadState('networkidle')

    // Assert blue background div is visible and has content
    const tailwindTestDiv = page.getByText(
      /Tailwind Test - Blue background, white text, padding, rounded corners/i
    )
    await expect(tailwindTestDiv).toBeVisible()

    // Verify the div has Tailwind styling applied by checking it has the bg-blue-500 class
    const hasBlueClass = await tailwindTestDiv.evaluate((el) => {
      return el.classList.contains('bg-blue-500')
    })
    expect(hasBlueClass).toBe(true)
  })

  test('should display shadcn/ui buttons', async ({ page }) => {
    // Navigate to the app
    await page.goto('/')

    // Wait for the page to load
    await page.waitForLoadState('networkidle')

    // Assert at least 3 buttons are visible
    const defaultButton = page.getByRole('button', { name: /Default Button/i })
    const secondaryButton = page.getByRole('button', { name: /Secondary/i })
    const outlineButton = page.getByRole('button', { name: /Outline/i })

    await expect(defaultButton).toBeVisible()
    await expect(secondaryButton).toBeVisible()
    await expect(outlineButton).toBeVisible()

    // Verify all buttons are clickable (interactive)
    await expect(defaultButton).toBeEnabled()
    await expect(secondaryButton).toBeEnabled()
    await expect(outlineButton).toBeEnabled()
  })

  test('should be responsive and display all elements', async ({ page }) => {
    // Navigate to the app
    await page.goto('/')

    // Wait for the page to load
    await page.waitForLoadState('networkidle')

    // Verify all key elements are present on the page
    const heading = page.getByRole('heading', { name: /Claine v2/i, level: 1 })
    const tailwindDiv = page.getByText(/Tailwind Test/i)
    const buttons = page.getByRole('button')

    await expect(heading).toBeVisible()
    await expect(tailwindDiv).toBeVisible()
    await expect(buttons).toHaveCount(3)
  })
})
