# Claine Email Client - Brownfield Architecture Document

## Introduction

This document captures the **CURRENT STATE** of the Claine email client (v1) codebase as it exists at `/Users/hansnieuwenhuis/vscode/claine-rebuild/`. This is a comprehensive brownfield analysis created to inform a **complete v2 rebuild** based on lessons learned from the current implementation.

### Purpose

This document serves as:
1. **Reference Material** - Understanding what exists in v1
2. **Lessons Learned** - Identifying what worked and what didn't
3. **Rebuild Guide** - Informing architecture decisions for v2
4. **Technical Debt Catalog** - Documenting known issues and bottlenecks

### Document Scope

**Comprehensive analysis** covering:
- Complete system architecture and patterns
- Performance bottlenecks and issues (especially in sync, workflow, UI nav)
- Technical debt and "slop" requiring cleanup
- What to preserve vs. what to reimagine in v2

### Project Context

**Claine v1** is a modern Gmail client featuring:
- Offline-first architecture with RxDB
- Visual workflow automation engine
- Incremental Gmail API synchronization
- Custom attribute system for email management
- Hybrid client-server storage with MongoDB replication

### Key Focus Areas for v2 Rebuild

Based on user requirements, emphasis on:
1. **Synchronization System** - Make it smarter, faster, more performant
2. **Workflow Engine** - Enhance and optimize the visual builder
3. **Database Architecture** - Improve query performance and data flow
4. **Hybrid Storage** - Refine client-server replication
5. **UI Navigation** - Achieve sub-millisecond navigation performance

### Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2025-10-27 | 1.0 | Initial brownfield analysis for v2 rebuild | Winston (Architect Agent) |

---

## Quick Reference - Critical Files and Entry Points

### Main Entry Points

- **Client Entry**: `src/main.tsx` - Bootstraps React app, initializes RxDB
- **Client Root Component**: `src/App.tsx` - Router and theme provider
- **Presentation Root**: `src/presentation/App.tsx` - Main app layout
- **Server Entry**: `server/src/server.ts` - Express server with replication endpoints

### Core Business Logic

- **Synchronization**: `src/infrastructure/services/synchronization/SynchronizationService.ts` (3,225 lines)
- **Workflow Execution**: `src/infrastructure/services/workflow/WorkflowExecutor.ts` (666 lines)
- **Database Init**: `src/infrastructure/database/database.ts` (264 lines)
- **Gmail API**: `src/infrastructure/api/gmail/` - API client implementation

### Critical Configuration

- **Package Definition**: `package.json` - React 19, RxDB 16.8.1, Vite 6
- **Build Config**: `vite.config.ts` - Dev server, aliases, ignored files
- **TypeScript**: `tsconfig.json` - Strict mode, path aliases

### Data Models

- **Thread Schema**: `src/infrastructure/database/schema.ts:12-59`
- **Message Schema**: `src/infrastructure/database/schema.ts:62-145`
- **Workflow Schema**: `src/infrastructure/database/workflowSchema.ts:162-243`
- **All Schemas**: `src/infrastructure/database/*.ts` (10 schemas total)

### For V2 Rebuild - Must Read First

1. **Sync Performance Analysis**: Section 6.1 - Synchronization System Deep Dive
2. **Workflow Engine Issues**: Section 6.2 - Workflow Architecture
3. **Database Bottlenecks**: Section 6.3 - Data Access Performance
4. **UI Navigation Problems**: Section 6.4 - Frontend Performance
5. **Technical Debt Summary**: Section 9 - Complete Debt Catalog

---

## High Level Architecture

### Technical Summary

**Claine v1** is a sophisticated single-page application (SPA) email client with:

- **Architecture Pattern**: Clean Architecture (Domain-driven design)
- **Frontend**: React 19 + TypeScript + Tailwind CSS
- **State Management**: RxDB (reactive database) + RxJS observables
- **Local Database**: RxDB with Dexie storage (IndexedDB)
- **Server Backend**: Node.js + Express + RxDB + MongoDB
- **API Integration**: Gmail API with OAuth 2.0 (Google Identity Services)
- **Build System**: Vite 6 with hot module replacement

### Actual Tech Stack (from package.json)

| Category | Technology | Version | Notes |
|----------|------------|---------|-------|
| **Runtime** | Node.js | 18+ | Required minimum |
| **Frontend Framework** | React | 19.0.0 | Latest with concurrent features |
| **Language** | TypeScript | 5.8.2 | Strict mode enabled |
| **Build Tool** | Vite | 6.2.3 | Fast HMR and bundling |
| **Database (Client)** | RxDB | 16.8.1 | Reactive NoSQL with Dexie adapter |
| **Database (Server)** | MongoDB | 6.18.0 | Via RxDB MongoDB adapter |
| **Styling** | Tailwind CSS | 4.0.17 | Utility-first CSS |
| **UI Components** | Radix UI | Various | Headless components |
| **Visual Flows** | ReactFlow (@xyflow/react) | 12.7.1 | Workflow designer |
| **Router** | React Router | 7.4.0 | Client-side routing |
| **Icons** | Lucide React | 0.484.0 | Icon library |
| **Date Handling** | date-fns | 4.1.0 | Date utilities |
| **Testing** | Vitest + Playwright | Latest | Unit and E2E tests |

### Server Tech Stack (from server/package.json)

| Category | Technology | Version | Notes |
|----------|------------|---------|-------|
| **Server Framework** | Express | 4.18.2 | REST API server |
| **Database** | MongoDB | 6.18.0 | Document store |
| **RxDB Server** | rxdb-server | latest | Replication protocol |
| **Authentication** | jsonwebtoken | 9.0.2 | JWT tokens |
| **CORS** | cors | 2.8.5 | Cross-origin handling |

### Repository Structure Reality Check

```
/Users/hansnieuwenhuis/vscode/claine-rebuild/
├── src/                           # Client source code
│   ├── application/               # Use cases (Clean Architecture)
│   │   ├── useCases/              # 8 use cases (Archive, Delete, GetThreads, etc.)
│   │   └── services/              # Application services
│   ├── components/                # Shared UI components
│   │   ├── ui/                    # Base UI components (shadcn)
│   │   ├── mail/                  # Email-specific components
│   │   ├── settings/              # Settings components
│   │   └── layout/                # Layout components
│   ├── contexts/                  # React contexts
│   ├── domain/                    # Domain entities and types
│   │   ├── entities/              # Thread, Message entities
│   │   ├── repositories/          # Repository interfaces
│   │   ├── types/                 # Domain type definitions
│   │   └── valueObjects/          # EmailAddress, MessageBody, Attachment
│   ├── hooks/                     # 15 custom React hooks
│   ├── infrastructure/            # External concerns
│   │   ├── api/                   # Gmail API integration
│   │   │   └── gmail/             # Gmail-specific API client
│   │   ├── database/              # RxDB setup and schemas (14 files)
│   │   ├── repositories/          # Concrete repository implementations
│   │   └── services/              # Infrastructure services
│   │       ├── synchronization/   # 5 sync-related files
│   │       ├── workflow/          # Workflow execution engine
│   │       ├── migration/         # Data migration system
│   │       ├── replication/       # Client-server sync
│   │       ├── attributes/        # Custom attributes system
│   │       ├── activity/          # Activity logging
│   │       ├── feature-flags/     # Feature toggles
│   │       └── cache/             # Caching layer
│   ├── lib/                       # Utility functions
│   ├── presentation/              # UI layer (presentational components)
│   │   ├── components/            # Presentation components
│   │   ├── pages/                 # 14 page components
│   │   └── App.tsx                # Main app component
│   ├── utils/                     # Utility functions
│   ├── main.tsx                   # Application entry point
│   ├── App.tsx                    # Root router component
│   └── index.css                  # Global styles
├── server/                        # Server-side code
│   ├── src/
│   │   ├── database/              # MongoDB RxDB setup
│   │   │   └── schemas/           # 3 replicated schemas
│   │   ├── endpoints/             # API endpoints
│   │   ├── auth/                  # Authentication middleware
│   │   ├── replication/           # Replication endpoints
│   │   ├── storage/               # File storage
│   │   └── server.ts              # Express server entry
│   └── package.json               # Server dependencies
├── tests/                         # Test files
├── scripts/                       # Build and utility scripts
├── dist/                          # Build output
├── node_modules/                  # Dependencies
├── package.json                   # Client dependencies
├── vite.config.ts                 # Vite configuration
├── tsconfig.json                  # TypeScript configuration
├── index.html                     # HTML entry point
└── README.md                      # Documentation
```

**Type**: Monorepo (client + server in single repo)
**Package Manager**: npm
**Notable**: Clean Architecture with clear separation of concerns, but some boundary violations exist

---

## Source Tree and Module Organization

### Project Structure (Actual)

The codebase follows **Clean Architecture principles** with domain-driven design:

```
Clean Architecture Layers:
┌─────────────────────────────────────────────────┐
│  Presentation (UI Components, Pages, Hooks)     │  ← React components
├─────────────────────────────────────────────────┤
│  Application (Use Cases, Application Services)  │  ← Business workflows
├─────────────────────────────────────────────────┤
│  Domain (Entities, Value Objects, Interfaces)   │  ← Core business logic
├─────────────────────────────────────────────────┤
│  Infrastructure (API, Database, Services)       │  ← External integrations
└─────────────────────────────────────────────────┘
```

### Key Modules and Their Purpose

#### Domain Layer (`src/domain/`)

**Purpose**: Core business logic, framework-independent

**Key Files**:
- `entities/Thread.ts` - Email thread aggregate root
- `entities/Message.ts` - Email message entity
- `valueObjects/EmailAddress.ts` - Email address with name
- `valueObjects/MessageBody.ts` - HTML/text message content
- `valueObjects/Attachment.ts` - File attachment metadata
- `repositories/*.ts` - Repository interfaces (dependency inversion)

**Characteristics**:
- No external dependencies (pure TypeScript)
- Immutable value objects
- Entity constructors with validation

#### Application Layer (`src/application/`)

**Purpose**: Use cases and application workflows

**Use Cases** (`useCases/`):
1. `ArchiveThread.ts` - Archive email thread
2. `DeleteThread.ts` - Delete email thread
3. `DownloadAttachment.ts` - Download file attachment
4. `GetLabels.ts` - Fetch available labels
5. `GetThreadDetail.ts` - Fetch complete thread with messages
6. `GetThreadsByLabel.ts` - Query threads by label
7. `MarkThreadRead.ts` - Mark thread as read
8. `PerformThreadAction.ts` - Generic thread action executor

**Services** (`services/`):
- Application-level orchestration
- Coordinates multiple repositories
- Implements business workflows

#### Infrastructure Layer (`src/infrastructure/`)

**Purpose**: External integrations, databases, APIs

**Critical Services**:

1. **Synchronization System** (`services/synchronization/`):
   - `SynchronizationService.ts` (3,225 lines) - Main sync orchestrator
   - `IncrementalSyncService.ts` (22,919 bytes) - History API sync
   - `SyncQueueManager.ts` (21,028 bytes) - Offline operation queue
   - `EnhancedSyncTracker.ts` - Progress tracking

2. **Workflow Engine** (`services/workflow/`):
   - `WorkflowService.ts` (281 lines) - CRUD operations
   - `WorkflowExecutor.ts` (666 lines) - Execution engine
   - `FlowExecutionContext.ts` (220 lines) - Runtime context
   - `ActionExecutionService.ts` - Action node handler

3. **Database** (`database/`):
   - `database.ts` - RxDB singleton initialization
   - `schema.ts` - Thread, Message, Label schemas
   - `workflowSchema.ts` - Workflow definition schema
   - `activityLogSchema.ts` - Audit trail schema
   - `syncMetadataSchema.ts` - Sync checkpoint storage
   - Plus 5 more specialized schemas

4. **Gmail API** (`api/gmail/`):
   - Gmail API client with rate limiting
   - OAuth 2.0 authentication flow
   - Batch request support

5. **Replication** (`services/replication/`):
   - `RxDBServerReplication.ts` - Client-server sync
   - Pull/push replication handlers

#### Presentation Layer (`src/presentation/`)

**Purpose**: React components and UI logic

**Structure**:
- `pages/` - 14 page components (ThreadPage, WorkflowsPage, etc.)
- `components/` - Reusable UI components
  - `workflow/` - Workflow designer components (1,113 lines main designer)
  - `mail/` - Email UI components
  - `attributes/` - Custom attributes UI
  - `common/` - Shared components

### N+1 Query Problems (CRITICAL)

**Issue**: `use-mail-threads.ts` had severe N+1 query problems in `loadMore()` function

**File**: `src/hooks/use-mail-threads.ts:407-471`

**Problem Pattern** (lines 407-427):
```typescript
const threadEntities: DomainThread[] = await Promise.all(
  threadDocs.map(async (doc: any) => {
    const db = await getDatabase();

    // N+1 PROBLEM #1: One query per thread to get first message
    if (doc.messageIds && doc.messageIds.length > 0) {
      const firstMessageDoc = await db.messages.findOne(doc.messageIds[0]).exec();
      // Process first message...
    }

    // N+1 PROBLEM #2: One query per thread to get ALL messages
    const messageDocs = await db.messages.find({
      selector: { id: { $in: doc.messageIds || [] } }
    }).exec();

    return new DomainThread({...});
  })
);
```

**Impact**:
- For 20 threads: 40 database queries (20 for first message + 20 for all messages)
- Each query has IndexedDB overhead
- Destroys pagination performance

**Workaround in Place** (lines 184-190):
The main `loadThreadsReactive()` uses optimized `getThreadsWithRelationsObservable()`:
```typescript
const threadsObservable = await threadRepository.getThreadsWithRelationsObservable(
  labelId,
  {
    sort: [{ lastMessageDate: 'desc' }]
    // Batch loads all relations upfront
  }
);
```

This **pre-fetches** messages with threads in single query, avoiding N+1.

**Remaining Problem**: `loadMore()` still uses old N+1 pattern (lines 407-471)

### Component Rendering Performance

**Issue**: Complex sender processing on every render

**File**: `use-mail-threads.ts:42-164` - `convertToUIThreads()` function

**Expensive Operations** (runs for EVERY thread):
1. Lines 54-81: Snippet selection with array sorting
2. Lines 100-132: Unique sender extraction with Map operations
3. Lines 119: Sender sorting
4. Lines 122-132: Sender name processing

**Impact**: For 100 threads, this runs 100 times on every state update

**Better Approach for V2**:
- Memoize `convertToUIThreads` per thread ID
- Pre-compute senders in database schema
- Use React.memo on thread list items

---

## Data Models and APIs

### Data Models

**Philosophy**: Domain-driven entities with rich behavior

#### Thread Entity

**File**: Referenced in `src/domain/entities/Thread.ts`

**Key Fields**:
```typescript
interface Thread {
  id: string;                    // Gmail thread ID
  subject: string;               // Email subject
  snippet: string;               // Preview text
  labelIds: string[];            // Associated labels
  messages: Message[];           // Related messages
  isUnread: boolean;             // Unread flag
  hasAttachments: boolean;       // Attachment indicator
  lastMessageDate: Date;         // For sorting
  syncStatus: 'basic' | 'complete' | 'error';  // Sync state
  initialSender: EmailAddress;   // First message sender
  totalMessageCount: number;     // Message count
}
```

**Database Schema**: `src/infrastructure/database/schema.ts:12-59`

**Notable Design Decisions**:
- `senders[]` array limited to 10 items (performance optimization)
- `localStatus` field for optimistic UI updates
- `syncError` field for error tracking
- `historyId` for incremental sync support

#### Message Entity

**File**: Referenced in `src/domain/entities/Message.ts`

**Key Fields**:
```typescript
interface Message {
  id: string;
  threadId: string;              // Foreign key to thread
  from: EmailAddress;
  to: EmailAddress[];
  cc: EmailAddress[];
  bcc: EmailAddress[];
  subject: string;
  body: MessageBody;             // HTML + text
  attachments: Attachment[];
  date: Date;
  isUnread: boolean;
  isStarred: boolean;
  snippet: string;
  historyId: string;
}
```

**Database Schema**: `src/infrastructure/database/schema.ts:62-145`

**Indexes**:
- Single: `threadId`
- Compound: `['threadId', 'date']` - For chronological queries

#### Workflow Schema

**File**: `src/infrastructure/database/workflowSchema.ts:162-243`

Complex nested schema with visual flow definition:

```typescript
interface Workflow {
  id: string;
  name: string;
  type: 'system_template' | 'user_created';
  workflowType: 'triggered' | 'autolaunched' | 'screen_flow';
  variables: WorkflowVariable[];
  flow: {
    nodes: FlowNode[];           // Screen, decision, action nodes
    edges: FlowEdge[];           // Connections between nodes
    startNodeId: string;
  };
  schemaVersion: number;         // 1, 2, or 3
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
```

**Node Types**:
- `start`, `end` - Flow boundaries
- `screen` - User interaction
- `decision` - Conditional branching
- `assignment` - Attribute modification
- `action` - Execute operations
- `navigation` - Flow control

**Full schema details**: See Section 6.3.1 - Database Schemas

### API Specifications

#### Gmail API Integration

**Files**: `src/infrastructure/api/gmail/`

**Key Endpoints Used**:

1. **Authentication**:
   - OAuth 2.0 with Google Identity Services (GIS)
   - Scopes: `gmail.readonly`, `gmail.modify`, `gmail.labels`

2. **Labels**:
   - `GET /gmail/v1/users/me/labels` - List all labels
   - `GET /gmail/v1/users/me/labels/{id}` - Get label with counts
   - `POST /gmail/v1/users/me/labels` - Create label

3. **Threads**:
   - `GET /gmail/v1/users/me/threads` - List threads (paginated)
   - `GET /gmail/v1/users/me/threads/{id}` - Get thread details
   - `POST /gmail/v1/users/me/threads/{id}/modify` - Modify labels

4. **Messages**:
   - `GET /gmail/v1/users/me/messages/{id}` - Get message
   - `GET /gmail/v1/users/me/messages/{id}/attachments/{attachmentId}` - Download attachment

5. **History API** (Incremental Sync):
   - `GET /gmail/v1/users/me/history` - Get changes since historyId
   - Returns: messagesAdded, messagesDeleted, labelsAdded, labelsRemoved

#### RxDB Server Replication API

**Server Endpoint**: `POST /replication/{collection}/pull` and `POST /replication/{collection}/push`

**Pull Request**:
```json
{
  "checkpoint": "2025-10-27T10:00:00.000Z",
  "limit": 100
}
```

**Pull Response**:
```json
{
  "documents": [...],
  "checkpoint": "2025-10-27T10:05:00.000Z"
}
```

**Push Request**:
```json
{
  "documents": [...]
}
```

**Push Response**:
```json
{
  "conflicts": []
}
```

**Collections Replicated**:
1. `globalAttributes` - Custom attribute definitions
2. `workflows` - Workflow templates
3. `itemAttributes` - Item attribute values

**NOT Replicated** (client-only):
- `threads`, `messages`, `labels` - Gmail data (privacy)
- `activityLogs` - User activity logs
- `syncQueue` - Offline operations
- `syncMetadata` - Sync checkpoints

---

## Section 6: Critical Systems Deep Dive

### 6.1 Synchronization System

#### Overview

The synchronization system is the **most complex subsystem** in Claine v1, responsible for:
- Two-phase sync (thread listing → details fetch)
- Incremental sync via Gmail History API
- Offline-first operation queuing
- Progress tracking
- Quota management

**Files** (5 main files):
1. `SynchronizationService.ts` - 3,225 lines (Main orchestrator)
2. `IncrementalSyncService.ts` - 22,919 bytes (History API sync)
3. `SyncQueueManager.ts` - 21,028 bytes (Offline queue)
4. `EnhancedSyncTracker.ts` - 4,753 bytes (Progress tracking)
5. `types.ts` - 5,859 bytes (Type definitions)

#### Two-Phase Sync Architecture

**File**: `SynchronizationService.ts:2429-2900`

**Phase 1: Thread Listing**
- Method: `performTwoPhaseSync()`
- Split into inbox + archive queries
- Pagination: 100 threads per request
- Checkpoint: Saves `pendingDetailFetchIds[]` to localStorage

**Phase 2: Details Fetch**
- Method: `fetchAndStoreThreadDetails()`
- Batch size: 30 threads (Gmail API limit)
- Bulk save to RxDB
- Checkpoint after each batch

**Checkpoint Structure** (localStorage):
```json
{
  "phase": "inbox_details" | "archive_details",
  "pendingDetailFetchIds": ["thread1", "thread2", ...],
  "completedThreadIds": ["thread3", ...],
  "currentQuery": "in:inbox" | "-in:inbox",
  "totalThreadsProcessed": 150
}
```

**Resume Capability**:
- On quota exhaustion, saves checkpoint
- Next sync resumes from checkpoint
- User can manually resume
- Checkpoint expires after 24 hours

#### Incremental Sync with History API

**File**: `IncrementalSyncService.ts:81-148`

**Eligibility Check** (lines 48-76):
```typescript
canPerformIncrementalSync():
  ✓ Has lastHistoryId
  ✓ Last sync < 7 days ago
  ✓ < 3 consecutive failures
  ✓ Feature flag enabled
  → Use incremental sync

  Otherwise:
  → Fall back to full sync
```

**Sync Process**:
1. Get current historyId from Gmail
2. Fetch history changes since last historyId
3. Process history events:
   - `messagesAdded` - Fetch new thread details
   - `messagesDeleted` - Remove from database
   - `labelsAdded` - Update thread labels
   - `labelsRemoved` - Update or delete thread
4. Update lastHistoryId checkpoint
5. Save sync metadata

**History API Limitations**:
- Maximum 1,000 history records per request
- 7-day retention window
- If > 1,000 records or > 7 days → Full sync fallback

**Performance Benefit**: ~70% reduction in API calls and sync time

#### Offline Operation Queue

**File**: `SyncQueueManager.ts`

**Queue Processing**:
- Polls every 10 seconds when online
- Processes 10 items per cycle
- Sequential execution (100ms delay between items)

**Operations Supported**:
- `archive`, `unarchive`, `delete`
- `markAsRead`, `markAsUnread`
- `addLabel`, `removeLabel`, `modifyLabels`
- `createLabel`

**Dependency Tracking** (lines 511-624):
```typescript
// Example: Create label, then apply it
Queue Items:
[
  {
    id: 'q1',
    operation: 'createLabel',
    payload: {name: 'Project'},
    status: 'pending'
  },
  {
    id: 'q2',
    operation: 'modifyLabels',
    payload: {addLabelNames: ['Project']},
    status: 'waiting',
    dependsOn: 'q1'  // Can't execute until q1 completes
  }
]

Processing:
1. Execute q1 → Gmail creates label → Store result: {labelId: 'label-xyz'}
2. Mark q1 completed
3. Dependency resolver finds q2
4. Replace 'Project' name with 'label-xyz' ID
5. Move q2 to 'pending'
6. Execute q2 with resolved label ID
```

**Retry Strategy**:
- Max 3 retries per item
- Exponential backoff: 1s, 2s, 4s
- After 3 failures: Status = 'failed', stops retrying

#### Performance Bottlenecks

**1. Sequential Queue Processing** (SyncQueueManager.ts:119-127)
```typescript
for (const item of pendingItems) {  // Sequential loop
  await this.processQueueItem(item);
  await new Promise(resolve => setTimeout(resolve, 100));  // 100ms delay
}
```
**Impact**: 10 items/second maximum throughput
**For 1,000 queued items**: ~100 seconds to drain

**Solution for V2**: Batch Gmail API calls (modify multiple threads in single request)

**2. Memory Usage in Deduplication** (SynchronizationService.ts:108-128)
```typescript
// Loads ALL thread summaries into memory
const existingThreads = await threadRepository.getAllThreadSummaries();
const processedThreads = new Map<string, string>();  // threadId → historyId
existingThreads.forEach(thread => {
  processedThreads.set(thread.id, thread.historyId || '');
});
```
**Impact**: For 100K threads, this Map uses ~15MB RAM
**Issue**: Map never cleared between syncs

**Solution for V2**:
- Query database for historyId on-demand
- Or: Use bloom filter for existence check

**3. Label Sync Redundancy** (SynchronizationService.ts:559-669)
```typescript
// Runs on every sync, even if labels haven't changed
await synchronizeLabels();
// Calls Gmail API for each label to get thread counts
```
**Impact**: 20 labels = 20 API calls, even if unchanged
**Solution for V2**: Cache label metadata, check `If-Modified-Since`

**4. Incremental Sync 7-Day Window**
Gmail History API only keeps 7 days of history. If user doesn't sync for 8 days, forced full sync.
**Impact**: Infrequent users always do expensive full syncs
**Solution for V2**: Implement hybrid approach - incremental when possible, selective full sync for missing gaps

#### Rate Limiting and Throttling

**Gmail API Quotas**:
- 1 billion quota units per day
- `threads.list`: 5 units
- `threads.get`: 5 units
- `threads.modify`: 5 units
- `history.list`: 2 units

**Throttling Strategy**:
- Uses `Priority.NORMAL` for standard operations
- Rate limiting handled in `GmailApiService` (not in sync service)
- No explicit throttling in sync service
- Quota exhaustion triggers checkpoint save + pause

**Batch Request Support**:
- Uses Gmail batch API for thread details
- Batch size: 30 threads
- Reduces API calls by 30x

**SyncQueueManager Throttling**:
- 10-second polling interval
- 100ms delay between operations
- Sequential processing prevents rate limit spikes

#### Technical Debt

**High Priority**:
1. **Multiple Sync Entry Points**: 4 different sync methods (unified, batch, two-phase, label-specific)
2. **In-Memory Checkpoint**: localStorage-based, no migration strategy
3. **No Automatic Cleanup**: Old checkpoints never deleted
4. **History API 7-Day Limit**: Forces full sync for inactive users

**Medium Priority**:
1. **Sequential Processing**: Queue drains slowly (10 items/10 seconds)
2. **Label Sync Redundancy**: Always fetches all labels
3. **Memory Leaks**: `processedThreads` Map not cleared
4. **Limited Progress Reporting**: Inconsistent progress percentages

**Lessons Learned for V2**:
1. ✅ **Keep**: Two-phase sync with checkpoints (works well)
2. ✅ **Keep**: Incremental sync with History API (massive performance win)
3. ✅ **Keep**: Offline-first queue with dependencies (solid pattern)
4. ❌ **Rethink**: Sequential processing → Batch operations
5. ❌ **Rethink**: Multiple sync entry points → Single unified API
6. ❌ **Rethink**: Memory-based deduplication → Database queries
7. 🔄 **Improve**: Error recovery and retry logic
8. 🔄 **Improve**: Progress tracking and user feedback

---

### 6.2 Workflow Engine

#### Overview

The workflow engine provides **visual workflow automation** for email management with:
- Visual flow designer (ReactFlow-based)
- Node types: screen, decision, action, assignment, navigation
- Execution engine with variable context
- Integration with thread attributes
- Workflow state persistence

**Files**:
1. `WorkflowService.ts` - 281 lines (CRUD)
2. `WorkflowExecutor.ts` - 666 lines (Execution)
3. `FlowExecutionContext.ts` - 220 lines (Runtime state)
4. `ActionExecutionService.ts` - 140 lines (Action handler)
5. `ScreenFlowDesignerDynamic.tsx` - 1,113 lines (UI)

#### Execution Engine Architecture

**File**: `WorkflowExecutor.ts:76-147`

**Execution Loop**:
```typescript
async executeWorkflow(workflow, threadId) {
  const context = createContext(workflow, threadId);
  let currentNodeId = workflow.flow.startNodeId;
  let iteration = 0;
  const maxIterations = 100;  // Safety limit

  while (currentNodeId && iteration < maxIterations) {
    const node = findNode(currentNodeId);

    // Execute node based on type
    const nextNodeId = await executeNode(node, context);

    if (!nextNodeId) break;  // End or error
    currentNodeId = nextNodeId;
    iteration++;
  }

  return context;
}
```

**Node Execution Handlers**:

1. **Screen Node** (lines 180-234):
   - Calls `onScreenRender()` callback
   - Waits for user input
   - Stores input values as workflow variables
   - Variable naming: `${nodeName}.${elementName}`

2. **Decision Node** (lines 239-342):
   - Evaluates outcomes in order
   - First matching outcome wins
   - Condition operators: equals, notEquals, contains, greater, less, exists
   - Date-aware comparisons
   - Falls back to default outcome if no match

3. **Assignment Node** (lines 410-598):
   - Modifies thread attributes
   - Operators: set, add, subtract, append, remove, concatenate
   - Type-aware: handles dates, numbers, arrays, strings
   - Updates `ItemAttributesService`

4. **Action Node** (lines 347-362):
   - Delegates to `ActionExecutionService`
   - Actions: archive, delete, modify labels
   - Logs to activity history

5. **Navigation Node** (lines 367-405):
   - Emits navigation events ('next' or 'previous')
   - Used for multi-step workflows

**Execution Context**:
```typescript
interface FlowExecutionContext {
  executionId: string;           // Unique execution ID
  workflowId: string;
  threadId: string;
  currentNodeId: string;
  status: 'running' | 'paused' | 'completed' | 'failed';
  variables: Map<string, any>;   // In-memory variables
  history: FlowStep[];           // Audit trail
  startTime: string;
  endTime?: string;
  error?: { nodeId, message, timestamp };
}
```

**Context Management** (FlowExecutionContext.ts):
- **Storage**: In-memory `Map<executionId, context>`
- **No persistence**: Lost on app refresh
- **Cleanup**: `cleanup()` method exists but never called
- **Retention**: Default 24 hours (but not enforced)

#### UI Integration (ReactFlow)

**File**: `ScreenFlowDesignerDynamic.tsx:1-1113`

**Component Hierarchy**:
```
ScreenFlowDesignerDynamic
└─ ReactFlowProvider
   └─ ScreenFlowDesignerDynamicInner
      ├─ ReactFlow (from @xyflow/react)
      │  ├─ StartNode (memo)
      │  ├─ EndNode (memo)
      │  ├─ ScreenNode (memo)
      │  ├─ DecisionNode (memo)
      │  ├─ ActionNode (memo)
      │  ├─ AssignmentNode (memo)
      │  ├─ NavigationNode (memo)
      │  └─ PlusNode (insertion points)
      ├─ NodeConfigDialog (1,610 lines)
      ├─ DecisionNodeConfig (462 lines)
      └─ WorkflowDebugPanel (328 lines)
```

**Custom Hooks**:
- `useAutoLayout.ts` (231 lines) - Auto-arrange nodes
- `useEdgeClick.ts` (447 lines) - Edge interactions
- `useNodeClick.ts` - Node selection
- `usePlaceholderClick.ts` - Plus node insertion

**Node Configuration Dialog**:
- Unified dialog for all node types
- Deep clone on edit: `JSON.parse(JSON.stringify(node))`
- Type-specific renderers
- 1,610 lines total

#### Screen Element Rendering

**File**: `ScreenRenderer.tsx:1-817`

**Element Types**:
1. **input** - Text input
2. **textarea** - Multi-line text
3. **select** - Dropdown
4. **checkbox** - Boolean toggle
5. **radio** - Single selection
6. **button** - Action button
7. **button-group** - Multiple buttons with auto-continue
8. **display** - Read-only text
9. **attribute** - Bind to global attribute
10. **date** - Date picker with presets

**Date Presets** (lines 44-156):
- Today, Tomorrow, Yesterday
- Start of week/month, End of week/month
- Relative: +N days, -N days
- Custom date picker

#### Performance Bottlenecks

**1. In-Memory Context (No Persistence)**
**File**: FlowExecutionContext.ts:36-37
```typescript
private contexts: Map<string, FlowExecutionContext> = new Map();
```
**Issues**:
- Lost on page refresh
- No recovery from crashes
- Memory grows unbounded
- No multi-tab support

**Solution for V2**: Persist execution state to database

**2. Cleanup Never Called**
**File**: FlowExecutionContext.ts:205-217
```typescript
async cleanup(maxAge: number = 24 * 60 * 60 * 1000) {
  // Remove contexts older than maxAge
  // ...
}
// ❌ This method is NEVER CALLED anywhere in codebase
```
**Impact**: Memory leak - old contexts accumulate

**Solution for V2**: Automatic cleanup on schedule or TTL-based eviction

**3. N+1 Attribute Lookups**
**File**: WorkflowExecutor.ts:428-457
```typescript
// Assignment node execution
for (const assignment of node.data.assignments) {
  const attribute = await GlobalAttributesService.getAttribute(
    assignment.attributeKey  // ❌ One query per assignment
  );
  // Process assignment...
}
```
**Impact**: Slow for nodes with many assignments

**Solution for V2**: Batch load all attributes upfront

**4. Deep Clone on Every Edit**
**File**: NodeConfigDialog.tsx:48
```typescript
const [editingNode, setEditingNode] = useState(
  JSON.parse(JSON.stringify(node))  // ❌ Expensive deep clone
);
```
**Impact**: Slow for large node configurations

**Solution for V2**: Use `structuredClone()` or Immer for efficient cloning

**5. Unbounded Variable History**
**File**: FlowExecutionContext.ts:102-107
```typescript
addHistoryStep(step: FlowStep) {
  this.history.push(step);  // ❌ No size limit
}
```
**Impact**: Long workflows accumulate large history arrays

**Solution for V2**: Circular buffer or summary rollups

#### Critical Issues

**1. Missing User ID in Flow State**
**File**: WorkflowService.ts:263
```typescript
triggeredBy: 'user'  // TODO: get actual user ID
```
**Impact**: Can't track who triggered transitions

**2. Hard-Coded 100 Iteration Limit**
**File**: WorkflowExecutor.ts:90
```typescript
const maxIterations = 100;  // ❌ Not configurable
```
**Impact**: Complex workflows fail silently

**3. No Validation of Edge Targets**
**File**: WorkflowExecutor.ts:96-98
If nextNodeId references non-existent node → "Node not found" runtime error

**4. Single Active Workflow Constraint**
**File**: WorkflowService.ts:98-100
Only one workflow can be active at a time
**Impact**: Can't run concurrent workflows on multiple threads

**5. No Workflow Versioning**
Schema has `version: number` field but it's unused
**Impact**: Can't roll back workflow changes

**6. No Transaction Support**
Assignment updates are individual, not atomic
**Impact**: Partial updates if one fails

**7. No Workflow Cancellation**
Once started, must run to completion
**Impact**: Can't interrupt long-running workflows

#### Lessons Learned for V2

1. ✅ **Keep**: ReactFlow visual designer (works great)
2. ✅ **Keep**: Node-based flow paradigm (intuitive)
3. ✅ **Keep**: Variable context system (flexible)
4. ❌ **Rethink**: In-memory execution state → Persistent storage
5. ❌ **Rethink**: Single active workflow → Multi-workflow support
6. ❌ **Rethink**: Hard-coded limits → Configurable constraints
7. 🔄 **Improve**: Error handling and recovery
8. 🔄 **Improve**: Transaction support for atomic updates
9. 🔄 **Improve**: Workflow versioning and rollback
10. 🔄 **Improve**: User context tracking

---

### 6.3 Database Architecture and Hybrid Storage

#### Overview

Claine v1 uses a **hybrid storage model**:
- **Client**: RxDB with Dexie (IndexedDB) - 10 collections
- **Server**: RxDB with MongoDB - 3 collections (replicated)
- **Replication**: Bidirectional pull/push for metadata

**Total Schemas**: 10 (7 client-only + 3 replicated)

#### Client-Side Schemas (RxDB + Dexie)

**File**: `src/infrastructure/database/database.ts:74-164`

**10 Collections**:

1. **threads** - Email thread metadata
2. **messages** - Email message content
3. **labels** - Gmail label definitions
4. **syncQueue** - Offline operation queue
5. **activityLogs** - User activity audit trail
6. **workflows** - Workflow definitions (replicated)
7. **globalAttributes** - Custom attribute definitions (replicated)
8. **itemAttributes** - Item attribute values (replicated)
9. **threadFlowStates** - Workflow execution state
10. **syncMetadata** - Sync checkpoint storage

**Schema Definitions**: See `src/infrastructure/database/*.ts`

**Key Design Decisions**:

1. **Senders Array Limit** (schema.ts:36-47):
   ```typescript
   senders: {
     type: 'array',
     maxItems: 10,  // Performance optimization
     items: { name, email, isUnread }
   }
   ```
   **Tradeoff**: Lose data for threads with > 10 participants

2. **Compound Indexes** (schema.ts:144):
   ```typescript
   indexes: [
     'threadId',
     ['threadId', 'date']  // For sorted queries
   ]
   ```
   **Benefit**: Fast "messages for thread, sorted by date" queries

3. **Soft Deletes** (activityLogSchema.ts:91):
   ```typescript
   _deleted: { type: 'boolean', default: false }
   ```
   **Only** activityLogs use soft deletes; others use hard deletes

4. **Flexible Attribute Storage** (itemAttributesSchema.ts:38-42):
   ```typescript
   attributes: {
     type: 'object',
     additionalProperties: true  // Any key-value pairs
   }
   ```
   **Benefit**: Schema-less attribute values

#### Server-Side Schemas (MongoDB)

**File**: `server/src/database/database.ts:1-95`

**3 Collections (Replicated)**:

1. **globalAttributes** - Authoritative attribute definitions
2. **workflows** - Workflow templates
3. **itemAttributes** - Centralized attribute values

**Not Replicated** (Client-Only):
- `threads`, `messages`, `labels` - User's Gmail data (privacy)
- `activityLogs` - User activity logs
- `syncQueue` - Offline operations
- `syncMetadata` - Sync checkpoints
- `threadFlowStates` - Workflow state

**Design Rationale**:
- **Privacy**: Gmail data never leaves client
- **Collaboration**: Workflows and attributes shared across users
- **Scalability**: Server doesn't store millions of email threads

#### Replication Architecture

**File**: `src/infrastructure/services/replication/RxDBServerReplication.ts:1-167`

**Replication Configuration**:
```typescript
replicateRxCollection({
  replicationIdentifier: `rxdb-server-${collectionName}`,
  live: true,                    // Continuous sync
  retryTime: 5 * 1000,          // 5-second retry
  waitForLeadership: false,
  autoStart: true,

  pull: {
    handler: pullHandler,
    batchSize: 100              // Pull 100 docs per batch
  },

  push: {
    handler: pushHandler,
    batchSize: 50               // Push 50 docs per batch
  }
})
```

**Pull Handler** (replicationEndpoints.ts:8-45):
```typescript
POST /replication/{collection}/pull
Request: { checkpoint, limit }

Query: collection.find()
  .where('updatedAt').gt(checkpoint)
  .sort({updatedAt: 'asc'})
  .limit(limit)

Response: { documents[], checkpoint }
```

**Push Handler** (replicationEndpoints.ts:48-93):
```typescript
POST /replication/{collection}/push
Request: { documents[] }

For each document:
  If exists: collection.patch(doc)
  If new: collection.insert(doc)
  If conflict: Add to conflicts[]

Response: { conflicts[] }
```

**Conflict Resolution**: Last-write-wins (client overwrites server)

**Authentication** (lines 19-40):
- JWT tokens via `/auth` endpoint
- Bearer token in `Authorization` header
- Token verified by `authMiddleware`

#### Migration System

**File**: `src/infrastructure/services/migration/MigrationOrchestrator.ts`

**Purpose**: Migrate Gmail labels to custom attributes

**Migration Flow**:
```
1. buildLabelMappings(globalAttributes, labels)
   → Map label prefixes to attribute IDs
   → e.g., "[Context]/" → contextAttribute

2. Create MigrationEngine with config

3. engine.start()
   → Load label cache
   → Process threads in batches
   → For each thread:
     - Check labels with mapped prefixes
     - Extract attribute values
     - Update ItemAttributesService
   → Track progress

4. Generate migration report
```

**Batch Processing**:
- Batch size: 100 threads (configurable)
- Max concurrent batches: 3
- Progress callbacks for UI

**Issues**:
1. **Load All Threads** (MigrationEngine.ts:109):
   ```typescript
   const allThreads = await db.threads.find().exec();
   // ❌ Loads ALL threads into memory
   ```
   **Impact**: Memory spike for 100K threads

2. **No Rollback**: Migrations are one-way, no undo

**Solution for V2**: Cursor-based pagination, reversible migrations

#### Schema Versioning and Migrations

**Current State**: All schemas at `version: 0`, no migration strategies

**File**: database.ts:87-101
```typescript
threads: {
  schema: threadSchema,
  migrationStrategies: {
    // ❌ Empty - no migrations defined
  }
}
```

**Version Mismatch Handling** (lines 167-194):
```typescript
try {
  createDatabaseWithCollections()
} catch (error) {
  if (error.code === 'DMS' || 'DM5' || 'DB6') {
    await clearAllIndexedDBDatabases();  // ❌ Nuclear option
    return createDatabaseWithCollections();
  }
}
```

**Impact**: Schema changes require **full database reset**, losing all local data

**Workflow Schema Versioning** (workflowSchema.ts:156):
```typescript
schemaVersion?: number  // 1 = old, 2 = with IDs, 3 = with flow
```
This enables gradual migration, but other schemas lack this

**Solution for V2**: Implement versioned migrations for all schemas

#### Performance Bottlenecks

**1. allowSlowCount Enabled** (database.ts:80)
```typescript
allowSlowCount: true  // ❌ Allows count queries without indexes
```
**Impact**: `db.threads.count()` scans entire collection
**Solution**: Add count indexes or cache counts

**2. Sequential Sync Queue Processing** (SyncQueueManager.ts:119-127)
```typescript
for (const item of pendingItems) {
  await this.processQueueItem(item);  // Sequential
  await new Promise(resolve => setTimeout(resolve, 100));
}
```
**Impact**: 10 items/second max
**Solution**: Batch operations, parallel processing

**3. Dependency Resolution Overhead** (SyncQueueManager.ts:511-577)
```typescript
const waitingItems = await db.syncQueue.find({
  selector: { status: 'waiting' }
}).exec();

for (const item of waitingItems) {
  if (item.dependsOn) {
    const dependency = await db.syncQueue.findOne(item.dependsOn).exec();
    // ❌ One query per waiting item
  }
}
```
**Impact**: O(n) queries for n waiting items
**Solution**: Single query with join or index on (status, dependsOn)

**4. No Cleanup Configuration** (database.ts:120-141)
Only `workflows` and `itemAttributes` have cleanup:
```typescript
cleanup: {
  minimumDeletedTime: 1000 * 30,      // 30 seconds
  runEach: 1000 * 60,                  // Every 60 seconds
  awaitReplicationsInSync: true
}
```

**Other collections**: No cleanup → soft-deleted docs persist forever
**Impact**: Storage bloat (especially activityLogs)

**Solution for V2**: Implement cleanup for all collections with soft deletes

**5. Large Nested Objects**
- `activityLogSchema` stores `entitySnapshot: {object}` - Full entity state
- `itemAttributes.attributes` - Flexible object, no size limit
- `workflowSchema` - Complex nested flow with nodes/edges

**Impact**:
- Storage size grows rapidly
- JSON serialization overhead
- Query filtering on nested properties expensive

**Solution for V2**:
- Set size limits
- Compress large objects
- Consider normalization for deeply nested data

#### Technical Debt Summary

**High Priority**:
1. **No Migration Strategies**: Schema changes require DB reset
2. **Nuclear Version Mismatch Recovery**: Clears entire DB
3. **In-Memory Migration Loading**: Memory spike for large datasets
4. **No Universal Cleanup**: Most collections don't cleanup soft-deletes

**Medium Priority**:
1. **allowSlowCount**: Count operations scan collections
2. **Sequential Queue Processing**: Slow operation execution
3. **Dependency Resolution**: N+1 query pattern
4. **Unbounded Nested Objects**: Storage bloat risk

**Low Priority**:
1. **Senders Array Truncation**: Data loss for > 10 participants
2. **Deprecated Field Coexistence**: Confusion in label schema
3. **No Replication Metrics**: Can't monitor sync health

#### Lessons Learned for V2

1. ✅ **Keep**: Hybrid storage model (client RxDB + server MongoDB)
2. ✅ **Keep**: Selective replication (only metadata, not user data)
3. ✅ **Keep**: RxDB reactivity (observable queries work well)
4. ❌ **Rethink**: Schema versioning → Implement migrations from day 1
5. ❌ **Rethink**: Version mismatch recovery → Preserve data, migrate
6. ❌ **Rethink**: Batch operations → Reduce sequential processing
7. 🔄 **Improve**: Add count indexes or cache
8. 🔄 **Improve**: Universal cleanup strategy
9. 🔄 **Improve**: Replication monitoring and metrics
10. 🔄 **Improve**: Set limits on nested object sizes

---

### 6.4 UI Navigation and Performance

#### Overview

UI navigation performance is a **critical pain point** in Claine v1:
- User requirement: Sub-millisecond navigation
- Current reality: Navigation can take 100-500ms
- Main issues: Data loading, re-renders, N+1 queries

#### Thread List Rendering

**File**: `src/hooks/use-mail-threads.ts:1-560`

**Current Approach**:
```
Label change
  ↓
loadThreadsReactive()
  ↓
threadRepository.getThreadsWithRelationsObservable(labelId)
  ↓
Subscribe to RxDB observable
  ↓
On data change:
  - Map to domain entities (lines 212-286)
  - Convert to UI threads (lines 294-296)
  - setState → React re-render
```

**Performance Characteristics**:

**Good**:
- Reactive: Updates automatically on data changes
- Batch loading: Pre-fetches messages with threads (no N+1)

**Bad**:
- Loads ALL threads for label (no limit) - line 188
- Processing overhead: 200+ lines of mapping (lines 212-286)
- Sender processing on every render (lines 100-132)
- No memoization of conversion results

**Metrics** (from PerfLogger):
```
[PERF] total-processing: 150-250ms
[PERF] mapping-to-entities: 80-120ms
[PERF] convert-to-ui-threads: 50-100ms
[PERF] threads-processed: 100 (for 100 threads)
```

**Problem**: For label with 500 threads, this takes 400-600ms

#### N+1 Query Problem (Still Present)

**File**: use-mail-threads.ts:407-471 - `loadMore()` function

```typescript
const threadEntities: DomainThread[] = await Promise.all(
  threadDocs.map(async (doc: any) => {
    // ❌ N+1 PROBLEM #1
    const firstMessageDoc = await db.messages.findOne(doc.messageIds[0]).exec();

    // ❌ N+1 PROBLEM #2
    const messageDocs = await db.messages.find({
      selector: { id: { $in: doc.messageIds || [] } }
    }).exec();

    return new DomainThread({...});
  })
);
```

**Impact**:
- 20 threads × 2 queries = 40 database queries
- Each with IndexedDB overhead
- **Destroys** pagination performance

**Why It Exists**:
`loadMore()` uses old implementation pattern, while `loadThreadsReactive()` uses optimized batch loading

**Solution**: Apply same optimization to `loadMore()`

#### Expensive Conversion Logic

**File**: use-mail-threads.ts:42-164 - `convertToUIThreads()`

**Runs on EVERY thread, EVERY render**:

1. **Snippet Selection** (lines 54-81):
   - Array filtering for unread messages
   - Sorting by date
   - Conditional logic for snippet source
   - **Cost**: O(n) for n messages per thread

2. **Unique Sender Extraction** (lines 100-132):
   - Map creation for unique senders
   - Iteration through all messages
   - Sorting by first appearance
   - Name processing (split, truncate)
   - **Cost**: O(n log n) for n messages

3. **Message Mapping** (lines 87-97):
   - Full message → UI message conversion
   - **Cost**: O(n) for n messages

**For 100 threads with avg 5 messages each**:
- 100 × 5 × 3 operations = 1,500 operations
- **Takes**: 50-100ms

**No Memoization**: Runs on every state update, even if thread data unchanged

**Solution for V2**:
- Memoize `convertToUIThreads` with thread ID + historyId as key
- Pre-compute senders in database
- Use React.memo on ThreadListItem components

#### Component Re-render Cascade

**Issue**: Changing label triggers full app re-render

**Flow**:
```
User clicks label
  ↓
URL changes (/label/INBOX → /label/SENT)
  ↓
useParams() detects change
  ↓
useMailThreads() effect re-runs
  ↓
loadThreadsReactive() called
  ↓
setThreads([]) - Clear existing threads
  ↓
React re-renders with empty list (loading state)
  ↓
New data arrives (150-250ms later)
  ↓
setThreads(newThreads) - Update with new data
  ↓
React re-renders with new threads
```

**Total Time**: 200-400ms from click to render

**Perceived Performance**: Slow, especially for users with many threads

**Solution for V2**:
- Keep previous threads visible while loading new label
- Show loading indicator, don't clear list
- Implement optimistic UI updates
- Preload adjacent labels

#### No Virtualization

**Current**: ThreadList renders ALL threads in DOM

**File**: No virtualization implemented (react-window installed but not used)

**Impact**:
- 500 threads = 500 DOM nodes
- Scroll performance degrades
- Initial render slow

**Solution for V2**:
- Use `react-window` or `react-virtual` for virtualized list
- Render only visible + buffer items
- Dramatically improve performance for large lists

#### Database Query Performance

**Issue**: No indexes optimized for common queries

**Example**: Thread listing by label
```typescript
// Current query (no specific optimization)
db.threads.find({
  selector: { labelIds: { $in: [labelId] } }
}).sort({ lastMessageDate: 'desc' })
```

**Performance**: O(n) scan of threads collection, then sort

**Ideal**: Compound index on `[labelIds, lastMessageDate]` for O(log n) query + sorted retrieval

**Current Indexes** (schema.ts):
- Thread: No indexes
- Message: `threadId`, `[threadId, date]`
- Label: No indexes

**Solution for V2**: Strategic compound indexes

#### React Hooks Performance

**15 Custom Hooks** in `src/hooks/`:

**Good Practices**:
- `useCallback` for function memoization
- `useRef` for subscription management
- RxJS subscription cleanup

**Bad Practices**:
- No `useMemo` for expensive computations
- Some hooks trigger too many re-renders
- Dependency arrays sometimes incomplete

**Example**: `use-mail-threads.ts:333` - `loadThreadsReactive` dependency array
```typescript
}, [labelId, pageSize, convertToUIThreads]);
//                      ^^^^^^^^^^^^^^^^
// ❌ convertToUIThreads changes every render (not memoized)
// → Effect re-runs unnecessarily
```

**Solution**: Wrap `convertToUIThreads` in `useCallback`

#### Layout Thrashing

**Issue**: Multiple layout recalculations on thread list render

**Likely Causes**:
- Flex layout with dynamic heights
- Image loading without dimensions
- Complex nested flex containers

**No Performance Profiling**: No React Profiler or Performance API usage

**Solution for V2**:
- Add Performance API timing
- Use React DevTools Profiler
- Optimize layout with `content-visibility: auto`
- Reserve space for images

#### Navigation State Management

**Current**: React Router with URL-based state

**Issues**:
1. No route prefetching
2. No state preservation between navigations
3. Full component remount on route change

**Solution for V2**:
- Implement route-based code splitting with prefetch
- Preserve scroll position and view state
- Use layout routes to keep common UI mounted

#### Technical Debt Summary

**High Priority**:
1. **No Virtualization**: All threads rendered to DOM
2. **N+1 Queries in loadMore()**: 40 queries for 20 threads
3. **No Memoization**: Expensive conversions re-run every render
4. **Missing Indexes**: Queries scan full collections

**Medium Priority**:
1. **Loading State**: Clears UI before showing new data
2. **Re-render Cascade**: Full app re-render on navigation
3. **Unbounded Thread Loading**: Loads ALL threads (no limit)
4. **No Performance Monitoring**: No metrics or profiling

**Low Priority**:
1. **Hook Dependencies**: Incomplete or over-specified
2. **Layout Thrashing**: Multiple recalculations
3. **No Prefetching**: Adjacent routes not preloaded

#### Performance Goals for V2

Based on user requirement: "Sub-millisecond navigation"

**Realistic Targets**:
- **Label switching**: < 50ms (from click to visible change)
- **Thread list render**: < 100ms (for 100 threads)
- **Scroll performance**: 60 FPS (16.67ms per frame)
- **Initial load**: < 500ms (cold start to interactive)

**Strategies**:
1. **Virtual scrolling**: Only render visible items
2. **Optimistic UI**: Show previous data while loading
3. **Preloading**: Load next page/label before click
4. **Memoization**: Cache expensive computations
5. **Code splitting**: Lazy load routes
6. **Web Workers**: Offload processing to background thread
7. **IndexedDB optimization**: Strategic indexes
8. **React optimization**: memo, useMemo, useCallback everywhere

#### Lessons Learned for V2

1. ✅ **Keep**: RxDB observable queries (reactive data)
2. ✅ **Keep**: Clean Architecture (separation of concerns)
3. ❌ **Rethink**: Load ALL threads → Virtual scrolling with pagination
4. ❌ **Rethink**: Clear UI on navigation → Optimistic updates
5. ❌ **Rethink**: No memoization → Aggressive caching
6. ❌ **Rethink**: Missing indexes → Strategic compound indexes
7. 🔄 **Improve**: Add performance monitoring
8. 🔄 **Improve**: Implement virtualization
9. 🔄 **Improve**: Fix N+1 queries everywhere
10. 🔄 **Improve**: Optimize React hooks and dependencies

---

## Section 7: Integration Points and External Dependencies

### External Services

| Service | Purpose | Integration Type | Key Files |
|---------|---------|------------------|-----------|
| **Gmail API** | Email access and management | REST API with OAuth 2.0 | `src/infrastructure/api/gmail/` |
| **Google Identity Services (GIS)** | Authentication | OAuth 2.0 PKCE flow | `src/presentation/components/auth/GisGmailLogin.tsx` |
| **MongoDB** | Server-side storage | Native driver via RxDB | `server/src/database/database.ts` |
| **RxDB Server** | Replication protocol | WebSocket/HTTP | `server/src/server.ts` |

### Gmail API Integration

**Authentication Flow**:
```
1. User clicks "Sign in with Google"
   ↓
2. GIS library loads (gapi-script)
   ↓
3. OAuth 2.0 authorization flow
   ↓
4. User grants permissions
   ↓
5. Access token received
   ↓
6. Token stored in GmailApiService
   ↓
7. All API calls include token in Authorization header
```

**Scopes Required**:
- `https://www.googleapis.com/auth/gmail.readonly` - Read emails
- `https://www.googleapis.com/auth/gmail.modify` - Modify (archive, delete, labels)
- `https://www.googleapis.com/auth/gmail.labels` - Manage labels

**Rate Limiting**:
- Quota: 1 billion units/day (typically enough for personal use)
- Rate limiter: Implemented in `GmailApiService` (not visible in current analysis)
- Retry strategy: Exponential backoff on 429 errors

**Batch Requests**:
- Supported: Yes, using Gmail batch API
- Batch size: 30 requests (Gmail API limit)
- Used in: Thread details fetching, message fetching

### MongoDB Integration

**Server-Side Only**: MongoDB used exclusively on server for replicated collections

**Connection**:
```typescript
// server/src/database/database.ts
const storage = getRxStorageMemory();  // In-memory during development
// Production: Use MongoDB storage adapter
```

**Collections**:
1. `globalAttributes` - 1 document per attribute definition
2. `workflows` - 1 document per workflow
3. `itemAttributes` - 1 document per thread with attributes

**No Direct Client Access**: Client connects via RxDB replication endpoints

### RxDB Replication Integration

**Architecture**:
```
Client RxDB (IndexedDB)
        ↓
    HTTP/JSON
        ↓
Express Endpoints (/replication/{collection}/{pull|push})
        ↓
Server RxDB (MongoDB)
```

**Endpoints**:
- `POST /replication/globalAttributes/pull`
- `POST /replication/globalAttributes/push`
- `POST /replication/workflows/pull`
- `POST /replication/workflows/push`
- `POST /replication/itemAttributes/pull`
- `POST /replication/itemAttributes/push`

**Authentication**:
- JWT tokens via `POST /auth`
- Token passed in `Authorization: Bearer <token>` header
- Verified by `authMiddleware` on server

**Replication Frequency**:
- **Live**: Continuous (not polling-based)
- **Retry**: 5-second backoff on failure
- **Batch Size**: Pull 100, Push 50

### Internal Integration Points

**Frontend → Backend Communication**:
- **Replication**: HTTP POST to replication endpoints
- **Authentication**: HTTP POST to /auth endpoint
- **No WebSocket**: All communication via HTTP (despite RxDB supporting WS)

**Database → UI Communication**:
- **Observable Queries**: RxDB emits changes via RxJS
- **Subscriptions**: React hooks subscribe to observables
- **Automatic Updates**: UI re-renders on data changes

**Service Dependencies**:
```
SynchronizationService
  ├─→ GmailApiService (API calls)
  ├─→ ThreadRepository (data access)
  ├─→ MessageRepository (data access)
  ├─→ LabelRepository (data access)
  ├─→ SyncMetadataRepository (checkpoint storage)
  └─→ SyncQueueManager (offline operations)

WorkflowExecutor
  ├─→ WorkflowService (workflow CRUD)
  ├─→ FlowExecutionContext (runtime state)
  ├─→ ActionExecutionService (action execution)
  ├─→ GlobalAttributesService (attribute definitions)
  ├─→ ItemAttributesService (attribute values)
  └─→ WorkflowEventService (event emission)

ThreadRepository
  ├─→ Database (RxDB instance)
  ├─→ MessageRepository (for thread with messages)
  └─→ Observable queries (reactivity)
```

### Third-Party Libraries

**Key Dependencies**:

| Library | Purpose | Version | Notes |
|---------|---------|---------|-------|
| `@xyflow/react` | Visual workflow designer | 12.7.1 | ReactFlow - excellent choice |
| `@radix-ui/*` | Headless UI components | Various | 15+ Radix components used |
| `gapi-script` | Google API loader | 1.2.0 | For GIS authentication |
| `rxdb` | Reactive database | 16.8.1 | Core data layer |
| `rxjs` | Reactive streams | 7.8.2 | Used by RxDB |
| `date-fns` | Date utilities | 4.1.0 | Date formatting/manipulation |
| `lucide-react` | Icons | 0.484.0 | 1000+ icons available |
| `react-router-dom` | Client-side routing | 7.4.0 | Latest version |
| `react-window` | Virtual scrolling | 1.8.11 | ⚠️ Installed but NOT USED |
| `bottleneck` | Rate limiting | 2.19.5 | For API throttling |
| `uuid` | UUID generation | 11.1.0 | For unique IDs |

**Notable**: `react-window` is installed (package.json:56) but not used anywhere in codebase

---

## Section 8: Development and Deployment

### Local Development Setup

**Requirements**:
- Node.js 18+
- npm 9+
- Google Cloud Project with Gmail API enabled
- OAuth 2.0 credentials (API key + Client ID)

**Setup Steps** (from README.md):

1. **Clone repository**:
   ```bash
   cd /Users/hansnieuwenhuis/vscode/claine-rebuild
   ```

2. **Install dependencies**:
   ```bash
   npm install
   cd server && npm install
   ```

3. **Environment Configuration**:
   Create `.env` in project root:
   ```env
   VITE_GOOGLE_API_KEY=AIza...
   VITE_GOOGLE_CLIENT_ID=123456789.apps.googleusercontent.com
   ```

4. **Google Cloud Console Setup**:
   - Create project
   - Enable Gmail API
   - Create OAuth 2.0 credentials (Web application)
   - Add `http://localhost:5173` to authorized JavaScript origins
   - Create API key

5. **Start Development**:
   ```bash
   # Terminal 1: Client
   npm run dev
   # Starts Vite dev server on http://localhost:5173

   # Terminal 2: Server (if using replication)
   cd server && npm run dev
   # Starts Express server on http://localhost:3000
   ```

**Known Setup Issues** (from TROUBLESHOOTING.md):

1. **Database Version Mismatch** (DM5 error):
   - Solution: Clear IndexedDB in browser DevTools
   - Or: Run `node fix-database-and-api.js`

2. **API Key Format**:
   - ❌ Wrong: `GOCSPX-...` (OAuth client secret)
   - ✅ Correct: `AIza...` (API key)

3. **OAuth Origin Validation**:
   - Must add `http://localhost:5173` to Google Cloud Console
   - Changes can take minutes to hours to propagate

### Build and Deployment Process

**Build Commands**:
```bash
# Client build
npm run build
# Output: dist/

# Server build
cd server && npm run build
# Output: server/dist/
```

**Build Configuration** (vite.config.ts:54-57):
```typescript
build: {
  outDir: 'dist',
  sourcemap: true    // Enable source maps for debugging
}
```

**TypeScript Configuration** (tsconfig.json):
- Strict mode enabled
- No emit (Vite handles compilation)
- Path aliases: `@/*` → `src/*`

**Deployment**:
- **No CI/CD**: No automated deployment configured
- **No Docker**: No containerization setup
- **Manual deployment**: Build + upload to hosting
- **Static hosting**: Client can be hosted on Vercel, Netlify, etc.
- **Server hosting**: Requires Node.js hosting (e.g., Heroku, Railway)

**Environment Variables** (Production):
```env
# Client
VITE_GOOGLE_API_KEY=<production-api-key>
VITE_GOOGLE_CLIENT_ID=<production-client-id>

# Server
MONGODB_URI=mongodb://...
JWT_SECRET=<secret-key>
PORT=3000
```

### Testing Infrastructure

**Test Frameworks**:
- **Unit Tests**: Vitest (installed)
- **E2E Tests**: Playwright (installed)
- **Coverage**: Vitest coverage (configured)

**Test Scripts** (package.json:13-15):
```json
{
  "test": "vitest",
  "test:ui": "vitest --ui",
  "test:coverage": "vitest --coverage"
}
```

**Test Files**:
- Unit tests: `src/**/__tests__/**/*.test.ts`
- E2E tests: `tests/**/*.spec.ts`
- Test results: `test-results/`, `playwright-report/`

**Test Coverage** (Current):
- **Repository layer**: Some tests exist (e.g., `src/infrastructure/repositories/__tests__/`)
- **Synchronization**: Some tests (e.g., `src/infrastructure/services/synchronization/__tests__/`)
- **Workflow**: Some tests (e.g., `src/infrastructure/services/workflow/__tests__/`)
- **Overall**: Partial coverage, not comprehensive

**Testing Debt**:
- No tests for presentation layer
- No tests for hooks
- No integration tests for full sync flow
- No performance tests

### Development Tools

**Available Scripts** (package.json:6-15):
```json
{
  "dev": "vite",
  "build": "tsc && vite build",
  "preview": "vite preview",
  "lint": "eslint src --ext ts,tsx",
  "format": "prettier --write \"src/**/*.{ts,tsx,css,md}\"",
  "clear-db": "tsx src/clearAndReinitializeDatabase.ts",
  "test": "vitest",
  "test:ui": "vitest --ui",
  "test:coverage": "vitest --coverage"
}
```

**Debugging**:
- Browser DevTools (React DevTools, Redux DevTools not used)
- Console logging (extensive use of `console.log`, `logger`)
- Activity viewer: `activity-viewer.log`, `client.log`, etc.
- Database inspection: Various `check-*.html` files for debugging

**Utility HTML Files** (Root Directory):
Many debugging HTML files for inspecting RxDB state:
- `check-database-status.html`
- `check-workflows.html`
- `check-indexeddb.html`
- `debug-workflow-flow.html`
- `test-migration-verification.html`
- And 20+ more...

**These are development aids**, not part of the application

---

## Section 9: Technical Debt and Known Issues - Complete Catalog

### 9.1 Critical Technical Debt (Must Fix for V2)

#### 1. **Database Schema Migrations**

**Issue**: No migration strategies defined, schema changes require full DB reset

**Files**:
- `src/infrastructure/database/database.ts:87-101`

**Evidence**:
```typescript
migrationStrategies: {
  // ❌ Empty - no migrations defined
}
```

**Impact**:
- Any schema change forces users to re-sync all Gmail data
- Lost user data (workflows, attributes, activity logs)
- Poor user experience

**Severity**: CRITICAL
**Effort**: HIGH
**Priority**: P0

---

#### 2. **In-Memory Workflow Execution State**

**Issue**: Workflow execution context stored in memory, lost on refresh

**Files**:
- `src/infrastructure/services/workflow/FlowExecutionContext.ts:36-37`

**Evidence**:
```typescript
private contexts: Map<string, FlowExecutionContext> = new Map();
// ❌ No persistence - lost on app refresh
```

**Impact**:
- Users lose workflow progress on page refresh
- No recovery from browser crashes
- Can't resume interrupted workflows

**Severity**: CRITICAL
**Effort**: MEDIUM
**Priority**: P0

---

#### 3. **N+1 Query Problem in Pagination**

**Issue**: `loadMore()` executes 2 queries per thread

**Files**:
- `src/hooks/use-mail-threads.ts:407-471`

**Evidence**:
```typescript
const threadEntities = await Promise.all(
  threadDocs.map(async (doc) => {
    const firstMessageDoc = await db.messages.findOne(...).exec();  // Query 1
    const messageDocs = await db.messages.find(...).exec();          // Query 2
  })
);
// For 20 threads: 40 queries!
```

**Impact**:
- Pagination is extremely slow (200-400ms for 20 threads)
- User-perceived performance is terrible
- Violates goal of sub-millisecond navigation

**Severity**: CRITICAL
**Effort**: LOW (pattern already exists in `loadThreadsReactive`)
**Priority**: P0

---

#### 4. **No Virtual Scrolling**

**Issue**: Renders ALL threads to DOM, no virtualization

**Files**:
- `react-window` installed but not used (package.json:56)

**Impact**:
- 500 threads = 500 DOM nodes
- Scroll performance degrades
- Initial render takes 500ms+

**Severity**: CRITICAL (for performance goal)
**Effort**: MEDIUM
**Priority**: P0

---

#### 5. **Sequential Sync Queue Processing**

**Issue**: Processes 10 items/10 seconds, extremely slow

**Files**:
- `src/infrastructure/services/synchronization/SyncQueueManager.ts:119-127`

**Evidence**:
```typescript
for (const item of pendingItems) {
  await this.processQueueItem(item);  // Sequential
  await new Promise(resolve => setTimeout(resolve, 100));  // 100ms delay
}
// 1,000 items = 100 seconds
```

**Impact**:
- Offline queue drains very slowly
- User actions take minutes to sync after reconnecting
- Poor offline-first user experience

**Severity**: HIGH
**Effort**: MEDIUM (requires batch Gmail API calls)
**Priority**: P1

---

#### 6. **No Cleanup of Old Execution Contexts**

**Issue**: `cleanup()` method exists but never called

**Files**:
- `src/infrastructure/services/workflow/FlowExecutionContext.ts:205-217`

**Impact**:
- Memory leak - contexts accumulate indefinitely
- Long-running app will eventually run out of memory

**Severity**: HIGH
**Effort**: LOW (just call the method)
**Priority**: P1

---

#### 7. **Missing Database Indexes**

**Issue**: No compound indexes for common queries

**Files**:
- `src/infrastructure/database/schema.ts` (thread schema has no indexes)

**Evidence**:
```typescript
// Thread schema: No indexes defined
// Query: threads by label, sorted by date → O(n) scan + sort
```

**Impact**:
- Slow queries for thread lists
- Performance degrades with large mailboxes

**Severity**: HIGH
**Effort**: LOW (add indexes)
**Priority**: P1

---

### 9.2 High-Priority Technical Debt

#### 8. **Expensive Conversion Logic on Every Render**

**Issue**: `convertToUIThreads()` runs complex logic for every thread on every render

**Files**:
- `src/hooks/use-mail-threads.ts:42-164`

**Impact**:
- 100 threads × 50ms = 5 seconds total processing
- No memoization, re-runs even if data unchanged

**Severity**: HIGH
**Effort**: MEDIUM (implement memoization)
**Priority**: P1

---

#### 9. **Load All Threads for Label (No Limit)**

**Issue**: Loads ALL threads for label, no pagination limit

**Files**:
- `src/hooks/use-mail-threads.ts:184-190`

**Evidence**:
```typescript
const threadsObservable = await threadRepository.getThreadsWithRelationsObservable(
  labelId,
  {
    sort: [{ lastMessageDate: 'desc' }]
    // No limit - get all threads
  }
);
```

**Impact**:
- Initial load slow for labels with 500+ threads
- Memory usage high
- UI unresponsive during load

**Severity**: HIGH
**Effort**: LOW (add limit parameter)
**Priority**: P1

---

#### 10. **Memory Leak in Sync Deduplication**

**Issue**: `processedThreads` Map never cleared

**Files**:
- `src/infrastructure/services/synchronization/SynchronizationService.ts:108-128`

**Evidence**:
```typescript
const processedThreads = new Map<string, string>();
existingThreads.forEach(thread => {
  processedThreads.set(thread.id, thread.historyId || '');
});
// ❌ Never cleared, only overwritten at next sync
```

**Impact**:
- For 100K threads: ~15MB RAM per sync
- Memory not reclaimed between syncs

**Severity**: MEDIUM
**Effort**: LOW (clear map after sync)
**Priority**: P1

---

#### 11. **No User ID Tracking in Workflows**

**Issue**: Can't track which user triggered workflow transitions

**Files**:
- `src/infrastructure/services/workflow/WorkflowService.ts:263`

**Evidence**:
```typescript
triggeredBy: 'user'  // TODO: get actual user ID
```

**Impact**:
- Incomplete audit trail
- Can't attribute actions to users
- Compliance issues

**Severity**: MEDIUM
**Effort**: LOW (pass user ID)
**Priority**: P2

---

#### 12. **Hard-Coded Workflow Iteration Limit**

**Issue**: Max 100 iterations, not configurable

**Files**:
- `src/infrastructure/services/workflow/WorkflowExecutor.ts:90`

**Evidence**:
```typescript
const maxIterations = 100;  // ❌ Hard-coded
```

**Impact**:
- Complex workflows fail silently
- No way to increase limit

**Severity**: MEDIUM
**Effort**: LOW (make configurable)
**Priority**: P2

---

#### 13. **Single Active Workflow Constraint**

**Issue**: Only one workflow can be active at a time

**Files**:
- `src/infrastructure/services/workflow/WorkflowService.ts:98-100`

**Impact**:
- Can't run multiple workflows concurrently
- Limits automation capabilities

**Severity**: MEDIUM
**Effort**: HIGH (architectural change)
**Priority**: P2

---

#### 14. **No Transaction Support in Assignments**

**Issue**: Assignment node updates are not atomic

**Files**:
- `src/infrastructure/services/workflow/WorkflowExecutor.ts:558-562`

**Impact**:
- Partial updates if one assignment fails
- Data inconsistency

**Severity**: MEDIUM
**Effort**: MEDIUM (implement rollback)
**Priority**: P2

---

#### 15. **Incremental Sync 7-Day Window**

**Issue**: Gmail History API only keeps 7 days

**Files**:
- `src/infrastructure/services/synchronization/IncrementalSyncService.ts:60`

**Impact**:
- Infrequent users always do expensive full syncs
- No hybrid approach

**Severity**: MEDIUM
**Effort**: HIGH (implement hybrid strategy)
**Priority**: P2

---

### 9.3 Medium-Priority Technical Debt

#### 16. **Label Sync Redundancy**

**Issue**: Always fetches all labels on every sync

**Files**:
- `src/infrastructure/services/synchronization/SynchronizationService.ts:559-669`

**Impact**:
- 20 API calls even if labels unchanged
- Wastes quota

**Severity**: MEDIUM
**Effort**: MEDIUM (implement caching)
**Priority**: P2

---

#### 17. **Deep Clone on Node Edit**

**Issue**: Uses expensive `JSON.parse(JSON.stringify())`

**Files**:
- `src/presentation/components/workflow/NodeConfigDialog.tsx:48`

**Impact**:
- Slow for large node configurations
- UI lag on node edit

**Severity**: MEDIUM
**Effort**: LOW (use `structuredClone`)
**Priority**: P2

---

#### 18. **Unbounded Variable History**

**Issue**: Workflow history grows indefinitely

**Files**:
- `src/infrastructure/services/workflow/FlowExecutionContext.ts:102-107`

**Impact**:
- Memory growth during long workflows
- No size limit

**Severity**: MEDIUM
**Effort**: MEDIUM (circular buffer)
**Priority**: P3

---

#### 19. **N+1 Attribute Lookups**

**Issue**: One query per attribute in assignment node

**Files**:
- `src/infrastructure/services/workflow/WorkflowExecutor.ts:428-457`

**Impact**:
- Slow assignment nodes
- Unnecessary queries

**Severity**: MEDIUM
**Effort**: LOW (batch load)
**Priority**: P3

---

#### 20. **No Cleanup for Most Collections**

**Issue**: Only workflows and itemAttributes have cleanup configured

**Files**:
- `src/infrastructure/database/database.ts:120-141`

**Impact**:
- ActivityLogs grow unbounded
- SyncQueue completed items never deleted
- Storage bloat

**Severity**: MEDIUM
**Effort**: LOW (add cleanup config)
**Priority**: P3

---

#### 21. **allowSlowCount Enabled**

**Issue**: Allows count queries without indexes

**Files**:
- `src/infrastructure/database/database.ts:80`

**Evidence**:
```typescript
allowSlowCount: true  // ❌ Allows unoptimized counts
```

**Impact**:
- `count()` operations scan full collections
- Slow for large datasets

**Severity**: MEDIUM
**Effort**: MEDIUM (add count indexes or cache)
**Priority**: P3

---

#### 22. **No Workflow Versioning**

**Issue**: Schema has `version` field but it's unused

**Files**:
- `src/infrastructure/database/workflowSchema.ts:155`

**Impact**:
- Can't roll back workflow changes
- No version history

**Severity**: MEDIUM
**Effort**: HIGH (implement versioning)
**Priority**: P3

---

#### 23. **Dependency Resolution Overhead**

**Issue**: O(n) queries for waiting items

**Files**:
- `src/infrastructure/services/synchronization/SyncQueueManager.ts:511-577`

**Impact**:
- Slow dependency resolution
- Inefficient for long dependency chains

**Severity**: MEDIUM
**Effort**: MEDIUM (add index)
**Priority**: P3

---

#### 24. **No Performance Monitoring**

**Issue**: No metrics, profiling, or telemetry

**Impact**:
- Can't identify performance regressions
- No production performance data

**Severity**: MEDIUM
**Effort**: MEDIUM (add Performance API)
**Priority**: P3

---

#### 25. **Incomplete Hook Dependencies**

**Issue**: `convertToUIThreads` not memoized, causes effect re-runs

**Files**:
- `src/hooks/use-mail-threads.ts:333`

**Evidence**:
```typescript
}, [labelId, pageSize, convertToUIThreads]);
//                      ^^^^^^^^^^^^^^^^
// ❌ Changes every render
```

**Impact**:
- Unnecessary effect re-runs
- Performance hit

**Severity**: LOW
**Effort**: LOW (use `useCallback`)
**Priority**: P3

---

### 9.4 Low-Priority Technical Debt

#### 26. **Senders Array Truncation**

**Issue**: Limited to 10 senders per thread

**Files**:
- `src/infrastructure/database/schema.ts:36-47`

**Impact**:
- Data loss for threads with > 10 participants
- Incomplete sender lists

**Severity**: LOW
**Effort**: MEDIUM (change schema + migration)
**Priority**: P4

---

#### 27. **Deprecated Field Coexistence**

**Issue**: Label schema has both old and new visibility fields

**Files**:
- `src/infrastructure/database/schema.ts:157-169`

**Impact**:
- Confusion about which field to use
- No migration path

**Severity**: LOW
**Effort**: LOW (remove deprecated field)
**Priority**: P4

---

#### 28. **react-window Installed But Not Used**

**Issue**: Dependency installed but never used

**Files**:
- `package.json:56`

**Impact**:
- Wasted bundle size (~30KB)
- Confusion

**Severity**: LOW
**Effort**: LOW (remove or use)
**Priority**: P4

---

#### 29. **Multiple Sync Entry Points**

**Issue**: 4 different sync methods

**Files**:
- `src/infrastructure/services/synchronization/SynchronizationService.ts`

**Methods**:
- `synchronize()` - Unified
- `synchronizeThreadsBatch()` - Label-specific
- `performTwoPhaseSync()` - Checkpoint-based
- `synchronizeThreadsForLabel()` - Legacy

**Impact**:
- Maintenance burden
- Potential inconsistencies
- Confusing API

**Severity**: LOW
**Effort**: HIGH (refactor to single method)
**Priority**: P4

---

#### 30. **No Replication Metrics**

**Issue**: Can't monitor replication health

**Impact**:
- No visibility into sync issues
- Can't detect replication failures

**Severity**: LOW
**Effort**: MEDIUM (add metrics)
**Priority**: P4

---

### 9.5 Code Quality Issues

**General Patterns**:

1. **Heavy use of `any` type**: Especially in node configurations
2. **Large files**: SynchronizationService.ts (3,225 lines)
3. **Limited JSDoc comments**: Most functions lack documentation
4. **Inconsistent error handling**: Mix of throws, returns, and silent failures
5. **No error boundaries**: React error boundaries not implemented
6. **Console.log debugging**: Extensive use, not production-ready
7. **Many utility HTML files**: 20+ debug HTML files in root directory

---

### 9.6 Architectural Debt

**Patterns to Reconsider**:

1. **Clean Architecture Violations**: Some UI components directly access infrastructure
2. **God Class**: SynchronizationService is 3,225 lines (too large)
3. **Tight Coupling**: Workflow executor tightly coupled to UI (onScreenRender callback)
4. **No Dependency Injection**: Manual service instantiation throughout
5. **Singleton Overuse**: Many services are singletons, hard to test
6. **No Event Bus**: Direct service-to-service calls, tight coupling

---

### 9.7 Testing Debt

**Missing Tests**:

1. **No presentation layer tests**: 0% coverage for components
2. **No hook tests**: Custom hooks not tested
3. **Partial service tests**: Some services tested, many not
4. **No E2E tests for critical flows**: Sync, workflow execution
5. **No performance tests**: No benchmarks or regression tests

---

### 9.8 Documentation Debt

**Missing Documentation**:

1. **API documentation**: No OpenAPI/Swagger for server endpoints
2. **Workflow language reference**: Node types not documented
3. **Custom attributes guide**: No user documentation
4. **Migration guide**: No schema migration documentation
5. **Performance tuning guide**: No optimization guide

---

## Section 10: Lessons Learned Summary

### What to Keep in V2

1. ✅ **Clean Architecture**: Clear separation of concerns works well
2. ✅ **RxDB with Reactivity**: Observable queries provide great DX
3. ✅ **Two-Phase Sync with Checkpoints**: Robust resumable sync
4. ✅ **Incremental Sync with History API**: Massive performance win (70% faster)
5. ✅ **Offline-First Queue with Dependencies**: Solid pattern for offline support
6. ✅ **ReactFlow Visual Designer**: Excellent workflow UI
7. ✅ **Hybrid Storage Model**: Client privacy + server collaboration works
8. ✅ **Node-Based Workflow Paradigm**: Intuitive and flexible
9. ✅ **Custom Attributes System**: Powerful extensibility
10. ✅ **Domain-Driven Design**: Clean domain models

### What to Rethink in V2

1. ❌ **Schema Migrations**: Implement from day 1, don't skip
2. ❌ **In-Memory State**: Persist execution contexts to database
3. ❌ **Sequential Processing**: Batch operations, parallel where possible
4. ❌ **No Virtualization**: Must have virtual scrolling from start
5. ❌ **Load All Pattern**: Always paginate, never load all records
6. ❌ **Multiple Entry Points**: Single unified API per subsystem
7. ❌ **God Classes**: Break up 3,000+ line files
8. ❌ **Hard-Coded Limits**: Make everything configurable
9. ❌ **No Metrics**: Build in observability from day 1
10. ❌ **Missing Indexes**: Design indexes with queries, not as afterthought

### What to Improve in V2

1. 🔄 **Error Recovery**: Better retry logic and user feedback
2. 🔄 **Progress Tracking**: Consistent, accurate progress reporting
3. 🔄 **Memory Management**: Automatic cleanup, bounded collections
4. 🔄 **Transaction Support**: Atomic operations for consistency
5. 🔄 **Performance Monitoring**: Built-in telemetry and profiling
6. 🔄 **Type Safety**: Eliminate `any`, use discriminated unions
7. 🔄 **Testing**: Comprehensive unit, integration, E2E tests
8. 🔄 **Documentation**: API docs, user guides, inline JSDoc
9. 🔄 **Code Splitting**: Lazy load routes and heavy components
10. 🔄 **Dependency Injection**: Better testability and flexibility

### Key Performance Goals for V2

Based on analysis and user requirements:

| Metric | V1 Current | V2 Target | Strategy |
|--------|------------|-----------|----------|
| **Label Switch** | 200-400ms | < 50ms | Optimistic UI, preloading, memoization |
| **Thread List Render** | 150-250ms | < 100ms | Virtual scrolling, indexes, batch loading |
| **Scroll Performance** | Varies | 60 FPS | Virtualization, content-visibility |
| **Initial Load** | 1-2s | < 500ms | Code splitting, lazy loading, caching |
| **Pagination** | 200-400ms | < 50ms | Fix N+1 queries, batch operations |
| **Sync Speed** | Varies | 2x faster | Parallel processing, batch API calls |

### Critical Success Factors for V2

1. **Performance First**: Design for performance from day 1, not optimize later
2. **Measure Everything**: Built-in metrics, profiling, telemetry
3. **Test Driven**: Write tests alongside code, not after
4. **Incremental Delivery**: Ship small, tested increments
5. **User Feedback**: Early user testing for navigation feel
6. **Database Design**: Indexes and migrations from start
7. **Clean Code**: No files > 500 lines, enforce with linter
8. **Error Handling**: Comprehensive error recovery everywhere
9. **Documentation**: Document as you build
10. **Simplicity**: Resist adding features that compromise performance

---

## Appendix: Useful Commands and Scripts

### Development

```bash
# Start client dev server
npm run dev

# Start server
cd server && npm run dev

# Clear database and reinitialize
npm run clear-db

# Run tests
npm test
npm run test:ui
npm run test:coverage

# Lint and format
npm run lint
npm run format
```

### Database Inspection

Use browser DevTools:
1. F12 → Application tab
2. IndexedDB → expand databases
3. Right-click database → Delete to reset

Or use provided HTML files:
- `check-database-status.html` - Overall DB health
- `check-indexeddb.html` - Raw IndexedDB data
- `check-workflows.html` - Workflow inspection
- `debug-workflow-flow.html` - Flow debugging

### Common Debugging Tasks

**Check sync status**:
```typescript
// In browser console
const db = await getDatabase();
const metadata = await db.syncMetadata.find().exec();
console.log(metadata);
```

**Clear sync queue**:
```typescript
const db = await getDatabase();
await db.syncQueue.remove();
```

**Inspect workflows**:
```typescript
const db = await getDatabase();
const workflows = await db.workflows.find().exec();
console.log(workflows);
```

**Check thread count**:
```typescript
const db = await getDatabase();
const count = await db.threads.count().exec();
console.log(`Total threads: ${count}`);
```

---

## Conclusion

This comprehensive brownfield architecture document captures the **current state** of Claine Email Client v1 with brutal honesty about what works, what doesn't, and why.

### Summary Statistics

- **Total Files Analyzed**: 100+ source files
- **Lines of Code**: ~50,000+ (estimated)
- **Key Systems**: 5 (Sync, Workflow, Database, Replication, UI)
- **Database Schemas**: 10
- **Technical Debt Items**: 30 documented
- **Performance Bottlenecks**: 12 identified
- **Critical Issues**: 7

### V2 Rebuild Priorities

**Phase 1: Foundation** (Weeks 1-4)
1. Database schema design with migrations
2. Core data layer with indexes
3. Performance monitoring infrastructure
4. Testing framework setup

**Phase 2: Sync System** (Weeks 5-8)
1. Unified sync API
2. Batch operations
3. Parallel processing
4. Progress tracking

**Phase 3: UI & Navigation** (Weeks 9-12)
1. Virtual scrolling
2. Optimistic updates
3. Memoization everywhere
4. Sub-50ms navigation

**Phase 4: Workflow Engine** (Weeks 13-16)
1. Persistent execution state
2. Multi-workflow support
3. Transaction support
4. Enhanced error handling

**Phase 5: Polish & Launch** (Weeks 17-20)
1. Performance optimization
2. Comprehensive testing
3. Documentation
4. User feedback integration

### Final Recommendations

1. **Don't rewrite everything at once**: Incremental rebuild with continuous testing
2. **Performance is non-negotiable**: Build it right from the start
3. **Test as you go**: No code without tests
4. **Measure everything**: Metrics and profiling from day 1
5. **Keep what works**: RxDB, ReactFlow, Clean Architecture are solid
6. **Fix what doesn't**: Migrations, state persistence, indexes
7. **User experience first**: Navigation feel is critical
8. **Simplicity wins**: Resist feature creep, optimize for speed

---

**Document Version**: 1.0
**Generated**: 2025-10-27
**Author**: Winston (Architect Agent)
**Source Project**: Claine Email Client v1
**Target Project**: Claine Email Client v2

---

This document is a living reference for the v2 rebuild. Update it as new insights emerge during development.
