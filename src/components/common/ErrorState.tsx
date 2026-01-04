/**
 * ErrorState Components
 *
 * Story 2.12: Empty States & Onboarding UX
 * Task 4: Error state components with actionable next steps
 *
 * Provides clear error messages with recovery actions.
 *
 * Usage:
 *   <ErrorState type="network" onRetry={handleRetry} />
 *   <NetworkError onRetry={handleRetry} />
 *   <AuthError onReauthenticate={handleReauth} />
 */

import { type ReactNode } from 'react'
import { WifiOff, KeyRound, RefreshCcw, AlertTriangle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@shared/utils/cn'
import { Button } from '@shared/components/ui/button'

export type ErrorType = 'network' | 'auth' | 'sync' | 'generic'

export interface ErrorStateProps {
  /** Type of error */
  type?: ErrorType
  /** Custom title */
  title?: string
  /** Custom description */
  description?: string
  /** Called when retry button is clicked */
  onRetry?: () => void
  /** Called when re-authenticate button is clicked */
  onReauthenticate?: () => void
  /** Whether an action is in progress */
  isLoading?: boolean
  /** Additional actions to show */
  additionalActions?: ReactNode
  /** Additional className */
  className?: string
  /** Whether to show compact version */
  compact?: boolean
}

interface ErrorConfig {
  icon: LucideIcon
  iconColor: string
  iconBg: string
  title: string
  description: string
  primaryAction: 'retry' | 'reauth' | null
  primaryLabel: string
}

const errorConfigs: Record<ErrorType, ErrorConfig> = {
  network: {
    icon: WifiOff,
    iconColor: 'text-orange-600',
    iconBg: 'bg-orange-100',
    title: 'Unable to connect',
    description: 'Please check your internet connection and try again.',
    primaryAction: 'retry',
    primaryLabel: 'Try Again',
  },
  auth: {
    icon: KeyRound,
    iconColor: 'text-amber-600',
    iconBg: 'bg-amber-100',
    title: 'Session expired',
    description: 'Your session has expired. Please sign in again to continue.',
    primaryAction: 'reauth',
    primaryLabel: 'Sign In Again',
  },
  sync: {
    icon: RefreshCcw,
    iconColor: 'text-red-600',
    iconBg: 'bg-red-100',
    title: 'Sync failed',
    description: "We couldn't sync your emails. You can retry or skip for now.",
    primaryAction: 'retry',
    primaryLabel: 'Retry Sync',
  },
  generic: {
    icon: AlertTriangle,
    iconColor: 'text-red-600',
    iconBg: 'bg-red-100',
    title: 'Something went wrong',
    description: 'An unexpected error occurred. Please try again.',
    primaryAction: 'retry',
    primaryLabel: 'Try Again',
  },
}

/**
 * ErrorState - Base error state component
 *
 * Features:
 * - Multiple error type variants
 * - Actionable recovery buttons
 * - Loading state support
 * - Accessible design
 */
export function ErrorState({
  type = 'generic',
  title,
  description,
  onRetry,
  onReauthenticate,
  isLoading = false,
  additionalActions,
  className,
  compact = false,
}: ErrorStateProps) {
  const config = errorConfigs[type]
  const Icon = config.icon

  const handlePrimaryAction = () => {
    if (config.primaryAction === 'retry' && onRetry) {
      onRetry()
    } else if (config.primaryAction === 'reauth' && onReauthenticate) {
      onReauthenticate()
    }
  }

  const showPrimaryButton =
    (config.primaryAction === 'retry' && onRetry) ||
    (config.primaryAction === 'reauth' && onReauthenticate)

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'py-8 px-4' : 'py-16 px-6',
        className
      )}
      role="alert"
      aria-live="assertive"
    >
      {/* Icon */}
      <div
        className={cn(
          'flex items-center justify-center rounded-full',
          config.iconBg,
          compact ? 'w-12 h-12 mb-3' : 'w-16 h-16 mb-4'
        )}
      >
        <Icon
          className={cn(config.iconColor, compact ? 'w-6 h-6' : 'w-8 h-8')}
          strokeWidth={1.5}
          aria-hidden="true"
        />
      </div>

      {/* Title */}
      <h3 className={cn('font-medium text-slate-900', compact ? 'text-base mb-1' : 'text-lg mb-2')}>
        {title ?? config.title}
      </h3>

      {/* Description */}
      <p
        className={cn(
          'text-slate-500 max-w-sm',
          compact ? 'text-sm' : 'text-base',
          showPrimaryButton || additionalActions ? 'mb-4' : undefined
        )}
      >
        {description ?? config.description}
      </p>

      {/* Actions */}
      {(showPrimaryButton || additionalActions) && (
        <div className="flex flex-col sm:flex-row gap-2 mt-4">
          {showPrimaryButton && (
            <Button
              onClick={handlePrimaryAction}
              disabled={isLoading}
              variant={type === 'auth' ? 'default' : 'outline'}
            >
              {isLoading ? (
                <>
                  <RefreshCcw className="w-4 h-4 mr-2 animate-spin" />
                  {type === 'auth' ? 'Signing in...' : 'Retrying...'}
                </>
              ) : (
                config.primaryLabel
              )}
            </Button>
          )}
          {additionalActions}
        </div>
      )}
    </div>
  )
}

/**
 * NetworkError - Specialized network error component
 */
export interface NetworkErrorProps {
  onRetry?: () => void
  isRetrying?: boolean
  className?: string
  compact?: boolean
}

export function NetworkError({ onRetry, isRetrying, className, compact }: NetworkErrorProps) {
  return (
    <ErrorState
      type="network"
      onRetry={onRetry}
      isLoading={isRetrying}
      className={className}
      compact={compact}
    />
  )
}

/**
 * AuthError - Specialized authentication error component
 */
export interface AuthErrorProps {
  onReauthenticate?: () => void
  isAuthenticating?: boolean
  className?: string
  compact?: boolean
}

export function AuthError({
  onReauthenticate,
  isAuthenticating,
  className,
  compact,
}: AuthErrorProps) {
  return (
    <ErrorState
      type="auth"
      onReauthenticate={onReauthenticate}
      isLoading={isAuthenticating}
      className={className}
      compact={compact}
    />
  )
}

/**
 * SyncError - Specialized sync error component
 */
export interface SyncErrorProps {
  onRetry?: () => void
  onSkip?: () => void
  isRetrying?: boolean
  className?: string
  compact?: boolean
}

export function SyncError({ onRetry, onSkip, isRetrying, className, compact }: SyncErrorProps) {
  return (
    <ErrorState
      type="sync"
      onRetry={onRetry}
      isLoading={isRetrying}
      additionalActions={
        onSkip && (
          <Button onClick={onSkip} variant="ghost" disabled={isRetrying}>
            Skip for now
          </Button>
        )
      }
      className={className}
      compact={compact}
    />
  )
}

export default ErrorState
