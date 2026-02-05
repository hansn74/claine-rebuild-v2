# Claine v1 → v2 Feature Parity Analysis

_Created: 2025-10-30_
_Purpose: Map existing v1 features to v2 PRD to ensure feature parity and identify gaps_

---

## Executive Summary

This document compares Claine v1 (existing codebase) with Claine v2 (planned PRD) to:

1. Identify features to **carry forward** from v1 to v2
2. Identify features to **deprecate** (not needed in v2)
3. Identify **new features** in v2 not present in v1
4. Create implementation priority for v2 development

---

## Feature Parity Matrix

Legend:

- ✅ **Keep & Enhance** - Feature exists in v1, enhance in v2
- 🆕 **New in v2** - Feature not in v1, new in v2
- ⚠️ **Partial** - Feature partially exists in v1, needs completion in v2
- ❌ **Deprecate** - Feature in v1 but not needed in v2
- 🔄 **Rethink** - Feature in v1 but needs major redesign for v2

---

## 1. EMAIL MANAGEMENT CORE

### Thread & Message Operations

| Feature                          | v1 Status                 | v2 Status         | Priority | Notes                             |
| -------------------------------- | ------------------------- | ----------------- | -------- | --------------------------------- |
| View threads in list             | ✅ Exists                 | ✅ Keep & Enhance | P0       | Enhance with AI priority sections |
| Thread detail view               | ✅ Exists                 | ✅ Keep & Enhance | P0       | Add AI draft panel                |
| Mark as read/unread              | ✅ Exists                 | ✅ Keep           | P0       | Core functionality                |
| Archive thread                   | ✅ Exists                 | ✅ Keep & Enhance | P0       | Add AI auto-archive               |
| Delete/trash thread              | ✅ Exists                 | ✅ Keep           | P1       | Core functionality                |
| Unarchive thread                 | ✅ Exists                 | ✅ Keep           | P1       | Core functionality                |
| View email body (HTML/text)      | ✅ Exists                 | ✅ Keep           | P0       | Core functionality                |
| View attachments                 | ✅ Exists                 | ✅ Keep           | P1       | Core functionality                |
| Download attachments             | ✅ Exists                 | ✅ Keep           | P1       | Core functionality                |
| Multi-select threads             | ⚠️ Code exists, not in UI | ✅ Complete in v2 | P1       | X key selection                   |
| Bulk operations (archive/delete) | ⚠️ Code exists            | ✅ Complete in v2 | P1       | Batch archive/delete              |
| **Reply to email**               | ❌ Not implemented        | 🆕 New in v2      | P0       | **AI-generated drafts**           |
| **Compose new email**            | ❌ Not implemented        | 🆕 New in v2      | P1       | New feature                       |
| **Forward email**                | ❌ Not implemented        | 🆕 New in v2      | P1       | New feature                       |
| **Send email**                   | ❌ Not implemented        | 🆕 New in v2      | P0       | **Critical for v2**               |
| Star/flag emails                 | ⚠️ Not shown              | ✅ Keep           | P1       | S key shortcut                    |
| Undo actions                     | ⚠️ Archive undo only      | ✅ Enhance        | P1       | 30-day undo for all actions       |

**Key Insight:** v1 focused on **reading** emails, v2 adds **writing/sending** with AI assistance.

---

### Label Management

| Feature                                        | v1 Status        | v2 Status    | Priority | Notes                   |
| ---------------------------------------------- | ---------------- | ------------ | -------- | ----------------------- |
| View labels in sidebar                         | ✅ Exists        | ✅ Keep      | P0       | Core navigation         |
| Filter by label                                | ✅ Exists        | ✅ Keep      | P0       | Core navigation         |
| Label counts (unread/total)                    | ✅ Exists        | ✅ Keep      | P0       | Real-time counts        |
| Apply labels to threads                        | ✅ Exists        | ✅ Keep      | P1       | Add/remove labels       |
| Label sync from Gmail                          | ✅ Exists        | ✅ Keep      | P0       | Essential               |
| Create custom labels                           | ✅ Via Gmail API | ✅ Keep      | P2       | Via Gmail API           |
| **Priority labels** (Urgent/Important)         | ❌ Not in v1     | 🆕 New in v2 | P0       | **AI-powered priority** |
| **Section headers** (Urgent/Important/Updates) | ❌ Not in v1     | 🆕 New in v2 | P0       | **Core v2 UX**          |

**Key Insight:** v2 adds **AI-powered priority labeling** on top of Gmail labels.

---

## 2. SEARCH & FILTERING

| Feature                      | v1 Status           | v2 Status         | Priority | Notes                           |
| ---------------------------- | ------------------- | ----------------- | -------- | ------------------------------- |
| Full-text search             | ✅ Exists           | ✅ Keep & Enhance | P0       | Enhance with AI semantic search |
| Search debouncing            | ✅ Exists (300ms)   | ✅ Keep           | P0       | Performance optimization        |
| Clear search                 | ✅ Exists           | ✅ Keep           | P0       | UX improvement                  |
| Status filters (read/unread) | ✅ Exists           | ✅ Keep           | P1       | Standard filter                 |
| Attachment filters           | ✅ Exists           | ✅ Keep           | P2       | Nice to have                    |
| **Attribute-based filters**  | ✅ Exists (GTD)     | ✅ Keep & Enhance | P1       | **Keep + add AI suggestions**   |
| **Smart filters**            | ✅ Exists (complex) | ✅ Keep & Enhance | P1       | **Enhance with AI**             |
| Combined filters             | ✅ Exists           | ✅ Keep & Enhance | P2       | Keep for power users            |
| Filter badges                | ✅ Exists           | ✅ Keep           | P2       | Visual indicator                |
| **Command palette search**   | ❌ Not in v1        | 🆕 New in v2      | P0       | **⌘K universal search**         |
| **AI semantic search**       | ❌ Not in v1        | 🆕 New in v2      | P1       | AI-powered search               |

**Key Insight:** v1 had manual filters and attributes, v2 enhances with **AI suggestions + user control + ⌘K palette**.

---

## 3. SYNCHRONIZATION & OFFLINE

| Feature                          | v1 Status            | v2 Status         | Priority | Notes                              |
| -------------------------------- | -------------------- | ----------------- | -------- | ---------------------------------- |
| Full sync from Gmail             | ✅ Exists            | ✅ Keep           | P0       | Initial sync                       |
| Incremental sync (History API)   | ✅ Exists            | ✅ Keep & Enhance | P0       | 90% API reduction                  |
| Background sync                  | ✅ Exists            | ✅ Keep           | P0       | Auto-sync intervals                |
| Sync progress tracking           | ✅ Exists            | ✅ Keep           | P0       | Visual progress                    |
| Sync status indicators           | ✅ Exists            | ✅ Keep           | P0       | UX feedback                        |
| Sync queue management            | ✅ Exists            | ✅ Keep           | P0       | Pending operations                 |
| Sync error handling              | ✅ Exists            | ✅ Keep           | P0       | Retry logic                        |
| Batch processing                 | ✅ Exists (30/batch) | ✅ Keep           | P0       | Performance                        |
| Offline reading                  | ✅ Exists (RxDB)     | ✅ Keep & Enhance | P0       | Core offline-first                 |
| Offline operations queue         | ✅ Exists            | ✅ Keep           | P0       | Queue for sync                     |
| Conflict resolution              | ⚠️ Basic             | ✅ Enhance        | P1       | Improve conflict handling          |
| **30-second wow** (sync + AI)    | ❌ Not in v1         | 🆕 New in v2      | P0       | **Show AI value before full sync** |
| **Local AI processing**          | ❌ Not in v1         | 🆕 New in v2      | P0       | **Core v2 differentiator**         |
| **Trust meter** (local vs cloud) | ❌ Not in v1         | 🆕 New in v2      | P0       | **Privacy transparency**           |

**Key Insight:** v1 had solid sync infrastructure, v2 adds **local AI processing + privacy transparency**.

---

## 4. WORKFLOW & AUTOMATION

### Workflow Engine & Automation

| Feature                             | v1 Status            | v2 Status             | Priority | Notes                             |
| ----------------------------------- | -------------------- | --------------------- | -------- | --------------------------------- |
| Visual workflow editor              | ✅ Exists            | ✅ **Keep & Enhance** | P1       | Add AI-suggested workflows        |
| Screen flows                        | ✅ Exists            | ✅ **Keep**           | P1       | Complex process automation        |
| Workflow node types                 | ✅ Exists            | ✅ **Keep & Enhance** | P1       | Add AI decision nodes             |
| Workflow variables                  | ✅ Exists            | ✅ **Keep**           | P1       | Essential for automation          |
| Action nodes (archive/delete/label) | ✅ Exists            | ✅ **Keep & Enhance** | P1       | Add AI actions                    |
| Decision nodes (branching)          | ✅ Exists            | ✅ **Keep & Enhance** | P1       | Add AI-powered conditions         |
| Workflow activation/management      | ✅ Exists            | ✅ **Keep**           | P1       | Enable/disable workflows          |
| GTD workflow template               | ✅ Exists            | ⚠️ **Keep as preset** | P2       | Keep as optional template         |
| Status attributes (To Do/Done)      | ✅ Exists            | ✅ **Keep & Enhance** | P1       | AI suggests, user confirms        |
| Priority attributes (High/Med/Low)  | ✅ Exists            | ✅ **Keep & Enhance** | P1       | AI suggests, user overrides       |
| Context/Zone attributes             | ✅ Exists            | ✅ **Keep & Enhance** | P2       | Support custom contexts           |
| Custom attributes system            | ✅ Exists            | ✅ **Keep & Enhance** | P1       | AI learns patterns                |
| **AI-suggested workflow templates** | ❌ Not in v1         | 🆕 New in v2          | P1       | AI analyzes patterns, suggests    |
| **AI decision nodes**               | ❌ Not in v1         | 🆕 New in v2          | P1       | AI-powered workflow decisions     |
| **Hybrid workflows** (AI + rules)   | ❌ Not in v1         | 🆕 New in v2          | P1       | AI suggests, user confirms        |
| **Smart triggers**                  | ❌ Not in v1         | 🆕 New in v2          | P2       | AI detects when to run            |
| **AI autonomous actions**           | ❌ Not in v1         | 🆕 New in v2          | P0       | **AI acts without workflow**      |
| **AI draft generation**             | ❌ Not in v1         | 🆕 New in v2          | P0       | **Core v2 feature**               |
| **AI reasoning/explainability**     | ❌ Not in v1         | 🆕 New in v2          | P0       | **Trust building**                |
| **AI attribute suggestions**        | ❌ Not in v1         | 🆕 New in v2          | P0       | **AI suggests attributes**        |
| **Action log with undo**            | ⚠️ Activity log only | ✅ Enhance            | P0       | Track all actions (AI + workflow) |

**Key Insight:** v1 had **manual workflows + attributes**, v2 adds **AI suggestions** while keeping **user control**.

**Decision:**

- ✅ **Keep workflow engine** - valuable for user control, complex processes, deterministic automation
- ✅ **Keep attributes system** - user control, trust, deterministic workflows, custom taxonomies
- 🆕 **Add AI suggestions** - AI suggests attributes, workflows, priorities (user confirms/overrides)
- 🆕 **Hybrid approach** - AI efficiency + user control = best of both worlds
- 🆕 **Add AI autonomous mode** - AI can act independently (no workflow needed) for common tasks

---

## 5. ACTIVITY LOGGING & ANALYTICS

| Feature                         | v1 Status       | v2 Status         | Priority | Notes                     |
| ------------------------------- | --------------- | ----------------- | -------- | ------------------------- |
| Log thread actions              | ✅ Exists       | ✅ Keep           | P1       | Archive/delete tracking   |
| Log label modifications         | ✅ Exists       | ✅ Keep           | P1       | Label change tracking     |
| Log attribute changes           | ✅ Exists       | ✅ Keep & Enhance | P1       | Track AI + manual changes |
| Activity metadata               | ✅ Exists       | ✅ Keep           | P1       | Context tracking          |
| Timestamp tracking              | ✅ Exists       | ✅ Keep           | P1       | Audit trail               |
| View activity history           | ✅ Exists       | ✅ Keep           | P2       | Activity viewer           |
| Filter activities               | ✅ Exists       | ✅ Keep           | P2       | Query capabilities        |
| Activity statistics             | ✅ Exists       | ✅ Keep           | P2       | Analytics                 |
| **AI action logging**           | ❌ Not in v1    | 🆕 New in v2      | P0       | **Log AI decisions**      |
| **AI reasoning audit trail**    | ❌ Not in v1    | 🆕 New in v2      | P0       | **Why AI did X**          |
| **30-day undo for all actions** | ⚠️ Archive only | ✅ Enhance        | P0       | Expand undo scope         |

**Key Insight:** v1 had basic activity logging, v2 enhances for **AI transparency and auditability**.

---

## 6. AUTHENTICATION & SETTINGS

| Feature                    | v1 Status    | v2 Status    | Priority | Notes                     |
| -------------------------- | ------------ | ------------ | -------- | ------------------------- |
| OAuth2 Gmail login         | ✅ Exists    | ✅ Keep      | P0       | Essential                 |
| Google Identity Services   | ✅ Exists    | ✅ Keep      | P0       | Modern OAuth              |
| Access token management    | ✅ Exists    | ✅ Keep      | P0       | Token refresh             |
| User email detection       | ✅ Exists    | ✅ Keep      | P0       | Show authenticated user   |
| Session management         | ✅ Exists    | ✅ Keep      | P0       | Auth state                |
| Logout functionality       | ✅ Exists    | ✅ Keep      | P0       | Clear auth                |
| Dark mode toggle           | ✅ Exists    | ✅ Keep      | P0       | Light/dark themes         |
| Theme persistence          | ✅ Exists    | ✅ Keep      | P0       | Remember preference       |
| Database clear             | ✅ Exists    | ✅ Keep      | P2       | Reset functionality       |
| **Multi-account support**  | ❌ Not in v1 | 🆕 New in v2 | P2       | Phase 2 feature           |
| **AI settings**            | ❌ Not in v1 | 🆕 New in v2 | P0       | **Configure AI behavior** |
| **Privacy dashboard**      | ❌ Not in v1 | 🆕 New in v2 | P0       | **Trust meter details**   |
| **Permissions management** | ❌ Not in v1 | 🆕 New in v2 | P0       | **Control AI scope**      |

**Key Insight:** v1 had basic auth/settings, v2 adds **AI configuration + privacy controls**.

---

## 7. DATABASE & PERSISTENCE

| Feature                          | v1 Status    | v2 Status    | Priority | Notes                     |
| -------------------------------- | ------------ | ------------ | -------- | ------------------------- |
| RxDB reactive database           | ✅ Exists    | ✅ Keep      | P0       | Core architecture         |
| Local persistence (browser)      | ✅ Exists    | ✅ Keep      | P0       | Offline-first             |
| Threads/messages/labels models   | ✅ Exists    | ✅ Keep      | P0       | Core data models          |
| Full-text search indexing        | ✅ Exists    | ✅ Keep      | P0       | Search performance        |
| Database schema versioning       | ✅ Exists    | ✅ Keep      | P0       | Migrations                |
| Database migrations              | ✅ Exists    | ✅ Keep      | P0       | Schema updates            |
| **AI state storage**             | ❌ Not in v1 | 🆕 New in v2 | P0       | **Store AI models/cache** |
| **Draft storage**                | ❌ Not in v1 | 🆕 New in v2 | P0       | **AI-generated drafts**   |
| **Action queue storage**         | ⚠️ Partial   | ✅ Enhance   | P0       | Autonomous action queue   |
| **Settings/preferences storage** | ⚠️ Minimal   | ✅ Enhance   | P0       | AI settings storage       |

**Key Insight:** v1 had solid database foundation, v2 adds **AI-specific data models**.

---

## 8. UI COMPONENTS & UX

| Feature                            | v1 Status     | v2 Status         | Priority | Notes                        |
| ---------------------------------- | ------------- | ----------------- | -------- | ---------------------------- |
| Three-pane layout                  | ✅ Exists     | ✅ Keep           | P0       | Sidebar + List + Detail      |
| Sidebar label navigation           | ✅ Exists     | ✅ Keep           | P0       | Core navigation              |
| Thread list view                   | ✅ Exists     | ✅ Keep & Enhance | P0       | Add AI badges                |
| Thread detail view                 | ✅ Exists     | ✅ Keep & Enhance | P0       | Add draft panel              |
| Responsive design                  | ✅ Exists     | ✅ Keep           | P0       | Desktop-first                |
| Sticky headers                     | ✅ Exists     | ✅ Keep           | P1       | UX improvement               |
| Avatar display                     | ✅ Exists     | ✅ Keep           | P1       | Sender avatars               |
| Back navigation                    | ✅ Exists     | ✅ Keep           | P0       | Core navigation              |
| Status indicators                  | ✅ Exists     | ✅ Keep           | P0       | Read/unread                  |
| Loading states                     | ✅ Exists     | ✅ Keep           | P0       | Progress feedback            |
| Empty states                       | ✅ Exists     | ✅ Keep           | P0       | No results feedback          |
| Badge indicators                   | ✅ Exists     | ✅ Keep           | P0       | Unread counts                |
| **Command palette (⌘K)**           | ❌ Not in v1  | 🆕 New in v2      | P0       | **Universal launcher**       |
| **Priority section headers**       | ❌ Not in v1  | 🆕 New in v2      | P0       | **Urgent/Important/Updates** |
| **AI draft panel**                 | ❌ Not in v1  | 🆕 New in v2      | P0       | **Show AI drafts**           |
| **AI reasoning drawer**            | ❌ Not in v1  | 🆕 New in v2      | P0       | **"Why?" explanation**       |
| **Trust meter widget**             | ❌ Not in v1  | 🆕 New in v2      | P0       | **Privacy indicator**        |
| **Confidence badges**              | ❌ Not in v1  | 🆕 New in v2      | P0       | **🟢🟡🔴 AI confidence**     |
| **Keyboard shortcuts (J/K/E/R/S)** | ⚠️ Some exist | ✅ Enhance        | P0       | Full keyboard coverage       |
| **Frameless window**               | ❌ Not in v1  | 🆕 New in v2      | P1       | Minimal chrome               |

**Key Insight:** v1 had solid email UI, v2 adds **AI-specific UI components + keyboard-first UX**.

---

## 9. PERFORMANCE & OPTIMIZATION

| Feature                    | v1 Status    | v2 Status    | Priority | Notes                   |
| -------------------------- | ------------ | ------------ | -------- | ----------------------- |
| Labels cache               | ✅ Exists    | ✅ Keep      | P0       | Performance             |
| Thread caching             | ✅ Exists    | ✅ Keep      | P0       | Performance             |
| Rate limiting (Gmail API)  | ✅ Exists    | ✅ Keep      | P0       | API limits              |
| Batch processing           | ✅ Exists    | ✅ Keep      | P0       | API efficiency          |
| Deduplication              | ✅ Exists    | ✅ Keep      | P0       | Avoid duplicates        |
| Progressive loading        | ✅ Exists    | ✅ Keep      | P0       | UX performance          |
| Intersection observer      | ✅ Exists    | ✅ Keep      | P1       | Lazy loading            |
| Sync performance logging   | ✅ Exists    | ✅ Keep      | P1       | Monitoring              |
| **Virtualized scrolling**  | ❌ Not in v1 | 🆕 New in v2 | P0       | **10,000+ email lists** |
| **Sub-50ms interactions**  | ❌ Not in v1 | 🆕 New in v2 | P0       | **NFR009 requirement**  |
| **Optimistic UI**          | ⚠️ Partial   | ✅ Enhance   | P0       | Instant feedback        |
| **Local AI model caching** | ❌ Not in v1 | 🆕 New in v2 | P0       | **AI performance**      |

**Key Insight:** v1 had good performance, v2 targets **sub-50ms + AI optimization**.

---

## FEATURE ENHANCEMENT SUMMARY

### Features to **KEEP & ENHANCE** from v1

✅ **Workflow Engine (Keep & Enhance with AI)**

- Visual workflow editor - **KEEP** (users want control)
- Screen flows - **KEEP** (complex business processes need this)
- Workflow node types - **KEEP & ENHANCE** (add AI decision nodes)
- Workflow variables system - **KEEP** (essential for complex workflows)
- Action nodes (archive/delete/label) - **KEEP & ENHANCE** (add AI-suggested actions)

✅ **Attributes System (Keep & Enhance with AI)**

- Custom attributes system - **KEEP & ENHANCE** (AI learns patterns, suggests values)
- Status attributes - **KEEP & ENHANCE** (AI suggests, user confirms/overrides)
- Priority attributes - **KEEP & ENHANCE** (AI suggests, user has final say)
- Context/Zone attributes - **KEEP** (custom taxonomies for domain-specific needs)
- Attribute types - **KEEP** (enum/text/date/boolean for structured data)
- Attribute-based filtering - **KEEP & ENHANCE** (combine with AI smart filters)
- GTD workflow template - **KEEP as optional preset** (not forced on users)

**New in v2: Hybrid AI + Manual Control**

- 🆕 AI attribute suggestions (AI analyzes email, suggests attribute values)
- 🆕 User confirmation/override (AI suggests, user decides)
- 🆕 AI learning from user patterns (AI learns user preferences over time)
- 🆕 Bulk attribute operations with AI (AI suggests, user bulk-applies)
- 🆕 AI-suggested workflow templates (AI analyzes patterns, suggests workflows)
- 🆕 AI decision nodes (AI-powered branching in workflows)
- 🆕 Hybrid workflows (AI + rule-based conditions)
- 🆕 Smart triggers (AI detects when to run workflows)

**Rationale:**

1. **User Control & Trust** - Manual attributes provide explicit control, building trust
2. **Deterministic Workflows** - Workflows need reliable data; attributes provide guaranteed structure
3. **Custom Taxonomies** - Domain-specific needs (Project Alpha, Legal-Hold, Q4-Budget)
4. **Power Users** - Advanced users with existing workflows retain full functionality
5. **Hybrid Efficiency** - AI handles 80% routine work, attributes for 20% precision needs
6. **Offline Reliability** - Attributes work 100% offline; AI may need cloud

**Example Use Cases:**

**Workflows:**

- Business processes: "When client email arrives, create task, add to CRM, notify team"
- Complex rules: "If email from VIP + has attachment + mentions 'urgent' → escalate"
- Integration workflows: "Archive newsletters but extract interesting links to reading list"

**Hybrid AI + Attributes:**

- AI: "This email looks Urgent with Priority=High" → User: Confirms or changes to Medium
- User creates custom attribute "Project-Alpha" → AI learns pattern, suggests on similar emails
- Workflow depends on attribute Status=To-Do → AI suggests the status, user confirms
- Bulk operation: AI suggests Priority=High for 20 emails → User reviews, applies to 18

**Net Result:**

- Keep ~100% of workflow code (core engine + editor)
- Keep ~100% of attributes code (enhance with AI integration)
- AI suggests, user controls (trust + efficiency)
- Casual users: AI automates 80% of categorization
- Power users: Full control via attributes + workflows + AI suggestions
- Best of both worlds: AI autonomy + user override capability

---

## HYBRID AI + ATTRIBUTES INTEGRATION

### How AI and Attributes Work Together in v2

**Core Philosophy:** AI provides **efficiency**, Attributes provide **control**, together they provide **trust**.

### Integration Model

```
Email Arrives
    ↓
AI Analyzes Email
    ↓
AI Suggests Attributes:
  - Priority: High (🟢 95% confidence)
  - Status: To Do
  - Context: Work
    ↓
User Reviews Suggestion:
  ✅ Accept all
  ✅ Accept Priority, change Status to "Waiting"
  ✅ Reject all, set manually
    ↓
Attributes Applied to Email
    ↓
Workflows Execute Using Reliable Attribute Data
    ↓
AI Learns from User's Choice
```

### Key Features

**1. AI Attribute Suggestions**

- AI analyzes email content, sender, thread history
- Suggests attribute values with confidence scores
- Shows reasoning: "Priority=High because deadline mentioned"
- User reviews and confirms/overrides

**2. User Override & Control**

- One-click accept/reject
- Edit AI suggestion before applying
- Bulk operations: "AI suggests High for 20 emails" → review → apply to 18
- Full manual control always available

**3. AI Pattern Learning**

- AI tracks user corrections: "User always changes Priority from High to Medium for newsletters"
- AI adapts suggestions based on user behavior
- Learns custom attribute patterns: "Emails from john@acme.com always get Project-Alpha"
- Improves over time, becoming more accurate

**4. Deterministic Workflows**

- Workflows depend on attributes (not AI predictions)
- Attributes provide guaranteed data structure
- Once applied, attribute values are stable (don't change unless user edits)
- Workflows execute reliably, offline-capable

**5. Transparency & Trust**

- Show AI confidence: 🟢 High (95%), 🟡 Medium (70%), 🔴 Low (40%)
- Show AI reasoning: "Why?" drawer explains suggestion
- Track AI vs manual: Activity log shows "AI suggested, user confirmed"
- Users always in control

### Example User Flows

**Flow 1: Casual User (AI Efficiency)**

1. Email arrives
2. AI suggests Priority=High, Status=To-Do
3. User clicks "Accept" (1 click)
4. Attributes applied
5. Workflows execute automatically

**Flow 2: Power User (User Control)**

1. Email arrives
2. AI suggests Priority=High, Status=To-Do
3. User reviews, changes to Priority=Medium
4. User adds custom attribute Project=Alpha
5. Attributes applied
6. AI learns: next time suggests Medium for similar emails

**Flow 3: Bulk Operations**

1. 50 new emails arrive
2. AI processes all, suggests attributes
3. User opens "AI Suggestions" panel
4. Reviews AI suggestions in bulk:
   - Accept 40 suggestions as-is
   - Override 8 suggestions
   - Skip 2 (set manually later)
5. Bulk apply
6. AI learns from all 50 decisions

**Flow 4: Custom Taxonomy**

1. User creates custom attribute "Legal-Hold" (boolean)
2. Manually applies to 10 emails from law firm
3. AI learns pattern: "Emails from \*@lawfirm.com likely need Legal-Hold"
4. Future emails from law firm → AI suggests Legal-Hold=true
5. User confirms → AI gets better at detecting legal emails

### Benefits

**For Casual Users:**

- AI handles 80% of categorization automatically
- One-click accept for most emails
- Don't need to understand GTD or create workflows
- Still benefit from structured organization

**For Power Users:**

- Full control via manual attributes
- Custom attributes for domain-specific needs
- Deterministic workflows using reliable attribute data
- AI speeds up routine work, user handles edge cases

**For Everyone:**

- Trust: User always has final say
- Offline: Attributes work 100% offline
- Transparency: AI explains its reasoning
- Learning: AI gets better over time

### Technical Implementation

**Database Schema:**

```typescript
interface AttributeSuggestion {
  id: string
  emailId: string
  attributeName: string
  suggestedValue: any
  confidence: number // 0-100
  reasoning: string
  status: 'pending' | 'accepted' | 'rejected' | 'modified'
  appliedAt?: timestamp
}

interface EmailAttribute {
  emailId: string
  attributeName: string
  value: any
  source: 'ai_suggested' | 'ai_accepted' | 'user_manual' | 'workflow'
  confidence?: number // if AI-suggested
  appliedAt: timestamp
  appliedBy: 'ai' | 'user' | 'workflow'
}
```

**AI Learning Database:**

```typescript
interface AILearningEvent {
  id: string
  emailId: string
  aiSuggestion: AttributeSuggestion
  userAction: 'accepted' | 'rejected' | 'modified'
  userValue?: any // if modified
  features: {
    sender: string
    subject: string
    labels: string[]
    hasAttachment: boolean
    // ... other email features
  }
  timestamp: timestamp
}
```

---

## NEW FEATURES IN v2 (Not in v1)

### Critical New Features (P0)

🆕 **AI Core Features:**

- AI draft generation (automatic reply suggestions)
- AI reasoning/explainability ("Why?" drawer)
- AI autonomous actions (auto-archive, auto-prioritize)
- AI attribute suggestions (suggest + user confirms)
- AI pattern learning (learns from user corrections)
- AI action log with undo
- Local AI processing (privacy-first)
- AI confidence badges (🟢🟡🔴)

🆕 **Sending/Writing Emails:**

- Reply to emails (AI-generated drafts)
- Send emails (critical for v2)
- Draft editing (approve/edit/reject)
- Compose new emails
- Forward emails

🆕 **Privacy & Trust:**

- Trust meter (local vs cloud %)
- Privacy dashboard (detailed breakdown)
- Permissions management (control AI scope)
- AI settings (configure behavior)

🆕 **UX Enhancements:**

- Command palette (⌘K universal launcher)
- Priority section headers (Urgent/Important/Updates)
- AI draft panel (inline draft review)
- AI reasoning drawer (explainability)
- Keyboard-first UX (J/K/E/R/S shortcuts)
- 30-second wow (show value before full sync)

🆕 **Performance:**

- Virtualized scrolling (10,000+ emails)
- Sub-50ms interactions (NFR009)
- Optimistic UI (instant feedback)

---

## IMPLEMENTATION PRIORITY

### Phase 1: Core Email + AI Drafts (MVP - Weeks 1-4)

**Must Have (from v1):**

- ✅ Thread list view
- ✅ Thread detail view
- ✅ Email sync (full + incremental)
- ✅ Offline storage (RxDB)
- ✅ Label navigation
- ✅ Mark as read/unread
- ✅ Archive/delete
- ✅ Search
- ✅ OAuth authentication

**Must Have (new in v2):**

- 🆕 AI draft generation
- 🆕 Send email functionality
- 🆕 Draft panel (approve/edit/reject)
- 🆕 Confidence badges
- 🆕 Command palette (⌘K)
- 🆕 Keyboard shortcuts (J/K/E/R/S)
- 🆕 30-second wow

### Phase 2: AI Transparency (Weeks 5-6)

**From v1:**

- ✅ Activity logging (enhance)

**New in v2:**

- 🆕 AI reasoning drawer
- 🆕 Trust meter
- 🆕 AI action log with undo
- 🆕 Privacy dashboard
- 🆕 Permissions management

### Phase 3: Polish & Optimization (Weeks 7-8)

**From v1:**

- ✅ Performance optimizations
- ✅ Sync improvements

**New in v2:**

- 🆕 Priority section headers
- 🆕 Virtualized scrolling
- 🆕 Sub-50ms interactions
- 🆕 Accessibility (WCAG 2.1 AA)
- 🆕 Dark mode polish

### Phase 4: Advanced Features (Post-MVP)

**From v1:**

- ✅ Multi-select/bulk operations
- ✅ Attachment management
- ✅ Advanced search

**New in v2:**

- 🆕 Compose new emails
- 🆕 Forward emails
- 🆕 Multi-account support
- 🆕 AI autonomous actions
- 🆕 Calendar integration
- 🆕 Snooze
- 🆕 Templates

---

## MIGRATION STRATEGY

### Code to Reuse from v1

**High Priority (P0 - Use As-Is or Minor Changes):**

1. **Sync infrastructure** - Gmail API integration, incremental sync, batch processing
2. **RxDB setup** - Database schemas, reactive queries, offline storage
3. **Authentication** - OAuth2 flow, token management, Google Identity Services
4. **Data models** - Thread, Message, Label schemas (minor additions for AI)
5. **API calls** - Gmail API wrappers (add send email endpoint)
6. **UI components** - Thread list, thread detail, sidebar navigation (enhance with AI)

**Medium Priority (P1 - Refactor/Enhance):**

1. **Search** - Enhance with AI semantic search
2. **Activity logging** - Extend for AI actions
3. **Error handling** - Enhance for AI errors
4. **Performance utilities** - Caching, rate limiting, batching

**Low Priority (P2 - Optional Reuse):**

1. **Testing infrastructure** - Test pages, debug tools
2. **Monitoring** - Performance logging, sync monitoring

### Code to **NOT** Reuse (Deprecate)

_None - all v1 features retained and enhanced with AI_

### Code to **KEEP & ENHANCE**

✅ **Workflow engine core** - 100% reusable
✅ **Visual workflow editor** - 90% reusable (add AI node types)
✅ **Screen flows** - 100% reusable
✅ **Workflow execution engine** - 100% reusable
✅ **Action nodes** - 90% reusable (add AI actions)
✅ **Attributes system** - 100% reusable (add AI integration layer)
✅ **Custom attributes CRUD** - 100% reusable (enhance with AI suggestions)
✅ **Attribute-based filtering** - 100% reusable (enhance with AI)

**Estimated Code Reuse:** ~95% of v1 codebase reusable (sync, database, auth, API, workflows, attributes, base UI)

**Estimated Code Removal:** ~0% (everything kept and enhanced)

**Estimated New Code:** ~35% new (AI core, sending, AI attribute suggestions, AI-enhanced workflows, new UI components, command palette, AI integration layer)

---

## RISK ASSESSMENT

### High Risk (Critical for v2)

⚠️ **Sending email functionality** - v1 has no send capability, must build from scratch

- **Mitigation:** Gmail API send endpoint is straightforward, prioritize early

⚠️ **Local AI integration** - v1 has no AI, entirely new subsystem

- **Mitigation:** Start with cloud API, migrate to local later if needed

⚠️ **AI draft generation** - Complex AI prompt engineering required

- **Mitigation:** Use proven LLM APIs (OpenAI, Anthropic) initially

### Medium Risk

⚠️ **Performance (sub-50ms)** - v1 didn't have this strict requirement

- **Mitigation:** Virtualization, optimistic UI, caching strategies

⚠️ **30-second wow** - Complex UX timing requirement

- **Mitigation:** Prioritize first N threads for AI processing

### Low Risk

✅ **Sync infrastructure** - v1 has solid foundation, low risk
✅ **Database** - RxDB is proven, low risk
✅ **Authentication** - OAuth2 is stable, low risk

---

## RECOMMENDATIONS

### 1. Architecture Strategy

**Recommendation:** **Reuse v1's infrastructure + workflow engine + attributes system, build AI layer on top**

- Keep: RxDB, Gmail API integration, OAuth, incremental sync, **workflow engine**, **attributes system**
- Add: AI service layer, draft generation, local AI models, **AI suggestions**, **AI learning**
- Remove: Nothing (enhance everything with AI)

**Rationale:** v1's core infrastructure, workflow engine, AND attributes system are solid. Don't rebuild what works. Focus on:

1. AI differentiation (drafts, reasoning, priority suggestions)
2. Enhancing workflows with AI (suggested templates, AI decision nodes)
3. Enhancing attributes with AI (suggestions, pattern learning, user overrides)
4. Hybrid approach: AI efficiency + user control = best UX

### 2. Implementation Approach

**Recommendation:** **Incremental migration, not big-bang rewrite**

**Phase 1:** Copy v1 core → Add AI drafts → Add send capability
**Phase 2:** Add AI transparency (reasoning, trust meter)
**Phase 3:** Polish UX (keyboard shortcuts, command palette)
**Phase 4:** Advanced features (autonomous actions, multi-account)

**Rationale:** Minimize risk, deliver value incrementally, validate AI features early.

### 3. Feature Parity Decision

**Recommendation:** **Achieve full feature parity + enhance with AI**

**Must Have Parity (Keep from v1):**

- ✅ Read emails (threads, messages, attachments)
- ✅ Sync (full, incremental, offline)
- ✅ Search
- ✅ Labels/navigation
- ✅ Archive/delete
- ✅ Authentication
- ✅ Workflows (engine, editor, screen flows)
- ✅ Attributes (custom attributes, GTD presets, filtering)

**Enhance with AI:**

- 🆕 AI attribute suggestions (AI proposes, user confirms)
- 🆕 AI workflow suggestions (AI learns patterns)
- 🆕 AI pattern learning (learns from user corrections)

**Add New (v2 Only):**

- 🆕 Send/reply/compose
- 🆕 AI drafts
- 🆕 AI reasoning
- 🆕 Trust meter
- 🆕 Command palette
- 🆕 AI-enhanced workflows (suggested templates, AI nodes)

**Rationale:** v2 is **significantly more powerful** than v1:

- AI handles 80% of routine categorization (efficiency for all users)
- Attributes provide user control + trust (power users retain full control)
- Workflows enable complex automation (deterministic, reliable)
- Best of both worlds: AI efficiency + user override capability + workflow automation

---

## CONCLUSION

### Summary

- **v1 Strengths:** Solid sync infrastructure, offline-first, workflow engine, attributes system, email reading UX
- **v1 Weaknesses:** No send capability, no AI assistance
- **v2 Strategy:** Keep v1's core + workflows + attributes, add AI suggestion layer
- **Net Result:**
  - Efficient for all users (AI suggests 80% of categorization)
  - Trustworthy (users confirm/override AI suggestions)
  - Powerful for power users (attributes + workflows + AI)
  - Best of three worlds: AI efficiency + user control + workflow automation

### Next Steps

1. ✅ **Complete this feature parity analysis** ← Done
2. → **Proceed to architecture workflow** to define v2 technical architecture
3. → **Map v1 code modules to v2 architecture** during architecture phase
4. → **Create migration plan** for code reuse during development

### Final Recommendation

**Proceed to architecture workflow (`/bmad:bmm:workflows:architecture`) with this feature parity document as input.**

The architecture workflow will:

- Define v2 technical architecture
- Decide which v1 code to reuse vs. rewrite
- Plan AI integration approach
- Define data models (reuse v1 + AI additions)
- Make technology stack decisions

This feature parity analysis provides critical context for architectural decisions.

---

_End of Feature Parity Analysis_
