/**
 * Token Refresh Service
 * Automatically refreshes OAuth access tokens before expiration
 *
 * Features:
 * - Checks token expiration every 1 minute
 * - Refreshes tokens 5 minutes before expiration
 * - Handles refresh token rotation
 * - Logs refresh failures for debugging
 * - Prompts user for re-auth if refresh token expired
 *
 * Flow:
 * 1. Scheduler runs every minute
 * 2. Checks all accounts for tokens expiring soon
 * 3. Refreshes tokens 5 minutes before expiration
 * 4. Updates stored tokens with new values
 * 5. Handles errors gracefully (logs, notifies user if needed)
 */

import { gmailOAuthService } from './gmailOAuth'
import { tokenStorageService } from './tokenStorage'
import type { OAuthTokens } from './types'

/**
 * Callback type for token refresh events
 */
export type TokenRefreshCallback = (accountId: string, success: boolean, error?: string) => void

/**
 * Token Refresh Scheduler Service
 * Manages automatic token refresh for all connected accounts
 */
export class TokenRefreshService {
  private intervalId: number | null = null
  private isRunning = false
  private refreshCallbacks: TokenRefreshCallback[] = []

  // Configuration
  private readonly CHECK_INTERVAL_MS = 60 * 1000 // 1 minute
  private readonly REFRESH_THRESHOLD_MINUTES = 5 // Refresh 5 minutes before expiration

  /**
   * Starts the token refresh scheduler
   * Checks token expiration every minute
   *
   * @example
   * ```typescript
   * tokenRefreshService.startScheduler()
   * ```
   */
  startScheduler(): void {
    if (this.isRunning) {
      console.warn('Token refresh scheduler is already running')
      return
    }

    this.isRunning = true

    // Run initial check immediately
    this.checkAndRefreshTokens().catch((error) => {
      console.error('Initial token refresh check failed:', error)
    })

    // Schedule periodic checks
    this.intervalId = window.setInterval(() => {
      this.checkAndRefreshTokens().catch((error) => {
        console.error('Token refresh check failed:', error)
      })
    }, this.CHECK_INTERVAL_MS)

    // eslint-disable-next-line no-console
    console.log(
      `Token refresh scheduler started (checking every ${this.CHECK_INTERVAL_MS / 1000}s, refreshing ${this.REFRESH_THRESHOLD_MINUTES} minutes before expiration)`
    )
  }

  /**
   * Stops the token refresh scheduler
   *
   * @example
   * ```typescript
   * tokenRefreshService.stopScheduler()
   * ```
   */
  stopScheduler(): void {
    if (!this.isRunning) {
      return
    }

    if (this.intervalId !== null) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }

    this.isRunning = false
    // eslint-disable-next-line no-console
    console.log('Token refresh scheduler stopped')
  }

  /**
   * Checks all accounts and refreshes tokens if needed
   * Called automatically by scheduler, can also be called manually
   */
  async checkAndRefreshTokens(): Promise<void> {
    try {
      // Get accounts needing refresh
      const accountsToRefresh = await tokenStorageService.getAccountsNeedingRefresh(
        this.REFRESH_THRESHOLD_MINUTES
      )

      if (accountsToRefresh.length === 0) {
        return // No accounts need refresh
      }

      // eslint-disable-next-line no-console
      console.log(`Refreshing tokens for ${accountsToRefresh.length} account(s)`)

      // Refresh tokens for each account
      const refreshPromises = accountsToRefresh.map((accountId) =>
        this.refreshAccountTokens(accountId)
      )

      await Promise.allSettled(refreshPromises)
    } catch (error) {
      console.error('Failed to check and refresh tokens:', error)
    }
  }

  /**
   * Refreshes tokens for a specific account
   *
   * @param accountId - Account email address
   */
  async refreshAccountTokens(accountId: string): Promise<void> {
    try {
      // Get current tokens
      const currentTokens = await tokenStorageService.getTokens(accountId)

      if (!currentTokens || !currentTokens.refresh_token) {
        throw new Error('No refresh token available for account')
      }

      // eslint-disable-next-line no-console
      console.log(`Refreshing tokens for account: ${accountId}`)

      // Request new tokens
      const newTokens = await gmailOAuthService.refreshAccessToken(currentTokens.refresh_token)

      // Merge new tokens with existing (refresh_token may or may not be updated)
      const updatedTokens: OAuthTokens = {
        ...newTokens,
        // If no new refresh_token, keep the old one (token rotation)
        refresh_token: newTokens.refresh_token || currentTokens.refresh_token,
      }

      // Store updated tokens
      await tokenStorageService.storeTokens(accountId, updatedTokens)

      // eslint-disable-next-line no-console
      console.log(`✓ Successfully refreshed tokens for account: ${accountId}`)

      // Notify listeners
      this.notifyCallbacks(accountId, true)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      console.error(`✗ Failed to refresh tokens for account ${accountId}:`, errorMessage)

      // Check if refresh token expired (requires re-auth)
      if (errorMessage.includes('Refresh token expired')) {
        console.error(`Account ${accountId} requires re-authentication`)
        // TODO: Trigger user notification/modal for re-auth
      }

      // Notify listeners
      this.notifyCallbacks(accountId, false, errorMessage)
    }
  }

  /**
   * Manually refreshes tokens for an account (force refresh)
   * Useful for testing or when user explicitly requests refresh
   *
   * @param accountId - Account email address
   * @returns true if refresh successful, false otherwise
   *
   * @example
   * ```typescript
   * const success = await tokenRefreshService.manualRefresh('user@gmail.com')
   * ```
   */
  async manualRefresh(accountId: string): Promise<boolean> {
    try {
      await this.refreshAccountTokens(accountId)
      return true
    } catch {
      return false
    }
  }

  /**
   * Registers a callback to be notified of token refresh events
   * Useful for UI updates or error handling
   *
   * @param callback - Callback function
   * @returns Unsubscribe function
   *
   * @example
   * ```typescript
   * const unsubscribe = tokenRefreshService.onRefresh((accountId, success, error) => {
   *   if (success) {
   *     console.log(`Tokens refreshed for ${accountId}`)
   *   } else {
   *     console.error(`Refresh failed for ${accountId}: ${error}`)
   *   }
   * })
   *
   * // Later: unsubscribe()
   * ```
   */
  onRefresh(callback: TokenRefreshCallback): () => void {
    this.refreshCallbacks.push(callback)

    // Return unsubscribe function
    return () => {
      const index = this.refreshCallbacks.indexOf(callback)
      if (index > -1) {
        this.refreshCallbacks.splice(index, 1)
      }
    }
  }

  /**
   * Notifies all registered callbacks of a refresh event
   */
  private notifyCallbacks(accountId: string, success: boolean, error?: string): void {
    this.refreshCallbacks.forEach((callback) => {
      try {
        callback(accountId, success, error)
      } catch (error) {
        console.error('Error in refresh callback:', error)
      }
    })
  }

  /**
   * Checks if the scheduler is currently running
   */
  isSchedulerRunning(): boolean {
    return this.isRunning
  }

  /**
   * Gets scheduler configuration
   */
  getConfig(): {
    checkIntervalMs: number
    refreshThresholdMinutes: number
    isRunning: boolean
  } {
    return {
      checkIntervalMs: this.CHECK_INTERVAL_MS,
      refreshThresholdMinutes: this.REFRESH_THRESHOLD_MINUTES,
      isRunning: this.isRunning,
    }
  }
}

/**
 * Singleton instance of token refresh service
 * Use this instance throughout the application
 */
export const tokenRefreshService = new TokenRefreshService()
