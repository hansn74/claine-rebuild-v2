/**
 * useInitializeAI Hook Tests
 *
 * Story 3.2b: AI Capability Detection & Graceful Degradation
 * Task 4: Tests for AI initialization hook
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useInitializeAI } from '../useInitializeAI'

// Mock capabilities data
const mockCapabilities = {
  webgpuSupported: true,
  wasmSupported: true,
  deviceMemoryGB: 8,
  estimatedAvailableMemoryGB: 4,
  deviceTier: 'high' as const,
  bestProvider: 'webgpu' as const,
  meetsMinimumRequirements: true,
  detectedAt: Date.now(),
}

const mockLowCapabilities = {
  ...mockCapabilities,
  webgpuSupported: false,
  deviceMemoryGB: 1,
  estimatedAvailableMemoryGB: 0.3,
  deviceTier: 'low' as const,
  bestProvider: 'cloud' as const,
  meetsMinimumRequirements: false,
}

// Mock detectCapabilities
const mockDetectCapabilities = vi.fn()
vi.mock('@/services/ai/capabilityDetection', () => ({
  detectCapabilities: (...args: unknown[]) => mockDetectCapabilities(...args),
}))

// Mock aiInferenceService
const mockInitialize = vi.fn()
const mockLoadModel = vi.fn()
const mockSetServiceCapabilities = vi.fn()
vi.mock('@/services/ai/aiInferenceService', () => ({
  aiInferenceService: {
    initialize: (...args: unknown[]) => mockInitialize(...args),
    loadModel: (...args: unknown[]) => mockLoadModel(...args),
    setCapabilities: (...args: unknown[]) => mockSetServiceCapabilities(...args),
  },
}))

// Mock analysisOrchestrator
const mockSetDependencies = vi.fn()
vi.mock('@/services/ai/analysisOrchestrator', () => ({
  analysisOrchestrator: {
    setDependencies: (...args: unknown[]) => mockSetDependencies(...args),
  },
}))

// Mock createAnalysisDependencies
const mockDeps = {
  getSenderStats: vi.fn(),
  getThreadEmails: vi.fn(),
  storeResult: vi.fn(),
}
vi.mock('@/services/ai/analysisResultStore', () => ({
  createAnalysisDependencies: () => mockDeps,
}))

// Mock health registry
const mockSetAIHealth = vi.fn()
vi.mock('@/services/sync/healthRegistry', () => ({
  healthRegistry: {
    setAIHealth: (...args: unknown[]) => mockSetAIHealth(...args),
  },
}))

// Mock logger
vi.mock('@/services/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock store - track all store calls
const mockSetCapabilities = vi.fn()
const mockSetStatus = vi.fn()
const mockSetDetectionError = vi.fn()
let mockIsCapabilitiesCacheValid = vi.fn().mockReturnValue(false)
let mockStoredCapabilities: typeof mockCapabilities | null = null

vi.mock('@/store/aiCapabilityStore', () => ({
  useAICapabilityStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      isCapabilitiesCacheValid: mockIsCapabilitiesCacheValid,
      capabilities: mockStoredCapabilities,
      setCapabilities: mockSetCapabilities,
      setStatus: mockSetStatus,
      setDetectionError: mockSetDetectionError,
    }),
}))

describe('useInitializeAI', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockDetectCapabilities.mockResolvedValue(mockCapabilities)
    mockInitialize.mockResolvedValue(undefined)
    mockLoadModel.mockResolvedValue(undefined)
    mockIsCapabilitiesCacheValid = vi.fn().mockReturnValue(false)
    mockStoredCapabilities = null
  })

  it('should return detecting=true initially and false when done', async () => {
    const { result } = renderHook(() => useInitializeAI())

    // Initially detecting
    expect(result.current.detecting).toBe(true)

    await waitFor(() => {
      expect(result.current.detecting).toBe(false)
    })
  })

  describe('cache behavior', () => {
    it('should skip detection when cache is valid', async () => {
      mockIsCapabilitiesCacheValid = vi.fn().mockReturnValue(true)
      mockStoredCapabilities = mockCapabilities

      const { result } = renderHook(() => useInitializeAI())

      await waitFor(() => {
        expect(result.current.detecting).toBe(false)
      })

      // Should NOT call detectCapabilities
      expect(mockDetectCapabilities).not.toHaveBeenCalled()
      // Should NOT call setCapabilities on store (cache is still valid)
      expect(mockSetCapabilities).not.toHaveBeenCalled()
      // Should still initialize inference service
      expect(mockInitialize).toHaveBeenCalled()
    })

    it('should run detection when cache is expired', async () => {
      mockIsCapabilitiesCacheValid = vi.fn().mockReturnValue(false)

      const { result } = renderHook(() => useInitializeAI())

      await waitFor(() => {
        expect(result.current.detecting).toBe(false)
      })

      expect(mockDetectCapabilities).toHaveBeenCalled()
      expect(mockSetCapabilities).toHaveBeenCalledWith(mockCapabilities)
    })
  })

  describe('inference service initialization', () => {
    it('should initialize inference service and load model when requirements met', async () => {
      const { result } = renderHook(() => useInitializeAI())

      await waitFor(() => {
        expect(result.current.detecting).toBe(false)
      })

      expect(mockInitialize).toHaveBeenCalled()
      expect(mockSetServiceCapabilities).toHaveBeenCalledWith(mockCapabilities)
      expect(mockLoadModel).toHaveBeenCalled()
      expect(result.current.aiAvailable).toBe(true)
    })

    it('should set status unavailable when requirements not met', async () => {
      mockDetectCapabilities.mockResolvedValue(mockLowCapabilities)

      const { result } = renderHook(() => useInitializeAI())

      await waitFor(() => {
        expect(result.current.detecting).toBe(false)
      })

      expect(mockInitialize).not.toHaveBeenCalled()
      expect(result.current.aiAvailable).toBe(false)
      expect(mockSetStatus).toHaveBeenCalledWith('unavailable')
      expect(mockSetAIHealth).toHaveBeenCalledWith(
        'unavailable',
        'Device does not meet minimum requirements'
      )
    })
  })

  describe('analysis orchestrator wiring', () => {
    it('should wire analysis orchestrator dependencies', async () => {
      const { result } = renderHook(() => useInitializeAI())

      await waitFor(() => {
        expect(result.current.detecting).toBe(false)
      })

      expect(mockSetDependencies).toHaveBeenCalledWith(mockDeps)
    })

    it('should wire dependencies even when requirements not met', async () => {
      mockDetectCapabilities.mockResolvedValue(mockLowCapabilities)

      const { result } = renderHook(() => useInitializeAI())

      await waitFor(() => {
        expect(result.current.detecting).toBe(false)
      })

      // Dependencies should still be wired for heuristic fallback
      expect(mockSetDependencies).toHaveBeenCalledWith(mockDeps)
    })
  })

  describe('health registry updates', () => {
    it('should update health registry on success', async () => {
      const { result } = renderHook(() => useInitializeAI())

      await waitFor(() => {
        expect(result.current.detecting).toBe(false)
      })

      expect(mockSetAIHealth).toHaveBeenCalledWith('healthy', 'AI ready (webgpu)')
    })

    it('should update health registry on failure', async () => {
      mockDetectCapabilities.mockRejectedValue(new Error('Detection crashed'))

      const { result } = renderHook(() => useInitializeAI())

      await waitFor(() => {
        expect(result.current.detecting).toBe(false)
      })

      expect(mockSetAIHealth).toHaveBeenCalledWith(
        'unavailable',
        'AI init failed: Detection crashed'
      )
    })
  })

  describe('error handling', () => {
    it('should handle detection failure gracefully (no throw)', async () => {
      mockDetectCapabilities.mockRejectedValue(new Error('WebGPU probe failed'))

      const { result } = renderHook(() => useInitializeAI())

      // Should not throw — hook swallows all errors
      await waitFor(() => {
        expect(result.current.detecting).toBe(false)
      })

      expect(result.current.aiAvailable).toBe(false)
      expect(mockSetDetectionError).toHaveBeenCalledWith('WebGPU probe failed')
      expect(mockSetStatus).toHaveBeenCalledWith('unavailable')
    })

    it('should handle inference service init failure gracefully', async () => {
      mockLoadModel.mockRejectedValue(new Error('Worker failed'))

      const { result } = renderHook(() => useInitializeAI())

      await waitFor(() => {
        expect(result.current.detecting).toBe(false)
      })

      // Should not crash — error is caught
      expect(result.current.aiAvailable).toBe(false)
      expect(mockSetDetectionError).toHaveBeenCalledWith('Worker failed')
    })

    it('should handle non-Error objects gracefully', async () => {
      mockDetectCapabilities.mockRejectedValue('string error')

      const { result } = renderHook(() => useInitializeAI())

      await waitFor(() => {
        expect(result.current.detecting).toBe(false)
      })

      expect(mockSetDetectionError).toHaveBeenCalledWith('Unknown AI init error')
    })
  })

  describe('store status updates', () => {
    it('should set status to loading then ready on success', async () => {
      const { result } = renderHook(() => useInitializeAI())

      await waitFor(() => {
        expect(result.current.detecting).toBe(false)
      })

      expect(mockSetStatus).toHaveBeenCalledWith('loading')
      expect(mockSetStatus).toHaveBeenCalledWith('ready')
    })

    it('should set status to unavailable on failure', async () => {
      mockDetectCapabilities.mockRejectedValue(new Error('fail'))

      const { result } = renderHook(() => useInitializeAI())

      await waitFor(() => {
        expect(result.current.detecting).toBe(false)
      })

      expect(mockSetStatus).toHaveBeenCalledWith('loading')
      expect(mockSetStatus).toHaveBeenCalledWith('unavailable')
    })
  })
})
