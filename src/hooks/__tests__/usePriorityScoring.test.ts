/**
 * usePriorityScoring Hook Tests
 *
 * Story 3.3: Priority Scoring Model
 * Task 9: Auto-scoring hook tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { usePriorityScoring } from '../usePriorityScoring'
import type { EmailDocument } from '@/services/database/schemas/email.schema'

vi.mock('@/services/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const mockScoreBatch = vi.fn()
vi.mock('@/services/ai/priorityScoringService', () => ({
  priorityScoringService: {
    scoreBatch: (...args: unknown[]) => mockScoreBatch(...args),
  },
}))

const mockEmails: Partial<EmailDocument>[] = [
  { id: 'email-1', accountId: 'acc-1', folder: 'INBOX', timestamp: 1000 },
  { id: 'email-2', accountId: 'acc-1', folder: 'INBOX', timestamp: 900 },
]

const mockExec = vi.fn()
vi.mock('@/services/database/init', () => ({
  getDatabase: () => ({
    emails: {
      find: () => ({
        exec: () => mockExec(),
      }),
    },
  }),
}))

let mockSelectedFolder = 'INBOX'
vi.mock('@/store/folderStore', () => ({
  useFolderStore: (selector: (state: { selectedFolder: string }) => unknown) =>
    selector({ selectedFolder: mockSelectedFolder }),
}))

function createMockDocs(emails: Partial<EmailDocument>[]) {
  return emails.map((e) => ({
    toJSON: () => e,
  }))
}

describe('usePriorityScoring', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mockSelectedFolder = 'INBOX'
    mockExec.mockResolvedValue(createMockDocs(mockEmails))
    mockScoreBatch.mockResolvedValue({ scored: 2, skipped: 0 })
  })

  it('scores emails when enabled with valid accountId', async () => {
    renderHook(() => usePriorityScoring({ enabled: true, accountId: 'acc-1' }))

    // Wait for the async effect to complete
    await vi.waitFor(() => {
      expect(mockScoreBatch).toHaveBeenCalled()
    })
  })

  it('does not score when disabled', async () => {
    renderHook(() => usePriorityScoring({ enabled: false, accountId: 'acc-1' }))

    // Give time for any async to happen
    await new Promise((r) => setTimeout(r, 50))
    expect(mockScoreBatch).not.toHaveBeenCalled()
  })

  it('does not score when accountId is null', async () => {
    renderHook(() => usePriorityScoring({ enabled: true, accountId: null }))

    await new Promise((r) => setTimeout(r, 50))
    expect(mockScoreBatch).not.toHaveBeenCalled()
  })

  it('does not score when accountId is undefined', async () => {
    renderHook(() => usePriorityScoring({ enabled: true, accountId: undefined }))

    await new Promise((r) => setTimeout(r, 50))
    expect(mockScoreBatch).not.toHaveBeenCalled()
  })

  it('re-triggers on folder change', async () => {
    const { rerender } = renderHook(
      ({ enabled, accountId }) => usePriorityScoring({ enabled, accountId }),
      { initialProps: { enabled: true, accountId: 'acc-1' } }
    )

    await vi.waitFor(() => {
      expect(mockScoreBatch).toHaveBeenCalledTimes(1)
    })

    // Change folder
    mockSelectedFolder = 'sent'
    mockExec.mockResolvedValue(
      createMockDocs([{ id: 'email-3', accountId: 'acc-1', folder: 'sent', timestamp: 800 }])
    )

    rerender({ enabled: true, accountId: 'acc-1' })

    await vi.waitFor(() => {
      expect(mockScoreBatch).toHaveBeenCalledTimes(2)
    })
  })

  it('deduplicates scoring for the same email set', async () => {
    const { rerender } = renderHook(
      ({ enabled, accountId }) => usePriorityScoring({ enabled, accountId }),
      { initialProps: { enabled: true, accountId: 'acc-1' } }
    )

    await vi.waitFor(() => {
      expect(mockScoreBatch).toHaveBeenCalledTimes(1)
    })

    // Rerender with same props — same email set returned
    rerender({ enabled: true, accountId: 'acc-1' })

    // Should not trigger a second scoreBatch since email set is identical
    await new Promise((r) => setTimeout(r, 50))
    expect(mockScoreBatch).toHaveBeenCalledTimes(1)
  })

  it('catches and logs errors without crashing', async () => {
    mockExec.mockRejectedValue(new Error('DB error'))

    // Should not throw
    renderHook(() => usePriorityScoring({ enabled: true, accountId: 'acc-1' }))

    await new Promise((r) => setTimeout(r, 50))
    // No crash — test passes if we get here
  })

  it('handles empty email results without calling scoreBatch', async () => {
    mockExec.mockResolvedValue([])

    renderHook(() => usePriorityScoring({ enabled: true, accountId: 'acc-1' }))

    // With empty results, the set key is empty string (same as initial ref),
    // so scoring is deduplicated — scoreBatch should not be called
    await new Promise((r) => setTimeout(r, 50))
    expect(mockScoreBatch).not.toHaveBeenCalled()
  })
})
