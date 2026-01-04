/**
 * AttributeManager Component
 * Main component for managing custom attributes
 *
 * Story 2.13: Custom Attributes System
 * Task 5.1: Create AttributeManager.tsx main component
 *
 * AC 3: Settings UI for attribute management: Create, Read, Update, Delete
 * AC 4: Built-in attribute presets available
 * AC 5: User can enable/disable built-in presets
 */

import { useState, useCallback, useEffect } from 'react'
import { useAttributes } from '@/hooks/useAttributes'
import { useAttributeStore } from '@/store/attributeStore'
import { initializeAttributePresets } from '@/services/attributes/presetInitializer'
import { AttributeList } from './AttributeList'
import { AttributeForm } from './AttributeForm'
import { DeleteAttributeDialog } from './DeleteAttributeDialog'
import type { Attribute, CreateAttributeInput, UpdateAttributeInput } from '@/types/attributes'

export interface AttributeManagerProps {
  className?: string
}

/**
 * AttributeManager component
 * Main container for attribute management UI
 */
export function AttributeManager({ className = '' }: AttributeManagerProps) {
  const {
    attributes,
    loading,
    error,
    addAttribute,
    updateAttribute,
    deleteAttribute,
    toggleAttribute,
    refreshAttributes,
    clearError,
  } = useAttributes()

  // Modal states
  const [showForm, setShowForm] = useState(false)
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create')
  const [editingAttribute, setEditingAttribute] = useState<Attribute | undefined>()
  const [deletingAttribute, setDeletingAttribute] = useState<Attribute | undefined>()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [presetsInitialized, setPresetsInitialized] = useState(false)

  // Initialize presets on first load
  useEffect(() => {
    if (!presetsInitialized) {
      initializeAttributePresets()
        .then(() => {
          setPresetsInitialized(true)
          refreshAttributes()
        })
        .catch((err) => {
          console.error('Failed to initialize presets:', err)
          setPresetsInitialized(true)
        })
    }
  }, [presetsInitialized, refreshAttributes])

  // Handle opening create form
  const handleAdd = useCallback(() => {
    setFormMode('create')
    setEditingAttribute(undefined)
    setFormError(null)
    clearError()
    setShowForm(true)
  }, [clearError])

  // Handle opening edit form
  const handleEdit = useCallback(
    (attribute: Attribute) => {
      setFormMode('edit')
      setEditingAttribute(attribute)
      setFormError(null)
      clearError()
      setShowForm(true)
    },
    [clearError]
  )

  // Handle form submission
  const handleFormSubmit = useCallback(
    async (data: CreateAttributeInput | UpdateAttributeInput) => {
      setIsSubmitting(true)
      setFormError(null)

      try {
        if (formMode === 'create') {
          // Get next order value from store
          const nextOrder = useAttributeStore.getState().attributes.length
          await addAttribute({ ...(data as CreateAttributeInput), order: nextOrder })
        } else if (editingAttribute) {
          await updateAttribute(editingAttribute.id, data as UpdateAttributeInput)
        }
        setShowForm(false)
        setEditingAttribute(undefined)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'An error occurred'
        setFormError(message)
      } finally {
        setIsSubmitting(false)
      }
    },
    [formMode, editingAttribute, addAttribute, updateAttribute]
  )

  // Handle form cancel
  const handleFormCancel = useCallback(() => {
    setShowForm(false)
    setEditingAttribute(undefined)
    setFormError(null)
  }, [])

  // Handle toggle
  const handleToggle = useCallback(
    async (id: string, enabled: boolean) => {
      try {
        await toggleAttribute(id, enabled)
      } catch (err) {
        console.error('Failed to toggle attribute:', err)
      }
    },
    [toggleAttribute]
  )

  // Handle opening delete confirmation
  const handleDeleteRequest = useCallback((attribute: Attribute) => {
    setDeletingAttribute(attribute)
  }, [])

  // Handle delete confirmation
  const handleDeleteConfirm = useCallback(async () => {
    if (!deletingAttribute) return

    setIsSubmitting(true)
    try {
      await deleteAttribute(deletingAttribute.id)
      setDeletingAttribute(undefined)
    } catch (err) {
      console.error('Failed to delete attribute:', err)
      // Error will be shown through the store
    } finally {
      setIsSubmitting(false)
    }
  }, [deletingAttribute, deleteAttribute])

  // Handle delete cancel
  const handleDeleteCancel = useCallback(() => {
    setDeletingAttribute(undefined)
  }, [])

  return (
    <div className={className}>
      <AttributeList
        attributes={attributes}
        loading={loading}
        error={error}
        onToggle={handleToggle}
        onEdit={handleEdit}
        onDelete={handleDeleteRequest}
        onAdd={handleAdd}
        onRefresh={refreshAttributes}
      />

      {/* Create/Edit Form Modal */}
      {showForm && (
        <AttributeForm
          mode={formMode}
          attribute={editingAttribute}
          onSubmit={handleFormSubmit}
          onCancel={handleFormCancel}
          isSubmitting={isSubmitting}
          error={formError}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {deletingAttribute && (
        <DeleteAttributeDialog
          attribute={deletingAttribute}
          onConfirm={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
          isDeleting={isSubmitting}
        />
      )}
    </div>
  )
}

export default AttributeManager
