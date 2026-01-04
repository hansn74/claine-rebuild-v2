/**
 * Attachment Service Tests
 *
 * Story 2.8: Attachment Handling
 * Task 1.7: Write unit tests for attachment service
 *
 * Tests attachment fetching, caching, and download functionality.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AttachmentService } from '../attachmentService'
import { tokenStorageService } from '@/services/auth/tokenStorage'
import { gmailOAuthService } from '@/services/auth/gmailOAuth'
import { outlookOAuthService } from '@/services/auth/outlookOAuth'
import type { Attachment } from '@/services/database/schemas/email.schema'

// Mock dependencies
vi.mock('@/services/auth/tokenStorage')
vi.mock('@/services/auth/gmailOAuth')
vi.mock('@/services/auth/outlookOAuth')
vi.mock('@/services/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe('AttachmentService', () => {
  const mockAccountId = 'test-account-123'
  const mockEmailId = 'msg-456'
  const mockAttachmentId = 'att-789'

  const mockTokens = {
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
    token_type: 'Bearer',
    expires_in: 3600,
  }

  // Gmail returns base64url encoded data
  const mockGmailBase64Data = btoa('Hello, this is test file content')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')

  // Outlook returns standard base64 data
  const mockOutlookBase64Data = btoa('Hello, this is test file content')

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Reset singleton for clean tests
    AttachmentService.__resetForTesting()

    // Mock token storage
    vi.mocked(tokenStorageService.getTokens).mockResolvedValue(mockTokens)

    // Mock fetch globally
    globalThis.fetch = vi.fn()
  })

  afterEach(() => {
    // Clean up
    AttachmentService.__resetForTesting()
  })

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = AttachmentService.getInstance()
      const instance2 = AttachmentService.getInstance()
      expect(instance1).toBe(instance2)
    })
  })

  describe('fetchAttachment - Gmail', () => {
    beforeEach(() => {
      vi.mocked(globalThis.fetch).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            attachmentId: mockAttachmentId,
            size: 100,
            data: mockGmailBase64Data,
          }),
      } as Response)
    })

    it('should fetch attachment from Gmail API', async () => {
      const service = AttachmentService.getInstance()
      const blob = await service.fetchAttachment(
        mockAccountId,
        mockEmailId,
        mockAttachmentId,
        'gmail'
      )

      expect(blob).toBeInstanceOf(Blob)
      expect(fetch).toHaveBeenCalledWith(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${mockEmailId}/attachments/${mockAttachmentId}`,
        expect.objectContaining({
          headers: {
            Authorization: `Bearer ${mockTokens.access_token}`,
          },
        })
      )
    })

    it('should decode base64url data correctly', async () => {
      const service = AttachmentService.getInstance()
      const blob = await service.fetchAttachment(
        mockAccountId,
        mockEmailId,
        mockAttachmentId,
        'gmail'
      )

      // Verify blob was created with correct size
      // "Hello, this is test file content" is 32 chars
      expect(blob).toBeInstanceOf(Blob)
      expect(blob.size).toBe(32)
    })

    it('should return cached attachment on second request', async () => {
      const service = AttachmentService.getInstance()

      // First request
      await service.fetchAttachment(mockAccountId, mockEmailId, mockAttachmentId, 'gmail')

      // Second request
      await service.fetchAttachment(mockAccountId, mockEmailId, mockAttachmentId, 'gmail')

      // Should only call fetch once
      expect(fetch).toHaveBeenCalledTimes(1)
    })

    it('should throw error when no tokens available', async () => {
      vi.mocked(tokenStorageService.getTokens).mockResolvedValue(null)

      const service = AttachmentService.getInstance()

      await expect(
        service.fetchAttachment(mockAccountId, mockEmailId, mockAttachmentId, 'gmail')
      ).rejects.toThrow('No OAuth tokens found for account')
    })

    it('should refresh token on 401 error and retry', async () => {
      let callCount = 0
      vi.mocked(globalThis.fetch).mockImplementation(async () => {
        callCount++
        if (callCount === 1) {
          return {
            ok: false,
            status: 401,
            statusText: 'Unauthorized',
            json: () => Promise.resolve({ error: { message: 'Invalid credentials' } }),
          } as Response
        }
        return {
          ok: true,
          json: () =>
            Promise.resolve({
              attachmentId: mockAttachmentId,
              size: 100,
              data: mockGmailBase64Data,
            }),
        } as Response
      })

      vi.mocked(gmailOAuthService.refreshAccessToken).mockResolvedValue({
        ...mockTokens,
        access_token: 'new-access-token',
      })

      const service = AttachmentService.getInstance()
      const blob = await service.fetchAttachment(
        mockAccountId,
        mockEmailId,
        mockAttachmentId,
        'gmail'
      )

      expect(blob).toBeInstanceOf(Blob)
      expect(gmailOAuthService.refreshAccessToken).toHaveBeenCalledWith(mockTokens.refresh_token)
      expect(tokenStorageService.storeTokens).toHaveBeenCalled()
    })

    it('should throw authentication error when token refresh fails', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: () => Promise.resolve({ error: { message: 'Invalid credentials' } }),
      } as Response)

      vi.mocked(gmailOAuthService.refreshAccessToken).mockRejectedValue(new Error('Refresh failed'))

      const service = AttachmentService.getInstance()

      await expect(
        service.fetchAttachment(mockAccountId, mockEmailId, mockAttachmentId, 'gmail')
      ).rejects.toThrow('Authentication failed. Please re-authenticate.')
    })
  })

  describe('fetchAttachment - Outlook', () => {
    beforeEach(() => {
      vi.mocked(globalThis.fetch).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            '@odata.type': '#microsoft.graph.fileAttachment',
            id: mockAttachmentId,
            name: 'test.txt',
            contentType: 'text/plain',
            size: 100,
            contentBytes: mockOutlookBase64Data,
          }),
      } as Response)
    })

    it('should fetch attachment from Microsoft Graph API', async () => {
      const service = AttachmentService.getInstance()
      const blob = await service.fetchAttachment(
        mockAccountId,
        mockEmailId,
        mockAttachmentId,
        'outlook'
      )

      expect(blob).toBeInstanceOf(Blob)
      expect(fetch).toHaveBeenCalledWith(
        `https://graph.microsoft.com/v1.0/me/messages/${mockEmailId}/attachments/${mockAttachmentId}`,
        expect.objectContaining({
          headers: {
            Authorization: `Bearer ${mockTokens.access_token}`,
          },
        })
      )
    })

    it('should decode base64 data correctly', async () => {
      const service = AttachmentService.getInstance()
      const blob = await service.fetchAttachment(
        mockAccountId,
        mockEmailId,
        mockAttachmentId,
        'outlook'
      )

      // Verify blob was created with correct size
      // "Hello, this is test file content" is 32 chars
      expect(blob).toBeInstanceOf(Blob)
      expect(blob.size).toBe(32)
    })

    it('should refresh Outlook token on 401 error', async () => {
      let callCount = 0
      vi.mocked(globalThis.fetch).mockImplementation(async () => {
        callCount++
        if (callCount === 1) {
          return {
            ok: false,
            status: 401,
            statusText: 'Unauthorized',
            json: () => Promise.resolve({ error: { message: 'Invalid credentials' } }),
          } as Response
        }
        return {
          ok: true,
          json: () =>
            Promise.resolve({
              '@odata.type': '#microsoft.graph.fileAttachment',
              id: mockAttachmentId,
              name: 'test.txt',
              contentType: 'text/plain',
              size: 100,
              contentBytes: mockOutlookBase64Data,
            }),
        } as Response
      })

      vi.mocked(outlookOAuthService.refreshAccessToken).mockResolvedValue({
        ...mockTokens,
        access_token: 'new-access-token',
      })

      const service = AttachmentService.getInstance()
      const blob = await service.fetchAttachment(
        mockAccountId,
        mockEmailId,
        mockAttachmentId,
        'outlook'
      )

      expect(blob).toBeInstanceOf(Blob)
      expect(outlookOAuthService.refreshAccessToken).toHaveBeenCalledWith(mockTokens.refresh_token)
    })
  })

  describe('downloadBlob', () => {
    it('should create download link and trigger click', () => {
      const service = AttachmentService.getInstance()
      const blob = new Blob(['test content'], { type: 'text/plain' })

      // Mock URL and document APIs
      const mockUrl = 'blob:http://localhost/mock-url'
      const mockCreateObjectURL = vi.fn().mockReturnValue(mockUrl)
      const mockRevokeObjectURL = vi.fn()
      globalThis.URL.createObjectURL = mockCreateObjectURL
      globalThis.URL.revokeObjectURL = mockRevokeObjectURL

      const mockClick = vi.fn()
      const mockAppendChild = vi.fn()
      const mockRemoveChild = vi.fn()
      vi.spyOn(document, 'createElement').mockReturnValue({
        href: '',
        download: '',
        click: mockClick,
      } as unknown as HTMLAnchorElement)
      vi.spyOn(document.body, 'appendChild').mockImplementation(mockAppendChild)
      vi.spyOn(document.body, 'removeChild').mockImplementation(mockRemoveChild)

      service.downloadBlob(blob, 'test-file.txt')

      expect(mockCreateObjectURL).toHaveBeenCalledWith(blob)
      expect(mockClick).toHaveBeenCalled()
      expect(mockRevokeObjectURL).toHaveBeenCalledWith(mockUrl)
    })
  })

  describe('downloadAttachment', () => {
    const mockAttachment: Attachment = {
      id: mockAttachmentId,
      filename: 'document.pdf',
      mimeType: 'application/pdf',
      size: 1024,
      isInline: false,
    }

    beforeEach(() => {
      vi.mocked(globalThis.fetch).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            attachmentId: mockAttachmentId,
            size: 100,
            data: mockGmailBase64Data,
          }),
      } as Response)
    })

    it('should fetch and download attachment in one call', async () => {
      const service = AttachmentService.getInstance()

      // Mock download methods
      const downloadBlobSpy = vi.spyOn(service, 'downloadBlob').mockImplementation(() => {})

      await service.downloadAttachment(mockAccountId, mockEmailId, mockAttachment, 'gmail')

      expect(downloadBlobSpy).toHaveBeenCalledWith(expect.any(Blob), mockAttachment.filename)
    })
  })

  describe('caching', () => {
    beforeEach(() => {
      vi.mocked(globalThis.fetch).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            attachmentId: mockAttachmentId,
            size: 100,
            data: mockGmailBase64Data,
          }),
      } as Response)
    })

    it('should return cache statistics', () => {
      const service = AttachmentService.getInstance()
      const stats = service.getCacheStats()

      expect(stats).toHaveProperty('size')
      expect(stats).toHaveProperty('maxSize')
      expect(stats).toHaveProperty('ttlMs')
      expect(stats.size).toBe(0)
    })

    it('should clear cache', async () => {
      const service = AttachmentService.getInstance()

      // Add item to cache
      await service.fetchAttachment(mockAccountId, mockEmailId, mockAttachmentId, 'gmail')

      expect(service.getCacheStats().size).toBe(1)

      service.clearCache()

      expect(service.getCacheStats().size).toBe(0)
    })

    it('should evict oldest entry when cache is full', async () => {
      const service = AttachmentService.getInstance()

      // Mock fetch to return different data for different attachment IDs
      vi.mocked(globalThis.fetch).mockImplementation(
        async (url) =>
          ({
            ok: true,
            json: () =>
              Promise.resolve({
                attachmentId: String(url).split('/').pop(),
                size: 100,
                data: mockGmailBase64Data,
              }),
          }) as Response
      )

      // Fill cache beyond max size (100 entries)
      const promises = []
      for (let i = 0; i < 105; i++) {
        promises.push(service.fetchAttachment(mockAccountId, mockEmailId, `att-${i}`, 'gmail'))
      }
      await Promise.all(promises)

      // Cache should not exceed max size
      expect(service.getCacheStats().size).toBeLessThanOrEqual(100)
    })
  })

  describe('error handling', () => {
    it('should throw on API error', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: { message: 'Attachment not found' } }),
      } as Response)

      const service = AttachmentService.getInstance()

      await expect(
        service.fetchAttachment(mockAccountId, mockEmailId, mockAttachmentId, 'gmail')
      ).rejects.toThrow('Gmail API attachment fetch failed')
    })

    it('should handle JSON parse error gracefully', async () => {
      vi.mocked(globalThis.fetch).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.reject(new Error('Invalid JSON')),
      } as Response)

      const service = AttachmentService.getInstance()

      await expect(
        service.fetchAttachment(mockAccountId, mockEmailId, mockAttachmentId, 'gmail')
      ).rejects.toThrow('Gmail API attachment fetch failed: 500')
    })
  })
})
