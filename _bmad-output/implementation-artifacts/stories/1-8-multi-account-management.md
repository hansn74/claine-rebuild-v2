# Story 1.8: Multi-Account Management

**Story ID:** 1-8-multi-account-management
**Epic:** Epic 1 - Foundation & Core Infrastructure
**Status:** done
**Priority:** High
**Created:** 2025-11-25

## Story

As a user,
I want to connect up to 3 email accounts,
So that I can manage multiple inboxes in one place.

## Acceptance Criteria

**AC 1:** Account switcher UI implemented (dropdown or sidebar)
**AC 2:** Each account syncs independently
**AC 3:** RxDB collections properly scoped by account (accountId filtering)
**AC 4:** User can switch between accounts seamlessly
**AC 5:** Account connection limit enforced (max 3 accounts)
**AC 6:** Clear indication of which account is currently active

## Tasks / Subtasks

### Account Switcher UI Component

- [x] Create AccountSwitcher component (AC: 1, 4, 6)
  - [x] Create `src/components/account/AccountSwitcher.tsx`
  - [x] Display list of connected accounts with provider icon (Gmail/Outlook)
  - [x] Show active account with visual indicator (checkmark, highlight)
  - [x] Dropdown or sidebar layout (responsive)
  - [x] Handle click to switch active account
  - [x] Add "Connect Account" button when < 3 accounts

### Account State Management

- [x] Create account store (AC: 4, 6)
  - [x] Create `src/store/accountStore.ts`
  - [x] Track list of connected accounts (id, email, provider, connectedAt)
  - [x] Track active account ID
  - [x] Implement `setActiveAccount(accountId)` action
  - [x] Persist active account preference in localStorage

### Account Limit Enforcement

- [x] Implement 3-account limit (AC: 5)
  - [x] Add validation in OAuth callback to check account count
  - [x] Show error message when attempting to connect 4th account
  - [x] Clear message: "Maximum 3 accounts supported. Please remove an account first."
  - [x] Add "Remove Account" functionality

### Data Scoping by Account

- [x] Verify RxDB queries filter by accountId (AC: 3)
  - [x] Update useEmails hook to filter by active accountId
  - [x] Update syncState queries to filter by accountId
  - [x] Ensure email list shows only active account's emails
  - [x] Test data isolation between accounts

### Independent Sync per Account

- [x] Implement independent sync workers (AC: 2)
  - [x] Verify Gmail sync uses accountId correctly (from Story 1.6A)
  - [x] Verify Outlook sync uses accountId correctly (from Story 1.6B)
  - [x] Sync orchestrator manages multiple accounts
  - [x] Sync continues for all accounts when one fails
  - [x] Progress indicator shows per-account status

### Account Management UI

- [x] Create account settings page (AC: 1, 5)
  - [x] List all connected accounts with details
  - [x] Show last sync time per account
  - [x] "Disconnect" button per account
  - [x] Confirmation dialog before disconnect
  - [x] Clear account data from RxDB on disconnect

### Testing

- [x] Write unit tests for AccountSwitcher component
- [x] Write unit tests for account store
- [x] Test account limit enforcement
- [x] Test data isolation between accounts
- [x] Test switching accounts updates email list

## Dev Notes

### Learnings from Previous Story

**From Story 1-7-basic-email-list-view-ui (Status: done)**

- **useEmails hook created**: Available at `src/hooks/useEmails.ts` - has `accountId` parameter for filtering
- **EmailList component**: Already accepts filtered emails from hook
- **Email schema**: Already has `accountId` field indexed for efficient queries
- **App.tsx**: Integrated email UI - needs AccountSwitcher added to header
- **Advisory**: DOMPurify sanitization should be added before production (not blocking)

[Source: stories/1-7-basic-email-list-view-ui.md#Dev-Agent-Record]

### From Story 1-6c (OAuth E2E + ReAuth UI)

- **notificationStore**: Available at `src/store/notificationStore.ts` - pattern for subscription-based store
- **tokenStorageService**: Stores tokens keyed by accountId at `src/services/auth/tokenStorage.ts`
- **ReAuthNotification**: Shows re-auth per account - already multi-account aware

### Architecture Patterns

**Account Data Model:**

```typescript
interface Account {
  id: string // Unique account ID (email address or generated)
  email: string // User email address
  provider: 'gmail' | 'outlook'
  displayName?: string // Optional display name
  connectedAt: number // Unix timestamp
  lastSyncAt?: number // Last successful sync
}
```

**Account Store Pattern (Zustand):**

```typescript
interface AccountStore {
  accounts: Account[]
  activeAccountId: string | null
  setActiveAccount: (accountId: string) => void
  addAccount: (account: Account) => void
  removeAccount: (accountId: string) => void
  getActiveAccount: () => Account | null
}
```

**Multi-Account Email Query:**

```typescript
// In useEmails hook
const activeAccountId = useAccountStore((s) => s.activeAccountId)
const emails = useQuery(
  db.emails.find({ selector: { accountId: activeAccountId } }).sort({ timestamp: 'desc' })
)
```

### Project Structure Notes

**New Files This Story:**

```
src/components/account/
├── AccountSwitcher.tsx        # Account dropdown/sidebar (NEW)
├── AccountListItem.tsx        # Individual account display (NEW)
├── AccountSettings.tsx        # Account management page (NEW)
└── __tests__/
    └── AccountSwitcher.test.tsx

src/store/
└── accountStore.ts            # Account state management (NEW)
```

**Modified Files:**

- `src/App.tsx` - Add AccountSwitcher to header
- `src/hooks/useEmails.ts` - Add active account filtering
- `src/services/auth/gmailOAuth.ts` - Add account limit check
- `src/services/auth/outlookOAuth.ts` - Add account limit check

### Technical Constraints

**Account Limit Rationale:**

- 3 accounts matches typical user needs
- Prevents IndexedDB storage bloat (100K emails × 3 = 300K max)
- Simplifies sync scheduling (max 3 concurrent syncs)
- Can increase limit in future if needed

**Data Isolation:**

- All email queries MUST include accountId filter
- Never display emails from inactive accounts
- Clear account data completely on disconnect

**Active Account Persistence:**

- Store activeAccountId in localStorage (not IndexedDB)
- Restore on app launch
- Default to first account if stored account removed

### References

- [Source: docs/epics/epic-1-foundation-core-infrastructure.md#Story-1.8]
- [Source: docs/architecture.md#Decision-2-State-Management-Zustand]
- [Source: docs/architecture.md#RxDB-Schema-Definitions]
- [Previous Story: stories/1-7-basic-email-list-view-ui.md]
- [OAuth Implementation: stories/1-4-oauth-2-0-pkce-integration-for-gmail.md]

## Dev Agent Record

### Context Reference

- docs/stories/1-8-multi-account-management.context.xml

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Implementation started with account store (Zustand pattern from existing databaseStore)
- AccountSwitcher created as dropdown component with provider icons and active indicator
- Account limit enforced via accountManager.ts service layer (not OAuth services directly)
- Data scoping already in place via existing RxDB indexes and useEmails hook
- Sync orchestrator already handles multiple accounts independently
- All 78 relevant tests pass

### Completion Notes List

- **AccountStore**: Created Zustand store with MAX_ACCOUNTS=3 enforcement, localStorage persistence
- **AccountSwitcher**: Dropdown component showing active account, account list, connect button
- **AccountListItem**: Individual account display with provider icons and active checkmark
- **AccountSettings**: Management page with disconnect functionality and confirmation dialog
- **AccountManager**: Service layer for account connection with limit enforcement
- **AccountLoader**: Hydrates account store from token storage on app startup
- **App.tsx Integration**: AccountSwitcher in header, activeAccountId passed to EmailList

### File List

**New Files:**

- `src/store/accountStore.ts` - Account state management with Zustand
- `src/components/account/AccountSwitcher.tsx` - Account dropdown UI
- `src/components/account/AccountListItem.tsx` - Individual account display
- `src/components/account/AccountSettings.tsx` - Account management page
- `src/components/account/index.ts` - Component exports
- `src/services/auth/accountManager.ts` - Account connection orchestration
- `src/services/auth/accountLoader.ts` - Account hydration from storage
- `src/store/__tests__/accountStore.test.ts` - Account store unit tests (22 tests)
- `src/components/account/__tests__/AccountSwitcher.test.tsx` - Component tests (10 tests)

**Modified Files:**

- `src/App.tsx` - Added AccountSwitcher to header, pass activeAccountId to EmailList
- `src/services/auth/index.ts` - Export new account management functions

## Code Review

### Review Date

2025-11-25

### Reviewer

Claude Opus 4.5 (SM)

### Review Outcome

**APPROVED** - Implementation meets all acceptance criteria with high code quality.

### Acceptance Criteria Validation

| AC                                  | Status         | Evidence                                                                                                      |
| ----------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------- |
| AC1: Account switcher UI            | ✅ IMPLEMENTED | `src/components/account/AccountSwitcher.tsx:86-145` - Dropdown component with trigger button and account list |
| AC2: Independent sync per account   | ✅ VERIFIED    | Existing sync infrastructure uses `accountId` - verified in `useEmails.ts:53-55` and orchestrator pattern     |
| AC3: RxDB scoped by accountId       | ✅ VERIFIED    | `src/hooks/useEmails.ts:52-58` - Selector filters by accountId, indexed in schema                             |
| AC4: Seamless account switching     | ✅ IMPLEMENTED | `src/store/accountStore.ts:98-105` - `setActiveAccount()` updates state and persists to localStorage          |
| AC5: Account limit enforced (max 3) | ✅ IMPLEMENTED | `src/store/accountStore.ts:30` - `MAX_ACCOUNTS=3`, enforced in `addAccount()` and `accountManager.ts:33-43`   |
| AC6: Active account indicator       | ✅ IMPLEMENTED | `src/components/account/AccountListItem.tsx:47-49` - Checkmark icon and `bg-blue-50` highlight                |

### Task Completion Verification

All tasks marked complete in story file verified:

- ✅ AccountSwitcher component with dropdown, provider icons, active indicator
- ✅ Account store with Zustand, localStorage persistence, limit enforcement
- ✅ Account limit with error messaging (AccountLimitError class)
- ✅ Data scoping via existing useEmails hook with accountId filtering
- ✅ Independent sync via existing sync orchestrator pattern
- ✅ AccountSettings page with disconnect and confirmation dialog
- ✅ Unit tests: 22 for accountStore, 10 for AccountSwitcher (32 total)

### Code Quality Assessment

**Strengths:**

- Clean separation of concerns (store, components, services)
- Follows existing codebase patterns (Zustand store pattern from databaseStore)
- Proper TypeScript typing throughout
- Good test coverage with meaningful assertions
- Defensive coding (duplicate prevention, localStorage error handling)

**Minor Observations (not blocking):**

- ProviderIcon component duplicated across AccountSwitcher, AccountListItem, AccountSettings - could be extracted to shared component in future refactoring
- `determineProvider()` in accountLoader.ts uses heuristic domain matching - noted as acceptable for current scope

### Test Results

- Story-specific tests: 32 passed (accountStore: 22, AccountSwitcher: 10)
- TypeScript: No errors
- ESLint: No errors on new files
- Pre-existing sync test failures unrelated to this story

### Action Items

None - implementation is complete and approved.

## Change Log

| Date       | Author                | Change                                                            |
| ---------- | --------------------- | ----------------------------------------------------------------- |
| 2025-11-25 | Claude Opus 4.5 (SM)  | Story created from Epic 1 Story 1.8 via create-story workflow     |
| 2025-11-25 | Claude Opus 4.5 (Dev) | Story implementation complete - all 6 ACs met, 32 new tests added |
| 2025-11-25 | Claude Opus 4.5 (SM)  | Code review completed - APPROVED                                  |
