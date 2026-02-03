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
  /** Called when user clicks "Connect Gmail Account" */
  onConnectGmail?: () => void
  /** Called when user clicks "Connect Outlook Account" */
  onConnectOutlook?: () => void
  /** Called when user clicks "Manage accounts" */
  onManageAccounts?: () => void
  /** @deprecated Use onConnectGmail instead */
  onConnectAccount?: () => void
}

/**
 * AccountSwitcher component
 * Displays current account and dropdown for switching
 */
export function AccountSwitcher({
  onConnectGmail,
  onConnectOutlook,
  onManageAccounts,
  onConnectAccount,
}: AccountSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [showProviderMenu, setShowProviderMenu] = useState(false)
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
    // If new props provided, show provider menu; otherwise use legacy behavior
    if (onConnectGmail || onConnectOutlook) {
      setShowProviderMenu(true)
    } else {
      setIsOpen(false)
      onConnectAccount?.()
    }
  }

  const handleProviderSelect = (provider: 'gmail' | 'outlook') => {
    setIsOpen(false)
    setShowProviderMenu(false)
    if (provider === 'gmail') {
      onConnectGmail?.()
    } else {
      onConnectOutlook?.()
    }
  }

  // No accounts connected yet - show provider selection dropdown
  if (accounts.length === 0) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-cyan-600 hover:text-cyan-700 hover:bg-cyan-50 rounded-md transition-colors"
        >
          <PlusIcon />
          Connect Account
          <ChevronDownIcon className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-slate-200 py-1 z-50">
            <div className="px-3 py-1 text-xs font-medium text-slate-500 uppercase tracking-wide">
              Choose provider
            </div>
            <button
              onClick={() => handleProviderSelect('gmail')}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <GmailIcon />
              Gmail
            </button>
            <button
              onClick={() => handleProviderSelect('outlook')}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <OutlookIcon />
              Outlook
            </button>
          </div>
        )}
      </div>
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

          {/* Connect another account button / Provider selection */}
          {canAddMore && !showProviderMenu && (
            <button
              onClick={handleConnectClick}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-cyan-600 hover:bg-cyan-50 transition-colors"
            >
              <PlusIcon />
              Connect another account
            </button>
          )}

          {/* Provider selection menu */}
          {canAddMore && showProviderMenu && (
            <div className="py-1">
              <div className="px-3 py-1 text-xs font-medium text-slate-500 uppercase tracking-wide">
                Choose provider
              </div>
              <button
                onClick={() => handleProviderSelect('gmail')}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <GmailIcon />
                Gmail
              </button>
              <button
                onClick={() => handleProviderSelect('outlook')}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <OutlookIcon />
                Outlook
              </button>
              <button
                onClick={() => setShowProviderMenu(false)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
              >
                ← Back
              </button>
            </div>
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

          {/* Manage accounts link */}
          <div className="border-t border-slate-200 my-1" />
          <button
            onClick={() => {
              setIsOpen(false)
              onManageAccounts?.()
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <SettingsIcon />
            Manage accounts
          </button>
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

/**
 * Gmail icon for provider selection
 */
function GmailIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
      <path
        d="M20 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6C22 4.9 21.1 4 20 4ZM20 8L12 13L4 8V6L12 11L20 6V8Z"
        fill="#EA4335"
      />
    </svg>
  )
}

/**
 * Outlook icon for provider selection
 */
function OutlookIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20ZM11 7H13V13H11V7ZM11 15H13V17H11V15Z"
        fill="#0078D4"
      />
    </svg>
  )
}

/**
 * Settings icon for manage accounts
 */
function SettingsIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  )
}
