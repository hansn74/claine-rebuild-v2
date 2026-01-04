import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { validateEnv } from './lib/env'
import { initSentry, logger } from '@/services/logger'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'

// Import settings store to register Sentry accessor
import '@/store/settingsStore'

// Import test helpers for E2E tests (only loaded in dev mode)
import './lib/test-helpers'

// Initialize Sentry error tracking before anything else
// Only active in production when VITE_SENTRY_DSN is configured
initSentry()

// Validate environment variables before app initialization
// Throws descriptive error if required variables are missing
validateEnv()

// Log application startup
logger.info('general', 'Application starting', {
  mode: import.meta.env.MODE,
  version: import.meta.env.VITE_APP_VERSION ?? 'dev',
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
)
