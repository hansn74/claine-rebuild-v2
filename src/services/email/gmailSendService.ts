/**
 * Gmail Send Service
 *
 * Implements the ISendProvider interface for sending emails via Gmail API.
 * Uses OAuth 2.0 tokens and RFC 2822 email formatting.
 *
 * Story 2.4: Offline-First Send Queue
 * Task 4: Implement Gmail Send Integration
 *
 * References:
 * - Gmail API messages.send: https://developers.google.com/gmail/api/reference/rest/v1/users.messages/send
 * - RFC 2822: Email message format
 */

import { gmailOAuthService } from '@/services/auth/gmailOAuth'
import { tokenStorageService } from '@/services/auth/tokenStorage'
import { logger } from '@/services/logger'
import type { ISendProvider } from './sendQueueService'
import type { SendQueueDocument } from '@/services/database/schemas/sendQueue.schema'

/**
 * Gmail API endpoints
 */
const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1'
const GMAIL_SEND_ENDPOINT = `${GMAIL_API_BASE}/users/me/messages/send`

/**
 * Gmail API send response
 */
interface GmailSendResponse {
  id: string
  threadId: string
  labelIds: string[]
}

/**
 * Gmail Send Service
 *
 * Implements email sending via Gmail API with OAuth 2.0 authentication.
 * Handles RFC 2822 message formatting and token refresh.
 */
export class GmailSendService implements ISendProvider {
  private static instance: GmailSendService

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): GmailSendService {
    if (!GmailSendService.instance) {
      GmailSendService.instance = new GmailSendService()
    }
    return GmailSendService.instance
  }

  /**
   * Send an email via Gmail API
   *
   * @param item - Queue item containing email data
   * @returns Gmail message ID of the sent email
   * @throws Error if send fails
   */
  async sendEmail(item: SendQueueDocument): Promise<string> {
    logger.debug('sendQueue', 'Sending email via Gmail', {
      id: item.id,
      accountId: item.accountId,
    })

    // Get access token (with refresh if needed)
    const accessToken = await this.getValidAccessToken(item.accountId)

    // Format email as RFC 2822
    const rawMessage = this.formatRfc2822Message(item)

    // Encode as base64url
    const encodedMessage = this.base64UrlEncode(rawMessage)

    // Prepare request body
    const body: { raw: string; threadId?: string } = {
      raw: encodedMessage,
    }

    // Include threadId for replies to keep in same thread
    if (item.threadId) {
      body.threadId = item.threadId
    }

    // Send via Gmail API
    const response = await fetch(GMAIL_SEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      const errorMessage =
        errorData.error?.message || `Gmail API error: ${response.status} ${response.statusText}`

      logger.error('sendQueue', 'Gmail send failed', {
        id: item.id,
        status: response.status,
        error: errorMessage,
      })

      throw new Error(errorMessage)
    }

    const result: GmailSendResponse = await response.json()

    logger.info('sendQueue', 'Gmail send successful', {
      id: item.id,
      messageId: result.id,
      threadId: result.threadId,
    })

    return result.id
  }

  /**
   * Get a valid access token, refreshing if necessary
   *
   * @param accountId - Account identifier (e.g., 'gmail:user@example.com')
   * @returns Valid access token
   * @throws Error if tokens not found or refresh fails
   */
  private async getValidAccessToken(accountId: string): Promise<string> {
    // Extract email from accountId (format: 'gmail:user@example.com')
    const email = accountId.replace('gmail:', '')

    // Get stored tokens
    const tokens = await tokenStorageService.getTokens(email)
    if (!tokens) {
      throw new Error(`No tokens found for account: ${accountId}`)
    }

    // Check if token is expired or about to expire (5 minute buffer)
    const expiresAt = new Date(tokens.expires_at)
    const buffer = 5 * 60 * 1000 // 5 minutes
    const isExpired = expiresAt.getTime() - Date.now() < buffer

    if (!isExpired) {
      return tokens.access_token
    }

    // Token is expired, refresh it
    logger.debug('sendQueue', 'Refreshing expired Gmail token', { accountId })

    if (!tokens.refresh_token) {
      throw new Error(`No refresh token available for account: ${accountId}`)
    }

    try {
      const newTokens = await gmailOAuthService.refreshAccessToken(tokens.refresh_token)

      // Store new tokens
      await tokenStorageService.storeTokens(email, newTokens)

      logger.info('sendQueue', 'Gmail token refreshed successfully', { accountId })

      return newTokens.access_token
    } catch (error) {
      logger.error('sendQueue', 'Gmail token refresh failed', {
        accountId,
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      throw new Error(
        `Token refresh failed for ${accountId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Format email content as RFC 2822 message
   *
   * RFC 2822 message format:
   * - Headers (From, To, Subject, etc.)
   * - Blank line
   * - Body (MIME encoded for HTML)
   * - Attachments (if present)
   *
   * @param item - Queue item containing email data
   * @returns RFC 2822 formatted email string
   */
  private formatRfc2822Message(item: SendQueueDocument): string {
    const lines: string[] = []

    // Extract sender email from accountId
    const fromEmail = item.accountId.replace('gmail:', '')

    // From header
    lines.push(`From: ${fromEmail}`)

    // To header
    if (item.to.length > 0) {
      const toAddrs = item.to
        .map((addr) => (addr.name ? `"${addr.name}" <${addr.email}>` : addr.email))
        .join(', ')
      lines.push(`To: ${toAddrs}`)
    }

    // Cc header
    if (item.cc.length > 0) {
      const ccAddrs = item.cc
        .map((addr) => (addr.name ? `"${addr.name}" <${addr.email}>` : addr.email))
        .join(', ')
      lines.push(`Cc: ${ccAddrs}`)
    }

    // Bcc header (will be stripped by Gmail but needed for sending)
    if (item.bcc.length > 0) {
      const bccAddrs = item.bcc
        .map((addr) => (addr.name ? `"${addr.name}" <${addr.email}>` : addr.email))
        .join(', ')
      lines.push(`Bcc: ${bccAddrs}`)
    }

    // Subject header (handle UTF-8)
    const subject = this.encodeHeaderValue(item.subject)
    lines.push(`Subject: ${subject}`)

    // Add In-Reply-To and References headers for replies
    if (item.replyToEmailId && (item.type === 'reply' || item.type === 'reply-all')) {
      const messageId = `<${item.replyToEmailId}@mail.gmail.com>`
      lines.push(`In-Reply-To: ${messageId}`)
      lines.push(`References: ${messageId}`)
    }

    // Check if we have attachments
    const hasAttachments = item.attachments && item.attachments.length > 0

    // MIME headers
    lines.push('MIME-Version: 1.0')

    if (hasAttachments) {
      // Use multipart/mixed for messages with attachments
      const mixedBoundary = `----=_Mixed_${Date.now()}_${Math.random().toString(36).slice(2)}`
      const altBoundary = `----=_Alt_${Date.now()}_${Math.random().toString(36).slice(2)}`

      lines.push(`Content-Type: multipart/mixed; boundary="${mixedBoundary}"`)
      lines.push('')

      // Body part (multipart/alternative for text and HTML)
      lines.push(`--${mixedBoundary}`)
      lines.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`)
      lines.push('')

      // Plain text part
      lines.push(`--${altBoundary}`)
      lines.push('Content-Type: text/plain; charset="UTF-8"')
      lines.push('Content-Transfer-Encoding: quoted-printable')
      lines.push('')
      lines.push(this.encodeQuotedPrintable(item.body.text || ''))

      // HTML part
      lines.push(`--${altBoundary}`)
      lines.push('Content-Type: text/html; charset="UTF-8"')
      lines.push('Content-Transfer-Encoding: quoted-printable')
      lines.push('')
      lines.push(this.encodeQuotedPrintable(item.body.html || ''))

      // End alternative boundary
      lines.push(`--${altBoundary}--`)

      // Add each attachment
      for (const attachment of item.attachments) {
        lines.push(`--${mixedBoundary}`)
        lines.push(
          `Content-Type: ${attachment.mimeType}; name="${this.encodeHeaderValue(attachment.filename)}"`
        )
        lines.push('Content-Transfer-Encoding: base64')
        lines.push(
          `Content-Disposition: attachment; filename="${this.encodeHeaderValue(attachment.filename)}"`
        )
        lines.push('')

        // Add base64 content (line-wrapped at 76 characters)
        if (attachment.content) {
          const base64Content = attachment.content
          for (let i = 0; i < base64Content.length; i += 76) {
            lines.push(base64Content.slice(i, i + 76))
          }
        }
      }

      // End mixed boundary
      lines.push(`--${mixedBoundary}--`)
    } else {
      // No attachments - use simple multipart/alternative
      const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2)}`
      lines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`)

      // Blank line before body
      lines.push('')

      // Plain text part
      lines.push(`--${boundary}`)
      lines.push('Content-Type: text/plain; charset="UTF-8"')
      lines.push('Content-Transfer-Encoding: quoted-printable')
      lines.push('')
      lines.push(this.encodeQuotedPrintable(item.body.text || ''))

      // HTML part
      lines.push(`--${boundary}`)
      lines.push('Content-Type: text/html; charset="UTF-8"')
      lines.push('Content-Transfer-Encoding: quoted-printable')
      lines.push('')
      lines.push(this.encodeQuotedPrintable(item.body.html || ''))

      // End boundary
      lines.push(`--${boundary}--`)
    }

    return lines.join('\r\n')
  }

  /**
   * Encode header value for UTF-8 support (RFC 2047)
   *
   * @param value - Header value to encode
   * @returns Encoded header value
   */
  private encodeHeaderValue(value: string): string {
    // Check if encoding is needed (non-ASCII characters)
    if (/^[\x20-\x7E]+$/.test(value)) {
      return value
    }

    // Encode using RFC 2047 base64 encoding
    const encoder = new TextEncoder()
    const bytes = encoder.encode(value)
    const base64 = btoa(String.fromCharCode(...bytes))

    return `=?UTF-8?B?${base64}?=`
  }

  /**
   * Encode string as quoted-printable
   *
   * @param text - Text to encode
   * @returns Quoted-printable encoded string
   */
  private encodeQuotedPrintable(text: string): string {
    const encoder = new TextEncoder()
    const bytes = encoder.encode(text)
    const lines: string[] = []
    let line = ''

    for (const byte of bytes) {
      let char: string

      // Characters that don't need encoding
      if ((byte >= 33 && byte <= 60) || (byte >= 62 && byte <= 126)) {
        char = String.fromCharCode(byte)
      } else if (byte === 32) {
        // Space - encode at end of line only
        char = ' '
      } else if (byte === 9) {
        // Tab
        char = '\t'
      } else if (byte === 13 || byte === 10) {
        // CR/LF - output as newline
        if (line.length > 0) {
          lines.push(line)
          line = ''
        }
        continue
      } else {
        // Encode as =XX
        char = '=' + byte.toString(16).toUpperCase().padStart(2, '0')
      }

      // Check line length (max 76 chars)
      if (line.length + char.length > 75) {
        lines.push(line + '=') // Soft line break
        line = char
      } else {
        line += char
      }
    }

    // Add final line
    if (line.length > 0) {
      lines.push(line)
    }

    return lines.join('\r\n')
  }

  /**
   * Encode string as base64url (URL-safe base64 without padding)
   *
   * @param str - String to encode
   * @returns Base64url encoded string
   */
  private base64UrlEncode(str: string): string {
    // Convert string to bytes
    const encoder = new TextEncoder()
    const bytes = encoder.encode(str)

    // Convert to base64
    const base64 = btoa(String.fromCharCode(...bytes))

    // Make URL-safe (replace + with -, / with _, remove padding)
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }
}

// Export singleton instance
export const gmailSendService = GmailSendService.getInstance()
