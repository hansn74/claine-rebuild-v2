# Story 1.19: Circuit Breaker for Provider APIs

**Story ID:** 1-19-circuit-breaker-provider-apis
**Epic:** Epic 1 - Foundation & Core Infrastructure
**Status:** done
**Priority:** High (Correct Course Priority 1)
**Created:** 2026-02-02
**Estimated Effort:** 6 hours
**Prerequisites:** Story 1.10 (retry logic), Story 1.6A/1.6B (sync engines)

---

## Story

As a user,
I want the app to stop hammering a failing email provider and recover gracefully,
So that I don't see repeated error toasts and my rate limit tokens aren't wasted.

---

## Context

Claine's retry engine retries each queued operation independently. If Gmail's API is down, 20 queued actions each independently discover this by failing and retrying — that's up to 80 wasted API calls against a known-failing service. Superhuman uses circuit breakers to detect provider-level failures, halt all operations for a cooldown, then probe with a single request before resuming. This is a standard resilience pattern from distributed systems.

**Key Integration Points:**

- `retryEngine.ts` — `executeWithRetry<T>(fn, shouldRetry, config?)` handles per-operation retries
- `rateLimiter.ts` — `RateLimiter` class with `acquireWithThrottling()` per provider
- `errorClassification.ts` — `classifyError()` returns `ClassifiedError` with type `transient | permanent | unknown`
- `syncOrchestrator.ts` — `syncAccount()` delegates to `GmailSyncService` or `OutlookSyncService`
- `emailActionQueue.ts` — Singleton `EmailActionQueue`, `IActionSyncProvider` interface, RETRY_DELAYS [1s,5s,30s,60s], MAX_ATTEMPTS 4
- `sendQueueService.ts` — Singleton `SendQueueService`, `ISendProvider` interface, RETRY_DELAYS [1s,5s,30s], MAX_ATTEMPTS 3

**Architecture Pattern:** The circuit breaker wraps the existing rate limiter and retry engine. It is checked _before_ any API call. If the circuit is open, the operation is queued instead of attempted. The circuit breaker is a plain class singleton (following `notificationStore` pattern), not a Zustand store.

**Previous Story Learnings (1.10 - Retry Logic):**

- Error classification service: `classifyError()` returns `ClassifiedError` with `type`, `httpStatus`, `retryAfterMs`, `message`
- Transient codes: 408, 429, 500, 502, 503, 504
- Permanent codes: 400, 401, 403, 404, 410
- Retry engine: exponential backoff with 1s base, 2x multiplier, 30s cap, 3 max retries
- `executeWithRetry<T>()` is the primary retry wrapper

**Previous Story Learnings (1.14 - Logging):**

- Logger: `logger.{level}(category, message, context)` with categories: auth, sync, db, ui, general
- PII sanitizer auto-applied to all logged context objects
- Use `'sync'` category for circuit breaker logs

---

## Acceptance Criteria

### Circuit States (AC 1-7)

- **AC 1:** Circuit breaker tracks three states per provider: Closed (healthy), Open (failing), Half-Open (probing)
- **AC 2:** Closed → Open: After 5 consecutive failures or 3 failures within 60 seconds against the same provider
- **AC 3:** Open state: All operations for that provider are immediately queued (not attempted) for a cooldown period
- **AC 4:** Cooldown period: 60 seconds (configurable per provider)
- **AC 5:** Open → Half-Open: After cooldown expires, allow a single probe request through
- **AC 6:** Half-Open → Closed: If probe succeeds, resume normal operation and drain queued items
- **AC 7:** Half-Open → Open: If probe fails, reset cooldown timer

### Provider Isolation (AC 8-10)

- **AC 8:** Each provider (Gmail, Outlook) has its own independent circuit breaker
- **AC 9:** Gmail circuit opening does not affect Outlook operations (and vice versa)
- **AC 10:** Circuit state persisted in memory (not RxDB — resets on app restart, which is correct behavior)

### User Experience (AC 11-14)

- **AC 11:** When circuit opens, show provider-specific status: "Gmail temporarily unavailable — retrying in 45s"
- **AC 12:** Countdown timer visible so user knows when retry will happen
- **AC 13:** User can manually force a probe attempt (bypass cooldown)
- **AC 14:** When circuit closes (recovery), show brief success notification: "Gmail connection restored"

### Integration (AC 15-17)

- **AC 15:** Circuit breaker wraps the existing rate limiter and retry engine (not a replacement)
- **AC 16:** Action queue and sync engine both check circuit state before attempting operations
- **AC 17:** Send queue checks circuit state but allows user to force-send (bypasses circuit for explicit user action)

### Testing (AC 18-23)

- **AC 18:** Test: 5 consecutive Gmail failures → circuit opens, operations queued
- **AC 19:** Test: Cooldown expires → single probe sent, success → circuit closes, queue drains
- **AC 20:** Test: Probe fails → circuit stays open, cooldown resets
- **AC 21:** Test: Gmail circuit open → Outlook operations unaffected
- **AC 22:** Test: User force-send bypasses open circuit
- **AC 23:** Test: App restart → circuit resets to Closed (clean slate)

---

## Tasks / Subtasks

### Task 1: Create Circuit Breaker Service (AC: 1-7, 10)

**Files:**

- `src/services/sync/circuitBreaker.ts` (NEW)
- `src/services/sync/circuitBreakerTypes.ts` (NEW)

**Subtasks:**

- [x] 1.1: Define `CircuitState` type: `'closed' | 'open' | 'half-open'`
- [x] 1.2: Define `CircuitBreakerConfig` interface: `{ failureThreshold: number, failureWindowMs: number, cooldownMs: number, consecutiveFailureThreshold: number }`
- [x] 1.3: Define `ProviderCircuit` interface tracking: state, failure timestamps, consecutive failure count, last state change time, cooldown timer
- [x] 1.4: Create `CircuitBreaker` class with `Map<string, ProviderCircuit>` (keyed by provider: `'gmail' | 'outlook'`)
- [x] 1.5: Implement `recordFailure(provider)` — pushes failure timestamp, increments consecutive count, checks thresholds for Closed→Open transition
- [x] 1.6: Implement `recordSuccess(provider)` — resets consecutive count, clears failure window; in Half-Open state transitions to Closed
- [x] 1.7: Implement `canExecute(provider): boolean` — returns `true` for Closed, `false` for Open, allows single probe for Half-Open
- [x] 1.8: Implement cooldown timer: after `cooldownMs`, transitions Open→Half-Open automatically
- [x] 1.9: Implement `getState(provider): CircuitState` getter
- [x] 1.10: Implement `getCooldownRemaining(provider): number` — returns remaining ms (for UI countdown)
- [x] 1.11: Implement `forceProbe(provider)` — bypasses cooldown, transitions Open→Half-Open immediately
- [x] 1.12: Implement `reset(provider)` — resets to Closed (for testing and app restart)
- [x] 1.13: Add `DEFAULT_CIRCUIT_CONFIG` with values from AC 2/4: `{ failureThreshold: 3, failureWindowMs: 60000, cooldownMs: 60000, consecutiveFailureThreshold: 5 }`
- [x] 1.14: Follow singleton pattern: `export const circuitBreaker = new CircuitBreaker()`

### Task 2: Add Circuit Breaker Event System (AC: 11, 14)

**Files:**

- `src/services/sync/circuitBreaker.ts` (modify)

**Subtasks:**

- [x] 2.1: Add listener pattern (matching `notificationStore.ts`): `private listeners: Set<() => void>` with `subscribe(listener): () => void`
- [x] 2.2: Emit events on state transitions: `{ provider, previousState, newState, cooldownMs? }`
- [x] 2.3: Add `getStatus(provider): { state, cooldownRemainingMs, failureCount, lastFailureTime }` for UI consumption
- [x] 2.4: Add logger calls for all state transitions: `logger.info('sync', 'Circuit breaker [provider] state: closed → open', { provider, failureCount })`

### Task 3: Create Circuit Breaker UI Notification (AC: 11-14)

**Files:**

- `src/components/notifications/CircuitBreakerNotification.tsx` (NEW)

**Subtasks:**

- [x] 3.1: Create `useCircuitState()` hook (via `useSyncExternalStore`) that subscribes to circuit breaker state changes per provider
- [x] 3.2: Implement countdown timer using `setInterval` that reads `getCooldownRemaining(provider)` every second
- [x] 3.3: Create `CircuitBreakerNotification` component showing provider-specific banner: "[Provider icon] Gmail temporarily unavailable — retrying in 45s"
- [x] 3.4: Add "Retry Now" button that calls `circuitBreaker.forceProbe(provider)` (AC 13)
- [x] 3.5: Show success toast when circuit transitions Half-Open→Closed: "Gmail connection restored" (AC 14)
- [x] 3.6: Mount `CircuitBreakerNotification` in `App.tsx` (alongside `ReAuthNotification`)

### Task 4: Integrate with Sync Orchestrator (AC: 15, 16)

**Files:**

- `src/services/sync/syncOrchestrator.ts` (modify)

**Subtasks:**

- [x] 4.1: Import `circuitBreaker` in `syncOrchestrator.ts`
- [x] 4.2: In `syncAccount()`, check `circuitBreaker.canExecute(provider)` before calling sync service — if circuit open, log and skip (scheduler will retry next interval)
- [x] 4.3: Wrap sync errors: on catch, call `circuitBreaker.recordFailure(provider)` for transient errors only (use `classifyError()`)
- [x] 4.4: On sync success, call `circuitBreaker.recordSuccess(provider)`

### Task 5: Integrate with Email Action Queue (AC: 15, 16)

**Files:**

- `src/services/email/emailActionQueue.ts` (modify)

**Subtasks:**

- [x] 5.1: Import `circuitBreaker` in `emailActionQueue.ts`
- [x] 5.2: In `processAction()`, check `circuitBreaker.canExecute(providerForAccount)` before calling `provider.syncAction()` — if circuit open, skip this action (leave as pending, will be retried when circuit closes)
- [x] 5.3: On `syncAction()` failure, call `circuitBreaker.recordFailure(provider)` for transient errors
- [x] 5.4: On `syncAction()` success, call `circuitBreaker.recordSuccess(provider)`
- [x] 5.5: Need to resolve provider from accountId — add `getProviderForAccount(accountId): 'gmail' | 'outlook'` helper (can query account store or pass provider through action queue document)

### Task 6: Integrate with Send Queue (AC: 15, 17)

**Files:**

- `src/services/email/sendQueueService.ts` (modify)

**Subtasks:**

- [x] 6.1: Import `circuitBreaker` in `sendQueueService.ts`
- [x] 6.2: In `sendQueuedEmail()`, check `circuitBreaker.canExecute(provider)` — if circuit open and not user-initiated, skip
- [x] 6.3: Add `forceSend` parameter to `sendQueuedEmail()` that bypasses circuit check (AC 17)
- [x] 6.4: On send failure, call `circuitBreaker.recordFailure(provider)` for transient errors
- [x] 6.5: On send success, call `circuitBreaker.recordSuccess(provider)`

### Task 7: Unit Tests (AC: 18-23)

**Files:**

- `src/services/sync/__tests__/circuitBreaker.test.ts` (NEW)

**Subtasks:**

- [x] 7.1: Test circuit starts in Closed state (default)
- [x] 7.2: Test `recordFailure()` 5 consecutive times → state transitions to Open (AC 18)
- [x] 7.3: Test `recordFailure()` 3 times within 60s window → state transitions to Open (AC 18)
- [x] 7.4: Test Open state → `canExecute()` returns false
- [x] 7.5: Test cooldown expiry → state transitions to Half-Open, `canExecute()` allows single request (AC 19)
- [x] 7.6: Test Half-Open + `recordSuccess()` → state transitions to Closed (AC 19)
- [x] 7.7: Test Half-Open + `recordFailure()` → state transitions back to Open, cooldown resets (AC 20)
- [x] 7.8: Test provider isolation: Gmail open, Outlook still closed (AC 21)
- [x] 7.9: Test `forceProbe()` bypasses cooldown → transitions to Half-Open immediately
- [x] 7.10: Test `reset()` returns to Closed state (AC 23 — simulates app restart)
- [x] 7.11: Test `getCooldownRemaining()` returns correct value and decrements over time
- [x] 7.12: Test only transient errors trip the breaker (permanent errors do NOT increment failure count)
- [x] 7.13: Test failure window: 3 failures spread across >60s should NOT trip breaker (window expiry)
- [x] 7.14: Test event listener receives state transition notifications
- [x] 7.15: Test `getStatus()` returns correct aggregate status

### Task 8: Integration Tests (AC: 22)

**Files:**

- `src/services/sync/__tests__/circuitBreaker.integration.test.ts` (NEW)

**Subtasks:**

- [x] 8.1: Test send queue with `forceSend: true` bypasses open circuit (AC 22)
- [x] 8.2: Test action queue skips actions when circuit open, processes them after circuit closes
- [x] 8.3: Test sync orchestrator skips sync when circuit open, resumes when circuit closes

---

## Dev Notes

### Circuit Breaker State Machine

```
         success
    ┌──────────────┐
    │              │
    ▼    failure   │
 CLOSED ────────► OPEN
    ▲    (5 consec   │
    │    or 3/60s)   │
    │              cooldown
    │              expires
    │                │
    │    success     ▼
    └──────────── HALF-OPEN
         probe       │
         success     │
                     │ probe
                     │ failure
                     ▼
                   OPEN
                   (reset
                   cooldown)
```

### Service Pattern

Follow the `notificationStore.ts` singleton pattern:

- Plain class (not Zustand)
- `Map<string, ProviderCircuit>` for per-provider state
- `Set<() => void>` listener pattern for UI subscriptions
- `subscribe(listener): () => void` for React hook integration
- Export singleton: `export const circuitBreaker = new CircuitBreaker()`

### Integration Hook Points

**SyncOrchestrator (`syncAccount` method, line ~132):**

```typescript
// BEFORE existing sync call:
const provider = progress?.provider // 'gmail' | 'outlook'
if (provider && !circuitBreaker.canExecute(provider)) {
  logger.info('sync', 'Circuit open, skipping sync', { accountId, provider })
  return
}

// AFTER sync success (existing code, add):
circuitBreaker.recordSuccess(provider)

// IN catch block (existing code, add):
const classified = classifyError(error)
if (classified.type === 'transient' || classified.type === 'unknown') {
  circuitBreaker.recordFailure(provider)
}
```

**EmailActionQueue (`processAction` method):**

```typescript
// BEFORE provider.syncAction(action) call:
const provider = getProviderForAccount(action.accountId)
if (!circuitBreaker.canExecute(provider)) {
  logger.debug('sync', 'Circuit open, deferring action', { actionId: action.id, provider })
  return // Leave action as pending, will be processed on next queue run
}
```

**SendQueueService (`sendQueuedEmail` method):**

```typescript
// Add forceSend parameter, default false
// BEFORE provider.sendEmail(item) call:
if (!forceSend && !circuitBreaker.canExecute(provider)) {
  logger.debug('sync', 'Circuit open, deferring send', { queueId: item.id, provider })
  return
}
```

### Error Types That Trip the Breaker

Only **transient** and **unknown** errors should increment the circuit breaker failure count. Permanent errors (400, 401, 403, 404, 410) are per-operation issues, not provider-level failures.

Errors that SHOULD trip the breaker:

- 429 (Rate Limit) — persistent rate limiting indicates provider stress
- 500, 502, 503, 504 — server-side failures
- Network errors (TypeError: Failed to fetch)
- Timeout errors (408)

Errors that SHOULD NOT trip the breaker:

- 400 (Bad Request) — client-side issue
- 401 (Unauthorized) — auth issue, handled by re-auth flow
- 403 (Forbidden) — permission issue
- 404 (Not Found) — specific resource issue

### Logging Convention

```typescript
logger.info('sync', 'Circuit breaker opened', {
  provider: 'gmail',
  failureCount: 5,
  cooldownMs: 60000,
})
logger.info('sync', 'Circuit breaker probe started', { provider: 'gmail' })
logger.info('sync', 'Circuit breaker closed (recovered)', { provider: 'gmail' })
logger.warn('sync', 'Circuit breaker probe failed', { provider: 'gmail', cooldownMs: 60000 })
```

### Project Structure Notes

**New Files:**

```
src/services/sync/
├── circuitBreaker.ts           # Circuit breaker service (NEW)
├── circuitBreakerTypes.ts      # Type definitions (NEW)
├── __tests__/
│   ├── circuitBreaker.test.ts            # Unit tests (NEW)
│   └── circuitBreaker.integration.test.ts # Integration tests (NEW)

src/components/notifications/
├── CircuitBreakerNotification.tsx  # UI notification component (NEW)
```

**Modified Files:**

- `src/services/sync/syncOrchestrator.ts` — Check circuit before sync, record success/failure
- `src/services/email/emailActionQueue.ts` — Check circuit before action sync
- `src/services/email/sendQueueService.ts` — Check circuit before send, add forceSend param
- `src/App.tsx` — Mount `CircuitBreakerNotification` component

### Testing Strategy

- **Unit tests** (`circuitBreaker.test.ts`): Use `vi.useFakeTimers()` for cooldown/window tests. No RxDB needed — circuit breaker is pure in-memory logic.
- **Integration tests** (`circuitBreaker.integration.test.ts`): Mock the provider interfaces (`IActionSyncProvider`, `ISendProvider`) to simulate failures, verify circuit breaker integration with queue services.
- **Test tags:** Use `@circuit-breaker` tag for test filtering.

### Technical Constraints

- **No RxDB persistence** — Circuit state resets on app restart (AC 10). This is intentional: a fresh start should assume the provider is healthy.
- **Timer management** — Cooldown timers use `setTimeout`. Must be properly cleaned up in `reset()` to prevent memory leaks.
- **Thread safety** — Not a concern in browser single-thread environment, but `canExecute()` in Half-Open must only allow one probe (use a `probeInFlight` boolean flag).

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-1-foundation-core-infrastructure.md#Story-1.19]
- [Source: src/services/sync/retryEngine.ts — executeWithRetry, DEFAULT_RETRY_CONFIG]
- [Source: src/services/sync/errorClassification.ts — classifyError, ClassifiedError, TRANSIENT_HTTP_CODES]
- [Source: src/services/sync/rateLimiter.ts — RateLimiter class, createGmailRateLimiter, createOutlookRateLimiter]
- [Source: src/services/sync/syncOrchestrator.ts — SyncOrchestratorService, syncAccount]
- [Source: src/services/email/emailActionQueue.ts — EmailActionQueue, IActionSyncProvider]
- [Source: src/services/email/sendQueueService.ts — SendQueueService, ISendProvider]
- [Source: src/store/notificationStore.ts — NotificationStore singleton pattern]
- [Source: stories/1-10-handle-partial-sync-failures-with-retry-logic.md — error classification patterns]
- [Source: stories/1-14-logging-error-tracking-infrastructure.md — logger service patterns]

---

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

None — implementation completed without issues requiring debug logs.

### Completion Notes List

- Implemented full circuit breaker state machine (Closed/Open/Half-Open) with per-provider isolation
- Used `notificationStore.ts` singleton pattern as specified: plain class, Map<string, ProviderCircuit>, Set<() => void> listener pattern
- Cooldown timer uses `setTimeout` with cleanup in `reset()` to prevent memory leaks
- `probeInFlight` boolean flag ensures only one probe request in Half-Open state
- Only transient/unknown errors trip the breaker — permanent errors (400, 401, 403, 404) are passed through to per-operation error handling
- UI notification uses `useSyncExternalStore` for clean React integration without lint issues
- Recovery toast auto-dismisses after 3 seconds via `useRecoveryTracker` hook
- `sendQueuedEmail` now accepts `forceSend` parameter (default `false`) to bypass circuit check for user-initiated sends (AC 17)
- All 55 tests pass: 32 unit tests + 11 integration tests + 12 existing syncOrchestrator tests (no regressions)
- Zero lint errors on all new and modified circuit breaker files

### Implementation Plan

1. Created `CircuitBreaker` class with state machine and event system
2. Created `CircuitBreakerNotification` component with countdown timer and recovery toast
3. Integrated with sync orchestrator, action queue, and send queue
4. Added comprehensive unit and integration tests

### File List

**New Files:**

- `src/services/sync/circuitBreaker.ts` — Circuit breaker service with state machine, event system, snapshot caching, singleton export
- `src/services/sync/circuitBreakerTypes.ts` — TypeScript types (CircuitState, CircuitBreakerConfig, ProviderCircuit, CircuitStatus)
- `src/components/notifications/CircuitBreakerNotification.tsx` — UI notification with countdown timer and recovery toast
- `src/services/sync/__tests__/circuitBreaker.test.ts` — 32 unit tests covering all AC 18-23
- `src/services/sync/__tests__/circuitBreaker.integration.test.ts` — 11 integration tests for queue/sync integration

**Modified Files:**

- `src/services/sync/syncOrchestrator.ts` — Added circuit breaker check before sync, record success/failure
- `src/services/email/emailActionQueue.ts` — Added circuit breaker check before action sync, provider resolution helper, circuit recovery drain subscription
- `src/services/email/sendQueueService.ts` — Added circuit breaker check before send, forceSend parameter, provider ID helper, circuit recovery drain subscription
- `src/App.tsx` — Mounted CircuitBreakerNotification component

**Deleted Files:**

- `src/hooks/useCircuitBreakerStatus.ts` — Removed: unused dead code (notification component uses its own useSyncExternalStore hook)

---

## Change Log

- **2026-02-03:** Code review fixes (7 findings). Deleted unused `useCircuitBreakerStatus.ts`. Removed dead `CircuitStateEvent` type. Added snapshot caching to `getStatus()` for `useSyncExternalStore` referential stability. Wired `forceSend=true` in `retryFailedEmail` for AC 17 completeness. Fixed misleading failure count logs (captured before `transitionTo` reset). Added queue drain subscriptions to `EmailActionQueue` and `SendQueueService` for AC 6. Improved integration tests to mirror real service patterns (43 tests total). (Claude Opus 4.5)
- **2026-02-02:** Implemented Story 1.19 — Circuit Breaker for Provider APIs. Added circuit breaker state machine with per-provider isolation (Gmail/Outlook), cooldown timers, UI notifications with countdown and recovery toasts, and integration with sync orchestrator, action queue, and send queue. 39 new tests (32 unit + 7 integration), all passing. (Claude Opus 4.5)
