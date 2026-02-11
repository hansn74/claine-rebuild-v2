/**
 * Transformers.js Inference Service
 *
 * Story 3.1: Local LLM Integration (Browser-Based Inference)
 * Task 3: Integrate Transformers.js v3 (AC: 2, 3)
 *
 * Implementation of browser-based LLM inference using Transformers.js.
 * Supports WebGPU acceleration with WASM fallback.
 */

import { logger } from '@/services/logger'
import type {
  ExecutionProvider,
  InferenceRequest,
  InferenceResponse,
  InferenceError,
  ModelLoadProgress,
} from './types'
import { DEFAULT_AI_CONFIG } from './types'

/**
 * Transformers.js pipeline type (loaded dynamically)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Pipeline = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TextGenerationPipeline = any

/**
 * Transformers.js progress callback data
 */
interface TransformersProgress {
  status: string
  name?: string
  file?: string
  loaded?: number
  total?: number
  progress?: number
}

/**
 * Transformers.js Inference Service
 *
 * Provides browser-based LLM inference using Transformers.js.
 * Manages model loading, inference execution, and resource cleanup.
 */
export class TransformersInferenceService {
  private pipeline: Pipeline | null = null
  private generator: TextGenerationPipeline | null = null
  private currentModelId: string | null = null
  private currentProvider: ExecutionProvider | null = null
  private isLoading = false
  private progressCallback: ((progress: ModelLoadProgress) => void) | null = null

  /**
   * Load the text generation pipeline
   * @param modelId Model ID to load (e.g., 'onnx-community/Llama-3.2-1B-Instruct-q4f16')
   * @param provider Execution provider (webgpu or wasm)
   * @param onProgress Progress callback
   */
  async loadModel(
    modelId: string = DEFAULT_AI_CONFIG.modelId,
    provider: ExecutionProvider = 'wasm',
    onProgress?: (progress: ModelLoadProgress) => void
  ): Promise<void> {
    if (this.isLoading) {
      throw new Error('Model is already loading')
    }

    if (this.generator && this.currentModelId === modelId) {
      logger.debug('ai', 'Model already loaded', { modelId })
      return
    }

    this.isLoading = true
    this.progressCallback = onProgress || null

    logger.info('ai', 'Loading model with Transformers.js', {
      modelId,
      provider,
    })

    try {
      // Dynamic import of transformers.js
      const { pipeline, env } = await import('@huggingface/transformers')
      this.pipeline = pipeline

      // Configure environment
      // Allow local models for development/testing
      env.allowLocalModels = false
      // Use browser cache for model files
      env.useBrowserCache = true

      // Report initial progress
      this.reportProgress({
        status: 'downloading',
        progress: 0,
        downloadedBytes: 0,
        totalBytes: 0,
        estimatedTimeRemainingMs: null,
      })

      // Configure device based on provider
      const device = provider === 'webgpu' ? 'webgpu' : 'wasm'
      const dtype = provider === 'webgpu' ? 'fp16' : 'q4' // Use quantized for WASM

      logger.debug('ai', 'Creating text-generation pipeline', {
        device,
        dtype,
      })

      // Create the pipeline with progress tracking
      this.generator = await pipeline('text-generation', modelId, {
        device,
        dtype,
        progress_callback: (progress: TransformersProgress) => {
          this.handleProgressCallback(progress)
        },
      })

      this.currentModelId = modelId
      this.currentProvider = provider
      this.isLoading = false

      this.reportProgress({
        status: 'ready',
        progress: 100,
        downloadedBytes: 0,
        totalBytes: 0,
        estimatedTimeRemainingMs: null,
      })

      logger.info('ai', 'Model loaded successfully', {
        modelId,
        provider,
      })
    } catch (error) {
      this.isLoading = false
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      // Check for specific error types
      if (errorMessage.includes('GPUOutOfMemoryError') || errorMessage.includes('out of memory')) {
        logger.error('ai', 'GPU out of memory - model too large', {
          modelId,
          provider,
          error: errorMessage,
        })
        this.reportProgress({
          status: 'error',
          progress: 0,
          downloadedBytes: 0,
          totalBytes: 0,
          estimatedTimeRemainingMs: null,
          error: 'GPU out of memory. Try using WASM backend or a smaller model.',
        })
      } else {
        logger.error('ai', 'Failed to load model', {
          modelId,
          provider,
          error: errorMessage,
        })
        this.reportProgress({
          status: 'error',
          progress: 0,
          downloadedBytes: 0,
          totalBytes: 0,
          estimatedTimeRemainingMs: null,
          error: errorMessage,
        })
      }

      throw error
    }
  }

  /**
   * Run inference with the loaded model
   * @param request Inference request
   * @returns Inference response
   */
  async inference(request: InferenceRequest): Promise<InferenceResponse | InferenceError> {
    if (!this.generator) {
      return {
        requestId: request.requestId,
        code: 'MODEL_NOT_LOADED',
        message: 'Model is not loaded. Call loadModel() first.',
        provider: this.currentProvider || 'wasm',
        fallbackAttempted: false,
      }
    }

    const startTime = performance.now()

    logger.debug('ai', 'Starting inference', {
      requestId: request.requestId,
      promptLength: request.prompt.length,
      maxTokens: request.maxTokens,
    })

    try {
      // Build messages for chat-style inference
      const messages = []

      if (request.systemPrompt) {
        messages.push({ role: 'system', content: request.systemPrompt })
      }

      messages.push({ role: 'user', content: request.prompt })

      // Run generation
      const result = await this.generator(messages, {
        max_new_tokens: request.maxTokens || 256,
        temperature: request.temperature || 0.7,
        top_p: request.topP || 0.9,
        do_sample: true,
        return_full_text: false,
      })

      const totalTime = performance.now() - startTime

      // Extract generated text
      const generatedText =
        result[0]?.generated_text || (typeof result[0] === 'object' && result[0]?.text) || ''

      // Estimate tokens (rough approximation: 4 chars per token)
      const estimatedTokens = Math.ceil(generatedText.length / 4)

      logger.info('ai', 'Inference completed', {
        requestId: request.requestId,
        totalTimeMs: totalTime,
        estimatedTokens,
      })

      return {
        requestId: request.requestId,
        text: generatedText,
        tokensGenerated: estimatedTokens,
        timeToFirstTokenMs: totalTime, // Transformers.js doesn't expose this
        totalTimeMs: totalTime,
        tokensPerSecond: estimatedTokens / (totalTime / 1000),
        provider: this.currentProvider || 'wasm',
        modelId: this.currentModelId || '',
        isFallback: false,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      logger.error('ai', 'Inference failed', {
        requestId: request.requestId,
        error: errorMessage,
      })

      // Determine error code
      let errorCode: InferenceError['code'] = 'UNKNOWN_ERROR'
      if (errorMessage.includes('GPUOutOfMemoryError') || errorMessage.includes('out of memory')) {
        errorCode = 'GPU_OUT_OF_MEMORY'
      } else if (errorMessage.includes('wasm')) {
        errorCode = 'WASM_ERROR'
      } else if (errorMessage.includes('timeout')) {
        errorCode = 'INFERENCE_TIMEOUT'
      }

      return {
        requestId: request.requestId,
        code: errorCode,
        message: errorMessage,
        details: error instanceof Error ? error.stack : undefined,
        provider: this.currentProvider || 'wasm',
        fallbackAttempted: false,
      }
    }
  }

  /**
   * Unload the model and free resources
   */
  async unload(): Promise<void> {
    if (this.generator) {
      // Transformers.js doesn't have explicit dispose, but we can help GC
      this.generator = null
    }

    this.currentModelId = null
    this.currentProvider = null
    this.isLoading = false
    this.progressCallback = null

    // Suggest garbage collection (not guaranteed but helps)
    if (typeof globalThis.gc === 'function') {
      globalThis.gc()
    }

    logger.info('ai', 'Model unloaded')
  }

  /**
   * Check if model is loaded
   */
  isModelLoaded(): boolean {
    return this.generator !== null
  }

  /**
   * Get current model ID
   */
  getCurrentModelId(): string | null {
    return this.currentModelId
  }

  /**
   * Get current execution provider
   */
  getCurrentProvider(): ExecutionProvider | null {
    return this.currentProvider
  }

  /**
   * Handle progress callback from Transformers.js
   */
  private handleProgressCallback(progress: TransformersProgress): void {
    if (progress.status === 'progress' && progress.loaded && progress.total) {
      const percent = Math.round((progress.loaded / progress.total) * 100)

      this.reportProgress({
        status: 'downloading',
        progress: percent,
        downloadedBytes: progress.loaded,
        totalBytes: progress.total,
        estimatedTimeRemainingMs: null, // Transformers.js doesn't provide ETA
      })
    } else if (progress.status === 'ready') {
      this.reportProgress({
        status: 'loading',
        progress: 95,
        downloadedBytes: 0,
        totalBytes: 0,
        estimatedTimeRemainingMs: null,
      })
    }
  }

  /**
   * Report progress to callback
   */
  private reportProgress(progress: ModelLoadProgress): void {
    if (this.progressCallback) {
      this.progressCallback(progress)
    }
  }
}

/**
 * Singleton instance
 */
let instance: TransformersInferenceService | null = null

/**
 * Get the singleton instance
 */
export function getTransformersInferenceService(): TransformersInferenceService {
  if (!instance) {
    instance = new TransformersInferenceService()
  }
  return instance
}

/**
 * Reset for testing
 * @internal
 */
export function __resetTransformersServiceForTesting(): void {
  if (instance) {
    instance.unload()
  }
  instance = null
}
