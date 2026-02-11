/**
 * Sender Scoring Tests
 *
 * Story 3.2: Email Analysis Engine
 * Task 2: Sender relationship scoring tests
 */

import { describe, it, expect, vi } from 'vitest'
import { calculateSenderScore, createDefaultSenderScore } from '../senderScoring'
import type { SenderStats } from '../senderScoring'

vi.mock('@/services/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

describe('calculateSenderScore', () => {
  it('should classify frequent sender (>10 emails)', () => {
    const stats: SenderStats = {
      receivedCount: 15,
      repliedCount: 10,
      lastEmailAt: Date.now() - 1000 * 60 * 60, // 1 hour ago
      isAutomated: false,
    }

    const score = calculateSenderScore('alice@example.com', stats)

    expect(score.category).toBe('frequent')
    expect(score.frequency).toBe(15)
    expect(score.relationshipScore).toBeGreaterThan(70)
    expect(score.contextSummary).toContain('Frequent contact')
  })

  it('should classify regular sender (3-10 emails)', () => {
    const stats: SenderStats = {
      receivedCount: 5,
      repliedCount: 2,
      lastEmailAt: Date.now() - 1000 * 60 * 60 * 24, // 1 day ago
      isAutomated: false,
    }

    const score = calculateSenderScore('bob@example.com', stats)

    expect(score.category).toBe('regular')
    expect(score.relationshipScore).toBeGreaterThanOrEqual(50)
    expect(score.relationshipScore).toBeLessThan(90)
  })

  it('should classify occasional sender (1-2 emails)', () => {
    const stats: SenderStats = {
      receivedCount: 2,
      repliedCount: 1,
      lastEmailAt: Date.now() - 1000 * 60 * 60 * 24 * 7, // 1 week ago
      isAutomated: false,
    }

    const score = calculateSenderScore('charlie@example.com', stats)

    expect(score.category).toBe('occasional')
  })

  it('should classify automated sender', () => {
    const stats: SenderStats = {
      receivedCount: 100,
      repliedCount: 0,
      lastEmailAt: Date.now(),
      isAutomated: true,
    }

    const score = calculateSenderScore('noreply@service.com', stats)

    expect(score.category).toBe('automated')
    expect(score.relationshipScore).toBe(5)
    expect(score.contextSummary).toContain('Automated')
  })

  it('should boost score for high response rate', () => {
    const lowReply: SenderStats = {
      receivedCount: 10,
      repliedCount: 1,
      lastEmailAt: Date.now(),
      isAutomated: false,
    }

    const highReply: SenderStats = {
      receivedCount: 10,
      repliedCount: 9,
      lastEmailAt: Date.now(),
      isAutomated: false,
    }

    const lowScore = calculateSenderScore('a@b.com', lowReply)
    const highScore = calculateSenderScore('a@b.com', highReply)

    expect(highScore.relationshipScore).toBeGreaterThan(lowScore.relationshipScore)
  })

  it('should penalize old last email', () => {
    const recent: SenderStats = {
      receivedCount: 5,
      repliedCount: 2,
      lastEmailAt: Date.now(),
      isAutomated: false,
    }

    const old: SenderStats = {
      receivedCount: 5,
      repliedCount: 2,
      lastEmailAt: Date.now() - 1000 * 60 * 60 * 24 * 100, // 100 days ago
      isAutomated: false,
    }

    const recentScore = calculateSenderScore('a@b.com', recent)
    const oldScore = calculateSenderScore('a@b.com', old)

    expect(recentScore.relationshipScore).toBeGreaterThan(oldScore.relationshipScore)
  })

  it('should extract domain from email', () => {
    const stats: SenderStats = {
      receivedCount: 5,
      repliedCount: 2,
      lastEmailAt: Date.now(),
      isAutomated: false,
    }

    const score = calculateSenderScore('alice@company.co.uk', stats)

    expect(score.domain).toBe('company.co.uk')
  })

  it('should include response rate in context', () => {
    const stats: SenderStats = {
      receivedCount: 10,
      repliedCount: 8,
      lastEmailAt: Date.now(),
      isAutomated: false,
    }

    const score = calculateSenderScore('alice@example.com', stats)

    expect(score.contextSummary).toContain('reply to 80%')
  })

  it('should cap response rate at 1', () => {
    const stats: SenderStats = {
      receivedCount: 5,
      repliedCount: 10, // More replies than received (e.g., multiple replies per email)
      lastEmailAt: Date.now(),
      isAutomated: false,
    }

    const score = calculateSenderScore('alice@example.com', stats)

    expect(score.responseRate).toBeLessThanOrEqual(1)
  })
})

describe('createDefaultSenderScore', () => {
  it('should create first-time sender score', () => {
    const score = createDefaultSenderScore('unknown@example.com')

    expect(score.category).toBe('first-time')
    expect(score.frequency).toBe(0)
    expect(score.responseRate).toBe(0)
    expect(score.relationshipScore).toBe(30)
    expect(score.contextSummary).toContain('First-time')
    expect(score.domain).toBe('example.com')
  })
})
