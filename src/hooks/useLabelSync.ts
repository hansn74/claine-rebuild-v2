/**
 * Hook for syncing labels/folders from email providers
 *
 * Story 2.9: Email Folders & Labels
 * Task 2.4: Store labels in folder store
 * Task 2.5: Display user-created Gmail labels in sidebar
 * Task 3.3: Store Outlook folders in same structure as Gmail labels
 *
 * Fetches labels from Gmail and/or Outlook based on connected accounts
 * and stores them in the folder store for display in the sidebar.
 */

import { useEffect, useCallback } from 'react'
import { useFolderStore } from '@/store/folderStore'
import { useAccountStore } from '@/store/accountStore'
import { useDatabaseStore } from '@/store/database'
import { labelService } from '@/services/email/labelService'
import { logger } from '@/services/logger'

/**
 * Hook to sync labels/folders from email providers
 *
 * Automatically fetches labels when:
 * - Database is initialized
 * - Account changes
 * - Manual refresh is triggered
 *
 * Usage:
 * ```tsx
 * function App() {
 *   const { refreshLabels, loading } = useLabelSync()
 *
 *   return (
 *     <button onClick={refreshLabels} disabled={loading}>
 *       Refresh Labels
 *     </button>
 *   )
 * }
 * ```
 */
export function useLabelSync(): {
  refreshLabels: () => Promise<void>
  loading: boolean
} {
  const initialized = useDatabaseStore((state) => state.initialized)
  const accounts = useAccountStore((state) => state.accounts)
  const setGmailLabels = useFolderStore((state) => state.setGmailLabels)
  const setOutlookFolders = useFolderStore((state) => state.setOutlookFolders)
  const setLoading = useFolderStore((state) => state.setLoading)
  const loading = useFolderStore((state) => state.loading)

  /**
   * Fetch labels from all connected accounts
   */
  const refreshLabels = useCallback(async () => {
    if (!initialized || accounts.length === 0) {
      return
    }

    setLoading(true)

    try {
      // Separate Gmail and Outlook accounts
      const gmailAccounts = accounts.filter((acc) => acc.provider === 'gmail')
      const outlookAccounts = accounts.filter((acc) => acc.provider === 'outlook')

      // Fetch Gmail labels from all Gmail accounts
      if (gmailAccounts.length > 0) {
        const allGmailLabels = await Promise.all(
          gmailAccounts.map(async (account) => {
            try {
              return await labelService.fetchGmailLabels(account.id)
            } catch (error) {
              logger.error('label-sync', 'Failed to fetch Gmail labels', {
                accountId: account.id,
                error: error instanceof Error ? error.message : String(error),
              })
              return []
            }
          })
        )

        // Merge labels from all Gmail accounts (dedupe by id)
        const labelMap = new Map<string, (typeof allGmailLabels)[0][0]>()
        for (const labels of allGmailLabels) {
          for (const label of labels) {
            if (!labelMap.has(label.id)) {
              labelMap.set(label.id, label)
            }
          }
        }

        setGmailLabels(Array.from(labelMap.values()))
      }

      // Fetch Outlook folders from all Outlook accounts
      if (outlookAccounts.length > 0) {
        const allOutlookFolders = await Promise.all(
          outlookAccounts.map(async (account) => {
            try {
              return await labelService.fetchOutlookFolders(account.id)
            } catch (error) {
              logger.error('label-sync', 'Failed to fetch Outlook folders', {
                accountId: account.id,
                error: error instanceof Error ? error.message : String(error),
              })
              return []
            }
          })
        )

        // Merge folders from all Outlook accounts (dedupe by id)
        const folderMap = new Map<string, (typeof allOutlookFolders)[0][0]>()
        for (const folders of allOutlookFolders) {
          for (const folder of folders) {
            if (!folderMap.has(folder.id)) {
              folderMap.set(folder.id, folder)
            }
          }
        }

        setOutlookFolders(Array.from(folderMap.values()))
      }

      logger.info('label-sync', 'Labels synced successfully', {
        gmailAccountCount: gmailAccounts.length,
        outlookAccountCount: outlookAccounts.length,
      })
    } catch (error) {
      logger.error('label-sync', 'Failed to sync labels', {
        error: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setLoading(false)
    }
  }, [initialized, accounts, setGmailLabels, setOutlookFolders, setLoading])

  // Auto-sync labels when database initializes or accounts change
  useEffect(() => {
    if (initialized && accounts.length > 0) {
      refreshLabels()
    }
  }, [initialized, accounts.length, refreshLabels])

  return { refreshLabels, loading }
}
