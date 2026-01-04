/**
 * CleanupWizard Component
 * Multi-step wizard for storage cleanup operations
 *
 * AC 6: Cleanup wizard shows storage breakdown by account, age, and size
 * AC 7: User can select cleanup criteria
 * AC 8: Cleanup preview shows estimated space that will be freed
 * AC 9: Cleanup executes with user confirmation, showing progress indicator
 * AC 10: Cleanup reduces IndexedDB storage usage
 */

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@shared/components/ui/button'
import { getDatabase } from '@/services/database/init'
import {
  getStorageBreakdown,
  estimateStorageReduction,
  formatBytes,
  type StorageBreakdown,
  type CleanupCriteria,
  type CleanupEstimate,
} from '@/services/quota'
import { CleanupService, type CleanupProgress, type CleanupResult } from '@/services/quota'
import { getQuotaMonitorService } from '@/services/quota'

export interface CleanupWizardProps {
  /** Whether the wizard is open */
  isOpen: boolean
  /** Callback when wizard is closed */
  onClose: () => void
  /** Callback when cleanup completes */
  onCleanupComplete?: (result: CleanupResult) => void
}

type WizardStep = 'overview' | 'criteria' | 'preview' | 'executing' | 'complete'

/**
 * CleanupWizard component
 * Multi-step dialog for managing storage cleanup
 */
export function CleanupWizard({ isOpen, onClose, onCleanupComplete }: CleanupWizardProps) {
  const [step, setStep] = useState<WizardStep>('overview')
  const [breakdown, setBreakdown] = useState<StorageBreakdown | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Cleanup criteria state
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([])
  const [selectedAge, setSelectedAge] = useState<number | null>(null) // days
  const [selectedSize, setSelectedSize] = useState<number | null>(null) // bytes

  // Preview state
  const [estimate, setEstimate] = useState<CleanupEstimate | null>(null)
  const [estimating, setEstimating] = useState(false)

  // Execution state
  const [progress, setProgress] = useState<CleanupProgress | null>(null)
  const [result, setResult] = useState<CleanupResult | null>(null)

  // Load storage breakdown
  const loadBreakdown = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const db = getDatabase()
      const data = await getStorageBreakdown(db)
      setBreakdown(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load storage breakdown')
    } finally {
      setLoading(false)
    }
  }, [])

  // Load breakdown when wizard opens
  useEffect(() => {
    if (isOpen) {
      loadBreakdown()
      // Reset state
      setStep('overview')
      setSelectedAccounts([])
      setSelectedAge(null)
      setSelectedSize(null)
      setEstimate(null)
      setProgress(null)
      setResult(null)
    }
  }, [isOpen, loadBreakdown])

  // Calculate cleanup estimate
  const calculateEstimate = useCallback(async () => {
    setEstimating(true)

    try {
      const db = getDatabase()
      const criteria: CleanupCriteria = {}

      if (selectedAccounts.length > 0) {
        criteria.accountIds = selectedAccounts
      }
      if (selectedAge !== null) {
        criteria.olderThanDays = selectedAge
      }
      if (selectedSize !== null) {
        criteria.minSizeBytes = selectedSize
      }

      const est = await estimateStorageReduction(db, criteria)
      setEstimate(est)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to estimate cleanup')
    } finally {
      setEstimating(false)
    }
  }, [selectedAccounts, selectedAge, selectedSize])

  // Execute cleanup
  const executeCleanup = useCallback(async () => {
    setStep('executing')
    setProgress({ phase: 'counting', current: 0, total: 0, deletedCount: 0, freedBytes: 0 })

    try {
      const db = getDatabase()
      const cleanupService = new CleanupService(db)

      const criteria = {
        accountIds: selectedAccounts.length > 0 ? selectedAccounts : undefined,
        olderThanDays: selectedAge ?? undefined,
        minSizeBytes: selectedSize ?? undefined,
      }

      const cleanupResult = await cleanupService.executeCleanup(criteria, (prog) => {
        setProgress(prog)
      })

      setResult(cleanupResult)
      setStep('complete')

      // Refresh quota monitor
      const quotaMonitor = getQuotaMonitorService()
      await quotaMonitor.checkStorageQuota()

      onCleanupComplete?.(cleanupResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cleanup failed')
      setStep('preview') // Go back to preview on error
    }
  }, [selectedAccounts, selectedAge, selectedSize, onCleanupComplete])

  // Handle step navigation
  const goToStep = (newStep: WizardStep) => {
    setStep(newStep)

    if (newStep === 'preview') {
      calculateEstimate()
    }
  }

  // Check if any criteria is selected
  const hasCriteria = selectedAccounts.length > 0 || selectedAge !== null || selectedSize !== null

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Storage Cleanup Wizard</h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600"
              disabled={step === 'executing'}
            >
              <XIcon />
            </button>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mt-4">
            <StepIndicator
              label="Overview"
              active={step === 'overview'}
              completed={['criteria', 'preview', 'executing', 'complete'].includes(step)}
            />
            <StepConnector />
            <StepIndicator
              label="Select"
              active={step === 'criteria'}
              completed={['preview', 'executing', 'complete'].includes(step)}
            />
            <StepConnector />
            <StepIndicator
              label="Preview"
              active={step === 'preview'}
              completed={['executing', 'complete'].includes(step)}
            />
            <StepConnector />
            <StepIndicator label="Done" active={step === 'complete'} completed={false} />
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 overflow-y-auto max-h-[60vh]">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">{error}</div>
          )}

          {/* Step 1: Overview */}
          {step === 'overview' && <OverviewStep breakdown={breakdown} loading={loading} />}

          {/* Step 2: Criteria Selection */}
          {step === 'criteria' && breakdown && (
            <CriteriaStep
              breakdown={breakdown}
              selectedAccounts={selectedAccounts}
              setSelectedAccounts={setSelectedAccounts}
              selectedAge={selectedAge}
              setSelectedAge={setSelectedAge}
              selectedSize={selectedSize}
              setSelectedSize={setSelectedSize}
            />
          )}

          {/* Step 3: Preview */}
          {step === 'preview' && (
            <PreviewStep
              estimate={estimate}
              estimating={estimating}
              selectedAge={selectedAge}
              selectedSize={selectedSize}
              selectedAccounts={selectedAccounts}
            />
          )}

          {/* Step 4: Executing */}
          {step === 'executing' && <ExecutingStep progress={progress} />}

          {/* Step 5: Complete */}
          {step === 'complete' && result && <CompleteStep result={result} />}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex justify-between">
          {step === 'overview' && (
            <>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={() => goToStep('criteria')} disabled={loading}>
                Select Cleanup Criteria
              </Button>
            </>
          )}

          {step === 'criteria' && (
            <>
              <Button variant="outline" onClick={() => goToStep('overview')}>
                Back
              </Button>
              <Button onClick={() => goToStep('preview')} disabled={!hasCriteria}>
                Preview Cleanup
              </Button>
            </>
          )}

          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => goToStep('criteria')}>
                Back
              </Button>
              <Button
                variant="destructive"
                onClick={executeCleanup}
                disabled={estimating || !estimate || estimate.emailCount === 0}
              >
                Confirm & Clean Up
              </Button>
            </>
          )}

          {step === 'executing' && (
            <div className="w-full text-center text-sm text-slate-500">
              Cleanup in progress... Please wait.
            </div>
          )}

          {step === 'complete' && (
            <>
              <div />
              <Button onClick={onClose}>Done</Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Step 1: Overview - Shows storage breakdown
 */
function OverviewStep({
  breakdown,
  loading,
}: {
  breakdown: StorageBreakdown | null
  loading: boolean
}) {
  if (loading) {
    return <div className="py-8 text-center text-slate-500">Loading storage breakdown...</div>
  }

  if (!breakdown) {
    return <div className="py-8 text-center text-slate-500">No storage data available</div>
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="p-4 bg-slate-50 rounded-lg">
        <div className="text-center">
          <div className="text-3xl font-bold text-slate-900">
            {formatBytes(breakdown.totalEstimatedSize)}
          </div>
          <div className="text-sm text-slate-500">
            {breakdown.totalEmails.toLocaleString()} emails stored locally
          </div>
        </div>
      </div>

      {/* By Account (AC 6) */}
      <div>
        <h3 className="text-sm font-medium text-slate-700 mb-2">By Account</h3>
        <div className="space-y-2">
          {breakdown.byAccount.map((acc) => (
            <div
              key={acc.accountId}
              className="flex items-center justify-between p-2 bg-slate-50 rounded"
            >
              <span className="text-sm text-slate-600 truncate flex-1">{acc.accountId}</span>
              <span className="text-sm font-medium text-slate-900 ml-4">
                {formatBytes(acc.estimatedSize)} ({acc.emailCount} emails)
              </span>
            </div>
          ))}
          {breakdown.byAccount.length === 0 && (
            <p className="text-sm text-slate-500">No accounts found</p>
          )}
        </div>
      </div>

      {/* By Age (AC 6) */}
      <div>
        <h3 className="text-sm font-medium text-slate-700 mb-2">By Age</h3>
        <div className="space-y-2">
          {breakdown.byAge.map((age) => (
            <div
              key={age.bucket}
              className="flex items-center justify-between p-2 bg-slate-50 rounded"
            >
              <span className="text-sm text-slate-600">{age.bucket}</span>
              <span className="text-sm font-medium text-slate-900">
                {formatBytes(age.estimatedSize)} ({age.emailCount} emails)
              </span>
            </div>
          ))}
          {breakdown.byAge.length === 0 && (
            <p className="text-sm text-slate-500">No emails found</p>
          )}
        </div>
      </div>

      {/* By Size (AC 6) */}
      <div>
        <h3 className="text-sm font-medium text-slate-700 mb-2">By Size</h3>
        <div className="space-y-2">
          {breakdown.bySize.map((size) => (
            <div
              key={size.bucket}
              className="flex items-center justify-between p-2 bg-slate-50 rounded"
            >
              <span className="text-sm text-slate-600">{size.bucket}</span>
              <span className="text-sm font-medium text-slate-900">
                {formatBytes(size.totalSize)} ({size.emailCount} emails)
              </span>
            </div>
          ))}
          {breakdown.bySize.length === 0 && (
            <p className="text-sm text-slate-500">No emails found</p>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Step 2: Criteria Selection
 */
function CriteriaStep({
  breakdown,
  selectedAccounts,
  setSelectedAccounts,
  selectedAge,
  setSelectedAge,
  selectedSize,
  setSelectedSize,
}: {
  breakdown: StorageBreakdown
  selectedAccounts: string[]
  setSelectedAccounts: (accounts: string[]) => void
  selectedAge: number | null
  setSelectedAge: (age: number | null) => void
  selectedSize: number | null
  setSelectedSize: (size: number | null) => void
}) {
  const ageOptions = [
    { value: 365, label: 'Older than 1 year' },
    { value: 730, label: 'Older than 2 years' },
    { value: 1095, label: 'Older than 3 years' },
  ]

  const sizeOptions = [
    { value: 1024 * 1024, label: 'Larger than 1 MB' },
    { value: 5 * 1024 * 1024, label: 'Larger than 5 MB' },
    { value: 10 * 1024 * 1024, label: 'Larger than 10 MB' },
  ]

  const toggleAccount = (accountId: string) => {
    if (selectedAccounts.includes(accountId)) {
      setSelectedAccounts(selectedAccounts.filter((a) => a !== accountId))
    } else {
      setSelectedAccounts([...selectedAccounts, accountId])
    }
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600">
        Select what emails to clean up. You can combine multiple criteria.
      </p>

      {/* Account selection */}
      <div>
        <h3 className="text-sm font-medium text-slate-700 mb-2">By Account (optional)</h3>
        <div className="space-y-2">
          {breakdown.byAccount.map((acc) => (
            <label
              key={acc.accountId}
              className="flex items-center gap-3 p-2 bg-slate-50 rounded cursor-pointer hover:bg-slate-100"
            >
              <input
                type="checkbox"
                checked={selectedAccounts.includes(acc.accountId)}
                onChange={() => toggleAccount(acc.accountId)}
                className="rounded border-slate-300"
              />
              <span className="text-sm text-slate-600 flex-1 truncate">{acc.accountId}</span>
              <span className="text-xs text-slate-500">{formatBytes(acc.estimatedSize)}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Age selection (AC 7) */}
      <div>
        <h3 className="text-sm font-medium text-slate-700 mb-2">By Age (optional)</h3>
        <div className="space-y-2">
          {ageOptions.map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-3 p-2 bg-slate-50 rounded cursor-pointer hover:bg-slate-100"
            >
              <input
                type="radio"
                name="age"
                checked={selectedAge === opt.value}
                onChange={() => setSelectedAge(opt.value)}
                className="border-slate-300"
              />
              <span className="text-sm text-slate-600">{opt.label}</span>
            </label>
          ))}
          {selectedAge !== null && (
            <button
              onClick={() => setSelectedAge(null)}
              className="text-xs text-cyan-600 hover:underline"
            >
              Clear age filter
            </button>
          )}
        </div>
      </div>

      {/* Size selection (AC 7) */}
      <div>
        <h3 className="text-sm font-medium text-slate-700 mb-2">By Size (optional)</h3>
        <div className="space-y-2">
          {sizeOptions.map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-3 p-2 bg-slate-50 rounded cursor-pointer hover:bg-slate-100"
            >
              <input
                type="radio"
                name="size"
                checked={selectedSize === opt.value}
                onChange={() => setSelectedSize(opt.value)}
                className="border-slate-300"
              />
              <span className="text-sm text-slate-600">{opt.label}</span>
            </label>
          ))}
          {selectedSize !== null && (
            <button
              onClick={() => setSelectedSize(null)}
              className="text-xs text-cyan-600 hover:underline"
            >
              Clear size filter
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Step 3: Preview
 */
function PreviewStep({
  estimate,
  estimating,
  selectedAge,
  selectedSize,
  selectedAccounts,
}: {
  estimate: CleanupEstimate | null
  estimating: boolean
  selectedAge: number | null
  selectedSize: number | null
  selectedAccounts: string[]
}) {
  if (estimating) {
    return <div className="py-8 text-center text-slate-500">Calculating cleanup estimate...</div>
  }

  if (!estimate) {
    return <div className="py-8 text-center text-slate-500">Unable to calculate estimate</div>
  }

  return (
    <div className="space-y-6">
      {/* Summary (AC 8) */}
      <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
        <div className="text-4xl font-bold text-yellow-700 mb-2">
          {formatBytes(estimate.estimatedFreedBytes)}
        </div>
        <div className="text-sm text-yellow-600">Estimated space to be freed</div>
        <div className="text-lg font-medium text-yellow-700 mt-2">
          {estimate.emailCount.toLocaleString()} emails will be deleted
        </div>
      </div>

      {/* Criteria summary */}
      <div>
        <h3 className="text-sm font-medium text-slate-700 mb-2">Selected Criteria</h3>
        <ul className="space-y-1 text-sm text-slate-600">
          {selectedAccounts.length > 0 && <li>Accounts: {selectedAccounts.join(', ')}</li>}
          {selectedAge !== null && <li>Age: Older than {Math.round(selectedAge / 365)} year(s)</li>}
          {selectedSize !== null && <li>Size: Larger than {formatBytes(selectedSize)}</li>}
        </ul>
      </div>

      {/* Warning */}
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="flex gap-3">
          <WarningIcon />
          <div>
            <h4 className="text-sm font-medium text-red-700">This action cannot be undone</h4>
            <p className="text-sm text-red-600 mt-1">
              Deleted emails will be removed from local storage. They will be re-synced from the
              server on the next sync if still available.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Step 4: Executing
 */
function ExecutingStep({ progress }: { progress: CleanupProgress | null }) {
  if (!progress) {
    return <div className="py-8 text-center text-slate-500">Starting cleanup...</div>
  }

  const percentage = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0

  return (
    <div className="py-8 space-y-4">
      {/* Phase indicator */}
      <div className="text-center">
        <div className="text-lg font-medium text-slate-900">
          {progress.phase === 'counting' && 'Counting emails...'}
          {progress.phase === 'deleting' && 'Deleting emails...'}
          {progress.phase === 'complete' && 'Cleanup complete!'}
        </div>
        <div className="text-sm text-slate-500 mt-1">
          {progress.current} of {progress.total} processed
        </div>
      </div>

      {/* Progress bar (AC 9) */}
      <div className="w-full bg-slate-200 rounded-full h-4 overflow-hidden">
        <div
          className="h-full bg-cyan-600 rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 text-center">
        <div>
          <div className="text-2xl font-bold text-slate-900">{progress.deletedCount}</div>
          <div className="text-xs text-slate-500">Emails Deleted</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-slate-900">
            {formatBytes(progress.freedBytes)}
          </div>
          <div className="text-xs text-slate-500">Space Freed</div>
        </div>
      </div>
    </div>
  )
}

/**
 * Step 5: Complete
 */
function CompleteStep({ result }: { result: CleanupResult }) {
  return (
    <div className="py-8 space-y-6">
      {/* Success icon */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
          <CheckIcon className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="text-lg font-medium text-slate-900">Cleanup Complete!</h3>
      </div>

      {/* Results (AC 10) */}
      <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
        <div className="text-center">
          <div className="text-3xl font-bold text-green-600">{formatBytes(result.freedBytes)}</div>
          <div className="text-sm text-slate-500">Space Freed</div>
        </div>
        <div className="text-center">
          <div className="text-3xl font-bold text-slate-900">{result.deletedCount}</div>
          <div className="text-sm text-slate-500">Emails Deleted</div>
        </div>
      </div>

      {/* Additional info */}
      <div className="text-center text-sm text-slate-500">
        <p>Completed in {(result.durationMs / 1000).toFixed(1)} seconds</p>
        {result.accountsAffected.length > 0 && (
          <p className="mt-1">Accounts affected: {result.accountsAffected.join(', ')}</p>
        )}
      </div>
    </div>
  )
}

/**
 * Step indicator component
 */
function StepIndicator({
  label,
  active,
  completed,
}: {
  label: string
  active: boolean
  completed: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
          active
            ? 'bg-cyan-600 text-white'
            : completed
              ? 'bg-green-500 text-white'
              : 'bg-slate-200 text-slate-500'
        }`}
      >
        {completed ? '✓' : label[0]}
      </div>
      <span className={`text-xs ${active ? 'text-cyan-600 font-medium' : 'text-slate-500'}`}>
        {label}
      </span>
    </div>
  )
}

/**
 * Step connector line
 */
function StepConnector() {
  return <div className="flex-1 h-px bg-slate-200 mx-2" />
}

/**
 * X icon for close button
 */
function XIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

/**
 * Warning icon
 */
function WarningIcon() {
  return (
    <svg
      className="w-5 h-5 text-red-500 flex-shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  )
}

/**
 * Check icon
 */
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  )
}
