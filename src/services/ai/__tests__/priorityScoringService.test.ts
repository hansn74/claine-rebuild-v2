/**
 * Priority Scoring Service Tests
 *
 * Story 3.3: Priority Scoring Model
 * Task 9: priorityScoringService tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PriorityScoringService } from '../priorityScoringService'
import { USER_OVERRIDE_MODEL_VERSION } from '../priorityDisplay'
import type { EmailDocument } from '@/services/database/schemas/email.schema'

vi.mock('@/services/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const mockAnalyzeEmail = vi.fn()

vi.mock('../analysisOrchestrator', () => ({
  analysisOrchestrator: {
    analyzeEmail: (...args: unknown[]) => mockAnalyzeEmail(...args),
  },
}))

vi.mock('../analysisResultStore', () => ({
  needsAnalysis: (email: EmailDocument) => !email.aiMetadata,
}))

function createEmail(overrides: Partial<EmailDocument> = {}): EmailDocument {
  return {
    id: `email-${Math.random().toString(36).slice(2, 8)}`,
    accountId: 'account-1',
    threadId: 'thread-1',
    subject: 'Test Subject',
    from: { name: 'Sender', email: 'sender@test.com' },
    to: [{ name: 'Recipient', email: 'recipient@test.com' }],
    timestamp: Date.now(),
    read: false,
    starred: false,
    labels: ['INBOX'],
    folder: 'INBOX',
    snippet: 'Test snippet',
    body: { text: 'Body' },
    attachments: [],
    importance: 'normal' as const,
    attributes: {},
    ...overrides,
  }
}

describe('PriorityScoringService', () => {
  let service: PriorityScoringService

  beforeEach(() => {
    vi.resetAllMocks()
    PriorityScoringService.__resetForTesting()
    service = PriorityScoringService.getInstance()
    mockAnalyzeEmail.mockResolvedValue({
      emailId: 'email-1',
      triageScore: 75,
      priority: 'medium',
      confidence: 70,
      reasoning: 'Test',
      signals: [],
      modelVersion: 'test-v1',
      processedAt: Date.now(),
      provider: 'local',
    })
  })

  describe('singleton', () => {
    it('returns the same instance', () => {
      const a = PriorityScoringService.getInstance()
      const b = PriorityScoringService.getInstance()
      expect(a).toBe(b)
    })

    it('resets for testing', () => {
      const a = PriorityScoringService.getInstance()
      PriorityScoringService.__resetForTesting()
      const b = PriorityScoringService.getInstance()
      expect(a).not.toBe(b)
    })
  })

  describe('scoreEmail', () => {
    it('scores an unscored email', async () => {
      const email = createEmail()
      const result = await service.scoreEmail(email)
      expect(result).toBe(true)
      expect(mockAnalyzeEmail).toHaveBeenCalledWith(email)
    })

    it('skips user-overridden emails', async () => {
      const email = createEmail({
        aiMetadata: {
          triageScore: 90,
          priority: 'high',
          suggestedAttributes: {},
          confidence: 100,
          reasoning: 'Manual',
          modelVersion: USER_OVERRIDE_MODEL_VERSION,
          processedAt: Date.now(),
        },
      })
      const result = await service.scoreEmail(email)
      expect(result).toBe(false)
      expect(mockAnalyzeEmail).not.toHaveBeenCalled()
    })

    it('skips recently scored emails', async () => {
      const email = createEmail({
        aiMetadata: {
          triageScore: 75,
          priority: 'medium',
          suggestedAttributes: {},
          confidence: 70,
          reasoning: 'AI scored',
          modelVersion: 'test-model-v1',
          processedAt: Date.now(),
        },
      })
      const result = await service.scoreEmail(email)
      expect(result).toBe(false)
      expect(mockAnalyzeEmail).not.toHaveBeenCalled()
    })

    it('returns false on analysis error', async () => {
      mockAnalyzeEmail.mockRejectedValueOnce(new Error('Analysis failed'))
      const email = createEmail()
      const result = await service.scoreEmail(email)
      expect(result).toBe(false)
    })
  })

  describe('scoreBatch', () => {
    it('scores multiple unscored emails', async () => {
      const emails = [createEmail(), createEmail(), createEmail()]
      const result = await service.scoreBatch(emails)
      expect(result.scored).toBe(3)
      expect(result.skipped).toBe(0)
      expect(mockAnalyzeEmail).toHaveBeenCalledTimes(3)
    })

    it('skips already-scored and user-overridden emails', async () => {
      const emails = [
        createEmail(),
        createEmail({
          aiMetadata: {
            triageScore: 90,
            priority: 'high',
            suggestedAttributes: {},
            confidence: 100,
            reasoning: 'Manual',
            modelVersion: USER_OVERRIDE_MODEL_VERSION,
            processedAt: Date.now(),
          },
        }),
        createEmail({
          aiMetadata: {
            triageScore: 50,
            priority: 'low',
            suggestedAttributes: {},
            confidence: 70,
            reasoning: 'AI',
            modelVersion: 'test-model-v1',
            processedAt: Date.now(),
          },
        }),
      ]
      const result = await service.scoreBatch(emails)
      expect(result.scored).toBe(1)
      expect(result.skipped).toBe(2)
    })

    it('respects concurrency option', async () => {
      let concurrentCalls = 0
      let maxConcurrent = 0

      mockAnalyzeEmail.mockImplementation(async () => {
        concurrentCalls++
        maxConcurrent = Math.max(maxConcurrent, concurrentCalls)
        await new Promise((r) => setTimeout(r, 10))
        concurrentCalls--
        return {
          emailId: 'e',
          triageScore: 75,
          priority: 'medium',
          confidence: 70,
          reasoning: 'Test',
          signals: [],
          modelVersion: 'test-v1',
          processedAt: Date.now(),
          provider: 'local',
        }
      })

      const emails = Array.from({ length: 6 }, () => createEmail())
      await service.scoreBatch(emails, { concurrency: 2 })
      expect(maxConcurrent).toBeLessThanOrEqual(2)
    })

    it('handles individual analysis failures in batch', async () => {
      mockAnalyzeEmail
        .mockResolvedValueOnce({ emailId: 'e1' })
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce({ emailId: 'e3' })

      const emails = [createEmail(), createEmail(), createEmail()]
      const result = await service.scoreBatch(emails)
      expect(result.scored).toBe(2)
      expect(result.skipped).toBe(1)
    })

    it('returns zero counts for empty array', async () => {
      const result = await service.scoreBatch([])
      expect(result.scored).toBe(0)
      expect(result.skipped).toBe(0)
      expect(mockAnalyzeEmail).not.toHaveBeenCalled()
    })
  })
})
