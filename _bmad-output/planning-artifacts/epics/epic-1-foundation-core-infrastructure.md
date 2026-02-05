# Epic 1: Foundation & Core Infrastructure

## Expanded Goal

Building on Epic 0's PWA foundation, establish the data layer and email connectivity for Claine v2, including RxDB + IndexedDB local-first data architecture, secure OAuth email account connectivity, basic email sync capability, and enhanced developer experience tooling. This epic delivers the first functional increment: users can connect their email accounts and see messages syncing locally with full offline capability.

## Value Delivery

By the end of this epic, users can:

- Securely connect Gmail or Outlook accounts via OAuth 2.0
- See their emails syncing to local storage
- Browse synced messages (basic list view)

Development team gains:

- Automated CI/CD pipeline for continuous deployment
- Structured logging for debugging
- Error tracking for production monitoring
- Solid foundation for subsequent feature development

## Story Breakdown

**Story 1.1: [COMPLETED IN EPIC 0] Project Setup & Repository Initialization**

_This story was completed as part of Epic 0 (Infrastructure & Project Setup). Epic 0 established a Vite + React + TypeScript PWA with all modern tooling, meeting all requirements of this story._

**Satisfied by Epic 0 Stories:**

- 0-1: Vite + React + TypeScript project initialization
- 0-3: ESLint, Prettier, Husky configuration
- 0-9: Project README documentation

**Status:** ✅ Complete (via Epic 0)

---

**Story 1.2: [NOT APPLICABLE - PWA ARCHITECTURE] Electron Application Shell**

_This story is not applicable. Per architecture.md, Claine v2 uses Progressive Web App (PWA) architecture instead of Electron, chosen for lower resource usage (40-60% less memory), faster deployment, easier CASA audit, and future mobile support._

**PWA Foundation:** Established in Epic 0 with Vite + React, providing browser-based application shell with hot reload, security best practices (Content Security Policy), and cross-platform support via web standards.

**Status:** ❌ Not Applicable (PWA architecture)

---

**Story 1.3: RxDB + IndexedDB Data Layer Setup**

As a developer,
I want RxDB integrated with IndexedDB storage,
So that we have offline-first local database capability.

**Acceptance Criteria:**

1. RxDB 16.20.0 installed and configured with IndexedDB adapter
2. Basic database initialization working
3. Basic CRUD operations working (create, read, update, delete)
4. Reactive queries functional (data changes trigger UI updates)
5. Database initialization on first app launch

**Prerequisites:** Epic 0 (PWA foundation with Vite + React + TypeScript)

**Estimated Effort:** 4 hours

---

**Story 1.3B: Design RxDB Schemas for Core Entities** _(NEW - Gate-Check High Priority)_

As a developer,
I want comprehensive RxDB schemas designed for all core entities,
So that data structures are consistent and optimized before Epic 2 depends on them.

**Acceptance Criteria:**

1. Email schema defined with all fields:
   - Core: id, threadId, from, to, cc, bcc, subject, body, timestamp
   - Metadata: labels, folder, read status, starred, importance
   - Custom: attributes (user-defined key-value pairs)
   - AI: aiMetadata (triageScore, priority, suggestedAttributes, confidence, reasoning)
2. Thread schema defined:
   - id, subject, participants, messageCount, lastMessageDate, snippet
3. Workflow schema defined:
   - id, name, description, nodes (array), edges (array), triggers (array), enabled, createdAt, updatedAt
4. AI metadata schema defined:
   - id, emailId, triageScore, priority, suggestedAttributes, confidence, reasoning, modelVersion, processedAt
5. Indexes specified for performance:
   - Email: timestamp (DESC), labels, attributes, aiMetadata.priority
   - Thread: lastMessageDate (DESC), participants
   - Workflow: enabled, triggers
6. Validation rules defined (required fields, data types, constraints)
7. All schemas documented in architecture.md
8. Schemas support 100K emails per account (NFR004 validation)
9. Query performance tested: <50ms for common queries (NFR001)

**Prerequisites:** Story 1.3

**Estimated Effort:** 6 hours

---

**Story 1.3C: Implement Schema Migration Strategy** _(NEW - Gate-Check High Priority)_

As a developer,
I want a schema migration system in place,
So that we can evolve database schemas safely without data loss.

**Acceptance Criteria:**

1. Schema version tracking implemented in RxDB
2. Migration runner created (runs migrations on schema version mismatch)
3. Migration files follow naming convention: YYYYMMDD_description.ts
4. Example migration created and tested (v1 → v2)
5. Rollback mechanism implemented and tested
6. Migration documentation created in docs/ folder
7. Migration creation process documented
8. Pre-migration backup strategy implemented
9. Migration status logged (success/failure with details)

**Prerequisites:** Story 1.3B

**Estimated Effort:** 6 hours

---

**Story 1.4: OAuth 2.0 PKCE Integration for Gmail** _(EXPANDED - Gate-Check High Priority)_

As a user,
I want to securely connect my Gmail account with industry-standard security,
So that Claine can access my emails without storing my password and my tokens are protected.

**Acceptance Criteria:**

**Core OAuth Flow:**

1. Gmail OAuth 2.0 PKCE flow implemented using Google APIs Client Library
2. User redirected to Google consent screen
3. Connection success confirmation shown to user

**PKCE Security (NEW - High Priority):** 4. PKCE code verifier generated using `crypto.randomUUID()` + SHA256 hash 5. Code challenge sent to Google authorization endpoint 6. Code verifier validated on token exchange 7. PKCE flow tested and verified secure

**Token Storage & Encryption (NEW - High Priority):** 8. OAuth tokens stored in IndexedDB with Web Crypto API encryption (AES-GCM 256-bit) 9. Token encryption key derived from user session 10. Encrypted tokens cannot be read without decryption key 11. Token encryption/decryption service created (src/services/auth/tokenEncryption.ts)

**Token Refresh Strategy (NEW - High Priority):** 12. Token refresh scheduler implemented (checks expiration every 1 minute) 13. Automatic token refresh triggered 5 minutes before expiration 14. Refresh token rotation implemented (new refresh token on each refresh) 15. Token expiration detection with automatic silent refresh 16. User prompted to re-authenticate ONLY if refresh token expired 17. Refresh failures logged for debugging

**Error Handling (NEW - High Priority):** 18. OAuth error handling covers all error codes: - invalid_grant (expired refresh token → re-auth) - authorization_pending (user hasn't completed auth) - slow_down (rate limited → exponential backoff) - access_denied (user cancelled → clear error message) 19. Network errors during OAuth handled gracefully 20. Token refresh failures trigger user notification

**Security Headers (NEW - High Priority):** 21. Content Security Policy (CSP) headers configured 22. HTTPS-only enforced for OAuth redirects 23. TLS 1.3 minimum for all API calls 24. Security audit: No token leakage in console/network logs

**Testing:** 25. Unit tests for PKCE code verifier generation 26. Unit tests for token encryption/decryption 27. Unit tests for token refresh logic 28. Integration test: Full OAuth flow with PKCE 29. Security test: Verify tokens encrypted at rest

**Prerequisites:** Story 1.3C (needs IndexedDB)

**Estimated Effort:** 10 hours (was ~4 hours, now 10 hours with security expansion)

---

**Story 1.5: OAuth 2.0 Integration for Outlook**

As a user,
I want to securely connect my Outlook account,
So that Claine can access my Microsoft emails.

**Acceptance Criteria:**

1. Outlook OAuth 2.0 flow implemented using Microsoft Graph SDK
2. User redirected to Microsoft consent screen
3. OAuth tokens stored securely in OS keychain
4. Token refresh mechanism implemented
5. Error handling for OAuth failures
6. Connection success confirmation shown to user

**Prerequisites:** Story 1.4 (reuse OAuth infrastructure)

---

**Story 1.6: [SPLIT INTO 1.6A, 1.6B, 1.6C] Basic Email Sync Engine**

_This story was identified as too large during implementation and split into three focused sub-stories for better manageability and risk mitigation._

**Status:** ⚠️ Split (see Stories 1.6A, 1.6B, 1.6C below)

---

**Story 1.6A: Gmail Sync Engine (Core)**

As a user,
I want my Gmail emails to sync from my connected account to local storage,
So that I can access them offline.

**Acceptance Criteria:**

1. Initial sync downloads last 90 days of emails (configurable via VITE_SYNC_DAYS_INITIAL)
2. Progress indicator shows sync status and estimated time (±10% accuracy)
3. Emails stored in RxDB with proper indexing (timestamp DESC, labels, threadId)
4. Incremental sync fetches new emails every 2-5 minutes when online
5. Sync respects Gmail API rate limits (250 quota units/second)
6. Graceful handling of network interruptions (resume sync when online)
7. Emails associated with correct OAuth account (multi-account support)

**Technical Implementation:**

- Use existing rate limiter and sync progress services (from Story 1.6 foundation)
- Gmail History API for delta sync (historyId-based)
- Network resilience with online/offline event detection
- Persist sync state in RxDB for resume capability

**Prerequisites:** Story 1.4 (Gmail OAuth), Story 1.3E (Migration system)

**Estimated Effort:** 3-4 days

---

**Story 1.6B: Outlook Sync Engine**

As a user,
I want my Outlook emails to sync from my connected account to local storage,
So that I can access them offline.

**Acceptance Criteria:**

1. Initial sync downloads last 90 days of emails (configurable via VITE_SYNC_DAYS_INITIAL)
2. Progress indicator shows sync status and estimated time (±10% accuracy)
3. Emails stored in RxDB with proper indexing (timestamp DESC, labels, threadId)
4. Incremental sync fetches new emails every 2-5 minutes when online
5. Sync respects Microsoft Graph API rate limits (10 requests/second)
6. Graceful handling of network interruptions (resume sync when online)
7. Emails associated with correct OAuth account (multi-account support)
8. Multi-account sync runs independently per account

**Technical Implementation:**

- Microsoft Graph Delta Query for incremental sync
- Reuse sync progress and rate limiting infrastructure from 1.6A
- Independent sync workers per account

**Prerequisites:** Story 1.5 (Outlook OAuth), Story 1.6A (Gmail sync establishes patterns)

**Estimated Effort:** 2-3 days

---

**Story 1.6C: OAuth E2E Tests & Re-Auth Notification UI**

As a developer,
I want comprehensive OAuth E2E tests and re-auth UI,
So that token refresh and re-authentication flows work reliably.

**Acceptance Criteria:**

1. OAuth E2E test for Gmail flow (deferred technical debt from Story 1.4)
2. OAuth E2E test for Outlook flow (deferred technical debt from Story 1.5)
3. Token refresh during sync operations tested end-to-end
4. Sync with expired tokens triggers re-auth (tested)
5. User re-auth notification UI component created
6. Notification integrates with tokenRefreshService callback system
7. Clear message shown when refresh token expired
8. "Re-authenticate" button initiates OAuth flow
9. Notification appears when token refresh fails (tested)

**Technical Implementation:**

- Playwright E2E tests for both OAuth providers
- React notification component with token refresh callback integration
- Test coverage for token expiry scenarios

**Prerequisites:** Story 1.4, 1.5, 1.6A, 1.6B

**Estimated Effort:** 2 days

---

**Story 1.7: Basic Email List View UI**

As a user,
I want to see a list of my synced emails,
So that I can browse my messages.

**Acceptance Criteria:**

1. Email list displays sender, subject, date, read/unread status
2. List sorted by date (newest first)
3. Unread emails visually distinguished (bold text or indicator)
4. Clicking email opens it (basic detail view - Story 2.x)
5. Empty state shown when no emails synced yet
6. Loading state shown during initial sync

**Prerequisites:** Story 1.6

---

**Story 1.8: Multi-Account Management**

As a user,
I want to connect up to 3 email accounts,
So that I can manage multiple inboxes in one place.

**Acceptance Criteria:**

1. Account switcher UI implemented (dropdown or sidebar)
2. Each account syncs independently
3. RxDB collections properly scoped by account
4. User can switch between accounts seamlessly
5. Account connection limit enforced (max 3 accounts)
6. Clear indication of which account is currently active

**Prerequisites:** Story 1.5, 1.6, 1.7

**Estimated Effort:** 6 hours

---

**Story 1.9: Implement Sync Conflict Detection and Resolution** _(NEW - Gate-Check High Priority)_

As a user,
I want sync conflicts handled automatically when possible,
So that I don't lose data when local and server changes conflict.

**Acceptance Criteria:**

**Conflict Detection:**

1. Conflict detected when local change timestamp > server change timestamp
2. Conflict detection runs on every sync operation
3. Conflicts logged to RxDB audit table with details

**Conflict Resolution Strategies:** 4. Last-write-wins applied for metadata (read status, starred, archived) 5. Merge strategy applied for labels/attributes (union of both sets) 6. User prompted with diff view for body/subject conflicts 7. User can choose: Keep Local, Keep Server, or Merge manually

**User Experience:** 8. Conflict resolution UI shows:

- Local version with timestamp
- Server version with timestamp
- Side-by-side diff highlighting changes

9. Conflict resolution decisions saved for similar future conflicts
10. User can review conflict history in settings

**Audit & Logging:** 11. All conflicts logged to RxDB with resolution strategy used 12. Conflict statistics displayed in settings (total, auto-resolved, manual)

**Testing:** 13. Test: Read status conflict → last-write-wins 14. Test: Labels conflict → merge (union) 15. Test: Body conflict → user prompt shown 16. Test: User resolves conflict → correct version saved

**Prerequisites:** Story 1.6 (Basic Email Sync)

**Estimated Effort:** 8 hours

---

**Story 1.10: Handle Partial Sync Failures with Retry Logic** _(NEW - Gate-Check High Priority)_

As a user,
I want sync to retry automatically when network issues occur,
So that temporary failures don't block my email access.

**Acceptance Criteria:**

**Exponential Backoff Retry:**

1. Failed sync operations retry with exponential backoff (1s, 2s, 4s, 8s, 16s)
2. Maximum 5 retry attempts before giving up
3. Retry logic applied to all network operations (fetch, send, delete)

**Sync Queue:** 4. Sync queue created in RxDB for failed operations 5. Queue persisted across app restarts 6. Queue processed on network reconnection 7. Queue displays in UI with status (pending, retrying, failed)

**User Notifications:** 8. User notified after 5 failed retry attempts with:

- Clear error message
- Manual retry button
- Option to view sync queue

9. Success notification shown when retries succeed

**Network Handling:** 10. Network status detected (online/offline) 11. Sync paused when offline, resumed when online 12. Partial sync doesn't block full sync completion 13. User can manually trigger sync from UI

**Testing:** 14. Test: Network interruption during sync → retry with backoff 15. Test: 5 retries fail → user notification shown 16. Test: Network restored → queue processed successfully 17. Test: App restart → queue persists and resumes

**Prerequisites:** Story 1.6, 1.9

**Estimated Effort:** 8 hours

---

**Story 1.11: Implement Quota Management (IndexedDB + Gmail API)** _(NEW - Gate-Check High Priority)_

As a user,
I want to be warned before storage quotas are exceeded,
So that I can manage storage and avoid sync failures.

**Acceptance Criteria:**

**IndexedDB Quota Monitoring:**

1. StorageManager API used to monitor IndexedDB usage
2. Current usage and available quota displayed in settings
3. Usage percentage calculated and shown (e.g., "Using 45% of 2 GB")
4. Warning shown at 80% quota: "Storage almost full - cleanup recommended"
5. Cleanup flow triggered at 90% quota

**Email Cleanup Flow:** 6. Cleanup wizard shows storage breakdown by:

- Account (which accounts use most storage)
- Age (emails older than 1 year, 2 years, etc.)
- Size (emails with large attachments)

7. User can select cleanup criteria (e.g., "Delete emails >2 years old")
8. Cleanup preview shows how much space will be freed
9. Cleanup executed with confirmation
10. Cleanup reduces storage by at least 20%

**Gmail API Rate Limit Handling:** 11. Gmail API quota tracked (250 quota units/user/second) 12. API calls throttled to stay under rate limits 13. Rate limit queue implemented (delays requests if limit approaching) 14. Rate limit errors (429) handled with exponential backoff

**User Experience:** 15. Storage widget in settings shows real-time usage 16. Rate limit status shown in settings (if applicable) 17. User can manually check storage/quota status

**Testing:** 18. Test: 80% quota reached → warning shown 19. Test: 90% quota reached → cleanup wizard shown 20. Test: Cleanup executed → storage reduced by 20%+ 21. Test: Rate limit approached → requests throttled 22. Test: Rate limit error (429) → exponential backoff applied

**Prerequisites:** Story 1.6, 1.10

**Estimated Effort:** 10 hours

---

**Story 1.12: Configure Bundle Analysis and Size Budgets** _(NEW - Gate-Check Medium Priority)_

As a developer,
I want bundle size monitoring beyond Epic 0 basic setup,
So that we can track bundle growth as features are added.

**Acceptance Criteria:**

1. Bundle analysis integrated into Epic 1 build process
2. Per-feature bundle size tracked:
   - Auth module size
   - RxDB/database module size
   - Sync engine size
3. Bundle size trend chart generated (shows growth over time)
4. Automated alerts if any module exceeds budget
5. Bundle size documented in Epic 1 completion report

**Prerequisites:** Epic 0 Story 0.10 (basic bundle analysis)

**Estimated Effort:** 3 hours

---

**Story 1.13: CI/CD Pipeline Setup** _(RENUMBERED - was 1.9, NOTE: Epic 0 handles basic CI/CD)_

As a developer,
I want Epic 1-specific CI/CD enhancements,
So that Epic 1 features are tested automatically.

**Acceptance Criteria:**

1. Epic 0 CI/CD pipeline extended with Epic 1 tests
2. OAuth integration tests run in CI
3. RxDB schema validation tests run in CI
4. Sync engine tests run in CI with mock email server
5. Performance tests for sync (time to sync 1000 emails)

**Prerequisites:** Epic 0 Story 0.6, Story 1.6

**Estimated Effort:** 3 hours (reduced - Epic 0 handles base CI/CD)

---

**Story 1.14: Logging & Error Tracking Infrastructure** _(RENUMBERED - was 1.10)_

As a developer,
I want structured logging and error tracking,
So that I can debug issues and monitor production health.

**Acceptance Criteria:**

1. Winston or Pino configured for structured logging
2. Log levels properly configured (debug, info, warn, error)
3. Logs written to file in user's app data directory
4. Sentry integrated for error tracking (privacy-preserving mode)
5. Unhandled exceptions and promise rejections caught and reported
6. User-identifiable information sanitized from error reports

**Prerequisites:** Epic 0 (PWA foundation)

---

**Story 1.15: Adaptive Sync Polling Intervals** _(NEW - Correct Course / Superhuman Analysis)_

As a user,
I want sync frequency to adapt based on my account activity,
So that active inboxes update faster and idle accounts don't waste resources.

**Context:** Claine uses a fixed 180s polling interval for all accounts. Superhuman uses 7 different intervals (10s-1h) with adaptive throttling based on activity. A simple heuristic approach gives most of the benefit without Superhuman's complexity.

**Acceptance Criteria:**

**Adaptive Interval Logic:**

1. Default interval remains 180s (3 min) as baseline
2. Interval shortened to 60s when recent activity detected (new messages in last sync)
3. Interval extended to 300s when no new messages for 3+ consecutive syncs
4. Interval extended to 600s when no new messages for 10+ consecutive syncs
5. Interval resets to 60s immediately when user performs an action (send, archive, label)

**Per-Account Tracking:** 6. Each connected account tracks its own activity heuristic independently 7. Activity counter (consecutive syncs with no changes) persisted in sync state 8. Account switching triggers an immediate sync for the selected account

**Configuration:** 9. Adaptive polling can be disabled in settings (reverts to fixed interval) 10. Min/max interval bounds configurable via environment variables

**Testing:** 11. Test: Active account (new messages each sync) → interval shortens to 60s 12. Test: Idle account (no messages for 10 syncs) → interval extends to 600s 13. Test: User action → interval resets to 60s 14. Test: Multiple accounts adapt independently

**Prerequisites:** Story 1.6A, 1.6B (sync engines)

**Estimated Effort:** 4 hours

---

**Story 1.16: Sync Bankruptcy Detection** _(NEW - Correct Course / Superhuman Analysis)_

As a user,
I want sync to detect when catching up via delta is slower than starting fresh,
So that I get my emails faster after extended offline periods.

**Context:** Superhuman implements "sync bankruptcy" — when data is too far behind, it abandons incremental catch-up and performs a clean full re-sync. Claine currently always attempts delta sync regardless of staleness, which can be slower for extended offline periods.

**Acceptance Criteria:**

**Staleness Detection:**

1. Before attempting delta sync, check time since last successful sync
2. If last sync was >7 days ago, trigger bankruptcy evaluation
3. Bankruptcy threshold configurable per provider (Gmail default: 7 days, Outlook default: 7 days)

**Bankruptcy Decision:** 4. When bankruptcy triggered, compare estimated delta catch-up cost vs fresh sync cost 5. Gmail: If historyId gap > 10,000, prefer fresh sync (last 90 days) 6. Outlook: If deltaLink returns 410 Gone, this already triggers fresh sync (existing behavior) 7. Log bankruptcy decision with reason for debugging

**Fresh Sync Flow:** 8. Clear stale local data for the affected account before fresh sync 9. Show user notification: "Syncing fresh copy of your emails (you were offline for a while)" 10. Preserve user-created local data (drafts, custom attributes) during fresh sync 11. Progress indicator shows fresh sync status

**Testing:** 12. Test: Last sync <7 days ago → normal delta sync proceeds 13. Test: Last sync >7 days ago with large gap → bankruptcy triggered, fresh sync starts 14. Test: Local drafts preserved during fresh sync 15. Test: User notification shown during bankruptcy recovery

**Prerequisites:** Story 1.6A, 1.6B (sync engines)

**Estimated Effort:** 4 hours

---

**Story 1.17: Sync Interval Jitter** _(NEW - Correct Course / Superhuman Analysis)_

As a developer,
I want sync intervals to include random jitter,
So that multiple accounts don't create correlated API burst pressure.

**Context:** When multiple accounts have the same polling interval, their timers can align and fire simultaneously, creating API request spikes. Superhuman adds jitter to prevent thundering herd effects. This is a small but effective reliability improvement.

**Acceptance Criteria:**

1. Each sync timer adds ±15% random jitter to the configured interval
2. Jitter recalculated on each timer reset (not fixed per account)
3. Example: 180s interval → actual interval randomly between 153s and 207s
4. Jitter applied after adaptive interval calculation (Story 1.15)
5. Jitter does not apply to user-triggered manual syncs (immediate execution)

**Testing:** 6. Test: Two accounts with same interval don't sync at exactly the same time 7. Test: Jitter stays within ±15% bounds 8. Test: Manual sync bypasses jitter (fires immediately)

**Prerequisites:** Story 1.6A, 1.6B (sync engines)

**Estimated Effort:** 1 hour

---

**Story 1.18: Batched Reactive Query Triggers** _(NEW - Correct Course / Superhuman Analysis)_

As a developer,
I want reactive query updates batched during bulk operations,
So that initial sync and bulk actions don't cause excessive re-renders.

**Context:** Claine's `createReactiveQuery` triggers a UI update on every RxDB write. During initial sync (writing hundreds of emails) or bulk actions (archiving 50 emails), this causes hundreds of sequential re-renders. Superhuman solves this with a `needs_render` bridge that batches changes. Claine can achieve the same effect by debouncing the reactive subscription layer without changing the underlying RxDB architecture.

**Acceptance Criteria:**

**Batch Window:**

1. Reactive query subscriptions collect changes within a configurable batch window (default 100ms)
2. After the batch window closes, a single update is emitted with all accumulated changes
3. Batch window resets on each new change (trailing debounce behavior)
4. Maximum batch window cap of 500ms to prevent indefinite buffering during continuous writes

**Selective Batching:** 5. Batching enabled automatically during bulk operations (initial sync, bulk actions) 6. Single-item operations (user archives one email) bypass batching for instant feedback 7. A `batchMode` flag on the reactive query context controls this behavior

**Performance Targets:** 8. Initial sync of 500 emails triggers <10 render cycles (not 500) 9. Bulk archive of 50 emails triggers 1-2 render cycles (not 50) 10. Single-item actions still update UI within 16ms (one frame)

**Testing:** 11. Test: Bulk insert of 100 documents → single batched render update 12. Test: Single document insert → immediate render update (no batching delay) 13. Test: Batch window capped at 500ms during continuous writes 14. Test: No data loss — all changes reflected after batch completes

**Prerequisites:** Story 1.3 (RxDB data layer)

**Estimated Effort:** 4 hours

---

**Story 1.19: Circuit Breaker for Provider APIs** _(NEW - Correct Course / Superhuman Analysis)_

As a user,
I want the app to stop hammering a failing email provider and recover gracefully,
So that I don't see repeated error toasts and my rate limit tokens aren't wasted.

**Context:** Claine's retry engine retries each queued operation independently. If Gmail's API is down, 20 queued actions each independently discover this by failing and retrying — that's up to 80 wasted API calls against a known-failing service. Superhuman uses circuit breakers to detect provider-level failures, halt all operations for a cooldown, then probe with a single request before resuming. This is a standard resilience pattern from distributed systems.

**Acceptance Criteria:**

**Circuit States:**

1. Circuit breaker tracks three states per provider: Closed (healthy), Open (failing), Half-Open (probing)
2. **Closed → Open:** After 5 consecutive failures or 3 failures within 60 seconds against the same provider
3. **Open state:** All operations for that provider are immediately queued (not attempted) for a cooldown period
4. Cooldown period: 60 seconds (configurable per provider)
5. **Open → Half-Open:** After cooldown expires, allow a single probe request through
6. **Half-Open → Closed:** If probe succeeds, resume normal operation and drain queued items
7. **Half-Open → Open:** If probe fails, reset cooldown timer

**Provider Isolation:** 8. Each provider (Gmail, Outlook) has its own independent circuit breaker 9. Gmail circuit opening does not affect Outlook operations (and vice versa) 10. Circuit state persisted in memory (not RxDB — resets on app restart, which is correct behavior)

**User Experience:** 11. When circuit opens, show provider-specific status: "Gmail temporarily unavailable — retrying in 45s" 12. Countdown timer visible so user knows when retry will happen 13. User can manually force a probe attempt (bypass cooldown) 14. When circuit closes (recovery), show brief success notification: "Gmail connection restored"

**Integration:** 15. Circuit breaker wraps the existing rate limiter and retry engine (not a replacement) 16. Action queue and sync engine both check circuit state before attempting operations 17. Send queue checks circuit state but allows user to force-send (bypasses circuit for explicit user action)

**Testing:** 18. Test: 5 consecutive Gmail failures → circuit opens, operations queued 19. Test: Cooldown expires → single probe sent, success → circuit closes, queue drains 20. Test: Probe fails → circuit stays open, cooldown resets 21. Test: Gmail circuit open → Outlook operations unaffected 22. Test: User force-send bypasses open circuit 23. Test: App restart → circuit resets to Closed (clean slate)

**Prerequisites:** Story 1.10 (retry logic), Story 1.6A/1.6B (sync engines)

**Estimated Effort:** 6 hours

---

**Story 1.20: Subsystem Health Tracking** _(NEW - Correct Course / Superhuman Analysis)_

As a user,
I want to see which parts of the app are working and which are degraded,
So that I understand what's happening instead of seeing generic errors.

**Context:** Superhuman tracks health at the subsystem level and communicates degraded states to the user. Claine currently reports errors per-operation, which doesn't give users a clear picture of overall system state. Subsystem health tracking provides the foundation for progressive recovery (future enhancement) and integrates with the circuit breaker (Story 1.19) to present coherent status.

**Acceptance Criteria:**

**Health Registry:**

1. Central health registry tracks status of each subsystem: sync (per provider), action queue, send queue, search index, database
2. Each subsystem reports one of: Healthy, Degraded, Unavailable
3. **Healthy:** All operations succeeding normally
4. **Degraded:** Some failures detected, operations partially working (e.g., circuit half-open, retry in progress)
5. **Unavailable:** Subsystem not functioning (e.g., circuit open, database init failed)

**Health Signals:** 6. Circuit breaker state feeds into health status (Open → Unavailable, Half-Open → Degraded, Closed → Healthy) 7. Retry engine failure rate feeds into health status (>50% failure rate in last 5 min → Degraded) 8. Network status feeds into health status (offline → all remote subsystems Degraded) 9. Health status updates debounced (don't flicker between states on transient errors)

**User-Facing Status:** 10. Health summary accessible from app header (subtle indicator, not intrusive) 11. Healthy state: no indicator shown (clean UI when everything works) 12. Degraded state: yellow indicator with tooltip showing which subsystem and why 13. Unavailable state: red indicator with expandable detail panel 14. Detail panel shows per-subsystem status with last error and next retry time

**Developer/Debug Access:** 15. Full health history (last 50 state changes) accessible via settings/debug panel 16. Health state changes logged to console in development mode

**Testing:** 17. Test: All subsystems healthy → no indicator shown 18. Test: Gmail circuit opens → indicator shows "Gmail sync: unavailable" 19. Test: Network offline → indicator shows "Sync: degraded (offline)" 20. Test: Recovery → indicator disappears after subsystem returns to healthy 21. Test: Multiple degraded subsystems → all listed in detail panel

**Prerequisites:** Story 1.19 (circuit breaker), Story 1.14 (logging infrastructure)

**Estimated Effort:** 5 hours

---
