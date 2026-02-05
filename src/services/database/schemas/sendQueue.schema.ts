import type { RxJsonSchema } from 'rxdb'
import type { EmailAddress, EmailBody } from './email.schema'

/**
 * Send queue status enum
 * - pending: Queued, waiting to be sent
 * - sending: Currently being sent
 * - sent: Successfully sent
 * - failed: Failed after max retries
 * - cancelled: Cancelled by user before send
 */
export type SendQueueStatus = 'pending' | 'sending' | 'sent' | 'failed' | 'cancelled'

/**
 * Send queue item type
 * - new: Fresh email composition
 * - reply: Reply to single sender
 * - reply-all: Reply to all participants
 * - forward: Forward to new recipients
 */
export type SendQueueType = 'new' | 'reply' | 'reply-all' | 'forward'

/**
 * Attachment metadata for queued emails
 * Content is stored base64-encoded for small attachments
 */
export interface SendQueueAttachment {
  id: string
  filename: string
  mimeType: string
  size: number
  content?: string // base64 encoded for small attachments
}

/**
 * Send queue document type representing an email waiting to be sent
 *
 * Design Philosophy:
 * - Supports offline-first sending (FR007)
 * - Retry logic with exponential backoff (AC5)
 * - Queue persists across app restarts (AC2)
 * - Visual status indicators (AC3)
 *
 * Storage: RxDB/IndexedDB for offline persistence
 */
export interface SendQueueDocument {
  // Primary identifier
  id: string // UUID for the queue item

  // Account association
  accountId: string // Which email account to send from

  // Original draft reference (optional - may be deleted after queueing)
  draftId?: string

  // Thread context for replies
  threadId?: string
  replyToEmailId?: string

  // Queue item type
  type: SendQueueType // new, reply, reply-all, or forward

  // Recipients (reusing EmailAddress interface)
  to: EmailAddress[] // Primary recipients
  cc: EmailAddress[] // Carbon copy recipients
  bcc: EmailAddress[] // Blind carbon copy recipients

  // Content
  subject: string // Email subject line
  body: EmailBody // HTML and plain text content

  // Attachments
  attachments: SendQueueAttachment[]

  // Status tracking
  status: SendQueueStatus // pending, sending, sent, failed, cancelled
  attempts: number // Number of send attempts
  maxAttempts: number // Maximum retry attempts (default: 3)

  // Timing
  lastAttemptAt?: number // Unix timestamp (ms) of last send attempt
  sentAt?: number // Unix timestamp (ms) when successfully sent
  sentMessageId?: string // Provider message ID after successful send

  // Error tracking
  error?: string // Last error message if failed

  // Story 2.18: Idempotency and duplicate prevention (Task 3)
  idempotencyKey?: string // Unique key to prevent duplicate sends
  lastProcessedBy?: 'app' | 'sw' // Which context last processed this item

  // Timestamps
  createdAt: number // Unix timestamp (ms) when queued
  updatedAt: number // Unix timestamp (ms) of last update
}

/**
 * RxDB schema for SendQueue collection
 * Version 0 - Initial schema design
 *
 * Indexes:
 * - accountId: Filter queue by account
 * - status: Filter by send status
 * - createdAt: Sort by queue order
 * - ['status', 'createdAt']: Compound index for pending queue processing
 */
export const sendQueueSchema: RxJsonSchema<SendQueueDocument> = {
  version: 1,
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
    draftId: {
      type: 'string',
      maxLength: 200,
    },
    threadId: {
      type: 'string',
      maxLength: 200,
    },
    replyToEmailId: {
      type: 'string',
      maxLength: 200,
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
      required: [],
    },
    attachments: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            maxLength: 200,
          },
          filename: {
            type: 'string',
            maxLength: 500,
          },
          mimeType: {
            type: 'string',
            maxLength: 200,
          },
          size: {
            type: 'number',
            minimum: 0,
          },
          content: {
            type: 'string',
            maxLength: 10000000, // ~10MB for base64 content
          },
        },
        required: ['id', 'filename', 'mimeType', 'size'],
      },
      default: [],
    },
    status: {
      type: 'string',
      enum: ['pending', 'sending', 'sent', 'failed', 'cancelled'],
      maxLength: 20,
    },
    attempts: {
      type: 'number',
      minimum: 0,
      maximum: 100,
      multipleOf: 1,
    },
    maxAttempts: {
      type: 'number',
      minimum: 1,
      maximum: 10,
      multipleOf: 1,
    },
    lastAttemptAt: {
      type: 'number',
      minimum: 0,
      maximum: 9999999999999, // Year 2286
      multipleOf: 1,
    },
    sentAt: {
      type: 'number',
      minimum: 0,
      maximum: 9999999999999, // Year 2286
      multipleOf: 1,
    },
    sentMessageId: {
      type: 'string',
      maxLength: 200,
    },
    error: {
      type: 'string',
      maxLength: 2000,
    },
    idempotencyKey: {
      type: 'string',
      maxLength: 100,
    },
    lastProcessedBy: {
      type: 'string',
      enum: ['app', 'sw'],
      maxLength: 10,
    },
    createdAt: {
      type: 'number',
      minimum: 0,
      maximum: 9999999999999, // Year 2286
      multipleOf: 1,
    },
    updatedAt: {
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
    'attachments',
    'status',
    'attempts',
    'maxAttempts',
    'createdAt',
    'updatedAt',
  ],
  indexes: ['accountId', 'status', 'createdAt', ['status', 'createdAt']],
}
