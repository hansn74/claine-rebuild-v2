/**
 * SyncButton Component
 *
 * Story 2.7: Offline Mode Indicators & Conflict Resolution
 * AC 6: Manual sync trigger available in settings
 *
 * Provides a button to manually trigger email sync.
 * Disabled when offline, shows spinner during sync.
 */

import { useState, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@shared/components/ui/button'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { syncOrchestratorService } from '@/services/sync/syncOrchestrator'
import { emailActionQueue } from '@/services/email/emailActionQueue'
import { useAccountStore } from '@/store/accountStore'
import { logger } from '@/services/logger'
import { cn } from '@/utils/cn'

export interface SyncButtonProps {
  /** Button variant */
  variant?: 'default' | 'outline' | 'ghost'
  /** Button size */
  size?: 'default' | 'sm' | 'lg' | 'icon'
  /** Additional CSS classes */
  className?: string
  /** Show text label */
  showLabel?: boolean
}

/**
 * SyncButton component
 * Triggers manual sync for the active account
 */
export function SyncButton({
  variant = 'ghost',
  size = 'sm',
  className = '',
  showLabel = false,
}: SyncButtonProps) {
  const { isOnline } = useNetworkStatus()
  const activeAccountId = useAccountStore((state) => state.activeAccountId)
  const [isSyncing, setIsSyncing] = useState(false)

  const handleSync = useCallback(async () => {
    if (!isOnline || isSyncing || !activeAccountId) {
      return
    }

    setIsSyncing(true)
    logger.info('sync', 'Manual sync triggered', { accountId: activeAccountId })

    try {
      // Trigger sync orchestrator for the account
      if (syncOrchestratorService) {
        await syncOrchestratorService.triggerSync(activeAccountId)
      }

      // Also process any pending action queue items
      await emailActionQueue.processQueue()

      logger.info('sync', 'Manual sync completed', { accountId: activeAccountId })
    } catch (error) {
      logger.error('sync', 'Manual sync failed', {
        accountId: activeAccountId,
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setIsSyncing(false)
    }
  }, [isOnline, isSyncing, activeAccountId])

  const isDisabled = !isOnline || isSyncing || !activeAccountId

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleSync}
      disabled={isDisabled}
      className={cn('gap-2', className)}
      aria-label={
        !isOnline ? 'Sync unavailable - offline' : isSyncing ? 'Syncing in progress...' : 'Sync now'
      }
      title={
        !isOnline
          ? 'Cannot sync while offline'
          : !activeAccountId
            ? 'No account selected'
            : 'Sync emails'
      }
    >
      <RefreshCw className={cn('h-4 w-4', isSyncing && 'animate-spin')} aria-hidden="true" />
      {showLabel && <span>{isSyncing ? 'Syncing...' : 'Sync'}</span>}
    </Button>
  )
}

/**
 * SyncIconButton - Compact icon-only sync button
 * For use in toolbars or tight spaces
 */
export function SyncIconButton({ className = '' }: { className?: string }) {
  return <SyncButton size="icon" variant="ghost" className={className} />
}
