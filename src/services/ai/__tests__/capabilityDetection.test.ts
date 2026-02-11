/**
 * Capability Detection Tests
 *
 * Story 3.1: Local LLM Integration (Browser-Based Inference)
 * Task 2: Implement capability detection (AC: 1, 10)
 *
 * Tests for browser capability detection functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  detectWebGPU,
  detectWebAssembly,
  getDeviceMemory,
  estimateAvailableMemory,
  determineDeviceTier,
  determineBestProvider,
  meetsMinimumRequirements,
  detectCapabilities,
  getCapabilityStatusMessage,
  getBrowserCompatibilityHelpUrl,
} from '../capabilityDetection'
import type { AICapabilities } from '../types'

// Mock logger to avoid console spam
vi.mock('@/services/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock healthRegistry
vi.mock('@/services/sync/healthRegistry', () => ({
  healthRegistry: {
    setAIHealth: vi.fn(),
  },
}))

describe('capabilityDetection', () => {
  const originalNavigator = global.navigator
  const originalWebAssembly = global.WebAssembly

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Restore original globals
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      writable: true,
    })
    Object.defineProperty(global, 'WebAssembly', {
      value: originalWebAssembly,
      writable: true,
    })
  })

  describe('detectWebGPU', () => {
    it('should return false when navigator.gpu is undefined', async () => {
      Object.defineProperty(global, 'navigator', {
        value: {},
        writable: true,
      })

      const result = await detectWebGPU()
      expect(result).toBe(false)
    })

    it('should return false when requestAdapter returns null', async () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          gpu: {
            requestAdapter: vi.fn().mockResolvedValue(null),
          },
        },
        writable: true,
      })

      const result = await detectWebGPU()
      expect(result).toBe(false)
    })

    it('should return true when adapter is available', async () => {
      const mockAdapter = {
        requestAdapterInfo: vi.fn().mockResolvedValue({
          vendor: 'Test Vendor',
          architecture: 'Test Arch',
        }),
      }

      Object.defineProperty(global, 'navigator', {
        value: {
          gpu: {
            requestAdapter: vi.fn().mockResolvedValue(mockAdapter),
          },
        },
        writable: true,
      })

      const result = await detectWebGPU()
      expect(result).toBe(true)
    })

    it('should return false when requestAdapter throws', async () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          gpu: {
            requestAdapter: vi.fn().mockRejectedValue(new Error('GPU error')),
          },
        },
        writable: true,
      })

      const result = await detectWebGPU()
      expect(result).toBe(false)
    })
  })

  describe('detectWebAssembly', () => {
    it('should return true when WebAssembly is available', () => {
      Object.defineProperty(global, 'WebAssembly', {
        value: {
          validate: vi.fn().mockReturnValue(false), // SIMD not supported
        },
        writable: true,
      })

      const result = detectWebAssembly()
      expect(result).toBe(true)
    })

    it('should return false when WebAssembly is undefined', () => {
      Object.defineProperty(global, 'WebAssembly', {
        value: undefined,
        writable: true,
      })

      const result = detectWebAssembly()
      expect(result).toBe(false)
    })
  })

  describe('getDeviceMemory', () => {
    it('should return device memory when available', () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          deviceMemory: 8,
        },
        writable: true,
      })

      const result = getDeviceMemory()
      expect(result).toBe(8)
    })

    it('should return null when deviceMemory is not available', () => {
      Object.defineProperty(global, 'navigator', {
        value: {},
        writable: true,
      })

      const result = getDeviceMemory()
      expect(result).toBeNull()
    })
  })

  describe('estimateAvailableMemory', () => {
    it('should return null for null input', () => {
      const result = estimateAvailableMemory(null)
      expect(result).toBeNull()
    })

    it('should estimate 30% for low memory devices', () => {
      const result = estimateAvailableMemory(4)
      expect(result).toBe(1.2) // 4 * 0.3
    })

    it('should estimate 50% for high memory devices', () => {
      const result = estimateAvailableMemory(8)
      expect(result).toBe(4) // 8 * 0.5
    })
  })

  describe('determineDeviceTier', () => {
    it('should return high for WebGPU + 8GB+ memory', () => {
      const result = determineDeviceTier(true, 8)
      expect(result).toBe('high')
    })

    it('should return medium for WebGPU without much memory', () => {
      const result = determineDeviceTier(true, 4)
      expect(result).toBe('medium')
    })

    it('should return medium for no WebGPU but 4GB+ memory', () => {
      const result = determineDeviceTier(false, 4)
      expect(result).toBe('medium')
    })

    it('should return low for no WebGPU and low memory', () => {
      const result = determineDeviceTier(false, 2)
      expect(result).toBe('low')
    })

    it('should return low for no WebGPU and unknown memory', () => {
      const result = determineDeviceTier(false, null)
      expect(result).toBe('low')
    })
  })

  describe('determineBestProvider', () => {
    it('should return webgpu when available and meets requirements', () => {
      const result = determineBestProvider(true, true, true)
      expect(result).toBe('webgpu')
    })

    it('should return wasm when WebGPU not available', () => {
      const result = determineBestProvider(false, true, true)
      expect(result).toBe('wasm')
    })

    it('should return wasm when minimum requirements not met', () => {
      const result = determineBestProvider(true, true, false)
      expect(result).toBe('wasm')
    })

    it('should return wasm when nothing else is available', () => {
      const result = determineBestProvider(false, false, true)
      expect(result).toBe('wasm')
    })
  })

  describe('meetsMinimumRequirements', () => {
    it('should return true when memory is sufficient', () => {
      const result = meetsMinimumRequirements(4, 2)
      expect(result).toBe(true)
    })

    it('should return false when device memory is too low', () => {
      const result = meetsMinimumRequirements(1, 0.5)
      expect(result).toBe(false)
    })

    it('should return false when available memory is too low', () => {
      const result = meetsMinimumRequirements(2, 0.5)
      expect(result).toBe(false)
    })

    it('should return true when memory is unknown (assume sufficient)', () => {
      const result = meetsMinimumRequirements(null, null)
      expect(result).toBe(true)
    })
  })

  describe('detectCapabilities', () => {
    it('should return complete capabilities object', async () => {
      // Mock WebGPU available
      const mockAdapter = {
        requestAdapterInfo: vi.fn().mockResolvedValue({}),
      }
      Object.defineProperty(global, 'navigator', {
        value: {
          gpu: {
            requestAdapter: vi.fn().mockResolvedValue(mockAdapter),
          },
          deviceMemory: 8,
        },
        writable: true,
      })

      Object.defineProperty(global, 'WebAssembly', {
        value: {
          validate: vi.fn().mockReturnValue(false),
        },
        writable: true,
      })

      const result = await detectCapabilities()

      expect(result).toMatchObject({
        webgpuSupported: true,
        wasmSupported: true,
        deviceMemoryGB: 8,
        deviceTier: 'high',
        bestProvider: 'webgpu',
        meetsMinimumRequirements: true,
      })
      expect(result.detectedAt).toBeDefined()
    })

    it('should fall back to wasm when WebGPU not available', async () => {
      Object.defineProperty(global, 'navigator', {
        value: {
          deviceMemory: 4,
        },
        writable: true,
      })

      Object.defineProperty(global, 'WebAssembly', {
        value: {
          validate: vi.fn().mockReturnValue(false),
        },
        writable: true,
      })

      const result = await detectCapabilities()

      expect(result.webgpuSupported).toBe(false)
      expect(result.wasmSupported).toBe(true)
      expect(result.bestProvider).toBe('wasm')
    })
  })

  describe('getCapabilityStatusMessage', () => {
    it('should return WebGPU message for WebGPU provider', () => {
      const capabilities: AICapabilities = {
        webgpuSupported: true,
        wasmSupported: true,
        deviceMemoryGB: 8,
        estimatedAvailableMemoryGB: 4,
        deviceTier: 'high',
        bestProvider: 'webgpu',
        meetsMinimumRequirements: true,
        detectedAt: Date.now(),
      }

      const message = getCapabilityStatusMessage(capabilities)
      expect(message).toContain('WebGPU')
      expect(message).toContain('fastest')
    })

    it('should return CPU message for wasm provider', () => {
      const capabilities: AICapabilities = {
        webgpuSupported: false,
        wasmSupported: true,
        deviceMemoryGB: 4,
        estimatedAvailableMemoryGB: 2,
        deviceTier: 'medium',
        bestProvider: 'wasm',
        meetsMinimumRequirements: true,
        detectedAt: Date.now(),
      }

      const message = getCapabilityStatusMessage(capabilities)
      expect(message).toContain('CPU')
      expect(message).toContain('slower')
    })

    it('should return unavailable message for insufficient memory', () => {
      const capabilities: AICapabilities = {
        webgpuSupported: false,
        wasmSupported: true,
        deviceMemoryGB: 1,
        estimatedAvailableMemoryGB: 0.5,
        deviceTier: 'low',
        bestProvider: 'wasm',
        meetsMinimumRequirements: false,
        detectedAt: Date.now(),
      }

      const message = getCapabilityStatusMessage(capabilities)
      expect(message).toContain('unavailable')
    })
  })

  describe('getBrowserCompatibilityHelpUrl', () => {
    it('should return null when WebGPU is supported', () => {
      const capabilities: AICapabilities = {
        webgpuSupported: true,
        wasmSupported: true,
        deviceMemoryGB: 8,
        estimatedAvailableMemoryGB: 4,
        deviceTier: 'high',
        bestProvider: 'webgpu',
        meetsMinimumRequirements: true,
        detectedAt: Date.now(),
      }

      const url = getBrowserCompatibilityHelpUrl(capabilities)
      expect(url).toBeNull()
    })

    it('should return WebGPU help URL when only WASM available', () => {
      const capabilities: AICapabilities = {
        webgpuSupported: false,
        wasmSupported: true,
        deviceMemoryGB: 4,
        estimatedAvailableMemoryGB: 2,
        deviceTier: 'medium',
        bestProvider: 'wasm',
        meetsMinimumRequirements: true,
        detectedAt: Date.now(),
      }

      const url = getBrowserCompatibilityHelpUrl(capabilities)
      expect(url).toContain('webgpu')
    })

    it('should return WASM help URL when WASM not available', () => {
      const capabilities: AICapabilities = {
        webgpuSupported: false,
        wasmSupported: false,
        deviceMemoryGB: 4,
        estimatedAvailableMemoryGB: 2,
        deviceTier: 'low',
        bestProvider: 'wasm',
        meetsMinimumRequirements: true,
        detectedAt: Date.now(),
      }

      const url = getBrowserCompatibilityHelpUrl(capabilities)
      expect(url).toContain('wasm')
    })
  })
})
