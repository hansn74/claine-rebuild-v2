/**
 * Attachment Blob Store
 *
 * Story 2.18: Persistent Send Queue with Background Sync API
 * Task 1: Persistent Attachment Storage (AC: 1, 2, 3, 4)
 *
 * Stores attachment binary data in a dedicated IndexedDB object store
 * (separate from RxDB) to avoid stack overflow with large base64 strings.
 *
 * This store is accessible from both the app context and the service worker context.
 *
 * Design decisions:
 * - Raw IndexedDB (not RxDB) because blobs don't fit RxDB schemas well
 * - Compound key [queueItemId, attachmentId] for efficient lookup and batch delete
 * - Separate DB name to avoid conflicts with RxDB's Dexie adapter
 * - Cached connection to avoid repeated open/close cycles during batch operations
 */

import { logger } from '@/services/logger'

const DB_NAME = 'claine-attachment-blobs'
const DB_VERSION = 1
const STORE_NAME = 'blobs'

/** Minimum free space buffer (10MB) required beyond the attachment size */
const QUOTA_BUFFER_BYTES = 10 * 1024 * 1024

/** Idle timeout (ms) before cached connection is closed */
const CONNECTION_IDLE_TIMEOUT = 5000

export interface AttachmentBlobRecord {
  queueItemId: string
  attachmentId: string
  blob: string // base64-encoded content
  size: number
  mimeType: string
  createdAt: number
}

/**
 * Cached database connection and idle timer.
 * Reuses a single connection across rapid sequential operations,
 * closing it after CONNECTION_IDLE_TIMEOUT ms of inactivity.
 */
let cachedDb: IDBDatabase | null = null
let idleTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Get or open the attachment blob IndexedDB database.
 * Returns a cached connection if available, otherwise opens a new one.
 * Resets the idle timer on each access.
 */
function getConnection(): Promise<IDBDatabase> {
  // Reset idle timer on each access
  if (idleTimer !== null) {
    clearTimeout(idleTimer)
  }
  idleTimer = setTimeout(() => {
    if (cachedDb) {
      cachedDb.close()
      cachedDb = null
    }
    idleTimer = null
  }, CONNECTION_IDLE_TIMEOUT)

  if (cachedDb) {
    return Promise.resolve(cachedDb)
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, {
          keyPath: ['queueItemId', 'attachmentId'],
        })
        // Index for batch operations per queue item
        store.createIndex('byQueueItemId', 'queueItemId', { unique: false })
      }
    }

    request.onsuccess = () => {
      cachedDb = request.result
      // If the connection is closed externally (e.g., versionchange), clear cache
      cachedDb.onclose = () => {
        cachedDb = null
      }
      cachedDb.onversionchange = () => {
        cachedDb?.close()
        cachedDb = null
      }
      resolve(cachedDb)
    }
    request.onerror = () => reject(request.error)
  })
}

/**
 * Store an attachment blob in IndexedDB
 *
 * @param queueItemId - The send queue item ID
 * @param attachmentId - The attachment ID within the queue item
 * @param blob - Base64-encoded attachment content
 * @param size - Original file size in bytes
 * @param mimeType - MIME type of the attachment
 */
async function put(
  queueItemId: string,
  attachmentId: string,
  blob: string,
  size: number,
  mimeType: string
): Promise<void> {
  const db = await getConnection()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)

    const record: AttachmentBlobRecord = {
      queueItemId,
      attachmentId,
      blob,
      size,
      mimeType,
      createdAt: Date.now(),
    }

    store.put(record)

    tx.oncomplete = () => {
      logger.debug('attachmentBlobStore', 'Blob stored', {
        queueItemId,
        attachmentId,
        size,
      })
      resolve()
    }
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'))
  })
}

/**
 * Retrieve an attachment blob from IndexedDB
 *
 * @param queueItemId - The send queue item ID
 * @param attachmentId - The attachment ID
 * @returns The blob record or null if not found
 */
async function get(
  queueItemId: string,
  attachmentId: string
): Promise<AttachmentBlobRecord | null> {
  const db = await getConnection()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)

    const request = store.get([queueItemId, attachmentId])
    let result: AttachmentBlobRecord | null = null

    request.onsuccess = () => {
      result = request.result || null
    }
    request.onerror = () => reject(request.error)

    tx.oncomplete = () => resolve(result)
    tx.onerror = () => reject(tx.error)
  })
}

/**
 * Get all attachment blobs for a queue item
 *
 * @param queueItemId - The send queue item ID
 * @returns Array of blob records for the queue item
 */
async function getAllForQueueItem(queueItemId: string): Promise<AttachmentBlobRecord[]> {
  const db = await getConnection()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const index = store.index('byQueueItemId')

    const request = index.getAll(queueItemId)
    let result: AttachmentBlobRecord[] = []

    request.onsuccess = () => {
      result = request.result || []
    }
    request.onerror = () => reject(request.error)

    tx.oncomplete = () => resolve(result)
    tx.onerror = () => reject(tx.error)
  })
}

/**
 * Delete all attachment blobs for a queue item
 *
 * @param queueItemId - The send queue item ID
 * @returns Number of blobs deleted
 */
async function deleteForQueueItem(queueItemId: string): Promise<number> {
  const db = await getConnection()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const index = store.index('byQueueItemId')

    // First get all keys for this queue item
    const getRequest = index.getAllKeys(queueItemId)
    let expectedCount = 0

    getRequest.onsuccess = () => {
      const keys = getRequest.result
      expectedCount = keys.length
      if (keys.length === 0) {
        // No keys to delete — transaction will still complete
        return
      }

      for (const key of keys) {
        store.delete(key)
      }
    }
    getRequest.onerror = () => reject(getRequest.error)

    tx.oncomplete = () => {
      if (expectedCount > 0) {
        logger.debug('attachmentBlobStore', 'Blobs deleted for queue item', {
          queueItemId,
          count: expectedCount,
        })
      }
      resolve(expectedCount)
    }
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'))
  })
}

/**
 * Check if the browser has sufficient storage quota for an attachment.
 * Uses the StorageManager API to estimate available space.
 *
 * AC 4: Storage quota checked before persisting large attachments
 *
 * @param requiredBytes - Number of bytes needed for the attachment
 * @returns Object indicating if quota is sufficient, with available/required info
 */
async function checkQuota(
  requiredBytes: number
): Promise<{ sufficient: boolean; available: number; required: number }> {
  const required = requiredBytes + QUOTA_BUFFER_BYTES

  if (!navigator.storage || !navigator.storage.estimate) {
    // If StorageManager API not available, assume sufficient
    return { sufficient: true, available: Infinity, required }
  }

  try {
    const estimate = await navigator.storage.estimate()
    const available = (estimate.quota || 0) - (estimate.usage || 0)
    return {
      sufficient: available >= required,
      available,
      required,
    }
  } catch {
    // On error, assume sufficient to avoid blocking sends
    return { sufficient: true, available: Infinity, required }
  }
}

/**
 * Get all queue item IDs that have blobs stored
 *
 * @returns Set of queue item IDs with stored blobs
 */
async function getAllQueueItemIds(): Promise<Set<string>> {
  const db = await getConnection()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const index = store.index('byQueueItemId')

    const ids = new Set<string>()
    const request = index.openKeyCursor()

    request.onsuccess = () => {
      const cursor = request.result
      if (cursor) {
        ids.add(cursor.key as string)
        cursor.continue()
      }
    }
    request.onerror = () => reject(request.error)

    tx.oncomplete = () => resolve(ids)
    tx.onerror = () => reject(tx.error)
  })
}

/**
 * Clean up orphaned blobs whose queue items no longer exist.
 * Should be called on app startup (Task 1.8).
 *
 * AC 3: Attachment storage cleaned up after successful send (no orphaned blobs)
 *
 * @param activeQueueItemIds - Set of queue item IDs that still exist in the send queue
 * @returns Number of orphaned blobs removed
 */
async function cleanupOrphanedBlobs(activeQueueItemIds: Set<string>): Promise<number> {
  const storedIds = await getAllQueueItemIds()
  let totalRemoved = 0

  for (const storedId of storedIds) {
    if (!activeQueueItemIds.has(storedId)) {
      const removed = await deleteForQueueItem(storedId)
      totalRemoved += removed
      logger.info('attachmentBlobStore', 'Cleaned up orphaned blobs', {
        queueItemId: storedId,
        count: removed,
      })
    }
  }

  if (totalRemoved > 0) {
    logger.info('attachmentBlobStore', 'Orphan cleanup complete', {
      totalRemoved,
    })
  }

  return totalRemoved
}

/**
 * Check if blobs exist for a given queue item
 *
 * @param queueItemId - The send queue item ID
 * @returns true if any blobs exist for this queue item
 */
async function hasBlobs(queueItemId: string): Promise<boolean> {
  const blobs = await getAllForQueueItem(queueItemId)
  return blobs.length > 0
}

export const attachmentBlobStore = {
  put,
  get,
  getAllForQueueItem,
  deleteForQueueItem,
  checkQuota,
  getAllQueueItemIds,
  cleanupOrphanedBlobs,
  hasBlobs,
}

// Also export the DB_NAME and STORE_NAME for service worker access
export { DB_NAME as ATTACHMENT_BLOB_DB_NAME, STORE_NAME as ATTACHMENT_BLOB_STORE_NAME }
