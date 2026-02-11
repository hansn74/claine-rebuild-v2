/**
 * Unit tests for AccountSwitcher component
 * Tests AC1: Account switcher UI implemented
 * Tests AC4: User can switch between accounts
 * Tests AC5: Account limit visual indicator
 * Tests AC6: Active account indicator
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AccountSwitcher } from '../AccountSwitcher'
import * as accountStoreModule from '@/store/accountStore'
import type { Account } from '@/store/accountStore'

// Mock the account store
vi.mock('@/store/accountStore', async () => {
  const actual = await vi.importActual('@/store/accountStore')
  return {
    ...actual,
    useAccountStore: vi.fn(),
    MAX_ACCOUNTS: 3,
  }
})

// Mock account data
const mockAccounts: Account[] = [
  {
    id: 'user@gmail.com',
    email: 'user@gmail.com',
    provider: 'gmail',
    connectedAt: Date.now() - 86400000, // 1 day ago
  },
  {
    id: 'user@outlook.com',
    email: 'user@outlook.com',
    provider: 'outlook',
    connectedAt: Date.now(),
  },
]

describe('AccountSwitcher', () => {
  const mockSetActiveAccount = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('No accounts connected', () => {
    it('shows "Connect Account" button when no accounts', () => {
      vi.mocked(accountStoreModule.useAccountStore).mockImplementation((selector) => {
        const state = {
          accounts: [],
          activeAccountId: null,
          setActiveAccount: mockSetActiveAccount,
        }
        return selector(state as accountStoreModule.AccountState)
      })

      render(<AccountSwitcher />)

      expect(screen.getByText('Connect Account')).toBeInTheDocument()
    })

    it('shows provider selection when connect button clicked', () => {
      const mockOnConnectGmail = vi.fn()
      const mockOnConnectOutlook = vi.fn()
      vi.mocked(accountStoreModule.useAccountStore).mockImplementation((selector) => {
        const state = {
          accounts: [],
          activeAccountId: null,
          setActiveAccount: mockSetActiveAccount,
        }
        return selector(state as accountStoreModule.AccountState)
      })

      render(
        <AccountSwitcher
          onConnectGmail={mockOnConnectGmail}
          onConnectOutlook={mockOnConnectOutlook}
        />
      )

      // Click to open dropdown
      fireEvent.click(screen.getByText('Connect Account'))

      // Provider selection should appear
      expect(screen.getByText('Gmail')).toBeInTheDocument()
      expect(screen.getByText('Outlook')).toBeInTheDocument()

      // Click Gmail provider
      fireEvent.click(screen.getByText('Gmail'))
      expect(mockOnConnectGmail).toHaveBeenCalledTimes(1)
    })
  })

  describe('AC1: Account switcher UI', () => {
    it('displays active account email when accounts exist', () => {
      vi.mocked(accountStoreModule.useAccountStore).mockImplementation((selector) => {
        const state = {
          accounts: mockAccounts,
          activeAccountId: 'user@gmail.com',
          setActiveAccount: mockSetActiveAccount,
        }
        return selector(state as accountStoreModule.AccountState)
      })

      render(<AccountSwitcher />)

      expect(screen.getByText('user@gmail.com')).toBeInTheDocument()
    })

    it('opens dropdown when clicked', () => {
      vi.mocked(accountStoreModule.useAccountStore).mockImplementation((selector) => {
        const state = {
          accounts: mockAccounts,
          activeAccountId: 'user@gmail.com',
          setActiveAccount: mockSetActiveAccount,
        }
        return selector(state as accountStoreModule.AccountState)
      })

      render(<AccountSwitcher />)

      // Click the dropdown trigger
      fireEvent.click(screen.getByRole('button', { expanded: false }))

      // Should see both accounts in dropdown
      expect(screen.getAllByText('user@gmail.com').length).toBeGreaterThan(0)
      expect(screen.getByText('user@outlook.com')).toBeInTheDocument()
    })

    it('shows "Connect another account" button when less than max', () => {
      vi.mocked(accountStoreModule.useAccountStore).mockImplementation((selector) => {
        const state = {
          accounts: mockAccounts, // 2 accounts, max is 3
          activeAccountId: 'user@gmail.com',
          setActiveAccount: mockSetActiveAccount,
        }
        return selector(state as accountStoreModule.AccountState)
      })

      render(<AccountSwitcher />)

      // Open dropdown
      fireEvent.click(screen.getByRole('button', { expanded: false }))

      expect(screen.getByText('Connect another account')).toBeInTheDocument()
    })
  })

  describe('AC4: Account switching', () => {
    it('calls setActiveAccount when selecting different account', () => {
      vi.mocked(accountStoreModule.useAccountStore).mockImplementation((selector) => {
        const state = {
          accounts: mockAccounts,
          activeAccountId: 'user@gmail.com',
          setActiveAccount: mockSetActiveAccount,
        }
        return selector(state as accountStoreModule.AccountState)
      })

      render(<AccountSwitcher />)

      // Open dropdown
      fireEvent.click(screen.getByRole('button', { expanded: false }))

      // Click on different account
      fireEvent.click(screen.getByText('user@outlook.com'))

      expect(mockSetActiveAccount).toHaveBeenCalledWith('user@outlook.com')
    })

    it('closes dropdown after account selection', () => {
      vi.mocked(accountStoreModule.useAccountStore).mockImplementation((selector) => {
        const state = {
          accounts: mockAccounts,
          activeAccountId: 'user@gmail.com',
          setActiveAccount: mockSetActiveAccount,
        }
        return selector(state as accountStoreModule.AccountState)
      })

      render(<AccountSwitcher />)

      // Open dropdown
      fireEvent.click(screen.getByRole('button', { expanded: false }))

      // Click on different account
      fireEvent.click(screen.getByText('user@outlook.com'))

      // Dropdown should be closed
      expect(screen.queryByText('Connect another account')).not.toBeInTheDocument()
    })
  })

  describe('AC5: Account limit indicator', () => {
    it('shows max accounts message when at limit', () => {
      const threeAccounts: Account[] = [
        ...mockAccounts,
        {
          id: 'third@example.com',
          email: 'third@example.com',
          provider: 'gmail',
          connectedAt: Date.now(),
        },
      ]

      vi.mocked(accountStoreModule.useAccountStore).mockImplementation((selector) => {
        const state = {
          accounts: threeAccounts,
          activeAccountId: 'user@gmail.com',
          setActiveAccount: mockSetActiveAccount,
        }
        return selector(state as accountStoreModule.AccountState)
      })

      render(<AccountSwitcher />)

      // Open dropdown
      fireEvent.click(screen.getByRole('button', { expanded: false }))

      // Should see max accounts message instead of connect button
      expect(screen.getByText('Maximum 3 accounts reached')).toBeInTheDocument()
      expect(screen.queryByText('Connect another account')).not.toBeInTheDocument()
    })
  })

  describe('AC6: Active account indicator', () => {
    it('shows active account with aria-selected', () => {
      vi.mocked(accountStoreModule.useAccountStore).mockImplementation((selector) => {
        const state = {
          accounts: mockAccounts,
          activeAccountId: 'user@gmail.com',
          setActiveAccount: mockSetActiveAccount,
        }
        return selector(state as accountStoreModule.AccountState)
      })

      render(<AccountSwitcher />)

      // Open dropdown
      fireEvent.click(screen.getByRole('button', { expanded: false }))

      // Active account should have aria-selected true
      const activeOption = screen.getByRole('option', { selected: true })
      expect(activeOption).toHaveTextContent('user@gmail.com')
    })
  })

  describe('Keyboard interaction', () => {
    it('closes dropdown on Escape key', () => {
      vi.mocked(accountStoreModule.useAccountStore).mockImplementation((selector) => {
        const state = {
          accounts: mockAccounts,
          activeAccountId: 'user@gmail.com',
          setActiveAccount: mockSetActiveAccount,
        }
        return selector(state as accountStoreModule.AccountState)
      })

      render(<AccountSwitcher />)

      // Open dropdown
      fireEvent.click(screen.getByRole('button', { expanded: false }))

      // Press Escape
      fireEvent.keyDown(document, { key: 'Escape' })

      // Dropdown should be closed
      expect(screen.queryByText('Connect another account')).not.toBeInTheDocument()
    })
  })
})
