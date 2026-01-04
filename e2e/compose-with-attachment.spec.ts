/**
 * Compose with Attachment E2E Tests
 *
 * Story 2.8: Attachment Handling
 * Task 5.5: E2E test for compose with attachment
 *
 * Tests for the compose dialog attachment functionality including:
 * - Opening compose dialog
 * - Attaching files via file picker
 * - Displaying attached files with size
 * - Removing attached files
 * - Drag-and-drop visual feedback
 */

import { test, expect } from '@playwright/test'

test.describe('Compose with Attachment', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app and wait for initialization
    await page.goto('/')

    // Wait for app to initialize (loading spinner to disappear)
    await page.waitForTimeout(2000)

    // Verify app has loaded by checking for the Compose button
    const composeButton = page.getByRole('button', { name: /Compose/i })
    await expect(composeButton).toBeVisible({ timeout: 10000 })
  })

  test.describe('Compose Dialog @compose @attachment', () => {
    test('should open compose dialog when clicking Compose button', async ({ page }) => {
      // Click compose button
      const composeButton = page.getByRole('button', { name: /Compose/i })
      await composeButton.click()

      // Wait for compose dialog to appear
      const composeDialog = page.getByRole('dialog')
      await expect(composeDialog).toBeVisible()

      // Verify it's a compose dialog (has "New Message" title or similar)
      const dialogTitle = page.getByText(/New Message|Reply|Forward/i)
      await expect(dialogTitle).toBeVisible()
    })

    test('should open compose dialog with keyboard shortcut "c"', async ({ page }) => {
      // Press 'c' key to open compose
      await page.keyboard.press('c')

      // Wait for compose dialog to appear
      const composeDialog = page.getByRole('dialog')
      await expect(composeDialog).toBeVisible({ timeout: 3000 })
    })

    test('should close compose dialog with Escape key', async ({ page }) => {
      // Open compose
      const composeButton = page.getByRole('button', { name: /Compose/i })
      await composeButton.click()

      // Verify dialog is open
      const composeDialog = page.getByRole('dialog')
      await expect(composeDialog).toBeVisible()

      // Press Escape to close
      await page.keyboard.press('Escape')

      // Verify dialog is closed
      await expect(composeDialog).not.toBeVisible()
    })
  })

  test.describe('Attachment Upload @compose @attachment', () => {
    test('should display attach button in compose dialog', async ({ page }) => {
      // Open compose
      await page.getByRole('button', { name: /Compose/i }).click()

      // Verify dialog is open
      const composeDialog = page.getByRole('dialog')
      await expect(composeDialog).toBeVisible()

      // Look for Attach button
      const attachButton = page.getByRole('button', { name: /Attach/i })
      await expect(attachButton).toBeVisible()
    })

    test('should display "or drag files here" hint', async ({ page }) => {
      // Open compose
      await page.getByRole('button', { name: /Compose/i }).click()
      await expect(page.getByRole('dialog')).toBeVisible()

      // Look for drag hint text
      const dragHint = page.getByText(/drag files here/i)
      await expect(dragHint).toBeVisible()
    })

    test('should attach file via file picker', async ({ page }) => {
      // Open compose
      await page.getByRole('button', { name: /Compose/i }).click()
      await expect(page.getByRole('dialog')).toBeVisible()

      // Get the hidden file input
      const fileInput = page.locator('input[type="file"]')

      // Create a test file
      await fileInput.setInputFiles({
        name: 'test-document.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('PDF content here'),
      })

      // Verify attachment appears in the list
      await expect(page.getByText('test-document.pdf')).toBeVisible()
    })

    test('should display file size for attached file', async ({ page }) => {
      // Open compose
      await page.getByRole('button', { name: /Compose/i }).click()
      await expect(page.getByRole('dialog')).toBeVisible()

      // Get the hidden file input
      const fileInput = page.locator('input[type="file"]')

      // Create a test file with specific size
      const content = 'x'.repeat(1024) // 1 KB
      await fileInput.setInputFiles({
        name: 'test-file.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from(content),
      })

      // Verify file name is visible
      await expect(page.getByText('test-file.txt')).toBeVisible()

      // Verify size indicator is visible (should show "1 KB" or similar)
      await expect(page.getByText(/\(.*KB.*\)/)).toBeVisible()
    })

    test('should attach multiple files', async ({ page }) => {
      // Open compose
      await page.getByRole('button', { name: /Compose/i }).click()
      await expect(page.getByRole('dialog')).toBeVisible()

      // Get the hidden file input
      const fileInput = page.locator('input[type="file"]')

      // Attach multiple files
      await fileInput.setInputFiles([
        {
          name: 'document1.pdf',
          mimeType: 'application/pdf',
          buffer: Buffer.from('PDF 1'),
        },
        {
          name: 'image.png',
          mimeType: 'image/png',
          buffer: Buffer.from('PNG data'),
        },
        {
          name: 'spreadsheet.xlsx',
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          buffer: Buffer.from('Excel data'),
        },
      ])

      // Verify all files appear
      await expect(page.getByText('document1.pdf')).toBeVisible()
      await expect(page.getByText('image.png')).toBeVisible()
      await expect(page.getByText('spreadsheet.xlsx')).toBeVisible()

      // Verify total count indicator
      await expect(page.getByText(/3 files/)).toBeVisible()
    })

    test('should remove attachment when clicking remove button', async ({ page }) => {
      // Open compose
      await page.getByRole('button', { name: /Compose/i }).click()
      await expect(page.getByRole('dialog')).toBeVisible()

      // Attach a file
      const fileInput = page.locator('input[type="file"]')
      await fileInput.setInputFiles({
        name: 'to-be-removed.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('Content'),
      })

      // Verify file is attached
      await expect(page.getByText('to-be-removed.pdf')).toBeVisible()

      // Click remove button (should have aria-label like "Remove to-be-removed.pdf")
      const removeButton = page.getByRole('button', { name: /Remove to-be-removed\.pdf/i })
      await removeButton.click()

      // Verify file is removed
      await expect(page.getByText('to-be-removed.pdf')).not.toBeVisible()
    })

    test('should show error for files exceeding size limit', async ({ page }) => {
      // Open compose
      await page.getByRole('button', { name: /Compose/i }).click()
      await expect(page.getByRole('dialog')).toBeVisible()

      // Get the hidden file input
      const fileInput = page.locator('input[type="file"]')

      // Create a file larger than 25MB limit
      // Note: We can't actually create a 25MB+ file in the test, but we can
      // check that the validation message area exists for when it would trigger
      const largeContent = 'x'.repeat(26 * 1024 * 1024) // 26 MB
      await fileInput.setInputFiles({
        name: 'too-large.zip',
        mimeType: 'application/zip',
        buffer: Buffer.from(largeContent),
      })

      // Should show size limit error
      await expect(page.getByText(/exceeds.*limit/i)).toBeVisible()
    })

    test('should show error for duplicate files', async ({ page }) => {
      // Open compose
      await page.getByRole('button', { name: /Compose/i }).click()
      await expect(page.getByRole('dialog')).toBeVisible()

      // Attach a file
      const fileInput = page.locator('input[type="file"]')
      await fileInput.setInputFiles({
        name: 'duplicate.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('Content'),
      })

      // Verify file is attached
      await expect(page.getByText('duplicate.pdf')).toBeVisible()

      // Try to attach the same file again
      await fileInput.setInputFiles({
        name: 'duplicate.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('Content'),
      })

      // Should show duplicate error
      await expect(page.getByText(/already attached/i)).toBeVisible()
    })
  })

  test.describe('Compose Form Integration @compose @attachment', () => {
    test('should allow composing email with attachment', async ({ page }) => {
      // Open compose
      await page.getByRole('button', { name: /Compose/i }).click()
      await expect(page.getByRole('dialog')).toBeVisible()

      // Fill in recipients (if there's an input field)
      // Note: We can't fully test send without a real account, but we can verify
      // the form structure

      // Attach a file
      const fileInput = page.locator('input[type="file"]')
      await fileInput.setInputFiles({
        name: 'attachment.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('PDF content'),
      })

      // Verify file is attached
      await expect(page.getByText('attachment.pdf')).toBeVisible()

      // Verify Send button exists (though it won't work without recipients)
      const sendButton = page.getByRole('button', { name: /Send/i })
      await expect(sendButton).toBeVisible()
    })

    test('should preserve attachments when minimizing and maximizing dialog', async ({ page }) => {
      // Open compose
      await page.getByRole('button', { name: /Compose/i }).click()
      await expect(page.getByRole('dialog')).toBeVisible()

      // Attach a file
      const fileInput = page.locator('input[type="file"]')
      await fileInput.setInputFiles({
        name: 'preserved.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('Content'),
      })

      // Verify file is attached
      await expect(page.getByText('preserved.pdf')).toBeVisible()

      // Minimize dialog
      const minimizeButton = page.getByRole('button', { name: /Minimize/i })
      await minimizeButton.click()

      // Dialog should be minimized (check for minimized state indicator)
      await page.waitForTimeout(300)

      // Expand dialog
      const expandButton = page.getByRole('button', { name: /Expand/i })
      await expandButton.click()

      // Verify attachment is still there
      await expect(page.getByText('preserved.pdf')).toBeVisible()
    })
  })

  test.describe('Accessibility @compose @attachment @a11y', () => {
    test('should have accessible attachment controls', async ({ page }) => {
      // Open compose
      await page.getByRole('button', { name: /Compose/i }).click()
      await expect(page.getByRole('dialog')).toBeVisible()

      // Verify file input has aria-label
      const fileInput = page.locator('input[type="file"]')
      await expect(fileInput).toHaveAttribute('aria-label', /Attach files/i)

      // Verify Attach button is focusable
      const attachButton = page.getByRole('button', { name: /Attach/i })
      await attachButton.focus()
      await expect(attachButton).toBeFocused()
    })

    test('should announce file attachment for screen readers', async ({ page }) => {
      // Open compose
      await page.getByRole('button', { name: /Compose/i }).click()
      await expect(page.getByRole('dialog')).toBeVisible()

      // Attach a file
      const fileInput = page.locator('input[type="file"]')
      await fileInput.setInputFiles({
        name: 'accessible.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('Content'),
      })

      // Verify remove button has proper aria-label
      const removeButton = page.getByRole('button', { name: /Remove accessible\.pdf/i })
      await expect(removeButton).toBeVisible()
      await expect(removeButton).toHaveAttribute('aria-label', /Remove accessible\.pdf/i)
    })
  })
})
