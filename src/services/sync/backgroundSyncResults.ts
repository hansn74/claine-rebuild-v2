/**
 * Background Sync Results
 *
 * Story 2.18: Persistent Send Queue with Background Sync API
 * Task 4: Background Send Notifications (AC: 8)
 *
 * Manages send results from the service worker.
 * When the SW sends emails in the background (tab closed), results are stored
 * in a dedicated IndexedDB store. On next app load, results are displayed as toasts.
 */

import { logger } from '@/services/logger'

const DB_NAME = 'claine-send-results'
const DB_VERSION = 1
const STORE_NAME = 'results'

export interface SendResult {
  queueItemId: string
  status: 'sent' | 'failed'
  sentAt?: number
  error?: string
  recipients: string
  subject: string
  processedBy: 'sw' | 'app'
  processedAt: number
  acknowledged?: boolean
}

/**
 * Open the send results IndexedDB database
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'queueItemId' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/**
 * Get all unacknowledged send results (Task 4.3)
 * Called on app startup to show notifications for background sends
 */
async function getUnacknowledgedResults(): Promise<SendResult[]> {
  try {
    const db = await openDatabase()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const request = store.getAll()

      request.onsuccess = () => {
        const results = (request.result || []).filter((r: SendResult) => !r.acknowledged)
        resolve(results)
      }
      request.onerror = () => reject(request.error)
      tx.oncomplete = () => db.close()
    })
  } catch (err) {
    logger.warn('backgroundSync', 'Failed to get send results', { error: err })
    return []
  }
}

/**
 * Mark results as acknowledged after displaying to user (Task 4.4)
 */
async function acknowledgeResults(queueItemIds: string[]): Promise<void> {
  if (queueItemIds.length === 0) return

  try {
    const db = await openDatabase()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)

    for (const id of queueItemIds) {
      store.delete(id)
    }

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => {
        db.close()
        resolve()
      }
      tx.onerror = () => {
        db.close()
        reject(tx.error)
      }
    })
  } catch (err) {
    logger.warn('backgroundSync', 'Failed to acknowledge results', { error: err })
  }
}

/**
 * Set up message listener for real-time results from service worker (Task 4.1)
 * @param callback - Function called when SW sends a result
 * @returns Cleanup function to remove listener
 */
function onSendResult(callback: (result: SendResult) => void): () => void {
  const handler = (event: MessageEvent) => {
    if (event.data?.type === 'send-queue-result' && event.data.result) {
      callback(event.data.result)
    }
  }

  navigator.serviceWorker?.addEventListener('message', handler)

  return () => {
    navigator.serviceWorker?.removeEventListener('message', handler)
  }
}

export const backgroundSyncResults = {
  getUnacknowledgedResults,
  acknowledgeResults,
  onSendResult,
}
