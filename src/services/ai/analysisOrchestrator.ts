/**
 * Email Analysis Orchestrator
 *
 * Story 3.2: Email Analysis Engine
 * Task 4: Analysis orchestrator with worker integration (AC: 5)
 *
 * Orchestrates the full analysis pipeline:
 * 1. Extract features from email
 * 2. Score sender relationship
 * 3. Analyze thread context
 * 4. Build LLM prompt
 * 5. Run inference (via Web Worker)
 * 6. Parse and store results
 */

import { logger } from '@/services/logger'
import { healthRegistry } from '@/services/sync/healthRegistry'
import { aiInferenceService } from './aiInferenceService'
import { extractEmailFeatures, buildAnalysisPrompt, parseAnalysisResponse } from './emailAnalysis'
import { calculateSenderScore, createDefaultSenderScore } from './senderScoring'
import { analyzeThreadContext, createSingleMessageContext } from './threadContext'
import type { SenderStats } from './senderScoring'
import type { EmailDocument } from '@/services/database/schemas/email.schema'
import type { InferenceRequest } from './types'

/**
 * Analysis result for a single email
 */
export interface AnalysisResult {
  emailId: string
  triageScore: number
  priority: 'high' | 'medium' | 'low' | 'none'
  confidence: number
  reasoning: string
  signals: string[]
  modelVersion: string
  processedAt: number
  provider: 'local'
}

/**
 * Batch analysis progress
 */
export interface AnalysisProgress {
  total: number
  completed: number
  failed: number
  inProgress: boolean
}

/**
 * Dependencies injected for testability
 */
export interface AnalysisDependencies {
  getSenderStats: (email: string, accountId: string) => Promise<SenderStats | null>
  getThreadEmails: (threadId: string) => Promise<EmailDocument[]>
  storeResult: (emailId: string, result: AnalysisResult) => Promise<void>
}

/**
 * Analysis Orchestrator
 *
 * Singleton service that coordinates email analysis pipeline.
 */
export class AnalysisOrchestrator {
  private static instance: AnalysisOrchestrator
  private deps: AnalysisDependencies | null = null
  private progress: AnalysisProgress = {
    total: 0,
    completed: 0,
    failed: 0,
    inProgress: false,
  }

  private constructor() {
    logger.debug('ai', 'AnalysisOrchestrator instance created')
  }

  static getInstance(): AnalysisOrchestrator {
    if (!AnalysisOrchestrator.instance) {
      AnalysisOrchestrator.instance = new AnalysisOrchestrator()
    }
    return AnalysisOrchestrator.instance
  }

  static __resetForTesting(): void {
    AnalysisOrchestrator.instance = undefined as unknown as AnalysisOrchestrator
  }

  /**
   * Set dependencies (called during app initialization)
   */
  setDependencies(deps: AnalysisDependencies): void {
    this.deps = deps
  }

  /**
   * Get current analysis progress
   */
  getProgress(): AnalysisProgress {
    return { ...this.progress }
  }

  /**
   * Analyze a single email
   */
  async analyzeEmail(email: EmailDocument): Promise<AnalysisResult> {
    if (!this.deps) {
      throw new Error('AnalysisOrchestrator not initialized: call setDependencies()')
    }

    logger.debug('ai', 'Analyzing email', { emailId: email.id })

    // Step 1: Extract features
    const features = extractEmailFeatures(email)

    // Step 2: Get sender context
    const senderStats = await this.deps.getSenderStats(features.senderEmail, email.accountId)
    const senderScore = senderStats
      ? calculateSenderScore(features.senderEmail, senderStats)
      : createDefaultSenderScore(features.senderEmail)

    // Step 3: Get thread context
    const threadEmails = await this.deps.getThreadEmails(email.threadId)
    const threadContext =
      threadEmails.length > 1
        ? analyzeThreadContext(email, threadEmails)
        : createSingleMessageContext(email)

    // Step 4: Build prompt
    const { systemPrompt, userPrompt } = buildAnalysisPrompt(
      features,
      senderScore.contextSummary,
      threadContext.contextSummary
    )

    // Step 5: Run inference
    const result = await this.runInference(email.id, systemPrompt, userPrompt, features)

    // Step 6: Store result
    try {
      await this.deps.storeResult(email.id, result)
    } catch (error) {
      logger.error('ai', 'Failed to store analysis result', {
        emailId: email.id,
        error: error instanceof Error ? error.message : 'Unknown',
      })
    }

    return result
  }

  /**
   * Analyze a batch of emails
   */
  async analyzeBatch(emails: EmailDocument[]): Promise<AnalysisResult[]> {
    if (!this.deps) {
      throw new Error('AnalysisOrchestrator not initialized')
    }

    this.progress = {
      total: emails.length,
      completed: 0,
      failed: 0,
      inProgress: true,
    }

    healthRegistry.setAIHealth('degraded', `Analyzing ${emails.length} emails`)
    const results: AnalysisResult[] = []

    for (const email of emails) {
      try {
        const result = await this.analyzeEmail(email)
        results.push(result)
        this.progress.completed++
      } catch (error) {
        this.progress.failed++
        logger.error('ai', 'Batch analysis failed for email', {
          emailId: email.id,
          error: error instanceof Error ? error.message : 'Unknown',
        })
      }
    }

    this.progress.inProgress = false
    healthRegistry.setAIHealth('healthy', 'Analysis complete')

    logger.info('ai', 'Batch analysis complete', {
      total: emails.length,
      completed: this.progress.completed,
      failed: this.progress.failed,
    })

    return results
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async runInference(
    emailId: string,
    systemPrompt: string,
    userPrompt: string,
    features: ReturnType<typeof extractEmailFeatures>
  ): Promise<AnalysisResult> {
    const request: InferenceRequest = {
      requestId: `analysis_${emailId}_${Date.now()}`,
      prompt: userPrompt,
      systemPrompt,
      maxTokens: 256,
      temperature: 0.1, // Low temperature for consistent classification
    }

    // Run local inference — allow 'ready' or 'processing' (concurrent requests queue in worker)
    const status = aiInferenceService.getStatus()

    if (status !== 'ready' && status !== 'processing') {
      throw new Error('Local inference not available')
    }

    const response = await aiInferenceService.inference(request)
    const responseText = response.text

    // Parse LLM response
    const parsed = parseAnalysisResponse(responseText)
    if (!parsed) {
      throw new Error('Failed to parse inference response')
    }

    return {
      emailId,
      triageScore: parsed.score,
      priority: parsed.priority,
      confidence: this.calculateConfidence(parsed, features),
      reasoning: parsed.reasoning,
      signals: parsed.signals,
      modelVersion: aiInferenceService.getConfig().modelId,
      processedAt: Date.now(),
      provider: 'local',
    }
  }

  private calculateConfidence(
    parsed: { score: number; signals: string[] },
    features: ReturnType<typeof extractEmailFeatures>
  ): number {
    let confidence = 70 // Base confidence

    // Higher confidence when LLM signals align with detected keywords
    const signalOverlap = features.contentSignals.filter((s) => parsed.signals.includes(s)).length
    confidence += signalOverlap * 5

    // Lower confidence for borderline scores
    if (parsed.score >= 35 && parsed.score <= 65) {
      confidence -= 10
    }

    return Math.max(0, Math.min(100, confidence))
  }
}

export const analysisOrchestrator = AnalysisOrchestrator.getInstance()
