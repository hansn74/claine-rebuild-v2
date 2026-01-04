import type { RxJsonSchema } from 'rxdb'
import type { EmailAddress, EmailBody } from './email.schema'

/**
 * Draft type for compose operations
 * - new: Fresh email composition
 * - reply: Reply to single sender
 * - reply-all: Reply to all participants
 * - forward: Forward to new recipients
 */
export type DraftType = 'new' | 'reply' | 'reply-all' | 'forward'

/**
 * Draft document type representing an email draft in composition
 *
 * Design Philosophy:
 * - Reuses EmailAddress from email.schema for consistency
 * - Supports offline-first draft saving (FR006, FR007)
 * - Links to original email for replies/forwards
 * - Auto-save timestamp for recovery and conflict detection
 *
 * Storage: RxDB/IndexedDB for offline persistence
 */
export interface DraftDocument {
  // Primary identifier
  id: string // UUID for the draft

  // Account association
  accountId: string // Which email account this draft belongs to

  // Draft type
  type: DraftType // new, reply, reply-all, or forward

  // Recipients (reusing EmailAddress interface)
  to: EmailAddress[] // Primary recipients
  cc: EmailAddress[] // Carbon copy recipients
  bcc: EmailAddress[] // Blind carbon copy recipients

  // Content
  subject: string // Email subject line
  body: EmailBody // HTML and plain text content

  // Reply/Forward context
  replyToEmailId?: string // Original email ID for replies/forwards
  threadId?: string // Thread ID to associate with existing thread

  // Timestamps
  createdAt: number // Unix timestamp (ms) when draft was created
  lastSaved: number // Unix timestamp (ms) of last save (for auto-save indicator)
}

/**
 * RxDB schema for Draft collection
 * Version 0 - Initial schema design
 *
 * Indexes:
 * - accountId: Filter drafts by account
 * - lastSaved: Sort by most recently saved
 * - ['accountId', 'lastSaved']: Compound index for account-specific draft list
 */
export const draftSchema: RxJsonSchema<DraftDocument> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 200,
    },
    accountId: {
      type: 'string',
      maxLength: 100,
    },
    type: {
      type: 'string',
      enum: ['new', 'reply', 'reply-all', 'forward'],
    },
    to: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            maxLength: 200,
          },
          email: {
            type: 'string',
            maxLength: 200,
          },
        },
        required: ['name', 'email'],
      },
      default: [],
    },
    cc: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            maxLength: 200,
          },
          email: {
            type: 'string',
            maxLength: 200,
          },
        },
        required: ['name', 'email'],
      },
      default: [],
    },
    bcc: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            maxLength: 200,
          },
          email: {
            type: 'string',
            maxLength: 200,
          },
        },
        required: ['name', 'email'],
      },
      default: [],
    },
    subject: {
      type: 'string',
      maxLength: 2000,
    },
    body: {
      type: 'object',
      properties: {
        html: {
          type: 'string',
          maxLength: 500000, // ~500KB for HTML content
        },
        text: {
          type: 'string',
          maxLength: 500000, // ~500KB for plain text
        },
      },
    },
    replyToEmailId: {
      type: 'string',
      maxLength: 200,
    },
    threadId: {
      type: 'string',
      maxLength: 200,
    },
    createdAt: {
      type: 'number',
      minimum: 0,
      maximum: 9999999999999, // Year 2286
      multipleOf: 1,
    },
    lastSaved: {
      type: 'number',
      minimum: 0,
      maximum: 9999999999999, // Year 2286
      multipleOf: 1,
    },
  },
  required: [
    'id',
    'accountId',
    'type',
    'to',
    'cc',
    'bcc',
    'subject',
    'body',
    'createdAt',
    'lastSaved',
  ],
  indexes: ['accountId', 'lastSaved', ['accountId', 'lastSaved']],
}
