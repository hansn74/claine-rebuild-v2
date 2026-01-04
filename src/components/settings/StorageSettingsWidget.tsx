/**
 * StorageSettingsWidget Component
 * Displays storage usage with visual progress bar and management options
 *
 * AC 2: Current usage and available quota displayed in settings page
 * AC 3: Usage percentage calculated and shown
 * AC 15: Storage widget in settings shows real-time usage with progress bar visual
 * AC 17: User can manually trigger storage quota check from settings
 */

import { Button } from '@shared/components/ui/button'
import { useQuotaStatus } from '@/hooks/useQuotaStatus'
import { formatBytes } from '@/services/quota'

export interface StorageSettingsWidgetProps {
  /** Callback when "Manage Storage" button is clicked */
  onManageStorage?: () => void
}

/**
 * StorageSettingsWidget component
 * Shows storage usage with progress bar and management options
 */
export function StorageSettingsWidget({ onManageStorage }: StorageSettingsWidgetProps) {
  const { usage, quota, percentage, status, isLoading, error, isStorageApiAvailable, refresh } =
    useQuotaStatus()

  // Color classes based on status
  const progressColorClasses = {
    normal: 'bg-cyan-600',
    warning: 'bg-yellow-500',
    critical: 'bg-red-500',
  }

  const statusColorClasses = {
    normal: 'text-cyan-600',
    warning: 'text-yellow-600',
    critical: 'text-red-600',
  }

  const statusLabels = {
    normal: 'Normal',
    warning: 'Warning',
    critical: 'Critical',
  }

  // Show message if Storage API is not available
  if (!isStorageApiAvailable) {
    return (
      <div className="bg-white rounded-lg border border-slate-200">
        <div className="px-4 py-3 border-b border-slate-200">
          <h3 className="text-base font-semibold text-slate-900">Storage Usage</h3>
        </div>
        <div className="px-4 py-4">
          <p className="text-sm text-slate-500">
            Storage monitoring is not available in this browser.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border border-slate-200">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200">
        <h3 className="text-base font-semibold text-slate-900">Storage Usage</h3>
        <p className="text-sm text-slate-500 mt-1">Monitor and manage local email storage</p>
      </div>

      {/* Content */}
      <div className="px-4 py-4">
        {error ? <div className="text-sm text-red-600 mb-4">Error: {error}</div> : null}

        {/* Usage display */}
        <div className="mb-4">
          <div className="flex justify-between items-baseline mb-2">
            <span className="text-sm font-medium text-slate-700">
              {isLoading ? 'Checking...' : `Using ${formatBytes(usage)} of ${formatBytes(quota)}`}
            </span>
            <span className={`text-sm font-medium ${statusColorClasses[status]}`}>
              {percentage.toFixed(1)}%
            </span>
          </div>

          {/* Progress bar (AC 15) */}
          <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${progressColorClasses[status]}`}
              style={{ width: `${Math.min(percentage, 100)}%` }}
              role="progressbar"
              aria-valuenow={percentage}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Storage usage"
            />
          </div>

          {/* Status indicator */}
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
              <StatusDot status={status} />
              <span className="text-xs text-slate-500">Status: {statusLabels[status]}</span>
            </div>

            {/* Warning/Critical messages */}
            {status === 'warning' && (
              <span className="text-xs text-yellow-600">
                Storage almost full - cleanup recommended
              </span>
            )}
            {status === 'critical' && (
              <span className="text-xs text-red-600">
                Storage critically low - cleanup required
              </span>
            )}
          </div>
        </div>

        {/* Storage breakdown summary */}
        <div className="grid grid-cols-2 gap-4 mb-4 p-3 bg-slate-50 rounded-md">
          <div>
            <div className="text-xs text-slate-500">Used</div>
            <div className="text-lg font-semibold text-slate-900">
              {isLoading ? '...' : formatBytes(usage)}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Available</div>
            <div className="text-lg font-semibold text-slate-900">
              {isLoading ? '...' : formatBytes(quota - usage)}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-2">
          {/* Check Storage button (AC 17) */}
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={isLoading}
            className="flex-1"
          >
            {isLoading ? (
              <>
                <LoadingSpinner />
                Checking...
              </>
            ) : (
              <>
                <RefreshIcon />
                Check Storage
              </>
            )}
          </Button>

          {/* Manage Storage button */}
          <Button
            variant={
              status === 'critical' ? 'destructive' : status === 'warning' ? 'default' : 'outline'
            }
            size="sm"
            onClick={onManageStorage}
            className="flex-1"
          >
            <StorageIcon />
            Manage Storage
          </Button>
        </div>
      </div>
    </div>
  )
}

/**
 * Status indicator dot
 */
function StatusDot({ status }: { status: 'normal' | 'warning' | 'critical' }) {
  const dotClasses = {
    normal: 'bg-cyan-500',
    warning: 'bg-yellow-500',
    critical: 'bg-red-500',
  }

  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${dotClasses[status]}`}
      aria-hidden="true"
    />
  )
}

/**
 * Loading spinner icon
 */
function LoadingSpinner() {
  return (
    <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}

/**
 * Refresh icon
 */
function RefreshIcon() {
  return (
    <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  )
}

/**
 * Storage icon
 */
function StorageIcon() {
  return (
    <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
      />
    </svg>
  )
}
