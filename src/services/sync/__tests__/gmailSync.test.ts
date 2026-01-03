import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { GmailSyncService } from '../gmailSync'
import { createTestDatabase, destroyTestDatabase } from '../../database/__tests__/testUtils'
import type { AppDatabase } from '../../database/types'
import { tokenStorageService } from '../../auth/tokenStorage'
import { gmailOAuthService } from '../../auth/gmailOAuth'
import { syncStateSchema } from '../../database/schemas/syncState.schema'
import { syncFailureSchema } from '../../database/schemas/syncFailure.schema'
import { emailSchema } from '../../database/schemas/email.schema'

// Mock the auth services
vi.mock('../../auth/tokenStorage')
vi.mock('../../auth/gmailOAuth')

// Mock fetch globally
global.fetch = vi.fn()

describe('GmailSyncService', () => {
  let db: AppDatabase
  let gmailSync: GmailSyncService
  const testAccountId = 'test-account-gmail'

  beforeEach(async () => {
    // Create test database
    db = await createTestDatabase('gmailsync-test')

    // Create syncState collection if it doesn't exist (required by SyncProgressService)
    if (!db.syncState) {
      await db.addCollections({
        syncState: { schema: syncStateSchema },
      })
    }

    // Create syncFailures collection if it doesn't exist (required by SyncFailureService)
    if (!db.syncFailures) {
      await db.addCollections({
        syncFailures: { schema: syncFailureSchema },
      })
    }

    // Create emails collection if it doesn't exist (required for storing synced emails)
    if (!db.emails) {
      await db.addCollections({
        emails: { schema: emailSchema },
      })
    }

    gmailSync = new GmailSyncService(db)

    // Reset all mocks completely
    vi.clearAllMocks()
    vi.resetAllMocks()
    vi.mocked(global.fetch).mockReset()

    // Mock navigator.onLine
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true,
    })
  })

  afterEach(async () => {
    // Cleanup test database
    await destroyTestDatabase(db)

    // Force garbage collection pause to let RxDB cleanup complete
    await new Promise((resolve) => setTimeout(resolve, 100))
  })

  describe('Initial Sync', () => {
    it('should perform initial sync for last 90 days', async () => {
      // Mock token storage
      vi.mocked(tokenStorageService.getTokens).mockResolvedValue({
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'https://www.googleapis.com/auth/gmail.readonly',
      })

      // Mock Gmail API messages.list response
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            messages: [
              { id: 'msg-1', threadId: 'thread-1' },
              { id: 'msg-2', threadId: 'thread-1' },
            ],
            resultSizeEstimate: 2,
          }),
          { status: 200 }
        )
      )

      // Mock Gmail API messages.get responses
      vi.mocked(global.fetch)
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              id: 'msg-1',
              threadId: 'thread-1',
              historyId: '12345',
              internalDate: '1699000000000',
              snippet: 'Test email 1',
              labelIds: ['INBOX', 'UNREAD'],
              payload: {
                mimeType: 'text/plain',
                headers: [
                  { name: 'From', value: 'sender@example.com' },
                  { name: 'To', value: 'recipient@example.com' },
                  { name: 'Subject', value: 'Test Email 1' },
                ],
                body: { data: 'VGVzdCBib2R5IDE=' }, // Base64 "Test body 1"
              },
            }),
            { status: 200 }
          )
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              id: 'msg-2',
              threadId: 'thread-1',
              historyId: '12346',
              internalDate: '1699000001000',
              snippet: 'Test email 2',
              labelIds: ['INBOX'],
              payload: {
                mimeType: 'text/plain',
                headers: [
                  { name: 'From', value: 'sender@example.com' },
                  { name: 'To', value: 'recipient@example.com' },
                  { name: 'Subject', value: 'Test Email 2' },
                ],
                body: { data: 'VGVzdCBib2R5IDI=' }, // Base64 "Test body 2"
              },
            }),
            { status: 200 }
          )
        )

      // Start sync
      await gmailSync.startSync(testAccountId)

      // Verify emails were stored in database
      const emails = await db.emails?.find().exec()
      expect(emails).toHaveLength(2)
      expect(emails?.[0].id).toBe('msg-1')
      expect(emails?.[0].from.email).toBe('sender@example.com')
      expect(emails?.[0].subject).toBe('Test Email 1')
      expect(emails?.[0].read).toBe(false) // UNREAD label
      expect(emails?.[1].id).toBe('msg-2')
      expect(emails?.[1].read).toBe(true) // No UNREAD label

      // Verify sync state was updated
      const syncState = await db.syncState?.findOne(testAccountId).exec()
      expect(syncState?.status).toBe('idle')
      expect(syncState?.initialSyncComplete).toBe(true)
      expect(syncState?.syncToken).toBe('12346') // Latest historyId
    })

    it('should respect configurable VITE_SYNC_DAYS_INITIAL', async () => {
      // Set environment variable
      vi.stubEnv('VITE_SYNC_DAYS_INITIAL', '30')

      // Recreate service with new env
      gmailSync = new GmailSyncService(db)

      vi.mocked(tokenStorageService.getTokens).mockResolvedValue({
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'https://www.googleapis.com/auth/gmail.readonly',
      })

      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ messages: [], resultSizeEstimate: 0 }), { status: 200 })
      )

      await gmailSync.startSync(testAccountId)

      // Verify the query used 30 days (check fetch call)
      const fetchCall = vi.mocked(global.fetch).mock.calls[0][0] as string
      const decodedFetchCall = decodeURIComponent(fetchCall)
      const thirtyDaysAgo = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000)
      expect(decodedFetchCall).toContain(`after:${thirtyDaysAgo}`)
    })

    it('should handle network interruption and pause sync', async () => {
      vi.mocked(tokenStorageService.getTokens).mockResolvedValue({
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'https://www.googleapis.com/auth/gmail.readonly',
      })

      // Simulate going offline
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      })

      await gmailSync.startSync(testAccountId)

      // Verify sync was paused
      const syncState = await db.syncState?.findOne(testAccountId).exec()
      expect(syncState?.status).toBe('paused')
    })

    it('should refresh token on 401 error', async () => {
      vi.mocked(tokenStorageService.getTokens).mockResolvedValue({
        access_token: 'expired-token',
        refresh_token: 'mock-refresh-token',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'https://www.googleapis.com/auth/gmail.readonly',
      })

      // Mock 401 response then success with new token
      vi.mocked(global.fetch)
        .mockResolvedValueOnce(new Response(null, { status: 401 }))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ messages: [], resultSizeEstimate: 0 }), { status: 200 })
        )

      // Mock token refresh
      vi.mocked(gmailOAuthService.refreshAccessToken).mockResolvedValue({
        access_token: 'new-access-token',
        refresh_token: 'mock-refresh-token',
        token_type: 'Bearer',
        expires_in: 3600,
      })

      await gmailSync.startSync(testAccountId)

      // Verify token refresh was called
      expect(gmailOAuthService.refreshAccessToken).toHaveBeenCalledWith('mock-refresh-token')
      expect(tokenStorageService.storeTokens).toHaveBeenCalledWith(testAccountId, {
        access_token: 'new-access-token',
        refresh_token: 'mock-refresh-token',
        token_type: 'Bearer',
        expires_in: 3600,
      })
    })

    it('should parse multipart email messages correctly', async () => {
      vi.mocked(tokenStorageService.getTokens).mockResolvedValue({
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'https://www.googleapis.com/auth/gmail.readonly',
      })

      // Mock Gmail API responses
      vi.mocked(global.fetch)
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              messages: [{ id: 'msg-multipart', threadId: 'thread-1' }],
              resultSizeEstimate: 1,
            }),
            { status: 200 }
          )
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              id: 'msg-multipart',
              threadId: 'thread-1',
              historyId: '12345',
              internalDate: '1699000000000',
              snippet: 'Multipart email',
              labelIds: ['INBOX'],
              payload: {
                mimeType: 'multipart/alternative',
                headers: [
                  { name: 'From', value: 'Sender Name <sender@example.com>' },
                  { name: 'To', value: 'recipient1@example.com, recipient2@example.com' },
                  { name: 'Cc', value: 'cc@example.com' },
                  { name: 'Subject', value: 'Multipart Test' },
                ],
                parts: [
                  {
                    mimeType: 'text/plain',
                    body: { data: 'UGxhaW4gdGV4dCBib2R5' }, // Base64 "Plain text body"
                  },
                  {
                    mimeType: 'text/html',
                    body: { data: 'PGh0bWw+SFRNTCBib2R5PC9odG1sPg==' }, // Base64 "<html>HTML body</html>"
                  },
                ],
                body: {},
              },
            }),
            { status: 200 }
          )
        )

      await gmailSync.startSync(testAccountId)

      // Verify multipart parsing
      const email = await db.emails?.findOne('msg-multipart').exec()
      expect(email?.from.name).toBe('Sender Name')
      expect(email?.from.email).toBe('sender@example.com')
      expect(email?.to).toHaveLength(2)
      expect(email?.to[0].email).toBe('recipient1@example.com')
      expect(email?.to[1].email).toBe('recipient2@example.com')
      expect(email?.cc).toHaveLength(1)
      expect(email?.cc?.[0].email).toBe('cc@example.com')
      expect(email?.body.text).toBe('Plain text body')
      expect(email?.body.html).toBe('<html>HTML body</html>')
    })
  })

  describe('Incremental Sync', () => {
    beforeEach(async () => {
      // Setup initial sync state with historyId
      const now = Date.now()
      await db.syncState?.insert({
        id: testAccountId,
        provider: 'gmail',
        status: 'idle',
        initialSyncComplete: true,
        syncToken: '12345', // Starting historyId
        emailsSynced: 10,
        totalEmailsToSync: 10,
        progressPercentage: 100,
        estimatedTimeRemaining: 0,
        lastSyncAt: now - 60000,
        nextSyncAt: now + 60000,
        errorCount: 0,
        lastRequestAt: now - 60000,
        requestCount: 0,
        averageSyncRate: 0,
      })
    })

    it('should use Gmail History API for incremental sync', async () => {
      vi.mocked(tokenStorageService.getTokens).mockResolvedValue({
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'https://www.googleapis.com/auth/gmail.readonly',
      })

      // Mock History API response
      vi.mocked(global.fetch)
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              history: [
                {
                  id: '12346',
                  messagesAdded: [
                    {
                      message: { id: 'msg-new', threadId: 'thread-new' },
                    },
                  ],
                },
              ],
              historyId: '12346',
            }),
            { status: 200 }
          )
        )
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              id: 'msg-new',
              threadId: 'thread-new',
              historyId: '12346',
              internalDate: '1699000002000',
              snippet: 'New incremental email',
              labelIds: ['INBOX'],
              payload: {
                mimeType: 'text/plain',
                headers: [
                  { name: 'From', value: 'sender@example.com' },
                  { name: 'To', value: 'recipient@example.com' },
                  { name: 'Subject', value: 'New Email' },
                ],
                body: { data: 'TmV3IGVtYWls' }, // Base64 "New email"
              },
            }),
            { status: 200 }
          )
        )

      await gmailSync.startSync(testAccountId)

      // Verify History API was called with correct startHistoryId
      const historyCall = vi.mocked(global.fetch).mock.calls[0][0] as string
      expect(historyCall).toContain('history')
      expect(historyCall).toContain('startHistoryId=12345')

      // Verify new email was added
      const email = await db.emails?.findOne('msg-new').exec()
      expect(email?.subject).toBe('New Email')

      // Verify syncToken was updated
      const syncState = await db.syncState?.findOne(testAccountId).exec()
      expect(syncState?.syncToken).toBe('12346')
    })

    it('should fallback to full sync if historyId expired (404)', async () => {
      vi.mocked(tokenStorageService.getTokens).mockResolvedValue({
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'https://www.googleapis.com/auth/gmail.readonly',
      })

      // Mock 404 response from History API
      vi.mocked(global.fetch)
        .mockResolvedValueOnce(new Response(null, { status: 404 }))
        // Then mock messages.list for full sync
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ messages: [], resultSizeEstimate: 0 }), { status: 200 })
        )

      await gmailSync.startSync(testAccountId)

      // Verify messages.list was called (full sync)
      const listCall = vi.mocked(global.fetch).mock.calls[1][0] as string
      const decodedListCall = decodeURIComponent(listCall)
      expect(decodedListCall).toContain('messages')
      expect(decodedListCall).toContain('after:')
    })
  })

  // Note: Rate limiting behavior is tested in rateLimiter.throttle.test.ts (19 tests)

  describe('Concurrent Sync Prevention', () => {
    it('should prevent concurrent sync for same account', async () => {
      vi.mocked(tokenStorageService.getTokens).mockResolvedValue({
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'https://www.googleapis.com/auth/gmail.readonly',
      })

      // Mock slow API response
      vi.mocked(global.fetch).mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve(
                new Response(JSON.stringify({ messages: [], resultSizeEstimate: 0 }), {
                  status: 200,
                })
              )
            }, 1000)
          })
      )

      // Start two syncs concurrently
      const sync1 = gmailSync.startSync(testAccountId)
      const sync2 = gmailSync.startSync(testAccountId)

      // Second sync should throw error
      await expect(sync2).rejects.toThrow('Sync already in progress')

      // Wait for first sync to complete
      await sync1
    })
  })
})
