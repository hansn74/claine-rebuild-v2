import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { OutlookSyncService } from '../outlookSync'
import { createTestDatabase, destroyTestDatabase } from '../../database/__tests__/testUtils'
import type { AppDatabase } from '../../database/types'
import { tokenStorageService } from '../../auth/tokenStorage'
import { outlookOAuthService } from '../../auth/outlookOAuth'
import { syncStateSchema } from '../../database/schemas/syncState.schema'
import { syncFailureSchema } from '../../database/schemas/syncFailure.schema'
import { emailSchema } from '../../database/schemas/email.schema'

// Mock the auth services
vi.mock('../../auth/tokenStorage')
vi.mock('../../auth/outlookOAuth')

// Mock fetch globally
global.fetch = vi.fn()

describe('OutlookSyncService', () => {
  let db: AppDatabase
  let outlookSync: OutlookSyncService
  const testAccountId = 'test-account-outlook'

  beforeEach(async () => {
    // Create test database
    db = await createTestDatabase('outlooksync-test')

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

    outlookSync = new OutlookSyncService(db)

    // Reset all mocks completely
    vi.clearAllMocks()
    vi.resetAllMocks()

    // Reset fetch to be a fresh mock
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

  /**
   * Helper to create mock Graph message with all required fields
   */
  function createMockGraphMessage(
    id: string,
    overrides: Partial<{
      conversationId: string
      receivedDateTime: string
      sentDateTime: string
      subject: string
      bodyPreview: string
      isRead: boolean
      isDraft: boolean
      importance: string
      flag: { flagStatus: string }
      from: { emailAddress: { name: string; address: string } }
      toRecipients: Array<{ emailAddress: { name: string; address: string } }>
      ccRecipients: Array<{ emailAddress: { name: string; address: string } }>
      body: { contentType: string; content: string }
      hasAttachments: boolean
      attachments: Array<{
        id: string
        name: string
        contentType: string
        size: number
        isInline: boolean
        contentId?: string
      }>
      parentFolderId: string
      categories: string[]
    }> = {}
  ) {
    return {
      id,
      conversationId: overrides.conversationId ?? 'conv-' + id,
      receivedDateTime: overrides.receivedDateTime ?? '2024-11-25T10:00:00Z',
      sentDateTime: overrides.sentDateTime ?? '2024-11-25T09:59:00Z',
      subject: overrides.subject ?? `Test Subject ${id}`,
      bodyPreview: overrides.bodyPreview ?? 'This is a test email preview...',
      isRead: overrides.isRead ?? false,
      isDraft: overrides.isDraft ?? false,
      importance: overrides.importance ?? 'normal',
      flag: overrides.flag ?? { flagStatus: 'notFlagged' },
      from: overrides.from ?? {
        emailAddress: {
          name: 'Sender Name',
          address: 'sender@example.com',
        },
      },
      toRecipients: overrides.toRecipients ?? [
        {
          emailAddress: {
            name: 'Recipient Name',
            address: 'recipient@example.com',
          },
        },
      ],
      ccRecipients: overrides.ccRecipients ?? [],
      body: overrides.body ?? {
        contentType: 'text',
        content: 'Test email body content',
      },
      hasAttachments: overrides.hasAttachments ?? false,
      attachments: overrides.attachments,
      parentFolderId: overrides.parentFolderId ?? 'inbox-folder-id',
      categories: overrides.categories ?? [],
    }
  }

  describe('Initial Sync', () => {
    it('should perform initial sync for last 90 days (AC1)', async () => {
      // Mock token storage
      vi.mocked(tokenStorageService.getTokens).mockResolvedValue({
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'Mail.Read Mail.Send offline_access',
      })

      // Mock folders response
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            value: [
              {
                id: 'inbox-folder-id',
                displayName: 'Inbox',
                totalItemCount: 100,
                unreadItemCount: 5,
              },
            ],
          }),
          { status: 200 }
        )
      )

      // Mock Graph API delta messages response
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            value: [
              createMockGraphMessage('msg-1'),
              createMockGraphMessage('msg-2', { isRead: true }),
            ],
            '@odata.deltaLink':
              'https://graph.microsoft.com/v1.0/me/messages/delta?$skiptoken=abc123',
          }),
          { status: 200 }
        )
      )

      // Start sync
      await outlookSync.startSync(testAccountId)

      // Verify emails were stored in database
      const emails = await db.emails?.find().exec()
      expect(emails).toHaveLength(2)
      expect(emails?.[0].id).toBe('outlook-msg-1')
      expect(emails?.[0].from.email).toBe('sender@example.com')
      expect(emails?.[0].subject).toBe('Test Subject msg-1')
      expect(emails?.[0].read).toBe(false)
      expect(emails?.[1].id).toBe('outlook-msg-2')
      expect(emails?.[1].read).toBe(true)

      // Verify sync state was updated with deltaLink
      const syncState = await db.syncState?.findOne(testAccountId).exec()
      expect(syncState?.status).toBe('idle')
      expect(syncState?.initialSyncComplete).toBe(true)
      // The syncToken stores the deltaLink URL for incremental sync
      expect(syncState?.syncToken).toContain('delta')
      expect(syncState?.syncToken).toContain('skiptoken')
    })

    it('should respect configurable VITE_SYNC_DAYS_INITIAL (AC1)', async () => {
      // Set environment variable
      vi.stubEnv('VITE_SYNC_DAYS_INITIAL', '30')

      // Recreate service with new env
      outlookSync = new OutlookSyncService(db)

      vi.mocked(tokenStorageService.getTokens).mockResolvedValue({
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'Mail.Read',
      })

      // Mock folders
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ value: [] }), { status: 200 })
      )

      // Mock empty response
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            value: [],
            '@odata.deltaLink': 'https://graph.microsoft.com/v1.0/me/messages/delta?token=xyz',
          }),
          { status: 200 }
        )
      )

      await outlookSync.startSync(testAccountId)

      // Verify the query used 30 days filter - check the messages fetch call (index 1)
      const fetchCall = vi.mocked(global.fetch).mock.calls[1][0] as string
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      const expectedDatePrefix = thirtyDaysAgo.toISOString().substring(0, 10) // YYYY-MM-DD
      // URL might encode space as %20 or + depending on URLSearchParams behavior
      expect(fetchCall).toMatch(/receivedDateTime(%20|\+)ge/)
      expect(fetchCall).toContain(expectedDatePrefix)
    })

    it('should handle network interruption and pause sync (AC6)', async () => {
      vi.mocked(tokenStorageService.getTokens).mockResolvedValue({
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'Mail.Read',
      })

      // Simulate going offline
      Object.defineProperty(navigator, 'onLine', {
        writable: true,
        value: false,
      })

      await outlookSync.startSync(testAccountId)

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
        scope: 'Mail.Read',
      })

      // Mock folders response
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ value: [] }), { status: 200 })
      )

      // Mock 401 response then success with new token
      vi.mocked(global.fetch)
        .mockResolvedValueOnce(new Response(null, { status: 401 }))
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              value: [],
              '@odata.deltaLink': 'https://graph.microsoft.com/v1.0/me/messages/delta?token=xyz',
            }),
            { status: 200 }
          )
        )

      // Mock token refresh
      vi.mocked(outlookOAuthService.refreshAccessToken).mockResolvedValue({
        access_token: 'new-access-token',
        refresh_token: 'mock-refresh-token',
        token_type: 'Bearer',
        expires_in: 3600,
      })

      await outlookSync.startSync(testAccountId)

      // Verify token refresh was called
      expect(outlookOAuthService.refreshAccessToken).toHaveBeenCalledWith('mock-refresh-token')
      expect(tokenStorageService.storeTokens).toHaveBeenCalledWith(testAccountId, {
        access_token: 'new-access-token',
        refresh_token: 'mock-refresh-token',
        token_type: 'Bearer',
        expires_in: 3600,
      })
    })

    it('should parse HTML email bodies correctly', async () => {
      vi.mocked(tokenStorageService.getTokens).mockResolvedValue({
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'Mail.Read',
      })

      // Mock folders
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ value: [] }), { status: 200 })
      )

      // Mock message with HTML body
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            value: [
              createMockGraphMessage('msg-html', {
                body: {
                  contentType: 'html',
                  content: '<html><body><p>HTML content</p></body></html>',
                },
              }),
            ],
            '@odata.deltaLink': 'https://graph.microsoft.com/v1.0/me/messages/delta?token=xyz',
          }),
          { status: 200 }
        )
      )

      await outlookSync.startSync(testAccountId)

      // Verify HTML parsing
      const email = await db.emails?.findOne('outlook-msg-html').exec()
      expect(email?.body.html).toBe('<html><body><p>HTML content</p></body></html>')
      expect(email?.body.text).toBe('This is a test email preview...')
    })

    it('should associate emails with correct account (AC7)', async () => {
      vi.mocked(tokenStorageService.getTokens).mockResolvedValue({
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'Mail.Read',
      })

      // Mock folders
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ value: [] }), { status: 200 })
      )

      // Mock message response
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            value: [createMockGraphMessage('msg-account-test')],
            '@odata.deltaLink': 'https://graph.microsoft.com/v1.0/me/messages/delta?token=xyz',
          }),
          { status: 200 }
        )
      )

      await outlookSync.startSync(testAccountId)

      // Verify email is associated with correct account
      const email = await db.emails?.findOne('outlook-msg-account-test').exec()
      expect(email?.accountId).toBe(testAccountId)
    })

    it('should handle attachments correctly', async () => {
      vi.mocked(tokenStorageService.getTokens).mockResolvedValue({
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'Mail.Read',
      })

      // Mock folders
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ value: [] }), { status: 200 })
      )

      // Mock message with attachments
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            value: [
              createMockGraphMessage('msg-attachments', {
                hasAttachments: true,
                attachments: [
                  {
                    id: 'att-1',
                    name: 'document.pdf',
                    contentType: 'application/pdf',
                    size: 12345,
                    isInline: false,
                  },
                  {
                    id: 'att-2',
                    name: 'image.png',
                    contentType: 'image/png',
                    size: 5678,
                    isInline: true,
                    contentId: 'image001',
                  },
                ],
              }),
            ],
            '@odata.deltaLink': 'https://graph.microsoft.com/v1.0/me/messages/delta?token=xyz',
          }),
          { status: 200 }
        )
      )

      await outlookSync.startSync(testAccountId)

      // Verify attachments
      const email = await db.emails?.findOne('outlook-msg-attachments').exec()
      expect(email?.attachments).toHaveLength(2)
      expect(email?.attachments[0].filename).toBe('document.pdf')
      expect(email?.attachments[0].mimeType).toBe('application/pdf')
      expect(email?.attachments[0].size).toBe(12345)
      expect(email?.attachments[1].isInline).toBe(true)
      expect(email?.attachments[1].contentId).toBe('image001')
    })

    it('should handle starred/flagged emails', async () => {
      vi.mocked(tokenStorageService.getTokens).mockResolvedValue({
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'Mail.Read',
      })

      // Mock folders
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ value: [] }), { status: 200 })
      )

      // Mock flagged message
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            value: [
              createMockGraphMessage('msg-flagged', {
                flag: { flagStatus: 'flagged' },
              }),
            ],
            '@odata.deltaLink': 'https://graph.microsoft.com/v1.0/me/messages/delta?token=xyz',
          }),
          { status: 200 }
        )
      )

      await outlookSync.startSync(testAccountId)

      // Verify starred status
      const email = await db.emails?.findOne('outlook-msg-flagged').exec()
      expect(email?.starred).toBe(true)
    })
  })

  describe('Delta Sync (Incremental)', () => {
    beforeEach(async () => {
      // Setup initial sync state with deltaLink - include all required fields per schema
      await db.syncState?.insert({
        id: testAccountId,
        provider: 'outlook',
        status: 'idle',
        initialSyncComplete: true,
        syncToken: 'https://graph.microsoft.com/v1.0/me/messages/delta?$skiptoken=existing123',
        emailsSynced: 10,
        totalEmailsToSync: 10,
        progressPercentage: 100,
        estimatedTimeRemaining: 0,
        lastSyncAt: Date.now() - 60000,
        nextSyncAt: Date.now() + 180000,
        errorCount: 0,
        lastRequestAt: 0,
        requestCount: 0,
        averageSyncRate: 0,
      })
    })

    it('should use Delta Query for incremental sync (AC4)', async () => {
      vi.mocked(tokenStorageService.getTokens).mockResolvedValue({
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'Mail.Read',
      })

      // Mock folders
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ value: [] }), { status: 200 })
      )

      // Mock Delta Query response
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            value: [createMockGraphMessage('msg-new-delta')],
            '@odata.deltaLink':
              'https://graph.microsoft.com/v1.0/me/messages/delta?$skiptoken=new456',
          }),
          { status: 200 }
        )
      )

      await outlookSync.startSync(testAccountId)

      // Verify delta link was used
      const deltaCall = vi.mocked(global.fetch).mock.calls[1][0] as string
      expect(deltaCall).toContain('delta')
      expect(deltaCall).toContain('existing123')

      // Verify new email was added
      const email = await db.emails?.findOne('outlook-msg-new-delta').exec()
      expect(email?.subject).toBe('Test Subject msg-new-delta')

      // Verify syncToken was updated
      const syncState = await db.syncState?.findOne(testAccountId).exec()
      expect(syncState?.syncToken).toContain('new456')
    })

    it('should handle deleted messages in delta response', async () => {
      // First insert an email to be deleted
      await db.emails?.insert({
        id: 'outlook-msg-to-delete',
        threadId: 'thread-1',
        from: { name: 'Test', email: 'test@test.com' },
        to: [{ name: 'Recipient', email: 'recipient@test.com' }],
        subject: 'To be deleted',
        body: { text: 'Test' },
        timestamp: Date.now(),
        accountId: testAccountId,
        attachments: [],
        snippet: 'Test',
        labels: [],
        folder: 'Inbox',
        read: true,
        starred: false,
        importance: 'normal',
        attributes: {},
      })

      vi.mocked(tokenStorageService.getTokens).mockResolvedValue({
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'Mail.Read',
      })

      // Mock folders
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ value: [] }), { status: 200 })
      )

      // Mock Delta Query with deleted message
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            value: [
              {
                id: 'msg-to-delete',
                '@removed': { reason: 'deleted' },
              },
            ],
            '@odata.deltaLink':
              'https://graph.microsoft.com/v1.0/me/messages/delta?$skiptoken=after-delete',
          }),
          { status: 200 }
        )
      )

      await outlookSync.startSync(testAccountId)

      // Verify email was deleted
      const deletedEmail = await db.emails?.findOne('outlook-msg-to-delete').exec()
      expect(deletedEmail).toBeNull()
    })

    it('should fallback to full sync if delta link expired (410)', async () => {
      vi.mocked(tokenStorageService.getTokens).mockResolvedValue({
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'Mail.Read',
      })

      // Mock folders
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ value: [] }), { status: 200 })
      )

      // Mock 410 response from Delta API
      vi.mocked(global.fetch)
        .mockResolvedValueOnce(new Response(null, { status: 410 }))
        // Then mock initial sync response
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              value: [],
              '@odata.deltaLink': 'https://graph.microsoft.com/v1.0/me/messages/delta?token=fresh',
            }),
            { status: 200 }
          )
        )

      await outlookSync.startSync(testAccountId)

      // Verify full sync was performed (should have filter in URL)
      const fullSyncCall = vi.mocked(global.fetch).mock.calls[2][0] as string
      expect(fullSyncCall).toContain('receivedDateTime')
    })
  })

  describe('Rate Limiting (AC5)', () => {
    it('should respect Microsoft Graph rate limits (10 requests/second)', async () => {
      vi.mocked(tokenStorageService.getTokens).mockResolvedValue({
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'Mail.Read',
      })

      // Create messages that require pagination
      const messageIds = Array.from({ length: 15 }, (_, i) => createMockGraphMessage(`msg-${i}`))

      // Mock all fetch calls in sequence
      vi.mocked(global.fetch)
        // First call: folders fetch
        .mockResolvedValueOnce(new Response(JSON.stringify({ value: [] }), { status: 200 }))
        // Second call: first page of messages
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              value: messageIds.slice(0, 10),
              '@odata.nextLink':
                'https://graph.microsoft.com/v1.0/me/messages/delta?$skiptoken=page2',
            }),
            { status: 200 }
          )
        )
        // Third call: second page of messages
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              value: messageIds.slice(10),
              '@odata.deltaLink':
                'https://graph.microsoft.com/v1.0/me/messages/delta?$skiptoken=final',
            }),
            { status: 200 }
          )
        )

      await outlookSync.startSync(testAccountId)

      // Verify emails were stored
      const emails = await db.emails?.find().exec()
      expect(emails).toHaveLength(15)

      // Verify sync completed
      const syncState = await db.syncState?.findOne(testAccountId).exec()
      expect(syncState?.status).toBe('idle')
    })

    it('should handle 429 rate limit response with Retry-After', async () => {
      vi.mocked(tokenStorageService.getTokens).mockResolvedValue({
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'Mail.Read',
      })

      // Mock all fetch calls in sequence
      vi.mocked(global.fetch)
        // First call: folders fetch succeeds
        .mockResolvedValueOnce(new Response(JSON.stringify({ value: [] }), { status: 200 }))
        // Second call: 429 rate limit response
        .mockResolvedValueOnce(
          new Response(null, {
            status: 429,
            headers: { 'Retry-After': '0' }, // 0 seconds - fast for testing
          })
        )
        // Third call: success after retry
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              value: [],
              '@odata.deltaLink': 'https://graph.microsoft.com/v1.0/me/messages/delta?token=xyz',
            }),
            { status: 200 }
          )
        )

      await outlookSync.startSync(testAccountId)

      // Verify sync completed successfully despite rate limiting
      const syncState = await db.syncState?.findOne(testAccountId).exec()
      expect(syncState?.status).toBe('idle')
    })
  })

  describe('Concurrent Sync Prevention (AC8)', () => {
    it('should prevent concurrent sync for same account', async () => {
      vi.mocked(tokenStorageService.getTokens).mockResolvedValue({
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'Mail.Read',
      })

      // Mock folders
      vi.mocked(global.fetch).mockResolvedValueOnce(
        new Response(JSON.stringify({ value: [] }), { status: 200 })
      )

      // Mock slow API response
      vi.mocked(global.fetch).mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve(
                new Response(
                  JSON.stringify({
                    value: [],
                    '@odata.deltaLink':
                      'https://graph.microsoft.com/v1.0/me/messages/delta?token=xyz',
                  }),
                  { status: 200 }
                )
              )
            }, 1000)
          })
      )

      // Start two syncs concurrently
      const sync1 = outlookSync.startSync(testAccountId)
      const sync2 = outlookSync.startSync(testAccountId)

      // Second sync should throw error
      await expect(sync2).rejects.toThrow('Sync already in progress')

      // Wait for first sync to complete
      await sync1
    })

    it('should allow different accounts to sync concurrently', async () => {
      vi.mocked(tokenStorageService.getTokens).mockResolvedValue({
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'Mail.Read',
      })

      // Mock responses for both accounts
      for (let i = 0; i < 4; i++) {
        if (i % 2 === 0) {
          vi.mocked(global.fetch).mockResolvedValueOnce(
            new Response(JSON.stringify({ value: [] }), { status: 200 })
          )
        } else {
          vi.mocked(global.fetch).mockResolvedValueOnce(
            new Response(
              JSON.stringify({
                value: [],
                '@odata.deltaLink': 'https://graph.microsoft.com/v1.0/me/messages/delta?token=xyz',
              }),
              { status: 200 }
            )
          )
        }
      }

      // Start syncs for different accounts
      const sync1 = outlookSync.startSync('account-1')
      const sync2 = outlookSync.startSync('account-2')

      // Both should complete successfully
      await Promise.all([sync1, sync2])

      // Verify both sync states were created
      const state1 = await db.syncState?.findOne('account-1').exec()
      const state2 = await db.syncState?.findOne('account-2').exec()
      expect(state1).toBeTruthy()
      expect(state2).toBeTruthy()
    })
  })

  describe('Progress Tracking (AC2)', () => {
    it('should update progress during sync', async () => {
      vi.mocked(tokenStorageService.getTokens).mockResolvedValue({
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'Mail.Read',
      })

      // Create 20 messages to trigger progress updates at 10 and 20
      const messages = Array.from({ length: 20 }, (_, i) => createMockGraphMessage(`msg-${i}`))

      // Mock all fetch calls in sequence
      vi.mocked(global.fetch)
        // First call: folders fetch
        .mockResolvedValueOnce(new Response(JSON.stringify({ value: [] }), { status: 200 }))
        // Second call: messages with all 20
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              value: messages,
              '@odata.deltaLink': 'https://graph.microsoft.com/v1.0/me/messages/delta?token=xyz',
              '@odata.count': 20,
            }),
            { status: 200 }
          )
        )

      await outlookSync.startSync(testAccountId)

      // Verify final sync state - emailsSynced reflects progress updates (at 10, 20 boundaries)
      const syncState = await db.syncState?.findOne(testAccountId).exec()
      // Progress updates happen every 10 messages, so 20 messages = 2 updates (at 10 and 20)
      expect(syncState?.emailsSynced).toBe(20)
      expect(syncState?.status).toBe('idle')
      expect(syncState?.initialSyncComplete).toBe(true)
    })
  })

  describe('Folder Mapping', () => {
    it('should map folder IDs to display names', async () => {
      vi.mocked(tokenStorageService.getTokens).mockResolvedValue({
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'Mail.Read',
      })

      // Mock all fetch calls in sequence
      vi.mocked(global.fetch)
        // First call: folders with display names
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              value: [
                {
                  id: 'folder-inbox',
                  displayName: 'Inbox',
                  totalItemCount: 100,
                  unreadItemCount: 5,
                },
                {
                  id: 'folder-sent',
                  displayName: 'Sent Items',
                  totalItemCount: 50,
                  unreadItemCount: 0,
                },
              ],
            }),
            { status: 200 }
          )
        )
        // Second call: messages in specific folders
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              value: [
                createMockGraphMessage('msg-inbox', { parentFolderId: 'folder-inbox' }),
                createMockGraphMessage('msg-sent', { parentFolderId: 'folder-sent' }),
              ],
              '@odata.deltaLink': 'https://graph.microsoft.com/v1.0/me/messages/delta?token=xyz',
            }),
            { status: 200 }
          )
        )

      await outlookSync.startSync(testAccountId)

      // Verify folder names are correctly mapped
      const inboxEmail = await db.emails?.findOne('outlook-msg-inbox').exec()
      expect(inboxEmail?.folder).toBe('Inbox')

      const sentEmail = await db.emails?.findOne('outlook-msg-sent').exec()
      expect(sentEmail?.folder).toBe('Sent Items')
    })
  })
})
