/**
 * React hook for downloading email attachments
 *
 * Story 2.8: Attachment Handling
 * Task 2: Integrate Download Handler
 *
 * Provides attachment download functionality with:
 * - Loading state tracking per attachment
 * - Error handling with user feedback
 * - Provider detection (Gmail vs Outlook)
 *
 * Usage:
 * ```tsx
 * const { downloadAttachment, isDownloading, error } = useAttachmentDownload(
 *   accountId,
 *   emailId
 * )
 *
 * <button
 *   onClick={() => downloadAttachment(attachment)}
 *   disabled={isDownloading(attachment.id)}
 * >
 *   {isDownloading(attachment.id) ? 'Downloading...' : 'Download'}
 * </button>
 * ```
 */

import { useState, useCallback } from 'react'
import { attachmentService } from '@/services/email'
import { logger } from '@/services/logger'
import type { Attachment } from '@/services/database/schemas/email.schema'

export interface UseAttachmentDownloadResult {
  /** Download an attachment (fetches and triggers browser download) */
  downloadAttachment: (attachment: Attachment) => Promise<void>
  /** Check if a specific attachment is currently downloading */
  isDownloading: (attachmentId: string) => boolean
  /** The last error that occurred, if any */
  error: Error | null
  /** Clear the current error */
  clearError: () => void
}

/**
 * Hook for downloading email attachments
 *
 * @param accountId - The account ID for authentication
 * @param emailId - The email message ID (may include provider prefix like 'outlook-')
 * @returns Download functions and state
 */
export function useAttachmentDownload(
  accountId: string,
  emailId: string
): UseAttachmentDownloadResult {
  // Track which attachments are currently downloading
  const [downloading, setDownloading] = useState<Set<string>>(new Set())
  const [error, setError] = useState<Error | null>(null)

  /**
   * Detect provider from email ID format
   * Gmail IDs are alphanumeric, Outlook IDs are prefixed with 'outlook-'
   */
  const getProvider = useCallback((id: string): 'gmail' | 'outlook' => {
    return id.startsWith('outlook-') ? 'outlook' : 'gmail'
  }, [])

  /**
   * Get the raw message ID without provider prefix
   */
  const getRawEmailId = useCallback((id: string): string => {
    return id.startsWith('outlook-') ? id.slice(8) : id
  }, [])

  /**
   * Download an attachment
   */
  const downloadAttachment = useCallback(
    async (attachment: Attachment): Promise<void> => {
      // Clear any previous error
      setError(null)

      // Mark as downloading
      setDownloading((prev) => new Set(prev).add(attachment.id))

      logger.info('attachment-hook', 'Starting attachment download', {
        accountId,
        emailId: emailId.slice(0, 20),
        attachmentId: attachment.id.slice(0, 20),
        filename: attachment.filename,
      })

      try {
        const provider = getProvider(emailId)
        const rawEmailId = getRawEmailId(emailId)

        await attachmentService.downloadAttachment(accountId, rawEmailId, attachment, provider)

        logger.info('attachment-hook', 'Attachment download completed', {
          filename: attachment.filename,
        })
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Download failed'
        const error = new Error(errorMessage)

        logger.error('attachment-hook', 'Attachment download failed', {
          accountId,
          emailId: emailId.slice(0, 20),
          attachmentId: attachment.id.slice(0, 20),
          error: errorMessage,
        })

        setError(error)
        throw error
      } finally {
        // Remove from downloading set
        setDownloading((prev) => {
          const next = new Set(prev)
          next.delete(attachment.id)
          return next
        })
      }
    },
    [accountId, emailId, getProvider, getRawEmailId]
  )

  /**
   * Check if an attachment is currently downloading
   */
  const isDownloading = useCallback(
    (attachmentId: string): boolean => {
      return downloading.has(attachmentId)
    },
    [downloading]
  )

  /**
   * Clear the current error
   */
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    downloadAttachment,
    isDownloading,
    error,
    clearError,
  }
}
