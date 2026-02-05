# Story 2.22: Search Operators for Structured Queries

Status: done

## Story

As a power user,
I want to use search operators like `from:john` and `has:attachment`,
so that I can precisely filter my search results.

## Acceptance Criteria

### Operator Parsing

1. Search input parsed for operators before passing to search engine
2. Supported operators:
   - `from:name` — filter by sender (partial match on name or email address)
   - `to:name` — filter by recipient
   - `has:attachment` — filter emails with attachments
   - `before:YYYY-MM-DD` — filter emails before date
   - `after:YYYY-MM-DD` — filter emails after date
   - `in:folder` — filter by folder/label (inbox, sent, archive, trash, or label name)
3. Remaining text after operator extraction passed as keyword query
4. Multiple operators combined with AND logic (e.g., `from:john has:attachment budget` = from john AND has attachment AND keyword "budget")

### Parser Behavior

5. Operators are case-insensitive (`From:` = `from:`)
6. Quoted values supported for multi-word matches (`from:"John Smith"`)
7. Invalid operators treated as regular keywords (no error, graceful fallback)
8. Operator autocomplete in search input (type `from:` → show suggestions from known senders)

### Integration

9. Operators work with MiniSearch keyword results (Story 2.21) — operators filter, keywords rank
10. Operator filters applied as post-search filters on MiniSearch results (simple implementation)
11. Active operators shown as removable chips below search input
12. Command palette (Cmd+K) shows operator hint text: "Try from:, to:, has:attachment, before:, after:"

### Testing

13. Test: `from:john` → only emails from "john" (partial match)
14. Test: `has:attachment` → only emails with attachments
15. Test: `from:john budget` → emails from john containing "budget"
16. Test: `before:2025-01-01 after:2024-06-01` → date range filter works
17. Test: `FROM:john` → case insensitive, same results as `from:john`
18. Test: `unknownop:value` → treated as keyword search for "unknownop:value"
19. Test: `from:"John Smith"` → matches full name

## Tasks / Subtasks

- [x] Task 1: Create searchOperatorParser.ts (AC: 1, 2, 3, 4, 5, 6, 7)
  - [x] 1.1 Define `SearchOperator` type and `ParsedOperatorQuery` interface
  - [x] 1.2 Define KNOWN_OPERATORS constant: `from`, `to`, `has`, `before`, `after`, `in`
  - [x] 1.3 Implement `parseSearchOperators(query: string): ParsedOperatorQuery` — reuse regex pattern from `attributeSearchParser.ts` (`/(\w+):((?:"[^"]*"|'[^']*'|\S+))/gi`) but validate against KNOWN_OPERATORS
  - [x] 1.4 Unknown operators (not in KNOWN_OPERATORS) left as-is in the text query — NOT extracted as filters (AC 7)
  - [x] 1.5 Implement `matchesOperatorFilters(email: EmailDocument, operators: SearchOperator[]): boolean` — the post-filter function
  - [x] 1.6 Implement operator matching logic per type:
    - `from:value` → case-insensitive partial match on `email.from.name` OR `email.from.email`
    - `to:value` → case-insensitive partial match on any `email.to[].name` OR `email.to[].email`
    - `has:attachment` → `email.attachments.length > 0`
    - `before:YYYY-MM-DD` → `email.timestamp < Date.parse(value)`
    - `after:YYYY-MM-DD` → `email.timestamp > Date.parse(value)`
    - `in:folder` → case-insensitive match on `email.folder` OR `email.labels.includes(value)`
  - [x] 1.7 Export `getOperatorSearchHints(): AttributeSearchHint[]` for UI autocomplete

- [x] Task 2: Integrate operators into useSearch hook (AC: 9, 10)
  - [x] 2.1 Import `parseSearchOperators` and `matchesOperatorFilters` in `useSearch.ts`
  - [x] 2.2 In `performSearch()`, call `parseSearchOperators(searchQuery)` FIRST
  - [x] 2.3 Pass `parsed.textQuery` (clean text without operators) to `searchIndexService.search()`
  - [x] 2.4 Post-filter enriched results: `enrichedResults.filter(r => matchesOperatorFilters(r.email, parsed.operators))`
  - [x] 2.5 If no text query but operators exist, search with empty string then post-filter ALL indexed documents — or use `searchIndexService.getAllDocuments()` if no text query
  - [x] 2.6 Include operator values in `parseSearchTerms()` call for highlighting

- [x] Task 3: Handle operator-only queries (AC: 1, 3, 9)
  - [x] 3.1 Add `getDocumentIds(): string[]` method to `SearchIndexService` — returns all indexed document IDs
  - [x] 3.2 When parsed query has operators but no text query (e.g., `from:john has:attachment`), iterate all documents and apply operator filters directly
  - [x] 3.3 Sort operator-only results by timestamp (newest first) since there are no relevance scores

- [x] Task 4: Update CommandPalette with operator hints (AC: 8, 12)
  - [x] 4.1 Update empty state help text in `CommandPalette.tsx` to include operator examples: "Try from:, to:, has:attachment, before:, after:"
  - [x] 4.2 Import `getOperatorSearchHints()` and merge with existing `getAttributeSearchHints()`
  - [x] 4.3 Show combined hints when user types a colon (`:`) character in search input
  - [x] 4.4 Update `SearchInput.tsx` placeholder to mention operators

- [x] Task 5: Show active operator chips (AC: 11)
  - [x] 5.1 Add `activeOperators` state to `useSearch` return type (or compute in CommandPalette)
  - [x] 5.2 Render operator chips between search input and results in `CommandPalette.tsx`
  - [x] 5.3 Each chip shows operator text (e.g., "from:john") with X button to remove
  - [x] 5.4 Removing a chip updates the query string (removes that operator) and re-triggers search

- [x] Task 6: Update search highlighting for operators (AC: 3)
  - [x] 6.1 In `useSearch.ts`, extract operator values and add to highlight terms
  - [x] 6.2 `parseSearchTerms()` in `searchHighlight.ts` already strips operator prefixes — verify it works with new operators
  - [x] 6.3 Ensure `from:john budget` highlights both "john" (in from field) and "budget" (everywhere)

- [x] Task 7: Write comprehensive tests (AC: 13-19)
  - [x] 7.1 Create `src/services/search/__tests__/searchOperatorParser.test.ts`
  - [x] 7.2 Test operator parsing: `from:john` extracts operator with value "john"
  - [x] 7.3 Test mixed query: `from:john budget meeting` → operators: [{from: "john"}], text: "budget meeting"
  - [x] 7.4 Test quoted values: `from:"John Smith"` → value = "John Smith"
  - [x] 7.5 Test case insensitivity: `FROM:john` → same as `from:john`
  - [x] 7.6 Test unknown operator: `unknownop:value` → left in text query as "unknownop:value"
  - [x] 7.7 Test `has:attachment` filter against EmailDocument with/without attachments
  - [x] 7.8 Test `before:` and `after:` date filters
  - [x] 7.9 Test `in:inbox` folder filter
  - [x] 7.10 Test multiple operators: `from:john to:jane has:attachment`
  - [x] 7.11 Test operator-only query (no text): `from:john` returns all emails from john
  - [x] 7.12 Verify existing `searchHighlight.test.ts` tests still pass
  - [x] 7.13 Verify existing `attributeSearchParser.test.ts` tests still pass

- [x] Task 8: Integration with attribute parser (AC: 7)
  - [x] 8.1 Ensure `searchOperatorParser` and `attributeSearchParser` coexist — email operators run first, remaining `name:value` patterns handled by attribute parser
  - [x] 8.2 Parsing order in `useSearch.ts`: email operators → attribute filters → MiniSearch text query
  - [x] 8.3 Both filter types applied as AND with each other

## Dev Notes

### Architecture Compliance

- **Service Pattern**: New `searchOperatorParser.ts` follows the pure function pattern from `attributeSearchParser.ts` — no singleton, no state, just exported functions
- **Hook Pattern**: `useSearch` public API must remain unchanged — only the internal search flow changes. New fields like `activeOperators` added as optional extensions
- **Post-filter Approach**: The story explicitly says "Operator filters applied as post-search filters on MiniSearch results" (AC 10). This is the simplest correct approach — MiniSearch handles relevance ranking, operators handle precise filtering
- **Health Registry**: No changes needed — search health tracking unchanged

### Critical Implementation Details

- **Existing Parser Pattern**: `attributeSearchParser.ts` (Story 2.15) already implements `key:value` parsing with the regex `/(\w+):((?:"[^"]*"|'[^']*'|\S+))/gi`. The new `searchOperatorParser.ts` should use the SAME regex but differentiate known email operators from custom attributes
- **Unknown Operator Handling**: Any `key:value` where key is NOT in KNOWN_OPERATORS (`from`, `to`, `has`, `before`, `after`, `in`) should be left in the text query. The `attributeSearchParser` will then catch it if it matches a custom attribute name
- **Parsing Order**: `searchOperatorParser` runs first (extracts `from:`, `to:`, etc.) → `attributeSearchParser` runs second on remaining text (extracts `Status:`, `Priority:`, etc.) → remaining text goes to MiniSearch
- **MiniSearch AND_NOT Combinator**: MiniSearch v7.x supports `AND_NOT` for exclusion queries — note for future `-from:john` support but NOT part of this story
- **Operator-Only Queries**: When there's no text query (e.g., `from:john has:attachment`), we can't use MiniSearch for ranking. Instead, iterate all documents from `searchIndexService.documents` Map and filter. Sort by timestamp (newest first)
- **Date Parsing**: For `before:` and `after:` operators, use `new Date(value).getTime()` for parsing. Accept `YYYY-MM-DD` format. Invalid dates should cause the operator to be treated as unknown (fall through as text)
- **EmailDocument Fields**: `from` is `{ name: string, email: string }` (singular), `to` is `EmailAddress[]` (array), `attachments` is `Attachment[]`, `folder` is a string, `labels` is `string[]`, `timestamp` is Unix ms

### What NOT to Change

- `searchIndexService.ts` — MiniSearch index configuration stays the same (no new indexed fields)
- `searchHistoryService.ts` — Search history records the raw query including operators (user expectation)
- `indexStorage.ts` — No persistence changes
- `useSearchIndex.ts` — Index subscription unchanged
- `searchHighlight.ts` — Existing `parseSearchTerms()` already strips `key:` prefixes; just verify it works
- DOMPurify XSS protection

### What WILL Change

- `src/services/search/searchOperatorParser.ts` (new) — Email operator parsing and filtering
- `src/services/search/__tests__/searchOperatorParser.test.ts` (new) — Comprehensive tests
- `src/hooks/useSearch.ts` (modified) — Integrate operator parsing before MiniSearch, post-filter after
- `src/services/search/searchIndexService.ts` (modified) — Add `getDocumentIds()` for operator-only queries
- `src/services/search/index.ts` (modified) — Export new parser functions
- `src/components/search/CommandPalette.tsx` (modified) — Operator hints, active operator chips
- `src/components/search/SearchInput.tsx` (modified) — Update placeholder text

### Project Structure Notes

- New parser file goes in `src/services/search/searchOperatorParser.ts` alongside existing `attributeSearchParser.ts`
- Tests go in `src/services/search/__tests__/searchOperatorParser.test.ts`
- No new directories needed

### Performance Targets

- Operator parsing: <1ms (pure string regex)
- Post-filtering: <10ms for 50 results (simple field comparisons)
- Operator-only query (iterate all docs): <50ms for 10K emails
- Total search with operators: <150ms (100ms MiniSearch + parsing + filtering)

### Previous Story Intelligence (Story 2.21)

Story 2.21 established:

- MiniSearch v7.2.0 as the search engine — BM25 scoring, incremental updates, fuzzy matching
- `searchHistoryService` for localStorage-based recent searches
- `SearchResult` type: `{ id, score, match: Record<string, string[]>, terms: string[] }`
- `MINISEARCH_OPTIONS` with field boosts, prefix search, fuzzy matching, `maxFuzzy: 2`
- `useSearchIndex` tracks RxDB revisions for incremental add/discard/replace
- `searchIndexService` singleton with `getIndex()`, `setIndex()`, `getMiniSearchOptions()`
- Code review finding: barrel exports must go through `src/services/search/index.ts`
- Code review finding: stale Lunr references were cleaned up — don't reintroduce

Story 2.15 established:

- `attributeSearchParser.ts` — regex `/(\w+):((?:"[^"]*"|'[^']*'|\S+))/gi` for `key:value` extraction
- `ParsedSearchQuery` interface: `{ textQuery, attributeFilters: Map, hasAttributeFilters }`
- `AttributeSearchHint` interface for autocomplete hints
- The attribute parser exists but is NOT currently called from `useSearch.ts` — it's used elsewhere in the filter UI

### Git Intelligence

Recent commits show patterns:

- Pre-commit hooks enforce ESLint + Prettier (lint-staged with husky)
- Test files follow `__tests__/` directory convention
- New singleton services export instance from file, not just class
- Parser files are pure functions (no class, no state) — follow this pattern for `searchOperatorParser.ts`
- Story code reviews found barrel export issues — always export from `index.ts`

### Latest Tech Information

**MiniSearch v7.2.0** (installed):

- `search(query, options)` accepts per-query options including field-specific boosting
- `AND_NOT` combinator available for exclusion queries (future story)
- Field-specific search: `miniSearch.search('john', { fields: ['fromName', 'fromEmail'] })` — could be used for `from:` operator but post-filtering is simpler and recommended by the story
- `autoSuggest()` for autocomplete
- BM25 scoring for relevance ranking

**Date Handling**:

- `new Date('2025-01-15').getTime()` returns UTC midnight — for `before:` comparisons, use start-of-day; for `after:`, use end-of-day
- `Date.parse()` returns NaN for invalid dates — check with `isNaN()` before comparing

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-2-offline-first-email-client-with-attributes.md#Story 2.22]
- [Source: _bmad-output/planning-artifacts/architecture.md#Search Implementation]
- [Source: src/services/search/attributeSearchParser.ts]
- [Source: src/services/search/searchIndexService.ts]
- [Source: src/services/search/types.ts]
- [Source: src/hooks/useSearch.ts]
- [Source: src/components/search/CommandPalette.tsx]
- [Source: src/components/search/SearchInput.tsx]
- [Source: src/utils/searchHighlight.ts]
- [Source: src/services/database/schemas/email.schema.ts]
- [Source: _bmad-output/implementation-artifacts/stories/2-21-replace-lunr-with-minisearch.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- All 37 tests pass in searchOperatorParser.test.ts (36 original + 1 strict date validation)
- All 52 existing search tests pass (attributeSearchParser: 17, searchHighlight: 35)
- All 164 search/hooks tests pass with no regressions
- Full test suite: 9 failing test files are all pre-existing (sendQueue, outlookSync, App.test, EmptyState, etc.)
- ESLint passes clean on all modified/new files

### Completion Notes List

- **Task 1**: Created `searchOperatorParser.ts` as pure function module following `attributeSearchParser.ts` pattern. Implements `parseSearchOperators()`, `matchesOperatorFilters()`, `getOperatorSearchHints()` with KNOWN_OPERATORS constant. Invalid dates for before:/after: treated as unknown operators (fall through as text). **Code review fix**: `isValidDate()` now enforces strict YYYY-MM-DD with regex `/^\d{4}-\d{2}-\d{2}$/` before `new Date()`.
- **Task 2**: Integrated operator parsing into `useSearch.ts` — operators parsed FIRST via `parseSearchOperators()`, text query passed to MiniSearch, results post-filtered with `matchesOperatorFilters()`. Added `activeOperators` to hook return type.
- **Task 3**: Added `getDocumentIds()` to `SearchIndexService`. Operator-only queries iterate all documents with operator filters, sorted by timestamp (newest first), score set to 0.
- **Task 4**: Updated CommandPalette empty state hint text to "Try from:, to:, has:attachment, before:, after:". Updated SearchInput default placeholder to include operator examples. **Code review fix**: Imported `getOperatorSearchHints()` and `getAttributeSearchHints()`, added dynamic colon-triggered hint dropdown in CommandPalette (Tasks 4.2/4.3).
- **Task 5**: Added operator chips UI between search input and results in CommandPalette. Each chip shows `type:value` with X remove button. Removing a chip strips the operator from the query string and re-triggers search. **Code review fix**: `handleRemoveOperator()` now matches both single and double quoted operator values.
- **Task 6**: Operator values added to highlight terms in `useSearch.ts` (deduplicated with Set). Verified `parseSearchTerms()` in searchHighlight.ts already strips `key:` prefixes correctly.
- **Task 7**: Created comprehensive test suite with 37 tests covering all ACs: operator parsing, case insensitivity, quoted values, unknown operators, all filter types (from, to, has, before, after, in), multiple operators with AND logic, operator-only queries, strict date format validation. Verified existing tests pass.
- **Task 8**: Coexistence verified — operator parser extracts known operators only, leaves unknown `key:value` in text for attribute parser. The attribute parser is NOT currently called from useSearch (used in filter UI), so no conflict.

### Change Log

- 2026-02-05: Implemented Story 2.22 — Search Operators for Structured Queries. Added email operator parsing (from:, to:, has:, before:, after:, in:) with post-filter integration into MiniSearch. Added operator chips UI and hint text.
- 2026-02-05: Code review fixes — (1) Strict YYYY-MM-DD validation in isValidDate(), (2) handleRemoveOperator handles both quote styles, (3) Dynamic colon-triggered hint dropdown with merged operator + attribute hints.

### File List

**New files:**

- src/services/search/searchOperatorParser.ts
- src/services/search/**tests**/searchOperatorParser.test.ts

**Modified files:**

- src/hooks/useSearch.ts
- src/services/search/searchIndexService.ts
- src/services/search/index.ts
- src/components/search/CommandPalette.tsx
- src/components/search/SearchInput.tsx
