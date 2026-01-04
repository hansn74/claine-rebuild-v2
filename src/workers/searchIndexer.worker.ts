/**
 * Search Indexer Web Worker
 *
 * Story 2.10: Performance Optimization & Benchmarking
 * Task 5.1: Create search indexer worker for search index building
 *
 * Offloads search index building and query execution to a background thread.
 * This prevents UI blocking during large email indexing operations.
 */

import type {
  WorkerMessage,
  WorkerResponse,
  SearchIndexerMessageType,
  IndexEmailsPayload,
  SearchPayload,
  IndexableEmail,
  SearchIndexEntry,
  SearchResult,
  SearchResultsPayload,
  IndexStatsPayload,
} from './types'

// ============================================================================
// In-Memory Search Index
// ============================================================================

/**
 * Inverted index: token -> document IDs with positions
 */
const invertedIndex = new Map<string, Set<string>>()

/**
 * Document store: document ID -> SearchIndexEntry
 */
const documentStore = new Map<string, SearchIndexEntry>()

/**
 * Index metadata
 */
let indexStats = {
  totalDocuments: 0,
  totalTokens: 0,
  indexSizeBytes: 0,
  lastUpdated: 0,
}

// ============================================================================
// Tokenization and Text Processing
// ============================================================================

/**
 * Stop words to filter out (common words that don't add search value)
 */
const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'has',
  'he',
  'in',
  'is',
  'it',
  'its',
  'of',
  'on',
  'or',
  'that',
  'the',
  'to',
  'was',
  'were',
  'will',
  'with',
  'you',
  'your',
  're',
  'fw',
  'fwd', // Email-specific
])

/**
 * Minimum token length to index
 */
const MIN_TOKEN_LENGTH = 2

/**
 * Tokenize text into searchable tokens
 */
function tokenize(text: string): string[] {
  if (!text) return []

  return (
    text
      .toLowerCase()
      // Replace non-alphanumeric with spaces (keep @ and . for emails)
      .replace(/[^\w\s@.]/g, ' ')
      // Split on whitespace
      .split(/\s+/)
      // Filter out short tokens and stop words
      .filter((token) => token.length >= MIN_TOKEN_LENGTH && !STOP_WORDS.has(token))
  )
}

/**
 * Extract tokens from an email for indexing
 */
function extractTokens(email: IndexableEmail): string[] {
  const tokens: string[] = []

  // Subject tokens (weighted higher)
  tokens.push(...tokenize(email.subject))
  tokens.push(...tokenize(email.subject)) // Double weight

  // Sender tokens
  tokens.push(...tokenize(email.fromName))
  tokens.push(...tokenize(email.fromEmail))

  // Recipient tokens
  email.toNames.forEach((name) => tokens.push(...tokenize(name)))
  email.toEmails.forEach((email) => tokens.push(...tokenize(email)))

  // Body/snippet tokens
  if (email.bodyText) {
    tokens.push(...tokenize(email.bodyText))
  }
  tokens.push(...tokenize(email.snippet))

  // Labels
  email.labels.forEach((label) => tokens.push(...tokenize(label)))

  return tokens
}

/**
 * Calculate base relevance score for an email
 */
function calculateBaseScore(email: IndexableEmail): number {
  let score = 50 // Base score

  // Recency boost (up to +20 for emails in last 7 days)
  const ageInDays = (Date.now() - email.timestamp) / (1000 * 60 * 60 * 24)
  if (ageInDays < 1) score += 20
  else if (ageInDays < 7) score += Math.max(0, 20 - ageInDays * 2)

  // Starred boost
  if (email.starred) score += 10

  // Unread boost (might be more relevant)
  if (!email.read) score += 5

  return Math.min(100, score)
}

// ============================================================================
// Index Operations
// ============================================================================

/**
 * Index a batch of emails
 */
function indexEmails(payload: IndexEmailsPayload): { indexed: number; duration: number } {
  const startTime = performance.now()

  // Clear index if replacing
  if (payload.replace) {
    invertedIndex.clear()
    documentStore.clear()
  }

  let indexedCount = 0

  for (const email of payload.emails) {
    // Extract tokens
    const tokens = extractTokens(email)
    const uniqueTokens = [...new Set(tokens)]

    // Create index entry
    const entry: SearchIndexEntry = {
      id: email.id,
      threadId: email.threadId,
      tokens: uniqueTokens,
      subject: email.subject,
      from: { name: email.fromName, email: email.fromEmail },
      timestamp: email.timestamp,
      folder: email.folder,
      labels: email.labels,
      baseScore: calculateBaseScore(email),
    }

    // Store document
    documentStore.set(email.id, entry)

    // Update inverted index
    for (const token of uniqueTokens) {
      if (!invertedIndex.has(token)) {
        invertedIndex.set(token, new Set())
      }
      invertedIndex.get(token)!.add(email.id)
    }

    indexedCount++
  }

  // Update stats
  indexStats = {
    totalDocuments: documentStore.size,
    totalTokens: invertedIndex.size,
    indexSizeBytes: estimateIndexSize(),
    lastUpdated: Date.now(),
  }

  const duration = performance.now() - startTime

  return { indexed: indexedCount, duration }
}

/**
 * Estimate index size in bytes
 */
function estimateIndexSize(): number {
  let size = 0

  // Document store size
  for (const entry of documentStore.values()) {
    size += entry.id.length * 2
    size += entry.threadId.length * 2
    size += entry.subject.length * 2
    size += entry.from.name.length * 2
    size += entry.from.email.length * 2
    size += entry.tokens.reduce((sum, t) => sum + t.length * 2, 0)
    size += 8 // timestamp
    size += 8 // baseScore
  }

  // Inverted index size
  for (const [token, docIds] of invertedIndex.entries()) {
    size += token.length * 2
    size += docIds.size * 40 // Estimated ID size
  }

  return size
}

/**
 * Search the index
 */
function search(payload: SearchPayload): SearchResultsPayload {
  const startTime = performance.now()

  const { query, options = {} } = payload
  const queryTokens = tokenize(query)

  if (queryTokens.length === 0) {
    return {
      results: [],
      totalCount: 0,
      query,
      processingTime: performance.now() - startTime,
    }
  }

  // Find documents containing all query tokens (AND search)
  let matchingDocIds: Set<string> | null = null

  for (const token of queryTokens) {
    const docIds = invertedIndex.get(token)
    if (!docIds) {
      // Token not found, no results
      return {
        results: [],
        totalCount: 0,
        query,
        processingTime: performance.now() - startTime,
      }
    }

    if (matchingDocIds === null) {
      matchingDocIds = new Set(docIds)
    } else {
      // Intersect
      matchingDocIds = new Set([...matchingDocIds].filter((id: string) => docIds.has(id)))
    }
  }

  if (!matchingDocIds || matchingDocIds.size === 0) {
    return {
      results: [],
      totalCount: 0,
      query,
      processingTime: performance.now() - startTime,
    }
  }

  // Get matching documents and apply filters
  let results: SearchResult[] = []

  for (const docId of matchingDocIds) {
    const entry = documentStore.get(docId)
    if (!entry) continue

    // Apply filters
    if (options.folder && entry.folder !== options.folder) continue
    if (options.from && !entry.from.email.includes(options.from.toLowerCase())) continue
    if (options.labels && options.labels.length > 0) {
      const hasLabel = options.labels.some((l) => entry.labels.includes(l))
      if (!hasLabel) continue
    }
    if (options.dateRange) {
      if (entry.timestamp < options.dateRange.start) continue
      if (entry.timestamp > options.dateRange.end) continue
    }

    // Calculate relevance score
    const matchedTokens = queryTokens.filter((qt) =>
      entry.tokens.some((t) => t.includes(qt) || qt.includes(t))
    )
    const tokenMatchRatio = matchedTokens.length / queryTokens.length
    const score = Math.round(entry.baseScore * tokenMatchRatio)

    results.push({
      id: entry.id,
      threadId: entry.threadId,
      subject: entry.subject,
      from: entry.from,
      timestamp: entry.timestamp,
      folder: entry.folder,
      score,
      matchedTokens,
    })
  }

  // Sort by score (descending) then timestamp (descending)
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    return b.timestamp - a.timestamp
  })

  const totalCount = results.length

  // Apply pagination
  const offset = options.offset || 0
  const limit = options.limit || 50
  results = results.slice(offset, offset + limit)

  return {
    results,
    totalCount,
    query,
    processingTime: performance.now() - startTime,
  }
}

/**
 * Clear the search index
 */
function clearIndex(): void {
  invertedIndex.clear()
  documentStore.clear()
  indexStats = {
    totalDocuments: 0,
    totalTokens: 0,
    indexSizeBytes: 0,
    lastUpdated: Date.now(),
  }
}

/**
 * Get index statistics
 */
function getStats(): IndexStatsPayload {
  return { ...indexStats }
}

// ============================================================================
// Message Handler
// ============================================================================

/**
 * Handle incoming messages from main thread
 */
self.onmessage = (event: MessageEvent<WorkerMessage<SearchIndexerMessageType>>) => {
  const { type, payload, messageId } = event.data
  const startTime = performance.now()

  let response: WorkerResponse<SearchIndexerMessageType>

  try {
    switch (type) {
      case 'INDEX_EMAILS': {
        const result = indexEmails(payload as IndexEmailsPayload)
        response = {
          type,
          result,
          messageId,
          duration: performance.now() - startTime,
        }
        break
      }

      case 'SEARCH': {
        const result = search(payload as SearchPayload)
        response = {
          type,
          result,
          messageId,
          duration: performance.now() - startTime,
        }
        break
      }

      case 'CLEAR_INDEX': {
        clearIndex()
        response = {
          type,
          result: { success: true },
          messageId,
          duration: performance.now() - startTime,
        }
        break
      }

      case 'GET_STATS': {
        const result = getStats()
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
