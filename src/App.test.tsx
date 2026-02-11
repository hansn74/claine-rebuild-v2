import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import App from './App'

// Mock the logger to reduce noise
vi.mock('@/services/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock health registry to avoid circuit breaker side effects at import time
vi.mock('@/services/sync/healthRegistry', () => ({
  healthRegistry: {
    setDatabaseHealth: vi.fn(),
    setSearchIndexHealth: vi.fn(),
    setAIHealth: vi.fn(),
    connectActionQueue: vi.fn(),
    connectSendQueue: vi.fn(),
    connectNetworkStatus: vi.fn(),
    connectSyncProgress: vi.fn(),
    subscribe: vi.fn(() => vi.fn()),
    getSnapshot: vi.fn(() => ({
      subsystems: new Map(),
      overallState: 'healthy',
      lastUpdated: Date.now(),
    })),
    getOverallState: vi.fn(() => 'healthy'),
    dispose: vi.fn(),
    reset: vi.fn(),
  },
}))

describe('App', () => {
  it('renders welcome screen with Claine branding on first launch', async () => {
    render(<App />)
    // Wait for database to initialize and welcome screen to appear
    await waitFor(() => expect(screen.getByText('Welcome to Claine')).toBeInTheDocument(), {
      timeout: 10000,
    })
  })

  it('shows intelligent email client tagline', async () => {
    render(<App />)
    // Wait for the welcome screen content
    await waitFor(
      () =>
        expect(
          screen.getByText(/Your intelligent, offline-first email client/)
        ).toBeInTheDocument(),
      { timeout: 10000 }
    )
  })

  it('renders email provider buttons on welcome screen', async () => {
    render(<App />)
    // Wait for the provider buttons (Gmail and Outlook)
    await waitFor(() => expect(screen.getByText('Gmail')).toBeInTheDocument(), {
      timeout: 10000,
    })
    await waitFor(() => expect(screen.getByText('Outlook')).toBeInTheDocument(), {
      timeout: 10000,
    })
  })

  it('shows feature highlights on welcome screen', async () => {
    render(<App />)
    // Wait for feature highlights to appear
    await waitFor(() => expect(screen.getByText('Offline-first')).toBeInTheDocument(), {
      timeout: 10000,
    })
  })

  it('displays privacy-focused messaging', async () => {
    render(<App />)
    // Wait for privacy feature
    await waitFor(() => expect(screen.getByText('Privacy focused')).toBeInTheDocument(), {
      timeout: 10000,
    })
  })
})
