/**
 * Modifier Factory
 *
 * Epic 3: Offline-First Modifier Architecture
 * Story 3.1: Core Modifier Infrastructure
 *
 * Factory for creating modifier instances from types and documents.
 *
 * Usage:
 * ```typescript
 * // Create a new modifier
 * const modifier = modifierFactory.create('archive', {
 *   entityId: 'email-123',
 *   accountId: 'gmail:user@example.com',
 *   provider: 'gmail',
 *   currentLabels: ['INBOX'],
 *   currentFolder: 'inbox'
 * })
 *
 * // Reconstruct from document
 * const modifier = modifierFactory.fromDocument(doc)
 * ```
 */

import { logger } from '@/services/logger'
import type {
  Modifier,
  ModifierDocument,
  ModifierType,
  ArchiveModifierParams,
  DeleteModifierParams,
  MoveModifierParams,
  MarkReadModifierParams,
  StarModifierParams,
  DraftUpdateModifierParams,
  DraftDeleteModifierParams,
} from './types'
import type { EmailDocument } from '@/services/database/schemas/email.schema'
import type { DraftDocument } from '@/services/database/schemas/draft.schema'

// Import modifier classes (will be created in Story 3.2 and 3.3)
// For now, we'll use a placeholder that throws until they're implemented
type ModifierClass<T> = new (params: unknown) => Modifier<T>

/**
 * Registry of modifier classes by type
 */
const modifierRegistry = new Map<ModifierType, ModifierClass<unknown>>()

/**
 * Modifier Factory
 *
 * Creates modifier instances from types, parameters, or documents.
 */
export class ModifierFactory {
  private static instance: ModifierFactory

  private constructor() {}

  /**
   * Get the singleton instance
   */
  static getInstance(): ModifierFactory {
    if (!ModifierFactory.instance) {
      ModifierFactory.instance = new ModifierFactory()
    }
    return ModifierFactory.instance
  }

  /**
   * Register a modifier class for a type
   *
   * @param type - Modifier type
   * @param modifierClass - Class constructor
   */
  register<T>(type: ModifierType, modifierClass: ModifierClass<T>): void {
    modifierRegistry.set(type, modifierClass as ModifierClass<unknown>)
    logger.debug('modifier-factory', 'Registered modifier class', { type })
  }

  /**
   * Create a new modifier instance
   *
   * @param type - Type of modifier to create
   * @param params - Parameters for the modifier
   * @returns Modifier instance
   */
  create(type: 'archive', params: ArchiveModifierParams): Modifier<EmailDocument>
  create(type: 'unarchive', params: ArchiveModifierParams): Modifier<EmailDocument>
  create(type: 'delete', params: DeleteModifierParams): Modifier<EmailDocument>
  create(type: 'undelete', params: DeleteModifierParams): Modifier<EmailDocument>
  create(type: 'move', params: MoveModifierParams): Modifier<EmailDocument>
  create(type: 'mark-read', params: MarkReadModifierParams): Modifier<EmailDocument>
  create(type: 'mark-unread', params: MarkReadModifierParams): Modifier<EmailDocument>
  create(type: 'star', params: StarModifierParams): Modifier<EmailDocument>
  create(type: 'unstar', params: StarModifierParams): Modifier<EmailDocument>
  create(type: 'draft-update', params: DraftUpdateModifierParams): Modifier<DraftDocument>
  create(type: 'draft-delete', params: DraftDeleteModifierParams): Modifier<DraftDocument>
  create(type: ModifierType, params: unknown): Modifier<unknown> {
    const ModifierClass = modifierRegistry.get(type)

    if (!ModifierClass) {
      throw new Error(`No modifier class registered for type: ${type}`)
    }

    return new ModifierClass(params)
  }

  /**
   * Reconstruct a modifier from a persisted document
   *
   * @param doc - Modifier document from database
   * @returns Modifier instance
   */
  fromDocument(doc: ModifierDocument): Modifier<unknown> {
    const ModifierClass = modifierRegistry.get(doc.type)

    if (!ModifierClass) {
      throw new Error(`No modifier class registered for type: ${doc.type}`)
    }

    // Parse the payload and reconstruct
    const payload = JSON.parse(doc.payload)
    const params = {
      ...payload,
      entityId: doc.entityId,
      accountId: doc.accountId,
      provider: doc.provider,
      threadId: doc.threadId,
    }

    const modifier = new ModifierClass(params)

    // Restore state from document
    Object.assign(modifier, {
      id: doc.id,
      status: doc.status,
      attempts: doc.attempts,
      createdAt: doc.createdAt,
      error: doc.error,
    })

    return modifier
  }

  /**
   * Check if a modifier type is registered
   */
  isRegistered(type: ModifierType): boolean {
    return modifierRegistry.has(type)
  }

  /**
   * Get all registered modifier types
   */
  getRegisteredTypes(): ModifierType[] {
    return Array.from(modifierRegistry.keys())
  }

  /**
   * Clear all registered modifiers (for testing)
   */
  clearRegistry(): void {
    modifierRegistry.clear()
  }

  /**
   * Reset singleton instance (for testing)
   * @internal
   */
  static __resetForTesting(): void {
    modifierRegistry.clear()
    ModifierFactory.instance = null as unknown as ModifierFactory
  }
}

/**
 * Singleton instance export
 */
export const modifierFactory = ModifierFactory.getInstance()
