/**
 * React Hook for Re-Auth Notifications
 * Provides reactive access to notification store
 */

import { useState, useEffect, useCallback } from 'react'
import { notificationStore, type ReAuthNotification } from '@/store/notificationStore'

/**
 * Hook to get active re-auth notifications
 * Automatically re-renders when notifications change
 */
export function useReAuthNotifications() {
  const [notifications, setNotifications] = useState<ReAuthNotification[]>(() =>
    notificationStore.getActiveNotifications()
  )

  useEffect(() => {
    const unsubscribe = notificationStore.subscribe(() => {
      setNotifications(notificationStore.getActiveNotifications())
    })

    return unsubscribe
  }, [])

  const dismissNotification = useCallback((accountId: string) => {
    notificationStore.dismissNotification(accountId)
  }, [])

  const removeNotification = useCallback((accountId: string) => {
    notificationStore.removeNotification(accountId)
  }, [])

  return {
    notifications,
    dismissNotification,
    removeNotification,
    hasNotifications: notifications.length > 0,
  }
}

/**
 * Hook to check if a specific account needs re-auth
 */
export function useAccountNeedsReAuth(accountId: string): boolean {
  const [needsReAuth, setNeedsReAuth] = useState(() =>
    notificationStore.accountNeedsReAuth(accountId)
  )

  useEffect(() => {
    const unsubscribe = notificationStore.subscribe(() => {
      setNeedsReAuth(notificationStore.accountNeedsReAuth(accountId))
    })

    return unsubscribe
  }, [accountId])

  return needsReAuth
}
