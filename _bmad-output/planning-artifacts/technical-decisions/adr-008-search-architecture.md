# ADR-008: Search Architecture

**Status:** Accepted
**Date:** 2025-11-03
**Deciders:** Architect, Lead Engineer

## Context

Claine requires fast, accurate search across:

- Email subjects, bodies, sender, recipient
- 100K+ emails with <100ms latency (P95)
- Full-text search with fuzzy matching, ranking
- Search within threads, by date range, by label/category
- Highlight search terms in results

**Requirement Mapping:** FR008 (local search), NFR001 (performance - <100ms search)

## Decision

**Selected: RxDB FlexSearch Plugin (Premium)**

Implement full-text search using:

- **Search Engine:** RxDB FlexSearch plugin (FlexSearch 0.7.x integrated)
- **Integration:** Native RxDB integration (auto-index updates on document changes)
- **Features:** BM25 ranking, fuzzy matching, phonetic matching, multi-field search
- **Persistence:** Search index persists in IndexedDB (survives app restarts)
- **Multi-Tab:** Leader election ensures only one tab indexes (battery/CPU efficient)
- **Encrypted Search:** Works transparently with RxDB encryption

## Options Under Consideration

**Option A: Embedded Full-Text Search (SQLite FTS5 or RxDB + FlexSearch)**

- **Pros:** No external dependencies, integrated with data store (ADR-002)
- **Cons:** Limited ranking algorithms, less mature than dedicated search engines
- **Performance:** Good for <100K emails, may struggle at scale
- **Best for:** MVP, integrated with chosen data store

**Option B: MiniSearch (JavaScript full-text search library)**

- **Pros:** Lightweight, pure JS, BM25 ranking, fuzzy search
- **Cons:** In-memory index (RAM usage for 100K emails), rebuild on app restart
- **Performance:** Fast for queries, slower index rebuild
- **Best for:** If data store (ADR-002) doesn't provide FTS

**Option C: Hybrid (Data store for exact match + MiniSearch for fuzzy/ranked)**

- **Pros:** Best of both worlds - exact match fast path, fuzzy fallback
- **Cons:** Complexity of maintaining two indexes, larger memory footprint
- **Best for:** If search quality critical, acceptable complexity trade-off

**Option D: Do Nothing / Defer**

- Simple substring match (no ranking, no fuzzy)
- **When this makes sense:** MVP validation, search not primary feature
- **When this fails:** User expectation for Google-quality search in email client

## Indexing Strategy

**What to Index:**

- Email: subject (high weight), body (medium weight), sender/recipient (low weight)
- Threads: Index thread titles separately for thread-level search
- Metadata: Labels, categories, priority (for filtering)

**Index Maintenance:**

- **Incremental:** Update index on email sync (add/update/delete)
- **Rebuild:** Full index rebuild on schema version upgrade or corruption detection
- **Background:** Index updates happen in background worker (don't block UI)

**Index Size:**

- Target: <100MB for 100K emails (compressed inverted index)
- Monitor: Alert if index size exceeds threshold (may indicate indexing bug)

## Search Features

**MVP:**

- Full-text search across subject/body
- Filter by date range, sender, label
- Sort by relevance (BM25) or date

**Post-MVP:**

- Fuzzy search ("recieve" → "receive")
- Synonym expansion ("meeting" → "call", "sync")
- Semantic search (via local AI embeddings)

## Acceptance Criteria

ADR-008 is **Accepted** (this decision is now validated):

- Search latency P95 <100ms for 10,000+ emails on reference hardware (Common Benchmark Plan)
- Search quality validated: Precision ≥90%, recall ≥85% on test query corpus (50+ queries)
- Incremental indexing working: New emails indexed within 5s of sync
- Index rebuild tested: 100K emails reindexed in <60s
- Fuzzy search working: Typos within edit distance 1-2 return correct results
- Filter/sort working: Date range, sender, label filters return correct results
- Highlight working: Search terms highlighted in results (subject/body preview)
- Index size within budget: <100MB for 100K emails
- Owner sign-off: Architect + Lead Engineer approval with performance benchmarks

## Operational Considerations

- **Rollout:**
  - Phase 1: Launch with basic full-text search (exact match + ranking)
  - Phase 2: Add fuzzy search if user feedback indicates typos problematic
  - Phase 3: Consider semantic search (AI embeddings) for post-GA
- **Telemetry:** Track search latency (P50/P95/P99), query frequency, zero-result rate, fuzzy match usage
- **Observability:**
  - Log slow searches (>200ms), indexing errors, index rebuild triggers
  - Dashboard: Search usage over time, popular queries (anonymized)
- **Fallback:**
  - If index corrupted: Trigger rebuild automatically, show progress to user
  - If search slow: Suggest reducing email count (archive old emails) or indexing optimization
- **Support Playbook:**
  - Search returns wrong results: Trigger index rebuild, check for indexing bugs
  - Search too slow: Check email count, hardware specs, background processes
  - Index won't rebuild: Check disk space, permissions, logs for errors

## Consequences

**Positive:**

- ✅ **Native Integration:** FlexSearch auto-updates on document changes (no manual sync)
- ✅ **10x Faster:** FlexSearch benchmarks show 10x performance vs Lunr.js/MiniSearch
- ✅ **Persistent Index:** Index survives app restarts (no rebuild needed)
- ✅ **Encrypted Search:** Works with RxDB encryption (searches encrypted fields transparently)
- ✅ **Phonetic Matching:** Handles misspellings better than basic fuzzy search

**Negative:**

- ❌ **Premium License:** RxDB FlexSearch requires premium license (~$500-1000/year)
- ❌ **Index Size:** ~100MB for 100K emails (acceptable but notable)

**Mitigations:**

- **License Cost:** Budget for RxDB Premium license (covers both database + search)
- **Index Monitoring:** Alert if index size exceeds 150MB (may indicate bug)

## References

- **RxDB FlexSearch Plugin:** https://rxdb.info/fulltext-search.html
- **FlexSearch GitHub:** https://github.com/nextapps-de/flexsearch
- **FlexSearch Benchmarks:** https://github.com/nextapps-de/flexsearch#performance
- **BM25 Ranking Algorithm:** https://en.wikipedia.org/wiki/Okapi_BM25
- **Architecture Document:** `docs/architecture.md` (Search architecture section)

---
