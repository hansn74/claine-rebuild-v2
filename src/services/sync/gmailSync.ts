/**
 * Gmail Sync Service
 * Implements email synchronization using Gmail API
 *
 * Features:
 * - Initial sync: Last 90 days of emails (configurable)
 * - Incremental sync: History API delta sync every 2-5 minutes
 * - Rate limiting: 250 quota units/second
 * - Network resilience: Resume sync after interruptions
 * - Multi-account: Independent sync per account
 */

import type { AppDatabase } from '../database/types'
import type { EmailDocument } from '../database/schemas/email.schema'
import { createGmailRateLimiter, type RateLimiter } from './rateLimiter'
import { SyncProgressService } from './syncProgress'
import { tokenStorageService } from '../auth/tokenStorage'
import { gmailOAuthService } from '../auth/gmailOAuth'
import { SyncFailureService } from './syncFailureService'
import { classifyHttpError, shouldRetry } from './errorClassification'
import { waitForRetry, DEFAULT_RETRY_CONFIG } from './retryEngine'
import { logger } from '@/services/logger'

/**
 * Gmail API Message resource (simplified)
 * Full spec: https://developers.google.com/gmail/api/reference/rest/v1/users.messages
 */
interface GmailMessage {
  id: string
  threadId: string
  historyId: string
  internalDate: string
  snippet: string
  labelIds?: string[]
  payload: {
    mimeType?: string
    headers: Array<{ name: string; value: string }>
    parts?: Array<{
      mimeType: string
      body: { data?: string }
      parts?: Array<{ mimeType: string; body: { data?: string } }>
    }>
    body: { data?: string }
  }
}

/**
 * Gmail API Messages.list response
 */
interface GmailMessagesListResponse {
  messages?: Array<{ id: string; threadId: string }>
  nextPageToken?: string
  resultSizeEstimate?: number
}

/**
 * Gmail API History.list response
 * https://developers.google.com/gmail/api/reference/rest/v1/users.history/list
 */
interface GmailHistoryListResponse {
  history?: Array<{
    id: string
    messages?: Array<{ id: string; threadId: string }>
    messagesAdded?: Array<{ message: { id: string; threadId: string } }>
    messagesDeleted?: Array<{ message: { id: string; threadId: string } }>
    labelsAdded?: Array<{ message: { id: string; threadId: string } }>
    labelsRemoved?: Array<{ message: { id: string; threadId: string } }>
  }>
  nextPageToken?: string
  historyId: string
}

/**
 * Gmail Sync Service
 */
export class GmailSyncService {
  private db: AppDatabase
  private rateLimiter: RateLimiter
  private progressService: SyncProgressService
  private failureService: SyncFailureService
  private syncInterval: number
  private syncDaysInitial: number
  private activeSync: Map<string, boolean> = new Map() // accountId → is syncing
  private pausedSyncs: Set<string> = new Set() // accountId → paused due to offline
  private onlineListenerAdded = false

  constructor(db: AppDatabase) {
    this.db = db
    this.rateLimiter = createGmailRateLimiter()
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
   * Start sync for a Gmail account
   * Performs initial sync if not complete, otherwise incremental sync
   */
  async startSync(accountId: string): Promise<void> {
    // Prevent concurrent sync for same account
    if (this.activeSync.get(accountId)) {
      throw new Error(`Sync already in progress for account: ${accountId}`)
    }

    this.activeSync.set(accountId, true)

    try {
      // Initialize sync state if needed
      await this.progressService.initializeSyncState(accountId, 'gmail')

      // Get current sync progress
      const progress = await this.progressService.getProgress(accountId)
      if (!progress) {
        throw new Error(`Failed to initialize sync state for account: ${accountId}`)
      }

      // Check if initial sync is complete
      if (!progress || progress.progressPercentage < 100) {
        await this.performInitialSync(accountId)
      } else {
        await this.performIncrementalSync(accountId)
      }

      // Schedule next sync
      await this.progressService.scheduleNextSync(accountId, this.syncInterval)
    } finally {
      this.activeSync.delete(accountId)
    }
  }

  /**
   * Perform initial sync (last 90 days)
   * Uses Gmail API messages.list with date filter
   */
  private async performInitialSync(accountId: string): Promise<void> {
    // Check network before starting (AC6)
    if (!navigator.onLine) {
      logger.info('sync', 'Offline - pausing sync', { accountId })
      this.pausedSyncs.add(accountId)
      await this.progressService.updateProgress(accountId, {
        status: 'paused',
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
    const afterDate = Math.floor((Date.now() - daysAgo * 24 * 60 * 60 * 1000) / 1000)

    // Get current progress to check for resume
    const currentProgress = await this.progressService.getProgress(accountId)
    let pageToken: string | undefined = currentProgress?.pageToken
    let syncedMessages = currentProgress?.emailsSynced || 0
    let totalMessages = currentProgress?.totalEmailsToSync || 0

    // Update status to syncing
    await this.progressService.updateProgress(accountId, {
      emailsSynced: syncedMessages,
      status: 'syncing',
    })

    try {
      do {
        // Check if network is still online (AC6)
        if (!navigator.onLine) {
          logger.info('sync', 'Offline detected - pausing sync', { accountId })
          this.pausedSyncs.add(accountId)
          await this.progressService.updateProgress(accountId, {
            status: 'paused',
            pageToken: pageToken, // Save for resume
          })
          return
        }

        // Rate limiting (1 unit for messages.list)
        await this.rateLimiter.acquireAndWait(1)

        // Build query (inbox emails from last N days)
        const query = `after:${afterDate}`
        const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages')
        url.searchParams.set('q', query)
        url.searchParams.set('maxResults', '500') // Max per page
        if (pageToken) {
          url.searchParams.set('pageToken', pageToken)
        }

        const listResponse = await fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
          },
        })

        if (!listResponse.ok) {
          if (listResponse.status === 401) {
            // Token expired, attempt refresh
            try {
              const refreshed = await gmailOAuthService.refreshAccessToken(tokens.refresh_token)
              await tokenStorageService.storeTokens(accountId, refreshed)
              // Update local tokens reference and continue
              tokens.access_token = refreshed.access_token
              continue // Retry this iteration with new token
            } catch {
              throw new Error('Token refresh failed. User must re-authenticate.')
            }
          }
          throw new Error(`Gmail API error: ${listResponse.status} ${listResponse.statusText}`)
        }

        const listData: GmailMessagesListResponse = await listResponse.json()

        // Update total estimate on first page
        if (totalMessages === 0 && listData.resultSizeEstimate) {
          totalMessages = listData.resultSizeEstimate
          await this.progressService.updateProgress(accountId, {
            emailsSynced: syncedMessages,
            totalEmailsToSync: totalMessages,
          })
        }

        // Fetch full message details in batches
        // AC 1, 2: Track successful vs failed emails separately
        if (listData.messages && listData.messages.length > 0) {
          let batchFailedCount = 0

          for (const msgRef of listData.messages) {
            // Check network before each message fetch (AC6)
            if (!navigator.onLine) {
              logger.info('sync', 'Offline detected - pausing sync', { accountId })
              this.pausedSyncs.add(accountId)
              await this.progressService.updateProgress(accountId, {
                status: 'paused',
                pageToken: pageToken,
              })
              return
            }

            // Rate limiting (5 units for messages.get with full format)
            await this.rateLimiter.acquireAndWait(5)

            // AC 1, 2: Wrap individual message fetch in try/catch for partial failure handling
            try {
              const message = await this.fetchMessageWithRetry(
                accountId,
                msgRef.id,
                tokens.access_token
              )
              await this.storeEmail(accountId, message)

              // Mark any existing failure as resolved
              await this.failureService.markResolvedByEmailId(msgRef.id, accountId)

              syncedMessages++
            } catch (error) {
              // Record the failure for retry
              logger.warn('sync', 'Failed to fetch message', {
                messageId: msgRef.id,
                error: error instanceof Error ? error.message : error,
              })

              await this.failureService.recordFailure(msgRef.id, accountId, 'gmail', error)
              batchFailedCount++
            }

            // Update progress every 10 messages
            if ((syncedMessages + batchFailedCount) % 10 === 0) {
              await this.progressService.updateProgress(accountId, {
                emailsSynced: syncedMessages,
                totalEmailsToSync: totalMessages,
                pageToken: listData.nextPageToken, // Save current position
              })
            }
          }
        }

        pageToken = listData.nextPageToken
      } while (pageToken)

      // Get latest historyId from most recent email for incremental sync
      const latestEmail = await this.db.emails
        ?.find({
          selector: {
            accountId: accountId,
          },
          sort: [{ timestamp: 'desc' }],
          limit: 1,
        })
        .exec()

      const latestHistoryId = latestEmail?.[0]?.historyId

      // Mark sync complete and store historyId
      await this.progressService.markSyncComplete(accountId, latestHistoryId)
    } catch (error) {
      // Save error state for debugging
      await this.progressService.updateProgress(accountId, {
        status: 'error',
        lastError: error instanceof Error ? error.message : 'Unknown error',
      })
      throw error
    }
  }

  /**
   * Perform incremental sync using History API
   * Fetches changes since last historyId (AC4)
   */
  private async performIncrementalSync(accountId: string): Promise<void> {
    // Check network before starting (AC6)
    if (!navigator.onLine) {
      logger.info('sync', 'Offline - skipping incremental sync', { accountId })
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

    // Get last historyId from syncToken (stored after initial sync)
    const startHistoryId = progress.syncToken
    if (!startHistoryId) {
      logger.info('sync', 'No historyId found, performing initial sync instead', { accountId })
      return await this.performInitialSync(accountId)
    }

    try {
      await this.progressService.updateProgress(accountId, {
        status: 'syncing',
      })

      let pageToken: string | undefined
      let newMessagesCount = 0
      let latestHistoryId = startHistoryId

      do {
        // Check network (AC6)
        if (!navigator.onLine) {
          logger.info('sync', 'Offline detected - pausing incremental sync', { accountId })
          await this.progressService.updateProgress(accountId, {
            status: 'idle',
          })
          return
        }

        // Rate limiting (1 unit for history.list)
        await this.rateLimiter.acquireAndWait(1)

        // Build History API request
        const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/history')
        url.searchParams.set('startHistoryId', startHistoryId)
        if (pageToken) {
          url.searchParams.set('pageToken', pageToken)
        }

        const historyResponse = await fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
          },
        })

        if (!historyResponse.ok) {
          if (historyResponse.status === 401) {
            // Token expired, attempt refresh
            try {
              const refreshed = await gmailOAuthService.refreshAccessToken(tokens.refresh_token)
              await tokenStorageService.storeTokens(accountId, refreshed)
              tokens.access_token = refreshed.access_token
              continue // Retry with new token
            } catch {
              throw new Error('Token refresh failed. User must re-authenticate.')
            }
          }
          if (historyResponse.status === 404) {
            // History ID too old, fallback to full sync
            logger.info('sync', 'History ID expired, performing full sync', { accountId })
            return await this.performInitialSync(accountId)
          }
          throw new Error(`Gmail History API error: ${historyResponse.status}`)
        }

        const historyData: GmailHistoryListResponse = await historyResponse.json()
        latestHistoryId = historyData.historyId

        // Process history records
        // AC 1, 2: Track successful vs failed emails separately
        if (historyData.history && historyData.history.length > 0) {
          for (const historyRecord of historyData.history) {
            // Process messagesAdded (new emails)
            if (historyRecord.messagesAdded) {
              for (const addedMsg of historyRecord.messagesAdded) {
                // Rate limiting (5 units for messages.get)
                await this.rateLimiter.acquireAndWait(5)

                try {
                  const message = await this.fetchMessageWithRetry(
                    accountId,
                    addedMsg.message.id,
                    tokens.access_token
                  )
                  await this.storeEmail(accountId, message)

                  // Mark any existing failure as resolved
                  await this.failureService.markResolvedByEmailId(addedMsg.message.id, accountId)

                  newMessagesCount++
                } catch (error) {
                  logger.warn('sync', 'Failed to fetch new message', {
                    messageId: addedMsg.message.id,
                    error: error instanceof Error ? error.message : error,
                  })
                  await this.failureService.recordFailure(
                    addedMsg.message.id,
                    accountId,
                    'gmail',
                    error
                  )
                }
              }
            }

            // Process messagesDeleted (emails deleted remotely)
            if (historyRecord.messagesDeleted) {
              for (const deletedMsg of historyRecord.messagesDeleted) {
                await this.deleteEmail(accountId, deletedMsg.message.id)
              }
            }

            // Process label changes (mark read/unread, starred, etc.)
            if (historyRecord.labelsAdded || historyRecord.labelsRemoved) {
              // For label changes, refetch the message to get updated state
              const msgId =
                historyRecord.labelsAdded?.[0]?.message.id ||
                historyRecord.labelsRemoved?.[0]?.message.id
              if (msgId) {
                await this.rateLimiter.acquireAndWait(5)
                try {
                  const message = await this.fetchMessageWithRetry(
                    accountId,
                    msgId,
                    tokens.access_token
                  )
                  await this.storeEmail(accountId, message)
                } catch (error) {
                  logger.warn('sync', 'Failed to update labels for message', {
                    messageId: msgId,
                    error: error instanceof Error ? error.message : error,
                  })
                  // Label updates are less critical - just log and continue
                }
              }
            }
          }
        }

        pageToken = historyData.nextPageToken
      } while (pageToken)

      // Update sync state with latest historyId
      await this.progressService.updateProgress(accountId, {
        status: 'idle',
        syncToken: latestHistoryId, // Save for next incremental sync
      })

      if (newMessagesCount > 0) {
        logger.info('sync', 'Incremental sync complete', { newMessagesCount })
      }
    } catch (error) {
      await this.progressService.updateProgress(accountId, {
        status: 'error',
        lastError: error instanceof Error ? error.message : 'Unknown error',
      })
      throw error
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
        await this.rateLimiter.acquireAndWait(5)

        const message = await this.fetchMessageWithRetry(
          accountId,
          failure.emailId,
          tokens.access_token
        )
        await this.storeEmail(accountId, message)

        // Mark as resolved
        await this.failureService.markResolved(failure.id)
        succeeded++

        logger.info('sync', 'Retry succeeded for message', { messageId: failure.emailId })
      } catch (error) {
        // Update failure with new attempt info
        await this.failureService.recordFailure(failure.emailId, accountId, 'gmail', error)

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

    const existing = await this.db.emails.findOne(messageId).exec()
    if (existing) {
      await existing.remove()
    }
  }

  /**
   * Fetch full message details from Gmail API with retry logic
   * AC 4: Exponential backoff retry for transient failures
   * AC 5: Maximum retry attempts configurable (default: 3)
   * AC 6: Delay between retries increases exponentially
   * AC 7: Permanent failures not retried
   */
  private async fetchMessageWithRetry(
    accountId: string,
    messageId: string,
    accessToken: string
  ): Promise<GmailMessage> {
    let lastError: Error | undefined
    let retryCount = 0

    while (retryCount <= DEFAULT_RETRY_CONFIG.maxRetries) {
      try {
        return await this.fetchMessage(accountId, messageId, accessToken)
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        // Check if we should retry
        const response = (error as { response?: Response }).response
        if (response) {
          const classification = classifyHttpError(response.status, response.headers)

          // AC 7: Don't retry permanent failures
          if (!shouldRetry(classification, retryCount, DEFAULT_RETRY_CONFIG.maxRetries)) {
            throw error
          }

          // AC 4, 5, 6: Wait with exponential backoff
          await waitForRetry(retryCount, classification.retryAfterMs)
          retryCount++
          continue
        }

        // Network error or unknown - retry with backoff
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
   * Fetch full message details from Gmail API
   */
  private async fetchMessage(
    _accountId: string,
    messageId: string,
    accessToken: string
  ): Promise<GmailMessage> {
    const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      // Create an error with the response attached for classification
      const error = new Error(
        `Failed to fetch message ${messageId}: ${response.status}`
      ) as Error & { response: Response }
      error.response = response
      throw error
    }

    return await response.json()
  }

  /**
   * Parse Gmail message and store in RxDB
   */
  private async storeEmail(accountId: string, message: GmailMessage): Promise<void> {
    if (!this.db.emails) {
      throw new Error('Emails collection not initialized')
    }

    // Parse headers
    const headers = message.payload.headers.reduce(
      (acc, h) => {
        acc[h.name.toLowerCase()] = h.value
        return acc
      },
      {} as Record<string, string>
    )

    // Parse from/to addresses
    const fromHeader = headers.from || ''
    const toHeader = headers.to || ''
    const ccHeader = headers.cc || ''

    const from = this.parseEmailAddress(fromHeader)
    const to = toHeader
      ? toHeader.split(',').map((addr) => this.parseEmailAddress(addr.trim()))
      : []
    const cc = ccHeader
      ? ccHeader.split(',').map((addr) => this.parseEmailAddress(addr.trim()))
      : undefined

    // Extract body (handle multipart messages)
    const { html, text } = this.extractBody(message.payload)

    // Parse labels
    const labels = message.labelIds || []
    const folder = labels.includes('INBOX') ? 'INBOX' : labels[0] || 'UNKNOWN'

    // Build EmailDocument
    const emailDoc: EmailDocument = {
      id: message.id,
      threadId: message.threadId,
      from,
      to,
      cc,
      subject: headers.subject || '(no subject)',
      body: {
        html,
        text: text || message.snippet,
      },
      timestamp: parseInt(message.internalDate, 10),
      accountId,
      attachments: [],
      snippet: message.snippet,
      labels,
      folder,
      read: !labels.includes('UNREAD'),
      starred: labels.includes('STARRED'),
      importance: 'normal',
      historyId: message.historyId,
      attributes: {},
    }

    // Insert or update email (upsert pattern)
    const existing = await this.db.emails.findOne(message.id).exec()
    if (existing) {
      await existing.update({
        $set: emailDoc,
      })
    } else {
      await this.db.emails.insert(emailDoc)
    }
  }

  /**
   * Extract email body from Gmail payload
   * Handles both simple and multipart messages
   */
  private extractBody(payload: GmailMessage['payload']): { html?: string; text?: string } {
    let html = ''
    let text = ''

    // Simple message (body in payload.body.data)
    if (payload.body.data) {
      const decoded = this.decodeBase64Url(payload.body.data)
      // If mimeType is text/html, it's HTML, otherwise plain text
      if (payload.mimeType === 'text/html') {
        html = decoded
      } else {
        text = decoded
      }
      return { html, text }
    }

    // Multipart message (body in parts)
    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body.data) {
          text = this.decodeBase64Url(part.body.data)
        } else if (part.mimeType === 'text/html' && part.body.data) {
          html = this.decodeBase64Url(part.body.data)
        } else if (part.parts) {
          // Nested multipart (e.g., multipart/alternative inside multipart/mixed)
          for (const nestedPart of part.parts) {
            if (nestedPart.mimeType === 'text/plain' && nestedPart.body.data) {
              text = this.decodeBase64Url(nestedPart.body.data)
            } else if (nestedPart.mimeType === 'text/html' && nestedPart.body.data) {
              html = this.decodeBase64Url(nestedPart.body.data)
            }
          }
        }
      }
    }

    return { html, text }
  }

  /**
   * Parse email address from header
   * Format: "Display Name <email@example.com>" or "email@example.com"
   */
  private parseEmailAddress(header: string): { name: string; email: string } {
    const match = header.match(/^(.*?)\s*<(.+)>$/)
    if (match) {
      return {
        name: match[1].replace(/"/g, '').trim(),
        email: match[2].trim(),
      }
    }
    return {
      name: header.trim(),
      email: header.trim(),
    }
  }

  /**
   * Decode base64url-encoded string
   * Gmail API uses base64url encoding for message bodies
   */
  private decodeBase64Url(data: string): string {
    try {
      // Convert base64url to base64
      const base64 = data.replace(/-/g, '+').replace(/_/g, '/')
      return atob(base64)
    } catch {
      return data // Return as-is if decoding fails
    }
  }
}
