/**
 * ReAuthNotification Component
 * Displays re-authentication notifications when OAuth tokens expire
 *
 * AC5: User re-auth notification UI component
 * AC6: Integrates with tokenRefreshService callback system
 * AC7: Clear message when refresh token expired
 * AC8: "Re-authenticate" button initiates OAuth flow
 *
 * Features:
 * - Non-blocking (dismissible)
 * - Shows provider name (Gmail or Outlook)
 * - Clear error message
 * - Re-authenticate button
 */

import { useReAuthNotifications } from '@/hooks/useReAuthNotifications'
import { gmailOAuthService } from '@/services/auth/gmailOAuth'
import { outlookOAuthService } from '@/services/auth/outlookOAuth'
import { notificationStore } from '@/store/notificationStore'

interface ReAuthNotificationItemProps {
  accountId: string
  provider: 'gmail' | 'outlook'
  error: string
  onDismiss: () => void
  onReAuth: () => void
}

/**
 * Individual notification item
 */
function ReAuthNotificationItem({
  accountId,
  provider,
  error,
  onDismiss,
  onReAuth,
}: ReAuthNotificationItemProps) {
  const providerName = provider === 'gmail' ? 'Gmail' : 'Outlook'
  const providerIcon = provider === 'gmail' ? '📧' : '📬'

  return (
    <div
      className="bg-amber-50 border border-amber-200 rounded-lg p-4 shadow-lg w-[380px]"
      role="alert"
      aria-live="polite"
      data-testid={`reauth-notification-${accountId}`}
    >
      <div className="flex items-start gap-3">
        {/* Provider icon */}
        <span className="text-2xl flex-shrink-0" aria-hidden="true">
          {providerIcon}
        </span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <h4 className="font-semibold text-amber-900 mb-1">
            {providerName} Re-authentication Required
          </h4>

          {/* Account */}
          <p className="text-sm text-amber-800 truncate mb-1" title={accountId}>
            {accountId}
          </p>

          {/* Error message */}
          <p className="text-sm text-amber-700 mb-3">
            {error || 'Session expired. Please sign in again.'}
          </p>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={onReAuth}
              className="px-3 py-1.5 text-sm font-medium text-white bg-cyan-600 rounded hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 transition-colors"
              data-testid="reauth-button"
            >
              Re-authenticate
            </button>
            <button
              onClick={onDismiss}
              className="px-3 py-1.5 text-sm font-medium text-amber-700 bg-amber-100 rounded hover:bg-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 transition-colors"
              data-testid="dismiss-button"
            >
              Dismiss
            </button>
          </div>
        </div>

        {/* Close button */}
        <button
          onClick={onDismiss}
          className="flex-shrink-0 text-amber-500 hover:text-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 rounded"
          aria-label="Close notification"
          data-testid="close-button"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  )
}

/**
 * Container component that displays all active re-auth notifications
 * Position: Fixed top-right corner
 */
export function ReAuthNotificationContainer() {
  const { notifications, dismissNotification } = useReAuthNotifications()

  if (notifications.length === 0) {
    return null
  }

  const handleReAuth = (accountId: string, provider: 'gmail' | 'outlook') => {
    // Initiate OAuth flow for the appropriate provider
    if (provider === 'gmail') {
      gmailOAuthService.initiateAuth()
    } else {
      outlookOAuthService.initiateAuth()
    }

    // Remove notification after initiating re-auth
    // The OAuth callback will handle success/failure
    notificationStore.removeNotification(accountId)
  }

  return (
    <div
      className="fixed top-4 right-4 z-50 space-y-3"
      role="region"
      aria-label="Re-authentication notifications"
      data-testid="reauth-notification-container"
    >
      {notifications.map((notification) => (
        <ReAuthNotificationItem
          key={notification.id}
          accountId={notification.accountId}
          provider={notification.provider}
          error={notification.error}
          onDismiss={() => dismissNotification(notification.accountId)}
          onReAuth={() => handleReAuth(notification.accountId, notification.provider)}
        />
      ))}
    </div>
  )
}

/**
 * Export individual item for direct use if needed
 */
export { ReAuthNotificationItem }
