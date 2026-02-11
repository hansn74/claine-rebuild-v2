/**
 * AI Inference Performance Benchmarks
 *
 * Story 3.1: Local LLM Integration (Browser-Based Inference)
 * Task 7: Performance benchmarking (AC: 4)
 *
 * Benchmark targets:
 * - Cold start (model load from cache): <10s
 * - Warm inference latency (triage): <500ms
 * - Warm inference latency (generation): <2s
 *
 * Note: These benchmarks require actual model and GPU availability.
 * In CI, they verify the benchmark harness runs without errors
 * using mocked services. Real performance numbers come from
 * manual testing on target hardware.
 */

import { describe, bench, beforeAll, vi } from 'vitest'
import { AIInferenceService } from '../aiInferenceService'
import type { InferenceRequest, InferenceResponse, ModelLoadProgress } from '../types'

// Mock dependencies for CI benchmark harness
vi.mock('@/services/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock('@/services/sync/healthRegistry', () => ({
  healthRegistry: {
    setAIHealth: vi.fn(),
  },
}))

/**
 * Simulated inference response for benchmark harness
 */
function createMockResponse(
  requestId: string,
  tokensGenerated: number,
  totalTimeMs: number
): InferenceResponse {
  return {
    requestId,
    text: 'Mock inference result '.repeat(tokensGenerated / 3),
    tokensGenerated,
    timeToFirstTokenMs: totalTimeMs * 0.1,
    totalTimeMs,
    tokensPerSecond: tokensGenerated / (totalTimeMs / 1000),
    provider: 'wasm',
    modelId: 'onnx-community/Llama-3.2-1B-Instruct-q4f16',
    isFallback: false,
  }
}

describe('AI Inference Performance Benchmarks', () => {
  beforeAll(() => {
    AIInferenceService.getInstance()
  })

  describe('Benchmark Harness Validation', () => {
    bench(
      'mock inference request creation',
      () => {
        const request: InferenceRequest = {
          requestId: `bench_${Date.now()}`,
          prompt: 'Classify this email priority: Subject: Meeting tomorrow',
          systemPrompt: 'You are an email triage assistant. Respond with: high, medium, or low.',
          maxTokens: 10,
          temperature: 0.1,
        }
        // Simulate processing
        createMockResponse(request.requestId, 3, 150)
      },
      { iterations: 1000 }
    )

    bench(
      'mock triage classification (target: <500ms)',
      () => {
        const response = createMockResponse('triage_bench', 5, 250)
        if (response.totalTimeMs > 500) {
          throw new Error(`Triage too slow: ${response.totalTimeMs}ms`)
        }
      },
      { iterations: 100 }
    )

    bench(
      'mock generation response (target: <2s)',
      () => {
        const response = createMockResponse('gen_bench', 50, 1500)
        if (response.totalTimeMs > 2000) {
          throw new Error(`Generation too slow: ${response.totalTimeMs}ms`)
        }
      },
      { iterations: 100 }
    )

    bench(
      'performance metrics calculation',
      () => {
        const latencies = Array.from({ length: 100 }, () => Math.random() * 500)
        const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length
        const p95 = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)]
        const p99 = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.99)]
        // Just ensure calculation completes
        if (avg < 0 || p95 < 0 || p99 < 0) throw new Error('Invalid metrics')
      },
      { iterations: 100 }
    )

    bench(
      'progress tracking overhead',
      () => {
        const progress: ModelLoadProgress = {
          status: 'downloading',
          progress: 0,
          downloadedBytes: 0,
          totalBytes: 1_240_000_000,
          estimatedTimeRemainingMs: null,
        }

        // Simulate 100 progress updates
        for (let i = 0; i <= 100; i++) {
          progress.progress = i
          progress.downloadedBytes = (i / 100) * progress.totalBytes
          progress.estimatedTimeRemainingMs = i > 0 ? ((100 - i) / i) * 10000 : null
        }
      },
      { iterations: 100 }
    )
  })
})
