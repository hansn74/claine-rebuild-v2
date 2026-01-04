/**
 * Email Parser Web Worker
 *
 * Story 2.10: Performance Optimization & Benchmarking
 * Task 5.2: Create email parser worker for email content parsing
 *
 * Offloads email parsing from raw API format to application format.
 * Handles header parsing, body decoding, and attachment extraction.
 */

import type {
  WorkerMessage,
  WorkerResponse,
  EmailParserMessageType,
  ParseEmailPayload,
  ParseEmailsBatchPayload,
  ExtractAttachmentsPayload,
  RawEmailData,
  ParsedEmail,
  ExtractedAttachment,
} from './types'

// ============================================================================
// Email Address Parsing
// ============================================================================

/**
 * Parse email address from RFC 5322 format
 * Handles: "Display Name <email@example.com>" or just "email@example.com"
 */
function parseEmailAddress(raw: string): { name: string; email: string } {
  if (!raw) {
    return { name: '', email: '' }
  }

  const trimmed = raw.trim()

  // Try to match "Display Name <email@example.com>" format
  const match = trimmed.match(/^(.+?)\s*<([^>]+)>$/)
  if (match) {
    return {
      name: match[1].replace(/^["']|["']$/g, '').trim(),
      email: match[2].trim().toLowerCase(),
    }
  }

  // Just an email address
  const emailMatch = trimmed.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/)
  if (emailMatch) {
    return {
      name: '',
      email: emailMatch[1].toLowerCase(),
    }
  }

  // Fallback
  return { name: '', email: trimmed.toLowerCase() }
}

/**
 * Parse multiple email addresses (comma-separated)
 */
function parseEmailAddresses(raw: string): { name: string; email: string }[] {
  if (!raw) return []

  // Split by comma but not within quotes or angle brackets
  const addresses: string[] = []
  let current = ''
  let inQuotes = false
  let inAngleBrackets = false

  for (const char of raw) {
    if (char === '"' && !inAngleBrackets) {
      inQuotes = !inQuotes
      current += char
    } else if (char === '<' && !inQuotes) {
      inAngleBrackets = true
      current += char
    } else if (char === '>' && !inQuotes) {
      inAngleBrackets = false
      current += char
    } else if (char === ',' && !inQuotes && !inAngleBrackets) {
      if (current.trim()) {
        addresses.push(current.trim())
      }
      current = ''
    } else {
      current += char
    }
  }

  if (current.trim()) {
    addresses.push(current.trim())
  }

  return addresses.map(parseEmailAddress)
}

// ============================================================================
// Body Decoding
// ============================================================================

/**
 * Decode base64 string to UTF-8 text
 */
function decodeBase64(encoded: string): string {
  try {
    // Handle URL-safe base64 (Gmail uses this)
    const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/')

    // Decode
    const binaryString = atob(normalized)

    // Convert to UTF-8
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }

    return new TextDecoder('utf-8').decode(bytes)
  } catch {
    // Return empty string on decode error
    return ''
  }
}

/**
 * Decode quoted-printable encoding
 */
function decodeQuotedPrintable(text: string): string {
  return (
    text
      // Handle soft line breaks
      .replace(/=\r?\n/g, '')
      // Decode hex-encoded characters
      .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
  )
}

/**
 * Extract plain text from HTML
 */
function htmlToText(html: string): string {
  // Simple HTML to text conversion
  return (
    html
      // Remove style and script tags with content
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      // Convert line breaks
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/tr>/gi, '\n')
      .replace(/<\/li>/gi, '\n')
      // Remove all other tags
      .replace(/<[^>]+>/g, '')
      // Decode HTML entities
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      // Clean up whitespace
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  )
}

/**
 * Generate snippet from text
 */
function generateSnippet(text: string, maxLength: number = 200): string {
  const cleaned = text.replace(/\s+/g, ' ').trim()

  if (cleaned.length <= maxLength) {
    return cleaned
  }

  return cleaned.substring(0, maxLength - 3) + '...'
}

// ============================================================================
// Header Parsing
// ============================================================================

/**
 * Parse timestamp from various date formats
 */
function parseTimestamp(dateStr: string): number {
  if (!dateStr) return Date.now()

  try {
    const parsed = new Date(dateStr)
    if (!isNaN(parsed.getTime())) {
      return parsed.getTime()
    }
  } catch {
    // Fall through to default
  }

  return Date.now()
}

/**
 * Get header value (case-insensitive)
 */
function getHeader(headers: Record<string, string>, name: string): string {
  const lowerName = name.toLowerCase()
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lowerName) {
      return value
    }
  }
  return ''
}

// ============================================================================
// Email Parsing
// ============================================================================

/**
 * Parse a single raw email into application format
 */
function parseEmail(rawEmail: RawEmailData): ParsedEmail {
  const { id, threadId, headers, bodyParts, attachments = [] } = rawEmail

  // Parse headers
  const from = parseEmailAddress(getHeader(headers, 'From'))
  const to = parseEmailAddresses(getHeader(headers, 'To'))
  const cc = parseEmailAddresses(getHeader(headers, 'Cc'))
  const bcc = parseEmailAddresses(getHeader(headers, 'Bcc'))
  const subject = getHeader(headers, 'Subject') || '(No Subject)'
  const timestamp = parseTimestamp(getHeader(headers, 'Date'))

  // Parse body parts
  let htmlBody = ''
  let textBody = ''

  for (const part of bodyParts) {
    let content = part.body

    // Decode if base64
    if (part.isBase64) {
      content = decodeBase64(content)
    }

    // Check for quoted-printable
    const contentTransferEncoding = getHeader(headers, 'Content-Transfer-Encoding')
    if (contentTransferEncoding?.toLowerCase() === 'quoted-printable') {
      content = decodeQuotedPrintable(content)
    }

    if (part.mimeType === 'text/html') {
      htmlBody = content
    } else if (part.mimeType === 'text/plain') {
      textBody = content
    }
  }

  // Generate text from HTML if no plain text
  if (!textBody && htmlBody) {
    textBody = htmlToText(htmlBody)
  }

  // Generate snippet
  const snippet = generateSnippet(textBody || htmlBody)

  // Parse attachments
  const parsedAttachments = attachments.map((att) => ({
    id: att.id,
    filename: att.filename,
    mimeType: att.mimeType,
    size: att.size,
    isInline: !!att.contentId,
    contentId: att.contentId,
  }))

  return {
    id,
    threadId,
    from,
    to,
    cc: cc.length > 0 ? cc : undefined,
    bcc: bcc.length > 0 ? bcc : undefined,
    subject,
    body: {
      html: htmlBody || undefined,
      text: textBody || undefined,
    },
    timestamp,
    attachments: parsedAttachments,
    snippet,
  }
}

/**
 * Parse a batch of raw emails
 */
function parseEmailsBatch(rawEmails: RawEmailData[]): ParsedEmail[] {
  return rawEmails.map(parseEmail)
}

/**
 * Extract attachments from body parts
 */
function extractAttachments(payload: ExtractAttachmentsPayload): ExtractedAttachment[] {
  const { emailId, bodyParts } = payload
  const attachments: ExtractedAttachment[] = []

  let attachmentIndex = 0

  for (const part of bodyParts) {
    // Skip text content parts
    if (part.mimeType === 'text/plain' || part.mimeType === 'text/html') {
      continue
    }

    // This is an attachment
    const id = `${emailId}-att-${attachmentIndex++}`
    const filename = part.filename || `attachment-${attachmentIndex}`
    const data = part.isBase64 ? part.body : btoa(part.body)
    const size = Math.round(data.length * 0.75) // Approximate decoded size

    attachments.push({
      id,
      filename,
      mimeType: part.mimeType,
      size,
      isInline: !!part.contentId,
      contentId: part.contentId,
      data,
    })
  }

  return attachments
}

// ============================================================================
// Message Handler
// ============================================================================

/**
 * Handle incoming messages from main thread
 */
self.onmessage = (event: MessageEvent<WorkerMessage<EmailParserMessageType>>) => {
  const { type, payload, messageId } = event.data
  const startTime = performance.now()

  let response: WorkerResponse<EmailParserMessageType>

  try {
    switch (type) {
      case 'PARSE_EMAIL': {
        const { rawEmail } = payload as ParseEmailPayload
        const result = parseEmail(rawEmail)
        response = {
          type,
          result,
          messageId,
          duration: performance.now() - startTime,
        }
        break
      }

      case 'PARSE_EMAILS_BATCH': {
        const { rawEmails } = payload as ParseEmailsBatchPayload
        const result = parseEmailsBatch(rawEmails)
        response = {
          type,
          result,
          messageId,
          duration: performance.now() - startTime,
        }
        break
      }

      case 'EXTRACT_ATTACHMENTS': {
        const result = extractAttachments(payload as ExtractAttachmentsPayload)
        response = {
          type,
          result,
          messageId,
          duration: performance.now() - startTime,
        }
        break
      }

      default:
        response = {
          type,
          error: `Unknown message type: ${type}`,
          messageId,
          duration: performance.now() - startTime,
        }
    }
  } catch (error) {
    response = {
      type,
      error: error instanceof Error ? error.message : 'Unknown error',
      messageId,
      duration: performance.now() - startTime,
    }
  }

  self.postMessage(response)
}

// Signal that worker is ready
self.postMessage({ type: 'READY', messageId: 'init', duration: 0 })
