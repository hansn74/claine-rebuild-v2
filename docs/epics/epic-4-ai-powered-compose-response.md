# Epic 4: AI-Powered Compose & Response

## Expanded Goal

Enable AI to generate context-aware draft responses based on conversation history and user's writing style, providing one-click approve/edit/reject workflow. This epic builds on the AI triage infrastructure to deliver autonomous drafting capability, requiring sophisticated context analysis, style learning, and user feedback incorporation.

## Value Delivery

By the end of this epic, users can:
- Receive AI-generated draft responses for incoming emails
- Review drafts that match their personal writing style and tone
- Approve drafts with one click or make quick edits
- Train the AI by approving/rejecting/editing drafts
- Receive smart timing suggestions (send now vs. batch later)

## Story Breakdown

**Story 4.1: Conversation Context Analysis**

As a developer,
I want AI to extract conversation context from email threads,
So that draft responses are relevant and contextual.

**Acceptance Criteria:**
1. Thread history parser extracts: participants, subject, key points
2. Previous user responses analyzed for tone and style patterns
3. Unresolved questions identified in thread
4. Context window limited to last 5 messages (performance optimization)
5. Context stored in RxDB for reuse
6. Analysis completes in <500ms

**Prerequisites:** Epic 3 complete (AI infrastructure ready)

---

**Story 4.2: Writing Style Learning Engine**

As a developer,
I want AI to learn user's writing style from sent emails,
So that generated drafts match user's voice and tone.

**Acceptance Criteria:**
1. Sent emails analyzed for: tone (formal/casual), sentence length, vocabulary
2. Common phrases and sign-offs extracted
3. Greeting patterns identified (Hi/Hello/Hey)
4. Style profile stored and updated incrementally
5. Minimum 10 sent emails required before style application
6. User can trigger style re-learning from settings

**Prerequisites:** Epic 2 (sent emails available)

---

**Story 4.3: Draft Response Generation**

As a user,
I want AI to generate draft replies to my emails,
So that I can respond faster.

**Acceptance Criteria:**
1. "AI Draft" button appears for emails needing response
2. Draft generation triggered on button click or auto-suggested for Urgent emails
3. Draft generated in <2 seconds using local LLM
4. Draft matches user's writing style (from Story 4.2)
5. Draft addresses questions and context from email
6. Fallback skeleton placeholder shown if generation takes >3s (with silent retry)

**Prerequisites:** Story 4.1, Story 4.2

---

**Story 4.4: Draft Review UI with One-Click Workflow**

As a user,
I want to quickly review and approve AI drafts,
So that I can send responses efficiently.

**Acceptance Criteria:**
1. Draft displayed in expandable panel below email
2. Three action buttons: Approve, Edit, Reject
3. Approve: Immediately sends draft (or queues if offline)
4. Edit: Opens compose interface with draft pre-populated
5. Reject: Dismisses draft, logs feedback for AI learning
6. Keyboard shortcuts: cmd/ctrl+enter (approve), e (edit), esc (reject)

**Prerequisites:** Story 4.3

---

**Story 4.5: Inline Draft Editing**

As a user,
I want to make quick edits to AI drafts without opening full composer,
So that I can adjust small details efficiently.

**Acceptance Criteria:**
1. Click on draft text enters edit mode (inline editor)
2. Edit mode supports: text changes, formatting (bold/italic)
3. Changes auto-saved to draft state
4. Approve button sends edited version
5. Edit tracking: AI learns from user's modifications
6. Cancel option reverts to original draft

**Prerequisites:** Story 4.4

---

**Story 4.6: Draft Quality Confidence Scoring**

As a user,
I want to see how confident AI is about each draft,
So that I know which drafts need more review.

**Acceptance Criteria:**
1. Confidence score (0-100%) displayed with each draft
2. Visual indicator: green (>80%), yellow (60-80%), red (<60%)
3. Low confidence (<60%) shows warning: "Review carefully"
4. Confidence factors: context clarity, style match, complexity
5. User can set threshold: only show drafts above X% confidence
6. Confidence score helps prioritize which drafts to review first

**Prerequisites:** Story 4.3

---

**Story 4.7: Smart Timing Suggestions**

As a user,
I want AI to suggest optimal send timing,
So that my responses arrive at the right moment.

**Acceptance Criteria:**
1. AI analyzes: urgency, recipient time zone, user's send patterns
2. Suggestion displayed: "Send now" vs. "Send at 9am tomorrow"
3. User can override suggestion with custom time
4. Scheduled sends queued locally, sent at specified time
5. User can review/edit scheduled sends before they're sent
6. Suggestion reasoning explained: "Recipient typically responds in mornings"

**Prerequisites:** Story 4.4

---

**Story 4.8: Feedback Loop - Draft Learning**

As a developer,
I want AI to learn from user's draft approvals and edits,
So that future drafts improve in quality.

**Acceptance Criteria:**
1. Approved drafts stored as positive examples
2. Rejected drafts stored as negative examples
3. User edits analyzed: what changed and why
4. Style model updated incrementally (weekly batch retraining)
5. Confidence scoring adjusted based on feedback
6. User sees improvement message: "AI draft quality improving"

**Prerequisites:** Story 4.5

---

**Story 4.9: Multi-Response Scenarios (Reply, Reply-All, Forward)**

As a user,
I want AI drafts for all response types,
So that I can use AI assistance regardless of action.

**Acceptance Criteria:**
1. Reply: AI generates response to sender only
2. Reply-All: AI includes context for all recipients
3. Forward: AI drafts forwarding context (e.g., "FYI, see below")
4. Draft adapts to response type (tone, audience awareness)
5. User can switch response type after draft generated
6. Draft regenerates if response type changed

**Prerequisites:** Story 4.3

---

**Story 4.10: Draft Templates & Common Responses**

As a user,
I want AI to learn my common response patterns,
So that frequent replies are instantly available.

**Acceptance Criteria:**
1. AI identifies common response types: confirmation, decline, follow-up request
2. Templates auto-created from user's sent email patterns
3. Template suggestions shown for matching scenarios
4. User can manually create/edit templates
5. Templates integrated into draft generation (faster, more consistent)
6. Template library accessible in settings

**Prerequisites:** Story 4.2, Story 4.8

---
