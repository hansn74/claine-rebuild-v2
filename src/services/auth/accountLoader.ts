/**
 * Account Loader Service
 * Loads connected accounts from token storage into the account store
 *
 * Flow:
 * 1. Get all account IDs from token storage
 * 2. Get token metadata for each account (to determine provider)
 * 3. Build Account objects and return for store hydration
 */

import { tokenStorageService } from './tokenStorage'
import type { Account } from '@/store/accountStore'

/**
 * Load accounts from token storage
 * Creates Account objects from stored token metadata
 *
 * @returns Array of Account objects for hydrating the account store
 */
export async function loadAccountsFromStorage(): Promise<Account[]> {
  try {
    const accountIds = await tokenStorageService.getAllAccountIds()

    if (accountIds.length === 0) {
      return []
    }

    const accounts: Account[] = []

    for (const accountId of accountIds) {
      try {
        const tokens = await tokenStorageService.getTokens(accountId)

        if (tokens) {
          // Determine provider from account ID or token characteristics
          // Gmail accounts typically have @gmail.com or use Google's token format
          // For now, we'll use a simple heuristic based on email domain
          const provider = determineProvider(accountId)

          const account: Account = {
            id: accountId,
            email: accountId,
            provider,
            connectedAt: tokens.obtained_at ? new Date(tokens.obtained_at).getTime() : Date.now(),
          }

          accounts.push(account)
        }
      } catch (error) {
        console.error(`Failed to load account ${accountId}:`, error)
        // Continue loading other accounts
      }
    }

    return accounts
  } catch (error) {
    console.error('Failed to load accounts from storage:', error)
    return []
  }
}

/**
 * Determine email provider from email address
 *
 * @param email - Email address / account ID
 * @returns Provider type
 */
function determineProvider(email: string): 'gmail' | 'outlook' {
  const lowerEmail = email.toLowerCase()

  // Gmail domains
  if (
    lowerEmail.endsWith('@gmail.com') ||
    lowerEmail.endsWith('@googlemail.com') ||
    // Google Workspace domains could be anything, but we'll default based on OAuth
    lowerEmail.includes('google')
  ) {
    return 'gmail'
  }

  // Microsoft domains
  if (
    lowerEmail.endsWith('@outlook.com') ||
    lowerEmail.endsWith('@hotmail.com') ||
    lowerEmail.endsWith('@live.com') ||
    lowerEmail.endsWith('@msn.com') ||
    lowerEmail.includes('microsoft')
  ) {
    return 'outlook'
  }

  // Default to gmail for now (can be enhanced with token inspection)
  // In a real implementation, you'd check the token's issuer
  return 'gmail'
}
