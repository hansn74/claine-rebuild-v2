# Story 1.6B: Outlook Sync Engine

**Story ID:** 1-6b-outlook-sync-engine
**Epic:** Epic 1 - Foundation & Core Infrastructure
**Status:** done
**Priority:** High
**Created:** 2025-11-23

## Story

As a user,
I want my Outlook emails to sync from my connected account to local storage,
So that I can access them offline.

## Acceptance Criteria

**AC 1:** Initial sync downloads last 90 days of emails (configurable via VITE_SYNC_DAYS_INITIAL)
**AC 2:** Progress indicator shows sync status and estimated time (±10% accuracy)
**AC 3:** Emails stored in RxDB with proper indexing (timestamp DESC, labels, threadId)
**AC 4:** Incremental sync fetches new emails every 2-5 minutes when online
**AC 5:** Sync respects Microsoft Graph API rate limits (10 requests/second)
**AC 6:** Graceful handling of network interruptions (resume sync when online)
**AC 7:** Emails associated with correct OAuth account (multi-account support)
**AC 8:** Multi-account sync runs independently per account

## Tasks / Subtasks

### Outlook Sync Service Implementation

- [ ] Create Outlook sync service (AC: 1, 3, 4, 5, 6, 7, 8)
  - [ ] Implement `src/services/sync/outlookSync.ts`
  - [ ] Implement initial sync (last 90 days configurable)
  - [ ] Implement incremental sync using Microsoft Graph Delta Query
  - [ ] Integrate rate limiter for API calls (10 requests/second)
  - [ ] Parse Microsoft Graph message format to EmailDocument schema
  - [ ] Store emails in RxDB \_emails collection
  - [ ] Associate emails with Outlook account ID
  - [ ] Handle token refresh during sync (401 errors)

### Microsoft Graph Delta Query Integration

- [ ] Implement delta sync pattern (AC: 4)
  - [ ] Use deltaLink from previous sync for incremental updates
  - [ ] Handle @odata.nextLink for pagination
  - [ ] Store deltaLink in syncState for next sync
  - [ ] Parse Graph API delta response format

### Network Resilience

- [ ] Implement network interruption handling (AC: 6)
  - [ ] Reuse network detection from Story 1.6A
  - [ ] Pause sync when offline
  - [ ] Resume sync when online (use deltaLink from syncState)
  - [ ] Persist sync state in RxDB for resume capability

### Multi-Account Sync Isolation

- [ ] Implement independent sync workers (AC: 8)
  - [ ] Ensure Gmail and Outlook sync don't interfere
  - [ ] Run sync orchestrator per account independently
  - [ ] Verify account data isolation in RxDB queries

### Testing

- [ ] Write unit tests for Outlook sync service
  - [ ] Test initial sync flow with mocked Microsoft Graph API
  - [ ] Test delta sync with mocked delta responses
  - [ ] Test rate limiting behavior (10 req/s)
  - [ ] Test network interruption scenarios
  - [ ] Test multi-account sync isolation
- [ ] Write integration tests
  - [ ] Test full sync flow with test database
  - [ ] Test token refresh during sync
  - [ ] Test concurrent Gmail + Outlook sync

### Documentation

- [ ] Document Outlook sync architecture
  - [ ] Document delta query flow diagrams
  - [ ] Document rate limiting strategy (10 req/s)
  - [ ] Document differences from Gmail sync
  - [ ] Document multi-account coordination

## Dev Notes

### Learnings from Previous Story (1-6a-gmail-sync-engine-core)

**From Story 1-6A (Status: drafted)**

- **Foundation Services Ready**: Story 1.6A established Gmail sync patterns
  - `rateLimiter.ts` - Token bucket with `createOutlookRateLimiter()` factory
  - `syncProgress.ts` - Progress tracking service (provider-agnostic)
  - `syncOrchestrator.ts` - Coordinates sync timing across accounts
  - Gmail sync patterns established - **REUSE architecture for Outlook**

- **Database Collections Ready**: Migration v2 created email and syncState collections
  - `_emails` collection supports multi-provider (no schema changes needed)
  - `_syncState` collection tracks progress per account
  - Indexes optimized for sync queries

- **Sync Architecture Pattern**: Follow Gmail sync structure
  - Initial sync: Fetch messages with date filter
  - Incremental sync: Use delta/history API
  - Rate limiting: Use `rateLimiter.acquireAndWait(tokens)`
  - Progress tracking: Update every 10 emails
  - Network resilience: Listen to online/offline events

- **Token Refresh Pattern**: Reuse from Story 1.5
  - Use `outlookOAuthService.refreshAccessToken()` for 401 errors
  - Store refreshed tokens via `tokenStorageService.storeTokens()`

[Source: stories/1-6a-gmail-sync-engine-core.md#Dev-Notes]

### Learnings from Story 1.5 (Outlook OAuth)

**From Story 1-5 (Status: done)**

- **Outlook OAuth Service**: Complete OAuth implementation at `src/services/auth/outlookOAuth.ts`
  - Singleton service pattern: `outlookOAuthService`
  - Token refresh method: `refreshAccessToken(refreshToken)`
  - Error handling for Microsoft Graph errors
  - CSP headers already configured for Microsoft endpoints

- **Microsoft Graph Specifics**:
  - Tokens expire in ~1 hour (same as Gmail)
  - Refresh token rotation supported
  - Scopes: `Mail.Read`, `Mail.Send`, `offline_access`

[Source: stories/1-5-oauth-2-0-integration-for-outlook.md#Completion-Notes-List]

### Architecture Patterns

**Microsoft Graph API Integration:**

1. **Initial Sync (90 days)**:
   - Use `/me/messages` with `$filter=receivedDateTime ge {date}`
   - Batch fetch messages (default page size 10, use `$top=50` for efficiency)
   - Parse to EmailDocument schema and insert into RxDB
   - Rate limit: 10 requests/second

2. **Incremental Sync (Delta Query)**:
   - Use `/me/messages/delta` endpoint
   - First call returns messages + `@odata.deltaLink`
   - Subsequent calls use `deltaLink` to get only changes
   - Store `deltaLink` in syncState.syncToken
   - More efficient than Gmail History API

3. **Rate Limiting**:
   - Microsoft Graph: 10 requests/second (tenant-level)
   - Use `createOutlookRateLimiter()` from rateLimiter.ts
   - Use `rateLimiter.acquireAndWait(1)` before each API call

4. **Progress Tracking**:
   - Reuse `SyncProgressService` from Story 1.6A
   - Track `emailsSynced / totalEmailsToSync` percentage
   - Calculate average sync rate (emails/second)
   - Estimate time remaining

5. **Multi-Account Isolation**:
   - Each account has separate syncState document (keyed by accountId)
   - Each account runs independent sync worker
   - RxDB queries filtered by accountId
   - No data leakage between accounts

### Project Structure Notes

**Services from Story 1.6A to Reuse**:

```
src/services/sync/
├── rateLimiter.ts          # Use createOutlookRateLimiter() - REUSE
├── syncProgress.ts         # Progress tracking - REUSE
├── syncOrchestrator.ts     # Sync coordination - REUSE
└── gmailSync.ts            # Gmail sync - REFERENCE for patterns
```

**New Files This Story**:

```
src/services/sync/
├── outlookSync.ts          # Outlook sync service (NEW)
└── __tests__/
    └── outlookSync.test.ts # Outlook sync tests (NEW)
```

**Services from Story 1.5 to Reuse**:

```
src/services/auth/
├── outlookOAuth.ts         # Outlook OAuth service - REUSE
├── tokenStorage.ts         # Token storage - REUSE for getTokens()
└── tokenRefresh.ts         # Token refresh - REUSE
```

### Technical Constraints

**Microsoft Graph Differences from Gmail**:

- **Delta Query**: More efficient than Gmail History API (returns full changes, not just IDs)
- **Rate Limits**: 10 requests/second (vs Gmail 250 quota units/second)
- **Token Lifetime**: ~1 hour (same as Gmail)
- **Pagination**: Uses `@odata.nextLink` (vs Gmail `nextPageToken`)
- **Message Format**: Different JSON structure than Gmail (needs parsing adapter)

**Multi-Account Coordination**:

- Gmail and Outlook sync run independently
- Each has own syncState document in RxDB
- Sync orchestrator schedules both without conflicts
- UI shows combined progress across accounts

### References

- [Source: docs/epics/epic-1-foundation-core-infrastructure.md#Story-1.6B]
- [Microsoft Graph Messages API](https://learn.microsoft.com/en-us/graph/api/user-list-messages)
- [Microsoft Graph Delta Query](https://learn.microsoft.com/en-us/graph/delta-query-messages)
- [Microsoft Graph Rate Limits](https://learn.microsoft.com/en-us/graph/throttling)
- [Previous Story: stories/1-6a-gmail-sync-engine-core.md]
- [Outlook OAuth: stories/1-5-oauth-2-0-integration-for-outlook.md]

## Dev Agent Record

### Context Reference

<!-- Path(s) to story context XML will be added here by context workflow -->

### Agent Model Used

Claude 3.7 Sonnet (claude-sonnet-4-5-20250929)

### Debug Log References

### Completion Notes List

**Implementation Complete:**

- OutlookSyncService implemented at `src/services/sync/outlookSync.ts` (645 lines)
- Uses Microsoft Graph Delta Query for efficient incremental sync
- Rate limiting via `createOutlookRateLimiter()` (10 req/s)
- Network resilience with pause/resume on offline
- Multi-account support with independent sync per account
- 17 unit tests passing at `src/services/sync/__tests__/outlookSync.test.ts`

### Senior Developer Review

**Review Date:** 2025-11-25
**Reviewer:** Claude Opus 4.5 (SM)
**Verdict:** APPROVED

| AC                            | Status | Evidence                                       |
| ----------------------------- | ------ | ---------------------------------------------- |
| AC1 (90 days configurable)    | ✅     | `outlookSync.ts:128,270-272`                   |
| AC2 (Progress tracking)       | ✅     | `SyncProgressService`, updates every 10 emails |
| AC3 (RxDB storage)            | ✅     | `storeEmail()` at `outlookSync.ts:555-636`     |
| AC4 (Delta sync 2-5min)       | ✅     | `performDeltaSync()` with `@odata.deltaLink`   |
| AC5 (Rate limiting 10/s)      | ✅     | `rateLimiter.acquireAndWait(1)`, 429 handling  |
| AC6 (Network resilience)      | ✅     | `navigator.onLine` checks, `pausedSyncs` Set   |
| AC7 (Account association)     | ✅     | `accountId` in EmailDocument                   |
| AC8 (Multi-account isolation) | ✅     | `activeSync` Map, concurrent prevention        |

**Test Coverage:** 17/17 tests passing

### File List

- `src/services/sync/outlookSync.ts` - Main sync service (NEW)
- `src/services/sync/__tests__/outlookSync.test.ts` - Unit tests (NEW)

## Change Log

| Date       | Author                  | Change                                                                                        |
| ---------- | ----------------------- | --------------------------------------------------------------------------------------------- |
| 2025-11-23 | System                  | Story created from Epic 1 Story 1.6B after splitting Story 1.6                                |
| 2025-11-23 | Claude 3.7 Sonnet (Dev) | Story drafted with Outlook sync requirements, building on Gmail sync patterns from Story 1.6A |
| 2025-11-25 | Claude Opus 4.5 (SM)    | Senior Developer Review: APPROVED - All 8 ACs verified with 17/17 tests passing               |
