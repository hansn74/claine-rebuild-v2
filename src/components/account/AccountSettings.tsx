/**
 * AccountSettings Component
 * Account management page with list of connected accounts and disconnect functionality
 *
 * AC1: List all connected accounts with details
 * AC5: "Disconnect" button per account with confirmation
 */

import { useState } from 'react'
import { useAccountStore, MAX_ACCOUNTS, type Account } from '@/store/accountStore'
import { disconnectAccount } from '@/services/auth/accountManager'
import { Button } from '@shared/components/ui/button'

export interface AccountSettingsProps {
  /** Called when settings panel should be closed */
  onClose?: () => void
  /** Called when user clicks "Connect Gmail Account" */
  onConnectGmail?: () => void
  /** Called when user clicks "Connect Outlook Account" */
  onConnectOutlook?: () => void
  /** @deprecated Use onConnectGmail instead */
  onConnectAccount?: () => void
}

/**
 * AccountSettings component
 * Full account management panel
 */
export function AccountSettings({
  onClose,
  onConnectGmail,
  onConnectOutlook,
  onConnectAccount,
}: AccountSettingsProps) {
  const accounts = useAccountStore((state) => state.accounts)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState<string | null>(null)
  const [showProviderMenu, setShowProviderMenu] = useState(false)

  const canAddMore = accounts.length < MAX_ACCOUNTS

  const handleDisconnect = async (accountId: string) => {
    setDisconnecting(accountId)
    try {
      await disconnectAccount(accountId)
    } catch (error) {
      console.error('Failed to disconnect account:', error)
    } finally {
      setDisconnecting(null)
      setShowConfirmDialog(null)
    }
  }

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return 'Never'
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="bg-white rounded-lg shadow-lg border border-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <h2 className="text-lg font-semibold text-slate-900">Connected Accounts</h2>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded"
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        )}
      </div>

      {/* Account list */}
      <div className="p-4 space-y-3">
        {accounts.length === 0 ? (
          <p className="text-slate-500 text-center py-4">No accounts connected yet</p>
        ) : (
          accounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              isDisconnecting={disconnecting === account.id}
              showConfirm={showConfirmDialog === account.id}
              onDisconnectClick={() => setShowConfirmDialog(account.id)}
              onConfirmDisconnect={() => handleDisconnect(account.id)}
              onCancelDisconnect={() => setShowConfirmDialog(null)}
              formatDate={formatDate}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 rounded-b-lg">
        {canAddMore ? (
          !showProviderMenu ? (
            <Button
              onClick={() => {
                // If new props provided, show provider menu; otherwise use legacy behavior
                if (onConnectGmail || onConnectOutlook) {
                  setShowProviderMenu(true)
                } else {
                  onConnectAccount?.()
                }
              }}
              className="w-full"
              variant="outline"
            >
              <PlusIcon />
              Connect another account ({accounts.length}/{MAX_ACCOUNTS})
            </Button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                Choose provider
              </p>
              <Button
                onClick={() => {
                  onConnectGmail?.()
                  onClose?.()
                }}
                className="w-full justify-start"
                variant="outline"
              >
                <GmailIcon />
                <span className="ml-2">Gmail</span>
              </Button>
              <Button
                onClick={() => {
                  onConnectOutlook?.()
                  onClose?.()
                }}
                className="w-full justify-start"
                variant="outline"
              >
                <OutlookIcon />
                <span className="ml-2">Outlook</span>
              </Button>
              <Button
                onClick={() => setShowProviderMenu(false)}
                variant="ghost"
                size="sm"
                className="w-full text-slate-500"
              >
                ← Back
              </Button>
            </div>
          )
        ) : (
          <p className="text-sm text-slate-500 text-center">
            Maximum {MAX_ACCOUNTS} accounts reached. Disconnect an account to add another.
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * Individual account card with details and disconnect button
 */
interface AccountCardProps {
  account: Account
  isDisconnecting: boolean
  showConfirm: boolean
  onDisconnectClick: () => void
  onConfirmDisconnect: () => void
  onCancelDisconnect: () => void
  formatDate: (timestamp?: number) => string
}

function AccountCard({
  account,
  isDisconnecting,
  showConfirm,
  onDisconnectClick,
  onConfirmDisconnect,
  onCancelDisconnect,
  formatDate,
}: AccountCardProps) {
  return (
    <div className="border border-slate-200 rounded-lg p-3">
      {/* Account info */}
      <div className="flex items-start gap-3">
        <ProviderIcon provider={account.provider} />

        <div className="flex-1 min-w-0">
          <div className="font-medium text-slate-900 truncate">
            {account.displayName || account.email}
          </div>
          {account.displayName && (
            <div className="text-sm text-slate-500 truncate">{account.email}</div>
          )}
          <div className="text-xs text-slate-400 mt-1">
            {account.provider === 'gmail' ? 'Gmail' : 'Outlook'}
          </div>
        </div>
      </div>

      {/* Sync info */}
      <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-slate-500">Connected:</span>
          <div className="text-slate-700">{formatDate(account.connectedAt)}</div>
        </div>
        <div>
          <span className="text-slate-500">Last sync:</span>
          <div className="text-slate-700">{formatDate(account.lastSyncAt)}</div>
        </div>
      </div>

      {/* Disconnect section */}
      <div className="mt-3 pt-3 border-t border-slate-100">
        {showConfirm ? (
          <div className="space-y-2">
            <p className="text-sm text-red-600">
              This will remove all emails for this account from your device. Continue?
            </p>
            <div className="flex gap-2">
              <Button
                onClick={onConfirmDisconnect}
                variant="destructive"
                size="sm"
                disabled={isDisconnecting}
                className="flex-1"
              >
                {isDisconnecting ? 'Disconnecting...' : 'Yes, Disconnect'}
              </Button>
              <Button
                onClick={onCancelDisconnect}
                variant="outline"
                size="sm"
                disabled={isDisconnecting}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            onClick={onDisconnectClick}
            variant="ghost"
            size="sm"
            className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            Disconnect
          </Button>
        )}
      </div>
    </div>
  )
}

/**
 * Provider icon component
 */
function ProviderIcon({ provider }: { provider: 'gmail' | 'outlook' }) {
  if (provider === 'gmail') {
    return (
      <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
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
    <div className="w-10 h-10 rounded-full bg-cyan-100 flex items-center justify-center flex-shrink-0">
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
        <path
          d="M7 3H17C18.1 3 19 3.9 19 5V19C19 20.1 18.1 21 17 21H7C5.9 21 5 20.1 5 19V5C5 3.9 5.9 3 7 3ZM12 15.5L17 11V7L12 11.5L7 7V11L12 15.5Z"
          fill="#0078D4"
        />
      </svg>
    </div>
  )
}

/**
 * Plus icon component
 */
function PlusIcon() {
  return (
    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  )
}

/**
 * Close icon component
 */
function CloseIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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
        d="M7 3H17C18.1 3 19 3.9 19 5V19C19 20.1 18.1 21 17 21H7C5.9 21 5 20.1 5 19V5C5 3.9 5.9 3 7 3ZM12 15.5L17 11V7L12 11.5L7 7V11L12 15.5Z"
        fill="#0078D4"
      />
    </svg>
  )
}
