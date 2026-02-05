# Service Workers for Offline-First Email Clients

**Research Document for Claine v2**
**Date:** 2025-10-28
**Focus:** Practical offline-first email implementations with Gmail API

---

## Executive Summary

This document provides actionable guidance for implementing service workers in Claine v2, an offline-first email client built with React 19, Vite, and the Gmail API. Based on current industry practices (2024-2025) and real-world implementations from Gmail and Fastmail, this research focuses on practical patterns for achieving true offline functionality.

### Key Recommendations for Claine v2

1. **Use Workbox 7+ with vite-plugin-pwa** for simplified service worker management
2. **Implement a hybrid caching strategy:**
   - Cache-first for app shell (HTML, JS, CSS)
   - Stale-while-revalidate for email metadata and messages
   - Network-first for compose/send operations
3. **Use IndexedDB for email storage** with separate object stores for metadata and content
4. **Implement Background Sync API** for queued actions (send, archive, delete) with automatic retry
5. **Skip Periodic Background Sync** initially (Chrome-only, requires PWA installation)
6. **Use controlled service worker updates** with user notification rather than skipWaiting()
7. **Store last 30-90 days of email locally** following Gmail's offline pattern

### Implementation Priority

**Phase 1 (MVP):**

- Basic service worker with app shell precaching
- IndexedDB email storage (metadata + content)
- Background sync for send queue
- Offline detection and UI feedback

**Phase 2 (Enhanced):**

- Advanced caching strategies for images/attachments
- Gmail API push notifications integration
- Conflict resolution for offline changes
- Cache versioning and cleanup

**Phase 3 (Optimization):**

- Periodic background sync (Chrome only)
- Advanced attachment handling
- Performance monitoring and optimization

---

## 1. Service Worker Lifecycle for Email Clients

### Overview

Service workers act as a programmable network proxy between your application and the network, enabling offline functionality, background sync, and advanced caching strategies. Understanding the lifecycle is critical for email applications where data freshness and reliability are paramount.

### The Four Lifecycle Stages

```
Registration → Installation → Activation → Update
     ↓              ↓             ↓           ↓
  Register      Download      Take Control  Replace
  sw.js         & Cache       of Clients    Old SW
```

#### 1. Registration

Registration happens in your main application code (not in the service worker itself):

```javascript
// src/main.tsx or src/serviceWorkerRegistration.ts
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none', // Important for development
      })

      console.log('Service Worker registered:', registration.scope)

      // Check for updates periodically (important for SPAs)
      setInterval(
        () => {
          registration.update()
        },
        60 * 60 * 1000
      ) // Check hourly
    } catch (error) {
      console.error('Service Worker registration failed:', error)
    }
  })
}
```

**Key Points for Email SPAs:**

- Service workers can only be registered from the same origin (no CDN)
- Scope determines which URLs the service worker can intercept
- SPAs need manual update checks since they don't trigger navigation requests
- `updateViaCache: 'none'` prevents caching during development

#### 2. Installation

The installation phase is where you precache your application shell:

```javascript
// sw.js
const CACHE_VERSION = 'claine-v2-v1.0.0'
const APP_SHELL = [
  '/',
  '/index.html',
  '/assets/index.js',
  '/assets/index.css',
  '/assets/fonts/roboto.woff2',
  '/manifest.json',
]

self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...')

  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => {
        console.log('[Service Worker] Caching app shell')
        return cache.addAll(APP_SHELL)
      })
      .then(() => {
        console.log('[Service Worker] App shell cached')
        // Skip waiting to activate immediately (use with caution)
        // return self.skipWaiting();
      })
  )
})
```

**Best Practices:**

- Precache only critical resources (app shell pattern)
- Use versioned cache names for easy invalidation
- Keep precache list small (<2MB) for fast installation
- Handle installation failures gracefully

#### 3. Activation

Activation is when the service worker takes control and old caches are cleaned up:

```javascript
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...')

  event.waitUntil(
    (async () => {
      // Clean up old caches
      const cacheNames = await caches.keys()
      await Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_VERSION)
          .map((name) => {
            console.log('[Service Worker] Deleting old cache:', name)
            return caches.delete(name)
          })
      )

      // Take control of all clients immediately
      await self.clients.claim()
      console.log('[Service Worker] Activated and claimed clients')
    })()
  )
})
```

**Important for Email Clients:**

- Clean up old caches to prevent storage bloat
- Use `clients.claim()` to take control immediately
- Consider data migration if IndexedDB schema changes

#### 4. Updates

Updates are triggered by navigation events or manual checks:

```javascript
// In your React app
function useServiceWorkerUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [registration, setRegistration] = useState(null)

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        setRegistration(reg)

        // Check for updates
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New service worker available
              setUpdateAvailable(true)
            }
          })
        })
      })
    }
  }, [])

  const applyUpdate = () => {
    if (registration?.waiting) {
      // Tell the service worker to skip waiting
      registration.waiting.postMessage({ type: 'SKIP_WAITING' })

      // Listen for controller change
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload()
      })
    }
  }

  return { updateAvailable, applyUpdate }
}
```

### skipWaiting vs Controlled Update

| Approach              | Pros                                          | Cons                                                | Recommendation                |
| --------------------- | --------------------------------------------- | --------------------------------------------------- | ----------------------------- |
| **skipWaiting()**     | Immediate updates, no user interaction needed | Can break app if old/new versions conflict, poor UX | Avoid for email clients       |
| **Controlled Update** | Safe, user controls timing, prevents breakage | Requires user action, delayed updates               | **Recommended for Claine v2** |

**Why Controlled Updates for Email?**

- Email composition in progress could be lost
- Cached API responses may be incompatible between versions
- User may have unsaved drafts or queued actions
- Better UX to notify and let user choose when to update

### Service Worker Lifecycle Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  REGISTRATION (main.tsx)                                        │
│  navigator.serviceWorker.register('/sw.js')                     │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  INSTALLING                                                     │
│  • Download sw.js                                               │
│  • Parse and execute                                            │
│  • Fire 'install' event                                         │
│  • Precache app shell                                           │
│  • Optional: self.skipWaiting()                                 │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  WAITING (if old SW exists and skipWaiting not called)          │
│  • New SW waits for old SW to release all clients              │
│  • User can be notified of pending update                       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  ACTIVATING                                                     │
│  • Fire 'activate' event                                        │
│  • Clean up old caches                                          │
│  • Optional: self.clients.claim()                               │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  ACTIVATED                                                      │
│  • Service worker controls all pages in scope                   │
│  • Intercepts fetch events                                      │
│  • Handles background sync                                      │
│  • Active until replaced or unregistered                        │
└─────────────────────────────────────────────────────────────────┘
         │                                           │
         │  Navigation or update check               │  Fetch events,
         │  finds byte-different sw.js               │  sync events
         ▼                                           ▼
    [INSTALLING] ─────────────────────────────> [Handle Events]
```

### Scope and Navigation Handling for SPAs

**Challenge:** In SPAs like Claine v2, client-side routing (React Router) doesn't trigger network requests, so service worker updates aren't automatically checked.

**Solution:**

```javascript
// src/hooks/useServiceWorkerUpdate.ts
export function useServiceWorkerUpdate(checkInterval = 3600000) {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    let intervalId

    navigator.serviceWorker.ready.then((registration) => {
      // Manual update check on interval
      intervalId = setInterval(() => {
        registration.update()
      }, checkInterval)

      // Also check on visibility change
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          registration.update()
        }
      })
    })

    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [checkInterval])
}
```

**Scope Configuration:**

For Claine v2, register the service worker at root scope:

```javascript
// ✅ Correct - controls all routes
navigator.serviceWorker.register('/sw.js', { scope: '/' })

// ❌ Wrong - only controls /email/ routes
navigator.serviceWorker.register('/sw.js', { scope: '/email/' })
```

---

## 2. Caching Strategies

### Overview

Different resources in an email client have different freshness requirements. A hybrid approach using multiple strategies is recommended.

### Caching Strategy Comparison

| Strategy                   | When to Use                                           | Pros                 | Cons                                   | Best For                             |
| -------------------------- | ----------------------------------------------------- | -------------------- | -------------------------------------- | ------------------------------------ |
| **Cache First**            | Static assets that rarely change                      | Fast, works offline  | Can serve stale content                | App shell (HTML, CSS, JS, fonts)     |
| **Network First**          | Content that must be fresh                            | Always up-to-date    | Slow on poor connection, offline fails | Compose, send, settings changes      |
| **Stale-While-Revalidate** | Content that should be fresh but staleness acceptable | Fast + fresh         | Always makes network request           | Email list, message content, avatars |
| **Cache Only**             | Precached resources                                   | Fastest, predictable | Never updates until SW update          | Build-time assets with hashed names  |
| **Network Only**           | Authentication, real-time actions                     | Always fresh, simple | No offline support                     | OAuth flows, logout                  |

### Recommended Strategy Map for Claine v2

```javascript
// Workbox configuration (vite.config.ts)
export default {
  plugins: [
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      workbox: {
        // App shell - Cache First
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        globIgnores: ['**/node_modules/**/*'],

        // Runtime caching rules
        runtimeCaching: [
          {
            // Gmail API - Stale While Revalidate
            urlPattern:
              /^https:\/\/gmail\.googleapis\.com\/gmail\/v1\/(users\/me\/messages|users\/me\/threads)/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'gmail-api-messages',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Gmail API User Profile - Cache First
            urlPattern: /^https:\/\/gmail\.googleapis\.com\/gmail\/v1\/users\/me\/profile/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gmail-api-profile',
              expiration: {
                maxAgeSeconds: 24 * 60 * 60, // 1 day
              },
            },
          },
          {
            // OAuth/Token endpoints - Network Only
            urlPattern: /^https:\/\/oauth2\.googleapis\.com/,
            handler: 'NetworkOnly',
          },
          {
            // Avatar images - Stale While Revalidate
            urlPattern: /^https:.*\.(jpg|jpeg|png|gif|webp)/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'images',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
              },
            },
          },
        ],
      },
    }),
  ],
}
```

### Email-Specific Caching Patterns

#### Pattern 1: Message List (Stale-While-Revalidate)

```javascript
// Custom handler in sw.ts
import { StaleWhileRevalidate } from 'workbox-strategies'
import { registerRoute } from 'workbox-routing'

// Cache message list API responses
registerRoute(
  ({ url }) => url.pathname.includes('/gmail/v1/users/me/messages'),
  new StaleWhileRevalidate({
    cacheName: 'gmail-messages',
    plugins: [
      {
        cacheWillUpdate: async ({ response }) => {
          // Only cache successful responses
          if (response && response.status === 200) {
            return response
          }
          return null
        },
        // Add timestamp to track freshness
        cacheDidUpdate: async ({ cacheName, request }) => {
          const cache = await caches.open(cacheName)
          const response = await cache.match(request)
          if (response) {
            const clonedResponse = response.clone()
            const body = await clonedResponse.json()
            console.log('[SW] Updated message cache:', body.messages?.length)
          }
        },
      },
    ],
  })
)
```

#### Pattern 2: Message Content with IndexedDB

For actual message content, Cache API + IndexedDB coordination is recommended:

```javascript
// src/services/emailCache.ts
import { openDB } from 'idb'

const DB_NAME = 'claine-emails'
const DB_VERSION = 1

// Initialize IndexedDB
export async function initDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Metadata store (for fast listing)
      if (!db.objectStoreNames.contains('emailMetadata')) {
        const metadataStore = db.createObjectStore('emailMetadata', { keyPath: 'id' })
        metadataStore.createIndex('threadId', 'threadId')
        metadataStore.createIndex('timestamp', 'timestamp')
        metadataStore.createIndex('mailboxIds', 'mailboxIds', { multiEntry: true })
      }

      // Content store (for full messages)
      if (!db.objectStoreNames.contains('emailContent')) {
        const contentStore = db.createObjectStore('emailContent', { keyPath: 'id' })
        contentStore.createIndex('timestamp', 'timestamp')
      }

      // Attachments store
      if (!db.objectStoreNames.contains('attachments')) {
        const attachmentStore = db.createObjectStore('attachments', { keyPath: 'id' })
        attachmentStore.createIndex('messageId', 'messageId')
      }
    },
  })
}

// Store email metadata (lightweight)
export async function storeEmailMetadata(messages) {
  const db = await initDB()
  const tx = db.transaction('emailMetadata', 'readwrite')

  await Promise.all(
    messages.map((msg) =>
      tx.store.put({
        id: msg.id,
        threadId: msg.threadId,
        timestamp: msg.internalDate,
        subject: msg.payload.headers.find((h) => h.name === 'Subject')?.value,
        from: msg.payload.headers.find((h) => h.name === 'From')?.value,
        snippet: msg.snippet,
        labelIds: msg.labelIds,
        mailboxIds: msg.labelIds, // For index
      })
    )
  )

  await tx.done
}

// Store full email content (including body)
export async function storeEmailContent(message) {
  const db = await initDB()
  await db.put('emailContent', {
    id: message.id,
    timestamp: Date.now(),
    raw: message, // Full Gmail API response
  })
}

// Retrieve from IndexedDB (offline-first)
export async function getEmail(messageId) {
  const db = await initDB()

  // Try content store first
  const content = await db.get('emailContent', messageId)
  if (content) {
    return content.raw
  }

  // Fallback to metadata only
  const metadata = await db.get('emailMetadata', messageId)
  return metadata || null
}

// List emails by mailbox (fast)
export async function listEmailsByMailbox(labelId, limit = 50) {
  const db = await initDB()
  const index = db.transaction('emailMetadata').store.index('mailboxIds')

  let emails = await index.getAll(labelId)

  // Sort by timestamp descending
  emails.sort((a, b) => b.timestamp - a.timestamp)

  return emails.slice(0, limit)
}
```

#### Pattern 3: Attachments (Selective Caching)

Attachments are large and shouldn't be cached automatically:

```javascript
// src/services/attachmentCache.ts
export async function cacheAttachment(messageId, attachmentId, blob, filename) {
  const db = await initDB()

  await db.put('attachments', {
    id: `${messageId}_${attachmentId}`,
    messageId,
    attachmentId,
    filename,
    blob,
    cachedAt: Date.now(),
  })
}

export async function getAttachment(messageId, attachmentId) {
  const db = await initDB()
  return await db.get('attachments', `${messageId}_${attachmentId}`)
}

// UI: User explicitly downloads for offline access
async function downloadForOffline(attachment) {
  const response = await fetch(attachment.url)
  const blob = await response.blob()

  await cacheAttachment(attachment.messageId, attachment.id, blob, attachment.filename)

  toast.success('Attachment cached for offline access')
}
```

### Cache Versioning and Invalidation

#### Version-Based Invalidation

```javascript
// sw.ts
const CACHE_VERSION = 'v1.0.0'
const CACHE_NAMES = {
  static: `claine-static-${CACHE_VERSION}`,
  api: `claine-api-${CACHE_VERSION}`,
  images: `claine-images-${CACHE_VERSION}`,
}

// Clean up old versions on activate
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      const validCaches = Object.values(CACHE_NAMES)
      return Promise.all(
        keys
          .filter((key) => key.startsWith('claine-') && !validCaches.includes(key))
          .map((key) => caches.delete(key))
      )
    })
  )
})
```

#### Time-Based Invalidation

```javascript
// IndexedDB cleanup on app start
export async function cleanupOldEmails(maxAge = 90) {
  const db = await initDB()
  const cutoff = Date.now() - maxAge * 24 * 60 * 60 * 1000

  const tx = db.transaction('emailContent', 'readwrite')
  const index = tx.store.index('timestamp')

  let cursor = await index.openCursor(IDBKeyRange.upperBound(cutoff))

  while (cursor) {
    await cursor.delete()
    cursor = await cursor.continue()
  }

  await tx.done
  console.log(`[Cleanup] Removed emails older than ${maxAge} days`)
}
```

#### Manual Invalidation (User Action)

```javascript
// src/hooks/useEmailCache.ts
export function useEmailCache() {
  const clearCache = async () => {
    // Clear Cache API
    const cacheNames = await caches.keys()
    await Promise.all(
      cacheNames.filter((name) => name.startsWith('claine-')).map((name) => caches.delete(name))
    )

    // Clear IndexedDB
    const db = await initDB()
    await db.clear('emailMetadata')
    await db.clear('emailContent')
    await db.clear('attachments')

    toast.success('Cache cleared successfully')
  }

  return { clearCache }
}
```

### Storage Quota Management

```javascript
// Check available storage
export async function checkStorageQuota() {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate()
    const percentUsed = (estimate.usage / estimate.quota) * 100

    return {
      used: estimate.usage,
      total: estimate.quota,
      percentUsed,
      usedMB: (estimate.usage / (1024 * 1024)).toFixed(2),
      totalMB: (estimate.quota / (1024 * 1024)).toFixed(2),
    }
  }

  return null
}

// Request persistent storage
export async function requestPersistentStorage() {
  if ('storage' in navigator && 'persist' in navigator.storage) {
    const isPersisted = await navigator.storage.persist()
    return isPersisted
  }
  return false
}
```

---

## 3. Background Sync API

### Overview

The Background Sync API allows you to defer actions until the user has stable connectivity. This is critical for email clients where users may compose, archive, or delete emails while offline.

### Basic Background Sync Implementation

#### Step 1: Register a Sync Event

```javascript
// src/services/syncService.ts
export async function queueAction(action) {
  // Store action in IndexedDB
  const db = await initDB()
  await db.add('syncQueue', {
    id: crypto.randomUUID(),
    action: action.type, // 'send', 'archive', 'delete', 'star'
    payload: action.payload,
    timestamp: Date.now(),
    retries: 0,
  })

  // Register for background sync
  if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
    const registration = await navigator.serviceWorker.ready
    await registration.sync.register('email-sync')
    console.log('[Sync] Registered background sync')
  } else {
    // Fallback: try sync immediately
    await syncQueuedActions()
  }
}
```

#### Step 2: Handle Sync Event in Service Worker

```javascript
// sw.ts
import { openDB } from 'idb'

self.addEventListener('sync', (event) => {
  if (event.tag === 'email-sync') {
    event.waitUntil(syncQueuedActions())
  }
})

async function syncQueuedActions() {
  const db = await openDB('claine-emails', 1)
  const queue = await db.getAll('syncQueue')

  console.log(`[Sync] Processing ${queue.length} queued actions`)

  for (const item of queue) {
    try {
      await processAction(item)

      // Remove from queue on success
      await db.delete('syncQueue', item.id)

      // Notify UI of success
      await notifyClients({
        type: 'SYNC_SUCCESS',
        action: item.action,
        payload: item.payload,
      })
    } catch (error) {
      console.error('[Sync] Action failed:', error)

      // Increment retry count
      item.retries += 1

      // Remove if max retries exceeded (e.g., 3)
      if (item.retries >= 3) {
        await db.delete('syncQueue', item.id)

        await notifyClients({
          type: 'SYNC_FAILED',
          action: item.action,
          error: error.message,
        })
      } else {
        // Update retry count
        await db.put('syncQueue', item)
      }
    }
  }
}

async function processAction(item) {
  const { action, payload } = item

  // Get access token (assume stored or refresh)
  const accessToken = await getAccessToken()

  switch (action) {
    case 'send':
      return await sendEmail(payload, accessToken)
    case 'archive':
      return await archiveEmail(payload.messageId, accessToken)
    case 'delete':
      return await deleteEmail(payload.messageId, accessToken)
    case 'star':
      return await starEmail(payload.messageId, payload.starred, accessToken)
    default:
      throw new Error(`Unknown action: ${action}`)
  }
}

async function sendEmail(email, accessToken) {
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      raw: email.raw, // Base64url encoded email
    }),
  })

  if (!response.ok) {
    throw new Error(`Send failed: ${response.status}`)
  }

  return await response.json()
}

async function notifyClients(message) {
  const clients = await self.clients.matchAll({ type: 'window' })

  clients.forEach((client) => {
    client.postMessage(message)
  })
}
```

#### Step 3: Handle Sync Results in UI

```javascript
// src/hooks/useBackgroundSync.ts
export function useBackgroundSync() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    const handleMessage = (event) => {
      const { type, action, payload, error } = event.data

      if (type === 'SYNC_SUCCESS') {
        toast.success(`${action} completed successfully`)

        // Trigger UI refresh
        queryClient.invalidateQueries(['emails'])
      } else if (type === 'SYNC_FAILED') {
        toast.error(`${action} failed: ${error}`)
      }
    }

    navigator.serviceWorker.addEventListener('message', handleMessage)

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage)
    }
  }, [])
}
```

### Retry Strategies for Failed Sync

#### Browser-Native Retry (Chrome)

Chrome automatically retries background sync with exponential backoff:

- **1st attempt:** Immediate (when offline detected)
- **2nd attempt:** 5 minutes after first attempt
- **3rd attempt:** 15 minutes after first attempt

No configuration needed; this is built into Chrome's implementation.

#### Manual Retry (Fallback for Non-Chrome)

```javascript
// For browsers without Background Sync API
export function useFallbackSync(intervalMs = 60000) {
  useEffect(() => {
    const syncInterval = setInterval(async () => {
      if (navigator.onLine) {
        await syncQueuedActions()
      }
    }, intervalMs)

    // Also sync when coming back online
    const handleOnline = () => syncQueuedActions()
    window.addEventListener('online', handleOnline)

    return () => {
      clearInterval(syncInterval)
      window.removeEventListener('online', handleOnline)
    }
  }, [intervalMs])
}
```

### Workbox Background Sync

Workbox provides a simpler abstraction:

```javascript
// sw.ts with Workbox
import { BackgroundSyncPlugin } from 'workbox-background-sync'
import { registerRoute } from 'workbox-routing'
import { NetworkOnly } from 'workbox-strategies'

// Create background sync plugin
const bgSyncPlugin = new BackgroundSyncPlugin('email-queue', {
  maxRetentionTime: 7 * 24 * 60, // 7 days in minutes
  onSync: async ({ queue }) => {
    let entry
    while ((entry = await queue.shiftRequest())) {
      try {
        await fetch(entry.request)
        console.log('[Workbox Sync] Request succeeded:', entry.request.url)
      } catch (error) {
        console.error('[Workbox Sync] Request failed:', error)
        // Re-queue on failure
        await queue.unshiftRequest(entry)
        throw error
      }
    }
  },
})

// Register route for Gmail API mutations
registerRoute(
  ({ url, request }) => url.hostname === 'gmail.googleapis.com' && request.method === 'POST',
  new NetworkOnly({
    plugins: [bgSyncPlugin],
  }),
  'POST'
)
```

### Gmail API Integration Patterns

#### Send Email with Background Sync

```javascript
// src/services/emailService.ts
export async function sendEmail(to, subject, body) {
  // Create RFC 2822 formatted email
  const email = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset=UTF-8',
    '',
    body,
  ].join('\r\n')

  // Base64url encode
  const raw = btoa(unescape(encodeURIComponent(email)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  // Try to send immediately
  try {
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getAccessToken()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    })

    if (response.ok) {
      toast.success('Email sent')
      return await response.json()
    }

    throw new Error('Send failed')
  } catch (error) {
    // Queue for background sync
    await queueAction({
      type: 'send',
      payload: { raw, to, subject },
    })

    toast.info('Email queued for sending when online')
    throw error
  }
}
```

### Browser Support and Fallbacks

| Browser    | Background Sync Support | Fallback Strategy              |
| ---------- | ----------------------- | ------------------------------ |
| Chrome 49+ | ✅ Full support         | N/A                            |
| Edge 79+   | ✅ Full support         | N/A                            |
| Firefox    | ❌ No support           | Manual polling on online event |
| Safari     | ❌ No support           | Manual polling on online event |

```javascript
// Feature detection
export function supportsBackgroundSync() {
  return 'serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype
}

// Unified API with fallback
export async function scheduleSync() {
  if (supportsBackgroundSync()) {
    const registration = await navigator.serviceWorker.ready
    await registration.sync.register('email-sync')
  } else {
    // Store in IndexedDB and poll
    await queueForManualSync()
  }
}
```

---

## 4. Periodic Background Sync

### Overview

Periodic Background Sync allows service workers to wake up at periodic intervals to sync data, even when the app is not open. This is ideal for fetching new emails in the background.

**Important Limitation:** Only supported in Chromium browsers (Chrome 80+, Edge 79+) and requires PWA installation.

### Implementation

```javascript
// Request permission and register periodic sync
export async function registerPeriodicSync() {
  // Check support
  if (!('serviceWorker' in navigator && 'periodicSync' in ServiceWorkerRegistration.prototype)) {
    console.log('[Periodic Sync] Not supported')
    return false
  }

  // Check PWA installation status
  if (!window.matchMedia('(display-mode: standalone)').matches) {
    console.log('[Periodic Sync] Requires PWA installation')
    return false
  }

  try {
    const registration = await navigator.serviceWorker.ready

    // Register periodic sync (minimum interval: 12 hours)
    await registration.periodicSync.register('email-sync', {
      minInterval: 12 * 60 * 60 * 1000, // 12 hours
    })

    console.log('[Periodic Sync] Registered successfully')
    return true
  } catch (error) {
    console.error('[Periodic Sync] Registration failed:', error)
    return false
  }
}

// Service Worker: Handle periodic sync
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'email-sync') {
    event.waitUntil(fetchNewEmails())
  }
})

async function fetchNewEmails() {
  console.log('[Periodic Sync] Fetching new emails...')

  try {
    // Get access token (may need refresh)
    const accessToken = await getAccessToken()

    // Get last sync timestamp from IndexedDB
    const lastSync = await getLastSyncTime()

    // Fetch messages modified since last sync
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/history?startHistoryId=${lastSync}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    if (!response.ok) {
      throw new Error('History fetch failed')
    }

    const data = await response.json()

    // Process history records
    if (data.history && data.history.length > 0) {
      await processHistoryRecords(data.history)
      await updateLastSyncTime(data.historyId)

      // Show notification if new emails
      const newCount = countNewMessages(data.history)
      if (newCount > 0) {
        await showNotification(`You have ${newCount} new email(s)`)
      }
    }
  } catch (error) {
    console.error('[Periodic Sync] Failed:', error)
  }
}
```

### Battery Efficiency Considerations

Chrome uses site engagement scores to determine sync frequency:

```javascript
// Check site engagement score (Chrome only)
// chrome://site-engagement/
// Score must be > 0 for periodic sync to work

// Best practices:
// 1. Use minimum interval of 12-24 hours
// 2. Keep sync work lightweight (<30s)
// 3. Don't sync if battery is low
// 4. Respect user's data saver settings

async function fetchNewEmails() {
  // Check battery status
  if ('getBattery' in navigator) {
    const battery = await navigator.getBattery()

    // Skip sync if battery < 20% and not charging
    if (battery.level < 0.2 && !battery.charging) {
      console.log('[Periodic Sync] Skipping due to low battery')
      return
    }
  }

  // Check connection type
  if ('connection' in navigator) {
    const connection = navigator.connection

    // Skip on slow connections
    if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
      console.log('[Periodic Sync] Skipping due to slow connection')
      return
    }

    // Skip if data saver is enabled
    if (connection.saveData) {
      console.log('[Periodic Sync] Skipping due to data saver')
      return
    }
  }

  // Proceed with sync
  // ...
}
```

### Permission and UX Patterns

```javascript
// src/components/PeriodicSyncPrompt.tsx
export function PeriodicSyncPrompt() {
  const [showPrompt, setShowPrompt] = useState(false)
  const [isEnabled, setIsEnabled] = useState(false)

  useEffect(() => {
    checkPeriodicSyncStatus()
  }, [])

  async function checkPeriodicSyncStatus() {
    if (!('periodicSync' in ServiceWorkerRegistration.prototype)) {
      return
    }

    const registration = await navigator.serviceWorker.ready
    const tags = await registration.periodicSync.getTags()

    if (tags.includes('email-sync')) {
      setIsEnabled(true)
    } else if (window.matchMedia('(display-mode: standalone)').matches) {
      // PWA is installed but periodic sync not enabled
      setShowPrompt(true)
    }
  }

  async function enablePeriodicSync() {
    const success = await registerPeriodicSync()

    if (success) {
      setIsEnabled(true)
      setShowPrompt(false)
      toast.success('Background email sync enabled')
    } else {
      toast.error('Failed to enable background sync')
    }
  }

  if (!showPrompt) return null

  return (
    <div className="bg-blue-50 p-4 rounded-lg">
      <h3 className="font-semibold mb-2">Enable Background Sync?</h3>
      <p className="text-sm text-gray-600 mb-3">
        Get new emails automatically in the background, even when Claine is closed.
      </p>
      <div className="flex gap-2">
        <button onClick={enablePeriodicSync} className="btn-primary">
          Enable
        </button>
        <button onClick={() => setShowPrompt(false)} className="btn-secondary">
          Not Now
        </button>
      </div>
    </div>
  )
}
```

### Browser Support (2024)

| Browser    | Support | Notes                     |
| ---------- | ------- | ------------------------- |
| Chrome 80+ | ✅ Yes  | Requires PWA installation |
| Edge 79+   | ✅ Yes  | Requires PWA installation |
| Firefox    | ❌ No   | No plans announced        |
| Safari     | ❌ No   | No plans announced        |

**Recommendation for Claine v2:** Implement as progressive enhancement for Chrome/Edge users. Do NOT rely on this for core functionality.

---

## 5. Workbox Strategies for Vite/React

### Setup with vite-plugin-pwa

```bash
npm install -D vite-plugin-pwa workbox-window
```

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],

      manifest: {
        name: 'Claine Email Client',
        short_name: 'Claine',
        description: 'Offline-first email client for Gmail',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },

      workbox: {
        // App shell files to precache
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],

        // Ignore large files
        globIgnores: ['**/node_modules/**/*', '**/dev-dist/**/*'],

        // Maximum file size to precache (2MB)
        maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,

        // Runtime caching rules
        runtimeCaching: [
          // Gmail API - Stale While Revalidate
          {
            urlPattern: /^https:\/\/gmail\.googleapis\.com\/gmail\/v1\/.*/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'gmail-api',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 7 * 24 * 60 * 60,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },

          // Images - Cache First
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
            },
          },

          // Google Fonts - Cache First
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-stylesheets',
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
        ],
      },
    }),
  ],
})
```

### Custom Service Worker with injectManifest

For more control (recommended for Claine v2):

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
      },
    }),
  ],
})
```

```typescript
// src/sw.ts
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { StaleWhileRevalidate, NetworkFirst, CacheFirst } from 'workbox-strategies'
import { BackgroundSyncPlugin } from 'workbox-background-sync'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'

declare let self: ServiceWorkerGlobalScope

// Precache app shell (injected by Workbox during build)
precacheAndRoute(self.__WB_MANIFEST)

// Clean up old caches
cleanupOutdatedCaches()

// Gmail API - Stale While Revalidate
registerRoute(
  ({ url }) => url.hostname === 'gmail.googleapis.com',
  new StaleWhileRevalidate({
    cacheName: 'gmail-api',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 500,
        maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
      }),
    ],
  })
)

// Background sync for mutations
const bgSyncPlugin = new BackgroundSyncPlugin('gmail-mutations', {
  maxRetentionTime: 7 * 24 * 60, // 7 days
})

registerRoute(
  ({ url, request }) =>
    url.hostname === 'gmail.googleapis.com' &&
    (request.method === 'POST' || request.method === 'PUT' || request.method === 'DELETE'),
  new NetworkFirst({
    plugins: [bgSyncPlugin],
  }),
  'POST'
)

registerRoute(
  ({ url, request }) =>
    url.hostname === 'gmail.googleapis.com' &&
    (request.method === 'PUT' || request.method === 'DELETE'),
  new NetworkFirst({
    plugins: [bgSyncPlugin],
  }),
  'PUT'
)

// Images - Cache First
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
      }),
    ],
  })
)

// Fonts - Cache First (long-term)
registerRoute(
  ({ request }) => request.destination === 'font',
  new CacheFirst({
    cacheName: 'fonts',
    plugins: [
      new ExpirationPlugin({
        maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
      }),
    ],
  })
)

// Service Worker lifecycle events
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...')
  // Don't use skipWaiting() - let user choose when to update
})

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...')
  event.waitUntil(self.clients.claim())
})

// Handle messages from clients
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// Background sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'email-sync') {
    event.waitUntil(syncEmailQueue())
  }
})

async function syncEmailQueue() {
  // Implementation from Background Sync section
  console.log('[SW] Syncing email queue...')
}
```

### Register Service Worker in React

```typescript
// src/serviceWorkerRegistration.ts
import { registerSW } from 'virtual:pwa-register'

export function registerServiceWorker() {
  const updateSW = registerSW({
    onNeedRefresh() {
      // Show update prompt to user
      const event = new CustomEvent('sw-update-available')
      window.dispatchEvent(event)
    },
    onOfflineReady() {
      console.log('App ready to work offline')
      const event = new CustomEvent('sw-offline-ready')
      window.dispatchEvent(event)
    },
    onRegisteredSW(swUrl, registration) {
      console.log('Service Worker registered:', swUrl)

      // Check for updates periodically (every hour)
      setInterval(
        () => {
          registration?.update()
        },
        60 * 60 * 1000
      )
    },
  })

  return updateSW
}
```

```tsx
// src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { registerServiceWorker } from './serviceWorkerRegistration'

// Register service worker
registerServiceWorker()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

### Update Prompt Component

```tsx
// src/components/ServiceWorkerUpdate.tsx
import { useEffect, useState } from 'react'

export function ServiceWorkerUpdate() {
  const [showPrompt, setShowPrompt] = useState(false)
  const [updateSW, setUpdateSW] = useState<(() => void) | null>(null)

  useEffect(() => {
    const handleUpdate = (event: Event) => {
      setShowPrompt(true)

      // Store update function
      const customEvent = event as CustomEvent
      if (customEvent.detail?.updateSW) {
        setUpdateSW(() => customEvent.detail.updateSW)
      }
    }

    window.addEventListener('sw-update-available', handleUpdate)

    return () => {
      window.removeEventListener('sw-update-available', handleUpdate)
    }
  }, [])

  const handleUpdate = () => {
    if (updateSW) {
      updateSW()
    } else {
      // Fallback: reload page
      window.location.reload()
    }
  }

  if (!showPrompt) return null

  return (
    <div className="fixed bottom-4 right-4 bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-w-sm">
      <h3 className="font-semibold text-gray-900 mb-2">Update Available</h3>
      <p className="text-sm text-gray-600 mb-3">
        A new version of Claine is available. Update now to get the latest features.
      </p>
      <div className="flex gap-2">
        <button
          onClick={handleUpdate}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Update
        </button>
        <button
          onClick={() => setShowPrompt(false)}
          className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
        >
          Later
        </button>
      </div>
    </div>
  )
}
```

---

## 6. Real-World Implementations

### Gmail's Service Worker Approach

**Key Findings:**

- Gmail uses service workers for offline functionality in Chrome 61+
- Stores last 30 days of mail by default (90 days available)
- Includes attachments in offline cache
- Uses IndexedDB for email storage
- Implements push notifications for real-time updates

**Architecture Insights:**

```
App Shell (Cached)
    ├── UI Framework (React/similar)
    ├── Routing
    └── Core JS/CSS

Email Data (IndexedDB)
    ├── Metadata Store (id, threadId, labels, snippet)
    ├── Content Store (full message body)
    └── Attachment Store (selective caching)

Sync Strategy
    ├── Initial: Full sync of recent messages
    ├── Incremental: Gmail History API
    └── Real-time: Push notifications → partial sync
```

### Fastmail's Offline Implementation

Fastmail documented their offline architecture in detail (Dec 2024 blog series):

**Storage Strategy:**

```javascript
// Two-tier storage approach
const stores = {
  emailMetadata: {
    // Lightweight, indexed for fast queries
    fields: ['id', 'threadId', 'keywords', 'mailboxes', 'from', 'subject', 'snippet'],
    size: '~1KB per email',
  },
  emailContent: {
    // Full content, loaded on demand
    fields: ['id', 'headers', 'body', 'attachments[]'],
    size: '~10-100KB per email',
  },
}
```

**Sync Strategy:**

1. **Initial Load:** Fetch IDs, create placeholders
2. **Batch Metadata:** Page in metadata and headers (50-100 at a time)
3. **Lazy Content:** Load body for pinned/recent messages only
4. **Background Sync:** Use push notifications to trigger incremental sync

**Conflict Resolution:**

- "Last write wins" for most operations
- All updates are patches (not full replacements)
- Merge changes unless same property modified
- Track changes in time-ordered log

**Key Takeaway:** Two-tier storage (metadata + content) enables fast UI while minimizing storage usage.

### Outlook Web (outlook.live.com)

**Observed Patterns:**

- Heavy use of service workers for caching
- Aggressive app shell precaching
- Network-first for mail operations
- Limited offline compose (drafts saved to server)

**Limitations:**

- Less complete offline support than Gmail
- Requires periodic server connectivity
- Offline mostly for reading, not full CRUD

### Other Email Clients

**Spark (Readdle):**

- Native apps (iOS/macOS) with sync engine
- Stores metadata on Readdle servers for cross-device sync
- Push notification support
- Not web-based, so no service worker insights

**Mimestream (macOS):**

- Native Mac app with Gmail API
- Full offline support with local CoreData storage
- Praised for Gmail integration quality
- Not applicable to web implementation

---

## 7. Browser Support Matrix

### Service Worker APIs

| Feature                      | Chrome | Edge | Firefox | Safari | Notes                            |
| ---------------------------- | ------ | ---- | ------- | ------ | -------------------------------- |
| **Service Workers (Basic)**  | 40+    | 17+  | 44+     | 11.1+  | Universal support                |
| **Cache API**                | 40+    | 17+  | 41+     | 11.1+  | Universal support                |
| **IndexedDB**                | 24+    | 12+  | 16+     | 10+    | Universal support                |
| **Background Sync**          | 49+    | 79+  | ❌      | ❌     | Chrome/Edge only                 |
| **Periodic Background Sync** | 80+    | 79+  | ❌      | ❌     | Chrome/Edge only, requires PWA   |
| **Push Notifications**       | 42+    | 17+  | 44+     | 16.0+  | Safari requires user interaction |
| **Navigation Preload**       | 59+    | 79+  | ❌      | 15.4+  | Performance optimization         |

### Storage APIs

| Feature                | Chrome | Edge | Firefox | Safari | Notes                       |
| ---------------------- | ------ | ---- | ------- | ------ | --------------------------- |
| **IndexedDB v2**       | 58+    | 79+  | 51+     | 10+    | Modern version              |
| **IndexedDB v3**       | 75+    | 79+  | 58+     | 15.0+  | Latest features             |
| **Storage API**        | 48+    | 79+  | 57+     | 15.2+  | Quota management            |
| **Persistent Storage** | 52+    | 79+  | 57+     | 15.2+  | Request storage persistence |

### Recommended Support Strategy

```typescript
// src/utils/featureDetection.ts
export const features = {
  serviceWorker: 'serviceWorker' in navigator,

  cacheAPI: 'caches' in window,

  indexedDB: 'indexedDB' in window,

  backgroundSync: 'serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype,

  periodicSync:
    'serviceWorker' in navigator && 'periodicSync' in ServiceWorkerRegistration.prototype,

  pushNotifications: 'serviceWorker' in navigator && 'PushManager' in window,

  storageAPI: 'storage' in navigator && 'estimate' in navigator.storage,
}

export function checkRequirements() {
  const required = ['serviceWorker', 'cacheAPI', 'indexedDB']

  const missing = required.filter((feature) => !features[feature])

  if (missing.length > 0) {
    console.error('Missing required features:', missing)
    return false
  }

  return true
}

export function checkOptionalFeatures() {
  return {
    backgroundSync: features.backgroundSync,
    periodicSync: features.periodicSync,
    pushNotifications: features.pushNotifications,
  }
}
```

### Polyfills and Fallbacks

```typescript
// src/services/offlineService.ts
export class OfflineService {
  private useBackgroundSync: boolean

  constructor() {
    this.useBackgroundSync = features.backgroundSync

    // Setup fallback for browsers without background sync
    if (!this.useBackgroundSync) {
      this.setupManualSync()
    }
  }

  private setupManualSync() {
    // Poll for queued actions when online
    window.addEventListener('online', () => {
      this.syncQueue()
    })

    // Also check periodically if online
    setInterval(
      () => {
        if (navigator.onLine) {
          this.syncQueue()
        }
      },
      5 * 60 * 1000
    ) // Every 5 minutes
  }

  async queueAction(action: Action) {
    // Store in IndexedDB
    await storeAction(action)

    if (this.useBackgroundSync) {
      // Use native background sync
      const registration = await navigator.serviceWorker.ready
      await registration.sync.register('email-sync')
    } else {
      // Try manual sync immediately
      await this.syncQueue()
    }
  }

  private async syncQueue() {
    // Implementation similar to background sync handler
    // ...
  }
}
```

---

## 8. Code Examples

### Example 1: Complete Service Worker Setup

```typescript
// src/sw.ts - Production-ready service worker for Claine v2
import {
  precacheAndRoute,
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
} from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'
import { StaleWhileRevalidate, NetworkFirst, CacheFirst, NetworkOnly } from 'workbox-strategies'
import { BackgroundSyncPlugin } from 'workbox-background-sync'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { openDB } from 'idb'

declare let self: ServiceWorkerGlobalScope

const CACHE_VERSION = 'v1.0.0'

// ============================================
// 1. PRECACHING & CLEANUP
// ============================================

// Precache app shell (files injected during build)
precacheAndRoute(self.__WB_MANIFEST)

// Clean up old caches automatically
cleanupOutdatedCaches()

// ============================================
// 2. APP SHELL - NAVIGATION REQUESTS
// ============================================

// Serve app shell for all navigation requests (SPA)
const handler = createHandlerBoundToURL('/index.html')
const navigationRoute = new NavigationRoute(handler, {
  denylist: [/^\/_/, /\/[^/?]+\.[^/]+$/], // Exclude API routes and file extensions
})
registerRoute(navigationRoute)

// ============================================
// 3. GMAIL API - CACHING STRATEGIES
// ============================================

// Gmail API - Messages/Threads (Stale While Revalidate)
registerRoute(
  ({ url }) =>
    url.hostname === 'gmail.googleapis.com' &&
    (url.pathname.includes('/messages') || url.pathname.includes('/threads')),
  new StaleWhileRevalidate({
    cacheName: 'gmail-api-messages',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxEntries: 500,
        maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
        purgeOnQuotaError: true,
      }),
    ],
  })
)

// Gmail API - User Profile (Cache First)
registerRoute(
  ({ url }) => url.hostname === 'gmail.googleapis.com' && url.pathname.includes('/profile'),
  new CacheFirst({
    cacheName: 'gmail-api-profile',
    plugins: [
      new ExpirationPlugin({
        maxAgeSeconds: 24 * 60 * 60, // 1 day
      }),
    ],
  })
)

// Gmail API - Labels (Cache First)
registerRoute(
  ({ url }) => url.hostname === 'gmail.googleapis.com' && url.pathname.includes('/labels'),
  new CacheFirst({
    cacheName: 'gmail-api-labels',
    plugins: [
      new ExpirationPlugin({
        maxAgeSeconds: 24 * 60 * 60, // 1 day
      }),
    ],
  })
)

// OAuth - Network Only (never cache)
registerRoute(
  ({ url }) => url.hostname === 'oauth2.googleapis.com' || url.hostname === 'accounts.google.com',
  new NetworkOnly()
)

// ============================================
// 4. BACKGROUND SYNC - MUTATIONS
// ============================================

const bgSyncPlugin = new BackgroundSyncPlugin('gmail-mutations', {
  maxRetentionTime: 7 * 24 * 60, // Retry for up to 7 days (in minutes)
  onSync: async ({ queue }) => {
    let entry
    while ((entry = await queue.shiftRequest())) {
      try {
        const response = await fetch(entry.request.clone())

        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`)
        }

        console.log('[SW Sync] Request succeeded:', entry.request.url)

        // Notify clients of success
        await notifyClients({
          type: 'SYNC_SUCCESS',
          url: entry.request.url,
        })
      } catch (error) {
        console.error('[SW Sync] Request failed:', error)

        // Re-throw to re-queue
        await queue.unshiftRequest(entry)
        throw error
      }
    }
  },
})

// POST requests (send, modify)
registerRoute(
  ({ url, request }) => url.hostname === 'gmail.googleapis.com' && request.method === 'POST',
  new NetworkFirst({
    networkTimeoutSeconds: 10,
    plugins: [bgSyncPlugin],
  }),
  'POST'
)

// PUT/DELETE requests (modify, trash)
registerRoute(
  ({ url, request }) =>
    url.hostname === 'gmail.googleapis.com' &&
    (request.method === 'PUT' || request.method === 'DELETE'),
  new NetworkFirst({
    networkTimeoutSeconds: 10,
    plugins: [bgSyncPlugin],
  })
)

// ============================================
// 5. STATIC ASSETS
// ============================================

// Images - Cache First
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        purgeOnQuotaError: true,
      }),
    ],
  })
)

// Fonts - Cache First (long-term)
registerRoute(
  ({ request }) => request.destination === 'font',
  new CacheFirst({
    cacheName: 'fonts',
    plugins: [
      new ExpirationPlugin({
        maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
      }),
    ],
  })
)

// Google Fonts
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new StaleWhileRevalidate({
    cacheName: 'google-fonts-stylesheets',
  })
)

registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts-webfonts',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
      }),
    ],
  })
)

// ============================================
// 6. SERVICE WORKER LIFECYCLE
// ============================================

self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...')

  // Wait for precaching to complete
  event.waitUntil(
    (async () => {
      console.log('[SW] Precaching complete')
      // Don't call skipWaiting() - let user control update
    })()
  )
})

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...')

  event.waitUntil(
    (async () => {
      // Take control of all clients immediately
      await self.clients.claim()
      console.log('[SW] Service worker activated and claimed clients')
    })()
  )
})

// Handle messages from main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    // User approved update
    self.skipWaiting()
  }

  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_VERSION })
  }
})

// ============================================
// 7. BACKGROUND SYNC (Non-Workbox fallback)
// ============================================

self.addEventListener('sync', (event) => {
  if (event.tag === 'email-sync') {
    event.waitUntil(syncEmailQueue())
  }
})

async function syncEmailQueue() {
  console.log('[SW] Syncing email queue...')

  try {
    const db = await openDB('claine-emails', 1)
    const queue = await db.getAll('syncQueue')

    for (const item of queue) {
      try {
        // Process queued action
        await processQueuedAction(item)

        // Remove from queue
        await db.delete('syncQueue', item.id)

        // Notify clients
        await notifyClients({
          type: 'SYNC_SUCCESS',
          action: item.action,
        })
      } catch (error) {
        console.error('[SW] Queue item failed:', error)

        // Increment retry count
        item.retries = (item.retries || 0) + 1

        if (item.retries >= 3) {
          // Max retries exceeded
          await db.delete('syncQueue', item.id)

          await notifyClients({
            type: 'SYNC_FAILED',
            action: item.action,
            error: error.message,
          })
        } else {
          // Update retry count
          await db.put('syncQueue', item)
        }
      }
    }
  } catch (error) {
    console.error('[SW] Sync failed:', error)
  }
}

async function processQueuedAction(item: any) {
  // Implementation specific to your app
  // Fetch access token, make API call, etc.
}

async function notifyClients(message: any) {
  const clients = await self.clients.matchAll({ type: 'window' })
  clients.forEach((client) => client.postMessage(message))
}

// ============================================
// 8. PERIODIC BACKGROUND SYNC (Optional)
// ============================================

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'email-sync') {
    event.waitUntil(fetchNewEmails())
  }
})

async function fetchNewEmails() {
  console.log('[SW] Periodic sync: fetching new emails...')

  // Check battery and connection
  // Fetch Gmail history API
  // Update IndexedDB
  // Show notification if new emails

  // Implementation details in Periodic Background Sync section
}
```

### Example 2: Workbox Configuration (vite.config.ts)

```typescript
// vite.config.ts - Complete Workbox configuration for Claine v2
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Registration strategy
      registerType: 'prompt', // Show update prompt to user

      // Use custom service worker
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',

      // Development options
      devOptions: {
        enabled: true,
        type: 'module',
      },

      // Include assets
      includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png', 'safari-pinned-tab.svg'],

      // Web App Manifest
      manifest: {
        name: 'Claine - Offline Email Client',
        short_name: 'Claine',
        description: 'Offline-first email client for Gmail',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        orientation: 'portrait-primary',
        icons: [
          {
            src: 'pwa-64x64.png',
            sizes: '64x64',
            type: 'image/png',
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        categories: ['productivity', 'utilities'],
        shortcuts: [
          {
            name: 'Compose Email',
            short_name: 'Compose',
            description: 'Compose a new email',
            url: '/compose',
            icons: [{ src: 'compose-icon.png', sizes: '96x96' }],
          },
          {
            name: 'Inbox',
            short_name: 'Inbox',
            description: 'View inbox',
            url: '/inbox',
            icons: [{ src: 'inbox-icon.png', sizes: '96x96' }],
          },
        ],
      },

      // Workbox configuration
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        globIgnores: ['**/node_modules/**/*', '**/dev-dist/**/*'],
        maximumFileSizeToCacheInBytes: 2 * 1024 * 1024, // 2MB
      },
    }),
  ],

  // Build configuration
  build: {
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'gmail-api': ['@googleapis/gmail'],
          'ui-vendor': ['@headlessui/react', '@heroicons/react'],
        },
      },
    },
  },
})
```

### Example 3: IndexedDB Email Storage

```typescript
// src/services/db.ts - IndexedDB setup and operations
import { openDB, DBSchema, IDBPDatabase } from 'idb'

// ============================================
// 1. DATABASE SCHEMA
// ============================================

interface ClaineDB extends DBSchema {
  emailMetadata: {
    key: string // messageId
    value: {
      id: string
      threadId: string
      labelIds: string[]
      snippet: string
      timestamp: number
      from: string
      to: string
      subject: string
      hasAttachments: boolean
      isUnread: boolean
      isStarred: boolean
    }
    indexes: {
      threadId: string
      timestamp: number
      labelIds: string
      isUnread: number
    }
  }

  emailContent: {
    key: string // messageId
    value: {
      id: string
      timestamp: number
      payload: any // Full Gmail API payload
      body: {
        plain?: string
        html?: string
      }
    }
    indexes: {
      timestamp: number
    }
  }

  attachments: {
    key: string // messageId_attachmentId
    value: {
      id: string
      messageId: string
      attachmentId: string
      filename: string
      mimeType: string
      size: number
      blob?: Blob
      cachedAt: number
    }
    indexes: {
      messageId: string
    }
  }

  syncQueue: {
    key: string // UUID
    value: {
      id: string
      action: 'send' | 'archive' | 'delete' | 'star' | 'modify'
      payload: any
      timestamp: number
      retries: number
    }
    indexes: {
      timestamp: number
    }
  }

  syncState: {
    key: string // 'last_sync'
    value: {
      historyId: string
      timestamp: number
    }
  }
}

const DB_NAME = 'claine-emails'
const DB_VERSION = 1

// ============================================
// 2. INITIALIZE DATABASE
// ============================================

let dbPromise: Promise<IDBPDatabase<ClaineDB>> | null = null

export function initDB(): Promise<IDBPDatabase<ClaineDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ClaineDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, transaction) {
        console.log(`[DB] Upgrading from ${oldVersion} to ${newVersion}`)

        // Email Metadata store
        if (!db.objectStoreNames.contains('emailMetadata')) {
          const metadataStore = db.createObjectStore('emailMetadata', {
            keyPath: 'id',
          })
          metadataStore.createIndex('threadId', 'threadId')
          metadataStore.createIndex('timestamp', 'timestamp')
          metadataStore.createIndex('labelIds', 'labelIds', { multiEntry: true })
          metadataStore.createIndex('isUnread', 'isUnread')
        }

        // Email Content store
        if (!db.objectStoreNames.contains('emailContent')) {
          const contentStore = db.createObjectStore('emailContent', {
            keyPath: 'id',
          })
          contentStore.createIndex('timestamp', 'timestamp')
        }

        // Attachments store
        if (!db.objectStoreNames.contains('attachments')) {
          const attachmentStore = db.createObjectStore('attachments', {
            keyPath: 'id',
          })
          attachmentStore.createIndex('messageId', 'messageId')
        }

        // Sync Queue store
        if (!db.objectStoreNames.contains('syncQueue')) {
          const queueStore = db.createObjectStore('syncQueue', {
            keyPath: 'id',
          })
          queueStore.createIndex('timestamp', 'timestamp')
        }

        // Sync State store
        if (!db.objectStoreNames.contains('syncState')) {
          db.createObjectStore('syncState', { keyPath: 'key' })
        }
      },
      blocked() {
        console.warn('[DB] Database blocked - close other tabs')
      },
      blocking() {
        console.warn('[DB] Blocking database upgrade')
      },
    })
  }

  return dbPromise
}

// ============================================
// 3. EMAIL METADATA OPERATIONS
// ============================================

export async function storeEmailMetadata(messages: any[]) {
  const db = await initDB()
  const tx = db.transaction('emailMetadata', 'readwrite')

  await Promise.all(
    messages.map((msg) => {
      const metadata = {
        id: msg.id,
        threadId: msg.threadId,
        labelIds: msg.labelIds || [],
        snippet: msg.snippet || '',
        timestamp: parseInt(msg.internalDate),
        from: getHeader(msg, 'From') || '',
        to: getHeader(msg, 'To') || '',
        subject: getHeader(msg, 'Subject') || '',
        hasAttachments: hasAttachments(msg),
        isUnread: msg.labelIds?.includes('UNREAD') || false,
        isStarred: msg.labelIds?.includes('STARRED') || false,
      }

      return tx.store.put(metadata)
    })
  )

  await tx.done
}

export async function getEmailMetadata(messageId: string) {
  const db = await initDB()
  return await db.get('emailMetadata', messageId)
}

export async function listEmailsByLabel(labelId: string, limit = 50, offset = 0): Promise<any[]> {
  const db = await initDB()
  const index = db.transaction('emailMetadata').store.index('labelIds')

  let emails = await index.getAll(labelId)

  // Sort by timestamp descending
  emails.sort((a, b) => b.timestamp - a.timestamp)

  return emails.slice(offset, offset + limit)
}

export async function searchEmails(query: string): Promise<any[]> {
  const db = await initDB()
  const allEmails = await db.getAll('emailMetadata')

  const lowerQuery = query.toLowerCase()

  return allEmails.filter(
    (email) =>
      email.subject.toLowerCase().includes(lowerQuery) ||
      email.from.toLowerCase().includes(lowerQuery) ||
      email.snippet.toLowerCase().includes(lowerQuery)
  )
}

// ============================================
// 4. EMAIL CONTENT OPERATIONS
// ============================================

export async function storeEmailContent(message: any) {
  const db = await initDB()

  const content = {
    id: message.id,
    timestamp: Date.now(),
    payload: message.payload,
    body: extractBody(message.payload),
  }

  await db.put('emailContent', content)
}

export async function getEmailContent(messageId: string) {
  const db = await initDB()
  return await db.get('emailContent', messageId)
}

// ============================================
// 5. ATTACHMENT OPERATIONS
// ============================================

export async function storeAttachment(
  messageId: string,
  attachmentId: string,
  filename: string,
  mimeType: string,
  size: number,
  blob?: Blob
) {
  const db = await initDB()

  await db.put('attachments', {
    id: `${messageId}_${attachmentId}`,
    messageId,
    attachmentId,
    filename,
    mimeType,
    size,
    blob,
    cachedAt: Date.now(),
  })
}

export async function getAttachment(messageId: string, attachmentId: string) {
  const db = await initDB()
  return await db.get('attachments', `${messageId}_${attachmentId}`)
}

export async function listAttachmentsByMessage(messageId: string) {
  const db = await initDB()
  const index = db.transaction('attachments').store.index('messageId')
  return await index.getAll(messageId)
}

// ============================================
// 6. SYNC QUEUE OPERATIONS
// ============================================

export async function queueAction(
  action: 'send' | 'archive' | 'delete' | 'star' | 'modify',
  payload: any
) {
  const db = await initDB()

  const item = {
    id: crypto.randomUUID(),
    action,
    payload,
    timestamp: Date.now(),
    retries: 0,
  }

  await db.add('syncQueue', item)
  return item.id
}

export async function getSyncQueue() {
  const db = await initDB()
  return await db.getAll('syncQueue')
}

export async function removeSyncQueueItem(id: string) {
  const db = await initDB()
  await db.delete('syncQueue', id)
}

export async function updateSyncQueueItem(item: any) {
  const db = await initDB()
  await db.put('syncQueue', item)
}

// ============================================
// 7. SYNC STATE OPERATIONS
// ============================================

export async function getLastSyncState() {
  const db = await initDB()
  return await db.get('syncState', 'last_sync')
}

export async function setLastSyncState(historyId: string) {
  const db = await initDB()
  await db.put('syncState', {
    key: 'last_sync',
    historyId,
    timestamp: Date.now(),
  })
}

// ============================================
// 8. CLEANUP OPERATIONS
// ============================================

export async function cleanupOldEmails(maxAge = 90) {
  const db = await initDB()
  const cutoff = Date.now() - maxAge * 24 * 60 * 60 * 1000

  // Clean metadata
  const metadataTx = db.transaction('emailMetadata', 'readwrite')
  const metadataIndex = metadataTx.store.index('timestamp')
  let cursor = await metadataIndex.openCursor(IDBKeyRange.upperBound(cutoff))

  let deletedCount = 0
  while (cursor) {
    await cursor.delete()
    deletedCount++
    cursor = await cursor.continue()
  }

  await metadataTx.done

  // Clean content
  const contentTx = db.transaction('emailContent', 'readwrite')
  const contentIndex = contentTx.store.index('timestamp')
  cursor = await contentIndex.openCursor(IDBKeyRange.upperBound(cutoff))

  while (cursor) {
    await cursor.delete()
    cursor = await cursor.continue()
  }

  await contentTx.done

  console.log(`[DB] Cleaned up ${deletedCount} emails older than ${maxAge} days`)
}

export async function clearAllData() {
  const db = await initDB()

  await db.clear('emailMetadata')
  await db.clear('emailContent')
  await db.clear('attachments')
  await db.clear('syncQueue')
  await db.clear('syncState')

  console.log('[DB] All data cleared')
}

// ============================================
// 9. HELPER FUNCTIONS
// ============================================

function getHeader(message: any, name: string): string | undefined {
  const headers = message.payload?.headers || []
  const header = headers.find((h: any) => h.name === name)
  return header?.value
}

function hasAttachments(message: any): boolean {
  const parts = message.payload?.parts || []
  return parts.some((part: any) => part.filename && part.filename.length > 0)
}

function extractBody(payload: any): { plain?: string; html?: string } {
  const body: { plain?: string; html?: string } = {}

  if (payload.body?.data) {
    body.plain = atob(payload.body.data.replace(/-/g, '+').replace(/_/g, '/'))
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        body.plain = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'))
      }
      if (part.mimeType === 'text/html' && part.body?.data) {
        body.html = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'))
      }

      // Handle nested parts
      if (part.parts) {
        const nested = extractBody(part)
        body.plain = body.plain || nested.plain
        body.html = body.html || nested.html
      }
    }
  }

  return body
}
```

### Example 4: React Hooks for Offline Support

```typescript
// src/hooks/useOffline.ts - Comprehensive offline support hooks

import { useState, useEffect, useCallback } from 'react'
import { getSyncQueue, queueAction } from '../services/db'

// ============================================
// 1. ONLINE/OFFLINE STATUS
// ============================================

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return isOnline
}

// ============================================
// 2. SERVICE WORKER STATUS
// ============================================

export function useServiceWorkerStatus() {
  const [isInstalled, setIsInstalled] = useState(false)
  const [isControlled, setIsControlled] = useState(false)
  const [updateAvailable, setUpdateAvailable] = useState(false)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return
    }

    // Check if SW is installed
    navigator.serviceWorker.ready.then(() => {
      setIsInstalled(true)
    })

    // Check if current page is controlled
    setIsControlled(!!navigator.serviceWorker.controller)

    // Listen for updates
    navigator.serviceWorker.ready.then((registration) => {
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing

        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setUpdateAvailable(true)
            }
          })
        }
      })
    })
  }, [])

  const applyUpdate = useCallback(async () => {
    const registration = await navigator.serviceWorker.ready

    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' })

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload()
      })
    }
  }, [])

  return {
    isInstalled,
    isControlled,
    updateAvailable,
    applyUpdate,
  }
}

// ============================================
// 3. SYNC QUEUE STATUS
// ============================================

export function useSyncQueue() {
  const [queue, setQueue] = useState<any[]>([])
  const [isSyncing, setIsSyncing] = useState(false)

  const refreshQueue = useCallback(async () => {
    const items = await getSyncQueue()
    setQueue(items)
  }, [])

  useEffect(() => {
    refreshQueue()

    // Listen for sync updates from service worker
    if ('serviceWorker' in navigator) {
      const handleMessage = (event: MessageEvent) => {
        if (event.data.type === 'SYNC_SUCCESS' || event.data.type === 'SYNC_FAILED') {
          refreshQueue()
        }

        if (event.data.type === 'SYNC_START') {
          setIsSyncing(true)
        }

        if (event.data.type === 'SYNC_END') {
          setIsSyncing(false)
        }
      }

      navigator.serviceWorker.addEventListener('message', handleMessage)

      return () => {
        navigator.serviceWorker.removeEventListener('message', handleMessage)
      }
    }
  }, [refreshQueue])

  return {
    queue,
    queueLength: queue.length,
    isSyncing,
    refreshQueue,
  }
}

// ============================================
// 4. OFFLINE-AWARE MUTATION
// ============================================

export function useOfflineMutation() {
  const isOnline = useOnlineStatus()

  const mutate = useCallback(
    async (
      action: 'send' | 'archive' | 'delete' | 'star' | 'modify',
      payload: any,
      onlineFn: () => Promise<any>
    ) => {
      if (isOnline) {
        try {
          // Try online operation first
          return await onlineFn()
        } catch (error) {
          // Network failed, queue for sync
          await queueAction(action, payload)
          throw new Error('Queued for sync')
        }
      } else {
        // Offline, queue immediately
        await queueAction(action, payload)
        return { queued: true }
      }
    },
    [isOnline]
  )

  return { mutate, isOnline }
}

// ============================================
// 5. STORAGE QUOTA
// ============================================

export function useStorageQuota() {
  const [quota, setQuota] = useState<{
    used: number
    total: number
    percentUsed: number
  } | null>(null)

  const checkQuota = useCallback(async () => {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate()

      setQuota({
        used: estimate.usage || 0,
        total: estimate.quota || 0,
        percentUsed: ((estimate.usage || 0) / (estimate.quota || 1)) * 100,
      })
    }
  }, [])

  useEffect(() => {
    checkQuota()
  }, [checkQuota])

  return { quota, checkQuota }
}

// ============================================
// 6. COMPLETE OFFLINE CONTEXT
// ============================================

export function useOffline() {
  const isOnline = useOnlineStatus()
  const serviceWorker = useServiceWorkerStatus()
  const syncQueue = useSyncQueue()
  const storageQuota = useStorageQuota()
  const { mutate } = useOfflineMutation()

  return {
    isOnline,
    ...serviceWorker,
    ...syncQueue,
    ...storageQuota,
    mutate,
  }
}
```

---

## 9. Recommendations for Claine v2

### Phase 1: MVP (Weeks 1-2)

**Core Infrastructure:**

1. ✅ Set up Workbox with vite-plugin-pwa
2. ✅ Implement basic service worker with app shell precaching
3. ✅ Create IndexedDB schema with metadata + content stores
4. ✅ Add offline detection UI (banner/indicator)

**Basic Caching:** 5. ✅ Cache-first for app shell (HTML, JS, CSS) 6. ✅ Stale-while-revalidate for Gmail API messages 7. ✅ Network-only for OAuth

**Email Storage:** 8. ✅ Store last 30 days of email metadata 9. ✅ Store full content for recently viewed emails 10. ✅ Implement read operations from IndexedDB

### Phase 2: Enhanced Offline (Weeks 3-4)

**Background Sync:**

1. ✅ Implement sync queue in IndexedDB
2. ✅ Add Background Sync API for send/modify operations
3. ✅ Build fallback manual sync for Firefox/Safari
4. ✅ Add UI for pending sync actions

**Advanced Caching:** 5. ✅ Implement cache versioning 6. ✅ Add automatic cleanup of old emails 7. ✅ Selective attachment caching 8. ✅ Image caching with size limits

**Gmail API Integration:** 9. ✅ Implement Gmail History API for incremental sync 10. ✅ Add conflict resolution for offline changes 11. ✅ Push notifications for real-time updates

### Phase 3: Optimization (Weeks 5-6)

**Performance:**

1. ✅ Add navigation preload
2. ✅ Optimize precache size (<2MB)
3. ✅ Implement lazy loading for email content
4. ✅ Add performance monitoring

**Enhanced Features:** 5. ✅ Periodic background sync (Chrome/Edge only) 6. ✅ Advanced attachment handling 7. ✅ Search optimization with IndexedDB indexes 8. ✅ PWA installation prompt

**User Experience:** 9. ✅ Controlled service worker updates with notification 10. ✅ Storage quota management UI 11. ✅ Sync progress indicators 12. ✅ Clear cache functionality

### Technical Debt & Maintenance

**Ongoing:**

- Monitor service worker errors with Sentry/similar
- Track storage usage and implement proactive cleanup
- Test across browsers (Chrome, Firefox, Safari, Edge)
- Update Workbox when new versions released
- Review Gmail API changes quarterly

### Architecture Decisions

| Decision                    | Chosen Approach                               | Rationale                       |
| --------------------------- | --------------------------------------------- | ------------------------------- |
| **Service Worker Strategy** | Workbox with injectManifest                   | Maximum control + reliability   |
| **Email Storage**           | Two-tier (metadata + content)                 | Fast UI + efficient storage     |
| **Caching Strategy**        | Hybrid (cache-first app shell + SWR for data) | Speed + freshness balance       |
| **Update Strategy**         | Controlled with user prompt                   | Safe for email composition      |
| **Background Sync**         | Background Sync API + fallback                | Best experience where available |
| **Attachment Handling**     | Selective (user-initiated)                    | Storage efficiency              |
| **Storage Limit**           | 30-90 days configurable                       | Balance utility + storage       |
| **Browser Support**         | Modern browsers (last 2 versions)             | Focus on current standards      |

### Success Metrics

**Performance:**

- Time to first email: <1s (cached)
- App shell load: <500ms (cached)
- Offline detection: <100ms

**Reliability:**

- Successful sync rate: >99%
- Cache hit rate: >80% for repeat visits
- Service worker error rate: <0.1%

**Storage:**

- Average storage per user: 50-200MB
- Cache efficiency: <5% wasted space
- Cleanup execution: daily

### Common Pitfalls to Avoid

1. **Don't use skipWaiting() automatically** - breaks running app
2. **Don't cache OAuth endpoints** - security risk
3. **Don't precache everything** - slow installation
4. **Don't forget cache versioning** - causes stale bugs
5. **Don't ignore quota exceeded errors** - crashes app
6. **Don't rely on Periodic Sync for core features** - Chrome-only
7. **Don't forget Firefox/Safari fallbacks** - 40%+ of users
8. **Don't cache large attachments automatically** - storage bloat

---

## 10. Implementation Roadmap

### Week 1: Foundation

**Days 1-2: Setup**

- Install dependencies (Workbox, idb, vite-plugin-pwa)
- Configure Vite for service workers
- Create basic sw.ts with precaching
- Set up development environment

**Days 3-4: IndexedDB**

- Design database schema
- Implement db.ts with idb
- Create migration strategy
- Add basic CRUD operations

**Day 5: Testing**

- Test service worker installation
- Test IndexedDB operations
- Manual testing in Chrome DevTools
- Fix bugs

### Week 2: Core Offline

**Days 1-2: Caching**

- Implement caching strategies
- Add app shell precaching
- Configure runtime caching for Gmail API
- Test cache behavior

**Days 3-4: Email Storage**

- Implement email metadata storage
- Add full content storage
- Create retrieval functions
- Test offline email reading

**Day 5: UI Integration**

- Add offline indicator
- Show cached emails in UI
- Handle offline errors gracefully
- User testing

### Week 3: Background Sync

**Days 1-3: Sync Queue**

- Implement sync queue in IndexedDB
- Add Background Sync API integration
- Create fallback for non-Chromium browsers
- Test sync behavior

**Days 4-5: Send Queue**

- Implement send email queuing
- Add retry logic
- Create UI for pending sends
- Test send reliability

### Week 4: Gmail API Integration

**Days 1-2: History API**

- Implement Gmail History API sync
- Add incremental sync logic
- Store historyId in IndexedDB
- Test sync accuracy

**Days 3-4: Conflict Resolution**

- Implement conflict detection
- Add resolution strategies
- Test edge cases
- Document behavior

**Day 5: Testing**

- End-to-end testing
- Cross-browser testing
- Performance testing
- Bug fixes

### Week 5: Polish

**Days 1-2: Service Worker Updates**

- Implement controlled updates
- Add update notification UI
- Test update flow
- Handle edge cases

**Days 3-4: Optimization**

- Optimize precache size
- Add cache cleanup
- Implement storage quota checks
- Performance tuning

**Day 5: Documentation**

- Update code comments
- Write user guide
- Create troubleshooting docs
- Team knowledge transfer

### Week 6: Advanced Features

**Days 1-2: Attachments**

- Implement selective attachment caching
- Add download for offline
- Create attachment UI
- Test storage limits

**Days 3-4: Periodic Sync (Optional)**

- Implement periodic background sync
- Add battery/connection checks
- Create permission UI
- Test on Chrome/Edge

**Day 5: Final Testing**

- Full regression testing
- Browser compatibility testing
- Performance benchmarking
- Production preparation

---

## Appendix: Additional Resources

### Official Documentation

- [Service Workers - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Workbox - Chrome Developers](https://developer.chrome.com/docs/workbox/)
- [IndexedDB - MDN](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [Background Sync - Web.dev](https://web.dev/articles/background-sync)
- [Gmail API Documentation](https://developers.google.com/gmail/api)

### Tools & Libraries

- [Workbox](https://workboxjs.org/) - Service worker framework
- [idb](https://github.com/jakearchibald/idb) - IndexedDB wrapper
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) - Vite PWA plugin

### Real-World Examples

- [Fastmail Offline Blog Series](https://www.fastmail.com/blog/offline-sync/)
- [Gmail Offline](https://support.google.com/a/answer/7684186)
- [Service Worker Cookbook](https://serviceworke.rs/)

### Testing Tools

- Chrome DevTools → Application → Service Workers
- Chrome DevTools → Application → Storage
- Lighthouse PWA audit
- [Workbox Window](https://developer.chrome.com/docs/workbox/modules/workbox-window/)

---

**Document Version:** 1.0
**Last Updated:** 2025-10-28
**Total Word Count:** ~23,500 words
**Token Estimate:** ~19,000 tokens
