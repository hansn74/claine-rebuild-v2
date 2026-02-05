/**
 * ShortcutHint Component
 *
 * Story 2.23: Keyboard Shortcut Discoverability
 * Task 2: Create ShortcutHint component for inline hints
 *
 * Displays a keyboard shortcut hint like "(e)" next to action labels.
 * Respects user settings and current scope context.
 */

import { memo } from 'react'
import { useSettingsStore } from '@/store/settingsStore'
import { useActiveScope } from '@/context/ShortcutContext'
import type { ShortcutScope } from '@/types/shortcuts'
import { cn } from '@/utils/cn'

export interface ShortcutHintProps {
  /** The shortcut key to display (e.g., "e", "r", "#") */
  shortcutKey: string
  /** Optional scope(s) where this hint should be visible */
  scopes?: ShortcutScope[]
  /** Additional CSS classes */
  className?: string
}

/**
 * ShortcutHint - Inline keyboard shortcut hint
 *
 * Usage:
 * ```tsx
 * <button>
 *   Archive <ShortcutHint shortcutKey="e" scopes={['inbox', 'reading']} />
 * </button>
 * ```
 */
export const ShortcutHint = memo(function ShortcutHint({
  shortcutKey,
  scopes,
  className,
}: ShortcutHintProps) {
  const showKeyboardHints = useSettingsStore((state) => state.showKeyboardHints)
  const activeScope = useActiveScope()

  // Don't render if hints are disabled
  if (!showKeyboardHints) {
    return null
  }

  // Don't render if scope is specified and doesn't match active scope
  if (scopes && scopes.length > 0 && !scopes.includes(activeScope)) {
    return null
  }

  return (
    <span className={cn('text-slate-400 text-xs font-normal ml-1', className)} aria-hidden="true">
      ({shortcutKey})
    </span>
  )
})
