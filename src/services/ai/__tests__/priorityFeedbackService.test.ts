/**
 * Priority Feedback Service Tests
 *
 * Story 3.6: Manual Priority Adjustment & Feedback Loop
 * Task 9: Tests for recordOverride, recordConfirmation, getSenderPatterns,
 *         getFeedbackCount, detectLearningInsights
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/services/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const mockEmailDoc = {
  toJSON: vi.fn(),
}
const mockInsert = vi.fn()
const mockFindOne = vi.fn()
const mockFind = vi.fn()

vi.mock('@/services/database/init', () => ({
  getDatabase: () => ({
    emails: {
      findOne: (...args: unknown[]) => ({ exec: () => mockFindOne(...args) }),
    },
    priorityFeedback: {
      insert: (...args: unknown[]) => mockInsert(...args),
      find: (...args: unknown[]) => ({ exec: () => mockFind(...args) }),
    },
  }),
}))

const mockSetEmailPriority = vi.fn()
vi.mock('../priorityOverride', () => ({
  setEmailPriority: (...args: unknown[]) => mockSetEmailPriority(...args),
}))

vi.mock('../priorityDisplay', () => ({
  getPriorityDisplay: (p: string) => ({ label: p, color: 'gray-500' }),
}))

vi.mock('@/store/feedbackToastStore', () => ({
  useFeedbackToastStore: {
    getState: () => ({
      showToast: vi.fn(),
    }),
  },
}))

// Must import after mocks
const { priorityFeedbackService } = await import('../priorityFeedbackService')

describe('PriorityFeedbackService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('recordOverride', () => {
    it('records override and applies setEmailPriority', async () => {
      mockFindOne.mockResolvedValue(mockEmailDoc)
      mockEmailDoc.toJSON.mockReturnValue({
        id: 'email-1',
        accountId: 'account-1',
        from: { email: 'sender@test.com' },
        aiMetadata: {
          priority: 'low',
          triageScore: 40,
          confidence: 60,
          modelVersion: 'test-model-v1',
        },
      })
      mockInsert.mockResolvedValue(undefined)
      mockSetEmailPriority.mockResolvedValue(undefined)
      mockFind.mockResolvedValue([]) // For detectLearningInsights

      await priorityFeedbackService.recordOverride('email-1', 'high')

      expect(mockInsert).toHaveBeenCalledTimes(1)
      const entry = mockInsert.mock.calls[0][0]
      expect(entry.emailId).toBe('email-1')
      expect(entry.newPriority).toBe('high')
      expect(entry.feedbackType).toBe('override')
      expect(entry.originalPriority).toBe('low')
      expect(entry.originalScore).toBe(40)

      expect(mockSetEmailPriority).toHaveBeenCalledWith('email-1', 'high')
    })

    it('handles email not found gracefully', async () => {
      mockFindOne.mockResolvedValue(null)

      await priorityFeedbackService.recordOverride('missing', 'high')

      expect(mockInsert).not.toHaveBeenCalled()
      expect(mockSetEmailPriority).not.toHaveBeenCalled()
    })

    it('captures null original when email has no aiMetadata', async () => {
      mockFindOne.mockResolvedValue(mockEmailDoc)
      mockEmailDoc.toJSON.mockReturnValue({
        id: 'email-2',
        accountId: 'account-1',
        from: { email: 'sender@test.com' },
      })
      mockInsert.mockResolvedValue(undefined)
      mockSetEmailPriority.mockResolvedValue(undefined)
      mockFind.mockResolvedValue([])

      await priorityFeedbackService.recordOverride('email-2', 'medium')

      const entry = mockInsert.mock.calls[0][0]
      expect(entry.originalPriority).toBeNull()
      expect(entry.originalScore).toBeNull()
      expect(entry.originalConfidence).toBeNull()
      expect(entry.originalModelVersion).toBeNull()
    })
  })

  describe('recordConfirmation', () => {
    it('records a confirmation entry', async () => {
      mockFindOne.mockResolvedValue(mockEmailDoc)
      mockEmailDoc.toJSON.mockReturnValue({
        id: 'email-1',
        accountId: 'account-1',
        from: { email: 'sender@test.com' },
        aiMetadata: {
          priority: 'high',
          triageScore: 85,
          confidence: 90,
          modelVersion: 'llm-v1',
        },
      })
      mockInsert.mockResolvedValue(undefined)

      await priorityFeedbackService.recordConfirmation('email-1')

      const entry = mockInsert.mock.calls[0][0]
      expect(entry.feedbackType).toBe('confirm')
      expect(entry.newPriority).toBe('high')
      expect(entry.originalPriority).toBe('high')
    })

    it('does nothing when no priority is set', async () => {
      mockFindOne.mockResolvedValue(mockEmailDoc)
      mockEmailDoc.toJSON.mockReturnValue({
        id: 'email-1',
        accountId: 'account-1',
        from: { email: 'sender@test.com' },
        aiMetadata: {},
      })

      await priorityFeedbackService.recordConfirmation('email-1')

      expect(mockInsert).not.toHaveBeenCalled()
    })
  })

  describe('getSenderPatterns', () => {
    it('returns null with fewer than 2 entries', async () => {
      mockFind.mockResolvedValue([{ newPriority: 'high' }])

      const result = await priorityFeedbackService.getSenderPatterns('sender@test.com', 'account-1')
      expect(result).toBeNull()
    })

    it('returns preferred priority from consistent overrides', async () => {
      mockFind.mockResolvedValue([
        { newPriority: 'high' },
        { newPriority: 'high' },
        { newPriority: 'low' },
      ])

      const result = await priorityFeedbackService.getSenderPatterns('sender@test.com', 'account-1')
      expect(result).not.toBeNull()
      expect(result!.preferredPriority).toBe('high')
      expect(result!.overrideCount).toBe(2)
      expect(result!.confidence).toBe(67) // 2/3
    })
  })

  describe('getFeedbackCount', () => {
    it('returns total count of feedback entries', async () => {
      mockFind.mockResolvedValue([{}, {}, {}])

      const count = await priorityFeedbackService.getFeedbackCount('account-1')
      expect(count).toBe(3)
    })
  })

  describe('detectLearningInsights', () => {
    it('returns empty array when no patterns', async () => {
      mockFind.mockResolvedValue([
        { senderEmail: 'a@test.com', newPriority: 'high', originalPriority: 'low' },
        { senderEmail: 'b@test.com', newPriority: 'low', originalPriority: 'high' },
      ])

      const insights = await priorityFeedbackService.detectLearningInsights('account-1')
      expect(insights).toEqual([])
    })

    it('detects sender pattern with 3+ overrides', async () => {
      mockFind.mockResolvedValue([
        { senderEmail: 'spammer@news.com', newPriority: 'none', originalPriority: 'medium' },
        { senderEmail: 'spammer@news.com', newPriority: 'none', originalPriority: 'medium' },
        { senderEmail: 'spammer@news.com', newPriority: 'none', originalPriority: 'low' },
      ])

      const insights = await priorityFeedbackService.detectLearningInsights('account-1')
      expect(insights).toHaveLength(1)
      expect(insights[0].type).toBe('sender_pattern')
      expect(insights[0].senderEmail).toBe('spammer@news.com')
      expect(insights[0].toPriority).toBe('none')
      expect(insights[0].count).toBe(3)
    })
  })
})
