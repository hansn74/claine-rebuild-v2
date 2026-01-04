/**
 * AccountListItem Component
 * Individual account display in the account switcher dropdown
 *
 * AC6: Clear indication of which account is currently active (checkmark)
 */

import type { Account } from '@/store/accountStore'

export interface AccountListItemProps {
  account: Account
  isActive: boolean
  onClick: () => void
}

/**
 * AccountListItem component
 * Displays account info with active indicator
 */
export function AccountListItem({ account, isActive, onClick }: AccountListItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-slate-50 transition-colors ${
        isActive ? 'bg-cyan-50' : ''
      }`}
      role="option"
      aria-selected={isActive}
    >
      {/* Provider icon */}
      <ProviderIcon provider={account.provider} />

      {/* Account info */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-900 truncate">
          {account.displayName || account.email}
        </div>
        {account.displayName && (
          <div className="text-xs text-slate-500 truncate">{account.email}</div>
        )}
        <div className="text-xs text-slate-400">
          {account.provider === 'gmail' ? 'Gmail' : 'Outlook'}
        </div>
      </div>

      {/* Active indicator */}
      {isActive && <CheckIcon className="w-4 h-4 text-cyan-600 flex-shrink-0" />}
    </button>
  )
}

/**
 * Provider icon component
 */
function ProviderIcon({ provider }: { provider: 'gmail' | 'outlook' }) {
  if (provider === 'gmail') {
    return (
      <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
          <path
            d="M22 6L12 13L2 6V4L12 11L22 4V6ZM2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6L12 13L2 6Z"
            fill="#EA4335"
          />
        </svg>
      </div>
    )
  }

  // Outlook icon
  return (
    <div className="w-8 h-8 rounded-full bg-cyan-100 flex items-center justify-center flex-shrink-0">
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
        <path
          d="M7 3H17C18.1 3 19 3.9 19 5V19C19 20.1 18.1 21 17 21H7C5.9 21 5 20.1 5 19V5C5 3.9 5.9 3 7 3ZM12 15.5L17 11V7L12 11.5L7 7V11L12 15.5Z"
          fill="#0078D4"
        />
      </svg>
    </div>
  )
}

/**
 * Check icon component
 */
function CheckIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  )
}
