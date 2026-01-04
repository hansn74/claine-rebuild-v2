/**
 * DeleteConfirmDialog Component
 *
 * Story 2.6: Email Actions (Archive, Delete, Mark Read/Unread)
 * Task 4.5: Add confirmation dialog for delete action
 *
 * Simple confirmation dialog for delete actions.
 * Shown before permanently deleting emails (optional).
 */

import { useEffect, useRef } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { cn } from '@/utils/cn'

interface DeleteConfirmDialogProps {
  /** Whether the dialog is open */
  open: boolean
  /** Number of emails to be deleted */
  count: number
  /** Handler when user confirms deletion */
  onConfirm: () => void
  /** Handler when user cancels */
  onCancel: () => void
  /** Whether the action is in progress */
  isLoading?: boolean
}

/**
 * DeleteConfirmDialog - Confirmation before delete
 *
 * Usage:
 * ```tsx
 * <DeleteConfirmDialog
 *   open={showDeleteConfirm}
 *   count={selectedIds.size}
 *   onConfirm={handleConfirmDelete}
 *   onCancel={() => setShowDeleteConfirm(false)}
 * />
 * ```
 */
export function DeleteConfirmDialog({
  open,
  count,
  onConfirm,
  onCancel,
  isLoading = false,
}: DeleteConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const confirmButtonRef = useRef<HTMLButtonElement>(null)

  // Focus management
  useEffect(() => {
    if (open && confirmButtonRef.current) {
      confirmButtonRef.current.focus()
    }
  }, [open])

  // Handle escape key
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onCancel])

  // Handle click outside
  useEffect(() => {
    if (!open) return

    const handleClickOutside = (e: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        onCancel()
      }
    }

    // Delay to prevent immediate close
    const timeoutId = setTimeout(() => {
      window.addEventListener('click', handleClickOutside)
    }, 100)

    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('click', handleClickOutside)
    }
  }, [open, onCancel])

  if (!open) {
    return null
  }

  const emailText = count === 1 ? 'email' : 'emails'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-confirm-title"
    >
      <div
        ref={dialogRef}
        className={cn(
          'bg-white rounded-lg shadow-xl max-w-md w-full mx-4',
          'animate-in fade-in zoom-in-95 duration-200'
        )}
      >
        {/* Header */}
        <div className="flex items-start gap-4 p-6 pb-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-1">
            <h2 id="delete-confirm-title" className="text-lg font-semibold text-slate-900">
              Delete {count} {emailText}?
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {count === 1
                ? 'This email will be moved to Trash. You can restore it from Trash later.'
                : `These ${count} emails will be moved to Trash. You can restore them from Trash later.`}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-600 p-1 -m-1 rounded"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 rounded-b-lg">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className={cn(
              'px-4 py-2 text-sm font-medium text-slate-700 bg-white',
              'border border-slate-300 rounded-md shadow-sm',
              'hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-gray-500',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            Cancel
          </button>
          <button
            ref={confirmButtonRef}
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={cn(
              'px-4 py-2 text-sm font-medium text-white',
              'bg-red-600 rounded-md shadow-sm',
              'hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                Deleting...
              </span>
            ) : (
              `Delete ${emailText}`
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
