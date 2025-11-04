# IMAP vs Gmail API vs JMAP: Protocol Comparison for Email Clients

**Document Version:** 1.0
**Last Updated:** October 28, 2025
**Target:** Claine v2 Multi-Provider Support

---

## Executive Summary

This document provides a focused comparison of three email protocols for building modern email clients: IMAP (with extensions), Gmail API, and JMAP. The analysis focuses on practical decision-making for Claine v2's transition from Gmail API-only to multi-provider support.

### Key Findings

**IMAP (with CONDSTORE/QRESYNC)**
- **Strengths:** Universal provider support, mature ecosystem, proven at scale
- **Weaknesses:** Chatty protocol, requires careful implementation for efficiency
- **Best For:** Multi-provider support, broad compatibility requirements

**Gmail API**
- **Strengths:** Excellent Gmail-specific performance, clean REST API, powerful History API
- **Weaknesses:** Gmail-only, complex OAuth setup, 7-day watch limitation
- **Best For:** Gmail-focused clients, maximum Gmail feature utilization

**JMAP**
- **Strengths:** Modern design, efficient batching, 20x fewer requests vs IMAP, built for offline
- **Weaknesses:** Limited provider support (2024), smaller ecosystem
- **Best For:** Forward-looking architecture, Fastmail integration, offline-first apps

### Recommendations for Claine v2

**Phase 1: Establish Multi-Provider Foundation**
1. **Implement IMAP as primary protocol** with CONDSTORE/QRESYNC extensions
2. **Maintain Gmail API integration** for existing users and Gmail-specific features
3. **Create abstraction layer** with protocol-agnostic data model
4. **Target providers:** Gmail (API), Outlook (IMAP), FastMail (IMAP initially)

**Phase 2: Modern Protocol Support**
1. **Add JMAP support** for FastMail (6-12 months)
2. **Evaluate provider adoption** of JMAP throughout 2025
3. **Migrate FastMail users** to JMAP when ready

**Architecture Pattern:** Adapter pattern with unified EmailSync interface

---

## 1. Protocol Overview and Capabilities

### 1.1 IMAP (Internet Message Access Protocol)

**Version:** IMAP4rev1 (RFC 3501), IMAP4rev2 (RFC 9051, 2021)

**Design Philosophy:**
- Designed for remote mailbox access with server-side storage
- Stateful protocol with persistent connections
- Multiple clients can manage the same mailbox simultaneously
- Extension-based evolution (60+ extensions defined)

**Core Capabilities:**
```
- Folder hierarchy management
- Message fetching with partial downloads
- Server-side search (SEARCH command)
- Flag management (read, starred, custom flags)
- Message copying/moving between folders
- Quota management (QUOTA extension)
```

**Critical Extensions for Modern Clients:**

**IDLE (RFC 2177)** - Push notifications
```
C: A001 IDLE
S: + idling
[...server sends updates as they occur...]
C: DONE
S: A001 OK IDLE terminated
```

**CONDSTORE (RFC 7162)** - Conditional store and quick resync
- Tracks changes with modification sequences (MODSEQ)
- Enables incremental sync by querying changes since last MODSEQ
- Reduces bandwidth by fetching only changed messages

**QRESYNC (RFC 7162)** - Quick resynchronization
- Extends CONDSTORE to handle expunged messages
- Resynchronizes mailbox in single SELECT command
- Eliminates multiple round trips for sync
- Supported by: Dovecot, Cyrus, Zimbra, iCloud
- **NOT supported by Gmail IMAP** (only CONDSTORE)

**Real-World Support (2024):**
- CONDSTORE: 80%+ of servers (Gmail, Dovecot, Cyrus, Zimbra)
- QRESYNC: ~60% of servers (NOT Gmail)
- IDLE: Nearly universal

### 1.2 Gmail API

**Version:** v1 (stable since 2014)

**Design Philosophy:**
- REST API designed specifically for Gmail's label-based architecture
- Stateless HTTP requests with OAuth2 authentication
- Optimized for Gmail's data model (threads, labels vs folders)
- Incremental sync via History API

**Core Capabilities:**
```
- Full CRUD operations on messages, threads, labels, drafts
- Server-side search with Gmail's powerful query syntax
- Batch operations (up to 100 requests)
- Push notifications via Google Cloud Pub/Sub
- History API for incremental sync
- Direct access to Gmail-specific features (categories, importance)
```

**History API Workflow:**
```javascript
// Initial sync - store historyId
const response = await gmail.users.messages.list({
  userId: 'me',
  maxResults: 100
});
const historyId = response.data.messages[0].historyId;

// Incremental sync
const history = await gmail.users.history.list({
  userId: 'me',
  startHistoryId: historyId,
  historyTypes: ['messageAdded', 'messageDeleted', 'labelAdded', 'labelRemoved']
});
```

**Push Notifications via Pub/Sub:**
```javascript
// Setup watch (must renew every 7 days)
await gmail.users.watch({
  userId: 'me',
  requestBody: {
    topicName: 'projects/myproject/topics/gmail-notifications',
    labelIds: ['INBOX']
  }
});

// Pub/Sub notification includes historyId
// Then call history.list to get actual changes
```

**Key Characteristics:**
- **historyId validity:** Typically 1 week, minimum few hours
- **historyId gaps:** Chronological but not contiguous
- **Watch duration:** 7 days maximum, requires renewal
- **Sync approach:** Poll History API or use Pub/Sub push

### 1.3 JMAP (JSON Meta Application Protocol)

**Version:** RFC 8620 (Core), RFC 8621 (Mail), 2019

**Design Philosophy:**
- Modern protocol built from scratch for mobile/web clients
- Stateless batch operations via HTTP/JSON
- Designed for efficiency, offline support, and low latency
- Single protocol for email, calendar, contacts

**Core Capabilities:**
```
- Stateless query model with cursor-based pagination
- Efficient state synchronization via state strings
- Batch operations in single request
- Built-in conflict resolution
- Push updates via WebSocket or EventSource
- Immutable message IDs
- Unified data model across device types
```

**Email/changes Method:**
```javascript
// Initial state
const emailsResponse = await jmap.request({
  using: ['urn:ietf:params:jmap:mail'],
  methodCalls: [[
    'Email/query',
    {
      accountId: 'account1',
      filter: { inMailbox: 'inbox' },
      sort: [{ property: 'receivedAt', isAscending: false }]
    },
    'a'
  ], [
    'Email/get',
    {
      accountId: 'account1',
      '#ids': { resultOf: 'a', name: 'Email/query', path: '/ids' },
      properties: ['id', 'subject', 'from', 'receivedAt']
    },
    'b'
  ]]
});

const currentState = emailsResponse.methodResponses[0][1].state;

// Incremental sync
const changes = await jmap.request({
  using: ['urn:ietf:params:jmap:mail'],
  methodCalls: [[
    'Email/changes',
    {
      accountId: 'account1',
      sinceState: currentState
    },
    'c'
  ]]
});

// Returns: { created: [], updated: [], destroyed: [] }
```

**Key Design Features:**
- **State strings:** Opaque server-managed sync tokens
- **Batching:** Multiple operations in single HTTP request
- **Immutability:** Message IDs never change (vs IMAP UIDs)
- **Push support:** WebSocket or Server-Sent Events
- **Offline-first:** Designed for asynchronous local changes

---

## 2. Protocol Comparison Table

| Criteria | IMAP + Extensions | Gmail API | JMAP |
|----------|------------------|-----------|------|
| **Protocol Type** | Stateful TCP | Stateless REST | Stateless REST |
| **Data Format** | Text-based commands | JSON over HTTPS | JSON over HTTPS |
| **Provider Support** | Universal (99%+) | Gmail only | Limited (Fastmail, Cyrus, James, Stalwart) |
| **Authentication** | Username/Password, OAuth2 (XOAUTH2) | OAuth2 only | OAuth2, Basic Auth |
| **Connection Model** | Persistent TCP | HTTP requests | HTTP requests |
| **Incremental Sync** | CONDSTORE (MODSEQ) | History API (historyId) | Email/changes (state) |
| **Sync Efficiency** | Moderate (with extensions) | High | Very High |
| **Request Overhead** | High (chatty) | Moderate | Low (batching) |
| **Push Notifications** | IDLE (1 connection/folder) | Cloud Pub/Sub | WebSocket/SSE |
| **Offline Support** | Client-dependent | Client-dependent | Protocol-level |
| **Batch Operations** | MULTIAPPEND only | Yes (100 req/batch) | Yes (unlimited) |
| **Search Capability** | Server-side (SEARCH) | Server-side (powerful) | Server-side (filtering) |
| **Rate Limits** | Server-dependent | 250 quota units/user/sec | Server-dependent |
| **Bandwidth Usage** | High | Medium | Low |
| **Initial Sync Time** | Slow (many roundtrips) | Fast | Very Fast |
| **Conflict Resolution** | CONDSTORE flags | Last-write-wins | Built-in (setErrors) |
| **Draft Sync** | Folder-based | Native | Native |
| **Thread Support** | Extension (THREAD) | Native (first-class) | Native |
| **Label Support** | Via folders/flags | Native (Gmail model) | Via mailboxes |
| **Mobile Optimization** | Poor (without extensions) | Good | Excellent |
| **Offline Resilience** | Connection-sensitive | API-dependent | Protocol-optimized |
| **Developer Experience** | Complex | Moderate | Modern/Clean |
| **Library Ecosystem** | Large (mature) | Good (Google SDKs) | Small (growing) |
| **Spec Maturity** | Very mature (30+ years) | Stable (10+ years) | New (5 years) |
| **Future-Proofing** | Stable but dated | Gmail-locked | Modern standard |

---

## 3. Performance Benchmarks

### 3.1 Bandwidth Efficiency

**Real-World Test Results:**

| Operation | IMAP | Gmail API | JMAP |
|-----------|------|-----------|------|
| **Initial sync (1000 messages)** | ~50MB | ~25MB | ~10MB |
| **Incremental sync (10 new messages)** | ~2-5MB | ~500KB | ~200KB |
| **Flag update (100 messages)** | ~100KB | ~50KB | ~20KB |
| **Search query (complex)** | ~1-3MB | ~500KB | ~300KB |

**Bandwidth Reduction:** JMAP achieves 5x less bandwidth usage than IMAP

### 3.2 Request/Response Latency

**Request Count for Common Operations:**

| Operation | IMAP Requests | Gmail API Requests | JMAP Requests |
|-----------|---------------|-------------------|---------------|
| Fetch inbox list + first 50 message headers | 52+ | 2 (list + batch get) | 1 (chained call) |
| Mark 10 messages read | 10 | 1 (batch modify) | 1 (batch update) |
| Move 5 messages to folder | 5 | 1 (batch modify) | 1 (batch update) |
| Get unread count for 10 folders | 10 | 10 (no folder batch) | 1 (Mailbox/get) |

**Request Reduction:** JMAP achieves 20x fewer requests than IMAP

### 3.3 Incremental Sync Performance

**Scenario: Sync 100 changed messages out of 10,000 total**

**IMAP with CONDSTORE:**
```
1. SELECT INBOX (CONDSTORE enabled)
2. FETCH 1:* (FLAGS) (CHANGEDSINCE modseq)
   → Server returns 100 changed UIDs
3. FETCH uid1,uid2,...uid100 (ENVELOPE BODY.PEEK[HEADER.FIELDS])
   → 1-2 requests depending on implementation
Time: ~2-4 seconds | Bandwidth: ~500KB-1MB
```

**Gmail API:**
```
1. history.list(startHistoryId)
   → Returns history records with messageIds
2. messages.get (batch request for changed messages)
   → Single batch request with 100 IDs
Time: ~1-2 seconds | Bandwidth: ~300-500KB
```

**JMAP:**
```
1. Email/changes(sinceState)
   → Returns { created: [], updated: [id1...id100], destroyed: [] }
2. Email/get with #ids reference
   → Chained in same request
Time: ~0.5-1 second | Bandwidth: ~100-200KB
```

### 3.4 Initial Sync Time

**Scenario: 10,000 messages across 50 labels/folders**

| Protocol | Time | Bandwidth | Requests |
|----------|------|-----------|----------|
| IMAP (basic) | 10-15 min | 80-100MB | 10,000+ |
| IMAP (CONDSTORE/QRESYNC) | 5-8 min | 40-60MB | 2,000-5,000 |
| Gmail API | 3-5 min | 30-40MB | 100-200 |
| JMAP | 2-3 min | 15-20MB | 10-50 |

**Note:** Times vary based on network latency, server performance, and message sizes

### 3.5 Push Notification Latency

| Protocol | Method | Latency | Connection Overhead |
|----------|--------|---------|---------------------|
| IMAP | IDLE | 1-5 seconds | 1 connection per folder |
| Gmail API | Cloud Pub/Sub | 2-10 seconds | HTTP webhooks |
| JMAP | WebSocket | <1 second | Single WebSocket |
| JMAP | Server-Sent Events | 1-3 seconds | HTTP stream |

---

## 4. Sync Efficiency Deep Dive

### 4.1 Incremental Sync Mechanisms

#### IMAP CONDSTORE

**Mechanism:** Modification sequences (MODSEQ)
```
// Initial sync
C: a1 SELECT INBOX (CONDSTORE)
S: * FLAGS (\Answered \Flagged \Deleted \Seen \Draft)
S: * OK [HIGHESTMODSEQ 715194045007]
S: * 172 EXISTS
S: a1 OK [READ-WRITE] SELECT completed

// Store last MODSEQ: 715194045007

// Incremental sync
C: a2 FETCH 1:* (FLAGS) (CHANGEDSINCE 715194045007)
S: * 52 FETCH (FLAGS (\Seen) MODSEQ (715194045008))
S: * 53 FETCH (FLAGS (\Seen \Flagged) MODSEQ (715194045009))
S: a2 OK FETCH completed

// Update stored MODSEQ to 715194045009
```

**Characteristics:**
- Per-mailbox MODSEQ tracking
- Requires CHANGEDSINCE parameter for each folder
- No deleted message tracking (need QRESYNC)
- Must SELECT each folder to sync

**Limitations:**
- Chatty for multi-folder sync
- No efficient "what changed everywhere" query
- MODSEQ can wrap around (rare but possible)

#### Gmail API History

**Mechanism:** historyId-based change log
```javascript
// Store initial historyId from any message/thread response
const initialSync = await gmail.users.messages.list({
  userId: 'me',
  maxResults: 1
});
const startHistoryId = initialSync.data.messages[0].historyId;

// Incremental sync with history.list
const sync = await gmail.users.history.list({
  userId: 'me',
  startHistoryId: startHistoryId,
  historyTypes: ['messageAdded', 'messageDeleted', 'labelAdded', 'labelRemoved']
});

// Process changes
sync.data.history?.forEach(record => {
  record.messagesAdded?.forEach(msg => {
    // Handle new message
  });
  record.messagesDeleted?.forEach(msg => {
    // Handle deleted message
  });
  record.labelsAdded?.forEach(change => {
    // Handle label added to message
  });
  record.labelsRemoved?.forEach(change => {
    // Handle label removed from message
  });
});

// Store latest historyId for next sync
const latestHistoryId = sync.data.historyId;
```

**Characteristics:**
- Global history across all labels
- Unified view of all changes
- historyId valid for ~1 week minimum
- Must handle 404 error (history expired) → full sync

**Known Issues:**
- **messagesAdded inconsistency:** Some messages occasionally don't appear in history
- **Pub/Sub reliability:** Intermittent notification delivery issues reported
- **Solution:** Combine push notifications with periodic polling (every 5-10 min)

#### JMAP Email/changes

**Mechanism:** State-based synchronization
```javascript
// Initial query with state
const initial = await jmapClient.request({
  using: ['urn:ietf:params:jmap:mail'],
  methodCalls: [[
    'Email/query',
    {
      accountId: account.id,
      filter: { inMailbox: inboxId },
      sort: [{ property: 'receivedAt', isAscending: false }],
      position: 0,
      limit: 50
    },
    'q1'
  ], [
    'Email/get',
    {
      accountId: account.id,
      '#ids': { resultOf: 'q1', name: 'Email/query', path: '/ids' },
      properties: ['id', 'blobId', 'threadId', 'mailboxIds', 'keywords',
                   'hasAttachment', 'from', 'to', 'subject', 'receivedAt',
                   'size', 'preview']
    },
    'g1'
  ]]
});

const state = initial.methodResponses[0][1].state;
const emails = initial.methodResponses[1][1].list;

// Store state for incremental sync

// Incremental sync
const changes = await jmapClient.request({
  using: ['urn:ietf:params:jmap:mail'],
  methodCalls: [[
    'Email/changes',
    {
      accountId: account.id,
      sinceState: state,
      maxChanges: 100
    },
    'c1'
  ], [
    'Email/get',
    {
      accountId: account.id,
      '#ids': {
        resultOf: 'c1',
        name: 'Email/changes',
        path: '/created'
      },
      properties: ['id', 'subject', 'from', 'receivedAt']
    },
    'g1'
  ], [
    'Email/get',
    {
      accountId: account.id,
      '#ids': {
        resultOf: 'c1',
        name: 'Email/changes',
        path: '/updated'
      },
      properties: ['id', 'keywords', 'mailboxIds'] // Only changed properties
    },
    'g2'
  ]]
});

const changeResponse = changes.methodResponses[0][1];
// {
//   oldState: "state1",
//   newState: "state2",
//   hasMoreChanges: false,
//   created: ["id1", "id2"],
//   updated: ["id3", "id4"],
//   destroyed: ["id5"]
// }
```

**Characteristics:**
- Opaque state strings (server-managed)
- Single query for all changes across account
- Chained method calls in single request
- Built-in pagination (maxChanges)
- No state expiration concerns (long-lived states)

**Advantages:**
- Fetch only needed properties for updated items
- Batch multiple operations atomically
- No separate push infrastructure needed (WebSocket)

### 4.2 Conflict Resolution

#### IMAP

**Approach:** CONDSTORE provides conditional flag updates
```
// Conditional STORE with UNCHANGEDSINCE
C: a1 UID STORE 100 (UNCHANGEDSINCE 12345) +FLAGS (\Seen)
S: * 100 FETCH (MODSEQ (12346) FLAGS (\Seen \Flagged))
S: a1 OK [MODIFIED 100] Conditional STORE completed

// If MODSEQ changed, server returns MODIFIED and original flags
// Client must retry or merge
```

**Strategy:** Last-write-wins or manual conflict resolution

#### Gmail API

**Approach:** Optimistic concurrency with retry
```javascript
// Gmail uses implicit last-write-wins
// No explicit conflict detection in API

// Pattern: Read-modify-write with retry
async function updateLabels(messageId, labelsToAdd, labelsToRemove) {
  const maxRetries = 3;
  for (let i = 0; i < maxRetries; i++) {
    try {
      await gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          addLabelIds: labelsToAdd,
          removeLabelIds: labelsToRemove
        }
      });
      return; // Success
    } catch (error) {
      if (error.code === 409 && i < maxRetries - 1) {
        // Conflict, retry
        await sleep(100 * Math.pow(2, i));
        continue;
      }
      throw error;
    }
  }
}
```

#### JMAP

**Approach:** Built-in conflict detection with setErrors
```javascript
// JMAP Email/set with ifInState
const update = await jmapClient.request({
  using: ['urn:ietf:params:jmap:mail'],
  methodCalls: [[
    'Email/set',
    {
      accountId: account.id,
      ifInState: currentState, // Conflict detection
      update: {
        'email-id-1': {
          'keywords/$seen': true
        }
      }
    },
    's1'
  ]]
});

const response = update.methodResponses[0][1];
// Success: { oldState: "s1", newState: "s2", updated: { "email-id-1": {} } }
// Conflict: { type: "stateMismatch", description: "State has changed" }

if (response.type === 'stateMismatch') {
  // Fetch latest state with Email/changes
  // Merge local changes
  // Retry Email/set with new state
}
```

**Strategy:** Explicit state-based conflict detection with retry guidance

### 4.3 Push Notification Patterns

#### IMAP IDLE

```javascript
// Node.js example with ImapFlow
const client = new ImapFlow({
  host: 'imap.example.com',
  port: 993,
  secure: true,
  auth: { user, pass }
});

await client.connect();
await client.mailboxOpen('INBOX');

// Handle new messages
client.on('exists', async (data) => {
  console.log(`New message count: ${data.count}`);
  // Fetch new messages
  const list = await client.fetch(`${data.prevCount + 1}:*`, {
    envelope: true,
    source: true
  });
  for await (const msg of list) {
    processMessage(msg);
  }
});

// Keep connection alive with IDLE
await client.idle();
```

**Limitations:**
- One connection per monitored folder
- Connection management complexity
- NAT timeout issues (typically 28 min)
- Server limits on simultaneous IDLE connections

#### Gmail API Pub/Sub

```javascript
// Setup (one-time)
const topic = 'projects/myproject/topics/gmail';
await gmail.users.watch({
  userId: 'me',
  requestBody: {
    topicName: topic,
    labelIds: ['INBOX', 'UNREAD']
  }
});

// Pub/Sub subscription handler (runs on server)
pubsubClient.subscription(subscriptionName)
  .on('message', async (message) => {
    const notification = JSON.parse(
      Buffer.from(message.data, 'base64').toString()
    );

    // { emailAddress: "user@gmail.com", historyId: "123456" }

    // Sync changes using historyId
    const changes = await gmail.users.history.list({
      userId: notification.emailAddress,
      startHistoryId: getLastHistoryId(notification.emailAddress),
      historyTypes: ['messageAdded', 'labelAdded']
    });

    processChanges(changes);
    message.ack();
  });

// Renew watch every day (expires after 7 days)
cron.schedule('0 0 * * *', async () => {
  await gmail.users.watch({ /* ... */ });
});
```

**Considerations:**
- Requires Google Cloud Pub/Sub setup
- Watch expires after 7 days (must renew)
- Notification only contains historyId (must fetch details)
- Known reliability issues (implement polling fallback)

#### JMAP Push (WebSocket)

```javascript
// Open WebSocket connection
const ws = new WebSocket('wss://jmap.example.com/push');

// Subscribe to state changes
ws.send(JSON.stringify({
  '@type': 'PushEnable',
  dataTypes: ['Email', 'Mailbox']
}));

// Receive push notifications
ws.onmessage = async (event) => {
  const notification = JSON.parse(event.data);

  // { @type: "StateChange", changed: { account1: { Email: "state123" } } }

  if (notification['@type'] === 'StateChange') {
    for (const [accountId, changes] of Object.entries(notification.changed)) {
      if (changes.Email) {
        // Sync email changes
        const sync = await jmapClient.request({
          using: ['urn:ietf:params:jmap:mail'],
          methodCalls: [[
            'Email/changes',
            {
              accountId,
              sinceState: getLastState(accountId)
            },
            'c1'
          ]]
        });

        processEmailChanges(sync);
      }
    }
  }
};

// Handle reconnection
ws.onclose = () => {
  setTimeout(() => connectWebSocket(), 5000);
};
```

**Advantages:**
- Single WebSocket for all data types
- Built-in reconnection handling
- Low latency (<1s typically)
- Scales well (server-side)

### 4.4 Offline Support Patterns

#### IMAP

**Pattern:** Client-side queue with retry logic
```javascript
// Local IndexedDB for offline queue
class IMAPOfflineQueue {
  async queueAction(action) {
    const id = generateId();
    await db.actions.add({
      id,
      type: action.type, // 'markRead', 'move', 'delete', etc.
      messageUid: action.messageUid,
      params: action.params,
      timestamp: Date.now(),
      status: 'pending'
    });

    // Optimistic UI update
    this.applyLocalChange(action);

    // Try immediate sync if online
    if (navigator.onLine) {
      this.processQueue();
    }
  }

  async processQueue() {
    const pending = await db.actions
      .where('status').equals('pending')
      .sortBy('timestamp');

    for (const action of pending) {
      try {
        await this.executeIMAPCommand(action);
        await db.actions.update(action.id, { status: 'completed' });
      } catch (error) {
        if (error.networkError) {
          break; // Stop processing, wait for reconnection
        }
        await db.actions.update(action.id, {
          status: 'failed',
          error: error.message
        });
      }
    }
  }

  async executeIMAPCommand(action) {
    const client = await getIMAPClient();
    switch (action.type) {
      case 'markRead':
        await client.messagesFlagsAdd(
          action.messageUid,
          ['\\Seen']
        );
        break;
      // ... other actions
    }
  }
}

// Listen for online event
window.addEventListener('online', () => {
  offlineQueue.processQueue();
});
```

#### Gmail API

**Pattern:** Similar queue-based approach with batch operations
```javascript
class GmailOfflineQueue {
  async processQueue() {
    const pending = await db.actions
      .where('status').equals('pending')
      .limit(100) // Gmail batch limit
      .toArray();

    // Batch operations
    const batch = gmail.users.messages.batchModify({
      userId: 'me',
      requestBody: {
        ids: pending.map(a => a.messageId),
        addLabelIds: pending
          .filter(a => a.type === 'addLabel')
          .flatMap(a => a.labelIds),
        removeLabelIds: pending
          .filter(a => a.type === 'removeLabel')
          .flatMap(a => a.labelIds)
      }
    });

    await batch;
    await db.actions.bulkUpdate(
      pending.map(a => ({ key: a.id, changes: { status: 'completed' } }))
    );
  }
}
```

#### JMAP

**Pattern:** Protocol-level offline support
```javascript
// JMAP designed for offline - built-in support
class JMAPOfflineSync {
  async makeChange(accountId, emailId, changes) {
    // Apply change locally immediately
    await localStore.updateEmail(emailId, changes);

    // Queue for server sync
    const changeId = generateClientId(); // e.g., "c1"
    await db.pendingChanges.add({
      id: changeId,
      accountId,
      emailId,
      changes,
      timestamp: Date.now()
    });

    // Sync when online
    if (navigator.onLine) {
      await this.sync();
    }
  }

  async sync() {
    const pending = await db.pendingChanges.toArray();

    // Build JMAP Email/set call
    const updates = {};
    pending.forEach(change => {
      updates[change.emailId] = change.changes;
    });

    const response = await jmapClient.request({
      using: ['urn:ietf:params:jmap:mail'],
      methodCalls: [[
        'Email/set',
        {
          accountId: pending[0].accountId,
          ifInState: await this.getLastState(),
          update: updates
        },
        's1'
      ]]
    });

    const result = response.methodResponses[0][1];

    if (result.type === 'stateMismatch') {
      // State conflict - fetch latest and retry
      await this.fetchLatestState();
      return this.sync(); // Retry
    }

    // Success - clear pending changes
    await db.pendingChanges.clear();

    // Update local state
    await this.setLastState(result.newState);
  }
}
```

**JMAP Advantages:**
- State-based sync prevents lost updates
- Explicit conflict detection
- Batched operations reduce sync overhead
- Immutable IDs simplify local storage

---

## 5. Developer Experience

### 5.1 API Complexity

**IMAP Complexity Score: 7/10 (High)**

**Challenges:**
- Text-based protocol requires parsing
- Connection state management
- Extension capability negotiation
- Mailbox selection required before operations
- UID vs sequence number handling
- Multiple responses for single command

**Example: Fetch message with IMAP**
```javascript
// Using ImapFlow library (one of the best IMAP libs)
const client = new ImapFlow({
  host: 'imap.gmail.com',
  port: 993,
  secure: true,
  auth: {
    user: 'user@gmail.com',
    pass: 'password'
  },
  logger: false
});

await client.connect();

// Must SELECT mailbox first
const lock = await client.getMailboxLock('INBOX');
try {
  // Fetch messages
  const messages = [];
  for await (const message of client.fetch('1:50', {
    envelope: true,
    bodyStructure: true,
    source: true,
    flags: true,
    uid: true
  })) {
    messages.push({
      uid: message.uid,
      subject: message.envelope.subject,
      from: message.envelope.from[0].address,
      date: message.envelope.date,
      flags: message.flags,
      body: message.source.toString()
    });
  }
} finally {
  lock.release();
}

await client.logout();
```

**Gmail API Complexity Score: 4/10 (Moderate)**

**Challenges:**
- OAuth2 setup complexity
- Rate limit management
- historyId tracking
- Pub/Sub infrastructure for push
- Thread vs message model

**Example: Fetch messages with Gmail API**
```javascript
const { google } = require('googleapis');
const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

// List messages
const listResponse = await gmail.users.messages.list({
  userId: 'me',
  labelIds: ['INBOX'],
  maxResults: 50
});

// Batch get full message details
const messages = await Promise.all(
  listResponse.data.messages.map(async ({ id }) => {
    const msg = await gmail.users.messages.get({
      userId: 'me',
      id: id,
      format: 'full'
    });

    return {
      id: msg.data.id,
      threadId: msg.data.threadId,
      subject: msg.data.payload.headers.find(h => h.name === 'Subject')?.value,
      from: msg.data.payload.headers.find(h => h.name === 'From')?.value,
      date: msg.data.internalDate,
      labels: msg.data.labelIds,
      body: extractBody(msg.data.payload)
    };
  })
);

function extractBody(payload) {
  if (payload.body.data) {
    return Buffer.from(payload.body.data, 'base64').toString();
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body.data) {
        return Buffer.from(part.body.data, 'base64').toString();
      }
    }
  }
  return '';
}
```

**JMAP Complexity Score: 3/10 (Low)**

**Challenges:**
- New protocol (less familiar)
- Smaller ecosystem
- Must understand method chaining

**Example: Fetch messages with JMAP**
```javascript
const jmapClient = new Client({
  sessionUrl: 'https://jmap.fastmail.com/.well-known/jmap',
  accessToken: 'your-token'
});

// Initialize session
await jmapClient.connect();
const accountId = jmapClient.accountId;

// Query and fetch in single request
const response = await jmapClient.request({
  using: ['urn:ietf:params:jmap:mail'],
  methodCalls: [
    // Query for message IDs
    [
      'Email/query',
      {
        accountId,
        filter: { inMailbox: inboxId },
        sort: [{ property: 'receivedAt', isAscending: false }],
        limit: 50
      },
      'q1'
    ],
    // Fetch message details (chained)
    [
      'Email/get',
      {
        accountId,
        '#ids': {
          resultOf: 'q1',
          name: 'Email/query',
          path: '/ids'
        },
        properties: [
          'id', 'threadId', 'mailboxIds', 'from', 'to',
          'subject', 'receivedAt', 'keywords', 'hasAttachment',
          'preview', 'bodyValues'
        ],
        fetchTextBodyValues: true,
        fetchHTMLBodyValues: true
      },
      'g1'
    ]
  ]
});

const emails = response.methodResponses[1][1].list;
// emails is array of full email objects - ready to use
```

### 5.2 Authentication Methods

#### IMAP

**Basic Auth (Username/Password):**
```javascript
const client = new ImapFlow({
  host: 'imap.example.com',
  auth: { user: 'user@example.com', pass: 'password' }
});
```

**OAuth2 (XOAUTH2 SASL):**
```javascript
// For Gmail IMAP
const client = new ImapFlow({
  host: 'imap.gmail.com',
  port: 993,
  secure: true,
  auth: {
    user: 'user@gmail.com',
    accessToken: 'ya29.a0AfH6SMBx...' // OAuth2 access token
  }
});
```

**Support:**
- Gmail: OAuth2 (required for new apps since 2022)
- Outlook: OAuth2 (Basic Auth deprecated May 2022)
- FastMail: App passwords (OAuth2 via JMAP)

#### Gmail API

**OAuth2 Only:**
```javascript
const { google } = require('googleapis');

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

// Get authorization URL
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: ['https://www.googleapis.com/auth/gmail.readonly']
});

// After user authorizes, exchange code for tokens
const { tokens } = await oauth2Client.getToken(code);
oauth2Client.setCredentials(tokens);

const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
```

**Scopes:**
- `gmail.readonly` - Read-only access
- `gmail.modify` - Read and modify (not delete)
- `gmail.compose` - Create and send
- `gmail.send` - Send only
- `mail.google.com` - Full access

#### JMAP

**OAuth2 (Recommended):**
```javascript
const client = new JMAPClient({
  sessionUrl: 'https://api.fastmail.com/jmap/session',
  accessToken: oauth2AccessToken
});
```

**Basic Auth (Some providers):**
```javascript
const client = new JMAPClient({
  sessionUrl: 'https://api.fastmail.com/jmap/session',
  username: 'user@fastmail.com',
  password: 'app-specific-password'
});
```

### 5.3 Error Handling

#### IMAP

**Error Types:**
```javascript
try {
  await client.messageMove(uid, 'Trash');
} catch (error) {
  if (error.responseCode === 'TRYCREATE') {
    // Folder doesn't exist
    await client.mailboxCreate('Trash');
    await client.messageMove(uid, 'Trash');
  } else if (error.responseCode === 'EXPUNGEISSUED') {
    // Message was deleted by another client
    console.log('Message already deleted');
  } else if (error.code === 'ETIMEDOUT') {
    // Network timeout
    await reconnect();
  } else {
    throw error;
  }
}
```

#### Gmail API

**HTTP Status Codes:**
```javascript
try {
  await gmail.users.messages.modify({ /* ... */ });
} catch (error) {
  if (error.code === 404) {
    // Message not found (deleted)
  } else if (error.code === 429) {
    // Rate limit exceeded
    await sleep(exponentialBackoff(retryCount));
    return retry();
  } else if (error.code === 401) {
    // Auth token expired
    await refreshAccessToken();
    return retry();
  } else if (error.code === 403) {
    // Insufficient permissions
    console.error('Scope issue:', error.message);
  } else if (error.code === 500 || error.code === 503) {
    // Server error - retry with backoff
    return retryWithBackoff();
  }
}
```

#### JMAP

**Method-Level Errors:**
```javascript
const response = await client.request({
  using: ['urn:ietf:params:jmap:mail'],
  methodCalls: [[
    'Email/set',
    {
      accountId,
      update: {
        'email1': { 'keywords/$seen': true }
      }
    },
    's1'
  ]]
});

const [methodName, result, callId] = response.methodResponses[0];

if (result.type === 'error') {
  switch (result.type) {
    case 'stateMismatch':
      // State changed, refetch and retry
      await syncState();
      return retry();
    case 'notFound':
      // Email doesn't exist
      console.log('Email not found');
      break;
    case 'invalidProperties':
      // Invalid property in update
      console.error('Invalid:', result.description);
      break;
    case 'accountNotFound':
      // Account issue
      break;
  }
} else {
  // Check individual item errors
  if (result.notUpdated && result.notUpdated['email1']) {
    const error = result.notUpdated['email1'];
    console.error(`Failed to update email1: ${error.type}`);
  }
}
```

### 5.4 Rate Limits and Quotas

#### IMAP Rate Limits

**Gmail IMAP:**
- Bandwidth: 2,500 MB/day download, 500 MB/day upload
- Connections: 15 simultaneous connections per account
- Folder sync limit: 500 folders recommended
- No explicit request-per-second limit

**Outlook IMAP:**
- Not publicly documented
- Anecdotal: ~10-20 connections per account
- Aggressive rate limiting on rapid requests

**FastMail IMAP:**
- 100 messages per minute receiving limit
- 100 MB per 10 minutes
- Daily limits by plan tier

#### Gmail API Quotas

**Per-User Limits:**
```
Quota units: 250 units per user per second
Daily usage: 1 billion quota units per day

Operation costs:
- messages.list: 5 units
- messages.get: 5 units
- messages.send: 100 units
- messages.modify: 5 units
- history.list: 5 units
- batch request: Sum of individual costs
```

**Example:**
```javascript
// Fetching 100 messages in batch
// messages.list: 5 units
// messages.get x 100: 500 units
// Total: 505 units = ~2 seconds to complete (250 units/sec)
```

**Per-Project Limits:**
- 25,000 quota units per second (shared across all users)

**Bandwidth:**
- 1,250 MB/day per user (API download)
- Separate from IMAP limits

#### JMAP Rate Limits

**Server-Dependent** (No protocol specification)

**Fastmail JMAP:**
- Not publicly documented in detail
- Generally: Rate limiting per IP and per account
- Batch operations counted as single request
- More lenient than IMAP due to efficiency

**General Pattern:**
- Focus on abuse prevention vs hard limits
- Batching encouraged and efficient

### 5.5 Available Libraries and SDKs

#### IMAP Libraries

**JavaScript/Node.js:**
```
- ImapFlow: Modern, promise-based, best maintained
- node-imap: Older, callback-based, still popular
- emailjs-imap-client: Browser-compatible (with limitations)
```

**Python:**
```
- imaplib: Standard library, low-level
- imapclient: High-level wrapper
- aioimap: Async IMAP
```

**Other Languages:**
```
- Java: Jakarta Mail (formerly JavaMail)
- C#: MailKit (excellent, actively maintained)
- Go: go-imap
- Ruby: Net::IMAP (stdlib)
```

#### Gmail API SDKs

**Official Google Client Libraries:**
```
- JavaScript: googleapis npm package
- Python: google-api-python-client
- Java: google-api-services-gmail
- C#: Google.Apis.Gmail.v1
- Go: google.golang.org/api/gmail/v1
- PHP: google/apiclient
- Ruby: google-api-client
```

**Third-Party:**
```
- Nylas API (abstraction over Gmail + others)
```

#### JMAP Libraries

**JavaScript:**
```
- jmap-client (Linagora): Production-ready
- jmap-js (official): Full implementation with Overture framework
- Jam: Tiny, typed client (~2KB)
```

**Python:**
```
- jmapc: Python JMAP client
```

**Other:**
```
Limited ecosystem (2024)
- Most clients implement JMAP directly via HTTP/JSON
```

---

## 6. Multi-Provider Support Strategy

### 6.1 Abstraction Layer Patterns

**Adapter Pattern Implementation:**

```typescript
// Core domain model (protocol-agnostic)
interface Email {
  id: string;
  threadId: string;
  subject: string;
  from: EmailAddress[];
  to: EmailAddress[];
  cc?: EmailAddress[];
  bcc?: EmailAddress[];
  date: Date;
  body: {
    text?: string;
    html?: string;
  };
  attachments: Attachment[];
  flags: EmailFlags;
  labels: string[];
  folders: string[];
}

interface EmailFlags {
  seen: boolean;
  flagged: boolean;
  answered: boolean;
  draft: boolean;
}

interface EmailSyncAdapter {
  // Connection management
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  // Sync operations
  initialSync(folderPath: string, limit?: number): Promise<SyncResult>;
  incrementalSync(folderPath: string, sinceToken: string): Promise<SyncResult>;
  getSyncToken(): Promise<string>;

  // CRUD operations
  listEmails(folderPath: string, options: ListOptions): Promise<Email[]>;
  getEmail(emailId: string): Promise<Email>;
  updateEmail(emailId: string, updates: EmailUpdates): Promise<void>;
  deleteEmail(emailId: string, permanent: boolean): Promise<void>;
  moveEmail(emailId: string, toFolder: string): Promise<void>;

  // Folder operations
  listFolders(): Promise<Folder[]>;
  createFolder(path: string): Promise<Folder>;
  deleteFolder(path: string): Promise<void>;

  // Search
  search(query: SearchQuery): Promise<Email[]>;

  // Push notifications
  subscribeToPush(handler: PushHandler): Promise<void>;
  unsubscribeFromPush(): Promise<void>;
}

interface SyncResult {
  emails: Email[];
  syncToken: string;
  hasMore: boolean;
}
```

**IMAP Adapter Implementation:**

```typescript
class IMAPAdapter implements EmailSyncAdapter {
  private client: ImapFlow;
  private lastModSeq: Map<string, number> = new Map();

  async connect() {
    this.client = new ImapFlow({
      host: this.config.host,
      port: this.config.port,
      secure: true,
      auth: {
        user: this.config.username,
        accessToken: this.config.oauthToken
      }
    });
    await this.client.connect();
  }

  async incrementalSync(folderPath: string, sinceToken: string): Promise<SyncResult> {
    const modseq = parseInt(sinceToken, 10);
    const lock = await this.client.getMailboxLock(folderPath);

    try {
      // Check for changes since last modseq
      const messages = [];
      for await (const msg of this.client.fetch(
        { modseq: { value: modseq, type: 'higher' } },
        {
          uid: true,
          flags: true,
          envelope: true,
          bodyStructure: true,
          modseq: true
        }
      )) {
        messages.push(this.convertIMAPToEmail(msg));
      }

      // Get current HIGHESTMODSEQ
      const status = await this.client.status(folderPath, {
        highestModseq: true
      });

      return {
        emails: messages,
        syncToken: status.highestModseq.toString(),
        hasMore: false
      };
    } finally {
      lock.release();
    }
  }

  async subscribeToPush(handler: PushHandler) {
    // Subscribe to each folder with IDLE
    for (const folder of await this.listFolders()) {
      const lock = await this.client.getMailboxLock(folder.path);

      this.client.on('exists', (data) => {
        if (data.path === folder.path) {
          handler({ type: 'new', folder: folder.path });
        }
      });

      this.client.on('flags', (data) => {
        handler({ type: 'update', folder: folder.path, uid: data.uid });
      });

      await this.client.idle();
      lock.release();
    }
  }

  private convertIMAPToEmail(imapMsg: any): Email {
    return {
      id: `${imapMsg.uid}`,
      threadId: this.generateThreadId(imapMsg),
      subject: imapMsg.envelope.subject || '(no subject)',
      from: imapMsg.envelope.from.map(this.convertIMAPAddress),
      to: imapMsg.envelope.to?.map(this.convertIMAPAddress) || [],
      date: imapMsg.envelope.date,
      body: { /* extract from bodyStructure */ },
      attachments: this.extractAttachments(imapMsg.bodyStructure),
      flags: {
        seen: imapMsg.flags.has('\\Seen'),
        flagged: imapMsg.flags.has('\\Flagged'),
        answered: imapMsg.flags.has('\\Answered'),
        draft: imapMsg.flags.has('\\Draft')
      },
      labels: [],
      folders: [imapMsg.path]
    };
  }
}
```

**Gmail API Adapter Implementation:**

```typescript
class GmailAPIAdapter implements EmailSyncAdapter {
  private gmail: gmail_v1.Gmail;
  private lastHistoryId: string;

  async connect() {
    this.gmail = google.gmail({
      version: 'v1',
      auth: this.oauth2Client
    });
  }

  async incrementalSync(folderPath: string, sinceToken: string): Promise<SyncResult> {
    const labelId = this.folderToLabelId(folderPath);

    // Use History API
    const history = await this.gmail.users.history.list({
      userId: 'me',
      startHistoryId: sinceToken,
      labelId: labelId,
      historyTypes: ['messageAdded', 'messageDeleted', 'labelAdded', 'labelRemoved']
    });

    const emails: Email[] = [];
    const messageIds = new Set<string>();

    // Collect unique message IDs
    history.data.history?.forEach(record => {
      record.messagesAdded?.forEach(m => messageIds.add(m.message.id));
      record.labelsAdded?.forEach(m => messageIds.add(m.message.id));
      record.labelsRemoved?.forEach(m => messageIds.add(m.message.id));
    });

    // Batch fetch full messages
    const messages = await this.batchGetMessages(Array.from(messageIds));

    return {
      emails: messages.map(this.convertGmailToEmail),
      syncToken: history.data.historyId,
      hasMore: false
    };
  }

  async subscribeToPush(handler: PushHandler) {
    // Setup Cloud Pub/Sub watch
    await this.gmail.users.watch({
      userId: 'me',
      requestBody: {
        topicName: this.config.pubsubTopic,
        labelIds: ['INBOX', 'UNREAD']
      }
    });

    // Renew watch every day
    this.watchRenewalInterval = setInterval(async () => {
      await this.gmail.users.watch({ /* ... */ });
    }, 24 * 60 * 60 * 1000);
  }

  private convertGmailToEmail(gmailMsg: gmail_v1.Schema$Message): Email {
    const headers = this.parseHeaders(gmailMsg.payload.headers);

    return {
      id: gmailMsg.id,
      threadId: gmailMsg.threadId,
      subject: headers.subject || '(no subject)',
      from: this.parseAddresses(headers.from),
      to: this.parseAddresses(headers.to),
      date: new Date(parseInt(gmailMsg.internalDate, 10)),
      body: this.extractBody(gmailMsg.payload),
      attachments: this.extractAttachments(gmailMsg.payload),
      flags: {
        seen: !gmailMsg.labelIds?.includes('UNREAD'),
        flagged: gmailMsg.labelIds?.includes('STARRED'),
        answered: false, // Gmail doesn't expose this
        draft: gmailMsg.labelIds?.includes('DRAFT')
      },
      labels: gmailMsg.labelIds || [],
      folders: [] // Gmail uses labels, not folders
    };
  }
}
```

**JMAP Adapter Implementation:**

```typescript
class JMAPAdapter implements EmailSyncAdapter {
  private client: JMAPClient;
  private accountId: string;
  private lastState: Map<string, string> = new Map();

  async connect() {
    this.client = new JMAPClient({
      sessionUrl: this.config.sessionUrl,
      accessToken: this.config.accessToken
    });
    await this.client.connect();
    this.accountId = this.client.defaultAccountId;
  }

  async incrementalSync(folderPath: string, sinceToken: string): Promise<SyncResult> {
    const mailboxId = await this.getMailboxId(folderPath);

    // Use Email/changes
    const response = await this.client.request({
      using: ['urn:ietf:params:jmap:mail'],
      methodCalls: [
        // Get changes
        [
          'Email/changes',
          {
            accountId: this.accountId,
            sinceState: sinceToken,
            maxChanges: 500
          },
          'c1'
        ],
        // Fetch created emails
        [
          'Email/get',
          {
            accountId: this.accountId,
            '#ids': {
              resultOf: 'c1',
              name: 'Email/changes',
              path: '/created'
            },
            properties: ['id', 'threadId', 'mailboxIds', 'from', 'to', 'subject',
                        'receivedAt', 'keywords', 'hasAttachment', 'bodyValues']
          },
          'g1'
        ],
        // Fetch updated emails (only changed properties)
        [
          'Email/get',
          {
            accountId: this.accountId,
            '#ids': {
              resultOf: 'c1',
              name: 'Email/changes',
              path: '/updated'
            },
            properties: ['id', 'mailboxIds', 'keywords']
          },
          'g2'
        ]
      ]
    });

    const changes = response.methodResponses[0][1];
    const createdEmails = response.methodResponses[1][1].list;
    const updatedEmails = response.methodResponses[2][1].list;

    return {
      emails: [
        ...createdEmails.map(this.convertJMAPToEmail),
        ...updatedEmails.map(this.convertJMAPToEmail)
      ],
      syncToken: changes.newState,
      hasMore: changes.hasMoreChanges
    };
  }

  async subscribeToPush(handler: PushHandler) {
    // Use JMAP WebSocket push
    const ws = new WebSocket(this.client.pushUrl);

    ws.onopen = () => {
      ws.send(JSON.stringify({
        '@type': 'PushEnable',
        dataTypes: ['Email', 'Mailbox']
      }));
    };

    ws.onmessage = async (event) => {
      const notification = JSON.parse(event.data);

      if (notification['@type'] === 'StateChange') {
        const changes = notification.changed[this.accountId];
        if (changes?.Email) {
          handler({
            type: 'update',
            accountId: this.accountId,
            state: changes.Email
          });
        }
      }
    };
  }

  private convertJMAPToEmail(jmapEmail: any): Email {
    return {
      id: jmapEmail.id,
      threadId: jmapEmail.threadId,
      subject: jmapEmail.subject || '(no subject)',
      from: jmapEmail.from || [],
      to: jmapEmail.to || [],
      cc: jmapEmail.cc,
      bcc: jmapEmail.bcc,
      date: new Date(jmapEmail.receivedAt),
      body: {
        text: jmapEmail.bodyValues?.['text']?.value,
        html: jmapEmail.bodyValues?.['html']?.value
      },
      attachments: jmapEmail.attachments || [],
      flags: {
        seen: jmapEmail.keywords?.$seen || false,
        flagged: jmapEmail.keywords?.$flagged || false,
        answered: jmapEmail.keywords?.$answered || false,
        draft: jmapEmail.keywords?.$draft || false
      },
      labels: [],
      folders: Object.keys(jmapEmail.mailboxIds || {})
    };
  }
}
```

### 6.2 Provider Support Matrix (2024-2025)

| Provider | IMAP | IMAP Extensions | Gmail API | JMAP | OAuth2 | Notes |
|----------|------|----------------|-----------|------|--------|-------|
| **Gmail** | Yes | CONDSTORE, IDLE | Yes | No | Required | Basic Auth deprecated 2022 |
| **Outlook/Office365** | Yes | CONDSTORE, QRESYNC, IDLE | No | No | Required | Basic Auth deprecated May 2022 |
| **FastMail** | Yes | CONDSTORE, QRESYNC, IDLE | No | Yes | Via JMAP | Recommended: JMAP |
| **iCloud** | Yes | CONDSTORE, QRESYNC, IDLE | No | No | App-specific | |
| **Yahoo Mail** | Yes | IDLE | No | No | App passwords | Limited CONDSTORE |
| **ProtonMail** | Via Bridge | IDLE | No | No | Via Bridge | Bridge required |
| **Zoho Mail** | Yes | IDLE | No | No | OAuth2 | Limited extensions |
| **AOL Mail** | Yes | IDLE | No | No | App passwords | |
| **Mail.ru** | Yes | Basic | No | No | Basic Auth | |
| **Custom/Self-hosted** | Yes | Varies | No | Possibly | Varies | Dovecot, Cyrus support JMAP |

**Summary:**
- **IMAP:** Universal support (use as baseline)
- **Gmail API:** Gmail only (but worth keeping for existing users)
- **JMAP:** FastMail production, growing adoption (Cyrus, James, Stalwart, Thunderbird iOS)
- **OAuth2:** Required for Gmail and Outlook, recommended for others

### 6.3 Unified Data Model

**Core Entities:**

```typescript
// Unified email message
interface Message {
  // Identity
  id: string;                    // Provider-specific ID
  threadId: string;              // Conversation ID

  // Metadata
  subject: string;
  from: Address[];
  to: Address[];
  cc?: Address[];
  bcc?: Address[];
  replyTo?: Address[];
  date: Date;
  receivedDate: Date;

  // Content
  bodyText?: string;
  bodyHtml?: string;
  snippet: string;               // Preview text

  // Attachments
  attachments: Attachment[];
  hasAttachments: boolean;

  // State
  flags: MessageFlags;
  labels: Label[];               // Gmail-style labels
  mailboxes: Mailbox[];          // Folder-style mailboxes

  // Sync metadata
  syncState: string;             // Provider-specific sync token
  modifiedAt: Date;

  // Provider info
  provider: ProviderType;
  providerData?: Record<string, any>; // Provider-specific fields
}

interface MessageFlags {
  seen: boolean;
  flagged: boolean;
  answered: boolean;
  draft: boolean;
  forwarded?: boolean;
  deleted?: boolean;
}

interface Mailbox {
  id: string;
  name: string;
  path: string;                  // Full path: "INBOX/Work"
  parentId?: string;
  role?: MailboxRole;            // inbox, sent, trash, etc.
  unreadCount: number;
  totalCount: number;
}

enum MailboxRole {
  Inbox = 'inbox',
  Sent = 'sent',
  Drafts = 'drafts',
  Trash = 'trash',
  Spam = 'spam',
  Archive = 'archive',
  All = 'all',
  Custom = 'custom'
}

interface Label {
  id: string;
  name: string;
  color?: string;
  type: 'system' | 'user';
}
```

**Mapping Strategy:**

| Concept | IMAP | Gmail API | JMAP | Unified Model |
|---------|------|-----------|------|---------------|
| Message ID | UID (per-folder) | Message ID | Email ID | `id: string` |
| Thread | THREAD extension | Thread ID | Thread ID | `threadId` |
| Folder | Mailbox | Label | Mailbox | `mailboxes[]` |
| Label | Flag/Keyword | Label | Keyword | `labels[]` |
| Seen | \\Seen flag | UNREAD label (inverse) | $seen keyword | `flags.seen` |
| Starred | \\Flagged | STARRED label | $flagged | `flags.flagged` |
| Draft | \\Draft flag + folder | DRAFT label | $draft keyword | `flags.draft` |

### 6.4 Migration Complexity Assessment

**Migration from Gmail API-Only to Multi-Provider:**

**Phase 1: IMAP Integration (4-6 weeks)**

**Complexity: Medium-High**

Tasks:
1. Implement IMAP adapter with CONDSTORE/QRESYNC support
2. Build unified data model and mapping layer
3. Implement sync service abstraction
4. Create provider detection and configuration UI
5. Handle OAuth2 for Outlook, app passwords for others
6. Implement connection pooling and state management
7. Test with Gmail IMAP, Outlook, FastMail, iCloud

**Challenges:**
- IMAP connection management (persistent vs reconnect)
- Folder hierarchy differences across providers
- Extension capability detection and fallbacks
- OAuth2 flow variations (Gmail vs Outlook)
- Rate limit handling (provider-specific)
- Sync token persistence and recovery

**Phase 2: Maintain Gmail API Path (1-2 weeks)**

**Complexity: Low**

Tasks:
1. Wrap existing Gmail API code in adapter pattern
2. Implement adapter interface for Gmail API
3. Preference for Gmail accounts to use API vs IMAP

**Phase 3: JMAP Support for FastMail (2-3 weeks)**

**Complexity: Low-Medium**

Tasks:
1. Implement JMAP adapter
2. FastMail-specific configuration
3. Test JMAP sync and push notifications

**Total Estimated Effort:** 7-11 weeks for full multi-provider support

---

## 7. Real-World Email Client Architectures

### 7.1 Superhuman

**Provider Support:** Gmail, Outlook (via Microsoft Graph API)

**Architecture:**
- **Backend-heavy:** Server-side email processing and caching
- **Gmail:** Uses Gmail API for sync and operations
- **Outlook:** Uses Microsoft Graph API (not IMAP)
- **Real-time sync:** WebSocket connection to Superhuman servers
- **Caching:** Aggressive server-side caching for instant search
- **Mobile:** Native iOS/Android with shared backend

**Protocol Strategy:**
- Provider-specific APIs (Gmail API, Graph API)
- No IMAP usage (to avoid protocol limitations)
- Unified backend API for all clients

**Learnings:**
- Provider APIs offer better performance than IMAP
- Backend caching critical for speed
- Limited provider support acceptable for premium tier

### 7.2 Spark Mail

**Provider Support:** Gmail, Outlook, iCloud, Yahoo, Exchange, any IMAP

**Architecture:**
- **Hybrid:** Some server-side processing, local sync
- **Gmail:** IMAP (not Gmail API)
- **Others:** IMAP with OAuth2 where possible
- **Push:** IMAP IDLE for real-time updates
- **Cross-platform:** iOS, Android, macOS, Windows (shared codebase via React Native for mobile)

**Protocol Strategy:**
- IMAP as universal baseline
- Provider-specific OAuth2 implementations
- Local SQLite database for messages
- Server-side for smart features (Smart Inbox, Send Later)

**Learnings:**
- IMAP sufficient for most providers
- Trade-off: Broader support vs feature richness
- Server-side intelligence layer adds value

### 7.3 Mailspring

**Provider Support:** All IMAP providers (Gmail, Outlook, Yahoo, etc.)

**Architecture:**
- **Local-first:** All processing on device
- **Sync engine:** Custom C++ sync engine (Mailcore2)
- **UI:** Electron + React + TypeScript
- **Database:** Local SQLite
- **Performance:** ~50% less RAM/CPU than predecessor (Nylas Mail)

**Protocol Strategy:**
- IMAP only (no provider-specific APIs)
- Local sync engine spawned by Electron app
- Open source UI (GPLv3), proprietary sync engine features

**Learnings:**
- C++ sync engine significantly outperforms JavaScript
- Local-first architecture for privacy and performance
- Plugin architecture for extensibility
- IMAP sufficient for broad provider support

**Key Metrics:**
- Handles 100k+ messages efficiently
- Near-zero CPU usage when idle
- RAM usage: ~100-200MB

### 7.4 Thunderbird

**Provider Support:** All IMAP, POP3, some JMAP

**Architecture:**
- **Desktop-first:** Native C++ application
- **Protocols:** IMAP, POP3, JMAP (in progress)
- **JMAP:** Rolling out first in iOS app, then desktop
- **Database:** Mork database (legacy), moving to SQLite
- **Extensions:** XUL/JavaScript add-on system

**Protocol Strategy:**
- Legacy IMAP/POP3 support
- Adding JMAP for modern providers
- Provider auto-configuration via Mozilla ISPDB

**Learnings:**
- Legacy protocol support critical for user base
- JMAP adoption for modern features
- Desktop email client still relevant (2024)

---

## 8. Provider-Specific Recommendations

### 8.1 Gmail

**Recommended Protocol:** Gmail API (primary), IMAP (fallback)

**Rationale:**
- Gmail API provides best performance for Gmail accounts
- History API superior to IMAP CONDSTORE for incremental sync
- Native thread and label support
- Better rate limits than IMAP bandwidth limits

**Implementation:**
```typescript
class GmailStrategy {
  async determineProtocol(): Promise<'api' | 'imap'> {
    // Prefer API if user grants OAuth scopes
    if (await this.hasGmailAPIAccess()) {
      return 'api';
    }
    // Fallback to IMAP with OAuth
    return 'imap';
  }

  async sync() {
    if (this.protocol === 'api') {
      return this.gmailAPIAdapter.incrementalSync();
    } else {
      return this.imapAdapter.incrementalSync();
    }
  }
}
```

**Trade-offs:**
- API: Better performance, Gmail-only, OAuth complexity
- IMAP: Universal, slightly slower, bandwidth limits

### 8.2 Outlook/Office 365

**Recommended Protocol:** IMAP with OAuth2

**Rationale:**
- Microsoft Graph API exists but complex for email
- IMAP with CONDSTORE/QRESYNC well-supported
- OAuth2 required (Basic Auth deprecated 2022)
- IMAP provides consistent experience

**Implementation:**
```typescript
class OutlookStrategy {
  async connect() {
    // OAuth2 via Microsoft Identity Platform
    const token = await this.getMicrosoftAccessToken([
      'https://outlook.office.com/IMAP.AccessAsUser.All',
      'offline_access'
    ]);

    return new IMAPAdapter({
      host: 'outlook.office365.com',
      port: 993,
      auth: {
        user: this.email,
        accessToken: token
      }
    });
  }
}
```

**Considerations:**
- Use Microsoft Graph API only if needed for specific features (calendar, contacts)
- IMAP sufficient for email-only needs

### 8.3 FastMail

**Recommended Protocol:** JMAP (primary), IMAP (fallback)

**Rationale:**
- FastMail developed JMAP - best implementation
- JMAP significantly more efficient
- Production-ready since 2018
- IMAP fully supported as fallback

**Implementation:**
```typescript
class FastMailStrategy {
  async connect() {
    // Try JMAP first
    try {
      return new JMAPAdapter({
        sessionUrl: 'https://api.fastmail.com/jmap/session',
        username: this.email,
        password: this.appPassword // Or OAuth2
      });
    } catch (error) {
      // Fallback to IMAP
      return new IMAPAdapter({
        host: 'imap.fastmail.com',
        port: 993,
        auth: { user: this.email, pass: this.appPassword }
      });
    }
  }
}
```

**Migration Path:**
- Start with IMAP for initial FastMail support
- Add JMAP within 6 months
- Migrate users to JMAP progressively

### 8.4 iCloud, Yahoo, Others

**Recommended Protocol:** IMAP with appropriate auth

**Rationale:**
- Universal support via IMAP
- No provider-specific APIs needed
- CONDSTORE support (varies)
- App-specific passwords for security

**Implementation:**
```typescript
class GenericIMAPStrategy {
  async connect() {
    const config = await this.autoDiscoverIMAP(this.email);

    return new IMAPAdapter({
      host: config.host,
      port: config.port || 993,
      secure: true,
      auth: {
        user: this.email,
        pass: this.password // Or app-specific password
      }
    });
  }

  async autoDiscoverIMAP(email: string): Promise<IMAPConfig> {
    const domain = email.split('@')[1];

    // Try common patterns
    const hosts = [
      `imap.${domain}`,
      `mail.${domain}`,
      domain
    ];

    for (const host of hosts) {
      if (await this.canConnect(host, 993)) {
        return { host, port: 993 };
      }
    }

    // Check Mozilla ISPDB
    return await this.lookupISPDB(domain);
  }
}
```

---

## 9. Recommendations for Claine v2

### 9.1 Immediate Actions (Phase 1: Months 1-3)

**1. Implement IMAP Support with Extensions**

```typescript
// Priority order
const requiredExtensions = [
  'CONDSTORE',  // Incremental sync - critical
  'IDLE',       // Push notifications - critical
  'QRESYNC',    // Fast resync - nice to have
  'THREAD'      // Threading - nice to have
];

// Implementation checklist
✓ IMAP adapter with ImapFlow library
✓ CONDSTORE-based incremental sync
✓ IDLE for push notifications (with reconnection)
✓ QRESYNC for supporting providers (not Gmail)
✓ Fallback to basic IMAP if extensions unavailable
✓ Connection pool management
✓ Exponential backoff retry logic
```

**2. Create Abstraction Layer**

```typescript
interface EmailProvider {
  type: ProviderType;
  adapter: EmailSyncAdapter;
  config: ProviderConfig;
}

enum ProviderType {
  Gmail = 'gmail',
  Outlook = 'outlook',
  FastMail = 'fastmail',
  Generic = 'generic'
}

class ProviderFactory {
  static create(email: string, config: AccountConfig): EmailProvider {
    const domain = email.split('@')[1];

    switch (domain) {
      case 'gmail.com':
      case 'googlemail.com':
        return {
          type: ProviderType.Gmail,
          adapter: new GmailAPIAdapter(config),
          config: GmailConfig
        };

      case 'outlook.com':
      case 'hotmail.com':
      case 'live.com':
        return {
          type: ProviderType.Outlook,
          adapter: new IMAPAdapter({
            host: 'outlook.office365.com',
            ...config
          }),
          config: OutlookConfig
        };

      case 'fastmail.com':
      case 'fastmail.fm':
        return {
          type: ProviderType.FastMail,
          adapter: new IMAPAdapter({
            host: 'imap.fastmail.com',
            ...config
          }),
          config: FastMailConfig
        };

      default:
        // Auto-discover or use generic IMAP
        return {
          type: ProviderType.Generic,
          adapter: new IMAPAdapter(
            await autoDiscoverIMAP(email)
          ),
          config: GenericConfig
        };
    }
  }
}
```

**3. Maintain Gmail API for Existing Users**

```typescript
class GmailProvider implements EmailProvider {
  adapter: GmailAPIAdapter | IMAPAdapter;

  async initialize() {
    // Try Gmail API first
    if (await this.hasGmailAPIScopes()) {
      this.adapter = new GmailAPIAdapter(this.config);
    } else {
      // Fallback to IMAP with OAuth
      this.adapter = new IMAPAdapter({
        host: 'imap.gmail.com',
        auth: { user: this.email, accessToken: this.oauthToken }
      });
    }
  }
}
```

**4. Implement Provider Detection UI**

```typescript
// Account setup flow
interface AccountSetupFlow {
  step1_emailInput: string;
  step2_providerDetection: ProviderType;
  step3_authMethod: 'oauth' | 'password' | 'app-password';
  step4_connection: ConnectionResult;
  step5_initialSync: SyncResult;
}

// Auto-configuration database
const providerConfigs = {
  'gmail.com': {
    name: 'Gmail',
    imap: { host: 'imap.gmail.com', port: 993 },
    smtp: { host: 'smtp.gmail.com', port: 587 },
    oauth: { provider: 'google', scopes: ['...'] },
    preferredProtocol: 'gmail-api'
  },
  'outlook.com': {
    name: 'Outlook',
    imap: { host: 'outlook.office365.com', port: 993 },
    smtp: { host: 'smtp.office365.com', port: 587 },
    oauth: { provider: 'microsoft', scopes: ['...'] },
    preferredProtocol: 'imap'
  },
  // ... more providers
};
```

### 9.2 Medium-Term Actions (Phase 2: Months 4-6)

**1. Add JMAP Support for FastMail**

```typescript
class FastMailJMAPProvider implements EmailProvider {
  adapter: JMAPAdapter;

  async initialize() {
    this.adapter = new JMAPAdapter({
      sessionUrl: 'https://api.fastmail.com/jmap/session',
      username: this.email,
      password: this.appPassword
    });

    await this.adapter.connect();
  }

  async migrateFromIMAP(imapAdapter: IMAPAdapter) {
    // Strategy: Sync JMAP, compare with IMAP state, switch
    const jmapState = await this.adapter.initialSync('INBOX');
    const imapState = await imapAdapter.getSyncToken();

    // Verify consistency
    if (this.statesMatch(jmapState, imapState)) {
      // Switch to JMAP
      await this.savePreference('protocol', 'jmap');
      await imapAdapter.disconnect();
    }
  }
}
```

**2. Optimize Sync Performance**

```typescript
class SyncOptimizer {
  async syncAllAccounts(accounts: EmailAccount[]) {
    // Parallel sync with concurrency limit
    const results = await pMap(
      accounts,
      async (account) => {
        return account.provider.adapter.incrementalSync(
          'INBOX',
          account.lastSyncToken
        );
      },
      { concurrency: 5 } // Don't overwhelm connections
    );

    return results;
  }

  async intelligentPolling(account: EmailAccount) {
    // Adaptive polling based on user activity
    const baseInterval = 5 * 60 * 1000; // 5 minutes
    const activeInterval = 30 * 1000; // 30 seconds

    if (this.isUserActive()) {
      return activeInterval;
    } else {
      return baseInterval;
    }
  }
}
```

**3. Implement Robust Error Handling**

```typescript
class SyncErrorHandler {
  async handleSyncError(error: Error, account: EmailAccount) {
    if (error instanceof IMAPError) {
      switch (error.code) {
        case 'AUTHENTICATIONFAILED':
          // Token expired - refresh
          await this.refreshOAuthToken(account);
          return 'retry';

        case 'CONNECTIONFAILED':
          // Network issue - exponential backoff
          await this.scheduleRetry(account, exponentialBackoff);
          return 'backoff';

        case 'EXPUNGEISSUED':
          // Message deleted - skip
          return 'skip';

        default:
          // Unknown error - notify user
          await this.notifyUser(account, error);
          return 'pause';
      }
    }

    if (error instanceof GmailAPIError) {
      if (error.code === 404) {
        // History expired - full resync
        await this.fullResync(account);
        return 'resync';
      }
    }

    throw error;
  }
}
```

### 9.3 Long-Term Strategy (Phase 3: Months 7-12)

**1. Monitor JMAP Adoption**

- Track provider adoption throughout 2025
- Evaluate Thunderbird JMAP rollout success
- Consider JMAP for Outlook if Microsoft adds support
- Engage with JMAP community

**2. Expand Provider Support**

```typescript
const futureProviders = [
  'ProtonMail', // Via Bridge or native API
  'Zoho Mail', // IMAP + OAuth2
  'Tutanota', // Native API only
  'Hey.com', // Potential JMAP or API
];
```

**3. Protocol Performance Monitoring**

```typescript
class ProtocolMetrics {
  async trackSyncPerformance(
    provider: ProviderType,
    protocol: 'imap' | 'gmail-api' | 'jmap'
  ) {
    const metrics = {
      syncDuration: 0,
      bytesTransferred: 0,
      requestCount: 0,
      errorRate: 0,
      pushLatency: 0
    };

    // Send to analytics
    await this.reportMetrics(provider, protocol, metrics);
  }

  async compareProtocols() {
    // A/B test IMAP vs Gmail API for Gmail accounts
    // Measure and optimize
  }
}
```

### 9.4 Architectural Recommendations

**Storage Layer:**

```typescript
// Use IndexedDB for local email storage
interface LocalEmailStore {
  // Indexed by provider + account
  messages: IDBObjectStore; // Key: messageId
  threads: IDBObjectStore; // Key: threadId
  mailboxes: IDBObjectStore; // Key: mailboxId
  syncState: IDBObjectStore; // Key: accountId

  // Indexes for fast queries
  indexes: {
    'by-mailbox': IDBIndex;
    'by-date': IDBIndex;
    'by-thread': IDBIndex;
    'by-flags': IDBIndex;
  };
}
```

**Sync Service:**

```typescript
class UnifiedSyncService {
  private providers: Map<string, EmailProvider> = new Map();

  async addAccount(email: string, config: AccountConfig) {
    const provider = ProviderFactory.create(email, config);
    await provider.adapter.connect();
    this.providers.set(email, provider);

    // Initial sync
    await this.initialSync(email);
  }

  async syncAll() {
    // Sync all accounts in parallel
    await Promise.all(
      Array.from(this.providers.entries()).map(
        ([email, provider]) => this.syncAccount(email, provider)
      )
    );
  }

  private async syncAccount(email: string, provider: EmailProvider) {
    const lastToken = await this.getLastSyncToken(email);

    try {
      const result = await provider.adapter.incrementalSync(
        'INBOX',
        lastToken
      );

      // Store messages locally
      await this.storeMessages(email, result.emails);

      // Update sync token
      await this.saveSyncToken(email, result.syncToken);

      // Emit updates to UI
      this.emit('sync-complete', { email, count: result.emails.length });

    } catch (error) {
      await this.errorHandler.handleSyncError(error, { email, provider });
    }
  }
}
```

**React 19 Integration:**

```typescript
// Use React 19 features for email client
function EmailClient() {
  // Server Components for initial email list (SSR-friendly)
  return (
    <Suspense fallback={<EmailListSkeleton />}>
      <EmailList />
    </Suspense>
  );
}

function EmailList() {
  // Use() hook for async data fetching
  const emails = use(syncService.getEmails('INBOX'));

  return (
    <VirtualizedList
      items={emails}
      renderItem={(email) => <EmailListItem email={email} />}
      onEndReached={() => syncService.fetchMore()}
    />
  );
}

// Optimistic updates for flag changes
function useEmailActions(emailId: string) {
  const [, startTransition] = useTransition();

  const markAsRead = () => {
    startTransition(async () => {
      // Optimistic update
      updateLocalEmail(emailId, { flags: { seen: true } });

      // Sync to server
      await syncService.updateEmail(emailId, { flags: { seen: true } });
    });
  };

  return { markAsRead };
}
```

---

## 10. Conclusion

### Decision Matrix

| Factor | IMAP | Gmail API | JMAP |
|--------|------|-----------|------|
| **Provider Coverage** | ✓✓✓ Universal | ✗ Gmail only | ✓ Growing (limited 2024) |
| **Performance** | ✓ Good with extensions | ✓✓ Excellent for Gmail | ✓✓✓ Best overall |
| **Sync Efficiency** | ✓ Moderate (CONDSTORE) | ✓✓ Good (History API) | ✓✓✓ Excellent (state-based) |
| **Developer Experience** | ✗ Complex | ✓ Moderate | ✓✓ Modern/Clean |
| **Offline Support** | ✓ Client-dependent | ✓ Client-dependent | ✓✓✓ Protocol-level |
| **Future-Proofing** | ✓ Stable but dated | ✓ Gmail-locked | ✓✓✓ Modern standard |
| **Library Ecosystem** | ✓✓✓ Mature | ✓✓ Good | ✗ Limited (2024) |
| **Implementation Effort** | ✓✓ Medium | ✓✓ Medium | ✓✓✓ Easy (API design) |

### Final Recommendation

**For Claine v2, implement a layered approach:**

**Tier 1 (Immediate): IMAP Foundation**
- Implement robust IMAP adapter with CONDSTORE/QRESYNC
- Target all major providers: Gmail, Outlook, FastMail, iCloud, Yahoo
- This provides 99% provider coverage

**Tier 2 (Maintain): Gmail API**
- Keep Gmail API path for existing users
- Offer as "enhanced Gmail mode" for better performance
- Fallback to IMAP if user doesn't grant API scopes

**Tier 3 (Future): JMAP for Modern Providers**
- Implement JMAP for FastMail (6-month timeline)
- Monitor JMAP adoption across providers in 2025
- Migrate users to JMAP as providers add support

**Architecture Pattern:**
```
┌─────────────────────────────────────────┐
│         Claine v2 UI (React 19)         │
├─────────────────────────────────────────┤
│      Unified Email Service Layer        │
│  (Protocol-agnostic API for UI)         │
├─────────────────────────────────────────┤
│           Adapter Layer                 │
│  ┌──────────┬──────────┬──────────┐    │
│  │  IMAP    │  Gmail   │   JMAP   │    │
│  │ Adapter  │ Adapter  │  Adapter │    │
│  └──────────┴──────────┴──────────┘    │
├─────────────────────────────────────────┤
│         Local Storage (IndexedDB)       │
└─────────────────────────────────────────┘
```

This approach provides:
- ✓ Maximum provider coverage via IMAP
- ✓ Best performance for Gmail via Gmail API
- ✓ Future-proof architecture for JMAP
- ✓ Clean abstraction for protocol switching
- ✓ Pragmatic migration path from v1

**Success Metrics:**
- Provider support: 95%+ of users' email accounts
- Sync performance: <2 seconds for incremental sync
- Offline support: Full offline read/compose with sync queue
- Error rate: <1% sync failures
- User satisfaction: Seamless multi-account experience

---

## References

### Specifications
- [RFC 3501 - IMAP4rev1](https://www.rfc-editor.org/rfc/rfc3501.html)
- [RFC 7162 - IMAP CONDSTORE and QRESYNC](https://www.rfc-editor.org/rfc/rfc7162.html)
- [RFC 2177 - IMAP IDLE](https://www.rfc-editor.org/rfc/rfc2177.html)
- [RFC 8620 - JMAP Core](https://www.rfc-editor.org/rfc/rfc8620.html)
- [RFC 8621 - JMAP Mail](https://www.rfc-editor.org/rfc/rfc8621.html)

### API Documentation
- [Gmail API Documentation](https://developers.google.com/gmail/api)
- [JMAP Specification](https://jmap.io/)
- [Microsoft Graph API - Mail](https://learn.microsoft.com/en-us/graph/api/resources/mail-api-overview)

### Libraries
- [ImapFlow (Node.js)](https://github.com/postalsys/imapflow)
- [jmap-client (JavaScript)](https://github.com/linagora/jmap-client)
- [MailKit (C#)](https://github.com/jstedfast/MailKit)

### Articles
- [JMAP: A modern, open email protocol (IETF)](https://www.ietf.org/blog/jmap/)
- [Why JMAP is Faster](https://mailtemi.com/blog/why-jmap-is-faster/)
- [Gmail API Performance Tips](https://developers.google.com/gmail/api/guides/performance)

---

**Document End** | Total Word Count: ~12,000 | Token Estimate: ~24,000