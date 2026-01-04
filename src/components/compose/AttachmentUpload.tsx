/**
 * AttachmentUpload Component
 *
 * Story 2.8: Attachment Handling
 * Task 4: Compose Attachment Support (AC: 6)
 *
 * Provides drag-and-drop and click-to-upload file attachment for compose.
 * Features:
 * - Drag-and-drop file handling (AC6)
 * - Click-to-upload with file picker
 * - Display attached files with remove option
 * - Size validation (max 25MB per attachment, Gmail limit)
 */

import { useState, useRef, useCallback, type DragEvent, type ChangeEvent } from 'react'
import { Paperclip, X, Upload, File } from 'lucide-react'
import { cn } from '@/utils/cn'
import { logger } from '@/services/logger'

/**
 * Compose attachment with file data
 */
export interface ComposeAttachment {
  /** Unique identifier for the attachment */
  id: string
  /** Original filename */
  filename: string
  /** MIME type */
  mimeType: string
  /** File size in bytes */
  size: number
  /** File object for upload */
  file: File
}

interface AttachmentUploadProps {
  /** Current list of attachments */
  attachments: ComposeAttachment[]
  /** Called when attachments change */
  onChange: (attachments: ComposeAttachment[]) => void
  /** Maximum file size in bytes (default: 25MB) */
  maxSize?: number
  /** Optional className */
  className?: string
}

/** Default max size: 25 MB (Gmail limit) */
const DEFAULT_MAX_SIZE = 25 * 1024 * 1024

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`
}

/**
 * Generate unique ID for attachment
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Convert a File to base64 encoded string
 * Used for sending attachments via email APIs
 */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      // Remove the data URL prefix (e.g., "data:application/pdf;base64,")
      const result = reader.result as string
      const base64 = result.split(',')[1]
      resolve(base64)
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

/**
 * Convert ComposeAttachment to SendQueueAttachment format with base64 content
 */
export async function prepareAttachmentsForSend(
  attachments: ComposeAttachment[]
): Promise<{ id: string; filename: string; mimeType: string; size: number; content: string }[]> {
  return Promise.all(
    attachments.map(async (att) => ({
      id: att.id,
      filename: att.filename,
      mimeType: att.mimeType,
      size: att.size,
      content: await fileToBase64(att.file),
    }))
  )
}

/**
 * Attachment upload component for compose dialog
 */
export function AttachmentUpload({
  attachments,
  onChange,
  maxSize = DEFAULT_MAX_SIZE,
  className,
}: AttachmentUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  /**
   * Add files to attachments list
   */
  const addFiles = useCallback(
    (files: FileList | File[]) => {
      setError(null)
      const fileArray = Array.from(files)
      const newAttachments: ComposeAttachment[] = []
      const errors: string[] = []

      for (const file of fileArray) {
        // Validate file size
        if (file.size > maxSize) {
          errors.push(`"${file.name}" exceeds ${formatFileSize(maxSize)} limit`)
          continue
        }

        // Check for duplicate
        const isDuplicate = attachments.some(
          (att) => att.filename === file.name && att.size === file.size
        )
        if (isDuplicate) {
          errors.push(`"${file.name}" is already attached`)
          continue
        }

        newAttachments.push({
          id: generateId(),
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
          file,
        })
      }

      if (errors.length > 0) {
        setError(errors.join('. '))
      }

      if (newAttachments.length > 0) {
        logger.info('compose', 'Files attached', {
          count: newAttachments.length,
          totalSize: newAttachments.reduce((sum, att) => sum + att.size, 0),
        })
        onChange([...attachments, ...newAttachments])
      }
    },
    [attachments, onChange, maxSize]
  )

  /**
   * Remove an attachment
   */
  const removeAttachment = useCallback(
    (id: string) => {
      logger.debug('compose', 'Removing attachment', { id })
      onChange(attachments.filter((att) => att.id !== id))
    },
    [attachments, onChange]
  )

  /**
   * Handle drag over event
   */
  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  /**
   * Handle drag leave event
   */
  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  /**
   * Handle drop event (Task 4.2)
   */
  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)

      const files = e.dataTransfer?.files
      if (files && files.length > 0) {
        addFiles(files)
      }
    },
    [addFiles]
  )

  /**
   * Handle file input change (Task 4.3)
   */
  const handleFileInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (files && files.length > 0) {
        addFiles(files)
      }
      // Reset input so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    },
    [addFiles]
  )

  /**
   * Open file picker
   */
  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  return (
    <div className={cn('border-t border-slate-100', className)}>
      {/* Drag-and-drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'px-4 py-3',
          isDragOver && 'bg-cyan-50 border-dashed border-2 border-cyan-300'
        )}
      >
        {/* Upload button and attached files */}
        <div className="flex items-center gap-2">
          {/* Attach button */}
          <button
            type="button"
            onClick={openFilePicker}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5',
              'text-sm text-slate-600 hover:text-slate-800',
              'rounded-md border border-slate-300 hover:border-slate-400',
              'transition-colors'
            )}
          >
            <Paperclip className="w-4 h-4" />
            <span>Attach</span>
          </button>

          {/* Drag hint */}
          {attachments.length === 0 && !isDragOver && (
            <span className="text-xs text-slate-400">or drag files here</span>
          )}

          {/* Drag overlay indicator */}
          {isDragOver && (
            <div className="flex items-center gap-2 text-sm text-cyan-600">
              <Upload className="w-4 h-4" />
              <span>Drop files to attach</span>
            </div>
          )}
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileInputChange}
          className="hidden"
          aria-label="Attach files"
        />

        {/* Error message */}
        {error && <div className="mt-2 text-sm text-red-600">{error}</div>}

        {/* Attached files list (Task 4.4) */}
        {attachments.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className={cn(
                  'flex items-center gap-2 px-2 py-1',
                  'bg-slate-100 rounded-md',
                  'text-sm text-slate-700',
                  'group'
                )}
              >
                <File className="w-4 h-4 text-slate-500" />
                <span className="max-w-[150px] truncate" title={attachment.filename}>
                  {attachment.filename}
                </span>
                <span className="text-xs text-slate-500">({formatFileSize(attachment.size)})</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(attachment.id)}
                  className={cn(
                    'p-0.5 rounded',
                    'text-slate-400 hover:text-red-500',
                    'hover:bg-slate-200',
                    'transition-colors'
                  )}
                  aria-label={`Remove ${attachment.filename}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Total size indicator */}
        {attachments.length > 0 && (
          <div className="mt-2 text-xs text-slate-500">
            Total: {formatFileSize(attachments.reduce((sum, att) => sum + att.size, 0))}
            {attachments.length > 1 && ` (${attachments.length} files)`}
          </div>
        )}
      </div>
    </div>
  )
}
