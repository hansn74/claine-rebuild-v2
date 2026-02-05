/**
 * Modifier System - Public API
 *
 * Epic 3: Offline-First Modifier Architecture
 *
 * This module provides the Superhuman-style modifier pattern for
 * reliable offline-first email operations.
 *
 * Usage:
 * ```typescript
 * import { modifierQueue, modifierProcessor, modifierFactory } from '@/services/modifiers'
 *
 * // Initialize on app startup
 * await modifierProcessor.initialize()
 *
 * // Create and queue a modifier
 * const modifier = modifierFactory.create('archive', {
 *   entityId: 'email-123',
 *   accountId: 'gmail:user@example.com',
 *   provider: 'gmail',
 *   currentLabels: ['INBOX'],
 *   currentFolder: 'inbox'
 * })
 * await modifierQueue.add(modifier)
 *
 * // Get pending modifiers for an entity (for state derivation)
 * const modifiers = modifierQueue.getModifiersForEntity('email-123')
 *
 * // Remove a modifier (undo)
 * await modifierQueue.remove(modifier.id)
 * ```
 */

// Core types
export type {
  Modifier,
  EmailModifier,
  DraftModifier,
  ModifierDocument,
  ModifierType,
  EmailModifierType,
  DraftModifierType,
  EntityType,
  ProviderType,
  ModifierStatus,
  ModifierQueueEvent,
  BaseModifierParams,
  ArchiveModifierParams,
  DeleteModifierParams,
  MoveModifierParams,
  MarkReadModifierParams,
  StarModifierParams,
  DraftUpdateModifierParams,
  DraftDeleteModifierParams,
  ModifierParams,
} from './types'

export {
  RETRY_DELAYS,
  MAX_ATTEMPTS,
  PARALLEL_ACTION_CONCURRENCY,
  generateModifierId,
} from './types'

// Queue service
export { ModifierQueue, modifierQueue } from './modifierQueue'

// Processor service
export { ModifierProcessor, modifierProcessor } from './modifierProcessor'
export type { ProcessorEvent } from './modifierProcessor'

// Factory
export { ModifierFactory, modifierFactory } from './modifierFactory'

// Email modifiers
export {
  BaseEmailModifier,
  ArchiveModifier,
  UnarchiveModifier,
  DeleteModifier,
  UndeleteModifier,
  MarkReadModifier,
  MarkUnreadModifier,
  MoveModifier,
  StarModifier,
  UnstarModifier,
  registerEmailModifiers,
  emailModifierFromDocument,
} from './email'

// Draft modifiers
export {
  BaseDraftModifier,
  DraftUpdateModifier,
  DraftDeleteModifier,
  registerDraftModifiers,
  draftModifierFromDocument,
} from './draft'

/**
 * Initialize the modifier system
 * Call this on app startup after database is initialized
 */
export async function initModifierSystem(): Promise<void> {
  // Register all modifier classes
  const { registerEmailModifiers } = await import('./email')
  const { registerDraftModifiers } = await import('./draft')

  registerEmailModifiers()
  registerDraftModifiers()

  // Initialize processor (which initializes queue)
  const { modifierProcessor } = await import('./modifierProcessor')
  await modifierProcessor.initialize()

  // Story 2.19 Task 7.2: Expose test state on window in dev mode
  if (import.meta.env.DEV) {
    ;(window as Record<string, unknown>).__TEST_MODIFIER_PROCESSOR__ =
      modifierProcessor.__getTestState()
    // Update on each processing event
    modifierProcessor.getEvents$().subscribe(() => {
      ;(window as Record<string, unknown>).__TEST_MODIFIER_PROCESSOR__ =
        modifierProcessor.__getTestState()
    })
  }
}
