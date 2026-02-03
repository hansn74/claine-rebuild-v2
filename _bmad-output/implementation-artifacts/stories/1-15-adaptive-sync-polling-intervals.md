# Story 1.15: Adaptive Sync Polling Intervals

**Story ID:** 1-15-adaptive-sync-polling-intervals
**Epic:** Epic 1 - Foundation & Core Infrastructure
**Status:** done
**Priority:** High (Correct Course Priority 3)
**Created:** 2026-02-03
**Estimated Effort:** 4 hours
**Prerequisites:** Story 1.6A (Gmail sync engine), Story 1.6B (Outlook sync engine)

---

## Story

As a user,
I want sync frequency to adapt based on my account activity,
So that active inboxes update faster and idle accounts don't waste resources.

---

## Context

Claine currently uses a fixed 180s (3 minute) polling interval for all accounts (configured via `VITE_SYNC_INTERVAL_MS`). Superhuman uses 7 different intervals (10s-1h) with adaptive throttling based on activity. A simple heuristic approach gives most of the benefit without Superhuman's complexity.

**Current State (verified via codebase analysis):**

- `src/services/sync/syncOrchestrator.ts` — Uses a single fixed `syncInterval` (180000ms default from `VITE_SYNC_INTERVAL_MS`) for all accounts. `scheduleNextSync()` always uses the same interval via `setTimeout(callback, this.syncInterval)`.
- `src/services/sync/syncProgress.ts` — `SyncProgressService` tracks sync state per account. `scheduleNextSync()` method accepts an `intervalMs` parameter but the orchestrator always passes the fixed value.
- `src/services/database/schemas/syncState.schema.ts` — Schema v0 with fields for sync progress tracking. Does NOT have adaptive polling fields (no `consecutiveSyncsNoChanges` or `currentAdaptiveInterval`).
- `src/services/email/emailActionsService.ts` — Has an RxJS `Subject` for action events. Can be subscribed to for detecting user actions.
- `src/services/email/sendQueueService.ts` — Has send event tracking.
- The orchestrator's `syncAccount()` calls `gmailSyncService.startSync()` or `outlookSyncService.startSync()` but does NOT check whether new messages were found in the sync.
- The `SyncProgressService.updateProgress()` receives `emailsSynced` count — comparing before/after can determine activity.

**Interval Tiers:**

| Condition                                   | Interval     |
| ------------------------------------------- | ------------ |
| Recent activity (new messages in last sync) | 60s          |
| Default (baseline)                          | 180s         |
| Idle 3+ consecutive syncs with no changes   | 300s         |
| Idle 10+ consecutive syncs with no changes  | 600s         |
| User action (send, archive, label)          | Reset to 60s |

---

## Acceptance Criteria

### Adaptive Interval Logic (AC 1-5)

- **AC 1:** Default interval remains 180s (3 min) as baseline
- **AC 2:** Interval shortened to 60s when recent activity detected (new messages in last sync)
- **AC 3:** Interval extended to 300s when no new messages for 3+ consecutive syncs
- **AC 4:** Interval extended to 600s when no new messages for 10+ consecutive syncs
- **AC 5:** Interval resets to 60s immediately when user performs an action (send, archive, label)

### Per-Account Tracking (AC 6-8)

- **AC 6:** Each connected account tracks its own activity heuristic independently
- **AC 7:** Activity counter (consecutive syncs with no changes) persisted in sync state
- **AC 8:** Account switching triggers an immediate sync for the selected account

### Configuration (AC 9-10)

- **AC 9:** Adaptive polling can be disabled in settings (reverts to fixed interval)
- **AC 10:** Min/max interval bounds configurable via environment variables

### Testing (AC 11-14)

- **AC 11:** Test: Active account (new messages each sync) -> interval shortens to 60s
- **AC 12:** Test: Idle account (no messages for 10 syncs) -> interval extends to 600s
- **AC 13:** Test: User action -> interval resets to 60s
- **AC 14:** Test: Multiple accounts adapt independently

---

## Tasks / Subtasks

### Task 1: Create AdaptiveIntervalService (AC: 1-4, 6, 10)

**Files:**

- `src/services/sync/adaptiveInterval.ts` (NEW)

**Subtasks:**

- [x] 1.1: Create `AdaptiveIntervalService` class with private `accountStates: Map<string, AccountSyncActivity>` tracking per-account activity
- [x] 1.2: Define `AccountSyncActivity` interface with fields: `consecutiveIdleSyncs: number`, `lastSyncHadActivity: boolean`, `lastUserActionAt: number`, `currentInterval: number`
- [x] 1.3: Implement `getInterval(accountId: string): number` — returns adaptive interval based on account's current activity heuristic:
  - `lastSyncHadActivity === true` -> 60_000ms (AC 2)
  - `consecutiveIdleSyncs >= 10` -> 600_000ms (AC 4)
  - `consecutiveIdleSyncs >= 3` -> 300_000ms (AC 3)
  - Default -> 180_000ms (AC 1)
- [x] 1.4: Implement `recordSyncResult(accountId: string, hadNewMessages: boolean)` — updates activity counter: if `hadNewMessages`, reset `consecutiveIdleSyncs` to 0 and set `lastSyncHadActivity = true`; otherwise increment `consecutiveIdleSyncs` and set `lastSyncHadActivity = false`
- [x] 1.5: Implement `recordUserAction(accountId: string)` — sets `lastUserActionAt = Date.now()`, resets `consecutiveIdleSyncs` to 0, sets `lastSyncHadActivity = true` (so next interval = 60s, AC 5)
- [x] 1.6: Implement `isEnabled(): boolean` — checks `localStorage.getItem('claine:adaptive-polling-enabled')`, defaults to `true`
- [x] 1.7: Implement `setEnabled(enabled: boolean)` — stores in localStorage, if disabled all accounts use fixed interval
- [x] 1.8: Read min/max bounds from env vars: `VITE_ADAPTIVE_MIN_INTERVAL_MS` (default 60_000), `VITE_ADAPTIVE_MAX_INTERVAL_MS` (default 600_000). Clamp `getInterval()` result to these bounds (AC 10)
- [x] 1.9: Export singleton: `export const adaptiveInterval = new AdaptiveIntervalService()`

### Task 2: Persist Adaptive State (AC: 7)

**Files:**

- `src/services/sync/adaptiveInterval.ts` (MODIFY)

**Subtasks:**

- [x] 2.1: Implement `save()` — serializes `accountStates` Map to JSON and writes to `localStorage.setItem('claine:adaptive-polling-state', json)`. Called after every state mutation (recordSyncResult, recordUserAction)
- [x] 2.2: Implement `load()` — reads from `localStorage.getItem('claine:adaptive-polling-state')`, parses JSON, populates `accountStates` Map. Called in constructor
- [x] 2.3: Implement `reset(accountId?: string)` — if accountId provided, deletes that account's state; otherwise clears all state and localStorage entry
- [x] 2.4: Add try/catch around localStorage operations to handle storage unavailable/full scenarios gracefully (fall back to in-memory only)

### Task 3: Integrate Adaptive Intervals into SyncOrchestrator (AC: 1-4, 6)

**Files:**

- `src/services/sync/syncOrchestrator.ts` (MODIFY)

**Subtasks:**

- [x] 3.1: Import `adaptiveInterval` from `./adaptiveInterval`
- [x] 3.2: Modify `scheduleNextSync(accountId)` — replace `this.syncInterval` with `adaptiveInterval.isEnabled() ? adaptiveInterval.getInterval(accountId) : this.syncInterval`
- [x] 3.3: Modify `syncAccount(accountId)` — before sync, capture `emailsSynced` from progress; after sync, capture again. If count increased, call `adaptiveInterval.recordSyncResult(accountId, true)`, otherwise `adaptiveInterval.recordSyncResult(accountId, false)`
- [x] 3.4: Log the chosen interval in `scheduleNextSync()` for observability: `logger.debug('sync-orchestrator', 'Scheduled next sync', { accountId, intervalMs, adaptiveEnabled })`

### Task 4: User Action Reset (AC: 5)

**Files:**

- `src/services/sync/syncOrchestrator.ts` (MODIFY)
- `src/services/sync/adaptiveInterval.ts` (MODIFY — add subscription helper)

**Subtasks:**

- [x] 4.1: Added `subscribeToActionEvents()` method on `SyncOrchestratorService` (simpler than originally planned helper on adaptiveInterval). Accepts Observable with `action.accountId` or `item.accountId`, calls `recordUserAction()` and reschedules sync
- [x] 4.2: In `SyncOrchestratorService`, the `subscribeToActionEvents()` method can be called with `emailActionsService.getEvents$()` — on each action event, calls `adaptiveInterval.recordUserAction(accountId)` and reschedules sync with the shortened interval
- [x] 4.3: Also accepts send queue events (`sendQueueService.getEvents$()`) for the same reset behavior (sending an email = user action)
- [x] 4.4: Ensure subscriptions are cleaned up in `stop()`

### Task 5: Account Switch Immediate Sync (AC: 8)

**Files:**

- `src/services/sync/syncOrchestrator.ts` (MODIFY)

**Subtasks:**

- [x] 5.1: Add `onAccountSwitch(accountId: string)` method to `SyncOrchestratorService` — cancels any pending timer for this account and immediately triggers `syncAccount(accountId)`, then reschedules
- [x] 5.2: Export the method so it can be called from account switcher component/store

### Task 6: Configuration (AC: 9-10)

**Files:**

- `src/services/sync/adaptiveInterval.ts` (already has env var and enable/disable logic from Task 1)
- `.env.example` (MODIFY — document new env vars)

**Subtasks:**

- [x] 6.1: Verify env vars `VITE_ADAPTIVE_MIN_INTERVAL_MS` and `VITE_ADAPTIVE_MAX_INTERVAL_MS` work correctly (already implemented in Task 1.8)
- [x] 6.2: Add `VITE_ADAPTIVE_MIN_INTERVAL_MS` and `VITE_ADAPTIVE_MAX_INTERVAL_MS` to `.env.example` with documentation comments
- [x] 6.3: The settings toggle (AC 9) is exposed via `adaptiveInterval.isEnabled()` / `adaptiveInterval.setEnabled()` from Task 1.6/1.7. UI integration is out of scope for this story (settings panel will wire it in a future story)

### Task 7: Unit Tests for AdaptiveIntervalService (AC: 11-14)

**Files:**

- `src/services/sync/__tests__/adaptiveInterval.test.ts` (NEW)

**Subtasks:**

- [x] 7.1: Test: Default interval is 180_000ms when no activity recorded (AC 1)
- [x] 7.2: Test: Interval shortens to 60_000ms after sync with new messages (AC 2, AC 11)
- [x] 7.3: Test: Interval extends to 300_000ms after 3 consecutive idle syncs (AC 3)
- [x] 7.4: Test: Interval extends to 600_000ms after 10 consecutive idle syncs (AC 4, AC 12)
- [x] 7.5: Test: `recordUserAction()` resets interval to 60_000ms (AC 5, AC 13)
- [x] 7.6: Test: After user action, next idle sync resets to 180_000ms baseline (not stuck at 60s)
- [x] 7.7: Test: Two accounts track independently — account A idle while account B active (AC 6, AC 14)
- [x] 7.8: Test: `getInterval()` clamps to min/max env var bounds (AC 10)
- [x] 7.9: Test: `isEnabled()` returns true by default; `setEnabled(false)` disables adaptive polling
- [x] 7.10: Test: State persistence — `save()` writes to localStorage, `load()` restores state
- [x] 7.11: Test: `reset()` clears account state and localStorage
- [x] 7.12: Test: localStorage failure handled gracefully (falls back to in-memory)

### Task 8: Integration Tests for Orchestrator (AC: 1-4, 6, 8)

**Files:**

- `src/services/sync/__tests__/adaptiveInterval.integration.test.ts` (NEW)

**Subtasks:**

- [x] 8.1: Test: Orchestrator uses adaptive interval when scheduling next sync — mock `adaptiveInterval.getInterval()` and verify `setTimeout` uses returned value
- [x] 8.2: Test: After sync with new messages, orchestrator records result and next sync uses shorter interval
- [x] 8.3: Test: After sync with no new messages (3x), next sync uses 300s interval
- [x] 8.4: Test: `onAccountSwitch()` triggers immediate sync and reschedules
- [x] 8.5: Test: When adaptive polling disabled, orchestrator uses fixed interval
- [x] 8.6: Test: User action resets interval and reschedules sync

---

## Dev Notes

### Architecture Pattern

The adaptive interval service sits alongside the sync orchestrator, providing dynamic interval calculation:

```
SyncOrchestratorService
  └── scheduleNextSync(accountId)
         └── adaptiveInterval.getInterval(accountId)  ← NEW
                |
          Consult per-account state:
          - consecutiveIdleSyncs → tier selection
          - lastSyncHadActivity → fast tier
          - lastUserActionAt → reset
          - isEnabled() → fallback to fixed
```

### State Persistence Strategy

Use `localStorage` instead of adding fields to the RxDB `syncState` schema (which is at version 0 and would require a migration). The adaptive polling state is ephemeral — if it resets, the system simply starts from the default 180s interval and adapts within a few sync cycles. localStorage is the right trade-off between persistence and complexity.

**Key:** `claine:adaptive-polling-state`
**Value:** `{ [accountId]: { consecutiveIdleSyncs, lastSyncHadActivity, lastUserActionAt, currentInterval } }`

### Detecting New Messages After Sync

The `SyncProgressService.getProgress(accountId)` returns `emailsSynced` count. Compare before/after sync:

```typescript
const before = await this.progressService.getProgress(accountId)
const beforeCount = before?.emailsSynced ?? 0

// ... perform sync ...

const after = await this.progressService.getProgress(accountId)
const afterCount = after?.emailsSynced ?? 0
const hadNewMessages = afterCount > beforeCount
adaptiveInterval.recordSyncResult(accountId, hadNewMessages)
```

### Key Integration Points

**SyncOrchestrator (`syncOrchestrator.ts`):**

- `scheduleNextSync()` at line 119: Replace fixed `this.syncInterval` with `adaptiveInterval.getInterval(accountId)`
- `syncAccount()` at line 142: Add before/after emailsSynced comparison
- `start()` at line 46: Subscribe to action events for reset behavior
- `stop()` at line 78: Unsubscribe from action events

**Email Actions (`emailActionsService.ts`):**

- Has RxJS `Subject` that emits on every action — subscribe to detect user actions for AC 5

### Environment Variables

```
VITE_SYNC_INTERVAL_MS=180000       # Existing: fixed interval (used when adaptive disabled)
VITE_ADAPTIVE_MIN_INTERVAL_MS=60000   # NEW: minimum adaptive interval
VITE_ADAPTIVE_MAX_INTERVAL_MS=600000  # NEW: maximum adaptive interval
```

### Files That Must NOT Be Changed

- `src/services/database/schemas/syncState.schema.ts` — No schema changes (use localStorage instead)
- `src/services/database/init.ts` — Database initialization unchanged
- Any existing test files — only new test files

### Previous Story Learnings

- **Story 1.18:** Singleton pattern (plain class, exported instance) works well for infrastructure services
- **Story 1.19:** `subscribe()` returning unsubscribe function pattern is established
- **Story 1.20:** Health registry integration is available for monitoring adaptive interval state
- `vi.useFakeTimers()` for timing-dependent tests
- RxJS `Subject` for event streams is the established pattern

### Testing Strategy

- **Unit tests** (`adaptiveInterval.test.ts`): Pure class tests, mock localStorage, test all interval tiers and edge cases
- **Integration tests** (`adaptiveInterval.integration.test.ts`): Mock sync orchestrator internals, verify interval selection feeds through correctly to scheduling

### Technical Constraints

- **No RxDB schema changes**: Use localStorage for persistence to avoid schema migration complexity
- **No UI changes**: Settings toggle API is exposed but UI wiring is a future story
- **Memory**: AccountSyncActivity map grows linearly with accounts (max ~5 accounts typically)
- **Bundle size**: Pure TypeScript, no new dependencies

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-1-foundation-core-infrastructure.md#Story-1.15]
- [Source: src/services/sync/syncOrchestrator.ts — fixed interval scheduling]
- [Source: src/services/sync/syncProgress.ts — SyncProgressService, emailsSynced tracking]
- [Source: src/services/database/schemas/syncState.schema.ts — current sync state fields]
- [Source: src/services/email/emailActionsService.ts — action event Subject]
- [Source: stories/1-18-batched-reactive-query-triggers.md — singleton pattern reference]
- [Source: stories/1-19-circuit-breaker-provider-apis.md — singleton + subscribe pattern reference]

---

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- All 42 Story 1.15 tests pass (31 unit, 11 integration)
- 12 existing sync orchestrator tests pass — no regressions
- 3 pre-existing outlook sync test failures (case mismatch "Inbox" vs "inbox") unrelated to this story
- 0 TypeScript compilation errors
- 0 lint errors in new files

### Completion Notes List

- **Task 1 + 2:** Created `AdaptiveIntervalService` in `src/services/sync/adaptiveInterval.ts` — singleton class with per-account `AccountSyncActivity` tracking. Implements 4-tier interval logic (60s active, 180s default, 300s idle-3, 600s idle-10), localStorage persistence, enable/disable toggle, min/max env var clamping, and graceful localStorage failure handling.
- **Task 3:** Modified `SyncOrchestratorService.scheduleNextSync()` to use adaptive interval when enabled. Modified `syncAccount()` to compare emailsSynced before/after sync and call `recordSyncResult()`.
- **Task 4:** Added `subscribeToActionEvents()` method on the orchestrator (simpler than the originally planned helper on adaptiveInterval). Accepts any Observable with `action.accountId` or `item.accountId`. Calls `recordUserAction()` and reschedules sync. Subscriptions cleaned up in `stop()`.
- **Task 5:** Added `onAccountSwitch(accountId)` method — cancels pending timer, triggers immediate sync, reschedules with adaptive interval.
- **Task 6:** Added `VITE_ADAPTIVE_MIN_INTERVAL_MS` and `VITE_ADAPTIVE_MAX_INTERVAL_MS` to `.env.example`. Settings toggle API exposed via `isEnabled()`/`setEnabled()` — UI wiring is future story.
- **Task 7:** 29 unit tests covering all interval tiers, sync result recording, user action reset, per-account independence, enable/disable, persistence, reset, and localStorage failure handling.
- **Task 8:** 11 integration tests covering orchestrator with adaptive intervals: scheduling, activity detection, tier progression, account switch, action event subscription, cleanup, and multi-account independence.

### Change Log

- 2026-02-03: Story drafted from epic requirements and codebase analysis
- 2026-02-03: Story 1.15 implementation complete — all 8 tasks, 40 tests passing
- 2026-02-03: Code review fixes (7 issues: 3 HIGH, 3 MEDIUM, 1 LOW):
  - H1: Wired subscribeToActionEvents() to emailActionsService and sendQueueService in App.tsx
  - H2: Wired onAccountSwitch() via useEffect watching activeAccountId in App.tsx
  - H3: Added Number.isFinite() guard for parseInt of env vars (NaN protection)
  - M1: getState() now returns shallow copy to prevent external mutation
  - M2: Added enabledCache to avoid localStorage reads on every getInterval() call
  - M3: Added unit tests for custom env var bounds and invalid env var fallback (2 new tests)
  - L1: Noted but deferred (double isEnabled() in debug log — cosmetic only)
  - Total tests: 42 (31 unit + 11 integration)

### File List

**New files:**

- `src/services/sync/adaptiveInterval.ts` — AdaptiveIntervalService singleton
- `src/services/sync/__tests__/adaptiveInterval.test.ts` — Unit tests (31)
- `src/services/sync/__tests__/adaptiveInterval.integration.test.ts` — Integration tests (11)

**Modified files:**

- `src/services/sync/syncOrchestrator.ts` — Adaptive interval integration, action event subscriptions
- `src/App.tsx` — Wired subscribeToActionEvents() and onAccountSwitch()
- `.env.example` — New env var documentation
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — Story status tracking
