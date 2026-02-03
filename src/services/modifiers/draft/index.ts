/**
 * Draft Modifiers
 *
 * Epic 3: Offline-First Modifier Architecture
 * Story 3.3: Draft Modifiers
 *
 * Exports all draft modifier classes and registers them with the factory.
 */

export { BaseDraftModifier, GMAIL_API_BASE, GRAPH_API_BASE } from './BaseDraftModifier'
export { DraftUpdateModifier } from './DraftUpdateModifier'
export { DraftDeleteModifier } from './DraftDeleteModifier'

import { modifierFactory } from '../modifierFactory'
import { DraftUpdateModifier } from './DraftUpdateModifier'
import { DraftDeleteModifier } from './DraftDeleteModifier'
import type { ModifierDocument, ProviderType, Modifier } from '../types'
import type { DraftDocument } from '@/services/database/schemas/draft.schema'

/**
 * Register all draft modifier classes with the factory
 */
export function registerDraftModifiers(): void {
  modifierFactory.register(
    'draft-update',
    DraftUpdateModifier as new (params: unknown) => Modifier<DraftDocument>
  )
  modifierFactory.register(
    'draft-delete',
    DraftDeleteModifier as new (params: unknown) => Modifier<DraftDocument>
  )
}

/**
 * Reconstruct a draft modifier from a document
 */
export function draftModifierFromDocument(doc: ModifierDocument): Modifier<DraftDocument> {
  const payload = JSON.parse(doc.payload)

  switch (doc.type) {
    case 'draft-update':
      return DraftUpdateModifier.fromPayload(
        doc.entityId,
        doc.accountId,
        doc.provider as ProviderType,
        payload,
        doc.id,
        doc.createdAt
      )
    case 'draft-delete':
      return DraftDeleteModifier.fromPayload(
        doc.entityId,
        doc.accountId,
        doc.provider as ProviderType,
        payload,
        doc.id,
        doc.createdAt
      )
    default:
      throw new Error(`Unknown draft modifier type: ${doc.type}`)
  }
}
