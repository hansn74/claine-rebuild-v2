/**
 * Unit tests for accountStore
 * Tests account management and persistence
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAccountStore, MAX_ACCOUNTS, type Account } from '../accountStore'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
  }
})()

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
})

// Mock account data
const createMockAccount = (id: string, provider: 'gmail' | 'outlook' = 'gmail'): Account => ({
  id,
  email: id,
  provider,
  connectedAt: Date.now(),
})

describe('accountStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useAccountStore.setState({
      accounts: [],
      activeAccountId: null,
      loading: false,
    })
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  describe('MAX_ACCOUNTS constant', () => {
    it('should be 3', () => {
      expect(MAX_ACCOUNTS).toBe(3)
    })
  })

  describe('addAccount', () => {
    it('adds a new account', () => {
      const account = createMockAccount('user@gmail.com')
      useAccountStore.getState().addAccount(account)

      expect(useAccountStore.getState().accounts).toHaveLength(1)
      expect(useAccountStore.getState().accounts[0].email).toBe('user@gmail.com')
    })

    it('sets first account as active automatically', () => {
      const account = createMockAccount('user@gmail.com')
      useAccountStore.getState().addAccount(account)

      expect(useAccountStore.getState().activeAccountId).toBe('user@gmail.com')
    })

    it('persists active account to localStorage', () => {
      const account = createMockAccount('user@gmail.com')
      useAccountStore.getState().addAccount(account)

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'claine_active_account_id',
        'user@gmail.com'
      )
    })

    it('does not change active account when adding second account', () => {
      const account1 = createMockAccount('first@gmail.com')
      const account2 = createMockAccount('second@outlook.com', 'outlook')

      useAccountStore.getState().addAccount(account1)
      useAccountStore.getState().addAccount(account2)

      expect(useAccountStore.getState().activeAccountId).toBe('first@gmail.com')
      expect(useAccountStore.getState().accounts).toHaveLength(2)
    })

    it('prevents adding duplicate accounts', () => {
      const account = createMockAccount('user@gmail.com')
      useAccountStore.getState().addAccount(account)
      useAccountStore.getState().addAccount(account) // Try to add again

      expect(useAccountStore.getState().accounts).toHaveLength(1)
    })

    it('enforces MAX_ACCOUNTS limit', () => {
      useAccountStore.getState().addAccount(createMockAccount('one@gmail.com'))
      useAccountStore.getState().addAccount(createMockAccount('two@outlook.com', 'outlook'))
      useAccountStore.getState().addAccount(createMockAccount('three@gmail.com'))
      useAccountStore.getState().addAccount(createMockAccount('four@outlook.com', 'outlook'))

      expect(useAccountStore.getState().accounts).toHaveLength(MAX_ACCOUNTS)
      expect(useAccountStore.getState().accounts.map((a) => a.id)).not.toContain('four@outlook.com')
    })
  })

  describe('removeAccount', () => {
    it('removes an account', () => {
      useAccountStore.getState().addAccount(createMockAccount('user@gmail.com'))
      useAccountStore.getState().removeAccount('user@gmail.com')

      expect(useAccountStore.getState().accounts).toHaveLength(0)
    })

    it('switches active account when active is removed', () => {
      useAccountStore.getState().addAccount(createMockAccount('first@gmail.com'))
      useAccountStore.getState().addAccount(createMockAccount('second@outlook.com', 'outlook'))
      useAccountStore.getState().setActiveAccount('first@gmail.com')

      useAccountStore.getState().removeAccount('first@gmail.com')

      expect(useAccountStore.getState().activeAccountId).toBe('second@outlook.com')
    })

    it('sets activeAccountId to null when last account removed', () => {
      useAccountStore.getState().addAccount(createMockAccount('user@gmail.com'))
      useAccountStore.getState().removeAccount('user@gmail.com')

      expect(useAccountStore.getState().activeAccountId).toBeNull()
    })
  })

  describe('setActiveAccount', () => {
    it('sets active account', () => {
      useAccountStore.getState().addAccount(createMockAccount('first@gmail.com'))
      useAccountStore.getState().addAccount(createMockAccount('second@outlook.com', 'outlook'))

      useAccountStore.getState().setActiveAccount('second@outlook.com')

      expect(useAccountStore.getState().activeAccountId).toBe('second@outlook.com')
    })

    it('persists active account to localStorage', () => {
      useAccountStore.getState().addAccount(createMockAccount('first@gmail.com'))
      useAccountStore.getState().addAccount(createMockAccount('second@outlook.com', 'outlook'))

      vi.clearAllMocks()
      useAccountStore.getState().setActiveAccount('second@outlook.com')

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'claine_active_account_id',
        'second@outlook.com'
      )
    })

    it('ignores setting non-existent account as active', () => {
      useAccountStore.getState().addAccount(createMockAccount('user@gmail.com'))
      useAccountStore.getState().setActiveAccount('nonexistent@gmail.com')

      expect(useAccountStore.getState().activeAccountId).toBe('user@gmail.com')
    })
  })

  describe('updateAccount', () => {
    it('updates account properties', () => {
      useAccountStore.getState().addAccount(createMockAccount('user@gmail.com'))

      useAccountStore.getState().updateAccount('user@gmail.com', {
        displayName: 'Test User',
        lastSyncAt: 12345,
      })

      const account = useAccountStore.getState().accounts[0]
      expect(account.displayName).toBe('Test User')
      expect(account.lastSyncAt).toBe(12345)
    })
  })

  describe('setAccounts (hydration)', () => {
    it('sets all accounts at once', () => {
      const accounts = [
        createMockAccount('one@gmail.com'),
        createMockAccount('two@outlook.com', 'outlook'),
      ]

      useAccountStore.getState().setAccounts(accounts)

      expect(useAccountStore.getState().accounts).toHaveLength(2)
    })

    it('selects first account if no active account set', () => {
      const accounts = [
        createMockAccount('one@gmail.com'),
        createMockAccount('two@outlook.com', 'outlook'),
      ]

      useAccountStore.getState().setAccounts(accounts)

      expect(useAccountStore.getState().activeAccountId).toBe('one@gmail.com')
    })

    it('validates persisted active account still exists', () => {
      // Pre-set activeAccountId that won't exist in new accounts
      useAccountStore.setState({ activeAccountId: 'removed@gmail.com' })

      const accounts = [
        createMockAccount('one@gmail.com'),
        createMockAccount('two@outlook.com', 'outlook'),
      ]

      useAccountStore.getState().setAccounts(accounts)

      // Should fall back to first account
      expect(useAccountStore.getState().activeAccountId).toBe('one@gmail.com')
    })
  })

  describe('getActiveAccount', () => {
    it('returns active account', () => {
      const account = createMockAccount('user@gmail.com')
      useAccountStore.getState().addAccount(account)

      const activeAccount = useAccountStore.getState().getActiveAccount()

      expect(activeAccount?.email).toBe('user@gmail.com')
    })

    it('returns undefined when no accounts', () => {
      const activeAccount = useAccountStore.getState().getActiveAccount()

      expect(activeAccount).toBeUndefined()
    })
  })

  describe('canAddAccount', () => {
    it('returns true when under limit', () => {
      useAccountStore.getState().addAccount(createMockAccount('user@gmail.com'))

      expect(useAccountStore.getState().canAddAccount()).toBe(true)
    })

    it('returns false when at limit', () => {
      useAccountStore.getState().addAccount(createMockAccount('one@gmail.com'))
      useAccountStore.getState().addAccount(createMockAccount('two@outlook.com', 'outlook'))
      useAccountStore.getState().addAccount(createMockAccount('three@gmail.com'))

      expect(useAccountStore.getState().canAddAccount()).toBe(false)
    })
  })

  describe('getAccountCount', () => {
    it('returns correct count', () => {
      expect(useAccountStore.getState().getAccountCount()).toBe(0)

      useAccountStore.getState().addAccount(createMockAccount('user@gmail.com'))
      expect(useAccountStore.getState().getAccountCount()).toBe(1)

      useAccountStore.getState().addAccount(createMockAccount('user@outlook.com', 'outlook'))
      expect(useAccountStore.getState().getAccountCount()).toBe(2)
    })
  })
})
