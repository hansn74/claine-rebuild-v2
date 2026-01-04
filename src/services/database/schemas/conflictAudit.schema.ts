import type { RxJsonSchema } from 'rxdb'

/**
 * Conflict type enum
 * Matches ConflictType from conflictDetection.ts
 */
export type ConflictType = 'metadata' | 'content' | 'labels'

/**
 * Resolution strategy enum
 */
export type ResolutionStrategy = 'local' | 'server' | 'merged' | 'auto-lww' | 'auto-merge'

/**
 * Resolver type enum
 */
export type ResolverType = 'system' | 'user'

/**
 * Version snapshot for conflict audit
 * Stores the state of email at conflict time
 */
export interface ConflictVersionSnapshot {
  timestamp: number // Unix timestamp (ms)
  data: {
    subject?: string
    body?: {
      html?: string
      text?: string
    }
    read?: boolean
    starred?: boolean
    importance?: 'high' | 'normal' | 'low'
    labels?: string[]
    attributes?: Record<string, string | number | boolean | null>
  }
}

/**
 * Conflict Audit Document
 * Logs all conflicts detected during sync for auditing and history
 *
 * AC3: Conflicts logged to RxDB audit table with details
 * AC11: All conflicts logged to RxDB with resolution strategy used
 */
export interface ConflictAuditDocument {
  id: string // UUID - unique conflict identifier
  emailId: string // FK to email document
  accountId: string // Account context for multi-account support
  conflictType: ConflictType // Type of conflict detected
  conflictingFields: string[] // List of fields that conflicted
  localVersion: ConflictVersionSnapshot // Local email state at conflict time
  serverVersion: ConflictVersionSnapshot // Server email state at conflict time
  resolution: ResolutionStrategy // How the conflict was resolved
  resolvedAt: string // ISO timestamp when conflict was resolved
  resolvedBy: ResolverType // Who resolved: system (auto) or user (manual)
  resolutionNotes?: string // Optional notes about resolution
}

/**
 * RxDB schema for ConflictAudit collection
 * Version 0 - Initial schema design
 *
 * Indexes:
 * - emailId: For finding conflicts by email
 * - accountId: For filtering by account
 * - resolvedAt: For sorting conflict history
 * - [accountId, resolvedAt]: Compound index for account-scoped history
 */
export const conflictAuditSchema: RxJsonSchema<ConflictAuditDocument> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 100,
    },
    emailId: {
      type: 'string',
      maxLength: 200,
    },
    accountId: {
      type: 'string',
      maxLength: 100,
    },
    conflictType: {
      type: 'string',
      enum: ['metadata', 'content', 'labels'],
      maxLength: 20,
    },
    conflictingFields: {
      type: 'array',
      items: {
        type: 'string',
        maxLength: 50,
      },
      default: [],
    },
    localVersion: {
      type: 'object',
      properties: {
        timestamp: {
          type: 'number',
          minimum: 0,
          maximum: 9999999999999,
          multipleOf: 1,
        },
        data: {
          type: 'object',
          properties: {
            subject: {
              type: 'string',
              maxLength: 2000,
            },
            body: {
              type: 'object',
              properties: {
                html: {
                  type: 'string',
                  maxLength: 100000, // Truncated for audit
                },
                text: {
                  type: 'string',
                  maxLength: 100000,
                },
              },
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
            labels: {
              type: 'array',
              items: {
                type: 'string',
                maxLength: 100,
              },
            },
            attributes: {
              type: 'object',
              additionalProperties: true,
            },
          },
        },
      },
      required: ['timestamp', 'data'],
    },
    serverVersion: {
      type: 'object',
      properties: {
        timestamp: {
          type: 'number',
          minimum: 0,
          maximum: 9999999999999,
          multipleOf: 1,
        },
        data: {
          type: 'object',
          properties: {
            subject: {
              type: 'string',
              maxLength: 2000,
            },
            body: {
              type: 'object',
              properties: {
                html: {
                  type: 'string',
                  maxLength: 100000,
                },
                text: {
                  type: 'string',
                  maxLength: 100000,
                },
              },
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
            labels: {
              type: 'array',
              items: {
                type: 'string',
                maxLength: 100,
              },
            },
            attributes: {
              type: 'object',
              additionalProperties: true,
            },
          },
        },
      },
      required: ['timestamp', 'data'],
    },
    resolution: {
      type: 'string',
      enum: ['local', 'server', 'merged', 'auto-lww', 'auto-merge'],
      maxLength: 20,
    },
    resolvedAt: {
      type: 'string',
      maxLength: 50, // ISO timestamp
    },
    resolvedBy: {
      type: 'string',
      enum: ['system', 'user'],
      maxLength: 10,
    },
    resolutionNotes: {
      type: 'string',
      maxLength: 1000,
    },
  },
  required: [
    'id',
    'emailId',
    'accountId',
    'conflictType',
    'conflictingFields',
    'localVersion',
    'serverVersion',
    'resolution',
    'resolvedAt',
    'resolvedBy',
  ],
  indexes: [
    'emailId', // Find conflicts for specific email
    'accountId', // Filter by account
    'resolvedAt', // Sort by resolution time
    ['accountId', 'resolvedAt'], // Account-scoped history
  ],
}
