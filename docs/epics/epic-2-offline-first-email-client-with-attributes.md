# Epic 2: Offline-First Email Client with Attributes

## Expanded Goal

Build a performant, fully-functional email client that works flawlessly offline, with virtualized inbox rendering, thread detail views, compose/reply functionality, custom attributes system for structured email organization, attribute-based filtering, and sub-50ms interaction performance. This epic proves the core email client viability AND establishes the v1-proven attributes foundation before adding AI capabilities. Custom attributes provide the structured data layer that AI suggestions and workflows will build upon in later epics.

## Value Delivery

By the end of this epic, users can:
- Read emails with full conversation threading
- Compose and send emails (queued when offline, sent when online)
- Create custom attributes (enum, text, date, boolean types) for domain-specific organization
- Apply attributes manually to emails (e.g., Project=Alpha, Status=To-Do, Priority=High)
- Filter and search emails by attribute combinations
- See attribute tags inline in inbox and thread views
- Search emails locally with instant results
- Archive, delete, and organize emails
- Experience sub-50ms performance for all interactions
- Work fully offline with zero feature loss (attributes work 100% offline)

## Story Breakdown

**Story 2.1: Virtualized Inbox Rendering**

As a user,
I want smooth, fast scrolling through large email lists,
So that I can quickly navigate my inbox without lag.

**Acceptance Criteria:**
1. React-window or tanstack-virtual implemented for inbox list
2. Only visible emails rendered in DOM (20-30 rows buffer)
3. Smooth 60 FPS scrolling with 10,000+ emails loaded
4. Dynamic row heights supported (varying email preview lengths)
5. Scroll position preserved when navigating back to inbox
6. Performance benchmarked: <50ms scroll interaction time

**Prerequisites:** Epic 1 complete (Story 1.7 basic list view)

---

**Story 2.2: Thread Detail View with Conversation History**

As a user,
I want to see full conversation threads,
So that I can understand email context and history.

**Acceptance Criteria:**
1. Thread detail view shows all messages in conversation order
2. Messages grouped by sender/time proximity
3. Quoted text collapsed by default with expand option
4. Attachments displayed with icons and download buttons
5. Inline images rendered (with lazy loading)
6. Email headers accessible (from, to, cc, bcc, date)

**Prerequisites:** Story 2.1

---

**Story 2.3: Compose & Reply Interface**

As a user,
I want to compose new emails and reply to existing ones,
So that I can communicate with others.

**Acceptance Criteria:**
1. Compose button opens new message editor
2. Reply/Reply-all/Forward actions available in thread view
3. Rich text editor implemented (basic formatting: bold, italic, lists)
4. To/Cc/Bcc fields with autocomplete from contacts
5. Subject line auto-populated for replies (Re: prefix)
6. Draft auto-save every 30 seconds to RxDB

**Prerequisites:** Story 2.2

---

**Story 2.4: Offline-First Send Queue**

As a user,
I want to send emails even when offline,
So that I don't have to wait for network connectivity.

**Acceptance Criteria:**
1. Send action queues email locally when offline
2. Optimistic UI shows "Sending..." then "Sent" immediately
3. Background sync sends queued emails when online
4. Failed sends show error notification with retry option
5. Queue status visible in UI (e.g., "3 emails waiting to send")
6. Emails sent in FIFO order when connectivity restored

**Prerequisites:** Story 2.3

---

**Story 2.5: Local Full-Text Search**

As a user,
I want to search my emails instantly,
So that I can find specific messages quickly.

**Acceptance Criteria:**
1. Search input in UI (keyboard shortcut: cmd/ctrl+k)
2. Full-text search across sender, subject, body
3. Results returned in <100ms for 10,000+ email database
4. Search highlights matching terms in results
5. Filters available: date range, sender, has attachment
6. IndexedDB indexes optimized for search performance

**Prerequisites:** Story 2.1, Story 2.2

---

**Story 2.6: Email Actions (Archive, Delete, Mark Read/Unread)**

As a user,
I want to organize my emails with basic actions,
So that I can keep my inbox manageable.

**Acceptance Criteria:**
1. Archive button removes email from inbox (moves to Archive folder)
2. Delete button moves email to Trash (soft delete)
3. Mark as read/unread toggles unread status
4. Keyboard shortcuts implemented (e for archive, # for delete)
5. Bulk actions available (select multiple, apply action)
6. Undo option for destructive actions (5-second toast)

**Prerequisites:** Story 2.2

---

**Story 2.7: Offline Mode Indicators & Conflict Resolution**

As a user,
I want clear indication when I'm offline,
So that I understand when my actions will sync.

**Acceptance Criteria:**
1. Offline indicator displayed in UI (icon in header)
2. Network status detection (online/offline events)
3. Queue status shown for pending actions
4. Conflict resolution for sync using last-write-wins strategy
5. User notified if action failed due to sync conflict
6. Manual sync trigger available in settings

**Prerequisites:** Story 2.4

---

**Story 2.8: Attachment Handling**

As a user,
I want to view and download email attachments,
So that I can access shared files.

**Acceptance Criteria:**
1. Attachments listed in thread view with icons and file sizes
2. Click to download attachment to user's Downloads folder
3. Lazy loading: attachments fetched on-demand, not during initial sync
4. Image attachments show inline preview
5. PDF/document attachments open in system default app
6. Compose interface supports drag-and-drop file attachment

**Prerequisites:** Story 2.2, Story 2.3

---

**Story 2.9: Email Folders & Labels**

As a user,
I want to organize emails with folders or labels,
So that I can categorize my messages.

**Acceptance Criteria:**
1. Sidebar shows standard folders (Inbox, Sent, Drafts, Archive, Trash)
2. Gmail labels synced and displayed
3. Outlook folders synced and displayed
4. User can move emails between folders/labels
5. Unread count displayed per folder
6. Folder selection persists across app restarts

**Prerequisites:** Story 2.6

---

**Story 2.10: Performance Optimization & Benchmarking**

As a developer,
I want comprehensive performance optimization,
So that we meet sub-50ms interaction targets.

**Acceptance Criteria:**
1. Performance benchmarks established for key interactions
2. React.memo and useMemo implemented for expensive components
3. IndexedDB queries optimized with proper indexes
4. Web Workers used for heavy computation (search, parsing)
5. Code splitting implemented for faster initial load
6. Performance monitoring dashboard (development tool)

**Prerequisites:** All Epic 2 stories (integration and optimization)

---

**Story 2.11: Keyboard Shortcuts & Power User Features**

As a power user,
I want comprehensive keyboard shortcuts,
So that I can navigate efficiently without mouse.

**Acceptance Criteria:**
1. Shortcut cheat sheet accessible (? key)
2. Navigation: j/k (up/down), enter (open), esc (back)
3. Actions: e (archive), # (delete), r (reply), f (forward)
4. Command palette (cmd/ctrl+k) for all actions
5. Vim-style navigation optional (configurable in settings)
6. Search: / to focus search, cmd/ctrl+f for in-email search

**Prerequisites:** Story 2.6, Story 2.5

---

**Story 2.12: Empty States & Onboarding UX**

As a new user,
I want clear guidance when getting started,
So that I understand how to use Claine.

**Acceptance Criteria:**
1. Welcome screen on first launch with "Connect Email" CTA
2. Empty inbox state: "You're all caught up" with calm affirmation
3. Empty search results: Helpful message with search tips
4. Loading states: Progress indicators with estimated time
5. Error states: Clear messages with actionable next steps
6. Tooltips for first-time interactions (dismissible)

**Prerequisites:** All Epic 2 core stories

---

**Story 2.13: Custom Attributes System - Data Model & CRUD**

As a power user,
I want to create and manage custom attributes for email organization,
So that I can structure my emails according to my domain-specific needs.

**Acceptance Criteria:**
1. RxDB schema extended with attributes collection (name, type, values, display settings)
2. Attributes types supported: enum (fixed value list), text (free form), date (picker), boolean (yes/no), number
3. Settings UI for attribute management: Create, Read, Update, Delete attributes
4. Built-in attribute presets available: Status (To-Do/In-Progress/Waiting/Done), Priority (High/Medium/Low), Context (Work/Personal/Projects)
5. User can enable/disable built-in presets
6. Validation: duplicate attribute names prevented, enum values validated
7. Attributes persist in RxDB and sync across app restarts

**Prerequisites:** Story 2.9 (Folders & Labels), Story 1.3 (RxDB)

---

**Story 2.14: Apply Attributes to Emails - UI & Interaction**

As a user,
I want to manually apply attributes to emails,
So that I can organize and categorize my messages.

**Acceptance Criteria:**
1. Attribute panel accessible from thread detail view (sidebar or dropdown)
2. User can select/apply multiple attributes to a single email
3. Enum attributes show dropdown with values
4. Text attributes show input field
5. Date attributes show date picker
6. Boolean attributes show checkbox
7. Attribute changes saved immediately to RxDB (email-attributes junction table)
8. Attribute tags displayed inline in inbox list (colored badges/pills)
9. Attribute tags displayed in thread detail view
10. User can remove attributes (click X on tag)

**Prerequisites:** Story 2.13

---

**Story 2.15: Attribute-Based Filtering & Search**

As a user,
I want to filter and search emails by attributes,
So that I can quickly find emails matching specific criteria.

**Acceptance Criteria:**
1. Filter panel in sidebar showing all available attributes
2. User can select attribute filters (e.g., Status=To-Do, Priority=High)
3. Multiple filters combined with AND logic (e.g., Status=To-Do AND Priority=High)
4. Filtered results update instantly (<100ms)
5. Active filters shown as chips with clear/remove option
6. Filter state persists during session (cleared on app restart unless saved)
7. Search enhanced to include attribute values (e.g., search "Project:Alpha" finds emails with Project=Alpha)
8. RxDB indexes optimized for attribute queries
9. Empty state when no emails match filters: "No emails found with these criteria"

**Prerequisites:** Story 2.14, Story 2.5 (Search)

**Estimated Effort:** 6 hours

---

**Story 2.16: Implement Lazy Loading for Email Threads and Large Lists** *(NEW - Gate-Check Medium Priority)*

As a user,
I want the app to load quickly even with large email lists,
So that I can start working immediately without waiting for everything to load.

**Acceptance Criteria:**

**Code Splitting:**
1. Email thread component lazy loaded (separate chunk)
2. Compose component lazy loaded (only loads when user clicks compose)
3. Settings component lazy loaded
4. Attribute management UI lazy loaded

**Virtualized Scrolling (Enhanced):**
5. React-window virtualization extended from Story 2.1
6. Email thread messages virtualized (only visible messages rendered)
7. Large attachment previews lazy loaded on scroll

**Performance Targets:**
8. Initial bundle size <500 KB (as per Epic 0 budget)
9. Email list chunk <200 KB
10. Each lazy-loaded chunk <150 KB
11. Lighthouse performance score >90
12. Time to Interactive (TTI) <3 seconds (NFR004)

**User Experience:**
13. Loading indicators shown for lazy-loaded components
14. Skeleton screens for email thread loading
15. No layout shift when components load

**Testing:**
16. Test: Initial load <3s with 100K emails in database
17. Test: Lighthouse performance score >90
18. Test: Bundle sizes meet budgets
19. Test: Lazy-loaded components load correctly

**Prerequisites:** Story 2.1 (Virtualized Inbox), Epic 0 Story 0.10 (Bundle analysis)

**Estimated Effort:** 4 hours

---
