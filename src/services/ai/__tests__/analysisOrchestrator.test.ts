/**
 * Analysis Orchestrator Tests
 *
 * Story 3.2: Email Analysis Engine
 * Task 4: Analysis orchestrator with worker integration (AC: 5)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AnalysisOrchestrator, type AnalysisDependencies } from '../analysisOrchestrator'
import type { EmailDocument } from '@/services/database/schemas/email.schema'
import type { SenderStats } from '../senderScoring'

vi.mock('@/services/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/services/sync/healthRegistry', () => ({
  healthRegistry: {
    setAIHealth: vi.fn(),
  },
}))

const mockGetStatus = vi.fn()
const mockLocalInference = vi.fn()
const mockGetConfig = vi.fn()

vi.mock('../aiInferenceService', () => ({
  aiInferenceService: {
    getStatus: (...args: unknown[]) => mockGetStatus(...args),
    inference: (...args: unknown[]) => mockLocalInference(...args),
    getConfig: (...args: unknown[]) => mockGetConfig(...args),
  },
}))

function createEmail(overrides?: Partial<EmailDocument>): EmailDocument {
  return {
    id: 'email-1',
    threadId: 'thread-1',
    from: { name: 'Alice', email: 'alice@example.com' },
    to: [{ name: 'Bob', email: 'bob@company.com' }],
    subject: 'Project update',
    body: { text: 'Here is the latest project status.' },
    timestamp: Date.now(),
    accountId: 'account-1',
    attachments: [],
    snippet: 'Here is the latest project status.',
    labels: ['inbox'],
    folder: 'inbox',
    read: false,
    starred: false,
    importance: 'normal' as const,
    attributes: {},
    ...overrides,
  }
}

function createDeps(overrides?: Partial<AnalysisDependencies>): AnalysisDependencies {
  return {
    getSenderStats: vi.fn().mockResolvedValue(null),
    getThreadEmails: vi.fn().mockResolvedValue([]),
    storeResult: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

const VALID_LLM_RESPONSE = JSON.stringify({
  priority: 'high',
  score: 85,
  reasoning: 'Important project deadline',
  signals: ['deadline', 'request'],
})

describe('AnalysisOrchestrator', () => {
  let orchestrator: AnalysisOrchestrator

  beforeEach(() => {
    vi.resetAllMocks()
    AnalysisOrchestrator.__resetForTesting()
    orchestrator = AnalysisOrchestrator.getInstance()

    mockGetConfig.mockReturnValue({ modelId: 'test-model-v1' })
  })

  describe('singleton', () => {
    it('should return the same instance', () => {
      const a = AnalysisOrchestrator.getInstance()
      const b = AnalysisOrchestrator.getInstance()
      expect(a).toBe(b)
    })

    it('should reset for testing', () => {
      const a = AnalysisOrchestrator.getInstance()
      AnalysisOrchestrator.__resetForTesting()
      const b = AnalysisOrchestrator.getInstance()
      expect(a).not.toBe(b)
    })
  })

  describe('initialization', () => {
    it('should throw if analyzeEmail called without setDependencies', async () => {
      const email = createEmail()
      await expect(orchestrator.analyzeEmail(email)).rejects.toThrow(
        'AnalysisOrchestrator not initialized'
      )
    })

    it('should throw if analyzeBatch called without setDependencies', async () => {
      await expect(orchestrator.analyzeBatch([])).rejects.toThrow(
        'AnalysisOrchestrator not initialized'
      )
    })
  })

  describe('analyzeEmail - local inference', () => {
    it('should run full pipeline with local inference', async () => {
      const email = createEmail()
      const senderStats: SenderStats = {
        receivedCount: 15,
        repliedCount: 10,
        lastEmailAt: Date.now(),
        isAutomated: false,
      }

      const deps = createDeps({
        getSenderStats: vi.fn().mockResolvedValue(senderStats),
        getThreadEmails: vi.fn().mockResolvedValue([email]),
      })
      orchestrator.setDependencies(deps)

      mockGetStatus.mockReturnValue('ready')
      mockLocalInference.mockResolvedValue({ text: VALID_LLM_RESPONSE })

      const result = await orchestrator.analyzeEmail(email)

      expect(result.emailId).toBe('email-1')
      expect(result.priority).toBe('high')
      expect(result.triageScore).toBe(85)
      expect(result.provider).toBe('local')
      expect(result.modelVersion).toBe('test-model-v1')
      expect(result.signals).toEqual(['deadline', 'request'])
      expect(deps.storeResult).toHaveBeenCalledWith('email-1', result)
    })

    it('should use default sender score when stats unavailable', async () => {
      const email = createEmail()
      const deps = createDeps({
        getSenderStats: vi.fn().mockResolvedValue(null),
        getThreadEmails: vi.fn().mockResolvedValue([email]),
      })
      orchestrator.setDependencies(deps)

      mockGetStatus.mockReturnValue('ready')
      mockLocalInference.mockResolvedValue({ text: VALID_LLM_RESPONSE })

      const result = await orchestrator.analyzeEmail(email)

      expect(result.emailId).toBe('email-1')
      expect(deps.getSenderStats).toHaveBeenCalledWith('alice@example.com', 'account-1')
    })

    it('should use thread context for multi-message thread', async () => {
      const email1 = createEmail({ id: 'e1', timestamp: 1000 })
      const email2 = createEmail({
        id: 'e2',
        timestamp: 2000,
        from: { name: 'Bob', email: 'bob@company.com' },
      })

      const deps = createDeps({
        getThreadEmails: vi.fn().mockResolvedValue([email1, email2]),
      })
      orchestrator.setDependencies(deps)

      mockGetStatus.mockReturnValue('ready')
      mockLocalInference.mockResolvedValue({ text: VALID_LLM_RESPONSE })

      const result = await orchestrator.analyzeEmail(email2)

      expect(result.emailId).toBe('e2')
      expect(deps.getThreadEmails).toHaveBeenCalledWith('thread-1')
    })
  })

  describe('analyzeEmail - no provider / inference errors', () => {
    it('should throw when local inference not available', async () => {
      const email = createEmail()
      const deps = createDeps({
        getThreadEmails: vi.fn().mockResolvedValue([email]),
      })
      orchestrator.setDependencies(deps)

      mockGetStatus.mockReturnValue('idle')

      await expect(orchestrator.analyzeEmail(email)).rejects.toThrow(
        'Local inference not available'
      )
    })

    it('should throw when local inference fails', async () => {
      const email = createEmail()
      const deps = createDeps({
        getThreadEmails: vi.fn().mockResolvedValue([email]),
      })
      orchestrator.setDependencies(deps)

      mockGetStatus.mockReturnValue('ready')
      mockLocalInference.mockRejectedValue(new Error('Inference failed'))

      await expect(orchestrator.analyzeEmail(email)).rejects.toThrow('Inference failed')
    })

    it('should throw when inference response parse fails', async () => {
      const email = createEmail()
      const deps = createDeps({
        getThreadEmails: vi.fn().mockResolvedValue([email]),
      })
      orchestrator.setDependencies(deps)

      mockGetStatus.mockReturnValue('ready')
      mockLocalInference.mockResolvedValue({ text: 'Not valid JSON' })

      await expect(orchestrator.analyzeEmail(email)).rejects.toThrow(
        'Failed to parse inference response'
      )
    })
  })

  describe('analyzeEmail - error handling', () => {
    it('should still return result when storeResult fails', async () => {
      const email = createEmail()
      const deps = createDeps({
        getThreadEmails: vi.fn().mockResolvedValue([email]),
        storeResult: vi.fn().mockRejectedValue(new Error('DB write failed')),
      })
      orchestrator.setDependencies(deps)

      mockGetStatus.mockReturnValue('ready')
      mockLocalInference.mockResolvedValue({ text: VALID_LLM_RESPONSE })

      const result = await orchestrator.analyzeEmail(email)

      expect(result.emailId).toBe('email-1')
      expect(result.priority).toBe('high')
    })
  })

  describe('analyzeBatch', () => {
    it('should analyze multiple emails', async () => {
      const emails = [
        createEmail({ id: 'e1' }),
        createEmail({ id: 'e2' }),
        createEmail({ id: 'e3' }),
      ]

      const deps = createDeps({
        getThreadEmails: vi.fn().mockResolvedValue([]),
      })
      orchestrator.setDependencies(deps)

      mockGetStatus.mockReturnValue('ready')
      mockLocalInference.mockResolvedValue({ text: VALID_LLM_RESPONSE })

      const results = await orchestrator.analyzeBatch(emails)

      expect(results).toHaveLength(3)
      expect(results[0].emailId).toBe('e1')
      expect(results[1].emailId).toBe('e2')
      expect(results[2].emailId).toBe('e3')
    })

    it('should track progress', async () => {
      const emails = [createEmail({ id: 'e1' }), createEmail({ id: 'e2' })]

      const deps = createDeps({
        getThreadEmails: vi.fn().mockResolvedValue([]),
      })
      orchestrator.setDependencies(deps)

      mockGetStatus.mockReturnValue('ready')
      mockLocalInference.mockResolvedValue({ text: VALID_LLM_RESPONSE })

      await orchestrator.analyzeBatch(emails)

      const progress = orchestrator.getProgress()
      expect(progress.total).toBe(2)
      expect(progress.completed).toBe(2)
      expect(progress.failed).toBe(0)
      expect(progress.inProgress).toBe(false)
    })

    it('should continue batch on individual failures', async () => {
      const emails = [createEmail({ id: 'e1' }), createEmail({ id: 'e2' })]

      const deps = createDeps({
        getThreadEmails: vi.fn().mockRejectedValueOnce(new Error('DB error')).mockResolvedValue([]),
      })
      orchestrator.setDependencies(deps)

      mockGetStatus.mockReturnValue('ready')
      mockLocalInference.mockResolvedValue({ text: VALID_LLM_RESPONSE })

      const results = await orchestrator.analyzeBatch(emails)

      expect(results).toHaveLength(1)
      expect(results[0].emailId).toBe('e2')

      const progress = orchestrator.getProgress()
      expect(progress.completed).toBe(1)
      expect(progress.failed).toBe(1)
    })

    it('should update health registry during batch', async () => {
      const { healthRegistry } = await import('@/services/sync/healthRegistry')

      const deps = createDeps({
        getThreadEmails: vi.fn().mockResolvedValue([]),
      })
      orchestrator.setDependencies(deps)

      mockGetStatus.mockReturnValue('ready')
      mockLocalInference.mockResolvedValue({ text: VALID_LLM_RESPONSE })

      await orchestrator.analyzeBatch([createEmail()])

      expect(healthRegistry.setAIHealth).toHaveBeenCalledWith(
        'degraded',
        expect.stringContaining('Analyzing')
      )
      expect(healthRegistry.setAIHealth).toHaveBeenCalledWith('healthy', 'Analysis complete')
    })
  })

  describe('getProgress', () => {
    it('should return initial progress', () => {
      const progress = orchestrator.getProgress()

      expect(progress.total).toBe(0)
      expect(progress.completed).toBe(0)
      expect(progress.failed).toBe(0)
      expect(progress.inProgress).toBe(false)
    })

    it('should return a copy (not mutable reference)', () => {
      const p1 = orchestrator.getProgress()
      const p2 = orchestrator.getProgress()
      expect(p1).not.toBe(p2)
      expect(p1).toEqual(p2)
    })
  })
})
