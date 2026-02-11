/**
 * AI Inference Service
 *
 * Story 3.1: Local LLM Integration (Browser-Based Inference)
 * Task 1: Create AI service infrastructure (AC: 1, 8, 9)
 *
 * Singleton service that manages browser-based LLM inference.
 * Uses Web Workers for non-blocking inference and integrates
 * with the health registry for monitoring.
 *
 * Follows the singleton pattern from searchIndexService.ts
 */

import { logger } from '@/services/logger'
import { healthRegistry } from '@/services/sync/healthRegistry'
import type {
  AIStatus,
  AIConfig,
  AICapabilities,
  InferenceRequest,
  InferenceResponse,
  InferenceError,
  ModelLoadProgress,
  AIPerformanceMetrics,
  ExecutionProvider,
  AIWorkerMessage,
  AIWorkerResponse,
  AIWorkerMessageType,
} from './types'
import { DEFAULT_AI_CONFIG } from './types'

/**
 * Pending inference request tracking
 */
interface PendingRequest {
  resolve: (response: InferenceResponse) => void
  reject: (error: InferenceError) => void
  timeoutId: ReturnType<typeof setTimeout>
}

/**
 * AI Inference Service
 *
 * Central service for browser-based LLM inference.
 * Manages model loading, inference execution, and health monitoring.
 */
export class AIInferenceService {
  private static instance: AIInferenceService

  private worker: Worker | null = null
  private status: AIStatus = 'uninitialized'
  private config: AIConfig = DEFAULT_AI_CONFIG
  private capabilities: AICapabilities | null = null
  private modelLoaded = false
  private loadProgress: ModelLoadProgress | null = null
  private pendingRequests = new Map<string, PendingRequest>()
  private listeners = new Set<() => void>()
  private messageIdCounter = 0

  // Performance metrics
  private metrics: AIPerformanceMetrics = {
    modelLoadTimeMs: null,
    averageInferenceLatencyMs: 0,
    averageTokensPerSecond: 0,
    totalRequests: 0,
    failedRequests: 0,
    memoryUsageBytes: null,
  }
  private activeInferenceCount = 0
  private inferenceLatencies: number[] = []
  private tokensPerSecondHistory: number[] = []

  private constructor() {
    // Private constructor for singleton
    logger.debug('ai', 'AIInferenceService instance created')
  }

  /**
   * Get singleton instance
   */
  static getInstance(): AIInferenceService {
    if (!AIInferenceService.instance) {
      AIInferenceService.instance = new AIInferenceService()
    }
    return AIInferenceService.instance
  }

  /**
   * Reset singleton instance (for testing only)
   * @internal
   */
  static __resetForTesting(): void {
    if (AIInferenceService.instance) {
      AIInferenceService.instance.dispose()
    }
    AIInferenceService.instance = null as unknown as AIInferenceService
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Initialize the AI service with configuration
   */
  async initialize(config?: Partial<AIConfig>): Promise<void> {
    if (config) {
      this.config = { ...this.config, ...config }
    }

    if (!this.config.enabled) {
      this.status = 'unavailable'
      healthRegistry.setAIHealth('unavailable', 'AI features disabled')
      this.notify()
      logger.info('ai', 'AI features disabled by configuration')
      return
    }

    logger.info('ai', 'Initializing AI inference service', {
      modelId: this.config.modelId,
    })

    this.status = 'uninitialized'
    healthRegistry.setAIHealth('healthy', 'Service initialized, model not loaded')
    this.notify()
  }

  /**
   * Initialize the Web Worker for inference
   */
  async initializeWorker(): Promise<void> {
    if (this.worker) {
      logger.debug('ai', 'Worker already initialized')
      return
    }

    try {
      this.worker = new Worker(new URL('../../workers/ai-inference.worker.ts', import.meta.url), {
        type: 'module',
      })

      this.worker.onmessage = this.handleWorkerMessage.bind(this)
      this.worker.onerror = this.handleWorkerError.bind(this)

      // Wait for worker ready signal
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Worker initialization timeout'))
        }, 10000)

        const readyHandler = (event: MessageEvent) => {
          if (event.data.type === 'READY') {
            clearTimeout(timeout)
            this.worker?.removeEventListener('message', readyHandler)
            resolve()
          }
        }

        this.worker?.addEventListener('message', readyHandler)
      })

      logger.info('ai', 'AI worker initialized successfully')
    } catch (error) {
      logger.error('ai', 'Failed to initialize AI worker', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      this.status = 'error'
      healthRegistry.setAIHealth('unavailable', 'Worker initialization failed')
      this.notify()
      throw error
    }
  }

  /**
   * Load the AI model
   */
  async loadModel(provider?: ExecutionProvider): Promise<void> {
    if (this.modelLoaded) {
      logger.debug('ai', 'Model already loaded')
      return
    }

    if (!this.worker) {
      await this.initializeWorker()
    }

    const executionProvider = provider || this.capabilities?.bestProvider || 'wasm'
    const loadStartTime = performance.now()

    this.status = 'loading'
    this.loadProgress = {
      status: 'downloading',
      progress: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      estimatedTimeRemainingMs: null,
    }
    healthRegistry.setAIHealth('degraded', 'Loading model')
    this.notify()

    logger.info('ai', 'Loading AI model', {
      modelId: this.config.modelId,
      provider: executionProvider,
    })

    try {
      const response = await this.sendWorkerMessage('LOAD_MODEL', {
        modelId: this.config.modelId,
        provider: executionProvider,
      })

      const loadResult = response.result as { success: boolean; error?: string }
      if (response.error || !loadResult?.success) {
        throw new Error(response.error || loadResult?.error || 'Model loading failed')
      }

      const loadTime = performance.now() - loadStartTime
      this.metrics.modelLoadTimeMs = loadTime
      this.modelLoaded = true
      this.status = 'ready'
      this.loadProgress = {
        status: 'ready',
        progress: 100,
        downloadedBytes: 0,
        totalBytes: 0,
        estimatedTimeRemainingMs: null,
      }
      healthRegistry.setAIHealth('healthy', 'Model loaded and ready')
      this.notify()

      logger.info('ai', 'AI model loaded successfully', {
        loadTimeMs: loadTime,
        provider: executionProvider,
      })
    } catch (error) {
      this.status = 'error'
      this.loadProgress = {
        status: 'error',
        progress: 0,
        downloadedBytes: 0,
        totalBytes: 0,
        estimatedTimeRemainingMs: null,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
      healthRegistry.setAIHealth('unavailable', 'Model loading failed')
      this.notify()

      logger.error('ai', 'Failed to load AI model', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      throw error
    }
  }

  /**
   * Run inference with the loaded model
   */
  async inference(request: InferenceRequest): Promise<InferenceResponse> {
    if (!this.modelLoaded) {
      const error: InferenceError = {
        requestId: request.requestId,
        code: 'MODEL_NOT_LOADED',
        message: 'Model is not loaded. Call loadModel() first.',
        provider: 'wasm',
        fallbackAttempted: false,
      }
      this.metrics.failedRequests++
      throw error
    }

    // Allow concurrent inference — worker queues messages naturally.
    // Only block if status indicates a real problem (loading, error, etc.)
    if (this.status !== 'ready' && this.status !== 'processing') {
      const error: InferenceError = {
        requestId: request.requestId,
        code: 'MODEL_NOT_LOADED',
        message: `Cannot run inference in status: ${this.status}`,
        provider: 'wasm',
        fallbackAttempted: false,
      }
      this.metrics.failedRequests++
      throw error
    }

    this.activeInferenceCount++
    this.status = 'processing'
    this.notify()

    logger.debug('ai', 'Starting inference', {
      requestId: request.requestId,
      promptLength: request.prompt.length,
    })

    const timeoutMs = request.timeoutMs || this.config.inferenceTimeoutMs

    try {
      const response = await Promise.race([
        this.executeInference(request),
        this.createTimeoutPromise(request.requestId, timeoutMs),
      ])

      this.activeInferenceCount--
      if (this.activeInferenceCount <= 0) {
        this.activeInferenceCount = 0
        this.status = 'ready'
      }
      this.notify()

      // Update metrics
      this.metrics.totalRequests++
      this.inferenceLatencies.push(response.totalTimeMs)
      this.tokensPerSecondHistory.push(response.tokensPerSecond)
      this.updateAverageMetrics()

      logger.info('ai', 'Inference completed', {
        requestId: request.requestId,
        totalTimeMs: response.totalTimeMs,
        tokensGenerated: response.tokensGenerated,
        tokensPerSecond: response.tokensPerSecond,
      })

      return response
    } catch (error) {
      this.activeInferenceCount--
      if (this.activeInferenceCount <= 0) {
        this.activeInferenceCount = 0
        this.status = 'ready'
      }
      this.metrics.failedRequests++
      this.notify()

      throw error
    }
  }

  /**
   * Cancel a pending inference request
   */
  async cancelRequest(requestId: string): Promise<boolean> {
    const pending = this.pendingRequests.get(requestId)
    if (pending) {
      clearTimeout(pending.timeoutId)
      pending.reject({
        requestId,
        code: 'CANCELLED',
        message: 'Request cancelled by user',
        provider: 'wasm',
        fallbackAttempted: false,
      })
      this.pendingRequests.delete(requestId)

      if (this.worker) {
        await this.sendWorkerMessage('CANCEL', { requestId })
      }

      logger.info('ai', 'Inference request cancelled', { requestId })
      return true
    }
    return false
  }

  /**
   * Unload the model and free resources
   */
  async unloadModel(): Promise<void> {
    if (!this.modelLoaded) {
      return
    }

    if (this.worker) {
      await this.sendWorkerMessage('UNLOAD_MODEL', undefined)
    }

    this.modelLoaded = false
    this.status = 'uninitialized'
    this.loadProgress = null
    healthRegistry.setAIHealth('healthy', 'Model unloaded')
    this.notify()

    logger.info('ai', 'AI model unloaded')
  }

  /**
   * Dispose the service and cleanup resources
   */
  dispose(): void {
    // Cancel all pending requests
    for (const [requestId, pending] of this.pendingRequests) {
      clearTimeout(pending.timeoutId)
      pending.reject({
        requestId,
        code: 'CANCELLED',
        message: 'Service disposed',
        provider: 'wasm',
        fallbackAttempted: false,
      })
    }
    this.pendingRequests.clear()

    // Terminate worker
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }

    // Reset state
    this.status = 'uninitialized'
    this.modelLoaded = false
    this.activeInferenceCount = 0
    this.loadProgress = null
    this.capabilities = null
    this.listeners.clear()

    logger.info('ai', 'AI inference service disposed')
  }

  // ============================================================================
  // State Accessors
  // ============================================================================

  /**
   * Get current service status
   */
  getStatus(): AIStatus {
    return this.status
  }

  /**
   * Check if model is loaded
   */
  isModelLoaded(): boolean {
    return this.modelLoaded
  }

  /**
   * Get model loading progress
   */
  getLoadProgress(): ModelLoadProgress | null {
    return this.loadProgress
  }

  /**
   * Get current configuration
   */
  getConfig(): AIConfig {
    return { ...this.config }
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<AIConfig>): void {
    this.config = { ...this.config, ...config }
    logger.debug('ai', 'Configuration updated', config)
  }

  /**
   * Get capabilities (set by capabilityDetection)
   */
  getCapabilities(): AICapabilities | null {
    return this.capabilities
  }

  /**
   * Set capabilities (called by capabilityDetection)
   */
  setCapabilities(capabilities: AICapabilities): void {
    this.capabilities = capabilities
    logger.debug('ai', 'Capabilities set', {
      deviceTier: capabilities.deviceTier,
      bestProvider: capabilities.bestProvider,
      meetsMinimumRequirements: capabilities.meetsMinimumRequirements,
    })
  }

  /**
   * Get performance metrics
   */
  getMetrics(): AIPerformanceMetrics {
    return { ...this.metrics }
  }

  // ============================================================================
  // Subscription API
  // ============================================================================

  /**
   * Subscribe to state changes
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private handleWorkerMessage(event: MessageEvent<AIWorkerResponse<AIWorkerMessageType>>): void {
    const { type, messageId, result, duration } = event.data

    // Handle progress updates
    if (type === ('PROGRESS' as AIWorkerMessageType)) {
      this.loadProgress = result as ModelLoadProgress
      this.notify()
      return
    }

    logger.debug('ai', 'Worker message received', { type, messageId, duration })
  }

  private handleWorkerError(event: ErrorEvent): void {
    logger.error('ai', 'Worker error', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
    })

    this.status = 'error'
    healthRegistry.setAIHealth('unavailable', 'Worker error occurred')
    this.notify()
  }

  private async sendWorkerMessage<T extends AIWorkerMessageType>(
    type: T,
    payload: AIWorkerMessage<T>['payload']
  ): Promise<AIWorkerResponse<T>> {
    if (!this.worker) {
      throw new Error('Worker not initialized')
    }

    const messageId = `msg_${++this.messageIdCounter}`

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Worker message timeout: ${type}`))
      }, 60000) // 60s timeout for model loading

      const handler = (event: MessageEvent<AIWorkerResponse<T>>) => {
        if (event.data.messageId === messageId) {
          clearTimeout(timeout)
          this.worker?.removeEventListener('message', handler)
          resolve(event.data)
        }
      }

      this.worker?.addEventListener('message', handler)

      const message: AIWorkerMessage<T> = {
        type,
        payload,
        messageId,
      }

      this.worker?.postMessage(message)
    })
  }

  private async executeInference(request: InferenceRequest): Promise<InferenceResponse> {
    const response = await this.sendWorkerMessage('INFERENCE', request)

    if (response.error) {
      throw {
        requestId: request.requestId,
        code: 'UNKNOWN_ERROR',
        message: response.error,
        provider: 'wasm',
        fallbackAttempted: false,
      } as InferenceError
    }

    return response.result as InferenceResponse
  }

  private createTimeoutPromise(requestId: string, timeoutMs: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject({
          requestId,
          code: 'INFERENCE_TIMEOUT',
          message: `Inference timed out after ${timeoutMs}ms`,
          provider: 'wasm',
          fallbackAttempted: false,
        } as InferenceError)
      }, timeoutMs)
    })
  }

  private updateAverageMetrics(): void {
    // Keep only last 100 samples
    if (this.inferenceLatencies.length > 100) {
      this.inferenceLatencies = this.inferenceLatencies.slice(-100)
    }
    if (this.tokensPerSecondHistory.length > 100) {
      this.tokensPerSecondHistory = this.tokensPerSecondHistory.slice(-100)
    }

    // Calculate averages
    if (this.inferenceLatencies.length > 0) {
      this.metrics.averageInferenceLatencyMs =
        this.inferenceLatencies.reduce((a, b) => a + b, 0) / this.inferenceLatencies.length
    }

    if (this.tokensPerSecondHistory.length > 0) {
      this.metrics.averageTokensPerSecond =
        this.tokensPerSecondHistory.reduce((a, b) => a + b, 0) / this.tokensPerSecondHistory.length
    }
  }

  private notify(): void {
    this.listeners.forEach((listener) => {
      try {
        listener()
      } catch (error) {
        logger.error('ai', 'Error in AI service listener', {
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    })
  }
}

/**
 * Singleton instance export
 */
export const aiInferenceService = AIInferenceService.getInstance()
