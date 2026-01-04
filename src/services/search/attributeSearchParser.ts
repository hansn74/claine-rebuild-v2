/**
 * Attribute Search Parser
 *
 * Story 2.15: Attribute-Based Filtering & Search
 * Task 6.1: Parse attribute search syntax
 *
 * Parses search queries containing attribute:value syntax.
 * Examples:
 * - "Status:To-Do" → attribute filter: Status = To-Do
 * - "Project:Alpha meeting" → filter: Project = Alpha, text: meeting
 * - "Priority:High Status:To-Do" → filter: Priority = High AND Status = To-Do
 * - "Project:\"My Project\" budget" → filter with quoted value + text search
 */

import type { FilterValue } from '@/store/attributeFilterStore'

/**
 * Parsed search query result
 */
export interface ParsedSearchQuery {
  /** Remaining text to search (after extracting attribute terms) */
  textQuery: string
  /** Attribute filters extracted from query */
  attributeFilters: Map<string, FilterValue[]>
  /** Whether any attribute filters were found */
  hasAttributeFilters: boolean
}

/**
 * Regex to match attribute:value patterns
 * Matches:
 * - attributeName:value (simple value)
 * - attributeName:"quoted value" (value with spaces)
 * - attributeName:'quoted value' (single quotes)
 */
const ATTRIBUTE_PATTERN = /(\w+):((?:"[^"]*"|'[^']*'|\S+))/gi

/**
 * Parse a search query to extract attribute filters
 *
 * @param query - Raw search query string
 * @returns ParsedSearchQuery with text portion and attribute filters
 */
export function parseAttributeSearchQuery(query: string): ParsedSearchQuery {
  const attributeFilters = new Map<string, FilterValue[]>()
  let textQuery = query

  // Find all attribute:value patterns
  const matches = query.matchAll(ATTRIBUTE_PATTERN)

  for (const match of matches) {
    const [fullMatch, attributeName, rawValue] = match

    // Clean up the value (remove quotes if present)
    let value = rawValue
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    // Normalize attribute name to lowercase for case-insensitive matching
    const normalizedName = attributeName.toLowerCase()

    // Add to filters (supporting multiple values per attribute)
    const existing = attributeFilters.get(normalizedName) ?? []
    attributeFilters.set(normalizedName, [...existing, value])

    // Remove the matched pattern from the text query
    textQuery = textQuery.replace(fullMatch, '')
  }

  // Clean up remaining text query
  textQuery = textQuery.trim().replace(/\s+/g, ' ')

  return {
    textQuery,
    attributeFilters,
    hasAttributeFilters: attributeFilters.size > 0,
  }
}

/**
 * Format a parsed query back to string (for display/debugging)
 *
 * @param parsed - Parsed search query
 * @returns Formatted string representation
 */
export function formatParsedQuery(parsed: ParsedSearchQuery): string {
  const parts: string[] = []

  // Add attribute filters
  for (const [name, values] of parsed.attributeFilters.entries()) {
    for (const value of values) {
      const valueStr = String(value).includes(' ') ? `"${value}"` : String(value)
      parts.push(`${name}:${valueStr}`)
    }
  }

  // Add text query
  if (parsed.textQuery) {
    parts.push(parsed.textQuery)
  }

  return parts.join(' ')
}

/**
 * Get attribute search hints for autocomplete
 * Returns common attribute patterns the user might want to type
 */
export interface AttributeSearchHint {
  /** Display text for the hint */
  label: string
  /** Value to insert into search */
  value: string
  /** Description of what the pattern matches */
  description: string
}

export function getAttributeSearchHints(): AttributeSearchHint[] {
  return [
    {
      label: 'Status:',
      value: 'Status:',
      description: 'Filter by email status',
    },
    {
      label: 'Priority:',
      value: 'Priority:',
      description: 'Filter by priority level',
    },
    {
      label: 'Project:',
      value: 'Project:',
      description: 'Filter by project name',
    },
    {
      label: 'Category:',
      value: 'Category:',
      description: 'Filter by category',
    },
    {
      label: 'attribute:"value"',
      value: '',
      description: 'Use quotes for values with spaces',
    },
  ]
}
