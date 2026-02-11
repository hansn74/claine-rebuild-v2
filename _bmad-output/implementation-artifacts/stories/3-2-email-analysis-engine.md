# Story 3.2: Email Analysis Engine

Status: done

## Story

As a developer,
I want an email analysis engine that extracts features for AI scoring,
so that the AI can understand email context and importance.

## Acceptance Criteria

1. Feature extractor analyzes: sender, subject, body content, urgency keywords
2. Sender relationship scoring (frequency of communication, response rate)
3. Content analysis: detect deadlines, questions, requests vs. FYI
4. Thread context incorporated (conversation history)
5. Analysis runs in Web Worker (doesn't block main thread)
6. Features cached in RxDB for performance

## Tasks / Subtasks

- [x] Task 1: Create email feature extraction service (AC: 1, 3) ✅
  - [x] Create `src/services/ai/emailAnalysis.ts`
  - [x] Implement feature extraction: sender, subject, body, urgency keywords
  - [x] Detect content signals: deadlines, questions, requests, FYI/newsletters
  - [x] Parse urgency keywords (ASAP, urgent, deadline, EOD, etc.)
  - [x] Build structured prompt for LLM inference from email features
  - [x] Add unit tests (26 tests)

- [x] Task 2: Implement sender relationship scoring (AC: 2) ✅
  - [x] Create `src/services/ai/senderScoring.ts`
  - [x] Calculate sender communication frequency
  - [x] Calculate response rate (how often user replies to this sender)
  - [x] Classify sender: frequent, regular, occasional, first-time, automated
  - [x] Build context summary for LLM prompt
  - [x] Add unit tests (10 tests)

- [x] Task 3: Implement thread context analysis (AC: 4) ✅
  - [x] Create `src/services/ai/threadContext.ts`
  - [x] Extract thread conversation history for context
  - [x] Determine thread position (first message, reply, follow-up)
  - [x] Detect thread urgency escalation (normal → urgent signals)
  - [x] Summarize thread context for LLM prompt
  - [x] Add unit tests (9 tests)

- [x] Task 4: Create analysis orchestrator with worker integration (AC: 5) ✅
  - [x] Create `src/services/ai/analysisOrchestrator.ts`
  - [x] Orchestrate feature extraction → prompt building → inference → result storage
  - [x] Use existing AI inference service (Web Worker) for non-blocking analysis
  - [x] Support single email and batch analysis with progress tracking
  - [x] Heuristic fallback when AI unavailable
  - [x] Health registry integration
  - [x] Add unit tests (20 tests)

- [x] Task 5: Implement RxDB result caching (AC: 6) ✅
  - [x] Create `src/services/ai/analysisResultStore.ts`
  - [x] Store analysis results in email `aiMetadata` field via `patch()`
  - [x] Batch update emails with `storeAnalysisResultsBatch()`
  - [x] Implement cache invalidation with `needsAnalysis()` (configurable maxAge)
  - [x] Wire dependencies with `createAnalysisDependencies()` factory
  - [x] Add unit tests (14 tests)

- [x] Task 6: Testing & Integration ✅
  - [x] Update barrel exports in `src/services/ai/index.ts`
  - [x] Full suite regression verification: 115 files, 1954 tests, 0 failures
  - [x] Update story file with completion notes

## Dev Notes

### Existing Infrastructure (from Story 3.1)

- `aiInferenceService` - Singleton with Web Worker for non-blocking inference
- `InferenceRequest/InferenceResponse` types ready
- `cloudInferenceService` - Fallback for when local inference unavailable
- `aiCapabilityStore` - Tracks AI availability
- `healthRegistry` - AI subsystem monitoring ('ai' subsystem ID)

### Email Schema AI Fields (already exist)

```typescript
aiMetadata?: {
  triageScore: number     // 0-100
  priority: 'high' | 'medium' | 'low' | 'none'
  suggestedAttributes: { [key: string]: { value: any, confidence: number } }
  confidence: number      // 0-100
  reasoning: string       // max 5000 chars
  modelVersion: string
  processedAt: number
}
```

### Key Patterns

- Use `db.emails.find({ selector }).$.subscribe()` with `createBatchedObservable()` for reactive queries
- Singleton services with `getInstance()` and `__resetForTesting()`
- Logger pattern: `logger.info('ai', 'message')`
- Health registry: `healthRegistry.setAIHealth(status, message)`

## Dev Agent Record

### Agent Model Used

Claude Opus 4.6

### Completion Notes List

- 79 new tests across 5 test files (26 + 10 + 9 + 20 + 14)
- Full test suite: 115 files, 1954 tests, 0 failures, 0 regressions
- Heuristic fallback ensures analysis works even without AI inference
- Dependency injection pattern in orchestrator enables clean unit testing
- `needsAnalysis()` supports configurable cache invalidation via maxAgeMs

### File List

**New Files:**

- `src/services/ai/emailAnalysis.ts` - Feature extraction, prompt building, response parsing
- `src/services/ai/senderScoring.ts` - Sender relationship scoring
- `src/services/ai/threadContext.ts` - Thread context analysis
- `src/services/ai/analysisOrchestrator.ts` - Pipeline orchestrator
- `src/services/ai/analysisResultStore.ts` - RxDB result caching
- `src/services/ai/__tests__/emailAnalysis.test.ts` - 26 tests
- `src/services/ai/__tests__/senderScoring.test.ts` - 10 tests
- `src/services/ai/__tests__/threadContext.test.ts` - 9 tests
- `src/services/ai/__tests__/analysisOrchestrator.test.ts` - 20 tests
- `src/services/ai/__tests__/analysisResultStore.test.ts` - 14 tests

**Modified Files:**

- `src/services/ai/index.ts` - Added Story 3.2 exports

## Change Log

| Date       | Change                                      | Author          |
| ---------- | ------------------------------------------- | --------------- |
| 2026-02-09 | Story created and implementation started    | Claude Opus 4.6 |
| 2026-02-09 | All 6 tasks completed, 79 tests, story done | Claude Opus 4.6 |
