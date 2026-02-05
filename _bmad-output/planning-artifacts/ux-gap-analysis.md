# UX Design System Gap Analysis

**Date:** 2025-12-15
**Analysis Scope:** All completed UI stories (0.1 - 2.14) vs UX Design Specification

---

## Executive Summary

A comprehensive UX Design Specification was created (`docs/ux-design-specification.md`) with interactive mockups (`docs/ux-design-directions.html`, `docs/ux-color-themes.html`). The specification defined:

- Color system (Theme 3: Technical Calm - Cyan #06B6D4)
- Typography (Inter Variable font)
- Spacing system (4px base, 8px rhythm)
- 10 custom component specifications
- Design direction (Hybrid Direction 1+2: Classic 3-Pane + Command Palette)

### The Core Problem

**14 stories have UI components. 11 have visual acceptance criteria. Zero reference the UX Design Specification.**

The visual ACs that exist are **functional** (e.g., "bold for unread", "60 FPS scrolling") rather than **design-system-aligned** (e.g., "use Cyan #06B6D4", "48px row height").

The UX spec was created but **completely disconnected from story creation**.

---

## Chosen Design Direction

### Decision: Hybrid Direction 1+2

From `docs/ux-design-directions.html`, 6 design directions were explored:

| Direction | Name                      | Key Characteristics                                                          |
| --------- | ------------------------- | ---------------------------------------------------------------------------- |
| 1         | Classic 3-Pane Dense      | Sidebar (200px) + Email List (400px) + Thread Detail. Gmail/Outlook pattern. |
| 2         | Command Palette First     | Raycast-inspired ⌘K central, minimal chrome, keyboard-first                  |
| 3         | Split-View Priority Focus | Two-column priority separation, inline AI reasoning                          |
| 4         | Dashboard + Action Cards  | Linear-inspired task-centric view with stats                                 |
| 5         | Timeline Flow             | Chronological stream with AI annotations                                     |
| 6         | Minimal Scan Mode         | Superhuman-inspired single-email focus, keyboard-only                        |

**Chosen: Hybrid of Direction 1 + Direction 2**

### Layout Specifications (from Direction 1)

| Element          | Specification          | Current Implementation |
| ---------------- | ---------------------- | ---------------------- |
| Sidebar          | 200px fixed width      | ❌ Variable/180px      |
| Email List       | 400px fixed width      | ❌ Not fixed           |
| Thread Panel     | 600px flexible         | ❌ Not constrained     |
| Email Row Height | Compact for density    | ❌ ~80px (too tall)    |
| Navigation       | Sidebar always visible | ✓ Implemented          |

### Command Palette Specifications (from Direction 2)

| Element        | Specification                 | Current Implementation |
| -------------- | ----------------------------- | ---------------------- |
| Trigger        | ⌘K central                    | ✓ Implemented          |
| Modal Width    | 600px                         | ⚠️ Check actual width  |
| Shadow         | `0 24px 48px rgba(0,0,0,0.3)` | ❌ Uses shadow-2xl     |
| Backdrop       | `bg-black/50` with blur       | ⚠️ Partial             |
| Result Icons   | 32px cyan background          | ❌ Gray icons          |
| Shortcut Hints | Monospace, gray background    | ✓ Present              |

### AI Component Patterns (from Mockups)

The mockups define AI-specific visual patterns to implement:

```
Confidence Badge:    🟢 95% (green pill, white text)
AI Chip:             "DRAFT READY" (cyan bg #ECFEFF, cyan text #0891B2)
Draft Panel:         Cyan top border, cyan background (#ECFEFF)
"Why?" Button:       Cyan border, hover fills cyan
AI Reasoning Card:   Green left border (#10B981), white background
```

**Status:** None of these AI patterns are currently implemented (future Epic 3/4).

---

## Story-by-Story Analysis

### All Stories (0.1 - 2.14)

| Story | Title                                | Has UI? | Has Visual ACs? | AC Type                  | References UX Spec? |
| ----- | ------------------------------------ | ------- | --------------- | ------------------------ | ------------------- |
| 0.1   | Initialize Vite + React + TypeScript | No      | -               | -                        | No                  |
| 0.2   | Configure TailwindCSS + shadcn/ui    | Yes     | Yes             | Generic (blue-500)       | No                  |
| 0.3   | ESLint + Prettier + Husky            | No      | -               | -                        | No                  |
| 0.4   | Vitest Testing Infrastructure        | No      | -               | -                        | No                  |
| 0.5   | Playwright E2E Testing               | No      | -               | -                        | No                  |
| 0.6   | GitHub Actions CI/CD                 | No      | -               | -                        | No                  |
| 0.7   | Vercel Deployment                    | No      | -               | -                        | No                  |
| 0.8   | Environment Variables                | No      | -               | -                        | No                  |
| 0.9   | Project README                       | No      | -               | -                        | No                  |
| 0.10  | Bundle Analysis                      | No      | -               | -                        | No                  |
| 1.3   | RxDB Data Layer                      | No      | -               | -                        | No                  |
| 1.3b  | RxDB Schemas                         | No      | -               | -                        | No                  |
| 1.3c  | Schema Migration                     | No      | -               | -                        | No                  |
| 1.3d  | Database Type Safety                 | No      | -               | -                        | No                  |
| 1.3e  | Migration Runner                     | No      | -               | -                        | No                  |
| 1.3f  | Migration E2E Tests                  | No      | -               | -                        | No                  |
| 1.3g  | Fix Epic 0 E2E Tests                 | No      | -               | -                        | No                  |
| 1.4   | Gmail OAuth PKCE                     | No      | -               | -                        | No                  |
| 1.5   | Outlook OAuth                        | No      | -               | -                        | No                  |
| 1.6   | Basic Email Sync                     | No      | -               | -                        | No                  |
| 1.6a  | Gmail Sync Engine                    | No      | -               | -                        | No                  |
| 1.6b  | Outlook Sync Engine                  | No      | -               | -                        | No                  |
| 1.6c  | OAuth E2E + Reauth UI                | Yes     | Yes             | Functional               | No                  |
| 1.7   | Basic Email List View                | Yes     | Yes             | Functional (bold unread) | No                  |
| 1.8   | Multi-Account Management             | Yes     | Partial         | Functional               | No                  |
| 1.9   | Sync Conflict Detection              | Yes     | Partial         | Functional               | No                  |
| 1.10  | Partial Sync Failures                | Yes     | Partial         | Functional               | No                  |
| 1.11  | Quota Management                     | Yes     | Partial         | Functional               | No                  |
| 1.12  | Bundle Analysis                      | No      | -               | -                        | No                  |
| 1.13  | CI/CD Pipeline                       | No      | -               | -                        | No                  |
| 1.14  | Logging Infrastructure               | No      | -               | -                        | No                  |
| 2.1   | Virtualized Inbox                    | Yes     | Yes             | Performance (60 FPS)     | No                  |
| 2.2   | Thread Detail View                   | Yes     | Yes             | Functional (grouping)    | No                  |
| 2.3   | Compose & Reply                      | Yes     | Yes             | Functional (rich text)   | No                  |
| 2.4   | Offline Send Queue                   | Yes     | Partial         | Functional               | No                  |
| 2.5   | Full-Text Search                     | Yes     | Yes             | Functional (results)     | No                  |
| 2.6   | Email Actions                        | Yes     | Yes             | Functional (feedback)    | No                  |
| 2.7   | Offline Indicators                   | Yes     | Yes             | Functional (badge)       | No                  |
| 2.8   | Attachment Handling                  | Yes     | Yes             | Functional (icons)       | No                  |
| 2.9   | Folders & Labels                     | Yes     | Yes             | Functional (icons)       | No                  |
| 2.10  | Performance Optimization             | No      | -               | -                        | No                  |
| 2.11  | Keyboard Shortcuts                   | Yes     | Yes             | Functional (dialog)      | No                  |
| 2.12  | Empty States & Onboarding            | Yes     | Yes             | **Closest** to design    | **Partial**         |
| 2.13  | Custom Attributes CRUD               | Yes     | Partial         | Functional               | No                  |
| 2.14  | Apply Attributes to Emails           | Yes     | Yes             | Functional (tags)        | No                  |

### Summary

- **Total stories:** 46
- **Stories with UI components:** 14
- **Stories with visual ACs:** 11
- **Stories referencing UX spec:** 0 (Story 2.12 partial)

### Story → Story 2-17 Task Mapping

| Original Story | UI Components Created                      | Story 2-17 Tasks      |
| -------------- | ------------------------------------------ | --------------------- |
| 0.2            | TailwindCSS + shadcn/ui base               | Task 1, Task 3        |
| 1.6c           | Reauth notification UI                     | Task 3                |
| 1.7            | EmailRow, EmailList                        | Task 4                |
| 1.8            | AccountSwitcher, AccountList               | Task 7                |
| 1.9            | ConflictResolutionDialog                   | Task 11               |
| 1.10           | RetryIndicator                             | Task 11               |
| 1.11           | Quota progress UI                          | Task 3                |
| 2.1            | VirtualEmailList                           | Task 4                |
| 2.2            | ThreadDetailView, ThreadMessage            | Task 5                |
| 2.3            | ComposeDialog, RecipientInput              | Task 9                |
| 2.4            | Send queue UI                              | Task 3                |
| 2.5            | CommandPalette, SearchInput, SearchResults | Task 6                |
| 2.6            | Email action buttons                       | Task 3, Task 4        |
| 2.7            | OfflineIndicator                           | N/A (already correct) |
| 2.8            | AttachmentPicker                           | Task 9                |
| 2.9            | FolderSidebar                              | Task 7                |
| 2.11           | Keyboard shortcuts dialog                  | Task 6                |
| 2.12           | EmptyInbox, EmptySearch, EmptyFolder       | Task 8                |
| 2.13           | Settings/attributes UI                     | Task 10               |
| 2.14           | Attribute badges/chips                     | Task 3, Task 4        |

**Coverage:** All 14 UI stories mapped to Story 2-17 tasks.

### What "Functional" ACs Look Like vs "Design-System" ACs

**Functional ACs (what we have):**

- "Unread emails visually distinguished (bold text)"
- "60 FPS scrolling with 10,000+ emails"
- "Folder icons using lucide-react"
- "Offline badge/icon visible"

**Design-System ACs (what was missing):**

- "Email row height: 48px per UX spec Section 6.2"
- "Selected state: 2px left border using Primary color (#06B6D4)"
- "Typography: Inter Variable font, 14px/-0.01em body text"
- "Confidence badges: Green (#10B981) pill with white text"

---

## UX Spec Visual Targets vs Actual Implementation

### 1. Color System

| Token          | UX Spec Value         | Actual Implementation           |
| -------------- | --------------------- | ------------------------------- |
| Primary        | `#06B6D4` (Cyan 500)  | `blue-500`, `blue-600` (varies) |
| Primary Dark   | `#0891B2` (Cyan 600)  | Not used                        |
| Success        | `#10B981` (Green 500) | Sometimes used                  |
| Warning        | `#F59E0B` (Amber 500) | `yellow-500`                    |
| Error          | `#EF4444` (Red 500)   | `red-500`                       |
| Text Primary   | `#0F172A` (Slate 900) | `gray-900`, `gray-700`          |
| Text Secondary | `#64748B` (Slate 500) | `gray-500`, `gray-600`          |
| Background     | `#F8FAFC` (Slate 50)  | `gray-50`, `white`              |
| Border         | `#CBD5E1` (Slate 300) | `gray-200`                      |

**Gap:** Primary color is blue instead of cyan. No Tailwind config customization for brand colors.

---

### 2. Typography

| Element        | UX Spec              | Actual Implementation          |
| -------------- | -------------------- | ------------------------------ |
| Font Family    | Inter Variable       | System default (not loaded)    |
| H1             | 24px/600/-0.02em     | `text-lg font-semibold` (18px) |
| Body           | 14px/400/-0.01em     | `text-sm` (14px) ✓             |
| Caption        | 12px/500             | `text-xs` (12px) ✓             |
| Letter-spacing | Negative for density | Default                        |

**Gap:** Inter font not loaded. Heading sizes smaller than spec. No letter-spacing customization.

---

### 3. Spacing & Layout

| Element          | UX Spec                       | Actual Implementation         |
| ---------------- | ----------------------------- | ----------------------------- |
| Base unit        | 4px                           | Default Tailwind (4px) ✓      |
| Sidebar width    | 180px fixed                   | Varies, sometimes 200px       |
| Email list width | 400px                         | Not fixed                     |
| Email row height | 48px compact                  | ~70-80px (p-3 = 12px padding) |
| Row padding      | 8px vertical, 12px horizontal | 12px all (p-3)                |

**Gap:** Row height larger than spec. Layout widths not constrained.

---

### 4. Visual Style

| Element                | UX Spec                     | Actual Implementation           |
| ---------------------- | --------------------------- | ------------------------------- |
| Border radius (small)  | 4px                         | Default (4px) ✓                 |
| Border radius (medium) | 6px                         | Often 8px (rounded-lg)          |
| Border radius (large)  | 8px                         | 12px (rounded-xl)               |
| Shadow (subtle)        | `0 1px 3px rgba(0,0,0,0.1)` | `shadow-2xl` in command palette |
| Selected state         | Cyan left border            | Blue left border                |

---

### 5. Component-by-Component Analysis

#### EmailListItem / EmailRow

| UX Spec Feature  | Spec Detail             | Implemented?    |
| ---------------- | ----------------------- | --------------- |
| Row height       | 48px compact            | ❌ (~80px)      |
| Confidence badge | `🟢 95%` green pill     | ❌ Not present  |
| AI chip          | "DRAFT READY" cyan pill | ❌ Not present  |
| Selected state   | Cyan left border 2px    | ⚠️ Blue border  |
| Sender styling   | 0.875rem, gray          | ✓ Close         |
| Time format      | Monospace optional      | ❌ Regular font |

**From mockup `ux-design-directions.html` lines 718-771:**

```css
.email-item {
  padding: 1rem;
  border-left: 2px solid #06b6d4; /* selected */
}
.confidence-badge {
  background: #10b981;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}
.ai-chip {
  background: #ecfeff;
  color: #0891b2;
  border-radius: 3px;
}
```

**Actual EmailRow.tsx:** Generic gray/blue styling, no confidence badges, no AI chips.

---

#### ThreadDetailView

| UX Spec Feature  | Spec Detail                      | Implemented?   |
| ---------------- | -------------------------------- | -------------- |
| Draft panel      | Cyan border top, cyan background | ❌ Not present |
| "Why?" button    | Reasoning drawer trigger         | ❌ Not present |
| AI draft display | Prominent highlight              | ❌ Not present |
| Message styling  | Cyan left border for sent        | ❌ Gray border |

---

#### CommandPalette

| UX Spec Feature | Spec Detail                   | Implemented?       |
| --------------- | ----------------------------- | ------------------ |
| Backdrop        | `bg-black/50`                 | ✓ Correct          |
| Modal shadow    | `0 24px 48px rgba(0,0,0,0.3)` | ⚠️ Uses shadow-2xl |
| Result icons    | 32px cyan background          | ❌ Gray icons      |
| Shortcut hints  | Monospace, gray background    | ✓ Present          |
| Search input    | Full width, prominent         | ✓ Present          |

---

#### FolderSidebar

| UX Spec Feature    | Spec Detail             | Implemented?      |
| ------------------ | ----------------------- | ----------------- |
| Width              | 180px fixed             | ❌ Not fixed      |
| Active state       | Cyan highlight + border | ❌ Blue highlight |
| Section labels     | Uppercase, 0.75rem      | ✓ Present         |
| Priority labels    | Color-coded (🔴🟡🟢)    | ❌ Not present    |
| Trust Meter widget | Compact pill            | ❌ Not present    |

---

#### Empty States

| UX Spec Feature | Spec Detail           | Implemented?    |
| --------------- | --------------------- | --------------- |
| Icon color      | Cyan                  | ✓ Uses cyan-500 |
| Tone            | Friendly, encouraging | ✓ Good copy     |
| Layout          | Centered, spacious    | ✓ Correct       |

---

### 6. Stories With UI - Design System Gap Details

All UI stories have **functional** ACs but lack **design-system** ACs:

| Story | UI Components                         | Functional ACs             | Design-System ACs       |
| ----- | ------------------------------------- | -------------------------- | ----------------------- |
| 1.7   | EmailList, EmailListItem, EmailDetail | ✓ Bold unread, date sort   | ❌ No colors/spacing    |
| 2.1   | VirtualEmailList, EmailRow            | ✓ 60 FPS, row heights      | ❌ No 48px height spec  |
| 2.2   | ThreadDetailView, ThreadMessage       | ✓ Grouping, collapse       | ❌ No cyan borders      |
| 2.3   | ComposeDialog, RecipientInput         | ✓ Rich text, autocomplete  | ❌ No typography spec   |
| 2.5   | SearchInput, CommandPalette           | ✓ Results display          | ❌ No modal shadow spec |
| 2.6   | EmailActionBar, EmailActionButton     | ✓ Action feedback          | ❌ No button styling    |
| 2.7   | OfflineIndicator, SyncButton          | ✓ Badge exists             | ❌ No badge styling     |
| 2.9   | FolderSidebar                         | ✓ Icons, hierarchy         | ❌ No 180px width       |
| 2.11  | ShortcutOverlay                       | ✓ Dialog exists            | ❌ No overlay styling   |
| 2.12  | EmptyInbox, EmptySearch               | ⚠️ **Closest** - cyan icon | ⚠️ Partial reference    |
| 2.13  | AttributeCard, AttributeForm          | ✓ CRUD works               | ❌ No card styling      |

---

## Recommendations

### Option A: Create Dedicated UX Story (Story 2-17)

A single story that applies the design system to all existing components. This is the approach already drafted in `docs/stories/2-17-apply-ux-design-system.md`.

**Pros:** Single focused effort, consistent application
**Cons:** Large story, might be 16+ hours

### Option B: Component-by-Component Stories

Create mini-stories for each component cluster:

- 2-17a: Design tokens setup
- 2-17b: EmailListItem/EmailRow styling
- 2-17c: ThreadDetailView styling
- 2-17d: CommandPalette styling
- etc.

**Pros:** Smaller, incremental
**Cons:** More coordination overhead

### Option C: Apply During Story 2-14

As Story 2-14 touches email components for attributes, also apply UX styling to those components as part of the work.

**Pros:** No separate story
**Cons:** Mixes concerns, might delay 2-14

---

## Priority Components (Impact vs Effort)

| Component                | Visual Impact | Effort | Priority |
| ------------------------ | ------------- | ------ | -------- |
| Tailwind config (tokens) | High          | Low    | 1        |
| Inter font loading       | High          | Low    | 2        |
| EmailRow/EmailListItem   | High          | Medium | 3        |
| FolderSidebar            | Medium        | Low    | 4        |
| CommandPalette           | Medium        | Low    | 5        |
| ThreadDetailView         | Medium        | Medium | 6        |
| Empty states             | Low           | Low    | 7        |

---

## Complete Component Inventory

### Component Count by Directory

| Directory                  | Count   | Primary Stories         |
| -------------------------- | ------- | ----------------------- |
| `src/components/email/`    | 18      | 1.7, 2.1, 2.2, 2.6, 2.9 |
| `src/components/ui/`       | 25      | 0.2 (shadcn base)       |
| `src/components/compose/`  | 8       | 2.3, 2.8                |
| `src/components/search/`   | 6       | 2.5, 2.11               |
| `src/components/common/`   | 10      | 2.7, 2.12               |
| `src/components/auth/`     | 5       | 1.4, 1.5, 1.6c          |
| `src/components/settings/` | 5       | 2.13, 2.14              |
| `src/components/accounts/` | 4       | 1.8                     |
| `src/components/sync/`     | 3       | 1.9, 1.10               |
| `src/components/debug/`    | 1       | 1.14                    |
| **Total**                  | **~85** |                         |

---

## Component Cross-Reference Matrix

### HIGH PRIORITY - Core Email Experience

| Component        | File                         | UX Spec Target                                                           | Current State                                                 | Story Origin |
| ---------------- | ---------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------- | ------------ |
| EmailRow         | `email/EmailRow.tsx`         | 48px height, cyan selected border (#06B6D4), confidence badges, AI chips | ~80px height (p-3=12px×2+content), blue-500 border, no badges | 2.1, 2.10    |
| EmailListItem    | `email/EmailListItem.tsx`    | Same as EmailRow                                                         | Same gaps                                                     | 1.7          |
| ThreadDetailView | `email/ThreadDetailView.tsx` | Cyan borders for sent messages, draft panel highlight                    | Gray borders, no draft styling                                | 2.2          |
| ThreadMessage    | `email/ThreadMessage.tsx`    | Proper message spacing, sent vs received styling                         | Generic styling                                               | 2.2          |
| FolderSidebar    | `email/FolderSidebar.tsx`    | 180px fixed width, cyan active state (#06B6D4), priority labels          | Variable width, blue-100 active                               | 2.9          |
| CommandPalette   | `search/CommandPalette.tsx`  | `0 24px 48px rgba(0,0,0,0.3)` shadow, cyan icons                         | shadow-2xl, gray icons                                        | 2.5, 2.11    |
| VirtualEmailList | `email/VirtualEmailList.tsx` | 48px row height for virtualization                                       | ~80px row height                                              | 2.1          |

### MEDIUM PRIORITY - Secondary UI

| Component                | File                                | UX Spec Target                              | Current State       | Story Origin |
| ------------------------ | ----------------------------------- | ------------------------------------------- | ------------------- | ------------ |
| ComposeDialog            | `compose/ComposeDialog.tsx`         | Cyan accent border, button styling per spec | Generic styling     | 2.3          |
| RecipientInput           | `compose/RecipientInput.tsx`        | Cyan focus ring, autocomplete styling       | Blue focus ring     | 2.3          |
| AttachmentPicker         | `compose/AttachmentPicker.tsx`      | Icon styling per spec                       | Generic icons       | 2.8          |
| SearchInput              | `search/SearchInput.tsx`            | Cyan focus ring (#06B6D4)                   | Blue focus ring     | 2.5          |
| SearchResults            | `search/SearchResults.tsx`          | Result highlighting with cyan               | Blue highlights     | 2.5          |
| AccountSwitcher          | `accounts/AccountSwitcher.tsx`      | Cyan highlights, dropdown styling           | Blue highlights     | 1.8          |
| AccountList              | `accounts/AccountList.tsx`          | Card styling per spec                       | Generic cards       | 1.8          |
| OfflineIndicator         | `common/OfflineIndicator.tsx`       | Status colors per spec                      | Amber-500 (correct) | 2.7          |
| ConflictResolutionDialog | `sync/ConflictResolutionDialog.tsx` | Modal styling per spec                      | Generic modal       | 1.9          |
| RetryIndicator           | `sync/RetryIndicator.tsx`           | Progress styling                            | Generic progress    | 1.10         |

### LOWER PRIORITY - Already Close or Non-Visual

| Component         | File                           | UX Spec Target                | Current State       | Story Origin |
| ----------------- | ------------------------------ | ----------------------------- | ------------------- | ------------ |
| EmptyInbox        | `common/EmptyInbox.tsx`        | Cyan icon, friendly copy      | ✓ Uses cyan-500     | 2.12         |
| EmptySearch       | `common/EmptySearch.tsx`       | Cyan icon, search tips        | ✓ Uses slate colors | 2.12         |
| EmptyFolder       | `common/EmptyFolder.tsx`       | Cyan icon, encouragement      | ✓ Follows pattern   | 2.12         |
| SyncProgress      | `common/SyncProgress.tsx`      | Cyan progress bar             | ✓ Uses cyan-500     | 2.12         |
| OnboardingWelcome | `common/OnboardingWelcome.tsx` | Friendly tone, proper styling | ✓ Good copy         | 2.12         |

### BASE UI COMPONENTS (shadcn/ui - Task 3)

| Component | File            | UX Spec Target                                   | Current State |
| --------- | --------------- | ------------------------------------------------ | ------------- |
| Button    | `ui/button.tsx` | Primary: Cyan bg, white text; Secondary: Gray bg | Blue variants |
| Input     | `ui/input.tsx`  | Border: Slate 300, Focus ring: Cyan              | Blue focus    |
| Badge     | `ui/badge.tsx`  | Success: Green, Warning: Amber                   | Mixed usage   |
| Dialog    | `ui/dialog.tsx` | Modal shadow: `0 8px 24px rgba(0,0,0,0.15)`      | shadow-lg     |
| Card      | `ui/card.tsx`   | Border radius: 8px, subtle shadow                | rounded-lg    |
| Toast     | `ui/toast.tsx`  | Status colors per spec                           | Correct       |

### Story 2-17 Task Mapping (Cross-Reference)

| Component                | Story 2-17 Task | Status             |
| ------------------------ | --------------- | ------------------ |
| **HIGH PRIORITY**        |                 |                    |
| EmailRow                 | Task 4.1-4.7    | ✅ Covered         |
| EmailListItem            | Task 4.1-4.7    | ✅ Covered         |
| ThreadDetailView         | Task 5.1-5.4    | ✅ Covered         |
| ThreadMessage            | Task 5.5        | ✅ Covered         |
| FolderSidebar            | Task 7.1-7.3    | ✅ Covered         |
| CommandPalette           | Task 6.1-6.4    | ✅ Covered         |
| VirtualEmailList         | Task 4.8        | ✅ Covered         |
| **MEDIUM PRIORITY**      |                 |                    |
| ComposeDialog            | Task 9.1        | ✅ Covered         |
| RecipientInput           | Task 9.2        | ✅ Covered         |
| AttachmentPicker         | Task 9.3        | ✅ Covered         |
| SearchInput              | Task 6.5        | ✅ Covered         |
| SearchResults            | Task 6.6        | ✅ Covered         |
| AccountSwitcher          | Task 7.4        | ✅ Covered         |
| AccountList              | Task 7.5        | ✅ Covered         |
| OfflineIndicator         | N/A             | ⚪ Already correct |
| ConflictResolutionDialog | Task 11.1       | ✅ Covered         |
| RetryIndicator           | Task 11.2       | ✅ Covered         |
| **LOWER PRIORITY**       |                 |                    |
| EmptyInbox               | Task 8.1        | ✅ Covered         |
| EmptySearch              | Task 8.2        | ✅ Covered         |
| EmptyFolder              | Task 8.3        | ✅ Covered         |
| SyncProgress             | N/A             | ⚪ Already correct |
| OnboardingWelcome        | N/A             | ⚪ Already correct |
| **BASE UI**              |                 |                    |
| Button                   | Task 3.1        | ✅ Covered         |
| Input                    | Task 3.2        | ✅ Covered         |
| Badge                    | Task 3.3        | ✅ Covered         |
| Dialog                   | Task 3.5        | ✅ Covered         |
| Card                     | Task 3.6        | ✅ Covered         |
| Toast                    | Task 3.4        | ✅ Covered         |

**Coverage Summary:** 28 components total, 25 covered by tasks, 3 already correct. **100% coverage.**

---

## UX Spec Visual Targets (Extracted from Mockups)

### From `ux-design-directions.html`

```css
/* EmailListItem - lines 718-771 */
.email-item {
  padding: 1rem;
  border-left: 2px solid transparent;
  border-left-color: #06b6d4; /* when selected */
  background: #f0fdfa; /* when selected */
}
.email-item:hover {
  background: #f8fafc;
}

/* Confidence Badge */
.confidence-badge {
  background: #10b981;
  color: white;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

/* AI Chip */
.ai-chip {
  background: #ecfeff;
  color: #0891b2;
  border-radius: 3px;
  padding: 0.125rem 0.375rem;
  font-size: 0.625rem;
  font-weight: 600;
}

/* Command Palette - lines 1200-1250 */
.command-palette {
  width: 600px;
  max-height: 400px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.3);
}
.command-palette-backdrop {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}
```

### From `ux-color-themes.html` (Theme 3: Technical Calm)

```css
:root {
  --color-primary: #06b6d4; /* Cyan 500 */
  --color-primary-dark: #0891b2; /* Cyan 600 */
  --color-primary-light: #22d3ee; /* Cyan 400 */
  --color-success: #10b981; /* Green 500 */
  --color-warning: #f59e0b; /* Amber 500 */
  --color-error: #ef4444; /* Red 500 */
  --color-text-primary: #0f172a; /* Slate 900 */
  --color-text-secondary: #64748b; /* Slate 500 */
  --color-background: #f8fafc; /* Slate 50 */
  --color-border: #cbd5e1; /* Slate 300 */
}
```

---

## Components NOT YET BUILT (Future Epics)

From UX Spec Section 6.2 - Required for AI features:

| Component             | UX Spec Section | Description                                  | Target Epic |
| --------------------- | --------------- | -------------------------------------------- | ----------- |
| TrustMeter            | 6.2.2           | Compact pill showing AI trust level          | Epic 3+     |
| ConfidenceBadge       | 6.2.3           | Green/yellow/red pills showing AI confidence | Epic 3      |
| DraftPanel            | 6.2.3           | Cyan-bordered draft display area             | Epic 4      |
| AIReasoningDrawer     | 6.2.4           | "Why?" button drawer explaining AI decisions | Epic 3      |
| PrioritySectionHeader | 6.2.5           | Color-coded priority section labels          | Epic 3      |
| ActionLogEntry        | 6.2.7           | Log entry for autonomous actions             | Epic 6      |
| AutomationRuleCard    | 6.2.6           | Rule builder visual component                | Epic 6      |

---

## Appendix: Files to Update

### Design Tokens (Task 1)

- `tailwind.config.ts` - Add color, spacing, typography tokens
- `src/index.css` - Add Inter font import

### Core Components (Tasks 4-9)

- `src/components/email/EmailRow.tsx`
- `src/components/email/EmailListItem.tsx`
- `src/components/email/ThreadDetailView.tsx`
- `src/components/email/ThreadMessage.tsx`
- `src/components/email/FolderSidebar.tsx`
- `src/components/email/VirtualEmailList.tsx`
- `src/components/search/CommandPalette.tsx`
- `src/components/search/SearchInput.tsx`
- `src/components/search/SearchResults.tsx`
- `src/components/compose/ComposeDialog.tsx`
- `src/components/compose/RecipientInput.tsx`
- `src/components/common/EmptyInbox.tsx`
- `src/components/common/EmptySearch.tsx`
- `src/components/common/EmptyFolder.tsx`
- `src/components/accounts/AccountSwitcher.tsx`

### Base UI Components (Task 3)

- `src/components/ui/button.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/badge.tsx`
- `src/components/ui/dialog.tsx`
- `src/components/ui/card.tsx`
