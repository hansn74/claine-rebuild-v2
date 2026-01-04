/**
 * Token Refresh Notification Integration
 * Connects tokenRefreshService to the notification store
 *
 * AC6: Integrates with tokenRefreshService callback system
 *
 * This module:
 * - Registers callback with tokenRefreshService
 * - Adds re-auth notifications when refresh fails
 * - Removes notifications when refresh succeeds
 */

import { tokenRefreshService } from './tokenRefresh'
import { tokenStorageService } from './tokenStorage'
import { notificationStore } from '@/store/notificationStore'

let isInitialized = false

/**
 * Initialize the notification integration
 * Should be called once at app startup
 */
export function initializeReAuthNotifications(): () => void {
  if (isInitialized) {
    console.warn('Re-auth notification integration already initialized')
    return () => {} // Return no-op unsubscribe
  }

  isInitialized = true

  // Register callback with tokenRefreshService
  const unsubscribe = tokenRefreshService.onRefresh(
    async (accountId: string, success: boolean, error?: string) => {
      if (success) {
        // Token refresh succeeded - remove any existing notification
        notificationStore.removeNotification(accountId)
      } else {
        // Token refresh failed - show re-auth notification
        // Determine provider from stored token metadata
        const provider = await getProviderForAccount(accountId)

        notificationStore.addReAuthNotification(
          accountId,
          provider,
          error || 'Session expired. Please sign in again.'
        )

        // eslint-disable-next-line no-console
        console.log(`Re-auth notification shown for ${provider} account: ${accountId}`)
      }
    }
  )

  // eslint-disable-next-line no-console
  console.log('Re-auth notification integration initialized')

  // Return cleanup function
  return () => {
    unsubscribe()
    isInitialized = false
    // eslint-disable-next-line no-console
    console.log('Re-auth notification integration cleanup')
  }
}

/**
 * Determine provider type for an account
 * Uses stored token metadata or domain heuristics
 */
async function getProviderForAccount(accountId: string): Promise<'gmail' | 'outlook'> {
  try {
    // Try to get token info from storage
    const tokens = await tokenStorageService.getTokens(accountId)

    // Check if provider is stored with tokens
    if (tokens?.provider) {
      return tokens.provider as 'gmail' | 'outlook'
    }

    // Fallback: Use domain heuristics
    if (accountId.toLowerCase().includes('@gmail.com')) {
      return 'gmail'
    }
    if (
      accountId.toLowerCase().includes('@outlook.') ||
      accountId.toLowerCase().includes('@hotmail.') ||
      accountId.toLowerCase().includes('@live.')
    ) {
      return 'outlook'
    }

    // Default to gmail if unknown
    return 'gmail'
  } catch {
    // Default to gmail on error
    return 'gmail'
  }
}

/**
 * Check if integration is initialized
 */
export function isNotificationIntegrationInitialized(): boolean {
  return isInitialized
}

/**
 * Reset initialization state (for testing)
 */
export function resetNotificationIntegration(): void {
  isInitialized = false
}
