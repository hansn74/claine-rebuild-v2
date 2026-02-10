/**
 * AI Service Module
 *
 * Story 3.1: Local LLM Integration (Browser-Based Inference)
 *
 * Provides browser-based LLM inference using Transformers.js.
 * Supports WebGPU acceleration with WASM fallback.
 *
 * Usage:
 *   import { aiInferenceService } from '@/services/ai'
 *
 *   // Initialize and load model
 *   await aiInferenceService.initialize()
 *   await aiInferenceService.loadModel()
 *
 *   // Run inference
 *   const response = await aiInferenceService.inference({
 *     requestId: 'req_1',
 *     prompt: 'Summarize this email...',
 *   })
 */

// Main inference service
export { aiInferenceService, AIInferenceService } from './aiInferenceService'

// Capability detection
export {
  detectCapabilities,
  detectWebGPU,
  detectWebAssembly,
  getDeviceMemory,
  estimateAvailableMemory,
  determineDeviceTier,
  determineBestProvider,
  meetsMinimumRequirements,
  getCapabilityStatusMessage,
  getBrowserCompatibilityHelpUrl,
} from './capabilityDetection'

// Transformers.js inference service
export {
  TransformersInferenceService,
  getTransformersInferenceService,
  __resetTransformersServiceForTesting,
} from './transformersInferenceService'

// Model caching
export {
  ModelCacheService,
  modelCacheService,
  MODEL_CACHE_VERSION,
  CACHE_METADATA_KEY,
  type CacheMetadata,
  type CacheStatus,
} from './modelCache'

// Cloud fallback
export {
  CloudInferenceService,
  cloudInferenceService,
  type CloudProvider,
  type CloudProviderConfig,
  type CircuitState,
} from './cloudInferenceService'

// Email analysis (Story 3.2)
export {
  extractEmailFeatures,
  buildAnalysisPrompt,
  parseAnalysisResponse,
  type EmailFeatures,
  type ContentSignal,
} from './emailAnalysis'

export {
  calculateSenderScore,
  createDefaultSenderScore,
  type SenderScore,
  type SenderStats,
  type SenderCategory,
} from './senderScoring'

export {
  analyzeThreadContext,
  createSingleMessageContext,
  type ThreadContext,
} from './threadContext'

export {
  AnalysisOrchestrator,
  analysisOrchestrator,
  type AnalysisResult,
  type AnalysisProgress,
  type AnalysisDependencies,
} from './analysisOrchestrator'

// Result storage (Story 3.2 Task 5)
export {
  storeAnalysisResult,
  storeAnalysisResultsBatch,
  getSenderStats,
  getThreadEmails,
  needsAnalysis,
  createAnalysisDependencies,
} from './analysisResultStore'

// Priority scoring (Story 3.3)
export {
  getPriorityDisplay,
  isUserOverride,
  PRIORITY_THRESHOLDS,
  USER_OVERRIDE_MODEL_VERSION,
  type Priority,
  type PriorityDisplayInfo,
} from './priorityDisplay'

export {
  PriorityScoringService,
  priorityScoringService,
  type ScoreResult,
  type ScoreBatchOptions,
} from './priorityScoringService'

export { setEmailPriority, clearPriorityOverride, priorityToScore } from './priorityOverride'

// Type definitions
export type {
  // Capability types
  DeviceTier,
  ExecutionProvider,
  AIStatus,
  AICapabilities,
  // Configuration
  AIConfig,
  // Inference types
  InferenceRequest,
  InferenceResponse,
  InferenceError,
  InferenceErrorCode,
  // Progress tracking
  ModelLoadProgress,
  // Performance metrics
  AIPerformanceMetrics,
  // Worker types
  AIWorkerMessageType,
  AIWorkerPayloads,
  AIWorkerResponses,
  AIWorkerMessage,
  AIWorkerResponse,
} from './types'

// Constants
export { DEFAULT_AI_CONFIG, MINIMUM_MEMORY_GB, MODEL_CACHE_NAME } from './types'
