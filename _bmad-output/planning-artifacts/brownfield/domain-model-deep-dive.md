# Claine Email Client - Domain Model Deep Dive

## Document Information

**Project**: Claine Email Client v1 (Brownfield Analysis)
**Purpose**: Comprehensive domain model documentation for v2 rebuild
**Audience**: AI agents, developers working on v2 rebuild
**Status**: Brownfield documentation - reflects ACTUAL implementation

### Change Log

| Date       | Version | Description                   | Author  |
| ---------- | ------- | ----------------------------- | ------- |
| 2025-10-27 | 1.0     | Initial domain model analysis | Winston |

---

## Executive Summary

The Claine Email Client v1 implements a **Clean Architecture** approach with **Domain-Driven Design (DDD)** principles. The domain layer is well-structured with clear separation between entities, value objects, and services, though some areas show inconsistency in applying DDD patterns.

**Domain Architecture Highlights**:

- ✅ Clear separation: Domain → Application → Infrastructure layers
- ✅ Rich domain models with business logic encapsulation
- ✅ Aggregate roots for transactional boundaries
- ⚠️ Some anemic domain models (data bags without behavior)
- ⚠️ Inconsistent use of value objects
- ⚠️ Domain events not fully implemented

**Core Domain Entities**:

1. **Thread** - Aggregate root for email conversations
2. **Message** - Email message entity
3. **Label** - Gmail label/folder classification
4. **Workflow** - User-defined automation rules
5. **Attribute** - Custom metadata for emails/threads

**Technical Implementation**:

- Language: TypeScript 5.8.2
- Pattern: Domain-Driven Design
- Validation: Zod schemas
- Persistence: Repository pattern with RxDB

---

## Table of Contents

1. [Domain Architecture Overview](#domain-architecture-overview)
2. [Core Domain Entities](#core-domain-entities)
3. [Value Objects](#value-objects)
4. [Aggregates & Boundaries](#aggregates--boundaries)
5. [Domain Services](#domain-services)
6. [Domain Events](#domain-events)
7. [Repositories](#repositories)
8. [Domain Model Issues](#domain-model-issues)
9. [Recommendations for v2](#recommendations-for-v2)

---

## 1. Domain Architecture Overview

### 1.1 Layer Architecture

```
┌───────────────────────────────────────────────────────────┐
│                    Presentation Layer                      │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  React Components, Hooks, UI State Management      │  │
│  └─────────────────────────────────────────────────────┘  │
└───────────────────┬───────────────────────────────────────┘
                    │ Uses
┌───────────────────▼───────────────────────────────────────┐
│                   Application Layer                        │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  Use Cases, Application Services, DTOs             │  │
│  │  - SynchronizationService                          │  │
│  │  - WorkflowExecutor                                │  │
│  │  - ThreadManagementService                         │  │
│  └─────────────────────────────────────────────────────┘  │
└───────────────────┬───────────────────────────────────────┘
                    │ Orchestrates
┌───────────────────▼───────────────────────────────────────┐
│                     Domain Layer                           │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  Entities, Value Objects, Domain Services          │  │
│  │  - Thread (Aggregate Root)                         │  │
│  │  - Message                                          │  │
│  │  - Label, Workflow, Attribute                      │  │
│  │  - Domain Logic & Business Rules                   │  │
│  └─────────────────────────────────────────────────────┘  │
└───────────────────┬───────────────────────────────────────┘
                    │ Uses
┌───────────────────▼───────────────────────────────────────┐
│                 Infrastructure Layer                       │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  RxDB Repositories, Gmail API Client, Storage      │  │
│  │  - ThreadRepository                                │  │
│  │  - MessageRepository                               │  │
│  │  - GmailApiService                                 │  │
│  └─────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
```

### 1.2 Directory Structure

```
src/
├── domain/                          # Domain Layer (PURE - No dependencies)
│   ├── entities/
│   │   ├── Thread.ts               # Aggregate Root
│   │   ├── Message.ts              # Entity
│   │   ├── Label.ts                # Entity
│   │   ├── Workflow.ts             # Aggregate Root
│   │   └── Attribute.ts            # Entity
│   ├── value-objects/
│   │   ├── EmailAddress.ts         # Value Object
│   │   ├── ThreadId.ts             # Value Object (ID)
│   │   └── WorkflowCondition.ts    # Value Object
│   ├── services/
│   │   ├── ThreadFilterService.ts  # Domain Service
│   │   └── WorkflowEvaluator.ts    # Domain Service
│   └── events/
│       ├── DomainEvent.ts          # Base event
│       ├── ThreadUpdatedEvent.ts
│       └── MessageReceivedEvent.ts
│
├── application/                     # Application Layer (Use Cases)
│   ├── use-cases/
│   │   ├── SyncEmailsUseCase.ts
│   │   ├── ApplyWorkflowUseCase.ts
│   │   └── SearchThreadsUseCase.ts
│   └── services/
│       ├── SynchronizationService.ts
│       ├── WorkflowExecutor.ts
│       └── ThreadManagementService.ts
│
└── infrastructure/                  # Infrastructure Layer
    ├── repositories/
    │   ├── ThreadRepository.ts
    │   └── MessageRepository.ts
    ├── database/
    │   └── database.ts              # RxDB setup
    └── api/
        └── gmail/
            └── GmailApiService.ts
```

### 1.3 Domain Layer Principles

**✅ ACTUAL Implementation**:

```typescript
// Domain entities have NO infrastructure dependencies
// Good: Pure domain code
import { Label } from './Label'
import { Message } from './Message'

export class Thread {
  constructor(
    public readonly id: string,
    public readonly messageIds: string[],
    public readonly snippet: string,
    public labels: Label[]
    // ... domain properties only
  ) {}

  // Domain logic methods
  public hasLabel(labelName: string): boolean {
    return this.labels.some((label) => label.name === labelName)
  }

  public addLabel(label: Label): void {
    if (!this.hasLabel(label.name)) {
      this.labels.push(label)
    }
  }
}
```

**File**: `src/domain/entities/Thread.ts:1-85`

**⚠️ VIOLATIONS Found**:

```typescript
// Some domain entities import from infrastructure (BAD)
import { RxDocument } from 'rxdb' // ❌ Infrastructure dependency!

export class ThreadEntity {
  // Domain logic mixed with infrastructure
  public static fromRxDocument(doc: RxDocument): ThreadEntity {
    // ❌ Domain should not know about RxDB
  }
}
```

**File**: `src/domain/entities/ThreadEntity.ts:8-12`

---

## 2. Core Domain Entities

### 2.1 Thread (Aggregate Root)

**Purpose**: Represents an email conversation thread, grouping related messages together.

**Implementation**:

```typescript
// src/domain/entities/Thread.ts
export class Thread {
  // Identity
  public readonly id: string // Gmail thread ID (e.g., "18f2a8b3c4d5e6f7")
  public readonly historyId: string // Gmail history ID for change tracking

  // Content
  public readonly snippet: string // Preview text (first 200 chars)
  public readonly messageIds: string[] // Ordered list of message IDs in thread

  // Classification
  public labels: Label[] // Gmail labels (INBOX, SENT, custom)

  // State
  public isRead: boolean
  public isStarred: boolean
  public isDraft: boolean
  public isImportant: boolean

  // Workflow State
  public flowState?: ThreadFlowState // Current state in workflow

  // Metadata
  public readonly createdAt: Date
  public updatedAt: Date
  public lastMessageDate: Date

  constructor(props: ThreadProps) {
    this.id = props.id
    this.historyId = props.historyId
    this.snippet = props.snippet
    this.messageIds = props.messageIds
    this.labels = props.labels || []
    this.isRead = props.isRead ?? false
    this.isStarred = props.isStarred ?? false
    this.isDraft = props.isDraft ?? false
    this.isImportant = props.isImportant ?? false
    this.flowState = props.flowState
    this.createdAt = props.createdAt || new Date()
    this.updatedAt = props.updatedAt || new Date()
    this.lastMessageDate = props.lastMessageDate || new Date()
  }

  // Domain Methods

  /**
   * Check if thread has a specific label
   */
  public hasLabel(labelName: string): boolean {
    return this.labels.some((label) => label.name.toLowerCase() === labelName.toLowerCase())
  }

  /**
   * Add label to thread (idempotent)
   */
  public addLabel(label: Label): void {
    if (!this.hasLabel(label.name)) {
      this.labels.push(label)
      this.updatedAt = new Date()
    }
  }

  /**
   * Remove label from thread
   */
  public removeLabel(labelName: string): void {
    this.labels = this.labels.filter(
      (label) => label.name.toLowerCase() !== labelName.toLowerCase()
    )
    this.updatedAt = new Date()
  }

  /**
   * Mark thread as read/unread
   */
  public markAsRead(): void {
    if (!this.isRead) {
      this.isRead = true
      this.updatedAt = new Date()
    }
  }

  public markAsUnread(): void {
    if (this.isRead) {
      this.isRead = false
      this.updatedAt = new Date()
    }
  }

  /**
   * Star/unstar thread
   */
  public star(): void {
    if (!this.isStarred) {
      this.isStarred = true
      this.updatedAt = new Date()
    }
  }

  public unstar(): void {
    if (this.isStarred) {
      this.isStarred = false
      this.updatedAt = new Date()
    }
  }

  /**
   * Check if thread is in inbox
   */
  public isInInbox(): boolean {
    return this.hasLabel('INBOX')
  }

  /**
   * Check if thread is archived
   */
  public isArchived(): boolean {
    return !this.hasLabel('INBOX') && !this.hasLabel('TRASH')
  }

  /**
   * Archive thread (remove INBOX label)
   */
  public archive(): void {
    this.removeLabel('INBOX')
  }

  /**
   * Move to trash
   */
  public moveToTrash(): void {
    this.removeLabel('INBOX')
    this.addLabel(new Label({ id: 'TRASH', name: 'TRASH', type: 'system' }))
  }

  /**
   * Restore from trash
   */
  public restoreFromTrash(): void {
    this.removeLabel('TRASH')
    this.addLabel(new Label({ id: 'INBOX', name: 'INBOX', type: 'system' }))
  }

  /**
   * Get first message ID (often used for thread preview)
   */
  public getFirstMessageId(): string | null {
    return this.messageIds.length > 0 ? this.messageIds[0] : null
  }

  /**
   * Get last message ID (most recent message)
   */
  public getLastMessageId(): string | null {
    return this.messageIds.length > 0 ? this.messageIds[this.messageIds.length - 1] : null
  }

  /**
   * Count messages in thread
   */
  public getMessageCount(): number {
    return this.messageIds.length
  }

  /**
   * Check if thread has multiple messages (conversation)
   */
  public isConversation(): boolean {
    return this.messageIds.length > 1
  }

  /**
   * Update workflow state
   */
  public updateFlowState(flowState: ThreadFlowState): void {
    this.flowState = flowState
    this.updatedAt = new Date()
  }

  /**
   * Check if thread matches filter criteria
   */
  public matchesFilter(filter: ThreadFilter): boolean {
    // Label filter
    if (filter.labels && filter.labels.length > 0) {
      const hasMatchingLabel = filter.labels.some((labelName) => this.hasLabel(labelName))
      if (!hasMatchingLabel) return false
    }

    // Read state filter
    if (filter.isRead !== undefined && this.isRead !== filter.isRead) {
      return false
    }

    // Starred filter
    if (filter.isStarred !== undefined && this.isStarred !== filter.isStarred) {
      return false
    }

    // Search query (snippet match)
    if (filter.query) {
      const query = filter.query.toLowerCase()
      if (!this.snippet.toLowerCase().includes(query)) {
        return false
      }
    }

    return true
  }
}
```

**File**: `src/domain/entities/Thread.ts:1-250`

**Aggregate Root Responsibilities**:

- ✅ Maintains consistency of thread state
- ✅ Controls access to child messages (via messageIds)
- ✅ Enforces business rules (e.g., idempotent label addition)
- ⚠️ Should emit domain events (not implemented)

### 2.2 Message (Entity)

**Purpose**: Represents a single email message within a thread.

**Implementation**:

```typescript
// src/domain/entities/Message.ts
export class Message {
  // Identity
  public readonly id: string // Gmail message ID
  public readonly threadId: string // Parent thread ID

  // Headers
  public readonly from: EmailAddress // Sender (Value Object)
  public readonly to: EmailAddress[] // Recipients
  public readonly cc: EmailAddress[] // CC recipients
  public readonly bcc: EmailAddress[] // BCC recipients (rarely available)
  public readonly subject: string
  public readonly date: Date // Message sent date

  // Content
  public readonly snippet: string // Preview (first 200 chars)
  public readonly body: MessageBody // Full message body (HTML + plain text)
  public readonly attachments: Attachment[]

  // State
  public readonly labelIds: string[] // Labels applied to this message
  public readonly historyId: string // Gmail history ID

  // Metadata
  public readonly internalDate: Date // Server receive date (different from sent date)
  public readonly sizeEstimate: number // Size in bytes

  constructor(props: MessageProps) {
    this.id = props.id
    this.threadId = props.threadId
    this.from = props.from
    this.to = props.to || []
    this.cc = props.cc || []
    this.bcc = props.bcc || []
    this.subject = props.subject
    this.date = props.date
    this.snippet = props.snippet
    this.body = props.body
    this.attachments = props.attachments || []
    this.labelIds = props.labelIds || []
    this.historyId = props.historyId
    this.internalDate = props.internalDate || props.date
    this.sizeEstimate = props.sizeEstimate || 0
  }

  // Domain Methods

  /**
   * Check if message has attachments
   */
  public hasAttachments(): boolean {
    return this.attachments.length > 0
  }

  /**
   * Get attachment by filename
   */
  public getAttachment(filename: string): Attachment | undefined {
    return this.attachments.find((att) => att.filename === filename)
  }

  /**
   * Check if message has a specific label
   */
  public hasLabel(labelId: string): boolean {
    return this.labelIds.includes(labelId)
  }

  /**
   * Check if message is from a specific sender
   */
  public isFrom(email: string): boolean {
    return this.from.email.toLowerCase() === email.toLowerCase()
  }

  /**
   * Check if message was sent to a specific recipient
   */
  public isSentTo(email: string): boolean {
    return this.to.some((recipient) => recipient.email.toLowerCase() === email.toLowerCase())
  }

  /**
   * Get all recipients (to + cc + bcc)
   */
  public getAllRecipients(): EmailAddress[] {
    return [...this.to, ...this.cc, ...this.bcc]
  }

  /**
   * Check if message is a reply (RE: in subject)
   */
  public isReply(): boolean {
    return this.subject.toLowerCase().startsWith('re:')
  }

  /**
   * Check if message is a forward (FW: in subject)
   */
  public isForward(): boolean {
    const subject = this.subject.toLowerCase()
    return subject.startsWith('fwd:') || subject.startsWith('fw:')
  }

  /**
   * Get plain text body
   */
  public getPlainTextBody(): string {
    return this.body.plain || this.body.html || this.snippet
  }

  /**
   * Get HTML body (fallback to plain text)
   */
  public getHtmlBody(): string {
    return this.body.html || this.body.plain || this.snippet
  }

  /**
   * Estimate read time in minutes
   */
  public estimateReadTime(): number {
    const text = this.getPlainTextBody()
    const wordCount = text.split(/\s+/).length
    const wordsPerMinute = 200
    return Math.ceil(wordCount / wordsPerMinute)
  }

  /**
   * Check if message is large (>500KB)
   */
  public isLarge(): boolean {
    return this.sizeEstimate > 500 * 1024
  }
}
```

**File**: `src/domain/entities/Message.ts:1-150`

**Entity Characteristics**:

- ✅ Has unique identity (Gmail message ID)
- ✅ Rich domain logic (isReply, estimateReadTime)
- ✅ Immutable after creation (readonly properties)
- ⚠️ Could benefit from more validation logic

### 2.3 Label (Entity)

**Purpose**: Represents Gmail labels (folders, categories, custom labels).

**Implementation**:

```typescript
// src/domain/entities/Label.ts
export class Label {
  // Identity
  public readonly id: string // Gmail label ID (e.g., "INBOX", "Label_123")
  public readonly name: string // Display name

  // Type
  public readonly type: LabelType // 'system' | 'user'

  // Appearance
  public color?: string // Hex color (e.g., "#ff0000")

  // Metadata
  public readonly messageListVisibility?: string // 'show' | 'hide'
  public readonly labelListVisibility?: string // 'labelShow' | 'labelHide'

  constructor(props: LabelProps) {
    this.id = props.id
    this.name = props.name
    this.type = props.type || 'user'
    this.color = props.color
    this.messageListVisibility = props.messageListVisibility
    this.labelListVisibility = props.labelListVisibility
  }

  // Domain Methods

  /**
   * Check if label is a system label
   */
  public isSystemLabel(): boolean {
    return this.type === 'system'
  }

  /**
   * Check if label is user-created
   */
  public isUserLabel(): boolean {
    return this.type === 'user'
  }

  /**
   * Check if label is visible in message list
   */
  public isVisibleInMessageList(): boolean {
    return this.messageListVisibility === 'show'
  }

  /**
   * Check if label is visible in label list
   */
  public isVisibleInLabelList(): boolean {
    return this.labelListVisibility === 'labelShow'
  }

  /**
   * Get system labels (constants)
   */
  public static getSystemLabels(): Label[] {
    return [
      new Label({ id: 'INBOX', name: 'INBOX', type: 'system' }),
      new Label({ id: 'SENT', name: 'SENT', type: 'system' }),
      new Label({ id: 'DRAFT', name: 'DRAFT', type: 'system' }),
      new Label({ id: 'TRASH', name: 'TRASH', type: 'system' }),
      new Label({ id: 'SPAM', name: 'SPAM', type: 'system' }),
      new Label({ id: 'STARRED', name: 'STARRED', type: 'system' }),
      new Label({ id: 'IMPORTANT', name: 'IMPORTANT', type: 'system' }),
      new Label({ id: 'UNREAD', name: 'UNREAD', type: 'system' }),
    ]
  }

  /**
   * Check if label is a specific system label
   */
  public isInbox(): boolean {
    return this.id === 'INBOX'
  }
  public isSent(): boolean {
    return this.id === 'SENT'
  }
  public isDraft(): boolean {
    return this.id === 'DRAFT'
  }
  public isTrash(): boolean {
    return this.id === 'TRASH'
  }
  public isSpam(): boolean {
    return this.id === 'SPAM'
  }
  public isStarred(): boolean {
    return this.id === 'STARRED'
  }
}
```

**File**: `src/domain/entities/Label.ts:1-90`

### 2.4 Workflow (Aggregate Root)

**Purpose**: Represents user-defined automation rules for email processing.

**Implementation**:

```typescript
// src/domain/entities/Workflow.ts
export class Workflow {
  // Identity
  public readonly id: string
  public name: string

  // Definition
  public nodes: WorkflowNode[] // Visual workflow nodes (ReactFlow)
  public edges: WorkflowEdge[] // Connections between nodes
  public triggers: WorkflowTrigger[] // What starts the workflow
  public conditions: WorkflowCondition[] // When to execute actions

  // Actions
  public actions: WorkflowAction[] // What to do (add label, move, etc.)

  // State
  public isActive: boolean
  public isValid: boolean // Validation status

  // Metadata
  public createdAt: Date
  public updatedAt: Date
  public lastExecutedAt?: Date
  public executionCount: number

  // Ownership
  public userId: string // Owner of workflow

  constructor(props: WorkflowProps) {
    this.id = props.id
    this.name = props.name
    this.nodes = props.nodes || []
    this.edges = props.edges || []
    this.triggers = props.triggers || []
    this.conditions = props.conditions || []
    this.actions = props.actions || []
    this.isActive = props.isActive ?? true
    this.isValid = props.isValid ?? false
    this.createdAt = props.createdAt || new Date()
    this.updatedAt = props.updatedAt || new Date()
    this.lastExecutedAt = props.lastExecutedAt
    this.executionCount = props.executionCount || 0
    this.userId = props.userId
  }

  // Domain Methods

  /**
   * Activate workflow
   */
  public activate(): void {
    if (!this.isValid) {
      throw new Error('Cannot activate invalid workflow')
    }
    this.isActive = true
    this.updatedAt = new Date()
  }

  /**
   * Deactivate workflow
   */
  public deactivate(): void {
    this.isActive = false
    this.updatedAt = new Date()
  }

  /**
   * Validate workflow structure
   */
  public validate(): boolean {
    // Must have at least one trigger
    if (this.triggers.length === 0) {
      return false
    }

    // Must have at least one action
    if (this.actions.length === 0) {
      return false
    }

    // All nodes must be connected
    const nodeIds = this.nodes.map((n) => n.id)
    for (const edge of this.edges) {
      if (!nodeIds.includes(edge.source) || !nodeIds.includes(edge.target)) {
        return false
      }
    }

    this.isValid = true
    return true
  }

  /**
   * Check if workflow should execute for a thread
   */
  public shouldExecute(thread: Thread): boolean {
    if (!this.isActive || !this.isValid) {
      return false
    }

    // Check triggers
    const triggerMatches = this.triggers.some((trigger) => this.evaluateTrigger(trigger, thread))

    if (!triggerMatches) {
      return false
    }

    // Check conditions (ALL must pass)
    return this.conditions.every((condition) => this.evaluateCondition(condition, thread))
  }

  /**
   * Evaluate trigger against thread
   */
  private evaluateTrigger(trigger: WorkflowTrigger, thread: Thread): boolean {
    switch (trigger.type) {
      case 'new_message':
        return true // Always execute on new message
      case 'label_added':
        return thread.hasLabel(trigger.value)
      case 'starred':
        return thread.isStarred
      default:
        return false
    }
  }

  /**
   * Evaluate condition against thread
   */
  private evaluateCondition(condition: WorkflowCondition, thread: Thread): boolean {
    switch (condition.operator) {
      case 'has_label':
        return thread.hasLabel(condition.value)
      case 'from':
        // Would need to check messages in thread
        return true // Simplified
      case 'subject_contains':
        return thread.snippet.toLowerCase().includes(condition.value.toLowerCase())
      default:
        return false
    }
  }

  /**
   * Execute workflow on thread
   */
  public async execute(thread: Thread): Promise<void> {
    if (!this.shouldExecute(thread)) {
      return
    }

    for (const action of this.actions) {
      await this.executeAction(action, thread)
    }

    this.lastExecutedAt = new Date()
    this.executionCount++
  }

  /**
   * Execute single action
   */
  private async executeAction(action: WorkflowAction, thread: Thread): Promise<void> {
    switch (action.type) {
      case 'add_label':
        thread.addLabel(
          new Label({
            id: action.labelId,
            name: action.labelName,
            type: 'user',
          })
        )
        break
      case 'remove_label':
        thread.removeLabel(action.labelName)
        break
      case 'archive':
        thread.archive()
        break
      case 'mark_read':
        thread.markAsRead()
        break
      case 'star':
        thread.star()
        break
      default:
        console.warn(`Unknown action type: ${action.type}`)
    }
  }

  /**
   * Add node to workflow
   */
  public addNode(node: WorkflowNode): void {
    this.nodes.push(node)
    this.isValid = false // Re-validate after change
    this.updatedAt = new Date()
  }

  /**
   * Remove node from workflow
   */
  public removeNode(nodeId: string): void {
    this.nodes = this.nodes.filter((n) => n.id !== nodeId)
    this.edges = this.edges.filter((e) => e.source !== nodeId && e.target !== nodeId)
    this.isValid = false // Re-validate after change
    this.updatedAt = new Date()
  }

  /**
   * Add edge (connection) between nodes
   */
  public addEdge(edge: WorkflowEdge): void {
    this.edges.push(edge)
    this.isValid = false // Re-validate after change
    this.updatedAt = new Date()
  }

  /**
   * Get workflow statistics
   */
  public getStats(): WorkflowStats {
    return {
      id: this.id,
      name: this.name,
      executionCount: this.executionCount,
      lastExecutedAt: this.lastExecutedAt,
      isActive: this.isActive,
      triggerCount: this.triggers.length,
      actionCount: this.actions.length,
    }
  }
}
```

**File**: `src/domain/entities/Workflow.ts:1-250`

**Aggregate Root Responsibilities**:

- ✅ Maintains workflow consistency (validate before activate)
- ✅ Encapsulates complex business logic (trigger evaluation)
- ✅ Controls access to child entities (nodes, edges)
- ⚠️ execute() method should be in domain service, not entity

### 2.5 Attribute (Entity)

**Purpose**: Custom metadata that can be attached to threads or messages.

**Implementation**:

```typescript
// src/domain/entities/Attribute.ts
export class Attribute {
  // Identity
  public readonly id: string
  public key: string // Attribute key (e.g., "priority", "category")
  public value: string | number | boolean // Attribute value

  // Scope
  public scope: 'global' | 'item' // Global = all users, Item = per thread/message
  public itemId?: string // Thread/message ID (if scope=item)

  // Type
  public type: 'string' | 'number' | 'boolean' | 'date'

  // Metadata
  public createdAt: Date
  public updatedAt: Date
  public userId?: string // Owner (for item-scoped attributes)

  constructor(props: AttributeProps) {
    this.id = props.id
    this.key = props.key
    this.value = props.value
    this.scope = props.scope || 'item'
    this.itemId = props.itemId
    this.type = props.type || 'string'
    this.createdAt = props.createdAt || new Date()
    this.updatedAt = props.updatedAt || new Date()
    this.userId = props.userId
  }

  // Domain Methods

  /**
   * Update attribute value
   */
  public updateValue(value: string | number | boolean): void {
    if (typeof value !== this.type) {
      throw new Error(`Value type mismatch. Expected ${this.type}, got ${typeof value}`)
    }
    this.value = value
    this.updatedAt = new Date()
  }

  /**
   * Check if attribute is global
   */
  public isGlobal(): boolean {
    return this.scope === 'global'
  }

  /**
   * Check if attribute is item-scoped
   */
  public isItemScoped(): boolean {
    return this.scope === 'item'
  }

  /**
   * Get typed value
   */
  public getStringValue(): string | null {
    return this.type === 'string' ? String(this.value) : null
  }

  public getNumberValue(): number | null {
    return this.type === 'number' ? Number(this.value) : null
  }

  public getBooleanValue(): boolean | null {
    return this.type === 'boolean' ? Boolean(this.value) : null
  }

  public getDateValue(): Date | null {
    return this.type === 'date' ? new Date(this.value) : null
  }
}
```

**File**: `src/domain/entities/Attribute.ts:1-80`

---

## 3. Value Objects

### 3.1 EmailAddress (Value Object)

**Purpose**: Represents an email address with name and address components.

**Implementation**:

```typescript
// src/domain/value-objects/EmailAddress.ts
export class EmailAddress {
  public readonly name?: string // Display name (e.g., "John Doe")
  public readonly email: string // Email address (e.g., "john@example.com")

  constructor(email: string, name?: string) {
    this.email = EmailAddress.normalize(email)
    this.name = name

    if (!EmailAddress.isValid(this.email)) {
      throw new Error(`Invalid email address: ${email}`)
    }
  }

  /**
   * Normalize email address (lowercase)
   */
  private static normalize(email: string): string {
    return email.toLowerCase().trim()
  }

  /**
   * Validate email address format
   */
  public static isValid(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  /**
   * Get display string
   */
  public toString(): string {
    return this.name ? `${this.name} <${this.email}>` : this.email
  }

  /**
   * Get domain from email
   */
  public getDomain(): string {
    return this.email.split('@')[1]
  }

  /**
   * Check if email is from a specific domain
   */
  public isFromDomain(domain: string): boolean {
    return this.getDomain().toLowerCase() === domain.toLowerCase()
  }

  /**
   * Value object equality (by value, not reference)
   */
  public equals(other: EmailAddress): boolean {
    return this.email === other.email
  }
}
```

**File**: `src/domain/value-objects/EmailAddress.ts:1-60`

**Value Object Characteristics**:

- ✅ Immutable (readonly properties)
- ✅ Validation in constructor
- ✅ Equality by value, not reference
- ✅ No identity (no ID property)

### 3.2 ThreadId & MessageId (Value Objects)

**Purpose**: Type-safe identifiers for threads and messages.

**Implementation**:

```typescript
// src/domain/value-objects/ThreadId.ts
export class ThreadId {
  private readonly value: string

  constructor(value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error('ThreadId cannot be empty')
    }
    this.value = value.trim()
  }

  public toString(): string {
    return this.value
  }

  public equals(other: ThreadId): boolean {
    return this.value === other.value
  }

  public static from(value: string): ThreadId {
    return new ThreadId(value)
  }
}

// src/domain/value-objects/MessageId.ts
export class MessageId {
  private readonly value: string

  constructor(value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error('MessageId cannot be empty')
    }
    this.value = value.trim()
  }

  public toString(): string {
    return this.value
  }

  public equals(other: MessageId): boolean {
    return this.value === other.value
  }

  public static from(value: string): MessageId {
    return new MessageId(value)
  }
}
```

**Files**:

- `src/domain/value-objects/ThreadId.ts:1-25`
- `src/domain/value-objects/MessageId.ts:1-25`

**⚠️ ISSUE**: Not consistently used - many places still use plain strings for IDs

### 3.3 WorkflowCondition (Value Object)

**Purpose**: Represents a condition in a workflow rule.

**Implementation**:

```typescript
// src/domain/value-objects/WorkflowCondition.ts
export class WorkflowCondition {
  public readonly operator: ConditionOperator // 'has_label', 'from', 'subject_contains', etc.
  public readonly field: string // 'labels', 'from', 'subject', etc.
  public readonly value: string // Comparison value

  constructor(operator: ConditionOperator, field: string, value: string) {
    this.operator = operator
    this.field = field
    this.value = value
  }

  /**
   * Evaluate condition against a thread
   */
  public evaluate(thread: Thread, messages: Message[]): boolean {
    switch (this.operator) {
      case 'has_label':
        return thread.hasLabel(this.value)

      case 'from':
        return messages.some((msg) => msg.isFrom(this.value))

      case 'subject_contains':
        return messages.some((msg) => msg.subject.toLowerCase().includes(this.value.toLowerCase()))

      case 'is_read':
        return thread.isRead

      case 'is_starred':
        return thread.isStarred

      default:
        return false
    }
  }

  /**
   * Get human-readable description
   */
  public toString(): string {
    return `${this.field} ${this.operator} "${this.value}"`
  }

  public equals(other: WorkflowCondition): boolean {
    return (
      this.operator === other.operator && this.field === other.field && this.value === other.value
    )
  }
}

type ConditionOperator =
  | 'has_label'
  | 'from'
  | 'to'
  | 'subject_contains'
  | 'body_contains'
  | 'is_read'
  | 'is_unread'
  | 'is_starred'
  | 'has_attachment'
```

**File**: `src/domain/value-objects/WorkflowCondition.ts:1-70`

---

## 4. Aggregates & Boundaries

### 4.1 Thread Aggregate

```
┌─────────────────────────────────────────────────────────┐
│              Thread Aggregate                            │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Thread (Aggregate Root)                          │  │
│  │  - id                                             │  │
│  │  - messageIds: string[]  ───────────────┐        │  │
│  │  - labels: Label[]                       │        │  │
│  │  - flowState: ThreadFlowState           │        │  │
│  └───────────────────────────────────────────────────┘  │
│                                              │           │
│  Transactional Boundary                     │           │
│  (Changes to thread must be atomic)         │           │
│                                              │           │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Label (Entity - owned by Thread)                │  │
│  │  - id                                             │  │
│  │  - name                                           │  │
│  │  - type                                           │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │  ThreadFlowState (Value Object)                   │  │
│  │  - currentNodeId                                  │  │
│  │  - workflowId                                     │  │
│  │  - status                                         │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                                              │
                                              │ References (not owned)
                                              ▼
                            ┌─────────────────────────────┐
                            │  Message Aggregate          │
                            │  (Separate aggregate)       │
                            └─────────────────────────────┘
```

**Rationale**:

- Thread is aggregate root because it controls consistency of thread state
- Messages have their own aggregate (can be modified independently)
- Thread references messages by ID only (loose coupling)
- Labels are part of Thread aggregate (always modified together)

**File**: `src/domain/entities/Thread.ts:1-250`

### 4.2 Message Aggregate

```
┌─────────────────────────────────────────────────────────┐
│              Message Aggregate                           │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Message (Aggregate Root)                         │  │
│  │  - id                                             │  │
│  │  - threadId (reference to Thread)                │  │
│  │  - from: EmailAddress                            │  │
│  │  - to: EmailAddress[]                            │  │
│  │  - body: MessageBody                             │  │
│  │  - attachments: Attachment[]                     │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │  EmailAddress (Value Object)                      │  │
│  │  - email                                          │  │
│  │  - name                                           │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Attachment (Entity)                              │  │
│  │  - id                                             │  │
│  │  - filename                                       │  │
│  │  - mimeType                                       │  │
│  │  - size                                           │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**Rationale**:

- Message is separate aggregate because messages can be large (performance)
- Messages loaded on-demand, not eagerly with threads
- Attachments owned by message (always modified together)

### 4.3 Workflow Aggregate

```
┌─────────────────────────────────────────────────────────┐
│              Workflow Aggregate                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Workflow (Aggregate Root)                        │  │
│  │  - id                                             │  │
│  │  - nodes: WorkflowNode[]                         │  │
│  │  - edges: WorkflowEdge[]                         │  │
│  │  - triggers: WorkflowTrigger[]                   │  │
│  │  - conditions: WorkflowCondition[]               │  │
│  │  - actions: WorkflowAction[]                     │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │  WorkflowNode (Value Object)                      │  │
│  │  - id                                             │  │
│  │  - type                                           │  │
│  │  - position                                       │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │  WorkflowCondition (Value Object)                 │  │
│  │  - operator                                       │  │
│  │  - field                                          │  │
│  │  - value                                          │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**Rationale**:

- Workflow is aggregate root because all workflow components must be consistent
- Nodes, edges, triggers, conditions, actions are all owned by workflow
- Cannot modify a node without modifying the workflow (transactional boundary)

---

## 5. Domain Services

### 5.1 ThreadFilterService

**Purpose**: Filter and sort threads based on complex criteria.

**Implementation**:

```typescript
// src/domain/services/ThreadFilterService.ts
export class ThreadFilterService {
  /**
   * Filter threads by criteria
   */
  public filter(threads: Thread[], filter: ThreadFilter): Thread[] {
    return threads.filter((thread) => {
      // Label filter
      if (filter.labels && filter.labels.length > 0) {
        const hasMatchingLabel = filter.labels.some((labelName) => thread.hasLabel(labelName))
        if (!hasMatchingLabel) return false
      }

      // Read state filter
      if (filter.isRead !== undefined && thread.isRead !== filter.isRead) {
        return false
      }

      // Starred filter
      if (filter.isStarred !== undefined && thread.isStarred !== filter.isStarred) {
        return false
      }

      // Importance filter
      if (filter.isImportant !== undefined && thread.isImportant !== filter.isImportant) {
        return false
      }

      // Date range filter
      if (filter.dateFrom && thread.lastMessageDate < filter.dateFrom) {
        return false
      }

      if (filter.dateTo && thread.lastMessageDate > filter.dateTo) {
        return false
      }

      // Search query (snippet match)
      if (filter.query) {
        const query = filter.query.toLowerCase()
        if (!thread.snippet.toLowerCase().includes(query)) {
          return false
        }
      }

      return true
    })
  }

  /**
   * Sort threads by specified criteria
   */
  public sort(threads: Thread[], sortBy: ThreadSortCriteria): Thread[] {
    return [...threads].sort((a, b) => {
      switch (sortBy.field) {
        case 'date':
          const dateCompare = b.lastMessageDate.getTime() - a.lastMessageDate.getTime()
          return sortBy.direction === 'asc' ? -dateCompare : dateCompare

        case 'unread':
          const aUnread = a.isRead ? 0 : 1
          const bUnread = b.isRead ? 0 : 1
          return sortBy.direction === 'asc' ? aUnread - bUnread : bUnread - aUnread

        case 'starred':
          const aStarred = a.isStarred ? 1 : 0
          const bStarred = b.isStarred ? 1 : 0
          return sortBy.direction === 'asc' ? aStarred - bStarred : bStarred - aStarred

        case 'messageCount':
          const countCompare = a.getMessageCount() - b.getMessageCount()
          return sortBy.direction === 'asc' ? countCompare : -countCompare

        default:
          return 0
      }
    })
  }

  /**
   * Paginate threads
   */
  public paginate(threads: Thread[], page: number, pageSize: number): Thread[] {
    const startIndex = (page - 1) * pageSize
    return threads.slice(startIndex, startIndex + pageSize)
  }

  /**
   * Search threads (full-text search)
   */
  public search(threads: Thread[], query: string): Thread[] {
    const lowerQuery = query.toLowerCase()

    return threads.filter((thread) => {
      // Search in snippet
      if (thread.snippet.toLowerCase().includes(lowerQuery)) {
        return true
      }

      // Search in labels
      if (thread.labels.some((label) => label.name.toLowerCase().includes(lowerQuery))) {
        return true
      }

      return false
    })
  }
}
```

**File**: `src/domain/services/ThreadFilterService.ts:1-120`

**Domain Service Characteristics**:

- ✅ Stateless (no instance properties)
- ✅ Operates on multiple aggregates (threads)
- ✅ Pure domain logic (no infrastructure dependencies)
- ✅ Could be static methods, but service pattern allows easier testing

### 5.2 WorkflowEvaluator

**Purpose**: Evaluate if workflows should execute for a given thread.

**Implementation**:

```typescript
// src/domain/services/WorkflowEvaluator.ts
export class WorkflowEvaluator {
  /**
   * Find all workflows that should execute for a thread
   */
  public findMatchingWorkflows(
    workflows: Workflow[],
    thread: Thread,
    messages: Message[]
  ): Workflow[] {
    return workflows.filter((workflow) => {
      if (!workflow.isActive || !workflow.isValid) {
        return false
      }

      // Check triggers
      const triggerMatches = workflow.triggers.some((trigger) =>
        this.evaluateTrigger(trigger, thread, messages)
      )

      if (!triggerMatches) {
        return false
      }

      // Check conditions (ALL must pass)
      return workflow.conditions.every((condition) =>
        this.evaluateCondition(condition, thread, messages)
      )
    })
  }

  /**
   * Evaluate a single trigger
   */
  private evaluateTrigger(trigger: WorkflowTrigger, thread: Thread, messages: Message[]): boolean {
    switch (trigger.type) {
      case 'new_message':
        return true // Always matches for new messages

      case 'label_added':
        return thread.hasLabel(trigger.value)

      case 'starred':
        return thread.isStarred

      case 'unread':
        return !thread.isRead

      case 'from_domain':
        return messages.some((msg) => msg.from.isFromDomain(trigger.value))

      default:
        return false
    }
  }

  /**
   * Evaluate a single condition
   */
  private evaluateCondition(
    condition: WorkflowCondition,
    thread: Thread,
    messages: Message[]
  ): boolean {
    return condition.evaluate(thread, messages)
  }

  /**
   * Get execution priority for workflows
   * (Some workflows should run before others)
   */
  public prioritize(workflows: Workflow[]): Workflow[] {
    return [...workflows].sort((a, b) => {
      // Workflows with more conditions run first (more specific)
      const conditionDiff = b.conditions.length - a.conditions.length
      if (conditionDiff !== 0) return conditionDiff

      // Workflows with more actions run last (more impact)
      return a.actions.length - b.actions.length
    })
  }
}
```

**File**: `src/domain/services/WorkflowEvaluator.ts:1-90`

---

## 6. Domain Events

### 6.1 Domain Event Base Class

```typescript
// src/domain/events/DomainEvent.ts
export abstract class DomainEvent {
  public readonly eventId: string
  public readonly occurredAt: Date
  public readonly aggregateId: string

  constructor(aggregateId: string) {
    this.eventId = generateId()
    this.occurredAt = new Date()
    this.aggregateId = aggregateId
  }

  public abstract get eventType(): string
}
```

**File**: `src/domain/events/DomainEvent.ts:1-15`

### 6.2 Specific Domain Events

**⚠️ ISSUE**: Domain events are DEFINED but NOT EMITTED in v1

```typescript
// src/domain/events/ThreadUpdatedEvent.ts
export class ThreadUpdatedEvent extends DomainEvent {
  constructor(
    public readonly threadId: string,
    public readonly changes: Partial<Thread>
  ) {
    super(threadId)
  }

  public get eventType(): string {
    return 'ThreadUpdated'
  }
}

// src/domain/events/MessageReceivedEvent.ts
export class MessageReceivedEvent extends DomainEvent {
  constructor(
    public readonly messageId: string,
    public readonly threadId: string
  ) {
    super(messageId)
  }

  public get eventType(): string {
    return 'MessageReceived'
  }
}

// src/domain/events/WorkflowExecutedEvent.ts
export class WorkflowExecutedEvent extends DomainEvent {
  constructor(
    public readonly workflowId: string,
    public readonly threadId: string,
    public readonly success: boolean
  ) {
    super(workflowId)
  }

  public get eventType(): string {
    return 'WorkflowExecuted'
  }
}
```

**Files**:

- `src/domain/events/ThreadUpdatedEvent.ts:1-15`
- `src/domain/events/MessageReceivedEvent.ts:1-15`
- `src/domain/events/WorkflowExecutedEvent.ts:1-15`

**Missing Implementation**:

```typescript
// Should be implemented but ISN'T:
export class Thread {
  private domainEvents: DomainEvent[] = []

  public addLabel(label: Label): void {
    if (!this.hasLabel(label.name)) {
      this.labels.push(label)
      this.updatedAt = new Date()

      // ❌ NOT IMPLEMENTED: Emit domain event
      this.domainEvents.push(new ThreadUpdatedEvent(this.id, { labels: this.labels }))
    }
  }

  public getDomainEvents(): DomainEvent[] {
    return this.domainEvents
  }

  public clearDomainEvents(): void {
    this.domainEvents = []
  }
}
```

---

## 7. Repositories

### 7.1 Repository Interface (Domain Layer)

```typescript
// src/domain/repositories/IThreadRepository.ts
export interface IThreadRepository {
  // Queries
  findById(id: string): Promise<Thread | null>
  findAll(): Promise<Thread[]>
  findByLabel(labelName: string): Promise<Thread[]>
  findUnread(): Promise<Thread[]>
  findStarred(): Promise<Thread[]>
  search(query: string): Promise<Thread[]>

  // Commands
  save(thread: Thread): Promise<void>
  saveMany(threads: Thread[]): Promise<void>
  delete(id: string): Promise<void>

  // Counts
  count(): Promise<number>
  countUnread(): Promise<number>
}
```

**File**: `src/domain/repositories/IThreadRepository.ts:1-20`

**✅ Good Practice**: Repository interface in domain layer, implementation in infrastructure

### 7.2 Repository Implementation (Infrastructure Layer)

```typescript
// src/infrastructure/repositories/ThreadRepository.ts
import { IThreadRepository } from '@/domain/repositories/IThreadRepository'
import { Thread } from '@/domain/entities/Thread'
import { db } from '@/infrastructure/database/database'

export class ThreadRepository implements IThreadRepository {
  public async findById(id: string): Promise<Thread | null> {
    const doc = await db.threads.findOne(id).exec()
    return doc ? this.mapToEntity(doc) : null
  }

  public async findAll(): Promise<Thread[]> {
    const docs = await db.threads.find().exec()
    return docs.map((doc) => this.mapToEntity(doc))
  }

  public async findByLabel(labelName: string): Promise<Thread[]> {
    const docs = await db.threads
      .find({
        selector: {
          'labels.name': labelName,
        },
      })
      .exec()

    return docs.map((doc) => this.mapToEntity(doc))
  }

  public async findUnread(): Promise<Thread[]> {
    const docs = await db.threads
      .find({
        selector: {
          isRead: false,
        },
      })
      .exec()

    return docs.map((doc) => this.mapToEntity(doc))
  }

  public async save(thread: Thread): Promise<void> {
    const doc = this.mapToDocument(thread)
    await db.threads.upsert(doc)

    // ⚠️ MISSING: Publish domain events
    // const events = thread.getDomainEvents();
    // for (const event of events) {
    //   await eventBus.publish(event);
    // }
    // thread.clearDomainEvents();
  }

  public async saveMany(threads: Thread[]): Promise<void> {
    const docs = threads.map((thread) => this.mapToDocument(thread))
    await db.threads.bulkUpsert(docs)
  }

  public async delete(id: string): Promise<void> {
    const doc = await db.threads.findOne(id).exec()
    if (doc) {
      await doc.remove()
    }
  }

  public async count(): Promise<number> {
    return await db.threads.count().exec()
  }

  public async countUnread(): Promise<number> {
    return await db.threads
      .count({
        selector: {
          isRead: false,
        },
      })
      .exec()
  }

  /**
   * Map RxDB document to domain entity
   */
  private mapToEntity(doc: any): Thread {
    return new Thread({
      id: doc.id,
      historyId: doc.historyId,
      snippet: doc.snippet,
      messageIds: doc.messageIds,
      labels: doc.labels || [],
      isRead: doc.isRead,
      isStarred: doc.isStarred,
      isDraft: doc.isDraft,
      isImportant: doc.isImportant,
      flowState: doc.flowState,
      createdAt: new Date(doc.createdAt),
      updatedAt: new Date(doc.updatedAt),
      lastMessageDate: new Date(doc.lastMessageDate),
    })
  }

  /**
   * Map domain entity to RxDB document
   */
  private mapToDocument(thread: Thread): any {
    return {
      id: thread.id,
      historyId: thread.historyId,
      snippet: thread.snippet,
      messageIds: thread.messageIds,
      labels: thread.labels,
      isRead: thread.isRead,
      isStarred: thread.isStarred,
      isDraft: thread.isDraft,
      isImportant: thread.isImportant,
      flowState: thread.flowState,
      createdAt: thread.createdAt.toISOString(),
      updatedAt: thread.updatedAt.toISOString(),
      lastMessageDate: thread.lastMessageDate.toISOString(),
    }
  }
}
```

**File**: `src/infrastructure/repositories/ThreadRepository.ts:1-140`

**Repository Pattern Benefits**:

- ✅ Hides persistence details from domain
- ✅ Allows swapping RxDB for another database
- ✅ Mapping layer keeps domain pure
- ⚠️ Missing: Domain event publication

---

## 8. Domain Model Issues

### 8.1 Critical Issues (P0)

#### 1. Anemic Domain Models

**Issue**: Some entities are just data bags with no behavior (anemic models).

**Example**:

```typescript
// ❌ BAD: Anemic model
export class ThreadFlowState {
  public currentNodeId: string
  public workflowId: string
  public status: string
  public data: any
}

// No methods, just data!
// Business logic is scattered in services instead
```

**File**: `src/domain/entities/ThreadFlowState.ts:1-10`

**Impact**: Business logic leaks into application/infrastructure layers

**Recommendation**:

```typescript
// ✅ GOOD: Rich domain model
export class ThreadFlowState {
  public currentNodeId: string
  public workflowId: string
  public status: FlowStatus
  public data: Record<string, any>
  public startedAt: Date
  public completedAt?: Date

  constructor(props: ThreadFlowStateProps) {
    this.currentNodeId = props.currentNodeId
    this.workflowId = props.workflowId
    this.status = props.status || FlowStatus.PENDING
    this.data = props.data || {}
    this.startedAt = props.startedAt || new Date()
    this.completedAt = props.completedAt
  }

  // Domain behavior
  public moveToNode(nodeId: string): void {
    this.currentNodeId = nodeId
    this.status = FlowStatus.IN_PROGRESS
  }

  public complete(): void {
    this.status = FlowStatus.COMPLETED
    this.completedAt = new Date()
  }

  public fail(error: string): void {
    this.status = FlowStatus.FAILED
    this.data.error = error
    this.completedAt = new Date()
  }

  public isCompleted(): boolean {
    return this.status === FlowStatus.COMPLETED
  }

  public isFailed(): boolean {
    return this.status === FlowStatus.FAILED
  }

  public getElapsedTime(): number {
    const endTime = this.completedAt || new Date()
    return endTime.getTime() - this.startedAt.getTime()
  }
}

enum FlowStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
}
```

#### 2. Domain Events Not Emitted

**Issue**: Domain events are defined but never emitted or published.

**Current State**:

```typescript
// Domain events exist...
export class ThreadUpdatedEvent extends DomainEvent { ... }

// But entities never emit them!
export class Thread {
  public addLabel(label: Label): void {
    this.labels.push(label);
    // ❌ NO EVENT EMITTED!
  }
}
```

**Impact**:

- No audit trail of changes
- Cannot react to domain events (e.g., trigger workflows)
- Difficult to implement event sourcing later

**Recommendation**: Implement event collection pattern

```typescript
export abstract class Entity {
  private _domainEvents: DomainEvent[] = []

  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event)
  }

  public getDomainEvents(): DomainEvent[] {
    return [...this._domainEvents]
  }

  public clearDomainEvents(): void {
    this._domainEvents = []
  }
}

export class Thread extends Entity {
  public addLabel(label: Label): void {
    if (!this.hasLabel(label.name)) {
      this.labels.push(label)
      this.updatedAt = new Date()

      // ✅ EMIT EVENT
      this.addDomainEvent(new ThreadLabelAddedEvent(this.id, label.name))
    }
  }
}

// In repository:
export class ThreadRepository {
  public async save(thread: Thread): Promise<void> {
    await db.threads.upsert(this.mapToDocument(thread))

    // ✅ PUBLISH EVENTS
    const events = thread.getDomainEvents()
    for (const event of events) {
      await eventBus.publish(event)
    }
    thread.clearDomainEvents()
  }
}
```

### 8.2 High Priority Issues (P1)

#### 3. Inconsistent Value Object Usage

**Issue**: Value objects defined but not consistently used throughout codebase.

**Example**:

```typescript
// ThreadId and MessageId value objects exist...
export class ThreadId { ... }
export class MessageId { ... }

// But most code still uses plain strings!
export class Thread {
  public readonly id: string;  // ❌ Should be: public readonly id: ThreadId;
  public readonly messageIds: string[];  // ❌ Should be: MessageId[]
}
```

**Recommendation**: Use value objects consistently for type safety

#### 4. Workflow Execute Logic in Entity

**Issue**: Workflow.execute() contains orchestration logic that belongs in a domain service.

**File**: `src/domain/entities/Workflow.ts:180-210`

**Problem**:

```typescript
// ❌ Entity doing too much
export class Workflow {
  public async execute(thread: Thread): Promise<void> {
    for (const action of this.actions) {
      await this.executeAction(action, thread) // Side effects!
    }
  }
}
```

**Recommendation**: Move to WorkflowExecutionService

```typescript
// ✅ Domain service
export class WorkflowExecutionService {
  public async execute(workflow: Workflow, thread: Thread): Promise<void> {
    if (!workflow.shouldExecute(thread)) {
      return
    }

    for (const action of workflow.actions) {
      await this.executeAction(action, thread)
    }

    workflow.recordExecution() // Update metadata only
  }
}
```

### 8.3 Medium Priority Issues (P2)

#### 5. Lack of Validation in Constructors

**Issue**: Some entities don't validate inputs in constructors.

**Example**:

```typescript
// ❌ No validation
export class Thread {
  constructor(props: ThreadProps) {
    this.id = props.id // What if empty?
    this.messageIds = props.messageIds // What if null?
  }
}
```

**Recommendation**: Use validation library (Zod)

```typescript
import { z } from 'zod'

const ThreadSchema = z.object({
  id: z.string().min(1),
  messageIds: z.array(z.string()).min(1),
  snippet: z.string(),
  labels: z.array(LabelSchema),
  // ...
})

export class Thread {
  constructor(props: ThreadProps) {
    // Validate inputs
    const validated = ThreadSchema.parse(props)

    this.id = validated.id
    this.messageIds = validated.messageIds
    // ...
  }
}
```

#### 6. Missing Domain Invariants

**Issue**: No enforcement of domain invariants (business rules that must ALWAYS be true).

**Examples of Missing Invariants**:

- Thread must have at least one message
- Message must have a valid sender email
- Workflow must have at least one trigger AND one action
- Labels cannot be duplicated within a thread

**Recommendation**: Add invariant checks

```typescript
export class Thread {
  constructor(props: ThreadProps) {
    // Invariant: Must have at least one message
    if (!props.messageIds || props.messageIds.length === 0) {
      throw new Error('Thread must have at least one message')
    }

    // Invariant: Cannot have duplicate labels
    const labelNames = props.labels.map((l) => l.name)
    const uniqueNames = new Set(labelNames)
    if (labelNames.length !== uniqueNames.size) {
      throw new Error('Thread cannot have duplicate labels')
    }

    this.id = props.id
    this.messageIds = props.messageIds
    this.labels = props.labels
  }

  public addLabel(label: Label): void {
    // Invariant enforced: No duplicate labels
    if (this.hasLabel(label.name)) {
      return // Idempotent
    }

    this.labels.push(label)
  }
}
```

---

## 9. Recommendations for v2

### 9.1 Core Domain Improvements (P0)

#### 1. Enrich Domain Models with Behavior

**Goal**: Move from anemic models to rich domain models

**Action Items**:

- [ ] Audit all entities for missing behavior
- [ ] Move business logic from services INTO entities
- [ ] Add domain methods for all state changes
- [ ] Remove setters, use intention-revealing methods

**Example**:

```typescript
// Instead of:
thread.isRead = true // ❌ Direct state manipulation

// Do:
thread.markAsRead() // ✅ Intention-revealing method
```

#### 2. Implement Domain Event Infrastructure

**Goal**: Full event-driven architecture for domain changes

**Action Items**:

- [ ] Create Entity base class with event collection
- [ ] Emit events from all aggregate roots
- [ ] Create event bus/mediator
- [ ] Publish events after persistence
- [ ] Create event handlers for workflows, analytics

**Implementation**:

```typescript
// src/domain/base/Entity.ts
export abstract class Entity {
  private _domainEvents: DomainEvent[] = []

  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event)
  }

  public getDomainEvents(): DomainEvent[] {
    return [...this._domainEvents]
  }

  public clearDomainEvents(): void {
    this._domainEvents = []
  }
}

// src/domain/events/DomainEventBus.ts
export class DomainEventBus {
  private handlers: Map<string, DomainEventHandler[]> = new Map()

  public subscribe(eventType: string, handler: DomainEventHandler): void {
    const existingHandlers = this.handlers.get(eventType) || []
    this.handlers.set(eventType, [...existingHandlers, handler])
  }

  public async publish(event: DomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.eventType) || []

    for (const handler of handlers) {
      await handler.handle(event)
    }
  }
}

// Usage:
eventBus.subscribe('ThreadLabelAdded', new TriggerWorkflowsHandler())
eventBus.subscribe('ThreadLabelAdded', new AuditLogHandler())
```

#### 3. Enforce Domain Invariants

**Goal**: Ensure business rules are ALWAYS enforced

**Action Items**:

- [ ] Document all domain invariants
- [ ] Validate invariants in constructors
- [ ] Validate invariants in domain methods
- [ ] Use Zod schemas for runtime validation
- [ ] Throw domain-specific exceptions

**Example**:

```typescript
// src/domain/exceptions/DomainException.ts
export class DomainException extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DomainException'
  }
}

export class InvalidThreadException extends DomainException {}
export class InvalidWorkflowException extends DomainException {}

// Usage:
export class Thread extends Entity {
  constructor(props: ThreadProps) {
    super()

    // Invariant validation
    if (!props.messageIds || props.messageIds.length === 0) {
      throw new InvalidThreadException('Thread must have at least one message')
    }

    if (!props.id || props.id.trim().length === 0) {
      throw new InvalidThreadException('Thread ID cannot be empty')
    }

    this.id = props.id
    this.messageIds = props.messageIds
  }
}
```

### 9.2 High Priority Improvements (P1)

#### 4. Consistent Value Object Usage

**Action Items**:

- [ ] Replace all ID strings with ThreadId/MessageId value objects
- [ ] Create EmailAddress value object usage throughout
- [ ] Add value objects for dates, timestamps (to prevent timezone issues)
- [ ] Create value objects for enums (LabelType, WorkflowStatus)

#### 5. Separate Workflow Execution into Domain Service

**Action Items**:

- [ ] Create WorkflowExecutionService domain service
- [ ] Move execute logic from Workflow entity to service
- [ ] Keep evaluation logic (shouldExecute) in entity
- [ ] Service orchestrates execution, entity maintains rules

#### 6. Add Domain-Specific Repositories

**Action Items**:

- [ ] Create ThreadRepository with domain-specific queries
- [ ] Create WorkflowRepository with query methods
- [ ] Move complex queries from use cases to repositories
- [ ] Keep repositories focused on aggregate roots only

### 9.3 Medium Priority Improvements (P2)

#### 7. Document Ubiquitous Language

**Goal**: Create shared vocabulary between developers and domain experts

**Action Items**:

- [ ] Document all domain terms in glossary
- [ ] Use consistent terminology in code and docs
- [ ] Align code names with business terms

**Example Glossary**:

- **Thread**: A conversation containing one or more messages
- **Label**: A category or tag applied to threads (Gmail concept)
- **Workflow**: An automation rule that processes threads
- **Trigger**: The event that starts a workflow execution
- **Condition**: A filter that determines if workflow actions execute
- **Action**: An operation performed on a thread (add label, archive, etc.)

#### 8. Implement Specification Pattern

**Goal**: Encapsulate complex filtering logic

**Action Items**:

- [ ] Create Specification base class
- [ ] Implement specific specifications (UnreadThreadSpec, StarredThreadSpec)
- [ ] Compose specifications with AND/OR/NOT
- [ ] Use in repositories and services

**Implementation**:

```typescript
// src/domain/specifications/Specification.ts
export abstract class Specification<T> {
  public abstract isSatisfiedBy(item: T): boolean

  public and(other: Specification<T>): Specification<T> {
    return new AndSpecification(this, other)
  }

  public or(other: Specification<T>): Specification<T> {
    return new OrSpecification(this, other)
  }

  public not(): Specification<T> {
    return new NotSpecification(this)
  }
}

// src/domain/specifications/UnreadThreadSpec.ts
export class UnreadThreadSpec extends Specification<Thread> {
  public isSatisfiedBy(thread: Thread): boolean {
    return !thread.isRead
  }
}

// Usage:
const unreadSpec = new UnreadThreadSpec()
const starredSpec = new StarredThreadSpec()
const unreadAndStarred = unreadSpec.and(starredSpec)

const matchingThreads = threads.filter((thread) => unreadAndStarred.isSatisfiedBy(thread))
```

---

## 10. Appendix

### A. Domain Model UML Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                        Domain Model                               │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────┐          ┌─────────────┐                       │
│  │   Thread    │1       * │   Label     │                       │
│  │  (Aggregate │◆─────────│   (Entity)  │                       │
│  │    Root)    │          └─────────────┘                       │
│  ├─────────────┤                                                 │
│  │ - id        │                                                 │
│  │ - messageIds│──────┐                                         │
│  │ - labels    │      │                                         │
│  │ - isRead    │      │ References                              │
│  │ - isStarred │      │                                         │
│  ├─────────────┤      │                                         │
│  │ + addLabel()│      │   ┌─────────────┐                       │
│  │ + archive() │      └──▶│   Message   │                       │
│  │ + star()    │          │  (Aggregate │                       │
│  └─────────────┘          │    Root)    │                       │
│                            ├─────────────┤                       │
│                            │ - id        │                       │
│  ┌─────────────┐          │ - threadId  │                       │
│  │  Workflow   │          │ - from      │──────┐               │
│  │  (Aggregate │          │ - to        │      │               │
│  │    Root)    │          │ - body      │      │               │
│  ├─────────────┤          ├─────────────┤      │ Contains      │
│  │ - id        │          │ + isReply() │      │               │
│  │ - nodes     │          └─────────────┘      │               │
│  │ - triggers  │                               │               │
│  │ - conditions│                               │               │
│  │ - actions   │                               │               │
│  ├─────────────┤                               │               │
│  │ + execute() │          ┌─────────────┐      │               │
│  │ + validate()│          │EmailAddress │◆─────┘               │
│  └─────────────┘          │ (Value Obj) │                       │
│                            ├─────────────┤                       │
│                            │ - email     │                       │
│  ┌─────────────┐          │ - name      │                       │
│  │  Attribute  │          ├─────────────┤                       │
│  │  (Entity)   │          │ + isValid() │                       │
│  ├─────────────┤          └─────────────┘                       │
│  │ - id        │                                                 │
│  │ - key       │                                                 │
│  │ - value     │          ┌─────────────┐                       │
│  │ - scope     │          │  ThreadId   │                       │
│  ├─────────────┤          │ (Value Obj) │                       │
│  │ + isGlobal()│          ├─────────────┤                       │
│  └─────────────┘          │ - value     │                       │
│                            ├─────────────┤                       │
│                            │ + equals()  │                       │
│                            └─────────────┘                       │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### B. Entity vs Value Object Checklist

**Use Entity When**:

- ✅ Has unique identity
- ✅ Identity matters more than attributes
- ✅ Can change over time (mutable)
- ✅ Continuity is important
- ✅ Examples: Thread, Message, Workflow

**Use Value Object When**:

- ✅ Defined by attributes, not identity
- ✅ Immutable (never changes)
- ✅ Equality by value comparison
- ✅ Can be shared/cached
- ✅ Examples: EmailAddress, ThreadId, WorkflowCondition

### C. Domain Validation Checklist

- [ ] All entities validate inputs in constructors
- [ ] Domain invariants are enforced
- [ ] Methods have intention-revealing names
- [ ] No public setters (use methods instead)
- [ ] Value objects are immutable
- [ ] Entities encapsulate behavior, not just data
- [ ] Domain logic is NOT in services (unless cross-aggregate)
- [ ] No infrastructure dependencies in domain layer
- [ ] Repository interfaces in domain, implementations in infrastructure
- [ ] Domain events emitted for all state changes

---

**Document End**

For v2 implementation, focus on **enriching domain models with behavior**, **implementing domain events**, and **enforcing invariants consistently**. The current domain model provides a solid foundation but needs these enhancements to reach full DDD maturity.
