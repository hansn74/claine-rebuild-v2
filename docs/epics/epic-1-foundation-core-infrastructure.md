# Epic 1: Foundation & Core Infrastructure

## Expanded Goal

Establish the technical foundation for Claine v2, including project infrastructure, local-first data architecture using RxDB + IndexedDB, secure OAuth email account connectivity, basic email sync capability, and developer experience tooling (CI/CD, logging, error tracking). This epic delivers the first deployable increment: users can connect their email accounts and see messages syncing locally, while the development team has automated pipelines for rapid iteration.

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

**Story 1.1: Project Setup & Repository Initialization**

As a developer,
I want a properly structured monorepo with modern tooling,
So that the team can develop efficiently with consistent standards.

**Acceptance Criteria:**
1. Repository initialized with Git, proper .gitignore, and README
2. Monorepo structure using Turborepo or pnpm workspaces
3. TypeScript configured with strict mode
4. ESLint and Prettier configured for code quality
5. Package.json scripts for common tasks (dev, build, test, lint)
6. Basic project documentation in README

**Prerequisites:** None (first story)

---

**Story 1.2: Electron Application Shell**

As a developer,
I want a basic Electron application shell running,
So that we have a desktop application foundation to build upon.

**Acceptance Criteria:**
1. Electron main process and renderer process configured
2. Basic window creation with proper dimensions (1440x900 minimum)
3. Security best practices implemented (contextIsolation, nodeIntegration disabled)
4. IPC communication channel established between main and renderer
5. Application launches successfully on macOS, Windows, Linux
6. Hot reload working in development mode

**Prerequisites:** Story 1.1

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

**Prerequisites:** Story 1.2 (or Epic 0 if using PWA architecture)

**Estimated Effort:** 4 hours

---

**Story 1.3B: Design RxDB Schemas for Core Entities** *(NEW - Gate-Check High Priority)*

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

**Story 1.3C: Implement Schema Migration Strategy** *(NEW - Gate-Check High Priority)*

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

**Story 1.4: OAuth 2.0 PKCE Integration for Gmail** *(EXPANDED - Gate-Check High Priority)*

As a user,
I want to securely connect my Gmail account with industry-standard security,
So that Claine can access my emails without storing my password and my tokens are protected.

**Acceptance Criteria:**

**Core OAuth Flow:**
1. Gmail OAuth 2.0 PKCE flow implemented using Google APIs Client Library
2. User redirected to Google consent screen
3. Connection success confirmation shown to user

**PKCE Security (NEW - High Priority):**
4. PKCE code verifier generated using `crypto.randomUUID()` + SHA256 hash
5. Code challenge sent to Google authorization endpoint
6. Code verifier validated on token exchange
7. PKCE flow tested and verified secure

**Token Storage & Encryption (NEW - High Priority):**
8. OAuth tokens stored in IndexedDB with Web Crypto API encryption (AES-GCM 256-bit)
9. Token encryption key derived from user session
10. Encrypted tokens cannot be read without decryption key
11. Token encryption/decryption service created (src/services/auth/tokenEncryption.ts)

**Token Refresh Strategy (NEW - High Priority):**
12. Token refresh scheduler implemented (checks expiration every 1 minute)
13. Automatic token refresh triggered 5 minutes before expiration
14. Refresh token rotation implemented (new refresh token on each refresh)
15. Token expiration detection with automatic silent refresh
16. User prompted to re-authenticate ONLY if refresh token expired
17. Refresh failures logged for debugging

**Error Handling (NEW - High Priority):**
18. OAuth error handling covers all error codes:
    - invalid_grant (expired refresh token → re-auth)
    - authorization_pending (user hasn't completed auth)
    - slow_down (rate limited → exponential backoff)
    - access_denied (user cancelled → clear error message)
19. Network errors during OAuth handled gracefully
20. Token refresh failures trigger user notification

**Security Headers (NEW - High Priority):**
21. Content Security Policy (CSP) headers configured
22. HTTPS-only enforced for OAuth redirects
23. TLS 1.3 minimum for all API calls
24. Security audit: No token leakage in console/network logs

**Testing:**
25. Unit tests for PKCE code verifier generation
26. Unit tests for token encryption/decryption
27. Unit tests for token refresh logic
28. Integration test: Full OAuth flow with PKCE
29. Security test: Verify tokens encrypted at rest

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

**Story 1.6: Basic Email Sync Engine**

As a user,
I want my emails to sync from my connected account to local storage,
So that I can access them offline.

**Acceptance Criteria:**
1. Initial sync downloads last 90 days of emails (configurable)
2. Progress indicator shows sync status and estimated time (±10% accuracy)
3. Emails stored in RxDB with proper indexing
4. Incremental sync fetches new emails every 2-5 minutes when online
5. Sync respects API rate limits (Gmail: 250 quotas/day)
6. Graceful handling of network interruptions (resume sync when online)

**Prerequisites:** Story 1.4 or 1.5, Story 1.3

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

**Story 1.9: Implement Sync Conflict Detection and Resolution** *(NEW - Gate-Check High Priority)*

As a user,
I want sync conflicts handled automatically when possible,
So that I don't lose data when local and server changes conflict.

**Acceptance Criteria:**

**Conflict Detection:**
1. Conflict detected when local change timestamp > server change timestamp
2. Conflict detection runs on every sync operation
3. Conflicts logged to RxDB audit table with details

**Conflict Resolution Strategies:**
4. Last-write-wins applied for metadata (read status, starred, archived)
5. Merge strategy applied for labels/attributes (union of both sets)
6. User prompted with diff view for body/subject conflicts
7. User can choose: Keep Local, Keep Server, or Merge manually

**User Experience:**
8. Conflict resolution UI shows:
   - Local version with timestamp
   - Server version with timestamp
   - Side-by-side diff highlighting changes
9. Conflict resolution decisions saved for similar future conflicts
10. User can review conflict history in settings

**Audit & Logging:**
11. All conflicts logged to RxDB with resolution strategy used
12. Conflict statistics displayed in settings (total, auto-resolved, manual)

**Testing:**
13. Test: Read status conflict → last-write-wins
14. Test: Labels conflict → merge (union)
15. Test: Body conflict → user prompt shown
16. Test: User resolves conflict → correct version saved

**Prerequisites:** Story 1.6 (Basic Email Sync)

**Estimated Effort:** 8 hours

---

**Story 1.10: Handle Partial Sync Failures with Retry Logic** *(NEW - Gate-Check High Priority)*

As a user,
I want sync to retry automatically when network issues occur,
So that temporary failures don't block my email access.

**Acceptance Criteria:**

**Exponential Backoff Retry:**
1. Failed sync operations retry with exponential backoff (1s, 2s, 4s, 8s, 16s)
2. Maximum 5 retry attempts before giving up
3. Retry logic applied to all network operations (fetch, send, delete)

**Sync Queue:**
4. Sync queue created in RxDB for failed operations
5. Queue persisted across app restarts
6. Queue processed on network reconnection
7. Queue displays in UI with status (pending, retrying, failed)

**User Notifications:**
8. User notified after 5 failed retry attempts with:
   - Clear error message
   - Manual retry button
   - Option to view sync queue
9. Success notification shown when retries succeed

**Network Handling:**
10. Network status detected (online/offline)
11. Sync paused when offline, resumed when online
12. Partial sync doesn't block full sync completion
13. User can manually trigger sync from UI

**Testing:**
14. Test: Network interruption during sync → retry with backoff
15. Test: 5 retries fail → user notification shown
16. Test: Network restored → queue processed successfully
17. Test: App restart → queue persists and resumes

**Prerequisites:** Story 1.6, 1.9

**Estimated Effort:** 8 hours

---

**Story 1.11: Implement Quota Management (IndexedDB + Gmail API)** *(NEW - Gate-Check High Priority)*

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

**Email Cleanup Flow:**
6. Cleanup wizard shows storage breakdown by:
   - Account (which accounts use most storage)
   - Age (emails older than 1 year, 2 years, etc.)
   - Size (emails with large attachments)
7. User can select cleanup criteria (e.g., "Delete emails >2 years old")
8. Cleanup preview shows how much space will be freed
9. Cleanup executed with confirmation
10. Cleanup reduces storage by at least 20%

**Gmail API Rate Limit Handling:**
11. Gmail API quota tracked (250 quota units/user/second)
12. API calls throttled to stay under rate limits
13. Rate limit queue implemented (delays requests if limit approaching)
14. Rate limit errors (429) handled with exponential backoff

**User Experience:**
15. Storage widget in settings shows real-time usage
16. Rate limit status shown in settings (if applicable)
17. User can manually check storage/quota status

**Testing:**
18. Test: 80% quota reached → warning shown
19. Test: 90% quota reached → cleanup wizard shown
20. Test: Cleanup executed → storage reduced by 20%+
21. Test: Rate limit approached → requests throttled
22. Test: Rate limit error (429) → exponential backoff applied

**Prerequisites:** Story 1.6, 1.10

**Estimated Effort:** 10 hours

---

**Story 1.12: Configure Bundle Analysis and Size Budgets** *(NEW - Gate-Check Medium Priority)*

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

**Story 1.13: CI/CD Pipeline Setup** *(RENUMBERED - was 1.9, NOTE: Epic 0 handles basic CI/CD)*

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

**Story 1.14: Logging & Error Tracking Infrastructure** *(RENUMBERED - was 1.10)*

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

**Prerequisites:** Story 1.2

---
