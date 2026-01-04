/**
 * Notification Store
 * Manages re-authentication notification state
 * Allows multiple notifications for different accounts
 *
 * Non-blocking: User can dismiss notifications
 * Persistent: Tracks which accounts need re-auth until resolved
 */

export interface ReAuthNotification {
  id: string
  accountId: string
  provider: 'gmail' | 'outlook'
  error: string
  createdAt: number
  dismissed: boolean
}

/**
 * Simple in-memory store for notifications
 * Could be replaced with zustand or RxDB if persistence needed
 */
class NotificationStore {
  private notifications: Map<string, ReAuthNotification> = new Map()
  private listeners: Set<() => void> = new Set()

  /**
   * Add a re-auth notification for an account
   * Won't duplicate if notification already exists for account
   */
  addReAuthNotification(accountId: string, provider: 'gmail' | 'outlook', error: string): void {
    // Don't add duplicate notifications for same account
    if (this.notifications.has(accountId)) {
      return
    }

    const notification: ReAuthNotification = {
      id: accountId,
      accountId,
      provider,
      error,
      createdAt: Date.now(),
      dismissed: false,
    }

    this.notifications.set(accountId, notification)
    this.notifyListeners()
  }

  /**
   * Remove notification for an account (after re-auth success)
   */
  removeNotification(accountId: string): void {
    if (this.notifications.has(accountId)) {
      this.notifications.delete(accountId)
      this.notifyListeners()
    }
  }

  /**
   * Dismiss notification (hides but tracks that re-auth still needed)
   */
  dismissNotification(accountId: string): void {
    const notification = this.notifications.get(accountId)
    if (notification) {
      notification.dismissed = true
      this.notifyListeners()
    }
  }

  /**
   * Get all active (non-dismissed) notifications
   */
  getActiveNotifications(): ReAuthNotification[] {
    return Array.from(this.notifications.values()).filter((n) => !n.dismissed)
  }

  /**
   * Get all notifications (including dismissed)
   */
  getAllNotifications(): ReAuthNotification[] {
    return Array.from(this.notifications.values())
  }

  /**
   * Check if account needs re-auth (even if notification dismissed)
   */
  accountNeedsReAuth(accountId: string): boolean {
    return this.notifications.has(accountId)
  }

  /**
   * Subscribe to notification changes
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener()
      } catch (error) {
        console.error('Error in notification listener:', error)
      }
    })
  }

  /**
   * Clear all notifications (for testing or logout)
   */
  clear(): void {
    this.notifications.clear()
    this.notifyListeners()
  }
}

/**
 * Singleton instance
 */
export const notificationStore = new NotificationStore()

/**
 * Expose notification store for E2E testing in development mode
 * This allows Playwright tests to trigger notifications without complex module imports
 */
if (import.meta.env.DEV) {
  ;(
    window as unknown as { __TEST_NOTIFICATION_STORE__: NotificationStore }
  ).__TEST_NOTIFICATION_STORE__ = notificationStore
}
