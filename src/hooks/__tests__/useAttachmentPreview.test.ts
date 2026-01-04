/**
 * useAttachmentPreview Hook Tests
 *
 * Story 2.8: Attachment Handling
 * Task 5.2: Unit tests for useAttachmentPreview hook
 *
 * Tests the attachment preview hook for fetching and displaying inline images.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useAttachmentPreview, useAttachmentPreviews } from '../useAttachmentPreview'
import { attachmentService } from '@/services/email'

// Mock dependencies
vi.mock('@/services/email', () => ({
  attachmentService: {
    fetchAttachment: vi.fn(),
  },
}))

vi.mock('@/services/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe('useAttachmentPreview', () => {
  const mockAccountId = 'test-account-123'
  const mockEmailId = 'msg-456'
  const mockAttachmentId = 'att-789'
  const mockProvider = 'gmail' as const

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock URL.createObjectURL and revokeObjectURL
    globalThis.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url')
    globalThis.URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('should return loading state initially', () => {
    vi.mocked(attachmentService.fetchAttachment).mockImplementation(
      () => new Promise(() => {}) // Never resolves to keep loading state
    )

    const { result } = renderHook(() =>
      useAttachmentPreview(mockAccountId, mockEmailId, mockAttachmentId, mockProvider)
    )

    expect(result.current.isLoading).toBe(true)
    expect(result.current.previewUrl).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('should fetch attachment and return blob URL on success', async () => {
    const mockBlob = new Blob(['test image data'], { type: 'image/png' })
    vi.mocked(attachmentService.fetchAttachment).mockResolvedValue(mockBlob)

    const { result } = renderHook(() =>
      useAttachmentPreview(mockAccountId, mockEmailId, mockAttachmentId, mockProvider)
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.previewUrl).toBe('blob:mock-url')
    expect(result.current.error).toBeNull()
    expect(attachmentService.fetchAttachment).toHaveBeenCalledWith(
      mockAccountId,
      mockEmailId,
      mockAttachmentId,
      mockProvider
    )
  })

  it('should handle errors gracefully', async () => {
    const mockError = new Error('Failed to fetch attachment')
    vi.mocked(attachmentService.fetchAttachment).mockRejectedValue(mockError)

    const { result } = renderHook(() =>
      useAttachmentPreview(mockAccountId, mockEmailId, mockAttachmentId, mockProvider)
    )

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.previewUrl).toBeNull()
    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.error?.message).toBe('Failed to fetch attachment')
  })

  it('should not fetch when enabled is false', () => {
    const { result } = renderHook(() =>
      useAttachmentPreview(mockAccountId, mockEmailId, mockAttachmentId, mockProvider, false)
    )

    expect(result.current.isLoading).toBe(false)
    expect(result.current.previewUrl).toBeNull()
    expect(attachmentService.fetchAttachment).not.toHaveBeenCalled()
  })

  it('should not fetch when parameters are missing', () => {
    const { result } = renderHook(() =>
      useAttachmentPreview('', mockEmailId, mockAttachmentId, mockProvider)
    )

    expect(result.current.isLoading).toBe(false)
    expect(attachmentService.fetchAttachment).not.toHaveBeenCalled()
  })

  it('should strip outlook- prefix from emailId', async () => {
    const mockBlob = new Blob(['test'], { type: 'image/png' })
    vi.mocked(attachmentService.fetchAttachment).mockResolvedValue(mockBlob)

    renderHook(() =>
      useAttachmentPreview(mockAccountId, 'outlook-msg-456', mockAttachmentId, 'outlook')
    )

    await waitFor(() => {
      expect(attachmentService.fetchAttachment).toHaveBeenCalled()
    })

    expect(attachmentService.fetchAttachment).toHaveBeenCalledWith(
      mockAccountId,
      'msg-456', // prefix stripped
      mockAttachmentId,
      'outlook'
    )
  })

  it('should revoke blob URL on unmount', async () => {
    const mockBlob = new Blob(['test'], { type: 'image/png' })
    vi.mocked(attachmentService.fetchAttachment).mockResolvedValue(mockBlob)

    const { result, unmount } = renderHook(() =>
      useAttachmentPreview(mockAccountId, mockEmailId, mockAttachmentId, mockProvider)
    )

    await waitFor(() => {
      expect(result.current.previewUrl).toBe('blob:mock-url')
    })

    unmount()

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })
})

describe('useAttachmentPreviews', () => {
  const mockAccountId = 'test-account-123'
  const mockEmailId = 'msg-456'
  const mockAttachmentIds = ['att-1', 'att-2', 'att-3']
  const mockProvider = 'gmail' as const

  beforeEach(() => {
    vi.clearAllMocks()
    globalThis.URL.createObjectURL = vi.fn().mockImplementation((blob) => `blob:url-${blob.size}`)
    globalThis.URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('should return initial loading state for all attachments', () => {
    vi.mocked(attachmentService.fetchAttachment).mockImplementation(() => new Promise(() => {}))

    const { result } = renderHook(() =>
      useAttachmentPreviews(mockAccountId, mockEmailId, mockAttachmentIds, mockProvider)
    )

    expect(result.current['att-1'].isLoading).toBe(true)
    expect(result.current['att-2'].isLoading).toBe(true)
    expect(result.current['att-3'].isLoading).toBe(true)
  })

  it('should fetch all attachments concurrently', async () => {
    vi.mocked(attachmentService.fetchAttachment).mockImplementation(async (_acc, _email, attId) => {
      return new Blob([`data-${attId}`], { type: 'image/png' })
    })

    const { result } = renderHook(() =>
      useAttachmentPreviews(mockAccountId, mockEmailId, mockAttachmentIds, mockProvider)
    )

    await waitFor(() => {
      expect(result.current['att-1'].isLoading).toBe(false)
      expect(result.current['att-2'].isLoading).toBe(false)
      expect(result.current['att-3'].isLoading).toBe(false)
    })

    expect(result.current['att-1'].url).toBeTruthy()
    expect(result.current['att-2'].url).toBeTruthy()
    expect(result.current['att-3'].url).toBeTruthy()
    expect(result.current['att-1'].error).toBeNull()
  })

  it('should handle partial failures', async () => {
    vi.mocked(attachmentService.fetchAttachment).mockImplementation(async (_acc, _email, attId) => {
      if (attId === 'att-2') {
        throw new Error('Failed to fetch att-2')
      }
      return new Blob([`data-${attId}`], { type: 'image/png' })
    })

    const { result } = renderHook(() =>
      useAttachmentPreviews(mockAccountId, mockEmailId, mockAttachmentIds, mockProvider)
    )

    await waitFor(() => {
      expect(result.current['att-1'].isLoading).toBe(false)
      expect(result.current['att-2'].isLoading).toBe(false)
      expect(result.current['att-3'].isLoading).toBe(false)
    })

    // att-1 and att-3 should succeed
    expect(result.current['att-1'].url).toBeTruthy()
    expect(result.current['att-3'].url).toBeTruthy()
    expect(result.current['att-1'].error).toBeNull()

    // att-2 should fail
    expect(result.current['att-2'].url).toBeNull()
    expect(result.current['att-2'].error).toBeInstanceOf(Error)
  })

  it('should not fetch when no attachment IDs provided', () => {
    const { result } = renderHook(() =>
      useAttachmentPreviews(mockAccountId, mockEmailId, [], mockProvider)
    )

    expect(Object.keys(result.current)).toHaveLength(0)
    expect(attachmentService.fetchAttachment).not.toHaveBeenCalled()
  })

  it('should revoke all blob URLs on unmount', async () => {
    let urlCounter = 0
    globalThis.URL.createObjectURL = vi.fn().mockImplementation(() => `blob:url-${++urlCounter}`)

    vi.mocked(attachmentService.fetchAttachment).mockImplementation(async () => {
      return new Blob(['data'], { type: 'image/png' })
    })

    const { result, unmount } = renderHook(() =>
      useAttachmentPreviews(mockAccountId, mockEmailId, mockAttachmentIds, mockProvider)
    )

    await waitFor(() => {
      expect(result.current['att-1'].isLoading).toBe(false)
    })

    unmount()

    // Should revoke all created URLs
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(3)
  })
})
