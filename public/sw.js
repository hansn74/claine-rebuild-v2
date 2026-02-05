/**
 * Service Worker - Background Send Queue Processing
 *
 * Story 2.18: Persistent Send Queue with Background Sync API
 * Task 2: Service Worker Setup (AC: 5, 6, 7)
 *
 * Minimal service worker focused on Background Sync for the send queue.
 * This file is plain JS (not bundled by Vite) — it runs in its own thread
 * without DOM or module bundler access.
 *
 * IMPORTANT: Cannot use RxDB, app imports, or ES modules.
 * Must use raw IndexedDB APIs to read queue items and auth tokens.
 */

// Constants matching the app's database names
const RXDB_NAME = 'claine-email-v6'
const ATTACHMENT_BLOB_DB = 'claine-attachment-blobs'
const ATTACHMENT_BLOB_STORE = 'blobs'
const SYNC_TAG = 'send-queue-sync'
const SEND_RESULTS_DB = 'claine-send-results'
const SEND_RESULTS_STORE = 'results'

// RxDB Dexie adapter naming: "rxdb-dexie-{dbname}--{schemaVersion}--{collection}"
// All schemas are version 0; documents are stored in the "docs" object store.
const DEXIE_SCHEMA_VERSION = 0
const DEXIE_DOCS_STORE = 'docs'

// Gmail API base URL
const GMAIL_API_BASE = 'https://gmail.googleapis.com'
// Microsoft Graph API base URL
const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0'

/**
 * Open an IndexedDB database by name
 * @param {string} name - Database name
 * @param {number} version - Database version (optional)
 * @returns {Promise<IDBDatabase>}
 */
function openDB(name, version) {
  return new Promise((resolve, reject) => {
    const request = version ? indexedDB.open(name, version) : indexedDB.open(name)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onupgradeneeded = (event) => {
      const db = event.target.result
      // Create send-results store if opening that DB
      if (name === SEND_RESULTS_DB && !db.objectStoreNames.contains(SEND_RESULTS_STORE)) {
        db.createObjectStore(SEND_RESULTS_STORE, { keyPath: 'queueItemId' })
      }
    }
  })
}

/**
 * Read a record from an IndexedDB object store
 * @param {IDBDatabase} db
 * @param {string} storeName
 * @param {*} key
 * @returns {Promise<*>}
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function readRecord(db, storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const request = store.get(key)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/**
 * Write a record to an IndexedDB object store
 * @param {IDBDatabase} db
 * @param {string} storeName
 * @param {*} record
 * @returns {Promise<void>}
 */
function writeRecord(db, storeName, record) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    const request = store.put(record)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

/**
 * Query records from an IndexedDB object store using an index
 * @param {IDBDatabase} db
 * @param {string} storeName
 * @param {string} indexName
 * @param {*} query
 * @returns {Promise<Array>}
 */
function queryByIndex(db, storeName, indexName, query) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const index = store.index(indexName)
    const request = index.getAll(query)
    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error)
  })
}

/**
 * Get all records from an IndexedDB object store
 * @param {IDBDatabase} db
 * @param {string} storeName
 * @returns {Promise<Array>}
 */
function getAllRecords(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const request = store.getAll()
    request.onsuccess = () => resolve(request.result || [])
    request.onerror = () => reject(request.error)
  })
}

/**
 * Get pending send queue items from RxDB's Dexie-backed IndexedDB.
 *
 * RxDB with Dexie adapter stores documents in the "docs" object store.
 * DB naming: "rxdb-dexie-{dbname}--{schemaVersion}--{collection}"
 * @returns {Promise<Array>} Array of pending queue item documents
 */
async function getPendingSendQueueItems() {
  try {
    const dexieDbName = `rxdb-dexie-${RXDB_NAME}--${DEXIE_SCHEMA_VERSION}--sendQueue`
    const db = await openDB(dexieDbName)

    if (!db.objectStoreNames.contains(DEXIE_DOCS_STORE)) {
      db.close()
      return []
    }

    const allDocs = await getAllRecords(db, DEXIE_DOCS_STORE)
    db.close()

    // Filter for pending items — skip items already being processed
    return allDocs.filter((doc) => doc.status === 'pending' && doc.lastProcessedBy !== 'sw')
  } catch (err) {
    console.error('[SW] Failed to read send queue:', err)
    return []
  }
}

/**
 * Get an auth token for an account from RxDB's token storage
 * @param {string} accountId - Format: "provider:email"
 * @returns {Promise<{access_token: string} | null>}
 */
async function getAuthToken(accountId) {
  try {
    const dexieDbName = `rxdb-dexie-${RXDB_NAME}--${DEXIE_SCHEMA_VERSION}--authTokens`
    const db = await openDB(dexieDbName)

    if (!db.objectStoreNames.contains(DEXIE_DOCS_STORE)) {
      db.close()
      return null
    }

    const allTokens = await getAllRecords(db, DEXIE_DOCS_STORE)
    db.close()

    // Token ID matches the email portion of accountId
    const email = accountId.includes(':') ? accountId.split(':').slice(1).join(':') : accountId
    const token = allTokens.find((t) => t.id === email || t.accountId === email)

    return token || null
  } catch (err) {
    console.error('[SW] Failed to read auth token:', err)
    return null
  }
}

/**
 * Get attachment blobs for a queue item
 * @param {string} queueItemId
 * @returns {Promise<Array>}
 */
async function getAttachmentBlobs(queueItemId) {
  try {
    const db = await openDB(ATTACHMENT_BLOB_DB)
    const blobs = await queryByIndex(db, ATTACHMENT_BLOB_STORE, 'byQueueItemId', queueItemId)
    db.close()
    return blobs
  } catch (err) {
    console.error('[SW] Failed to read attachment blobs:', err)
    return []
  }
}

/**
 * Update a send queue item's status in IndexedDB
 * @param {object} item - The queue item to update
 * @param {string} newStatus - New status value
 * @param {object} [extra] - Additional fields to merge
 */
async function updateQueueItemStatus(item, newStatus, extra = {}) {
  try {
    const dexieDbName = `rxdb-dexie-${RXDB_NAME}--${DEXIE_SCHEMA_VERSION}--sendQueue`
    const db = await openDB(dexieDbName)

    if (!db.objectStoreNames.contains(DEXIE_DOCS_STORE)) {
      db.close()
      return
    }

    const updated = {
      ...item,
      status: newStatus,
      updatedAt: Date.now(),
      lastProcessedBy: 'sw',
      ...extra,
    }

    await writeRecord(db, DEXIE_DOCS_STORE, updated)
    db.close()
  } catch (err) {
    console.error('[SW] Failed to update queue item:', err)
  }
}

/**
 * Store a send result for the app to display on next load
 * @param {object} result
 */
async function storeSendResult(result) {
  try {
    const db = await openDB(SEND_RESULTS_DB, 1)
    await writeRecord(db, SEND_RESULTS_STORE, result)
    db.close()
  } catch (err) {
    console.error('[SW] Failed to store send result:', err)
  }
}

/**
 * Notify all open clients of send results
 * @param {object} result - Send result object
 */
async function notifyClients(result) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  if (clients.length > 0) {
    for (const client of clients) {
      client.postMessage({ type: 'send-queue-result', result })
    }
  } else {
    // No open clients — store result for pickup on next load
    await storeSendResult(result)
  }
}

/**
 * Process a single send queue item
 * @param {object} item - Queue item document
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
async function processSendQueueItem(item) {
  // Check if already sent or sending (idempotency)
  if (item.status === 'sent' || item.status === 'sending') {
    return { success: true, messageId: item.sentMessageId }
  }

  // Mark as sending with SW ownership
  await updateQueueItemStatus(item, 'sending', {
    lastProcessedBy: 'sw',
    lastAttemptAt: Date.now(),
  })

  try {
    // Get auth token
    const tokenDoc = await getAuthToken(item.accountId)
    if (!tokenDoc) {
      throw new Error(`No auth token for account: ${item.accountId}`)
    }

    // Determine access_token from token document
    // Token documents may have encrypted tokens — SW can only use plaintext
    const accessToken = tokenDoc.access_token || tokenDoc.accessToken
    if (!accessToken) {
      throw new Error('Auth token not available in plaintext for SW processing')
    }

    // Get attachment blobs
    const blobs = await getAttachmentBlobs(item.id)
    const blobMap = {}
    for (const blob of blobs) {
      blobMap[blob.attachmentId] = blob
    }

    // Determine provider from accountId
    const provider = item.accountId.split(':')[0]

    let messageId
    if (provider === 'gmail') {
      messageId = await sendViaGmail(item, accessToken, blobMap)
    } else if (provider === 'outlook') {
      messageId = await sendViaOutlook(item, accessToken, blobMap)
    } else {
      throw new Error(`Unknown provider: ${provider}`)
    }

    // Mark as sent
    await updateQueueItemStatus(item, 'sent', {
      sentAt: Date.now(),
      sentMessageId: messageId,
    })

    return { success: true, messageId }
  } catch (err) {
    const errorMessage = err.message || 'Unknown error'
    const attempts = (item.attempts || 0) + 1

    if (attempts >= (item.maxAttempts || 3)) {
      await updateQueueItemStatus(item, 'failed', {
        attempts,
        error: errorMessage,
      })
    } else {
      await updateQueueItemStatus(item, 'pending', {
        attempts,
        error: errorMessage,
      })
    }

    return { success: false, error: errorMessage }
  }
}

/**
 * Send an email via Gmail API
 * Constructs an RFC 2822 message and sends via Gmail's send endpoint
 */
async function sendViaGmail(item, accessToken, blobMap) {
  const raw = buildRFC2822Message(item, blobMap)
  const base64url = btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

  const response = await fetch(`${GMAIL_API_BASE}/gmail/v1/users/me/messages/send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw: base64url }),
  })

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '')
    throw new Error(`Gmail send failed (${response.status}): ${errorBody}`)
  }

  const result = await response.json()
  return result.id
}

/**
 * Send an email via Microsoft Graph API
 */
async function sendViaOutlook(item, accessToken, blobMap) {
  const message = buildGraphMessage(item, blobMap)

  const response = await fetch(`${GRAPH_API_BASE}/me/sendMail`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message }),
  })

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '')
    throw new Error(`Outlook send failed (${response.status}): ${errorBody}`)
  }

  // Graph API returns 202 with no body on success
  return `outlook-${Date.now()}`
}

/**
 * Build an RFC 2822 formatted email for Gmail API
 */
function buildRFC2822Message(item, blobMap) {
  const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`
  const hasAttachments = item.attachments && item.attachments.length > 0

  let headers = ''
  headers += `From: ${item.accountId.split(':').slice(1).join(':')}\r\n`
  headers += `To: ${item.to.map((r) => r.email).join(', ')}\r\n`
  if (item.cc && item.cc.length > 0) {
    headers += `Cc: ${item.cc.map((r) => r.email).join(', ')}\r\n`
  }
  headers += `Subject: ${item.subject}\r\n`
  headers += `MIME-Version: 1.0\r\n`

  if (item.threadId) {
    headers += `In-Reply-To: ${item.replyToEmailId || ''}\r\n`
    headers += `References: ${item.replyToEmailId || ''}\r\n`
  }

  if (hasAttachments) {
    headers += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n`
    headers += `\r\n`

    // Body part
    let body = `--${boundary}\r\n`
    body += `Content-Type: text/html; charset="UTF-8"\r\n`
    body += `Content-Transfer-Encoding: 7bit\r\n\r\n`
    body += (item.body && item.body.html) || (item.body && item.body.text) || ''
    body += `\r\n`

    // Attachment parts
    for (const att of item.attachments) {
      const blob = blobMap[att.id]
      if (blob && blob.blob) {
        body += `--${boundary}\r\n`
        body += `Content-Type: ${att.mimeType}; name="${att.filename}"\r\n`
        body += `Content-Disposition: attachment; filename="${att.filename}"\r\n`
        body += `Content-Transfer-Encoding: base64\r\n\r\n`
        body += blob.blob + `\r\n`
      }
    }
    body += `--${boundary}--\r\n`

    return headers + body
  } else {
    headers += `Content-Type: text/html; charset="UTF-8"\r\n`
    headers += `\r\n`
    return headers + ((item.body && item.body.html) || (item.body && item.body.text) || '')
  }
}

/**
 * Build a Microsoft Graph API message object
 */
function buildGraphMessage(item, blobMap) {
  const message = {
    subject: item.subject,
    body: {
      contentType: 'HTML',
      content: (item.body && item.body.html) || (item.body && item.body.text) || '',
    },
    toRecipients: item.to.map((r) => ({
      emailAddress: { address: r.email, name: r.name },
    })),
    ccRecipients: (item.cc || []).map((r) => ({
      emailAddress: { address: r.email, name: r.name },
    })),
    bccRecipients: (item.bcc || []).map((r) => ({
      emailAddress: { address: r.email, name: r.name },
    })),
  }

  // Add attachments
  if (item.attachments && item.attachments.length > 0) {
    message.attachments = []
    for (const att of item.attachments) {
      const blob = blobMap[att.id]
      if (blob && blob.blob) {
        message.attachments.push({
          '@odata.type': '#microsoft.graph.fileAttachment',
          name: att.filename,
          contentType: att.mimeType,
          contentBytes: blob.blob,
        })
      }
    }
  }

  return message
}

// ============================================================
// Service Worker Event Listeners
// ============================================================

/**
 * Install event — activate immediately
 */
self.addEventListener('install', () => {
  self.skipWaiting()
})

/**
 * Activate event — claim all clients
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

/**
 * Sync event — Background Sync API (Task 2.3)
 * Triggered by the browser when connectivity is restored.
 * AC 5: Register a sync event with the service worker for each queued send operation
 * AC 6: Service worker processes the send queue even after the tab is closed
 */
self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(processAllPendingItems())
  }
})

/**
 * Process all pending send queue items
 */
async function processAllPendingItems() {
  console.warn('[SW] Processing pending send queue items...')

  const items = await getPendingSendQueueItems()
  if (items.length === 0) {
    console.warn('[SW] No pending items to process')
    return
  }

  console.warn(`[SW] Found ${items.length} pending items`)

  for (const item of items) {
    const result = await processSendQueueItem(item)

    const sendResult = {
      queueItemId: item.id,
      status: result.success ? 'sent' : 'failed',
      sentAt: result.success ? Date.now() : undefined,
      error: result.error,
      recipients: item.to.map((r) => r.email).join(', '),
      subject: item.subject,
      processedBy: 'sw',
      processedAt: Date.now(),
    }

    await notifyClients(sendResult)
  }

  console.warn('[SW] Finished processing send queue')
}

/**
 * Message event — handle messages from the app
 * Used for ping/pong health checks and manual sync triggers
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'ping') {
    event.ports[0]?.postMessage({ type: 'pong' })
  }

  if (event.data && event.data.type === 'trigger-sync') {
    processAllPendingItems()
  }
})
