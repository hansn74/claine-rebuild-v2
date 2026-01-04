/**
 * AccountSwitcher Component
 * Dropdown for switching between connected email accounts
 *
 * AC1: Account switcher UI implemented (dropdown)
 * AC4: User can switch between accounts seamlessly
 * AC5: Account connection limit enforced (visual indicator)
 * AC6: Clear indication of which account is currently active
 */

import { useState, useRef, useEffect } from 'react'
import { useAccountStore, MAX_ACCOUNTS, type Account } from '@/store/accountStore'
import { AccountListItem } from './AccountListItem'

export interface AccountSwitcherProps {
  /** Called when user clicks "Connect Account" */
  onConnectAccount?: () => void
}

/**
 * AccountSwitcher component
 * Displays current account and dropdown for switching
 */
export function AccountSwitcher({ onConnectAccount }: AccountSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const accounts = useAccountStore((state) => state.accounts)
  const activeAccountId = useAccountStore((state) => state.activeAccountId)
  const setActiveAccount = useAccountStore((state) => state.setActiveAccount)

  const activeAccount = accounts.find((a) => a.id === activeAccountId)
  const canAddMore = accounts.length < MAX_ACCOUNTS

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Close on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  const handleAccountSelect = (account: Account) => {
    setActiveAccount(account.id)
    setIsOpen(false)
  }

  const handleConnectClick = () => {
    setIsOpen(false)
    onConnectAccount?.()
  }

  // No accounts connected yet
  if (accounts.length === 0) {
    return (
      <button
        onClick={onConnectAccount}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50 rounded-md transition-colors"
      >
        <PlusIcon />
        Connect Account
      </button>
    )
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger button - shows active account */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {activeAccount && (
          <>
            <ProviderIcon provider={activeAccount.provider} />
            <span className="max-w-[150px] truncate">{activeAccount.email}</span>
          </>
        )}
        <ChevronDownIcon className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute right-0 mt-1 w-72 bg-white rounded-md shadow-lg border border-slate-200 py-1 z-50">
          {/* Account list */}
          <div className="max-h-64 overflow-y-auto">
            {accounts.map((account) => (
              <AccountListItem
                key={account.id}
                account={account}
                isActive={account.id === activeAccountId}
                onClick={() => handleAccountSelect(account)}
              />
            ))}
          </div>

          {/* Divider */}
          {canAddMore && <div className="border-t border-slate-200 my-1" />}

          {/* Connect another account button */}
          {canAddMore && (
            <button
              onClick={handleConnectClick}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-cyan-600 hover:bg-cyan-50 transition-colors"
            >
              <PlusIcon />
              Connect another account
            </button>
          )}

          {/* Account limit indicator */}
          {!canAddMore && (
            <>
              <div className="border-t border-slate-200 my-1" />
              <div className="px-3 py-2 text-xs text-slate-500">
                Maximum {MAX_ACCOUNTS} accounts reached
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Provider icon component
 */
function ProviderIcon({ provider }: { provider: 'gmail' | 'outlook' }) {
  if (provider === 'gmail') {
    return (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
        <path
          d="M22 6L12 13L2 6V4L12 11L22 4V6ZM2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6L12 13L2 6Z"
          fill="#EA4335"
        />
      </svg>
    )
  }

  // Outlook icon
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM8 17L4 12L5.41 10.59L8 13.17L18.59 2.58L20 4L8 17Z"
        fill="#0078D4"
      />
    </svg>
  )
}

/**
 * Plus icon component
 */
function PlusIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  )
}

/**
 * Chevron down icon component
 */
function ChevronDownIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={`w-4 h-4 ${className}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )
}
