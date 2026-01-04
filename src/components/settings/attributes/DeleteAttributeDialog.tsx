/**
 * DeleteAttributeDialog Component
 * Confirmation dialog for deleting an attribute
 *
 * Story 2.13: Custom Attributes System
 * Task 5.5: Add delete confirmation dialog
 */

import { memo } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@shared/components/ui/button'
import type { Attribute } from '@/types/attributes'

export interface DeleteAttributeDialogProps {
  attribute: Attribute
  onConfirm: () => void
  onCancel: () => void
  isDeleting?: boolean
}

/**
 * DeleteAttributeDialog component
 */
export const DeleteAttributeDialog = memo(function DeleteAttributeDialog({
  attribute,
  onConfirm,
  onCancel,
  isDeleting = false,
}: DeleteAttributeDialogProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        {/* Content */}
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-slate-900">Delete Attribute</h3>
              <p className="mt-2 text-sm text-slate-500">
                Are you sure you want to delete the attribute{' '}
                <strong className="text-slate-900">{attribute.displayName}</strong>?
              </p>
              <p className="mt-2 text-sm text-slate-500">
                This will remove the attribute definition. Any emails currently using this attribute
                will retain their values but will not be editable through the attribute system.
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-lg">
          <Button variant="outline" onClick={onCancel} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? 'Deleting...' : 'Delete Attribute'}
          </Button>
        </div>
      </div>
    </div>
  )
})

export default DeleteAttributeDialog
