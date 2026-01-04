/**
 * Web Worker Type Definitions
 *
 * Story 2.10: Performance Optimization & Benchmarking
 * Task 5.3: Implement worker message protocol with TypeScript types
 *
 * Provides type-safe message passing between main thread and workers.
 */

/**
 * Base message structure for worker communication
 */
export interface WorkerMessage<T extends string = string, P = unknown> {
  /** Message type identifier */
  type: T
  /** Message payload */
  payload: P
  /** Unique message ID for request-response correlation */
  messageId: string
}

/**
 * Worker response structure
 */
export interface WorkerResponse<T extends string = string, R = unknown> {
  /** Response type (matches request type) */
  type: T
  /** Response result */
  result?: R
  /** Error message if failed */
  error?: string
  /** Original message ID */
  messageId: string
  /** Processing duration in milliseconds */
  duration: number
}

// ============================================================================
// Search Indexer Worker Types
// ============================================================================

/**
 * Email data for search indexing (minimal fields needed for indexing)
 */
export interface IndexableEmail {
  id: string
  threadId: string
  subject: string
  snippet: string
  fromName: string
  fromEmail: string
  toNames: string[]
  toEmails: string[]
  timestamp: number
  folder: string
  labels: string[]
  read: boolean
  starred: boolean
  bodyText?: string
}

/**
 * Search index entry with tokenized and processed content
 */
export interface SearchIndexEntry {
  id: string
  threadId: string
  /** Lowercase tokens from all searchable fields */
  tokens: string[]
  /** Original subject for display */
  subject: string
  /** Sender info for filtering */
  from: { name: string; email: string }
  /** Timestamp for sorting */
  timestamp: number
  /** Folder for filtering */
  folder: string
  /** Labels for filtering */
  labels: string[]
  /** Computed relevance score base */
  baseScore: number
}

/**
 * Search indexer message types
 */
export type SearchIndexerMessageType = 'INDEX_EMAILS' | 'SEARCH' | 'CLEAR_INDEX' | 'GET_STATS'

/**
 * Index emails request
 */
export interface IndexEmailsPayload {
  emails: IndexableEmail[]
  /** Whether to replace entire index or merge */
  replace?: boolean
}

/**
 * Search request payload
 */
export interface SearchPayload {
  query: string
  options?: {
    folder?: string
    labels?: string[]
    from?: string
    dateRange?: { start: number; end: number }
    limit?: number
    offset?: number
  }
}

/**
 * Search result
 */
export interface SearchResult {
  id: string
  threadId: string
  subject: string
  from: { name: string; email: string }
  timestamp: number
  folder: string
  /** Relevance score (0-100) */
  score: number
  /** Matched tokens for highlighting */
  matchedTokens: string[]
}

/**
 * Search results response
 */
export interface SearchResultsPayload {
  results: SearchResult[]
  totalCount: number
  query: string
  processingTime: number
}

/**
 * Index statistics
 */
export interface IndexStatsPayload {
  totalDocuments: number
  totalTokens: number
  indexSizeBytes: number
  lastUpdated: number
}

// ============================================================================
// Email Parser Worker Types
// ============================================================================

/**
 * Email parser message types
 */
export type EmailParserMessageType = 'PARSE_EMAIL' | 'PARSE_EMAILS_BATCH' | 'EXTRACT_ATTACHMENTS'

/**
 * Raw email data to parse (from API)
 */
export interface RawEmailData {
  id: string
  threadId: string
  /** Raw headers as key-value pairs */
  headers: Record<string, string>
  /** Base64 encoded body parts */
  bodyParts: {
    mimeType: string
    body: string
    isBase64?: boolean
  }[]
  /** Raw attachment metadata */
  attachments?: {
    id: string
    filename: string
    mimeType: string
    size: number
    contentId?: string
  }[]
  /** Provider-specific metadata */
  metadata?: Record<string, unknown>
}

/**
 * Parsed email result
 */
export interface ParsedEmail {
  id: string
  threadId: string
  from: { name: string; email: string }
  to: { name: string; email: string }[]
  cc?: { name: string; email: string }[]
  bcc?: { name: string; email: string }[]
  subject: string
  body: {
    html?: string
    text?: string
  }
  timestamp: number
  attachments: {
    id: string
    filename: string
    mimeType: string
    size: number
    isInline: boolean
    contentId?: string
  }[]
  snippet: string
}

/**
 * Parse email request
 */
export interface ParseEmailPayload {
  rawEmail: RawEmailData
}

/**
 * Parse emails batch request
 */
export interface ParseEmailsBatchPayload {
  rawEmails: RawEmailData[]
}

/**
 * Extract attachments request
 */
export interface ExtractAttachmentsPayload {
  emailId: string
  bodyParts: {
    mimeType: string
    body: string
    isBase64?: boolean
    filename?: string
    contentId?: string
  }[]
}

/**
 * Extracted attachment result
 */
export interface ExtractedAttachment {
  id: string
  filename: string
  mimeType: string
  size: number
  isInline: boolean
  contentId?: string
  /** Base64 encoded data */
  data: string
}

// ============================================================================
// Worker Manager Types
// ============================================================================

/**
 * Worker status
 */
export type WorkerStatus = 'idle' | 'busy' | 'error' | 'terminated'

/**
 * Worker info for management
 */
export interface WorkerInfo {
  id: string
  type: 'searchIndexer' | 'emailParser'
  status: WorkerStatus
  createdAt: number
  lastActivity: number
  messagesProcessed: number
  errorsCount: number
}

/**
 * Worker pool configuration
 */
export interface WorkerPoolConfig {
  /** Maximum workers of each type */
  maxWorkers?: number
  /** Idle timeout before terminating worker (ms) */
  idleTimeout?: number
  /** Message timeout (ms) */
  messageTimeout?: number
}

/**
 * Default worker pool configuration
 */
export const DEFAULT_WORKER_CONFIG: Required<WorkerPoolConfig> = {
  maxWorkers: 2,
  idleTimeout: 60000, // 1 minute
  messageTimeout: 30000, // 30 seconds
}
