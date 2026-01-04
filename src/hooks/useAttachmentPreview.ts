/**
 * React hook for fetching attachment previews (images)
 *
 * Story 2.8: Attachment Handling
 * Task 3: Image Inline Preview (AC: 4)
 *
 * Provides image attachment preview functionality with:
 * - Blob URL generation for inline display
 * - Automatic cleanup on unmount
 * - Loading and error states
 * - Caching via attachmentService
 *
 * Usage:
 * ```tsx
 * const { previewUrl, isLoading, error } = useAttachmentPreview(
 *   accountId,
 *   emailId,
 *   attachmentId,
 *   'gmail'
 * )
 *
 * {previewUrl && <img src={previewUrl} alt="preview" />}
 * ```
 */

import { useState, useEffect, useRef, useMemo } from 'react'
import { attachmentService } from '@/services/email'
import { logger } from '@/services/logger'

export interface UseAttachmentPreviewResult {
  /** Blob URL for the attachment (or null if not loaded) */
  previewUrl: string | null
  /** Whether the attachment is currently loading */
  isLoading: boolean
  /** Error if fetch failed */
  error: Error | null
}

/**
 * Hook for fetching a single attachment preview
 *
 * @param accountId - Account ID for authentication
 * @param emailId - Email message ID (may include provider prefix)
 * @param attachmentId - Attachment ID to fetch
 * @param provider - 'gmail' or 'outlook'
 * @param enabled - Whether to fetch (defaults to true)
 * @returns Preview URL and loading state
 */
export function useAttachmentPreview(
  accountId: string,
  emailId: string,
  attachmentId: string,
  provider: 'gmail' | 'outlook',
  enabled = true
): UseAttachmentPreviewResult {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // Track the created blob URL to revoke on cleanup
  const blobUrlRef = useRef<string | null>(null)

  useEffect(() => {
    // Skip if not enabled or missing required params
    if (!enabled || !accountId || !emailId || !attachmentId) {
      return
    }

    let isMounted = true

    const fetchPreview = async () => {
      setIsLoading(true)
      setError(null)

      try {
        // Get raw email ID (strip provider prefix for API)
        const rawEmailId = emailId.startsWith('outlook-') ? emailId.slice(8) : emailId

        logger.debug('attachment-preview', 'Fetching preview', {
          accountId,
          emailId: emailId.slice(0, 20),
          attachmentId: attachmentId.slice(0, 20),
          provider,
        })

        const blob = await attachmentService.fetchAttachment(
          accountId,
          rawEmailId,
          attachmentId,
          provider
        )

        if (!isMounted) return

        // Create blob URL
        const url = URL.createObjectURL(blob)
        blobUrlRef.current = url
        setPreviewUrl(url)

        logger.debug('attachment-preview', 'Preview loaded', {
          attachmentId: attachmentId.slice(0, 20),
          size: blob.size,
        })
      } catch (err) {
        if (!isMounted) return

        const errorObj = err instanceof Error ? err : new Error('Failed to load preview')
        logger.error('attachment-preview', 'Preview fetch failed', {
          attachmentId: attachmentId.slice(0, 20),
          error: errorObj.message,
        })
        setError(errorObj)
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    fetchPreview()

    // Cleanup on unmount or dependency change
    return () => {
      isMounted = false
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
    }
  }, [accountId, emailId, attachmentId, provider, enabled])

  return {
    previewUrl,
    isLoading,
    error,
  }
}

/**
 * Result type for batch preview hook
 */
export interface AttachmentPreviewMap {
  [attachmentId: string]: {
    url: string | null
    isLoading: boolean
    error: Error | null
  }
}

/**
 * Hook for fetching multiple attachment previews
 * Useful for loading all inline images in an email
 *
 * @param accountId - Account ID
 * @param emailId - Email message ID
 * @param attachmentIds - Array of attachment IDs to fetch
 * @param provider - 'gmail' or 'outlook'
 * @returns Map of attachment ID to preview state
 */
export function useAttachmentPreviews(
  accountId: string,
  emailId: string,
  attachmentIds: string[],
  provider: 'gmail' | 'outlook'
): AttachmentPreviewMap {
  // Serialize attachment IDs for stable dependency comparison
  const attachmentIdsKey = attachmentIds.join(',')

  // Create initial state with loading for all IDs
  const initialState = useMemo(() => {
    const state: AttachmentPreviewMap = {}
    for (const id of attachmentIds) {
      state[id] = { url: null, isLoading: true, error: null }
    }
    return state
  }, [attachmentIdsKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const [previews, setPreviews] = useState<AttachmentPreviewMap>(initialState)
  const blobUrlsRef = useRef<Map<string, string>>(new Map())

  // Reset previews when attachmentIds change
  useEffect(() => {
    setPreviews(initialState)
  }, [initialState])

  useEffect(() => {
    // Skip if no attachments or missing required params
    if (!accountId || !emailId || attachmentIds.length === 0) {
      return
    }

    let isMounted = true

    // Copy ref for cleanup
    const blobUrls = blobUrlsRef.current

    // Fetch all attachments concurrently
    const fetchAll = async () => {
      const rawEmailId = emailId.startsWith('outlook-') ? emailId.slice(8) : emailId

      const results = await Promise.allSettled(
        attachmentIds.map(async (attachmentId) => {
          const blob = await attachmentService.fetchAttachment(
            accountId,
            rawEmailId,
            attachmentId,
            provider
          )
          return { attachmentId, blob }
        })
      )

      if (!isMounted) return

      const newPreviews: AttachmentPreviewMap = {}

      for (let i = 0; i < results.length; i++) {
        const result = results[i]
        const attachmentId = attachmentIds[i]

        if (result.status === 'fulfilled') {
          const url = URL.createObjectURL(result.value.blob)
          blobUrls.set(attachmentId, url)
          newPreviews[attachmentId] = { url, isLoading: false, error: null }
        } else {
          newPreviews[attachmentId] = {
            url: null,
            isLoading: false,
            error: result.reason instanceof Error ? result.reason : new Error('Failed to load'),
          }
        }
      }

      setPreviews(newPreviews)
    }

    fetchAll()

    // Cleanup on unmount
    return () => {
      isMounted = false
      for (const url of blobUrls.values()) {
        URL.revokeObjectURL(url)
      }
      blobUrls.clear()
    }
  }, [accountId, emailId, attachmentIdsKey, provider, attachmentIds])

  return previews
}
