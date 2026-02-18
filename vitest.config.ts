import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    exclude: ['node_modules', 'dist', 'e2e', '**/*.spec.ts', 'src/benchmark'],
    // Run tests sequentially to avoid RxDB's 16-collection limit in open-source version
    // Database tests create multiple collections and hit the parallel limit
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    // Run tests within each file sequentially (not concurrently)
    // This prevents multiple database tests from running simultaneously
    sequence: {
      concurrent: false,
    },
    // Increase timeout for database tests that need to run migrations
    testTimeout: 30000,
    hookTimeout: 30000,
    env: {
      // OAuth test environment variables
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
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'coverage/',
        '.husky/',
        'bmad/',
        'docs/',
        '**/*.config.*',
        '**/test/',
        '**/*.test.*',
      ],
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@features': fileURLToPath(new URL('./src/features', import.meta.url)),
      '@shared': fileURLToPath(new URL('./src/shared', import.meta.url)),
      '@db': fileURLToPath(new URL('./src/db', import.meta.url)),
      '@workers': fileURLToPath(new URL('./src/workers', import.meta.url)),
    },
  },
})
