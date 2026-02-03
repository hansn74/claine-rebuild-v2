# Story 1.20: Subsystem Health Tracking

**Story ID:** 1-20-subsystem-health-tracking
**Epic:** Epic 1 - Foundation & Core Infrastructure
**Status:** done
**Priority:** High (Correct Course Priority 3)
**Created:** 2026-02-03
**Estimated Effort:** 5 hours
**Prerequisites:** Story 1.19 (circuit breaker - done), Story 1.14 (logging - done)

---

## Story

As a user,
I want to see which parts of the app are working and which are degraded,
So that I understand what's happening instead of seeing generic errors.

---

## Context

Claine currently reports errors per-operation (circuit breaker notifications, offline indicator, individual sync errors). This doesn't give users a clear picture of overall system health. Subsystem health tracking provides a unified health registry that aggregates signals from circuit breaker, retry engine, network status, and other subsystems into coherent per-subsystem states (Healthy / Degraded / Unavailable).

**Key Design Principle:** Healthy = invisible. Only show UI when something is wrong. The health indicator in the header is subtle and non-intrusive — no indicator when all systems are healthy (AC 11).

**Relationship to Existing Components:**

- **CircuitBreakerNotification** (Story 1.19): Remains as-is for immediate provider-failure banners. The health registry _reads_ circuit breaker state but does not replace it.
- **OfflineIndicator** (Story 2.7): Remains as-is for offline badge. The health registry reads network status as an input signal.
- **Health indicator** (this story): New, complementary component showing aggregate subsystem status. Goes in the same header area alongside existing indicators.

---

## Acceptance Criteria

### Health Registry (AC 1-5)

- **AC 1:** Central health registry tracks status of each subsystem: sync (per provider), action queue, send queue, search index, database
- **AC 2:** Each subsystem reports one of: Healthy, Degraded, Unavailable
- **AC 3:** Healthy: All operations succeeding normally
- **AC 4:** Degraded: Some failures detected, operations partially working (e.g., circuit half-open, retry in progress)
- **AC 5:** Unavailable: Subsystem not functioning (e.g., circuit open, database init failed)

### Health Signals (AC 6-9)

- **AC 6:** Circuit breaker state feeds into health status (Open → Unavailable, Half-Open → Degraded, Closed → Healthy)
- **AC 7:** Retry engine failure rate feeds into health status (>50% failure rate in last 5 min → Degraded)
- **AC 8:** Network status feeds into health status (offline → all remote subsystems Degraded)
- **AC 9:** Health status updates debounced (don't flicker between states on transient errors)

### User-Facing Status (AC 10-14)

- **AC 10:** Health summary accessible from app header (subtle indicator, not intrusive)
- **AC 11:** Healthy state: no indicator shown (clean UI when everything works)
- **AC 12:** Degraded state: yellow indicator with tooltip showing which subsystem and why
- **AC 13:** Unavailable state: red indicator with expandable detail panel
- **AC 14:** Detail panel shows per-subsystem status with last error and next retry time

### Developer/Debug Access (AC 15-16)

- **AC 15:** Full health history (last 50 state changes) accessible via settings/debug panel
- **AC 16:** Health state changes logged to console in development mode

### Testing (AC 17-21)

- **AC 17:** Test: All subsystems healthy → no indicator shown
- **AC 18:** Test: Gmail circuit opens → indicator shows "Gmail sync: unavailable"
- **AC 19:** Test: Network offline → indicator shows "Sync: degraded (offline)"
- **AC 20:** Test: Recovery → indicator disappears after subsystem returns to healthy
- **AC 21:** Test: Multiple degraded subsystems → all listed in detail panel

---

## Tasks / Subtasks

### Task 1: Create Health Registry Types (AC: 1-5)

**Files:**

- `src/services/sync/healthTypes.ts` (NEW)

**Subtasks:**

- [x] 1.1: Define `HealthState` type: `'healthy' | 'degraded' | 'unavailable'`
- [x] 1.2: Define `SubsystemId` type: `'sync-gmail' | 'sync-outlook' | 'action-queue' | 'send-queue' | 'search-index' | 'database'`
- [x] 1.3: Define `SubsystemHealth` interface: `{ id: SubsystemId, state: HealthState, reason?: string, lastError?: string, nextRetryAt?: number, lastStateChange: number }`
- [x] 1.4: Define `HealthStateChange` interface for history: `{ subsystemId: SubsystemId, previousState: HealthState, newState: HealthState, reason: string, timestamp: number }`
- [x] 1.5: Define `HealthSnapshot` interface: `{ subsystems: Map<SubsystemId, SubsystemHealth>, overallState: HealthState, lastUpdated: number }`

### Task 2: Create Health Registry Service (AC: 1-5, 9, 15-16)

**Files:**

- `src/services/sync/healthRegistry.ts` (NEW)

**Subtasks:**

- [x] 2.1: Create `HealthRegistry` class following `circuitBreaker.ts` singleton pattern: plain class (NOT Zustand), `Set<() => void>` listener pattern, `subscribe(listener): () => void`
- [x] 2.2: Internal state: `Map<SubsystemId, SubsystemHealth>` for current state, `HealthStateChange[]` (capped at 50 entries) for history (AC 15)
- [x] 2.3: Implement `updateHealth(subsystemId, state, reason?, lastError?, nextRetryAt?)` — updates subsystem state, pushes to history, notifies listeners
- [x] 2.4: Implement debounced state transitions (AC 9): use a 2-second debounce window before transitioning from Healthy → Degraded. Direct Healthy ↔ Unavailable transitions are immediate (no debounce). Degraded → Healthy also debounced (2s) to avoid flicker on transient recovery.
- [x] 2.5: Implement `getSnapshot(): HealthSnapshot` — returns current state of all subsystems with cached reference for `useSyncExternalStore` (same pattern as `circuitBreaker.getStatus()` — cache and return stable reference until state changes)
- [x] 2.6: Implement `getOverallState(): HealthState` — worst-of: if any Unavailable → Unavailable; if any Degraded → Degraded; else Healthy
- [x] 2.7: Implement `getHistory(): HealthStateChange[]` — returns last 50 state changes (AC 15)
- [x] 2.8: Add logger calls for all state transitions in dev mode (AC 16): `logger.info('sync', 'Health: [subsystemId] [prev] → [new]', { subsystemId, reason })`
- [x] 2.9: Initialize all subsystems as Healthy on construction
- [x] 2.10: Export singleton: `export const healthRegistry = new HealthRegistry()`
- [x] 2.11: Implement `reset()` for testing — resets all subsystems to Healthy, clears history

### Task 3: Wire Health Signals from Circuit Breaker (AC: 6)

**Files:**

- `src/services/sync/healthRegistry.ts` (modify)

**Subtasks:**

- [x] 3.1: In constructor or via `initialize()` method, subscribe to `circuitBreaker.subscribe()` — on each notification, read `circuitBreaker.getStatus('gmail')` and `circuitBreaker.getStatus('outlook')` and map: `closed` → Healthy, `half-open` → Degraded, `open` → Unavailable
- [x] 3.2: Include cooldown remaining in `nextRetryAt` field: `Date.now() + status.cooldownRemainingMs`
- [x] 3.3: Include failure count in `reason`: e.g., "Circuit open (5 failures)" or "Circuit probing"
- [x] 3.4: Unsubscribe from circuit breaker in `dispose()` method (for testing cleanup)

### Task 4: Wire Health Signals from Sync Progress (AC: 7 partial)

**Files:**

- `src/services/sync/healthRegistry.ts` (modify)

**Subtasks:**

- [x] 4.1: Add `connectSyncProgress(syncProgressService: SyncProgressService)` method — polls `getAllProgress()` on a 30-second interval to check sync state per account
- [x] 4.2: Map sync status: `'error'` with high errorCount → Degraded (only if circuit breaker shows Healthy — circuit breaker takes priority for sync-gmail/sync-outlook subsystems)
- [x] 4.3: Store interval ID for cleanup in `dispose()`

### Task 5: Wire Health Signals from Network Status (AC: 8)

**Files:**

- `src/services/sync/healthRegistry.ts` (modify)

**Subtasks:**

- [x] 5.1: Add `connectNetworkStatus(isOnline: boolean)` method — called from a React component or hook that observes network status
- [x] 5.2: When offline: set all remote subsystems (sync-gmail, sync-outlook, action-queue, send-queue) to Degraded with reason "Network offline"
- [x] 5.3: When back online: clear the network-offline degradation (subsystems revert to their actual state from other signals)
- [x] 5.4: Network-offline is a separate signal layer — does not override circuit breaker Unavailable (if circuit is Open, subsystem stays Unavailable even if network is online)

### Task 6: Wire Health Signals from Action Queue and Send Queue (AC: 7)

**Files:**

- `src/services/sync/healthRegistry.ts` (modify)

**Subtasks:**

- [x] 6.1: Add `connectActionQueue(actionQueue: EmailActionQueue)` method — subscribes to `actionQueue.getEvents$()` observable
- [x] 6.2: Track failure rate: count `'failed'` events in a 5-minute sliding window. If >50% of events are failures → Degraded. If all recent operations fail → Unavailable
- [x] 6.3: Add `connectSendQueue(sendQueue: SendQueueService)` method — subscribes to `sendQueue.getEvents$()` observable
- [x] 6.4: Same failure rate tracking for send queue as action queue
- [x] 6.5: On recovery (failure rate drops below 50%) → transition back to Healthy
- [x] 6.6: Store subscriptions for cleanup in `dispose()`

### Task 7: Wire Database Health Signal (AC: 1, 5)

**Files:**

- `src/services/sync/healthRegistry.ts` (modify)

**Subtasks:**

- [x] 7.1: Add `setDatabaseHealth(healthy: boolean, error?: string)` method — simple setter since database health is determined at init time
- [x] 7.2: Called from `App.tsx` init sequence: if `initDatabase()` succeeds → Healthy; if it throws → Unavailable with error message
- [x] 7.3: Database is a local subsystem — not affected by network status signals

### Task 8: Wire Search Index Health Signal (AC: 1)

**Files:**

- `src/services/sync/healthRegistry.ts` (modify)

**Subtasks:**

- [x] 8.1: Add `setSearchIndexHealth(state: HealthState, reason?: string)` method
- [x] 8.2: Called from search index initialization: if index builds successfully → Healthy; if build fails → Degraded with reason
- [x] 8.3: Search index is a local subsystem — not affected by network status signals

### Task 9: Create Health Indicator UI Component (AC: 10-14)

**Files:**

- `src/components/ui/HealthIndicator.tsx` (NEW)

**Subtasks:**

- [x] 9.1: Create `useHealthState()` hook using `useSyncExternalStore` — subscribes to `healthRegistry.subscribe()`, reads `healthRegistry.getSnapshot()` (same pattern as `CircuitBreakerNotification.tsx` line 42-50)
- [x] 9.2: Component renders nothing when overall state is Healthy (AC 11) — return `null`
- [x] 9.3: Degraded state: render yellow dot indicator (`bg-amber-400`) with tooltip (AC 12). Tooltip shows list of degraded subsystems with reasons. Use `title` attribute for simple tooltip (or a popover if click-to-expand is preferred for AC 13)
- [x] 9.4: Unavailable state: render red dot indicator (`bg-red-500`) with click-to-expand detail panel (AC 13)
- [x] 9.5: Detail panel (expandable): shows per-subsystem status as a list. Each row: subsystem name, state badge (green/yellow/red), reason text, next retry time if applicable (AC 14). Use `absolute` positioning relative to the indicator button (like a dropdown).
- [x] 9.6: Use `lucide-react` icons: `Activity` or `HeartPulse` for the indicator icon
- [x] 9.7: Follow `OfflineIndicator.tsx` patterns: `role="status"`, `aria-live="polite"`, `aria-label` with descriptive text
- [x] 9.8: Click outside to close detail panel (use `useEffect` with document click listener)
- [x] 9.9: Subsystem display names map: `'sync-gmail'` → "Gmail sync", `'sync-outlook'` → "Outlook sync", `'action-queue'` → "Email actions", `'send-queue'` → "Send queue", `'search-index'` → "Search", `'database'` → "Database"

### Task 10: Mount Health Indicator in App Header (AC: 10)

**Files:**

- `src/App.tsx` (modify)
- `src/components/ui/index.ts` (modify — add export)

**Subtasks:**

- [x] 10.1: Import `HealthIndicator` from `@/components/ui`
- [x] 10.2: Mount `<HealthIndicator />` in header, between `OfflineIndicator` and the sync status indicators group (App.tsx line ~869, after `<OfflineIndicator />`)
- [x] 10.3: Export `HealthIndicator` from `src/components/ui/index.ts`

### Task 11: Connect Health Registry in App Initialization (AC: 6-8)

**Files:**

- `src/App.tsx` (modify)

**Subtasks:**

- [x] 11.1: Import `healthRegistry` in App.tsx
- [x] 11.2: In the existing `useEffect` database/sync init block (App.tsx line ~186-239): after `initDatabase()` success, call `healthRegistry.setDatabaseHealth(true)`. In catch block, call `healthRegistry.setDatabaseHealth(false, error.message)`
- [x] 11.3: After `initializeSyncOrchestrator(db)`, call `healthRegistry.connectSyncProgress(syncProgressService)` if the sync progress service instance is accessible
- [x] 11.4: Create a small `useHealthNetworkBridge()` hook (can be inline in App.tsx or separate file) that calls `useNetworkStatus()` and feeds `healthRegistry.connectNetworkStatus(isOnline)` on changes
- [x] 11.5: Connect action queue: `healthRegistry.connectActionQueue(emailActionQueue)` after queue initialization
- [x] 11.6: Connect send queue: `healthRegistry.connectSendQueue(sendQueueService)` after queue initialization

### Task 12: Create Debug Health Panel (AC: 15)

**Files:**

- `src/components/dev/HealthDebugPanel.tsx` (NEW)

**Subtasks:**

- [x] 12.1: Create `HealthDebugPanel` component that displays `healthRegistry.getHistory()` as a scrollable list
- [x] 12.2: Each history entry shows: timestamp (formatted), subsystem name, state transition arrow (e.g., "Healthy → Degraded"), reason
- [x] 12.3: Only render in development mode: `import.meta.env.DEV` guard
- [x] 12.4: Mount in existing `PerformanceMonitor` dev panel area (if accessible) or in AccountSettings debug section

### Task 13: Unit Tests (AC: 17-21)

**Files:**

- `src/services/sync/__tests__/healthRegistry.test.ts` (NEW)

**Subtasks:**

- [x] 13.1: Test: HealthRegistry initializes all subsystems as Healthy
- [x] 13.2: Test: `updateHealth('sync-gmail', 'unavailable', 'Circuit open')` → subsystem state updates, listeners notified
- [x] 13.3: Test: `getOverallState()` returns worst-of across all subsystems (AC 17: all healthy → 'healthy')
- [x] 13.4: Test: Circuit breaker Open → sync-gmail Unavailable (AC 18)
- [x] 13.5: Test: Circuit breaker Half-Open → sync-gmail Degraded
- [x] 13.6: Test: Circuit breaker Closed → sync-gmail Healthy
- [x] 13.7: Test: Network offline → remote subsystems Degraded (AC 19)
- [x] 13.8: Test: Network online + circuit closed → subsystem Healthy
- [x] 13.9: Test: Network offline does NOT override circuit breaker Unavailable
- [x] 13.10: Test: Debounced transitions — rapid Healthy↔Degraded flicker results in single notification after debounce window (AC 9)
- [x] 13.11: Test: History capped at 50 entries (AC 15)
- [x] 13.12: Test: Recovery → subsystem returns to Healthy, overall returns to Healthy (AC 20)
- [x] 13.13: Test: Multiple degraded subsystems tracked independently (AC 21)
- [x] 13.14: Test: Failure rate calculation — >50% failures in 5-min window → Degraded (AC 7)
- [x] 13.15: Test: `reset()` clears all state and history
- [x] 13.16: Test: `subscribe()` / unsubscribe pattern works correctly (no listener leaks)
- [x] 13.17: Test: `getSnapshot()` returns stable reference (referential equality) when state hasn't changed

### Task 14: Integration Tests (AC: 18, 19, 20)

**Files:**

- `src/services/sync/__tests__/healthRegistry.integration.test.ts` (NEW)

**Subtasks:**

- [x] 14.1: Test: Wire real `CircuitBreaker` instance → record 5 failures → health registry shows sync-gmail Unavailable (AC 18)
- [x] 14.2: Test: Wire circuit breaker → force probe → success → health registry shows sync-gmail Healthy (AC 20 recovery)
- [x] 14.3: Test: Wire action queue events → simulate >50% failure rate → action-queue shows Degraded (AC 7)
- [x] 14.4: Test: Multiple subsystem degradation → `getSnapshot()` lists all degraded subsystems (AC 21)

---

## Dev Notes

### Service Pattern

Follow the `circuitBreaker.ts` singleton pattern exactly:

```typescript
// healthRegistry.ts
class HealthRegistry {
  private subsystems = new Map<SubsystemId, SubsystemHealth>()
  private history: HealthStateChange[] = []
  private listeners = new Set<() => void>()
  private snapshotCache: HealthSnapshot | null = null

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(): void {
    this.snapshotCache = null // Invalidate cache
    this.listeners.forEach((l) => l())
  }

  getSnapshot(): HealthSnapshot {
    if (!this.snapshotCache) {
      this.snapshotCache = {
        subsystems: new Map(this.subsystems),
        overallState: this.getOverallState(),
        lastUpdated: Date.now(),
      }
    }
    return this.snapshotCache
  }
}

export const healthRegistry = new HealthRegistry()
```

### React Integration Pattern

Use `useSyncExternalStore` exactly as in `CircuitBreakerNotification.tsx`:

```typescript
// In HealthIndicator.tsx
function useHealthState(): HealthSnapshot {
  return useSyncExternalStore(
    (callback) => healthRegistry.subscribe(callback),
    () => healthRegistry.getSnapshot()
  )
}
```

### Debounce Strategy (AC 9)

Use `setTimeout` for debouncing state transitions (NOT RxJS — keep it simple like circuit breaker):

```typescript
private debounceTimers = new Map<SubsystemId, ReturnType<typeof setTimeout>>()

updateHealth(id: SubsystemId, newState: HealthState, reason?: string) {
  const current = this.subsystems.get(id)
  if (current?.state === newState) return // No change

  // Immediate transitions: anything → Unavailable, Unavailable → anything
  if (newState === 'unavailable' || current?.state === 'unavailable') {
    this.applyStateChange(id, newState, reason)
    return
  }

  // Debounced: Healthy ↔ Degraded (2 second window)
  clearTimeout(this.debounceTimers.get(id))
  this.debounceTimers.set(id, setTimeout(() => {
    this.applyStateChange(id, newState, reason)
    this.debounceTimers.delete(id)
  }, 2000))
}
```

### Failure Rate Tracking (AC 7)

5-minute sliding window for action queue and send queue:

```typescript
private failureWindows = new Map<SubsystemId, { timestamp: number, failed: boolean }[]>()

private updateFailureRate(subsystemId: SubsystemId, failed: boolean) {
  const window = this.failureWindows.get(subsystemId) ?? []
  const now = Date.now()
  const fiveMinAgo = now - 5 * 60 * 1000

  // Add new entry, prune old entries
  window.push({ timestamp: now, failed })
  const recent = window.filter(e => e.timestamp > fiveMinAgo)
  this.failureWindows.set(subsystemId, recent)

  // Calculate rate
  if (recent.length < 3) return // Not enough data
  const failRate = recent.filter(e => e.failed).length / recent.length
  if (failRate > 0.5) {
    this.updateHealth(subsystemId, 'degraded', `High failure rate (${Math.round(failRate * 100)}%)`)
  } else {
    this.updateHealth(subsystemId, 'healthy')
  }
}
```

### Signal Priority

When multiple signals affect the same subsystem, use worst-of logic:

1. Circuit breaker Open → **Unavailable** (overrides everything)
2. Network offline → **Degraded** (unless circuit already Unavailable)
3. Failure rate >50% → **Degraded** (unless circuit already Unavailable)
4. No issues → **Healthy**

Implementation: store signal sources per subsystem and compute effective state from all active signals.

### Header Placement

Mount `<HealthIndicator />` in the header (App.tsx line ~869), after `<OfflineIndicator />`:

```tsx
<div className="flex items-center gap-4">
  {/* Offline indicator */}
  <OfflineIndicator />

  {/* Subsystem health indicator - Story 1.20 */}
  <HealthIndicator />

  {/* Sync status indicators */}
  <div className="flex items-center gap-2">
```

### Existing Components NOT Modified

- `CircuitBreakerNotification.tsx` — remains for immediate provider-failure banners
- `OfflineIndicator.tsx` — remains for offline badge
- `QueueStatusBadge` — remains for queue count display
- `SyncButton` — remains for manual sync trigger

The health indicator is complementary, providing aggregate subsystem-level view.

### Project Structure Notes

**New Files:**

```
src/services/sync/
├── healthTypes.ts                    # Type definitions (NEW)
├── healthRegistry.ts                 # Health registry service (NEW)
├── __tests__/
│   ├── healthRegistry.test.ts        # Unit tests (NEW)
│   └── healthRegistry.integration.test.ts  # Integration tests (NEW)

src/components/ui/
├── HealthIndicator.tsx               # Health indicator component (NEW)

src/components/dev/
├── HealthDebugPanel.tsx              # Debug panel (NEW, dev-only)
```

**Modified Files:**

- `src/App.tsx` — Mount HealthIndicator, connect health registry in init sequence
- `src/components/ui/index.ts` — Export HealthIndicator

### Testing Strategy

- **Unit tests** (`healthRegistry.test.ts`): Use `vi.useFakeTimers()` for debounce window tests. Mock circuit breaker with custom `CircuitBreaker` instance. No RxDB needed — health registry is pure in-memory logic.
- **Integration tests** (`healthRegistry.integration.test.ts`): Wire real `CircuitBreaker` instance, simulate failures, verify health state propagation. Use `Subject<ActionQueueEvent>` to simulate queue events.
- **No E2E tests** — UI validation through manual testing; unit tests cover all AC logic.

### Key Integration Points Reference

| Service         | File                                     | Method                            | Returns                                                                       |
| --------------- | ---------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------- | ------------ | -------- | -------- | ------------------ | ------------------ |
| Circuit Breaker | `src/services/sync/circuitBreaker.ts`    | `subscribe(listener)`             | `() => void` (unsubscribe)                                                    |
| Circuit Breaker | same                                     | `getStatus(provider: ProviderId)` | `CircuitStatus { state, cooldownRemainingMs, failureCount, lastFailureTime }` |
| Action Queue    | `src/services/email/emailActionQueue.ts` | `getEvents$()`                    | `Observable<ActionQueueEvent>` — events: `'queued'                            | 'processing' | 'synced' | 'failed' | 'retry-scheduled'` |
| Send Queue      | `src/services/email/sendQueueService.ts` | `getEvents$()`                    | `Observable<SendQueueEvent>` — events: `'queued'                              | 'sending'    | 'sent'   | 'failed' | 'cancelled'        | 'retry-scheduled'` |
| Network Status  | `src/hooks/useNetworkStatus.ts`          | `useNetworkStatus()`              | `{ isOnline, lastChecked, checking }`                                         |
| Sync Progress   | `src/services/sync/syncProgress.ts`      | `getAllProgress()`                | `Promise<SyncProgress[]>`                                                     |
| Logger          | `src/services/logger/index.ts`           | `logger.info(category, msg, ctx)` | void — use category `'sync'`                                                  |
| DB Init         | `src/services/database/init.ts`          | `initDatabase()`                  | `Promise<AppDatabase>`                                                        |

### Technical Constraints

- **No RxDB persistence** — Health state resets on app restart (same rationale as circuit breaker). Fresh start = assume healthy.
- **Timer management** — Debounce timers and polling intervals must be cleaned up in `dispose()` to prevent memory leaks in tests.
- **Snapshot stability** — `getSnapshot()` must return the same reference when state hasn't changed (for `useSyncExternalStore` to avoid unnecessary re-renders).
- **Signal layering** — Multiple signals can affect the same subsystem simultaneously. Use worst-of logic, not last-write-wins.

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-1-foundation-core-infrastructure.md#Story-1.20]
- [Source: src/services/sync/circuitBreaker.ts — CircuitBreaker class, subscribe(), getStatus(), singleton]
- [Source: src/services/sync/circuitBreakerTypes.ts — CircuitState, ProviderId, CircuitStatus]
- [Source: src/components/notifications/CircuitBreakerNotification.tsx — useSyncExternalStore pattern, useCircuitState hook]
- [Source: src/services/email/emailActionQueue.ts — getEvents$(), ActionQueueEvent type]
- [Source: src/services/email/sendQueueService.ts — getEvents$(), SendQueueEvent type]
- [Source: src/hooks/useNetworkStatus.ts — useNetworkStatus(), NetworkStatus interface]
- [Source: src/services/sync/syncProgress.ts — SyncProgressService, getAllProgress()]
- [Source: src/services/database/init.ts — initDatabase(), dbInstance]
- [Source: src/services/logger/index.ts — logger singleton, LogCategory]
- [Source: src/components/ui/OfflineIndicator.tsx — role="status", aria-live="polite" pattern]
- [Source: src/store/notificationStore.ts — Set<() => void> listener pattern]
- [Source: stories/1-19-circuit-breaker-provider-apis.md — singleton pattern, useSyncExternalStore, snapshot caching]

---

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Unit tests: 33/33 passing (`healthRegistry.test.ts`)
- Integration tests: 7/7 passing (`healthRegistry.integration.test.ts`)
- CircuitBreaker tests: 43/43 still passing (no regressions)
- TypeScript: 0 errors on new files

### Completion Notes List

- Implemented central HealthRegistry service following circuitBreaker.ts singleton pattern
- Signal layering system with worst-of resolution for multi-source signals per subsystem
- 2-second debounce for Healthy↔Degraded transitions, immediate for Unavailable transitions
- Circuit breaker wired automatically in constructor via subscribe()
- Network status, action queue, send queue, database, and search index signals all connected
- HealthIndicator UI component: invisible when healthy, yellow dot for degraded, red dot for unavailable
- Expandable detail panel shows per-subsystem status with reasons and retry times
- HealthDebugPanel shows last 50 state changes in dev mode
- App.tsx updated: imports, header mount point, init block connections, network bridge
- App.test.tsx updated with healthRegistry mock to prevent import side effects
- All 40 new tests passing, 0 regressions in related test suites

### Change Log

- 2026-02-03: Story 1.20 implementation complete — all 14 tasks, 82 subtasks, 21 ACs satisfied
- 2026-02-03: Code review fixes (6 issues) — Rules of Hooks fix, dead code mounting, history cache, failure rate Unavailable, wiring gaps

### File List

**New Files:**

- `src/services/sync/healthTypes.ts` — Health registry type definitions (Task 1)
- `src/services/sync/healthRegistry.ts` — Health registry service with signal system (Tasks 2-8)
- `src/components/ui/HealthIndicator.tsx` — Health indicator UI component (Task 9)
- `src/components/dev/HealthDebugPanel.tsx` — Debug health history panel (Task 12)
- `src/services/sync/__tests__/healthRegistry.test.ts` — 33 unit tests (Task 13)
- `src/services/sync/__tests__/healthRegistry.integration.test.ts` — 7 integration tests (Task 14)

**Modified Files:**

- `src/App.tsx` — Imports, HealthIndicator mount, health registry connections, network bridge, connectSyncProgress wiring
- `src/App.test.tsx` — Added healthRegistry mock
- `src/components/ui/index.ts` — Added HealthIndicator export
- `src/components/dev/index.ts` — Added HealthDebugPanel export (review fix)
- `src/components/dev/PerformanceMonitor.tsx` — Mounted HealthDebugPanel (review fix)
- `src/hooks/useSearchIndex.ts` — Wired setSearchIndexHealth (review fix)
- `src/services/sync/syncOrchestrator.ts` — Added getProgressService() getter (review fix)
