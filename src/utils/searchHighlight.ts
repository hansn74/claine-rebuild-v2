/**
 * Search Highlight Utilities
 *
 * Story 2.5: Local Full-Text Search
 * Task 9: Implement Search Result Highlighting
 *
 * Utilities for highlighting search terms in text and generating context snippets.
 * Uses DOMPurify for XSS protection when rendering highlighted HTML.
 */

import DOMPurify from 'dompurify'

/**
 * Escape special regex characters in a string
 *
 * @param str - String to escape
 * @returns Escaped string safe for regex
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Parse search query into individual terms
 * Handles quoted phrases and individual words
 *
 * @param query - Search query string
 * @returns Array of search terms
 *
 * @example
 * parseSearchTerms('budget "Q4 planning" review')
 * // Returns: ['budget', 'Q4 planning', 'review']
 */
export function parseSearchTerms(query: string): string[] {
  const terms: string[] = []

  // Match quoted phrases and individual words
  const regex = /"([^"]+)"|(\S+)/g
  let match

  while ((match = regex.exec(query)) !== null) {
    // match[1] is quoted phrase, match[2] is single word
    const term = match[1] || match[2]
    if (term && term.length > 0) {
      // Skip Lunr operators
      const lowerTerm = term.toLowerCase()
      if (lowerTerm !== 'or' && lowerTerm !== 'and' && lowerTerm !== 'not') {
        // Remove field prefixes (e.g., "subject:" or "from:")
        const cleanTerm = term.replace(/^[a-z]+:/i, '')
        if (cleanTerm.length > 0) {
          terms.push(cleanTerm)
        }
      }
    }
  }

  return terms
}

/**
 * Highlight matching terms in text
 * Wraps matches in <mark> tags for visual highlighting
 *
 * @param text - Text to highlight
 * @param terms - Search terms to highlight
 * @returns Text with matches wrapped in <mark> tags (sanitized)
 *
 * @example
 * highlightMatches('Meeting about the budget review', ['budget', 'meeting'])
 * // Returns: '<mark>Meeting</mark> about the <mark>budget</mark> review'
 */
export function highlightMatches(text: string, terms: string[]): string {
  if (!text || terms.length === 0) {
    return text || ''
  }

  let result = text

  // Sort terms by length (longest first) to avoid partial replacements
  const sortedTerms = [...terms].sort((a, b) => b.length - a.length)

  for (const term of sortedTerms) {
    if (!term) continue

    // Create regex for case-insensitive matching
    const regex = new RegExp(`(${escapeRegExp(term)})`, 'gi')
    result = result.replace(regex, '<mark>$1</mark>')
  }

  // Sanitize to prevent XSS, but allow <mark> tags
  return DOMPurify.sanitize(result, {
    ALLOWED_TAGS: ['mark'],
    ALLOWED_ATTR: [],
  })
}

/**
 * Generate a context snippet around matched terms
 * Shows text before and after the first match
 *
 * @param text - Full text to extract snippet from
 * @param terms - Search terms to find
 * @param contextChars - Number of characters to show before/after match (default: 50)
 * @returns Context snippet with matches highlighted
 *
 * @example
 * generateSnippet('This is a long email about the budget review for Q4', ['budget'], 20)
 * // Returns: '...email about the <mark>budget</mark> review for Q4...'
 */
export function generateSnippet(text: string, terms: string[], contextChars: number = 50): string {
  if (!text || terms.length === 0) {
    // Return truncated text if no terms
    const maxLength = contextChars * 2 + 20
    if (text && text.length > maxLength) {
      return text.slice(0, maxLength) + '...'
    }
    return text || ''
  }

  // Find the first matching term and its position
  let firstMatchIndex = -1
  let matchedTerm = ''

  for (const term of terms) {
    const index = text.toLowerCase().indexOf(term.toLowerCase())
    if (index !== -1 && (firstMatchIndex === -1 || index < firstMatchIndex)) {
      firstMatchIndex = index
      matchedTerm = term
    }
  }

  // If no match found, return start of text
  if (firstMatchIndex === -1) {
    const maxLength = contextChars * 2 + 20
    if (text.length > maxLength) {
      return text.slice(0, maxLength) + '...'
    }
    return text
  }

  // Calculate snippet boundaries
  const start = Math.max(0, firstMatchIndex - contextChars)
  const end = Math.min(text.length, firstMatchIndex + matchedTerm.length + contextChars)

  // Extract snippet
  let snippet = text.slice(start, end)

  // Add ellipsis if truncated
  const prefix = start > 0 ? '...' : ''
  const suffix = end < text.length ? '...' : ''

  snippet = prefix + snippet + suffix

  // Highlight all matches in snippet
  return highlightMatches(snippet, terms)
}

/**
 * Highlight matches from a search query string
 * Parses the query and highlights all terms
 *
 * @param text - Text to highlight
 * @param query - Search query string
 * @returns Text with matches highlighted
 */
export function highlightFromQuery(text: string, query: string): string {
  const terms = parseSearchTerms(query)
  return highlightMatches(text, terms)
}

/**
 * Generate snippet from a search query string
 * Parses the query and generates context around first match
 *
 * @param text - Text to generate snippet from
 * @param query - Search query string
 * @param contextChars - Characters of context (default: 50)
 * @returns Context snippet with highlights
 */
export function generateSnippetFromQuery(
  text: string,
  query: string,
  contextChars: number = 50
): string {
  const terms = parseSearchTerms(query)
  return generateSnippet(text, terms, contextChars)
}

/**
 * Check if text contains any of the search terms
 *
 * @param text - Text to check
 * @param terms - Terms to search for
 * @returns true if any term is found
 */
export function containsSearchTerms(text: string, terms: string[]): boolean {
  if (!text || terms.length === 0) {
    return false
  }

  const lowerText = text.toLowerCase()
  return terms.some((term) => lowerText.includes(term.toLowerCase()))
}
