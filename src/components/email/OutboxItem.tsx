/**
 * OutboxItem Component
 *
 * Story 2.4: Offline-First Send Queue
 * Task 7: Create Outbox View Component (subtask 7.2)
 *
 * Displays a single queued email with status indicator.
 * Provides retry/cancel actions based on status.
 *
 * AC 3: Visual indicator shows queue status (pending/sending/sent/failed)
 * AC 5: Failed sends can be retried
 * AC 6: User can cancel queued email before it's sent
 */

import { useState, useCallback, type ReactNode } from 'react'
import {
  Clock,
  Send,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  RefreshCw,
  Trash2,
} from 'lucide-react'
import { Button } from '@shared/components/ui/button'
import { cn } from '@/utils/cn'
import { sendQueueService } from '@/services/email/sendQueueService'
import { logger } from '@/services/logger'
import type {
  SendQueueDocument,
  SendQueueStatus,
} from '@/services/database/schemas/sendQueue.schema'

interface OutboxItemProps {
  item: SendQueueDocument
  onStatusChange?: () => void
}

/**
 * Get status icon and color for queue item
 */
function getStatusDisplay(status: SendQueueStatus): {
  icon: ReactNode
  label: string
  colorClass: string
} {
  switch (status) {
    case 'pending':
      return {
        icon: <Clock className="w-4 h-4" />,
        label: 'Queued',
        colorClass: 'text-yellow-600 bg-yellow-50',
      }
    case 'sending':
      return {
        icon: <Loader2 className="w-4 h-4 animate-spin" />,
        label: 'Sending',
        colorClass: 'text-cyan-600 bg-cyan-50',
      }
    case 'sent':
      return {
        icon: <CheckCircle className="w-4 h-4" />,
        label: 'Sent',
        colorClass: 'text-green-600 bg-green-50',
      }
    case 'failed':
      return {
        icon: <XCircle className="w-4 h-4" />,
        label: 'Failed',
        colorClass: 'text-red-600 bg-red-50',
      }
    case 'cancelled':
      return {
        icon: <AlertCircle className="w-4 h-4" />,
        label: 'Cancelled',
        colorClass: 'text-slate-600 bg-slate-50',
      }
    default:
      return {
        icon: <Clock className="w-4 h-4" />,
        label: 'Unknown',
        colorClass: 'text-slate-600 bg-slate-50',
      }
  }
}

/**
 * Format timestamp to readable date/time
 */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / (1000 * 60))

  if (diffMinutes < 1) {
    return 'Just now'
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`
  }
  if (diffMinutes < 1440) {
    return `${Math.floor(diffMinutes / 60)}h ago`
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

/**
 * Get recipient display string
 */
function getRecipientsDisplay(item: SendQueueDocument): string {
  const recipients = [...item.to, ...item.cc, ...item.bcc]
  if (recipients.length === 0) return '(No recipients)'
  if (recipients.length === 1) {
    return recipients[0].name || recipients[0].email
  }
  const first = recipients[0].name || recipients[0].email
  return `${first} +${recipients.length - 1} more`
}

export function OutboxItem({ item, onStatusChange }: OutboxItemProps) {
  const [isRetrying, setIsRetrying] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)

  const statusDisplay = getStatusDisplay(item.status)

  // Handle retry
  const handleRetry = useCallback(async () => {
    setIsRetrying(true)
    try {
      const success = await sendQueueService.retryFailedEmail(item.id)
      if (success) {
        logger.info('outbox', 'Retry initiated', { id: item.id })
        onStatusChange?.()
      }
    } catch (error) {
      logger.error('outbox', 'Retry failed', {
        id: item.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      setIsRetrying(false)
    }
  }, [item.id, onStatusChange])

  // Handle cancel
  const handleCancel = useCallback(async () => {
    setIsCancelling(true)
    try {
      const success = await sendQueueService.cancelQueuedEmail(item.id)
      if (success) {
        logger.info('outbox', 'Email cancelled', { id: item.id })
        onStatusChange?.()
      }
    } catch (error) {
      logger.error('outbox', 'Cancel failed', {
        id: item.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      setIsCancelling(false)
    }
  }, [item.id, onStatusChange])

  return (
    <div className="flex flex-col gap-2 p-4 border-b border-slate-200 hover:bg-slate-50 transition-colors">
      {/* Top row: Recipients and Time */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Send className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <span className="text-sm font-medium text-slate-900 truncate">
            {getRecipientsDisplay(item)}
          </span>
        </div>
        <span className="text-xs text-slate-500 flex-shrink-0">{formatTime(item.createdAt)}</span>
      </div>

      {/* Subject line */}
      <div className="text-sm text-slate-700 truncate pl-6">{item.subject || '(No subject)'}</div>

      {/* Status row */}
      <div className="flex items-center justify-between gap-2 pl-6">
        {/* Status badge */}
        <div
          className={cn(
            'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium',
            statusDisplay.colorClass
          )}
        >
          {statusDisplay.icon}
          <span>{statusDisplay.label}</span>
          {item.status === 'failed' && item.attempts > 0 && (
            <span className="text-xs opacity-75">
              ({item.attempts}/{item.maxAttempts} attempts)
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {/* Retry button for failed items */}
          {item.status === 'failed' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRetry}
              disabled={isRetrying}
              className="h-7 px-2"
            >
              {isRetrying ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              <span className="ml-1 text-xs">Retry</span>
            </Button>
          )}

          {/* Cancel button for pending items */}
          {item.status === 'pending' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              disabled={isCancelling}
              className="h-7 px-2 text-slate-500 hover:text-red-600"
            >
              {isCancelling ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              <span className="ml-1 text-xs">Cancel</span>
            </Button>
          )}
        </div>
      </div>

      {/* Error message for failed items */}
      {item.status === 'failed' && item.error && (
        <div className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded ml-6">{item.error}</div>
      )}
    </div>
  )
}
