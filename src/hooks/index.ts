/**
 * Hooks barrel export
 *
 * Central export point for all custom React hooks.
 */

export { useThread } from './useThread'
export type { UseThreadResult } from './useThread'

export { useNetworkStatus, useIsOnline } from './useNetworkStatus'
export type { NetworkStatus, UseNetworkStatusOptions } from './useNetworkStatus'

export { useSendQueue } from './useSendQueue'
export type { UseSendQueueResult, SendEmailData, SendResult } from './useSendQueue'

export { useQueueProcessor, QueueProcessorProvider } from './useQueueProcessor'
export type { QueueProcessorConfig } from './useQueueProcessor'

export { useSearch } from './useSearch'
export type { UseSearchResult, UseSearchOptions } from './useSearch'

export { useEmailSelection } from './useEmailSelection'
export type { UseEmailSelectionReturn } from './useEmailSelection'

export {
  useEmailKeyboardShortcuts,
  getEmailShortcutsForHelp,
  EMAIL_SHORTCUTS,
} from './useEmailKeyboardShortcuts'

export { useUndoAction } from './useUndoAction'
export type { UseUndoActionReturn } from './useUndoAction'

// Story 2.11: Keyboard Shortcuts
export {
  useEmailShortcut,
  useNavigationShortcuts,
  useActionShortcuts,
  useFolderNavigationShortcuts,
} from './useEmailShortcut'
export type {
  UseEmailShortcutOptions,
  UseNavigationShortcutOptions,
  UseActionShortcutOptions,
  UseFolderNavigationOptions,
} from './useEmailShortcut'

// Story 2.13: Custom Attributes
export { useAttributes } from './useAttributes'
export type { UseAttributesReturn } from './useAttributes'

// Epic 3: Offline-First Modifier Architecture
export {
  useDerivedEmailState,
  useDerivedEmailStates,
  useHasPendingModifiers,
} from './useDerivedEmailState'

export {
  useDerivedDraftState,
  useDerivedDraftStates,
  useHasPendingDraftModifiers,
  useIsDraftSyncing,
} from './useDerivedDraftState'

export { useModifierActions, useBulkModifierActions } from './useModifierActions'
export type { ActionResult } from './useModifierActions'

// Story 3.1: AI Model Loading
export { useModelLoader } from './useModelLoader'
export type { UseModelLoaderReturn } from './useModelLoader'

// Story 3.2b: AI Initialization
export { useInitializeAI } from './useInitializeAI'
export type { UseInitializeAIReturn } from './useInitializeAI'

// Story 3.3: Priority Scoring
export { usePriorityScoring } from './usePriorityScoring'
export type { UsePriorityScoringOptions } from './usePriorityScoring'
