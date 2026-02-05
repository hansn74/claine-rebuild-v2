# Story 2.17: Apply UX Design System to All Components

Status: ready-for-dev

## Story

As a user,
I want the application to have a polished, professional interface following the UX Design Specification,
so that the experience matches the quality expected of a premium email client.

## Background

The UX Design Specification (`docs/ux-design-specification.md`) was created during Phase 2 but was not integrated into the development workflow. Implementation stories focused on functional requirements without enforcing visual standards. This remediation story applies the design system to all existing components.

### Chosen Design Direction: Hybrid 1+2

From `docs/ux-design-directions.html`, the chosen direction is a **hybrid of Direction 1 (Classic 3-Pane Dense) + Direction 2 (Command Palette First)**:

**Layout (Direction 1):**

- Sidebar: 200px fixed width
- Email List: 400px fixed width
- Thread Panel: 600px flexible
- Email Row: Compact height for density
- Navigation: Sidebar always visible

**Command Palette (Direction 2):**

- Trigger: ⌘K central
- Modal: 600px width, `0 24px 48px rgba(0,0,0,0.3)` shadow
- Backdrop: `bg-black/50` with blur
- Result Icons: 32px with cyan background (#ECFEFF)

### Chosen Color Theme: Theme 3 (Technical Calm)

From `docs/ux-color-themes.html`:

- Primary: `#06B6D4` (Cyan 500)
- Primary Dark: `#0891B2` (Cyan 600)
- Success: `#10B981` (Green 500)
- Warning: `#F59E0B` (Amber 500)
- Error: `#EF4444` (Red 500)
- Neutrals: Slate scale (50-900)

## Acceptance Criteria

1. Color system tokens defined in Tailwind config matching UX spec (Cyan #06B6D4 primary, Slate neutrals)
2. Typography uses Inter Variable font with specified sizes (H1: 24px, Body: 14px, etc.)
3. Spacing follows 4px base, 8px rhythm (xs: 4px, sm: 8px, md: 12px, lg: 16px, xl: 24px)
4. Border radius follows spec (small: 4px, medium: 6px, large: 8px, extra-large: 12px)
5. Shadows follow spec (subtle: `0 1px 3px rgba(0,0,0,0.1)`, modal: `0 8px 24px rgba(0,0,0,0.15)`)
6. All components updated to use design tokens instead of hardcoded values
7. Dark mode palette implemented as specified
8. EmailListItem matches UX spec (48px height, confidence badges, AI chips)
9. ThreadDetailView follows spec layout (thread panel with collapsible sections)
10. CommandPalette styled per spec (overlay with backdrop, type-ahead filtering)
11. All buttons follow primary/secondary/tertiary styling from spec
12. Empty states follow spec patterns (encouragement, friendly tone)

## Tasks / Subtasks

- [ ] Task 1: Setup Design System Tokens (AC: 1, 2, 3, 4, 5, 7)
  - [ ] 1.1 Update `tailwind.config.ts` with color tokens:
    - Primary: `#06B6D4` (Cyan 500), Dark: `#0891B2`, Light: `#22D3EE`
    - Success: `#10B981`, Warning: `#F59E0B`, Error: `#EF4444`
    - Neutral scale: Slate 50-900 as per spec
  - [ ] 1.2 Configure typography in Tailwind:
    - Font family: Inter Variable
    - Type scale: h1 (24px/600), h2 (20px/600), h3 (18px/600), body (14px/400), caption (12px/500)
    - Letter-spacing: -0.02em for headings, -0.01em for body
  - [ ] 1.3 Configure spacing scale:
    - xs: 4px, sm: 8px, md: 12px, lg: 16px, xl: 24px, 2xl: 32px, 3xl: 48px
  - [ ] 1.4 Add border-radius tokens: sm (4px), md (6px), lg (8px), xl (12px)
  - [ ] 1.5 Add shadow tokens: subtle, modal
  - [ ] 1.6 Configure dark mode colors

- [ ] Task 2: Add Inter Variable Font (AC: 2)
  - [ ] 2.1 Install Inter Variable font (via Google Fonts or self-hosted)
  - [ ] 2.2 Configure font-face in CSS
  - [ ] 2.3 Set as default font-family in Tailwind config

- [ ] Task 3: Update Core UI Components (AC: 6, 11)
  - [ ] 3.1 Update `src/components/ui/button.tsx` variants:
    - Primary: Cyan background, white text
    - Secondary: Gray background, dark text
    - Tertiary: Text only, hover underline
  - [ ] 3.2 Update `src/components/ui/input.tsx` styling:
    - Border radius: 6px
    - Border color: Slate 300
    - Focus ring: Cyan
  - [ ] 3.3 Update badge/pill components with spec colors
  - [ ] 3.4 Update toast notifications with spec styling
  - [ ] 3.5 Update dialog/modal styling with spec shadows and radius
  - [ ] 3.6 Update `src/components/ui/card.tsx` border radius (8px) and subtle shadow

- [ ] Task 4: Update EmailListItem Component (AC: 8)
  - [ ] 4.1 Apply 48px compact row height
  - [ ] 4.2 Style confidence badges (green/yellow/red pills)
  - [ ] 4.3 Add AI chip styling ("DRAFT READY", "AI")
  - [ ] 4.4 Apply selected state styling (cyan border left)
  - [ ] 4.5 Apply read/unread text weight difference
  - [ ] 4.6 Add hover background state
  - [ ] 4.7 Update padding: 8px vertical, 12px horizontal
  - [ ] 4.8 Update `VirtualEmailList.tsx` ESTIMATED_ROW_HEIGHT to 48px

- [ ] Task 5: Update ThreadDetailView Component (AC: 9)
  - [ ] 5.1 Apply thread panel layout per spec
  - [ ] 5.2 Style thread messages with proper spacing
  - [ ] 5.3 Add collapsible sections for quoted text
  - [ ] 5.4 Style action buttons per spec
  - [ ] 5.5 Update `ThreadMessage.tsx` styling (cyan border for sent, proper spacing)

- [ ] Task 6: Update CommandPalette Component (AC: 10)
  - [ ] 6.1 Apply modal overlay with backdrop blur
  - [ ] 6.2 Style search input per spec
  - [ ] 6.3 Add keyboard shortcut hints in results
  - [ ] 6.4 Apply category labels (Actions, Navigation, Search)
  - [ ] 6.5 Update `SearchInput.tsx` with cyan focus ring (#06B6D4)
  - [ ] 6.6 Update `SearchResults.tsx` highlighting with cyan

- [ ] Task 7: Update Sidebar/Navigation (AC: 6)
  - [ ] 7.1 Apply 180px fixed width per spec
  - [ ] 7.2 Style navigation items (Inbox, Starred, Sent, etc.)
  - [ ] 7.3 Add priority label styling (color-coded)
  - [ ] 7.4 Style account switcher dropdown
  - [ ] 7.5 Update `AccountList.tsx` card styling per spec

- [ ] Task 8: Update Empty States (AC: 12)
  - [ ] 8.1 Apply spec styling to EmptyInbox component
  - [ ] 8.2 Apply spec styling to EmptySearch component
  - [ ] 8.3 Apply spec styling to EmptyFolder component
  - [ ] 8.4 Add friendly, encouraging tone to copy

- [ ] Task 9: Update Compose Dialog (AC: 6)
  - [ ] 9.1 Apply spec styling to compose form
  - [ ] 9.2 Style recipient input per spec
  - [ ] 9.3 Style attachment area
  - [ ] 9.4 Apply action button styling

- [ ] Task 10: Update Settings Components (AC: 6)
  - [ ] 10.1 Apply card styling per spec
  - [ ] 10.2 Update form inputs
  - [ ] 10.3 Style toggle switches
  - [ ] 10.4 Apply section headers

- [ ] Task 11: Update Sync Components (AC: 6)
  - [ ] 11.1 Update `ConflictResolutionDialog.tsx` modal styling (cyan accents, spec shadow)
  - [ ] 11.2 Update `RetryIndicator.tsx` progress styling (cyan progress bar)

- [ ] Task 12: Visual QA & Consistency Check (AC: 1-12)
  - [ ] 12.1 Review all components for color token usage
  - [ ] 12.2 Verify typography consistency
  - [ ] 12.3 Check spacing consistency
  - [ ] 12.4 Test dark mode
  - [ ] 12.5 Fix any visual inconsistencies

## Dev Notes

### UX Design Specification Reference

All styling decisions should reference `docs/ux-design-specification.md`:

**Color System (Section 3.1):**

- Primary: `#06B6D4` (Cyan 500)
- Semantic: Success `#10B981`, Warning `#F59E0B`, Error `#EF4444`
- Neutrals: Slate scale (50-900)

**Typography (Section 3.2):**

- Font: Inter Variable
- H1: 24px / 600 / -0.02em
- Body: 14px / 400 / -0.01em
- Caption: 12px / 500 / 0em

**Spacing (Section 3.3):**

- Base unit: 4px
- Scale: xs(4), sm(8), md(12), lg(16), xl(24), 2xl(32), 3xl(48)

**Visual Style (Section 3.4):**

- Borders: 1px using Slate 300
- Shadows: `0 1px 3px rgba(0,0,0,0.1)` (subtle)
- Border radius: 4px (small), 6px (medium), 8px (large), 12px (extra-large)

**Custom Components (Section 6.2):**

- EmailListItem: 48px height, confidence badges, AI chips
- CommandPalette: Modal overlay, type-ahead, shortcuts
- TrustMeter: Pill in header, click opens dashboard

### Existing Component Files (Gap Analysis Cross-Reference)

**HIGH PRIORITY - Core Email:**

- `src/components/email/EmailRow.tsx`
- `src/components/email/EmailListItem.tsx`
- `src/components/email/ThreadDetailView.tsx`
- `src/components/email/ThreadMessage.tsx`
- `src/components/email/FolderSidebar.tsx`
- `src/components/email/VirtualEmailList.tsx`
- `src/components/search/CommandPalette.tsx`

**MEDIUM PRIORITY - Secondary UI:**

- `src/components/compose/ComposeDialog.tsx`
- `src/components/compose/RecipientInput.tsx`
- `src/components/compose/AttachmentPicker.tsx`
- `src/components/search/SearchInput.tsx`
- `src/components/search/SearchResults.tsx`
- `src/components/accounts/AccountSwitcher.tsx`
- `src/components/accounts/AccountList.tsx`
- `src/components/sync/ConflictResolutionDialog.tsx`
- `src/components/sync/RetryIndicator.tsx`

**LOWER PRIORITY - Already Close:**

- `src/components/common/EmptyInbox.tsx`
- `src/components/common/EmptySearch.tsx`
- `src/components/common/EmptyFolder.tsx`

**BASE UI (shadcn):**

- `src/components/ui/button.tsx`
- `src/components/ui/input.tsx`
- `src/components/ui/badge.tsx`
- `src/components/ui/dialog.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/toast.tsx`

### Testing Approach

- Visual regression testing with screenshots
- Dark mode toggle testing
- Responsive breakpoint testing
- Component storybook review (if available)

## References

- [Source: docs/ux-design-specification.md] - Complete UX Design Specification
- [Source: docs/ux-design-specification.md#Section 3.1] - Color System
- [Source: docs/ux-design-specification.md#Section 3.2] - Typography System
- [Source: docs/ux-design-specification.md#Section 3.3] - Spacing & Layout
- [Source: docs/ux-design-specification.md#Section 6.2] - Custom Component Specs

## Dev Agent Record

### Context Reference

- `docs/stories/2-17-apply-ux-design-system.context.xml`

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List
