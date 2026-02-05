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

**Story 2.16: Implement Lazy Loading for Email Threads and Large Lists** _(NEW - Gate-Check Medium Priority)_

As a user,
I want the app to load quickly even with large email lists,
So that I can start working immediately without waiting for everything to load.

**Acceptance Criteria:**

**Code Splitting:**

1. Email thread component lazy loaded (separate chunk)
2. Compose component lazy loaded (only loads when user clicks compose)
3. Settings component lazy loaded
4. Attribute management UI lazy loaded

**Virtualized Scrolling (Enhanced):** 5. React-window virtualization extended from Story 2.1 6. Email thread messages virtualized (only visible messages rendered) 7. Large attachment previews lazy loaded on scroll

**Performance Targets:** 8. Initial bundle size <500 KB (as per Epic 0 budget) 9. Email list chunk <200 KB 10. Each lazy-loaded chunk <150 KB 11. Lighthouse performance score >90 12. Time to Interactive (TTI) <3 seconds (NFR004)

**User Experience:** 13. Loading indicators shown for lazy-loaded components 14. Skeleton screens for email thread loading 15. No layout shift when components load

**Testing:** 16. Test: Initial load <3s with 100K emails in database 17. Test: Lighthouse performance score >90 18. Test: Bundle sizes meet budgets 19. Test: Lazy-loaded components load correctly

**Prerequisites:** Story 2.1 (Virtualized Inbox), Epic 0 Story 0.10 (Bundle analysis)

**Estimated Effort:** 4 hours

---

**Story 2.18: Persistent Send Queue with Background Sync API** _(NEW - Correct Course / Superhuman Analysis)_

As a user,
I want my outgoing emails (including attachments) to survive page refresh and tab closure,
So that I never lose an email I've hit send on.

**Context:** Claine's current send queue persists message metadata in RxDB but caches attachment data in memory — closing the tab or refreshing the page loses pending attachments. Superhuman uses the Background Sync API to ensure writes survive tab closure. This is a reliability gap that directly impacts user trust.

**Acceptance Criteria:**

**Attachment Persistence:**

1. Attachment binary data stored in IndexedDB (not in-memory) when email is queued for sending
2. Attachments retrievable after page refresh, tab closure, or browser restart
3. Attachment storage cleaned up after successful send (no orphaned blobs)
4. Storage quota checked before persisting large attachments (warn user if insufficient space)

**Background Sync API Integration:** 5. Register a `sync` event with the service worker for each queued send operation 6. Service worker processes the send queue even after the tab is closed (Chrome/Edge) 7. Fallback for browsers without Background Sync: process queue on next app load 8. User notified on next visit if background send succeeded or failed

**Queue Resilience:** 9. Send queue survives: page refresh, tab closure, browser restart, network loss + recovery 10. Queue items include full payload (recipients, subject, body, attachment references) 11. Duplicate send prevention: each queue item has a unique idempotency key 12. Queue status accurately reflects actual state after app restart

**Testing:** 13. Test: Queue email with 5MB attachment → refresh page → attachment still in queue 14. Test: Queue email → close tab → reopen → email sends successfully 15. Test: Queue email offline → go online → email sends (with and without Background Sync) 16. Test: Duplicate send prevented when queue processes same item twice 17. Test: Storage quota exceeded → user warned before attachment discarded

**Prerequisites:** Story 2.4 (Offline-First Send Queue)

**Estimated Effort:** 6 hours

---

**Story 2.19: Parallel Action Queue Processing** _(NEW - Correct Course / Superhuman Analysis)_

As a user,
I want bulk email actions (archive 50 emails, label 30 emails) to complete quickly,
So that organizing my inbox feels responsive even for large selections.

**Context:** Claine processes action queue items sequentially — each API call waits for the previous one to complete. Superhuman uses 4 parallel PersistWorkers for throughput. For a bulk archive of 50 emails at ~200-500ms per API call, sequential processing takes 10-25 seconds; with 4 concurrent workers it takes 2.5-6 seconds. The complexity is in implementing concurrency at all — once you have it, the parallelism level is just a config value.

**Acceptance Criteria:**

**Concurrent Processing:**

1. Action queue processes up to 4 independent operations concurrently
2. Concurrency level configurable (default: 4, matching Superhuman's proven number)
3. Only independent operations run in parallel (different emails, no ordering dependency)
4. Operations on the same email remain sequential (e.g., archive then label on same thread)

**Dependency Detection:** 5. Queue items tagged with target email/thread ID 6. Items with same target ID processed sequentially (FIFO within same target) 7. Items with different target IDs eligible for parallel processing 8. Dependency logic handles thread-level grouping (all emails in a thread = same target)

**Rate Limit Awareness:** 9. Parallel processing respects existing rate limiter (token bucket) 10. If rate limit approached (>80% utilization), concurrency dynamically reduced 11. Rate limit errors on one worker don't crash other workers

**Error Isolation:** 12. Failure of one parallel operation doesn't block or cancel others 13. Each operation retries independently per existing retry logic (1s, 5s, 30s, 60s) 14. Failed operations tracked individually in queue status

**Testing:** 15. Test: Bulk archive 50 emails → 4 concurrent API calls observed 16. Test: 3 actions on same thread → processed sequentially 17. Test: Rate limit at 80% → concurrency reduced to 2 18. Test: One operation fails → others complete normally 19. Test: Mixed operations (archive A, label B, delete C) → all run in parallel

**Prerequisites:** Story 2.6 (Email Actions)

**Estimated Effort:** 6 hours

---

**Story 2.20: Pre-Render Adjacent Email Thread Views** _(NEW - Correct Course / Superhuman Analysis)_

As a user,
I want navigating between emails (j/k keys) to feel instant,
So that triaging my inbox is fluid and never interrupted by loading.

**Context:** This is Superhuman's signature performance trick. When email #5 is selected, email #6 and #4's thread views are pre-rendered in hidden off-screen containers. When the user presses 'j' to move to the next email, the already-rendered view is swapped into the visible area — the transition takes ~1-2ms (DOM swap) instead of 50-200ms (full render). The perceived difference is dramatic: navigation feels like flipping pages in a book rather than loading content.

**Acceptance Criteria:**

**Pre-Render Engine:**

1. When an email is selected, pre-render the thread view for the next and previous emails in the list
2. Pre-rendered views stored in hidden off-screen containers (not visible, but in DOM)
3. On navigation (j/k, click), swap the pre-rendered container into the visible area
4. After swap, start pre-rendering the new adjacent emails (always stay one ahead/behind)
5. Pre-render triggered after the current email view has fully rendered (don't compete for render time)

**Resource Management:** 6. Maximum 2 pre-rendered views at any time (next + previous) 7. Pre-rendered views discarded when they're more than 2 positions away from current selection 8. Pre-rendering paused when app is in background tab (Page Visibility API) 9. Pre-rendering skipped if device has <4GB RAM (navigator.deviceMemory API, fallback: always pre-render) 10. Thread data fetched from RxDB (already local, no network cost)

**Integration with Existing Navigation:** 11. Works with keyboard navigation (j/k shortcuts from Story 2.11) 12. Works with click navigation (clicking email in list) 13. Works with search results navigation 14. Falls back gracefully to normal rendering if pre-rendered view is unavailable (e.g., user jumps 10 emails ahead)

**Performance Targets:** 15. Navigation between adjacent emails: <5ms perceived transition time 16. Navigation to non-adjacent emails: existing render time (no regression) 17. Memory overhead of 2 pre-rendered views: <10MB additional

**Testing:** 18. Test: Select email → next email's thread view pre-rendered within 500ms 19. Test: Press 'j' → view swaps in <5ms (measure with Performance API) 20. Test: Jump 10 emails ahead → falls back to normal render (no crash) 21. Test: Background tab → pre-rendering paused (no CPU waste) 22. Test: Rapid j/j/j navigation → each swap is instant, pre-render catches up

**Prerequisites:** Story 2.2 (Thread Detail View), Story 2.11 (Keyboard Shortcuts)

**Estimated Effort:** 8 hours

---

**Story 2.21: Replace Lunr.js with MiniSearch for Incremental Indexing** _(NEW - Correct Course / Superhuman Analysis)_

As a user,
I want search to stay fast as my mailbox grows and new emails arrive,
So that I don't experience slowdowns after every sync.

**Context:** Lunr.js requires rebuilding the entire search index when documents change. After a sync adds 50 new emails to a 10K+ mailbox, the full index is rebuilt — this gets progressively slower as the mailbox grows. MiniSearch (~7KB gzipped, fully client-side, works offline) supports incremental `add()`, `remove()`, and `replace()` operations on a live index, plus built-in fuzzy matching and auto-suggest. This is a library swap, not an architecture change.

**Acceptance Criteria:**

**Library Swap:**

1. Replace Lunr.js with MiniSearch in `searchIndexService`
2. Existing search behavior preserved (field boosts: subject:10, from:5, to:2, body:1)
3. Search API surface unchanged for consuming hooks (`useSearch`)
4. Bundle size equal or smaller (MiniSearch ~7KB vs Lunr ~8KB gzipped)

**Incremental Index Updates:** 5. New emails from sync added to index via `add()` without full rebuild 6. Deleted/modified emails updated via `remove()` / `replace()` 7. Index subscribes to RxDB reactive query for email changes 8. Full index rebuild only on first app load or after sync bankruptcy (Story 1.16)

**Fuzzy Matching:** 9. Typo tolerance enabled (e.g., "meetng" matches "meeting") 10. Fuzzy matching configurable: prefix search by default, edit distance of 1 for short terms, 2 for longer terms 11. Fuzzy results ranked below exact matches

**Recent Search History:** 12. Last 20 searches persisted in localStorage 13. Recent searches shown in command palette dropdown when search is empty 14. User can clear search history 15. Clicking a recent search re-executes it

**Testing:** 16. Test: Search results identical to Lunr.js for exact keyword queries (regression) 17. Test: Sync 50 new emails → index updated incrementally (no full rebuild) 18. Test: Typo "recieved" → finds emails with "received" 19. Test: Search performance <100ms at 10K+ emails (NFR target) 20. Test: Recent searches persist across app restart 21. Test: Bundle size ≤ previous Lunr.js size

**Prerequisites:** Story 2.5 (Local Full-Text Search)

**Estimated Effort:** 5 hours

---

**Story 2.22: Search Operators for Structured Queries** _(NEW - Correct Course / Superhuman Analysis)_

As a power user,
I want to use search operators like `from:john` and `has:attachment`,
So that I can precisely filter my search results.

**Context:** Claine's search currently treats all input as plain text keywords. Typing `from:john` searches for the literal string "from:john" in email content. Superhuman and every major email client support structured search operators that map to field-level queries. This is a standard user expectation for email search.

**Acceptance Criteria:**

**Operator Parsing:**

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

**Parser Behavior:** 5. Operators are case-insensitive (`From:` = `from:`) 6. Quoted values supported for multi-word matches (`from:"John Smith"`) 7. Invalid operators treated as regular keywords (no error, graceful fallback) 8. Operator autocomplete in search input (type `from:` → show suggestions from known senders)

**Integration:** 9. Operators work with MiniSearch keyword results (Story 2.21) — operators filter, keywords rank 10. Operator filters applied as post-search filters on MiniSearch results (simple implementation) 11. Active operators shown as removable chips below search input 12. Command palette (Cmd+K) shows operator hint text: "Try from:, to:, has:attachment, before:, after:"

**Testing:** 13. Test: `from:john` → only emails from "john" (partial match) 14. Test: `has:attachment` → only emails with attachments 15. Test: `from:john budget` → emails from john containing "budget" 16. Test: `before:2025-01-01 after:2024-06-01` → date range filter works 17. Test: `FROM:john` → case insensitive, same results as `from:john` 18. Test: `unknownop:value` → treated as keyword search for "unknownop:value" 19. Test: `from:"John Smith"` → matches full name

**Prerequisites:** Story 2.21 (MiniSearch), Story 2.5 (Local Full-Text Search)

**Estimated Effort:** 6 hours

---

**Story 2.23: Keyboard Shortcut Discoverability & Progressive Learning** _(NEW - Correct Course / Superhuman Analysis)_

As a user,
I want to naturally discover keyboard shortcuts while using the app,
So that I gradually become faster without needing to memorize a reference sheet.

**Context:** Superhuman's most effective shortcut adoption mechanism isn't a tutorial — it's showing shortcuts inline on UI elements so users learn passively while clicking. Combined with nudge tooltips after repeated mouse usage and context-aware command palette ranking, users organically transition from mouse to keyboard. Claine has 35+ shortcuts and a comprehensive overlay (? key), but the gap is in passive discoverability during normal use.

**Acceptance Criteria:**

**Inline Shortcut Hints:**

1. All buttons/actions with keyboard shortcuts show the shortcut parenthetically: "Archive (e)", "Reply (r)", "Forward (f)"
2. Hints shown in button text, tooltips, or subtle badge — consistent style across all actions
3. Hints respect current scope (don't show thread shortcuts when in list view)
4. Hints can be hidden via user setting ("Show keyboard hints: on/off")

**Context-Aware Command Palette:** 5. Command palette (Cmd+K) ranks actions by current context:

- In list view: navigation and bulk actions ranked first
- In thread view: reply, forward, archive ranked first
- In compose: formatting and send actions ranked first

6. Recently used commands (last 10) shown in a "Recent" section at top of palette
7. Usage counts tracked per command in localStorage
8. Palette shows shortcut key next to each command entry

**Nudge Tooltips:** 9. Track action execution method (mouse click vs keyboard shortcut) per action type 10. After a user performs the same mouse action 3+ times without using the shortcut, show a one-time tooltip: "Tip: press 'e' to archive faster" 11. Each nudge shown only once per action (don't nag) 12. Nudge dismissed on click or after 5 seconds 13. Nudges disabled if user turns off keyboard hints (AC #4)

**Testing:** 14. Test: Archive button shows "(e)" hint in default state 15. Test: Thread view command palette shows Reply/Forward/Archive at top 16. Test: List view command palette shows navigation actions at top 17. Test: Mouse-archive 3 times → nudge tooltip appears with "e" shortcut 18. Test: Same nudge doesn't appear twice for same action 19. Test: Disable hints setting → all inline hints and nudges hidden

**Prerequisites:** Story 2.11 (Keyboard Shortcuts), Story 2.5 (Command Palette)

**Estimated Effort:** 5 hours

---
