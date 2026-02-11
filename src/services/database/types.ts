import type { RxDatabase, RxCollection } from 'rxdb'
import type {
  EmailDocument,
  ThreadDocument,
  WorkflowDocument,
  AIMetadataDocument,
  AuthTokenDocument,
  SyncStateDocument,
  ConflictAuditDocument,
  SyncFailureDocument,
  DraftDocument,
  ContactDocument,
  SendQueueDocument,
  SearchIndexDocument,
  ActionQueueDocument,
  AttributeDocument,
  MetadataDocument,
  ModifierDocument,
  PriorityFeedbackDocument,
} from './schemas'

// Re-export MetadataDocument for convenience
export type { MetadataDocument }

/**
 * Database collections interface
 * Maps collection names to their typed RxCollection instances
 *
 * Required collections:
 * - metadata: System collection for version tracking and migration history
 *
 * Optional collections (prefixed with underscore):
 * - emails: Email messages (optional - loaded dynamically based on user accounts)
 * - _threads: Email conversation threads
 * - _workflows: User-defined workflows
 * - _aiMetadata: AI analysis results for emails
 * - authTokens: Encrypted OAuth tokens for account authentication
 */
export interface DatabaseCollections {
  // Required system collection
  metadata: RxCollection<MetadataDocument>

  // Optional user data collections (may not exist until user adds accounts)
  emails?: RxCollection<EmailDocument>
  threads?: RxCollection<ThreadDocument>
  workflows?: RxCollection<WorkflowDocument>
  aiMetadata?: RxCollection<AIMetadataDocument>
  authTokens?: RxCollection<AuthTokenDocument>
  syncState?: RxCollection<SyncStateDocument>
  conflictAudit?: RxCollection<ConflictAuditDocument>
  syncFailures?: RxCollection<SyncFailureDocument>
  drafts?: RxCollection<DraftDocument>
  contacts?: RxCollection<ContactDocument>
  sendQueue?: RxCollection<SendQueueDocument>
  searchIndex?: RxCollection<SearchIndexDocument>
  actionQueue?: RxCollection<ActionQueueDocument>
  attributes?: RxCollection<AttributeDocument>
  modifiers?: RxCollection<ModifierDocument>
  priorityFeedback?: RxCollection<PriorityFeedbackDocument>
}

/**
 * Typed RxDatabase instance for the application
 * Use this type instead of generic RxDatabase for compile-time type safety
 *
 * Example usage:
 * ```typescript
 * import type { AppDatabase } from './types'
 *
 * async function getVersion(db: AppDatabase): Promise<number> {
 *   const metadata = await db.metadata.findOne('db-version').exec()
 *   return metadata.version
 * }
 * ```
 */
export type AppDatabase = RxDatabase<DatabaseCollections> & {
  destroyed: boolean
  destroy: () => Promise<boolean>
}
