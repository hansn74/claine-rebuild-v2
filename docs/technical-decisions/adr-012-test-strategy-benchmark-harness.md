# ADR-012: Test Strategy & Benchmark Harness

**Status:** Accepted
**Date:** 2025-11-03
**Deciders:** Architect, QA Lead

## Context

Claine requires comprehensive testing to ensure reliability, performance, and quality:
- Unit tests (code coverage >80%)
- Integration tests (email sync, AI inference, undo flow)
- E2E tests (user workflows: connect account → triage → reply)
- Performance benchmarks (Common Benchmark Plan from this doc)
- AI quality tests (triage accuracy, draft acceptance rate)

**Requirement Mapping:** NFR002 (reliability - 99.5% crash-free), NFR005 (AI quality - >90% accuracy), All performance NFRs

## Decision

**Selected: Comprehensive Test Pyramid (Vitest 4.0 + Playwright 1.56)**

Implement testing using:
- **Unit Tests:** Vitest 4.0.x with @testing-library/react for component testing
- **Integration Tests:** Vitest with MSW (Mock Service Worker) for API mocking
- **E2E Tests:** Playwright 1.56.x for cross-browser testing (Chromium, Firefox, WebKit)
- **Coverage:** Vitest v8 coverage provider (target: >80% line coverage)
- **Benchmarks:** Custom benchmark harness using Vitest bench + Playwright tracing

## Options Under Consideration

**Option A: Comprehensive Test Pyramid (Unit + Integration + E2E)**
- **Pros:** High confidence, catch regressions early, aligns with best practices
- **Cons:** Time investment, CI/CD overhead, flaky E2E tests
- **Best for:** Production-quality software, GA launch

**Option B: Focused Testing (Unit + Critical Path E2E)**
- **Pros:** Faster development, focus on high-risk areas
- **Cons:** Lower coverage, may miss edge cases
- **Best for:** MVP, time-constrained

**Option C: Manual Testing Only**
- **Pros:** No test infrastructure investment
- **Cons:** Unscalable, regression-prone, unacceptable for AI-driven features
- **Decision:** Rejected - inadequate for Claine's complexity

**Option D: Do Nothing / Defer**
- Launch without tests, fix bugs as reported
- **When this makes sense:** Never - AI autonomy requires high confidence
- **When this fails:** Always - unacceptable quality risk

## Test Coverage Targets

**Unit Tests:**
- **Coverage:** >80% line coverage, >70% branch coverage
- **Focus:** Business logic, AI triage algorithm, undo/action log, sync logic

**Integration Tests:**
- **Coverage:** All major integrations (Gmail API, Outlook Graph, IMAP, local AI, database)
- **Focus:** OAuth flow, sync incremental updates, AI inference end-to-end

**E2E Tests:**
- **Coverage:** Critical user workflows (5-10 tests)
- **Focus:**
  1. Connect Gmail account → Sync inbox → Triage works
  2. AI archives email → User undoes → Email restored
  3. Draft generation → User edits → Sends email
  4. Search 10K emails → Returns results <100ms
  5. Notification sent → User clicks → Opens email

## Benchmark Harness (Common Benchmark Plan)

**Implementation:**
- Automated benchmark suite runs on every release candidate
- Hardware cohorts: M1, i7-10700, Ryzen 5600U (3 CI runners or cloud VMs)
- Synthetic dataset: 100K emails (from Common Benchmark Plan section)
- Workloads: Cold start, inbox render, search, AI triage, sync
- Pass/fail criteria: All NFRs met (P95 latency, FPS, memory, storage)

**Reporting:**
- Benchmark results published to dashboard (Grafana or similar)
- Regression detection: Alert if any metric degrades >10% vs. previous release
- Historical trends: Track performance over time

## AI Quality Testing

**Triage Accuracy:**
- Test corpus: 1,000 manually labeled emails (ground truth)
- Metrics: Precision, recall, F1 score per category
- Target: >90% accuracy (per NFR005)

**Draft Acceptance Rate:**
- Collect user feedback: Did user send AI draft as-is, edit, or discard?
- Target: >95% acceptance (sent or edited, not discarded)

**Undo Rate:**
- Track: % of AI actions undone by user
- Target: <5% (per PRD guardrails)

## Acceptance Criteria

ADR-012 is **Accepted** (this decision is now validated):
- Unit test suite implemented: >80% line coverage, runs in CI on every commit
- Integration test suite implemented: All major integrations covered (Gmail, Outlook, IMAP, AI, database)
- E2E test suite implemented: 5-10 critical workflows automated (Playwright or similar)
- Benchmark harness implemented: Runs on 3 hardware cohorts, validates all NFRs, publishes results
- AI quality tests implemented: Triage accuracy >90%, draft acceptance >95%, undo rate <5%
- CI/CD integrated: All tests run on PR, block merge if failing, auto-deploy if passing
- Flakiness <2%: E2E tests pass consistently (no false negatives)
- Owner sign-off: QA Lead + Architect approval with test coverage report

## Operational Considerations

- **Rollout:**
  - Phase 1: Implement unit tests + critical path E2E (5 tests) for MVP
  - Phase 2: Expand integration tests, full E2E coverage for GA
  - Phase 3: Benchmark harness automation in CI/CD
- **Telemetry:** Track test pass rate, flakiness, CI/CD pipeline duration, benchmark results
- **Observability:**
  - Dashboard: Test coverage over time, flaky tests, benchmark trends
  - Alert on: Test pass rate <95%, benchmark regression >10%, flaky test rate >5%
- **Fallback:**
  - If E2E tests too flaky: Reduce to smoke tests only, rely on manual QA
  - If benchmark harness too expensive: Run manually before major releases (not every commit)
- **Support Playbook:**
  - Test failing in CI: Check logs, reproduce locally, fix or mark flaky
  - Benchmark regression: Bisect commits, identify root cause, optimize or revert
  - AI quality degraded: Retrain model, expand test corpus, adjust thresholds

## Consequences

**Positive:**
- ✅ **Fast Unit Tests:** Vitest 4.0 is 10x faster than Jest (WASM-based test runner)
- ✅ **Cross-Browser E2E:** Playwright tests on Chromium, Firefox, WebKit (coverage for all browsers)
- ✅ **Native Vite Integration:** Vitest uses Vite config (no separate test bundler)
- ✅ **Coverage Built-In:** Vitest v8 coverage provider (no Istanbul setup needed)

**Negative:**
- ❌ **E2E Flakiness Risk:** Playwright tests may be flaky (network timing, async operations)
- ❌ **CI Time:** E2E tests slow down CI pipeline (3-5 minutes per run)

**Mitigations:**
- **Retry Logic:** Playwright retries failed tests 2x before marking as failed
- **Parallel Execution:** Run E2E tests in parallel across multiple workers (faster CI)
- **Smoke Tests:** Run only critical E2E tests on every commit, full suite on PR merge

## References

- **Vitest Documentation:** https://vitest.dev/
- **Vitest Coverage (v8):** https://vitest.dev/guide/coverage.html
- **Playwright Documentation:** https://playwright.dev/
- **@testing-library/react:** https://testing-library.com/docs/react-testing-library/intro/
- **MSW (Mock Service Worker):** https://mswjs.io/
- **Test Pyramid:** https://martinfowler.com/articles/practical-test-pyramid.html
- **Architecture Document:** `docs/architecture.md` (Testing strategy section)

---
