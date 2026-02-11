/**
 * AI Capability Detection Service
 *
 * Story 3.1: Local LLM Integration (Browser-Based Inference)
 * Task 2: Implement capability detection (AC: 1, 10)
 *
 * Detects browser capabilities for AI inference:
 * - WebGPU support
 * - WebAssembly support
 * - Device memory
 * - Device tier classification
 */

import { logger } from '@/services/logger'
import { healthRegistry } from '@/services/sync/healthRegistry'
import type { AICapabilities, DeviceTier, ExecutionProvider } from './types'
import { MINIMUM_MEMORY_GB } from './types'

/**
 * Interface for navigator with experimental APIs
 */
interface NavigatorWithGPU extends Navigator {
  gpu?: {
    requestAdapter(): Promise<GPUAdapter | null>
  }
  deviceMemory?: number
}

/**
 * Detect WebGPU support
 * @returns true if WebGPU is supported and an adapter can be obtained
 */
export async function detectWebGPU(): Promise<boolean> {
  try {
    const nav = navigator as NavigatorWithGPU

    if (!nav.gpu) {
      logger.debug('ai', 'WebGPU not available: navigator.gpu is undefined')
      return false
    }

    const adapter = await nav.gpu.requestAdapter()
    if (!adapter) {
      logger.debug('ai', 'WebGPU not available: no adapter returned')
      return false
    }

    // Check for known problematic driver versions (NVIDIA 572.xx)
    // Note: This is a defensive check based on known issues
    const info = await adapter.requestAdapterInfo?.()
    if (info?.driver?.includes('572.')) {
      logger.warn('ai', 'Detected NVIDIA 572.xx driver with known WebGPU issues', {
        driver: info.driver,
      })
      // We still report WebGPU as supported, but this could be used for fallback logic
    }

    logger.debug('ai', 'WebGPU is supported', {
      vendor: info?.vendor,
      architecture: info?.architecture,
    })
    return true
  } catch (error) {
    logger.debug('ai', 'WebGPU detection failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })
    return false
  }
}

/**
 * Detect WebAssembly support
 * @returns true if WebAssembly is supported
 */
export function detectWebAssembly(): boolean {
  try {
    if (typeof WebAssembly !== 'undefined') {
      // Check for SIMD support which improves performance
      const simdSupported =
        typeof WebAssembly.validate === 'function' &&
        WebAssembly.validate(
          new Uint8Array([
            0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0,
            253, 15, 253, 98, 11,
          ])
        )

      logger.debug('ai', 'WebAssembly is supported', { simdSupported })
      return true
    }
    return false
  } catch {
    logger.debug('ai', 'WebAssembly detection failed')
    return false
  }
}

/**
 * Get device memory in GB
 * @returns Device memory in GB or null if not available
 */
export function getDeviceMemory(): number | null {
  try {
    const nav = navigator as NavigatorWithGPU
    if (typeof nav.deviceMemory === 'number') {
      logger.debug('ai', 'Device memory detected', { memoryGB: nav.deviceMemory })
      return nav.deviceMemory
    }
    return null
  } catch {
    return null
  }
}

/**
 * Estimate available memory based on various signals
 * @param deviceMemory Total device memory in GB
 * @returns Estimated available memory in GB
 */
export function estimateAvailableMemory(deviceMemory: number | null): number | null {
  if (deviceMemory === null) {
    return null
  }

  // Conservative estimate: assume 50% of device memory might be available
  // This accounts for OS usage, other tabs, etc.
  const estimatedAvailable = deviceMemory * 0.5

  // For devices with less memory, be even more conservative
  if (deviceMemory <= 4) {
    return deviceMemory * 0.3
  }

  return estimatedAvailable
}

/**
 * Determine device tier based on capabilities
 * @param webgpuSupported Whether WebGPU is supported
 * @param deviceMemory Device memory in GB
 * @returns Device tier classification
 */
export function determineDeviceTier(
  webgpuSupported: boolean,
  deviceMemory: number | null
): DeviceTier {
  // High tier: WebGPU + 8GB+ memory
  if (webgpuSupported && deviceMemory !== null && deviceMemory >= 8) {
    return 'high'
  }

  // Medium tier: WebGPU OR 4GB+ memory
  if (webgpuSupported || (deviceMemory !== null && deviceMemory >= 4)) {
    return 'medium'
  }

  // Low tier: no WebGPU and less than 4GB memory
  return 'low'
}

/**
 * Determine best execution provider based on capabilities
 * @param webgpuSupported Whether WebGPU is supported
 * @param wasmSupported Whether WASM is supported
 * @param meetsMinimumRequirements Whether minimum memory requirements are met
 * @returns Best available execution provider
 */
export function determineBestProvider(
  webgpuSupported: boolean,
  wasmSupported: boolean,
  meetsMinimumRequirements: boolean
): ExecutionProvider {
  // Prefer WebGPU for best performance
  if (webgpuSupported && meetsMinimumRequirements) {
    return 'webgpu'
  }

  // Fall back to WASM (best effort even if requirements not fully met)
  return 'wasm'
}

/**
 * Check if minimum memory requirements are met
 * @param deviceMemory Device memory in GB
 * @param estimatedAvailable Estimated available memory in GB
 * @returns true if minimum requirements are met
 */
export function meetsMinimumRequirements(
  deviceMemory: number | null,
  estimatedAvailable: number | null
): boolean {
  // If we can't determine memory, assume it's sufficient
  // (will fail at runtime with proper error handling)
  if (deviceMemory === null) {
    logger.debug('ai', 'Cannot determine device memory, assuming sufficient')
    return true
  }

  // Need at least MINIMUM_MEMORY_GB total and half that available
  return deviceMemory >= MINIMUM_MEMORY_GB && (estimatedAvailable ?? 0) >= MINIMUM_MEMORY_GB / 2
}

/**
 * Perform full capability detection
 * @returns AICapabilities object with all detection results
 */
export async function detectCapabilities(): Promise<AICapabilities> {
  logger.info('ai', 'Starting capability detection')

  // Run detections in parallel where possible
  const [webgpuSupported, wasmSupported, deviceMemory] = await Promise.all([
    detectWebGPU(),
    Promise.resolve(detectWebAssembly()),
    Promise.resolve(getDeviceMemory()),
  ])

  const estimatedAvailableMemoryGB = estimateAvailableMemory(deviceMemory)
  const meetsMinReq = meetsMinimumRequirements(deviceMemory, estimatedAvailableMemoryGB)
  const deviceTier = determineDeviceTier(webgpuSupported, deviceMemory)
  const bestProvider = determineBestProvider(webgpuSupported, wasmSupported, meetsMinReq)

  const capabilities: AICapabilities = {
    webgpuSupported,
    wasmSupported,
    deviceMemoryGB: deviceMemory,
    estimatedAvailableMemoryGB,
    deviceTier,
    bestProvider,
    meetsMinimumRequirements: meetsMinReq,
    detectedAt: Date.now(),
  }

  // Update health registry based on capabilities
  if (!meetsMinReq) {
    healthRegistry.setAIHealth('unavailable', 'Insufficient device memory for AI inference')
  } else {
    healthRegistry.setAIHealth('healthy', `AI ready (${bestProvider})`)
  }

  logger.info('ai', 'Capability detection complete', {
    deviceTier,
    bestProvider,
    meetsMinimumRequirements: meetsMinReq,
    webgpuSupported,
    wasmSupported,
    deviceMemoryGB: deviceMemory,
  })

  return capabilities
}

/**
 * Get a human-readable description of the AI status
 * @param capabilities AI capabilities
 * @returns Status message for display
 */
export function getCapabilityStatusMessage(capabilities: AICapabilities): string {
  if (!capabilities.meetsMinimumRequirements) {
    return 'AI features unavailable - insufficient device memory'
  }

  switch (capabilities.bestProvider) {
    case 'webgpu':
      return 'AI features available (WebGPU - fastest)'
    case 'wasm':
      return 'AI features available (CPU - slower)'
    default:
      return 'AI status unknown'
  }
}

/**
 * Get a help URL for browser compatibility
 * @param capabilities AI capabilities
 * @returns Help URL or null if not needed
 */
export function getBrowserCompatibilityHelpUrl(capabilities: AICapabilities): string | null {
  if (capabilities.webgpuSupported) {
    return null // No help needed
  }

  // Return a help URL based on what's missing
  if (!capabilities.wasmSupported) {
    return 'https://caniuse.com/wasm'
  }

  return 'https://caniuse.com/webgpu'
}
