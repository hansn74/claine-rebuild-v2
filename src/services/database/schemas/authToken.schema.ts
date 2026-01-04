/**
 * OAuth Token Schema for RxDB
 * Defines the structure for storing encrypted OAuth tokens in IndexedDB
 *
 * Security Notes:
 * - Tokens are always stored encrypted using AES-GCM 256-bit
 * - Never store tokens in localStorage (vulnerable to XSS)
 * - The schema stores encrypted blobs, not plaintext tokens
 */

import type { RxJsonSchema } from 'rxdb'

/**
 * Auth Token Document Interface
 * Represents an encrypted OAuth token document in RxDB
 */
export interface AuthTokenDocument {
  /** Document ID (account email address) */
  id: string

  /** Account email address */
  account_id: string

  /** Base64-encoded encrypted token data */
  ciphertext: string

  /** Base64-encoded initialization vector */
  iv: string

  /** Base64-encoded authentication tag (included in ciphertext for AES-GCM) */
  tag: string

  /** ISO timestamp when tokens were encrypted */
  encrypted_at: string

  /** ISO timestamp when tokens were last updated */
  updated_at: string

  /** ISO timestamp when access token expires (for scheduling refresh) */
  expires_at: string
}

/**
 * RxDB Schema for Auth Tokens
 * Version 0: Initial schema for encrypted OAuth token storage
 */
export const authTokenSchema: RxJsonSchema<AuthTokenDocument> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 255,
    },
    account_id: {
      type: 'string',
      maxLength: 255,
    },
    ciphertext: {
      type: 'string',
      maxLength: 10000, // Encrypted tokens are small, ~2KB typical
    },
    iv: {
      type: 'string',
      maxLength: 100, // Base64-encoded 12-byte IV = ~16 chars
    },
    tag: {
      type: 'string',
      maxLength: 100, // AES-GCM tag included in ciphertext
    },
    encrypted_at: {
      type: 'string',
      maxLength: 100,
    },
    updated_at: {
      type: 'string',
      maxLength: 100,
    },
    expires_at: {
      type: 'string',
      maxLength: 100,
    },
  },
  required: ['id', 'account_id', 'ciphertext', 'iv', 'encrypted_at', 'updated_at', 'expires_at'],
  indexes: ['account_id', 'expires_at'],
}

/**
 * Export schema and type for use in database initialization
 */
export type AuthTokenDocType = AuthTokenDocument
