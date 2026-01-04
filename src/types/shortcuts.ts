/**
 * Keyboard Shortcuts Types
 *
 * Story 2.11: Keyboard Shortcuts & Power User Features
 * Task 1.3: Create TypeScript types for scopes and configs
 *
 * Type definitions for the keyboard shortcut system.
 */

/**
 * Shortcut scope - determines when shortcuts are active
 * Priority order (highest to lowest): compose > reading > search > inbox > global
 */
export type ShortcutScope = 'global' | 'inbox' | 'reading' | 'compose' | 'search'

/**
 * Shortcut category for grouping in the help overlay
 */
export type ShortcutCategory =
  | 'navigation'
  | 'actions'
  | 'composition'
  | 'search'
  | 'general'
  | 'vim'

/**
 * Modifier keys that can be combined with shortcuts
 */
export type ModifierKey = 'ctrl' | 'meta' | 'alt' | 'shift'

/**
 * Single shortcut definition
 */
export interface ShortcutDefinition {
  /** Unique identifier for the shortcut */
  id: string
  /** Human-readable description */
  description: string
  /** The key combination (e.g., 'j', 'ctrl+k', 'shift+3') */
  keys: string
  /** Display string for UI (e.g., '⌘K', '#') */
  displayKeys: string
  /** Scope(s) where this shortcut is active */
  scopes: ShortcutScope[]
  /** Category for grouping in help overlay */
  category: ShortcutCategory
  /** Whether this shortcut is enabled in form fields */
  enableOnFormTags?: boolean
  /** Whether this shortcut requires Vim mode to be enabled */
  requiresVimMode?: boolean
}

/**
 * Shortcut action handler
 */
export type ShortcutHandler = () => void | Promise<void>

/**
 * Registered shortcut with its handler
 */
export interface RegisteredShortcut extends ShortcutDefinition {
  /** Handler function to execute when shortcut is triggered */
  handler: ShortcutHandler
  /** Whether the shortcut is currently enabled */
  enabled: boolean
}

/**
 * Shortcut context state
 */
export interface ShortcutContextState {
  /** Current active scope */
  activeScope: ShortcutScope
  /** All registered shortcuts */
  shortcuts: Map<string, RegisteredShortcut>
  /** Whether Vim mode is enabled */
  vimModeEnabled: boolean
  /** Whether shortcuts are globally enabled */
  enabled: boolean
}

/**
 * Shortcut context actions
 */
export interface ShortcutContextActions {
  /** Set the active scope */
  setActiveScope: (scope: ShortcutScope) => void
  /** Register a shortcut */
  registerShortcut: (shortcut: RegisteredShortcut) => void
  /** Unregister a shortcut by ID */
  unregisterShortcut: (id: string) => void
  /** Enable or disable Vim mode */
  setVimMode: (enabled: boolean) => void
  /** Enable or disable all shortcuts */
  setEnabled: (enabled: boolean) => void
  /** Get shortcuts for a specific scope */
  getShortcutsForScope: (scope: ShortcutScope) => RegisteredShortcut[]
  /** Get shortcuts by category */
  getShortcutsByCategory: (category: ShortcutCategory) => RegisteredShortcut[]
  /** Get all shortcuts for help display */
  getAllShortcuts: () => RegisteredShortcut[]
}

/**
 * Full shortcut context value
 */
export type ShortcutContextValue = ShortcutContextState & ShortcutContextActions

/**
 * Options for the useEmailShortcut hook
 */
export interface UseEmailShortcutOptions {
  /** Key combination to bind */
  keys: string
  /** Handler to execute */
  handler: ShortcutHandler
  /** Scope(s) where this shortcut should be active */
  scopes?: ShortcutScope[]
  /** Whether to enable on form tags (inputs, textareas) */
  enableOnFormTags?: boolean
  /** Whether to prevent default browser behavior */
  preventDefault?: boolean
  /** Whether to stop event propagation */
  stopPropagation?: boolean
  /** Whether the shortcut is enabled */
  enabled?: boolean
  /** Description for help display */
  description?: string
}

/**
 * User preference for shortcut settings
 */
export interface ShortcutPreferences {
  /** Whether Vim mode is enabled */
  vimModeEnabled: boolean
  /** Custom key bindings (shortcutId -> keys) */
  customBindings: Record<string, string>
}

/**
 * Scope priority map - higher number = higher priority
 */
export const SCOPE_PRIORITY: Record<ShortcutScope, number> = {
  global: 1,
  inbox: 2,
  search: 3,
  reading: 4,
  compose: 5,
}

/**
 * Default shortcut definitions
 */
export const DEFAULT_SHORTCUTS: ShortcutDefinition[] = [
  // Navigation shortcuts (AC 2)
  {
    id: 'nav-down',
    description: 'Move to next email',
    keys: 'j',
    displayKeys: 'j',
    scopes: ['inbox', 'reading'],
    category: 'navigation',
  },
  {
    id: 'nav-up',
    description: 'Move to previous email',
    keys: 'k',
    displayKeys: 'k',
    scopes: ['inbox', 'reading'],
    category: 'navigation',
  },
  {
    id: 'nav-open',
    description: 'Open selected email',
    keys: 'enter',
    displayKeys: 'Enter',
    scopes: ['inbox'],
    category: 'navigation',
  },
  {
    id: 'nav-back',
    description: 'Go back / Close',
    keys: 'escape',
    displayKeys: 'Esc',
    scopes: ['global'],
    category: 'navigation',
  },
  {
    id: 'nav-inbox',
    description: 'Go to Inbox',
    keys: 'g i',
    displayKeys: 'g i',
    scopes: ['global'],
    category: 'navigation',
  },
  {
    id: 'nav-sent',
    description: 'Go to Sent',
    keys: 'g t',
    displayKeys: 'g t',
    scopes: ['global'],
    category: 'navigation',
  },
  {
    id: 'nav-drafts',
    description: 'Go to Drafts',
    keys: 'g d',
    displayKeys: 'g d',
    scopes: ['global'],
    category: 'navigation',
  },
  {
    id: 'nav-starred',
    description: 'Go to Starred',
    keys: 'g s',
    displayKeys: 'g s',
    scopes: ['global'],
    category: 'navigation',
  },

  // Action shortcuts (AC 3)
  {
    id: 'action-archive',
    description: 'Archive',
    keys: 'e',
    displayKeys: 'e',
    scopes: ['inbox', 'reading'],
    category: 'actions',
  },
  {
    id: 'action-delete',
    description: 'Delete',
    keys: 'shift+3',
    displayKeys: '#',
    scopes: ['inbox', 'reading'],
    category: 'actions',
  },
  {
    id: 'action-reply',
    description: 'Reply',
    keys: 'r',
    displayKeys: 'r',
    scopes: ['reading'],
    category: 'actions',
  },
  {
    id: 'action-reply-all',
    description: 'Reply all',
    keys: 'a',
    displayKeys: 'a',
    scopes: ['reading'],
    category: 'actions',
  },
  {
    id: 'action-forward',
    description: 'Forward',
    keys: 'f',
    displayKeys: 'f',
    scopes: ['reading'],
    category: 'actions',
  },
  {
    id: 'action-star',
    description: 'Star / Unstar',
    keys: 's',
    displayKeys: 's',
    scopes: ['inbox', 'reading'],
    category: 'actions',
  },
  {
    id: 'action-select',
    description: 'Select email',
    keys: 'x',
    displayKeys: 'x',
    scopes: ['inbox'],
    category: 'actions',
  },
  {
    id: 'action-mark-read',
    description: 'Mark as read',
    keys: 'shift+i',
    displayKeys: 'I',
    scopes: ['inbox', 'reading'],
    category: 'actions',
  },
  {
    id: 'action-mark-unread',
    description: 'Mark as unread',
    keys: 'shift+u',
    displayKeys: 'U',
    scopes: ['inbox', 'reading'],
    category: 'actions',
  },

  // Composition shortcuts
  {
    id: 'compose-new',
    description: 'Compose new email',
    keys: 'c',
    displayKeys: 'c',
    scopes: ['global', 'inbox', 'reading'],
    category: 'composition',
  },
  {
    id: 'compose-send',
    description: 'Send email',
    keys: 'meta+enter',
    displayKeys: '⌘ Enter',
    scopes: ['compose'],
    category: 'composition',
    enableOnFormTags: true,
  },
  {
    id: 'compose-discard',
    description: 'Discard draft',
    keys: 'meta+shift+d',
    displayKeys: '⌘ ⇧ D',
    scopes: ['compose'],
    category: 'composition',
    enableOnFormTags: true,
  },

  // Search shortcuts (AC 6)
  {
    id: 'search-focus',
    description: 'Focus search',
    keys: '/',
    displayKeys: '/',
    scopes: ['global', 'inbox', 'reading'],
    category: 'search',
  },
  {
    id: 'search-command-palette',
    description: 'Open command palette',
    keys: 'meta+k',
    displayKeys: '⌘ K',
    scopes: ['global'],
    category: 'search',
    enableOnFormTags: true,
  },
  {
    id: 'search-in-email',
    description: 'Search in email',
    keys: 'meta+f',
    displayKeys: '⌘ F',
    scopes: ['reading'],
    category: 'search',
  },

  // General shortcuts (AC 1)
  {
    id: 'help-overlay',
    description: 'Show keyboard shortcuts',
    keys: 'shift+/',
    displayKeys: '?',
    scopes: ['global'],
    category: 'general',
  },

  // Vim mode shortcuts (AC 5)
  {
    id: 'vim-top',
    description: 'Go to top of list',
    keys: 'g g',
    displayKeys: 'gg',
    scopes: ['inbox'],
    category: 'vim',
    requiresVimMode: true,
  },
  {
    id: 'vim-bottom',
    description: 'Go to bottom of list',
    keys: 'shift+g',
    displayKeys: 'G',
    scopes: ['inbox'],
    category: 'vim',
    requiresVimMode: true,
  },
  {
    id: 'vim-collapse',
    description: 'Collapse thread',
    keys: 'h',
    displayKeys: 'h',
    scopes: ['reading'],
    category: 'vim',
    requiresVimMode: true,
  },
  {
    id: 'vim-expand',
    description: 'Expand thread',
    keys: 'l',
    displayKeys: 'l',
    scopes: ['reading'],
    category: 'vim',
    requiresVimMode: true,
  },
]
