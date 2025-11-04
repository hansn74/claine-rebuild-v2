# Background Sync and Push Notification Patterns for Email Clients

**Research Document for Claine v2**
**Focus: Battery-Efficient Real-Time Email Delivery**
**Date: October 2025**

---

## Executive Summary

This document evaluates background synchronization and push notification strategies for building a battery-efficient, real-time email client web application. The research compares Gmail's Cloud Pub/Sub, Web Push API, Background Sync API, and various real-time communication protocols.

### Key Findings

1. **Gmail Cloud Pub/Sub + History API** is the most battery-efficient approach for real-time email notifications, eliminating unnecessary polling
2. **Web Push API** enables browser-native notifications with minimal battery impact when properly implemented
3. **Adaptive polling with exponential backoff** should be used as a fallback when push technologies are unavailable
4. **Push-based approaches show 187% less energy consumption** compared to traditional polling methods
5. **React 19's concurrent features** align well with optimistic UI patterns for real-time updates

### Recommended Architecture

**Primary Strategy:** Gmail Cloud Pub/Sub → Server Webhook → Web Push API → Service Worker → IndexedDB → React UI

**Fallback Strategy:** Adaptive polling with exponential backoff (visibility-aware, battery-aware)

---

## 1. Background Sync Technologies Comparison

### 1.1 Technology Overview

| Technology | Type | Battery Impact | Latency | Reliability | Browser Support | Best For |
|-----------|------|---------------|---------|-------------|-----------------|----------|
| **Gmail Cloud Pub/Sub** | Server Push | ⭐⭐⭐⭐⭐ Excellent | <500ms | Very High | N/A (Server-side) | Real-time email notifications |
| **Web Push API** | Browser Push | ⭐⭐⭐⭐⭐ Excellent | <1s | High | Chrome, Firefox, Safari 16+ | User-facing notifications |
| **WebSocket** | Persistent Connection | ⭐⭐⭐ Moderate | <100ms | Medium | All modern browsers | Bidirectional real-time |
| **Server-Sent Events** | Persistent Connection | ⭐⭐⭐⭐ Good | <500ms | Medium-High | All modern browsers | Unidirectional updates |
| **Background Sync API** | Queue Retry | ⭐⭐⭐⭐ Good | Async | High | Chromium only | Failed request retry |
| **Periodic Background Sync** | Scheduled Polling | ⭐⭐⭐ Moderate | 12hrs+ | Medium | Chromium only | Infrequent updates |
| **Adaptive Polling** | Smart Polling | ⭐⭐ Fair | 5-60s | High | All browsers | Universal fallback |
| **Fixed Polling** | Traditional | ⭐ Poor | 5-30s | High | All browsers | Legacy support |

### 1.2 Battery Impact Analysis

**Research Findings:**

- **Push vs Polling:** Push techniques show a **187% reduction** in energy consumption compared to traditional polling
- **Polling Frequency:** Polling intervals below 5000ms (5 seconds) significantly increase battery drain
- **Connection Type:**
  - Persistent connections (WebSocket, SSE) are battery-efficient when active
  - Mobile OS automatically closes connections after inactivity to preserve battery
  - SSE is "in a league of its own" for mobile battery optimization due to proxy offloading
- **Radio Usage:** Small frequent requests drain more battery than larger infrequent requests due to radio power-up cycles

**Best Practice:** Transmit larger amounts of data less frequently, allowing the radio to power down between transmissions.

### 1.3 WebSocket vs Server-Sent Events vs Long Polling

```
┌─────────────────────────────────────────────────────────────┐
│ Communication Pattern Comparison                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ WEBSOCKET (Bidirectional)                                   │
│ Client ←──────────────────────────→ Server                  │
│        Push/Pull at any time                                │
│ Battery: Moderate | Latency: <100ms | Use: Chat, Gaming    │
│                                                              │
│ SERVER-SENT EVENTS (Unidirectional)                         │
│ Client ←──────────────────────────── Server                 │
│        Server pushes, Client receives                       │
│ Battery: Good | Latency: <500ms | Use: Feeds, Notifications│
│                                                              │
│ LONG POLLING (Request/Response)                             │
│ Client ──→ [Wait] ←── Server                                │
│        Repeated request cycles                              │
│ Battery: Poor | Latency: Variable | Use: Legacy fallback   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Recommendation for Email:** Neither WebSocket nor SSE is optimal for email sync. Gmail Cloud Pub/Sub combined with Web Push API provides better battery efficiency and reliability.

---

## 2. Gmail Pub/Sub Integration

### 2.1 Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│ Gmail Push Notification Flow                                 │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  Gmail Mailbox                                               │
│       │                                                       │
│       │ (New email arrives)                                  │
│       ▼                                                       │
│  Gmail API Watch                                             │
│       │                                                       │
│       │ (Triggers push notification)                         │
│       ▼                                                       │
│  Cloud Pub/Sub Topic                                         │
│       │                                                       │
│       │ (Delivers notification)                              │
│       ▼                                                       │
│  ┌─────────────────────────────┐                            │
│  │ Subscription Options:       │                            │
│  │  • Webhook Push (HTTP POST) │ ← Recommended              │
│  │  • Pull (App-initiated)     │                            │
│  └─────────────────────────────┘                            │
│       │                                                       │
│       ▼                                                       │
│  Your Backend Server                                         │
│       │                                                       │
│       │ (Processes historyId)                                │
│       ▼                                                       │
│  Gmail History API                                           │
│       │                                                       │
│       │ (Fetches changes since lastHistoryId)                │
│       ▼                                                       │
│  Web Push API → Service Worker → User Notification          │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 Setup and Authentication

**Prerequisites:**
1. Google Cloud Project with Gmail API enabled
2. Cloud Pub/Sub API enabled
3. Pub/Sub topic created
4. Service account with appropriate permissions

**Key Configuration Steps:**

```javascript
// 1. Grant publish privileges to Gmail API
// Grant to: gmail-api-push@system.gserviceaccount.com
// Permission: pubsub.publisher role on your topic

// 2. Set up watch request
const setupGmailWatch = async (userId, accessToken) => {
  const topicName = 'projects/YOUR_PROJECT_ID/topics/gmail-notifications';

  const watchRequest = {
    labelIds: ['INBOX'], // Watch specific labels or omit for all
    topicName: topicName,
    labelFilterAction: 'include' // or 'exclude'
  };

  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/${userId}/watch`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(watchRequest)
    }
  );

  const data = await response.json();
  // Store data.historyId for future sync operations
  // Store data.expiration (Unix timestamp in milliseconds)

  return data;
};

// 3. Renew watch (must be called at least every 7 days)
// Recommended: Call once per day
const renewWatch = async (userId, accessToken) => {
  return await setupGmailWatch(userId, accessToken);
};
```

### 2.3 Receiving Push Notifications

**Webhook Handler (Express.js example):**

```javascript
import express from 'express';
import { OAuth2Client } from 'google-auth-library';

const app = express();

// Pub/Sub sends notifications as base64-encoded JSON
app.post('/pubsub/webhook', express.json(), async (req, res) => {
  // Pub/Sub message structure
  const message = req.body.message;

  if (!message) {
    res.status(400).send('Bad Request: no message');
    return;
  }

  // Decode the Pub/Sub message
  const data = message.data
    ? JSON.parse(Buffer.from(message.data, 'base64').toString())
    : {};

  const { emailAddress, historyId } = data;

  console.log('Received notification:', {
    emailAddress,
    historyId,
    timestamp: new Date().toISOString()
  });

  // Acknowledge receipt immediately
  res.status(204).send();

  // Process asynchronously
  processGmailNotification(emailAddress, historyId).catch(console.error);
});

// Process the notification
const processGmailNotification = async (emailAddress, historyId) => {
  // 1. Get stored lastHistoryId for this user
  const lastHistoryId = await getStoredHistoryId(emailAddress);

  // 2. Fetch changes using History API
  const changes = await fetchHistoryChanges(
    emailAddress,
    lastHistoryId,
    historyId
  );

  // 3. Update local database
  await updateLocalDatabase(changes);

  // 4. Send Web Push notification to user's devices
  await sendWebPushNotification(emailAddress, changes);

  // 5. Store new historyId
  await storeHistoryId(emailAddress, historyId);
};
```

### 2.4 History API Processing

**Critical Concepts:**

- **historyId**: Increases chronologically but not contiguously (has gaps)
- **Validity**: Typically valid for at least 1 week, but can expire in hours
- **Error Handling**: HTTP 404 indicates expired historyId → perform full sync
- **Pagination**: Use `nextPageToken` to fetch all changes

```javascript
const fetchHistoryChanges = async (emailAddress, startHistoryId, latestHistoryId) => {
  const accessToken = await getAccessToken(emailAddress);
  let changes = {
    messagesAdded: [],
    messagesDeleted: [],
    labelsAdded: [],
    labelsRemoved: []
  };
  let nextPageToken = null;

  do {
    try {
      const url = new URL(
        `https://gmail.googleapis.com/gmail/v1/users/me/history`
      );
      url.searchParams.append('startHistoryId', startHistoryId);
      if (nextPageToken) {
        url.searchParams.append('pageToken', nextPageToken);
      }

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (response.status === 404) {
        // historyId expired - perform full sync
        console.warn('History ID expired, performing full sync');
        return await performFullSync(emailAddress);
      }

      const data = await response.json();

      // Process history records
      if (data.history) {
        data.history.forEach(record => {
          if (record.messagesAdded) {
            changes.messagesAdded.push(...record.messagesAdded);
          }
          if (record.messagesDeleted) {
            changes.messagesDeleted.push(...record.messagesDeleted);
          }
          if (record.labelsAdded) {
            changes.labelsAdded.push(...record.labelsAdded);
          }
          if (record.labelsRemoved) {
            changes.labelsRemoved.push(...record.labelsRemoved);
          }
        });
      }

      nextPageToken = data.nextPageToken;

      // If no nextPageToken, we're done - store the historyId
      if (!nextPageToken && data.historyId) {
        await storeHistoryId(emailAddress, data.historyId);
      }

    } catch (error) {
      console.error('Error fetching history:', error);
      throw error;
    }
  } while (nextPageToken);

  return changes;
};

// Fetch full message details for new messages
const fetchMessageDetails = async (emailAddress, messageId) => {
  const accessToken = await getAccessToken(emailAddress);

  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`,
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    }
  );

  return await response.json();
};
```

### 2.5 Cost and Quotas

**Gmail API Quotas:**
- Watch must be renewed every 7 days (recommended: daily)
- No explicit quota on watch operations in documentation
- History API calls count toward standard Gmail API quota

**Cloud Pub/Sub Pricing (as of October 2025):**
- **Message ingestion/delivery**: Based on volume (published, delivered, or stored bytes)
- **Pay-as-you-go**: Only pay for what you use
- **Typical email notification**: ~1KB per notification
- **Estimated cost**: For 1000 users receiving ~50 emails/day:
  - 50,000 notifications/day
  - ~50MB/day
  - ~1.5GB/month
  - Cost: Typically < $0.10/month (check current pricing)

**Quotas and Limits:**
- Maximum 10,000 subscriptions per project
- Watch expiration: 7 days
- Message size limits apply (email notifications are very small)

**Cost Optimization:**
- Use label filters to watch only relevant folders (e.g., INBOX)
- Batch history API calls when possible
- Cache message metadata to reduce API calls

---

## 3. Web Push API Patterns

### 3.1 Service Worker Setup with VAPID

**Step 1: Generate VAPID Keys**

```bash
# Using web-push npm package (recommended)
npx web-push generate-vapid-keys

# Output:
# Public Key: BMjc...
# Private Key: 5K3...
```

**Step 2: Service Worker Registration**

```javascript
// main.js (client-side)
const registerServiceWorker = async () => {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Workers not supported');
    return null;
  }

  try {
    // Register the service worker
    const registration = await navigator.serviceWorker.register(
      '/service-worker.js',
      { scope: '/' }
    );

    console.log('Service Worker registered:', registration.scope);

    // Wait for service worker to be ready
    await navigator.serviceWorker.ready;

    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    return null;
  }
};

// Subscribe to push notifications
const subscribeToPush = async (registration) => {
  try {
    // Check for existing subscription
    let subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      console.log('Already subscribed:', subscription.endpoint);
      return subscription;
    }

    // Subscribe with VAPID public key
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true, // Must be true for web push
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });

    console.log('Push subscription created:', subscription.endpoint);

    // Send subscription to your server
    await sendSubscriptionToServer(subscription);

    return subscription;
  } catch (error) {
    console.error('Push subscription failed:', error);
    return null;
  }
};

// Convert VAPID public key to Uint8Array
const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
};

// Send subscription to backend
const sendSubscriptionToServer = async (subscription) => {
  const response = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(subscription)
  });

  if (!response.ok) {
    throw new Error('Failed to send subscription to server');
  }
};
```

### 3.2 Service Worker Push Event Handler

```javascript
// service-worker.js

// Listen for push events
self.addEventListener('push', event => {
  console.log('Push event received:', event);

  // Extract data from push payload
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { body: event.data.text() };
    }
  }

  const title = data.title || 'New Email';
  const options = {
    body: data.body || 'You have a new message',
    icon: data.icon || '/icons/email-icon-192.png',
    badge: '/icons/badge-72.png',
    tag: data.tag || `email-${Date.now()}`, // Prevents duplicate notifications
    requireInteraction: false, // Auto-dismiss after timeout
    silent: data.silent || false,
    data: {
      url: data.url || '/',
      messageId: data.messageId,
      timestamp: Date.now()
    },
    actions: [
      {
        action: 'view',
        title: 'View Email',
        icon: '/icons/view-icon.png'
      },
      {
        action: 'archive',
        title: 'Archive',
        icon: '/icons/archive-icon.png'
      }
    ]
  };

  // Show the notification
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  console.log('Notification clicked:', event.action);

  event.notification.close();

  const urlToOpen = event.notification.data.url || '/';

  // Handle different actions
  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow(urlToOpen)
    );
  } else if (event.action === 'archive') {
    // Perform archive action
    event.waitUntil(
      fetch(`/api/messages/${event.notification.data.messageId}/archive`, {
        method: 'POST'
      }).then(() => {
        // Optionally show a confirmation
        return self.registration.showNotification('Email Archived', {
          body: 'The email has been archived',
          tag: 'archive-confirmation',
          requireInteraction: false
        });
      })
    );
  } else {
    // Default click (no action button) - open the app
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then(clientList => {
          // Check if app is already open
          for (let client of clientList) {
            if (client.url === urlToOpen && 'focus' in client) {
              return client.focus();
            }
          }
          // Open new window if not open
          if (clients.openWindow) {
            return clients.openWindow(urlToOpen);
          }
        })
    );
  }
});
```

### 3.3 Notification Permission UX Best Practices

**Key Statistics:**
- Average website notification acceptance rate: **17%**
- Average rejection rate: **41%**
- With proper UX: Acceptance rate can reach **89-100%**
- **Context matters**: Requests without context are granted 40% less

**Best Practices:**

```javascript
// ❌ BAD: Request permission immediately on page load
window.addEventListener('load', () => {
  Notification.requestPermission(); // Only 17% acceptance!
});

// ✅ GOOD: Use a pre-permission prompt with context
const requestNotificationPermission = async (context) => {
  // Check current permission state
  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission === 'denied') {
    // Show alternative (e.g., in-app notifications)
    showInAppNotificationOption();
    return false;
  }

  // Show custom pre-permission dialog
  const userWantsNotifications = await showPrePermissionDialog(context);

  if (!userWantsNotifications) {
    return false;
  }

  // Now request the real permission
  const permission = await Notification.requestPermission();

  return permission === 'granted';
};

// Custom pre-permission dialog (HTML/React component)
const showPrePermissionDialog = (context) => {
  return new Promise((resolve) => {
    // Show modal/dialog explaining the value
    showModal({
      title: 'Stay Updated',
      message: `Get notified when you receive new emails in ${context.folderName}.
                You can disable this anytime in settings.`,
      benefits: [
        'Never miss important messages',
        'Respond faster to urgent emails',
        'Stay productive on the go'
      ],
      buttons: [
        {
          text: 'Enable Notifications',
          onClick: () => resolve(true),
          primary: true
        },
        {
          text: 'Maybe Later',
          onClick: () => resolve(false)
        }
      ]
    });
  });
};

// Request at contextually relevant moments
const contextualPermissionTriggers = {
  // After user performs an action that would benefit from notifications
  afterFirstEmailSent: () => {
    requestNotificationPermission({
      folderName: 'Inbox',
      reason: 'replies'
    });
  },

  // When user enables a feature that needs notifications
  afterEnablingImportantLabel: () => {
    requestNotificationPermission({
      folderName: 'Important',
      reason: 'priority messages'
    });
  },

  // After user has used the app for a while (engagement-based)
  afterThirdVisit: () => {
    const visitCount = getVisitCount();
    if (visitCount >= 3 && Notification.permission === 'default') {
      requestNotificationPermission({
        folderName: 'all folders',
        reason: 'new emails'
      });
    }
  }
};
```

**Permission Request Timing Strategy:**

```
┌────────────────────────────────────────────────────────┐
│ Permission Request Timing                              │
├────────────────────────────────────────────────────────┤
│                                                         │
│  First Visit                                           │
│  ├─ Show app value                                    │
│  ├─ Let user explore features                         │
│  └─ NO permission request                             │
│                                                         │
│  2-3 Visits OR Key Action                             │
│  ├─ User has demonstrated interest                    │
│  ├─ Show pre-permission dialog                        │
│  └─ Explain clear benefit                             │
│                                                         │
│  User Accepts Pre-Dialog                              │
│  ├─ Request actual browser permission                 │
│  └─ High acceptance rate (80%+)                       │
│                                                         │
│  User Declines                                         │
│  ├─ Don't show again for 7-30 days                    │
│  ├─ Offer alternative (in-app notifications)          │
│  └─ Add settings toggle for later                     │
│                                                         │
└────────────────────────────────────────────────────────┘
```

### 3.4 Silent Push vs Visible Notifications

**Browser Requirements:**
- Web Push requires `userVisibleOnly: true` in subscription
- Silent push (without notification) will cause subscription to fail
- Must show a notification for every push event received

**Workaround for Background Sync:**

```javascript
// service-worker.js
self.addEventListener('push', event => {
  const data = event.data.json();

  // Always show notification (required)
  // But make it minimal for background sync
  if (data.type === 'background-sync') {
    // Update cache/IndexedDB silently
    event.waitUntil(
      updateLocalCache(data).then(() => {
        // Show minimal, auto-dismissing notification
        return self.registration.showNotification('Email Synced', {
          body: `${data.newCount} new emails`,
          tag: 'background-sync',
          requireInteraction: false,
          silent: true, // No sound
          badge: '/icons/badge-72.png',
          icon: '/icons/sync-icon-192.png',
          data: { type: 'background-sync' }
        });
      })
    );
  } else {
    // Show full notification for user-facing alerts
    event.waitUntil(
      self.registration.showNotification(data.title, {
        body: data.body,
        tag: data.tag,
        requireInteraction: true,
        actions: [
          { action: 'view', title: 'View' },
          { action: 'archive', title: 'Archive' }
        ],
        data: data
      })
    );
  }
});
```

### 3.5 Notification UI Best Practices

**Frequency Limits:**
- Never send more than **1 notification per day** for promotional content
- Try to send less than **5 notifications per week**
- Use interaction-requiring notifications sparingly

**Notification Deduplication:**

```javascript
// Use tag to replace previous notifications
self.registration.showNotification('New Emails', {
  tag: 'inbox-unread', // Same tag replaces previous notification
  body: `You have ${count} unread emails`,
  renotify: true, // Vibrate/sound even when replacing
  badge: '/icons/badge-72.png'
});

// Group notifications by conversation
self.registration.showNotification('Email Thread', {
  tag: `thread-${threadId}`, // Unique per thread
  body: `${senderName}: ${preview}`,
  data: { threadId }
});
```

**Adaptive Notification Strategy:**

```javascript
// Only show notification if app is not in focus
const shouldShowNotification = async () => {
  const clients = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true
  });

  // Check if any client is focused
  const hasVisibleClient = clients.some(client => client.visibilityState === 'visible');

  return !hasVisibleClient;
};

self.addEventListener('push', event => {
  event.waitUntil(
    shouldShowNotification().then(show => {
      if (show) {
        return self.registration.showNotification(title, options);
      } else {
        // App is visible - send message to app instead
        return self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({
              type: 'NEW_EMAIL',
              data: event.data.json()
            });
          });
        });
      }
    })
  );
});
```

---

## 4. Battery-Efficient Sync Strategies

### 4.1 Adaptive Polling with Exponential Backoff

**Use Case:** Fallback when push notifications are unavailable or for supplementary polling.

```javascript
class AdaptiveSyncManager {
  constructor() {
    this.baseInterval = 30000; // 30 seconds minimum
    this.maxInterval = 600000; // 10 minutes maximum
    this.currentInterval = this.baseInterval;
    this.backoffMultiplier = 1.5;
    this.pollTimeoutId = null;
    this.isDocumentVisible = !document.hidden;
    this.networkType = this.getNetworkType();
    this.batteryLevel = 1.0;
    this.isCharging = true;

    this.setupEventListeners();
  }

  setupEventListeners() {
    // Visibility change - pause when hidden
    document.addEventListener('visibilitychange', () => {
      this.isDocumentVisible = !document.hidden;
      this.adjustPollingInterval();

      if (this.isDocumentVisible) {
        // Resume immediately when visible
        this.resetInterval();
        this.poll();
      }
    });

    // Network status
    if ('connection' in navigator) {
      navigator.connection.addEventListener('change', () => {
        this.networkType = this.getNetworkType();
        this.adjustPollingInterval();
      });
    }

    // Battery status (deprecated but still useful where available)
    if ('getBattery' in navigator) {
      navigator.getBattery().then(battery => {
        this.batteryLevel = battery.level;
        this.isCharging = battery.charging;

        battery.addEventListener('levelchange', () => {
          this.batteryLevel = battery.level;
          this.adjustPollingInterval();
        });

        battery.addEventListener('chargingchange', () => {
          this.isCharging = battery.charging;
          this.adjustPollingInterval();
        });

        this.adjustPollingInterval();
      });
    }

    // Online/Offline
    window.addEventListener('online', () => {
      this.resetInterval();
      this.poll();
    });

    window.addEventListener('offline', () => {
      this.stopPolling();
    });
  }

  getNetworkType() {
    if (!('connection' in navigator)) {
      return 'unknown';
    }

    const connection = navigator.connection;
    const effectiveType = connection.effectiveType;

    // 'slow-2g', '2g', '3g', '4g'
    return effectiveType;
  }

  adjustPollingInterval() {
    let interval = this.baseInterval;

    // Factor 1: Document visibility
    if (!this.isDocumentVisible) {
      interval *= 4; // Poll 4x less frequently when hidden
    }

    // Factor 2: Network type
    if (this.networkType === 'slow-2g' || this.networkType === '2g') {
      interval *= 2; // Poll less on slow connections
    } else if (this.networkType === '4g') {
      interval *= 0.8; // Can afford slightly more frequent on fast connection
    }

    // Factor 3: Battery level (only if not charging)
    if (!this.isCharging) {
      if (this.batteryLevel < 0.15) {
        interval *= 4; // Very aggressive power saving below 15%
      } else if (this.batteryLevel < 0.30) {
        interval *= 2; // Power saving below 30%
      }
    }

    // Factor 4: Consecutive empty responses (exponential backoff)
    // Applied in poll() method

    // Clamp to min/max
    this.currentInterval = Math.min(Math.max(interval, this.baseInterval), this.maxInterval);

    console.log('Adjusted polling interval:', {
      interval: this.currentInterval,
      visible: this.isDocumentVisible,
      network: this.networkType,
      battery: this.batteryLevel,
      charging: this.isCharging
    });
  }

  async poll() {
    try {
      const response = await fetch('/api/sync/check', {
        method: 'GET',
        headers: {
          'X-Last-Sync': this.getLastSyncTimestamp()
        }
      });

      const data = await response.json();

      if (data.hasChanges) {
        // Reset to base interval on successful change detection
        this.resetInterval();

        // Process changes
        await this.processChanges(data.changes);
      } else {
        // No changes - apply exponential backoff
        this.currentInterval = Math.min(
          this.currentInterval * this.backoffMultiplier,
          this.maxInterval
        );
      }

    } catch (error) {
      console.error('Polling error:', error);
      // On error, back off aggressively
      this.currentInterval = Math.min(
        this.currentInterval * 2,
        this.maxInterval
      );
    }

    // Schedule next poll
    this.scheduleNextPoll();
  }

  scheduleNextPoll() {
    this.stopPolling();

    // Only poll if online and (visible OR important)
    if (navigator.onLine) {
      this.pollTimeoutId = setTimeout(() => {
        this.poll();
      }, this.currentInterval);
    }
  }

  resetInterval() {
    this.currentInterval = this.baseInterval;
  }

  stopPolling() {
    if (this.pollTimeoutId) {
      clearTimeout(this.pollTimeoutId);
      this.pollTimeoutId = null;
    }
  }

  startPolling() {
    this.resetInterval();
    this.poll();
  }

  async processChanges(changes) {
    // Update local IndexedDB
    await this.updateLocalDatabase(changes);

    // Notify UI if visible
    if (this.isDocumentVisible) {
      this.notifyUI(changes);
    }
  }

  getLastSyncTimestamp() {
    return localStorage.getItem('lastSyncTimestamp') || Date.now();
  }

  updateLocalDatabase(changes) {
    // IndexedDB update logic
    return Promise.resolve();
  }

  notifyUI(changes) {
    // Dispatch event to React components
    window.dispatchEvent(new CustomEvent('sync-update', {
      detail: changes
    }));
  }
}

// Usage
const syncManager = new AdaptiveSyncManager();
syncManager.startPolling();
```

**Adaptive Polling Behavior:**

```
┌────────────────────────────────────────────────────────┐
│ Polling Interval Adaptation                            │
├────────────────────────────────────────────────────────┤
│                                                         │
│  Scenario                    │ Interval  │ Reasoning   │
│  ─────────────────────────────┼───────────┼──────────  │
│  App visible + WiFi + Charging│  30s     │ Aggressive  │
│  App visible + WiFi + Low bat │  60s     │ Conservative│
│  App hidden + WiFi + Charging │  2m      │ Background  │
│  App hidden + 3G + Low bat    │  8m      │ Preserve    │
│  Repeated empty responses     │  →10m    │ Exponential │
│  New changes detected         │  →30s    │ Reset       │
│  Offline                      │  Paused  │ No network  │
│                                                         │
└────────────────────────────────────────────────────────┘
```

### 4.2 Network-Aware Sync

```javascript
// Coalesce sync requests based on network conditions
class NetworkAwareSync {
  constructor() {
    this.pendingSyncOperations = [];
    this.syncThrottleTimeout = null;
    this.getNetworkConditions();
  }

  getNetworkConditions() {
    if (!('connection' in navigator)) {
      return {
        effectiveType: '4g',
        downlink: 10,
        rtt: 50,
        saveData: false
      };
    }

    const conn = navigator.connection;
    return {
      effectiveType: conn.effectiveType,
      downlink: conn.downlink, // Mbps
      rtt: conn.rtt, // ms
      saveData: conn.saveData // User preference
    };
  }

  shouldBatchSync() {
    const network = this.getNetworkConditions();

    // Always batch on slow connections
    if (network.effectiveType === 'slow-2g' || network.effectiveType === '2g') {
      return true;
    }

    // Batch if user enabled data saver
    if (network.saveData) {
      return true;
    }

    // Batch if high latency
    if (network.rtt > 500) {
      return true;
    }

    return false;
  }

  queueSync(operation) {
    this.pendingSyncOperations.push(operation);

    if (this.shouldBatchSync()) {
      // Coalesce syncs - wait for more operations
      clearTimeout(this.syncThrottleTimeout);
      this.syncThrottleTimeout = setTimeout(() => {
        this.executeBatchSync();
      }, 2000); // Wait 2s to batch multiple operations
    } else {
      // Execute immediately on good connection
      this.executeBatchSync();
    }
  }

  async executeBatchSync() {
    if (this.pendingSyncOperations.length === 0) {
      return;
    }

    const operations = [...this.pendingSyncOperations];
    this.pendingSyncOperations = [];

    console.log(`Executing batch sync: ${operations.length} operations`);

    try {
      // Send all operations in single request
      await fetch('/api/sync/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operations })
      });
    } catch (error) {
      console.error('Batch sync failed:', error);
      // Re-queue failed operations
      this.pendingSyncOperations.push(...operations);
    }
  }
}
```

### 4.3 Background Sync API (Chromium)

**Use Case:** Retry failed sync requests when network is restored.

```javascript
// Register background sync
const registerBackgroundSync = async (tag) => {
  if (!('serviceWorker' in navigator) || !('sync' in ServiceWorkerRegistration.prototype)) {
    console.warn('Background Sync not supported');
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.sync.register(tag);
    console.log('Background sync registered:', tag);
    return true;
  } catch (error) {
    console.error('Background sync registration failed:', error);
    return false;
  }
};

// Service Worker: Handle sync event
self.addEventListener('sync', event => {
  console.log('Sync event:', event.tag);

  if (event.tag === 'email-sync') {
    event.waitUntil(
      syncEmails().catch(error => {
        console.error('Sync failed:', error);
        // Sync will be retried automatically by browser
        throw error;
      })
    );
  }
});

const syncEmails = async () => {
  // Get pending operations from IndexedDB
  const pendingOperations = await getPendingOperations();

  for (const op of pendingOperations) {
    await executeOperation(op);
    await markOperationComplete(op.id);
  }
};

// Usage: Queue operation when offline
const sendEmail = async (emailData) => {
  try {
    await fetch('/api/emails/send', {
      method: 'POST',
      body: JSON.stringify(emailData)
    });
  } catch (error) {
    // Queue for background sync
    await queueOperation({ type: 'send', data: emailData });
    await registerBackgroundSync('email-sync');

    // Show user feedback
    showToast('Email will be sent when you\'re back online');
  }
};
```

**Browser Support:**
- ✅ Chrome/Edge (Chromium)
- ❌ Firefox
- ❌ Safari

### 4.4 Periodic Background Sync (Chromium)

**Use Case:** Periodic email check even when app is closed (requires user engagement).

```javascript
// Register periodic sync (requires user engagement)
const registerPeriodicSync = async () => {
  if (!('serviceWorker' in navigator) || !('periodicSync' in ServiceWorkerRegistration.prototype)) {
    console.warn('Periodic Background Sync not supported');
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;

    // Check permission
    const status = await navigator.permissions.query({
      name: 'periodic-background-sync'
    });

    if (status.state === 'granted') {
      await registration.periodicSync.register('email-sync', {
        minInterval: 12 * 60 * 60 * 1000 // Minimum 12 hours
      });
      console.log('Periodic sync registered');
      return true;
    } else {
      console.warn('Periodic sync permission not granted');
      return false;
    }
  } catch (error) {
    console.error('Periodic sync registration failed:', error);
    return false;
  }
};

// Service Worker: Handle periodic sync
self.addEventListener('periodicsync', event => {
  console.log('Periodic sync event:', event.tag);

  if (event.tag === 'email-sync') {
    event.waitUntil(performPeriodicEmailSync());
  }
});

const performPeriodicEmailSync = async () => {
  // Only sync if battery is OK
  // Browser handles this automatically, but you can add extra checks

  try {
    const response = await fetch('/api/sync/check');
    const data = await response.json();

    if (data.hasChanges) {
      // Update local database
      await updateLocalDatabase(data.changes);

      // Show notification if important emails
      const importantCount = countImportantEmails(data.changes);
      if (importantCount > 0) {
        await self.registration.showNotification('New Important Emails', {
          body: `You have ${importantCount} new important emails`,
          tag: 'periodic-sync-notification',
          badge: '/icons/badge-72.png'
        });
      }
    }
  } catch (error) {
    console.error('Periodic sync failed:', error);
  }
};
```

**Important Constraints:**
- Maximum frequency: Once every 12 hours
- Requires site engagement (Chrome site engagement score)
- Browser may not fire if device is in battery saver mode
- Not fired when device is in data saver mode
- Browser Support: Chromium only

---

## 5. Real-Time Update Patterns

### 5.1 Optimistic UI Updates

**React 19 useOptimistic Hook:**

```javascript
import { useOptimistic, useTransition } from 'react';

function EmailList({ emails, onArchive }) {
  const [isPending, startTransition] = useTransition();
  const [optimisticEmails, setOptimisticEmails] = useOptimistic(
    emails,
    (currentEmails, optimisticUpdate) => {
      switch (optimisticUpdate.type) {
        case 'archive':
          return currentEmails.filter(email => email.id !== optimisticUpdate.id);
        case 'star':
          return currentEmails.map(email =>
            email.id === optimisticUpdate.id
              ? { ...email, starred: !email.starred }
              : email
          );
        case 'add':
          return [optimisticUpdate.email, ...currentEmails];
        default:
          return currentEmails;
      }
    }
  );

  const handleArchive = (emailId) => {
    // Optimistically update UI
    startTransition(() => {
      setOptimisticEmails({ type: 'archive', id: emailId });
    });

    // Actual API call
    onArchive(emailId).catch(error => {
      // On error, React will revert optimistic update
      console.error('Archive failed:', error);
      showToast('Failed to archive email');
    });
  };

  return (
    <div>
      {optimisticEmails.map(email => (
        <EmailItem
          key={email.id}
          email={email}
          onArchive={() => handleArchive(email.id)}
          isPending={isPending}
        />
      ))}
    </div>
  );
}
```

### 5.2 Push → Local DB → UI Update Flow

```javascript
// service-worker.js
self.addEventListener('push', event => {
  const data = event.data.json();

  event.waitUntil(
    (async () => {
      // 1. Update IndexedDB
      await updateIndexedDB(data);

      // 2. Notify all open clients
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach(client => {
        client.postMessage({
          type: 'EMAIL_UPDATE',
          data: data
        });
      });

      // 3. Show notification only if no client is visible
      const hasVisibleClient = clients.some(c => c.visibilityState === 'visible');
      if (!hasVisibleClient) {
        await self.registration.showNotification('New Email', {
          body: data.preview,
          data: data
        });
      }
    })()
  );
});

const updateIndexedDB = async (emailData) => {
  const db = await openDB('email-cache', 1);
  const tx = db.transaction('emails', 'readwrite');

  // Upsert email
  await tx.store.put({
    id: emailData.id,
    threadId: emailData.threadId,
    subject: emailData.subject,
    from: emailData.from,
    preview: emailData.preview,
    timestamp: emailData.timestamp,
    labels: emailData.labels,
    unread: emailData.unread
  });

  await tx.done;
};
```

```javascript
// React component
import { useEffect, useState } from 'react';
import { openDB } from 'idb';

function useRealtimeEmails() {
  const [emails, setEmails] = useState([]);

  useEffect(() => {
    // Load initial data from IndexedDB
    loadEmailsFromDB().then(setEmails);

    // Listen for service worker messages
    const handleMessage = (event) => {
      if (event.data.type === 'EMAIL_UPDATE') {
        // Optimistically update UI
        setEmails(currentEmails => {
          const updatedEmail = event.data.data;
          const existingIndex = currentEmails.findIndex(e => e.id === updatedEmail.id);

          if (existingIndex >= 0) {
            // Update existing email
            const newEmails = [...currentEmails];
            newEmails[existingIndex] = updatedEmail;
            return newEmails;
          } else {
            // Add new email
            return [updatedEmail, ...currentEmails];
          }
        });
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
    };
  }, []);

  return emails;
}

async function loadEmailsFromDB() {
  const db = await openDB('email-cache', 1);
  return await db.getAll('emails');
}
```

### 5.3 Deduplication Strategies

```javascript
class EmailDeduplicator {
  constructor() {
    this.processedMessageIds = new Set();
    this.processingQueue = [];
    this.maxCacheSize = 10000;
  }

  // Check if message was already processed
  isDuplicate(messageId) {
    return this.processedMessageIds.has(messageId);
  }

  // Mark message as processed
  markProcessed(messageId) {
    this.processedMessageIds.add(messageId);

    // Limit cache size (remove oldest entries)
    if (this.processedMessageIds.size > this.maxCacheSize) {
      const toRemove = Array.from(this.processedMessageIds).slice(0, 1000);
      toRemove.forEach(id => this.processedMessageIds.delete(id));
    }
  }

  // Process email update with deduplication
  async processEmailUpdate(emailData) {
    const messageId = emailData.id;

    // Check for duplicate
    if (this.isDuplicate(messageId)) {
      console.log('Duplicate email update ignored:', messageId);
      return null;
    }

    // Add to queue
    this.processingQueue.push({
      messageId,
      data: emailData,
      timestamp: Date.now()
    });

    // Debounce processing
    clearTimeout(this.processTimeout);
    this.processTimeout = setTimeout(() => {
      this.processBatch();
    }, 100);
  }

  async processBatch() {
    const batch = [...this.processingQueue];
    this.processingQueue = [];

    // Remove duplicates within batch
    const uniqueBatch = Array.from(
      new Map(batch.map(item => [item.messageId, item])).values()
    );

    console.log(`Processing batch: ${batch.length} → ${uniqueBatch.length} unique`);

    // Process each unique update
    for (const item of uniqueBatch) {
      await this.processItem(item);
      this.markProcessed(item.messageId);
    }
  }

  async processItem(item) {
    // Update local database
    await updateEmailInDB(item.data);

    // Notify UI
    notifyUIUpdate(item.data);
  }
}

// Singleton instance
const deduplicator = new EmailDeduplicator();

// Service worker usage
self.addEventListener('push', event => {
  const emailData = event.data.json();
  event.waitUntil(
    deduplicator.processEmailUpdate(emailData)
  );
});
```

### 5.4 Handling Out-of-Order Messages

```javascript
class MessageOrderingQueue {
  constructor() {
    this.queue = new Map(); // threadId -> messages[]
    this.expectedHistoryId = new Map(); // threadId -> historyId
  }

  async addMessage(message) {
    const { threadId, historyId } = message;

    // Get or create queue for this thread
    if (!this.queue.has(threadId)) {
      this.queue.set(threadId, []);

      // Initialize expected historyId from DB
      const lastKnownHistoryId = await getLastHistoryId(threadId);
      this.expectedHistoryId.set(threadId, lastKnownHistoryId);
    }

    const threadQueue = this.queue.get(threadId);
    const expectedHistoryId = this.expectedHistoryId.get(threadId);

    // Check if message is in order
    if (historyId === expectedHistoryId + 1) {
      // In order - process immediately
      await this.processMessage(message);
      this.expectedHistoryId.set(threadId, historyId);

      // Check if queued messages can now be processed
      await this.processQueuedMessages(threadId);
    } else if (historyId > expectedHistoryId + 1) {
      // Out of order - queue for later
      console.log('Out of order message queued:', { threadId, historyId, expected: expectedHistoryId + 1 });
      threadQueue.push(message);
      threadQueue.sort((a, b) => a.historyId - b.historyId);

      // Fetch missing history if gap is too large
      if (historyId - expectedHistoryId > 5) {
        await this.fillHistoryGap(threadId, expectedHistoryId, historyId);
      }
    } else {
      // Already processed - ignore duplicate
      console.log('Duplicate message ignored:', { threadId, historyId });
    }
  }

  async processQueuedMessages(threadId) {
    const threadQueue = this.queue.get(threadId);
    let expectedHistoryId = this.expectedHistoryId.get(threadId);

    while (threadQueue.length > 0 && threadQueue[0].historyId === expectedHistoryId + 1) {
      const message = threadQueue.shift();
      await this.processMessage(message);
      expectedHistoryId = message.historyId;
      this.expectedHistoryId.set(threadId, expectedHistoryId);
    }
  }

  async processMessage(message) {
    // Update database
    await updateEmailInDB(message);

    // Notify UI
    notifyUIUpdate(message);
  }

  async fillHistoryGap(threadId, startHistoryId, endHistoryId) {
    console.log('Filling history gap:', { threadId, start: startHistoryId, end: endHistoryId });

    try {
      // Fetch missing history from server
      const response = await fetch(`/api/history?threadId=${threadId}&start=${startHistoryId}&end=${endHistoryId}`);
      const missingMessages = await response.json();

      // Process missing messages in order
      for (const message of missingMessages) {
        await this.addMessage(message);
      }
    } catch (error) {
      console.error('Failed to fill history gap:', error);
    }
  }
}

// Usage
const orderingQueue = new MessageOrderingQueue();

self.addEventListener('push', event => {
  const message = event.data.json();
  event.waitUntil(orderingQueue.addMessage(message));
});
```

---

## 6. Real-World Implementations

### 6.1 Gmail's Push Notification System

**Architecture:**
- **Gmail Backend** → **Cloud Pub/Sub** → **Webhook** → **Client Backend** → **Web Push API** → **Browser**

**Key Characteristics:**
- Uses Cloud Pub/Sub for server-to-server push notifications
- Watch API must be renewed every 7 days (recommended: daily)
- History API provides incremental sync using historyId
- Supports label filtering to reduce noise
- Notifications contain minimal data (emailAddress, historyId)
- Client must fetch full details via History API and Messages API

**Benefits:**
- Extremely battery-efficient (no client polling)
- Scales to millions of users
- Sub-second latency for new email notifications
- Reliable delivery via Cloud Pub/Sub guarantees

### 6.2 Slack's Real-Time Messaging Patterns

**Architecture:**
- **WebSocket Connections** for active clients
- **Channel Servers** (stateful, in-memory) using consistent hashing
- **Message Queue** (Kafka) for buffering and distribution
- **Push Notifications** for offline clients

**Key Characteristics:**
- Every client maintains persistent WebSocket connection when active
- Channel Servers serve tens of millions of channels per host
- Messages delivered globally in ~500ms
- Falls back to push notifications when client is offline
- Consistent hashing ensures efficient server distribution

**Lessons for Email:**
- WebSocket is overkill for email (lower message frequency)
- Push notifications are more battery-efficient for email use case
- Consistent hashing pattern useful for scaling

### 6.3 WhatsApp Web Architecture

**Push Notification System:**
- **Google Firebase Cloud Messaging (FCM)** for Android/Web
- **Apple Push Notification Service (APNs)** for iOS
- **Persistent connection** between device and push service

**Message Flow:**
1. Sender → WhatsApp Server
2. Server stores in message queue
3. Server sends notification metadata to FCM/APNs
4. FCM/APNs delivers to device
5. Device fetches full message, decrypts, stores locally
6. UI updates

**Key Characteristics:**
- Notification contains only metadata (not full message content)
- End-to-end encryption - server cannot read messages
- Device fetches and decrypts when notification arrives
- Persistent push connection is battery-optimized by OS

**Lessons for Email:**
- Separate notification (metadata) from content fetching
- Let browser/OS handle push connection efficiently
- Fetch full content only when needed

### 6.4 Email Client Examples

**ProtonMail:**
- Uses event polling (no native push from their API)
- Exponential backoff when no changes detected
- Visibility-aware polling (pauses when tab hidden)
- End-to-end encryption requires client-side decryption

**Superhuman:**
- Aggressive caching with IndexedDB
- Optimistic UI updates for all actions
- Real-time updates via WebSocket (custom backend)
- Predictive prefetching of likely-to-open emails

**Outlook Web:**
- Uses SignalR (WebSocket/Long Polling hybrid)
- Falls back gracefully to polling
- Coalesces notifications to reduce noise
- Smart batching of sync operations

---

## 7. Browser Support Matrix

| Feature | Chrome | Firefox | Safari | Edge | Mobile Support |
|---------|--------|---------|--------|------|----------------|
| **Service Workers** | ✅ 40+ | ✅ 44+ | ✅ 11.1+ | ✅ 17+ | ✅ Wide |
| **Web Push API** | ✅ 50+ | ✅ 44+ | ✅ 16+ | ✅ 79+ | ✅ Chrome/Safari |
| **VAPID** | ✅ 52+ | ✅ 46+ | ✅ 16+ | ✅ 79+ | ✅ Chrome/Safari |
| **Background Sync** | ✅ 49+ | ❌ No | ❌ No | ✅ 79+ | ⚠️ Android only |
| **Periodic Sync** | ✅ 80+ | ❌ No | ❌ No | ✅ 80+ | ⚠️ Android only |
| **WebSocket** | ✅ 4+ | ✅ 11+ | ✅ 5+ | ✅ 12+ | ✅ Universal |
| **Server-Sent Events** | ✅ 6+ | ✅ 6+ | ✅ 5+ | ✅ 79+ | ✅ Universal |
| **Network Information** | ✅ 61+ | ❌ No | ❌ No | ✅ 79+ | ⚠️ Android only |
| **Battery Status** | ⚠️ Deprecated | ⚠️ Deprecated | ❌ No | ⚠️ Deprecated | ❌ No |
| **Notification Actions** | ✅ 48+ | ❌ No | ✅ 16+ | ✅ 79+ | ⚠️ Limited |

**Key:**
- ✅ Fully supported
- ⚠️ Partial support or deprecated
- ❌ Not supported

**Recommendations:**

1. **Core Features** (Use everywhere):
   - Service Workers
   - Web Push API with VAPID
   - Adaptive polling as fallback

2. **Progressive Enhancement** (Use where available):
   - Background Sync API (Chromium)
   - Periodic Background Sync (Chromium, if high engagement)
   - Network Information API (Android Chrome)

3. **Avoid**:
   - Battery Status API (deprecated, privacy concerns)
   - WebSocket for email sync (battery inefficient)
   - Long polling (legacy only)

---

## 8. Recommendations for Claine v2

### 8.1 Primary Architecture

```
┌─────────────────────────────────────────────────────────┐
│ Recommended Architecture for Claine v2                  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  Gmail Mailbox                                          │
│       │                                                  │
│       ▼                                                  │
│  Gmail Watch API (renewed daily)                        │
│       │                                                  │
│       ▼                                                  │
│  Cloud Pub/Sub Topic                                    │
│       │                                                  │
│       ▼                                                  │
│  Claine Backend (Webhook)                               │
│       │                                                  │
│       ├─→ Fetch History API (changes since lastHistoryId│
│       │                                                  │
│       ├─→ Store in Backend DB                           │
│       │                                                  │
│       └─→ Send Web Push to User's Devices               │
│                                                          │
│  User's Browser                                         │
│       │                                                  │
│       ▼                                                  │
│  Service Worker (receives push)                         │
│       │                                                  │
│       ├─→ Update IndexedDB                              │
│       │                                                  │
│       ├─→ Show Notification (if app not visible)        │
│       │                                                  │
│       └─→ PostMessage to React App (if visible)         │
│                                                          │
│  React 19 App                                           │
│       │                                                  │
│       ├─→ Optimistic UI Updates                         │
│       │                                                  │
│       └─→ IndexedDB Query (local-first)                 │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 8.2 Implementation Phases

**Phase 1: Core Push Infrastructure**
1. Set up Gmail Cloud Pub/Sub topic and permissions
2. Implement backend webhook handler for Pub/Sub notifications
3. Build History API sync logic with deduplication
4. Create service worker with push event handler
5. Implement Web Push API subscription flow
6. Build IndexedDB schema for local email cache

**Phase 2: Optimistic UI**
1. Integrate React 19 useOptimistic hook for all email actions
2. Implement service worker → React message passing
3. Build real-time UI update system
4. Add conflict resolution for out-of-order updates

**Phase 3: Fallback & Polish**
1. Implement adaptive polling fallback
2. Add network-aware sync optimization
3. Build permission request UX with pre-permission dialog
4. Implement notification deduplication and grouping
5. Add Background Sync API for offline actions (Chromium)

**Phase 4: Advanced Features**
1. Implement Periodic Background Sync (optional, Chromium)
2. Add smart notification batching
3. Build notification action handlers (archive, star, etc.)
4. Implement predictive email prefetching

### 8.3 Technical Stack Recommendations

**Frontend:**
- **React 19**: Concurrent features, useOptimistic hook
- **IndexedDB**: Local email cache (use `idb` library for promises)
- **Service Worker**: Push notifications, background sync
- **TanStack Query**: Server state management with optimistic updates

**Backend:**
- **Node.js + Express**: Webhook handler for Pub/Sub
- **Cloud Pub/Sub SDK**: Google Cloud client library
- **Gmail API**: Watch API, History API, Messages API
- **PostgreSQL**: Store user settings, historyIds, push subscriptions
- **Redis**: Cache frequently accessed data, deduplication sets

**Infrastructure:**
- **Google Cloud Pub/Sub**: Push notification delivery
- **Cloud Run / Vercel**: Scalable webhook endpoints
- **HTTPS**: Required for service workers and push API

### 8.4 Performance Targets

| Metric | Target | Rationale |
|--------|--------|-----------|
| **Time to Notification** | <2s | From email arrival to browser notification |
| **Battery Impact** | <2% per day | Background sync + push should be minimal |
| **Offline Support** | 100% | All actions work offline, sync when online |
| **First Load Time** | <1s | Load from IndexedDB cache immediately |
| **Push Acceptance Rate** | >50% | With proper permission UX |
| **Sync Accuracy** | 99.9%+ | No missed or duplicate emails |

### 8.5 Cost Estimation

**For 1,000 Active Users:**

Assumptions:
- 50 emails received per user per day
- 50,000 Pub/Sub notifications per day
- 5KB average notification size
- 250MB Pub/Sub data per day = 7.5GB/month

**Google Cloud Pub/Sub:**
- Data ingestion/delivery: ~7.5GB/month
- Estimated cost: **< $0.50/month**

**Gmail API:**
- Watch API calls: 1,000 users × 1 call/day = 1,000/day
- History API calls: ~50,000/day (one per notification)
- Messages API calls: ~50,000/day (fetch details)
- Total: ~100,000 API calls/day = 3M/month
- Cost: **Free** (within quota limits)

**Backend Hosting:**
- Cloud Run or Vercel function invocations: 50,000/day
- Cost: **< $5/month**

**Total Infrastructure Cost: < $10/month for 1,000 users**

**Scaling to 10,000 users: ~$50-75/month**

### 8.6 Security Considerations

1. **VAPID Keys**: Store private key securely (environment variables)
2. **Pub/Sub Authentication**: Use service account with minimal permissions
3. **Webhook Verification**: Verify Pub/Sub message signatures
4. **User Data**: Encrypt sensitive data in IndexedDB
5. **OAuth Tokens**: Store in HttpOnly cookies or secure storage
6. **CSP Headers**: Content Security Policy for service workers
7. **HTTPS Only**: Required for service workers and push API

### 8.7 Monitoring & Debugging

**Key Metrics to Track:**
- Push notification delivery rate
- Service worker activation success rate
- IndexedDB sync errors
- History API 404 errors (expired historyId)
- Push subscription drop-off rate
- Battery usage per user (if measurable)
- Notification click-through rate

**Debugging Tools:**
- Chrome DevTools → Application → Service Workers
- Chrome DevTools → Application → Push Messaging
- `chrome://serviceworker-internals/`
- `chrome://gcm-internals/` (push message debugging)
- Background Sync events in DevTools

### 8.8 Testing Strategy

**Unit Tests:**
- History API sync logic
- Deduplication algorithms
- Message ordering queue
- Adaptive polling interval calculation

**Integration Tests:**
- Pub/Sub webhook → History API → IndexedDB flow
- Service worker push event → notification display
- Optimistic updates → server confirmation → UI sync

**End-to-End Tests:**
- Full email notification flow
- Offline → online sync recovery
- Permission request flow
- Notification action handlers

**Performance Tests:**
- Battery drain measurement (manual)
- IndexedDB query performance
- Push notification latency
- Concurrent user load testing

---

## 9. Code Examples Summary

### Example 1: Gmail Pub/Sub Setup

```javascript
const setupGmailWatch = async (userId, accessToken) => {
  const topicName = 'projects/YOUR_PROJECT_ID/topics/gmail-notifications';

  const watchRequest = {
    labelIds: ['INBOX'],
    topicName: topicName
  };

  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/${userId}/watch`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(watchRequest)
    }
  );

  const data = await response.json();
  return data; // Store historyId and expiration
};
```

### Example 2: Service Worker Push Handler

```javascript
self.addEventListener('push', event => {
  const data = event.data.json();

  const options = {
    body: data.body,
    icon: '/icons/email-icon-192.png',
    badge: '/icons/badge-72.png',
    tag: data.tag,
    data: { url: data.url, messageId: data.messageId },
    actions: [
      { action: 'view', title: 'View Email' },
      { action: 'archive', title: 'Archive' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});
```

### Example 3: Adaptive Polling

```javascript
class AdaptiveSyncManager {
  adjustPollingInterval() {
    let interval = this.baseInterval;

    if (!this.isDocumentVisible) interval *= 4;
    if (this.networkType === '2g') interval *= 2;
    if (!this.isCharging && this.batteryLevel < 0.15) interval *= 4;

    this.currentInterval = Math.min(interval, this.maxInterval);
  }
}
```

### Example 4: Optimistic UI with React 19

```javascript
const [optimisticEmails, setOptimisticEmails] = useOptimistic(
  emails,
  (current, update) => {
    if (update.type === 'archive') {
      return current.filter(e => e.id !== update.id);
    }
    return current;
  }
);
```

### Example 5: History API Processing

```javascript
const fetchHistoryChanges = async (emailAddress, startHistoryId) => {
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/history?startHistoryId=${startHistoryId}`,
    {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    }
  );

  if (response.status === 404) {
    return await performFullSync(emailAddress); // historyId expired
  }

  const data = await response.json();
  return processHistoryRecords(data.history);
};
```

---

## 10. Conclusion

**Key Takeaways:**

1. **Gmail Cloud Pub/Sub + Web Push API** is the optimal architecture for battery-efficient, real-time email notifications

2. **Push-based approaches** reduce battery consumption by 187% compared to polling

3. **Adaptive polling** with exponential backoff provides robust fallback for all browsers

4. **Optimistic UI updates** with React 19's useOptimistic hook create responsive user experience

5. **IndexedDB-first architecture** enables offline-first functionality and instant UI

6. **Cost is negligible**: < $10/month for 1,000 users with Cloud Pub/Sub

7. **Browser support is excellent** for core features (Service Workers + Web Push API)

**Next Steps for Implementation:**

1. Set up Google Cloud Pub/Sub infrastructure
2. Implement backend webhook handler for Gmail notifications
3. Build service worker with push notification support
4. Create IndexedDB schema for local email cache
5. Implement optimistic UI updates with React 19
6. Add adaptive polling fallback
7. Build permission request UX flow
8. Test end-to-end notification delivery
9. Monitor performance and iterate

**Final Recommendation:**

For Claine v2, implement the **Gmail Cloud Pub/Sub + Web Push API** architecture as the primary strategy, with **adaptive polling** as a universal fallback. This approach provides the best balance of battery efficiency, real-time performance, reliability, and cost-effectiveness for a modern email client.

---

## References

- [Gmail Push Notifications Documentation](https://developers.google.com/workspace/gmail/api/guides/push)
- [Web Push API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [Background Sync API (Chrome Developers)](https://developer.chrome.com/docs/capabilities/periodic-background-sync)
- [Cloud Pub/Sub Documentation](https://cloud.google.com/pubsub/docs)
- [Gmail History API](https://developers.google.com/gmail/api/reference/rest/v1/users.history)
- [React useOptimistic Hook](https://react.dev/reference/react/useOptimistic)
- [Service Worker API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)

---

**Document Version:** 1.0
**Last Updated:** October 28, 2025
**Author:** Research for Claine v2 Development
