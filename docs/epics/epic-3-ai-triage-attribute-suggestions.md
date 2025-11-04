# Epic 3: AI Triage & Attribute Suggestions

## Expanded Goal

Implement local AI inference for intelligent email categorization, priority scoring, and AI-powered attribute suggestions with user confirmation. This epic introduces the **hybrid AI + manual control approach** where AI suggests, user decides, and AI learns from corrections. Must be fast (<200ms for triage, <500ms for attribute suggestions), explainable, and trustworthy. This epic establishes the foundation for all subsequent AI features by proving local AI performance, building trust through transparency, creating feedback loops for continuous improvement, and demonstrating that AI enhances (not replaces) user control.

## Value Delivery

By the end of this epic, users can:
- See their inbox automatically prioritized by AI (Urgent, Important, Updates, Low Priority)
- Receive AI attribute suggestions with confidence indicators (🟢 High, 🟡 Medium, 🔴 Low)
- Accept, reject, or modify AI attribute suggestions with one-click workflow
- Perform bulk attribute operations (AI suggests for 50 emails, user reviews and applies)
- Understand why each email was prioritized and why attributes were suggested (explainable scoring)
- Manually adjust priorities and attributes, training the AI through feedback
- See AI accuracy improve over time as it learns from corrections
- Experience smart notifications (only for truly important emails)
- Trust that all AI processing happens locally on their device

## Story Breakdown

**Story 3.1: Local LLM Integration (Ollama)**

As a developer,
I want Ollama integrated for local LLM inference,
So that we can run AI models on-device without cloud dependency.

**Acceptance Criteria:**
1. Ollama installed and configured (packaged with Electron app or external install)
2. Llama 3.1 8B model downloaded and verified
3. API wrapper created for inference requests
4. Latency benchmarked on target hardware (M1, Intel i7, AMD Ryzen)
5. Fallback mechanism to cloud API (OpenAI/Anthropic) configurable
6. Model loading happens in background (doesn't block UI)

**Prerequisites:** Epic 2 complete

---

**Story 3.2: Email Analysis Engine**

As a developer,
I want an email analysis engine that extracts features for AI scoring,
So that the AI can understand email context and importance.

**Acceptance Criteria:**
1. Feature extractor analyzes: sender, subject, body content, urgency keywords
2. Sender relationship scoring (frequency of communication, response rate)
3. Content analysis: detect deadlines, questions, requests vs. FYI
4. Thread context incorporated (conversation history)
5. Analysis runs in Web Worker (doesn't block main thread)
6. Features cached in RxDB for performance

**Prerequisites:** Story 3.1

**Estimated Effort:** 8 hours

---

**Story 3.2B: Implement AI Capability Detection and Graceful Degradation** *(NEW - Gate-Check Medium Priority)*

As a user,
I want the app to work even if my browser doesn't support local AI,
So that I can still use email features without AI enhancements.

**Acceptance Criteria:**

**Browser Capability Detection:**
1. WebAssembly support checked on app load
2. WebGPU availability checked (fallback to WebGL or CPU if unavailable)
3. Available memory detected for model loading (require 4 GB minimum)
4. Capability check results stored in app state

**Progressive Enhancement:**
5. AI features gracefully hidden if capabilities unavailable
6. Email client works fully without AI (manual priority assignment available)
7. Settings show AI capability status:
   - ✅ "AI features available (WebGPU accelerated)"
   - ⚠️ "AI features available (CPU only - slower)"
   - ❌ "AI features unavailable (browser not supported)"

**Fallback UI:**
8. Manual priority dropdown shown instead of AI priority (Urgent, Important, Updates, Low)
9. Manual attribute assignment UI available without AI suggestions
10. Clear user messaging: "AI features require a modern browser with WebGPU support"
11. Help link to browser compatibility page

**Model Download Handling:**
12. Model download failure shows error with retry button
13. Download progress shown (e.g., "Downloading AI model... 45%")
14. User can cancel model download
15. Partial downloads resumed on retry (not restarted)

**Testing:**
16. Test: App loads successfully on browsers without WebGPU (Chrome 94, Firefox 100)
17. Test: AI features hidden, manual controls shown
18. Test: User can use email client fully without AI
19. Test: Model download failure → retry works
20. Test: Capability status displayed correctly in settings

**Prerequisites:** Story 3.1 (Local LLM Integration)

**Estimated Effort:** 6 hours

---

**Story 3.3: Priority Scoring Model**

As a user,
I want emails automatically scored for priority,
So that important messages surface first.

**Acceptance Criteria:**
1. AI model assigns priority scores (0-100) to each email
2. Scoring completes in <200ms per email on average
3. Four priority categories: Urgent (80-100), Important (60-79), Updates (40-59), Low (0-39)
4. Scoring factors: sender relationship, urgency keywords, deadlines, questions
5. Batch processing for inbox backlog (prioritize visible emails first)
6. Scores stored in RxDB and updated on user feedback

**Prerequisites:** Story 3.2

---

**Story 3.4: Priority-Based Inbox View**

As a user,
I want my inbox organized by AI priority,
So that I focus on what matters most.

**Acceptance Criteria:**
1. Inbox grouped by priority: Urgent, Important, Updates, Low Priority
2. Visual indicators (🔴 🟡 🟢 ⚪) distinguish priority levels
3. Collapsible sections (e.g., collapse Low Priority)
4. Sort within section: newest first or highest confidence first
5. User can toggle between Priority View and Chronological View
6. Priority View preference persists across sessions

**Prerequisites:** Story 3.3

---

**Story 3.5: Explainability UI - "Why this priority?"**

As a user,
I want to understand why AI prioritized each email,
So that I can trust the AI's decisions.

**Acceptance Criteria:**
1. "Why?" button or icon next to each email
2. Explanation popup shows reasoning in plain language
3. Example: "Marked Urgent because: Client mentioned 'ASAP' and deadline is tomorrow"
4. Factors shown: sender relationship, keywords detected, urgency signals
5. AI confidence score displayed (e.g., "85% confident")
6. Explanation uses human-sounding language (not technical jargon)

**Prerequisites:** Story 3.4

---

**Story 3.6: Manual Priority Adjustment & Feedback Loop**

As a user,
I want to manually adjust email priorities,
So that the AI learns my preferences.

**Acceptance Criteria:**
1. User can drag-and-drop emails between priority sections
2. Right-click menu: "Set priority to..." with options
3. Feedback recorded: user adjustments stored in RxDB
4. AI model incorporates feedback in future scoring
5. Feedback effects visible within 24 hours (model retraining)
6. User notified when AI adapts: "AI learned from your feedback"

**Prerequisites:** Story 3.5

---

**Story 3.7: Smart Notifications (High-Priority Only)**

As a user,
I want notifications only for truly important emails,
So that I'm not overwhelmed by inbox noise.

**Acceptance Criteria:**
1. OS notifications triggered only for Urgent priority emails
2. Notification shows sender, subject, and priority reason
3. Notification click opens Claine and navigates to email
4. User can configure threshold (e.g., notify for Important+ or Urgent only)
5. Do Not Disturb mode: suppress all notifications
6. Notification rate-limiting: max 5 per hour to prevent spam

**Prerequisites:** Story 3.4

---

**Story 3.8: Batch Triage for Inbox Backlog**

As a user,
I want AI to quickly triage my entire inbox,
So that I can catch up on backlog efficiently.

**Acceptance Criteria:**
1. "AI Triage All" button triggers batch processing
2. Progress indicator shows triage status (e.g., "Analyzing 347 emails...")
3. Prioritizes visible emails first (above-the-fold), then background
4. Triage completes in <30 seconds for 500 emails
5. Results displayed progressively (updates as scoring completes)
6. User can cancel triage mid-process

**Prerequisites:** Story 3.3, Story 3.4

---

**Story 3.9: AI Performance Monitoring Dashboard (Dev Tool)**

As a developer,
I want monitoring for AI performance metrics,
So that I can ensure latency and accuracy targets are met.

**Acceptance Criteria:**
1. Dev dashboard shows: avg latency, P95 latency, throughput
2. Accuracy metrics: user feedback rate, adjustment frequency
3. Model version and configuration displayed
4. Performance breakdown: feature extraction time, inference time
5. Historical trends: performance over time
6. Alerts if latency exceeds 200ms threshold

**Prerequisites:** Story 3.3, Story 3.6

---

**Story 3.10: Privacy Dashboard - AI Processing Transparency**

As a user,
I want visibility into AI processing,
So that I trust my data stays local.

**Acceptance Criteria:**
1. Privacy dashboard accessible from settings
2. Shows: "All AI processing: Local (on-device)"
3. Model information: version, size, location
4. Cloud fallback status: enabled/disabled, usage count
5. Data visualization: "0 emails sent to cloud for processing"
6. Link to privacy policy and data handling documentation

**Prerequisites:** Story 3.1, Story 3.3

---

**Story 3.11: AI Attribute Suggestion Engine**

As a user,
I want AI to suggest attribute values for my emails,
So that I can quickly categorize emails without manual data entry.

**Acceptance Criteria:**
1. AI analyzes email content and suggests attribute values (uses attributes from Epic 2)
2. Suggestion engine analyzes: sender, subject, body, thread history
3. Generates suggestions for all user-defined attributes (built-in + custom)
4. Confidence score (0-100%) computed for each suggestion
5. Reasoning generated in plain language (e.g., "Project=Alpha because email is from alex@alpha.com and mentions Alpha milestone")
6. Suggestions complete in <500ms per email
7. Suggestions stored in RxDB with status: pending, accepted, rejected, modified
8. Batch processing supported (suggest attributes for 50+ emails at once)

**Prerequisites:** Story 3.2 (Email Analysis Engine), Story 2.13 (Attributes System)

---

**Story 3.12: AI Attribute Suggestions UI - Review & Apply Workflow**

As a user,
I want to review and apply AI attribute suggestions with one-click,
So that AI speeds up my workflow while I maintain control.

**Acceptance Criteria:**
1. "AI Suggestions" panel shows pending attribute suggestions
2. Badge indicator shows count (e.g., "🔔 28 suggestions pending")
3. Each suggestion displays: attribute name, suggested value, confidence indicator (🟢 90%+, 🟡 70-89%, 🔴 <70%)
4. One-click actions: Accept, Reject, Modify (change value before applying)
5. Bulk review mode: show all suggestions for multiple emails, select which to accept
6. "Accept All" button with confirmation dialog
7. Applied suggestions marked as "accepted" in database
8. Rejected suggestions marked as "rejected" for AI learning
9. Modified suggestions store both AI value and user value for learning

**Prerequisites:** Story 3.11, Story 2.14 (Apply Attributes UI)

---

**Story 3.13: AI Learning from Attribute Corrections**

As a user,
I want the AI to learn from my attribute corrections,
So that future suggestions become more accurate over time.

**Acceptance Criteria:**
1. Learning events stored in RxDB: email features, AI suggestion, user action (accepted/rejected/modified), user final value
2. Pattern detection: AI identifies when user consistently overrides specific suggestions
3. Example: User always changes Priority from High to Medium for newsletters → AI learns to suggest Medium for newsletters
4. Domain-specific learning: User creates custom attribute "Project-Alpha" and manually applies to 10 emails → AI learns pattern for future emails
5. Confidence scores adjust based on learning (increase for patterns AI learned, decrease for frequently corrected suggestions)
6. Learning dashboard shows improvement metrics: "AI accuracy improved from 75% to 94% over 30 days"
7. User can view learning insights: "AI learned: Emails from @domain.com always get Project=Beta"

**Prerequisites:** Story 3.12

---
