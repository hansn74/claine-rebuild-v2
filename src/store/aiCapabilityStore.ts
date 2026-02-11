/**
 * AI Capability Store
 *
 * Story 3.1: Local LLM Integration (Browser-Based Inference)
 * Task 2: Implement capability detection (AC: 1, 10)
 *
 * Zustand store for AI capability state with localStorage persistence.
 * Follows the pattern from settingsStore.ts
 */

import { create } from 'zustand'
import { logger } from '@/services/logger'
import type { AICapabilities, DeviceTier, ExecutionProvider, AIStatus } from '@/services/ai/types'

/**
 * localStorage key for capability state
 */
const AI_CAPABILITIES_KEY = 'claine_ai_capabilities'

/**
 * How long capability detection results are considered valid (24 hours)
 */
const CAPABILITY_CACHE_TTL_MS = 24 * 60 * 60 * 1000

/**
 * AI Capability Store State
 */
export interface AICapabilityState {
  // Capability data
  capabilities: AICapabilities | null
  status: AIStatus
  lastDetectionError: string | null

  // User preferences
  preferredProvider: ExecutionProvider | null // User override

  // Actions
  setCapabilities: (capabilities: AICapabilities) => void
  setStatus: (status: AIStatus) => void
  setDetectionError: (error: string | null) => void
  setPreferredProvider: (provider: ExecutionProvider | null) => void
  clearCapabilities: () => void
  isCapabilitiesCacheValid: () => boolean
}

/**
 * Default state values
 */
const DEFAULT_STATE = {
  capabilities: null,
  status: 'uninitialized' as AIStatus,
  lastDetectionError: null,
  preferredProvider: null,
}

/**
 * Persisted state shape (subset that gets saved)
 */
interface PersistedState {
  capabilities: AICapabilities | null
  preferredProvider: ExecutionProvider | null
}

/**
 * Load persisted state from localStorage
 */
function loadPersistedState(): Partial<PersistedState> {
  try {
    const stored = localStorage.getItem(AI_CAPABILITIES_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as PersistedState
      logger.debug('ai', 'Loaded AI capabilities from localStorage', {
        hasCapabilities: !!parsed.capabilities,
        preferredProvider: parsed.preferredProvider,
      })
      return parsed
    }
  } catch (error) {
    logger.warn('ai', 'Failed to load AI capabilities from localStorage', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
  return {}
}

/**
 * Persist state to localStorage
 */
function persistState(state: PersistedState): void {
  try {
    localStorage.setItem(AI_CAPABILITIES_KEY, JSON.stringify(state))
    logger.debug('ai', 'Persisted AI capabilities to localStorage')
  } catch (error) {
    logger.warn('ai', 'Failed to persist AI capabilities to localStorage', {
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

/**
 * AI Capability Store
 *
 * Manages AI capability state with localStorage persistence.
 */
export const useAICapabilityStore = create<AICapabilityState>((set, get) => {
  const persisted = loadPersistedState()

  return {
    // Initial state (persisted values override defaults)
    capabilities: persisted.capabilities ?? DEFAULT_STATE.capabilities,
    status: persisted.capabilities ? 'uninitialized' : DEFAULT_STATE.status,
    lastDetectionError: DEFAULT_STATE.lastDetectionError,
    preferredProvider: persisted.preferredProvider ?? DEFAULT_STATE.preferredProvider,

    // Actions
    setCapabilities: (capabilities: AICapabilities) => {
      set({ capabilities, lastDetectionError: null })
      const state = get()
      persistState({
        capabilities,
        preferredProvider: state.preferredProvider,
      })
      logger.info('ai', 'AI capabilities updated', {
        deviceTier: capabilities.deviceTier,
        bestProvider: capabilities.bestProvider,
      })
    },

    setStatus: (status: AIStatus) => {
      set({ status })
      logger.debug('ai', 'AI status updated', { status })
    },

    setDetectionError: (error: string | null) => {
      set({ lastDetectionError: error })
      if (error) {
        logger.error('ai', 'AI capability detection error', { error })
      }
    },

    setPreferredProvider: (provider: ExecutionProvider | null) => {
      set({ preferredProvider: provider })
      const state = get()
      persistState({
        capabilities: state.capabilities,
        preferredProvider: provider,
      })
      logger.info('ai', 'Preferred AI provider updated', { provider })
    },

    clearCapabilities: () => {
      set({
        capabilities: null,
        status: 'uninitialized',
        lastDetectionError: null,
      })
      try {
        localStorage.removeItem(AI_CAPABILITIES_KEY)
      } catch {
        // Ignore localStorage errors
      }
      logger.info('ai', 'AI capabilities cleared')
    },

    isCapabilitiesCacheValid: () => {
      const { capabilities } = get()
      if (!capabilities) {
        return false
      }

      const age = Date.now() - capabilities.detectedAt
      return age < CAPABILITY_CACHE_TTL_MS
    },
  }
})

/**
 * Selector: Get effective provider (preferred or best available)
 */
export function selectEffectiveProvider(state: AICapabilityState): ExecutionProvider | null {
  // User preference takes precedence
  if (state.preferredProvider) {
    // But only if it's available
    if (state.preferredProvider === 'webgpu' && state.capabilities?.webgpuSupported) {
      return 'webgpu'
    }
    if (state.preferredProvider === 'wasm' && state.capabilities?.wasmSupported) {
      return 'wasm'
    }
  }

  // Fall back to best available
  return state.capabilities?.bestProvider ?? null
}

/**
 * Selector: Check if AI features are available
 */
export function selectAIAvailable(state: AICapabilityState): boolean {
  if (!state.capabilities) {
    return false
  }

  if (!state.capabilities.meetsMinimumRequirements) {
    return false
  }

  // Check if at least one local provider is available
  return state.capabilities.webgpuSupported || state.capabilities.wasmSupported
}

/**
 * Selector: Get device tier
 */
export function selectDeviceTier(state: AICapabilityState): DeviceTier | null {
  return state.capabilities?.deviceTier ?? null
}

// Expose for E2E testing in dev mode
if (import.meta.env.DEV) {
  ;(
    window as unknown as { __TEST_AI_CAPABILITY_STORE__: typeof useAICapabilityStore }
  ).__TEST_AI_CAPABILITY_STORE__ = useAICapabilityStore
}
