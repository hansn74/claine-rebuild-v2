/**
 * ConflictHistoryPanel Component
 * Displays conflict history and statistics in settings
 *
 * AC10: User can review conflict history in settings
 * AC12: Conflict statistics displayed in settings (total, auto-resolved, manual)
 */

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@shared/components/ui/button'
import { getDatabase } from '@/services/database/init'
import type { ConflictAuditDocument } from '@/services/database/schemas/conflictAudit.schema'
import { useConflictStore, type ConflictPreference } from '@/store/conflictStore'

export interface ConflictHistoryPanelProps {
  /** Account ID to filter by (optional - shows all if not provided) */
  accountId?: string
}

/**
 * Conflict statistics
 */
interface ConflictStats {
  total: number
  autoResolved: number
  manualResolved: number
  byType: {
    metadata: number
    labels: number
    content: number
  }
}

/**
 * ConflictHistoryPanel component
 * Shows conflict history and resolution preferences
 */
export function ConflictHistoryPanel({ accountId }: ConflictHistoryPanelProps) {
  const [history, setHistory] = useState<ConflictAuditDocument[]>([])
  const [stats, setStats] = useState<ConflictStats>({
    total: 0,
    autoResolved: 0,
    manualResolved: 0,
    byType: { metadata: 0, labels: 0, content: 0 },
  })
  const [loading, setLoading] = useState(true)
  const [showHistory, setShowHistory] = useState(false)

  const preferences = useConflictStore((state) => state.preferences)
  const setPreference = useConflictStore((state) => state.setPreference)

  // Load conflict history from database
  const loadHistory = useCallback(async () => {
    setLoading(true)
    try {
      const db = getDatabase()

      if (!db.conflictAudit) {
        // Collection doesn't exist yet
        setHistory([])
        setStats({
          total: 0,
          autoResolved: 0,
          manualResolved: 0,
          byType: { metadata: 0, labels: 0, content: 0 },
        })
        return
      }

      // Build query
      const query = accountId
        ? db.conflictAudit.find({ selector: { accountId } })
        : db.conflictAudit.find()

      // Sort by resolvedAt descending
      const docs = await query
        .sort({ resolvedAt: 'desc' })
        .limit(50) // Last 50 conflicts
        .exec()

      // Convert to plain objects
      const auditDocs: ConflictAuditDocument[] = docs.map(
        (doc) => doc.toJSON() as ConflictAuditDocument
      )

      setHistory(auditDocs)

      // Calculate stats
      const newStats: ConflictStats = {
        total: auditDocs.length,
        autoResolved: auditDocs.filter((d) => d.resolvedBy === 'system').length,
        manualResolved: auditDocs.filter((d) => d.resolvedBy === 'user').length,
        byType: {
          metadata: auditDocs.filter((d) => d.conflictType === 'metadata').length,
          labels: auditDocs.filter((d) => d.conflictType === 'labels').length,
          content: auditDocs.filter((d) => d.conflictType === 'content').length,
        },
      }
      setStats(newStats)
    } catch (error) {
      console.error('Failed to load conflict history:', error)
    } finally {
      setLoading(false)
    }
  }, [accountId])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  const formatDate = useCallback((isoString: string) => {
    return new Date(isoString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }, [])

  const handlePreferenceChange = useCallback(
    (type: 'metadata' | 'labels' | 'content', value: ConflictPreference) => {
      setPreference(type, value)
    },
    [setPreference]
  )

  return (
    <div className="bg-white rounded-lg border border-slate-200">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200">
        <h3 className="text-base font-semibold text-slate-900">Sync Conflict Settings</h3>
        <p className="text-sm text-slate-500 mt-1">
          Configure how conflicts are resolved and view history
        </p>
      </div>

      {/* Statistics */}
      <div className="px-4 py-4 border-b border-slate-200">
        <h4 className="text-sm font-medium text-slate-700 mb-3">Statistics</h4>
        {loading ? (
          <p className="text-sm text-slate-500">Loading...</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatBox label="Total Conflicts" value={stats.total} />
            <StatBox label="Auto-resolved" value={stats.autoResolved} color="green" />
            <StatBox label="Manual" value={stats.manualResolved} color="blue" />
            <StatBox
              label="By Type"
              value={`M:${stats.byType.metadata} L:${stats.byType.labels} C:${stats.byType.content}`}
              small
            />
          </div>
        )}
      </div>

      {/* Preferences */}
      <div className="px-4 py-4 border-b border-slate-200">
        <h4 className="text-sm font-medium text-slate-700 mb-3">Resolution Preferences</h4>
        <div className="space-y-3">
          <PreferenceRow
            label="Metadata conflicts"
            description="Read status, starred, importance"
            value={preferences.metadata}
            onChange={(v) => handlePreferenceChange('metadata', v)}
          />
          <PreferenceRow
            label="Label conflicts"
            description="Email labels and categories"
            value={preferences.labels}
            onChange={(v) => handlePreferenceChange('labels', v)}
          />
          <PreferenceRow
            label="Content conflicts"
            description="Subject and body changes"
            value={preferences.content}
            onChange={(v) => handlePreferenceChange('content', v)}
            disableAuto
          />
        </div>
      </div>

      {/* History toggle */}
      <div className="px-4 py-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowHistory(!showHistory)}
          className="w-full justify-between"
        >
          <span>View Conflict History</span>
          <ChevronIcon direction={showHistory ? 'up' : 'down'} />
        </Button>

        {/* History list */}
        {showHistory && (
          <div className="mt-3 max-h-64 overflow-y-auto border border-slate-200 rounded-md">
            {history.length === 0 ? (
              <p className="p-4 text-sm text-slate-500 text-center">No conflict history yet</p>
            ) : (
              <ul className="divide-y divide-gray-200">
                {history.map((item) => (
                  <li key={item.id} className="px-3 py-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium uppercase ${
                            item.conflictType === 'content'
                              ? 'bg-red-100 text-red-700'
                              : item.conflictType === 'labels'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {item.conflictType}
                        </span>
                        <span className="ml-2 text-xs text-slate-600">
                          {item.conflictingFields.join(', ')}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded ${
                          item.resolvedBy === 'system'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-cyan-100 text-cyan-700'
                        }`}
                      >
                        {item.resolution}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">{formatDate(item.resolvedAt)}</p>
                  </li>
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
  color?: 'green' | 'blue' | 'amber'
  small?: boolean
}

function StatBox({ label, value, color, small }: StatBoxProps) {
  const colorClasses = {
    green: 'text-green-600',
    blue: 'text-cyan-600',
    amber: 'text-amber-600',
  }

  return (
    <div className="text-center">
      <div
        className={`${small ? 'text-sm' : 'text-2xl'} font-semibold ${
          color ? colorClasses[color] : 'text-slate-900'
        }`}
      >
        {value}
      </div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  )
}

/**
 * Preference row component
 */
interface PreferenceRowProps {
  label: string
  description: string
  value: ConflictPreference
  onChange: (value: ConflictPreference) => void
  disableAuto?: boolean
}

function PreferenceRow({ label, description, value, onChange, disableAuto }: PreferenceRowProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-900">{label}</div>
        <div className="text-xs text-slate-500">{description}</div>
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as ConflictPreference)}
        className="px-2 py-1 text-sm border border-slate-300 rounded-md focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
      >
        <option value="always-ask">Always ask</option>
        {!disableAuto && (
          <>
            <option value="always-local">Keep local</option>
            <option value="always-server">Keep server</option>
          </>
        )}
      </select>
    </div>
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
