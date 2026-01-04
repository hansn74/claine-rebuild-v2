/**
 * Log Store
 *
 * IndexedDB-based persistence for log entries.
 * Maintains a rolling buffer of the last 1000 entries.
 *
 * Uses raw IndexedDB (not RxDB) to avoid circular dependencies
 * and keep the logger as lightweight as possible.
 *
 * Features:
 * - Rolling buffer (max 1000 entries)
 * - Async, non-blocking writes
 * - JSON export for debugging
 * - Clear function for maintenance
 */

import type { LogEntry } from './types'

const DB_NAME = 'claine-logs'
const DB_VERSION = 1
const STORE_NAME = 'logs'
const MAX_ENTRIES = 1000

/**
 * Log Store class for IndexedDB persistence
 */
class LogStore {
  private db: IDBDatabase | null = null
  private initPromise: Promise<void> | null = null

  /**
   * Initialize the IndexedDB database
   */
  private async init(): Promise<void> {
    if (this.db) return
    if (this.initPromise) return this.initPromise

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => {
        reject(new Error('Failed to open log database'))
      }

      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        // Create logs object store with auto-incrementing key
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, {
            keyPath: 'id',
            autoIncrement: true,
          })

          // Index by timestamp for efficient querying/cleanup
          store.createIndex('timestamp', 'timestamp', { unique: false })
        }
      }
    })

    return this.initPromise
  }

  /**
   * Add a log entry to the store
   * Automatically trims old entries to maintain rolling buffer
   */
  async addEntry(entry: LogEntry): Promise<void> {
    try {
      await this.init()
      if (!this.db) return

      const transaction = this.db.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)

      // Add the new entry
      store.add(entry)

      // Trim old entries if over limit
      await this.trimEntries()
    } catch {
      // Silently fail - logging should not break the app
    }
  }

  /**
   * Get all log entries
   */
  async getEntries(): Promise<LogEntry[]> {
    await this.init()
    if (!this.db) return []

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.getAll()

      request.onsuccess = () => {
        resolve(request.result as LogEntry[])
      }

      request.onerror = () => {
        reject(new Error('Failed to get log entries'))
      }
    })
  }

  /**
   * Export all logs as JSON string
   * Useful for debugging and support
   */
  async exportAsJson(): Promise<string> {
    const entries = await this.getEntries()
    return JSON.stringify(entries, null, 2)
  }

  /**
   * Clear all log entries
   */
  async clear(): Promise<void> {
    await this.init()
    if (!this.db) return

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.clear()

      request.onsuccess = () => {
        resolve()
      }

      request.onerror = () => {
        reject(new Error('Failed to clear log entries'))
      }
    })
  }

  /**
   * Get the current entry count
   */
  async getCount(): Promise<number> {
    await this.init()
    if (!this.db) return 0

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.count()

      request.onsuccess = () => {
        resolve(request.result)
      }

      request.onerror = () => {
        reject(new Error('Failed to count log entries'))
      }
    })
  }

  /**
   * Trim old entries to maintain rolling buffer
   * Keeps only the most recent MAX_ENTRIES
   */
  private async trimEntries(): Promise<void> {
    if (!this.db) return

    const count = await this.getCount()
    if (count <= MAX_ENTRIES) return

    const toDelete = count - MAX_ENTRIES

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const index = store.index('timestamp')

      // Get the oldest entries
      const request = index.openCursor()
      let deleted = 0

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
        if (cursor && deleted < toDelete) {
          cursor.delete()
          deleted++
          cursor.continue()
        } else {
          resolve()
        }
      }

      request.onerror = () => {
        resolve() // Fail silently
      }
    })
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close()
      this.db = null
      this.initPromise = null
    }
  }
}

/**
 * Singleton log store instance
 */
export const logStore = new LogStore()
