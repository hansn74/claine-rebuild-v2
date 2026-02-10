/**
 * Priority Override Tests
 *
 * Story 3.3: Priority Scoring Model
 * Task 9: priorityOverride tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setEmailPriority, clearPriorityOverride, priorityToScore } from '../priorityOverride'
import { USER_OVERRIDE_MODEL_VERSION } from '../priorityDisplay'

vi.mock('@/services/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const mockPatch = vi.fn().mockResolvedValue(undefined)
const mockFindOneExec = vi.fn()

vi.mock('@/services/database/init', () => ({
  getDatabase: () => ({
    emails: {
      findOne: (id: string) => ({
        exec: () => mockFindOneExec(id),
      }),
    },
  }),
}))

describe('priorityToScore', () => {
  it('maps high to 90', () => {
    expect(priorityToScore('high')).toBe(90)
  })

  it('maps medium to 70', () => {
    expect(priorityToScore('medium')).toBe(70)
  })

  it('maps low to 50', () => {
    expect(priorityToScore('low')).toBe(50)
  })

  it('maps none to 20', () => {
    expect(priorityToScore('none')).toBe(20)
  })
})

describe('setEmailPriority', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockPatch.mockResolvedValue(undefined)
  })

  it('patches email with user override metadata', async () => {
    mockFindOneExec.mockResolvedValue({ patch: mockPatch })

    await setEmailPriority('email-1', 'high')

    expect(mockPatch).toHaveBeenCalledWith({
      aiMetadata: expect.objectContaining({
        triageScore: 90,
        priority: 'high',
        confidence: 100,
        reasoning: 'Manually set by user',
        modelVersion: USER_OVERRIDE_MODEL_VERSION,
      }),
    })
  })

  it('does nothing when email not found', async () => {
    mockFindOneExec.mockResolvedValue(null)

    await setEmailPriority('nonexistent', 'medium')

    expect(mockPatch).not.toHaveBeenCalled()
  })

  it('sets correct score for each priority level', async () => {
    const priorities = ['high', 'medium', 'low', 'none'] as const
    const expectedScores = [90, 70, 50, 20]

    for (let i = 0; i < priorities.length; i++) {
      mockPatch.mockClear()
      mockFindOneExec.mockResolvedValue({ patch: mockPatch })

      await setEmailPriority(`email-${i}`, priorities[i])

      expect(mockPatch).toHaveBeenCalledWith(
        expect.objectContaining({
          aiMetadata: expect.objectContaining({
            triageScore: expectedScores[i],
            priority: priorities[i],
          }),
        })
      )
    }
  })
})

describe('clearPriorityOverride', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockPatch.mockResolvedValue(undefined)
  })

  it('removes aiMetadata from email', async () => {
    mockFindOneExec.mockResolvedValue({ patch: mockPatch })

    await clearPriorityOverride('email-1')

    expect(mockPatch).toHaveBeenCalledWith({
      aiMetadata: undefined,
    })
  })

  it('does nothing when email not found', async () => {
    mockFindOneExec.mockResolvedValue(null)

    await clearPriorityOverride('nonexistent')

    expect(mockPatch).not.toHaveBeenCalled()
  })
})
