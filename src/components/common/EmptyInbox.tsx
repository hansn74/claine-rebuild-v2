/**
 * EmptyInbox Component
 *
 * Story 2.12: Empty States & Onboarding UX
 * Task 1.2: Create EmptyInbox.tsx variant: "You're all caught up!" message
 *
 * Specialized empty state for when the inbox has no unread emails.
 * Provides a calm, reassuring message with a checkmark icon.
 *
 * Usage:
 *   <EmptyInbox />
 *   <EmptyInbox variant="archived" />
 */

import { CheckCircle } from 'lucide-react'
import { cn } from '@shared/utils/cn'
import { EmptyState, type EmptyStateProps } from './EmptyState'

export interface EmptyInboxProps extends Omit<EmptyStateProps, 'icon' | 'title' | 'description'> {
  /** Variant of empty inbox message */
  variant?: 'default' | 'archived' | 'filtered'
  /** Override title */
  title?: string
  /** Override description */
  description?: string
}

const variants = {
  default: {
    title: "You're all caught up!",
    description: 'No unread emails. Enjoy your day.',
  },
  archived: {
    title: 'Inbox Zero achieved!',
    description: 'All emails have been processed.',
  },
  filtered: {
    title: 'No matching emails',
    description: 'Try adjusting your filters.',
  },
}

/**
 * EmptyInbox - Empty state for inbox with no emails
 *
 * Features:
 * - Multiple variants for different contexts
 * - Checkmark icon for positive reinforcement
 * - Calm, reassuring tone per UX guidelines
 */
export function EmptyInbox({
  variant = 'default',
  title,
  description,
  className,
  ...props
}: EmptyInboxProps) {
  const content = variants[variant]

  return (
    <EmptyState
      icon={<CheckCircle className="w-8 h-8 text-cyan-500" strokeWidth={1.5} aria-hidden="true" />}
      title={title ?? content.title}
      description={description ?? content.description}
      className={cn('text-center', className)}
      testId="empty-inbox"
      {...props}
    />
  )
}

export default EmptyInbox
