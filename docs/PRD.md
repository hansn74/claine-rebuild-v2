# claine-rebuild-v2 Product Requirements Document (PRD)

**Author:** Hans
**Date:** 2025-10-29
**Project Level:** 3
**Target Scale:** Complex system - subsystems, integrations, architectural decisions

> **Technical Reference:** This PRD defines product requirements (what & why). For implementation details (how), see [technical-decisions.md](./technical-decisions.md) for architecture rationale and technology choices.

---

## Goals and Background Context

### Goals

**What success looks like for Claine v2:**

- Create the first offline-first AI communication agent category and establish category leadership
- Achieve 5,000+ active users within 6 months demonstrating product-market fit
- Deliver measurable time savings: users reclaim 15-20+ hours monthly through AI autonomy
- Prove unit economics with $30-50 ARPU and <$100 CAC through community-driven growth
- Build trust foundation with NPS 50+ showing users trust AI autonomy with their communication
- Establish technical moat through sub-50ms performance that competitors cannot quickly replicate
- Validate offline-first advantage as sustainable competitive differentiation in privacy-first market

**North Star Metric:** Average monthly hours saved per active user through autonomous AI actions.

**Success Metrics:**
- **Activation:** ≥90% of new users reach "first AI-assisted action" within 30 seconds
- **Autonomy Accuracy:** ≥95% of AI actions not undone; undo rate <5%
- **Notification Precision:** ≥40% of clicked notifications result in reply or archive within 5 minutes
- **Cloud Fallback Usage:** <2% of AI operations at GA
- **Privacy Compliance:** Zero privacy incidents

**Guardrails:**
- Undo rate <5%
- Cloud fallback usage <2%
- Crash-free sessions ≥99.5%
- Privacy incidents = 0

### Background Context

**Why Claine matters now:**

High-leverage professionals face an unsustainable communication crisis. With 120+ daily emails consuming 28% of their workday (McKinsey), they're forced to choose between AI convenience and data sovereignty. Cloud-based AI tools require uploading sensitive correspondence, while privacy-focused email clients offer no intelligent assistance.

The market timing is ideal: the AI email and communication-agent market reached $30.9B in 2025, projected to exceed $125B by 2030. Recent validation signals include Superhuman's $825M acquisition, Fyxer's $10M ARR in 6 months, and 50% of YC's Spring 2025 batch building agentic AI products. Yet across 15+ analyzed competitors, none combine offline-first architecture, autonomous AI capability, and a multi-channel roadmap.

Claine v2 incorporates critical learnings from v1's architecture while building on proven strengths. **V1 established a powerful foundation:** local-first data patterns, visual workflow engine, custom attributes system, and deterministic automation that users trust. Rather than replace these capabilities with pure AI, v2 takes a **hybrid approach** — layering AI suggestions and efficiency on top of v1's user-controlled workflow and attributes systems. This creates a unique competitive position: AI handles 80% of routine categorization, while users retain manual control for the 20% requiring precision. Workflows remain deterministic and reliable, now enhanced with AI-powered decision nodes.

The rebuild targets the intersection of four accelerating shifts: the offline-first renaissance (ProtonMail's 100M+ users), autonomous AI agents (Fyxer's growth trajectory), hybrid AI-human collaboration (GitHub Copilot's model), and multi-channel future (email as beachhead, calendar/chat as moat).

**Context Summary:** Claine sits at the inflection point of productivity, privacy, and autonomy — combining proven workflow automation with local AI efficiency to create a new standard for professional communication where users control the final decision.

---

## Requirements

### Functional Requirements

**Email Account Integration & Sync**

- **FR001:** System shall support OAuth 2.0 secure connection for Gmail and Outlook accounts
- **FR002:** System shall support IMAP/SMTP connection for other email providers
- **FR003:** System shall support multi-account management (up to 3 email accounts)
- **FR004:** System shall perform initial full inbox sync with progress indication. For <5K messages: ETA within ±10%; 5-25K: ±20%; >25K: display progress by phase (headers, bodies, attachments) and estimated range
- **FR005:** System shall perform incremental sync every 2-5 minutes when online to fetch new messages and sync local actions

**Offline-First Data Storage & Management**

- **FR006:** System shall store all email data locally in a persistent, queryable store supporting offline mode
- **FR007:** System shall maintain full read/write functionality when offline, queueing actions for later sync
- **FR008:** System shall provide local full-text search with instant results (<100ms) across all stored messages
- **FR009:** System shall handle conflict resolution during sync with deterministic strategy for user actions
- **FR010:** System shall support selective sync with configurable time windows to manage storage limits

**AI Triage & Prioritization**

- **FR011:** System shall automatically categorize incoming emails using a configurable taxonomy with default preset (Primary, Updates, Social, Promotions). Users can rename, hide, or add custom categories
- **FR012:** System shall assign priority scores to emails based on sender relationship, content urgency, and historical patterns
- **FR013:** System shall provide explainable scoring showing why each email was prioritized or categorized, and allow users to manually adjust priority with feedback incorporated into future scoring adjustments
- **FR014:** System shall deliver smart notifications only for high-priority communications. Default rate limit: ≤5/hour; respects OS Do Not Disturb settings; per-priority thresholds configurable by user

**AI-Powered Compose & Response**

- **FR015:** System shall generate context-aware email drafts based on conversation history and user's writing style
- **FR016:** System shall learn and adapt to user's tone, voice, and communication patterns through feedback
- **FR017:** System shall provide one-click approve/edit/reject workflow for all AI-generated drafts
- **FR018:** System shall suggest optimal response timing (immediate vs. batch send)

**Autonomous Action Engine**

- **FR019:** System shall execute user-defined automation rules with transparent action logging
- **FR020:** System shall provide granular permission controls for AI autonomy at message-level and sender-domain-level (e.g., internal-only, external with review, domain-specific rules)
- **FR021:** System shall maintain complete action history showing what AI did, when, and why
- **FR022:** System shall support undo capability for all AI-executed actions, available for at least 30 days for reversible actions and executing in ≤200ms locally (excluding provider round-trip for remote reversals). Irreversible actions (e.g., provider-side permanent delete) require explicit confirmation dialogs with clear warnings
- **FR023:** System shall learn from user approval/rejection patterns to improve future suggestions

**Custom Attributes System**

- **FR024a:** System shall support user-defined custom attributes with configurable types (enum, text, date, boolean, number) that can be applied to emails for structured organization
- **FR024b:** System shall provide built-in attribute presets (Status: To Do/In Progress/Waiting/Done; Priority: High/Medium/Low; Context: Work/Personal/Projects) that users can enable, customize, or disable
- **FR024c:** System shall allow users to create domain-specific custom attributes (e.g., "Project-Alpha", "Legal-Hold", "Q4-Budget") with custom value sets
- **FR024d:** System shall support attribute-based filtering and search, allowing users to query emails by any combination of attributes (e.g., "Status=To-Do AND Priority=High")
- **FR024e:** System shall display attribute values inline in inbox list and thread detail views with clear visual indicators

**AI Attribute Suggestions (Hybrid AI + Manual Control)**

- **FR025a:** System shall analyze incoming emails and suggest attribute values with confidence scores (0-100%) and explainable reasoning (e.g., "Priority=High because deadline mentioned in subject")
- **FR025b:** System shall provide one-click accept/reject/modify workflow for AI attribute suggestions, with visual confidence indicators (🟢 High 90%+, 🟡 Medium 70-89%, 🔴 Low <70%)
- **FR025c:** System shall support bulk attribute operations where AI suggests values for multiple emails and user reviews/applies in batch
- **FR025d:** System shall track user corrections to AI suggestions (accepted as-is, modified before applying, rejected) and store as learning events
- **FR025e:** System shall learn from user attribute patterns and adapt future suggestions based on historical corrections (e.g., "User always changes Priority from High to Medium for newsletters from @domain.com")
- **FR025f:** System shall store both AI-suggested and user-final attribute values with metadata (source: ai_suggested/ai_accepted/user_manual/workflow, confidence score, timestamp)

**Visual Workflow Engine**

- **FR026a:** System shall provide visual workflow editor allowing users to create, edit, and manage automation workflows using drag-and-drop interface
- **FR026b:** System shall support workflow components including: triggers (email arrives, attribute changes), conditions (attribute values, sender, content), actions (apply attributes, archive, send, label), and decision nodes (branching logic)
- **FR026c:** System shall support workflow variables for dynamic data passing between nodes (e.g., extract subject line, use in reply template)
- **FR026d:** System shall provide AI-enhanced decision nodes where AI can evaluate conditions and provide branching logic based on email content analysis
- **FR026e:** System shall execute workflows using reliable attribute data (not AI predictions), ensuring deterministic and reproducible behavior
- **FR026f:** System shall support screen flows for complex multi-step automation processes with user interaction points
- **FR026g:** System shall provide workflow templates and AI-suggested workflows based on user email patterns (e.g., "I notice you always archive newsletters after reading - want me to create a workflow?")
- **FR026h:** System shall allow workflows to trigger on both manual attribute changes and AI-accepted attribute suggestions

**Privacy & Trust**

- **FR027:** System shall process all AI operations locally on-device without cloud uploads. Cloud fallback is OFF by default. When enabled by user, each event shows per-event banner ("Processed in cloud: redacted"), prompts/outputs are redacted locally (no addresses, names, message bodies), and cloud invocations are logged in exportable audit trail
- **FR028:** System shall provide privacy dashboard visualizing local vs. synced data, AI processing location, which AI modules ran locally vs. cloud fallback, and exportable audit of all cloud invocations
- **FR029:** System shall store OAuth tokens securely using OS-native keychain/credential managers
- **FR030:** System shall support import and export in standard formats (MBOX/EML for messages; JSON/CSV for settings, rules, workflows, attributes, and action logs). Import enables migration from other clients and restoring backups

**Performance & User Experience**

- **FR031:** System shall support smooth performance when displaying and scrolling through ≥10,000 emails
- **FR032:** System shall provide immediate visual feedback for offline actions with optimistic UI patterns
- **FR033:** System shall optimize initial render performance by loading attachments and images on-demand
- **FR034:** System shall allow users to configure notification thresholds (Urgent-only / Important+) and Do Not Disturb schedules
- **FR035:** System shall gracefully degrade to standard email client behavior with clear, non-alarming messages when AI features fail. Degradation rate target: <1% of user actions at GA
- **FR036:** System shall provide in-product controls for Export and Delete of user data (mail, settings, rules, workflows, attributes, telemetry) to satisfy GDPR/CCPA requests. Export formats: MBOX/EML for mail; JSON/CSV for settings, rules, workflows, attributes, action logs. If cloud fallback was used, requests must also purge provider-side logs
- **FR037:** System shall allow users to configure local data retention windows (e.g., sync last N days/months) and apply retention consistently across search, analytics, and storage

### Non-Functional Requirements

- **NFR001 - Performance:** System shall achieve sub-50ms input latency for 95% of user interactions (scroll, search, open message, navigation). UI lists must maintain ≥60 FPS scrolling with ≥10,000 emails

- **NFR002 - Reliability:** System shall maintain ≥99.5% crash-free session rate and gracefully handle network interruptions without data loss or user-visible errors

- **NFR003 - Security:** System shall encrypt all OAuth tokens using OS-native keychain storage, enforce TLS 1.3 for all network communication, and implement Content Security Policy to prevent XSS attacks

- **NFR004 - Scalability:** System shall support local storage of up to 100,000 emails per account with <5% performance degradation, and handle sync operations for accounts with 50-200 daily incoming messages

- **NFR005 - AI Performance & Quality:** AI triage scoring completes in <200ms per email and draft generation in <2 seconds in the reference environment (see Assumptions). Local inference is the default; cloud fallback is optional and opt-in. Quality targets: P0 wording errors <1% in approved drafts; hallucination rate (facts not in thread) <2% in evaluation set

- **NFR006 - Usability:** System shall enable new users to complete onboarding and reach "first AI-assisted action" (defined as: approving an AI draft OR accepting an AI triage decision) within 30 seconds, achieving 90% success rate. Validated via moderated usability tests (n≥20) with success defined as: user completes first AI-assisted action without facilitator help

- **NFR007 - Maintainability:** System shall maintain >85% automated test coverage for core logic and achieve <1 day turnaround for critical bug fixes in production

- **NFR008 - Accessibility:** System shall meet WCAG 2.1 AA standards for core flows (onboarding, inbox navigation, thread reading, compose, settings). Keyboard-only navigation must cover 100% of core actions. Screen reader labels complete; focus order logical; contrast ≥4.5:1 (body text) / 3:1 (icons)

- **NFR009 - Privacy-Preserving Telemetry:** Diagnostics default OFF. If enabled (optional/opt-in), events must exclude message bodies and addresses, be anonymized and aggregated. Retention: 30 days locally. Users can export or delete telemetry data. Export/delete covers telemetry in addition to mail/settings

- **NFR010 - Notification Hygiene:** Notifications must follow OS Do Not Disturb settings. Default rate limit ≤5/hour. False-positive rate (notifications user dismisses without viewing referenced message) <20%

---

## User Journeys

**Journey 1: First-Time User Onboarding & 30-Second Wow**

*Goal: New user experiences AI autonomy within 30 seconds of account connection*

**Context:** Sarah, a privacy-conscious founder, has just downloaded Claine after reading about offline-first AI on Product Hunt.

**Steps:**

1. **Launch Application** (0:00)
   - Opens Claine desktop app
   - Sees welcome screen with "Connect Your Email" CTA
   - Decides to try with Gmail work account

2. **Secure Account Connection** (0:05)
   - Clicks "Connect Gmail"
   - Redirected to Google OAuth consent screen
   - Reviews permissions (read, send, manage email)
   - Grants access, returns to Claine
   - **Decision Point:** Trust OAuth vs. abandon (trusts due to standard Google flow)

3. **Initial Sync Begins** (0:10)
   - Progress indicator shows: "Syncing your inbox locally..."
   - Estimate: "About 2 minutes for 5,000 messages"
   - **Background:** Claine begins downloading and storing last 90 days locally
   - Sarah can see progress: "1,200 / 5,000 messages synced"

4. **30-Second Wow Moment** (0:30)
   - **Before sync completes**, Claine shows:
     - "✓ Found 8 high-priority messages needing your attention"
     - First AI-triaged message visible with priority badge
     - "AI suggests: Reply to Michael about Q4 budget approval"
   - **Action:** Sarah clicks suggested message
   - **AI Draft Shown:** Context-aware reply ready for review
   - **Fallback:** If AI draft fails to generate within 3s, shows skeleton draft placeholder and retries silently
   - **Sarah's Reaction:** "It already knows this is urgent AND drafted a reply!"

5. **First AI-Assisted Action** (0:45)
   - Reviews AI draft
   - Makes minor edit (adds budget number)
   - Clicks "Approve & Send"
   - **Optimistic UI:** Message sent immediately (queued for actual send)
   - **Feedback:** "✓ Sent! AI will learn from your edits"

6. **Exploration & Autonomy Setup** (2:00 - 5:00)
   - **Sync completes in background**
   - Sarah explores privacy dashboard: "All AI processing happened locally"
   - Sets autonomy rules: "Auto-respond to newsletter confirmations"
   - Enables domain rule: "Internal @company.com emails can auto-triage"

**Outcome:** Sarah experiences AI value in <30 seconds, understands privacy model, and begins trusting autonomous features.

**Edge Cases Handled:**
- Slow internet: Shows "Offline mode active" + explains functionality works without connection
- Large inbox (50K+ messages): Prompts for selective sync window
- OAuth failure: Clear error message + retry option
- AI draft generation failure: Skeleton placeholder + silent retry within 3s

---

**Journey 2: Daily Email Management - Morning Triage**

*Goal: Established user processes overnight email backlog efficiently*

**Context:** Michael, a consultant, opens Claine Monday morning after weekend offline. 47 new emails arrived.

**Steps:**

1. **App Launch - Offline-First Priority** (8:00 AM)
   - Michael opens Claine (was closed over weekend)
   - **Background sync starts automatically**
   - Inbox shows AI-prioritized view immediately:
     - 🔴 5 Urgent (client requests, meeting conflicts)
     - 🟡 12 Important (requires response this week)
     - 🟢 18 Updates (FYI, newsletters)
     - ⚪ 12 Low Priority (promotions, automated)

2. **AI-Assisted Triage** (8:02 AM)
   - Michael reviews "Urgent" section first
   - **Decision Point:** Trust AI prioritization vs. scan all 47
   - Trusts AI (has 95% accuracy from past week)
   - **For each urgent email:**
     - AI shows reasoning: "Client Alex mentioned 'ASAP' + deadline tomorrow"
     - Suggested actions: "Reply now" / "Schedule follow-up" / "Delegate"

3. **Batch Processing with AI Drafts** (8:05 AM)
   - Email 1 (Client Alex): AI draft ready, Michael approves with one edit
   - Email 2 (Meeting conflict): AI suggests: "Propose reschedule to Thursday 2pm"
   - Michael clicks "Approve" - calendar integration queued for Phase 2, manually checks calendar
   - Email 3 (Budget approval): Needs detailed thought, Michael flags for afternoon

4. **Autonomous Actions Review** (8:12 AM)
   - Claine shows: "✓ AI handled 12 emails automatically while you were offline"
   - Michael reviews action log:
     - 8 newsletter confirmations → auto-responded "Thanks, confirmed"
     - 4 internal updates → auto-archived to "Updates" folder
   - **Decision Point:** Undo any AI actions vs. approve
   - All actions appropriate, Michael continues
   - **Emotional Beat:** Michael notices his stress level drops—Claine feels like an assistant, not a tool

5. **Remaining Inbox Management** (8:15 AM)
   - Important section (12 emails): Michael skims, delegates 2, snoozes 5, replies to 5
   - Updates/Low Priority: Batch archives, will read during breaks
   - **Total time:** 15 minutes (previously 45 minutes without AI)

**Outcome:** Michael processes 47 emails in 15 minutes, reclaiming 30 minutes for deep work. AI autonomy handled routine items, human focused on high-value decisions.

**Edge Cases Handled:**
- Incorrect AI prioritization: Easy manual reprioritization + feedback loop
- Offline period: Queued actions sync when back online
- AI action user disagrees with: Undo button reverts and retrains model

---

**Journey 3: Building Trust in AI Autonomy - Permission Evolution**

*Goal: User progressively grants more autonomy as trust builds*

**Context:** Lisa, a lawyer handling sensitive client communication, is cautious about AI autonomy. Week 1-4 journey.

**Trust Meter Visual Reference:** UI displays trust progression as user grants permissions (0% → 100% autonomy scale)

**Week 1: Conservative Start (Trust Meter: 10%)**

1. **Initial Setup** (Day 1)
   - Lisa connects email but sets strictest permissions:
     - "AI can suggest but never send"
     - "Never touch emails from @clients.com domains"
     - "Review all AI actions before execution"
   - **Trust Meter:** Shows 10% - "Maximum Control Mode"

2. **Daily Pattern** (Days 2-7)
   - AI suggests categorization and drafts
   - Lisa manually approves everything
   - Reviews AI reasoning for each suggestion
   - **Observes:** AI consistently correct on internal vs. external emails

**Week 2: Selective Autonomy (Trust Meter: 30%)**

3. **Trust Building** (Day 8)
   - Lisa notices AI correctly identifies "safe" automated emails:
     - Newsletter confirmations
     - Appointment reminders from known services
     - Internal team updates
   - **Decision:** Enables autonomy for: "Auto-respond to appointment confirmations"
   - **Trust Meter:** Increases to 30% - "Selective Autonomy"

4. **Validation** (Days 9-14)
   - Reviews AI action log daily
   - All automated responses appropriate
   - **Time Savings:** 10 minutes/day from not manually confirming appointments

**Week 3: Domain-Level Trust (Trust Meter: 55%)**

5. **Expanding Permissions** (Day 15)
   - Lisa enables: "Internal @lawfirm.com emails can auto-triage to Priority/Updates"
   - Still requires review for client emails
   - **Reasoning:** "Internal emails are lower risk, AI has proven reliable"
   - **Trust Meter:** Increases to 55% - "Domain Trust Established"

6. **Testing Boundaries** (Days 16-21)
   - AI correctly triages partner requests as Priority
   - Admin updates properly archived as Updates
   - One mistake: Client intro email marked Update instead of Priority
   - Lisa corrects, AI learns from feedback
   - **Trust Meter:** Briefly dips to 50%, recovers as AI adapts

**Week 4: Strategic Autonomy (Trust Meter: 75%)**

7. **Confidence Milestone** (Day 22)
   - Lisa enables: "Auto-send replies to routine client check-ins using my templates"
   - Still reviews drafts for new/complex client matters
   - Sets rule: "If AI confidence <90%, flag for review"
   - **Trust Meter:** Increases to 75% - "Strategic Partnership"

8. **Steady State** (Days 23-30)
   - AI handles 40% of Lisa's email volume autonomously
   - Lisa reviews action log weekly instead of daily
   - **Time Reclaimed:** 1.5 hours/day
   - **Trust Level:** "I trust Claine more than I trust some associates"
   - **Trust Meter:** Stabilizes at 75% - optimal balance for legal practice

**Outcome:** Progressive trust-building through transparent AI + granular controls + explainable reasoning. User retains control while gaining time savings.

**Design Note:** Trust Meter provides visual feedback on autonomy level and helps users understand their current delegation settings at a glance.

**Edge Cases Handled:**
- AI mistake on sensitive email: Undo + add sender to "always review" list (Trust Meter adjusts)
- Permission too broad: Easy rollback to stricter settings (Trust Meter decreases appropriately)
- Confidence calibration: User can adjust AI confidence threshold for auto-send

---

**Journey 4: Hybrid AI + Manual Control - Power User Workflow**

*Goal: Power user leverages both AI efficiency and manual attribute control for domain-specific email organization*

**Context:** Marcus, a product manager at a SaaS company, manages 150+ daily emails across multiple projects. He needs structured organization for his workflow: client emails need attributes like "Project-Alpha", "Q4-Budget", "Legal-Review". He wants AI to speed up routine work but maintain precise control over project categorization.

**Week 1: Setting Up Custom Attributes & Initial AI Learning**

1. **Custom Attribute Creation** (Day 1, 10:00 AM)
   - Marcus opens Settings → Custom Attributes
   - Creates domain-specific attributes:
     - "Project" (enum): Alpha, Beta, Gamma, Internal, None
     - "Review-Status" (enum): Needs-Review, Approved, Blocked, N/A
     - "Budget-Impact" (boolean): Yes/No
     - "Due-Date" (date): Custom date picker
   - **Decision:** Keeps built-in Priority/Status attributes enabled
   - Sets up attribute display in inbox: colored tags for Project, icon for Budget-Impact

2. **Manual Attribute Application** (Day 1, 10:15 AM)
   - Marcus processes 20 emails manually, applying attributes:
     - Email from client Alex → Project=Alpha, Review-Status=Needs-Review, Priority=High
     - Budget approval email → Project=Alpha, Budget-Impact=Yes, Due-Date=Oct-31
     - Newsletter → Project=None, Priority=Low, Status=Done (archive)
   - **Background:** AI observes all manual attribute assignments
   - **AI Learning:** Stores patterns: Alex's emails → Project=Alpha, Budget keywords → Budget-Impact=Yes

3. **First AI Suggestion** (Day 2, 9:00 AM)
   - New email arrives from client Alex about Project Alpha milestone
   - AI analyzes and suggests:
     - 🟢 Project=Alpha (95% confidence) - "Alex always discusses Project Alpha"
     - 🟢 Priority=High (92% confidence) - "Client email with 'milestone' urgency"
     - 🟡 Review-Status=Needs-Review (75% confidence) - "Contains action items"
   - **Marcus Reviews:**
     - Accepts Project=Alpha ✓
     - Accepts Priority=High ✓
     - Changes Review-Status to "Approved" (no action needed, just FYI)
   - Clicks "Apply Attributes"
   - **AI Learning Event Stored:** User accepted Project+Priority, corrected Review-Status

**Week 2: AI Adaptation & Bulk Operations**

4. **AI Pattern Learning** (Day 8)
   - Marcus notices AI suggestions getting more accurate:
     - Correctly suggests Project=Beta for emails from sarah@company.com
     - Learned Budget-Impact=Yes when subject contains "budget", "cost", "invoice"
     - Adapted Review-Status suggestions based on Marcus's corrections
   - **Confidence scores improving:** Most suggestions now 🟢 High (90%+)

5. **Bulk Attribute Operations** (Day 10, Morning triage)
   - 30 new emails overnight
   - Marcus opens "AI Suggestions" panel (🔔 badge shows "28 suggestions pending")
   - Reviews bulk suggestions:
     - 15 Project=Alpha emails from various senders → Accept all ✓
     - 8 newsletters → Project=None, Status=Done → Accept all ✓
     - 3 Budget emails → Budget-Impact=Yes → Accept all ✓
     - 2 incorrect suggestions (client intro marked as Project=Beta) → Override to Project=Alpha
   - Clicks "Apply All" (with corrections)
   - **Time saved:** 30 emails categorized in 2 minutes (previously 10+ minutes)
   - **AI learns:** All 30 decisions feed back into pattern recognition

**Week 3: Workflow Automation with Attributes**

6. **Building Attribute-Based Workflows** (Day 15)
   - Marcus opens Workflow Editor (visual drag-and-drop)
   - **Workflow 1: Auto-Archive Approved Budget Items**
     - Trigger: Attribute changes to Review-Status=Approved
     - Condition: Budget-Impact=Yes
     - Action: Apply label "Budget-Approved", Archive thread
   - **Workflow 2: Escalate Blocked Project Alpha Items**
     - Trigger: Review-Status=Blocked
     - Condition: Project=Alpha AND Due-Date < 7 days
     - Action: Send notification, Forward to manager@company.com with template
   - **Workflow 3: AI-Enhanced Client Response**
     - Trigger: Email arrives from @clients.com domain
     - AI Decision Node: "Does this need immediate response?" (AI evaluates urgency)
     - If Yes → Generate draft, notify Marcus
     - If No → Apply Priority=Low, move to "Client Updates" folder
   - **Marcus saves all three workflows**

7. **Workflows + AI Suggestions in Action** (Day 16)
   - Email arrives: Budget approval for Project Alpha
   - **Flow:**
     1. AI suggests: Project=Alpha, Budget-Impact=Yes, Review-Status=Needs-Review
     2. Marcus reviews email, changes Review-Status to "Approved" (budget is good)
     3. Attributes applied → **Workflow 1 triggers automatically**
     4. Email labeled "Budget-Approved" and archived
     5. Workflow log shows: "Workflow 'Auto-Archive Approved Budget' executed successfully"
   - **Marcus's reaction:** "AI handled categorization, I confirmed approval, workflow handled the rest. Perfect."

**Week 4: Steady State - Hybrid Efficiency**

8. **Daily Workflow Pattern** (Day 22-30)
   - **Morning routine (150 emails processed in 20 minutes):**
     - AI suggests attributes for ~140 emails (93% of volume)
     - Marcus reviews AI suggestions panel:
       - Accepts 120 suggestions as-is (1-click bulk accept)
       - Overrides 15 suggestions (corrections take 3 seconds each)
       - Manually categorizes 5 edge cases (custom attributes AI hasn't learned)
     - 10 emails processed manually (sensitive/complex decisions)
   - **Workflows execute automatically:**
     - 20 approved budget items auto-archived
     - 5 blocked Project Alpha items escalated to manager
     - 12 low-priority client updates triaged to folder
   - **Time reclaimed:** 45 minutes/day (was 65 minutes, now 20 minutes)

9. **Insight & Continuous Improvement** (Day 30)
   - Marcus reviews "AI Learning Dashboard":
     - AI suggestion accuracy: 94% (Marcus accepts without changes)
     - Attributes applied: 2,100 (80% AI-suggested, 20% manual)
     - Workflows executed: 340 actions (100% success rate)
     - Custom attributes most used: Project (45%), Budget-Impact (28%)
   - **Marcus reflects:** "AI handles the grunt work, I handle the judgment calls. Workflows make sure nothing slips through the cracks. I trust this system more than I trust myself to remember everything."

**Outcome:** Marcus achieves 70% time savings while maintaining precise control over project organization. AI learns his patterns, workflows provide deterministic automation, and manual overrides ensure accuracy. The hybrid system combines efficiency (AI suggestions) with control (manual attributes) and reliability (workflow automation).

**System Benefits Demonstrated:**
- **AI Efficiency:** 80% of attributes suggested correctly, saving 45 min/day
- **User Control:** Manual overrides on 15% of suggestions maintain accuracy
- **Pattern Learning:** AI adapts to domain-specific attributes (Project names, budget keywords)
- **Workflow Reliability:** Deterministic automation using stable attribute data
- **Offline Capability:** Attributes work 100% offline; AI suggestions queue when offline, apply when online

**Edge Cases Handled:**
- AI suggests wrong project: Override in 1 click, AI learns from correction
- Complex email needs multiple attributes: Manual mode always available
- Workflow triggers incorrectly: Undo button reverts action, edit workflow condition
- New project "Delta" added: Create new enum value, AI learns pattern within 5-10 examples
- Offline period: AI suggestions queue, workflows execute when back online

---

## UX Design Principles

**Core Experience Qualities:**

1. **Transparency as Foundation**
   - Every AI decision must be explainable on-demand
   - Action history always visible and reversible
   - Privacy status clear at all times (local vs. cloud processing)

2. **Progressive Trust Building**
   - Start with maximum user control, earn autonomy through reliability
   - Granular permission controls at message and domain level
   - Trust Meter visualization showing current autonomy level

3. **Performance as Delight**
   - Sub-50ms interactions create "instant" feeling
   - Optimistic UI makes offline actions feel immediate
   - No spinners for core interactions (triage, open, archive)

4. **Calm, Not Overwhelming**
   - AI reduces noise, surfaces only what matters
   - Smart notifications (not every email)
   - Batch-friendly workflows minimize context switching

**Critical Accessibility & Usability:**

- Keyboard-first navigation (Superhuman-style shortcuts)
- High contrast modes for readability
- Clear visual hierarchy (priority indicators, unread states)
- Accessible AI explanations (plain language, not jargon)

**Micro-Copy Principle:**

Language should be plain, empathic, and human-sounding — e.g., "AI suggests this because..." rather than "Model inference result...". All system messages reinforce transparency and build trust through conversational tone.

---

## User Interface Design Goals

**Platform & Screens:**

**Target Platform:** Desktop (macOS, Windows, Linux)
- Primary interaction: Multi-pane layout (inbox list + thread detail + AI panel)
- Secondary interaction: Command palette for power users

**Core Screens/Views:**

1. **Inbox View** (Primary)
   - High-performance list capable of smooth scrolling with ≥10,000 emails
   - Priority badges (🔴 Urgent, 🟡 Important, 🟢 Updates, ⚪ Low)
   - Inline AI suggestions ("Suggested reply ready")
   - Trust Meter widget (shows current autonomy level with subtle pulse animation on changes)
   - **Empty State:** When inbox is clear, show calm affirmation ("You're all caught up") with suggested next action or focus time encouragement

2. **Thread Detail View**
   - Conversation history with context preservation
   - AI draft panel (expandable, shows reasoning)
   - One-click actions: Approve / Edit / Reject
   - Explainability overlay ("Why AI suggested this")

3. **Privacy Dashboard**
   - Local vs. synced data visualization
   - AI processing location indicator
   - OAuth token management
   - Data export controls

4. **Autonomy Settings**
   - Permission matrix (message-level, domain-level)
   - Automation rule builder (if/then logic)
   - AI confidence threshold slider
   - Action log review

5. **Search & Command Palette**
   - Instant local search (<100ms)
   - Keyboard-driven command execution
   - AI-powered semantic search (future)

**Key Interaction Patterns:**

- **Keyboard Shortcuts:** e (archive), r (reply), cmd+k (command palette)
- **Drag & Drop:** Organize emails, create automation rules
- **Swipe Gestures:** Archive, snooze (future trackpad optimization)
- **Inline Editing:** Modify AI drafts without modal dialogs

**Design Constraints:**

- **Performance Target:** 60 FPS scrolling, <50ms interactions
- **Existing Design Systems:** None - greenfield design opportunity
- **Technical UI Constraints:**
  - Desktop shell: Based on Chromium-class webview or native equivalent (final choice in ADR)
  - Accessibility: WCAG 2.1 AA compliance
  - Responsive: Optimized for 13"+ laptop screens (1440px+ width)

**Visual Design Direction:**

- **Style:** Clean, professional, trust-inspiring (not playful)
- **Color Palette:** Neutral base + accent for priority indicators
- **Typography:** High readability (system fonts, 14-16px body)
- **Density:** Information-dense but not cluttered (Superhuman reference)
- **Animation:** Subtle, purposeful (not decorative)
  - Trust Meter: Subtle pulse animation when autonomy level changes
  - State transitions: Smooth 200ms easing
  - Optimistic actions: Immediate visual feedback with success confirmation

---

## Epic List

**Epic 1: Foundation & Core Infrastructure**
- **Goal:** Establish project infrastructure, local-first data architecture, basic email sync capability, and developer experience foundation
- **Deliverable:** Users can connect email accounts and sync messages locally to persistent storage. Development team has CI/CD, logging, and error tracking in place.
- **Story Estimate:** 10-12 stories
- **Rationale:** Must establish foundation before any AI or workflow features. Includes repo setup, local data architecture with attribute support, OAuth integration, basic sync, CI/CD pipeline, structured logging, and error tracking for rapid iteration.

**Epic 2: Offline-First Email Client with Attributes**
- **Goal:** Deliver performant email client with custom attributes system, attribute-based filtering, and offline functionality
- **Deliverable:** Users can read, compose, manage emails with sub-50ms performance, create custom attributes, apply attributes manually, and filter by attributes—fully functional offline
- **Story Estimate:** 12-15 stories
- **Rationale:** Core email functionality plus v1-proven attributes system must work flawlessly before adding AI layer. Custom attributes provide the structured data foundation that AI suggestions and workflows will build upon. Focus on performance optimization, efficient rendering, offline reliability, and attribute CRUD operations.

**Epic 3: AI Triage & Attribute Suggestions**
- **Goal:** Implement local AI inference for intelligent email categorization, priority scoring, and AI-powered attribute suggestions with user confirmation
- **Deliverable:** Users see AI-prioritized inbox with explainable scoring, receive AI attribute suggestions with confidence indicators, can accept/reject/modify suggestions, and AI learns from corrections
- **Story Estimate:** 10-12 stories
- **Rationale:** First AI capability - introduces hybrid approach where AI suggests, user controls. Must be fast (<200ms for triage, <500ms for attribute suggestions), explainable, and trustworthy. AI learns from user corrections to improve future suggestions. Sets foundation for all subsequent AI features.

**Epic 4: AI-Powered Compose & Response**
- **Goal:** Enable AI to generate context-aware draft responses based on conversation history and user writing style
- **Deliverable:** Users can review, edit, and approve AI-generated drafts with one-click workflow
- **Story Estimate:** 8-10 stories
- **Rationale:** Core autonomous capability. Requires style learning, context analysis, and user feedback loops. Works independently from attributes/workflows but can be triggered by workflow actions.

**Epic 5: Visual Workflow Engine & Hybrid Automation**
- **Goal:** Implement visual workflow editor allowing users to create deterministic automation using attributes, with AI-enhanced decision nodes
- **Deliverable:** Users can create, edit, and manage workflows using drag-and-drop editor. Workflows execute using reliable attribute data. AI-suggested workflow templates based on user patterns. AI-enhanced decision nodes for intelligent branching.
- **Story Estimate:** 12-15 stories
- **Rationale:** Integrates attributes (Epic 2) and AI capabilities (Epics 3-4) into powerful automation system. Workflow engine provides deterministic, user-controlled automation that power users demand. AI suggestions make workflows accessible to casual users. Requires visual editor, workflow execution engine, AI decision nodes, workflow templates, and action logging.

**Epic 6: Autonomous Action Engine & Trust Building**
- **Goal:** Implement permission-based autonomy system allowing AI to execute actions independently, with comprehensive action logging and undo capability
- **Deliverable:** Users can set granular permissions, review action logs with AI reasoning, undo AI actions within 30 days, and view Trust Meter visualization showing autonomy level.
- **Story Estimate:** 10-12 stories
- **Rationale:** Culmination of AI features. Enables AI to act autonomously (without workflow or manual trigger) while maintaining user trust through transparency, explainability, and reversibility. Requires sophisticated permission system, action logging, rollback capability, and Trust Meter visualization.

---

**Total Estimated Stories:** 62-76 stories across 6 epics

**Delivery Sequence Rationale:**

1. **Epic 1** establishes technical foundation (infrastructure, data layer with attribute support, sync, DevEx)
2. **Epic 2** proves core email client viability + attributes system (deterministic, user-controlled organization)
3. **Epic 3** introduces hybrid AI approach (AI suggests attributes, user confirms/overrides, AI learns)
4. **Epic 4** adds AI drafting (autonomous capability, independent from workflows/attributes)
5. **Epic 5** integrates attributes + AI into visual workflow engine (power user automation with AI assistance)
6. **Epic 6** enables full AI autonomy (AI acts independently with user oversight)

Each epic delivers end-to-end, deployable increment. No forward dependencies.

**Key Architectural Decision:** Epics 2-3-5 form the "hybrid backbone" - manual attributes (Epic 2) + AI suggestions (Epic 3) + workflow automation (Epic 5) create the unique value proposition. Epics 4 and 6 add autonomous AI capabilities that work alongside (not replace) the hybrid system.

> **Note:** Detailed epic breakdown with full story specifications is available in [epics.md](./epics.md)

---

## Assumptions & Constraints

### Technical Assumptions

**Reference Hardware Environment:**
- Desktop/Laptop with 16GB+ RAM
- Modern CPU (Apple Silicon M1+, Intel i7 10th gen+, AMD Ryzen 5000+)
- 50GB+ available storage
- Stable internet connection for sync (offline mode fully functional)

**AI Performance Assumptions:**
- Local AI inference achievable within latency targets on reference hardware
- 8B parameter models (or quantized equivalents) provide acceptable quality
- Consumer hardware continues to improve (5-year forward compatibility)

### Business Assumptions

- Privacy-minded professionals willing to pay premium ($30-50/month) for offline-first AI
- Email remains primary professional communication channel (not displaced by chat/social)
- Category education successful: "offline-first AI agent" resonates with target market
- Community-driven growth achieves CAC <$100

### User Assumptions

- Target users manage 50-200+ emails daily
- Desktop workflow primary (mobile secondary in Phase 2)
- Users willing to complete onboarding (OAuth, sync, permission setup)
- Trust builds progressively through transparency and control

**Validation Plan:** All assumptions tested in first 90 days post-MVP via user research, telemetry analysis, and market feedback.

---

## Rollout Plan & Exit Criteria

### Rollout Phases

**Phase 1: Private Beta** (Weeks 1-4)
- Limited to 50-100 invited users (privacy advocates, early adopters)
- Hardware cohorts: Apple Silicon (M1/M2/M3), Intel/AMD Windows, Linux
- Validate: NFR001 (performance), NFR002 (reliability), NFR008 (accessibility)
- Exit criteria: ≥85% activation rate, crash-free ≥99%, performance targets met on all hardware cohorts

**Phase 2: Public Waitlist** (Weeks 5-12)
- Expand to 500-1,000 users via Product Hunt / community waitlist
- Validate: NFR005 (AI quality), NFR006 (usability), NFR010 (notification hygiene)
- Exit criteria: NPS ≥40, AI accuracy ≥95%, <5% undo rate, cloud fallback <2%

**Phase 3: General Availability (GA)** (Week 13+)
- Open signup, public launch
- All NFRs must be met
- Exit criteria: All success metrics and guardrails achieved

### Epic Exit Criteria

**Epic 1 (Foundation):** OAuth working for Gmail+Outlook; sync completes for 10K emails in <5min; CI/CD pipeline operational

**Epic 2 (Email Client):** NFR001 (performance) and NFR008 (accessibility) met on reference hardware; offline mode fully functional with zero data loss in 100 test scenarios

**Epic 3 (AI Triage):** NFR005 (AI performance) met; explainability displayed within 100ms for ≥95% of emails; user feedback loop functional

**Epic 4 (AI Compose):** Draft generation <2s; style match validated by user acceptance ≥80%; confidence scoring calibrated

**Epic 5 (Autonomy):** Permission system functional; action log complete; undo working for all reversible actions; autonomy accuracy ≥95%

---

## Out of Scope

**What we're NOT doing in MVP (explicitly deferred to post-launch):**

**Multi-Channel Integration (Phase 2)**
- Calendar integration (Google Calendar, Outlook Calendar, CalDAV)
- Chat platform integration (Slack, Microsoft Teams, Discord)
- Social media integration (Twitter/X, LinkedIn, Reddit, Mastodon)
- Meeting coordination and scheduling automation
- Unified communication timeline across channels

**Mobile Applications (Phase 2)**
- iOS native app (Swift)
- Android native app (Kotlin)
- Cross-device sync optimization for mobile
- Mobile-specific UI patterns and gestures
- Push notification system

**Advanced AI Features (Phase 2-3)**
- Sentiment analysis and tone detection
- Relationship intelligence graphs
- Communication pattern analytics dashboard
- Multi-language support (MVP: English only)
- Custom AI personality tuning
- Semantic/vector search (MVP: full-text search only)

**Collaboration & Team Features (Phase 3)**
- Shared inbox management
- Email delegation workflows
- Team communication analytics
- Collaborative draft editing
- Team automation template library
- Admin controls and permissions for teams

**Enterprise Capabilities (Phase 3)**
- Single Sign-On (SSO) / SAML authentication
- Enterprise admin dashboard
- Audit logging and compliance reporting
- On-premise deployment option
- Air-gapped operation mode
- HIPAA / SOC 2 certification
- Team billing and user management

**Integration Ecosystem (Phase 4)**
- CRM integrations (Salesforce, HubSpot, Pipedrive)
- Project management tools (Linear, Asana, Jira, Monday)
- Note-taking apps (Notion, Obsidian, Roam Research)
- Plugin marketplace and API platform
- Webhook support for custom automation
- Zapier / Make.com connectors
- Browser extensions (Chrome, Safari, Firefox) - focus remains on native desktop performance for MVP

**Advanced Productivity Features**
- Email templates library
- Read receipts and tracking
- Snooze with smart suggestions
- Send later / scheduled sending (beyond queue-for-sync)
- Email finder / contact enrichment
- Bulk operations UI
- Advanced filtering and saved searches
- AI meeting notes generation
- Task extraction from email content

**AI Model Customization (Phase 4)**
- Fine-tuning custom models on user data
- Model export and sharing
- Federated learning infrastructure
- Bring-your-own-LLM (BYOLLM) support
- Model marketplace

**Scope Boundaries - Clarifications:**

**Email Provider Scope:**
- **In Scope:** Gmail, Outlook, standard IMAP/SMTP providers
- **Out of Scope:** ProtonMail (custom protocol), Exchange Server (complex enterprise setup)

**AI Capabilities:**
- **In Scope:** Triage, prioritization, draft generation, basic automation
- **Out of Scope:** Calendar coordination (requires calendar integration), meeting note generation, CRM updates

**Privacy & Security:**
- **In Scope:** Local AI processing, OAuth 2.0, OS keychain storage, basic encryption
- **Out of Scope:** End-to-end encryption like ProtonMail, zero-knowledge architecture, formal compliance certifications

**Performance:**
- **In Scope:** Desktop optimization (13"+ screens, modern hardware)
- **Out of Scope:** Low-end hardware support (<8GB RAM), older OS versions (pre-2020)

---

**Rationale for Deferral:**

Following Superhuman's playbook: spend 18-24 months perfecting email + AI autonomy + offline-first before expanding to calendar, chat, or mobile. Each deferred feature cluster represents 3-6 months of additional development effort that would dilute MVP focus and delay market validation.

**Re-evaluation Triggers:**

These deferred capabilities may be re-evaluated for MVP inclusion if:
- User research reveals critical blocker (e.g., "Can't adopt without mobile")
- Competitive pressure requires feature parity
- Strategic partnership opportunity depends on specific capability
- Technical foundation enables low-effort implementation
