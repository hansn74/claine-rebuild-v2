/**
 * AttachmentItem Component
 *
 * Story 2.2: Thread Detail View with Conversation History
 * Task 6: Implement Attachment Display
 *
 * Story 2.8: Attachment Handling
 * Task 2: Integrate Download Handler
 *
 * Displays a single attachment with icon, filename, size, and download button.
 * Supports loading state during download (AC2).
 */

import { memo, type KeyboardEvent } from 'react'
import {
  File,
  FileText,
  Image,
  FileArchive,
  FileSpreadsheet,
  FileVideo,
  FileAudio,
  FileCode,
  Download,
  Loader2,
  Eye,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import type { Attachment } from '@/services/database/schemas/email.schema'

interface AttachmentItemProps {
  /** The attachment data */
  attachment: Attachment
  /** Click handler for download */
  onDownload?: (attachment: Attachment) => void
  /** Click handler for preview (for images) */
  onPreview?: (attachment: Attachment) => void
  /** Preview URL if available (for image previews) */
  previewUrl?: string
  /** Whether this attachment is currently downloading */
  isDownloading?: boolean
  /** Optional className for styling */
  className?: string
}

/**
 * Check if MIME type is an image that can be previewed
 */
function isPreviewableImage(mimeType: string): boolean {
  const type = mimeType.toLowerCase()
  return (
    type.startsWith('image/') &&
    !type.includes('svg') && // SVG can have XSS issues
    !type.includes('tiff') // TIFF not well supported in browsers
  )
}

/**
 * Format file size in human-readable format
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`
}

/**
 * Get a color class based on MIME type for icon
 */
function getColorForMimeType(mimeType: string): string {
  const type = mimeType.toLowerCase()

  if (type.startsWith('image/')) return 'text-purple-500'
  if (type === 'application/pdf') return 'text-red-500'
  if (type.includes('spreadsheet') || type.includes('excel')) return 'text-green-500'
  if (type.includes('zip') || type.includes('archive')) return 'text-yellow-600'
  if (type.startsWith('video/')) return 'text-cyan-500'
  if (type.startsWith('audio/')) return 'text-pink-500'
  if (type.includes('document')) return 'text-cyan-600'

  return 'text-slate-500'
}

/**
 * Render icon based on MIME type
 * Returns the appropriate icon element directly instead of a component
 */
function renderIcon(mimeType: string) {
  const type = mimeType.toLowerCase()
  const className = 'w-5 h-5'

  if (type.startsWith('image/')) {
    return <Image className={className} aria-hidden="true" />
  }

  if (type === 'application/pdf' || type.includes('document')) {
    return <FileText className={className} aria-hidden="true" />
  }

  if (type.includes('spreadsheet') || type.includes('excel') || type === 'text/csv') {
    return <FileSpreadsheet className={className} aria-hidden="true" />
  }

  if (
    type.includes('zip') ||
    type.includes('tar') ||
    type.includes('rar') ||
    type.includes('7z') ||
    type.includes('gzip')
  ) {
    return <FileArchive className={className} aria-hidden="true" />
  }

  if (type.startsWith('video/')) {
    return <FileVideo className={className} aria-hidden="true" />
  }

  if (type.startsWith('audio/')) {
    return <FileAudio className={className} aria-hidden="true" />
  }

  if (
    type.startsWith('text/') ||
    type.includes('javascript') ||
    type.includes('json') ||
    type.includes('xml') ||
    type.includes('html')
  ) {
    return <FileCode className={className} aria-hidden="true" />
  }

  return <File className={className} aria-hidden="true" />
}

/**
 * Single attachment item display
 */
export const AttachmentItem = memo(function AttachmentItem({
  attachment,
  onDownload,
  onPreview,
  previewUrl,
  isDownloading = false,
  className,
}: AttachmentItemProps) {
  const iconColor = getColorForMimeType(attachment.mimeType)
  const canPreview = isPreviewableImage(attachment.mimeType) && (onPreview || previewUrl)

  const handleDownload = () => {
    if (!isDownloading) {
      onDownload?.(attachment)
    }
  }

  const handlePreview = () => {
    if (canPreview) {
      onPreview?.(attachment)
    }
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleDownload()
    }
  }

  const handlePreviewKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handlePreview()
    }
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 p-2 rounded-lg',
        'bg-slate-50 hover:bg-slate-100',
        'border border-slate-200',
        'transition-colors duration-150',
        'group',
        isDownloading && 'opacity-70',
        className
      )}
    >
      {/* Icon or thumbnail preview */}
      <div
        className={cn('flex-shrink-0', canPreview ? 'cursor-pointer' : '', iconColor)}
        onClick={canPreview ? handlePreview : undefined}
        onKeyDown={canPreview ? handlePreviewKeyDown : undefined}
        role={canPreview ? 'button' : undefined}
        tabIndex={canPreview ? 0 : undefined}
        aria-label={canPreview ? `Preview ${attachment.filename}` : undefined}
      >
        {previewUrl ? (
          <img src={previewUrl} alt="" className="w-8 h-8 object-cover rounded" />
        ) : (
          renderIcon(attachment.mimeType)
        )}
      </div>

      {/* File info */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-700 truncate" title={attachment.filename}>
          {attachment.filename}
        </div>
        <div className="text-xs text-slate-500">
          {isDownloading ? 'Downloading...' : formatFileSize(attachment.size)}
        </div>
      </div>

      {/* Preview button (for images) */}
      {canPreview && (
        <button
          type="button"
          onClick={handlePreview}
          onKeyDown={handlePreviewKeyDown}
          className={cn(
            'flex-shrink-0 p-1.5 rounded',
            'text-slate-400 hover:text-purple-600',
            'hover:bg-slate-200',
            'opacity-0 group-hover:opacity-100',
            'transition-all duration-150',
            'focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-1'
          )}
          aria-label={`Preview ${attachment.filename}`}
          title={`Preview ${attachment.filename}`}
        >
          <Eye className="w-4 h-4" />
        </button>
      )}

      {/* Download button / Loading indicator */}
      <button
        type="button"
        onClick={handleDownload}
        onKeyDown={handleKeyDown}
        disabled={isDownloading}
        className={cn(
          'flex-shrink-0 p-1.5 rounded',
          'text-slate-400 hover:text-slate-600',
          'hover:bg-slate-200',
          !isDownloading && 'opacity-0 group-hover:opacity-100',
          isDownloading && 'opacity-100 cursor-wait',
          'transition-all duration-150',
          'focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-1',
          'disabled:cursor-wait'
        )}
        aria-label={
          isDownloading ? `Downloading ${attachment.filename}` : `Download ${attachment.filename}`
        }
        title={isDownloading ? 'Downloading...' : `Download ${attachment.filename}`}
      >
        {isDownloading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Download className="w-4 h-4" />
        )}
      </button>
    </div>
  )
})
