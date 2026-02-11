/**
 * AI Capability Store Tests
 *
 * Story 3.1: Local LLM Integration (Browser-Based Inference)
 * Task 2: Implement capability detection (AC: 1, 10)
 *
 * Tests for the AI capability Zustand store
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  useAICapabilityStore,
  selectEffectiveProvider,
  selectAIAvailable,
  selectDeviceTier,
} from '../aiCapabilityStore'
import type { AICapabilities } from '@/services/ai/types'

// Mock logger to avoid console spam
vi.mock('@/services/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

describe('aiCapabilityStore', () => {
  const mockCapabilities: AICapabilities = {
    webgpuSupported: true,
    wasmSupported: true,
    deviceMemoryGB: 8,
    estimatedAvailableMemoryGB: 4,
    deviceTier: 'high',
    bestProvider: 'webgpu',
    meetsMinimumRequirements: true,
    detectedAt: Date.now(),
  }

  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
    // Reset store state
    useAICapabilityStore.setState({
      capabilities: null,
      status: 'uninitialized',
      lastDetectionError: null,
      preferredProvider: null,
    })
  })

  afterEach(() => {
    localStorageMock.clear()
  })

  describe('initial state', () => {
    it('should have null capabilities initially', () => {
      const state = useAICapabilityStore.getState()
      expect(state.capabilities).toBeNull()
    })

    it('should have uninitialized status initially', () => {
      const state = useAICapabilityStore.getState()
      expect(state.status).toBe('uninitialized')
    })
  })

  describe('setCapabilities', () => {
    it('should update capabilities', () => {
      useAICapabilityStore.getState().setCapabilities(mockCapabilities)

      const state = useAICapabilityStore.getState()
      expect(state.capabilities).toEqual(mockCapabilities)
    })

    it('should clear detection error when setting capabilities', () => {
      useAICapabilityStore.setState({ lastDetectionError: 'Some error' })
      useAICapabilityStore.getState().setCapabilities(mockCapabilities)

      const state = useAICapabilityStore.getState()
      expect(state.lastDetectionError).toBeNull()
    })

    it('should persist to localStorage', () => {
      useAICapabilityStore.getState().setCapabilities(mockCapabilities)

      expect(localStorageMock.setItem).toHaveBeenCalled()
      const savedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1] as string)
      expect(savedData.capabilities).toEqual(mockCapabilities)
    })
  })

  describe('setStatus', () => {
    it('should update status', () => {
      useAICapabilityStore.getState().setStatus('loading')

      const state = useAICapabilityStore.getState()
      expect(state.status).toBe('loading')
    })
  })

  describe('setDetectionError', () => {
    it('should set error message', () => {
      useAICapabilityStore.getState().setDetectionError('Detection failed')

      const state = useAICapabilityStore.getState()
      expect(state.lastDetectionError).toBe('Detection failed')
    })

    it('should clear error when set to null', () => {
      useAICapabilityStore.setState({ lastDetectionError: 'Some error' })
      useAICapabilityStore.getState().setDetectionError(null)

      const state = useAICapabilityStore.getState()
      expect(state.lastDetectionError).toBeNull()
    })
  })

  describe('setPreferredProvider', () => {
    it('should update preferred provider', () => {
      useAICapabilityStore.getState().setPreferredProvider('wasm')

      const state = useAICapabilityStore.getState()
      expect(state.preferredProvider).toBe('wasm')
    })

    it('should persist to localStorage', () => {
      useAICapabilityStore.getState().setPreferredProvider('webgpu')

      expect(localStorageMock.setItem).toHaveBeenCalled()
      const savedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1] as string)
      expect(savedData.preferredProvider).toBe('webgpu')
    })
  })

  describe('clearCapabilities', () => {
    it('should clear capabilities and reset state', () => {
      useAICapabilityStore.getState().setCapabilities(mockCapabilities)
      useAICapabilityStore.getState().setStatus('ready')
      useAICapabilityStore.getState().clearCapabilities()

      const state = useAICapabilityStore.getState()
      expect(state.capabilities).toBeNull()
      expect(state.status).toBe('uninitialized')
      expect(state.lastDetectionError).toBeNull()
    })

    it('should remove from localStorage', () => {
      useAICapabilityStore.getState().setCapabilities(mockCapabilities)
      useAICapabilityStore.getState().clearCapabilities()

      expect(localStorageMock.removeItem).toHaveBeenCalled()
    })
  })

  describe('isCapabilitiesCacheValid', () => {
    it('should return false when no capabilities', () => {
      const valid = useAICapabilityStore.getState().isCapabilitiesCacheValid()
      expect(valid).toBe(false)
    })

    it('should return true for recent capabilities', () => {
      useAICapabilityStore.getState().setCapabilities({
        ...mockCapabilities,
        detectedAt: Date.now(),
      })

      const valid = useAICapabilityStore.getState().isCapabilitiesCacheValid()
      expect(valid).toBe(true)
    })

    it('should return false for old capabilities', () => {
      useAICapabilityStore.getState().setCapabilities({
        ...mockCapabilities,
        detectedAt: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago
      })

      const valid = useAICapabilityStore.getState().isCapabilitiesCacheValid()
      expect(valid).toBe(false)
    })
  })

  describe('selectors', () => {
    describe('selectEffectiveProvider', () => {
      it('should return null when no capabilities', () => {
        const state = useAICapabilityStore.getState()
        const provider = selectEffectiveProvider(state)
        expect(provider).toBeNull()
      })

      it('should return best provider when no preference', () => {
        useAICapabilityStore.getState().setCapabilities(mockCapabilities)
        const state = useAICapabilityStore.getState()
        const provider = selectEffectiveProvider(state)
        expect(provider).toBe('webgpu')
      })

      it('should return preferred provider when available', () => {
        useAICapabilityStore.getState().setCapabilities(mockCapabilities)
        useAICapabilityStore.getState().setPreferredProvider('wasm')
        const state = useAICapabilityStore.getState()
        const provider = selectEffectiveProvider(state)
        expect(provider).toBe('wasm')
      })

      it('should fall back to best provider when preference not available', () => {
        useAICapabilityStore.getState().setCapabilities({
          ...mockCapabilities,
          webgpuSupported: false,
          bestProvider: 'wasm', // Best available when WebGPU not supported
        })
        useAICapabilityStore.getState().setPreferredProvider('webgpu')
        const state = useAICapabilityStore.getState()
        const provider = selectEffectiveProvider(state)
        expect(provider).toBe('wasm') // Falls back to best available
      })
    })

    describe('selectAIAvailable', () => {
      it('should return false when no capabilities', () => {
        const state = useAICapabilityStore.getState()
        const available = selectAIAvailable(state)
        expect(available).toBe(false)
      })

      it('should return false when minimum requirements not met', () => {
        useAICapabilityStore.getState().setCapabilities({
          ...mockCapabilities,
          meetsMinimumRequirements: false,
        })
        const state = useAICapabilityStore.getState()
        const available = selectAIAvailable(state)
        expect(available).toBe(false)
      })

      it('should return true when WebGPU available', () => {
        useAICapabilityStore.getState().setCapabilities(mockCapabilities)
        const state = useAICapabilityStore.getState()
        const available = selectAIAvailable(state)
        expect(available).toBe(true)
      })

      it('should return true when only WASM available', () => {
        useAICapabilityStore.getState().setCapabilities({
          ...mockCapabilities,
          webgpuSupported: false,
        })
        const state = useAICapabilityStore.getState()
        const available = selectAIAvailable(state)
        expect(available).toBe(true)
      })

      it('should return false when no local provider available', () => {
        useAICapabilityStore.getState().setCapabilities({
          ...mockCapabilities,
          webgpuSupported: false,
          wasmSupported: false,
        })
        const state = useAICapabilityStore.getState()
        const available = selectAIAvailable(state)
        expect(available).toBe(false)
      })
    })

    describe('selectDeviceTier', () => {
      it('should return null when no capabilities', () => {
        const state = useAICapabilityStore.getState()
        const tier = selectDeviceTier(state)
        expect(tier).toBeNull()
      })

      it('should return device tier from capabilities', () => {
        useAICapabilityStore.getState().setCapabilities(mockCapabilities)
        const state = useAICapabilityStore.getState()
        const tier = selectDeviceTier(state)
        expect(tier).toBe('high')
      })
    })
  })
})
