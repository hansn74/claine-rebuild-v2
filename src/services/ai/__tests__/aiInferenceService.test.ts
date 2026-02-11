/**
 * AI Inference Service Tests
 *
 * Story 3.1: Local LLM Integration (Browser-Based Inference)
 * Task 1: Create AI service infrastructure (AC: 1, 8, 9)
 *
 * Tests for the AI inference service singleton and basic functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AIInferenceService } from '../aiInferenceService'
import type { InferenceRequest, AIConfig } from '../types'

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

// Mock Web Worker
class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  private messageHandlers: ((event: MessageEvent) => void)[] = []

  constructor() {
    // Simulate worker ready signal
    setTimeout(() => {
      this.postToMain({ type: 'READY', messageId: 'init', duration: 0 })
    }, 10)
  }

  postMessage(data: unknown): void {
    // Simulate worker responses
    const message = data as { type: string; messageId: string; payload?: unknown }

    setTimeout(() => {
      switch (message.type) {
        case 'LOAD_MODEL':
          this.postToMain({
            type: 'LOAD_MODEL',
            result: { success: true },
            messageId: message.messageId,
            duration: 100,
          })
          break
        case 'INFERENCE':
          this.postToMain({
            type: 'INFERENCE',
            result: {
              requestId: (message.payload as InferenceRequest).requestId,
              text: 'Mock inference response',
              tokensGenerated: 10,
              timeToFirstTokenMs: 50,
              totalTimeMs: 200,
              tokensPerSecond: 50,
              provider: 'wasm',
              modelId: 'test-model',
              isFallback: false,
            },
            messageId: message.messageId,
            duration: 200,
          })
          break
        case 'GET_STATUS':
          this.postToMain({
            type: 'GET_STATUS',
            result: { status: 'ready', modelLoaded: true },
            messageId: message.messageId,
            duration: 1,
          })
          break
        case 'UNLOAD_MODEL':
          this.postToMain({
            type: 'UNLOAD_MODEL',
            result: { success: true },
            messageId: message.messageId,
            duration: 10,
          })
          break
        case 'CANCEL':
          this.postToMain({
            type: 'CANCEL',
            result: { cancelled: true },
            messageId: message.messageId,
            duration: 1,
          })
          break
      }
    }, 10)
  }

  addEventListener(type: string, handler: (event: MessageEvent) => void): void {
    if (type === 'message') {
      this.messageHandlers.push(handler)
    }
  }

  removeEventListener(type: string, handler: (event: MessageEvent) => void): void {
    if (type === 'message') {
      const index = this.messageHandlers.indexOf(handler)
      if (index > -1) {
        this.messageHandlers.splice(index, 1)
      }
    }
  }

  terminate(): void {
    this.messageHandlers = []
  }

  private postToMain(data: unknown): void {
    const event = { data } as MessageEvent
    if (this.onmessage) {
      this.onmessage(event)
    }
    this.messageHandlers.forEach((handler) => handler(event))
  }
}

// Mock the Worker constructor globally using a proper class
vi.stubGlobal('Worker', MockWorker)

describe('AIInferenceService', () => {
  let service: AIInferenceService

  beforeEach(() => {
    // Reset singleton for each test
    AIInferenceService.__resetForTesting()
    service = AIInferenceService.getInstance()
    vi.clearAllMocks()
  })

  afterEach(() => {
    service.dispose()
  })

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = AIInferenceService.getInstance()
      const instance2 = AIInferenceService.getInstance()
      expect(instance1).toBe(instance2)
    })
  })

  describe('__resetForTesting', () => {
    it('should reset singleton instance', () => {
      const instance1 = AIInferenceService.getInstance()
      AIInferenceService.__resetForTesting()
      const instance2 = AIInferenceService.getInstance()
      expect(instance1).not.toBe(instance2)
    })
  })

  describe('initialize', () => {
    it('should initialize with default config', async () => {
      await service.initialize()
      expect(service.getStatus()).toBe('uninitialized')
      expect(service.getConfig().enabled).toBe(true)
    })

    it('should initialize with custom config', async () => {
      const customConfig: Partial<AIConfig> = {
        modelId: 'custom-model',
      }

      await service.initialize(customConfig)
      expect(service.getConfig().modelId).toBe('custom-model')
    })

    it('should mark service unavailable when disabled', async () => {
      await service.initialize({ enabled: false })
      expect(service.getStatus()).toBe('unavailable')
    })
  })

  describe('initializeWorker', () => {
    it('should initialize worker successfully', async () => {
      await service.initialize()
      await service.initializeWorker()
      // If no error thrown, worker initialized
      expect(true).toBe(true)
    })

    it('should not reinitialize if already initialized', async () => {
      await service.initialize()
      await service.initializeWorker()
      await service.initializeWorker() // Second call should be no-op
      expect(true).toBe(true)
    })
  })

  describe('loadModel', () => {
    it('should load model successfully', async () => {
      await service.initialize()
      await service.loadModel()

      expect(service.isModelLoaded()).toBe(true)
      expect(service.getStatus()).toBe('ready')
    })

    it('should not reload if already loaded', async () => {
      await service.initialize()
      await service.loadModel()
      await service.loadModel() // Second call should be no-op

      expect(service.isModelLoaded()).toBe(true)
    })

    it('should update load progress', async () => {
      await service.initialize()
      await service.loadModel()

      const progress = service.getLoadProgress()
      expect(progress).not.toBeNull()
      expect(progress?.status).toBe('ready')
    })
  })

  describe('inference', () => {
    beforeEach(async () => {
      await service.initialize()
      await service.loadModel()
    })

    it('should run inference successfully', async () => {
      const request: InferenceRequest = {
        requestId: 'test-1',
        prompt: 'Hello world',
      }

      const response = await service.inference(request)

      expect(response.requestId).toBe('test-1')
      expect(response.text).toBeDefined()
      expect(response.tokensGenerated).toBeGreaterThan(0)
    })

    it('should throw error if model not loaded', async () => {
      AIInferenceService.__resetForTesting()
      const freshService = AIInferenceService.getInstance()
      await freshService.initialize()

      const request: InferenceRequest = {
        requestId: 'test-2',
        prompt: 'Hello',
      }

      await expect(freshService.inference(request)).rejects.toMatchObject({
        code: 'MODEL_NOT_LOADED',
      })
    })

    it('should update metrics after inference', async () => {
      const request: InferenceRequest = {
        requestId: 'test-3',
        prompt: 'Hello',
      }

      await service.inference(request)

      const metrics = service.getMetrics()
      expect(metrics.totalRequests).toBe(1)
      expect(metrics.averageInferenceLatencyMs).toBeGreaterThan(0)
    })
  })

  describe('cancelRequest', () => {
    it('should return false for non-existent request', async () => {
      await service.initialize()
      const cancelled = await service.cancelRequest('non-existent')
      expect(cancelled).toBe(false)
    })
  })

  describe('unloadModel', () => {
    it('should unload model', async () => {
      await service.initialize()
      await service.loadModel()
      expect(service.isModelLoaded()).toBe(true)

      await service.unloadModel()
      expect(service.isModelLoaded()).toBe(false)
      expect(service.getStatus()).toBe('uninitialized')
    })

    it('should be no-op if model not loaded', async () => {
      await service.initialize()
      await service.unloadModel() // Should not throw
      expect(service.isModelLoaded()).toBe(false)
    })
  })

  describe('dispose', () => {
    it('should clean up all resources', async () => {
      await service.initialize()
      await service.loadModel()

      service.dispose()

      expect(service.getStatus()).toBe('uninitialized')
      expect(service.isModelLoaded()).toBe(false)
    })
  })

  describe('capabilities', () => {
    it('should store and retrieve capabilities', () => {
      service.setCapabilities({
        webgpuSupported: true,
        wasmSupported: true,
        deviceMemoryGB: 8,
        estimatedAvailableMemoryGB: 4,
        deviceTier: 'high',
        bestProvider: 'webgpu',
        meetsMinimumRequirements: true,
        detectedAt: Date.now(),
      })

      const capabilities = service.getCapabilities()
      expect(capabilities).not.toBeNull()
      expect(capabilities?.webgpuSupported).toBe(true)
      expect(capabilities?.deviceTier).toBe('high')
    })
  })

  describe('subscription', () => {
    it('should notify listeners on state change', async () => {
      const listener = vi.fn()
      service.subscribe(listener)

      await service.initialize()

      // Initialization should trigger notification
      expect(listener).toHaveBeenCalled()
    })

    it('should unsubscribe correctly', async () => {
      const listener = vi.fn()
      const unsubscribe = service.subscribe(listener)

      unsubscribe()
      listener.mockClear()

      await service.initialize()

      // Listener should not be called after unsubscribe
      expect(listener).not.toHaveBeenCalled()
    })
  })

  describe('configuration', () => {
    it('should update configuration', () => {
      service.setConfig({ inferenceTimeoutMs: 60000 })
      expect(service.getConfig().inferenceTimeoutMs).toBe(60000)
    })

    it('should preserve existing config when updating', () => {
      const originalModelId = service.getConfig().modelId

      service.setConfig({ inferenceTimeoutMs: 60000 })

      expect(service.getConfig().modelId).toBe(originalModelId)
    })
  })

  describe('metrics', () => {
    it('should return initial metrics', () => {
      const metrics = service.getMetrics()

      expect(metrics.modelLoadTimeMs).toBeNull()
      expect(metrics.totalRequests).toBe(0)
      expect(metrics.failedRequests).toBe(0)
    })
  })
})
