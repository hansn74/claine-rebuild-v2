/**
 * Transformers.js Inference Service Tests
 *
 * Story 3.1: Local LLM Integration (Browser-Based Inference)
 * Task 3: Integrate Transformers.js v3 (AC: 2, 3)
 *
 * Tests for the Transformers.js inference service with mocked transformers
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  TransformersInferenceService,
  getTransformersInferenceService,
  __resetTransformersServiceForTesting,
} from '../transformersInferenceService'
import type { InferenceRequest } from '../types'

// Mock logger to avoid console spam
vi.mock('@/services/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// Create mock functions
const mockGenerator = vi.fn()

// Mock @huggingface/transformers
vi.mock('@huggingface/transformers', () => ({
  pipeline: vi.fn().mockImplementation(() => Promise.resolve(mockGenerator)),
  env: {
    allowLocalModels: false,
    useBrowserCache: true,
  },
}))

describe('TransformersInferenceService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    __resetTransformersServiceForTesting()

    // Reset mock to default behavior
    mockGenerator.mockReset()
    mockGenerator.mockResolvedValue([{ generated_text: 'Mock response from the model' }])
  })

  describe('singleton', () => {
    it('should return same instance', () => {
      const instance1 = getTransformersInferenceService()
      const instance2 = getTransformersInferenceService()
      expect(instance1).toBe(instance2)
    })

    it('should reset instance for testing', () => {
      const instance1 = getTransformersInferenceService()
      __resetTransformersServiceForTesting()
      const instance2 = getTransformersInferenceService()
      expect(instance1).not.toBe(instance2)
    })
  })

  describe('loadModel', () => {
    it('should load model successfully', async () => {
      const service = new TransformersInferenceService()

      await service.loadModel('test-model', 'wasm')

      expect(service.isModelLoaded()).toBe(true)
      expect(service.getCurrentModelId()).toBe('test-model')
      expect(service.getCurrentProvider()).toBe('wasm')
    })

    it('should not reload if same model', async () => {
      const { pipeline } = await import('@huggingface/transformers')
      const service = new TransformersInferenceService()

      await service.loadModel('test-model', 'wasm')
      vi.mocked(pipeline).mockClear()

      await service.loadModel('test-model', 'wasm')

      expect(pipeline).not.toHaveBeenCalled()
    })

    it('should call progress callback on load', async () => {
      const service = new TransformersInferenceService()
      const progressCallback = vi.fn()

      await service.loadModel('test-model', 'wasm', progressCallback)

      expect(progressCallback).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'downloading' })
      )
      expect(progressCallback).toHaveBeenCalledWith(expect.objectContaining({ status: 'ready' }))
    })
  })

  describe('inference', () => {
    it('should run inference successfully', async () => {
      const service = new TransformersInferenceService()
      await service.loadModel('test-model', 'wasm')

      const request: InferenceRequest = {
        requestId: 'test-1',
        prompt: 'Hello, world!',
        maxTokens: 100,
      }

      const result = await service.inference(request)

      expect('text' in result).toBe(true)
      if ('text' in result) {
        expect(result.text).toBe('Mock response from the model')
        expect(result.requestId).toBe('test-1')
        expect(result.provider).toBe('wasm')
      }
    })

    it('should return error if model not loaded', async () => {
      const service = new TransformersInferenceService()

      const request: InferenceRequest = {
        requestId: 'test-2',
        prompt: 'Test',
      }

      const result = await service.inference(request)

      expect('code' in result).toBe(true)
      if ('code' in result) {
        expect(result.code).toBe('MODEL_NOT_LOADED')
      }
    })

    it('should handle inference error', async () => {
      const service = new TransformersInferenceService()
      await service.loadModel('test-model', 'wasm')

      mockGenerator.mockRejectedValueOnce(new Error('Inference failed'))

      const request: InferenceRequest = {
        requestId: 'test-3',
        prompt: 'Test',
      }

      const result = await service.inference(request)

      expect('code' in result).toBe(true)
      if ('code' in result) {
        expect(result.code).toBe('UNKNOWN_ERROR')
        expect(result.message).toBe('Inference failed')
      }
    })

    it('should include system prompt in messages', async () => {
      const service = new TransformersInferenceService()
      await service.loadModel('test-model', 'wasm')

      const request: InferenceRequest = {
        requestId: 'test-4',
        prompt: 'Test prompt',
        systemPrompt: 'You are a helpful assistant',
      }

      await service.inference(request)

      expect(mockGenerator).toHaveBeenCalledWith(
        [
          { role: 'system', content: 'You are a helpful assistant' },
          { role: 'user', content: 'Test prompt' },
        ],
        expect.any(Object)
      )
    })
  })

  describe('unload', () => {
    it('should unload model', async () => {
      const service = new TransformersInferenceService()
      await service.loadModel('test-model', 'wasm')

      expect(service.isModelLoaded()).toBe(true)

      await service.unload()

      expect(service.isModelLoaded()).toBe(false)
      expect(service.getCurrentModelId()).toBeNull()
      expect(service.getCurrentProvider()).toBeNull()
    })

    it('should be safe to call when no model loaded', async () => {
      const service = new TransformersInferenceService()

      await service.unload() // Should not throw

      expect(service.isModelLoaded()).toBe(false)
    })
  })

  describe('state accessors', () => {
    it('should return correct isModelLoaded state', async () => {
      const service = new TransformersInferenceService()

      expect(service.isModelLoaded()).toBe(false)

      await service.loadModel('test-model', 'wasm')
      expect(service.isModelLoaded()).toBe(true)

      await service.unload()
      expect(service.isModelLoaded()).toBe(false)
    })

    it('should return correct modelId and provider', async () => {
      const service = new TransformersInferenceService()

      expect(service.getCurrentModelId()).toBeNull()
      expect(service.getCurrentProvider()).toBeNull()

      await service.loadModel('my-model-id', 'webgpu')

      expect(service.getCurrentModelId()).toBe('my-model-id')
      expect(service.getCurrentProvider()).toBe('webgpu')
    })
  })
})
