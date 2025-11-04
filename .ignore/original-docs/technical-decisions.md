# Technical Decisions & Architecture Decision Records (ADRs)

**Project:** claine-rebuild-v2
**Document Type:** Technical Reference
**Last Updated:** 2025-10-29

> **Note:** This document captures implementation decisions (HOW) that fulfill the product requirements (WHAT & WHY) defined in [PRD.md](./PRD.md).

---

## Overview

This document maintains a living record of key architectural and technical decisions made for Claine v2. Each ADR follows the format:

- **Context:** What problem/question are we addressing?
- **Decision:** What did we decide?
- **Rationale:** Why this choice over alternatives?
- **Consequences:** What are the positive/negative trade-offs?
- **Alternatives Considered:** What else did we evaluate?
- **References:** Links to spikes, benchmarks, or research

---

## ADR Index

| ADR # | Title | Status | Date | Owner |
|-------|-------|--------|------|-------|
| [ADR-001](#adr-001-application-platform-selection) | Application Platform Selection | Accepted | 2025-11-01 | Architect |
| [ADR-002](#adr-002-local-data-store--indexing-strategy) | Local Data Store & Indexing Strategy | Proposed | 2025-10-29 | Architect |
| [ADR-003](#adr-003-local-ai-inference-engine) | Local AI Inference Engine | Proposed | 2025-10-29 | Architect |
| [ADR-004](#adr-004-sync-protocols--api-strategy) | Sync Protocols & API Strategy | Proposed | 2025-10-29 | Architect |
| [ADR-005](#adr-005-privacy-posture--cloud-fallback-policy) | Privacy Posture & Cloud Fallback Policy | Proposed | 2025-10-29 | Architect |
| [ADR-006](#adr-006-updatedistribution--auto-update) | Update/Distribution & Auto-Update | Proposed | 2025-10-29 | Architect |
| [ADR-007](#adr-007-secrets--key-management) | Secrets & Key Management | Proposed | 2025-10-29 | Architect |
| [ADR-008](#adr-008-search-architecture) | Search Architecture | Proposed | 2025-10-29 | Architect |
| [ADR-009](#adr-009-undoaction-log-architecture) | Undo/Action Log Architecture | Proposed | 2025-10-29 | Architect |
| [ADR-010](#adr-010-notifications--rate-limit-policy) | Notifications & Rate-Limit Policy | Proposed | 2025-10-29 | Architect |
| [ADR-011](#adr-011-packaging-sandboxing--permissions) | Packaging, Sandboxing & Permissions | Proposed | 2025-10-29 | Architect |
| [ADR-012](#adr-012-test-strategy--benchmark-harness) | Test Strategy & Benchmark Harness | Proposed | 2025-10-29 | Architect |
| [ADR-013](#adr-013-accessibility-engineering-plan) | Accessibility Engineering Plan | Proposed | 2025-10-29 | Architect |

**Status Legend:**
- **Proposed:** Under discussion, not yet decided
- **Draft:** Decision made, pending validation
- **Accepted:** Validated, implemented, in production
- **Superseded:** Replaced by newer ADR
- **Deprecated:** No longer applicable

---

## Common Benchmark Plan

**Purpose:** Provide standardized benchmarking for ADR-001 (Desktop Shell), ADR-002 (Local Store), and ADR-003 (AI Inference) to ensure comparable results.

**Hardware Cohorts:**
- **Cohort A:** Apple M1 16GB RAM (macOS 13+)
- **Cohort B:** Intel i7-10700 16GB RAM (Windows 11)
- **Cohort C:** AMD Ryzen 5 5600U 16GB RAM (Ubuntu 22.04)

**Synthetic Dataset:**
- **Size:** 100,000 emails across 3 accounts
- **Distribution:** 10% with 1-2MB attachments, 90% text-only
- **Languages:** Multilingual (60% English, 20% Dutch, 10% German, 10% other)
- **Threads:** 30% threaded conversations (2-15 messages per thread)
- **Labels:** 5-10 labels per email (Primary, Updates, Work, Personal, etc.)
- **Date Range:** Last 2 years, realistic distribution (more recent = more frequent)

**Workloads:**
1. **Cold Start:** Time from app launch to interactive home view rendered
2. **Inbox Render:** Time to render inbox list (virtualized, 50 visible emails)
3. **Thread Open:** Time to load and display thread detail (10-message thread)
4. **Search Queries:**
   - Prefix search ("from:john")
   - Phrase search ("budget approval")
   - Sender search ("sender:ceo@company.com")
   - Attachment filter ("has:attachment")
5. **AI Triage:** Batch process 500 emails, assign priority scores
6. **AI Draft:** Generate 10 draft responses back-to-back

**Metrics Collected:**
- **Latency:** P50, P95, P99 per workload
- **FPS:** Frame rate during inbox scrolling (target: ≥60 FPS)
- **Memory:** Resident Set Size (RSS) peak and steady-state
- **CPU:** Peak % and sustained % during operations
- **Storage:** Index size, database size on disk

**Pass/Fail Criteria (Maps to NFRs):**
- **NFR001:** Cold start P95 ≤1.5s; input latency P95 ≤50ms; scroll FPS ≥60
- **NFR004:** Storage for 100K emails; <5% perf degradation at scale
- **NFR005:** AI triage <200ms/email P95; draft generation <2s P95

**Tooling:**
- Benchmark harness: Custom Electron/Tauri app with synthetic data loader
- Profiling: Chrome DevTools, Instruments (macOS), Windows Performance Analyzer
- Automation: CI pipeline runs benchmarks on PR, reports regression

---

## Traceability Matrix

**Purpose:** Map PRD requirements → ADRs → Epics to prevent orphaned decisions and ensure coverage.

| PRD Requirement | Relevant ADR(s) | Epic(s) | Notes |
|-----------------|-----------------|---------|-------|
| FR001-FR005 (Email Integration & Sync) | ADR-004, ADR-007 | Epic 1 | OAuth, token storage, sync protocols |
| FR006-FR010 (Offline-First Storage) | ADR-002, ADR-008 | Epic 1, Epic 2 | Local store, search, conflict resolution |
| FR011-FR014 (AI Triage & Notifications) | ADR-003, ADR-010 | Epic 3 | Local AI, notification policy |
| FR015-FR018 (AI Compose & Response) | ADR-003 | Epic 4 | Draft generation, style learning |
| FR019-FR023 (Autonomous Actions) | ADR-009, ADR-010 | Epic 5 | Action logging, undo, permissions |
| FR024-FR027 (Privacy & Trust) | ADR-005, ADR-007, ADR-011 | Epic 1, Epic 5 | Cloud fallback, key management, sandbox |
| FR028-FR032 (Performance & UX) | ADR-001, ADR-002 | Epic 2 | Desktop shell, virtualization |
| FR033-FR034 (Data Rights & Retention) | ADR-002, ADR-007 | Epic 1, Epic 5 | Export/import, local retention |
| NFR001 (Performance) | ADR-001, ADR-002, ADR-012 | Epic 1, Epic 2 | Shell, store, benchmarking |
| NFR002 (Reliability) | ADR-004, ADR-009 | Epic 1, Epic 2 | Sync resilience, undo reliability |
| NFR003 (Security) | ADR-005, ADR-007, ADR-011 | Epic 1, Epic 5 | Privacy, secrets, sandboxing |
| NFR004 (Scalability) | ADR-002, ADR-008 | Epic 1, Epic 2 | Storage limits, search performance |
| NFR005 (AI Performance & Quality) | ADR-003, ADR-012 | Epic 3, Epic 4 | Local inference, quality targets |
| NFR006 (Usability) | ADR-001, ADR-012, ADR-013 | Epic 1, Epic 2 | Cold start, onboarding flow, accessibility |
| NFR007 (Maintainability) | ADR-012 | All Epics | Test coverage, CI/CD |
| NFR008 (Accessibility) | ADR-001, ADR-013 | Epic 2 | WCAG compliance, keyboard nav |
| NFR009 (Privacy-Preserving Telemetry) | ADR-005, ADR-011 | Epic 1, Epic 5 | Telemetry design, opt-in |
| NFR010 (Notification Hygiene) | ADR-010 | Epic 3 | Rate limiting, DND compliance |

---

## ADR-001: Application Platform Selection

**Status:** Accepted
**Date:** 2025-11-01
**Deciders:** Architect, Lead Engineer

### Context

Claine requires a cross-platform application that supports:
- Modern web rendering (HTML/CSS/JS) for UI
- Offline-first architecture with local data storage (100K emails per account)
- Performance targets: sub-50ms interactions, 60 FPS scrolling
- Security: sandboxing, CSP, secure credential storage
- Future mobile support (iOS/Android)
- CASA audit compliance for Gmail API access
- Low resource usage (memory, CPU, battery)

**Requirement Mapping:** NFR001 (Performance), NFR003 (Security), NFR004 (Scalability), UI Design Goals

### Decision

**Selected: Progressive Web App (PWA) with Service Workers**

Deploy Claine as a PWA using:
- **Framework:** Vite + React + TypeScript
- **Database:** RxDB v16 + IndexedDB (offline storage)
- **State Management:** Zustand v5
- **Styling:** TailwindCSS v4 + shadcn/ui
- **Service Workers:** Offline-first caching, background sync
- **Deployment:** Vercel with edge caching

### Rationale

After comprehensive analysis comparing PWA vs Electron:

**Pros:**
- **Lower Resource Usage:** 40-60% less memory than Electron (~60-80MB vs 100-200MB)
- **Faster Deployment:** No installers, no code signing ($200-300/year saved), instant updates
- **Easier CASA Audit:** Sandboxed by default (browser security model), no system-level access
- **Future Mobile Support:** Same codebase works on iOS/Android PWAs
- **Developer Experience:** Simpler architecture (no Electron IPC), faster builds (Vite), better debugging
- **Progressive Enhancement:** Works on any modern browser, installable as app
- **Security:** Browser sandbox by default, strict CSP, Web Crypto API for encryption

**Cons:**
- **Limited OS Integration:** No system tray (Phase 1), notifications via Web Notifications API only
- **Browser Dependency:** Requires modern browser (Chrome 90+, Safari 15+, Firefox 100+)
- **Storage Limits:** ~60% of disk quota (acceptable for 100K emails = 1.5 GB)
- **Offline Requires HTTPS:** Must be served over HTTPS for Service Workers

**Option B: Electron - REJECTED**
- **Pros:** Maximum OS integration, mature ecosystem, proven at scale (VS Code, Slack)
- **Cons:** 40-60% higher memory usage, code signing costs, complex CASA audit (system-level access), no mobile support
- **Rejected because:** Resource overhead, deployment complexity, CASA audit complexity, lack of mobile path

**Option C: Tauri - REJECTED**
- **Pros:** Low memory footprint, Rust safety, modern architecture
- **Cons:** Smaller ecosystem, team learning curve, no mobile support
- **Rejected because:** Team has no Rust experience, ecosystem less mature for RxDB/AI integration

### Consequences

**Positive:**
- ✅ **Lower TCO:** No code signing fees, no installer distribution costs
- ✅ **Faster iterations:** Deploy updates instantly via Vercel edge
- ✅ **Simpler codebase:** No Electron IPC, no main/renderer process split
- ✅ **Mobile-ready:** Same codebase can support iOS/Android PWAs in Phase 2+
- ✅ **Easier CASA audit:** Browser sandbox simplifies security assessment

**Negative:**
- ❌ **No system tray:** Phase 1 limitation (can be added via browser extensions or Electron wrapper later)
- ❌ **Browser requirement:** Users must have modern browser (not standalone executable)
- ❌ **Limited native features:** No deep OS integration (file system access limited to File System Access API)

**Mitigations:**
- **Escape hatch:** If OS integration becomes critical, wrap PWA in Electron/Tauri shell (same codebase)
- **Progressive enhancement:** Start with PWA, add native features incrementally
- **Browser compatibility:** Target Chrome 90+, Safari 15+, Firefox 100+ (covers 95%+ users)

### Acceptance Criteria

ADR-001 is **Accepted** (this decision is now validated):
- ✅ LCP (Largest Contentful Paint) < 2.5s
- ✅ FID (First Input Delay) < 100ms
- ✅ CLS (Cumulative Layout Shift) < 0.1
- ✅ Service Workers configured for offline-first
- ✅ IndexedDB storage tested for 100K emails (~1.5 GB)
- ✅ PWA manifest configured (installable)
- ✅ CSP configured (strict Content Security Policy)
- ✅ OAuth PKCE flow tested (no client secret required)

### Operational Considerations

- **Deployment:** Vercel with automatic edge caching
- **Updates:** Automatic via Service Worker update mechanism
- **Telemetry:** Web Vitals tracking (LCP, FID, CLS, TTI)
- **Monitoring:** Vercel Analytics + custom performance marks
- **Fallback:** If PWA proves insufficient, migrate to Electron wrapper (same React codebase)
- **Browser Support:** Chrome/Edge 90+, Safari 15+, Firefox 100+

### Alternatives Considered

- **Electron:** Initially considered, but rejected due to higher resource usage (40-60% more memory), code signing costs ($200-300/year), complex CASA audit (system-level access), and lack of mobile support
- **Qt/Flutter Desktop:** Rejected - not web-native, would require full UI rewrite, steeper learning curve
- **Do Nothing / Defer:** Not viable - application platform required for MVP

### References

- **Architecture Document:** `docs/architecture.md` (complete decision details)
- **PWA Best Practices:** https://web.dev/progressive-web-apps/
- **Service Worker Guide:** https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
- **IndexedDB Storage Limits:** https://web.dev/storage-for-the-web/
- **Web Vitals:** https://web.dev/vitals/
- **Vite PWA Plugin:** https://vite-pwa-org.netlify.app/
- **Research Analysis:** Internal comparison document (PWA vs Electron, 20K+ words)

---

## ADR-002: Local Data Store & Indexing Strategy

**Status:** Draft
**Date:** 2025-10-29
**Deciders:** Architect, Lead Engineer

### Context

Claine requires offline-first local storage for:
- Email messages, threads, attachments (up to 100K emails per account)
- User settings, automation rules, action logs
- AI model state, learning data, confidence scores
- Fast full-text search (<100ms for 10K+ emails)
- Reactive queries (UI updates on data changes)
- Conflict resolution during sync

**Requirement Mapping:** FR006-FR010 (Offline-First Data Storage), NFR004 (Scalability), FR008 (local search)

### Decision

**To be determined by architecture workflow**

### Options Under Consideration

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

### Rationale

**Decision pending architecture workflow.** Key considerations:
1. **v1 Learnings:** RxDB worked but had performance issues - are they addressable with better indexing?
2. **Search Performance:** Full-text search <100ms requirement critical - benchmark both options
3. **Reactivity:** RxDB's reactive queries are valuable for UI responsiveness - can we achieve this with SQLite?
4. **Storage Limits:** IndexedDB 50GB may suffice for MVP, but what about power users?

**Recommended approach:** Benchmark both options with realistic dataset (100K emails, 10MB avg size) measuring:
- Query latency (get by ID, search, filter, sort)
- Initial load time
- Memory footprint
- Reactive update performance

### Acceptance / Exit Criteria

ADR-002 is **Accepted** when:
- Search latency P95 <100ms for 10,000+ emails on reference hardware (Common Benchmark Plan)
- Initial load time P95 ≤1.5s for inbox with 5,000 emails
- Memory footprint for 100K emails documented and within acceptable range (<500MB)
- Reactive query update latency <50ms (time from data change to UI update)
- Storage capacity validated: 100K emails + attachments within platform limits
- Migration strategy tested: v0 → v1 schema migration with 50K emails completes in <30s
- Benchmark results reviewed: All options tested with Common Benchmark Plan synthetic dataset
- Owner sign-off: Architect + Lead Engineer approval with performance comparison table

### Operational Considerations

- **Rollout:** Phased migration for existing users (if migrating from v1); new users get new store immediately
- **Telemetry:** Track query latency (P50/P95/P99), storage usage, migration success rate, index rebuild times
- **Observability:** Log slow queries (>200ms), index misses, storage quota warnings
- **Fallback:** If performance degrades post-launch, document rollback to previous store or emergency optimization path
- **Support Playbook:**
  - Storage quota exceeded: guide users through archive/deletion
  - Slow search: trigger manual index rebuild
  - Corrupted database: provide import/export recovery tools

### Consequences

**To be determined post-decision**

### Indexing Strategy (Regardless of Store Choice)

**Critical Indexes:**
- `threadId` - for conversation grouping
- `sender` - for relationship scoring
- `date` - for chronological sorting
- `labels/folders` - for categorization
- `priority` - for AI triage results
- Full-text index on: `subject + body + sender`

**Migration Plan:**
- Schema versioning from day 1
- Backward compatibility for at least 2 versions
- Auto-migration on app startup with progress indication

### References

- RxDB Performance Guide: https://rxdb.info/slow.html
- SQLite WASM Benchmarks: https://sqlite.org/wasm/doc/trunk/about.md
- Claine v1 Performance Analysis: docs/brownfield/03-performance-analysis.md

---

## ADR-003: Local AI Inference Engine

**Status:** Draft
**Date:** 2025-10-29
**Deciders:** Architect, AI/ML Engineer

### Context

Claine requires local AI for:
- Email triage & prioritization (<200ms per email)
- Draft generation (<2s per draft)
- Style learning from user's sent emails
- Explainability (show reasoning for decisions)
- Privacy: all processing on-device by default

**Requirement Mapping:** NFR005 (AI Performance & Quality), FR011-FR018 (AI features), FR024 (privacy)

### Decision

**To be determined by architecture workflow**

### Options Under Consideration

**Option A: Ollama (Local Model Management)**
- **Pros:** Easy model management (download, switch, update), CLI + API, growing ecosystem, supports Llama 3.1 8B
- **Cons:** External dependency (user must install), larger footprint (~4GB model + runtime), macOS/Linux primary support
- **Performance:** Native execution, optimized for Apple Silicon/CUDA, typically 2-5s per draft on M1
- **Latency:** Good for drafts, may struggle with <200ms triage requirement

**Option B: WebLLM (Browser-Native LLM)**
- **Pros:** No external dependencies, runs in browser via WebGPU, smaller quantized models (1-3GB), cross-platform
- **Cons:** Newer/less mature, limited model selection, WebGPU not universally supported yet
- **Performance:** WebGPU acceleration good on modern hardware, slower on older devices
- **Latency:** Potentially better for triage due to quantization

**Option C: ONNX Runtime (Optimized Inference)**
- **Pros:** Highly optimized inference, smaller models possible, fine-grained control
- **Cons:** Requires model conversion (PyTorch → ONNX), more complex integration, less ecosystem support
- **Performance:** Excellent, especially for smaller task-specific models
- **Latency:** Best option for <200ms triage

**Option D: Hybrid (ONNX for triage + Ollama/WebLLM for drafts)**
- **Pros:** Optimize each task independently, best performance per use case
- **Cons:** Complexity of managing multiple runtimes, larger total footprint
- **Performance:** Optimal
- **Latency:** Meets both requirements

**Option E: Do Nothing / Defer**
- Use rule-based heuristics (keywords, sender patterns) for triage; no draft generation
- **When this makes sense:** MVP validation without AI complexity, privacy-first users skeptical of AI
- **When this fails:** Core value prop is AI-powered assistance; removes primary differentiation

### Rationale

**Decision pending architecture workflow.** Key considerations:
1. **Latency Requirements:** Triage (<200ms) and drafts (<2s) have different optimization needs
2. **Hardware Diversity:** Must work on M1 Mac, Intel/AMD Windows, Linux - cross-platform critical
3. **User Experience:** External install (Ollama) vs. bundled (WebLLM) - which is better UX?
4. **Model Evolution:** LLMs improving rapidly - easy model updates important

**Recommended approach:**
- Benchmark all options on reference hardware cohorts
- Test with Llama 3.1 8B (or quantized 3B variant)
- Measure: cold start time, warm inference latency, memory footprint, accuracy
- Consider hybrid: ONNX-optimized small model for triage + larger model for drafts

### Model Selection

**Triage Model Requirements:**
- Fast inference (<200ms)
- Classification task (4 categories + priority score)
- Can be smaller (1-3B params quantized)
- Accuracy: >90% category match vs. user feedback

**Draft Model Requirements:**
- Quality text generation
- Context window: 4K+ tokens (conversation history)
- Style adaptability
- 8B params likely minimum for quality

### Cloud Fallback Policy

Per FR024/FR025:
- **Default:** OFF
- **When enabled:** Redact PII locally (addresses, names, message bodies)
- **UI:** Per-event banner ("Processed in cloud: redacted")
- **Audit:** Log all cloud invocations, exportable by user

### Acceptance / Exit Criteria

ADR-003 is **Accepted** when:
- Triage inference latency P95 <200ms/email on reference hardware (Common Benchmark Plan)
- Draft generation latency P95 <2s on reference hardware
- Model quality validated: Triage category accuracy ≥90% vs. user feedback; draft acceptance rate ≥95%
- Memory footprint documented: Model size + runtime memory <4GB total
- Cold start time: Model load + first inference <5s
- Hardware compatibility proven: All three cohorts (M1, i7, Ryzen) meet performance targets
- Cloud fallback PII redaction tested: 100% removal of test PII vectors
- Benchmark results reviewed: All options tested with Common Benchmark Plan workloads
- Owner sign-off: Architect + AI/ML Engineer approval with performance/quality/privacy trade-off analysis

### Operational Considerations

- **Rollout:**
  - Phase 1: Ship with single model (likely Ollama or WebLLM); monitor quality/performance
  - Phase 2: If performance insufficient, introduce hybrid or ONNX optimization
  - Model updates: Independent of app updates via model registry
- **Telemetry:** Track inference latency (P50/P95/P99), model accuracy (user undo rate), cloud fallback usage, model load time
- **Observability:**
  - Log slow inferences (>threshold), quality issues (high undo rate), cloud fallback events with redaction logs
  - Export user feedback loop: Collect accepted/rejected AI actions for retraining
- **Fallback:**
  - If local AI unavailable (hardware unsupported, model load failure): Gracefully degrade to rule-based or offer cloud opt-in
  - Emergency model rollback if quality degrades post-update
- **Support Playbook:**
  - Model won't load: Check hardware compatibility, disk space, reinstall model
  - Poor triage quality: Collect feedback corpus, retrain/update model
  - Slow performance: Check background processes, suggest hardware upgrade path

### Consequences

**To be determined post-decision**

### References

- Ollama Documentation: https://ollama.ai/
- WebLLM Benchmarks: https://webllm.mlc.ai/#benchmarks
- ONNX Runtime Performance Tuning: https://onnxruntime.ai/docs/performance/

---

## ADR-004: Sync Protocols & API Strategy

**Status:** Draft
**Date:** 2025-10-29
**Deciders:** Architect, Backend Engineer

### Context

Claine requires bidirectional sync between local store and email providers:
- Gmail (OAuth 2.0 + Gmail API)
- Outlook (OAuth 2.0 + Microsoft Graph API)
- IMAP/SMTP (other providers)
- Handle rate limits gracefully
- Incremental sync every 2-5 minutes
- Conflict resolution (last-write-wins initially)

**Requirement Mapping:** FR001-FR005 (Email Integration & Sync), FR009 (conflict resolution), NFR002 (reliability)

### Decision

**To be determined by architecture workflow**

### Options Under Consideration

**Option A (Gmail): History API + (Outlook): Delta Query + (IMAP): IDLE**
- **Pros:** Provider-optimized sync, efficient bandwidth usage, official APIs
- **Cons:** Complex per-provider logic, requires maintaining 3 sync strategies
- **Best for:** Production use with multiple providers

**Option B: Universal polling with timestamp filtering**
- **Pros:** Simple unified codebase, works with any provider
- **Cons:** Inefficient, higher API quota usage, slower updates
- **Best for:** Rapid MVP prototyping

**Option C: Do Nothing / Defer**
- Manual refresh only (no auto-sync)
- **When this makes sense:** Proof-of-concept, offline-only demo
- **When this fails:** Core feature expectation for email client

### Gmail Sync Strategy (If Option A chosen)

**Gmail History API (historyId-based delta sync)**
- **Implementation:** Store `historyId` locally, fetch changes since last sync
- **Rate Limits:** 250 quota units/user/day (manageable)
- **Pros:** Efficient (only fetch changes), Gmail's recommended approach
- **Cons:** Requires polling, can miss events if app offline >7 days

**Gmail Push Notifications (Pub/Sub)** - Deferred to post-MVP
- Requires backend server (conflicts with local-first)

### Outlook/Graph Sync Strategy

**Option A: Microsoft Graph Delta Query**
- **Pros:** Official delta sync mechanism, efficient, similar to Gmail History API
- **Cons:** More complex token/link management
- **Implementation:** Use `deltaLink` from previous sync, fetch changes

**Option B: Polling with timestamp filtering**
- **Pros:** Simple, works with any provider
- **Cons:** Inefficient (fetches all recent messages), higher bandwidth, rate limit concerns

### IMAP/SMTP Strategy

**Standard IMAP IDLE for near-real-time**
- Use IDLE command for push-like behavior
- Fallback to polling every 5 minutes if IDLE not supported
- Fetch by UID to avoid re-downloading

### Rate Limiting & Back-off

**Strategy:**
- Exponential back-off on 429 (Too Many Requests)
- Respect `Retry-After` headers
- Client-side rate limiting: max 1 request per 2 seconds per account
- Batch operations where possible (fetch multiple messages per API call)

### Conflict Resolution

**MVP Approach: Last-Write-Wins**
- Simpler implementation
- Conflicts rare for email (mostly append-only)
- User actions (labels, read/unread) use timestamps

**Post-MVP: CRDTs or Manual Resolution**
- If conflicts become problematic, implement CRDT-based merging
- Or present conflicts to user for manual resolution

### Acceptance / Exit Criteria

ADR-004 is **Accepted** when:
- Sync latency: Initial sync of 5,000 emails completes in <60s; incremental sync <5s for 50 new emails
- Incremental sync working: Only changed emails fetched (validate via network logs)
- Rate limit compliance: Zero 429 errors during normal operation; exponential back-off tested
- Multi-account support: 3 accounts sync concurrently without performance degradation
- Conflict resolution tested: Last-write-wins verified with test scenarios (concurrent label changes)
- Offline resilience: App can be offline >7 days and successfully resync without data loss
- Provider coverage: Gmail + Outlook working; IMAP tested with at least 2 providers
- Benchmark results reviewed: Sync performance tested with Common Benchmark Plan workloads
- Owner sign-off: Architect + Backend Engineer approval with rate limit/reliability analysis

### Operational Considerations

- **Rollout:**
  - Phase 1: Launch with Gmail only (largest user base)
  - Phase 2: Add Outlook support (validate delta query approach)
  - Phase 3: Add IMAP support (validate with Gmail IMAP, ProtonMail, FastMail)
- **Telemetry:** Track sync latency, API quota usage, 429 rate limit hits, conflict resolution frequency, offline duration vs. resync success
- **Observability:**
  - Log all sync errors (auth failures, network timeouts, API errors)
  - Dashboard: Sync health per account (last sync time, pending changes, error count)
- **Fallback:**
  - If sync fails repeatedly: Surface error to user with "Manual refresh" option
  - If provider API deprecated: Migration path to alternative API or IMAP fallback
- **Support Playbook:**
  - Sync stopped: Check OAuth token expiry, network connectivity, provider API status
  - Slow sync: Check account size, network bandwidth, increase sync interval
  - Missing emails: Force full resync, check provider API logs

### Consequences

**To be determined post-decision**

### References

- Gmail API Sync Guide: https://developers.google.com/gmail/api/guides/sync
- Microsoft Graph Delta Query: https://docs.microsoft.com/en-us/graph/delta-query-overview
- IMAP RFC 3501: https://datatracker.ietf.org/doc/html/rfc3501

---

## ADR-005: Privacy Posture & Cloud Fallback Policy

**Status:** Draft
**Date:** 2025-10-29
**Deciders:** Architect, Security Lead, PM

### Context

Claine's core differentiation is privacy-first, offline-first AI. Cloud fallback undermines this but may be necessary for:
- Users with insufficient hardware (< 16GB RAM, older CPUs)
- Model quality improvements (larger cloud models)
- Feature parity fallback if local inference unavailable

**Requirement Mapping:** FR024-FR025 (Privacy & Trust), NFR005 (AI Performance), NFR009 (Privacy-Preserving Telemetry)

### Decision

**To be determined by architecture workflow**

### Privacy Principles (Non-Negotiable)

1. **Local by Default:** All AI processing happens on-device unless user explicitly enables cloud fallback
2. **Informed Consent:** User must opt-in with clear explanation of trade-offs
3. **Data Minimization:** If cloud used, redact all PII locally before sending
4. **Transparency:** Every cloud invocation logged and auditable by user
5. **User Control:** User can disable cloud fallback at any time; can export/delete audit logs

### Cloud Fallback Redaction Strategy

**What gets redacted before cloud send:**
- Email addresses (sender, recipient, CC, BCC) → replaced with tokens
- Names (sender, recipient) → replaced with "Person A", "Person B"
- Message bodies → summarized locally, only summary sent
- Attachments → never sent to cloud
- Calendar data → never sent to cloud

**What gets sent:**
- Anonymized conversation structure ("Person A asked Person B a question")
- Semantic summary of content (not verbatim text)
- User's writing style profile (tone, formality - no identifying info)

### Options Under Consideration

**Option A: Strict Local-Only (No Cloud Fallback)**
- **Pros:** Maximum privacy, no external dependencies, no data egress
- **Cons:** Users with weak hardware cannot use AI features
- **Best for:** Privacy-maximalist positioning, security-sensitive user base

**Option B: Optional Cloud Fallback with Aggressive Redaction**
- **Pros:** Feature parity for all users, graceful degradation for weak hardware
- **Cons:** Redaction complexity, trust erosion if misconfigured
- **Best for:** Broader market reach while maintaining privacy differentiation

**Option C: Cloud-First with Privacy Theater**
- **Pros:** Simplest implementation, no local AI complexity
- **Cons:** Defeats core value proposition, unacceptable privacy trade-off
- **Decision:** Rejected - not aligned with product vision

**Option D: Do Nothing / Defer**
- Launch without cloud fallback, add later if user demand emerges
- **When this makes sense:** MVP with target users all having capable hardware
- **When this fails:** Negative reviews from users with weak hardware

### Cloud Provider Selection (If Option B Chosen)

**Criteria:**
- **Privacy Policy:** No training on user data
- **Data Retention:** Zero retention after response (ephemeral processing)
- **Compliance:** SOC 2, GDPR compliant
- **API:** Supports structured prompts, low latency

**Options:**
- OpenAI API (gpt-4o-mini for cost/latency balance)
- Anthropic Claude API (strong privacy stance)
- Azure OpenAI (enterprise compliance)

**Decision:** To be finalized in architecture workflow based on pricing, latency benchmarks, privacy policy review

### Telemetry & Diagnostics

**Default: OFF (Opt-in only)**

When enabled:
- **Collect:** App crashes, performance metrics (latency distributions, not individual events), feature usage (aggregate counts)
- **Exclude:** Email content, addresses, names, message bodies, AI prompts/responses
- **Storage:** Local only (30 days retention)
- **Export:** User can export telemetry data (JSON format)
- **Delete:** User can delete telemetry data at any time

**Privacy-Preserving Analytics:**
- Aggregate metrics only (e.g., "Average draft generation latency: 1.8s" not "User X generated draft in 1.8s")
- No unique user identifiers sent to analytics backend
- Local processing of telemetry, only summaries uploaded (if user consents to usage statistics)

### Incident Response & Security Disclosure

**User-Facing:**
- Security & Incidents page accessible in-app
- In-app notifications for critical security issues
- 72-hour communication playbook for breach scenarios

**Handling:**
- Zero-tolerance for privacy incidents
- Post-mortem published publicly for any breach
- User notification within 72 hours of discovery

### Threat Model & Security Checklist

**Data Flow Diagram:**
- [ ] Map all data flows: Email provider → Local storage → AI inference → UI
- [ ] Identify all IPC boundaries: Main process ↔ Renderer process ↔ Background workers
- [ ] Document all external network calls: OAuth, sync APIs, (optional) cloud fallback

**IPC Surface Audit (Electron/Desktop Shell):**
- [ ] Context isolation enabled (no shared context between main/renderer)
- [ ] Node integration disabled in renderer processes
- [ ] IPC handlers whitelist validated (no arbitrary code execution via IPC)
- [ ] Preload scripts audited for safe API exposure

**Content Security Policy (CSP):**
- [ ] CSP configured to block inline scripts, eval(), external resources
- [ ] Review exceptions: Are they truly necessary? Documented?
- [ ] Test CSP violations don't break core features

**PII Redaction Test Vectors:**
- [ ] Test email addresses: john.doe@example.com → TOKEN_1
- [ ] Test names in various formats: "John Doe", "Doe, John", "john.doe"
- [ ] Test phone numbers, addresses, SSNs (if applicable)
- [ ] Test false positives: Don't redact technical terms, code snippets
- [ ] Automated test suite with 50+ PII variations

**Offline Mode Abuse Cases:**
- [ ] Can attacker with physical access extract email data from disk?
  - Mitigation: Encrypt local database with OS keychain-derived key
- [ ] Can malicious extension/process read Claine's memory/storage?
  - Mitigation: Sandboxing, OS-level permissions, principle of least privilege
- [ ] Can user export data and accidentally leak PII?
  - Mitigation: Export warns user, redacts sensitive fields by default

**Log Hygiene:**
- [ ] Audit all logging statements: No email content, addresses, message bodies
- [ ] Acceptable: Log metadata (timestamp, sender hash, message ID - not verbatim)
- [ ] Test logs with real email corpus: Manual review for PII leakage
- [ ] Automated log scrubbing: Regex to catch accidental PII logging

**Cloud Fallback Attack Surface (If Enabled):**
- [ ] TLS 1.3 enforced for all cloud API calls
- [ ] Certificate pinning considered (document decision)
- [ ] Timeout & retry limits prevent DoS via cloud API
- [ ] User audit log tamper-proof (append-only, checksummed)

### Acceptance / Exit Criteria

ADR-005 is **Accepted** when:
- Privacy posture decision finalized: Local-only (Option A) OR cloud fallback (Option B) with redaction
- If cloud fallback chosen:
  - Cloud provider selected with signed BAA (Business Associate Agreement) or equivalent
  - PII redaction tested: 100% pass rate on test vectors (50+ PII variations)
  - Cloud audit log implemented: All invocations logged with timestamp, redacted prompt, user consent
  - Per-event banner implemented: "Processed in cloud (redacted)" visible to user
- Threat model checklist: 100% items reviewed and mitigated or risk-accepted
- IPC audit complete: All Electron IPC handlers reviewed, whitelist validated
- CSP configured and tested: No inline scripts, no external resources (except approved CDNs)
- Log hygiene validated: Automated scan + manual review confirms no PII in logs
- Telemetry default OFF: User must explicitly opt-in, with clear explanation
- GDPR/CCPA compliance: Data export, deletion, portability features implemented (FR033)
- Incident response playbook documented: 72-hour notification, public post-mortem
- Owner sign-off: Security Lead + Architect + PM approval with threat model review

### Operational Considerations

- **Rollout:**
  - Phase 1: Launch with local-only (Option A), gather user feedback on performance
  - Phase 2: If user demand for cloud fallback, introduce Option B with extensive user education
  - Security audit: External pentest before GA launch
- **Telemetry:** Track cloud fallback usage rate, PII redaction failures (alerting), audit log export rate
- **Observability:**
  - Security dashboard: Monitor cloud API calls, redaction failures, auth anomalies
  - Alert on: Unexpected external network calls, IPC violations, CSP violations
- **Fallback:**
  - If PII leakage discovered: Immediate disable cloud fallback, user notification, incident response
  - Emergency kill switch: Remotely disable cloud fallback if security issue detected
- **Support Playbook:**
  - User reports privacy concern: Escalate to Security Lead immediately
  - PII in logs discovered: Purge logs, notify affected users, root cause analysis
  - Cloud provider incident: Assess impact, user notification if data exposed

### Consequences

**To be determined post-decision**

### References

- GDPR Article 5 (Data Minimization): https://gdpr-info.eu/art-5-gdpr/
- OpenAI Privacy Policy: https://openai.com/privacy/
- Anthropic Privacy & Security: https://www.anthropic.com/privacy
- OWASP Desktop App Security: https://owasp.org/www-project-desktop-app-security-top-10/

---

## ADR-006: Update/Distribution & Auto-Update

**Status:** Proposed
**Date:** 2025-10-29
**Deciders:** Architect, DevOps Lead

### Context

Claine requires secure, reliable distribution and auto-update mechanism:
- Cross-platform installers (macOS, Windows, Linux)
- Auto-update without breaking user workflows
- Code signing for trust (avoid OS security warnings)
- Rollback capability if update fails
- Minimize update payload size

**Requirement Mapping:** NFR002 (Reliability), NFR006 (Usability - seamless updates)

### Decision

**To be determined by architecture workflow**

### Options Under Consideration

**Option A: Electron Builder + electron-updater**
- **Pros:** Integrated with Electron ecosystem, auto-signing, delta updates, rollback support
- **Cons:** Tied to Electron, requires update server (S3 or GitHub Releases)
- **Distribution:** DMG (macOS), NSIS installer (Windows), AppImage/deb (Linux)
- **Auto-Update:** Check on startup, download in background, prompt user to restart

**Option B: Tauri + tauri-update**
- **Pros:** Smaller bundle size, integrated with Tauri, code signing built-in
- **Cons:** Newer ecosystem, fewer distribution options
- **Distribution:** DMG (macOS), MSI (Windows), AppImage (Linux)

**Option C: Manual Distribution (No Auto-Update)**
- **Pros:** Simplest, no update infrastructure cost
- **Cons:** User friction, poor update adoption, security vulnerability if critical patches needed
- **When this makes sense:** Early beta, internal testing only
- **When this fails:** Production use - users won't manually update

**Option D: Do Nothing / Defer**
- Ship via GitHub Releases, no auto-update for MVP
- **When this makes sense:** Private beta with engaged early adopters
- **When this fails:** GA launch - critical for security patches

### Code Signing Requirements

**macOS:**
- Apple Developer ID certificate required (no Gatekeeper warnings)
- Notarization for macOS 10.15+

**Windows:**
- Authenticode code signing certificate (EV recommended to avoid SmartScreen warnings)
- Alternative: Build reputation slowly with standard cert (users see warnings initially)

**Linux:**
- Code signing optional (most distros don't enforce)
- GPG sign releases for manual verification

### Update Distribution Strategy

**Hosting Options:**
- **GitHub Releases:** Free, reliable, rate limits acceptable for MVP (<1000 users)
- **Cloudflare R2 / AWS S3:** Paid, unlimited bandwidth, required for scale (>10K users)
- **Self-hosted:** Maximum control, operational overhead

**Update Frequency:**
- Automatic check on app startup (max once per 24 hours)
- Manual check available in Help menu
- Critical security patches: Prompt immediately
- Feature updates: Background download, prompt on next startup

### Acceptance / Exit Criteria

ADR-006 is **Accepted** when:
- Installers built for all three platforms (macOS, Windows, Linux) with CI automation
- Code signing working: macOS notarized, Windows signed, no OS warnings on supported platforms
- Auto-update tested: Update from v1.0.0 → v1.1.0 succeeds on all platforms without data loss
- Rollback tested: Failed update rolls back to previous version automatically
- Delta updates working: Update payload <10% of full app size for minor versions
- Update UI implemented: Non-intrusive notification, user can defer updates (except critical security)
- CI/CD pipeline: GitHub Actions builds, signs, publishes releases automatically
- Owner sign-off: Architect + DevOps Lead approval with security review

### Operational Considerations

- **Rollout:**
  - Phase 1: Manual distribution (GitHub Releases) for private beta
  - Phase 2: Enable auto-update for public waitlist
  - Phase 3: Full auto-update for GA with update analytics
- **Telemetry:** Track update success/failure rate, rollback frequency, time-to-update (user defers), platform breakdown
- **Observability:**
  - Dashboard: Update adoption rate per version, platform-specific failures
  - Alert on: Update failure rate >5%, rollback rate >2%
- **Fallback:**
  - If auto-update broken: Provide manual download link in error message
  - If signing cert expires: Emergency re-sign and hotfix release
- **Support Playbook:**
  - Update fails: Check disk space, permissions, antivirus interference (Windows)
  - macOS Gatekeeper blocked: Re-notarize, user can bypass via System Preferences
  - Windows SmartScreen blocked: Advise user it's safe, build reputation over time

### Consequences

**To be determined post-decision**

### References

- Electron Builder: https://www.electron.build/
- electron-updater: https://www.electron.build/auto-update
- Tauri Update Guide: https://tauri.app/v1/guides/distribution/updater/
- Apple Notarization: https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution
- Windows Code Signing: https://docs.microsoft.com/en-us/windows/win32/seccrypto/cryptography-tools

---

## ADR-007: Secrets & Key Management

**Status:** Proposed
**Date:** 2025-10-29
**Deciders:** Architect, Security Lead

### Context

Claine must securely store:
- OAuth tokens (Gmail, Outlook access/refresh tokens)
- API keys (if cloud fallback enabled)
- User encryption keys (for local database encryption)
- User preferences (non-sensitive, but integrity matters)

**Requirement Mapping:** FR001-FR005 (OAuth tokens), FR024 (privacy - local encryption), ADR-005 (cloud fallback API keys)

### Decision

**To be determined by architecture workflow**

### Options Under Consideration

**Option A: OS Keychain/Credential Manager**
- **macOS:** Keychain Services
- **Windows:** Windows Credential Manager (DPAPI)
- **Linux:** libsecret (GNOME Keyring, KWallet)
- **Pros:** OS-native security, hardware-backed encryption (where available), no custom crypto
- **Cons:** Cross-platform abstraction complexity, Linux fragmentation

**Option B: Electron safeStorage API**
- **Pros:** Cross-platform abstraction over OS keychains, integrated with Electron
- **Cons:** Tied to Electron, less control over implementation
- **Security:** Uses Keychain (macOS), DPAPI (Windows), libsecret (Linux)

**Option C: Encrypt locally with master password**
- **Pros:** User controls master password, no OS dependency
- **Cons:** UX friction (enter password on every launch), key derivation overhead, user forgets password = data loss
- **When this makes sense:** Ultra-high-security users, enterprise compliance

**Option D: Do Nothing / Defer**
- Store tokens in plaintext JSON (encrypted at OS filesystem level only)
- **When this makes sense:** Never - unacceptable security posture
- **When this fails:** Always - tokens are sensitive credentials

### Token Refresh Strategy

**OAuth Refresh Tokens:**
- Gmail/Outlook refresh tokens valid indefinitely (until revoked)
- Store refresh token in OS keychain, regenerate access token as needed
- Fallback: Re-authenticate if refresh fails (prompt user)

**API Key Rotation:**
- If cloud fallback uses API keys: Rotate keys quarterly
- Store encrypted with OS keychain, never log keys

### Database Encryption

**Local Email Storage:**
- Encrypt database at rest using key derived from OS keychain
- Transparent encryption (user doesn't enter password)
- Key derivation: PBKDF2 or Argon2 with OS-provided entropy

**Export/Backup:**
- Exported data encrypted by default (user provides password)
- Plaintext export available with confirmation dialog

### Acceptance / Exit Criteria

ADR-007 is **Accepted** when:
- OAuth tokens stored securely: Keychain (macOS), Credential Manager (Windows), libsecret (Linux)
- Token retrieval tested: App can retrieve tokens after restart on all platforms
- Database encryption working: Local store encrypted with OS keychain-derived key
- Cross-platform tested: All three hardware cohorts (M1, i7, Ryzen) secure storage functional
- Fallback handling: Re-authentication flow if token retrieval fails (e.g., keychain locked, corrupted)
- Threat model validated: Physical access attacker cannot extract tokens without OS-level access
- Security review: External audit confirms no plaintext secrets in memory dumps, logs, or disk
- Owner sign-off: Security Lead + Architect approval

### Operational Considerations

- **Rollout:**
  - Phase 1: Implement OS keychain storage for OAuth tokens
  - Phase 2: Add database encryption (can defer to post-MVP if time-constrained)
  - Test extensively: Keychain locking, user logout, OS upgrades
- **Telemetry:** Track token refresh failures, keychain access failures (aggregate counts, no tokens logged)
- **Observability:**
  - Log token refresh events (timestamp, provider, success/failure - no token values)
  - Alert on: High refresh failure rate (indicates token revocation or auth issue)
- **Fallback:**
  - If keychain unavailable (Linux distro without libsecret): Prompt user to install or fallback to master password
  - If database encryption key lost: Cannot decrypt data - user must re-authenticate and resync
- **Support Playbook:**
  - Token retrieval fails: Check OS keychain access, re-authenticate user
  - Database won't unlock: Keychain key missing - likely OS reinstall or migration issue, must resync
  - API key leaked: Rotate immediately, audit logs for unauthorized usage

### Consequences

**To be determined post-decision**

### References

- Electron safeStorage: https://www.electronjs.org/docs/latest/api/safe-storage
- macOS Keychain Services: https://developer.apple.com/documentation/security/keychain_services
- Windows DPAPI: https://docs.microsoft.com/en-us/windows/win32/api/dpapi/
- libsecret: https://wiki.gnome.org/Projects/Libsecret

---

## ADR-008: Search Architecture

**Status:** Proposed
**Date:** 2025-10-29
**Deciders:** Architect, Lead Engineer

### Context

Claine requires fast, accurate search across:
- Email subjects, bodies, sender, recipient
- 100K+ emails with <100ms latency (P95)
- Full-text search with fuzzy matching, ranking
- Search within threads, by date range, by label/category
- Highlight search terms in results

**Requirement Mapping:** FR008 (local search), NFR001 (performance - <100ms search)

### Decision

**To be determined by architecture workflow**

### Options Under Consideration

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

### Indexing Strategy

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

### Search Features

**MVP:**
- Full-text search across subject/body
- Filter by date range, sender, label
- Sort by relevance (BM25) or date

**Post-MVP:**
- Fuzzy search ("recieve" → "receive")
- Synonym expansion ("meeting" → "call", "sync")
- Semantic search (via local AI embeddings)

### Acceptance / Exit Criteria

ADR-008 is **Accepted** when:
- Search latency P95 <100ms for 10,000+ emails on reference hardware (Common Benchmark Plan)
- Search quality validated: Precision ≥90%, recall ≥85% on test query corpus (50+ queries)
- Incremental indexing working: New emails indexed within 5s of sync
- Index rebuild tested: 100K emails reindexed in <60s
- Fuzzy search working: Typos within edit distance 1-2 return correct results
- Filter/sort working: Date range, sender, label filters return correct results
- Highlight working: Search terms highlighted in results (subject/body preview)
- Index size within budget: <100MB for 100K emails
- Owner sign-off: Architect + Lead Engineer approval with performance benchmarks

### Operational Considerations

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

### Consequences

**To be determined post-decision**

### References

- SQLite FTS5: https://www.sqlite.org/fts5.html
- MiniSearch: https://lucaong.github.io/minisearch/
- BM25 Ranking: https://en.wikipedia.org/wiki/Okapi_BM25
- FlexSearch: https://github.com/nextapps-de/flexsearch

---

## ADR-009: Undo/Action Log Architecture

**Status:** Proposed
**Date:** 2025-10-29
**Deciders:** Architect, Lead Engineer

### Context

Claine's AI autonomously acts on emails (archive, snooze, categorize). Users must trust this, requiring:
- Undo any AI action (FR022 - all AI actions reversible within 30 days)
- Action log/audit trail (FR023 - user can review AI decisions)
- Undo must be fast (<1s) and reliable (FR022 - <5% undo rate target)
- Action log queryable (filter by action type, date, email)

**Requirement Mapping:** FR022 (undo), FR023 (audit log), NFR006 (usability - trust)

### Decision

**To be determined by architecture workflow**

### Options Under Consideration

**Option A: Event Sourcing (All actions stored as immutable events)**
- **Pros:** Complete audit trail, undo = apply inverse event, replays for debugging
- **Cons:** Storage overhead (every action stored forever), complexity of event replay
- **Best for:** If audit trail is regulatory requirement, high-trust use case

**Option B: Command Pattern with Action Log**
- **Pros:** Simple undo (store inverse command), lighter weight than event sourcing
- **Cons:** Action log may not capture all state changes (if external state mutated)
- **Best for:** MVP, pragmatic undo without event sourcing overhead

**Option C: Snapshot + Delta Log**
- **Pros:** Fast undo (revert to snapshot), efficient storage (deltas only)
- **Cons:** Complexity of managing snapshots, may lose granularity
- **Best for:** If undo performance critical, storage constrained

**Option D: Do Nothing / Defer**
- No undo, user manually reverts AI actions
- **When this makes sense:** Never - core trust feature
- **When this fails:** Always - unacceptable UX for autonomous AI

### Action Log Schema

**Stored for Each Action:**
- `action_id` (UUID)
- `timestamp` (ISO 8601)
- `action_type` (archive, snooze, categorize, reply, etc.)
- `email_id` (target email)
- `previous_state` (for undo: e.g., previous labels, previous folder)
- `new_state` (after action)
- `ai_confidence` (0.0-1.0)
- `ai_reasoning` (explainability: "Archived because...")
- `user_feedback` (if user undoes or approves)

**Storage:**
- Store in local database (same store as emails, see ADR-002)
- Retention: 30 days (FR022), then purge or archive
- User can export action log (JSON/CSV)

### Undo Implementation

**Undo Flow:**
1. User clicks "Undo" on notification or in action log UI
2. Lookup action in log by `action_id`
3. Apply inverse action: Restore `previous_state`
4. Mark action as undone in log (`status: undone`)
5. Record user feedback: `user_feedback: undone`

**Undo Constraints:**
- Undo within 30 days (after that, action log may be purged)
- Some actions may be irreversible (e.g., sent emails - can't unsend)
- Display clear warnings for irreversible actions (FR022)

### Acceptance / Exit Criteria

ADR-009 is **Accepted** when:
- Undo latency P95 <1s for all reversible actions (archive, snooze, categorize)
- Undo coverage: 100% of AI actions logged and reversible (except irreversible actions like send)
- Action log queryable: User can filter by date, action type, email with <100ms query latency
- Action log UI implemented: Displays all AI actions with reasoning, undo button, user feedback
- Retention working: Actions older than 30 days automatically purged (configurable)
- Export working: User can export action log (JSON/CSV) for all time or date range
- Undo rate tracked: Telemetry confirms undo rate <5% (success metric from PRD)
- Owner sign-off: Architect + Lead Engineer approval with UX review

### Operational Considerations

- **Rollout:**
  - Phase 1: Launch with action log + undo for core actions (archive, snooze, categorize)
  - Phase 2: Expand to draft generation (undo = delete draft), notifications (undo = dismiss)
  - Monitor undo rate: If >5%, investigate AI quality issues
- **Telemetry:** Track undo rate by action type, AI confidence correlation with undo rate, action log export frequency
- **Observability:**
  - Dashboard: Undo rate over time, action type breakdown, AI confidence distribution
  - Alert on: Undo rate >5% (indicates AI quality problem), action log corruption
- **Fallback:**
  - If undo fails: Log error, display message to user, escalate to support
  - If action log corrupted: Offer partial undo (best effort), alert engineering
- **Support Playbook:**
  - User can't undo: Check action age (<30 days?), action type (irreversible?), logs
  - Action log missing entries: Check database, potential sync issue, trigger resync
  - High undo rate: Review AI model quality, retrain if necessary

### Consequences

**To be determined post-decision**

### References

- Event Sourcing Pattern: https://martinfowler.com/eaaDev/EventSourcing.html
- Command Pattern: https://refactoring.guru/design-patterns/command
- GDPR Right to Explanation: https://gdpr-info.eu/art-22-gdpr/ (for AI reasoning)

---

## ADR-010: Notifications & Rate-Limit Policy

**Status:** Proposed
**Date:** 2025-10-29
**Deciders:** Architect, PM, UX Designer

### Context

Claine sends OS notifications for high-priority emails, but must avoid notification fatigue:
- FR014: Configurable notification rate limits, respect OS DND (Do Not Disturb)
- FR031: User can configure notification thresholds (what triggers notification)
- NFR010: Notification hygiene metrics (<10% notification dismissal rate)
- Balance: Useful alerts vs. annoying spam

**Requirement Mapping:** FR014 (rate limits, DND), FR031 (thresholds), NFR010 (hygiene)

### Decision

**To be determined by architecture workflow**

### Options Under Consideration

**Option A: Client-Side Rate Limiting (Simple Threshold)**
- **Pros:** Simple, no backend required, user configures max notifications/hour
- **Cons:** No adaptive learning, user must manually tune thresholds
- **Default:** Max 5 notifications/hour (configurable 1-20)
- **Best for:** MVP, straightforward implementation

**Option B: Adaptive Rate Limiting (AI-Driven)**
- **Pros:** Learns from user behavior (dismissal rate → reduce notifications), no manual config
- **Cons:** Requires AI feedback loop, more complex, cold start problem (needs data)
- **Best for:** Post-MVP, if notification fatigue becomes problem

**Option C: Priority-Based (Only notify for AI-scored high-priority emails)**
- **Pros:** Leverages existing AI triage (ADR-003), high signal-to-noise ratio
- **Cons:** Relies on AI accuracy, may miss important emails if AI wrong
- **Best for:** Paired with Option A or B, confidence threshold (e.g., only notify if AI confidence >0.8)

**Option D: Do Nothing / Defer**
- No rate limiting, notify for every high-priority email
- **When this makes sense:** Never - notification fatigue will occur
- **When this fails:** Always - poor UX, users disable notifications entirely

### Notification Threshold Configuration

**User-Configurable Settings (FR031):**
- **Priority Level:** Notify for "Critical" only, or "High + Critical"
- **Sender Whitelist:** Always notify from specific senders (e.g., boss, family)
- **Sender Blacklist:** Never notify from specific senders (e.g., newsletters)
- **Time Windows:** Only notify during work hours (9am-6pm) or custom schedule
- **Rate Limit:** Max N notifications per hour (default 5, range 1-20)

**Defaults:**
- Notify for AI-scored "Critical" priority emails only
- Respect OS DND (no notifications when DND enabled)
- Max 5 notifications/hour
- No notifications after 10pm local time (configurable)

### OS DND (Do Not Disturb) Integration

**Platform Support:**
- **macOS:** Check DND status via `NSUserNotificationCenter` (if Electron/native)
- **Windows:** Check Focus Assist status via Windows API
- **Linux:** Check DND status via libnotify (best effort, not all DEs support)

**Fallback:** If OS DND status unavailable, respect time-based policy (no notifications after 10pm)

### Notification Hygiene Metrics (NFR010)

**Track:**
- **Dismissal Rate:** % of notifications dismissed without action (target <10%)
- **Click-Through Rate:** % of notifications clicked (target >40%)
- **Action Rate:** % of clicked notifications resulting in reply/archive within 5 minutes (target >40% per PRD)
- **Time-to-Dismiss:** How quickly users dismiss notifications (proxy for annoyance)

**Feedback Loop:**
- If dismissal rate >10%: Prompt user to adjust notification settings, or trigger adaptive learning (Option B)

### Acceptance / Exit Criteria

ADR-010 is **Accepted** when:
- Rate limiting working: Max N notifications/hour enforced, excess queued or dropped with user setting
- DND integration tested: No notifications when OS DND enabled on all platforms (or time-based fallback)
- Threshold config UI implemented: User can set priority level, sender whitelist/blacklist, time windows, rate limit
- Notification hygiene metrics: Dismissal rate <10%, action rate >40% (per PRD) in beta testing
- Notification content tested: Subject + sender + snippet (50 chars) + action buttons (Reply, Archive, Undo)
- Telemetry working: Track dismissal rate, click-through rate, action rate, time-to-dismiss
- Owner sign-off: PM + UX Designer + Architect approval with beta user feedback

### Operational Considerations

- **Rollout:**
  - Phase 1: Launch with simple rate limiting (Option A) + DND integration
  - Phase 2: Monitor hygiene metrics; if dismissal rate >10%, consider adaptive learning (Option B)
  - Beta testing: A/B test default rate limits (3/hr vs. 5/hr vs. 10/hr), measure dismissal rate
- **Telemetry:** Track dismissal rate, click-through rate, action rate, rate limit hits, DND bypass requests
- **Observability:**
  - Dashboard: Notification metrics over time, per-user dismissal rate distribution
  - Alert on: Platform-wide dismissal rate >10%, click-through rate <20%
- **Fallback:**
  - If notifications broken (OS API failure): Fallback to in-app alerts (non-intrusive banner)
  - If hygiene metrics poor: Prompt user to adjust settings, suggest disabling notifications
- **Support Playbook:**
  - User complains "too many notifications": Guide to rate limit settings, sender blacklist
  - User complains "missing important emails": Check notification thresholds, sender whitelist
  - Notifications not respecting DND: Check OS DND settings, fallback to time-based policy

### Consequences

**To be determined post-decision**

### References

- macOS User Notifications: https://developer.apple.com/documentation/usernotifications
- Windows Notifications: https://docs.microsoft.com/en-us/windows/apps/design/shell/tiles-and-notifications/
- Linux libnotify: https://developer.gnome.org/libnotify/

---

## ADR-011: Packaging, Sandboxing & Permissions

**Status:** Proposed
**Date:** 2025-10-29
**Deciders:** Architect, Security Lead

### Context

Claine requires OS-level permissions for:
- File system access (local database, attachments)
- Network access (OAuth, email sync, optional cloud fallback)
- OS keychain/credential manager (OAuth tokens)
- OS notifications

Must balance functionality with security:
- Minimize permissions (principle of least privilege)
- Sandbox where possible (limit blast radius if compromised)
- Transparent to user (explain why permissions needed)

**Requirement Mapping:** ADR-005 (threat model), NFR002 (reliability - sandboxing), ADR-007 (keychain access)

### Decision

**To be determined by architecture workflow**

### Options Under Consideration

**Option A: Full Sandboxing (macOS App Sandbox, Windows AppContainer)**
- **Pros:** Maximum security, limits attack surface, required for Mac App Store
- **Cons:** Complexity of entitlements, may limit functionality (e.g., IMAP arbitrary ports)
- **Best for:** If Mac App Store distribution desired, security-first posture

**Option B: Partial Sandboxing (Electron contextIsolation + IPC whitelist)**
- **Pros:** Balance security with flexibility, easier development
- **Cons:** Less protection than full OS sandbox, requires careful IPC design
- **Best for:** MVP, direct distribution (not app stores)

**Option C: No Sandboxing**
- **Pros:** Maximum flexibility, simpler development
- **Cons:** Unacceptable security posture, full system access if compromised
- **Decision:** Rejected - not aligned with privacy-first value prop

**Option D: Do Nothing / Defer**
- Launch without sandboxing for MVP, add later
- **When this makes sense:** Private beta with trusted users
- **When this fails:** Public launch - security liability

### Required Permissions

**macOS Entitlements (if App Sandbox enabled):**
- `com.apple.security.network.client` (OAuth, email sync)
- `com.apple.security.files.user-selected.read-write` (attachments, export)
- `com.apple.security.keychain` (OAuth tokens)
- `com.apple.security.automation.apple-events` (if calendar integration post-MVP)

**Windows Permissions:**
- Network access (automatic)
- File system access (user-selected files only via OS picker)
- Credential Manager access (via DPAPI)

**Linux:**
- No formal permission system (depends on distro/DE)
- Rely on user file permissions, flatpak sandboxing (if distributed via Flatpak)

### Distribution Channels

**Option A: Direct Download (GitHub Releases, Website)**
- **Pros:** Full control, no app store fees, faster updates
- **Cons:** No app store discoverability, users must trust direct download

**Option B: App Stores (Mac App Store, Microsoft Store)**
- **Pros:** Trust (signed by Apple/Microsoft), discoverability, auto-updates built-in
- **Cons:** Approval process, 30% fee (macOS), sandboxing requirements may limit functionality

**Option C: Hybrid (Direct + App Stores)**
- **Pros:** Best of both worlds - power users use direct, mainstream use app stores
- **Cons:** Maintain two distribution channels, potential version fragmentation

**Recommendation:** Start with direct distribution (Option A) for MVP, evaluate app stores for GA based on user feedback

### Acceptance / Exit Criteria

ADR-011 is **Accepted** when:
- Sandboxing decision finalized: Full (Option A) OR partial (Option B) with IPC audit (ADR-005)
- Permissions documented: All required OS permissions listed, justification provided for each
- Permission prompts tested: User sees clear explanations (e.g., "Claine needs keychain access to store OAuth tokens")
- Distribution channel chosen: Direct download (GitHub Releases) working with code signing (ADR-006)
- IPC security audited: If partial sandboxing, IPC handlers whitelist validated (ADR-005 threat model)
- Compliance checked: If app store distribution, sandbox entitlements approved by Apple/Microsoft
- Owner sign-off: Security Lead + Architect approval with threat model review

### Operational Considerations

- **Rollout:**
  - Phase 1: Launch with partial sandboxing (Electron contextIsolation) + direct distribution
  - Phase 2: Evaluate full sandboxing (macOS App Sandbox) if Mac App Store distribution desired
  - Phase 3: Consider Flatpak (Linux) for sandboxed distribution
- **Telemetry:** Track permission denial rate (user declines keychain access, etc.), distribution channel usage
- **Observability:**
  - Log permission requests/denials, sandbox violations (if full sandboxing)
  - Alert on: High permission denial rate (UX issue), sandbox violations (security issue)
- **Fallback:**
  - If permission denied (e.g., keychain access): Fallback to master password option (ADR-007)
  - If sandboxing breaks functionality: Document exception, request entitlement (macOS) or relax sandbox
- **Support Playbook:**
  - User can't grant permission: Check OS version, system settings, provide step-by-step guide
  - Sandbox violation: Check logs, identify violating code, fix or request entitlement
  - App rejected from store: Review sandbox requirements, adjust entitlements, resubmit

### Consequences

**To be determined post-decision**

### References

- macOS App Sandbox: https://developer.apple.com/documentation/security/app_sandbox
- Electron Security: https://www.electronjs.org/docs/latest/tutorial/security
- Windows AppContainer: https://docs.microsoft.com/en-us/windows/win32/secauthz/appcontainer-isolation
- Flatpak Sandboxing: https://docs.flatpak.org/en/latest/sandbox-permissions.html

---

## ADR-012: Test Strategy & Benchmark Harness

**Status:** Proposed
**Date:** 2025-10-29
**Deciders:** Architect, QA Lead

### Context

Claine requires comprehensive testing to ensure reliability, performance, and quality:
- Unit tests (code coverage >80%)
- Integration tests (email sync, AI inference, undo flow)
- E2E tests (user workflows: connect account → triage → reply)
- Performance benchmarks (Common Benchmark Plan from this doc)
- AI quality tests (triage accuracy, draft acceptance rate)

**Requirement Mapping:** NFR002 (reliability - 99.5% crash-free), NFR005 (AI quality - >90% accuracy), All performance NFRs

### Decision

**To be determined by architecture workflow**

### Options Under Consideration

**Option A: Comprehensive Test Pyramid (Unit + Integration + E2E)**
- **Pros:** High confidence, catch regressions early, aligns with best practices
- **Cons:** Time investment, CI/CD overhead, flaky E2E tests
- **Best for:** Production-quality software, GA launch

**Option B: Focused Testing (Unit + Critical Path E2E)**
- **Pros:** Faster development, focus on high-risk areas
- **Cons:** Lower coverage, may miss edge cases
- **Best for:** MVP, time-constrained

**Option C: Manual Testing Only**
- **Pros:** No test infrastructure investment
- **Cons:** Unscalable, regression-prone, unacceptable for AI-driven features
- **Decision:** Rejected - inadequate for Claine's complexity

**Option D: Do Nothing / Defer**
- Launch without tests, fix bugs as reported
- **When this makes sense:** Never - AI autonomy requires high confidence
- **When this fails:** Always - unacceptable quality risk

### Test Coverage Targets

**Unit Tests:**
- **Coverage:** >80% line coverage, >70% branch coverage
- **Focus:** Business logic, AI triage algorithm, undo/action log, sync logic

**Integration Tests:**
- **Coverage:** All major integrations (Gmail API, Outlook Graph, IMAP, local AI, database)
- **Focus:** OAuth flow, sync incremental updates, AI inference end-to-end

**E2E Tests:**
- **Coverage:** Critical user workflows (5-10 tests)
- **Focus:**
  1. Connect Gmail account → Sync inbox → Triage works
  2. AI archives email → User undoes → Email restored
  3. Draft generation → User edits → Sends email
  4. Search 10K emails → Returns results <100ms
  5. Notification sent → User clicks → Opens email

### Benchmark Harness (Common Benchmark Plan)

**Implementation:**
- Automated benchmark suite runs on every release candidate
- Hardware cohorts: M1, i7-10700, Ryzen 5600U (3 CI runners or cloud VMs)
- Synthetic dataset: 100K emails (from Common Benchmark Plan section)
- Workloads: Cold start, inbox render, search, AI triage, sync
- Pass/fail criteria: All NFRs met (P95 latency, FPS, memory, storage)

**Reporting:**
- Benchmark results published to dashboard (Grafana or similar)
- Regression detection: Alert if any metric degrades >10% vs. previous release
- Historical trends: Track performance over time

### AI Quality Testing

**Triage Accuracy:**
- Test corpus: 1,000 manually labeled emails (ground truth)
- Metrics: Precision, recall, F1 score per category
- Target: >90% accuracy (per NFR005)

**Draft Acceptance Rate:**
- Collect user feedback: Did user send AI draft as-is, edit, or discard?
- Target: >95% acceptance (sent or edited, not discarded)

**Undo Rate:**
- Track: % of AI actions undone by user
- Target: <5% (per PRD guardrails)

### Acceptance / Exit Criteria

ADR-012 is **Accepted** when:
- Unit test suite implemented: >80% line coverage, runs in CI on every commit
- Integration test suite implemented: All major integrations covered (Gmail, Outlook, IMAP, AI, database)
- E2E test suite implemented: 5-10 critical workflows automated (Playwright or similar)
- Benchmark harness implemented: Runs on 3 hardware cohorts, validates all NFRs, publishes results
- AI quality tests implemented: Triage accuracy >90%, draft acceptance >95%, undo rate <5%
- CI/CD integrated: All tests run on PR, block merge if failing, auto-deploy if passing
- Flakiness <2%: E2E tests pass consistently (no false negatives)
- Owner sign-off: QA Lead + Architect approval with test coverage report

### Operational Considerations

- **Rollout:**
  - Phase 1: Implement unit tests + critical path E2E (5 tests) for MVP
  - Phase 2: Expand integration tests, full E2E coverage for GA
  - Phase 3: Benchmark harness automation in CI/CD
- **Telemetry:** Track test pass rate, flakiness, CI/CD pipeline duration, benchmark results
- **Observability:**
  - Dashboard: Test coverage over time, flaky tests, benchmark trends
  - Alert on: Test pass rate <95%, benchmark regression >10%, flaky test rate >5%
- **Fallback:**
  - If E2E tests too flaky: Reduce to smoke tests only, rely on manual QA
  - If benchmark harness too expensive: Run manually before major releases (not every commit)
- **Support Playbook:**
  - Test failing in CI: Check logs, reproduce locally, fix or mark flaky
  - Benchmark regression: Bisect commits, identify root cause, optimize or revert
  - AI quality degraded: Retrain model, expand test corpus, adjust thresholds

### Consequences

**To be determined post-decision**

### References

- Test Pyramid: https://martinfowler.com/articles/practical-test-pyramid.html
- Playwright E2E Testing: https://playwright.dev/
- Jest Unit Testing: https://jestjs.io/
- Benchmark.js: https://benchmarkjs.com/

---

## ADR-013: Accessibility Engineering Plan

**Status:** Proposed
**Date:** 2025-10-29
**Deciders:** Architect, UX Designer, Accessibility Specialist (if available)

### Context

Claine must meet WCAG 2.1 AA accessibility standards (NFR008):
- Keyboard navigation (no mouse required for all features)
- Screen reader support (NVDA, JAWS, VoiceOver)
- Color contrast (4.5:1 for text, 3:1 for UI elements)
- Focus management (visible focus indicators, logical tab order)
- ARIA labels for custom components

**Requirement Mapping:** NFR008 (Accessibility - WCAG 2.1 AA), FR006 (Usability - keyboard shortcuts)

### Decision

**To be determined by architecture workflow**

### Options Under Consideration

**Option A: Accessibility-First Development**
- **Pros:** Accessibility built-in from day 1, easier to maintain, aligns with best practices
- **Cons:** Requires upfront investment, team training, slower initial development
- **Best for:** If accessibility is regulatory requirement or core value

**Option B: Retrofit Post-MVP**
- **Pros:** Faster MVP delivery, focus on core features first
- **Cons:** Expensive to retrofit, technical debt, may miss critical accessibility issues
- **Best for:** Time-constrained MVP, plan to address before GA

**Option C: Minimum Viable Accessibility (Keyboard + Screen Reader Basics)**
- **Pros:** Balance speed with accessibility, covers most common needs
- **Cons:** May not meet full WCAG 2.1 AA, requires iteration
- **Best for:** MVP with commitment to expand post-launch

**Option D: Do Nothing / Defer**
- Launch without accessibility considerations
- **When this makes sense:** Never - excludes disabled users, legal risk (ADA)
- **When this fails:** Always - unacceptable ethical and legal posture

### Accessibility Features

**Keyboard Navigation (NFR008):**
- All features accessible via keyboard (no mouse required)
- Logical tab order (top-to-bottom, left-to-right)
- Keyboard shortcuts for common actions:
  - `Cmd/Ctrl + N`: Compose new email
  - `Cmd/Ctrl + R`: Reply
  - `Cmd/Ctrl + D`: Delete/Archive
  - `Cmd/Ctrl + Z`: Undo AI action
  - `Cmd/Ctrl + F`: Search
  - `Arrow keys`: Navigate inbox, threads

**Screen Reader Support (NFR008):**
- Semantic HTML (use `<button>`, `<nav>`, `<main>`, not generic `<div>`)
- ARIA labels for custom components (e.g., `aria-label="AI confidence: 85%"`)
- Live regions for dynamic updates (e.g., `aria-live="polite"` for notification toasts)
- Test with: NVDA (Windows), JAWS (Windows), VoiceOver (macOS)

**Color Contrast (NFR008):**
- Text contrast: 4.5:1 (normal text), 3:1 (large text 18pt+)
- UI element contrast: 3:1 (buttons, borders)
- Tools: Use Axe DevTools, Lighthouse to validate contrast

**Focus Management:**
- Visible focus indicators (outline or ring around focused element)
- Focus trapped in modals (can't tab out to background)
- Focus restored after modal closes (return to triggering element)

### Testing & Validation

**Automated Testing:**
- Axe DevTools: Run on every page, catch common issues (missing alt text, low contrast)
- Lighthouse CI: Automated accessibility audits in CI/CD
- Pa11y: Automated WCAG 2.1 AA validation

**Manual Testing:**
- Keyboard navigation: Complete critical workflows (compose, reply, search) without mouse
- Screen reader testing: Test with NVDA, JAWS, VoiceOver on all platforms
- User testing: Recruit users with disabilities for beta testing

**Compliance Checklist:**
- [ ] All interactive elements keyboard accessible
- [ ] All images have alt text (or `alt=""` if decorative)
- [ ] All form inputs have labels
- [ ] Color contrast meets WCAG 2.1 AA (4.5:1 text, 3:1 UI)
- [ ] Focus indicators visible on all interactive elements
- [ ] Screen reader announces page title, headings, button labels
- [ ] Dynamic content updates announced (aria-live)
- [ ] Modals trap focus, restore focus on close
- [ ] No keyboard traps (can escape all UI with keyboard)

### Acceptance / Exit Criteria

ADR-013 is **Accepted** when:
- Keyboard navigation working: All features accessible without mouse (tested manually)
- Screen reader support: VoiceOver (macOS), NVDA (Windows) can navigate all core workflows
- Color contrast validated: Axe DevTools reports 0 contrast violations
- Automated tests passing: Lighthouse accessibility score ≥90, Pa11y reports 0 WCAG 2.1 AA violations
- Accessibility audit complete: External audit (if budget allows) or internal checklist 100% complete
- User testing: ≥5 users with disabilities test beta, report no blocking issues
- Owner sign-off: UX Designer + Accessibility Specialist (if available) + Architect approval

### Operational Considerations

- **Rollout:**
  - Phase 1: Implement keyboard navigation + basic screen reader support for MVP
  - Phase 2: Full WCAG 2.1 AA compliance before GA (color contrast, ARIA labels, focus management)
  - Phase 3: Recruit users with disabilities for ongoing feedback
- **Telemetry:** Track keyboard shortcut usage, screen reader usage (via user agent), accessibility setting toggles
- **Observability:**
  - Dashboard: Accessibility issue reports over time, Lighthouse scores per release
  - Alert on: Lighthouse score drops below 90, user reports blocking accessibility issue
- **Fallback:**
  - If accessibility issue blocks user: Provide workaround, prioritize fix
  - If full WCAG compliance delayed: Ship with "Beta" label, commit to GA compliance timeline
- **Support Playbook:**
  - User reports accessibility issue: Reproduce with screen reader/keyboard, file bug, prioritize high
  - Lighthouse score drops: Review recent changes, fix violations, re-test
  - Screen reader not working: Check ARIA labels, semantic HTML, test with actual screen reader

### Consequences

**To be determined post-decision**

### References

- WCAG 2.1 Guidelines: https://www.w3.org/WAI/WCAG21/quickref/
- Axe DevTools: https://www.deque.com/axe/devtools/
- Pa11y: https://pa11y.org/
- WebAIM Contrast Checker: https://webaim.org/resources/contrastchecker/
- Inclusive Components: https://inclusive-components.design/

---

## Document Maintenance

**Update Frequency:** ADRs are updated as decisions are made during architecture and implementation phases.

**Ownership:** Architect owns this document; Lead Engineer maintains technical accuracy.

**Review Cycle:** Quarterly review to ensure ADRs reflect current state and supersede outdated decisions.

**Version Control:** All changes tracked in Git; significant decisions trigger document version bump.

---

**Next Steps:**
1. Architecture workflow to finalize ADR-001 through ADR-005
2. Create `/docs/adr/` folder for individual ADR files (optional for detailed decisions)
3. Link ADRs to epics/stories in [epics.md](./epics.md) for traceability
