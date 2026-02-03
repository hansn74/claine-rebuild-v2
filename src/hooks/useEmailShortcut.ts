/**
 * useEmailShortcut Hook
 *
 * Story 2.11: Keyboard Shortcuts & Power User Features
 * Task 1.4: Create custom hook wrapping react-hotkeys-hook
 *
 * Scope-aware keyboard shortcut hook that integrates with
 * the ShortcutContext for centralized shortcut management.
 */

import { useCallback, useEffect, useRef } from 'react'
import { useHotkeys, type Options as HotkeysOptions } from 'react-hotkeys-hook'
import { useShortcuts } from '@/context/ShortcutContext'
import type { ShortcutScope, UseEmailShortcutOptions } from '@/types/shortcuts'
import { logger } from '@/services/logger'

/**
 * Default options for shortcuts
 */
const DEFAULT_OPTIONS: Partial<UseEmailShortcutOptions> = {
  scopes: ['global'],
  enableOnFormTags: false,
  preventDefault: true,
  enabled: true,
}

/**
 * useEmailShortcut - Scope-aware keyboard shortcut hook
 *
 * Wraps react-hotkeys-hook with scope awareness and integrates
 * with the ShortcutContext for centralized management.
 *
 * Task 2.5: enableOnFormTags: false to prevent shortcuts in input fields
 *
 * @param options - Shortcut configuration options
 *
 * Usage:
 * ```tsx
 * function EmailView() {
 *   useEmailShortcut({
 *     keys: 'j',
 *     handler: () => moveToNextEmail(),
 *     scopes: ['inbox'],
 *     description: 'Move to next email',
 *   })
 * }
 * ```
 */
export function useEmailShortcut(options: UseEmailShortcutOptions): void {
  const {
    keys,
    handler,
    scopes = DEFAULT_OPTIONS.scopes,
    enableOnFormTags = DEFAULT_OPTIONS.enableOnFormTags,
    preventDefault = DEFAULT_OPTIONS.preventDefault,
    enabled = DEFAULT_OPTIONS.enabled,
    description,
  } = options

  const { activeScope, enabled: globalEnabled } = useShortcuts()

  // Track if this shortcut should be active based on scope
  const isActiveInCurrentScope = scopes?.includes(activeScope) ?? false

  // Create stable handler reference
  const handlerRef = useRef(handler)
  useEffect(() => {
    handlerRef.current = handler
  }, [handler])

  /**
   * Determine if the shortcut should be enabled
   * Task 2.4: Conflict resolution - check scope priority
   */
  const shouldBeEnabled = useCallback(() => {
    // Check global enabled state
    if (!globalEnabled) return false

    // Check local enabled state
    if (!enabled) return false

    // Check if active in current scope
    if (!isActiveInCurrentScope) return false

    return true
  }, [globalEnabled, enabled, isActiveInCurrentScope])

  /**
   * Wrapped handler that checks scope before executing
   */
  const wrappedHandler = useCallback(
    (_event: KeyboardEvent) => {
      if (!shouldBeEnabled()) return

      // Log shortcut trigger in debug mode
      if (import.meta.env.DEV) {
        logger.debug('shortcuts', 'Shortcut triggered', {
          keys,
          scope: activeScope,
          description,
        })
      }

      // Execute the handler
      try {
        handlerRef.current()
      } catch (error) {
        logger.error('shortcuts', 'Shortcut handler error', {
          keys,
          error: error instanceof Error ? error.message : String(error),
        })
      }
    },
    [shouldBeEnabled, keys, activeScope, description]
  )

  // Configure react-hotkeys-hook options
  const isEnabled = shouldBeEnabled()
  const hotkeysOptions: HotkeysOptions = {
    enabled: isEnabled,
    preventDefault,
    enableOnFormTags: enableOnFormTags ? ['INPUT', 'TEXTAREA', 'SELECT'] : false,
    // Don't enable on contentEditable unless explicitly allowed
    enableOnContentEditable: enableOnFormTags,
  }

  // Register with react-hotkeys-hook
  useHotkeys(keys, wrappedHandler, hotkeysOptions, [wrappedHandler, isEnabled])
}

/**
 * Options for useNavigationShortcut
 */
interface UseNavigationShortcutOptions {
  /** Handler for moving down (j key) */
  onMoveDown?: () => void
  /** Handler for moving up (k key) */
  onMoveUp?: () => void
  /** Handler for opening/selecting (Enter key) */
  onSelect?: () => void
  /** Handler for going back (Escape key) */
  onBack?: () => void
  /** Handler for going to top (gg in Vim mode) */
  onGoToTop?: () => void
  /** Handler for going to bottom (G in Vim mode) */
  onGoToBottom?: () => void
  /** Whether shortcuts are enabled */
  enabled?: boolean
  /** Scopes where these shortcuts are active */
  scopes?: ShortcutScope[]
}

/**
 * useNavigationShortcuts - Convenience hook for navigation shortcuts
 *
 * Task 3: Implement Navigation Shortcuts
 *
 * @param options - Navigation handlers and configuration
 */
export function useNavigationShortcuts(options: UseNavigationShortcutOptions): void {
  const {
    onMoveDown,
    onMoveUp,
    onSelect,
    onBack,
    onGoToTop,
    onGoToBottom,
    enabled = true,
    scopes = ['inbox', 'reading'],
  } = options

  const { vimModeEnabled } = useShortcuts()

  // j - Move down
  useEmailShortcut({
    keys: 'j',
    handler: () => onMoveDown?.(),
    scopes,
    enabled: enabled && !!onMoveDown,
    description: 'Move to next email',
  })

  // k - Move up
  useEmailShortcut({
    keys: 'k',
    handler: () => onMoveUp?.(),
    scopes,
    enabled: enabled && !!onMoveUp,
    description: 'Move to previous email',
  })

  // Enter - Select/Open
  useEmailShortcut({
    keys: 'enter',
    handler: () => onSelect?.(),
    scopes: ['inbox'],
    enabled: enabled && !!onSelect,
    description: 'Open selected email',
  })

  // Escape - Go back
  useEmailShortcut({
    keys: 'escape',
    handler: () => onBack?.(),
    scopes: ['global'],
    enabled: enabled && !!onBack,
    description: 'Go back / Close',
  })

  // Vim mode: gg - Go to top
  // Note: Sequence shortcuts like 'gg' need custom handling
  // For now, use shift+g for go to top (alternative binding)
  useEmailShortcut({
    keys: 'home',
    handler: () => onGoToTop?.(),
    scopes: ['inbox'],
    enabled: enabled && !!onGoToTop,
    description: 'Go to top of list',
  })

  // Vim mode: G - Go to bottom
  useEmailShortcut({
    keys: 'shift+g',
    handler: () => onGoToBottom?.(),
    scopes: ['inbox'],
    enabled: enabled && vimModeEnabled && !!onGoToBottom,
    description: 'Go to bottom of list',
  })
}

/**
 * Options for useActionShortcuts
 */
interface UseActionShortcutOptions {
  /** Handler for archive (e key) */
  onArchive?: () => void
  /** Handler for delete (# key) */
  onDelete?: () => void
  /** Handler for reply (r key) */
  onReply?: () => void
  /** Handler for reply all (a key) */
  onReplyAll?: () => void
  /** Handler for forward (f key) */
  onForward?: () => void
  /** Handler for star/unstar (s key) */
  onStar?: () => void
  /** Handler for select (x key) */
  onSelect?: () => void
  /** Handler for toggle read/unread (u key) */
  onToggleRead?: () => void
  /** Handler for mark read (Shift+I) */
  onMarkRead?: () => void
  /** Handler for mark unread (Shift+U) */
  onMarkUnread?: () => void
  /** Whether shortcuts are enabled */
  enabled?: boolean
  /** Scopes where these shortcuts are active */
  scopes?: ShortcutScope[]
}

/**
 * useActionShortcuts - Convenience hook for email action shortcuts
 *
 * Task 4: Implement Action Shortcuts
 *
 * @param options - Action handlers and configuration
 */
export function useActionShortcuts(options: UseActionShortcutOptions): void {
  const {
    onArchive,
    onDelete,
    onReply,
    onReplyAll,
    onForward,
    onStar,
    onSelect,
    onToggleRead,
    onMarkRead,
    onMarkUnread,
    enabled = true,
    scopes = ['inbox', 'reading'],
  } = options

  // e - Archive
  useEmailShortcut({
    keys: 'e',
    handler: () => onArchive?.(),
    scopes,
    enabled: enabled && !!onArchive,
    description: 'Archive email',
  })

  // # (Shift+3) - Delete
  useEmailShortcut({
    keys: 'shift+3',
    handler: () => onDelete?.(),
    scopes,
    enabled: enabled && !!onDelete,
    description: 'Delete email',
  })

  // r - Reply
  useEmailShortcut({
    keys: 'r',
    handler: () => onReply?.(),
    scopes: ['inbox', 'reading'],
    enabled: enabled && !!onReply,
    description: 'Reply to email',
  })

  // a - Reply All
  useEmailShortcut({
    keys: 'a',
    handler: () => onReplyAll?.(),
    scopes: ['inbox', 'reading'],
    enabled: enabled && !!onReplyAll,
    description: 'Reply all',
  })

  // f - Forward
  useEmailShortcut({
    keys: 'f',
    handler: () => onForward?.(),
    scopes: ['inbox', 'reading'],
    enabled: enabled && !!onForward,
    description: 'Forward email',
  })

  // s - Star/Unstar
  useEmailShortcut({
    keys: 's',
    handler: () => onStar?.(),
    scopes: ['inbox', 'reading'],
    enabled: enabled && !!onStar,
    description: 'Star/Unstar email',
  })

  // x - Select
  useEmailShortcut({
    keys: 'x',
    handler: () => onSelect?.(),
    scopes: ['inbox'],
    enabled: enabled && !!onSelect,
    description: 'Select email',
  })

  // u - Toggle read/unread
  useEmailShortcut({
    keys: 'u',
    handler: () => onToggleRead?.(),
    scopes,
    enabled: enabled && !!onToggleRead,
    description: 'Toggle read/unread',
  })

  // Shift+I - Mark as read
  useEmailShortcut({
    keys: 'shift+i',
    handler: () => onMarkRead?.(),
    scopes,
    enabled: enabled && !!onMarkRead,
    description: 'Mark as read',
  })

  // Shift+U - Mark as unread
  useEmailShortcut({
    keys: 'shift+u',
    handler: () => onMarkUnread?.(),
    scopes,
    enabled: enabled && !!onMarkUnread,
    description: 'Mark as unread',
  })
}

/**
 * Options for folder navigation shortcuts
 */
interface UseFolderNavigationOptions {
  /** Handler for navigating to a folder */
  onNavigateToFolder?: (folder: string) => void
  /** Whether shortcuts are enabled */
  enabled?: boolean
}

/**
 * useFolderNavigationShortcuts - Gmail-style folder navigation
 *
 * Task 3.5: g+i, g+s, g+t, g+d for folder navigation
 *
 * Uses a state machine approach since react-hotkeys-hook doesn't
 * support key sequences natively. Press 'g' to enter navigation mode,
 * then press i/s/t/d within 1 second.
 *
 * @param options - Navigation handlers
 */
export function useFolderNavigationShortcuts(options: UseFolderNavigationOptions): void {
  const { onNavigateToFolder, enabled = true } = options
  const { activeScope, enabled: globalEnabled } = useShortcuts()

  // State for tracking 'g' prefix
  const gPrefixActiveRef = useRef(false)
  const gPrefixTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Check if shortcuts should be active
  const isActive = enabled && globalEnabled && ['global', 'inbox', 'reading'].includes(activeScope)

  // Handle 'g' key to enter navigation mode
  useEffect(() => {
    if (!isActive || !onNavigateToFolder) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger in form fields
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }

      const key = e.key.toLowerCase()

      // 'g' starts navigation mode
      if (key === 'g' && !gPrefixActiveRef.current) {
        gPrefixActiveRef.current = true
        // Clear any existing timeout
        if (gPrefixTimeoutRef.current) {
          clearTimeout(gPrefixTimeoutRef.current)
        }
        // Reset after 1 second
        gPrefixTimeoutRef.current = setTimeout(() => {
          gPrefixActiveRef.current = false
        }, 1000)
        e.preventDefault()
        return
      }

      // If 'g' was pressed, check for second key
      if (gPrefixActiveRef.current) {
        gPrefixActiveRef.current = false
        if (gPrefixTimeoutRef.current) {
          clearTimeout(gPrefixTimeoutRef.current)
        }

        switch (key) {
          case 'i':
            e.preventDefault()
            onNavigateToFolder('inbox')
            logger.info('shortcuts', 'Folder navigation: g+i -> inbox')
            break
          case 's':
            e.preventDefault()
            onNavigateToFolder('starred')
            logger.info('shortcuts', 'Folder navigation: g+s -> starred')
            break
          case 't':
            e.preventDefault()
            onNavigateToFolder('sent')
            logger.info('shortcuts', 'Folder navigation: g+t -> sent')
            break
          case 'd':
            e.preventDefault()
            onNavigateToFolder('drafts')
            logger.info('shortcuts', 'Folder navigation: g+d -> drafts')
            break
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      if (gPrefixTimeoutRef.current) {
        clearTimeout(gPrefixTimeoutRef.current)
      }
    }
  }, [isActive, onNavigateToFolder, activeScope, globalEnabled])
}

export type {
  UseEmailShortcutOptions,
  UseNavigationShortcutOptions,
  UseActionShortcutOptions,
  UseFolderNavigationOptions,
}
