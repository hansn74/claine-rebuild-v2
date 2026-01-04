/**
 * SyncIssuesPanel Component
 * Displays sync failure history and allows retry actions
 *
 * AC 13: Failed emails accessible via "Sync Issues" panel in settings
 * AC 16: Manual "Retry All Failed" button in sync issues panel
 */

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@shared/components/ui/button'
import { getDatabase } from '@/services/database/init'
import type {
  SyncFailureDocument,
  SyncFailureStatus,
} from '@/services/database/schemas/syncFailure.schema'
import { SyncFailureService } from '@/services/sync/syncFailureService'

export interface SyncIssuesPanelProps {
  /** Account ID to filter by (optional - shows all if not provided) */
  accountId?: string
  /** Callback when retry all is clicked */
  onRetryAll?: (accountId: string, retryCount: number) => void
}

/**
 * Sync failure statistics
 */
interface SyncFailureStats {
  total: number
  pending: number
  exhausted: number
  permanent: number
  resolved: number
}

/**
 * Status badge color mapping
 */
const statusColors: Record<SyncFailureStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  retrying: 'bg-cyan-100 text-cyan-700',
  resolved: 'bg-green-100 text-green-700',
  exhausted: 'bg-orange-100 text-orange-700',
  permanent: 'bg-red-100 text-red-700',
  dismissed: 'bg-slate-100 text-slate-700',
}

/**
 * Status labels
 */
const statusLabels: Record<SyncFailureStatus, string> = {
  pending: 'Pending',
  retrying: 'Retrying',
  resolved: 'Resolved',
  exhausted: 'Exhausted',
  permanent: 'Permanent',
  dismissed: 'Dismissed',
}

/**
 * SyncIssuesPanel component
 * Shows sync failures and provides retry functionality
 */
export function SyncIssuesPanel({ accountId, onRetryAll }: SyncIssuesPanelProps) {
  const [failures, setFailures] = useState<SyncFailureDocument[]>([])
  const [stats, setStats] = useState<SyncFailureStats>({
    total: 0,
    pending: 0,
    exhausted: 0,
    permanent: 0,
    resolved: 0,
  })
  const [loading, setLoading] = useState(true)
  const [retrying, setRetrying] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  // Load sync failures from database
  const loadFailures = useCallback(async () => {
    setLoading(true)
    try {
      const db = getDatabase()

      if (!db.syncFailures) {
        // Collection doesn't exist yet
        setFailures([])
        setStats({
          total: 0,
          pending: 0,
          exhausted: 0,
          permanent: 0,
          resolved: 0,
        })
        return
      }

      // Build query
      const query = accountId
        ? db.syncFailures.find({ selector: { accountId } })
        : db.syncFailures.find()

      // Get all failures (limited to recent 100)
      const docs = await query.sort({ lastAttemptAt: 'desc' }).limit(100).exec()

      // Convert to plain objects
      const failureDocs: SyncFailureDocument[] = docs.map(
        (doc) => doc.toJSON() as SyncFailureDocument
      )

      setFailures(failureDocs)

      // Calculate stats
      const newStats: SyncFailureStats = {
        total: failureDocs.length,
        pending: failureDocs.filter((d) => d.status === 'pending').length,
        exhausted: failureDocs.filter((d) => d.status === 'exhausted').length,
        permanent: failureDocs.filter((d) => d.status === 'permanent').length,
        resolved: failureDocs.filter((d) => d.status === 'resolved').length,
      }
      setStats(newStats)
    } catch (error) {
      console.error('Failed to load sync failures:', error)
    } finally {
      setLoading(false)
    }
  }, [accountId])

  useEffect(() => {
    loadFailures()
  }, [loadFailures])

  const formatDate = useCallback((timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }, [])

  // AC 16: Manual "Retry All Failed" button
  const handleRetryAll = useCallback(async () => {
    if (!accountId) {
      console.warn('Cannot retry all without accountId')
      return
    }

    setRetrying(true)
    try {
      const db = getDatabase()
      const failureService = new SyncFailureService(db)
      const count = await failureService.retryAllExhausted(accountId)

      // Reload the list
      await loadFailures()

      // Notify parent
      onRetryAll?.(accountId, count)
    } catch (error) {
      console.error('Failed to retry all:', error)
    } finally {
      setRetrying(false)
    }
  }, [accountId, loadFailures, onRetryAll])

  // Dismiss a single failure
  const handleDismiss = useCallback(
    async (failureId: string) => {
      try {
        const db = getDatabase()
        const failureService = new SyncFailureService(db)
        await failureService.dismissFailure(failureId)

        // Reload the list
        await loadFailures()
      } catch (error) {
        console.error('Failed to dismiss failure:', error)
      }
    },
    [loadFailures]
  )

  // Filter to show only actionable failures (exhausted, permanent)
  const actionableFailures = failures.filter(
    (f) => f.status === 'exhausted' || f.status === 'permanent'
  )

  const hasActionable = actionableFailures.length > 0

  return (
    <div className="bg-white rounded-lg border border-slate-200">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200">
        <h3 className="text-base font-semibold text-slate-900">Sync Issues</h3>
        <p className="text-sm text-slate-500 mt-1">View and manage failed sync operations</p>
      </div>

      {/* Statistics */}
      <div className="px-4 py-4 border-b border-slate-200">
        <h4 className="text-sm font-medium text-slate-700 mb-3">Statistics</h4>
        {loading ? (
          <p className="text-sm text-slate-500">Loading...</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatBox label="Total Failures" value={stats.total} />
            <StatBox label="Pending Retry" value={stats.pending} color="amber" />
            <StatBox label="Exhausted" value={stats.exhausted} color="orange" />
            <StatBox label="Permanent" value={stats.permanent} color="red" />
            <StatBox label="Resolved" value={stats.resolved} color="green" />
          </div>
        )}
      </div>

      {/* Actions */}
      {hasActionable && accountId && (
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-slate-600">
                {stats.exhausted} exhausted failures can be retried
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetryAll}
              disabled={retrying || stats.exhausted === 0}
            >
              {retrying ? 'Retrying...' : 'Retry All Failed'}
            </Button>
          </div>
        </div>
      )}

      {/* Actionable failures list */}
      {hasActionable && (
        <div className="px-4 py-4 border-b border-slate-200">
          <h4 className="text-sm font-medium text-slate-700 mb-3">
            Requires Attention ({actionableFailures.length})
          </h4>
          <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-md">
            <ul className="divide-y divide-gray-200">
              {actionableFailures.slice(0, 10).map((failure) => (
                <FailureRow
                  key={failure.id}
                  failure={failure}
                  onDismiss={() => handleDismiss(failure.id)}
                  formatDate={formatDate}
                />
              ))}
            </ul>
            {actionableFailures.length > 10 && (
              <p className="p-2 text-xs text-center text-slate-500">
                And {actionableFailures.length - 10} more...
              </p>
            )}
          </div>
        </div>
      )}

      {/* History toggle */}
      <div className="px-4 py-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowHistory(!showHistory)}
          className="w-full justify-between"
        >
          <span>View All Sync Failures</span>
          <ChevronIcon direction={showHistory ? 'up' : 'down'} />
        </Button>

        {/* Full history list */}
        {showHistory && (
          <div className="mt-3 max-h-64 overflow-y-auto border border-slate-200 rounded-md">
            {failures.length === 0 ? (
              <p className="p-4 text-sm text-slate-500 text-center">No sync failures recorded</p>
            ) : (
              <ul className="divide-y divide-gray-200">
                {failures.map((failure) => (
                  <FailureRow
                    key={failure.id}
                    failure={failure}
                    onDismiss={() => handleDismiss(failure.id)}
                    formatDate={formatDate}
                    showDismiss={failure.status !== 'dismissed' && failure.status !== 'resolved'}
                  />
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Statistics box component
 */
interface StatBoxProps {
  label: string
  value: string | number
  color?: 'green' | 'amber' | 'orange' | 'red'
}

function StatBox({ label, value, color }: StatBoxProps) {
  const colorClasses = {
    green: 'text-green-600',
    amber: 'text-amber-600',
    orange: 'text-orange-600',
    red: 'text-red-600',
  }

  return (
    <div className="text-center">
      <div className={`text-2xl font-semibold ${color ? colorClasses[color] : 'text-slate-900'}`}>
        {value}
      </div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  )
}

/**
 * Failure row component
 */
interface FailureRowProps {
  failure: SyncFailureDocument
  onDismiss: () => void
  formatDate: (timestamp: number) => string
  showDismiss?: boolean
}

function FailureRow({ failure, onDismiss, formatDate, showDismiss = true }: FailureRowProps) {
  return (
    <li className="px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium uppercase ${
                statusColors[failure.status]
              }`}
            >
              {statusLabels[failure.status]}
            </span>
            <span className="text-[10px] text-slate-500 uppercase">{failure.provider}</span>
          </div>
          <p className="text-xs text-slate-600 mt-1 truncate" title={failure.errorMessage}>
            {failure.errorMessage}
          </p>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-[10px] text-slate-400">Code: {failure.errorCode}</span>
            <span className="text-[10px] text-slate-400">
              Retries: {failure.retryCount}/{failure.maxRetries}
            </span>
            <span className="text-[10px] text-slate-400">{formatDate(failure.lastAttemptAt)}</span>
          </div>
        </div>
        {showDismiss && (
          <button
            onClick={onDismiss}
            className="text-slate-400 hover:text-slate-600 p-1"
            title="Dismiss"
          >
            <XIcon />
          </button>
        )}
      </div>
    </li>
  )
}

/**
 * Chevron icon
 */
function ChevronIcon({ direction }: { direction: 'up' | 'down' }) {
  return (
    <svg
      className={`w-4 h-4 transition-transform ${direction === 'up' ? 'rotate-180' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )
}

/**
 * X icon for dismiss
 */
function XIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}
