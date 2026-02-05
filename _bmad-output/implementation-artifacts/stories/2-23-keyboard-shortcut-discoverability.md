# Story 2.23: Keyboard Shortcut Discoverability & Progressive Learning

Status: done

## Story

As a user,
I want to naturally discover keyboard shortcuts while using the app,
So that I gradually become faster without needing to memorize a reference sheet.

## Acceptance Criteria

### Inline Shortcut Hints

1. All buttons/actions with keyboard shortcuts show the shortcut in their label or tooltip: "Archive (e)", "Reply (r)", "Forward (f)"
2. Hints shown consistently across all action buttons using a shared pattern
3. Hints respect current scope (don't show thread shortcuts when in list view)
4. Hints can be hidden via user setting ("Show keyboard hints: on/off") in settingsStore

### Context-Aware Command Palette

5. Command palette (Cmd+K actions mode) ranks actions by current context:
   - In list view (inbox scope): navigation and bulk actions ranked first
   - In thread view (reading scope): reply, forward, archive ranked first
   - In compose scope: send and formatting actions ranked first
6. Recently used commands (last 10) shown in a "Recent" section at top of palette
7. Usage counts tracked per command in localStorage (key: 'claine-command-usage')
8. Palette already shows shortcut key next to each command entry (verify existing)

### Nudge Tooltips

9. Track action execution method (mouse click vs keyboard shortcut) per action type in localStorage
10. After a user performs the same mouse action 3+ times without using the shortcut, show a one-time tooltip: "Tip: press 'e' to archive faster"
11. Each nudge shown only once per action (don't nag) — tracked in localStorage
12. Nudge dismissed on click or after 5 seconds
13. Nudges disabled if user turns off keyboard hints (AC #4)

### Testing

14. Test: Archive button shows "(e)" hint when showKeyboardHints is enabled
15. Test: Thread view command palette shows Reply/Forward/Archive at top
16. Test: List view command palette shows navigation actions at top
17. Test: Mouse-archive 3 times → nudge tooltip appears with "e" shortcut
18. Test: Same nudge doesn't appear twice for same action
19. Test: Disable hints setting → all inline hints and nudges hidden

## Tasks / Subtasks

- [x] Task 1: Add showKeyboardHints setting (AC: 4)
  - [x] 1.1 Add `showKeyboardHints: boolean` to settingsStore (default: true)
  - [x] 1.2 Persist to localStorage with existing 'claine_settings' key
  - [x] 1.3 Add toggle UI in settings panel (if exists) or expose via debug helpers

- [x] Task 2: Create ShortcutHint component for inline hints (AC: 1, 2, 3, 4)
  - [x] 2.1 Create `src/components/common/ShortcutHint.tsx` — renders `(key)` styled consistently
  - [x] 2.2 Props: `shortcutKey: string`, `scope?: ShortcutScope` (optional scope filtering)
  - [x] 2.3 Component checks `showKeyboardHints` from settingsStore — returns null if disabled
  - [x] 2.4 Component checks `activeScope` from ShortcutContext — returns null if scope mismatch
  - [x] 2.5 Style: muted text, smaller font size, parentheses wrapping

- [x] Task 3: Add ShortcutHint to action buttons (AC: 1, 2, 3)
  - [x] 3.1 Update EmailActionButton component with shortcutKey, shortcutScopes, actionId props
  - [x] 3.2 ShortcutHint renders inline when label shown and scope matches
  - [x] 3.3 Tooltip automatically includes shortcut: "Archive email (e)" pattern
  - [x] 3.4 Nudge tooltip integration with ShortcutNudgeTooltip component

- [x] Task 4: Context-aware command palette ranking (AC: 5, 6, 7, 8)
  - [x] 4.1 Create `useCommandUsage` hook to track command usage counts in localStorage
  - [x] 4.2 Add `getRecentCommands(): string[]` — returns last 10 used command IDs
  - [x] 4.3 Add `recordCommandUsage(commandId: string)` — increments usage count
  - [x] 4.4 Modify CommandPalette `filteredCommands` to sort by: recent → context-relevant → alphabetical
  - [x] 4.5 Context relevance: check `activeScope` from ShortcutContext, boost commands matching current scope
  - [x] 4.6 Add "Recent" section header when recent commands exist — Sorting puts recent at top automatically
  - [x] 4.7 Verify existing shortcut kbd display works (Task 8.1 already shows `<kbd>` elements)

- [x] Task 5: Create nudge tooltip system (AC: 9, 10, 11, 12, 13)
  - [x] 5.1 Create `useShortcutNudge` hook — tracks mouse vs keyboard usage per action
  - [x] 5.2 Storage structure: `{ [actionId]: { mouseCount: number, keyboardCount: number, nudgeShown: boolean } }`
  - [x] 5.3 `recordMouseAction(actionId)` — increments mouseCount, triggers nudge check
  - [x] 5.4 `recordKeyboardAction(actionId)` — increments keyboardCount, resets mouseCount
  - [x] 5.5 `shouldShowNudge(actionId)` — returns true if mouseCount >= 3 AND !nudgeShown AND showKeyboardHints
  - [x] 5.6 `markNudgeShown(actionId)` — sets nudgeShown: true in storage
  - [x] 5.7 Create `ShortcutNudgeTooltip` component — positioned near action button, auto-dismisses after 5s
  - [x] 5.8 Integrate nudge with EmailActionButton — show tooltip when shouldShowNudge returns true

- [x] Task 6: Integrate tracking into action handlers (AC: 9)
  - [x] 6.1 Update useEmailKeyboardShortcuts to call `recordKeyboardAction` when shortcut executed
  - [x] 6.2 Update EmailActionButton onClick to call `recordMouseAction` when clicked
  - [x] 6.3 Map action IDs consistently: 'archive', 'delete', 'reply', 'forward', 'star', 'markRead', 'markUnread', 'toggleRead'

- [x] Task 7: Write comprehensive tests (AC: 14-19)
  - [x] 7.1 Create `src/components/common/__tests__/ShortcutHint.test.tsx` (6 tests)
  - [x] 7.2 Test: ShortcutHint renders "(e)" when enabled and scope matches
  - [x] 7.3 Test: ShortcutHint returns null when showKeyboardHints is false
  - [x] 7.4 Test: ShortcutHint returns null when activeScope doesn't include target scope
  - [x] 7.5 Create `src/hooks/__tests__/useShortcutNudge.test.ts` (8 tests)
  - [x] 7.6 Test: shouldShowNudge returns true after 3 mouse actions, false after nudge shown
  - [x] 7.7 Test: recordKeyboardAction resets mouse count
  - [x] 7.8 Create `src/hooks/__tests__/useCommandUsage.test.ts` (9 tests)
  - [x] 7.9 Test: getRecentCommands returns last 10 used commands in order
  - [x] 7.10 Test: Command palette sorts by recent → context → alpha
  - [x] 7.11 Create `src/components/search/__tests__/CommandPalette.ranking.test.tsx` (6 tests) - Code Review Fix
  - [x] 7.12 Test: Thread view (reading scope) shows Reply/Forward/Archive at top (AC 15)
  - [x] 7.13 Test: List view (inbox scope) shows navigation actions at top (AC 16)
  - [x] 7.14 Test: Recent section header displayed when recent commands exist (AC 6)

## Dev Notes

### Architecture Compliance

- **Settings Pattern**: Use existing `settingsStore.ts` Zustand store for `showKeyboardHints` setting
- **Context Pattern**: Use existing `ShortcutContext` for `activeScope` — don't duplicate state
- **Hook Pattern**: New hooks (`useShortcutNudge`, `useCommandUsage`) follow existing patterns in `src/hooks/`
- **Component Pattern**: New components go in `src/components/common/` for reusable pieces
- **localStorage Keys**: Use prefixed keys for new storage: `claine-command-usage`, `claine-shortcut-nudges`

### Critical Implementation Details

- **Existing Infrastructure**: Story 2.11 already implemented:
  - `ShortcutContext` with `activeScope`, `useShortcuts()`, `useActiveScope()`
  - `DEFAULT_SHORTCUTS` array in `src/types/shortcuts.ts` with all shortcut definitions
  - `QUICK_COMMANDS` in CommandPalette with shortcut hints (`<kbd>` display)
  - `EmailActionButton` component with tooltip support
  - Vim mode stored in `claine-shortcut-preferences` localStorage key

- **Scope Constants**: Use `ShortcutScope` type: 'global' | 'inbox' | 'reading' | 'compose' | 'search'

- **Command Palette Mode**: Actions mode triggered by Cmd+K, uses `QUICK_COMMANDS` array. Search mode uses `/` key.

- **Shortcut Display Format**: Use `displayKeys` from `ShortcutDefinition` (e.g., "e", "⌘ K", "#")

- **Don't Break Existing**:
  - Tooltips already exist on EmailActionButton — enhance, don't replace
  - CommandPalette already shows shortcuts in kbd elements — add ranking, don't rewrite
  - ShortcutOverlay (?) already works — no changes needed

### What NOT to Change

- `ShortcutContext.tsx` — only read from it, don't modify state management
- `ShortcutOverlay/` — help screen works, no changes needed
- `useEmailShortcut.ts` — core hook, only add tracking calls
- `shortcuts.ts` types — definitions are complete

### What WILL Change

- `src/store/settingsStore.ts` (modified) — add `showKeyboardHints` setting
- `src/components/common/ShortcutHint.tsx` (new) — inline hint component
- `src/components/common/ShortcutNudgeTooltip.tsx` (new) — nudge tooltip component
- `src/hooks/useShortcutNudge.ts` (new) — nudge tracking hook
- `src/hooks/useCommandUsage.ts` (new) — command usage tracking hook
- `src/components/search/CommandPalette.tsx` (modified) — context-aware ranking
- `src/components/email/EmailActionButton.tsx` (modified) — add hint and nudge integration
- `src/hooks/useEmailKeyboardShortcuts.ts` (modified) — add keyboard tracking calls

### Performance Targets

- ShortcutHint render: <1ms (simple conditional render)
- Nudge check: <1ms (localStorage read, cached in hook)
- Command ranking: <5ms (array sort, max ~50 commands)
- No impact on shortcut execution latency (<16ms target from Story 2.11)

### Previous Story Intelligence (Story 2.11)

Story 2.11 established:

- 25+ shortcuts across 5 scopes with conflict resolution via SCOPE_PRIORITY
- `react-hotkeys-hook` v4.6.2 for detection
- Vim mode toggle with localStorage persistence
- CommandPalette shows shortcuts as `<kbd>` elements
- EmailActionButton uses `title` attribute for tooltips
- ShortcutOverlay accessible help screen with search/filter

### References

- [Source: _bmad-output/planning-artifacts/epics/epic-2-offline-first-email-client-with-attributes.md#Story 2.23]
- [Source: src/types/shortcuts.ts]
- [Source: src/context/ShortcutContext.tsx]
- [Source: src/hooks/useEmailShortcut.ts]
- [Source: src/hooks/useEmailKeyboardShortcuts.ts]
- [Source: src/components/search/CommandPalette.tsx]
- [Source: src/components/email/EmailActionButton.tsx]
- [Source: src/store/settingsStore.ts]
- [Source: _bmad-output/implementation-artifacts/stories/2-11-keyboard-shortcuts-power-user-features.md]

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- All 23 tests passing: ShortcutHint (6), useShortcutNudge (8), useCommandUsage (9)
- Pre-existing test failures not affected (App.test.tsx, sendQueuePersistence, etc.)

### Completion Notes List

1. Task 1: Added `showKeyboardHints` boolean to settingsStore with localStorage persistence
2. Task 2: Created ShortcutHint component with scope filtering and settings awareness
3. Task 3: Updated EmailActionButton with shortcutKey, shortcutScopes, actionId props
4. Task 4: Created useCommandUsage hook with recent commands tracking and context-aware ranking
5. Task 5: Created useShortcutNudge hook and ShortcutNudgeTooltip component
6. Task 6: Integrated recordKeyboardAction in useEmailKeyboardShortcuts, recordMouseAction in EmailActionButton
7. Task 7: All 23 tests written and passing

### Change Log

- src/store/settingsStore.ts: Added showKeyboardHints setting
- src/components/common/ShortcutHint.tsx: New inline hint component
- src/components/common/ShortcutNudgeTooltip.tsx: New nudge tooltip component
- src/hooks/useCommandUsage.ts: New command usage tracking hook
- src/hooks/useShortcutNudge.ts: New shortcut nudge tracking hook
- src/components/search/CommandPalette.tsx: Context-aware ranking + "Recent" section header (Code Review Fix)
- src/components/email/EmailActionButton.tsx: Shortcut hint and nudge integration
- src/hooks/useEmailKeyboardShortcuts.ts: Keyboard action tracking

### File List

**New Files:**

- src/components/common/ShortcutHint.tsx
- src/components/common/ShortcutNudgeTooltip.tsx
- src/hooks/useCommandUsage.ts
- src/hooks/useShortcutNudge.ts
- src/components/common/**tests**/ShortcutHint.test.tsx
- src/hooks/**tests**/useCommandUsage.test.ts
- src/hooks/**tests**/useShortcutNudge.test.ts
- src/components/search/**tests**/CommandPalette.ranking.test.tsx (Code Review Fix)

**Modified Files:**

- src/store/settingsStore.ts
- src/components/search/CommandPalette.tsx
- src/components/email/EmailActionButton.tsx
- src/hooks/useEmailKeyboardShortcuts.ts
