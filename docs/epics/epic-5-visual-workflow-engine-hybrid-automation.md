# Epic 5: Visual Workflow Engine & Hybrid Automation

## Expanded Goal

Implement visual workflow editor allowing users to create deterministic automation using attributes, with AI-enhanced decision nodes. This epic integrates attributes (Epic 2) and AI capabilities (Epics 3-4) into a powerful automation system. The workflow engine provides deterministic, user-controlled automation that power users demand, while AI suggestions make workflows accessible to casual users. Workflows execute using reliable attribute data (not AI predictions), ensuring reproducible and trustworthy behavior.

## Value Delivery

By the end of this epic, users can:
- Create workflows using drag-and-drop visual editor
- Define workflow triggers (email arrives, attribute changes, time-based)
- Set conditions using attribute values, sender rules, content analysis
- Execute actions (apply attributes, send email, archive, label)
- Use AI-enhanced decision nodes for intelligent branching
- Access workflow templates and AI-suggested workflows based on email patterns
- Execute workflows using deterministic attribute data (100% reliable, offline-capable)
- View workflow execution logs showing what executed, when, and why
- Debug and troubleshoot workflows with detailed execution history

## Story Breakdown

**Story 5.1: Workflow Data Model & Engine Core**

As a developer,
I want a workflow data model and execution engine,
So that users can define and execute automation rules.

**Acceptance Criteria:**
1. RxDB schema for workflows collection: id, name, enabled, triggers, nodes, variables
2. Workflow execution engine: reads workflow definition, evaluates conditions, executes actions
3. Node types defined: trigger, condition, action, decision, variable
4. Trigger types: email_arrives, attribute_changes, schedule (time-based)
5. Action types: apply_attribute, send_email, archive, delete, label, move_folder
6. Condition evaluation: attribute value matches, sender matches regex, content contains keywords
7. Workflow variables for data passing between nodes (e.g., extract subject, use in action)
8. Execution happens in background worker (doesn't block UI)

**Prerequisites:** Epic 2 complete (Attributes), Epic 3 complete (AI Triage)

---

**Story 5.2: Visual Workflow Editor - Canvas & Node Placement**

As a user,
I want a visual drag-and-drop editor to create workflows,
So that I can design automation without code.

**Acceptance Criteria:**
1. Workflow editor UI with canvas (using react-flow or similar library)
2. Node palette showing available node types (trigger, condition, action, decision)
3. Drag-and-drop nodes from palette to canvas
4. Connect nodes with arrows to define flow
5. Visual indicators: trigger (green), condition (yellow), action (blue), decision (purple)
6. Canvas pan and zoom (trackpad gestures, mouse wheel)
7. Node selection, move, delete operations
8. Grid snapping for clean alignment

**Prerequisites:** Story 5.1

---

**Story 6.3: Workflow Trigger Configuration**

As a user,
I want to configure when my workflow should run,
So that automation executes at the right time.

**Acceptance Criteria:**
1. Trigger node configuration panel
2. Email arrives trigger: select labels/folders to watch (e.g., "Run when email arrives in Inbox")
3. Attribute changes trigger: select attribute + value (e.g., "Run when Status changes to To-Do")
4. Schedule trigger: cron-like interface for time-based (e.g., "Every day at 9am")
5. Multiple triggers per workflow (OR logic: run if any trigger fires)
6. Test trigger button: simulate trigger to test workflow
7. Trigger event log: see when triggers fired

**Prerequisites:** Story 5.2

---

**Story 6.4: Workflow Condition Nodes - Attribute-Based Logic**

As a user,
I want to add conditional logic to my workflows,
So that actions execute only when conditions are met.

**Acceptance Criteria:**
1. Condition node configuration panel
2. Attribute-based conditions: attribute name + operator (equals, not equals, contains, greater than) + value
3. Multiple conditions with AND/OR logic
4. Example: "If Priority=High AND Project=Alpha"
5. Sender-based conditions: sender email/domain matches pattern
6. Content-based conditions: subject or body contains keywords
7. Visual branching: condition true → one path, condition false → another path
8. Test condition button: evaluate condition against sample email

**Prerequisites:** Story 5.3, Story 2.13 (Attributes)

---

**Story 6.5: Workflow Action Nodes - Apply Attributes, Archive, Label**

As a user,
I want to define actions my workflow should execute,
So that automation completes tasks for me.

**Acceptance Criteria:**
1. Action node configuration panel
2. Apply attribute action: select attribute + value to apply
3. Archive action: move email to Archive folder
4. Delete action: move email to Trash
5. Label action: apply Gmail label
6. Move folder action: move to specified folder
7. Mark read/unread action
8. Actions execute sequentially in workflow order
9. Action execution logged (timestamp, email ID, action taken)

**Prerequisites:** Story 5.4

---

**Story 6.6: AI-Enhanced Decision Nodes**

As a power user,
I want AI-powered decision nodes in my workflows,
So that automation can make intelligent decisions based on email content.

**Acceptance Criteria:**
1. AI decision node type added to palette
2. Decision node configuration: define question for AI (e.g., "Does this email need immediate response?")
3. AI analyzes email content and answers yes/no
4. Workflow branches based on AI response (yes path, no path)
5. AI confidence threshold configurable (e.g., only branch if confidence >80%)
6. Explainability: AI reasoning shown in workflow execution log
7. Fallback behavior if AI fails: default path (user-configured)
8. Example workflow: "If AI says urgent → notify, else → move to Updates folder"

**Prerequisites:** Story 5.5, Story 3.2 (Email Analysis Engine)

---

**Story 6.7: Workflow Variables & Data Passing**

As a power user,
I want to extract data from emails and use it in workflow actions,
So that automation can be dynamic and contextual.

**Acceptance Criteria:**
1. Variable nodes: extract data from email (sender, subject, body text, date)
2. Variable storage: temporary variables scoped to workflow execution
3. Variable usage in actions: insert variable into email template, attribute value
4. Example: Extract "deadline" from subject → Store as variable → Set Due-Date attribute to deadline value
5. Variable types: string, date, number, boolean
6. Variable transformations: uppercase, lowercase, substring, regex extract
7. Variable debugging: show variable values in execution log

**Prerequisites:** Story 5.5

---

**Story 6.8: Screen Flows - Multi-Step User Interaction**

As a user,
I want workflows that pause for my input,
So that I can confirm or provide data before automation continues.

**Acceptance Criteria:**
1. Screen flow node type: pauses workflow and shows UI modal
2. Modal displays: message, input fields, buttons (Continue, Cancel)
3. User input captured as variables and used in subsequent nodes
4. Example workflow: "Email arrives → Show modal: 'Which project is this?' → User selects → Apply Project attribute"
5. Timeout configuration: if user doesn't respond in N minutes, take default action
6. Screen flow history: see pending and completed screen flows
7. Screen flow notifications: notify user when input needed

**Prerequisites:** Story 5.7

---

**Story 6.9: Workflow Templates & AI-Suggested Workflows**

As a user,
I want pre-built workflow templates and AI suggestions,
So that I can quickly set up common automation patterns.

**Acceptance Criteria:**
1. Workflow template library in settings
2. Built-in templates: "Auto-archive newsletters", "Escalate urgent client emails", "Triage internal vs external"
3. Template import: one-click add template to user's workflows
4. AI workflow suggestions: AI analyzes user email patterns and suggests workflows
5. Example: "I notice you always archive emails from @newsletter.com after reading. Want me to create a workflow?"
6. Suggestion UI: shows suggested workflow diagram, accept/reject buttons
7. Accepted suggestions added to workflows, activated automatically
8. Suggestion dismissal: user can dismiss and won't see again

**Prerequisites:** Story 5.5, Story 3.13 (AI Learning)

---

**Story 6.10: Workflow Execution Engine - Trigger Processing & Action Queue**

As a developer,
I want reliable workflow execution with queuing and retry logic,
So that workflows run consistently even under load.

**Acceptance Criteria:**
1. Workflow execution triggered by events (email sync, attribute changes, schedule)
2. Execution queue: workflows queued for processing, processed sequentially
3. Parallel execution for independent workflows (multiple workflows can run simultaneously)
4. Retry logic for failed actions (e.g., send email fails due to network → retry 3 times)
5. Workflow timeout: abort if execution exceeds N minutes
6. Error handling: log errors, notify user, mark workflow as failed
7. Execution history: track all workflow runs (success, failure, duration)

**Prerequisites:** Story 5.1, Story 5.5

---

**Story 6.11: Workflow Execution Logs & Debugging**

As a user,
I want detailed logs of workflow executions,
So that I can understand what automation did and troubleshoot issues.

**Acceptance Criteria:**
1. Workflow execution log viewer in UI
2. Log entry shows: workflow name, trigger event, start time, duration, status (success/failed)
3. Detailed step-by-step log: each node execution, conditions evaluated, actions taken
4. Email context: link to email that triggered workflow
5. Variable values logged at each step
6. Error messages shown for failed steps
7. Filter logs: by workflow, by date range, by status
8. Export logs to JSON/CSV for analysis

**Prerequisites:** Story 5.10

---

**Story 6.12: Workflow Enable/Disable & Management**

As a user,
I want to manage my workflows (enable, disable, edit, delete),
So that I can control which automations are active.

**Acceptance Criteria:**
1. Workflows list view: shows all workflows with status (enabled/disabled)
2. Toggle switch to enable/disable workflow (disabling prevents trigger from firing)
3. Edit workflow: opens visual editor with existing workflow loaded
4. Duplicate workflow: create copy to modify
5. Delete workflow: soft delete with confirmation dialog
6. Workflow statistics: show execution count, success rate, last run time
7. Search/filter workflows by name, trigger type, status

**Prerequisites:** Story 5.11

---

**Story 5.13: Workflow Performance Optimization**

As a developer,
I want workflow execution to be fast and efficient,
So that automation doesn't impact user experience.

**Acceptance Criteria:**
1. Workflow execution completes in <500ms for simple workflows (3-5 nodes)
2. Complex workflows (10+ nodes) complete in <2 seconds
3. Workflows execute in Web Worker (doesn't block UI thread)
4. Workflow definitions cached in memory (loaded once, reused)
5. Attribute queries optimized (use RxDB indexes)
6. Batch execution: multiple emails triggering same workflow processed in batch
7. Performance monitoring: track execution times, identify slow workflows

**Prerequisites:** Story 5.10

**Estimated Effort:** 6 hours

---

**Story 5.14: Audit Workflow Editor for Keyboard Navigation and ARIA Compliance** *(NEW - Gate-Check Medium Priority)*

As a user with disabilities,
I want the workflow editor to be fully accessible via keyboard and screen reader,
So that I can create and edit workflows without using a mouse.

**Acceptance Criteria:**

**Keyboard Navigation:**
1. Full keyboard navigation for workflow editor:
   - Tab: Navigate between nodes, edges, toolbar buttons
   - Arrow keys: Move focus between connected nodes
   - Enter: Open node editor modal
   - Escape: Close modals, cancel drag operations
   - Space: Select/deselect nodes
   - Ctrl+C/V: Copy/paste nodes
   - Delete: Remove selected nodes/edges
2. Node editor modal fully keyboard accessible
3. Toolbar buttons keyboard accessible
4. Node palette keyboard accessible (Tab to select, Enter to add)

**ARIA Labels and Roles:**
5. ARIA roles assigned to all components:
   - Canvas: `role="region"` `aria-label="Workflow canvas"`
   - Nodes: `role="button"` `aria-label="Trigger Node: Email Arrives"`
   - Edges: `aria-label="Connection from node 1 to node 2"`
   - Toolbar: `role="toolbar"` `aria-label="Workflow tools"`
6. Node type announced by screen reader (e.g., "Trigger Node", "Condition Node")
7. Node connections announced (e.g., "Connected to Decision Node")
8. Workflow state changes announced (e.g., "Workflow enabled", "Node added")

**Focus Management:**
9. Focus indicator visible (2px blue outline) on all focusable elements
10. Focus trapped in modals (doesn't escape to background)
11. Focus restored to triggering element when modal closes
12. Skip links provided (e.g., "Skip to canvas", "Skip to toolbar")

**Screen Reader Support:**
13. Screen reader announces:
    - Node types when focused
    - Node connections when traversing
    - Validation errors when saving workflow
    - Success messages when workflow saved
14. ARIA live regions for dynamic updates
15. Workflow execution status announced (e.g., "Workflow running", "Workflow completed")

**Color Contrast:**
16. All text meets WCAG 2.1 AA: ≥4.5:1 contrast ratio
17. Node colors distinguishable (not relying on color alone)
18. Focus indicators meet 3:1 contrast ratio

**Testing:**
19. Playwright accessibility tests with axe-core run in CI
20. Manual testing with NVDA (Windows) and VoiceOver (macOS)
21. Manual keyboard-only testing (no mouse)
22. Test: All features accessible via keyboard
23. Test: Screen reader announces all important information
24. Test: No WCAG 2.1 AA violations

**Prerequisites:** Story 5.2 (Visual Workflow Editor)

**Estimated Effort:** 8 hours

---
