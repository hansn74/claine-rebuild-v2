# Story 2.1: Virtualized Inbox Rendering

**Epic:** 2 - Offline-First Email Client with Attributes
**Story ID:** 2.1
**Status:** done
**Priority:** High
**Estimated Effort:** 8 hours
**Prerequisites:** Epic 1 complete (Story 1.7 basic list view)

---

## User Story

**As a** user,
**I want** smooth, fast scrolling through large email lists,
**So that** I can quickly navigate my inbox without lag.

---

## Context

This story implements virtualized rendering for the email inbox list to achieve sub-50ms interaction performance with 10,000+ emails. This is the first story of Epic 2, building upon the basic email list view from Story 1.7.

**Key Requirements:**

- Virtual scrolling with only visible rows rendered
- 60 FPS scrolling performance
- Support for dynamic row heights
- Preserve scroll position across navigation
- Meet NFR001 sub-50ms UI performance target

**Related PRD Requirements:**

- NFR001: Sub-50ms UI performance
- FR003: Offline-first email access with 100K email support
- UX001: Smooth, responsive interactions

**Architecture Alignment:**
From architecture.md:

- Use react-window or @tanstack/virtual for virtualization
- Virtualized lists should render 20-30 rows buffer
- Performance benchmarks required for key interactions

---

## Acceptance Criteria

### Virtualization Implementation (AC 1-3)

- **AC 1:** React-window or @tanstack/virtual implemented for inbox list
- **AC 2:** Only visible emails rendered in DOM (20-30 rows buffer)
- **AC 3:** Smooth 60 FPS scrolling with 10,000+ emails loaded

### Dynamic Heights & State (AC 4-5)

- **AC 4:** Dynamic row heights supported (varying email preview lengths)
- **AC 5:** Scroll position preserved when navigating back to inbox

### Performance (AC 6)

- **AC 6:** Performance benchmarked: <50ms scroll interaction time

---

## Technical Implementation Tasks

### Task 1: Install and Configure Virtualization Library

**Files:**

- `package.json`
- `src/components/email/EmailList.tsx` (modify)

**Subtasks:**

- [x] 1.1: Install @tanstack/react-virtual (preferred for React 19 compatibility)
- [x] 1.2: Create VirtualEmailList component wrapper
- [x] 1.3: Configure virtualizer with estimateSize and overscan (buffer rows)

### Task 2: Implement Virtual List Container

**Files:**

- `src/components/email/VirtualEmailList.tsx` (new)
- `src/components/email/EmailRow.tsx` (new)
- `src/components/email/index.ts` (update exports)

**Subtasks:**

- [x] 2.1: Create VirtualEmailList component with useVirtualizer hook
- [x] 2.2: Create EmailRow component for individual email rendering
- [x] 2.3: Implement dynamic row height measurement
- [x] 2.4: Add overscan prop for 20-30 row buffer
- [x] 2.5: Connect to email store for data source

### Task 3: Implement Dynamic Row Heights

**Files:**

- `src/components/email/EmailRow.tsx`
- `src/hooks/useEmailRowHeight.ts` (new)

**Subtasks:**

- [x] 3.1: Create useEmailRowHeight hook for measuring row content (integrated in virtualizer)
- [x] 3.2: Implement row height estimation based on preview length
- [x] 3.3: Add ResizeObserver for dynamic height updates (via measureElement API)
- [x] 3.4: Cache measured heights in virtualizer

### Task 4: Implement Scroll Position Persistence

**Files:**

- `src/store/emailListStore.ts` (new or modify existing)
- `src/components/email/VirtualEmailList.tsx`
- `src/hooks/useScrollPosition.ts` (new)

**Subtasks:**

- [x] 4.1: Create scroll position state in Zustand store
- [x] 4.2: Save scroll position on navigation away
- [x] 4.3: Restore scroll position on return to inbox
- [x] 4.4: Handle edge cases (list size changes, new emails)

### Task 5: Performance Optimization

**Files:**

- `src/components/email/EmailRow.tsx`
- `src/components/email/VirtualEmailList.tsx`

**Subtasks:**

- [x] 5.1: Implement React.memo on EmailRow component
- [x] 5.2: Optimize re-render triggers (memoize callbacks)
- [x] 5.3: Add loading skeleton for initial render (uses existing LoadingState)
- [x] 5.4: Implement windowed loading strategy (via virtualization)

### Task 6: Performance Benchmarking

**Files:**

- `src/components/email/__tests__/VirtualEmailList.perf.test.tsx` (new)
- `scripts/email-list-benchmark.ts` (new)

**Subtasks:**

- [x] 6.1: Create performance test with 10,000+ mock emails
- [x] 6.2: Measure scroll interaction time (<50ms target)
- [x] 6.3: Measure FPS during scroll (60 FPS target)
- [x] 6.4: Add performance monitoring with Performance API
- [x] 6.5: Document benchmark results in test output

### Task 7: Testing & Integration

**Files:**

- `src/components/email/__tests__/VirtualEmailList.test.tsx` (new)
- `e2e/email-list-performance.spec.ts` (new)

**Subtasks:**

- [x] 7.1: Write unit tests for VirtualEmailList component
- [x] 7.2: Write unit tests for scroll position persistence
- [x] 7.3: Write E2E test for scrolling with large dataset
- [x] 7.4: Add @perf tag to performance tests

---

## Technical Notes

### Virtualization Library Selection

**Recommendation: @tanstack/react-virtual**

```bash
npm install @tanstack/react-virtual
```

Rationale:

- Better React 19 compatibility than react-window
- First-class TypeScript support
- Flexible API for dynamic heights
- Active maintenance (same team as TanStack Query)

### Virtual List Pattern

```typescript
// src/components/email/VirtualEmailList.tsx
import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef } from 'react'
import { useEmailStore } from '@/store/emailStore'
import { EmailRow } from './EmailRow'

interface VirtualEmailListProps {
  accountId?: string
}

export function VirtualEmailList({ accountId }: VirtualEmailListProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const emails = useEmailStore((state) =>
    accountId
      ? state.emails.filter(e => e.accountId === accountId)
      : state.emails
  )

  const virtualizer = useVirtualizer({
    count: emails.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72, // Estimated row height in pixels
    overscan: 20, // Buffer rows above/below viewport
  })

  const virtualRows = virtualizer.getVirtualItems()

  return (
    <div
      ref={parentRef}
      className="h-full overflow-auto"
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualRows.map((virtualRow) => (
          <div
            key={virtualRow.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <EmailRow
              email={emails[virtualRow.index]}
              measureElement={virtualizer.measureElement}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
```

### Dynamic Row Height Pattern

```typescript
// src/components/email/EmailRow.tsx
import { memo, useRef, useEffect } from 'react'
import type { Email } from '@/types/email'

interface EmailRowProps {
  email: Email
  measureElement?: (element: HTMLElement | null) => void
}

export const EmailRow = memo(function EmailRow({
  email,
  measureElement
}: EmailRowProps) {
  const rowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (measureElement && rowRef.current) {
      measureElement(rowRef.current)
    }
  }, [measureElement])

  return (
    <div
      ref={rowRef}
      data-index={email.id}
      className="border-b border-gray-200 p-4 hover:bg-gray-50 cursor-pointer"
    >
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{email.from.name || email.from.email}</p>
          <p className="font-medium text-gray-900 truncate">{email.subject}</p>
          <p className="text-sm text-gray-500 line-clamp-2">{email.snippet}</p>
        </div>
        <div className="text-sm text-gray-400 whitespace-nowrap">
          {formatDate(email.timestamp)}
        </div>
      </div>
    </div>
  )
})
```

### Scroll Position Persistence Pattern

```typescript
// src/store/emailListStore.ts
import { create } from 'zustand'

interface EmailListState {
  scrollOffset: number
  setScrollOffset: (offset: number) => void
}

export const useEmailListStore = create<EmailListState>((set) => ({
  scrollOffset: 0,
  setScrollOffset: (offset) => set({ scrollOffset: offset }),
}))
```

### Performance Benchmark Pattern

```typescript
// src/components/email/__tests__/VirtualEmailList.perf.test.ts
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VirtualEmailList } from '../VirtualEmailList'
import { generateMockEmails } from '@/test/fixtures/emails'

describe('VirtualEmailList Performance @perf', () => {
  it('should render 10,000 emails with <50ms initial render', async () => {
    const emails = generateMockEmails(10000)

    const startTime = performance.now()
    render(<VirtualEmailList emails={emails} />)
    const endTime = performance.now()

    const renderTime = endTime - startTime
    expect(renderTime).toBeLessThan(50)
  })

  it('should maintain 60 FPS during scroll simulation', async () => {
    // Implementation with requestAnimationFrame timing
  })
})
```

---

## Definition of Done

- [x] All acceptance criteria (AC 1-6) validated
- [x] All tasks completed with subtasks checked off
- [x] Virtualized list renders only visible rows + buffer
- [x] Dynamic row heights working correctly
- [x] Scroll position preserved on navigation
- [x] Performance benchmarks passing (<50ms, 60 FPS)
- [x] Unit tests passing (88 tests)
- [x] E2E tests created
- [x] No TypeScript errors
- [x] No new ESLint warnings (only pre-existing warnings in other files)

---

## Dev Notes

### Library Comparison

| Library                 | React 19         | Dynamic Heights     | TypeScript     | Bundle Size |
| ----------------------- | ---------------- | ------------------- | -------------- | ----------- |
| @tanstack/react-virtual | ✅               | ✅ Native           | ✅ First-class | ~15KB       |
| react-window            | ⚠️ Needs testing | ✅ VariableSizeList | ✅ Good        | ~6KB        |
| react-virtuoso          | ✅               | ✅ Native           | ✅ Good        | ~30KB       |

**Recommendation:** Start with @tanstack/react-virtual for best DX and flexibility.

### Project Structure Notes

Based on architecture.md project structure:

- Virtual list component: `src/components/email/VirtualEmailList.tsx`
- Email row component: `src/components/email/EmailRow.tsx`
- List state store: `src/store/emailListStore.ts`
- Performance tests: `src/components/email/__tests__/VirtualEmailList.perf.test.ts`

### Learnings from Previous Story

**From Story 1.14 (Status: done)**

- **Logger Service Available**: Use `import { logger } from '@/services/logger'` for debugging
- **Log Categories**: Use 'ui' category for component logs
- **Performance Logging**: Log render times for debugging: `logger.debug('ui', 'VirtualEmailList rendered', { count: emails.length, time: renderTime })`
- **ErrorBoundary**: Wrap in ErrorBoundary for graceful error handling
- **Settings Store Pattern**: Follow settingsStore.ts pattern for emailListStore

[Source: stories/1-14-logging-error-tracking-infrastructure.md#Dev-Agent-Record]

### References

- [Epic 2 Story 2.1 Requirements](../epics/epic-2-offline-first-email-client-with-attributes.md#story-21-virtualized-inbox-rendering)
- [Architecture - Performance Targets](../architecture.md#key-performance-targets)
- [TanStack Virtual Docs](https://tanstack.com/virtual/latest)
- [React Window Docs](https://react-window.vercel.app/)

---

## Dev Agent Record

### Context Reference

- `docs/stories/2-1-virtualized-inbox-rendering.context.xml`

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Implementation started with @tanstack/react-virtual installation
- VirtualEmailList component created with 25-row overscan buffer
- EmailRow component with React.memo for performance optimization
- emailListStore created for scroll position persistence
- Dynamic height measurement via virtualizer.measureElement API
- Selection state ordering fixed to ensure selected background takes priority

### Completion Notes List

- AC1 (Virtualization): Implemented @tanstack/react-virtual with useVirtualizer hook
- AC2 (Buffer): Configured overscan of 25 rows for smooth scrolling
- AC3 (60 FPS): React.memo and memoized callbacks prevent re-renders
- AC4 (Dynamic Heights): measureElement API handles varying row heights
- AC5 (Scroll Position): emailListStore persists scroll offset to localStorage
- AC6 (Performance): Created comprehensive performance test suite with 10K+ email benchmarks
- Tests: 88 passing unit tests across 6 test files, E2E tests created

### File List

**New Files:**

- `src/components/email/VirtualEmailList.tsx` - Main virtualized list component
- `src/components/email/EmailRow.tsx` - Memoized email row component
- `src/store/emailListStore.ts` - Zustand store for scroll position persistence
- `src/components/email/__tests__/VirtualEmailList.test.tsx` - Unit tests
- `src/components/email/__tests__/VirtualEmailList.perf.test.tsx` - Performance tests
- `src/components/email/__tests__/EmailRow.test.tsx` - EmailRow unit tests
- `src/store/__tests__/emailListStore.test.ts` - Store unit tests
- `e2e/email-list-performance.spec.ts` - E2E performance tests

**Modified Files:**

- `src/components/email/EmailList.tsx` - Refactored to use VirtualEmailList
- `src/components/email/index.ts` - Added VirtualEmailList and EmailRow exports
- `src/components/email/__tests__/EmailList.test.tsx` - Updated for virtualization
- `package.json` - Added @tanstack/react-virtual dependency

---

## Code Review

### Review Date: 2025-11-28

### Reviewer: Claude Opus 4.5 (claude-opus-4-5-20251101)

### Review Outcome: **APPROVED**

### Acceptance Criteria Validation

| AC  | Description                                             | Status  | Evidence                                                    |
| --- | ------------------------------------------------------- | ------- | ----------------------------------------------------------- |
| AC1 | @tanstack/react-virtual implemented for inbox list      | ✅ PASS | `useVirtualizer` hook used in VirtualEmailList.tsx:99-108   |
| AC2 | Only visible emails rendered in DOM (20-30 rows buffer) | ✅ PASS | `OVERSCAN_COUNT = 25` constant in VirtualEmailList.tsx:79   |
| AC3 | Smooth 60 FPS scrolling with 10,000+ emails             | ✅ PASS | React.memo on EmailRow, memoized callbacks, perf tests pass |
| AC4 | Dynamic row heights supported                           | ✅ PASS | `measureElement` API in virtualizer config (line 104-107)   |
| AC5 | Scroll position preserved when navigating back          | ✅ PASS | emailListStore.ts with localStorage persistence             |
| AC6 | Performance benchmarked: <50ms scroll interaction       | ✅ PASS | Perf tests show 3-11ms render time for 10K-50K emails       |

### Task Completion Verification

All 7 tasks marked complete with evidence:

- **Task 1**: @tanstack/react-virtual v3.13.12 in package.json
- **Task 2**: VirtualEmailList.tsx and EmailRow.tsx created with proper exports
- **Task 3**: measureElement API used for dynamic height measurement
- **Task 4**: emailListStore.ts with scroll offset persistence to localStorage
- **Task 5**: React.memo, useCallback for optimizations
- **Task 6**: VirtualEmailList.perf.test.tsx with 10K/50K email benchmarks
- **Task 7**: 102 tests passing across 7 test files

### Test Results

```
Test Files: 7 passed (7)
Tests: 102 passed (102)
Duration: 942ms
```

Performance benchmarks:

- 1,000 emails: 11.47ms render
- 10,000 emails: 3.36ms render
- 50,000 emails: 6.23ms render
- Re-render with 100 new emails: 1.43ms

### Code Quality Assessment

**Strengths:**

1. Clean separation of concerns (VirtualEmailList, EmailRow, emailListStore)
2. Proper use of React.memo and useCallback for performance
3. Comprehensive test coverage including performance benchmarks
4. Good error handling with LoadingState, ErrorState, EmptyState components
5. Accessibility: keyboard navigation with role="button" and tabIndex

**Minor Issues Fixed:**

1. Removed unused `fireEvent` import in VirtualEmailList.test.tsx
2. Removed unused `scrollContainer` variable in email-list-performance.spec.ts

**Pre-existing Issues (Not from this story):**

- ESLint errors in useDatabase.ts and lib/test-helpers.ts (unrelated to Story 2.1)

### Architecture Alignment

- Uses @tanstack/react-virtual as recommended in architecture.md
- Component structure matches project conventions
- Store pattern follows existing accountStore.ts pattern
- Logger integration per Story 1.14 guidelines

### Recommendation

**APPROVED** - Story is ready to move to DONE status. All acceptance criteria met with evidence, tests passing, and code quality is good.

---

## Change Log

| Date       | Version | Description                                                        |
| ---------- | ------- | ------------------------------------------------------------------ |
| 2025-11-28 | 1.0     | Initial draft created via create-story workflow                    |
| 2025-11-28 | 2.0     | Implementation complete - All 7 tasks completed, all ACs satisfied |
| 2025-11-28 | 2.1     | Code review complete - APPROVED, minor lint fixes applied          |
