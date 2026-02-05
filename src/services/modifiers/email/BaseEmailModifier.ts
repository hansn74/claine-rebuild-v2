/**
 * Base Email Modifier
 *
 * Epic 3: Offline-First Modifier Architecture
 * Story 3.2: Email Action Modifiers
 *
 * Abstract base class for all email modifiers.
 * Provides common functionality for email transformations and API calls.
 */

import { tokenStorageService } from '@/services/auth/tokenStorage'
import { gmailOAuthService } from '@/services/auth/gmailOAuth'
import { outlookOAuthService } from '@/services/auth/outlookOAuth'
import { logger } from '@/services/logger'
import type { EmailDocument } from '@/services/database/schemas/email.schema'
import type {
  Modifier,
  ModifierDocument,
  EmailModifierType,
  ProviderType,
  ModifierStatus,
} from '../types'
import { generateModifierId, MAX_ATTEMPTS } from '../types'

/**
 * Gmail API base URL
 */
export const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me'

/**
 * Microsoft Graph API base URL
 */
export const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0/me'

/**
 * Abstract base class for email modifiers
 */
export abstract class BaseEmailModifier implements Modifier<EmailDocument> {
  readonly id: string
  readonly entityId: string
  readonly threadId?: string
  readonly entityType = 'email' as const
  readonly createdAt: number
  readonly accountId: string
  readonly provider: ProviderType
  abstract readonly type: EmailModifierType

  status: ModifierStatus = 'pending'
  attempts = 0
  error?: string

  constructor(
    entityId: string,
    accountId: string,
    provider: ProviderType,
    id?: string,
    createdAt?: number,
    threadId?: string
  ) {
    this.id = id || generateModifierId()
    this.entityId = entityId
    this.accountId = accountId
    this.provider = provider
    this.createdAt = createdAt || Date.now()
    this.threadId = threadId
  }

  /**
   * Pure function that transforms email state locally.
   * Must be implemented by subclasses.
   */
  abstract modify(email: EmailDocument): EmailDocument

  /**
   * Idempotent function that syncs to backend.
   * Must be implemented by subclasses.
   */
  abstract persist(): Promise<void>

  /**
   * Get payload for serialization.
   * Must be implemented by subclasses.
   */
  abstract getPayload(): Record<string, unknown>

  /**
   * Serialize modifier for persistence
   */
  toDocument(): ModifierDocument {
    return {
      id: this.id,
      entityId: this.entityId,
      threadId: this.threadId,
      entityType: this.entityType,
      type: this.type,
      accountId: this.accountId,
      provider: this.provider,
      status: this.status,
      attempts: this.attempts,
      maxAttempts: MAX_ATTEMPTS,
      createdAt: this.createdAt,
      updatedAt: Date.now(),
      lastAttemptAt: undefined,
      error: this.error,
      payload: JSON.stringify(this.getPayload()),
    }
  }

  /**
   * Get access token for API calls with automatic refresh
   */
  protected async getAccessToken(): Promise<string> {
    const tokens = await tokenStorageService.getTokens(this.accountId)
    if (!tokens) {
      throw new Error(`No OAuth tokens found for account: ${this.accountId}`)
    }

    return tokens.access_token
  }

  /**
   * Refresh access token and retry
   */
  protected async refreshTokenAndRetry<T>(operation: (token: string) => Promise<T>): Promise<T> {
    const tokens = await tokenStorageService.getTokens(this.accountId)
    if (!tokens?.refresh_token) {
      throw new Error('No refresh token available for re-authentication')
    }

    logger.debug('email-modifier', 'Refreshing token...', {
      provider: this.provider,
      accountId: this.accountId,
    })

    const refreshed =
      this.provider === 'gmail'
        ? await gmailOAuthService.refreshAccessToken(tokens.refresh_token)
        : await outlookOAuthService.refreshAccessToken(tokens.refresh_token)

    await tokenStorageService.storeTokens(this.accountId, refreshed)

    return operation(refreshed.access_token)
  }

  /**
   * Execute Gmail API request with token refresh on 401
   */
  protected async executeGmailRequest(
    method: string,
    endpoint: string,
    body?: Record<string, unknown>
  ): Promise<Response> {
    const accessToken = await this.getAccessToken()
    const url = `${GMAIL_API_BASE}${endpoint}`

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    if (response.status === 401) {
      return this.refreshTokenAndRetry(async (newToken) => {
        const retryResponse = await fetch(url, {
          method,
          headers: {
            Authorization: `Bearer ${newToken}`,
            ...(body ? { 'Content-Type': 'application/json' } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
        })
        return retryResponse
      })
    }

    return response
  }

  /**
   * Execute Outlook Graph API request with token refresh on 401
   */
  protected async executeOutlookRequest(
    method: string,
    endpoint: string,
    body?: Record<string, unknown>
  ): Promise<Response> {
    const accessToken = await this.getAccessToken()
    const url = `${GRAPH_API_BASE}${endpoint}`

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    if (response.status === 401) {
      return this.refreshTokenAndRetry(async (newToken) => {
        const retryResponse = await fetch(url, {
          method,
          headers: {
            Authorization: `Bearer ${newToken}`,
            ...(body ? { 'Content-Type': 'application/json' } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
        })
        return retryResponse
      })
    }

    return response
  }

  /**
   * Parse error from API response
   */
  protected async parseApiError(response: Response): Promise<string> {
    try {
      const data = await response.json()
      return data.error?.message || response.statusText
    } catch {
      return `${response.status} ${response.statusText}`
    }
  }
}
