# Story 1.17: Sync Interval Jitter

**Story ID:** 1-17-sync-interval-jitter
**Epic:** Epic 1 - Foundation & Core Infrastructure
**Status:** done
**Priority:** Medium (Correct Course Priority 3)
**Created:** 2026-02-03
**Estimated Effort:** 1 hour
**Prerequisites:** Story 1.15 (Adaptive Sync Polling Intervals)

---

## Story

As a user with multiple email accounts,
I want sync intervals to include random jitter,
so that API calls are spread across time and don't create thundering herd effects that could trigger rate limiting.

---

## Context

Claine currently syncs all accounts on exact timer intervals (60s, 180s, 300s, or 600s depending on activity tier from Story 1.15). When multiple accounts share the same tier, their syncs fire at precisely the same moment, creating burst API traffic. This "thundering herd" pattern can trigger provider rate limits (Gmail: 250 quota units/second, Outlook: 10,000 requests/10 minutes) and degrade performance.

Adding +/-15% random jitter to each interval spreads API calls across a window, reducing peak load. For example, a 180s interval becomes 153s-207s, and a 60s interval becomes 51s-69s.

**Current State (verified via codebase):**

- `src/services/sync/adaptiveInterval.ts` (line 61-84) — `getInterval(accountId)` returns exact tier values (60k, 180k, 300k, 600k ms). No randomization.
- `src/services/sync/syncOrchestrator.ts` (line 137) — `scheduleNextSync()` calls `adaptiveInterval.getInterval(accountId)` and passes result directly to `setTimeout`.
- `src/services/sync/syncOrchestrator.ts` (line 239) — `triggerSync()` calls `syncAccount()` directly — bypasses `scheduleNextSync()`, so manual syncs naturally avoid jitter.
- No existing jitter, `Math.random`, or randomization anywhere in the sync production code.

**Design Decision:** Add jitter inside `AdaptiveIntervalService.getInterval()` after tier selection and before clamping. This is the cleanest integration point because:

1. The orchestrator already calls `getInterval()` fresh on each schedule — jitter is naturally recalculated per timer reset
2. Manual syncs via `triggerSync()` bypass `getInterval()` — no jitter on manual sync
3. `clamp()` after jitter ensures values stay within `[minInterval, maxInterval]` bounds
4. No orchestrator changes needed

---

## Acceptance Criteria

### Jitter Calculation (AC 1-3)

- **AC 1:** Apply +/-15% random jitter to the base interval returned by the adaptive interval tier logic
- **AC 2:** Jitter recalculated on each timer reset (each call to `getInterval()`), not fixed per account
- **AC 3:** Jitter range: `interval * (1 + (random * 0.3 - 0.15))` where random is [0, 1)

### Integration (AC 4-6)

- **AC 4:** Jitter applied after adaptive interval tier selection (Story 1.15) but before clamping to min/max bounds
- **AC 5:** Jitter can be disabled via `VITE_SYNC_JITTER_ENABLED=false` env var (default: enabled)
- **AC 6:** When adaptive intervals are disabled, jitter still applies to the fixed default interval (180s)

### Edge Cases (AC 7-9)

- **AC 7:** Jittered interval clamped to `[minInterval, maxInterval]` bounds (existing `clamp()` method handles this)
- **AC 8:** Manual syncs (`triggerSync()`) bypass jitter — immediate execution (already works, verify in integration test)
- **AC 9:** Two accounts with the same tier should produce different jittered intervals (probabilistically)

### Testing (AC 10-12)

- **AC 10:** Test: Jittered interval falls within +/-15% of base interval
- **AC 11:** Test: Consecutive calls to `getInterval()` for same account produce varying results
- **AC 12:** Test: Jitter disabled via env var returns exact tier value (no randomization)

---

## Tasks / Subtasks

### Task 1: Add Jitter Logic to AdaptiveIntervalService (AC: 1-7)

**Files:**

- `src/services/sync/adaptiveInterval.ts` (MODIFY)

**Subtasks:**

- [x] 1.1: Make the random function injectable for testability — add optional `randomFn: () => number` parameter to constructor (default: `Math.random`), store as `private randomFn`
- [x] 1.2: Add `VITE_SYNC_JITTER_ENABLED` env var support — read in constructor, cache in `private jitterEnabled: boolean` field with `Number.isFinite` guard pattern. Default: `true` (AC 5)
- [x] 1.3: Create private `applyJitter(interval: number): number` method — calculates `interval * (1 + (this.randomFn() * 0.3 - 0.15))` (AC 1, 3)
- [x] 1.4: Modify `getInterval()` to apply jitter: after tier selection (line 71-81) and before `this.clamp()` (line 83), call `applyJitter()` on the base interval (AC 4)
- [x] 1.5: When adaptive is disabled (`!this.isEnabled()`), still apply jitter to `DEFAULT_INTERVAL` before returning (AC 6). Current code at line 63 returns `DEFAULT_INTERVAL` directly — change to `return this.jitterEnabled ? this.clamp(this.applyJitter(DEFAULT_INTERVAL)) : DEFAULT_INTERVAL`
- [x] 1.6: When jitter is disabled (`!this.jitterEnabled`), `applyJitter()` returns the interval unchanged (AC 5)

### Task 2: Unit Tests (AC: 10-12)

**Files:**

- `src/services/sync/__tests__/adaptiveInterval.test.ts` (MODIFY — add jitter test suite)

**Subtasks:**

- [x] 2.1: Test: With jitter enabled and `randomFn: () => 0.5`, jittered interval equals exact base (midpoint: `0.5 * 0.3 - 0.15 = 0`, no change) (AC 10)
- [x] 2.2: Test: With `randomFn: () => 0`, jittered interval equals `base * 0.85` (-15%) (AC 10)
- [x] 2.3: Test: With `randomFn: () => 1`, jittered interval equals `base * 1.15` (+15%). Note: `Math.random()` returns [0, 1) so 1.0 is theoretical max (AC 10)
- [x] 2.4: Test: Jittered interval is clamped to `[minInterval, maxInterval]` bounds (AC 7) — use a very low base interval and verify it gets clamped
- [x] 2.5: Test: Two calls to `getInterval()` with different `randomFn` values produce different results (AC 11)
- [x] 2.6: Test: `VITE_SYNC_JITTER_ENABLED=false` → `getInterval()` returns exact tier value, no jitter applied (AC 12)
- [x] 2.7: Test: When adaptive is disabled but jitter is enabled, default interval still gets jittered (AC 6)
- [x] 2.8: Test: Existing adaptive interval tests still pass — no regressions (verify existing 31 unit tests pass)

### Task 3: Integration Tests (AC: 8-9)

**Files:**

- `src/services/sync/__tests__/adaptiveInterval.integration.test.ts` (MODIFY — add jitter integration tests)

**Subtasks:**

- [x] 3.1: Test: Manual sync via `triggerSync()` bypasses jitter — verify `syncAccount()` is called immediately without going through `scheduleNextSync()` (AC 8)
- [x] 3.2: Test: Two accounts with same tier produce different intervals when using real `Math.random` (probabilistic — run multiple times and verify not all identical) (AC 9)

---

## Dev Notes

### Architecture Pattern

Jitter is added inside the existing `AdaptiveIntervalService` rather than as a separate service. This follows the principle of minimal change — jitter is a modifier on interval calculation, not a standalone concern.

```
getInterval(accountId)
  |
  v
Tier selection (existing: 60k/180k/300k/600k)
  |
  v
applyJitter(interval) -- NEW: multiply by (1 + random * 0.3 - 0.15)
  |
  v
clamp(interval) -- existing: enforce [min, max] bounds
  |
  v
Return jittered, clamped interval
```

### Key Implementation Details

- **Injectable randomness for testing:** Constructor accepts `randomFn?: () => number` defaulting to `Math.random`. This allows deterministic testing with fixed values (0, 0.5, 1) while using real randomness in production.
- **Jitter formula:** `interval * (1 + (random * 0.3 - 0.15))` gives uniform distribution in range `[interval * 0.85, interval * 1.15)`. The 0.3 multiplier and 0.15 offset produce the +/-15% band.
- **Existing tests use exact `toBe()` assertions.** Passing `randomFn: () => 0.5` yields zero jitter (midpoint), so existing test patterns still work.
- **Clamp after jitter:** The existing `this.clamp()` call already follows tier selection. Jitter is inserted between tier selection and clamp, so bounds are always enforced.
- **No new files:** All changes are modifications to existing files. No new services, components, or exports.
- **No orchestrator changes needed:** `scheduleNextSync()` already calls `getInterval()` fresh each time.
- **No UI changes:** Jitter is invisible to the user — it's a backend optimization.
- **Bundle impact:** Zero new dependencies. One `Math.random` call per `getInterval()` invocation.

### Existing Test Context

The existing `adaptiveInterval.test.ts` has 31 unit tests organized by:

- `getInterval()` — tier selection (7 tests)
- `recordSyncResult()` — activity tracking (5 tests)
- `recordUserAction()` — reset behavior (3 tests)
- Per-account independence (2 tests)
- Min/max clamping (2 tests)
- Custom env var bounds (2 tests)
- `isEnabled()/setEnabled()` (3 tests)
- Persistence via localStorage (3 tests)
- `reset()` (2 tests)
- localStorage failure handling (2 tests)

New jitter tests should be added as a new `describe('jitter')` block. Existing tests that assert exact values will need `randomFn: () => 0.5` passed to the constructor so jitter has zero effect.

### Environment Variables

```
VITE_SYNC_JITTER_ENABLED=true        # NEW: Enable/disable jitter (default: true)
VITE_ADAPTIVE_MIN_INTERVAL_MS=60000  # Existing: min bound (clamps jittered values)
VITE_ADAPTIVE_MAX_INTERVAL_MS=600000 # Existing: max bound (clamps jittered values)
```

### Files That Must NOT Be Changed

- `src/services/sync/syncOrchestrator.ts` — No changes needed (already works correctly)
- `src/services/sync/syncBankruptcy.ts` — Unrelated
- `src/services/sync/circuitBreaker.ts` — Unrelated
- `src/services/database/schemas/syncState.schema.ts` — No schema changes

### Project Structure Notes

- Modified file: `src/services/sync/adaptiveInterval.ts` — alongside other sync services
- Modified file: `src/services/sync/__tests__/adaptiveInterval.test.ts` — add jitter describe block
- Modified file: `src/services/sync/__tests__/adaptiveInterval.integration.test.ts` — add jitter integration tests
- No new files created

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-1-foundation-core-infrastructure.md — Story 1.17 section, lines 599-623]
- [Source: src/services/sync/adaptiveInterval.ts — getInterval() method, lines 61-84]
- [Source: src/services/sync/adaptiveInterval.ts — clamp() method, line 232-234]
- [Source: src/services/sync/syncOrchestrator.ts — scheduleNextSync(), lines 131-159]
- [Source: src/services/sync/syncOrchestrator.ts — triggerSync(), line 239]
- [Source: src/services/sync/__tests__/adaptiveInterval.test.ts — existing test patterns]

### Previous Story Intelligence (Stories 1.15, 1.16)

- **vi.hoisted() pattern:** Required for mock objects referenced in `vi.mock()` factories
- **Injectable constructor params:** Story 1.17 uses the same pattern (injectable `randomFn`) for testability
- **Guard `parseInt` of env vars with `Number.isFinite()`:** Apply to jitter enabled env var parsing
- **Return copies from getState():** Already done in 1.15 review fix
- **Cache localStorage reads:** Already done for `enabledCache` in 1.15 — apply same pattern for `jitterEnabled`
- **Existing tests pass with deterministic random:** Pass `randomFn: () => 0.5` to zero out jitter effect in existing tests
- **Test isolation:** Reset shared mocks in `beforeEach` to prevent test bleed

---

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Floating-point precision: `180_000 * 1.15` produces `206999.99999999997` — used `toBeCloseTo` for test 2.3
- Integration test 3.2: `require()` fails on mocked module — used `vi.importActual()` to get real class

### Completion Notes List

- Implemented +/-15% jitter in `AdaptiveIntervalService.applyJitter()` using formula `interval * (1 + (randomFn() * 0.3 - 0.15))`
- Constructor accepts optional `randomFn` for deterministic testing (default: `Math.random`)
- Jitter applied after tier selection, before clamping — no orchestrator changes needed
- `VITE_SYNC_JITTER_ENABLED` env var controls jitter (default: true, set to 'false' to disable)
- When adaptive polling disabled but jitter enabled, DEFAULT_INTERVAL still gets jittered
- Existing 31 unit tests updated with `randomFn: () => 0.5` (zero jitter) — no regressions
- Added 8 new unit tests covering all jitter scenarios (AC 10-12)
- Added 2 new integration tests for manual sync bypass (AC 8) and probabilistic variance (AC 9)
- All 52 adaptive interval tests pass (39 unit + 13 integration)
- Zero lint errors, zero new dependencies, zero new files

### Code Review Fixes (2026-02-03)

- [M1] Added `VITE_SYNC_JITTER_ENABLED` to `.env.example` with documentation
- [M2] Added `clamp()` to disabled-adaptive + disabled-jitter path for consistency
- [M3] Strengthened integration test 3.1 with call-order verification proving immediate execution
- [M4] Wrapped env var tests in nested `describe` with `afterEach` cleanup for test isolation

### Change Log

- 2026-02-03: Story created by create-story workflow with comprehensive codebase analysis
- 2026-02-03: Implementation complete — jitter logic, unit tests, integration tests all passing
- 2026-02-03: Code review complete — 4 medium issues fixed (env docs, clamp consistency, test quality, test isolation)

### File List

- `src/services/sync/adaptiveInterval.ts` (MODIFIED) — added randomFn, jitterEnabled, applyJitter(); review fix: added clamp() to disabled path
- `src/services/sync/__tests__/adaptiveInterval.test.ts` (MODIFIED) — updated existing tests with randomFn: () => 0.5, added 8 jitter tests; review fix: afterEach cleanup for env vars
- `src/services/sync/__tests__/adaptiveInterval.integration.test.ts` (MODIFIED) — added 2 jitter integration tests; review fix: strengthened manual sync bypass test
- `.env.example` (MODIFIED) — added VITE_SYNC_JITTER_ENABLED documentation
