/**
 * Quoted Text Parser Utility
 *
 * Story 2.2: Thread Detail View with Conversation History
 * Task 5: Implement Quoted Text Handling
 *
 * Parses email content to separate main content from quoted text.
 * Supports both plain text (> prefix) and HTML (blockquote).
 */

/**
 * Result of parsing content for quoted text
 */
export interface ParsedContent {
  /** The main message content without quoted text */
  mainContent: string
  /** The quoted/reply text (if any) */
  quotedContent: string | null
  /** Whether quoted text was found */
  hasQuotedText: boolean
}

/**
 * Common patterns that indicate the start of a quote
 */
const QUOTE_HEADER_PATTERNS = [
  /^On .+ wrote:$/m, // "On Mon, Jan 1, 2024, John wrote:"
  /^-+\s*Original Message\s*-+$/im, // "--- Original Message ---"
  /^From:\s+.+$/m, // "From: sender@example.com"
  /^>{2,}/m, // Multiple quote markers
]

/**
 * Parse email content to separate main content from quoted text
 *
 * @param content - The email body content
 * @param isHtml - Whether the content is HTML
 * @returns Parsed content with main and quoted sections
 */
export function parseQuotedText(content: string, isHtml: boolean): ParsedContent {
  if (!content || content.trim() === '') {
    return {
      mainContent: '',
      quotedContent: null,
      hasQuotedText: false,
    }
  }

  if (isHtml) {
    return parseHtmlQuotes(content)
  }
  return parsePlainTextQuotes(content)
}

/**
 * Parse plain text email for quoted content
 * Detects > prefixed lines and common quote headers
 */
function parsePlainTextQuotes(text: string): ParsedContent {
  const lines = text.split('\n')
  const mainLines: string[] = []
  const quotedLines: string[] = []
  let inQuote = false

  // First pass: find where the quote starts
  for (const line of lines) {
    // Check for quote indicators
    if (!inQuote) {
      // Check for > prefix
      if (line.trimStart().startsWith('>')) {
        inQuote = true
        quotedLines.push(line)
        continue
      }

      // Check for quote header patterns
      for (const pattern of QUOTE_HEADER_PATTERNS) {
        if (pattern.test(line)) {
          inQuote = true
          quotedLines.push(line)
          break
        }
      }

      if (!inQuote) {
        mainLines.push(line)
      }
    } else {
      quotedLines.push(line)
    }
  }

  // Clean up trailing empty lines from main content
  while (mainLines.length > 0 && mainLines[mainLines.length - 1].trim() === '') {
    mainLines.pop()
  }

  return {
    mainContent: mainLines.join('\n'),
    quotedContent: quotedLines.length > 0 ? quotedLines.join('\n') : null,
    hasQuotedText: quotedLines.length > 0,
  }
}

/**
 * Parse HTML email for quoted content
 * Detects blockquote elements and Gmail/Outlook quote divs
 */
function parseHtmlQuotes(html: string): ParsedContent {
  // Use DOM parser to find blockquote elements
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  let quotedContent = ''

  // Find and extract blockquote elements
  const blockquotes = doc.querySelectorAll('blockquote')
  blockquotes.forEach((bq) => {
    quotedContent += bq.outerHTML
    bq.remove()
  })

  // Also check for Gmail-style quoted content
  const gmailQuotes = doc.querySelectorAll('.gmail_quote, .gmail_extra')
  gmailQuotes.forEach((gq) => {
    quotedContent += gq.outerHTML
    gq.remove()
  })

  // Check for Outlook-style quoted content
  const outlookQuotes = doc.querySelectorAll(
    '[style*="border-left"][style*="padding-left"], .OutlookMessageHeader'
  )
  outlookQuotes.forEach((oq) => {
    quotedContent += oq.outerHTML
    oq.remove()
  })

  // Check for common quote dividers
  const quoteDividers = doc.querySelectorAll('div[style*="border-top"]')
  quoteDividers.forEach((div) => {
    const text = div.textContent || ''
    if (text.includes('Original Message') || text.includes('wrote:')) {
      // Get this element and everything after it
      let current: Element | null = div
      while (current) {
        quotedContent += current.outerHTML
        const next = current.nextElementSibling
        current.remove()
        current = next
      }
    }
  })

  return {
    mainContent: doc.body.innerHTML.trim(),
    quotedContent: quotedContent || null,
    hasQuotedText: quotedContent.length > 0,
  }
}

/**
 * Strip > prefix from quoted text lines for display
 *
 * @param quotedText - Text with > prefixes
 * @returns Text with > prefixes removed
 */
export function stripQuotePrefix(quotedText: string): string {
  return quotedText
    .split('\n')
    .map((line) => {
      const trimmed = line.trimStart()
      if (trimmed.startsWith('>')) {
        return trimmed.slice(1).trimStart()
      }
      return line
    })
    .join('\n')
}
