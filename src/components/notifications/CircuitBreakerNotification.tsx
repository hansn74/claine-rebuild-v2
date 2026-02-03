/**
 * Circuit Breaker Notification Component
 *
 * Story 1.19: Circuit Breaker for Provider APIs
 * Task 3: Subtasks 3.3-3.6
 *
 * AC 11: Provider-specific status banner with countdown
 * AC 12: Countdown timer visible
 * AC 13: "Retry Now" button to force probe
 * AC 14: Success notification when circuit closes
 */

import { useState, useEffect, useCallback, useSyncExternalStore } from 'react'
import { circuitBreaker } from '@/services/sync/circuitBreaker'
import type { CircuitStatus, CircuitState, ProviderId } from '@/services/sync/circuitBreakerTypes'

/**
 * Format milliseconds as "Xm Ys" or "Ys"
 */
function formatCountdown(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  }
  return `${seconds}s`
}

/**
 * Get display name for a provider
 */
function getProviderName(provider: ProviderId): string {
  return provider === 'gmail' ? 'Gmail' : 'Outlook'
}

/**
 * Use useSyncExternalStore to subscribe to circuit breaker state
 * This avoids the set-state-in-effect lint issue
 */
function useCircuitState(provider: ProviderId): CircuitStatus {
  const subscribe = useCallback(
    (onStoreChange: () => void) => circuitBreaker.subscribe(onStoreChange),
    []
  )
  const getSnapshot = useCallback(() => circuitBreaker.getStatus(provider), [provider])

  return useSyncExternalStore(subscribe, getSnapshot)
}

/**
 * Single provider notification banner (Subtask 3.3)
 */
function ProviderBanner({
  provider,
  status,
  onForceProbe,
}: {
  provider: ProviderId
  status: CircuitStatus
  onForceProbe: () => void
}) {
  // Live countdown update every second when circuit is open (Subtask 3.2, AC 12)
  const [cooldownDisplay, setCooldownDisplay] = useState(status.cooldownRemainingMs)

  useEffect(() => {
    if (status.state !== 'open') return

    const interval = setInterval(() => {
      setCooldownDisplay(circuitBreaker.getCooldownRemaining(provider))
    }, 1000)

    return () => clearInterval(interval)
  }, [status.state, provider])

  if (status.state !== 'open') return null

  const providerName = getProviderName(provider)
  const countdown = formatCountdown(cooldownDisplay)

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 bg-white border border-slate-200 rounded-xl shadow-md"
      role="alert"
      aria-live="polite"
      data-testid={`circuit-breaker-${provider}`}
    >
      <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" aria-hidden="true" />

      <span className="text-sm text-slate-700 whitespace-nowrap">
        {providerName} temporarily unavailable — retrying in{' '}
        <span className="font-medium tabular-nums">{countdown}</span>
      </span>

      <button
        onClick={onForceProbe}
        className="flex-shrink-0 px-3 py-1 text-xs font-medium text-cyan-700 bg-cyan-50 border border-cyan-200 rounded-lg hover:bg-cyan-100 transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-1"
        data-testid={`circuit-breaker-retry-${provider}`}
      >
        Retry Now
      </button>
    </div>
  )
}

/**
 * Success toast shown when a circuit recovers (Subtask 3.5)
 */
function RecoveryToast({ provider, onDismiss }: { provider: ProviderId; onDismiss: () => void }) {
  const providerName = getProviderName(provider)

  useEffect(() => {
    const timer = setTimeout(onDismiss, 3000)
    return () => clearTimeout(timer)
  }, [onDismiss])

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 bg-white border border-slate-200 rounded-xl shadow-md animate-in fade-in slide-in-from-top-2"
      role="status"
      aria-live="polite"
      data-testid={`circuit-breaker-recovered-${provider}`}
    >
      <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" aria-hidden="true" />
      <span className="text-sm text-slate-700">{providerName} connection restored</span>
    </div>
  )
}

/**
 * Hook to track recovery events — detects when a circuit transitions
 * from open/half-open to closed and shows a temporary toast.
 */
function useRecoveryTracker(currentState: CircuitState, provider: ProviderId) {
  const [showRecovery, setShowRecovery] = useState(false)
  const [, setPrevState] = useState<CircuitState>(currentState)

  // Use a callback in the subscription to detect transitions
  useEffect(() => {
    const unsubscribe = circuitBreaker.subscribe(() => {
      const status = circuitBreaker.getStatus(provider)
      setPrevState((prev) => {
        if ((prev === 'open' || prev === 'half-open') && status.state === 'closed') {
          setShowRecovery(true)
        }
        return status.state
      })
    })

    return unsubscribe
  }, [provider])

  // Keep prevState in sync when the prop changes
  useEffect(() => {
    setPrevState(currentState)
  }, [currentState])

  const dismissRecovery = useCallback(() => {
    setShowRecovery(false)
  }, [])

  return { showRecovery, dismissRecovery }
}

/**
 * Circuit Breaker Notification Container (Subtask 3.6)
 *
 * Mounted in App.tsx alongside ReAuthNotification.
 * Shows provider-specific banners when circuits are open.
 */
export function CircuitBreakerNotification() {
  const gmailStatus = useCircuitState('gmail')
  const outlookStatus = useCircuitState('outlook')

  const forceProbe = useCallback((provider: ProviderId) => {
    circuitBreaker.forceProbe(provider)
  }, [])

  const { showRecovery: gmailRecovered, dismissRecovery: dismissGmail } = useRecoveryTracker(
    gmailStatus.state,
    'gmail'
  )
  const { showRecovery: outlookRecovered, dismissRecovery: dismissOutlook } = useRecoveryTracker(
    outlookStatus.state,
    'outlook'
  )

  const hasAnything =
    gmailStatus.state === 'open' ||
    outlookStatus.state === 'open' ||
    gmailRecovered ||
    outlookRecovered

  if (!hasAnything) return null

  return (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-40 flex flex-col gap-2"
      data-testid="circuit-breaker-notifications"
    >
      <ProviderBanner
        provider="gmail"
        status={gmailStatus}
        onForceProbe={() => forceProbe('gmail')}
      />
      <ProviderBanner
        provider="outlook"
        status={outlookStatus}
        onForceProbe={() => forceProbe('outlook')}
      />

      {gmailRecovered && <RecoveryToast provider="gmail" onDismiss={dismissGmail} />}
      {outlookRecovered && <RecoveryToast provider="outlook" onDismiss={dismissOutlook} />}
    </div>
  )
}
