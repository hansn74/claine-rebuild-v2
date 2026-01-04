/**
 * Schema Validation Test Suite
 *
 * Comprehensive validation tests for all RxDB schemas.
 * Ensures schemas enforce constraints correctly for CI.
 *
 * @tag @rxdb
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createRxDatabase, addRxPlugin, type RxDatabase } from 'rxdb'
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie'
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv'
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode'

// Import all schemas
import { emailSchema, type EmailDocument } from '../email.schema'
import { threadSchema, type ThreadDocument } from '../thread.schema'
import { workflowSchema, type WorkflowDocument } from '../workflow.schema'
import { aiMetadataSchema, type AIMetadataDocument } from '../aiMetadata.schema'
import { syncStateSchema } from '../syncState.schema'
import { conflictAuditSchema } from '../conflictAudit.schema'
import { syncFailureSchema } from '../syncFailure.schema'
import { authTokenSchema } from '../authToken.schema'

// Add dev mode plugin for validation
addRxPlugin(RxDBDevModePlugin)

/**
 * Helper to create test database with validation
 */
async function createValidatedDB(name: string, schemas: Record<string, { schema: unknown }>) {
  const db = await createRxDatabase({
    name: `test-schema-validation-${name}-${Date.now()}`,
    storage: wrappedValidateAjvStorage({ storage: getRxStorageDexie() }),
    multiInstance: false,
    ignoreDuplicate: true,
  })

  await db.addCollections(schemas)
  return db
}

describe('@rxdb Email Schema Validation', () => {
  let db: RxDatabase

  beforeEach(async () => {
    db = await createValidatedDB('email', { emails: { schema: emailSchema } })
  })

  afterEach(async () => {
    if (db) await db.remove()
  })

  const validEmail: EmailDocument = {
    id: 'email-1',
    threadId: 'thread-1',
    from: { name: 'Sender', email: 'sender@example.com' },
    to: [{ name: 'Recipient', email: 'recipient@example.com' }],
    subject: 'Test Subject',
    body: { html: '<p>Test</p>', text: 'Test' },
    timestamp: Date.now(),
    accountId: 'account-1',
    attachments: [],
    snippet: 'Test',
    labels: ['INBOX'],
    folder: 'INBOX',
    read: false,
    starred: false,
    importance: 'normal',
    attributes: {},
  }

  it('@rxdb should accept valid email document', async () => {
    const doc = await db.emails.insert(validEmail)
    expect(doc.id).toBe('email-1')
  })

  it('@rxdb should reject email missing required "from" field', async () => {
    const invalid = { ...validEmail, id: 'email-2' }
    delete (invalid as Partial<EmailDocument>).from

    await expect(db.emails.insert(invalid)).rejects.toThrow()
  })

  it('@rxdb should reject email missing required "to" field', async () => {
    const invalid = { ...validEmail, id: 'email-3' }
    delete (invalid as Partial<EmailDocument>).to

    await expect(db.emails.insert(invalid)).rejects.toThrow()
  })

  it('@rxdb should reject invalid importance value', async () => {
    const invalid = { ...validEmail, id: 'email-4', importance: 'invalid' as 'high' }

    await expect(db.emails.insert(invalid)).rejects.toThrow()
  })

  it('@rxdb should validate email address structure', async () => {
    const invalidFrom = { ...validEmail, id: 'email-5', from: { name: 'Test' } } // Missing email

    await expect(db.emails.insert(invalidFrom as EmailDocument)).rejects.toThrow()
  })

  it('@rxdb should accept optional fields', async () => {
    const withOptionals: EmailDocument = {
      ...validEmail,
      id: 'email-6',
      cc: [{ name: 'CC', email: 'cc@example.com' }],
      bcc: [{ name: 'BCC', email: 'bcc@example.com' }],
      historyId: '12345',
    }

    const doc = await db.emails.insert(withOptionals)
    expect(doc.cc?.length).toBe(1)
    expect(doc.historyId).toBe('12345')
  })

  it('@rxdb should accept custom attributes', async () => {
    const withAttrs: EmailDocument = {
      ...validEmail,
      id: 'email-7',
      attributes: {
        Project: 'Alpha',
        Priority: 'High',
        BillableHours: 5.5,
        IsUrgent: true,
      },
    }

    const doc = await db.emails.insert(withAttrs)
    expect(doc.attributes.Project).toBe('Alpha')
  })

  it('@rxdb should verify email schema indexes exist', () => {
    const indexes = emailSchema.indexes || []
    expect(indexes).toContain('timestamp')
    expect(indexes).toContain('folder')
    expect(indexes).toContain('threadId')
    expect(indexes.some((idx) => Array.isArray(idx) && idx.includes('accountId'))).toBe(true)
  })
})

describe('@rxdb Thread Schema Validation', () => {
  let db: RxDatabase

  beforeEach(async () => {
    db = await createValidatedDB('thread', { threads: { schema: threadSchema } })
  })

  afterEach(async () => {
    if (db) await db.remove()
  })

  const validThread: ThreadDocument = {
    id: 'thread-1',
    subject: 'Test Thread',
    participants: [{ name: 'User', email: 'user@example.com' }],
    messageCount: 3,
    lastMessageDate: Date.now(),
    accountId: 'account-1',
    snippet: 'Latest message preview',
    read: true,
  }

  it('@rxdb should accept valid thread document', async () => {
    const doc = await db.threads.insert(validThread)
    expect(doc.id).toBe('thread-1')
  })

  it('@rxdb should reject thread missing required participants', async () => {
    const invalid = { ...validThread, id: 'thread-2' }
    delete (invalid as Partial<ThreadDocument>).participants

    await expect(db.threads.insert(invalid)).rejects.toThrow()
  })

  it('@rxdb should verify thread schema indexes', () => {
    const indexes = threadSchema.indexes || []
    expect(indexes).toContain('lastMessageDate')
    expect(indexes.some((idx) => Array.isArray(idx) && idx.includes('accountId'))).toBe(true)
  })
})

describe('@rxdb Workflow Schema Validation', () => {
  let db: RxDatabase

  beforeEach(async () => {
    db = await createValidatedDB('workflow', { workflows: { schema: workflowSchema } })
  })

  afterEach(async () => {
    if (db) await db.remove()
  })

  const validWorkflow: WorkflowDocument = {
    id: 'workflow-1',
    name: 'Auto-Label Workflow',
    description: 'Automatically label emails',
    enabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    nodes: [
      {
        id: 'node-1',
        type: 'trigger',
        position: { x: 0, y: 0 },
        data: { triggerType: 'email_received' },
      },
      {
        id: 'node-2',
        type: 'action',
        position: { x: 200, y: 0 },
        data: { actionType: 'add_label', label: 'Important' },
      },
    ],
    edges: [
      {
        id: 'edge-1',
        source: 'node-1',
        target: 'node-2',
      },
    ],
    triggers: [
      {
        type: 'email_received',
        config: {},
      },
    ],
    executionCount: 0,
  }

  it('@rxdb should accept valid workflow document', async () => {
    const doc = await db.workflows.insert(validWorkflow)
    expect(doc.id).toBe('workflow-1')
  })

  it('@rxdb should reject workflow without name', async () => {
    const invalid = { ...validWorkflow, id: 'workflow-2' }
    delete (invalid as Partial<WorkflowDocument>).name

    await expect(db.workflows.insert(invalid)).rejects.toThrow()
  })

  it('@rxdb should accept workflow with multiple triggers', async () => {
    const multiTrigger: WorkflowDocument = {
      ...validWorkflow,
      id: 'workflow-3',
      triggers: [
        { type: 'email_received', config: { folder: 'INBOX' } },
        { type: 'schedule', config: { cron: '0 9 * * *' } },
      ],
    }

    const doc = await db.workflows.insert(multiTrigger)
    expect(doc.triggers.length).toBe(2)
  })
})

describe('@rxdb AI Metadata Schema Validation', () => {
  let db: RxDatabase

  beforeEach(async () => {
    db = await createValidatedDB('ai', { aiMetadata: { schema: aiMetadataSchema } })
  })

  afterEach(async () => {
    if (db) await db.remove()
  })

  const validAIMetadata: AIMetadataDocument = {
    id: 'ai-1',
    emailId: 'email-1',
    triageScore: 85,
    priority: 'high',
    suggestedAttributes: {},
    confidence: 90,
    reasoning: 'Important email from boss',
    modelVersion: 'v1.0',
    processedAt: Date.now(),
  }

  it('@rxdb should accept valid AI metadata document', async () => {
    const doc = await db.aiMetadata.insert(validAIMetadata)
    expect(doc.triageScore).toBe(85)
  })

  it('@rxdb should enforce triageScore range (0-100)', async () => {
    const invalid = { ...validAIMetadata, id: 'ai-2', triageScore: 150 }

    await expect(db.aiMetadata.insert(invalid)).rejects.toThrow()
  })

  it('@rxdb should validate priority enum values', async () => {
    const invalid = { ...validAIMetadata, id: 'ai-3', priority: 'urgent' as 'high' }

    await expect(db.aiMetadata.insert(invalid)).rejects.toThrow()
  })
})

describe('@rxdb Sync State Schema Validation', () => {
  let db: RxDatabase

  beforeEach(async () => {
    db = await createValidatedDB('sync', { syncState: { schema: syncStateSchema } })
  })

  afterEach(async () => {
    if (db) await db.remove()
  })

  it('@rxdb should accept valid sync state document', async () => {
    const syncState = {
      id: 'account-1',
      provider: 'gmail',
      status: 'idle',
      initialSyncComplete: false,
      emailsSynced: 0,
      totalEmailsToSync: 0,
      progressPercentage: 0,
      estimatedTimeRemaining: 0,
      lastSyncAt: Date.now(),
      nextSyncAt: Date.now() + 3600000,
      errorCount: 0,
      lastRequestAt: Date.now(),
      requestCount: 0,
      averageSyncRate: 0,
    }

    const doc = await db.syncState.insert(syncState)
    expect(doc.provider).toBe('gmail')
  })

  it('@rxdb should validate provider enum', async () => {
    const invalid = {
      id: 'account-2',
      provider: 'yahoo', // Invalid provider
      status: 'idle',
      initialSyncComplete: false,
      emailsSynced: 0,
      totalEmailsToSync: 0,
      progressPercentage: 0,
      estimatedTimeRemaining: 0,
      lastSyncAt: Date.now(),
      nextSyncAt: Date.now(),
      errorCount: 0,
      lastRequestAt: Date.now(),
      requestCount: 0,
      averageSyncRate: 0,
    }

    await expect(db.syncState.insert(invalid)).rejects.toThrow()
  })
})

describe('@rxdb Conflict Audit Schema Validation', () => {
  let db: RxDatabase

  beforeEach(async () => {
    db = await createValidatedDB('conflict', { conflictAudit: { schema: conflictAuditSchema } })
  })

  afterEach(async () => {
    if (db) await db.remove()
  })

  it('@rxdb should accept valid conflict audit document', async () => {
    const conflict = {
      id: 'conflict-1',
      emailId: 'email-1',
      accountId: 'account-1',
      conflictType: 'metadata',
      conflictingFields: ['read'],
      localVersion: {
        timestamp: Date.now(),
        data: { read: false },
      },
      serverVersion: {
        timestamp: Date.now() + 1000,
        data: { read: true },
      },
      resolution: 'server',
      resolvedAt: new Date().toISOString(),
      resolvedBy: 'system',
    }

    const doc = await db.conflictAudit.insert(conflict)
    expect(doc.resolution).toBe('server')
  })
})

describe('@rxdb Sync Failure Schema Validation', () => {
  let db: RxDatabase

  beforeEach(async () => {
    db = await createValidatedDB('syncfail', { syncFailure: { schema: syncFailureSchema } })
  })

  afterEach(async () => {
    if (db) await db.remove()
  })

  it('@rxdb should accept valid sync failure document', async () => {
    const failure = {
      id: 'failure-1',
      emailId: 'email-123',
      accountId: 'account-1',
      provider: 'gmail',
      errorType: 'transient',
      errorCode: 429,
      errorMessage: 'Rate limit exceeded',
      retryCount: 1,
      maxRetries: 3,
      lastAttemptAt: Date.now(),
      nextRetryAt: Date.now() + 60000,
      status: 'pending',
      createdAt: Date.now(),
    }

    const doc = await db.syncFailure.insert(failure)
    expect(doc.status).toBe('pending')
  })
})

describe('@rxdb Auth Token Schema Validation', () => {
  let db: RxDatabase

  beforeEach(async () => {
    db = await createValidatedDB('auth', { authTokens: { schema: authTokenSchema } })
  })

  afterEach(async () => {
    if (db) await db.remove()
  })

  it('@rxdb should accept valid auth token document', async () => {
    const token = {
      id: 'token-1',
      account_id: 'account-1',
      ciphertext: 'encrypted-base64-data',
      iv: 'initialization-vector',
      tag: 'auth-tag-base64',
      encrypted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 3600000).toISOString(),
    }

    const doc = await db.authTokens.insert(token)
    expect(doc.account_id).toBe('account-1')
  })
})

describe('@rxdb Schema Version Tracking', () => {
  it('@rxdb should have correct version numbers on all schemas', () => {
    expect(emailSchema.version).toBe(0)
    expect(threadSchema.version).toBe(0)
    expect(workflowSchema.version).toBe(0)
    expect(aiMetadataSchema.version).toBe(0)
  })
})
