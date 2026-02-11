/**
 * AI Inference Web Worker
 *
 * Story 3.1: Local LLM Integration (Browser-Based Inference)
 * Task 1: Create AI service infrastructure (AC: 8)
 *
 * Offloads AI inference to a background thread to prevent UI blocking.
 * Uses Transformers.js for browser-based LLM inference.
 *
 * Follows the pattern from searchIndexer.worker.ts
 */

import type {
  AIWorkerMessage,
  AIWorkerResponse,
  AIWorkerMessageType,
  AIWorkerPayloads,
  InferenceRequest,
  InferenceResponse,
  InferenceError,
  ModelLoadProgress,
  ExecutionProvider,
  AIStatus,
} from '@/services/ai/types'

// ============================================================================
// State
// ============================================================================

let status: AIStatus = 'uninitialized'
let modelLoaded = false
let currentModelId: string | null = null
let currentProvider: ExecutionProvider | null = null
// Pipeline will be loaded dynamically from transformers.js
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pipeline: any = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let generator: any = null

// Active inference tracking for cancellation
const activeInferences = new Map<string, { cancelled: boolean }>()

// ============================================================================
// Model Loading
// ============================================================================

/**
 * Load the AI model using Transformers.js
 */
async function loadModel(
  payload: AIWorkerPayloads['LOAD_MODEL']
): Promise<{ success: boolean; error?: string }> {
  const { modelId, provider } = payload

  if (modelLoaded && currentModelId === modelId) {
    return { success: true }
  }

  status = 'loading'

  try {
    // Dynamic import of transformers.js (will be installed in Task 3)
    // For now, we stub this to allow the worker structure to be tested
    const transformers = await import('@huggingface/transformers')

    // Report initial progress
    postProgressUpdate({
      status: 'downloading',
      progress: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      estimatedTimeRemainingMs: null,
    })

    // Configure execution provider
    const device = provider === 'webgpu' ? 'webgpu' : 'wasm'

    // Create pipeline with progress callback
    pipeline = transformers.pipeline
    generator = await pipeline('text-generation', modelId, {
      device,
      progress_callback: (progress: { status: string; loaded?: number; total?: number }) => {
        if (progress.status === 'progress' && progress.loaded && progress.total) {
          const percent = Math.round((progress.loaded / progress.total) * 100)
          postProgressUpdate({
            status: 'downloading',
            progress: percent,
            downloadedBytes: progress.loaded,
            totalBytes: progress.total,
            estimatedTimeRemainingMs: null,
          })
        }
      },
    })

    modelLoaded = true
    currentModelId = modelId
    currentProvider = provider
    status = 'ready'

    postProgressUpdate({
      status: 'ready',
      progress: 100,
      downloadedBytes: 0,
      totalBytes: 0,
      estimatedTimeRemainingMs: null,
    })

    return { success: true }
  } catch (error) {
    status = 'error'
    const errorMessage = error instanceof Error ? error.message : 'Unknown error loading model'

    postProgressUpdate({
      status: 'error',
      progress: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      estimatedTimeRemainingMs: null,
      error: errorMessage,
    })

    return { success: false, error: errorMessage }
  }
}

/**
 * Unload the model and free resources
 */
async function unloadModel(): Promise<{ success: boolean }> {
  if (generator) {
    // Transformers.js pipelines should be garbage collected
    // but we explicitly null the reference
    generator = null
  }

  modelLoaded = false
  currentModelId = null
  currentProvider = null
  status = 'uninitialized'

  return { success: true }
}

// ============================================================================
// Inference
// ============================================================================

/**
 * Run inference with the loaded model
 */
async function runInference(
  request: InferenceRequest
): Promise<InferenceResponse | InferenceError> {
  if (!modelLoaded || !generator) {
    return {
      requestId: request.requestId,
      code: 'MODEL_NOT_LOADED',
      message: 'Model is not loaded',
      provider: currentProvider || 'wasm',
      fallbackAttempted: false,
    }
  }

  // Track this inference for cancellation
  activeInferences.set(request.requestId, { cancelled: false })

  const startTime = performance.now()
  let timeToFirstToken: number | null = null

  try {
    status = 'processing'

    // Build chat messages for instruct models (Llama-3.2-Instruct, etc.)
    // Transformers.js text-generation pipeline accepts messages array directly
    // and applies the model's chat template automatically
    const messages: Array<{ role: string; content: string }> = []
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt })
    }
    messages.push({ role: 'user', content: request.prompt })

    // Run inference with chat messages
    const result = await generator(messages, {
      max_new_tokens: request.maxTokens || 256,
      temperature: request.temperature || 0.7,
      top_p: request.topP || 0.9,
      do_sample: true,
    })

    // Clean up tracking
    activeInferences.delete(request.requestId)

    const totalTime = performance.now() - startTime

    // Extract the assistant's response from the last message
    const lastMessage = result[0].generated_text
    const generatedText =
      typeof lastMessage === 'string'
        ? lastMessage
        : Array.isArray(lastMessage)
          ? (lastMessage[lastMessage.length - 1] as { content: string }).content
          : ''

    // Estimate tokens (rough approximation: 4 chars per token)
    const estimatedTokens = Math.ceil(generatedText.length / 4)

    status = 'ready'

    return {
      requestId: request.requestId,
      text: generatedText,
      tokensGenerated: estimatedTokens,
      timeToFirstTokenMs: timeToFirstToken || totalTime,
      totalTimeMs: totalTime,
      tokensPerSecond: estimatedTokens / (totalTime / 1000),
      provider: currentProvider || 'wasm',
      modelId: currentModelId || '',
      isFallback: false,
    }
  } catch (error) {
    // Clean up tracking
    activeInferences.delete(request.requestId)
    status = 'ready'

    if (error instanceof Error && error.message === 'CANCELLED') {
      return {
        requestId: request.requestId,
        code: 'CANCELLED',
        message: 'Inference was cancelled',
        provider: currentProvider || 'wasm',
        fallbackAttempted: false,
      }
    }

    // Check for specific error types
    let errorCode: InferenceError['code'] = 'UNKNOWN_ERROR'
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    if (errorMessage.includes('GPUOutOfMemoryError') || errorMessage.includes('out of memory')) {
      errorCode = 'GPU_OUT_OF_MEMORY'
    } else if (errorMessage.includes('wasm')) {
      errorCode = 'WASM_ERROR'
    }

    return {
      requestId: request.requestId,
      code: errorCode,
      message: errorMessage,
      details: error instanceof Error ? error.stack : undefined,
      provider: currentProvider || 'wasm',
      fallbackAttempted: false,
    }
  }
}

/**
 * Cancel an active inference
 */
function cancelInference(requestId: string): { cancelled: boolean } {
  const tracking = activeInferences.get(requestId)
  if (tracking) {
    tracking.cancelled = true
    return { cancelled: true }
  }
  return { cancelled: false }
}

/**
 * Get current worker status
 */
function getStatus(): { status: AIStatus; modelLoaded: boolean } {
  return { status, modelLoaded }
}

// ============================================================================
// Progress Updates
// ============================================================================

/**
 * Post a progress update to the main thread
 */
function postProgressUpdate(progress: ModelLoadProgress): void {
  self.postMessage({
    type: 'PROGRESS',
    result: progress,
    messageId: 'progress',
    duration: 0,
  })
}

// ============================================================================
// Message Handler
// ============================================================================

/**
 * Handle incoming messages from main thread
 */
self.onmessage = async (event: MessageEvent<AIWorkerMessage<AIWorkerMessageType>>) => {
  const { type, payload, messageId } = event.data
  const startTime = performance.now()

  let response: AIWorkerResponse<AIWorkerMessageType>

  try {
    switch (type) {
      case 'LOAD_MODEL': {
        const result = await loadModel(payload as AIWorkerPayloads['LOAD_MODEL'])
        response = {
          type,
          result,
          messageId,
          duration: performance.now() - startTime,
        }
        break
      }

      case 'INFERENCE': {
        const result = await runInference(payload as InferenceRequest)
        response = {
          type,
          result,
          messageId,
          duration: performance.now() - startTime,
        }
        break
      }

      case 'GET_STATUS': {
        const result = getStatus()
        response = {
          type,
          result,
          messageId,
          duration: performance.now() - startTime,
        }
        break
      }

      case 'UNLOAD_MODEL': {
        const result = await unloadModel()
        response = {
          type,
          result,
          messageId,
          duration: performance.now() - startTime,
        }
        break
      }

      case 'CANCEL': {
        const { requestId } = payload as AIWorkerPayloads['CANCEL']
        const result = cancelInference(requestId)
        response = {
          type,
          result,
          messageId,
          duration: performance.now() - startTime,
        }
        break
      }

      default:
        response = {
          type,
          error: `Unknown message type: ${type}`,
          messageId,
          duration: performance.now() - startTime,
        }
    }
  } catch (error) {
    response = {
      type,
      error: error instanceof Error ? error.message : 'Unknown error',
      messageId,
      duration: performance.now() - startTime,
    }
  }

  self.postMessage(response)
}

// Signal that worker is ready
self.postMessage({ type: 'READY', messageId: 'init', duration: 0 })
