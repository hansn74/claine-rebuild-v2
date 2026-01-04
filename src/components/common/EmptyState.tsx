/**
 * EmptyState Base Component
 *
 * Story 2.12: Empty States & Onboarding UX
 * Task 1.1: Create base component with icon, title, description, action slots
 *
 * A composable empty state component for displaying messages when
 * content is unavailable or a view is empty.
 *
 * Usage:
 *   <EmptyState
 *     icon={<Inbox className="w-12 h-12" />}
 *     title="You're all caught up!"
 *     description="No unread emails"
 *   />
 */

import { type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@shared/utils/cn'

export interface EmptyStateProps {
  /** Icon component or element to display */
  icon?: ReactNode | LucideIcon
  /** Main title text */
  title: string
  /** Optional description text */
  description?: string
  /** Optional action element (button, link, etc.) */
  action?: ReactNode
  /** Additional CSS classes */
  className?: string
  /** Icon container className */
  iconClassName?: string
  /** Whether to use compact styling */
  compact?: boolean
  /** ARIA role override (defaults to 'status') */
  role?: 'status' | 'alert' | 'presentation'
  /** Test ID for testing */
  testId?: string
}

/**
 * Type guard to check if icon is a Lucide icon component
 * Lucide icons are ForwardRefExoticComponent with $$typeof Symbol
 */
function isLucideIcon(icon: unknown): icon is LucideIcon {
  return icon !== null && typeof icon === 'object' && '$$typeof' in icon && 'render' in icon
}

/**
 * Renders an icon, handling both LucideIcon components and ReactNode elements
 */
function renderIcon(icon: ReactNode | LucideIcon, iconClassName?: string): ReactNode {
  // Check if it's a Lucide icon component (ForwardRef component)
  if (isLucideIcon(icon)) {
    const IconComponent = icon
    return <IconComponent className={cn('text-slate-400', iconClassName)} aria-hidden="true" />
  }

  // Otherwise treat as ReactNode
  return icon
}

/**
 * EmptyState - Base empty state component
 *
 * Features:
 * - Flexible composition with icon, title, description, and action slots
 * - Accessible with proper ARIA attributes
 * - Responsive and compact variants
 * - Consistent styling following design system
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  iconClassName,
  compact = false,
  role = 'status',
  testId,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'py-8 px-4' : 'py-16 px-6',
        className
      )}
      role={role}
      aria-live={role === 'status' ? 'polite' : undefined}
      data-testid={testId}
    >
      {icon && (
        <div
          className={cn(
            'flex items-center justify-center rounded-full bg-slate-100',
            compact ? 'w-12 h-12 mb-3' : 'w-16 h-16 mb-4',
            iconClassName
          )}
        >
          {renderIcon(icon, cn(compact ? 'w-6 h-6' : 'w-8 h-8', 'text-slate-400'))}
        </div>
      )}

      <h3 className={cn('font-medium text-slate-900', compact ? 'text-base mb-1' : 'text-lg mb-2')}>
        {title}
      </h3>

      {description && (
        <p
          className={cn(
            'text-slate-500 max-w-sm',
            compact ? 'text-sm' : 'text-base',
            action ? 'mb-4' : undefined
          )}
        >
          {description}
        </p>
      )}

      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export default EmptyState
