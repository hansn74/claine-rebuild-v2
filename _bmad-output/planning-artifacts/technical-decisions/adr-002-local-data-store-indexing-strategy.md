# ADR-002: Local Data Store & Indexing Strategy

**Status:** Accepted
**Date:** 2025-11-03
**Deciders:** Architect, Lead Engineer

## Context

Claine requires offline-first local storage for:

- Email messages, threads, attachments (up to 100K emails per account)
- User settings, automation rules, action logs
- AI model state, learning data, confidence scores
- Fast full-text search (<100ms for 10K+ emails)
- Reactive queries (UI updates on data changes)
- Conflict resolution during sync

**Requirement Mapping:** FR006-FR010 (Offline-First Data Storage), NFR004 (Scalability), FR008 (local search)

## Decision

**Selected: RxDB 16.20.0 + IndexedDB + RxDB FlexSearch Plugin (Premium)**

Implement offline-first storage using:

- **Database:** RxDB 16.20.0 with IndexedDB storage adapter (Dexie.js)
- **Full-Text Search:** RxDB FlexSearch plugin (premium) for integrated client-side search
- **Reactivity:** RxDB's reactive queries for real-time UI updates
- **Encryption:** RxDB encryption plugin for sensitive email fields
- **Sync:** RxDB replication with Gmail API using History API (incremental sync)

## Options Under Consideration

**Option A: RxDB + IndexedDB**

- **Pros:** Reactive (RxDB), browser-native storage (IndexedDB), proven in Claine v1, observability patterns established
- **Cons:** IndexedDB 50GB browser limit, complex migration system, N+1 query issues in v1
- **Performance:** Good with proper indexing; v1 had issues (142 queries for 50 emails) - fixable
- **Scalability:** Suitable for 100K emails if indexes optimized

**Option B: SQLite + WASM (sql.js or wa-sqlite)**

- **Pros:** SQL ecosystem, mature query optimizer, no storage limits, familiar to engineers
- **Cons:** No native reactivity (need polling or triggers), WASM performance overhead, larger bundle size
- **Performance:** Excellent query performance, potential WASM bottleneck for high-frequency operations
- **Scalability:** Proven at millions of rows

**Option C: Hybrid (RxDB for metadata + SQLite for full-text search)**

- **Pros:** Best of both worlds - reactive UI + powerful search
- **Cons:** Complexity of maintaining two stores, sync overhead, larger footprint
- **Performance:** Potentially optimal if orchestrated well
- **Scalability:** Excellent

**Option D: Do Nothing / Defer**

- Use in-memory data structures for MVP, persist to JSON files
- **When this makes sense:** Extreme time pressure, <1000 emails, disposable prototype
- **When this fails:** Any production use, no search capability, no scalability

## Rationale

RxDB + FlexSearch provides the best balance of features for offline-first email:

**Pros:**

- **Native Integration:** FlexSearch plugin auto-updates search index on document changes (no manual sync)
- **Persistent Indexing:** Search index survives app restarts, incremental updates only process changes
- **Reactive Queries:** RxDB's observables enable real-time UI updates (critical for email client UX)
- **Proven in V1:** Claine v1 used RxDB successfully, v2 addresses performance issues with better indexing
- **Encrypted Search:** FlexSearch works with RxDB encryption (searches encrypted fields transparently)
- **Multi-Tab Optimization:** Leader election ensures only one tab does indexing work (battery/CPU efficient)
- **FlexSearch Performance:** 10x faster than Lunr.js, phonetic matching handles misspellings

**Cons:**

- **Premium License:** RxDB FlexSearch requires premium license (~$500-1000/year for commercial use)
- **IndexedDB Limits:** ~60% of disk quota (acceptable for 100K emails = ~1.5 GB)
- **Learning Curve:** RxDB migration system more complex than raw IndexedDB

**Why Not SQLite + WASM?**

- No native reactivity (requires polling or manual refresh)
- WASM overhead for high-frequency operations
- Larger bundle size (~1MB for sql.js vs ~200KB for RxDB)
- Would need separate search solution anyway

**Why FlexSearch over Lunr.js?**

- 10x faster search performance (FlexSearch benchmarks vs Lunr.js)
- Native RxDB integration (auto-index updates, encrypted search)
- Phonetic matching built-in (better UX for misspellings)
- Multi-tab leader election (battery/CPU efficient)

## Acceptance Criteria

ADR-002 is **Accepted** (this decision is now validated):

- Search latency P95 <100ms for 10,000+ emails on reference hardware (Common Benchmark Plan)
- Initial load time P95 ≤1.5s for inbox with 5,000 emails
- Memory footprint for 100K emails documented and within acceptable range (<500MB)
- Reactive query update latency <50ms (time from data change to UI update)
- Storage capacity validated: 100K emails + attachments within platform limits
- Migration strategy tested: v0 → v1 schema migration with 50K emails completes in <30s
- Benchmark results reviewed: All options tested with Common Benchmark Plan synthetic dataset
- Owner sign-off: Architect + Lead Engineer approval with performance comparison table

## Operational Considerations

- **Rollout:** Phased migration for existing users (if migrating from v1); new users get new store immediately
- **Telemetry:** Track query latency (P50/P95/P99), storage usage, migration success rate, index rebuild times
- **Observability:** Log slow queries (>200ms), index misses, storage quota warnings
- **Fallback:** If performance degrades post-launch, document rollback to previous store or emergency optimization path
- **Support Playbook:**
  - Storage quota exceeded: guide users through archive/deletion
  - Slow search: trigger manual index rebuild
  - Corrupted database: provide import/export recovery tools

## Consequences

**Positive:**

- ✅ **Proven Technology:** RxDB used successfully in Claine v1, v2 fixes known performance issues
- ✅ **Real-Time UI:** Reactive queries enable instant UI updates (no manual refresh needed)
- ✅ **Integrated Search:** FlexSearch plugin eliminates manual index sync (reduces bugs)
- ✅ **Encrypted Search:** Search works transparently with RxDB encryption (no separate implementation)
- ✅ **Battery Efficient:** Leader election prevents duplicate indexing work across tabs

**Negative:**

- ❌ **Premium License Cost:** RxDB FlexSearch requires ~$500-1000/year commercial license
- ❌ **IndexedDB Limits:** Safari 1GB limit may impact power users (Chrome/Firefox acceptable)
- ❌ **Migration Complexity:** RxDB schema migrations more complex than raw IndexedDB

**Mitigations:**

- **License Cost:** Budget for RxDB Premium license in Year 1 operating costs
- **Storage Limits:** Monitor quota usage, provide "Archive old emails" feature
- **Migration Testing:** Comprehensive migration tests in Epic 1 (Story 1.3C)

## Indexing Strategy

**RxDB Indexes:**

```typescript
// Email schema with indexes
const emailSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    threadId: { type: 'string' },
    sender: { type: 'string' },
    date: { type: 'number' },
    labels: { type: 'array', items: { type: 'string' } },
    priority: { type: 'number' }, // AI triage score
    subject: { type: 'string' },
    body: { type: 'string' },
  },
  indexes: [
    'threadId', // Conversation grouping
    'sender', // Relationship scoring
    'date', // Chronological sorting
    ['labels', 'date'], // Compound index for filtered views
    'priority', // AI triage results
  ],
  encrypted: ['subject', 'body', 'sender'], // Encrypted fields
}
```

**FlexSearch Configuration:**

```typescript
// Full-text search on subject + body + sender
const fulltextSearch = await createRxFulltextSearch({
  identifier: 'email-search',
  source: emailCollection,
  documentToString: (doc) => {
    return `${doc.subject} ${doc.body} ${doc.sender}`
  },
  options: {
    tokenize: 'forward',
    threshold: 0,
    depth: 3, // Phonetic matching depth
  },
})
```

**Migration Plan:**

- Schema versioning from day 1 (version: 0 → 1 → 2, etc.)
- RxDB migration strategies for backward compatibility (at least 2 versions)
- Auto-migration on app startup with progress indication (Story 1.3C)

## References

- **RxDB Documentation:** https://rxdb.info/
- **RxDB FlexSearch Plugin:** https://rxdb.info/fulltext-search.html
- **RxDB Performance Guide:** https://rxdb.info/slow.html
- **FlexSearch Benchmarks:** https://github.com/nextapps-de/flexsearch#performance
- **RxDB Encryption:** https://rxdb.info/encryption.html
- **IndexedDB Storage Quotas:** https://web.dev/storage-for-the-web/
- **Architecture Document:** `docs/architecture.md` (Data layer section)

---
