/**
 * Mock Sync Server for CI Testing
 *
 * Simulates Gmail and Outlook sync APIs for testing sync engine
 * functionality without real API calls. Supports both initial
 * sync and delta (incremental) sync patterns.
 *
 * @tag @sync
 */

import {
  generateMockEmails,
  mockGmailHistoryResponse,
  mockGmailMessageResponse,
} from './mockEmailData'
import type { EmailDocument } from '../../database/schemas/email.schema'

/**
 * Configuration for mock sync server behavior
 */
export interface MockSyncServerConfig {
  /** Provider type (gmail or outlook) */
  provider: 'gmail' | 'outlook'
  /** Total number of emails in mock mailbox */
  totalEmails?: number
  /** Emails per page (default: 100) */
  pageSize?: number
  /** Simulate API failures */
  simulateFailures?: {
    /** Fail rate (0-1) */
    rate?: number
    /** Error type to simulate */
    errorType?: '401' | '403' | '429' | '500' | '503' | 'network'
    /** After how many successful calls to fail */
    failAfter?: number
  }
  /** Simulate rate limiting */
  simulateRateLimiting?: boolean
  /** Response delay in ms (default: 0) */
  responseDelay?: number
  /** Initial history ID (Gmail only) */
  initialHistoryId?: string
}

/**
 * Mock response from sync server
 */
interface SyncResponse<T> {
  ok: boolean
  status: number
  data?: T
  error?: string
  headers?: Record<string, string>
}

/**
 * Mock Sync Server
 *
 * Provides a configurable mock server that simulates email provider APIs
 * for testing sync engine functionality.
 *
 * @example
 * ```typescript
 * const server = new MockSyncServer({
 *   provider: 'gmail',
 *   totalEmails: 500,
 * })
 *
 * // Fetch initial email list
 * const response = await server.listMessages()
 *
 * // Fetch delta changes
 * const delta = await server.getHistoryChanges('12345')
 * ```
 */
export class MockSyncServer {
  private config: MockSyncServerConfig
  private emails: EmailDocument[] = []
  private callCount = 0
  private currentHistoryId: string

  constructor(config: MockSyncServerConfig) {
    this.config = {
      totalEmails: 100,
      pageSize: 100,
      responseDelay: 0,
      ...config,
    }

    // Pre-generate emails
    this.emails = generateMockEmails(this.config.totalEmails!, {
      provider: this.config.provider,
      accountId: `mock-${this.config.provider}-account`,
    })

    this.currentHistoryId = this.config.initialHistoryId || '1000000'
  }

  /**
   * Reset server state
   */
  reset(): void {
    this.callCount = 0
    this.currentHistoryId = this.config.initialHistoryId || '1000000'
    this.emails = generateMockEmails(this.config.totalEmails!, {
      provider: this.config.provider,
      accountId: `mock-${this.config.provider}-account`,
    })
  }

  /**
   * Configure server behavior
   */
  configure(config: Partial<MockSyncServerConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Simulate API delay
   */
  private async simulateDelay(): Promise<void> {
    if (this.config.responseDelay && this.config.responseDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.config.responseDelay))
    }
  }

  /**
   * Check if should simulate failure
   */
  private shouldSimulateFailure(): boolean {
    if (!this.config.simulateFailures) return false

    const { rate = 0, failAfter } = this.config.simulateFailures

    if (failAfter !== undefined && this.callCount < failAfter) {
      return false
    }

    return Math.random() < rate
  }

  /**
   * Get simulated error response
   */
  private getFailureResponse<T>(): SyncResponse<T> {
    const errorType = this.config.simulateFailures?.errorType || '500'

    const errors: Record<
      string,
      { status: number; error: string; headers?: Record<string, string> }
    > = {
      '401': { status: 401, error: 'Unauthorized - Token expired' },
      '403': { status: 403, error: 'Forbidden - Insufficient permissions' },
      '429': {
        status: 429,
        error: 'Too Many Requests',
        headers: { 'Retry-After': '60' },
      },
      '500': { status: 500, error: 'Internal Server Error' },
      '503': { status: 503, error: 'Service Unavailable' },
      network: { status: 0, error: 'Network Error - Connection refused' },
    }

    const errorConfig = errors[errorType] || errors['500']

    return {
      ok: false,
      status: errorConfig.status,
      error: errorConfig.error,
      headers: errorConfig.headers,
    }
  }

  /**
   * List messages (initial sync)
   *
   * @param pageToken - Page token for pagination
   * @returns Paginated message list
   */
  async listMessages(pageToken?: string): Promise<
    SyncResponse<{
      messages: Array<{ id: string; threadId?: string }>
      nextPageToken?: string
      resultSizeEstimate: number
    }>
  > {
    this.callCount++
    await this.simulateDelay()

    if (this.shouldSimulateFailure()) {
      return this.getFailureResponse()
    }

    const pageSize = this.config.pageSize!
    const page = pageToken ? parseInt(pageToken, 10) : 0
    const start = page * pageSize
    const end = Math.min(start + pageSize, this.emails.length)
    const pageEmails = this.emails.slice(start, end)

    const hasMore = end < this.emails.length
    const nextPageToken = hasMore ? (page + 1).toString() : undefined

    if (this.config.provider === 'gmail') {
      return {
        ok: true,
        status: 200,
        data: {
          messages: pageEmails.map((e) => ({ id: e.id, threadId: e.threadId })),
          nextPageToken,
          resultSizeEstimate: this.emails.length,
        },
      }
    } else {
      // Outlook format
      return {
        ok: true,
        status: 200,
        data: {
          messages: pageEmails.map((e) => ({ id: e.id })),
          nextPageToken,
          resultSizeEstimate: this.emails.length,
        },
      }
    }
  }

  /**
   * Get a single message by ID
   *
   * @param messageId - Message ID
   * @returns Full message details
   */
  async getMessage(messageId: string): Promise<SyncResponse<Record<string, unknown>>> {
    this.callCount++
    await this.simulateDelay()

    if (this.shouldSimulateFailure()) {
      return this.getFailureResponse()
    }

    const email = this.emails.find((e) => e.id === messageId)
    if (!email) {
      return {
        ok: false,
        status: 404,
        error: 'Message not found',
      }
    }

    if (this.config.provider === 'gmail') {
      return {
        ok: true,
        status: 200,
        data: mockGmailMessageResponse(email.id, email.threadId, {
          hasAttachment: email.attachments.length > 0,
          isUnread: !email.read,
          timestamp: email.timestamp,
        }),
      }
    } else {
      // Outlook format
      return {
        ok: true,
        status: 200,
        data: {
          id: email.id,
          conversationId: email.threadId,
          subject: email.subject,
          from: {
            emailAddress: {
              name: email.from.name,
              address: email.from.email,
            },
          },
          toRecipients: email.to.map((t) => ({
            emailAddress: { name: t.name, address: t.email },
          })),
          body: {
            contentType: 'html',
            content: email.body.html || email.body.text || '',
          },
          receivedDateTime: new Date(email.timestamp).toISOString(),
          isRead: email.read,
          hasAttachments: email.attachments.length > 0,
        },
      }
    }
  }

  /**
   * Get history changes since a history ID (Gmail delta sync)
   *
   * @param startHistoryId - Starting history ID
   * @returns History changes
   */
  async getHistoryChanges(startHistoryId: string): Promise<
    SyncResponse<{
      history: Array<{
        id: string
        messagesAdded?: Array<{ message: { id: string; threadId: string } }>
        messagesDeleted?: Array<{ message: { id: string; threadId: string } }>
      }>
      historyId: string
    }>
  > {
    this.callCount++
    await this.simulateDelay()

    if (this.shouldSimulateFailure()) {
      return this.getFailureResponse()
    }

    // Simulate history expired (404) for very old history IDs
    const startId = parseInt(startHistoryId, 10)
    const currentId = parseInt(this.currentHistoryId, 10)

    if (currentId - startId > 100000) {
      return {
        ok: false,
        status: 404,
        error: 'History ID expired',
      }
    }

    // Generate mock history with some new messages
    const mockHistory = mockGmailHistoryResponse(startHistoryId, 3, 0)

    // Update current history ID
    this.currentHistoryId = mockHistory.historyId

    return {
      ok: true,
      status: 200,
      data: mockHistory,
    }
  }

  /**
   * Get delta changes (Outlook delta sync)
   *
   * @param deltaLink - Delta link token
   * @returns Delta changes
   */
  async getDeltaChanges(_deltaLink?: string): Promise<
    SyncResponse<{
      value: Array<{
        id: string
        '@odata.type'?: string
        isRead?: boolean
        subject?: string
      }>
      '@odata.deltaLink'?: string
    }>
  > {
    this.callCount++
    await this.simulateDelay()

    if (this.shouldSimulateFailure()) {
      return this.getFailureResponse()
    }

    // Generate some mock changes
    const changes = []

    // Add 2-5 new messages
    const newCount = Math.floor(Math.random() * 4) + 2
    for (let i = 0; i < newCount; i++) {
      changes.push({
        id: `delta-new-${Date.now()}-${i}`,
        '@odata.type': '#microsoft.graph.message',
        subject: `New Message ${i + 1}`,
        isRead: false,
      })
    }

    return {
      ok: true,
      status: 200,
      data: {
        value: changes,
        '@odata.deltaLink': `https://graph.microsoft.com/v1.0/me/messages/delta?$deltatoken=${Date.now()}`,
      },
    }
  }

  /**
   * Add new emails to the mock server (simulate incoming mail)
   *
   * @param count - Number of emails to add
   * @returns Added email IDs
   */
  addNewEmails(count: number): string[] {
    const newEmails = generateMockEmails(count, {
      provider: this.config.provider,
      accountId: `mock-${this.config.provider}-account`,
      startDate: Date.now() - 3600000, // Last hour
      endDate: Date.now(),
    })

    this.emails.unshift(...newEmails)

    // Update history ID
    const currentId = parseInt(this.currentHistoryId, 10)
    this.currentHistoryId = (currentId + count).toString()

    return newEmails.map((e) => e.id)
  }

  /**
   * Get total call count (for rate limit testing)
   */
  getCallCount(): number {
    return this.callCount
  }

  /**
   * Get current history ID (Gmail)
   */
  getCurrentHistoryId(): string {
    return this.currentHistoryId
  }

  /**
   * Get all emails (for verification in tests)
   */
  getAllEmails(): EmailDocument[] {
    return [...this.emails]
  }
}

/**
 * Create a pre-configured Gmail mock server
 */
export function createGmailMockServer(config: Partial<MockSyncServerConfig> = {}): MockSyncServer {
  return new MockSyncServer({
    provider: 'gmail',
    totalEmails: 100,
    pageSize: 100,
    ...config,
  })
}

/**
 * Create a pre-configured Outlook mock server
 */
export function createOutlookMockServer(
  config: Partial<MockSyncServerConfig> = {}
): MockSyncServer {
  return new MockSyncServer({
    provider: 'outlook',
    totalEmails: 100,
    pageSize: 50, // Outlook default is 10-50
    ...config,
  })
}

/**
 * Global mock server instances for use in tests
 */
export const mockGmailSyncServer = createGmailMockServer()
export const mockOutlookSyncServer = createOutlookMockServer()
