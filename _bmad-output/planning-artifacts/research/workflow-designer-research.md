# Workflow Visual Designer Best Practices: Research for Claine v2

**Document Version**: 1.0
**Date**: 2025-10-28
**Status**: Research & Recommendations

---

## Executive Summary

This document provides practical guidance for building Claine v2's email automation workflow designer. Based on analysis of current v1 implementation (ReactFlow-based), industry patterns from n8n/Pipedream, and email-specific automation needs.

### Key Findings

**ReactFlow Assessment**: ✅ **RECOMMENDED** - Keep ReactFlow for v2

- Mature library (12.7.1 → latest 12.x)
- Built-in features align with email workflow needs
- Lower learning curve than alternatives (Rete.js)
- Strong community, regular updates, TypeScript support

**Critical v1 Issues to Address**:

1. Workflow execution logic in entity (should be domain service)
2. Missing workflow validation before activation
3. No error handling/retry logic in execution
4. Limited visual feedback for execution state
5. No workflow versioning

**Implementation Priority**:

1. **Phase 1**: Fix execution engine architecture (domain service pattern)
2. **Phase 2**: Enhance UX (auto-layout, validation, keyboard shortcuts)
3. **Phase 3**: Add monitoring & error handling
4. **Phase 4**: Implement version control

---

## 1. Workflow Designer Libraries Comparison

### 1.1 Library Comparison Table

| Feature                       | ReactFlow        | Rete.js   | Custom Canvas | n8n Pattern    |
| ----------------------------- | ---------------- | --------- | ------------- | -------------- |
| **Learning Curve**            | Low ⭐⭐⭐       | High ⭐   | Medium ⭐⭐   | N/A (full app) |
| **TypeScript Support**        | Excellent        | Good      | Full control  | Excellent      |
| **Bundle Size**               | ~200KB           | ~150KB    | Minimal       | N/A            |
| **Auto-layout**               | Plugin available | Manual    | Manual        | Built-in       |
| **Connection Validation**     | Built-in hooks   | Manual    | Manual        | Custom         |
| **Undo/Redo**                 | Manual           | Manual    | Manual        | Built-in       |
| **Performance (1000+ nodes)** | Excellent        | Good      | Excellent     | Good           |
| **Mobile Support**            | Limited          | Limited   | Full control  | Desktop only   |
| **Customization**             | High             | Very High | Total         | N/A            |
| **Email Workflow Fit**        | ⭐⭐⭐⭐⭐       | ⭐⭐⭐    | ⭐⭐⭐⭐      | ⭐⭐⭐⭐⭐     |
| **Maintenance Burden**        | Low              | Medium    | High          | N/A            |
| **Documentation**             | Excellent        | Good      | N/A           | Good           |

### 1.2 ReactFlow - Detailed Analysis

**Pros for Email Automation**:

- ✅ Built-in edge validation hooks (`isValidConnection`)
- ✅ Node selection, drag-drop, pan-zoom out of box
- ✅ Custom node types (perfect for trigger/action/condition nodes)
- ✅ Minimap for large workflows
- ✅ Controlled/uncontrolled mode (fits React state management)
- ✅ Edge types (straight, step, smooth, custom) for visual clarity
- ✅ Sub-flows support (group nodes logically)

**Cons**:

- ⚠️ No built-in undo/redo (need custom implementation)
- ⚠️ Auto-layout requires external library (dagre/elk)
- ⚠️ Persistence layer is manual (good - allows flexibility)
- ⚠️ Execution engine separate (expected for domain logic)

**Current v1 Usage**:

```typescript
// From domain model analysis
export class Workflow {
  public nodes: WorkflowNode[] // ReactFlow nodes
  public edges: WorkflowEdge[] // ReactFlow edges
  public triggers: WorkflowTrigger[]
  public conditions: WorkflowCondition[]
  public actions: WorkflowAction[]
}
```

**Recommendation**: Keep ReactFlow, but separate concerns:

- **ReactFlow**: Visual editing only (UI layer)
- **Domain Model**: Execution logic (business layer)
- **Mapping Layer**: Convert ReactFlow nodes ↔ Domain entities

### 1.3 Rete.js - Alternative Analysis

**When to Consider**:

- Need complete control over rendering engine
- Building complex, nested sub-workflows
- Require dynamic node input/output ports

**Why Not for Claine**:

- Steeper learning curve (custom React renderer needed)
- Email workflows are relatively simple (trigger → condition → action)
- ReactFlow's built-in features suffice

### 1.4 n8n Pattern Analysis

**Key Patterns to Adopt**:

1. **Node Categorization**:
   - Triggers (start workflow)
   - Actions (do something)
   - Conditions (if/then logic)
   - Control flow (loops, wait, error handling)

2. **Connection Rules**:
   - Single trigger per workflow
   - Conditions have true/false outputs
   - Actions can chain
   - Error handlers branch from any node

3. **Execution Model**:
   - Linear execution (node by node)
   - Data passed between nodes
   - Execution context preserved
   - Pause/resume support

**n8n Schema Example** (adapted for email):

```typescript
interface N8nNode {
  id: string
  type: 'trigger' | 'action' | 'condition' | 'control'
  position: { x: number; y: number }
  parameters: Record<string, any>
  credentials?: string
}

interface N8nWorkflow {
  nodes: N8nNode[]
  connections: {
    [sourceNodeId: string]: {
      [outputIndex: number]: Array<{
        node: string
        type: string
        index: number
      }>
    }
  }
  settings: {
    executionOrder: 'v1' // Linear execution
  }
}
```

**Adaptation for Claine**:

- Simpler connection model (ReactFlow edges)
- Email-specific node types
- Gmail API credentials per workflow
- Execution state tracking per thread

---

## 2. UX Best Practices for Email Workflow Designer

### 2.1 Node Interaction Patterns

#### Node Types & Visual Design

```typescript
// Node type definitions
type EmailNodeType =
  | 'trigger.new_email'
  | 'trigger.label_added'
  | 'trigger.schedule'
  | 'condition.has_label'
  | 'condition.from_sender'
  | 'condition.subject_contains'
  | 'condition.has_attachment'
  | 'action.add_label'
  | 'action.send_email'
  | 'action.forward'
  | 'action.archive'
  | 'action.mark_read'
  | 'control.wait'
  | 'control.error_handler'

// Visual styling by category
const nodeStyles = {
  trigger: {
    borderColor: '#10b981', // green
    icon: '▶️',
    bgColor: '#d1fae5',
  },
  condition: {
    borderColor: '#f59e0b', // amber
    icon: '◆',
    bgColor: '#fef3c7',
    shape: 'diamond', // Visual indicator
  },
  action: {
    borderColor: '#3b82f6', // blue
    icon: '⚡',
    bgColor: '#dbeafe',
  },
  control: {
    borderColor: '#8b5cf6', // purple
    icon: '⏸',
    bgColor: '#ede9fe',
  },
}
```

#### Node States

```typescript
type NodeState =
  | 'idle' // Not executing
  | 'running' // Currently executing
  | 'success' // Last execution successful
  | 'error' // Last execution failed
  | 'disabled' // Node disabled
  | 'invalid' // Configuration invalid

// Visual feedback
const stateStyles = {
  running: {
    border: '2px dashed #3b82f6',
    animation: 'pulse 2s infinite',
  },
  success: {
    border: '2px solid #10b981',
    icon: '✓',
  },
  error: {
    border: '2px solid #ef4444',
    icon: '✗',
    shake: true,
  },
  invalid: {
    border: '2px dotted #f59e0b',
    icon: '⚠',
  },
}
```

### 2.2 Drag-and-Drop Patterns

**Node Palette** (Sidebar):

```typescript
// Group nodes by category
const nodePalette = {
  Triggers: [
    { type: 'trigger.new_email', label: 'New Email', description: 'When new email arrives' },
    { type: 'trigger.label_added', label: 'Label Added', description: 'When label is applied' },
    { type: 'trigger.schedule', label: 'Schedule', description: 'Run on schedule' },
  ],
  Conditions: [
    { type: 'condition.has_label', label: 'Has Label', description: 'Check if email has label' },
    { type: 'condition.from_sender', label: 'From Sender', description: 'Check sender email' },
    {
      type: 'condition.subject_contains',
      label: 'Subject Contains',
      description: 'Check subject text',
    },
  ],
  Actions: [
    { type: 'action.add_label', label: 'Add Label', description: 'Apply label to email' },
    { type: 'action.send_email', label: 'Send Email', description: 'Send new email' },
    { type: 'action.forward', label: 'Forward', description: 'Forward to address' },
  ],
}

// Drag interaction
const onNodeDragStart = (event: DragEvent, nodeType: string) => {
  event.dataTransfer.setData('application/reactflow', nodeType)
  event.dataTransfer.effectAllowed = 'move'
}

const onNodeDrop = (event: DragEvent) => {
  const nodeType = event.dataTransfer.getData('application/reactflow')
  const position = screenToFlowPosition({
    x: event.clientX,
    y: event.clientY,
  })

  addNode({
    id: generateId(),
    type: nodeType,
    position,
    data: getDefaultData(nodeType),
  })
}
```

**UX Best Practices**:

- Show ghost/preview while dragging
- Snap to grid (16px or 20px)
- Highlight drop zones
- Auto-connect to selected node
- Keyboard shortcut: Spacebar opens quick-add menu at cursor

### 2.3 Connection Validation

```typescript
// Email workflow connection rules
const isValidConnection = (connection: Connection): boolean => {
  const sourceNode = getNode(connection.source)
  const targetNode = getNode(connection.target)

  // Rule 1: No self-connections
  if (connection.source === connection.target) return false

  // Rule 2: Only one trigger per workflow
  if (targetNode.type.startsWith('trigger.')) return false

  // Rule 3: Triggers must be first (no incoming edges)
  if (sourceNode.type.startsWith('trigger.')) {
    const outgoing = getOutgoingEdges(sourceNode.id)
    if (outgoing.length > 0) return false // Single trigger
  }

  // Rule 4: Conditions must connect to true/false branches
  if (sourceNode.type.startsWith('condition.')) {
    const handle = connection.sourceHandle // 'true' or 'false'
    if (!handle) return false
  }

  // Rule 5: No circular dependencies
  if (wouldCreateCycle(connection)) return false

  return true
}

// Visual feedback
const connectionLineStyle = {
  stroke: '#94a3b8', // neutral gray
  strokeWidth: 2,
  strokeDasharray: '5 5', // dashed while dragging
}

const edgeStyle = {
  valid: { stroke: '#64748b', strokeWidth: 2 },
  invalid: { stroke: '#ef4444', strokeWidth: 2, strokeDasharray: '5 5' },
  active: { stroke: '#3b82f6', strokeWidth: 3 }, // executing
}
```

### 2.4 Auto-Layout Implementation

**Strategy**: Use Dagre for hierarchical layout

```typescript
import dagre from 'dagre'

interface LayoutOptions {
  direction: 'TB' | 'LR' // Top-to-bottom or Left-to-right
  nodeWidth: number
  nodeHeight: number
  ranksep: number // Vertical spacing
  nodesep: number // Horizontal spacing
}

const autoLayout = (nodes: Node[], edges: Edge[], options: LayoutOptions) => {
  const dagreGraph = new dagre.graphlib.Graph()
  dagreGraph.setDefaultEdgeLabel(() => ({}))
  dagreGraph.setGraph({
    rankdir: options.direction,
    ranksep: options.ranksep,
    nodesep: options.nodesep,
  })

  // Add nodes
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, {
      width: options.nodeWidth,
      height: options.nodeHeight,
    })
  })

  // Add edges
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target)
  })

  // Calculate layout
  dagre.layout(dagreGraph)

  // Apply positions
  return nodes.map((node) => {
    const position = dagreGraph.node(node.id)
    return {
      ...node,
      position: {
        x: position.x - options.nodeWidth / 2,
        y: position.y - options.nodeHeight / 2,
      },
    }
  })
}

// Usage
const onAutoLayout = () => {
  const layoutedNodes = autoLayout(nodes, edges, {
    direction: 'TB',
    nodeWidth: 200,
    nodeHeight: 80,
    ranksep: 100,
    nodesep: 50,
  })

  setNodes(layoutedNodes)
}
```

**When to Auto-Layout**:

- User clicks "Organize" button
- After importing workflow
- When workflow becomes messy (detect overlapping nodes)

**Preserve User Intent**:

- Don't auto-layout on every change
- Allow manual override
- Animate transition (smooth, not jarring)

### 2.5 Keyboard Shortcuts

```typescript
const keyboardShortcuts = {
  // Node manipulation
  Delete: 'Delete selected nodes/edges',
  'Cmd+D': 'Duplicate selected nodes',
  'Cmd+C': 'Copy selected nodes',
  'Cmd+V': 'Paste nodes',

  // Canvas navigation
  Space: 'Pan mode (drag canvas)',
  'Cmd+0': 'Fit view',
  'Cmd++': 'Zoom in',
  'Cmd+-': 'Zoom out',

  // Workflow actions
  'Cmd+Z': 'Undo',
  'Cmd+Shift+Z': 'Redo',
  'Cmd+S': 'Save workflow',
  'Cmd+Enter': 'Run workflow',

  // Node creation
  A: 'Quick add node (at cursor)',
  T: 'Add trigger node',
  C: 'Add condition node',

  // Selection
  'Cmd+A': 'Select all',
  Esc: 'Deselect all',
}

// Implementation
const useWorkflowKeyboard = () => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Delete
      if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelectedElements()
        return
      }

      // Undo/Redo
      if (e.metaKey && e.key === 'z') {
        if (e.shiftKey) {
          redo()
        } else {
          undo()
        }
        return
      }

      // Quick add
      if (e.key === 'a' && !e.metaKey) {
        openQuickAddMenu()
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
```

### 2.6 Undo/Redo Implementation

**Strategy**: Command pattern with history stack

```typescript
interface Command {
  execute: () => void
  undo: () => void
  redo: () => void
}

class AddNodeCommand implements Command {
  constructor(
    private node: Node,
    private addFn: (node: Node) => void,
    private removeFn: (id: string) => void
  ) {}

  execute() {
    this.addFn(this.node)
  }

  undo() {
    this.removeFn(this.node.id)
  }

  redo() {
    this.execute()
  }
}

class WorkflowHistory {
  private history: Command[] = []
  private currentIndex = -1

  execute(command: Command) {
    // Remove any commands after current index
    this.history = this.history.slice(0, this.currentIndex + 1)

    command.execute()
    this.history.push(command)
    this.currentIndex++
  }

  undo() {
    if (this.currentIndex < 0) return

    const command = this.history[this.currentIndex]
    command.undo()
    this.currentIndex--
  }

  redo() {
    if (this.currentIndex >= this.history.length - 1) return

    this.currentIndex++
    const command = this.history[this.currentIndex]
    command.redo()
  }

  canUndo(): boolean {
    return this.currentIndex >= 0
  }

  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1
  }
}

// React integration
const useWorkflowHistory = () => {
  const historyRef = useRef(new WorkflowHistory())

  const addNode = (node: Node) => {
    const command = new AddNodeCommand(
      node,
      (n) => setNodes((nodes) => [...nodes, n]),
      (id) => setNodes((nodes) => nodes.filter((n) => n.id !== id))
    )
    historyRef.current.execute(command)
  }

  return {
    addNode,
    undo: () => historyRef.current.undo(),
    redo: () => historyRef.current.redo(),
    canUndo: historyRef.current.canUndo(),
    canRedo: historyRef.current.canRedo(),
  }
}
```

---

## 3. Email Automation Patterns

### 3.1 Trigger Nodes

```typescript
// Trigger type definitions
interface EmailTrigger {
  type: 'trigger.new_email' | 'trigger.label_added' | 'trigger.schedule'
  config: TriggerConfig
}

// 1. New Email Trigger
interface NewEmailTriggerConfig {
  type: 'trigger.new_email'
  filters?: {
    from?: string[] // Specific senders
    to?: string[] // Specific recipients
    hasAttachment?: boolean
    isUnread?: boolean
  }
  batchMode?: boolean // Process emails one-by-one or in batch
}

// Example workflow node
const newEmailTrigger = {
  id: 'trigger-1',
  type: 'trigger.new_email',
  data: {
    label: 'New Email',
    config: {
      filters: {
        from: ['boss@company.com'],
        hasAttachment: true,
      },
      batchMode: false,
    },
  },
  position: { x: 100, y: 100 },
}

// 2. Label Added Trigger
interface LabelAddedTriggerConfig {
  type: 'trigger.label_added'
  labelId: string // Which label to watch
  includeExisting?: boolean // Run on existing emails with label
}

// 3. Schedule Trigger
interface ScheduleTriggerConfig {
  type: 'trigger.schedule'
  schedule: {
    type: 'interval' | 'cron'
    value: string // '5m', '1h', '0 9 * * 1' (cron)
  }
  query?: string // Gmail search query to run
}
```

**Implementation Pattern**:

```typescript
// Trigger evaluation service
class EmailTriggerService {
  async evaluateTrigger(
    trigger: EmailTrigger,
    context: { thread: Thread; message: Message }
  ): Promise<boolean> {
    switch (trigger.type) {
      case 'trigger.new_email':
        return this.evaluateNewEmail(trigger.config, context)

      case 'trigger.label_added':
        return this.evaluateLabelAdded(trigger.config, context)

      case 'trigger.schedule':
        return this.evaluateSchedule(trigger.config)

      default:
        return false
    }
  }

  private evaluateNewEmail(
    config: NewEmailTriggerConfig,
    { thread, message }: { thread: Thread; message: Message }
  ): boolean {
    // Check if message is new (not processed)
    if (thread.flowState?.processedMessageIds?.includes(message.id)) {
      return false
    }

    // Apply filters
    if (config.filters?.from) {
      const fromEmail = message.from.address.toLowerCase()
      if (!config.filters.from.some((f) => fromEmail.includes(f.toLowerCase()))) {
        return false
      }
    }

    if (config.filters?.hasAttachment !== undefined) {
      if (message.hasAttachments !== config.filters.hasAttachment) {
        return false
      }
    }

    return true
  }
}
```

### 3.2 Condition Nodes

```typescript
// Condition node types
interface EmailCondition {
  type: 'condition.has_label'
      | 'condition.from_sender'
      | 'condition.subject_contains'
      | 'condition.has_attachment'
      | 'condition.is_unread'
      | 'condition.date_range'
      | 'condition.custom_attribute';
  config: ConditionConfig;
}

// 1. Has Label Condition
interface HasLabelConditionConfig {
  type: 'condition.has_label';
  labelIds: string[];        // Check if ANY of these labels exist
  matchAll?: boolean;        // If true, ALL labels must exist
}

// 2. From Sender Condition
interface FromSenderConditionConfig {
  type: 'condition.from_sender';
  senders: string[];         // Email addresses or domains
  matchType: 'exact' | 'contains' | 'domain';
}

// 3. Subject Contains Condition
interface SubjectContainsConditionConfig {
  type: 'condition.subject_contains';
  text: string;
  caseSensitive?: boolean;
  useRegex?: boolean;
}

// ReactFlow node with two output handles (true/false)
const conditionNode = {
  id: 'condition-1',
  type: 'condition.has_label',
  data: {
    label: 'Has Label: Work',
    config: {
      labelIds: ['label-work'],
      matchAll: false
    }
  },
  position: { x: 300, y: 100 }
};

// Custom node component
const ConditionNodeComponent = ({ data, id }) => {
  return (
    <div className="condition-node">
      <div className="node-header">
        <span>◆</span>
        <span>{data.label}</span>
      </div>

      {/* True output (right side, top) */}
      <Handle
        type="source"
        position={Position.Right}
        id="true"
        style={{ top: '30%', background: '#10b981' }}
      />

      {/* False output (right side, bottom) */}
      <Handle
        type="source"
        position={Position.Right}
        id="false"
        style={{ top: '70%', background: '#ef4444' }}
      />

      {/* Input (left side) */}
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: '#64748b' }}
      />
    </div>
  );
};
```

**Condition Evaluation**:

```typescript
class EmailConditionService {
  async evaluateCondition(
    condition: EmailCondition,
    context: { thread: Thread; message: Message }
  ): Promise<boolean> {
    switch (condition.type) {
      case 'condition.has_label':
        return this.evaluateHasLabel(condition.config, context.thread)

      case 'condition.from_sender':
        return this.evaluateFromSender(condition.config, context.message)

      case 'condition.subject_contains':
        return this.evaluateSubjectContains(condition.config, context.thread)

      default:
        return false
    }
  }

  private evaluateHasLabel(config: HasLabelConditionConfig, thread: Thread): boolean {
    const threadLabelIds = thread.labels.map((l) => l.id)

    if (config.matchAll) {
      return config.labelIds.every((labelId) => threadLabelIds.includes(labelId))
    } else {
      return config.labelIds.some((labelId) => threadLabelIds.includes(labelId))
    }
  }

  private evaluateFromSender(config: FromSenderConditionConfig, message: Message): boolean {
    const fromEmail = message.from.address.toLowerCase()

    return config.senders.some((sender) => {
      switch (config.matchType) {
        case 'exact':
          return fromEmail === sender.toLowerCase()

        case 'contains':
          return fromEmail.includes(sender.toLowerCase())

        case 'domain':
          const domain = fromEmail.split('@')[1]
          return domain === sender.toLowerCase()

        default:
          return false
      }
    })
  }
}
```

### 3.3 Action Nodes

```typescript
// Action node types
interface EmailAction {
  type:
    | 'action.add_label'
    | 'action.remove_label'
    | 'action.send_email'
    | 'action.forward'
    | 'action.archive'
    | 'action.mark_read'
    | 'action.star'
    | 'action.move_to_trash'
    | 'action.set_attribute'
  config: ActionConfig
}

// 1. Add Label Action
interface AddLabelActionConfig {
  type: 'action.add_label'
  labelId: string
  createIfNotExists?: boolean
}

// 2. Send Email Action
interface SendEmailActionConfig {
  type: 'action.send_email'
  to: string[] // Can use template variables
  subject: string // Template: "Re: {{subject}}"
  body: string // Template: "Hello {{sender.name}}"
  replyToThreadId?: string // Reply to current thread
  attachments?: {
    type: 'forward' | 'upload'
    files?: string[] // File IDs or URLs
  }
}

// 3. Forward Action
interface ForwardActionConfig {
  type: 'action.forward'
  to: string[]
  includeAttachments?: boolean
  addNote?: string // Prepend note to forwarded email
}

// Template variable system
interface TemplateContext {
  thread: {
    id: string
    subject: string
    snippet: string
  }
  message: {
    from: { name: string; address: string }
    to: Array<{ name: string; address: string }>
    subject: string
    body: string
  }
  labels: string[]
  attributes: Record<string, any>
}

// Template parser
class EmailTemplateParser {
  parse(template: string, context: TemplateContext): string {
    return template.replace(/\{\{([\w.]+)\}\}/g, (match, path) => {
      return this.getValueByPath(context, path) || match
    })
  }

  private getValueByPath(obj: any, path: string): any {
    return path.split('.').reduce((curr, key) => curr?.[key], obj)
  }
}

// Example usage
const templateParser = new EmailTemplateParser()
const subject = templateParser.parse('Re: {{thread.subject}} - Follow up', {
  thread: { subject: 'Meeting tomorrow' /* ... */ },
  // ...
})
// Result: "Re: Meeting tomorrow - Follow up"
```

**Action Execution**:

```typescript
class EmailActionService {
  constructor(
    private gmailApi: GmailApiService,
    private templateParser: EmailTemplateParser
  ) {}

  async executeAction(
    action: EmailAction,
    context: { thread: Thread; message: Message }
  ): Promise<ActionResult> {
    try {
      switch (action.type) {
        case 'action.add_label':
          return await this.executeAddLabel(action.config, context)

        case 'action.send_email':
          return await this.executeSendEmail(action.config, context)

        case 'action.forward':
          return await this.executeForward(action.config, context)

        default:
          throw new Error(`Unknown action type: ${action.type}`)
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date(),
      }
    }
  }

  private async executeAddLabel(
    config: AddLabelActionConfig,
    { thread }: { thread: Thread }
  ): Promise<ActionResult> {
    await this.gmailApi.modifyThread(thread.id, {
      addLabelIds: [config.labelId],
    })

    return {
      success: true,
      message: `Added label ${config.labelId}`,
      timestamp: new Date(),
    }
  }

  private async executeSendEmail(
    config: SendEmailActionConfig,
    context: { thread: Thread; message: Message }
  ): Promise<ActionResult> {
    // Build template context
    const templateContext = this.buildTemplateContext(context)

    // Parse templates
    const subject = this.templateParser.parse(config.subject, templateContext)
    const body = this.templateParser.parse(config.body, templateContext)

    // Send email
    const messageId = await this.gmailApi.sendMessage({
      to: config.to,
      subject,
      body,
      threadId: config.replyToThreadId || context.thread.id,
    })

    return {
      success: true,
      message: `Sent email ${messageId}`,
      data: { messageId },
      timestamp: new Date(),
    }
  }
}
```

### 3.4 Error Handling Patterns

```typescript
// Error handler node
interface ErrorHandlerConfig {
  type: 'control.error_handler'
  strategy: 'retry' | 'ignore' | 'notify' | 'fallback'
  retryConfig?: {
    maxAttempts: number
    delayMs: number
    backoffMultiplier?: number // Exponential backoff
  }
  notifyConfig?: {
    email?: string
    webhook?: string
  }
  fallbackNodeId?: string // Alternative path on error
}

// Workflow execution with error handling
class WorkflowExecutionEngine {
  async executeNode(node: WorkflowNode, context: ExecutionContext): Promise<NodeExecutionResult> {
    const maxAttempts = node.errorHandler?.retryConfig?.maxAttempts || 1
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // Execute node logic
        const result = await this.executeNodeLogic(node, context)

        // Success - record in execution log
        this.recordExecution({
          nodeId: node.id,
          status: 'success',
          attempt,
          result,
          timestamp: new Date(),
        })

        return result
      } catch (error) {
        lastError = error

        // Log attempt
        this.recordExecution({
          nodeId: node.id,
          status: 'error',
          attempt,
          error: error.message,
          timestamp: new Date(),
        })

        // Check if should retry
        if (attempt < maxAttempts) {
          const delay = this.calculateRetryDelay(attempt, node.errorHandler?.retryConfig)
          await this.sleep(delay)
          continue
        }

        // Max attempts reached - handle error
        return await this.handleNodeError(node, error, context)
      }
    }

    throw lastError
  }

  private async handleNodeError(
    node: WorkflowNode,
    error: Error,
    context: ExecutionContext
  ): Promise<NodeExecutionResult> {
    const strategy = node.errorHandler?.strategy || 'ignore'

    switch (strategy) {
      case 'retry':
        // Already handled by loop above
        throw error

      case 'ignore':
        // Continue workflow, mark node as skipped
        return { status: 'skipped', error: error.message }

      case 'notify':
        // Send notification and stop workflow
        await this.sendErrorNotification(node, error)
        throw error

      case 'fallback':
        // Execute alternative path
        const fallbackNode = this.getNode(node.errorHandler.fallbackNodeId)
        return await this.executeNode(fallbackNode, context)

      default:
        throw error
    }
  }

  private calculateRetryDelay(attempt: number, config?: ErrorHandlerConfig['retryConfig']): number {
    if (!config) return 1000

    const baseDelay = config.delayMs
    const multiplier = config.backoffMultiplier || 1

    // Exponential backoff: delay * (multiplier ^ attempt)
    return baseDelay * Math.pow(multiplier, attempt - 1)
  }

  private async sendErrorNotification(node: WorkflowNode, error: Error): Promise<void> {
    const config = node.errorHandler?.notifyConfig
    if (!config) return

    const message = `
      Workflow Error

      Node: ${node.data.label}
      Error: ${error.message}
      Time: ${new Date().toISOString()}
    `

    if (config.email) {
      await this.emailService.send({
        to: config.email,
        subject: 'Workflow Error',
        body: message,
      })
    }

    if (config.webhook) {
      await fetch(config.webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          node: node.id,
          error: error.message,
          timestamp: new Date(),
        }),
      })
    }
  }
}
```

---

## 4. Technical Architecture

### 4.1 Workflow Schema (JSON)

**Domain Model** (business logic):

```typescript
// Domain entity (from v1 analysis)
export class Workflow {
  public readonly id: string
  public name: string
  public description?: string

  // ReactFlow visual data
  public nodes: WorkflowNode[]
  public edges: WorkflowEdge[]

  // Execution data
  public triggers: WorkflowTrigger[]
  public conditions: WorkflowCondition[]
  public actions: WorkflowAction[]

  // State
  public isActive: boolean
  public isValid: boolean
  public version: number

  // Metadata
  public userId: string
  public createdAt: Date
  public updatedAt: Date
  public executionCount: number
  public lastExecutionAt?: Date
}
```

**Persistence Schema** (database):

```typescript
// RxDB schema for workflows
const workflowSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 36 },
    name: { type: 'string' },
    description: { type: 'string' },

    // ReactFlow visual data (stored as JSON)
    visualData: {
      type: 'object',
      properties: {
        nodes: { type: 'array' },
        edges: { type: 'array' },
        viewport: {
          type: 'object',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' },
            zoom: { type: 'number' },
          },
        },
      },
    },

    // Compiled execution data
    executionData: {
      type: 'object',
      properties: {
        triggers: { type: 'array' },
        nodes: { type: 'array' }, // Execution graph (different from visual)
        entryNodeId: { type: 'string' },
      },
    },

    // State
    isActive: { type: 'boolean' },
    isValid: { type: 'boolean' },
    version: { type: 'number' },

    // Metadata
    userId: { type: 'string' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },

    // Stats
    stats: {
      type: 'object',
      properties: {
        executionCount: { type: 'number' },
        successCount: { type: 'number' },
        errorCount: { type: 'number' },
        lastExecutionAt: { type: 'string', format: 'date-time' },
      },
    },
  },
  required: ['id', 'name', 'userId', 'createdAt', 'updatedAt'],
  indexes: ['userId', 'isActive', 'createdAt'],
}
```

**Separation of Concerns**:

```typescript
// Visual data (ReactFlow) - UI layer
interface WorkflowVisualData {
  nodes: Array<{
    id: string
    type: string
    position: { x: number; y: number }
    data: Record<string, any> // Node configuration
  }>
  edges: Array<{
    id: string
    source: string
    target: string
    sourceHandle?: string
    targetHandle?: string
  }>
  viewport?: {
    x: number
    y: number
    zoom: number
  }
}

// Execution data (Domain) - Business logic
interface WorkflowExecutionData {
  triggers: WorkflowTrigger[]
  nodes: ExecutionNode[] // Optimized execution graph
  entryNodeId: string // Where to start execution
}

interface ExecutionNode {
  id: string
  type: string
  config: NodeConfig
  nextNodes: {
    default?: string // Next node for actions
    true?: string // True branch for conditions
    false?: string // False branch for conditions
    error?: string // Error handler
  }
}

// Compiler: Visual → Execution
class WorkflowCompiler {
  compile(visual: WorkflowVisualData): WorkflowExecutionData {
    // 1. Find trigger node
    const triggerNode = visual.nodes.find((n) => n.type.startsWith('trigger.'))
    if (!triggerNode) {
      throw new Error('Workflow must have a trigger node')
    }

    // 2. Build execution graph
    const executionNodes = this.buildExecutionGraph(visual)

    // 3. Extract triggers
    const triggers = this.extractTriggers(visual.nodes)

    return {
      triggers,
      nodes: executionNodes,
      entryNodeId: triggerNode.id,
    }
  }

  private buildExecutionGraph(visual: WorkflowVisualData): ExecutionNode[] {
    return visual.nodes.map((node) => {
      // Find outgoing edges
      const outgoingEdges = visual.edges.filter((e) => e.source === node.id)

      // Build next node mapping
      const nextNodes: ExecutionNode['nextNodes'] = {}

      if (node.type.startsWith('condition.')) {
        // Condition nodes have true/false branches
        const trueEdge = outgoingEdges.find((e) => e.sourceHandle === 'true')
        const falseEdge = outgoingEdges.find((e) => e.sourceHandle === 'false')

        if (trueEdge) nextNodes.true = trueEdge.target
        if (falseEdge) nextNodes.false = falseEdge.target
      } else {
        // Action/trigger nodes have single next
        const nextEdge = outgoingEdges[0]
        if (nextEdge) nextNodes.default = nextEdge.target
      }

      return {
        id: node.id,
        type: node.type,
        config: node.data.config,
        nextNodes,
      }
    })
  }
}
```

### 4.2 State Management

**Architecture**:

```
┌─────────────────────────────────────────────────────────┐
│                    UI Layer (React)                      │
│  ┌────────────────────────────────────────────────────┐ │
│  │  WorkflowEditor Component                          │ │
│  │  - ReactFlow instance                              │ │
│  │  - Node palette                                    │ │
│  │  - Toolbar (save, run, etc.)                       │ │
│  └────────────────┬───────────────────────────────────┘ │
└───────────────────┼───────────────────────────────────────┘
                    │
                    ↓
┌─────────────────────────────────────────────────────────┐
│              State Management (Zustand)                  │
│  ┌────────────────────────────────────────────────────┐ │
│  │  useWorkflowStore                                  │ │
│  │  - Visual state (nodes, edges)                     │ │
│  │  - Editor state (selected, viewport)               │ │
│  │  - Actions (addNode, deleteNode, etc.)             │ │
│  └────────────────┬───────────────────────────────────┘ │
└───────────────────┼───────────────────────────────────────┘
                    │
                    ↓
┌─────────────────────────────────────────────────────────┐
│            Application Layer (Use Cases)                 │
│  ┌────────────────────────────────────────────────────┐ │
│  │  SaveWorkflowUseCase                               │ │
│  │  ExecuteWorkflowUseCase                            │ │
│  │  ValidateWorkflowUseCase                           │ │
│  └────────────────┬───────────────────────────────────┘ │
└───────────────────┼───────────────────────────────────────┘
                    │
                    ↓
┌─────────────────────────────────────────────────────────┐
│              Domain Layer (Business Logic)               │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Workflow (Entity)                                 │ │
│  │  WorkflowCompiler (Service)                        │ │
│  │  WorkflowExecutionEngine (Service)                 │ │
│  └────────────────┬───────────────────────────────────┘ │
└───────────────────┼───────────────────────────────────────┘
                    │
                    ↓
┌─────────────────────────────────────────────────────────┐
│          Infrastructure Layer (Persistence)              │
│  ┌────────────────────────────────────────────────────┐ │
│  │  WorkflowRepository (RxDB)                         │ │
│  │  GmailApiService                                   │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**Zustand Store Implementation**:

```typescript
import create from 'zustand'
import { Node, Edge, addEdge, applyNodeChanges, applyEdgeChanges } from '@xyflow/react'

interface WorkflowState {
  // Visual state
  nodes: Node[]
  edges: Edge[]

  // Editor state
  selectedNodeIds: string[]
  viewport: { x: number; y: number; zoom: number }
  isDirty: boolean

  // Workflow metadata
  workflowId: string | null
  workflowName: string

  // Actions - Visual manipulation
  setNodes: (nodes: Node[] | ((nodes: Node[]) => Node[])) => void
  setEdges: (edges: Edge[] | ((edges: Edge[]) => Edge[])) => void
  onNodesChange: (changes: any) => void
  onEdgesChange: (changes: any) => void
  onConnect: (connection: any) => void

  addNode: (node: Omit<Node, 'id'>) => void
  deleteNode: (nodeId: string) => void
  updateNodeData: (nodeId: string, data: any) => void

  // Actions - Editor
  selectNode: (nodeId: string) => void
  deselectAll: () => void
  setViewport: (viewport: { x: number; y: number; zoom: number }) => void

  // Actions - Persistence
  loadWorkflow: (workflowId: string) => Promise<void>
  saveWorkflow: () => Promise<void>

  // Actions - Execution
  validateWorkflow: () => Promise<ValidationResult>
  executeWorkflow: (threadId: string) => Promise<void>
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  // Initial state
  nodes: [],
  edges: [],
  selectedNodeIds: [],
  viewport: { x: 0, y: 0, zoom: 1 },
  isDirty: false,
  workflowId: null,
  workflowName: 'Untitled Workflow',

  // Visual manipulation
  setNodes: (nodes) =>
    set({
      nodes: typeof nodes === 'function' ? nodes(get().nodes) : nodes,
      isDirty: true,
    }),

  setEdges: (edges) =>
    set({
      edges: typeof edges === 'function' ? edges(get().edges) : edges,
      isDirty: true,
    }),

  onNodesChange: (changes) =>
    set({
      nodes: applyNodeChanges(changes, get().nodes),
      isDirty: true,
    }),

  onEdgesChange: (changes) =>
    set({
      edges: applyEdgeChanges(changes, get().edges),
      isDirty: true,
    }),

  onConnect: (connection) =>
    set({
      edges: addEdge(connection, get().edges),
      isDirty: true,
    }),

  addNode: (node) => {
    const newNode = {
      ...node,
      id: generateId(),
    }
    set({
      nodes: [...get().nodes, newNode],
      isDirty: true,
    })
  },

  deleteNode: (nodeId) => {
    set({
      nodes: get().nodes.filter((n) => n.id !== nodeId),
      edges: get().edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
      isDirty: true,
    })
  },

  updateNodeData: (nodeId, data) => {
    set({
      nodes: get().nodes.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, ...data } } : node
      ),
      isDirty: true,
    })
  },

  // Editor actions
  selectNode: (nodeId) =>
    set({
      selectedNodeIds: [nodeId],
    }),

  deselectAll: () =>
    set({
      selectedNodeIds: [],
    }),

  setViewport: (viewport) => set({ viewport }),

  // Persistence
  loadWorkflow: async (workflowId) => {
    const workflow = await workflowRepository.findById(workflowId)
    if (!workflow) throw new Error('Workflow not found')

    set({
      workflowId,
      workflowName: workflow.name,
      nodes: workflow.visualData.nodes,
      edges: workflow.visualData.edges,
      viewport: workflow.visualData.viewport || { x: 0, y: 0, zoom: 1 },
      isDirty: false,
    })
  },

  saveWorkflow: async () => {
    const state = get()

    // Validate before save
    const validation = await get().validateWorkflow()
    if (!validation.isValid) {
      throw new Error(validation.errors.join(', '))
    }

    // Compile execution data
    const compiler = new WorkflowCompiler()
    const executionData = compiler.compile({
      nodes: state.nodes,
      edges: state.edges,
    })

    // Save to repository
    if (state.workflowId) {
      // Update existing
      await workflowRepository.update(state.workflowId, {
        name: state.workflowName,
        visualData: {
          nodes: state.nodes,
          edges: state.edges,
          viewport: state.viewport,
        },
        executionData,
        updatedAt: new Date(),
      })
    } else {
      // Create new
      const workflow = await workflowRepository.create({
        name: state.workflowName,
        visualData: {
          nodes: state.nodes,
          edges: state.edges,
          viewport: state.viewport,
        },
        executionData,
        isActive: false,
        isValid: validation.isValid,
      })
      set({ workflowId: workflow.id })
    }

    set({ isDirty: false })
  },

  // Validation
  validateWorkflow: async () => {
    const { nodes, edges } = get()
    const errors: string[] = []

    // Must have at least one trigger
    const triggers = nodes.filter((n) => n.type.startsWith('trigger.'))
    if (triggers.length === 0) {
      errors.push('Workflow must have at least one trigger')
    }
    if (triggers.length > 1) {
      errors.push('Workflow can only have one trigger')
    }

    // Must have at least one action
    const actions = nodes.filter((n) => n.type.startsWith('action.'))
    if (actions.length === 0) {
      errors.push('Workflow must have at least one action')
    }

    // No disconnected nodes (except trigger)
    const connectedNodeIds = new Set<string>()
    edges.forEach((e) => {
      connectedNodeIds.add(e.source)
      connectedNodeIds.add(e.target)
    })

    const disconnected = nodes.filter(
      (n) => !n.type.startsWith('trigger.') && !connectedNodeIds.has(n.id)
    )
    if (disconnected.length > 0) {
      errors.push(`${disconnected.length} disconnected nodes`)
    }

    // No cycles
    if (this.hasCycle(nodes, edges)) {
      errors.push('Workflow contains circular dependencies')
    }

    return {
      isValid: errors.length === 0,
      errors,
    }
  },

  // Execution
  executeWorkflow: async (threadId: string) => {
    const state = get()
    if (!state.workflowId) {
      throw new Error('Save workflow before executing')
    }

    // Delegate to use case
    const useCase = new ExecuteWorkflowUseCase(workflowRepository, executionEngine)

    await useCase.execute({
      workflowId: state.workflowId,
      threadId,
    })
  },
}))
```

### 4.3 Execution Engine

**Architecture** (fixes v1 issues):

```typescript
// Domain service (NOT in entity)
export class WorkflowExecutionEngine {
  constructor(
    private triggerService: EmailTriggerService,
    private conditionService: EmailConditionService,
    private actionService: EmailActionService,
    private executionLogger: ExecutionLogger
  ) {}

  /**
   * Execute workflow for a thread
   * @returns Execution result with success/failure
   */
  async execute(workflow: Workflow, context: ExecutionContext): Promise<ExecutionResult> {
    // Validate workflow is active and valid
    if (!workflow.isActive || !workflow.isValid) {
      throw new Error('Cannot execute inactive or invalid workflow')
    }

    // Create execution record
    const execution = await this.executionLogger.start({
      workflowId: workflow.id,
      threadId: context.thread.id,
      triggeredBy: context.triggeredBy,
    })

    try {
      // 1. Evaluate triggers
      const shouldRun = await this.evaluateTriggers(workflow, context)

      if (!shouldRun) {
        await this.executionLogger.skip(execution.id, 'Trigger not matched')
        return { success: true, skipped: true }
      }

      // 2. Execute workflow graph
      const result = await this.executeGraph(workflow.executionData, context)

      // 3. Update workflow stats
      await this.updateWorkflowStats(workflow.id, result)

      // 4. Log success
      await this.executionLogger.complete(execution.id, result)

      return result
    } catch (error) {
      // Log error
      await this.executionLogger.fail(execution.id, error)

      // Re-throw (caller handles notification)
      throw error
    }
  }

  /**
   * Execute workflow graph (node by node)
   */
  private async executeGraph(
    executionData: WorkflowExecutionData,
    context: ExecutionContext
  ): Promise<ExecutionResult> {
    const { nodes, entryNodeId } = executionData
    const results: NodeExecutionResult[] = []

    let currentNodeId: string | null = entryNodeId
    let iteration = 0
    const maxIterations = 100 // Prevent infinite loops

    while (currentNodeId && iteration < maxIterations) {
      iteration++

      // Find node
      const node = nodes.find((n) => n.id === currentNodeId)
      if (!node) {
        throw new Error(`Node ${currentNodeId} not found`)
      }

      // Execute node
      const result = await this.executeNode(node, context)
      results.push(result)

      // Update thread flow state
      context.thread.updateFlowState({
        currentNodeId,
        workflowId: executionData.workflowId,
        status: result.status,
        data: result.data,
        updatedAt: new Date(),
      })

      // Determine next node
      currentNodeId = this.getNextNode(node, result)
    }

    if (iteration >= maxIterations) {
      throw new Error('Workflow exceeded maximum iterations (possible infinite loop)')
    }

    return {
      success: true,
      nodeResults: results,
      completedAt: new Date(),
    }
  }

  /**
   * Execute single node
   */
  private async executeNode(
    node: ExecutionNode,
    context: ExecutionContext
  ): Promise<NodeExecutionResult> {
    const startTime = Date.now()

    try {
      let result: any

      // Execute based on node type
      if (node.type.startsWith('condition.')) {
        const conditionMet = await this.conditionService.evaluate(node.config, context)
        result = { conditionMet }
      } else if (node.type.startsWith('action.')) {
        result = await this.actionService.execute(node.config, context)
      } else {
        throw new Error(`Unknown node type: ${node.type}`)
      }

      return {
        nodeId: node.id,
        status: 'success',
        data: result,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      }
    } catch (error) {
      return {
        nodeId: node.id,
        status: 'error',
        error: error.message,
        duration: Date.now() - startTime,
        timestamp: new Date(),
      }
    }
  }

  /**
   * Determine next node based on execution result
   */
  private getNextNode(node: ExecutionNode, result: NodeExecutionResult): string | null {
    // Error handling
    if (result.status === 'error' && node.nextNodes.error) {
      return node.nextNodes.error
    }

    // Condition branching
    if (node.type.startsWith('condition.')) {
      const conditionMet = result.data?.conditionMet
      return conditionMet ? node.nextNodes.true : node.nextNodes.false
    }

    // Default next node
    return node.nextNodes.default || null
  }

  /**
   * Evaluate if triggers should fire
   */
  private async evaluateTriggers(workflow: Workflow, context: ExecutionContext): Promise<boolean> {
    // Check all triggers (OR logic)
    for (const trigger of workflow.executionData.triggers) {
      const matches = await this.triggerService.evaluate(trigger, context)

      if (matches) return true
    }

    return false
  }
}

// Execution context (data passed to nodes)
interface ExecutionContext {
  thread: Thread
  message: Message
  user: User
  triggeredBy: 'manual' | 'automatic'
  variables: Record<string, any> // User-defined variables
}

// Execution result
interface ExecutionResult {
  success: boolean
  skipped?: boolean
  nodeResults?: NodeExecutionResult[]
  error?: string
  completedAt?: Date
}

interface NodeExecutionResult {
  nodeId: string
  status: 'success' | 'error' | 'skipped'
  data?: any
  error?: string
  duration: number
  timestamp: Date
}
```

### 4.4 Monitoring & Execution Logs

```typescript
// Execution log schema (RxDB)
const executionLogSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string' },
    workflowId: { type: 'string' },
    workflowVersion: { type: 'number' },
    threadId: { type: 'string' },

    // Status
    status: {
      type: 'string',
      enum: ['running', 'success', 'error', 'skipped'],
    },

    // Timing
    startedAt: { type: 'string', format: 'date-time' },
    completedAt: { type: 'string', format: 'date-time' },
    duration: { type: 'number' }, // milliseconds

    // Results
    nodeResults: { type: 'array' }, // Array of NodeExecutionResult
    error: { type: 'string' },

    // Context
    triggeredBy: {
      type: 'string',
      enum: ['manual', 'automatic'],
    },
    userId: { type: 'string' },
  },
  required: ['id', 'workflowId', 'threadId', 'status', 'startedAt'],
  indexes: ['workflowId', 'threadId', 'status', 'startedAt'],
}

// Execution logger service
export class ExecutionLogger {
  constructor(private db: RxDatabase) {}

  async start(params: {
    workflowId: string
    threadId: string
    triggeredBy: 'manual' | 'automatic'
  }): Promise<ExecutionLog> {
    const log = await this.db.execution_logs.insert({
      id: generateId(),
      workflowId: params.workflowId,
      threadId: params.threadId,
      status: 'running',
      startedAt: new Date().toISOString(),
      triggeredBy: params.triggeredBy,
      nodeResults: [],
    })

    return log
  }

  async complete(executionId: string, result: ExecutionResult): Promise<void> {
    await this.db.execution_logs.update(executionId, {
      status: 'success',
      completedAt: new Date().toISOString(),
      duration: Date.now() - new Date(log.startedAt).getTime(),
      nodeResults: result.nodeResults,
    })
  }

  async fail(executionId: string, error: Error): Promise<void> {
    await this.db.execution_logs.update(executionId, {
      status: 'error',
      completedAt: new Date().toISOString(),
      duration: Date.now() - new Date(log.startedAt).getTime(),
      error: error.message,
    })
  }

  async skip(executionId: string, reason: string): Promise<void> {
    await this.db.execution_logs.update(executionId, {
      status: 'skipped',
      completedAt: new Date().toISOString(),
      error: reason,
    })
  }

  // Query methods
  async getWorkflowHistory(workflowId: string, limit = 50): Promise<ExecutionLog[]> {
    return await this.db.execution_logs
      .find({
        selector: { workflowId },
        sort: [{ startedAt: 'desc' }],
        limit,
      })
      .exec()
  }

  async getThreadExecutions(threadId: string): Promise<ExecutionLog[]> {
    return await this.db.execution_logs
      .find({
        selector: { threadId },
        sort: [{ startedAt: 'desc' }],
      })
      .exec()
  }

  async getFailedExecutions(since: Date): Promise<ExecutionLog[]> {
    return await this.db.execution_logs
      .find({
        selector: {
          status: 'error',
          startedAt: { $gte: since.toISOString() },
        },
        sort: [{ startedAt: 'desc' }],
      })
      .exec()
  }
}
```

### 4.5 Workflow Versioning

**Strategy**: Immutable versions with migration support

```typescript
// Workflow version schema
const workflowVersionSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string' },
    workflowId: { type: 'string' },
    version: { type: 'number' },

    // Snapshot of workflow at this version
    name: { type: 'string' },
    visualData: { type: 'object' },
    executionData: { type: 'object' },

    // Metadata
    createdAt: { type: 'string', format: 'date-time' },
    createdBy: { type: 'string' },
    changeDescription: { type: 'string' },
  },
  required: ['id', 'workflowId', 'version', 'createdAt'],
  indexes: [
    ['workflowId', 'version'], // Compound index
  ],
}

// Version control service
export class WorkflowVersionControl {
  async createVersion(workflow: Workflow, changeDescription: string): Promise<WorkflowVersion> {
    const latestVersion = await this.getLatestVersion(workflow.id)
    const newVersion = (latestVersion?.version || 0) + 1

    const version = await this.db.workflow_versions.insert({
      id: generateId(),
      workflowId: workflow.id,
      version: newVersion,
      name: workflow.name,
      visualData: workflow.visualData,
      executionData: workflow.executionData,
      createdAt: new Date().toISOString(),
      createdBy: workflow.userId,
      changeDescription,
    })

    // Update workflow version number
    await this.db.workflows.update(workflow.id, {
      version: newVersion,
    })

    return version
  }

  async getVersionHistory(workflowId: string): Promise<WorkflowVersion[]> {
    return await this.db.workflow_versions
      .find({
        selector: { workflowId },
        sort: [{ version: 'desc' }],
      })
      .exec()
  }

  async restoreVersion(workflowId: string, version: number): Promise<void> {
    const versionDoc = await this.db.workflow_versions
      .findOne({
        selector: { workflowId, version },
      })
      .exec()

    if (!versionDoc) {
      throw new Error(`Version ${version} not found`)
    }

    // Create new version with restored data
    await this.createVersion(
      {
        id: workflowId,
        visualData: versionDoc.visualData,
        executionData: versionDoc.executionData,
      },
      `Restored from version ${version}`
    )
  }
}
```

---

## 5. Email Workflow Templates

### 5.1 Auto-Label by Sender

**Use Case**: Automatically label emails from specific senders

```json
{
  "name": "Auto-label from boss",
  "nodes": [
    {
      "id": "trigger-1",
      "type": "trigger.new_email",
      "data": {
        "label": "New Email",
        "config": {}
      },
      "position": { "x": 100, "y": 100 }
    },
    {
      "id": "condition-1",
      "type": "condition.from_sender",
      "data": {
        "label": "From boss?",
        "config": {
          "senders": ["boss@company.com"],
          "matchType": "exact"
        }
      },
      "position": { "x": 300, "y": 100 }
    },
    {
      "id": "action-1",
      "type": "action.add_label",
      "data": {
        "label": "Add Label: Important",
        "config": {
          "labelId": "label-important"
        }
      },
      "position": { "x": 500, "y": 100 }
    }
  ],
  "edges": [
    {
      "id": "e1",
      "source": "trigger-1",
      "target": "condition-1"
    },
    {
      "id": "e2",
      "source": "condition-1",
      "target": "action-1",
      "sourceHandle": "true"
    }
  ]
}
```

### 5.2 Auto-Reply to Clients

**Use Case**: Send automatic reply to client emails

```json
{
  "name": "Auto-reply to clients",
  "nodes": [
    {
      "id": "trigger-1",
      "type": "trigger.new_email",
      "data": {
        "label": "New Email"
      },
      "position": { "x": 100, "y": 100 }
    },
    {
      "id": "condition-1",
      "type": "condition.has_label",
      "data": {
        "label": "Has Label: Clients",
        "config": {
          "labelIds": ["label-clients"]
        }
      },
      "position": { "x": 300, "y": 100 }
    },
    {
      "id": "action-1",
      "type": "action.send_email",
      "data": {
        "label": "Send Auto-Reply",
        "config": {
          "to": ["{{message.from.address}}"],
          "subject": "Re: {{thread.subject}}",
          "body": "Thank you for your email. We'll get back to you within 24 hours.",
          "replyToThreadId": "{{thread.id}}"
        }
      },
      "position": { "x": 500, "y": 100 }
    }
  ],
  "edges": [
    {
      "id": "e1",
      "source": "trigger-1",
      "target": "condition-1"
    },
    {
      "id": "e2",
      "source": "condition-1",
      "target": "action-1",
      "sourceHandle": "true"
    }
  ]
}
```

### 5.3 Forward Invoices to Accounting

**Use Case**: Automatically forward invoice emails to accounting

```json
{
  "name": "Forward invoices to accounting",
  "nodes": [
    {
      "id": "trigger-1",
      "type": "trigger.new_email",
      "data": {
        "label": "New Email"
      },
      "position": { "x": 100, "y": 100 }
    },
    {
      "id": "condition-1",
      "type": "condition.subject_contains",
      "data": {
        "label": "Subject contains 'invoice'",
        "config": {
          "text": "invoice",
          "caseSensitive": false
        }
      },
      "position": { "x": 300, "y": 100 }
    },
    {
      "id": "condition-2",
      "type": "condition.has_attachment",
      "data": {
        "label": "Has attachment",
        "config": {}
      },
      "position": { "x": 500, "y": 100 }
    },
    {
      "id": "action-1",
      "type": "action.forward",
      "data": {
        "label": "Forward to accounting",
        "config": {
          "to": ["accounting@company.com"],
          "includeAttachments": true,
          "addNote": "Automatic forward from {{message.from.address}}"
        }
      },
      "position": { "x": 700, "y": 100 }
    },
    {
      "id": "action-2",
      "type": "action.add_label",
      "data": {
        "label": "Add Label: Processed",
        "config": {
          "labelId": "label-processed"
        }
      },
      "position": { "x": 900, "y": 100 }
    }
  ],
  "edges": [
    {
      "id": "e1",
      "source": "trigger-1",
      "target": "condition-1"
    },
    {
      "id": "e2",
      "source": "condition-1",
      "target": "condition-2",
      "sourceHandle": "true"
    },
    {
      "id": "e3",
      "source": "condition-2",
      "target": "action-1",
      "sourceHandle": "true"
    },
    {
      "id": "e4",
      "source": "action-1",
      "target": "action-2"
    }
  ]
}
```

### 5.4 Daily Digest of Unread Emails

**Use Case**: Send daily summary of unread emails

```json
{
  "name": "Daily unread digest",
  "nodes": [
    {
      "id": "trigger-1",
      "type": "trigger.schedule",
      "data": {
        "label": "Daily at 9 AM",
        "config": {
          "schedule": {
            "type": "cron",
            "value": "0 9 * * *"
          },
          "query": "is:unread"
        }
      },
      "position": { "x": 100, "y": 100 }
    },
    {
      "id": "action-1",
      "type": "action.send_email",
      "data": {
        "label": "Send digest",
        "config": {
          "to": ["{{user.email}}"],
          "subject": "Daily Unread Emails Digest",
          "body": "You have {{threads.count}} unread emails.\n\n{{threads.list}}"
        }
      },
      "position": { "x": 300, "y": 100 }
    }
  ],
  "edges": [
    {
      "id": "e1",
      "source": "trigger-1",
      "target": "action-1"
    }
  ]
}
```

---

## 6. Recommendations for Claine v2

### 6.1 Keep ReactFlow

**Rationale**:

- ✅ Mature, well-maintained library
- ✅ Built-in features align with requirements
- ✅ Good TypeScript support
- ✅ Lower learning curve than alternatives
- ✅ Active community

**Action Items**:

- Update to latest 12.x version
- Add auto-layout plugin (dagre)
- Implement custom node types for email automation
- Add keyboard shortcuts
- Implement undo/redo with command pattern

### 6.2 Fix Execution Engine Architecture

**Critical Changes**:

1. **Move execution logic out of entity**:

   ```typescript
   // ❌ v1 (BAD)
   class Workflow {
     async execute(thread: Thread) {
       /* ... */
     }
   }

   // ✅ v2 (GOOD)
   class WorkflowExecutionEngine {
     async execute(workflow: Workflow, context: ExecutionContext) {
       /* ... */
     }
   }
   ```

2. **Separate visual and execution data**:
   - Visual data: ReactFlow nodes/edges (UI)
   - Execution data: Optimized graph (domain)
   - Compiler: Transform visual → execution

3. **Add validation before activation**:
   - Check trigger exists
   - Check actions exist
   - Check no cycles
   - Check no disconnected nodes

4. **Implement error handling**:
   - Retry logic with exponential backoff
   - Error notification
   - Fallback paths
   - Execution logging

### 6.3 Enhance UX

**Priority Features**:

1. **Auto-layout** (High):
   - Use dagre for hierarchical layout
   - Add "Organize" button
   - Animate transitions

2. **Connection validation** (High):
   - Implement `isValidConnection` hook
   - Show visual feedback (red/green)
   - Prevent invalid connections

3. **Keyboard shortcuts** (Medium):
   - Delete, Copy, Paste, Undo, Redo
   - Quick add menu (Spacebar)
   - Pan/zoom shortcuts

4. **Undo/Redo** (Medium):
   - Command pattern
   - History stack
   - Keyboard shortcuts

5. **Node states** (Low):
   - Visual feedback for execution
   - Error indicators
   - Loading states

### 6.4 Add Monitoring

**Features**:

1. **Execution logs**:
   - Track all executions
   - Store results per node
   - Query by workflow/thread/status

2. **Workflow analytics**:
   - Execution count
   - Success/error rates
   - Average execution time
   - Most active workflows

3. **Error tracking**:
   - Failed executions
   - Error notifications
   - Retry attempts

4. **Performance monitoring**:
   - Execution duration per node
   - Bottleneck detection
   - Optimization suggestions

### 6.5 Implement Version Control

**Strategy**:

1. **Immutable versions**:
   - Create snapshot on save
   - Track version number
   - Store change description

2. **Version history**:
   - List all versions
   - Compare versions (diff)
   - Restore previous version

3. **Execution tracking**:
   - Log which version executed
   - Allow rollback if new version fails

### 6.6 Email-Specific Features

**Add These Node Types**:

1. **Triggers**:
   - New email (with filters)
   - Label added/removed
   - Schedule (cron)
   - Star added
   - Attachment received

2. **Conditions**:
   - Has label
   - From sender
   - To recipient
   - Subject contains
   - Body contains
   - Has attachment
   - Is unread/starred
   - Date range
   - Custom attribute

3. **Actions**:
   - Add/remove label
   - Send email (with templates)
   - Forward
   - Archive
   - Mark read/unread
   - Star/unstar
   - Move to trash
   - Set custom attribute
   - Wait (delay)

4. **Control Flow**:
   - Condition (if/then)
   - Error handler
   - Wait/delay
   - Stop workflow

### 6.7 Template System

**Features**:

1. **Template variables**:
   - `{{thread.subject}}`
   - `{{message.from.name}}`
   - `{{labels}}`
   - `{{attributes.custom_field}}`

2. **Template functions**:
   - `{{date.format(message.date, 'YYYY-MM-DD')}}`
   - `{{string.truncate(message.body, 100)}}`
   - `{{array.join(labels, ', ')}}`

3. **Workflow templates**:
   - Pre-built templates for common use cases
   - Export/import workflows
   - Share workflows with team

---

## 7. Implementation Roadmap

### Phase 1: Foundation (Week 1-2)

**Goals**: Fix critical architecture issues

- [ ] Create `WorkflowExecutionEngine` domain service
- [ ] Move execution logic out of `Workflow` entity
- [ ] Implement `WorkflowCompiler` (visual → execution)
- [ ] Add workflow validation before activation
- [ ] Update RxDB schema (separate visual/execution data)

### Phase 2: Execution Engine (Week 3-4)

**Goals**: Robust execution with error handling

- [ ] Implement node-by-node execution
- [ ] Add error handling (retry, fallback)
- [ ] Implement execution logging
- [ ] Add execution context (thread, message, variables)
- [ ] Create template parser for dynamic content

### Phase 3: UX Enhancements (Week 5-6)

**Goals**: Improve visual designer

- [ ] Add auto-layout (dagre integration)
- [ ] Implement connection validation
- [ ] Add keyboard shortcuts
- [ ] Implement undo/redo (command pattern)
- [ ] Add node state visualization (running, success, error)

### Phase 4: Monitoring (Week 7-8)

**Goals**: Visibility into execution

- [ ] Create execution log schema
- [ ] Implement `ExecutionLogger` service
- [ ] Build execution history UI
- [ ] Add workflow analytics dashboard
- [ ] Implement error tracking/notifications

### Phase 5: Advanced Features (Week 9-10)

**Goals**: Version control and templates

- [ ] Implement workflow versioning
- [ ] Add version history UI
- [ ] Create workflow template library
- [ ] Add export/import functionality
- [ ] Build workflow marketplace (future)

---

## 8. Technical Debt from v1

### Issues Identified

1. **Execution logic in entity** (Critical):
   - `Workflow.execute()` method does too much
   - Should be in domain service
   - **Fix**: Create `WorkflowExecutionEngine`

2. **No validation before activation** (High):
   - Can activate invalid workflows
   - No cycle detection
   - **Fix**: Implement `validateWorkflow()` method

3. **Mixed concerns** (High):
   - Visual data mixed with execution data
   - Hard to optimize execution
   - **Fix**: Separate `visualData` and `executionData`

4. **No error handling** (High):
   - Execution fails silently
   - No retry logic
   - **Fix**: Add error handlers, retry logic

5. **No execution logging** (Medium):
   - Can't debug failed workflows
   - No audit trail
   - **Fix**: Create `ExecutionLogger` service

6. **No versioning** (Medium):
   - Can't rollback changes
   - No change history
   - **Fix**: Implement `WorkflowVersionControl`

7. **Limited node types** (Low):
   - Missing common email actions
   - **Fix**: Add more node types

### Migration Plan

**Phase 1**: Database schema changes

```typescript
// Add new fields to workflow collection
await db.workflows.migrate({
  version: 1,
  migrationStrategies: {
    1: (oldDoc) => {
      return {
        ...oldDoc,
        visualData: {
          nodes: oldDoc.nodes,
          edges: oldDoc.edges,
          viewport: { x: 0, y: 0, zoom: 1 },
        },
        executionData: compileWorkflow(oldDoc),
      }
    },
  },
})
```

**Phase 2**: Code refactoring

- Move execution logic to service
- Update all workflow usage sites
- Add validation before activation

**Phase 3**: Testing

- Unit tests for execution engine
- Integration tests for workflows
- E2E tests for visual designer

---

## 9. References

### Libraries

- **ReactFlow**: https://reactflow.dev/
- **Dagre** (auto-layout): https://github.com/dagrejs/dagre
- **Zustand** (state): https://github.com/pmndrs/zustand

### Inspiration

- **n8n**: https://github.com/n8n-io/n8n
- **Pipedream**: https://pipedream.com/
- **Zapier**: https://zapier.com/

### Email Automation

- **Gmail API**: https://developers.google.com/gmail/api
- **Email Templates**: https://github.com/email-templates/email-templates

---

## Conclusion

This research provides practical guidance for building Claine v2's workflow designer. Key recommendations:

1. **Keep ReactFlow** - proven, mature library that fits requirements
2. **Fix architecture** - move execution logic to domain service
3. **Separate concerns** - visual data (UI) vs execution data (domain)
4. **Add robustness** - validation, error handling, retry logic
5. **Enhance UX** - auto-layout, keyboard shortcuts, undo/redo
6. **Monitor execution** - logging, analytics, error tracking
7. **Version control** - track changes, enable rollback

Focus on **Phase 1-2** first (execution engine fixes) before adding advanced UX features. This ensures solid foundation for email automation workflows.

**Document Size**: ~25,000 tokens (within budget)
