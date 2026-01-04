/**
 * Label Service Tests
 *
 * Story 2.9: Email Folders & Labels
 * Task 6.1: Unit tests for labelService (Gmail and Outlook)
 *
 * Tests label/folder fetching for Gmail and Outlook.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { LabelService, labelService } from '../labelService'
import { tokenStorageService } from '@/services/auth/tokenStorage'
import { gmailOAuthService } from '@/services/auth/gmailOAuth'

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

describe('LabelService', () => {
  const mockAccountId = 'test-account-123'

  const mockTokens = {
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
    token_type: 'Bearer',
    expires_in: 3600,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    LabelService.__resetForTesting()
    vi.mocked(tokenStorageService.getTokens).mockResolvedValue(mockTokens)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Gmail Labels', () => {
    it('fetches Gmail labels successfully', async () => {
      const mockLabels = {
        labels: [
          {
            id: 'Label_1',
            name: 'Work',
            type: 'user',
            labelListVisibility: 'labelShow',
            messagesUnread: 5,
            color: { backgroundColor: '#ff0000', textColor: '#ffffff' },
          },
          {
            id: 'Label_2',
            name: 'Personal',
            type: 'user',
            labelListVisibility: 'labelShow',
            messagesUnread: 3,
          },
          // System labels should be filtered out
          {
            id: 'INBOX',
            name: 'INBOX',
            type: 'system',
          },
          {
            id: 'SENT',
            name: 'SENT',
            type: 'system',
          },
        ],
      }

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockLabels),
      } as unknown as Response)

      const result = await labelService.fetchGmailLabels(mockAccountId)

      expect(fetch).toHaveBeenCalledWith(
        'https://gmail.googleapis.com/gmail/v1/users/me/labels',
        expect.objectContaining({
          headers: { Authorization: 'Bearer mock-access-token' },
        })
      )

      // Should only return user labels, not system labels
      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('Personal')
      expect(result[1].name).toBe('Work')
      expect(result[1].color).toBe('#ff0000')
      expect(result[1].unreadCount).toBe(5)
    })

    it('filters out hidden labels', async () => {
      const mockLabels = {
        labels: [
          {
            id: 'Label_1',
            name: 'Visible',
            type: 'user',
            labelListVisibility: 'labelShow',
          },
          {
            id: 'Label_2',
            name: 'Hidden',
            type: 'user',
            labelListVisibility: 'labelHide',
          },
        ],
      }

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockLabels),
      } as unknown as Response)

      const result = await labelService.fetchGmailLabels(mockAccountId)

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Visible')
    })

    it('throws error when no tokens found', async () => {
      vi.mocked(tokenStorageService.getTokens).mockResolvedValue(null)

      await expect(labelService.fetchGmailLabels(mockAccountId)).rejects.toThrow(
        'No OAuth tokens found'
      )
    })

    it('handles token refresh on 401 error', async () => {
      const newTokens = { ...mockTokens, access_token: 'new-access-token' }

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ labels: [] }),
        } as unknown as Response)

      vi.mocked(gmailOAuthService.refreshAccessToken).mockResolvedValue(newTokens)
      vi.mocked(tokenStorageService.storeTokens).mockResolvedValue()

      const result = await labelService.fetchGmailLabels(mockAccountId)

      expect(gmailOAuthService.refreshAccessToken).toHaveBeenCalledWith('mock-refresh-token')
      expect(tokenStorageService.storeTokens).toHaveBeenCalledWith(mockAccountId, newTokens)
      expect(result).toEqual([])
    })
  })

  describe('Outlook Folders', () => {
    it('fetches Outlook folders successfully', async () => {
      const mockFolders = {
        value: [
          {
            id: 'folder-1',
            displayName: 'Projects',
            unreadItemCount: 10,
            totalItemCount: 50,
            childFolderCount: 0,
          },
          {
            id: 'folder-2',
            displayName: 'Archive',
            unreadItemCount: 0,
            totalItemCount: 100,
            childFolderCount: 0,
            wellKnownName: 'archive', // Should be filtered
          },
        ],
      }

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockFolders),
      } as unknown as Response)

      const result = await labelService.fetchOutlookFolders(mockAccountId)

      expect(fetch).toHaveBeenCalledWith(
        'https://graph.microsoft.com/v1.0/me/mailFolders?$top=100&$expand=childFolders',
        expect.objectContaining({
          headers: { Authorization: 'Bearer mock-access-token' },
        })
      )

      // Should filter out well-known folders that map to standard folders
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Projects')
      expect(result[0].unreadCount).toBe(10)
    })

    it('handles nested Outlook folders', async () => {
      const mockFolders = {
        value: [
          {
            id: 'parent-1',
            displayName: 'Parent Folder',
            unreadItemCount: 5,
            totalItemCount: 20,
            childFolderCount: 1,
            childFolders: [
              {
                id: 'child-1',
                displayName: 'Child Folder',
                unreadItemCount: 2,
                totalItemCount: 10,
                childFolderCount: 0,
              },
            ],
          },
        ],
      }

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockFolders),
      } as unknown as Response)

      const result = await labelService.fetchOutlookFolders(mockAccountId)

      expect(result).toHaveLength(2)
      // Child folder should have parentId set
      const childFolder = result.find((f) => f.name === 'Child Folder')
      expect(childFolder?.parentId).toBe('parent-1')
    })

    it('filters hidden Outlook folders', async () => {
      const mockFolders = {
        value: [
          {
            id: 'folder-1',
            displayName: 'Visible',
            unreadItemCount: 0,
            totalItemCount: 0,
            childFolderCount: 0,
          },
          {
            id: 'folder-2',
            displayName: 'Hidden',
            unreadItemCount: 0,
            totalItemCount: 0,
            childFolderCount: 0,
            isHidden: true,
          },
        ],
      }

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockFolders),
      } as unknown as Response)

      const result = await labelService.fetchOutlookFolders(mockAccountId)

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Visible')
    })
  })

  describe('fetchLabels', () => {
    it('routes to Gmail labels for gmail provider', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ labels: [] }),
      } as unknown as Response)

      await labelService.fetchLabels(mockAccountId, 'gmail')

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('gmail.googleapis.com'),
        expect.any(Object)
      )
    })

    it('routes to Outlook folders for outlook provider', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ value: [] }),
      } as unknown as Response)

      await labelService.fetchLabels(mockAccountId, 'outlook')

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('graph.microsoft.com'),
        expect.any(Object)
      )
    })
  })
})
