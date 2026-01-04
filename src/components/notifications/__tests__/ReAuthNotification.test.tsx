/**
 * ReAuthNotification Component Tests
 *
 * Tests for:
 * - AC5: User re-auth notification UI component
 * - AC7: Clear message when refresh token expired
 * - AC8: "Re-authenticate" button initiates OAuth flow
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ReAuthNotificationContainer, ReAuthNotificationItem } from '../ReAuthNotification'
import { notificationStore } from '@/store/notificationStore'

// Mock the OAuth services
vi.mock('@/services/auth/gmailOAuth', () => ({
  gmailOAuthService: {
    initiateAuth: vi.fn(),
  },
}))

vi.mock('@/services/auth/outlookOAuth', () => ({
  outlookOAuthService: {
    initiateAuth: vi.fn(),
  },
}))

// Import mocked services for assertions
import { gmailOAuthService } from '@/services/auth/gmailOAuth'
import { outlookOAuthService } from '@/services/auth/outlookOAuth'

describe('ReAuthNotificationItem', () => {
  const defaultProps = {
    accountId: 'user@gmail.com',
    provider: 'gmail' as const,
    error: 'Session expired',
    onDismiss: vi.fn(),
    onReAuth: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders notification with provider name (AC5)', () => {
    render(<ReAuthNotificationItem {...defaultProps} />)

    expect(screen.getByText('Gmail Re-authentication Required')).toBeInTheDocument()
  })

  it('renders notification for Outlook provider', () => {
    render(<ReAuthNotificationItem {...defaultProps} provider="outlook" />)

    expect(screen.getByText('Outlook Re-authentication Required')).toBeInTheDocument()
  })

  it('displays account ID', () => {
    render(<ReAuthNotificationItem {...defaultProps} />)

    expect(screen.getByText('user@gmail.com')).toBeInTheDocument()
  })

  it('displays error message (AC7)', () => {
    render(<ReAuthNotificationItem {...defaultProps} error="Session expired" />)

    expect(screen.getByText('Session expired')).toBeInTheDocument()
  })

  it('shows default error message when no error provided', () => {
    render(<ReAuthNotificationItem {...defaultProps} error="" />)

    expect(screen.getByText('Session expired. Please sign in again.')).toBeInTheDocument()
  })

  it('has Re-authenticate button (AC8)', () => {
    render(<ReAuthNotificationItem {...defaultProps} />)

    expect(screen.getByTestId('reauth-button')).toBeInTheDocument()
    expect(screen.getByText('Re-authenticate')).toBeInTheDocument()
  })

  it('calls onReAuth when Re-authenticate button clicked (AC8)', () => {
    const onReAuth = vi.fn()
    render(<ReAuthNotificationItem {...defaultProps} onReAuth={onReAuth} />)

    fireEvent.click(screen.getByTestId('reauth-button'))

    expect(onReAuth).toHaveBeenCalledTimes(1)
  })

  it('has Dismiss button', () => {
    render(<ReAuthNotificationItem {...defaultProps} />)

    expect(screen.getByTestId('dismiss-button')).toBeInTheDocument()
    expect(screen.getByText('Dismiss')).toBeInTheDocument()
  })

  it('calls onDismiss when Dismiss button clicked', () => {
    const onDismiss = vi.fn()
    render(<ReAuthNotificationItem {...defaultProps} onDismiss={onDismiss} />)

    fireEvent.click(screen.getByTestId('dismiss-button'))

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('has close button with accessibility label', () => {
    render(<ReAuthNotificationItem {...defaultProps} />)

    expect(screen.getByLabelText('Close notification')).toBeInTheDocument()
  })

  it('calls onDismiss when close button clicked', () => {
    const onDismiss = vi.fn()
    render(<ReAuthNotificationItem {...defaultProps} onDismiss={onDismiss} />)

    fireEvent.click(screen.getByLabelText('Close notification'))

    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('has proper accessibility role', () => {
    render(<ReAuthNotificationItem {...defaultProps} />)

    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('has data-testid for testing', () => {
    render(<ReAuthNotificationItem {...defaultProps} />)

    expect(screen.getByTestId('reauth-notification-user@gmail.com')).toBeInTheDocument()
  })
})

describe('ReAuthNotificationContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    notificationStore.clear()
  })

  afterEach(() => {
    notificationStore.clear()
  })

  it('renders nothing when no notifications', () => {
    const { container } = render(<ReAuthNotificationContainer />)

    expect(container.querySelector('[data-testid="reauth-notification-container"]')).toBeNull()
  })

  it('renders notification when added to store', () => {
    notificationStore.addReAuthNotification('user@gmail.com', 'gmail', 'Token expired')

    render(<ReAuthNotificationContainer />)

    expect(screen.getByTestId('reauth-notification-container')).toBeInTheDocument()
    expect(screen.getByText('Gmail Re-authentication Required')).toBeInTheDocument()
  })

  it('renders multiple notifications', () => {
    notificationStore.addReAuthNotification('user@gmail.com', 'gmail', 'Token expired')
    notificationStore.addReAuthNotification('user@outlook.com', 'outlook', 'Session ended')

    render(<ReAuthNotificationContainer />)

    expect(screen.getByText('Gmail Re-authentication Required')).toBeInTheDocument()
    expect(screen.getByText('Outlook Re-authentication Required')).toBeInTheDocument()
  })

  it('dismisses notification when dismiss clicked', () => {
    notificationStore.addReAuthNotification('user@gmail.com', 'gmail', 'Token expired')

    render(<ReAuthNotificationContainer />)

    expect(screen.getByText('Gmail Re-authentication Required')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('dismiss-button'))

    // Notification should be hidden after dismiss
    expect(screen.queryByText('Gmail Re-authentication Required')).toBeNull()
  })

  it('initiates Gmail OAuth when re-authenticate clicked for Gmail account', () => {
    notificationStore.addReAuthNotification('user@gmail.com', 'gmail', 'Token expired')

    render(<ReAuthNotificationContainer />)

    fireEvent.click(screen.getByTestId('reauth-button'))

    expect(gmailOAuthService.initiateAuth).toHaveBeenCalledTimes(1)
  })

  it('initiates Outlook OAuth when re-authenticate clicked for Outlook account', () => {
    notificationStore.addReAuthNotification('user@outlook.com', 'outlook', 'Token expired')

    render(<ReAuthNotificationContainer />)

    fireEvent.click(screen.getByTestId('reauth-button'))

    expect(outlookOAuthService.initiateAuth).toHaveBeenCalledTimes(1)
  })

  it('removes notification after initiating re-auth', () => {
    notificationStore.addReAuthNotification('user@gmail.com', 'gmail', 'Token expired')

    render(<ReAuthNotificationContainer />)

    expect(screen.getByText('Gmail Re-authentication Required')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('reauth-button'))

    // Notification should be removed after clicking re-authenticate
    expect(screen.queryByText('Gmail Re-authentication Required')).toBeNull()
  })

  it('has proper accessibility region', () => {
    notificationStore.addReAuthNotification('user@gmail.com', 'gmail', 'Token expired')

    render(<ReAuthNotificationContainer />)

    expect(screen.getByRole('region')).toBeInTheDocument()
    expect(screen.getByLabelText('Re-authentication notifications')).toBeInTheDocument()
  })

  it('does not duplicate notifications for same account', () => {
    notificationStore.addReAuthNotification('user@gmail.com', 'gmail', 'Token expired')
    notificationStore.addReAuthNotification('user@gmail.com', 'gmail', 'Another error')

    render(<ReAuthNotificationContainer />)

    // Should only show one notification for the account
    const notifications = screen.getAllByTestId('reauth-notification-user@gmail.com')
    expect(notifications).toHaveLength(1)
  })
})

describe('NotificationStore', () => {
  beforeEach(() => {
    notificationStore.clear()
  })

  afterEach(() => {
    notificationStore.clear()
  })

  it('adds notification', () => {
    notificationStore.addReAuthNotification('user@gmail.com', 'gmail', 'Error')

    const notifications = notificationStore.getActiveNotifications()
    expect(notifications).toHaveLength(1)
    expect(notifications[0].accountId).toBe('user@gmail.com')
  })

  it('removes notification', () => {
    notificationStore.addReAuthNotification('user@gmail.com', 'gmail', 'Error')
    notificationStore.removeNotification('user@gmail.com')

    expect(notificationStore.getActiveNotifications()).toHaveLength(0)
  })

  it('dismisses notification but keeps in store', () => {
    notificationStore.addReAuthNotification('user@gmail.com', 'gmail', 'Error')
    notificationStore.dismissNotification('user@gmail.com')

    // Active notifications should not include dismissed
    expect(notificationStore.getActiveNotifications()).toHaveLength(0)

    // But account should still need re-auth
    expect(notificationStore.accountNeedsReAuth('user@gmail.com')).toBe(true)
  })

  it('tracks if account needs re-auth', () => {
    expect(notificationStore.accountNeedsReAuth('user@gmail.com')).toBe(false)

    notificationStore.addReAuthNotification('user@gmail.com', 'gmail', 'Error')

    expect(notificationStore.accountNeedsReAuth('user@gmail.com')).toBe(true)
  })

  it('clears all notifications', () => {
    notificationStore.addReAuthNotification('user@gmail.com', 'gmail', 'Error')
    notificationStore.addReAuthNotification('user@outlook.com', 'outlook', 'Error')

    notificationStore.clear()

    expect(notificationStore.getActiveNotifications()).toHaveLength(0)
    expect(notificationStore.getAllNotifications()).toHaveLength(0)
  })

  it('notifies subscribers on changes', () => {
    const listener = vi.fn()
    notificationStore.subscribe(listener)

    notificationStore.addReAuthNotification('user@gmail.com', 'gmail', 'Error')

    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('unsubscribes listener', () => {
    const listener = vi.fn()
    const unsubscribe = notificationStore.subscribe(listener)

    unsubscribe()
    notificationStore.addReAuthNotification('user@gmail.com', 'gmail', 'Error')

    expect(listener).not.toHaveBeenCalled()
  })
})
