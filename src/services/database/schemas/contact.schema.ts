import type { RxJsonSchema } from 'rxdb'

/**
 * Contact document type for autocomplete
 *
 * Stores email contacts extracted from email from/to/cc fields
 * Used for recipient autocomplete in compose
 *
 * Story 2.3: Compose & Reply Interface
 * Task 9: Contact Storage and Extraction
 */
export interface ContactDocument {
  // Primary key - email address (lowercase)
  id: string // email address serves as unique ID

  // Contact info
  email: string // Email address
  name: string // Display name (may be empty)

  // Usage tracking for autocomplete ranking
  frequency: number // Number of times used in compose
  lastUsed: number // Unix timestamp of last use

  // Account association
  accountId: string // Which account this contact belongs to

  // Source tracking
  source: 'sent' | 'received' | 'manual' // How contact was added
  firstSeen: number // Unix timestamp when first encountered
}

/**
 * RxDB schema for Contact collection
 * Version 0 - Initial schema design
 *
 * Indexes:
 * - accountId: Filter contacts by account
 * - lastUsed: Sort by most recently used
 * - frequency: Sort by most frequently used
 * - ['accountId', 'frequency']: Compound for account-specific ranking
 */
export const contactSchema: RxJsonSchema<ContactDocument> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 200,
    },
    email: {
      type: 'string',
      maxLength: 200,
    },
    name: {
      type: 'string',
      maxLength: 200,
    },
    frequency: {
      type: 'number',
      minimum: 0,
      maximum: 999999999,
      multipleOf: 1,
    },
    lastUsed: {
      type: 'number',
      minimum: 0,
      maximum: 9999999999999,
      multipleOf: 1,
    },
    accountId: {
      type: 'string',
      maxLength: 100,
    },
    source: {
      type: 'string',
      enum: ['sent', 'received', 'manual'],
    },
    firstSeen: {
      type: 'number',
      minimum: 0,
      maximum: 9999999999999,
      multipleOf: 1,
    },
  },
  required: ['id', 'email', 'name', 'frequency', 'lastUsed', 'accountId', 'source', 'firstSeen'],
  indexes: ['accountId', 'lastUsed', 'frequency', ['accountId', 'frequency']],
}
