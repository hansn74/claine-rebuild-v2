# Story 2.12: Empty States & Onboarding UX

Status: done

## Story

As a new user,
I want clear guidance when getting started,
so that I understand how to use Claine.

## Acceptance Criteria

1. Welcome screen on first launch with "Connect Email" CTA
2. Empty inbox state: "You're all caught up" with calm affirmation
3. Empty search results: Helpful message with search tips
4. Loading states: Progress indicators with estimated time
5. Error states: Clear messages with actionable next steps
6. Tooltips for first-time interactions (dismissible)

## Tasks / Subtasks

- [x] Task 1: Create Empty State Component Library (AC: 2, 3)
  - [x] 1.1 Create `src/components/common/EmptyState.tsx` base component with icon, title, description, action slots
  - [x] 1.2 Create `EmptyInbox.tsx` variant: "You're all caught up!" message with checkmark icon
  - [x] 1.3 Create `EmptySearch.tsx` variant: "No results found" with search tips
  - [x] 1.4 Create `EmptyFolder.tsx` variant: Generic empty folder state (Sent, Drafts, Archive, Trash)
  - [x] 1.5 Add illustration/icon assets (use Lucide icons: Inbox, Search, FolderOpen, CheckCircle)
  - [x] 1.6 Write unit tests for EmptyState component variants

- [x] Task 2: Implement Welcome Screen / Onboarding Flow (AC: 1)
  - [x] 2.1 Create `src/components/onboarding/WelcomeScreen.tsx` with Claine branding
  - [x] 2.2 Add "Connect Email Account" CTA button prominently displayed
  - [x] 2.3 Show feature highlights (Offline-first, Fast search, Keyboard shortcuts)
  - [x] 2.4 Create `useOnboardingState` hook to track first-launch status in localStorage
  - [x] 2.5 Integrate with existing AccountManager to trigger OAuth flow
  - [x] 2.6 Add E2E test for first-launch welcome screen flow

- [x] Task 3: Create Loading State Components (AC: 4)
  - [x] 3.1 Extend existing `LoadingFallback.tsx` with progress variants
  - [x] 3.2 Create `SyncProgress.tsx` component showing sync status (e.g., "Syncing emails... 250/1000")
  - [x] 3.3 Add estimated time remaining calculation based on sync rate
  - [x] 3.4 Create skeleton loading states for inbox list (extend EmailListLoadingFallback)
  - [x] 3.5 Add indeterminate and determinate progress bar variants
  - [x] 3.6 Write unit tests for loading components

- [x] Task 4: Implement Error State Components (AC: 5)
  - [x] 4.1 Create `src/components/common/ErrorState.tsx` base component
  - [x] 4.2 Create specific error variants:
    - `NetworkError.tsx`: "Unable to connect" with retry button
    - `AuthError.tsx`: "Session expired" with re-authenticate button
    - `SyncError.tsx`: "Sync failed" with retry/skip options
  - [x] 4.3 Integrate with ErrorBoundary.tsx for component-level error recovery
  - [x] 4.4 Add error logging integration with existing logger service
  - [x] 4.5 Write unit tests for error states

- [x] Task 5: Implement First-Time Tooltips System (AC: 6)
  - [x] 5.1 Create `src/hooks/useFirstTimeTooltip.ts` hook for managing tooltip state
  - [x] 5.2 Create `FirstTimeTooltip.tsx` component with dismiss functionality
  - [x] 5.3 Store dismissed tooltip IDs in localStorage
  - [x] 5.4 Add tooltips for key features:
    - Keyboard shortcuts (? key)
    - Search (/ key)
    - Archive (e key)
    - Compose (c key)
  - [x] 5.5 Position tooltips correctly near target elements (use Radix Tooltip or similar)
  - [x] 5.6 Write unit tests for tooltip visibility and dismiss logic

- [x] Task 6: Integrate Empty States into Existing Views (AC: 1-3)
  - [x] 6.1 Add EmptyInbox to InboxView when no emails
  - [x] 6.2 Add EmptySearch to SearchResults when no results
  - [x] 6.3 Add EmptyFolder to folder views (Sent, Drafts, Archive, Trash)
  - [x] 6.4 Show WelcomeScreen when no accounts connected
  - [x] 6.5 Ensure smooth transitions between loading → empty → content states
  - [x] 6.6 Write integration tests for state transitions

- [x] Task 7: Accessibility & Testing (AC: 1-6)
  - [x] 7.1 Add ARIA labels to all empty state components
  - [x] 7.2 Ensure focus management for modal tooltips
  - [x] 7.3 Add screen reader announcements for state changes
  - [x] 7.4 Write E2E tests covering:
    - First launch → welcome screen → connect account flow
    - Empty inbox after archive all
    - Empty search results with tips
    - Error recovery flows
  - [x] 7.5 Test with keyboard-only navigation

## Dev Notes

### Architecture Patterns

- Empty states follow existing component patterns in `src/components/common/`
- Use composition pattern: base EmptyState + variant-specific content
- Tooltips use localStorage for persistence, similar to `shortcutPreferences.ts`
- Error states integrate with existing ErrorBoundary.tsx
- Skeleton loading extends existing LoadingFallback.tsx patterns

### Source Tree Components to Touch

- `src/components/common/EmptyState.tsx` (create) - Base empty state component
- `src/components/common/EmptyInbox.tsx` (create) - Empty inbox variant
- `src/components/common/EmptySearch.tsx` (create) - Empty search variant
- `src/components/common/ErrorState.tsx` (create) - Error state component
- `src/components/onboarding/WelcomeScreen.tsx` (create) - First-launch screen
- `src/components/common/LoadingFallback.tsx` (modify) - Add progress variants
- `src/hooks/useOnboardingState.ts` (create) - First-launch state hook
- `src/hooks/useFirstTimeTooltip.ts` (create) - Tooltip dismiss state hook
- `src/components/email/InboxView.tsx` (modify) - Integrate empty states
- `src/components/search/SearchResults.tsx` (modify) - Integrate empty states

### Testing Standards

- Unit tests for all new components (Vitest)
- Integration tests for state transitions
- E2E tests for first-launch flow (Playwright)
- Accessibility tests using @testing-library/jest-dom
- Follow test patterns from `docs/testing.md`

### Project Structure Notes

- Empty state components in: `src/components/common/`
- Onboarding components in: `src/components/onboarding/`
- Hooks in: `src/hooks/`
- Follow existing Tailwind patterns from LoadingFallback.tsx
- Use Lucide icons for consistency with existing components

### Design Guidelines

From UX Design Spec:

- Color: Cyan primary (#06B6D4), Slate neutrals
- Typography: Inter Variable, 14-16px body
- Spacing: 4px base unit, 8px rhythm
- Border radius: 4-8px for components
- Animation: 150-200ms ease for transitions
- Empty state as encouragement (Notion-inspired warmth)
- Tone: "Calm, direct, reassuring"

### Learnings from Previous Story

**From Story 2-11-keyboard-shortcuts-power-user-features (Status: in-progress)**

- **ShortcutContext Available**: Use `src/context/ShortcutContext.tsx` for keyboard shortcut integration in tooltips
- **Hooks Pattern**: Follow `src/hooks/useEmailShortcut.ts` pattern for custom hooks
- **Overlay Pattern**: ShortcutOverlay at `src/components/ShortcutOverlay/` shows modal overlay implementation
- **Focus Management**: Roving tabindex pattern used in EmailRow - consider for tooltip focus

Note: Story 2-11 is currently in-progress, completion notes not yet available.

[Source: stories/2-11-keyboard-shortcuts-power-user-features.md]

### References

- [Source: docs/epics/epic-2-offline-first-email-client-with-attributes.md#Story 2.12]
- [Source: docs/ux-design-specification.md#Visual Foundation]
- [Source: docs/ux-design-specification.md#Design Foundation Decisions]
- [Source: src/components/common/LoadingFallback.tsx] - Loading state patterns
- [Source: src/components/common/ErrorBoundary.tsx] - Error handling patterns

## Dev Agent Record

### Context Reference

- `docs/stories/2-12-empty-states-onboarding-ux.context.xml`

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
