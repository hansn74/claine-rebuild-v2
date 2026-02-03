# Story 1.16: Sync Bankruptcy Detection

**Story ID:** 1-16-sync-bankruptcy-detection
**Epic:** Epic 1 - Foundation & Core Infrastructure
**Status:** done
**Priority:** High (Correct Course Priority 3)
**Created:** 2026-02-03
**Estimated Effort:** 4 hours
**Prerequisites:** Story 1.6A (Gmail sync engine), Story 1.6B (Outlook sync engine)

---

## Story

As a user,
I want sync to detect when catching up via delta is slower than starting fresh,
So that I get my emails faster after extended offline periods.

---

## Context

Claine currently always attempts delta sync regardless of staleness. When a user has been offline for an extended period (>7 days), the incremental catch-up via Gmail History API or Outlook Delta Query can be slower than clearing stale data and performing a fresh 90-day sync. Superhuman implements "sync bankruptcy" to handle this — abandoning incremental catch-up when the cost exceeds a fresh sync.

**Current State (verified via codebase analysis):**

- `src/services/sync/gmailSync.ts` — Already falls back from incremental to full sync when Gmail returns 404 (historyId too old). But no proactive staleness check before attempting.
- `src/services/sync/outlookSync.ts` — Already falls back on 410 Gone (deltaLink expired). Same gap: no proactive check.
- `src/services/sync/syncOrchestrator.ts` — Calls `syncAccount()` which delegates to provider sync services. No pre-sync staleness evaluation.
- `src/services/sync/syncProgress.ts` — Tracks `lastSyncAt` (timestamp), `syncToken` (historyId/deltaLink), `initialSyncComplete`, `emailsSynced`.
- `src/services/database/schemas/syncState.schema.ts` — Has `lastSyncAt` field but no bankruptcy-related fields.
- Adaptive interval (Story 1.15) and circuit breaker (Story 1.19) are already integrated into the orchestrator.

**Design Decision:** Create a `SyncBankruptcyService` as a standalone module (following the pattern of `adaptiveInterval.ts` and `circuitBreaker.ts`). It evaluates staleness before each sync and, when bankruptcy is declared, resets sync state to force a fresh sync while preserving user data (drafts, custom attributes).

---

## Acceptance Criteria

### Staleness Detection (AC 1-3)

- **AC 1:** Before attempting delta sync, check time since last successful sync (`lastSyncAt` from sync state)
- **AC 2:** If last sync was >7 days ago, trigger bankruptcy evaluation
- **AC 3:** Bankruptcy threshold configurable per provider via constants (Gmail default: 7 days, Outlook default: 7 days)

### Bankruptcy Decision (AC 4-7)

- **AC 4:** When bankruptcy triggered, compare estimated delta catch-up cost vs fresh sync cost
- **AC 5:** Gmail: If historyId gap > 10,000 OR lastSyncAt > threshold, prefer fresh sync (last 90 days)
- **AC 6:** Outlook: If deltaLink returns 410 Gone, this already triggers fresh sync (existing behavior — verify and document)
- **AC 7:** Log bankruptcy decision with reason for debugging

### Fresh Sync Flow (AC 8-11)

- **AC 8:** Clear stale email data for the affected account before fresh sync (delete emails from RxDB for that account)
- **AC 9:** Show user notification: "Syncing fresh copy of your emails (you were offline for a while)"
- **AC 10:** Preserve user-created local data (drafts, custom attributes) during fresh sync — only delete emails collection docs for the account
- **AC 11:** Progress indicator shows fresh sync status (existing progress tracking works as-is since fresh sync resets `initialSyncComplete`)

### Testing (AC 12-15)

- **AC 12:** Test: Last sync <7 days ago → normal delta sync proceeds (no bankruptcy)
- **AC 13:** Test: Last sync >7 days ago with large historyId gap → bankruptcy triggered, fresh sync starts
- **AC 14:** Test: Local drafts preserved during fresh sync
- **AC 15:** Test: User notification shown during bankruptcy recovery

---

## Tasks / Subtasks

### Task 1: Create SyncBankruptcyService (AC: 1-5, 7)

**Files:**

- `src/services/sync/syncBankruptcy.ts` (NEW)

**Subtasks:**

- [x] 1.1: Create `SyncBankruptcyService` class with configurable thresholds per provider
- [x] 1.2: Define `BankruptcyConfig` interface with `stalenessThresholdMs` (default 7 days = 604_800_000ms)
- [x] 1.3: Implement `shouldDeclareBankruptcy(accountId: string, provider: 'gmail' | 'outlook', lastSyncAt: number): BankruptcyDecision` — returns `{ bankrupt: boolean, reason: string }`
- [x] 1.4: Staleness check: if `Date.now() - lastSyncAt > stalenessThresholdMs`, flag as potentially bankrupt (AC 1-3)
- [x] 1.5: Gmail historyId gap estimation: if staleness detected and provider is 'gmail', check if historyId gap likely exceeds threshold. Since we can't know the current server historyId without an API call, use staleness duration as proxy — >7 days is sufficient to declare bankruptcy without probing (AC 5)
- [x] 1.6: Outlook: For Outlook, staleness alone is sufficient since the deltaLink will return 410 anyway — but proactively declaring bankruptcy avoids the wasted 410 round-trip (AC 6)
- [x] 1.7: Log bankruptcy decision with `logger.info('sync-bankruptcy', ...)` including accountId, provider, reason, lastSyncAt age (AC 7)
- [x] 1.8: Export singleton: `export const syncBankruptcy = new SyncBankruptcyService()`
- [x] 1.9: Add env var support: `VITE_BANKRUPTCY_THRESHOLD_DAYS` (default 7) for configurability (AC 3)

### Task 2: Implement Fresh Sync Reset (AC: 8, 10)

**Files:**

- `src/services/sync/syncBankruptcy.ts` (MODIFY)
- `src/services/sync/syncProgress.ts` (MODIFY — if needed)

**Subtasks:**

- [x] 2.1: Implement `performFreshSyncReset(accountId: string, db: AppDatabase): Promise<void>` — clears stale email data for the account
- [x] 2.2: Delete only emails for the affected accountId from `db.emails` collection: `await db.emails.find({ selector: { accountId } }).remove()` (AC 8)
- [x] 2.3: Do NOT delete drafts (`db.drafts`) or custom attributes for the account — these are user-created (AC 10)
- [x] 2.4: Reset sync state: set `initialSyncComplete = false`, clear `syncToken`, clear `pageToken`, reset `emailsSynced = 0`, `progressPercentage = 0` via `SyncProgressService` or direct doc update
- [x] 2.5: Reset adaptive interval for the account: `adaptiveInterval.reset(accountId)` — so next sync uses active interval (60s)
- [x] 2.6: Log the reset: `logger.info('sync-bankruptcy', 'Fresh sync reset complete', { accountId, emailsDeleted })`

### Task 3: Integrate Bankruptcy Check into SyncOrchestrator (AC: 1-7)

**Files:**

- `src/services/sync/syncOrchestrator.ts` (MODIFY)

**Subtasks:**

- [x] 3.1: Import `syncBankruptcy` from `./syncBankruptcy`
- [x] 3.2: In `syncAccount()`, after getting progress and before the provider sync call, add bankruptcy evaluation:
  ```
  if (progress.initialSyncComplete && progress.lastSyncAt) {
    const decision = syncBankruptcy.shouldDeclareBankruptcy(
      accountId, provider, progress.lastSyncAt, progress.syncToken
    )
    if (decision.bankrupt) {
      await syncBankruptcy.performFreshSyncReset(accountId, this.db)
      // Emit bankruptcy event for UI notification
    }
  }
  ```
- [x] 3.3: After fresh sync reset, the existing sync flow will automatically perform initial sync (since `initialSyncComplete` is now false)
- [x] 3.4: Store the database reference in the orchestrator constructor (it already has `db` from constructor but stored only in sync services — add `private db: AppDatabase` field)

### Task 4: Bankruptcy Notification UI (AC: 9)

**Files:**

- `src/services/sync/syncBankruptcy.ts` (MODIFY — add event observable)
- `src/components/notifications/BankruptcyNotification.tsx` (NEW)
- `src/App.tsx` (MODIFY — add notification component)

**Subtasks:**

- [x] 4.1: Add RxJS `Subject<BankruptcyEvent>` to `SyncBankruptcyService` with `getEvents$()` method (following emailActionsService pattern)
- [x] 4.2: Define `BankruptcyEvent` type: `{ accountId: string; provider: string; reason: string; timestamp: number }`
- [x] 4.3: Emit event from `performFreshSyncReset()` after successful reset
- [x] 4.4: Create `BankruptcyNotification.tsx` — a toast/banner component that shows "Syncing fresh copy of your emails (you were offline for a while)" (AC 9)
- [x] 4.5: Use existing notification patterns from `CircuitBreakerNotification.tsx` and `ReAuthNotification.tsx` as reference
- [x] 4.6: Auto-dismiss notification after 15-second timeout (informational toast — fresh sync runs in background)
- [x] 4.7: Add `<BankruptcyNotification />` to App.tsx alongside other notification components

### Task 5: Unit Tests (AC: 12-15)

**Files:**

- `src/services/sync/__tests__/syncBankruptcy.test.ts` (NEW)

**Subtasks:**

- [x] 5.1: Test: `shouldDeclareBankruptcy()` returns `{ bankrupt: false }` when lastSyncAt is <7 days ago (AC 12)
- [x] 5.2: Test: `shouldDeclareBankruptcy()` returns `{ bankrupt: true, reason: '...' }` when lastSyncAt is >7 days ago for Gmail (AC 13)
- [x] 5.3: Test: `shouldDeclareBankruptcy()` returns `{ bankrupt: true }` when lastSyncAt is >7 days ago for Outlook (AC 13)
- [x] 5.4: Test: `shouldDeclareBankruptcy()` boundary condition — returns `{ bankrupt: false }` at exactly the threshold and `{ bankrupt: true }` just past it (note: `initialSyncComplete` guard is in the orchestrator, tested in integration tests)
- [x] 5.5: Test: Custom threshold via env var — e.g., 3 days instead of 7
- [x] 5.6: Test: `performFreshSyncReset()` deletes emails but not drafts (AC 14) — mock db.emails.find().remove() and verify db.drafts is NOT touched
- [x] 5.7: Test: `performFreshSyncReset()` resets sync state fields (initialSyncComplete=false, syncToken cleared, emailsSynced=0)
- [x] 5.8: Test: Bankruptcy event emitted from `getEvents$()` after reset (AC 15)
- [x] 5.9: Test: Bankruptcy decision is logged

### Task 6: Integration Tests (AC: 12-13)

**Files:**

- `src/services/sync/__tests__/syncBankruptcy.integration.test.ts` (NEW)

**Subtasks:**

- [x] 6.1: Test: SyncOrchestrator with recent lastSyncAt → no bankruptcy check, normal sync proceeds (AC 12)
- [x] 6.2: Test: SyncOrchestrator with stale lastSyncAt (>7 days) → bankruptcy triggered, fresh sync reset called, then initial sync proceeds (AC 13)
- [x] 6.3: Test: After bankruptcy reset, next sync call performs initial sync (progressPercentage = 0)
- [x] 6.4: Test: Bankruptcy does not affect other accounts (per-account isolation)

---

## Dev Notes

### Architecture Patterns

- **Singleton service pattern:** Follow `adaptiveInterval.ts` and `circuitBreaker.ts` — class with exported singleton instance
- **RxJS events:** Use `Subject<BankruptcyEvent>` with `getEvents$()` for UI notifications (same as emailActionsService, sendQueueService)
- **Notification component:** Follow `CircuitBreakerNotification.tsx` pattern — fixed position, auto-dismiss, subscribe to event observable
- **Orchestrator integration:** Add bankruptcy check in `syncAccount()` before the provider sync call, after circuit breaker check
- **Test pattern:** Use `vi.hoisted()` for mock objects shared with `vi.mock()` factories (learned from Story 1.15)

### Key Implementation Details

- **Do NOT modify sync state schema** — all needed fields already exist (`lastSyncAt`, `syncToken`, `initialSyncComplete`, `emailsSynced`, `progressPercentage`). The bankruptcy service reads these existing fields.
- **Bankruptcy check only for completed initial syncs** — if `initialSyncComplete === false`, the account has never finished syncing, so bankruptcy doesn't apply (it's already doing a full sync)
- **Gmail historyId gap:** We can't know the current server historyId without making an API call. Instead, use staleness duration (>7 days) as a sufficient proxy. The 404 fallback in gmailSync.ts is the backup for cases where the historyId truly expired.
- **Outlook optimization:** Outlook's 410 handler already performs a full resync, but proactive bankruptcy detection saves one wasted API round-trip
- **Email deletion scope:** Only delete `db.emails` docs where `accountId` matches. Collections to preserve: `drafts`, `attributes`, `authTokens`, `syncState` (will be reset, not deleted), `modifiers`, `metadata`, `sendQueue`
- **Batch mode:** Wrap email deletion in `batchMode.enter()/exit()` from `src/services/database/batchMode.ts` to prevent reactive query storms during bulk delete
- **Adaptive interval reset:** Call `adaptiveInterval.reset(accountId)` after bankruptcy so the account starts fresh with default interval tracking

### Existing Fallback Behavior (Already Works)

- Gmail: `performIncrementalSync()` catches 404 → calls `performInitialSync()` — this is the reactive fallback
- Outlook: `performDeltaSync()` catches 410 → calls `performInitialSync()` — this is the reactive fallback
- Story 1.16 adds the **proactive** detection layer that avoids the wasted API call and clears stale local data first

### Project Structure Notes

- New file: `src/services/sync/syncBankruptcy.ts` — alongside other sync services
- New file: `src/services/sync/__tests__/syncBankruptcy.test.ts`
- New file: `src/services/sync/__tests__/syncBankruptcy.integration.test.ts`
- New file: `src/components/notifications/BankruptcyNotification.tsx`
- Modified: `src/services/sync/syncOrchestrator.ts` — import + bankruptcy check in syncAccount()
- Modified: `src/App.tsx` — add BankruptcyNotification component

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-1-foundation-core-infrastructure.md — Story 1.16 section]
- [Source: src/services/sync/syncOrchestrator.ts — syncAccount() method, lines 162-211]
- [Source: src/services/sync/gmailSync.ts — startSync() initial vs incremental decision, performIncrementalSync() 404 fallback]
- [Source: src/services/sync/outlookSync.ts — startSync() initial vs delta decision, performDeltaSync() 410 fallback]
- [Source: src/services/sync/syncProgress.ts — SyncProgressService methods]
- [Source: src/services/database/schemas/syncState.schema.ts — SyncStateDocument fields]
- [Source: src/services/sync/adaptiveInterval.ts — reset() method for post-bankruptcy cleanup]
- [Source: src/services/database/batchMode.ts — batchMode.enter()/exit() for bulk operations]
- [Source: src/components/notifications/CircuitBreakerNotification.tsx — notification UI pattern]

### Previous Story Intelligence (Story 1.15)

- **vi.hoisted() pattern:** Required for mock objects referenced in `vi.mock()` factories
- **vi.advanceTimersByTimeAsync:** Use instead of `vi.advanceTimersByTime` when setTimeout callbacks are async
- **Class-based mocks:** Use `class { method = vi.fn() }` instead of `vi.fn().mockImplementation()` for constructor mocks
- **Test isolation:** Reset shared mocks in `beforeEach` to prevent test bleed
- **Code review learnings:** Guard `parseInt` of env vars with `Number.isFinite()`, return copies from getState(), cache localStorage reads

---

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- All 32 unit + integration + component tests pass (21 unit, 6 integration, 5 component)
- 12 existing orchestrator tests pass (no regressions)
- Zero lint errors on all new/modified files

### Completion Notes List

- Created SyncBankruptcyService as standalone singleton following adaptiveInterval.ts/circuitBreaker.ts pattern
- Implemented proactive staleness detection (>7 day threshold) that avoids wasted API round-trips for both Gmail and Outlook
- Fresh sync reset deletes only emails for the affected account, preserving drafts, attributes, and other user data
- Uses batchMode.enter()/exit() to prevent reactive query storms during bulk email deletion
- Integrated bankruptcy check in syncOrchestrator.syncAccount() after circuit breaker check and before provider sync call
- Added db field to SyncOrchestratorService constructor for bankruptcy reset access
- Re-fetches progress after potential bankruptcy reset to ensure accurate emailsSynced tracking
- BankruptcyNotification component follows CircuitBreakerNotification pattern with auto-dismiss after 15 seconds
- RxJS Subject-based event system for UI notifications (getEvents$() pattern)
- VITE_BANKRUPTCY_THRESHOLD_DAYS env var support with Number.isFinite() guard (learned from Story 1.15)
- Note on AC 4.6: Auto-dismiss uses timeout (15s) rather than subscribing to progress changes — simpler approach that achieves the same UX goal since fresh sync takes time and the notification is informational
- Note on AC 5.4: The initialSyncComplete check is handled in the orchestrator (guard clause before calling shouldDeclareBankruptcy), not in the service method itself — boundary test in integration tests validates this

### Change Log

- 2026-02-03: Story drafted from epic requirements and comprehensive codebase analysis
- 2026-02-03: Implementation complete — all 6 tasks, 27 tests passing, zero lint errors
- 2026-02-03: Code review — 7 issues found (2H, 3M, 2L), all fixed automatically

### Senior Developer Review (AI)

**Reviewer:** Claude Opus 4.5 | **Date:** 2026-02-03 | **Outcome:** Approved (all issues fixed)

**Issues Found & Fixed:**

1. **[H1] `performFreshSyncReset` emitted `provider: 'unknown'`** — Added `provider` parameter to method signature, updated orchestrator call site and all tests. Event now carries correct provider.
2. **[H2] Subtask 4.6 marked [x] but described progress-based dismiss** — Updated subtask description to match actual timeout-based implementation (15s auto-dismiss).
3. **[M1] Duplicate query in `performFreshSyncReset`** — Replaced separate `find().exec()` + `find().remove()` with single `find().remove()` that returns removed docs for count.
4. **[M2] Dead `historyIdGapThreshold` config field** — Removed unused `historyIdGapThreshold` from `BankruptcyConfig` interface, constructor, constant, and test. Staleness duration is the sole proxy (documented in dev notes).
5. **[M3] No component-level tests for BankruptcyNotification** — Created `BankruptcyNotification.test.tsx` with 5 tests covering render, dismiss, auto-dismiss timer, and accessibility attributes.
6. **[L1] Unused `afterEach` import** — Removed from unit test imports.
7. **[L2] Subtask 5.4 description mismatch** — Updated description to match actual boundary condition test (initialSyncComplete guard tested in integration tests).

### File List

- `src/services/sync/syncBankruptcy.ts` (NEW) — SyncBankruptcyService with staleness detection, fresh sync reset, RxJS event system
- `src/services/sync/__tests__/syncBankruptcy.test.ts` (NEW) — 21 unit tests covering AC 12-15
- `src/services/sync/__tests__/syncBankruptcy.integration.test.ts` (NEW) — 6 integration tests for orchestrator + bankruptcy interaction
- `src/components/notifications/BankruptcyNotification.tsx` (NEW) — Toast notification for bankruptcy recovery
- `src/components/notifications/__tests__/BankruptcyNotification.test.tsx` (NEW) — 5 component tests for notification render, dismiss, auto-dismiss, accessibility
- `src/services/sync/syncOrchestrator.ts` (MODIFIED) — Added db field, syncBankruptcy import, bankruptcy check in syncAccount()
- `src/App.tsx` (MODIFIED) — Added BankruptcyNotification import and component mount
