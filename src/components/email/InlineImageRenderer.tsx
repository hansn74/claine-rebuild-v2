/**
 * InlineImageRenderer Component
 *
 * Story 2.8: Attachment Handling
 * Task 3: Image Inline Preview (AC: 4)
 * Task 3.3: Add preview modal for full-size image viewing
 *
 * Renders email HTML content with inline images loaded from attachments.
 * Replaces cid: references with actual blob URLs fetched from the API.
 * Clicking on an image opens a full-screen preview modal.
 */

import { useMemo, memo, useState, useCallback, useEffect, useRef } from 'react'
import { useAttachmentPreviews } from '@/hooks/useAttachmentPreview'
import { sanitizeEmailHtml } from '@/utils/sanitizeHtml'
import { ImagePreviewModal } from './ImagePreviewModal'
import type { Attachment } from '@/services/database/schemas/email.schema'

interface InlineImageRendererProps {
  /** HTML content with potential cid: references */
  html: string
  /** Inline attachments to fetch */
  inlineAttachments: Attachment[]
  /** Account ID for fetching */
  accountId: string
  /** Email ID for fetching */
  emailId: string
  /** Optional className */
  className?: string
}

interface PreviewState {
  isOpen: boolean
  src: string
  alt: string
  filename?: string
}

/**
 * Get provider from email ID
 */
function getProvider(emailId: string): 'gmail' | 'outlook' {
  return emailId.startsWith('outlook-') ? 'outlook' : 'gmail'
}

/**
 * Renders email HTML with inline images
 * Fetches inline attachments and replaces cid: references with blob URLs
 */
export const InlineImageRenderer = memo(function InlineImageRenderer({
  html,
  inlineAttachments,
  accountId,
  emailId,
  className,
}: InlineImageRendererProps) {
  const provider = getProvider(emailId)
  const containerRef = useRef<HTMLDivElement>(null)

  // Preview modal state
  const [previewState, setPreviewState] = useState<PreviewState>({
    isOpen: false,
    src: '',
    alt: '',
  })

  // Get IDs of inline attachments that need fetching
  const inlineAttachmentIds = useMemo(
    () => inlineAttachments.map((att) => att.id),
    [inlineAttachments]
  )

  // Fetch all inline attachments
  const previews = useAttachmentPreviews(accountId, emailId, inlineAttachmentIds, provider)

  // Build content ID to blob URL map and filename map
  const { contentIdMap, filenameMap } = useMemo(() => {
    const urlMap: Record<string, string> = {}
    const nameMap: Record<string, string> = {}

    for (const attachment of inlineAttachments) {
      if (attachment.contentId) {
        const cleanId = attachment.contentId.replace(/^<|>$/g, '')
        const preview = previews[attachment.id]
        if (preview?.url) {
          urlMap[cleanId] = preview.url
          nameMap[preview.url] = attachment.filename
        }
      }
    }

    return { contentIdMap: urlMap, filenameMap: nameMap }
  }, [inlineAttachments, previews])

  // Replace cid: references with blob URLs and sanitize
  const processedHtml = useMemo(() => {
    // Replace cid: references and add click handler class
    let processed = html.replace(/src=["']cid:([^"']+)["']/gi, (_match, contentId) => {
      const cleanId = contentId.replace(/^<|>$/g, '')
      const url = contentIdMap[cleanId]
      if (url) {
        return `src="${url}" class="cursor-pointer hover:opacity-80 transition-opacity" data-previewable="true"`
      }
      // If not loaded yet, show placeholder
      return `src="" data-cid="${cleanId}" class="inline-image-loading"`
    })

    // Sanitize HTML
    return sanitizeEmailHtml(processed)
  }, [html, contentIdMap])

  // Check if any images are still loading
  const hasLoadingImages = useMemo(() => {
    return inlineAttachmentIds.some((id) => previews[id]?.isLoading)
  }, [inlineAttachmentIds, previews])

  // Handle image click for preview
  const handleImageClick = useCallback(
    (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'IMG' && target.getAttribute('data-previewable') === 'true') {
        const img = target as HTMLImageElement
        const src = img.src
        const alt = img.alt || 'Image preview'
        const filename = filenameMap[src]

        setPreviewState({
          isOpen: true,
          src,
          alt,
          filename,
        })
      }
    },
    [filenameMap]
  )

  // Close preview modal
  const handleClosePreview = useCallback(() => {
    setPreviewState((prev) => ({ ...prev, isOpen: false }))
  }, [])

  // Add click listener to container
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const clickHandler = (e: Event) => handleImageClick(e as unknown as MouseEvent)
    container.addEventListener('click', clickHandler)
    return () => {
      container.removeEventListener('click', clickHandler)
    }
  }, [handleImageClick])

  return (
    <div className={className}>
      {/* Loading indicator for inline images */}
      {hasLoadingImages && <div className="text-xs text-slate-400 mb-2">Loading images...</div>}

      {/* Rendered HTML content */}
      <div
        ref={containerRef}
        className="prose prose-sm max-w-none prose-gray"
        dangerouslySetInnerHTML={{ __html: processedHtml }}
      />

      {/* Image preview modal */}
      <ImagePreviewModal
        isOpen={previewState.isOpen}
        onClose={handleClosePreview}
        src={previewState.src}
        alt={previewState.alt}
        filename={previewState.filename}
      />
    </div>
  )
})
