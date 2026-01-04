import type { RxJsonSchema } from 'rxdb'

/**
 * Email address with display name and email
 * Follows RFC 5322 standard: "Display Name <email@example.com>"
 * Compatible with Gmail API, Outlook API, and IMAP parsing
 */
export interface EmailAddress {
  name: string // Display name (e.g., "John Doe")
  email: string // Email address (e.g., "john.doe@example.com")
}

/**
 * Email body in multiple formats
 * Standard email practice: store both HTML and plain text versions
 * - HTML: Rich formatted version for display
 * - Text: Plain text for accessibility and fallback
 */
export interface EmailBody {
  html?: string // HTML version of email body
  text?: string // Plain text version of email body
}

/**
 * Email attachment metadata
 * Follows standard MIME attachment structure
 * Compatible with Gmail API attachments.get response
 */
export interface Attachment {
  id: string // Attachment identifier (for fetching from API)
  filename: string // Original filename
  mimeType: string // MIME type (e.g., "application/pdf")
  size: number // Size in bytes
  isInline: boolean // Whether attachment is inline (embedded in HTML)
  contentId?: string // Content-ID for inline attachments (e.g., "image001")
}

/**
 * Email document type representing a single email message
 *
 * Design Philosophy:
 * - Stores PARSED data (not raw API format) for query efficiency
 * - Provider-agnostic: works with Gmail, Outlook, IMAP after adapter parsing
 * - Supports PRD features: custom attributes (FR024), AI metadata (FR025)
 * - Multi-account ready (FR003)
 */
export interface EmailDocument {
  // Core email fields (parsed from provider APIs)
  id: string // Primary key - unique email identifier (Gmail message ID or generated)
  threadId: string // Thread identifier for conversation grouping
  from: EmailAddress // Sender with name and email
  to: EmailAddress[] // Recipients with names and emails
  cc?: EmailAddress[] // CC recipients (optional)
  bcc?: EmailAddress[] // BCC recipients (optional)
  subject: string // Email subject line
  body: EmailBody // Email body in HTML and/or plain text
  timestamp: number // Unix timestamp (milliseconds) for email date
  accountId: string // Email account identifier (for multi-account support, up to 3 accounts per FR003)

  // Attachment metadata
  attachments: Attachment[] // List of attachments with metadata
  snippet: string // First 200 chars of body for preview (plain text)

  // Metadata fields
  labels: string[] // Gmail labels or folder names
  folder: string // Primary folder/label
  read: boolean // Read/unread status
  starred: boolean // Starred/flagged status
  importance: 'high' | 'normal' | 'low' // Importance level

  // Provider-specific fields (for sync optimization)
  historyId?: string // Gmail History ID for delta sync (Story 1.4)

  // Custom attributes (user-defined key-value pairs - FR024)
  attributes: {
    [key: string]: string | number | boolean | null
  }

  // AI metadata (optional - FR025)
  aiMetadata?: {
    triageScore: number // AI confidence in triage decision (0-100)
    priority: 'high' | 'medium' | 'low' | 'none' // AI-suggested priority
    suggestedAttributes: {
      [key: string]: {
        value: string | number | boolean
        confidence: number // Confidence score (0-100)
      }
    }
    confidence: number // Overall AI confidence score (0-100)
    reasoning: string // Explainable AI reasoning for suggestions
    modelVersion: string // AI model version used
    processedAt: number // Unix timestamp when AI processed email
  }
}

/**
 * RxDB schema for Email collection
 * Version 0 - Initial schema design
 *
 * Indexes:
 * - timestamp (DESC): For inbox view sorted by date
 * - folder: For filtering by primary folder
 * - ['accountId', 'timestamp']: Compound index for multi-account filtering
 * - threadId: For thread grouping
 *
 * Note: Array fields (labels, attachments) and optional nested fields (aiMetadata.priority)
 * cannot be directly indexed in RxDB. Use application-level filtering for these cases.
 *
 * Adapter Pattern:
 * This schema stores PARSED data. Provider adapters (Gmail, Outlook, IMAP) must:
 * 1. Parse raw API responses (e.g., Gmail header strings → EmailAddress objects)
 * 2. Transform to this schema format
 * 3. Insert into RxDB
 *
 * Example Gmail Adapter Flow:
 * Gmail API: { headers: [{ name: "From", value: "John <john@example.com>" }] }
 *     ↓ (parse with emailAddressParser library)
 * EmailDocument: { from: { name: "John", email: "john@example.com" } }
 */
export const emailSchema: RxJsonSchema<EmailDocument> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    // Core fields
    id: {
      type: 'string',
      maxLength: 200,
    },
    threadId: {
      type: 'string',
      maxLength: 200,
    },
    from: {
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
          maxLength: 500000, // ~500KB for HTML emails
        },
        text: {
          type: 'string',
          maxLength: 500000, // ~500KB for plain text
        },
      },
    },
    timestamp: {
      type: 'number',
      minimum: 0,
      maximum: 9999999999999, // Year 2286
      multipleOf: 1,
    },
    accountId: {
      type: 'string',
      maxLength: 100,
    },

    // Attachments
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
            maxLength: 100,
          },
          size: {
            type: 'number',
            minimum: 0,
            multipleOf: 1,
          },
          isInline: {
            type: 'boolean',
          },
          contentId: {
            type: 'string',
            maxLength: 200,
          },
        },
        required: ['id', 'filename', 'mimeType', 'size', 'isInline'],
      },
      default: [],
    },
    snippet: {
      type: 'string',
      maxLength: 200,
    },

    // Metadata fields
    labels: {
      type: 'array',
      items: {
        type: 'string',
        maxLength: 100,
      },
      default: [],
    },
    folder: {
      type: 'string',
      maxLength: 100,
    },
    read: {
      type: 'boolean',
    },
    starred: {
      type: 'boolean',
    },
    importance: {
      type: 'string',
      enum: ['high', 'normal', 'low'],
    },

    // Provider-specific
    historyId: {
      type: 'string',
      maxLength: 100,
    },

    // Custom attributes (flexible key-value pairs)
    attributes: {
      type: 'object',
      additionalProperties: true, // Allow arbitrary keys
      default: {},
    },

    // AI metadata (optional)
    aiMetadata: {
      type: 'object',
      properties: {
        triageScore: {
          type: 'number',
          minimum: 0,
          maximum: 100,
        },
        priority: {
          type: 'string',
          enum: ['high', 'medium', 'low', 'none'],
        },
        suggestedAttributes: {
          type: 'object',
          additionalProperties: true, // Flexible structure for AI suggestions
        },
        confidence: {
          type: 'number',
          minimum: 0,
          maximum: 100,
        },
        reasoning: {
          type: 'string',
          maxLength: 5000,
        },
        modelVersion: {
          type: 'string',
          maxLength: 100,
        },
        processedAt: {
          type: 'number',
          minimum: 0,
          maximum: 9999999999999,
          multipleOf: 1,
        },
      },
      required: [
        'triageScore',
        'priority',
        'confidence',
        'reasoning',
        'modelVersion',
        'processedAt',
      ],
    },
  },
  required: [
    'id',
    'threadId',
    'from',
    'to',
    'subject',
    'body',
    'timestamp',
    'accountId',
    'attachments',
    'snippet',
    'labels',
    'folder',
    'read',
    'starred',
    'importance',
    'attributes',
  ],
  indexes: [
    'timestamp', // Sort by date (DESC in query)
    ['accountId', 'timestamp'], // Compound index for multi-account inbox view
    'threadId', // Thread grouping
    'folder', // Filter by primary folder
    // Story 2.10: Task 4.2 - Additional compound indexes for common query patterns
    ['folder', 'timestamp'], // Folder view sorted by date
    ['accountId', 'folder'], // Multi-account folder filtering
    'read', // Quick unread filtering
  ],
}
