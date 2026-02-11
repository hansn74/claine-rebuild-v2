/**
 * AICapabilityStatus Component Tests
 *
 * Story 3.1: Local LLM Integration (Browser-Based Inference)
 * Task 8: Graceful degradation UI tests (AC: 10)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AICapabilityStatus } from '../AICapabilityStatus'
import type { AICapabilities } from '@/services/ai/types'

// Mock logger
vi.mock('@/services/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// Store state mock
let mockState: {
  capabilities: AICapabilities | null
  status: string
  preferredProvider: string | null
}

vi.mock('@/store/aiCapabilityStore', () => ({
  useAICapabilityStore: (selector: (s: unknown) => unknown) =>
    selector({
      ...mockState,
    }),
  selectAIAvailable: (s: { capabilities: AICapabilities | null }) =>
    s.capabilities?.meetsMinimumRequirements &&
    (s.capabilities?.webgpuSupported || s.capabilities?.wasmSupported),
  selectEffectiveProvider: (s: {
    capabilities: AICapabilities | null
    preferredProvider: string | null
  }) => s.preferredProvider || s.capabilities?.bestProvider || null,
}))

function createCapabilities(overrides?: Partial<AICapabilities>): AICapabilities {
  return {
    webgpuSupported: true,
    wasmSupported: true,
    deviceMemoryGB: 8,
    estimatedAvailableMemoryGB: 4,
    deviceTier: 'high',
    bestProvider: 'webgpu',
    meetsMinimumRequirements: true,
    detectedAt: Date.now(),
    ...overrides,
  }
}

describe('AICapabilityStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockState = {
      capabilities: null,
      status: 'uninitialized',
      preferredProvider: null,
    }
  })

  it('should show undetected state when no capabilities', () => {
    render(<AICapabilityStatus />)

    expect(screen.getByTestId('ai-status-message')).toHaveTextContent(
      'AI capabilities not yet detected'
    )
  })

  it('should show WebGPU status when available', () => {
    mockState.capabilities = createCapabilities()

    render(<AICapabilityStatus />)

    expect(screen.getByTestId('ai-status-indicator')).toHaveTextContent('WebGPU')
    expect(screen.getByTestId('ai-status-message')).toHaveTextContent(
      'AI features available (WebGPU - fastest)'
    )
    expect(screen.getByTestId('ai-device-tier')).toHaveTextContent('high')
  })

  it('should show CPU/WASM degraded status', () => {
    mockState.capabilities = createCapabilities({
      webgpuSupported: false,
      bestProvider: 'wasm',
      deviceTier: 'medium',
    })

    render(<AICapabilityStatus />)

    expect(screen.getByTestId('ai-status-indicator')).toHaveTextContent('CPU (slower)')
    expect(screen.getByTestId('ai-status-message')).toHaveTextContent(
      'AI features available (CPU - slower)'
    )
  })

  it('should show unavailable when requirements not met', () => {
    mockState.capabilities = createCapabilities({
      meetsMinimumRequirements: false,
      deviceMemoryGB: 1,
      deviceTier: 'low',
    })

    render(<AICapabilityStatus />)

    expect(screen.getByTestId('ai-status-indicator')).toHaveTextContent('Unavailable')
    expect(screen.getByTestId('ai-status-message')).toHaveTextContent('AI features unavailable')
  })

  it('should show loading indicator when model is loading', () => {
    mockState.capabilities = createCapabilities()
    mockState.status = 'loading'

    render(<AICapabilityStatus />)

    expect(screen.getByTestId('ai-loading-indicator')).toHaveTextContent('Loading AI model...')
  })

  it('should show browser help link when WebGPU unavailable', () => {
    mockState.capabilities = createCapabilities({
      webgpuSupported: false,
      bestProvider: 'wasm',
    })

    render(<AICapabilityStatus />)

    const helpLink = screen.getByTestId('ai-help-link')
    expect(helpLink).toBeInTheDocument()
    expect(helpLink).toHaveAttribute('href', 'https://caniuse.com/webgpu')
    expect(helpLink).toHaveAttribute('target', '_blank')
  })

  it('should not show help link when WebGPU is available', () => {
    mockState.capabilities = createCapabilities({ webgpuSupported: true })

    render(<AICapabilityStatus />)

    expect(screen.queryByTestId('ai-help-link')).not.toBeInTheDocument()
  })

  it('should display device memory info', () => {
    mockState.capabilities = createCapabilities({ deviceMemoryGB: 16 })

    render(<AICapabilityStatus />)

    expect(screen.getByText('16GB')).toBeInTheDocument()
  })
})
