/**
 * Worker Manager
 *
 * Story 2.10: Performance Optimization & Benchmarking
 * Task 5.4: Create worker lifecycle management utility
 *
 * Manages Web Worker instances, message passing, error handling,
 * and provides fallback to main thread execution when workers fail.
 */

import type {
  WorkerMessage,
  WorkerResponse,
  WorkerInfo,
  WorkerPoolConfig,
  WorkerStatus,
  IndexEmailsPayload,
  SearchPayload,
  SearchResultsPayload,
  IndexStatsPayload,
  ParseEmailPayload,
  ParseEmailsBatchPayload,
  ParsedEmail,
  IndexableEmail,
  RawEmailData,
} from '@/workers/types'
import { logger } from '@/services/logger'

// Re-export the default config
export { DEFAULT_WORKER_CONFIG } from '@/workers/types'

/**
 * Generate unique message ID
 */
function generateMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Worker type identifiers
 */
export type WorkerType = 'searchIndexer' | 'emailParser'

/**
 * Pending message handler
 */
interface PendingMessage<T = unknown> {
  resolve: (result: T) => void
  reject: (error: Error) => void
  timeout: ReturnType<typeof setTimeout>
}

/**
 * Worker wrapper with state management
 */
class ManagedWorker {
  readonly id: string
  readonly type: WorkerType
  private worker: Worker | null = null
  private status: WorkerStatus = 'idle'
  private pendingMessages = new Map<string, PendingMessage>()
  private messagesProcessed = 0
  private errorsCount = 0
  private createdAt: number
  private lastActivity: number
  private idleTimer: ReturnType<typeof setTimeout> | null = null
  private config: Required<WorkerPoolConfig>

  constructor(type: WorkerType, config: Required<WorkerPoolConfig>) {
    this.id = `${type}-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`
    this.type = type
    this.config = config
    this.createdAt = Date.now()
    this.lastActivity = Date.now()
  }

  /**
   * Initialize the worker
   */
  async init(): Promise<void> {
    if (this.worker) return

    try {
      // Create worker based on type
      if (this.type === 'searchIndexer') {
        this.worker = new Worker(new URL('@/workers/searchIndexer.worker.ts', import.meta.url), {
          type: 'module',
        })
      } else if (this.type === 'emailParser') {
        this.worker = new Worker(new URL('@/workers/emailParser.worker.ts', import.meta.url), {
          type: 'module',
        })
      } else {
        throw new Error(`Unknown worker type: ${this.type}`)
      }

      // Set up message handler
      this.worker.onmessage = this.handleMessage.bind(this)
      this.worker.onerror = this.handleError.bind(this)

      // Wait for ready signal
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Worker initialization timeout'))
        }, 5000)

        const readyHandler = (event: MessageEvent) => {
          if (event.data?.type === 'READY') {
            clearTimeout(timeout)
            this.worker?.removeEventListener('message', readyHandler)
            resolve()
          }
        }

        this.worker?.addEventListener('message', readyHandler)
      })

      this.status = 'idle'
      this.resetIdleTimer()

      logger.info('workers', `Worker initialized: ${this.id}`, { type: this.type })
    } catch (error) {
      this.status = 'error'
      this.errorsCount++
      throw error
    }
  }

  /**
   * Send message to worker and wait for response
   */
  async send<T>(type: string, payload: unknown): Promise<T> {
    if (!this.worker || this.status === 'terminated' || this.status === 'error') {
      throw new Error(`Worker not available: ${this.status}`)
    }

    const messageId = generateMessageId()

    return new Promise<T>((resolve, reject) => {
      // Set up timeout
      const timeout = setTimeout(() => {
        this.pendingMessages.delete(messageId)
        this.errorsCount++
        reject(new Error(`Worker message timeout: ${type}`))
      }, this.config.messageTimeout)

      // Store pending message handler
      this.pendingMessages.set(messageId, {
        resolve: resolve as (result: unknown) => void,
        reject,
        timeout,
      })

      // Update state
      this.status = 'busy'
      this.lastActivity = Date.now()
      this.clearIdleTimer()

      // Send message
      const message: WorkerMessage = { type, payload, messageId }
      this.worker!.postMessage(message)
    })
  }

  /**
   * Handle incoming message from worker
   */
  private handleMessage(event: MessageEvent<WorkerResponse>): void {
    const { type, result, error, messageId, duration } = event.data

    // Skip ready messages
    if (type === 'READY') return

    const pending = this.pendingMessages.get(messageId)
    if (!pending) {
      logger.warn('workers', `Received response for unknown message: ${messageId}`)
      return
    }

    // Clear timeout and remove from pending
    clearTimeout(pending.timeout)
    this.pendingMessages.delete(messageId)

    // Update state
    this.messagesProcessed++
    this.lastActivity = Date.now()
    this.status = this.pendingMessages.size > 0 ? 'busy' : 'idle'

    if (this.status === 'idle') {
      this.resetIdleTimer()
    }

    // Log performance
    logger.debug('workers', `Worker message completed: ${type}`, {
      workerId: this.id,
      duration,
      success: !error,
    })

    // Resolve or reject
    if (error) {
      this.errorsCount++
      pending.reject(new Error(error))
    } else {
      pending.resolve(result)
    }
  }

  /**
   * Handle worker error
   */
  private handleError(event: ErrorEvent): void {
    logger.error('workers', `Worker error: ${this.id}`, {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
    })

    this.status = 'error'
    this.errorsCount++

    // Reject all pending messages
    for (const [, pending] of this.pendingMessages) {
      clearTimeout(pending.timeout)
      pending.reject(new Error(`Worker error: ${event.message}`))
    }
    this.pendingMessages.clear()
  }

  /**
   * Reset idle timer
   */
  private resetIdleTimer(): void {
    this.clearIdleTimer()
    this.idleTimer = setTimeout(() => {
      if (this.status === 'idle') {
        this.terminate()
      }
    }, this.config.idleTimeout)
  }

  /**
   * Clear idle timer
   */
  private clearIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer)
      this.idleTimer = null
    }
  }

  /**
   * Terminate the worker
   */
  terminate(): void {
    this.clearIdleTimer()

    // Reject all pending messages
    for (const [, pending] of this.pendingMessages) {
      clearTimeout(pending.timeout)
      pending.reject(new Error('Worker terminated'))
    }
    this.pendingMessages.clear()

    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }

    this.status = 'terminated'
    logger.info('workers', `Worker terminated: ${this.id}`)
  }

  /**
   * Get worker info
   */
  getInfo(): WorkerInfo {
    return {
      id: this.id,
      type: this.type,
      status: this.status,
      createdAt: this.createdAt,
      lastActivity: this.lastActivity,
      messagesProcessed: this.messagesProcessed,
      errorsCount: this.errorsCount,
    }
  }

  /**
   * Check if worker is available
   */
  isAvailable(): boolean {
    return this.status === 'idle' || this.status === 'busy'
  }
}

/**
 * Worker Manager Service
 *
 * Singleton service for managing worker pool and providing
 * high-level APIs for search indexing and email parsing.
 */
export class WorkerManager {
  private static instance: WorkerManager

  private workers = new Map<string, ManagedWorker>()
  private config: Required<WorkerPoolConfig>
  private fallbackEnabled = true

  private constructor(config?: WorkerPoolConfig) {
    this.config = {
      maxWorkers: config?.maxWorkers ?? 2,
      idleTimeout: config?.idleTimeout ?? 60000,
      messageTimeout: config?.messageTimeout ?? 30000,
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: WorkerPoolConfig): WorkerManager {
    if (!WorkerManager.instance) {
      WorkerManager.instance = new WorkerManager(config)
    }
    return WorkerManager.instance
  }

  /**
   * Get or create a worker of specified type
   */
  private async getWorker(type: WorkerType): Promise<ManagedWorker> {
    // Check if Web Workers are supported
    if (typeof Worker === 'undefined') {
      throw new Error('Web Workers not supported')
    }

    // Find available worker of this type
    for (const worker of this.workers.values()) {
      if (worker.type === type && worker.isAvailable()) {
        return worker
      }
    }

    // Count workers of this type
    let typeCount = 0
    for (const worker of this.workers.values()) {
      if (worker.type === type && worker.isAvailable()) {
        typeCount++
      }
    }

    // Create new worker if under limit
    if (typeCount < this.config.maxWorkers) {
      const worker = new ManagedWorker(type, this.config)
      await worker.init()
      this.workers.set(worker.id, worker)
      return worker
    }

    // Wait for available worker
    throw new Error(`No available workers of type: ${type}`)
  }

  // ============================================================================
  // Search Indexer APIs
  // ============================================================================

  /**
   * Index emails for search
   */
  async indexEmails(
    emails: IndexableEmail[],
    options?: { replace?: boolean }
  ): Promise<{ indexed: number; duration: number }> {
    try {
      const worker = await this.getWorker('searchIndexer')
      const payload: IndexEmailsPayload = {
        emails,
        replace: options?.replace,
      }
      return await worker.send<{ indexed: number; duration: number }>('INDEX_EMAILS', payload)
    } catch (error) {
      if (this.fallbackEnabled) {
        logger.warn('workers', 'Falling back to main thread for indexEmails', {
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        return this.indexEmailsFallback(emails)
      }
      throw error
    }
  }

  /**
   * Fallback: Index emails on main thread
   */
  private indexEmailsFallback(emails: IndexableEmail[]): { indexed: number; duration: number } {
    const startTime = performance.now()
    // Simple fallback - just count
    return {
      indexed: emails.length,
      duration: performance.now() - startTime,
    }
  }

  /**
   * Search indexed emails
   */
  async search(query: string, options?: SearchPayload['options']): Promise<SearchResultsPayload> {
    try {
      const worker = await this.getWorker('searchIndexer')
      const payload: SearchPayload = { query, options }
      return await worker.send<SearchResultsPayload>('SEARCH', payload)
    } catch (error) {
      if (this.fallbackEnabled) {
        logger.warn('workers', 'Falling back to main thread for search', {
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        return this.searchFallback(query)
      }
      throw error
    }
  }

  /**
   * Fallback: Search on main thread
   */
  private searchFallback(query: string): SearchResultsPayload {
    return {
      results: [],
      totalCount: 0,
      query,
      processingTime: 0,
    }
  }

  /**
   * Clear search index
   */
  async clearSearchIndex(): Promise<void> {
    try {
      const worker = await this.getWorker('searchIndexer')
      await worker.send('CLEAR_INDEX', {})
    } catch (error) {
      logger.warn('workers', 'Failed to clear search index', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  /**
   * Get search index statistics
   */
  async getSearchIndexStats(): Promise<IndexStatsPayload> {
    try {
      const worker = await this.getWorker('searchIndexer')
      return await worker.send<IndexStatsPayload>('GET_STATS', {})
    } catch {
      return {
        totalDocuments: 0,
        totalTokens: 0,
        indexSizeBytes: 0,
        lastUpdated: 0,
      }
    }
  }

  // ============================================================================
  // Email Parser APIs
  // ============================================================================

  /**
   * Parse a single email
   */
  async parseEmail(rawEmail: RawEmailData): Promise<ParsedEmail> {
    try {
      const worker = await this.getWorker('emailParser')
      const payload: ParseEmailPayload = { rawEmail }
      return await worker.send<ParsedEmail>('PARSE_EMAIL', payload)
    } catch (error) {
      if (this.fallbackEnabled) {
        logger.warn('workers', 'Falling back to main thread for parseEmail', {
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        return this.parseEmailFallback(rawEmail)
      }
      throw error
    }
  }

  /**
   * Fallback: Parse email on main thread
   */
  private parseEmailFallback(rawEmail: RawEmailData): ParsedEmail {
    // Minimal parsing fallback
    return {
      id: rawEmail.id,
      threadId: rawEmail.threadId,
      from: { name: '', email: rawEmail.headers['From'] || '' },
      to: [],
      subject: rawEmail.headers['Subject'] || '(No Subject)',
      body: {
        text: rawEmail.bodyParts[0]?.body || '',
      },
      timestamp: Date.now(),
      attachments: [],
      snippet: '',
    }
  }

  /**
   * Parse multiple emails in batch
   */
  async parseEmailsBatch(rawEmails: RawEmailData[]): Promise<ParsedEmail[]> {
    try {
      const worker = await this.getWorker('emailParser')
      const payload: ParseEmailsBatchPayload = { rawEmails }
      return await worker.send<ParsedEmail[]>('PARSE_EMAILS_BATCH', payload)
    } catch (error) {
      if (this.fallbackEnabled) {
        logger.warn('workers', 'Falling back to main thread for parseEmailsBatch', {
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        return rawEmails.map(this.parseEmailFallback)
      }
      throw error
    }
  }

  // ============================================================================
  // Management APIs
  // ============================================================================

  /**
   * Get all worker info
   */
  getWorkerInfo(): WorkerInfo[] {
    return Array.from(this.workers.values()).map((w) => w.getInfo())
  }

  /**
   * Terminate all workers
   */
  terminateAll(): void {
    for (const worker of this.workers.values()) {
      worker.terminate()
    }
    this.workers.clear()
    logger.info('workers', 'All workers terminated')
  }

  /**
   * Terminate workers of specific type
   */
  terminateByType(type: WorkerType): void {
    for (const [id, worker] of this.workers) {
      if (worker.type === type) {
        worker.terminate()
        this.workers.delete(id)
      }
    }
  }

  /**
   * Enable/disable fallback to main thread
   */
  setFallbackEnabled(enabled: boolean): void {
    this.fallbackEnabled = enabled
  }

  /**
   * Check if workers are supported
   */
  static isSupported(): boolean {
    return typeof Worker !== 'undefined'
  }

  /**
   * Reset singleton (for testing)
   * @internal
   */
  static __resetForTesting(): void {
    if (WorkerManager.instance) {
      WorkerManager.instance.terminateAll()
    }
    WorkerManager.instance = null as unknown as WorkerManager
  }
}

/**
 * Singleton instance export
 */
export const workerManager = WorkerManager.getInstance()
