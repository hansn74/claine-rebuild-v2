/**
 * QueueStatusBadge Component
 *
 * Story 2.7: Offline Mode Indicators & Conflict Resolution
 * AC 3: Queue status shown for pending actions
 *
 * Shows the count of pending email actions waiting to sync.
 * Combines both send queue and action queue counts.
 */

import { useState, useEffect } from 'react'
import { Clock, AlertCircle, CheckCircle } from 'lucide-react'
import { emailActionQueue } from '@/services/email/emailActionQueue'
import { sendQueueService } from '@/services/email/sendQueueService'
import { cn } from '@/utils/cn'

export interface QueueStatusBadgeProps {
  /** Additional CSS classes */
  className?: string
  /** Show badge even when count is zero */
  showZero?: boolean
  /** Click handler */
  onClick?: () => void
}

interface QueueCounts {
  pendingActions: number
  failedActions: number
  pendingSends: number
  failedSends: number
}

/**
 * QueueStatusBadge component
 * Displays count of pending/failed actions in the queue
 */
export function QueueStatusBadge({
  className = '',
  showZero = false,
  onClick,
}: QueueStatusBadgeProps) {
  const [counts, setCounts] = useState<QueueCounts>({
    pendingActions: 0,
    failedActions: 0,
    pendingSends: 0,
    failedSends: 0,
  })

  // Poll for queue counts
  useEffect(() => {
    const updateCounts = async () => {
      try {
        const [pendingActions, failedActions, pendingSends, failedSends] = await Promise.all([
          emailActionQueue.getPendingCount(),
          emailActionQueue.getFailedCount(),
          sendQueueService.getPendingCount(),
          sendQueueService.getFailedCount(),
        ])

        setCounts({
          pendingActions,
          failedActions,
          pendingSends,
          failedSends,
        })
      } catch {
        // Silently handle errors - collections may not be initialized yet
      }
    }

    // Initial update
    updateCounts()

    // Poll every 3 seconds
    const interval = setInterval(updateCounts, 3000)

    return () => clearInterval(interval)
  }, [])

  const totalPending = counts.pendingActions + counts.pendingSends
  const totalFailed = counts.failedActions + counts.failedSends
  const total = totalPending + totalFailed

  // Don't render if no items and showZero is false
  if (total === 0 && !showZero) {
    return null
  }

  const hasFailed = totalFailed > 0
  const hasPending = totalPending > 0

  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
        'transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2',
        hasFailed
          ? 'bg-red-100 text-red-700 hover:bg-red-200 focus:ring-red-500'
          : hasPending
            ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200 focus:ring-yellow-500'
            : 'bg-green-100 text-green-600 hover:bg-green-200 focus:ring-green-500',
        className
      )}
      aria-label={
        hasFailed
          ? `${totalFailed} actions failed, ${totalPending} pending`
          : hasPending
            ? `${totalPending} actions pending`
            : 'All actions synced'
      }
    >
      {hasFailed ? (
        <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
      ) : hasPending ? (
        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      <span>
        {hasFailed ? `${totalFailed} failed` : hasPending ? `${totalPending} pending` : 'Synced'}
      </span>
    </button>
  )
}

/**
 * Compact queue indicator (just count badge)
 * For use in navigation or status bar
 */
export function QueueCountBadge({ className = '' }: { className?: string }) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const updateCount = async () => {
      try {
        const [pendingActions, pendingSends] = await Promise.all([
          emailActionQueue.getPendingCount(),
          sendQueueService.getPendingCount(),
        ])
        setCount(pendingActions + pendingSends)
      } catch {
        // Silently handle errors
      }
    }

    updateCount()
    const interval = setInterval(updateCount, 3000)
    return () => clearInterval(interval)
  }, [])

  if (count === 0) {
    return null
  }

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center px-1.5 py-0.5',
        'text-[10px] font-bold text-yellow-800 bg-yellow-100 rounded-full min-w-[18px]',
        className
      )}
      role="status"
      aria-label={`${count} actions pending`}
    >
      {count > 99 ? '99+' : count}
    </span>
  )
}
