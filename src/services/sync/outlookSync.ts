/**
 * Outlook Sync Service
 * Implements email synchronization using Microsoft Graph API
 *
 * Features:
 * - Initial sync: Last 90 days of emails (configurable)
 * - Incremental sync: Delta Query every 2-5 minutes
 * - Rate limiting: 10 requests/second (Microsoft Graph tenant-level)
 * - Network resilience: Resume sync after interruptions
 * - Multi-account: Independent sync per account
 */

import type { AppDatabase } from '../database/types'
import type { EmailDocument } from '../database/schemas/email.schema'
import { createOutlookRateLimiter, type RateLimiter } from './rateLimiter'
import { SyncProgressService } from './syncProgress'
import { tokenStorageService } from '../auth/tokenStorage'
import { outlookOAuthService } from '../auth/outlookOAuth'
import { SyncFailureService } from './syncFailureService'
import { classifyHttpError, shouldRetry } from './errorClassification'
import { waitForRetry, DEFAULT_RETRY_CONFIG } from './retryEngine'
import { logger } from '@/services/logger'
import { batchMode } from '@/services/database/batchMode'

/**
 * Microsoft Graph Message resource (simplified)
 * Full spec: https://learn.microsoft.com/en-us/graph/api/resources/message
 */
interface GraphMessage {
  id: string
  conversationId: string
  receivedDateTime: string
  sentDateTime: string
  subject: string
  bodyPreview: string
  isRead: boolean
  isDraft: boolean
  importance: 'low' | 'normal' | 'high'
  flag: {
    flagStatus: 'notFlagged' | 'complete' | 'flagged'
  }
  from?: {
    emailAddress: {
      name: string
      address: string
    }
  }
  toRecipients: Array<{
    emailAddress: {
      name: string
      address: string
    }
  }>
  ccRecipients?: Array<{
    emailAddress: {
      name: string
      address: string
    }
  }>
  bccRecipients?: Array<{
    emailAddress: {
      name: string
      address: string
    }
  }>
  body: {
    contentType: 'text' | 'html'
    content: string
  }
  hasAttachments: boolean
  attachments?: Array<{
    id: string
    name: string
    contentType: string
    size: number
    isInline: boolean
    contentId?: string
  }>
  parentFolderId: string
  categories: string[]
  '@removed'?: { reason: 'deleted' | 'changed' }
}

/**
 * Microsoft Graph Messages list response
 */
interface GraphMessagesListResponse {
  value: GraphMessage[]
  '@odata.nextLink'?: string
  '@odata.deltaLink'?: string
  '@odata.count'?: number
}

/**
 * Microsoft Graph Folder resource
 */
interface GraphFolder {
  id: string
  displayName: string
  parentFolderId?: string
  totalItemCount: number
  unreadItemCount: number
}

/**
 * Microsoft Graph Folders response
 */
interface GraphFoldersResponse {
  value: GraphFolder[]
}

/**
 * Outlook Sync Service
 */
export class OutlookSyncService {
  private db: AppDatabase
  private rateLimiter: RateLimiter
  private progressService: SyncProgressService
  private failureService: SyncFailureService
  private syncInterval: number
  private syncDaysInitial: number
  private activeSync: Map<string, boolean> = new Map() // accountId → is syncing
  private pausedSyncs: Set<string> = new Set() // accountId → paused due to offline
  private onlineListenerAdded = false
  private folderIdMap: Map<string, string> = new Map() // folderId → displayName

  constructor(db: AppDatabase) {
    this.db = db
    this.rateLimiter = createOutlookRateLimiter()
    this.progressService = new SyncProgressService(db)
    this.failureService = new SyncFailureService(db)

    // Load sync configuration from environment
    this.syncInterval = parseInt(import.meta.env.VITE_SYNC_INTERVAL_MS || '180000', 10) // 3 minutes default
    this.syncDaysInitial = parseInt(import.meta.env.VITE_SYNC_DAYS_INITIAL || '90', 10) // 90 days default

    // Setup network event listeners for resilience (AC6)
    this.setupNetworkListeners()
  }

  /**
   * Setup network online/offline listeners
   * Enables resume sync when network returns (AC6)
   */
  private setupNetworkListeners(): void {
    if (this.onlineListenerAdded || typeof window === 'undefined') {
      return
    }

    window.addEventListener('online', () => {
      logger.info('sync', 'Network online - resuming paused syncs')
      this.resumePausedSyncs()
    })

    window.addEventListener('offline', () => {
      logger.info('sync', 'Network offline - syncs will pause')
      // Active syncs will detect offline and pause themselves
    })

    this.onlineListenerAdded = true
  }

  /**
   * Resume all paused syncs when network returns
   */
  private async resumePausedSyncs(): Promise<void> {
    const accountsToResume = Array.from(this.pausedSyncs)
    this.pausedSyncs.clear()

    for (const accountId of accountsToResume) {
      try {
        await this.startSync(accountId)
      } catch (error) {
        logger.error('sync', `Failed to resume sync for account ${accountId}`, { error })
      }
    }
  }

  /**
   * Start sync for an Outlook account
   * Performs initial sync if not complete, otherwise incremental sync (delta query)
   */
  async startSync(accountId: string): Promise<void> {
    // Prevent concurrent sync for same account
    if (this.activeSync.get(accountId)) {
      throw new Error(`Sync already in progress for account: ${accountId}`)
    }

    this.activeSync.set(accountId, true)

    try {
      // Initialize sync state if needed
      await this.progressService.initializeSyncState(accountId, 'outlook')

      // Get current sync progress
      const progress = await this.progressService.getProgress(accountId)
      if (!progress) {
        throw new Error(`Failed to initialize sync state for account: ${accountId}`)
      }

      // Load folder mapping
      await this.loadFolderMapping(accountId)

      // Check if initial sync is complete (has deltaLink stored in syncToken)
      if (!progress || progress.progressPercentage < 100 || !progress.syncToken) {
        await this.performInitialSync(accountId)
      } else {
        await this.performDeltaSync(accountId)
      }

      // Schedule next sync
      await this.progressService.scheduleNextSync(accountId, this.syncInterval)
    } finally {
      this.activeSync.delete(accountId)
    }
  }

  /**
   * Load folder ID to display name mapping
   */
  private async loadFolderMapping(accountId: string): Promise<void> {
    // Check network before starting
    if (!navigator.onLine) {
      return
    }

    const tokens = await tokenStorageService.getTokens(accountId)
    if (!tokens) {
      return
    }

    try {
      // Rate limiting
      await this.rateLimiter.acquireAndWait(1)

      const response = await fetch('https://graph.microsoft.com/v1.0/me/mailFolders', {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      })

      if (response.ok) {
        const data: GraphFoldersResponse = await response.json()
        this.folderIdMap.clear()
        for (const folder of data.value) {
          this.folderIdMap.set(folder.id, folder.displayName)
        }
      }
    } catch (error) {
      logger.warn('sync', 'Failed to load folder mapping', { error })
    }
  }

  /**
   * Perform initial sync (last 90 days)
   * Uses Microsoft Graph /me/messages with date filter
   */
  private async performInitialSync(accountId: string): Promise<void> {
    // Check network before starting (AC6)
    if (!navigator.onLine) {
      logger.info('sync', 'Offline - pausing sync', { accountId })
      this.pausedSyncs.add(accountId)
      await this.progressService.updateProgress(accountId, {
        status: 'paused',
        emailsSynced: 0,
      })
      return
    }

    // Get access token
    const tokens = await tokenStorageService.getTokens(accountId)
    if (!tokens) {
      throw new Error(`No OAuth tokens found for account: ${accountId}`)
    }

    // Calculate date threshold (90 days ago)
    const daysAgo = this.syncDaysInitial
    const afterDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)
    const afterDateISO = afterDate.toISOString()

    // Get current progress to check for resume
    const currentProgress = await this.progressService.getProgress(accountId)
    let nextLink: string | undefined = currentProgress?.pageToken
    let syncedMessages = currentProgress?.emailsSynced || 0
    let totalMessages = currentProgress?.totalEmailsToSync || 0

    // Update status to syncing
    await this.progressService.updateProgress(accountId, {
      emailsSynced: syncedMessages,
      status: 'syncing',
    })

    let deltaLink: string | undefined

    // Story 1.18: Enter batch mode to reduce reactive query re-renders during bulk sync
    batchMode.enter()
    try {
      // Build initial URL if no resume link
      // Note: Delta endpoint doesn't support $filter, so we use regular messages endpoint for initial sync
      if (!nextLink) {
        const url = new URL('https://graph.microsoft.com/v1.0/me/messages')
        url.searchParams.set('$filter', `receivedDateTime ge ${afterDateISO}`)
        url.searchParams.set('$top', '50') // Page size
        url.searchParams.set('$orderby', 'receivedDateTime desc')
        url.searchParams.set(
          '$select',
          'id,conversationId,receivedDateTime,sentDateTime,subject,bodyPreview,isRead,isDraft,importance,flag,from,toRecipients,ccRecipients,bccRecipients,body,hasAttachments,parentFolderId,categories'
        )
        nextLink = url.toString()
      }

      do {
        // Check if network is still online (AC6)
        if (!navigator.onLine) {
          logger.info('sync', 'Offline detected - pausing sync', { accountId })
          this.pausedSyncs.add(accountId)
          await this.progressService.updateProgress(accountId, {
            status: 'paused',
            pageToken: nextLink, // Save for resume
            emailsSynced: syncedMessages,
          })
          return
        }

        // Rate limiting (1 request per call)
        await this.rateLimiter.acquireAndWait(1)

        const response = await fetch(nextLink, {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
            Prefer: 'odata.maxpagesize=50',
          },
        })

        if (!response.ok) {
          if (response.status === 401) {
            // Token expired, attempt refresh
            if (!tokens.refresh_token) {
              throw new Error('No refresh token available for re-authentication')
            }
            try {
              const refreshed = await outlookOAuthService.refreshAccessToken(tokens.refresh_token)
              await tokenStorageService.storeTokens(accountId, refreshed)
              // Update local tokens reference and continue
              tokens.access_token = refreshed.access_token
              continue // Retry this iteration with new token
            } catch {
              throw new Error('Token refresh failed. User must re-authenticate.')
            }
          }
          if (response.status === 429) {
            // Rate limited - extract retry-after header
            const retryAfter = response.headers.get('Retry-After')
            const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 60000
            logger.warn('sync', 'Rate limited, waiting', { waitMs })
            await this.sleep(waitMs)
            continue // Retry
          }
          throw new Error(`Microsoft Graph API error: ${response.status} ${response.statusText}`)
        }

        const data: GraphMessagesListResponse = await response.json()

        // Update total estimate on first page
        if (totalMessages === 0 && data['@odata.count']) {
          totalMessages = data['@odata.count']
          await this.progressService.updateProgress(accountId, {
            emailsSynced: syncedMessages,
            totalEmailsToSync: totalMessages,
          })
        }

        // Process messages
        // AC 1, 2: Track successful vs failed emails separately
        if (data.value && data.value.length > 0) {
          let batchFailedCount = 0

          for (const message of data.value) {
            // Skip deleted messages
            if (message['@removed']) {
              continue
            }

            try {
              await this.storeEmail(accountId, message)

              // Mark any existing failure as resolved
              await this.failureService.markResolvedByEmailId(message.id, accountId)

              syncedMessages++
            } catch (error) {
              // Record the failure for retry
              logger.warn('sync', 'Failed to store message', {
                messageId: message.id,
                error: error instanceof Error ? error.message : error,
              })

              await this.failureService.recordFailure(message.id, accountId, 'outlook', error)
              batchFailedCount++
            }

            // Update progress every 10 messages
            if ((syncedMessages + batchFailedCount) % 10 === 0) {
              await this.progressService.updateProgress(accountId, {
                emailsSynced: syncedMessages,
                totalEmailsToSync: totalMessages || syncedMessages,
                pageToken: data['@odata.nextLink'],
              })
            }
          }
        }

        nextLink = data['@odata.nextLink']
      } while (nextLink)

      // After initial sync, get a deltaLink for future incremental syncs
      // We need to call the delta endpoint once to get the initial deltaLink
      try {
        await this.rateLimiter.acquireAndWait(1)
        const deltaResponse = await fetch(
          'https://graph.microsoft.com/v1.0/me/messages/delta?$select=id&$top=1',
          {
            headers: {
              Authorization: `Bearer ${tokens.access_token}`,
            },
          }
        )
        if (deltaResponse.ok) {
          // Follow through all pages to get the final deltaLink
          let deltaData: GraphMessagesListResponse = await deltaResponse.json()
          while (deltaData['@odata.nextLink']) {
            await this.rateLimiter.acquireAndWait(1)
            const nextDeltaResponse = await fetch(deltaData['@odata.nextLink'], {
              headers: { Authorization: `Bearer ${tokens.access_token}` },
            })
            if (nextDeltaResponse.ok) {
              deltaData = await nextDeltaResponse.json()
            } else {
              break
            }
          }
          if (deltaData['@odata.deltaLink']) {
            deltaLink = deltaData['@odata.deltaLink']
          }
        }
      } catch (deltaError) {
        logger.warn('sync', 'Failed to get initial deltaLink', { error: deltaError })
      }

      // Mark sync complete and store deltaLink for incremental sync
      await this.progressService.markSyncComplete(accountId, deltaLink)
      logger.info('sync', 'Outlook initial sync complete', {
        syncedMessages,
        deltaLink: !!deltaLink,
      })
    } catch (error) {
      // Save error state for debugging
      await this.progressService.updateProgress(accountId, {
        status: 'error',
        lastError: error instanceof Error ? error.message : 'Unknown error',
        emailsSynced: syncedMessages,
      })
      throw error
    } finally {
      // Story 1.18: Always exit batch mode, even on error
      batchMode.exit()
    }
  }

  /**
   * Perform incremental sync using Delta Query
   * Fetches changes since last deltaLink (AC4)
   */
  private async performDeltaSync(accountId: string): Promise<void> {
    // Check network before starting (AC6)
    if (!navigator.onLine) {
      logger.info('sync', 'Offline - skipping delta sync', { accountId })
      return
    }

    const tokens = await tokenStorageService.getTokens(accountId)
    if (!tokens) {
      throw new Error(`No OAuth tokens found for account: ${accountId}`)
    }

    const progress = await this.progressService.getProgress(accountId)
    if (!progress) {
      throw new Error(`Sync state not found for account: ${accountId}`)
    }

    // Get deltaLink from syncToken (stored after initial sync)
    const deltaLink = progress.syncToken
    if (!deltaLink) {
      logger.info('sync', 'No deltaLink found, performing initial sync instead', { accountId })
      return await this.performInitialSync(accountId)
    }

    // Story 1.18: Enter batch mode for delta sync (can have many changes)
    batchMode.enter()
    try {
      await this.progressService.updateProgress(accountId, {
        status: 'syncing',
        emailsSynced: progress.emailsSynced,
      })

      let nextLink: string | undefined = deltaLink
      let newDeltaLink: string | undefined
      let newMessagesCount = 0
      let deletedMessagesCount = 0

      do {
        // Check network (AC6)
        if (!navigator.onLine) {
          logger.info('sync', 'Offline detected - pausing delta sync', { accountId })
          await this.progressService.updateProgress(accountId, {
            status: 'idle',
            emailsSynced: progress.emailsSynced + newMessagesCount,
          })
          return
        }

        // Rate limiting (1 request per call)
        await this.rateLimiter.acquireAndWait(1)

        const response = await fetch(nextLink, {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
          },
        })

        if (!response.ok) {
          if (response.status === 401) {
            // Token expired, attempt refresh
            if (!tokens.refresh_token) {
              throw new Error('No refresh token available for re-authentication')
            }
            try {
              const refreshed = await outlookOAuthService.refreshAccessToken(tokens.refresh_token)
              await tokenStorageService.storeTokens(accountId, refreshed)
              tokens.access_token = refreshed.access_token
              continue // Retry with new token
            } catch {
              throw new Error('Token refresh failed. User must re-authenticate.')
            }
          }
          if (response.status === 410) {
            // DeltaLink expired, fallback to full sync
            logger.info('sync', 'Delta link expired, performing full sync', { accountId })
            return await this.performInitialSync(accountId)
          }
          if (response.status === 429) {
            // Rate limited
            const retryAfter = response.headers.get('Retry-After')
            const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 60000
            logger.warn('sync', 'Rate limited, waiting', { waitMs })
            await this.sleep(waitMs)
            continue
          }
          throw new Error(`Microsoft Graph Delta API error: ${response.status}`)
        }

        const data: GraphMessagesListResponse = await response.json()

        // Process changes
        // AC 1, 2: Track successful vs failed emails separately
        if (data.value && data.value.length > 0) {
          for (const message of data.value) {
            if (message['@removed']) {
              // Message was deleted
              await this.deleteEmail(accountId, message.id)
              deletedMessagesCount++
            } else {
              // New or updated message
              try {
                await this.storeEmail(accountId, message)

                // Mark any existing failure as resolved
                await this.failureService.markResolvedByEmailId(message.id, accountId)

                newMessagesCount++
              } catch (error) {
                logger.warn('sync', 'Failed to store delta message', {
                  messageId: message.id,
                  error: error instanceof Error ? error.message : error,
                })
                await this.failureService.recordFailure(message.id, accountId, 'outlook', error)
              }
            }
          }
        }

        // Save new deltaLink when we reach the end
        if (data['@odata.deltaLink']) {
          newDeltaLink = data['@odata.deltaLink']
        }

        nextLink = data['@odata.nextLink']
      } while (nextLink)

      // Update sync state with new deltaLink
      await this.progressService.updateProgress(accountId, {
        status: 'idle',
        syncToken: newDeltaLink || deltaLink, // Keep old one if no new link
        emailsSynced: progress.emailsSynced + newMessagesCount,
      })

      if (newMessagesCount > 0 || deletedMessagesCount > 0) {
        logger.info('sync', 'Delta sync complete', { newMessagesCount, deletedMessagesCount })
      }
    } catch (error) {
      await this.progressService.updateProgress(accountId, {
        status: 'error',
        lastError: error instanceof Error ? error.message : 'Unknown error',
        emailsSynced: progress.emailsSynced,
      })
      throw error
    } finally {
      // Story 1.18: Always exit batch mode, even on error
      batchMode.exit()
    }
  }

  /**
   * Process pending retry failures for an account
   * AC 15: App startup checks for pending retries and resumes
   */
  async processPendingRetries(
    accountId: string
  ): Promise<{ processed: number; succeeded: number }> {
    const tokens = await tokenStorageService.getTokens(accountId)
    if (!tokens) {
      return { processed: 0, succeeded: 0 }
    }

    const pendingFailures = await this.failureService.getPendingRetries(accountId)
    let processed = 0
    let succeeded = 0

    for (const failure of pendingFailures) {
      // Mark as retrying
      await this.failureService.markRetrying(failure.id)
      processed++

      try {
        // Rate limiting
        await this.rateLimiter.acquireAndWait(1)

        // Fetch the message from Graph API with retry logic
        const message = await this.fetchMessageWithRetry(
          accountId,
          failure.emailId,
          tokens.access_token
        )

        if (message) {
          await this.storeEmail(accountId, message)

          // Mark as resolved
          await this.failureService.markResolved(failure.id)
          succeeded++

          logger.info('sync', 'Retry succeeded for message', { messageId: failure.emailId })
        }
      } catch (error) {
        // Update failure with new attempt info
        await this.failureService.recordFailure(failure.emailId, accountId, 'outlook', error)

        logger.warn('sync', 'Retry failed for message', {
          messageId: failure.emailId,
          error: error instanceof Error ? error.message : error,
        })
      }
    }

    if (processed > 0) {
      logger.info('sync', 'Processed pending retries', { processed, succeeded })
    }

    return { processed, succeeded }
  }

  /**
   * Fetch a single message with retry logic
   * AC 4, 5, 6, 7: Exponential backoff retry
   */
  private async fetchMessageWithRetry(
    _accountId: string,
    messageId: string,
    accessToken: string
  ): Promise<GraphMessage | null> {
    let lastError: Error | undefined
    let retryCount = 0

    while (retryCount <= DEFAULT_RETRY_CONFIG.maxRetries) {
      try {
        const url = `https://graph.microsoft.com/v1.0/me/messages/${messageId}?$select=id,conversationId,receivedDateTime,sentDateTime,subject,bodyPreview,isRead,isDraft,importance,flag,from,toRecipients,ccRecipients,bccRecipients,body,hasAttachments,parentFolderId,categories`

        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })

        if (!response.ok) {
          const classification = classifyHttpError(response.status, response.headers)

          // AC 7: Don't retry permanent failures
          if (!shouldRetry(classification, retryCount, DEFAULT_RETRY_CONFIG.maxRetries)) {
            throw new Error(`Failed to fetch message ${messageId}: ${response.status} (permanent)`)
          }

          // AC 4, 5, 6: Wait with exponential backoff
          await waitForRetry(retryCount, classification.retryAfterMs)
          retryCount++
          continue
        }

        return await response.json()
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        // Network error - retry with backoff
        if (retryCount < DEFAULT_RETRY_CONFIG.maxRetries) {
          await waitForRetry(retryCount)
          retryCount++
          continue
        }

        throw error
      }
    }

    throw lastError || new Error(`Failed to fetch message ${messageId} after ${retryCount} retries`)
  }

  /**
   * Get the failure service for external access
   */
  getFailureService(): SyncFailureService {
    return this.failureService
  }

  /**
   * Delete email from local database
   */
  private async deleteEmail(_accountId: string, messageId: string): Promise<void> {
    if (!this.db.emails) {
      throw new Error('Emails collection not initialized')
    }

    // Find by Outlook message ID (stored with outlook- prefix)
    const id = `outlook-${messageId}`
    const existing = await this.db.emails.findOne(id).exec()
    if (existing) {
      await existing.remove()
    }
  }

  /**
   * Parse Microsoft Graph message and store in RxDB
   */
  private async storeEmail(accountId: string, message: GraphMessage): Promise<void> {
    if (!this.db.emails) {
      throw new Error('Emails collection not initialized')
    }

    // Parse from address (truncate to schema maxLength)
    const from = message.from
      ? {
          name: (message.from.emailAddress.name || '').slice(0, 200),
          email: message.from.emailAddress.address.slice(0, 200),
        }
      : { name: 'Unknown', email: 'unknown@unknown.com' }

    // Parse to addresses (handle empty/missing toRecipients)
    const to = (message.toRecipients || []).map((r) => ({
      name: (r.emailAddress.name || '').slice(0, 200),
      email: r.emailAddress.address.slice(0, 200),
    }))

    // Parse cc addresses
    const cc = message.ccRecipients?.map((r) => ({
      name: (r.emailAddress.name || '').slice(0, 200),
      email: r.emailAddress.address.slice(0, 200),
    }))

    // Parse body (handle missing body)
    const body: { html?: string; text?: string } = {}
    if (message.body?.contentType === 'html') {
      body.html = message.body.content
      body.text = message.bodyPreview
    } else if (message.body?.content) {
      body.text = message.body.content
    } else {
      body.text = message.bodyPreview || ''
    }

    // Map folder ID to name and normalize to lowercase (like Gmail)
    const rawFolderName = this.folderIdMap.get(message.parentFolderId) || message.parentFolderId
    const folderName = rawFolderName.toLowerCase()

    // Parse attachments if present
    const attachments =
      message.attachments?.map((att) => ({
        id: att.id.slice(0, 200),
        filename: (att.name || 'attachment').slice(0, 500),
        mimeType: (att.contentType || 'application/octet-stream').slice(0, 100),
        size: att.size,
        isInline: att.isInline,
        contentId: att.contentId?.slice(0, 200),
      })) || []

    // Build EmailDocument with schema-safe values (truncate to maxLength per schema)
    const emailDoc: EmailDocument = {
      id: `outlook-${message.id}`.slice(0, 200), // Prefix to avoid Gmail ID conflicts
      threadId: message.conversationId.slice(0, 200),
      from,
      to: to.length > 0 ? to : [{ name: 'Unknown', email: 'unknown@unknown.com' }],
      cc,
      subject: (message.subject || '(no subject)').slice(0, 2000),
      body,
      timestamp: new Date(message.receivedDateTime).getTime(),
      accountId: accountId.slice(0, 100), // schema maxLength: 100
      attachments,
      snippet: (message.bodyPreview || '').slice(0, 200), // schema maxLength: 200
      labels: (message.categories || []).map((l) => l.slice(0, 100)),
      folder: folderName.slice(0, 100),
      read: message.isRead,
      starred: message.flag?.flagStatus === 'flagged',
      importance: message.importance || 'normal',
      attributes: {},
    }

    // Insert or update email (upsert pattern)
    const existingId = `outlook-${message.id}`
    const existing = await this.db.emails.findOne(existingId).exec()
    if (existing) {
      await existing.update({
        $set: emailDoc,
      })
    } else {
      await this.db.emails.insert(emailDoc)
    }
  }

  /**
   * Utility sleep function
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
