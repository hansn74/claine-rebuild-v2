# Story 1.6: Basic Email Sync Engine

**Story ID:** 1-6-basic-email-sync-engine
**Epic:** Epic 1 - Foundation & Core Infrastructure
**Status:** needs-split
**Priority:** High
**Created:** 2025-11-21

## Story

As a user,
I want my emails to sync from my connected account to local storage,
So that I can access them offline.

## Acceptance Criteria

**AC 1:** Initial sync downloads last 90 days of emails (configurable via environment variable)
**AC 2:** Progress indicator shows sync status and estimated time (±10% accuracy)
**AC 3:** Emails stored in RxDB with proper indexing (timestamp DESC, labels, threadId)
**AC 4:** Incremental sync fetches new emails every 2-5 minutes when online
**AC 5:** Sync respects API rate limits (Gmail: 250 quotas/second, Outlook: 10 requests/second)
**AC 6:** Graceful handling of network interruptions (resume sync when online)
**AC 7:** OAuth E2E tests implemented for both Gmail and Outlook (deferred from Stories 1.4 and 1.5)
**AC 8:** Sync engine handles both Gmail API and Microsoft Graph API
**AC 9:** Emails associated with correct OAuth account (multi-account support)
**AC 10:** User re-auth notification UI implemented (deferred technical debt from Story 1.4)

## Tasks / Subtasks

### Planning & Architecture

- [ ] Review email sync patterns and best practices (AC: 1, 4)
  - [ ] Research Gmail API batch operations and pagination
  - [ ] Research Microsoft Graph API delta sync patterns
  - [ ] Design sync state management (last sync timestamp, sync status)
  - [ ] Define sync worker architecture (background vs foreground)

### RxDB Schema Integration

- [ ] Verify email schema from Story 1.3B supports sync requirements (AC: 3)
  - [ ] Confirm all required fields present (id, threadId, from, to, subject, body, timestamp, labels)
  - [ ] Verify indexes support sync queries (timestamp DESC, labels, threadId)
  - [ ] Test schema with sample email data

### Gmail Sync Implementation

- [ ] Implement Gmail sync service (AC: 1, 3, 4, 5, 8)
  - [ ] Create `src/services/sync/gmailSync.ts`
  - [ ] Implement initial sync (last 90 days, configurable)
  - [ ] Implement incremental sync (2-5 minute polling)
  - [ ] Implement Gmail API rate limiting (250 quotas/second)
  - [ ] Parse Gmail message format to RxDB schema
  - [ ] Store emails in RxDB with proper indexing
  - [ ] Associate emails with Gmail account ID

### Outlook Sync Implementation

- [ ] Implement Outlook sync service (AC: 1, 3, 4, 5, 8)
  - [ ] Create `src/services/sync/outlookSync.ts`
  - [ ] Implement initial sync using Microsoft Graph delta query
  - [ ] Implement incremental sync (2-5 minute polling)
  - [ ] Implement Microsoft Graph rate limiting (10 requests/second)
  - [ ] Parse Microsoft Graph message format to RxDB schema
  - [ ] Store emails in RxDB with proper indexing
  - [ ] Associate emails with Outlook account ID

### Sync Progress & Status

- [ ] Implement sync progress tracking (AC: 2)
  - [ ] Create sync status RxDB collection (status, progress, estimatedTime, errors)
  - [ ] Calculate progress percentage (emails synced / total emails)
  - [ ] Estimate remaining time based on sync rate (±10% accuracy)
  - [ ] Emit sync progress events for UI consumption
  - [ ] Store sync state for resume after interruption

### Network Resilience

- [ ] Implement network interruption handling (AC: 6)
  - [ ] Detect network status (online/offline events)
  - [ ] Pause sync when offline
  - [ ] Resume sync when online (continue from last synced email)
  - [ ] Persist sync state across app restarts
  - [ ] Handle partial sync failures gracefully

### Multi-Account Support

- [ ] Implement account-scoped sync (AC: 9)
  - [ ] Associate each email with account ID
  - [ ] Run sync workers independently per account
  - [ ] Store account sync state separately
  - [ ] Prevent cross-account data leakage

### OAuth Integration & Testing

- [ ] Implement OAuth E2E tests (AC: 7)
  - [ ] Create E2E test for Gmail OAuth flow (deferred from Story 1.4)
  - [ ] Create E2E test for Outlook OAuth flow (deferred from Story 1.5)
  - [ ] Test token refresh during sync operations
  - [ ] Test sync with expired tokens (triggers re-auth)

### User Re-Auth Notification UI

- [ ] Implement re-auth notification UI (AC: 10, deferred from Story 1.4)
  - [ ] Create notification component for expired tokens
  - [ ] Integrate with tokenRefreshService callback system
  - [ ] Show clear message when refresh token expired
  - [ ] Provide "Re-authenticate" button to initiate OAuth flow
  - [ ] Test notification appears when refresh fails

### Testing

- [ ] Write unit tests for sync services (AC: 1-9)
  - [ ] Test Gmail sync service methods
  - [ ] Test Outlook sync service methods
  - [ ] Test rate limiting logic
  - [ ] Test network interruption handling
  - [ ] Test progress calculation accuracy (±10%)
  - [ ] Mock Gmail API and Microsoft Graph API responses

- [ ] Write integration tests (AC: 7, 8, 9)
  - [ ] Test full sync flow with mocked APIs
  - [ ] Test incremental sync behavior
  - [ ] Test multi-account sync isolation
  - [ ] Test sync resume after network interruption

### Documentation

- [ ] Document sync architecture
  - [ ] Update architecture.md with sync engine design
  - [ ] Document Gmail API integration patterns
  - [ ] Document Microsoft Graph API integration patterns
  - [ ] Document rate limiting strategies
  - [ ] Document sync state management

## Dev Notes

### Architecture Patterns

**Sync Engine Design:**

1. **Service Layer:**
   - `gmailSync.ts` - Gmail-specific sync implementation
   - `outlookSync.ts` - Outlook-specific sync implementation
   - `syncOrchestrator.ts` - Coordinates sync across accounts
   - `syncProgress.ts` - Progress tracking and estimation

2. **Sync Strategy:**
   - Initial sync: Fetch last 90 days (configurable via `VITE_SYNC_DAYS_INITIAL`)
   - Incremental sync: Poll every 2-5 minutes (configurable via `VITE_SYNC_INTERVAL_MS`)
   - Use OAuth access tokens from tokenStorageService
   - Handle token refresh transparently via tokenRefreshService

3. **Rate Limiting:**
   - Gmail: 250 quota units/second (1 message = 5 units, batch = 25 units)
   - Outlook: 10 requests/second (Microsoft Graph throttling)
   - Implement token bucket algorithm for rate limiting
   - Queue requests when rate limit approached

4. **Data Storage:**
   - Reuse email schema from Story 1.3B
   - Index by: timestamp DESC (for inbox view), labels, threadId
   - Associate with account_id for multi-account support

### Learnings from Previous Story (1-5-oauth-2-0-integration-for-outlook)

**From Story 1-5 (Status: done)**

- **OAuth Service Available**: `outlookOAuthService` at `src/services/auth/outlookOAuth.ts` - Use `refreshAccessToken()` for token refresh during sync
- **Multi-Provider Architecture**: Existing `tokenStorageService`, `tokenEncryptionService`, `tokenRefreshService` support both Gmail and Outlook - NO modifications needed
- **Service Pattern**: Singleton service pattern established - follow for sync services
- **Native OAuth Implementation**: Both Gmail and Outlook use native OAuth 2.0 (not SDKs) - maintain consistency
- **Technical Debt to Address**:
  - OAuth E2E tests deferred to this story (AC 7) - MUST implement for both providers
  - User re-auth notification UI pending (AC 10) - MUST implement in this story
- **Testing Setup**: Test environment configured in `vitest.config.ts` and `src/test/setup.ts` - reuse patterns
- **Security Headers**: CSP headers already configured for both Google and Microsoft endpoints

[Source: stories/1-5-oauth-2-0-integration-for-outlook.md#Dev-Agent-Record]

### Project Structure Notes

**New Files:**

```
src/services/sync/
├── gmailSync.ts           # Gmail API sync implementation
├── outlookSync.ts         # Microsoft Graph sync implementation
├── syncOrchestrator.ts    # Multi-account sync coordination
├── syncProgress.ts        # Progress tracking and estimation
├── rateLimiter.ts         # Token bucket rate limiting
└── __tests__/
    ├── gmailSync.test.ts
    ├── outlookSync.test.ts
    ├── syncOrchestrator.test.ts
    └── syncProgress.test.ts

src/components/notifications/
└── ReAuthNotification.tsx  # User re-auth notification UI (AC 10)

e2e/
├── gmail-oauth.spec.ts     # OAuth E2E test (AC 7)
└── outlook-oauth.spec.ts   # OAuth E2E test (AC 7)
```

**Modified Files:**

- `src/services/database/schemas/email.schema.ts` - Verify schema supports all sync requirements
- `src/services/auth/tokenRefresh.ts` - Integrate re-auth notification callback
- `.env.example` - Add sync configuration (VITE_SYNC_DAYS_INITIAL, VITE_SYNC_INTERVAL_MS)
- `docs/architecture.md` - Document sync engine architecture

**Integration Points:**

- `gmailOAuthService.refreshAccessToken()` - Get fresh Gmail access token
- `outlookOAuthService.refreshAccessToken()` - Get fresh Outlook access token
- `tokenStorageService.getTokens(accountId)` - Retrieve OAuth tokens for sync
- `tokenRefreshService.registerCallback()` - Register re-auth notification callback
- `database.emails.insert()` - Store synced emails in RxDB

### Technical Constraints

1. **Prerequisites:**
   - Story 1.4 completed (Gmail OAuth available)
   - Story 1.5 completed (Outlook OAuth available)
   - Story 1.3B completed (Email schema available)
   - RxDB database initialized

2. **API Rate Limits:**
   - Gmail API: 250 quota units/user/second (per-user quota)
   - Microsoft Graph: 10 requests/second (tenant-level throttling)
   - Must implement exponential backoff for 429 errors

3. **Data Volume:**
   - Initial sync: Up to ~8,100 emails (90 days × ~90 emails/day)
   - Incremental sync: ~10-50 new emails per sync interval
   - NFR004: Support 100K emails per account (validate during implementation)

4. **Network Handling:**
   - Detect online/offline status via `navigator.onLine` and network events
   - Persist sync state in RxDB for resume capability
   - Handle partial sync failures gracefully (retry logic in Story 1.10)

5. **Security:**
   - Never log email content or OAuth tokens
   - Use encrypted token storage (tokenEncryptionService)
   - Validate API responses before storing in RxDB

### References

- [Source: docs/epics/epic-1-foundation-core-infrastructure.md#Story-1.6]
- [Gmail API Messages.list](https://developers.google.com/gmail/api/reference/rest/v1/users.messages/list)
- [Gmail API Messages.get](https://developers.google.com/gmail/api/reference/rest/v1/users.messages/get)
- [Microsoft Graph List Messages](https://learn.microsoft.com/en-us/graph/api/user-list-messages)
- [Microsoft Graph Delta Query](https://learn.microsoft.com/en-us/graph/delta-query-messages)
- [Previous Story: stories/1-5-oauth-2-0-integration-for-outlook.md]
- [Email Schema: src/services/database/schemas/email.schema.ts (Story 1.3B)]

## Dev Agent Record

### Context Reference

- `docs/stories/1-6-basic-email-sync-engine.context.xml` - Story context with documentation, code artifacts, interfaces, constraints, and testing guidance

### Agent Model Used

Claude 3.7 Sonnet (claude-sonnet-4-5-20250929)

### Debug Log

**Planning Phase (2025-11-23)**

Implementation plan for basic email sync engine:

1. **Architecture Review** ✓
   - Reviewed Gmail/Outlook OAuth services - both follow singleton pattern
   - Email schema ready with all required fields (historyId, accountId, timestamp indexes)
   - Token refresh service available with callback system for re-auth notifications

2. **Core Services to Build**:
   - `rateLimiter.ts` - Token bucket rate limiting (Gmail: 250 quotas/s, Outlook: 10 req/s)
   - `syncProgress.ts` - Progress tracking with ±10% time estimation accuracy
   - `gmailSync.ts` - Gmail API sync (initial 90 days + incremental 2-5 min polling)
   - `outlookSync.ts` - Microsoft Graph delta sync
   - `syncOrchestrator.ts` - Multi-account coordination

3. **UI Components**:
   - `ReAuthNotification.tsx` - Token expiry notification (AC 10 technical debt)

4. **Testing Strategy**:
   - Unit tests for each sync service with mocked API responses
   - Integration tests for full sync flow
   - E2E tests for OAuth flows (AC 7 deferred from Stories 1.4 & 1.5)
   - Progress estimation accuracy validation (±10%)

5. **Network Resilience**:
   - Use `navigator.onLine` + online/offline events
   - Persist sync state in RxDB for resume capability
   - Handle API rate limits with exponential backoff

### Debug Log References

**Implementation Progress (2025-11-23)** - Story Paused for Split

**Completed Components:**

1. ✅ Database Schema & Migration
   - Created `syncState.schema.ts` for tracking sync progress per account
   - Created migration `20251123_add_email_and_sync_collections` (version 2)
   - Updated database types to include `_syncState` collection
   - Verified email schema has all required fields (historyId, accountId, indexes)

2. ✅ Core Services - Foundation Layer
   - `rateLimiter.ts` - Token bucket rate limiting (Gmail: 250 quotas/s, Outlook: 10 req/s)
   - `syncProgress.ts` - Progress tracking with ±10% time estimation
   - `gmailSync.ts` - Gmail sync service (partial implementation - initial sync logic complete)

**Recommendation: Split Story into 3 Focused Stories**

This story is too large for a single iteration. Recommend splitting as follows:

**Story 1.6A: Gmail Sync Engine (Core)**

- AC1: Initial sync (90 days configurable)
- AC2: Progress tracking
- AC3: RxDB storage with indexing
- AC4: Incremental sync
- AC5: Rate limiting (Gmail only)
- AC6: Network resilience
- AC9: Account association
- Estimated: 3-4 days

**Story 1.6B: Outlook Sync Engine**

- AC5: Rate limiting (Outlook)
- AC8: Microsoft Graph API support
- AC9: Multi-account isolation
- Estimated: 2-3 days

**Story 1.6C: OAuth E2E Tests & Re-Auth UI (Technical Debt)**

- AC7: OAuth E2E tests (Gmail + Outlook)
- AC10: Re-auth notification UI
- Estimated: 2 days

**Current State:**

- Database collections ready for sync implementation
- Rate limiting and progress tracking services complete
- Gmail sync service scaffolded (needs completion and testing)
- Ready to resume with Story 1.6A focusing on Gmail sync

**Files Modified:**

- src/services/database/schemas/syncState.schema.ts (new)
- src/services/database/schemas/index.ts
- src/services/database/types.ts
- src/services/database/migrations/20251123_add_email_and_sync_collections.ts (new)
- src/services/database/migrations/index.ts
- src/services/sync/rateLimiter.ts (new)
- src/services/sync/syncProgress.ts (new)
- src/services/sync/gmailSync.ts (new, partial)

### Completion Notes List

### File List

**New Files:**

- src/services/database/schemas/syncState.schema.ts
- src/services/database/migrations/20251123_add_email_and_sync_collections.ts
- src/services/sync/rateLimiter.ts
- src/services/sync/syncProgress.ts
- src/services/sync/gmailSync.ts (partial)

**Modified Files:**

- src/services/database/schemas/index.ts
- src/services/database/types.ts
- src/services/database/migrations/index.ts (LATEST_SCHEMA_VERSION = 2)
- docs/stories/1-6-basic-email-sync-engine.md
- docs/sprint-status.yaml

## Change Log

| Date       | Author                  | Change                                                                                                                                                                                                                                                       |
| ---------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2025-11-21 | System                  | Initial story creation from Epic 1 requirements                                                                                                                                                                                                              |
| 2025-11-21 | Claude 3.7 Sonnet (SM)  | Story drafted with sync engine requirements, OAuth E2E tests (AC 7), and re-auth notification UI (AC 10) to address technical debt from Stories 1.4 and 1.5                                                                                                  |
| 2025-11-23 | Claude 3.7 Sonnet (Dev) | Started implementation - completed database schema, migration, rate limiter, and progress tracking. Story identified as too large and marked needs-split. Recommended breaking into 3 stories: 1.6A (Gmail Sync), 1.6B (Outlook Sync), 1.6C (E2E Tests & UI) |
