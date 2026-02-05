/**
 * Search Operator Parser
 *
 * Story 2.22: Search Operators for Structured Queries
 * Task 1: Parse email search operators (from:, to:, has:, before:, after:, in:)
 *
 * Pure function module — no singleton, no state.
 * Parses search queries containing email operator syntax and provides
 * post-filter matching against EmailDocument fields.
 *
 * Examples:
 * - "from:john" → operator filter: from = john
 * - "from:john budget" → filter: from = john, text: budget
 * - "from:john has:attachment" → filter: from = john AND has = attachment
 * - "from:\"John Smith\"" → filter: from = John Smith (quoted value)
 * - "unknownop:value" → treated as text query (not extracted)
 */

import type { EmailDocument } from '@/services/database/schemas/email.schema'
import type { AttributeSearchHint } from './attributeSearchParser'

/**
 * Known email search operators
 */
export const KNOWN_OPERATORS = ['from', 'to', 'has', 'before', 'after', 'in'] as const

export type OperatorType = (typeof KNOWN_OPERATORS)[number]

/**
 * A single parsed search operator
 */
export interface SearchOperator {
  type: OperatorType
  value: string
}

/**
 * Result of parsing a search query for operators
 */
export interface ParsedOperatorQuery {
  /** Remaining text after operator extraction */
  textQuery: string
  /** Extracted search operators */
  operators: SearchOperator[]
  /** Whether any operators were found */
  hasOperators: boolean
}

/**
 * Regex to match key:value patterns (same as attributeSearchParser)
 */
const OPERATOR_PATTERN = /(\w+):((?:"[^"]*"|'[^']*'|\S+))/gi

/**
 * Validate that a date string is a valid YYYY-MM-DD format
 */
function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(value)
  return !isNaN(parsed.getTime())
}

/**
 * Parse a search query to extract known email operators
 *
 * Known operators (from, to, has, before, after, in) are extracted as filters.
 * Unknown key:value patterns are left in the text query for the attribute parser
 * or MiniSearch to handle.
 *
 * @param query - Raw search query string
 * @returns ParsedOperatorQuery with operators and remaining text
 */
export function parseSearchOperators(query: string): ParsedOperatorQuery {
  const operators: SearchOperator[] = []
  let textQuery = query

  const matches = query.matchAll(OPERATOR_PATTERN)

  for (const match of matches) {
    const [fullMatch, operatorName, rawValue] = match
    const normalizedName = operatorName.toLowerCase()

    // Check if this is a known operator
    if (!KNOWN_OPERATORS.includes(normalizedName as OperatorType)) {
      // Unknown operator — leave in text query
      continue
    }

    // Clean up value (remove quotes if present)
    let value = rawValue
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    // Validate date operators
    if ((normalizedName === 'before' || normalizedName === 'after') && !isValidDate(value)) {
      // Invalid date — treat as text, don't extract
      continue
    }

    operators.push({
      type: normalizedName as OperatorType,
      value,
    })

    // Remove the matched pattern from the text query
    textQuery = textQuery.replace(fullMatch, '')
  }

  // Clean up remaining text query
  textQuery = textQuery.trim().replace(/\s+/g, ' ')

  return {
    textQuery,
    operators,
    hasOperators: operators.length > 0,
  }
}

/**
 * Check if an email matches all operator filters (AND logic)
 *
 * @param email - Email document to check
 * @param operators - Array of operators to match against
 * @returns true if email matches ALL operators
 */
export function matchesOperatorFilters(email: EmailDocument, operators: SearchOperator[]): boolean {
  if (operators.length === 0) return true

  return operators.every((op) => matchesSingleOperator(email, op))
}

/**
 * Check if an email matches a single operator
 */
function matchesSingleOperator(email: EmailDocument, operator: SearchOperator): boolean {
  const value = operator.value.toLowerCase()

  switch (operator.type) {
    case 'from': {
      const fromName = (email.from?.name || '').toLowerCase()
      const fromEmail = (email.from?.email || '').toLowerCase()
      return fromName.includes(value) || fromEmail.includes(value)
    }

    case 'to': {
      const recipients = email.to || []
      return recipients.some((r) => {
        const name = (r.name || '').toLowerCase()
        const addr = (r.email || '').toLowerCase()
        return name.includes(value) || addr.includes(value)
      })
    }

    case 'has': {
      if (value === 'attachment') {
        return (email.attachments?.length ?? 0) > 0
      }
      return false
    }

    case 'before': {
      const dateMs = new Date(operator.value).getTime()
      return email.timestamp < dateMs
    }

    case 'after': {
      const dateMs = new Date(operator.value).getTime()
      return email.timestamp > dateMs
    }

    case 'in': {
      const folderMatch = (email.folder || '').toLowerCase() === value
      const labelMatch = (email.labels || []).some((l) => l.toLowerCase() === value)
      return folderMatch || labelMatch
    }

    default:
      return false
  }
}

/**
 * Get operator search hints for autocomplete (AC 8)
 * Returns hints compatible with AttributeSearchHint interface
 */
export function getOperatorSearchHints(): AttributeSearchHint[] {
  return [
    {
      label: 'from:',
      value: 'from:',
      description: 'Filter by sender name or email',
    },
    {
      label: 'to:',
      value: 'to:',
      description: 'Filter by recipient name or email',
    },
    {
      label: 'has:attachment',
      value: 'has:attachment',
      description: 'Filter emails with attachments',
    },
    {
      label: 'before:',
      value: 'before:',
      description: 'Filter emails before date (YYYY-MM-DD)',
    },
    {
      label: 'after:',
      value: 'after:',
      description: 'Filter emails after date (YYYY-MM-DD)',
    },
    {
      label: 'in:',
      value: 'in:',
      description: 'Filter by folder or label name',
    },
  ]
}
