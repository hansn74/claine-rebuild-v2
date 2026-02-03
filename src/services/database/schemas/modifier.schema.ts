/**
 * Modifier Schema
 *
 * Epic 3: Offline-First Modifier Architecture
 * Story 3.1: Core Modifier Infrastructure
 *
 * RxDB schema for persisting modifiers to IndexedDB.
 * Modifiers are queued actions that transform entity state
 * and sync to backend when online.
 *
 * Design:
 * - Per-entity queues maintained via entityId index
 * - FIFO ordering via createdAt index
 * - Status tracking for queue processing
 * - Payload stores modifier-specific data as JSON
 */

import type { RxJsonSchema } from 'rxdb'
import type { ModifierDocument } from '@/services/modifiers/types'

/**
 * RxDB schema for Modifier collection
 * Version 0 - Initial schema design
 *
 * Indexes:
 * - entityId: For per-entity queue lookups
 * - status: For finding pending modifiers to process
 * - createdAt: For FIFO ordering
 * - ['entityId', 'createdAt']: Compound index for ordered per-entity queue
 * - ['status', 'createdAt']: Compound index for efficient queue processing
 */
export const modifierSchema: RxJsonSchema<ModifierDocument> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 100,
    },
    entityId: {
      type: 'string',
      maxLength: 200,
    },
    entityType: {
      type: 'string',
      enum: ['email', 'draft'],
      maxLength: 20,
    },
    type: {
      type: 'string',
      enum: [
        'archive',
        'unarchive',
        'delete',
        'undelete',
        'mark-read',
        'mark-unread',
        'move',
        'star',
        'unstar',
        'draft-update',
        'draft-delete',
      ],
      maxLength: 30,
    },
    accountId: {
      type: 'string',
      maxLength: 100,
    },
    provider: {
      type: 'string',
      enum: ['gmail', 'outlook'],
      maxLength: 20,
    },
    status: {
      type: 'string',
      enum: ['pending', 'processing', 'completed', 'failed'],
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
    createdAt: {
      type: 'number',
      minimum: 0,
      maximum: 9999999999999,
      multipleOf: 1,
    },
    updatedAt: {
      type: 'number',
      minimum: 0,
      maximum: 9999999999999,
      multipleOf: 1,
    },
    lastAttemptAt: {
      type: 'number',
      minimum: 0,
      maximum: 9999999999999,
      multipleOf: 1,
    },
    error: {
      type: 'string',
      maxLength: 2000,
    },
    payload: {
      type: 'string',
      maxLength: 50000, // Large enough for draft content
    },
  },
  required: [
    'id',
    'entityId',
    'entityType',
    'type',
    'accountId',
    'provider',
    'status',
    'attempts',
    'maxAttempts',
    'createdAt',
    'updatedAt',
    'payload',
  ],
  indexes: [
    'entityId',
    'status',
    'createdAt',
    ['entityId', 'createdAt'],
    ['status', 'createdAt'],
    ['entityType', 'status'],
  ],
}
