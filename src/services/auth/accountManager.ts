/**
 * Account Manager Service
 * Orchestrates account connection with limit enforcement
 *
 * AC5: Account connection limit enforced (max 3 accounts)
 *
 * Flow:
 * 1. Check if can add account (< MAX_ACCOUNTS)
 * 2. If yes, proceed with OAuth flow
 * 3. If no, throw AccountLimitError
 */

import { useAccountStore, MAX_ACCOUNTS, type Account } from '@/store/accountStore'
import { gmailOAuthService } from './gmailOAuth'
import { outlookOAuthService } from './outlookOAuth'
import { tokenStorageService } from './tokenStorage'
import type { OAuthTokens } from './types'

/**
 * Error thrown when account limit is reached
 */
export class AccountLimitError extends Error {
  constructor() {
    super(`Maximum ${MAX_ACCOUNTS} accounts supported. Please remove an account first.`)
    this.name = 'AccountLimitError'
  }
}

/**
 * Check if another account can be added
 * Checks both store state and token storage for accuracy
 */
export async function canAddAccount(): Promise<boolean> {
  // Check store first (faster)
  const storeState = useAccountStore.getState()
  if (storeState.accounts.length >= MAX_ACCOUNTS) {
    return false
  }

  // Double-check with token storage (source of truth)
  const storedAccounts = await tokenStorageService.getAllAccountIds()
  return storedAccounts.length < MAX_ACCOUNTS
}

/**
 * Connect a Gmail account
 * Checks account limit before initiating OAuth
 *
 * @throws AccountLimitError if account limit reached
 */
export async function connectGmailAccount(): Promise<void> {
  const allowed = await canAddAccount()
  if (!allowed) {
    throw new AccountLimitError()
  }

  // Store provider type for callback handling
  sessionStorage.setItem('oauth_provider', 'gmail')

  // Initiate OAuth flow (will redirect)
  await gmailOAuthService.initiateAuth()
}

/**
 * Connect an Outlook account
 * Checks account limit before initiating OAuth
 *
 * @throws AccountLimitError if account limit reached
 */
export async function connectOutlookAccount(): Promise<void> {
  const allowed = await canAddAccount()
  if (!allowed) {
    throw new AccountLimitError()
  }

  // Store provider type for callback handling
  sessionStorage.setItem('oauth_provider', 'outlook')

  // Initiate OAuth flow (will redirect)
  await outlookOAuthService.initiateAuth()
}

/**
 * Complete account connection after OAuth callback
 * Stores tokens and adds account to store
 *
 * @param accountId - Email address / account ID
 * @param tokens - OAuth tokens from exchange
 * @param provider - Email provider type
 */
export async function completeAccountConnection(
  accountId: string,
  tokens: OAuthTokens,
  provider: 'gmail' | 'outlook'
): Promise<Account> {
  // Store tokens securely
  await tokenStorageService.storeTokens(accountId, tokens)

  // Create account object
  const account: Account = {
    id: accountId,
    email: accountId,
    provider,
    connectedAt: Date.now(),
  }

  // Add to store
  useAccountStore.getState().addAccount(account)

  return account
}

/**
 * Disconnect an account
 * Removes tokens and account data
 *
 * @param accountId - Account to disconnect
 */
export async function disconnectAccount(accountId: string): Promise<void> {
  // Remove tokens
  await tokenStorageService.deleteTokens(accountId)

  // Remove from store
  useAccountStore.getState().removeAccount(accountId)
}

/**
 * Get the provider type from session storage
 * Used during OAuth callback handling
 */
export function getOAuthProvider(): 'gmail' | 'outlook' | null {
  const provider = sessionStorage.getItem('oauth_provider')
  if (provider === 'gmail' || provider === 'outlook') {
    return provider
  }
  return null
}

/**
 * Clear OAuth provider from session storage
 */
export function clearOAuthProvider(): void {
  sessionStorage.removeItem('oauth_provider')
}
