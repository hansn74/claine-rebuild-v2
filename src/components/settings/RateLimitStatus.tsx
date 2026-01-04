/**
 * RateLimitStatus Component
 * Displays current API rate limit status during active sync
 *
 * AC 16: Rate limit status shown in settings when sync is active
 */

import { useState, useEffect, useRef } from 'react'
import type { RateLimiter, ThrottleStatus } from '@/services/sync/rateLimiter'

export interface RateLimitStatusProps {
  /** Rate limiter instance to monitor */
  rateLimiter: RateLimiter | null
  /** Provider name (Gmail, Outlook) */
  provider: 'gmail' | 'outlook'
  /** Whether sync is currently active */
  isSyncActive: boolean
}

/**
 * RateLimitStatus component
 * Shows rate limit status when sync is active
 */
export function RateLimitStatus({ rateLimiter, provider, isSyncActive }: RateLimitStatusProps) {
  const [status, setStatus] = useState<ThrottleStatus>('normal')
  const [usage, setUsage] = useState(0)

  // Track if component is mounted for safe state updates
  const isMountedRef = useRef(true)

  // Reset state when sync becomes inactive (synchronously before render)
  const effectiveStatus = !rateLimiter || !isSyncActive ? 'normal' : status
  const effectiveUsage = !rateLimiter || !isSyncActive ? 0 : usage

  // Subscribe to rate limiter status changes
  useEffect(() => {
    isMountedRef.current = true

    if (!rateLimiter || !isSyncActive) {
      return
    }

    // Set up callback for status changes
    const handleStatusChange = (newStatus: ThrottleStatus, newUsage: number) => {
      if (isMountedRef.current) {
        setStatus(newStatus)
        setUsage(newUsage)
      }
    }

    rateLimiter.onThrottleChange(handleStatusChange)

    // Poll for updates every second while sync is active
    const intervalId = setInterval(() => {
      if (isMountedRef.current) {
        const currentUsage = rateLimiter.getCurrentUsage()
        const currentStatus = rateLimiter.getThrottleStatus()
        setUsage(currentUsage)
        setStatus(currentStatus)
      }
    }, 1000)

    return () => {
      isMountedRef.current = false
      clearInterval(intervalId)
      rateLimiter.onThrottleChange(null)
    }
  }, [rateLimiter, isSyncActive])

  // Don't show when sync is not active (AC 16: "Only visible during active sync")
  if (!isSyncActive || !rateLimiter) {
    return null
  }

  // Status badge styling
  const statusStyles: Record<ThrottleStatus, { bg: string; text: string; label: string }> = {
    normal: {
      bg: 'bg-green-100',
      text: 'text-green-700',
      label: 'Normal',
    },
    throttled: {
      bg: 'bg-yellow-100',
      text: 'text-yellow-700',
      label: 'Throttled',
    },
    'rate-limited': {
      bg: 'bg-red-100',
      text: 'text-red-700',
      label: 'Rate Limited',
    },
  }

  const style = statusStyles[effectiveStatus]
  const providerLabel = provider === 'gmail' ? 'Gmail API' : 'Outlook API'
  const availableTokens = rateLimiter.getAvailableTokens()
  const maxTokens = rateLimiter.getMaxTokens()
  const refillRate = rateLimiter.getRefillRate()

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Provider icon */}
          <div className="flex-shrink-0">
            {provider === 'gmail' ? <GmailIcon /> : <OutlookIcon />}
          </div>

          {/* Provider label and status */}
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-900">{providerLabel}</span>
              <span
                className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${style.bg} ${style.text}`}
              >
                {style.label}
              </span>
            </div>

            {/* Rate info */}
            <div className="text-xs text-slate-500 mt-1">
              {availableTokens} / {maxTokens} tokens available ({refillRate}/sec refill)
            </div>
          </div>
        </div>

        {/* Usage indicator */}
        <div className="text-right">
          <div className="text-lg font-semibold text-slate-900">{effectiveUsage.toFixed(0)}%</div>
          <div className="text-xs text-slate-500">API Usage</div>
        </div>
      </div>

      {/* Usage bar */}
      <div className="mt-3">
        <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              effectiveStatus === 'normal'
                ? 'bg-green-500'
                : effectiveStatus === 'throttled'
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
            }`}
            style={{ width: `${Math.min(effectiveUsage, 100)}%` }}
          />
        </div>
      </div>

      {/* Status message */}
      {effectiveStatus === 'throttled' && (
        <div className="mt-2 text-xs text-yellow-600">
          Requests are being slowed down to prevent hitting API limits.
        </div>
      )}
      {effectiveStatus === 'rate-limited' && (
        <div className="mt-2 text-xs text-red-600">
          API rate limit reached. Waiting for quota to refill...
        </div>
      )}
    </div>
  )
}

/**
 * Wrapper component that can monitor multiple rate limiters
 */
export interface MultiRateLimitStatusProps {
  gmailRateLimiter: RateLimiter | null
  outlookRateLimiter: RateLimiter | null
  isGmailSyncActive: boolean
  isOutlookSyncActive: boolean
}

export function MultiRateLimitStatus({
  gmailRateLimiter,
  outlookRateLimiter,
  isGmailSyncActive,
  isOutlookSyncActive,
}: MultiRateLimitStatusProps) {
  const showGmail = isGmailSyncActive && gmailRateLimiter
  const showOutlook = isOutlookSyncActive && outlookRateLimiter

  if (!showGmail && !showOutlook) {
    return null
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-slate-700">API Rate Limits</h3>
      {showGmail && (
        <RateLimitStatus
          rateLimiter={gmailRateLimiter}
          provider="gmail"
          isSyncActive={isGmailSyncActive}
        />
      )}
      {showOutlook && (
        <RateLimitStatus
          rateLimiter={outlookRateLimiter}
          provider="outlook"
          isSyncActive={isOutlookSyncActive}
        />
      )}
    </div>
  )
}

/**
 * Gmail icon
 */
function GmailIcon() {
  return (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
      <path
        d="M2 6L12 13L22 6"
        stroke="#EA4335"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect x="2" y="6" width="20" height="14" rx="2" stroke="#4285F4" strokeWidth="2" />
    </svg>
  )
}

/**
 * Outlook icon
 */
function OutlookIcon() {
  return (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="4" width="20" height="16" rx="2" stroke="#0078D4" strokeWidth="2" />
      <path
        d="M2 8L12 14L22 8"
        stroke="#0078D4"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
