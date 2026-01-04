/**
 * Conflict Detection Service
 * Detects sync conflicts between local and server email versions
 *
 * Conflict Detection Rules:
 * - Conflict detected when local has uncommitted changes AND server version differs
 * - No conflict if server timestamp > local last sync (server is newer, just accept it)
 * - Conflict types: metadata (read/starred/archived), labels, content (subject/body)
 *
 * Performance Constraints:
 * - Must run BEFORE local data is overwritten
 * - Batch detection during sync for efficiency
 * - Async audit logging (don't block sync)
 */

import type { EmailDocument } from '../database/schemas/email.schema'

/**
 * Types of conflicts that can occur during sync
 * - none: No conflict, server version can be accepted
 * - metadata: Read/starred/archived/importance differ
 * - labels: Label arrays differ
 * - content: Subject or body differs (requires user resolution)
 */
export type ConflictType = 'none' | 'metadata' | 'labels' | 'content'

/**
 * Result of conflict detection
 */
export interface ConflictResult {
  type: ConflictType
  localTimestamp: number
  serverTimestamp: number
  conflictingFields?: string[]
}

/**
 * Email data for conflict comparison
 * Subset of EmailDocument with fields that can conflict
 */
export interface ConflictEmailData {
  id: string
  timestamp: number // Unix timestamp (ms)
  subject: string
  body: {
    html?: string
    text?: string
  }
  read: boolean
  starred: boolean
  importance: 'high' | 'normal' | 'low'
  labels: string[]
  attributes: Record<string, string | number | boolean | null>
  // Track when local changes were made (if available)
  localModifiedAt?: number
}

/**
 * Pending conflict requiring user resolution
 */
export interface PendingConflict {
  id: string // Unique conflict ID
  emailId: string
  accountId: string
  type: ConflictType
  localVersion: ConflictEmailData
  serverVersion: ConflictEmailData
  conflictingFields: string[]
  detectedAt: number
}

/**
 * Conflict Detection Service
 * Compares local and server email versions to detect conflicts
 */
export class ConflictDetectionService {
  /**
   * Detect conflicts between local and server email versions
   *
   * AC1: Conflict detected when local change timestamp > server change timestamp
   * AC2: Conflict detection runs on every sync operation
   *
   * @param localEmail - Local email document from RxDB
   * @param serverEmail - Server email data from API
   * @returns Conflict result with type and details
   */
  detect(localEmail: ConflictEmailData, serverEmail: ConflictEmailData): ConflictResult {
    const conflictingFields: string[] = []

    // If server is newer and no local modifications, no conflict
    // Local data will just be overwritten with server version
    if (!localEmail.localModifiedAt || serverEmail.timestamp >= localEmail.localModifiedAt) {
      return {
        type: 'none',
        localTimestamp: localEmail.timestamp,
        serverTimestamp: serverEmail.timestamp,
      }
    }

    // Local has changes that are newer than server - potential conflict
    // Check what fields are actually different

    // Check content fields (subject, body) - requires user resolution
    const contentConflict = this.detectContentConflict(localEmail, serverEmail)
    if (contentConflict.length > 0) {
      conflictingFields.push(...contentConflict)
      return {
        type: 'content',
        localTimestamp: localEmail.localModifiedAt,
        serverTimestamp: serverEmail.timestamp,
        conflictingFields,
      }
    }

    // Check label conflicts
    const labelConflict = this.detectLabelConflict(localEmail, serverEmail)
    if (labelConflict) {
      conflictingFields.push('labels')
      return {
        type: 'labels',
        localTimestamp: localEmail.localModifiedAt,
        serverTimestamp: serverEmail.timestamp,
        conflictingFields,
      }
    }

    // Check metadata conflicts (read, starred, archived, importance)
    const metadataConflict = this.detectMetadataConflict(localEmail, serverEmail)
    if (metadataConflict.length > 0) {
      conflictingFields.push(...metadataConflict)
      return {
        type: 'metadata',
        localTimestamp: localEmail.localModifiedAt,
        serverTimestamp: serverEmail.timestamp,
        conflictingFields,
      }
    }

    // No differences found
    return {
      type: 'none',
      localTimestamp: localEmail.timestamp,
      serverTimestamp: serverEmail.timestamp,
    }
  }

  /**
   * Detect content conflicts (subject, body)
   * These require user resolution as auto-merge is too risky
   */
  private detectContentConflict(local: ConflictEmailData, server: ConflictEmailData): string[] {
    const conflicts: string[] = []

    if (local.subject !== server.subject) {
      conflicts.push('subject')
    }

    // Compare body content (check both html and text)
    const localBodyHtml = local.body.html || ''
    const serverBodyHtml = server.body.html || ''
    const localBodyText = local.body.text || ''
    const serverBodyText = server.body.text || ''

    if (localBodyHtml !== serverBodyHtml || localBodyText !== serverBodyText) {
      conflicts.push('body')
    }

    return conflicts
  }

  /**
   * Detect label conflicts
   * Labels can be auto-merged using union strategy
   */
  private detectLabelConflict(local: ConflictEmailData, server: ConflictEmailData): boolean {
    const localLabels = new Set(local.labels)
    const serverLabels = new Set(server.labels)

    // Check if sets are different
    if (localLabels.size !== serverLabels.size) {
      return true
    }

    for (const label of localLabels) {
      if (!serverLabels.has(label)) {
        return true
      }
    }

    return false
  }

  /**
   * Detect metadata conflicts (read, starred, importance)
   * These can be auto-resolved using last-write-wins
   */
  private detectMetadataConflict(local: ConflictEmailData, server: ConflictEmailData): string[] {
    const conflicts: string[] = []

    if (local.read !== server.read) {
      conflicts.push('read')
    }

    if (local.starred !== server.starred) {
      conflicts.push('starred')
    }

    if (local.importance !== server.importance) {
      conflicts.push('importance')
    }

    return conflicts
  }

  /**
   * Batch detect conflicts for multiple emails
   * Optimized for sync operations
   *
   * @param pairs - Array of [localEmail, serverEmail] pairs
   * @returns Array of conflict results with email IDs
   */
  detectBatch(
    pairs: Array<{ local: ConflictEmailData; server: ConflictEmailData }>
  ): Array<{ emailId: string; result: ConflictResult }> {
    return pairs.map(({ local, server }) => ({
      emailId: local.id,
      result: this.detect(local, server),
    }))
  }

  /**
   * Convert EmailDocument to ConflictEmailData for comparison
   */
  static toConflictData(email: EmailDocument, localModifiedAt?: number): ConflictEmailData {
    return {
      id: email.id,
      timestamp: email.timestamp,
      subject: email.subject,
      body: {
        html: email.body.html,
        text: email.body.text,
      },
      read: email.read,
      starred: email.starred,
      importance: email.importance,
      labels: [...email.labels],
      attributes: { ...email.attributes },
      localModifiedAt,
    }
  }
}

/**
 * Singleton instance for conflict detection
 */
export const conflictDetectionService = new ConflictDetectionService()
