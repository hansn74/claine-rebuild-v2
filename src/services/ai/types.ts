/**
 * AI Service Types
 *
 * Story 3.1: Local LLM Integration (Browser-Based Inference)
 * Task 1: Create AI service infrastructure (AC: 1, 8, 9)
 *
 * Type definitions for browser-based LLM inference with Transformers.js
 */

/**
 * Device capability tier for model selection
 */
export type DeviceTier = 'high' | 'medium' | 'low'

/**
 * Execution provider for inference
 */
export type ExecutionProvider = 'webgpu' | 'wasm'

/**
 * AI inference status
 */
export type AIStatus =
  | 'uninitialized'
  | 'loading'
  | 'ready'
  | 'processing'
  | 'error'
  | 'unavailable'

/**
 * Browser capability detection results
 */
export interface AICapabilities {
  /** WebGPU support detected */
  webgpuSupported: boolean
  /** WebAssembly support detected */
  wasmSupported: boolean
  /** Device memory in GB (navigator.deviceMemory) */
  deviceMemoryGB: number | null
  /** Estimated available memory in GB */
  estimatedAvailableMemoryGB: number | null
  /** Device tier based on capabilities */
  deviceTier: DeviceTier
  /** Best available execution provider */
  bestProvider: ExecutionProvider
  /** Whether minimum requirements are met (2GB memory for 1B model) */
  meetsMinimumRequirements: boolean
  /** Detected at timestamp */
  detectedAt: number
}

/**
 * Model loading progress
 */
export interface ModelLoadProgress {
  /** Current status */
  status: 'downloading' | 'loading' | 'ready' | 'error'
  /** Progress percentage (0-100) */
  progress: number
  /** Bytes downloaded so far */
  downloadedBytes: number
  /** Total bytes to download */
  totalBytes: number
  /** Estimated time remaining in ms */
  estimatedTimeRemainingMs: number | null
  /** Error message if status is 'error' */
  error?: string
}

/**
 * Inference request configuration
 */
export interface InferenceRequest {
  /** Unique request ID for tracking */
  requestId: string
  /** Input prompt for the model */
  prompt: string
  /** System prompt (optional) */
  systemPrompt?: string
  /** Maximum tokens to generate */
  maxTokens?: number
  /** Temperature for sampling (0-1) */
  temperature?: number
  /** Top-p sampling parameter */
  topP?: number
  /** Timeout in ms */
  timeoutMs?: number
}

/**
 * Inference response
 */
export interface InferenceResponse {
  /** Request ID for correlation */
  requestId: string
  /** Generated text */
  text: string
  /** Number of tokens generated */
  tokensGenerated: number
  /** Time to first token in ms */
  timeToFirstTokenMs: number
  /** Total inference time in ms */
  totalTimeMs: number
  /** Tokens per second */
  tokensPerSecond: number
  /** Execution provider used */
  provider: ExecutionProvider
  /** Model ID used */
  modelId: string
  /** Whether this was a fallback */
  isFallback: boolean
}

/**
 * Inference error
 */
export interface InferenceError {
  /** Request ID for correlation */
  requestId: string
  /** Error code */
  code: InferenceErrorCode
  /** Human-readable error message */
  message: string
  /** Underlying error details */
  details?: string
  /** Provider that failed */
  provider: ExecutionProvider
  /** Whether fallback was attempted */
  fallbackAttempted: boolean
}

/**
 * Error codes for inference failures
 */
export type InferenceErrorCode =
  | 'MODEL_NOT_LOADED'
  | 'GPU_OUT_OF_MEMORY'
  | 'INFERENCE_TIMEOUT'
  | 'WASM_ERROR'
  | 'NETWORK_ERROR'
  | 'CANCELLED'
  | 'UNKNOWN_ERROR'

/**
 * AI service configuration
 */
export interface AIConfig {
  /** Whether AI features are enabled */
  enabled: boolean
  /** Model ID to use (e.g., 'onnx-community/Llama-3.2-1B-Instruct-q4f16') */
  modelId: string
  /** Cache version for model storage */
  cacheVersion: number
  /** Inference timeout in ms */
  inferenceTimeoutMs: number
}

/**
 * Worker message types for AI inference
 */
export type AIWorkerMessageType =
  | 'LOAD_MODEL'
  | 'INFERENCE'
  | 'GET_STATUS'
  | 'UNLOAD_MODEL'
  | 'CANCEL'

/**
 * Worker message payload types
 */
export interface AIWorkerPayloads {
  LOAD_MODEL: {
    modelId: string
    provider: ExecutionProvider
  }
  INFERENCE: InferenceRequest
  GET_STATUS: undefined
  UNLOAD_MODEL: undefined
  CANCEL: { requestId: string }
}

/**
 * Worker response types
 */
export interface AIWorkerResponses {
  LOAD_MODEL: { success: boolean; error?: string }
  INFERENCE: InferenceResponse | InferenceError
  GET_STATUS: { status: AIStatus; modelLoaded: boolean }
  UNLOAD_MODEL: { success: boolean }
  CANCEL: { cancelled: boolean }
  PROGRESS: ModelLoadProgress
  READY: undefined
}

/**
 * Generic worker message structure
 */
export interface AIWorkerMessage<T extends AIWorkerMessageType> {
  type: T
  payload: AIWorkerPayloads[T]
  messageId: string
}

/**
 * Generic worker response structure
 */
export interface AIWorkerResponse<T extends AIWorkerMessageType> {
  type: T
  result?: AIWorkerResponses[T]
  error?: string
  messageId: string
  duration: number
}

/**
 * Performance metrics for monitoring
 */
export interface AIPerformanceMetrics {
  /** Model load time in ms */
  modelLoadTimeMs: number | null
  /** Average inference latency in ms */
  averageInferenceLatencyMs: number
  /** Average tokens per second */
  averageTokensPerSecond: number
  /** Total inference requests */
  totalRequests: number
  /** Failed inference requests */
  failedRequests: number
  /** Current memory usage estimate in bytes */
  memoryUsageBytes: number | null
}

/**
 * Default AI configuration
 */
export const DEFAULT_AI_CONFIG: AIConfig = {
  enabled: true,
  modelId: 'onnx-community/Llama-3.2-1B-Instruct-q4f16',
  cacheVersion: 1,
  inferenceTimeoutMs: 30000,
}

/**
 * Minimum memory requirement in GB for 1B model
 */
export const MINIMUM_MEMORY_GB = 2

/**
 * Model cache name for Cache Storage API
 */
export const MODEL_CACHE_NAME = 'claine-models-v1'
