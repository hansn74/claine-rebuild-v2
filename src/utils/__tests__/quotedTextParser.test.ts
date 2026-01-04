/**
 * Quoted Text Parser Utility Tests
 *
 * Story 2.2: Thread Detail View with Conversation History
 * Task 11: Testing & Performance
 */

import { describe, it, expect } from 'vitest'
import { parseQuotedText, stripQuotePrefix } from '../quotedTextParser'

describe('parseQuotedText', () => {
  describe('Plain Text Parsing', () => {
    it('should return empty content for empty string', () => {
      const result = parseQuotedText('', false)

      expect(result.mainContent).toBe('')
      expect(result.quotedContent).toBeNull()
      expect(result.hasQuotedText).toBe(false)
    })

    it('should return original content when no quotes present', () => {
      const content = 'Hello World\nThis is a regular email.'

      const result = parseQuotedText(content, false)

      expect(result.mainContent).toBe(content)
      expect(result.quotedContent).toBeNull()
      expect(result.hasQuotedText).toBe(false)
    })

    it('should detect > prefixed quoted text', () => {
      const content = `Hello,

Thanks for your email.

> This is quoted text
> From the previous email`

      const result = parseQuotedText(content, false)

      expect(result.mainContent).toBe('Hello,\n\nThanks for your email.')
      expect(result.quotedContent).toContain('> This is quoted text')
      expect(result.hasQuotedText).toBe(true)
    })

    it('should detect "On X wrote:" pattern', () => {
      const content = `Hello,

Thanks for your email.

On Mon, Jan 1, 2024, John wrote:
Previous message content`

      const result = parseQuotedText(content, false)

      expect(result.mainContent).toContain('Thanks for your email')
      expect(result.quotedContent).toContain('On Mon, Jan 1, 2024, John wrote:')
      expect(result.hasQuotedText).toBe(true)
    })

    it('should handle multiple levels of quoting', () => {
      const content = `My response.

> First level quote
>> Second level quote`

      const result = parseQuotedText(content, false)

      expect(result.mainContent).toBe('My response.')
      expect(result.quotedContent).toContain('> First level quote')
      expect(result.quotedContent).toContain('>> Second level quote')
      expect(result.hasQuotedText).toBe(true)
    })
  })

  describe('HTML Parsing', () => {
    it('should detect blockquote elements', () => {
      const html = `
        <p>My response</p>
        <blockquote>
          <p>Previous message</p>
        </blockquote>
      `

      const result = parseQuotedText(html, true)

      expect(result.mainContent).toContain('My response')
      expect(result.mainContent).not.toContain('Previous message')
      expect(result.quotedContent).toContain('blockquote')
      expect(result.hasQuotedText).toBe(true)
    })

    it('should detect Gmail-style quote divs', () => {
      const html = `
        <p>My response</p>
        <div class="gmail_quote">
          <p>Previous message</p>
        </div>
      `

      const result = parseQuotedText(html, true)

      expect(result.mainContent).toContain('My response')
      expect(result.quotedContent).toContain('gmail_quote')
      expect(result.hasQuotedText).toBe(true)
    })

    it('should handle HTML without quotes', () => {
      const html = '<p>Simple email content</p>'

      const result = parseQuotedText(html, true)

      expect(result.mainContent).toContain('Simple email content')
      expect(result.quotedContent).toBeNull()
      expect(result.hasQuotedText).toBe(false)
    })
  })
})

describe('stripQuotePrefix', () => {
  it('should remove > prefix from lines', () => {
    const text = '> Line 1\n> Line 2'

    const result = stripQuotePrefix(text)

    expect(result).toBe('Line 1\nLine 2')
  })

  it('should handle multiple > prefixes', () => {
    const text = '>> Double quoted'

    const result = stripQuotePrefix(text)

    expect(result).toBe('> Double quoted') // Only removes one level
  })

  it('should preserve lines without prefix', () => {
    const text = 'Normal line\n> Quoted line'

    const result = stripQuotePrefix(text)

    expect(result).toContain('Normal line')
    expect(result).toContain('Quoted line')
  })

  it('should handle leading whitespace before >', () => {
    const text = '  > Indented quote'

    const result = stripQuotePrefix(text)

    expect(result).toBe('Indented quote')
  })
})
