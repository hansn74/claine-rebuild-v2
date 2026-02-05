/**
 * EmailActionButton Component
 *
 * Story 2.6: Email Actions (Archive, Delete, Mark Read/Unread)
 * Task 4.2: Create individual EmailActionButton component
 *
 * Story 2.23: Keyboard Shortcut Discoverability
 * Task 3: Add ShortcutHint support and nudge tracking
 *
 * Individual action button with icon, label, and tooltip.
 * Supports different variants and sizes.
 */

import {
  forwardRef,
  useState,
  type MouseEvent,
  type ReactNode,
  type ButtonHTMLAttributes,
} from 'react'
import { cn } from '@/utils/cn'
import { ShortcutHint } from '@/components/common/ShortcutHint'
import { ShortcutNudgeTooltip } from '@/components/common/ShortcutNudgeTooltip'
import { useShortcutNudge } from '@/hooks/useShortcutNudge'
import type { ShortcutScope } from '@/types/shortcuts'

interface EmailActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Icon to display */
  icon: ReactNode
  /** Text label (optional, shown next to icon) */
  label?: string
  /** Tooltip text */
  tooltip: string
  /** Button variant */
  variant?: 'default' | 'ghost' | 'outline'
  /** Button size */
  size?: 'default' | 'sm' | 'icon'
  /** Whether this is a destructive action (e.g., delete) */
  destructive?: boolean
  /** Whether button is loading */
  loading?: boolean
  /** Keyboard shortcut key to display (e.g., 'e' for archive) */
  shortcutKey?: string
  /** Scopes where the shortcut hint should be visible */
  shortcutScopes?: ShortcutScope[]
  /** Action ID for tracking (e.g., 'archive', 'delete') */
  actionId?: string
}

/**
 * EmailActionButton - Reusable action button for email operations
 *
 * Usage:
 * ```tsx
 * <EmailActionButton
 *   icon={<Archive className="w-4 h-4" />}
 *   label="Archive"
 *   tooltip="Archive email"
 *   shortcutKey="e"
 *   shortcutScopes={['inbox', 'reading']}
 *   actionId="archive"
 *   onClick={handleArchive}
 * />
 * ```
 */
export const EmailActionButton = forwardRef<HTMLButtonElement, EmailActionButtonProps>(
  (
    {
      icon,
      label,
      tooltip,
      variant = 'ghost',
      size = 'sm',
      destructive = false,
      loading = false,
      disabled,
      className,
      shortcutKey,
      shortcutScopes,
      actionId,
      onClick,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading
    const { recordMouseAction, shouldShowNudge, markNudgeShown } = useShortcutNudge()
    // Track if nudge was dismissed during this component's lifetime
    const [nudgeDismissed, setNudgeDismissed] = useState(false)

    // Derive showNudge from shouldShowNudge without useEffect
    const showNudge = !nudgeDismissed && actionId && shortcutKey ? shouldShowNudge(actionId) : false

    // Handle click with mouse action tracking
    const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
      if (actionId) {
        recordMouseAction(actionId)
      }
      onClick?.(e)
    }

    // Handle nudge dismiss
    const handleNudgeDismiss = () => {
      if (actionId) {
        markNudgeShown(actionId)
      }
      setNudgeDismissed(true)
    }

    // Base classes
    const baseClasses =
      'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50'

    // Variant classes
    const variantClasses = {
      default: destructive
        ? 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500'
        : 'bg-slate-900 text-white hover:bg-slate-800 focus-visible:ring-gray-500',
      ghost: destructive
        ? 'text-slate-600 hover:text-red-600 hover:bg-red-50 focus-visible:ring-red-500'
        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus-visible:ring-gray-500',
      outline: destructive
        ? 'border border-red-300 text-red-600 hover:bg-red-50 focus-visible:ring-red-500'
        : 'border border-slate-300 text-slate-700 hover:bg-slate-50 focus-visible:ring-gray-500',
    }

    // Size classes
    const sizeClasses = {
      default: 'h-9 px-4 py-2 text-sm',
      sm: 'h-8 px-3 py-1.5 text-xs',
      icon: 'h-8 w-8 p-0',
    }

    // Build tooltip with shortcut hint
    const tooltipWithShortcut = shortcutKey ? `${tooltip} (${shortcutKey})` : tooltip

    return (
      <div className="relative inline-block">
        <button
          ref={ref}
          type="button"
          disabled={isDisabled}
          title={tooltipWithShortcut}
          aria-label={label || tooltip}
          className={cn(baseClasses, variantClasses[variant], sizeClasses[size], className)}
          onClick={handleClick}
          {...props}
        >
          {loading ? (
            <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
          ) : (
            <>
              {icon}
              {label && size !== 'icon' && (
                <>
                  <span>{label}</span>
                  {shortcutKey && (
                    <ShortcutHint shortcutKey={shortcutKey} scopes={shortcutScopes} />
                  )}
                </>
              )}
            </>
          )}
        </button>
        {showNudge && shortcutKey && (
          <ShortcutNudgeTooltip
            actionName={label || tooltip}
            shortcutKey={shortcutKey}
            onDismiss={handleNudgeDismiss}
          />
        )}
      </div>
    )
  }
)

EmailActionButton.displayName = 'EmailActionButton'
