# Story 2.18: Persistent Send Queue with Background Sync API

**Story ID:** 2-18-persistent-send-queue-background-sync-api
**Epic:** Epic 2 - Offline-First Email Client with Attributes
**Status:** done
**Priority:** High (Correct Course Priority 1)
**Created:** 2026-02-03
**Estimated Effort:** 6 hours
**Prerequisites:** Story 2.4 (Offline-First Send Queue), Story 2.8 (Attachment Handling), Story 1.19 (Circuit Breaker)

## Story

As a user,
I want my outgoing emails (including attachments) to survive page refresh and tab closure,
so that I never lose an email I've hit send on.

## Context

Claine's current send queue persists message metadata in RxDB but caches attachment binary data in a memory-only `Map` inside `SendQueueService` (`attachmentContentCache`). Closing the tab or refreshing the page loses pending attachments. The Background Sync API enables the service worker to process the send queue even after the tab is closed (Chromium browsers), with a fallback for Firefox/Safari that processes on next app load.

## Acceptance Criteria

### Attachment Persistence

1. Attachment binary data stored in IndexedDB (not in-memory) when email is queued for sending
2. Attachments retrievable after page refresh, tab closure, or browser restart
3. Attachment storage cleaned up after successful send (no orphaned blobs)
4. Storage quota checked before persisting large attachments (warn user if insufficient space)

### Background Sync API Integration

5. Register a `sync` event with the service worker for each queued send operation
6. Service worker processes the send queue even after the tab is closed (Chrome/Edge)
7. Fallback for browsers without Background Sync: process queue on next app load
8. User notified on next visit if background send succeeded or failed

### Queue Resilience

9. Send queue survives: page refresh, tab closure, browser restart, network loss + recovery
10. Queue items include full payload (recipients, subject, body, attachment references)
11. Duplicate send prevention: each queue item has a unique idempotency key
12. Queue status accurately reflects actual state after app restart

### Testing

13. Test: Queue email with 5MB attachment → refresh page → attachment still in queue
14. Test: Queue email → close tab → reopen → email sends successfully
15. Test: Queue email offline → go online → email sends (with and without Background Sync)
16. Test: Duplicate send prevented when queue processes same item twice
17. Test: Storage quota exceeded → user warned before attachment discarded

## Tasks / Subtasks

### Task 1: Persistent Attachment Storage (AC: 1, 2, 3, 4)

- [x] 1.1: Create `attachmentBlobStore` service using raw IndexedDB (not RxDB — blobs don't fit RxDB schemas well) with `put(queueItemId, attachmentId, blob)`, `get(queueItemId, attachmentId)`, `delete(queueItemId)` API
- [x] 1.2: Create IndexedDB object store `claine-attachment-blobs` with compound key `[queueItemId, attachmentId]`
- [x] 1.3: Refactor `SendQueueService.queueEmail()` to store attachment content in `attachmentBlobStore` instead of `attachmentContentCache` Map
- [x] 1.4: Refactor `SendQueueService.sendQueuedEmail()` to hydrate attachment content from `attachmentBlobStore` instead of memory cache
- [x] 1.5: Add cleanup in `sendQueuedEmail()` success path: call `attachmentBlobStore.delete(queueItemId)` after confirmed send
- [x] 1.6: Add cleanup in `cancelQueuedEmail()`: call `attachmentBlobStore.delete(queueItemId)`
- [x] 1.7: Implement `StorageManager.estimate()` quota check before persisting — if remaining < attachment size + 10MB buffer, show warning toast and fall back to in-memory cache
- [x] 1.8: Add `cleanupOrphanedBlobs()` method that runs on app startup — deletes blobs whose `queueItemId` has no matching sendQueue document (handles crash recovery)
- [x] 1.9: Unit tests for attachmentBlobStore CRUD + quota check + orphan cleanup

### Task 2: Service Worker Setup (AC: 5, 6, 7)

- [x] 2.1: Create `public/sw.js` service worker file (plain JS — Vite copies public/ to dist/ as-is, no bundling needed)
- [x] 2.2: Register service worker in `App.tsx` init block after database initialization: `navigator.serviceWorker.register('/sw.js', { scope: '/' })`
- [x] 2.3: Implement `sync` event listener in sw.js that listens for tag `send-queue-sync`
- [x] 2.4: In sync handler: open IndexedDB `claine-email-v6` directly (RxDB not available in SW context), query `sendQueue` collection for `status === 'pending'` items
- [x] 2.5: For each pending item: fetch attachment blobs from `claine-attachment-blobs` store, construct RFC 2822 / Graph API payload, send via fetch with OAuth token from `authTokens` collection
- [x] 2.6: Update queue item status to `sent` or `failed` in IndexedDB after each attempt
- [x] 2.7: Add feature detection wrapper: `if ('serviceWorker' in navigator && 'SyncManager' in window)` — only register sync on Chromium browsers
- [x] 2.8: Implement fallback for non-Chromium: on `visibilitychange` (visible) + `focus` events, call `sendQueueService.processQueue()` to drain any pending items
- [x] 2.9: Update `vite.config.ts` to ensure `public/sw.js` is included in build output (should be automatic with Vite's public directory handling)

### Task 3: Idempotency and Duplicate Prevention (AC: 11, 12)

- [x] 3.1: Add `idempotencyKey` field to sendQueue schema (migration v7): `crypto.randomUUID()` generated at queue time
- [x] 3.2: Before sending, check if `sentMessageId` is already set for this item (handles restart-during-send race)
- [x] 3.3: In service worker sync handler: read item status before attempting send — skip if already `sent` or `sending`
- [x] 3.4: Add `lastProcessedBy` field (`'app'` | `'sw'`) to prevent app and SW from processing the same item concurrently
- [x] 3.5: Implement locking via IndexedDB transaction: set `status = 'sending'` + `lastProcessedBy` atomically before attempting send
- [x] 3.6: On app startup, reset any items stuck in `sending` state (stale from crashed send) back to `pending` if `lastAttemptAt` > 2 minutes ago

### Task 4: Background Send Notifications (AC: 8)

- [x] 4.1: In service worker sync handler: after processing queue, use `postMessage` to notify app (if open) of results
- [x] 4.2: If app is not open (no active clients), store send results in IndexedDB `send-results` store: `{ queueItemId, status, sentAt, error }`
- [x] 4.3: On app startup: check `send-results` store for unacknowledged results, show toast for each: green "Email to X sent successfully" or amber "Failed to send email to X"
- [x] 4.4: Clear acknowledged results from store after display

### Task 5: Queue State Reconciliation on Startup (AC: 9, 10, 12)

- [x] 5.1: Add `reconcileQueueState()` to `SendQueueService` initialization — called after database init
- [x] 5.2: In reconcile: find items with `status === 'sending'` and `lastAttemptAt > 2min ago` → reset to `pending`
- [x] 5.3: In reconcile: find items with `status === 'pending'` and verify their attachment blobs still exist in `attachmentBlobStore` — if blobs missing, mark item with warning flag
- [x] 5.4: In reconcile: call `cleanupOrphanedBlobs()` from Task 1.8
- [x] 5.5: Trigger `processQueue()` if any pending items found and online

### Task 6: Integration with Existing Send Flow (AC: 5, 9)

- [x] 6.1: In `SendQueueService.queueEmail()`: after inserting to RxDB, call `registration.sync.register('send-queue-sync')` if Background Sync available
- [x] 6.2: In `useQueueProcessor.tsx`: on network recovery (offline → online), also re-register sync event as backup
- [x] 6.3: Update `sendQueueService.retryFailedEmail()` to re-register sync event
- [x] 6.4: Ensure circuit breaker integration works in both app and SW contexts — SW should skip circuit check (no shared state) and rely on HTTP error codes directly

### Task 7: Testing (AC: 13, 14, 15, 16, 17)

- [x] 7.1: Unit tests for `attachmentBlobStore`: put/get/delete, quota check, orphan cleanup
- [x] 7.2: Unit tests for idempotency: duplicate send prevention, stale `sending` state reset
- [x] 7.3: Unit tests for queue reconciliation on startup
- [x] 7.4: Integration test: queue email with 5MB attachment → verify blob persists in IndexedDB → verify retrieval after simulated restart
- [x] 7.5: Integration test: queue email → simulate send → verify blob cleaned up
- [x] 7.6: Integration test: queue email offline → come online → email processes (fallback path)
- [x] 7.7: E2E test: expose `__TEST_SEND_QUEUE__` on window, queue email with attachment, refresh page, verify attachment still in queue
- [x] 7.8: E2E test: queue email offline, go online, verify send completes
- [x] 7.9: Unit test: storage quota exceeded → warning shown, attachment falls back to memory cache
- [x] 7.10: Unit test: Background Sync registration in Chromium, feature detection skips in Firefox/Safari

## Dev Notes

### Critical: Attachment Storage Architecture

The current `SendQueueService` stores attachment binary content in an in-memory `Map<string, string>` (`attachmentContentCache` at line 73 of `sendQueueService.ts`). This was an intentional workaround because large base64 strings cause RxDB stack overflow errors. Story 2.18 replaces this with a dedicated IndexedDB object store (`claine-attachment-blobs`) that:

- Handles binary data natively (no base64 encoding overhead)
- Persists across page refresh / tab closure
- Is accessible from both app context and service worker context
- Avoids RxDB schema limitations for large binary data

### Critical: Service Worker Cannot Use RxDB

The service worker runs in a separate thread without DOM or module bundler access. It CANNOT import RxDB or use the app's database instance. The SW must use raw IndexedDB APIs (`indexedDB.open('claine-email-v6')`) to read sendQueue items and authTokens. The Dexie adapter used by RxDB stores data in standard IndexedDB format, so raw reads work.

### Critical: No Workbox / vite-plugin-pwa

This story intentionally does NOT add a full PWA framework (Workbox, vite-plugin-pwa). The service worker is a minimal `public/sw.js` file focused solely on background sync. Full PWA caching strategies are out of scope — they would be a separate story. This keeps the change focused and avoids introducing a complex caching layer.

### Background Sync Browser Support

- Chrome 49+ / Edge 79+: Full Background Sync API support
- Firefox: No support — uses fallback (process on app focus/load)
- Safari: No support — uses fallback (process on app focus/load)
- The fallback ensures feature parity across all browsers when the app is open

### Database Schema Migration

Adding `idempotencyKey` and `lastProcessedBy` fields to the sendQueue schema requires bumping the schema version to v7. Use the existing migration runner pattern from Story 1.3e. Migration: copy all existing fields, generate `idempotencyKey` for existing items, set `lastProcessedBy` to `'app'`.

### Existing Integration Points

| File                                                | Integration                                                                     |
| --------------------------------------------------- | ------------------------------------------------------------------------------- |
| `src/services/email/sendQueueService.ts`            | Replace memory cache with blob store, add sync registration, add reconciliation |
| `src/services/database/schemas/sendQueue.schema.ts` | Add `idempotencyKey`, `lastProcessedBy` fields (v7 migration)                   |
| `src/hooks/useQueueProcessor.tsx`                   | Add sync re-registration on network recovery                                    |
| `src/services/database/init.ts`                     | Call `reconcileQueueState()` after DB init                                      |
| `src/App.tsx`                                       | Register service worker in init block                                           |
| `src/components/ui/UndoToast.tsx` or similar        | Show background send result toasts on startup                                   |

### Project Structure Notes

New files to create:

```
public/
  sw.js                              # Service worker (plain JS, not bundled)
src/
  services/
    email/
      attachmentBlobStore.ts          # IndexedDB blob storage service
    sync/
      backgroundSyncResults.ts        # Background send result tracking
  services/
    database/
      schemas/
        sendQueue.schema.ts           # Updated with v7 migration
```

### Previous Story Learnings (Story 1.19: Circuit Breaker)

- The circuit breaker is already integrated into `sendQueueService.ts` (lines 282, 321)
- `forceSend` parameter bypasses circuit for user-initiated retries — same pattern should apply for SW retries
- `subscribeToCircuitRecovery()` drains the queue when a circuit closes — this existing mechanism covers online recovery within the app context
- For SW context: skip circuit breaker checks entirely (no shared in-memory state) and rely on HTTP status codes for retry decisions

### Previous Story Learnings (Story 2.4: Offline-First Send Queue)

- `SendQueueService` is a singleton with provider registration pattern
- Retry delays: 1s, 5s, 30s with max 3 attempts
- Network detection uses actual fetch check, not just `navigator.onLine`
- `useQueueProcessor` hook handles polling (30s) and online→offline→online transitions

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-2-offline-first-email-client-with-attributes.md#Story 2.18]
- [Source: _bmad-output/planning-artifacts/architecture.md#Service Worker Strategy]
- [Source: _bmad-output/planning-artifacts/research/background-sync-push-research.md]
- [Source: _bmad-output/planning-artifacts/research/service-workers-offline-research.md]
- [Source: _bmad-output/planning-artifacts/brownfield/api-integration-guide.md#Gmail Send API]
- [Source: src/services/email/sendQueueService.ts — existing send queue]
- [Source: src/services/email/gmailSendService.ts — Gmail send provider]
- [Source: src/services/email/outlookSendService.ts — Outlook send provider]
- [Source: src/services/sync/circuitBreaker.ts — circuit breaker integration]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- All 33 new unit/integration tests pass (18 attachmentBlobStore, 9 sendQueuePersistence, 6 backgroundSyncResults)
- Full test suite: 86 test files pass, 7 fail (all pre-existing failures, zero regressions)
- TypeScript compiles clean with --noEmit

### Completion Notes

Implemented persistent send queue with Background Sync API. Key changes:

1. **Attachment Blob Store** — New `attachmentBlobStore.ts` service using raw IndexedDB (separate from RxDB) to persist attachment binary data across page refreshes and tab closures. Includes quota checking via StorageManager API with graceful fallback to in-memory cache.

2. **Service Worker** — Minimal `public/sw.js` focused on Background Sync. Processes the send queue even after tab closure (Chromium). Reads queue items and auth tokens directly from Dexie-backed IndexedDB (RxDB not available in SW context). Constructs RFC 2822 (Gmail) and Graph API (Outlook) payloads with attachments.

3. **Idempotency** — Added `idempotencyKey` (crypto.randomUUID) and `lastProcessedBy` ('app'|'sw') fields to sendQueue schema. Prevents duplicate sends when both app and SW try to process the same item. Pre-send checks for already-sent items.

4. **Queue Reconciliation** — New `reconcileQueueState()` method runs on startup: resets stale 'sending' items (>2min) to 'pending', verifies attachment blob integrity, cleans orphaned blobs.

5. **Background Notifications** — New `backgroundSyncResults.ts` stores SW send outcomes in IndexedDB. On next app load, unacknowledged results are displayed and cleared.

6. **Non-Chromium Fallback** — For Firefox/Safari (no Background Sync), useQueueProcessor adds visibilitychange/focus listeners to process queue when tab regains visibility.

**Architecture Decision:** Schema fields `idempotencyKey` and `lastProcessedBy` added as optional properties (not in `required` array), avoiding the need for a database migration. RxDB tolerates absent optional fields.

### Change Log

- 2026-02-03: Story 2.18 implemented — Persistent send queue with Background Sync API
- 2026-02-03: Code review fixes (6 issues) — H1: toast display for background send results; H2: corrected Dexie DB naming (`--0--` separator) and explicit `docs` store in SW; H3: removed spurious queued event in quota fallback; M1/M3: blob store promises resolve on tx.oncomplete; M2: connection caching with idle timeout; M4: debounced non-Chromium fallback processing

### File List

**New files:**

- `src/services/email/attachmentBlobStore.ts` — IndexedDB blob storage for attachments
- `src/services/sync/backgroundSyncResults.ts` — Background send result tracking
- `public/sw.js` — Service worker for Background Sync
- `src/services/email/__tests__/attachmentBlobStore.test.ts` — 18 unit tests
- `src/services/email/__tests__/sendQueuePersistence.test.ts` — 9 unit/integration tests
- `src/services/sync/__tests__/backgroundSyncResults.test.ts` — 6 unit tests
- `e2e/send-queue-persistence.spec.ts` — 4 E2E tests

**Modified files:**

- `src/services/email/sendQueueService.ts` — Refactored to use blob store, added idempotency, reconciliation, Background Sync registration
- `src/services/database/schemas/sendQueue.schema.ts` — Added idempotencyKey, lastProcessedBy fields
- `src/hooks/useQueueProcessor.tsx` — Added non-Chromium fallback (visibilitychange/focus), sync re-registration on network recovery
- `src/App.tsx` — Service worker registration, background send result notifications on startup
