/**
 * Analysis Result Store Tests
 *
 * Story 3.2: Email Analysis Engine
 * Task 5: RxDB result caching tests (AC: 6)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  storeAnalysisResult,
  storeAnalysisResultsBatch,
  getSenderStats,
  getThreadEmails,
  needsAnalysis,
  createAnalysisDependencies,
} from '../analysisResultStore'
import type { AnalysisResult } from '../analysisOrchestrator'
import type { EmailDocument } from '@/services/database/schemas/email.schema'

vi.mock('@/services/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const mockPatch = vi.fn().mockResolvedValue(undefined)
const mockFindOneExec = vi.fn()
const mockFindExec = vi.fn()

vi.mock('@/services/database/init', () => ({
  getDatabase: () => ({
    emails: {
      findOne: (id: string) => ({
        exec: () => mockFindOneExec(id),
      }),
      find: (query: unknown) => ({
        exec: () => mockFindExec(query),
      }),
    },
  }),
}))

function createResult(overrides?: Partial<AnalysisResult>): AnalysisResult {
  return {
    emailId: 'email-1',
    triageScore: 75,
    priority: 'medium',
    confidence: 70,
    reasoning: 'Project update from frequent contact',
    signals: ['request'],
    modelVersion: 'test-v1',
    processedAt: Date.now(),
    provider: 'local',
    ...overrides,
  }
}

function createEmailDoc(overrides?: Partial<EmailDocument>): EmailDocument {
  return {
    id: 'email-1',
    threadId: 'thread-1',
    from: { name: 'Alice', email: 'alice@example.com' },
    to: [{ name: 'Bob', email: 'bob@company.com' }],
    subject: 'Test',
    body: { text: 'Test body' },
    timestamp: Date.now(),
    accountId: 'account-1',
    attachments: [],
    snippet: 'Test body',
    labels: [],
    folder: 'inbox',
    read: false,
    starred: false,
    importance: 'normal' as const,
    attributes: {},
    ...overrides,
  }
}

describe('storeAnalysisResult', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('should store result in email aiMetadata field', async () => {
    const doc = { patch: mockPatch }
    mockFindOneExec.mockResolvedValue(doc)

    const result = createResult()
    await storeAnalysisResult('email-1', result)

    expect(mockFindOneExec).toHaveBeenCalledWith('email-1')
    expect(mockPatch).toHaveBeenCalledWith({
      aiMetadata: {
        triageScore: 75,
        priority: 'medium',
        suggestedAttributes: {},
        confidence: 70,
        reasoning: 'Project update from frequent contact',
        modelVersion: 'test-v1',
        processedAt: result.processedAt,
      },
    })
  })

  it('should handle email not found gracefully', async () => {
    mockFindOneExec.mockResolvedValue(null)

    await storeAnalysisResult('nonexistent', createResult())

    expect(mockPatch).not.toHaveBeenCalled()
  })
})

describe('storeAnalysisResultsBatch', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('should store multiple results', async () => {
    const doc = { patch: mockPatch }
    mockFindOneExec.mockResolvedValue(doc)

    const results = [
      createResult({ emailId: 'e1' }),
      createResult({ emailId: 'e2' }),
      createResult({ emailId: 'e3' }),
    ]

    const { stored, failed } = await storeAnalysisResultsBatch(results)

    expect(stored).toBe(3)
    expect(failed).toBe(0)
  })

  it('should count failures without stopping batch', async () => {
    mockFindOneExec
      .mockResolvedValueOnce({ patch: mockPatch })
      .mockRejectedValueOnce(new Error('DB error'))
      .mockResolvedValueOnce({ patch: mockPatch })

    const results = [
      createResult({ emailId: 'e1' }),
      createResult({ emailId: 'e2' }),
      createResult({ emailId: 'e3' }),
    ]

    const { stored, failed } = await storeAnalysisResultsBatch(results)

    expect(stored).toBe(2)
    expect(failed).toBe(1)
  })
})

describe('getSenderStats', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('should return null when no emails from sender', async () => {
    mockFindExec.mockResolvedValue([])

    const stats = await getSenderStats('unknown@example.com', 'account-1')

    expect(stats).toBeNull()
  })

  it('should calculate sender stats', async () => {
    const now = Date.now()
    const receivedEmails = [
      { threadId: 'thread-1', timestamp: now - 1000 },
      { threadId: 'thread-2', timestamp: now - 2000 },
      { threadId: 'thread-3', timestamp: now },
    ]
    const sentEmails = [{ threadId: 'thread-1' }, { threadId: 'thread-3' }]

    mockFindExec
      .mockResolvedValueOnce(receivedEmails) // received from sender
      .mockResolvedValueOnce(sentEmails) // user's sent replies

    const stats = await getSenderStats('alice@example.com', 'account-1')

    expect(stats).not.toBeNull()
    expect(stats!.receivedCount).toBe(3)
    expect(stats!.repliedCount).toBe(2) // threads 1 and 3 have replies
    expect(stats!.lastEmailAt).toBe(now)
    expect(stats!.isAutomated).toBe(false)
  })

  it('should detect automated senders', async () => {
    mockFindExec
      .mockResolvedValueOnce([{ threadId: 't1', timestamp: Date.now() }])
      .mockResolvedValueOnce([])

    const stats = await getSenderStats('noreply@service.com', 'account-1')

    expect(stats!.isAutomated).toBe(true)
  })
})

describe('getThreadEmails', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('should return emails sorted by timestamp', async () => {
    const docs = [
      { toJSON: () => createEmailDoc({ id: 'e1', timestamp: 1000 }) },
      { toJSON: () => createEmailDoc({ id: 'e2', timestamp: 2000 }) },
    ]
    mockFindExec.mockResolvedValue(docs)

    const emails = await getThreadEmails('thread-1')

    expect(emails).toHaveLength(2)
    expect(emails[0].id).toBe('e1')
    expect(emails[1].id).toBe('e2')
  })

  it('should return empty array for unknown thread', async () => {
    mockFindExec.mockResolvedValue([])

    const emails = await getThreadEmails('nonexistent')

    expect(emails).toEqual([])
  })
})

describe('needsAnalysis', () => {
  it('should return true when no aiMetadata', () => {
    const email = createEmailDoc()
    expect(needsAnalysis(email)).toBe(true)
  })

  it('should return true when aiMetadata is stale', () => {
    const email = createEmailDoc({
      aiMetadata: {
        triageScore: 50,
        priority: 'medium',
        suggestedAttributes: {},
        confidence: 70,
        reasoning: 'test',
        modelVersion: 'v1',
        processedAt: Date.now() - 48 * 60 * 60 * 1000, // 48 hours ago
      },
    })

    expect(needsAnalysis(email)).toBe(true)
  })

  it('should return false when aiMetadata is recent', () => {
    const email = createEmailDoc({
      aiMetadata: {
        triageScore: 50,
        priority: 'medium',
        suggestedAttributes: {},
        confidence: 70,
        reasoning: 'test',
        modelVersion: 'v1',
        processedAt: Date.now() - 1000, // 1 second ago
      },
    })

    expect(needsAnalysis(email)).toBe(false)
  })

  it('should respect custom maxAgeMs', () => {
    const email = createEmailDoc({
      aiMetadata: {
        triageScore: 50,
        priority: 'medium',
        suggestedAttributes: {},
        confidence: 70,
        reasoning: 'test',
        modelVersion: 'v1',
        processedAt: Date.now() - 10 * 60 * 1000, // 10 min ago
      },
    })

    // 5 minutes max age → stale
    expect(needsAnalysis(email, 5 * 60 * 1000)).toBe(true)
    // 1 hour max age → still fresh
    expect(needsAnalysis(email, 60 * 60 * 1000)).toBe(false)
  })
})

describe('createAnalysisDependencies', () => {
  it('should create dependencies object with all required methods', () => {
    const deps = createAnalysisDependencies()

    expect(typeof deps.getSenderStats).toBe('function')
    expect(typeof deps.getThreadEmails).toBe('function')
    expect(typeof deps.storeResult).toBe('function')
  })
})
