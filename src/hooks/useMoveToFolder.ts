/**
 * Hook for moving emails to folders/labels
 *
 * Story 2.9: Email Folders & Labels
 * Task 4.1: Create useMoveToFolder hook for managing move operations
 *
 * Provides a simple interface for moving emails between folders.
 * Handles provider detection, optimistic updates, and error handling.
 */

import { useState, useCallback } from 'react'
import { moveService, type MoveResult } from '@/services/email/moveService'
import { useAccountStore } from '@/store/accountStore'
import { logger } from '@/services/logger'

/**
 * Hook state for move operations
 */
export interface UseMoveToFolderResult {
  /** Move a single email to a folder */
  moveEmail: (emailId: string, targetFolder: string) => Promise<MoveResult | null>
  /** Move multiple emails to a folder */
  moveEmails: (emailIds: string[], targetFolder: string) => Promise<MoveResult[]>
  /** Whether a move operation is in progress */
  loading: boolean
  /** Error message from last operation */
  error: string | null
  /** Clear the error state */
  clearError: () => void
}

/**
 * Hook for moving emails between folders
 *
 * Usage:
 * ```tsx
 * function MoveToFolderButton({ emailId }: { emailId: string }) {
 *   const { moveEmail, loading, error } = useMoveToFolder()
 *
 *   const handleMove = async () => {
 *     const result = await moveEmail(emailId, 'archive')
 *     if (result?.success) {
 *       console.log('Email moved to archive')
 *     }
 *   }
 *
 *   return (
 *     <button onClick={handleMove} disabled={loading}>
 *       Archive
 *     </button>
 *   )
 * }
 * ```
 */
export function useMoveToFolder(): UseMoveToFolderResult {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const accounts = useAccountStore((state) => state.accounts)
  const activeAccountId = useAccountStore((state) => state.activeAccountId)

  /**
   * Get provider type for an account
   */
  const getProvider = useCallback(
    (accountId?: string): 'gmail' | 'outlook' | null => {
      const targetAccountId = accountId || activeAccountId
      if (!targetAccountId) return null

      const account = accounts.find((acc) => acc.id === targetAccountId)
      if (!account) return null

      return account.provider as 'gmail' | 'outlook'
    },
    [accounts, activeAccountId]
  )

  /**
   * Move a single email to a folder
   */
  const moveEmail = useCallback(
    async (emailId: string, targetFolder: string): Promise<MoveResult | null> => {
      setError(null)
      setLoading(true)

      try {
        const accountId = activeAccountId
        if (!accountId) {
          throw new Error('No active account')
        }

        const provider = getProvider(accountId)
        if (!provider) {
          throw new Error('Unable to determine email provider')
        }

        const result = await moveService.moveEmail(emailId, targetFolder, accountId, provider)

        if (!result.success && result.error) {
          setError(result.error)
        }

        return result
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to move email'
        setError(errorMessage)
        logger.error('use-move-to-folder', 'Move failed', {
          emailId,
          targetFolder,
          error: errorMessage,
        })
        return null
      } finally {
        setLoading(false)
      }
    },
    [activeAccountId, getProvider]
  )

  /**
   * Move multiple emails to a folder
   */
  const moveEmails = useCallback(
    async (emailIds: string[], targetFolder: string): Promise<MoveResult[]> => {
      setError(null)
      setLoading(true)

      try {
        const accountId = activeAccountId
        if (!accountId) {
          throw new Error('No active account')
        }

        const provider = getProvider(accountId)
        if (!provider) {
          throw new Error('Unable to determine email provider')
        }

        const results = await moveService.moveEmails(emailIds, targetFolder, accountId, provider)

        // Check for any failures
        const failures = results.filter((r) => !r.success)
        if (failures.length > 0) {
          const failureMessages = failures
            .map((f) => f.error)
            .filter(Boolean)
            .join(', ')
          setError(`Failed to move ${failures.length} email(s): ${failureMessages}`)
        }

        return results
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to move emails'
        setError(errorMessage)
        logger.error('use-move-to-folder', 'Bulk move failed', {
          count: emailIds.length,
          targetFolder,
          error: errorMessage,
        })
        return []
      } finally {
        setLoading(false)
      }
    },
    [activeAccountId, getProvider]
  )

  /**
   * Clear the error state
   */
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    moveEmail,
    moveEmails,
    loading,
    error,
    clearError,
  }
}
