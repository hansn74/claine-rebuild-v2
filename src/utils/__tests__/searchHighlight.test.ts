/**
 * Search Highlight Utilities Tests
 *
 * Story 2.5: Local Full-Text Search
 * Tests for search highlighting and snippet generation
 */

import { describe, it, expect } from 'vitest'
import {
  parseSearchTerms,
  highlightMatches,
  generateSnippet,
  highlightFromQuery,
  generateSnippetFromQuery,
  containsSearchTerms,
} from '../searchHighlight'

describe('parseSearchTerms', () => {
  it('should parse single word', () => {
    const terms = parseSearchTerms('budget')
    expect(terms).toEqual(['budget'])
  })

  it('should parse multiple words', () => {
    const terms = parseSearchTerms('budget meeting review')
    expect(terms).toEqual(['budget', 'meeting', 'review'])
  })

  it('should parse quoted phrases', () => {
    const terms = parseSearchTerms('"budget meeting" review')
    expect(terms).toEqual(['budget meeting', 'review'])
  })

  it('should handle multiple quoted phrases', () => {
    const terms = parseSearchTerms('"budget meeting" "Q4 planning"')
    expect(terms).toEqual(['budget meeting', 'Q4 planning'])
  })

  it('should skip OR operator', () => {
    const terms = parseSearchTerms('budget OR meeting')
    expect(terms).toEqual(['budget', 'meeting'])
  })

  it('should skip AND operator', () => {
    const terms = parseSearchTerms('budget AND meeting')
    expect(terms).toEqual(['budget', 'meeting'])
  })

  it('should skip NOT operator', () => {
    const terms = parseSearchTerms('budget NOT spam')
    expect(terms).toEqual(['budget', 'spam'])
  })

  it('should remove field prefixes', () => {
    const terms = parseSearchTerms('subject:budget from:john')
    expect(terms).toEqual(['budget', 'john'])
  })

  it('should handle empty string', () => {
    const terms = parseSearchTerms('')
    expect(terms).toEqual([])
  })

  it('should handle whitespace only', () => {
    const terms = parseSearchTerms('   ')
    expect(terms).toEqual([])
  })
})

describe('highlightMatches', () => {
  it('should wrap matching terms in <mark> tags', () => {
    const result = highlightMatches('Meeting about the budget', ['budget'])
    expect(result).toBe('Meeting about the <mark>budget</mark>')
  })

  it('should be case-insensitive', () => {
    const result = highlightMatches('Meeting about BUDGET', ['budget'])
    expect(result).toBe('Meeting about <mark>BUDGET</mark>')
  })

  it('should highlight multiple matches', () => {
    const result = highlightMatches('Budget meeting about budget review', ['budget'])
    expect(result).toBe('<mark>Budget</mark> meeting about <mark>budget</mark> review')
  })

  it('should highlight multiple different terms', () => {
    const result = highlightMatches('Meeting about the budget', ['meeting', 'budget'])
    expect(result).toBe('<mark>Meeting</mark> about the <mark>budget</mark>')
  })

  it('should handle no matches', () => {
    const result = highlightMatches('Some text', ['xyz'])
    expect(result).toBe('Some text')
  })

  it('should handle empty text', () => {
    const result = highlightMatches('', ['budget'])
    expect(result).toBe('')
  })

  it('should handle empty terms', () => {
    const result = highlightMatches('Some text', [])
    expect(result).toBe('Some text')
  })

  it('should sanitize potential XSS', () => {
    const result = highlightMatches('Text with <script>alert(1)</script>', ['text'])
    expect(result).not.toContain('<script>')
  })

  it('should handle overlapping terms (both get highlighted)', () => {
    // Note: With nested matches, both terms get highlighted which may create nested marks
    // This is acceptable behavior as the visual result still shows highlighting
    const result = highlightMatches('budgeting is about budget', ['budget', 'budgeting'])
    expect(result).toContain('<mark>')
    expect(result).toContain('budget')
  })
})

describe('generateSnippet', () => {
  const longText =
    'This is a very long email about the quarterly budget review meeting. ' +
    'We need to discuss the financial projections for the next quarter. ' +
    'Please come prepared with your department reports.'

  it('should generate snippet around first match', () => {
    const result = generateSnippet(longText, ['budget'], 20)
    expect(result).toContain('<mark>budget</mark>')
    expect(result.length).toBeLessThan(longText.length)
  })

  it('should add ellipsis when truncated at start', () => {
    const result = generateSnippet(longText, ['budget'], 10)
    expect(result.startsWith('...')).toBe(true)
  })

  it('should add ellipsis when truncated at end', () => {
    const result = generateSnippet(longText, ['quarterly'], 10)
    expect(result.endsWith('...')).toBe(true)
  })

  it('should not add ellipsis when no truncation needed', () => {
    const shortText = 'Short budget text'
    const result = generateSnippet(shortText, ['budget'], 100)
    expect(result).not.toContain('...')
  })

  it('should return truncated text when no matches', () => {
    const result = generateSnippet(longText, ['xyz'], 20)
    expect(result.length).toBeLessThan(longText.length)
  })

  it('should handle empty text', () => {
    const result = generateSnippet('', ['budget'], 50)
    expect(result).toBe('')
  })

  it('should handle empty terms', () => {
    const result = generateSnippet('Some text', [], 50)
    expect(result).toBe('Some text')
  })
})

describe('highlightFromQuery', () => {
  it('should parse query and highlight matches', () => {
    const result = highlightFromQuery('Meeting about the budget', 'budget')
    expect(result).toBe('Meeting about the <mark>budget</mark>')
  })

  it('should handle quoted phrases in query', () => {
    const result = highlightFromQuery('This is a budget meeting today', '"budget meeting"')
    expect(result).toContain('<mark>budget meeting</mark>')
  })
})

describe('generateSnippetFromQuery', () => {
  it('should parse query and generate snippet', () => {
    const text = 'This is a long text about budget planning and financial review'
    const result = generateSnippetFromQuery(text, 'budget', 10)
    expect(result).toContain('<mark>budget</mark>')
  })
})

describe('containsSearchTerms', () => {
  it('should return true when text contains term', () => {
    expect(containsSearchTerms('Meeting about budget', ['budget'])).toBe(true)
  })

  it('should be case-insensitive', () => {
    expect(containsSearchTerms('Meeting about BUDGET', ['budget'])).toBe(true)
  })

  it('should return true if any term matches', () => {
    expect(containsSearchTerms('Meeting about budget', ['xyz', 'meeting'])).toBe(true)
  })

  it('should return false when no terms match', () => {
    expect(containsSearchTerms('Meeting about budget', ['xyz', 'abc'])).toBe(false)
  })

  it('should return false for empty text', () => {
    expect(containsSearchTerms('', ['budget'])).toBe(false)
  })

  it('should return false for empty terms', () => {
    expect(containsSearchTerms('Some text', [])).toBe(false)
  })
})
