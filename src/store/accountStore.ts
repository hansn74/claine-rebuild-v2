/**
 * Account Store
 * Manages connected email accounts state using Zustand
 *
 * Features:
 * - Track connected accounts (max 3)
 * - Active account selection
 * - Persist active account to localStorage
 * - Integrate with tokenStorageService for account data
 */

import { create } from 'zustand'
import { logger } from '@/services/logger'

/**
 * Account data model
 * Represents a connected email account
 */
export interface Account {
  id: string // Unique account ID (email address)
  email: string // User email address
  provider: 'gmail' | 'outlook'
  displayName?: string // Optional display name
  connectedAt: number // Unix timestamp
  lastSyncAt?: number // Last successful sync timestamp
}

/**
 * Maximum number of accounts allowed
 */
export const MAX_ACCOUNTS = 3

/**
 * localStorage key for persisting active account
 */
const ACTIVE_ACCOUNT_KEY = 'claine_active_account_id'

/**
 * Account store state and actions
 */
interface AccountState {
  accounts: Account[]
  activeAccountId: string | null
  loading: boolean

  // Actions
  setActiveAccount: (accountId: string) => void
  addAccount: (account: Account) => void
  removeAccount: (accountId: string) => void
  updateAccount: (accountId: string, updates: Partial<Account>) => void
  setAccounts: (accounts: Account[]) => void
  setLoading: (loading: boolean) => void

  // Getters (computed-like)
  getActiveAccount: () => Account | undefined
  canAddAccount: () => boolean
  getAccountCount: () => number
}

/**
 * Load active account ID from localStorage
 */
function loadPersistedActiveAccount(): string | null {
  try {
    return localStorage.getItem(ACTIVE_ACCOUNT_KEY)
  } catch {
    return null
  }
}

/**
 * Persist active account ID to localStorage
 */
function persistActiveAccount(accountId: string | null): void {
  try {
    if (accountId) {
      localStorage.setItem(ACTIVE_ACCOUNT_KEY, accountId)
    } else {
      localStorage.removeItem(ACTIVE_ACCOUNT_KEY)
    }
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Account store using Zustand
 * Follows project convention from database.ts
 */
export const useAccountStore = create<AccountState>((set, get) => ({
  accounts: [],
  activeAccountId: loadPersistedActiveAccount(),
  loading: false,

  /**
   * Set the active account
   * Persists to localStorage for restoration on app launch
   */
  setActiveAccount: (accountId: string) => {
    const { accounts } = get()
    // Only set if account exists
    if (accounts.some((a) => a.id === accountId)) {
      set({ activeAccountId: accountId })
      persistActiveAccount(accountId)
    }
  },

  /**
   * Add a new account
   * Enforces MAX_ACCOUNTS limit
   */
  addAccount: (account: Account) => {
    const { accounts, activeAccountId } = get()

    // Enforce account limit
    if (accounts.length >= MAX_ACCOUNTS) {
      logger.warn('auth', `Cannot add account: maximum ${MAX_ACCOUNTS} accounts reached`, {
        currentCount: accounts.length,
        maxAccounts: MAX_ACCOUNTS,
      })
      return
    }

    // Don't add duplicates
    if (accounts.some((a) => a.id === account.id)) {
      logger.warn('auth', 'Account already exists', {
        accountId: account.id,
      })
      return
    }

    const newAccounts = [...accounts, account]
    set({ accounts: newAccounts })

    // If no active account, set this as active
    if (!activeAccountId) {
      set({ activeAccountId: account.id })
      persistActiveAccount(account.id)
    }
  },

  /**
   * Remove an account
   * Updates active account if needed
   */
  removeAccount: (accountId: string) => {
    const { accounts, activeAccountId } = get()
    const newAccounts = accounts.filter((a) => a.id !== accountId)

    set({ accounts: newAccounts })

    // If removed account was active, switch to first remaining or null
    if (activeAccountId === accountId) {
      const newActive = newAccounts[0]?.id ?? null
      set({ activeAccountId: newActive })
      persistActiveAccount(newActive)
    }
  },

  /**
   * Update account properties
   */
  updateAccount: (accountId: string, updates: Partial<Account>) => {
    const { accounts } = get()
    const newAccounts = accounts.map((a) => (a.id === accountId ? { ...a, ...updates } : a))
    set({ accounts: newAccounts })
  },

  /**
   * Set all accounts (for initial load from storage)
   * Validates active account still exists
   */
  setAccounts: (accounts: Account[]) => {
    const { activeAccountId } = get()
    set({ accounts })

    // Validate active account still exists
    if (activeAccountId && !accounts.some((a) => a.id === activeAccountId)) {
      // Active account was removed, select first or null
      const newActive = accounts[0]?.id ?? null
      set({ activeAccountId: newActive })
      persistActiveAccount(newActive)
    } else if (!activeAccountId && accounts.length > 0) {
      // No active account but accounts exist, select first
      set({ activeAccountId: accounts[0].id })
      persistActiveAccount(accounts[0].id)
    }
  },

  /**
   * Set loading state
   */
  setLoading: (loading: boolean) => set({ loading }),

  /**
   * Get the currently active account
   */
  getActiveAccount: () => {
    const { accounts, activeAccountId } = get()
    return accounts.find((a) => a.id === activeAccountId)
  },

  /**
   * Check if more accounts can be added
   */
  canAddAccount: () => {
    const { accounts } = get()
    return accounts.length < MAX_ACCOUNTS
  },

  /**
   * Get current account count
   */
  getAccountCount: () => {
    const { accounts } = get()
    return accounts.length
  },
}))

/**
 * Expose account store for E2E testing in development mode
 */
if (import.meta.env.DEV) {
  ;(
    window as unknown as { __TEST_ACCOUNT_STORE__: typeof useAccountStore }
  ).__TEST_ACCOUNT_STORE__ = useAccountStore
}
