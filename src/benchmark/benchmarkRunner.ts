/**
 * Benchmark Runner
 *
 * Core benchmark logic for comparing LLM models on email priority scoring.
 * Uses Transformers.js directly (no worker, no singletons).
 * Reuses buildAnalysisPrompt and parseAnalysisResponse from emailAnalysis.ts.
 */

import {
  extractEmailFeatures,
  buildAnalysisPrompt,
  parseAnalysisResponse,
} from '@/services/ai/emailAnalysis'
import { TEST_EMAILS, type LabeledEmail } from './testEmails'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TextGenerationPipeline = any

export interface BenchmarkConfig {
  modelIds: string[]
  provider: 'webgpu' | 'wasm'
  dtype: 'auto' | 'q4f16' | 'fp16' | 'fp32' | 'q4'
  onProgress: (msg: string, type?: 'info' | 'success' | 'error') => void
  onModelResult: (result: ModelBenchmarkResult) => void
  signal?: AbortSignal
}

export interface ModelBenchmarkResult {
  modelId: string
  loadTimeMs: number
  loadFailed: boolean
  loadError?: string
  effectiveDtype?: string
  results: EmailBenchmarkResult[]
  avgInferenceMs: number
  accuracy: number
  scoreAccuracy: number
  parseFailures: number
}

export interface EmailBenchmarkResult {
  emailId: string
  expected: { priority: string; score: number }
  actual: { priority: string; score: number; reasoning: string } | null
  inferenceMs: number
  rawOutput: string
  correct: boolean
}

function isCorrectPriority(expected: string, actual: string): boolean {
  return expected === actual
}

async function runSingleEmail(
  generator: TextGenerationPipeline,
  labeled: LabeledEmail,
  modelId: string
): Promise<EmailBenchmarkResult> {
  const features = extractEmailFeatures(labeled.email)
  const { systemPrompt, userPrompt } = buildAnalysisPrompt(features)

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ]

  // DeepSeek-R1-Distill outputs <think>...</think> tokens before JSON — needs more generation budget
  const maxNewTokens = modelId.toLowerCase().includes('deepseek') ? 512 : 256

  const startTime = performance.now()

  const result = await generator(messages, {
    max_new_tokens: maxNewTokens,
    temperature: 0.1,
    top_p: 0.9,
    do_sample: true,
    return_full_text: false,
  })

  const inferenceMs = performance.now() - startTime

  // Transformers.js chat format returns generated_text as a message object or array
  const generated = result[0]?.generated_text
  let rawOutput: string
  if (typeof generated === 'string') {
    rawOutput = generated
  } else if (Array.isArray(generated)) {
    // Chat format: [{role: 'assistant', content: '...'}]
    const last = generated[generated.length - 1]
    rawOutput = last?.content || last?.text || JSON.stringify(last)
  } else if (generated && typeof generated === 'object') {
    // Single message object: {role: 'assistant', content: '...'}
    rawOutput = generated.content || generated.text || JSON.stringify(generated)
  } else {
    rawOutput = String(generated ?? '')
  }

  const parsed = parseAnalysisResponse(rawOutput)

  return {
    emailId: labeled.email.id,
    expected: labeled.expected,
    actual: parsed
      ? { priority: parsed.priority, score: parsed.score, reasoning: parsed.reasoning }
      : null,
    inferenceMs,
    rawOutput,
    correct: parsed ? isCorrectPriority(labeled.expected.priority, parsed.priority) : false,
  }
}

function computeModelResult(
  modelId: string,
  loadTimeMs: number,
  results: EmailBenchmarkResult[],
  opts?: { loadFailed?: boolean; loadError?: string; effectiveDtype?: string }
): ModelBenchmarkResult {
  const correctCount = results.filter((r) => r.correct).length
  const parsedResults = results.filter((r) => r.actual !== null)
  const parseFailures = results.filter((r) => r.actual === null).length

  const avgInferenceMs =
    results.length > 0 ? results.reduce((sum, r) => sum + r.inferenceMs, 0) / results.length : 0

  // Score accuracy: average absolute difference between expected and actual scores
  let scoreAccuracy = 0
  if (parsedResults.length > 0) {
    const totalScoreDiff = parsedResults.reduce((sum, r) => {
      const expectedScore = r.expected.score
      const actualScore = r.actual!.score
      return sum + Math.abs(expectedScore - actualScore)
    }, 0)
    scoreAccuracy = totalScoreDiff / parsedResults.length
  }

  return {
    modelId,
    loadTimeMs,
    loadFailed: opts?.loadFailed ?? false,
    loadError: opts?.loadError,
    effectiveDtype: opts?.effectiveDtype,
    results,
    avgInferenceMs,
    accuracy: results.length > 0 ? (correctCount / results.length) * 100 : 0,
    scoreAccuracy,
    parseFailures,
  }
}

export async function runBenchmark(config: BenchmarkConfig): Promise<ModelBenchmarkResult[]> {
  const { modelIds, provider, dtype, onProgress, onModelResult, signal } = config
  const allResults: ModelBenchmarkResult[] = []

  for (const modelId of modelIds) {
    if (signal?.aborted) {
      onProgress('Benchmark aborted by user', 'error')
      break
    }

    onProgress(`Loading model: ${modelId}`, 'info')
    let generator: TextGenerationPipeline = null
    let loadTimeMs = 0
    let effectiveDtype: string | undefined

    try {
      const { pipeline, env } = await import('@huggingface/transformers')

      env.allowLocalModels = false
      env.useBrowserCache = true

      const device = provider === 'webgpu' ? 'webgpu' : 'wasm'

      const makeProgressCallback = () => ({
        progress_callback: (p: { status: string; progress?: number; file?: string }) => {
          if (p.status === 'progress' && p.progress !== undefined) {
            const pct = Math.round(p.progress)
            if (pct % 10 === 0 || pct === 100) {
              onProgress(`  Downloading ${p.file || '...'}: ${pct}%`)
            }
          } else if (p.status === 'ready') {
            onProgress(`  File ready: ${p.file || ''}`, 'success')
          }
        },
      })

      // Build dtype candidates to try in order
      const dtypeCandidates: (string | undefined)[] = []
      if (dtype !== 'auto') {
        // Explicit dtype — only try that one
        dtypeCandidates.push(dtype)
      } else if (device === 'webgpu' && !modelId.toLowerCase().includes('q4f16')) {
        // Auto on WebGPU: try q4f16 first (small/fast), fall back to fp16, then model default
        dtypeCandidates.push('q4f16', 'fp16', undefined)
      } else {
        dtypeCandidates.push(undefined)
      }

      let lastError: Error | null = null
      const loadStart = performance.now()

      for (const candidateDtype of dtypeCandidates) {
        if (signal?.aborted) break

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pipelineOpts: Record<string, any> = { device, ...makeProgressCallback() }
        if (candidateDtype) {
          pipelineOpts.dtype = candidateDtype
        }

        const label = candidateDtype || 'model default'
        onProgress(`Creating pipeline (device: ${device}, dtype: ${label})...`)

        try {
          generator = await pipeline('text-generation', modelId, pipelineOpts)
          effectiveDtype = candidateDtype
          lastError = null
          break
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error))
          const msg = lastError.message
          onProgress(`  Failed with dtype=${label}: ${msg.slice(0, 120)}`, 'error')

          // If there are more candidates, try the next one
          if (candidateDtype !== dtypeCandidates[dtypeCandidates.length - 1]) {
            onProgress(`  Retrying with next dtype...`, 'info')
          }
        }
      }

      if (!generator || lastError) {
        throw lastError || new Error('No dtype candidates succeeded')
      }

      loadTimeMs = performance.now() - loadStart
      onProgress(
        `Model loaded in ${(loadTimeMs / 1000).toFixed(1)}s (dtype: ${effectiveDtype || 'model default'})`,
        'success'
      )
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      onProgress(`Failed to load ${modelId}: ${msg}`, 'error')

      const failResult = computeModelResult(modelId, loadTimeMs, [], {
        loadFailed: true,
        loadError: msg,
        effectiveDtype,
      })
      allResults.push(failResult)
      onModelResult(failResult)
      continue
    }

    // Run each test email
    const emailResults: EmailBenchmarkResult[] = []
    for (let i = 0; i < TEST_EMAILS.length; i++) {
      if (signal?.aborted) {
        onProgress('Benchmark aborted by user', 'error')
        break
      }

      const labeled = TEST_EMAILS[i]
      onProgress(`  [${i + 1}/${TEST_EMAILS.length}] ${labeled.email.subject.slice(0, 60)}...`)

      try {
        const result = await runSingleEmail(generator, labeled, modelId)
        emailResults.push(result)

        const status = result.correct ? '✓' : result.actual ? '✗' : '⚠ parse fail'
        const actual = result.actual ? `${result.actual.priority}(${result.actual.score})` : 'null'
        const expected = `${result.expected.priority}(${result.expected.score})`
        onProgress(
          `    ${status} expected=${expected} actual=${actual} (${(result.inferenceMs / 1000).toFixed(1)}s)`,
          result.correct ? 'success' : 'error'
        )
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        onProgress(`    ⚠ Error: ${msg}`, 'error')
        emailResults.push({
          emailId: labeled.email.id,
          expected: labeled.expected,
          actual: null,
          inferenceMs: 0,
          rawOutput: msg,
          correct: false,
        })
      }
    }

    // Unload model — dispose ONNX sessions and free WebGPU buffers
    try {
      if (generator && typeof generator.dispose === 'function') {
        await generator.dispose()
        onProgress('  Model disposed', 'info')
      }
    } catch {
      // dispose may throw if session already closed
    }
    generator = null
    if (typeof globalThis.gc === 'function') {
      globalThis.gc()
    }
    // Brief pause to let GPU memory free
    await new Promise((r) => setTimeout(r, 1000))

    const modelResult = computeModelResult(modelId, loadTimeMs, emailResults, { effectiveDtype })
    allResults.push(modelResult)
    onModelResult(modelResult)

    onProgress(
      `Finished ${modelId}: accuracy=${modelResult.accuracy.toFixed(0)}%, avg=${(modelResult.avgInferenceMs / 1000).toFixed(1)}s, failures=${modelResult.parseFailures}`,
      'success'
    )
    onProgress('---')
  }

  onProgress('Benchmark complete!', 'success')
  return allResults
}
