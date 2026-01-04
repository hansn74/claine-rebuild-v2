/**
 * AttachmentList Component
 *
 * Story 2.2: Thread Detail View with Conversation History
 * Task 6: Implement Attachment Display
 *
 * Story 2.8: Attachment Handling
 * Task 2: Integrate Download Handler
 * Task 3.3: Image preview modal integration
 *
 * Displays a list of email attachments with icons and download capability.
 * When accountId and emailId are provided, handles actual downloads (AC2).
 * Image attachments can be previewed in a fullscreen modal.
 */

import { memo, useState, useCallback, useMemo } from 'react'
import { Paperclip, AlertCircle } from 'lucide-react'
import { cn } from '@/utils/cn'
import { AttachmentItem } from './AttachmentItem'
import { ImagePreviewModal } from './ImagePreviewModal'
import { useAttachmentDownload } from '@/hooks/useAttachmentDownload'
import { useAttachmentPreviews } from '@/hooks/useAttachmentPreview'
import type { Attachment } from '@/services/database/schemas/email.schema'

interface AttachmentListProps {
  /** Array of attachments to display */
  attachments: Attachment[]
  /** Account ID for attachment download (required for real downloads) */
  accountId?: string
  /** Email ID for attachment download (required for real downloads) */
  emailId?: string
  /** Legacy handler for download clicks (used when accountId/emailId not provided) */
  onDownload?: (attachment: Attachment) => void
  /** Whether to show only non-inline attachments */
  excludeInline?: boolean
  /** Optional className for styling */
  className?: string
}

interface PreviewState {
  isOpen: boolean
  src: string
  alt: string
  filename?: string
  attachmentId?: string
}

/**
 * Check if MIME type is a previewable image
 */
function isPreviewableImage(mimeType: string): boolean {
  const type = mimeType.toLowerCase()
  return type.startsWith('image/') && !type.includes('svg') && !type.includes('tiff')
}

/**
 * Get provider from email ID
 */
function getProvider(emailId: string): 'gmail' | 'outlook' {
  return emailId.startsWith('outlook-') ? 'outlook' : 'gmail'
}

/**
 * List of attachments with header
 */
export const AttachmentList = memo(function AttachmentList({
  attachments,
  accountId,
  emailId,
  onDownload,
  excludeInline = true,
  className,
}: AttachmentListProps) {
  // Filter attachments - by default exclude inline (those shown in body)
  const displayAttachments = excludeInline
    ? attachments.filter((att) => !att.isInline)
    : attachments

  // Use the download hook when accountId and emailId are provided
  const canDownload = Boolean(accountId && emailId)
  const downloadHook = useAttachmentDownload(accountId || '', emailId || '')

  // Get image attachment IDs for preview fetching
  const imageAttachmentIds = useMemo(
    () => displayAttachments.filter((att) => isPreviewableImage(att.mimeType)).map((att) => att.id),
    [displayAttachments]
  )

  // Fetch previews for image attachments
  const provider = emailId ? getProvider(emailId) : 'gmail'
  const previews = useAttachmentPreviews(
    accountId || '',
    emailId || '',
    imageAttachmentIds,
    provider
  )

  // Local error state for showing error messages
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Preview modal state
  const [previewState, setPreviewState] = useState<PreviewState>({
    isOpen: false,
    src: '',
    alt: '',
  })

  // Handle download with error feedback
  const handleDownload = useCallback(
    async (attachment: Attachment) => {
      setErrorMessage(null)

      if (canDownload) {
        try {
          await downloadHook.downloadAttachment(attachment)
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Download failed'
          setErrorMessage(message)
          // Auto-clear after 5 seconds
          setTimeout(() => setErrorMessage(null), 5000)
        }
      } else {
        // Fallback to legacy handler
        onDownload?.(attachment)
      }
    },
    [canDownload, downloadHook, onDownload]
  )

  // Handle preview click
  const handlePreview = useCallback(
    (attachment: Attachment) => {
      const preview = previews[attachment.id]
      if (preview?.url) {
        setPreviewState({
          isOpen: true,
          src: preview.url,
          alt: attachment.filename,
          filename: attachment.filename,
          attachmentId: attachment.id,
        })
      }
    },
    [previews]
  )

  // Close preview modal
  const handleClosePreview = useCallback(() => {
    setPreviewState((prev) => ({ ...prev, isOpen: false }))
  }, [])

  // Handle download from preview modal
  const handlePreviewDownload = useCallback(() => {
    if (previewState.attachmentId) {
      const attachment = displayAttachments.find((att) => att.id === previewState.attachmentId)
      if (attachment) {
        handleDownload(attachment)
      }
    }
  }, [previewState.attachmentId, displayAttachments, handleDownload])

  if (displayAttachments.length === 0) {
    return null
  }

  return (
    <div className={cn('mt-4', className)}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-2 text-sm text-slate-500">
        <Paperclip className="w-4 h-4" aria-hidden="true" />
        <span>
          {displayAttachments.length} attachment{displayAttachments.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Error message */}
      {errorMessage && (
        <div className="flex items-center gap-2 p-2 mb-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Attachment grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {displayAttachments.map((attachment) => {
          const preview = previews[attachment.id]
          const isImage = isPreviewableImage(attachment.mimeType)

          return (
            <AttachmentItem
              key={attachment.id}
              attachment={attachment}
              onDownload={handleDownload}
              onPreview={isImage && preview?.url ? handlePreview : undefined}
              previewUrl={isImage && preview?.url ? preview.url : undefined}
              isDownloading={canDownload ? downloadHook.isDownloading(attachment.id) : false}
            />
          )
        })}
      </div>

      {/* Image preview modal */}
      <ImagePreviewModal
        isOpen={previewState.isOpen}
        onClose={handleClosePreview}
        src={previewState.src}
        alt={previewState.alt}
        filename={previewState.filename}
        onDownload={handlePreviewDownload}
      />
    </div>
  )
})
