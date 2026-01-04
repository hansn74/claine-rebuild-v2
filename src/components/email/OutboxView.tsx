/**
 * OutboxView Component
 *
 * Story 2.4: Offline-First Send Queue
 * Task 7: Create Outbox View Component (subtask 7.1)
 *
 * Displays all queued emails with their status.
 * Provides filtering and actions for queue management.
 *
 * AC 4: User can view all queued emails in dedicated "Outbox" view
 * AC 3: Visual indicator shows queue status (pending/sending/sent/failed)
 */

import { useState, useEffect, useCallback } from 'react'
import { Inbox, RefreshCw, Wifi, WifiOff, AlertTriangle } from 'lucide-react'
import { Button } from '@shared/components/ui/button'
import { cn } from '@/utils/cn'
import { OutboxItem } from './OutboxItem'
import { sendQueueService } from '@/services/email/sendQueueService'
import { useIsOnline } from '@/hooks/useNetworkStatus'
import { logger } from '@/services/logger'
import type { SendQueueDocument } from '@/services/database/schemas/sendQueue.schema'

type FilterOption = 'all' | 'pending' | 'failed' | 'sent'

const FILTER_OPTIONS: { value: FilterOption; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'failed', label: 'Failed' },
  { value: 'sent', label: 'Sent' },
]

export function OutboxView() {
  const [items, setItems] = useState<SendQueueDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterOption>('all')
  const [isProcessing, setIsProcessing] = useState(false)

  const isOnline = useIsOnline()

  // Load queue items
  const loadItems = useCallback(async () => {
    try {
      const observable = await sendQueueService.getQueueItems$()
      const subscription = observable.subscribe({
        next: (queueItems) => {
          setItems(queueItems.map((item) => item as unknown as SendQueueDocument))
          setLoading(false)
        },
        error: (error) => {
          logger.error('outbox', 'Failed to load queue items', {
            error: error instanceof Error ? error.message : 'Unknown error',
          })
          setLoading(false)
        },
      })

      return () => subscription.unsubscribe()
    } catch (error) {
      logger.error('outbox', 'Failed to initialize queue subscription', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadItems()
  }, [loadItems])

  // Handle manual queue processing
  const handleProcessQueue = useCallback(async () => {
    if (!isOnline) return

    setIsProcessing(true)
    try {
      await sendQueueService.processQueue()
      logger.info('outbox', 'Queue processed manually')
    } catch (error) {
      logger.error('outbox', 'Failed to process queue', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      setIsProcessing(false)
    }
  }, [isOnline])

  // Filter items based on selected filter
  const filteredItems = items.filter((item) => {
    if (filter === 'all') return true
    if (filter === 'pending') return item.status === 'pending' || item.status === 'sending'
    if (filter === 'failed') return item.status === 'failed'
    if (filter === 'sent') return item.status === 'sent'
    return true
  })

  // Count items by status
  const counts = {
    all: items.length,
    pending: items.filter((i) => i.status === 'pending' || i.status === 'sending').length,
    failed: items.filter((i) => i.status === 'failed').length,
    sent: items.filter((i) => i.status === 'sent').length,
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <Inbox className="w-5 h-5 text-slate-600" />
          <h1 className="text-lg font-semibold text-slate-900">Outbox</h1>
          {counts.pending > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
              {counts.pending} pending
            </span>
          )}
          {counts.failed > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium bg-red-100 text-red-800 rounded-full">
              {counts.failed} failed
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Network status indicator */}
          <div
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded text-xs',
              isOnline ? 'text-green-700 bg-green-50' : 'text-red-700 bg-red-50'
            )}
          >
            {isOnline ? (
              <>
                <Wifi className="w-3.5 h-3.5" />
                <span>Online</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5" />
                <span>Offline</span>
              </>
            )}
          </div>

          {/* Process queue button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleProcessQueue}
            disabled={!isOnline || isProcessing || counts.pending === 0}
            className="h-8"
          >
            <RefreshCw className={cn('w-4 h-4 mr-1', isProcessing && 'animate-spin')} />
            {isProcessing ? 'Sending...' : 'Send Now'}
          </Button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-slate-100 bg-slate-50">
        {FILTER_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setFilter(option.value)}
            className={cn(
              'px-3 py-1.5 text-sm rounded-lg transition-colors',
              filter === option.value
                ? 'bg-white text-slate-900 shadow-sm font-medium'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            )}
          >
            {option.label}
            <span className="ml-1 text-xs text-slate-400">({counts[option.value]})</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <RefreshCw className="w-6 h-6 text-slate-400 animate-spin" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-slate-500">
            {filter === 'all' ? (
              <>
                <Inbox className="w-12 h-12 text-slate-300 mb-3" />
                <p className="text-sm">No emails in outbox</p>
                <p className="text-xs text-slate-400 mt-1">
                  Emails waiting to be sent will appear here
                </p>
              </>
            ) : (
              <>
                <p className="text-sm">No {filter} emails</p>
              </>
            )}
          </div>
        ) : (
          <div>
            {filteredItems.map((item) => (
              <OutboxItem key={item.id} item={item} onStatusChange={loadItems} />
            ))}
          </div>
        )}

        {/* Offline warning */}
        {!isOnline && counts.pending > 0 && (
          <div className="mx-4 my-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-800">You&apos;re offline</p>
                <p className="text-xs text-yellow-700 mt-0.5">
                  {counts.pending} email{counts.pending > 1 ? 's' : ''} will be sent when
                  you&apos;re back online.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
