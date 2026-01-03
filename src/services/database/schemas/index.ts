/**
 * RxDB Schema Definitions
 *
 * This module exports all RxDB schemas for the Claine v2 application.
 * Schemas follow RxDB JSON Schema specification (draft-07 compatible).
 *
 * Schema Design Principles:
 * - All collections use lowercase plural names (emails, threads, workflows)
 * - All schemas start at version 0
 * - String fields have maxLength constraints
 * - Indexes specified for common query patterns
 * - Nested objects fully defined with validation rules
 * - Support for multi-account (accountId field)
 * - Custom attributes use flexible additionalProperties for user-defined keys
 *
 * **Adapter Pattern for Provider Integration:**
 * Schemas store PARSED data, not raw API responses. Provider adapters (Gmail, Outlook, IMAP)
 * must transform API responses into these schema formats:
 * - Parse email address headers → EmailAddress objects
 * - Extract HTML/text body → EmailBody object
 * - Parse attachment metadata → Attachment objects
 *
 * Performance Targets (NFR001):
 * - Common queries must execute in <50ms with 100K emails
 * - Indexes optimize for: timestamp sorting, folder filtering, thread grouping
 *
 * Storage Targets (NFR004):
 * - Average email size: ~20 KB (with metadata, attachments metadata, HTML/text body)
 * - 100K emails: ~2 GB
 * - Well within browser IndexedDB quota (~60% of disk space)
 */

export { emailSchema } from './email.schema'
export type { EmailDocument, EmailAddress, EmailBody, Attachment } from './email.schema'

export { threadSchema } from './thread.schema'
export type { ThreadDocument } from './thread.schema'

export { workflowSchema } from './workflow.schema'
export type {
  WorkflowDocument,
  WorkflowNode,
  WorkflowEdge,
  WorkflowTrigger,
  WorkflowNodeType,
} from './workflow.schema'

export { aiMetadataSchema } from './aiMetadata.schema'
export type { AIMetadataDocument } from './aiMetadata.schema'

export { authTokenSchema } from './authToken.schema'
export type { AuthTokenDocument } from './authToken.schema'

export { syncStateSchema } from './syncState.schema'
export type { SyncStateDocument } from './syncState.schema'

export { conflictAuditSchema } from './conflictAudit.schema'
export type {
  ConflictAuditDocument,
  ConflictVersionSnapshot,
  ConflictType,
  ResolutionStrategy,
  ResolverType,
} from './conflictAudit.schema'

export { syncFailureSchema } from './syncFailure.schema'
export type {
  SyncFailureDocument,
  SyncErrorType,
  SyncProvider,
  SyncFailureStatus,
} from './syncFailure.schema'

export { draftSchema } from './draft.schema'
export type { DraftDocument, DraftType } from './draft.schema'

export { contactSchema } from './contact.schema'
export type { ContactDocument } from './contact.schema'

export { sendQueueSchema } from './sendQueue.schema'
export type {
  SendQueueDocument,
  SendQueueStatus,
  SendQueueType,
  SendQueueAttachment,
} from './sendQueue.schema'

export {
  searchIndexSchema,
  SEARCH_INDEX_SCHEMA_VERSION,
  SEARCH_INDEX_DOCUMENT_ID,
} from './searchIndex.schema'
export type { SearchIndexDocument } from './searchIndex.schema'

export { actionQueueSchema } from './actionQueue.schema'
export type { ActionQueueDocument, ActionQueueStatus, ActionType } from './actionQueue.schema'

export { attributeSchema, ATTRIBUTE_TYPES } from './attribute.schema'
export type { AttributeDocument, AttributeEnumValueDoc } from './attribute.schema'

export { metadataSchema } from './metadata.schema'
export type { MetadataDocument } from './metadata.schema'
