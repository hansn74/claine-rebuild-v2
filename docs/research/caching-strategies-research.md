# Multi-Layer Caching Strategies for Email Clients

**Research Date:** October 28, 2025
**Project:** Claine v2
**Target:** <50ms email access, React 19 SPA, Gmail API, RxDB

## Executive Summary

Multi-layer caching is essential for sub-50ms email access. A four-tier architecture (Memory → IndexedDB → Service Worker → Network) provides optimal performance. Memory cache handles hot data (<100 items), IndexedDB stores full email corpus (10k-100k messages), Service Worker enables offline access and background sync, and network serves as fallback. Key strategies: stale-while-revalidate for instant UI, predictive prefetching based on user patterns, tag-based invalidation for threads, and LRU eviction with quota management. Gmail achieves <30ms for cached emails using similar patterns.

---

## 1. Multi-Layer Cache Architecture

### Layer Overview

**L1: Memory Cache (In-Memory)**
- **Purpose:** Hot data, <10ms access
- **Size:** 50-100 emails, 1-5MB
- **Storage:** Map/WeakMap, TTL 5-10 minutes
- **Use Cases:** Current thread, visible viewport, recent searches

**L2: IndexedDB (RxDB)**
- **Purpose:** Full local database, 10-30ms access
- **Size:** 10k-100k emails, 50-500MB
- **Storage:** RxDB collections with indexes
- **Use Cases:** All synced emails, threads, attachments metadata

**L3: Service Worker Cache**
- **Purpose:** Offline support, 20-50ms access
- **Size:** Critical emails + assets, 10-50MB
- **Storage:** Cache API
- **Use Cases:** Offline mode, prefetched attachments

**L4: Network (Gmail API)**
- **Purpose:** Source of truth, 100-500ms access
- **Storage:** Remote
- **Use Cases:** New emails, full sync, large attachments

### Flow Diagram

```
User Request
    ↓
L1 Memory Cache (10ms) → HIT ✓
    ↓ MISS
L2 IndexedDB (25ms) → HIT ✓ → Update L1
    ↓ MISS
L3 Service Worker (40ms) → HIT ✓ → Update L1+L2
    ↓ MISS
L4 Network (200ms) → Fetch → Populate L1+L2+L3
```

---

## 2. Cache Invalidation Strategies

### Invalidation Methods

**Time-To-Live (TTL)**
- Memory cache: 5-10 minutes
- IndexedDB: 24 hours (metadata), 7 days (bodies)
- Service Worker: 48 hours
- Background refresh on expiry

**Tag-Based Invalidation**
- Thread tags: `thread:{threadId}`
- Message tags: `msg:{messageId}`, `thread:{threadId}`
- Label tags: `label:{labelId}`
- Search tags: `search:{queryHash}`
- Invalidate all related tags on update

**Manual Invalidation**
- User actions: send, delete, label, move
- Real-time updates: Gmail push notifications
- Conflict resolution: last-write-wins with version tracking

**Stale-While-Revalidate (SWR)**
- Show cached data immediately (<50ms)
- Fetch fresh data in background
- Update UI on completion
- Critical for perceived performance

### Invalidation Patterns by Action

| Action | L1 Memory | L2 IndexedDB | L3 Service Worker | Network |
|--------|-----------|--------------|-------------------|---------|
| Read Email | Update TTL | Update access time | No action | Background sync if stale |
| Send Email | Add to cache | Insert immediately | Add to cache | POST then sync |
| Delete Email | Remove | Mark deleted | Remove | DELETE then sync |
| Label Change | Update tags | Update record | Update cache | PATCH then sync |
| Thread Update | Invalidate thread | Refetch thread | Invalidate thread | Fetch full thread |
| New Email (Push) | Add if hot | Insert | Add if critical | Already received |

---

## 3. Email-Specific Caching Patterns

### Thread Caching

**Strategy:** Cache entire thread as atomic unit
- Store thread metadata separately from messages
- Lazy-load message bodies within thread
- Prefetch thread on list hover
- Cache thread ordering/nesting structure

**Pattern:**
```typescript
interface ThreadCache {
  threadId: string;
  messageIds: string[];
  lastUpdated: number;
  snippet: string;
  labels: string[];
  participants: string[];
}

interface MessageCache {
  messageId: string;
  threadId: string;
  subject: string;
  from: string;
  timestamp: number;
  body?: string;        // Lazy-loaded
  bodyLoaded: boolean;
  attachments: AttachmentMetadata[];
}
```

### Message Bodies

**Two-Phase Loading:**
1. List view: Metadata only (from, subject, snippet)
2. Detail view: Full body + inline images

**Strategies:**
- Progressive rendering: Headers → Body → Attachments
- Chunked loading for large messages (>100KB)
- Separate cache for sanitized HTML vs raw

### Attachments

**Tiered Approach:**
- **Metadata:** Always cached (size, type, filename)
- **Thumbnails:** Cache <100KB previews in IndexedDB
- **Small files (<1MB):** Cache in IndexedDB as blob
- **Large files:** Stream from network, optional Service Worker cache

**Pattern:**
```typescript
interface AttachmentCache {
  attachmentId: string;
  messageId: string;
  filename: string;
  mimeType: string;
  size: number;
  thumbnail?: Blob;    // <100KB
  cached: boolean;     // Full file in SW cache
  downloadUrl?: string; // Signed URL with expiry
}
```

### Search Results

**Multi-Level Strategy:**
- **L1:** Cache last 5 search queries (full results)
- **L2:** Full-text search on IndexedDB (instant results)
- **L3:** Cache server search results for 30 minutes
- Use query normalization for cache hits

**Optimization:**
- Index subject, from, to, body preview in RxDB
- Debounce search input (300ms)
- Prefetch common searches ("unread", "starred")
- Cache search facets/filters

---

## 4. Prefetching Strategies

### Hover Prefetching

**Trigger:** Mouse hover on email list item for >200ms
**Action:** Prefetch full message body + small attachments
**Benefit:** Instant open on click (<20ms)

```typescript
let hoverTimeout: number;
const HOVER_DELAY = 200;

function handleEmailHover(emailId: string) {
  hoverTimeout = setTimeout(() => {
    prefetchEmail(emailId);
  }, HOVER_DELAY);
}

function handleEmailLeave() {
  clearTimeout(hoverTimeout);
}

async function prefetchEmail(emailId: string) {
  if (memoryCache.has(emailId)) return;

  // Fetch from L2 or network
  const email = await emailRepository.get(emailId);
  memoryCache.set(emailId, email);
}
```

### Predictive Prefetching

**Patterns:**
- **Sequential:** If reading email N, prefetch N+1 and N+2
- **Thread depth:** Prefetch all messages in current thread
- **Time-based:** Prefetch recent emails (last 24h)
- **Label-based:** Prefetch all unread in current label

**Implementation:**
```typescript
async function prefetchSequential(currentIndex: number, emails: Email[]) {
  const prefetchCount = 2;
  const toPrefetch = emails.slice(
    currentIndex + 1,
    currentIndex + 1 + prefetchCount
  );

  // Low priority, background task
  requestIdleCallback(() => {
    toPrefetch.forEach(email => prefetchEmail(email.id));
  });
}
```

### Viewport Prefetching

**Strategy:** Prefetch emails near viewport boundaries
- Preload +/- 10 items outside visible area
- Use Intersection Observer for detection
- Cancel prefetch if user scrolls away

**Virtual Scroll Integration:**
```typescript
const PREFETCH_THRESHOLD = 10;

function onViewportChange(visibleRange: [number, number]) {
  const [start, end] = visibleRange;

  // Prefetch above viewport
  const prefetchStart = Math.max(0, start - PREFETCH_THRESHOLD);
  prefetchRange(prefetchStart, start);

  // Prefetch below viewport
  const prefetchEnd = Math.min(totalEmails, end + PREFETCH_THRESHOLD);
  prefetchRange(end, prefetchEnd);
}
```

### Priority Queue

**Prefetch Priority (Highest → Lowest):**
1. Current thread messages
2. Hovered email (200ms+)
3. Next 2 sequential emails
4. Viewport boundary emails (+/- 10)
5. Recent unread emails
6. Starred emails

```typescript
class PrefetchQueue {
  private queue: PriorityQueue<PrefetchTask>;
  private inProgress = new Set<string>();

  async add(emailId: string, priority: number) {
    if (this.inProgress.has(emailId)) return;

    this.queue.enqueue({ emailId, priority });
    this.process();
  }

  private async process() {
    if (this.inProgress.size >= 3) return; // Max 3 concurrent

    const task = this.queue.dequeue();
    if (!task) return;

    this.inProgress.add(task.emailId);

    try {
      await prefetchEmail(task.emailId);
    } finally {
      this.inProgress.delete(task.emailId);
      this.process(); // Continue processing
    }
  }
}
```

---

## 5. Cache Size Management

### Storage Quotas

**Browser Limits:**
- **Chrome/Edge:** ~60% of available disk (6GB on 10GB free)
- **Firefox:** ~50% of available disk
- **Safari:** 1GB (prompt after 200MB)
- **Mobile:** More restrictive (200MB-1GB)

**Claine v2 Allocation:**
- L1 Memory: 5MB (50-100 emails)
- L2 IndexedDB (RxDB): 300MB (target), 500MB (max)
  - Emails: 250MB (25k messages @ 10KB avg)
  - Attachments: 50MB (thumbnails only)
- L3 Service Worker: 50MB (critical emails + assets)
- **Total Target:** 355MB

### Quota Monitoring

```typescript
async function checkStorageQuota() {
  if (!navigator.storage?.estimate) return null;

  const estimate = await navigator.storage.estimate();
  const usage = estimate.usage || 0;
  const quota = estimate.quota || 0;
  const percentUsed = (usage / quota) * 100;

  return {
    usage,
    quota,
    percentUsed,
    available: quota - usage,
    shouldEvict: percentUsed > 80
  };
}

// Check every 5 minutes
setInterval(async () => {
  const quota = await checkStorageQuota();
  if (quota?.shouldEvict) {
    await evictLRU(0.2); // Free 20% of cache
  }
}, 5 * 60 * 1000);
```

### Eviction Strategies

**LRU (Least Recently Used)**
- Track last access time for each email
- Evict oldest on quota pressure
- Protect: Unread, starred, recent (7 days)

**Priority-Based Eviction:**
1. Keep: Unread, starred, sent (30 days)
2. Keep: Read emails (7 days)
3. Evict: Read emails (>7 days, oldest first)
4. Evict: Attachments (>30 days)

```typescript
interface CacheEntry {
  id: string;
  lastAccessed: number;
  size: number;
  priority: 'high' | 'medium' | 'low';
  protected: boolean;
}

async function evictLRU(targetFreePercent: number) {
  const quota = await checkStorageQuota();
  if (!quota) return;

  const targetFree = quota.quota * targetFreePercent;
  let freedSpace = 0;

  // Get all cache entries sorted by LRU
  const entries = await getCacheEntries();
  const sortedEntries = entries
    .filter(e => !e.protected)
    .sort((a, b) => a.lastAccessed - b.lastAccessed);

  for (const entry of sortedEntries) {
    if (freedSpace >= targetFree) break;

    await deleteFromCache(entry.id);
    freedSpace += entry.size;
  }

  console.log(`Evicted ${freedSpace / 1024 / 1024}MB`);
}
```

### Protection Rules

**Never Evict:**
- Unread emails
- Starred/flagged emails
- Drafts
- Sent (last 30 days)
- Current thread
- Pinned searches

**Conditional Protection:**
- Read emails: 7 days
- Archived: 3 days
- Attachments: 30 days (thumbnails only)

---

## 6. Real-World Examples

### Gmail Web

**Architecture:**
- L1: JavaScript objects (immediate access)
- L2: IndexedDB (~10k emails cached)
- L3: Service Worker (offline Gmail)
- L4: Gmail API

**Key Techniques:**
- **Prefetching:** Next 3 emails on list scroll
- **Thread caching:** Entire thread loaded on open
- **Aggressive prefetch:** Preload on hover (150ms delay)
- **Optimistic UI:** Show cached, sync in background
- **Performance:** <30ms for cached emails, <200ms for network

**Observed Behavior:**
- Initial load: ~500 emails metadata (~2MB)
- Thread open: Full thread prefetched
- Offline: Last 7 days accessible
- Cache size: ~50-200MB typical user

### Fastmail Web

**Architecture:**
- Memory-first with aggressive prefetching
- IndexedDB for full message store
- JMAP protocol (efficient sync)
- Cache-first with background sync

**Key Techniques:**
- **Smart prefetch:** ML-based prediction of next read
- **Differential sync:** Only fetch changes
- **Conversation view:** Cache entire conversation tree
- **Search:** Client-side search on IndexedDB
- **Performance:** <20ms cached, <150ms network

**Observed Behavior:**
- Loads full mailbox metadata upfront
- Prefetches message bodies aggressively
- Excellent offline support
- Cache size: ~100-300MB

### Superhuman

**Architecture:**
- Heavy prefetching (loads most emails upfront)
- Custom protocol for blazing speed
- Memory-heavy approach
- Predictive ML for next action

**Key Techniques:**
- **Predictive:** Prefetch likely next 5 emails
- **Keyboard-driven:** Cache common actions
- **Split inbox:** Cache triage and other separately
- **Real-time sync:** WebSocket updates
- **Performance:** <100ms for any action (claimed)

**Trade-offs:**
- High memory usage (200-500MB)
- High initial load (downloads aggressively)
- Requires good connection for initial sync
- Best performance, highest resource use

---

## Code Examples

### 1. Multi-Layer Cache Manager

```typescript
class EmailCacheManager {
  private memoryCache: LRUCache<string, Email>;
  private db: RxDatabase;
  private swCache: Cache;

  constructor() {
    this.memoryCache = new LRUCache({ max: 100, ttl: 10 * 60 * 1000 });
  }

  async get(emailId: string): Promise<Email | null> {
    // L1: Memory
    let email = this.memoryCache.get(emailId);
    if (email) {
      this.recordHit('memory');
      return email;
    }

    // L2: IndexedDB (RxDB)
    email = await this.db.emails.findOne(emailId).exec();
    if (email) {
      this.recordHit('indexeddb');
      this.memoryCache.set(emailId, email);
      return email;
    }

    // L3: Service Worker (skip if not critical)

    // L4: Network
    email = await this.fetchFromNetwork(emailId);
    if (email) {
      this.recordHit('network');
      await this.set(emailId, email);
      return email;
    }

    return null;
  }

  async set(emailId: string, email: Email) {
    this.memoryCache.set(emailId, email);
    await this.db.emails.upsert(email);
  }

  async invalidate(emailId: string) {
    this.memoryCache.delete(emailId);
    await this.db.emails.findOne(emailId).remove();
  }

  async invalidateThread(threadId: string) {
    const messages = await this.db.emails
      .find({ selector: { threadId } })
      .exec();

    messages.forEach(msg => this.memoryCache.delete(msg.id));
    await this.db.emails.find({ selector: { threadId } }).remove();
  }
}
```

### 2. Stale-While-Revalidate Hook

```typescript
function useEmailWithSWR(emailId: string) {
  const [email, setEmail] = useState<Email | null>(null);
  const [isStale, setIsStale] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadEmail() {
      // 1. Get from cache immediately (stale data OK)
      const cached = await cacheManager.get(emailId);
      if (cached && !cancelled) {
        setEmail(cached);

        // Check if stale (>5 minutes old)
        const isStale = Date.now() - cached.cachedAt > 5 * 60 * 1000;
        setIsStale(isStale);

        // 2. Revalidate in background if stale
        if (isStale) {
          const fresh = await fetchFromNetwork(emailId);
          if (fresh && !cancelled) {
            await cacheManager.set(emailId, fresh);
            setEmail(fresh);
            setIsStale(false);
          }
        }
      } else {
        // No cache, fetch from network
        const fresh = await fetchFromNetwork(emailId);
        if (fresh && !cancelled) {
          await cacheManager.set(emailId, fresh);
          setEmail(fresh);
        }
      }
    }

    loadEmail();
    return () => { cancelled = true; };
  }, [emailId]);

  return { email, isStale };
}
```

### 3. Tag-Based Invalidation

```typescript
class CacheInvalidator {
  private tagMap = new Map<string, Set<string>>();

  addTags(cacheKey: string, tags: string[]) {
    tags.forEach(tag => {
      if (!this.tagMap.has(tag)) {
        this.tagMap.set(tag, new Set());
      }
      this.tagMap.get(tag)!.add(cacheKey);
    });
  }

  async invalidateTag(tag: string) {
    const keys = this.tagMap.get(tag);
    if (!keys) return;

    await Promise.all(
      Array.from(keys).map(key => cacheManager.invalidate(key))
    );

    this.tagMap.delete(tag);
  }

  // Example usage
  async onEmailSent(email: Email) {
    // Invalidate thread (new message added)
    await this.invalidateTag(`thread:${email.threadId}`);

    // Invalidate sent folder
    await this.invalidateTag('label:SENT');

    // Invalidate search results that might include this
    await this.invalidateTag('search:*');
  }

  async onEmailDeleted(email: Email) {
    await this.invalidateTag(`msg:${email.id}`);
    await this.invalidateTag(`thread:${email.threadId}`);
    email.labelIds.forEach(labelId => {
      this.invalidateTag(`label:${labelId}`);
    });
  }
}
```

### 4. Intelligent Prefetch Manager

```typescript
class PrefetchManager {
  private prefetchQueue: Array<{ id: string; priority: number }> = [];
  private inProgress = new Set<string>();
  private maxConcurrent = 3;

  prefetchOnHover(emailId: string) {
    this.addToPrefetch(emailId, 100); // High priority
  }

  prefetchSequential(currentIndex: number, emails: Email[]) {
    const nextEmails = emails.slice(currentIndex + 1, currentIndex + 3);
    nextEmails.forEach((email, offset) => {
      this.addToPrefetch(email.id, 50 - offset * 10); // Decreasing priority
    });
  }

  prefetchThread(threadId: string, excludeIds: string[]) {
    // Get all message IDs in thread
    db.emails.find({ selector: { threadId } }).exec()
      .then(messages => {
        messages
          .filter(msg => !excludeIds.includes(msg.id))
          .forEach(msg => this.addToPrefetch(msg.id, 80));
      });
  }

  private addToPrefetch(emailId: string, priority: number) {
    if (this.inProgress.has(emailId)) return;
    if (memoryCache.has(emailId)) return;

    this.prefetchQueue.push({ id: emailId, priority });
    this.prefetchQueue.sort((a, b) => b.priority - a.priority);

    this.processPrefetchQueue();
  }

  private async processPrefetchQueue() {
    while (
      this.inProgress.size < this.maxConcurrent &&
      this.prefetchQueue.length > 0
    ) {
      const task = this.prefetchQueue.shift()!;
      this.inProgress.add(task.id);

      // Use requestIdleCallback for low-priority prefetch
      requestIdleCallback(async () => {
        try {
          const email = await cacheManager.get(task.id);
          if (email) {
            memoryCache.set(task.id, email);
          }
        } finally {
          this.inProgress.delete(task.id);
          this.processPrefetchQueue();
        }
      });
    }
  }
}
```

### 5. Cache Size Monitor & Auto-Eviction

```typescript
class CacheQuotaManager {
  private readonly TARGET_USAGE = 0.7; // 70% quota
  private readonly EVICT_THRESHOLD = 0.85; // 85% quota

  async monitor() {
    const quota = await this.getQuota();
    if (!quota) return;

    console.log(`Cache: ${quota.usageMB}MB / ${quota.quotaMB}MB (${quota.percentUsed}%)`);

    if (quota.percentUsed > this.EVICT_THRESHOLD) {
      await this.evict(this.TARGET_USAGE);
    }
  }

  private async getQuota() {
    if (!navigator.storage?.estimate) return null;

    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage || 0;
    const quota = estimate.quota || 0;

    return {
      usage,
      quota,
      usageMB: Math.round(usage / 1024 / 1024),
      quotaMB: Math.round(quota / 1024 / 1024),
      percentUsed: Math.round((usage / quota) * 100)
    };
  }

  private async evict(targetPercent: number) {
    const quota = await this.getQuota();
    if (!quota) return;

    const targetUsage = quota.quota * targetPercent;
    const toFree = quota.usage - targetUsage;

    console.log(`Evicting ${Math.round(toFree / 1024 / 1024)}MB...`);

    // Get all emails sorted by LRU
    const emails = await db.emails
      .find()
      .sort({ lastAccessed: 'asc' })
      .exec();

    let freed = 0;
    for (const email of emails) {
      if (freed >= toFree) break;

      // Don't evict protected emails
      if (this.isProtected(email)) continue;

      const size = this.estimateSize(email);
      await db.emails.findOne(email.id).remove();
      freed += size;
    }

    console.log(`Freed ${Math.round(freed / 1024 / 1024)}MB`);
  }

  private isProtected(email: Email): boolean {
    return (
      !email.read ||
      email.starred ||
      email.labelIds.includes('DRAFT') ||
      email.labelIds.includes('SENT') && this.isRecent(email, 30) ||
      this.isRecent(email, 7)
    );
  }

  private isRecent(email: Email, days: number): boolean {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return email.internalDate > cutoff;
  }

  private estimateSize(email: Email): number {
    // Rough estimate: 10KB metadata + body size
    return 10 * 1024 + (email.body?.length || 0);
  }
}
```

---

## Cache Strategy Comparison

| Strategy | Access Time | Complexity | Offline Support | Memory Usage | Best For |
|----------|-------------|------------|-----------------|--------------|----------|
| **Memory Only** | <5ms | Low | None | High (5-50MB) | Hot data, current view |
| **IndexedDB Only** | 10-30ms | Medium | Full | Low (app overhead) | Full corpus, search |
| **Service Worker** | 20-50ms | High | Full | Medium (50-100MB) | Offline-first, PWA |
| **Multi-Layer** | <10ms (L1), <30ms (L2) | High | Full | Medium-High | Production apps |
| **Network-First** | 100-500ms | Low | None | Minimal | Real-time, auth-sensitive |
| **Cache-First** | <50ms | Medium | Partial | Medium | Email clients, content apps |
| **Stale-While-Revalidate** | <50ms | Medium | Partial | Medium | Best UX, eventual consistency |

---

## Recommendations for Claine v2

### Core Architecture

1. **Implement 4-layer cache** (Memory → RxDB → Service Worker → Gmail API)
2. **Memory cache:** 100 emails, 5-10 minute TTL, LRU eviction
3. **RxDB:** Full email corpus, 300MB target, 500MB max
4. **Service Worker:** Critical emails + offline assets, 50MB
5. **Use stale-while-revalidate** for all reads (show cache, sync background)

### Prefetching Strategy

6. **Hover prefetch** with 200ms delay (most effective for instant opens)
7. **Sequential prefetch** (next 2 emails) during reading
8. **Thread prefetch** (full thread on open)
9. **Viewport prefetch** (+/- 10 items with Intersection Observer)
10. **Priority queue** with max 3 concurrent prefetches

### Cache Invalidation

11. **Tag-based invalidation** for threads, labels, searches
12. **Optimistic updates** with rollback on conflict
13. **Real-time sync** via Gmail push notifications (webhook/polling)
14. **TTL:** 5 min (memory), 24h (metadata), 7d (bodies)

### Size Management

15. **Monitor quota** every 5 minutes
16. **Auto-evict** at 85% usage, target 70%
17. **LRU eviction** with protection rules (unread, starred, recent)
18. **Protect:** Unread, starred, drafts, sent (30d), read (7d)

### Performance Targets

19. **Cached email:** <20ms (L1), <50ms (L2)
20. **Network fetch:** <200ms (Gmail API)
21. **Initial load:** <500ms (first 500 email metadata)
22. **Thread open:** <100ms (prefetched), <300ms (network)

### Monitoring & Optimization

23. **Track cache hit rates** (target >85% for L1+L2)
24. **Log cache performance** (p50, p95, p99 latencies)
25. **A/B test prefetch strategies** (hover delay, sequential count)
26. **Monitor quota usage** per user, alert on 90%

### Implementation Priority

**Phase 1 (MVP):**
- Memory + RxDB caching
- Basic LRU eviction
- Hover prefetch
- Stale-while-revalidate

**Phase 2 (Enhanced):**
- Service Worker integration
- Tag-based invalidation
- Sequential prefetch
- Quota monitoring

**Phase 3 (Optimized):**
- ML-based predictive prefetch
- Advanced priority queue
- Cache warming strategies
- Performance analytics

### Key Metrics to Track

- **Cache hit rate:** L1 + L2 combined (target >85%)
- **Access latency:** p50 <20ms, p95 <50ms, p99 <100ms
- **Prefetch accuracy:** % of prefetched emails actually opened (target >30%)
- **Storage usage:** Average per user (target <300MB)
- **Eviction rate:** Emails evicted per day (lower is better)
- **Offline capability:** % of emails accessible offline (target >90% for recent)

---

## References

- **Gmail Architecture:** [Chrome DevTools Network Analysis]
- **Fastmail JMAP:** https://jmap.io/spec-core.html
- **Workbox (Google):** https://developer.chrome.com/docs/workbox/
- **RxDB Caching:** https://rxdb.info/caching.html
- **Cache API:** https://developer.mozilla.org/en-US/docs/Web/API/Cache
- **Storage Quotas:** https://web.dev/storage-for-the-web/
- **React Query:** https://tanstack.com/query/latest (SWR patterns)

---

**Document Version:** 1.0
**Last Updated:** October 28, 2025
**Next Review:** After Phase 1 implementation
