import { expect, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import * as matchers from '@testing-library/jest-dom/matchers'
import 'fake-indexeddb/auto'

// Set up OAuth environment variables for testing
Object.defineProperty(import.meta, 'env', {
  value: {
    ...import.meta.env,
    VITE_GOOGLE_CLIENT_ID: 'test-google-client-id',
    VITE_GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
    VITE_GOOGLE_REDIRECT_URI: 'http://localhost:5173/auth/callback',
    VITE_GOOGLE_SCOPES:
      'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send',
    VITE_MICROSOFT_CLIENT_ID: 'test-microsoft-client-id',
    VITE_MICROSOFT_CLIENT_SECRET: 'test-microsoft-client-secret',
    VITE_MICROSOFT_REDIRECT_URI: 'http://localhost:5173/auth/callback',
    VITE_MICROSOFT_SCOPES: 'Mail.Read Mail.Send offline_access',
  },
  writable: true,
  configurable: true,
})

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers)

// Cleanup after each test
afterEach(() => {
  cleanup()
})
