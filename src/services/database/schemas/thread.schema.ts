import type { RxJsonSchema } from 'rxdb'
import type { EmailAddress } from './email.schema'

/**
 * Thread document type representing an email conversation thread
 * Groups multiple related email messages together
 */
export interface ThreadDocument {
  id: string // Primary key - thread identifier
  subject: string // Thread subject (from first email)
  participants: EmailAddress[] // All participants in thread (with names)
  messageCount: number // Number of emails in thread
  lastMessageDate: number // Unix timestamp of most recent email
  snippet: string // Preview of latest message (max 200 chars)
  read: boolean // All messages in thread read?
  accountId: string // Email account identifier (for multi-account support)

  // Provider-specific fields (for sync optimization)
  historyId?: string // Gmail History ID for delta sync (Story 1.4)
}

/**
 * RxDB schema for Thread collection
 * Version 0 - Initial schema design
 *
 * Indexes:
 * - lastMessageDate (DESC): For sorted thread list
 * - ['accountId', 'lastMessageDate']: Compound index for multi-account filtering
 *
 * Note: Array fields like participants cannot be directly indexed in RxDB.
 * Use application-level filtering for participant search.
 */
export const threadSchema: RxJsonSchema<ThreadDocument> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 200,
    },
    subject: {
      type: 'string',
      maxLength: 2000,
    },
    participants: {
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
    },
    messageCount: {
      type: 'number',
      minimum: 1,
      multipleOf: 1,
    },
    lastMessageDate: {
      type: 'number',
      minimum: 0,
      maximum: 9999999999999, // Year 2286
      multipleOf: 1,
    },
    snippet: {
      type: 'string',
      maxLength: 200,
    },
    read: {
      type: 'boolean',
    },
    accountId: {
      type: 'string',
      maxLength: 100,
    },
    // Provider-specific
    historyId: {
      type: 'string',
      maxLength: 100,
    },
  },
  required: [
    'id',
    'subject',
    'participants',
    'messageCount',
    'lastMessageDate',
    'snippet',
    'read',
    'accountId',
  ],
  indexes: [
    'lastMessageDate', // Sort threads by date (DESC in query)
    ['accountId', 'lastMessageDate'], // Compound index for multi-account thread view
  ],
}
