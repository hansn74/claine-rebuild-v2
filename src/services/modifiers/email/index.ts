/**
 * Email Modifiers
 *
 * Epic 3: Offline-First Modifier Architecture
 * Story 3.2: Email Action Modifiers
 *
 * Exports all email modifier classes and registers them with the factory.
 */

export { BaseEmailModifier, GMAIL_API_BASE, GRAPH_API_BASE } from './BaseEmailModifier'
export { ArchiveModifier, UnarchiveModifier } from './ArchiveModifier'
export { DeleteModifier, UndeleteModifier } from './DeleteModifier'
export { MarkReadModifier, MarkUnreadModifier } from './MarkReadModifier'
export { MoveModifier } from './MoveModifier'
export { StarModifier, UnstarModifier } from './StarModifier'

import { modifierFactory } from '../modifierFactory'
import { ArchiveModifier, UnarchiveModifier } from './ArchiveModifier'
import { DeleteModifier, UndeleteModifier } from './DeleteModifier'
import { MarkReadModifier, MarkUnreadModifier } from './MarkReadModifier'
import { MoveModifier } from './MoveModifier'
import { StarModifier, UnstarModifier } from './StarModifier'
import type { ModifierDocument, ProviderType } from '../types'
import type { EmailDocument } from '@/services/database/schemas/email.schema'
import type { Modifier } from '../types'

/**
 * Register all email modifier classes with the factory
 */
export function registerEmailModifiers(): void {
  // Archive modifiers
  modifierFactory.register(
    'archive',
    ArchiveModifier as new (params: unknown) => Modifier<EmailDocument>
  )
  modifierFactory.register(
    'unarchive',
    UnarchiveModifier as new (params: unknown) => Modifier<EmailDocument>
  )

  // Delete modifiers
  modifierFactory.register(
    'delete',
    DeleteModifier as new (params: unknown) => Modifier<EmailDocument>
  )
  modifierFactory.register(
    'undelete',
    UndeleteModifier as new (params: unknown) => Modifier<EmailDocument>
  )

  // Read status modifiers
  modifierFactory.register(
    'mark-read',
    MarkReadModifier as new (params: unknown) => Modifier<EmailDocument>
  )
  modifierFactory.register(
    'mark-unread',
    MarkUnreadModifier as new (params: unknown) => Modifier<EmailDocument>
  )

  // Move modifier
  modifierFactory.register('move', MoveModifier as new (params: unknown) => Modifier<EmailDocument>)

  // Star modifiers
  modifierFactory.register('star', StarModifier as new (params: unknown) => Modifier<EmailDocument>)
  modifierFactory.register(
    'unstar',
    UnstarModifier as new (params: unknown) => Modifier<EmailDocument>
  )
}

/**
 * Reconstruct an email modifier from a document
 */
export function emailModifierFromDocument(doc: ModifierDocument): Modifier<EmailDocument> {
  const payload = JSON.parse(doc.payload)

  switch (doc.type) {
    case 'archive':
      return ArchiveModifier.fromPayload(
        doc.entityId,
        doc.accountId,
        doc.provider as ProviderType,
        payload,
        doc.id,
        doc.createdAt
      )
    case 'unarchive':
      return UnarchiveModifier.fromPayload(
        doc.entityId,
        doc.accountId,
        doc.provider as ProviderType,
        payload,
        doc.id,
        doc.createdAt
      )
    case 'delete':
      return DeleteModifier.fromPayload(
        doc.entityId,
        doc.accountId,
        doc.provider as ProviderType,
        payload,
        doc.id,
        doc.createdAt
      )
    case 'undelete':
      return UndeleteModifier.fromPayload(
        doc.entityId,
        doc.accountId,
        doc.provider as ProviderType,
        payload,
        doc.id,
        doc.createdAt
      )
    case 'mark-read':
      return MarkReadModifier.fromPayload(
        doc.entityId,
        doc.accountId,
        doc.provider as ProviderType,
        payload,
        doc.id,
        doc.createdAt
      )
    case 'mark-unread':
      return MarkUnreadModifier.fromPayload(
        doc.entityId,
        doc.accountId,
        doc.provider as ProviderType,
        payload,
        doc.id,
        doc.createdAt
      )
    case 'move':
      return MoveModifier.fromPayload(
        doc.entityId,
        doc.accountId,
        doc.provider as ProviderType,
        payload,
        doc.id,
        doc.createdAt
      )
    case 'star':
      return StarModifier.fromPayload(
        doc.entityId,
        doc.accountId,
        doc.provider as ProviderType,
        payload,
        doc.id,
        doc.createdAt
      )
    case 'unstar':
      return UnstarModifier.fromPayload(
        doc.entityId,
        doc.accountId,
        doc.provider as ProviderType,
        payload,
        doc.id,
        doc.createdAt
      )
    default:
      throw new Error(`Unknown email modifier type: ${doc.type}`)
  }
}
