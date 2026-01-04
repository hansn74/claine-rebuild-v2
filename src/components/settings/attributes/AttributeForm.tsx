/**
 * AttributeForm Component
 * Form for creating and editing attributes
 *
 * Story 2.13: Custom Attributes System
 * Task 5.3: Create AttributeForm.tsx for create/edit dialog
 */

import type React from 'react'
import { useState, useCallback, memo } from 'react'
import { X, Plus, Trash2, GripVertical } from 'lucide-react'
import { Button } from '@shared/components/ui/button'
import type {
  Attribute,
  AttributeType,
  AttributeEnumValue,
  CreateAttributeInput,
  UpdateAttributeInput,
} from '@/types/attributes'

export interface AttributeFormProps {
  mode: 'create' | 'edit'
  attribute?: Attribute
  onSubmit: (data: CreateAttributeInput | UpdateAttributeInput) => Promise<void>
  onCancel: () => void
  isSubmitting?: boolean
  error?: string | null
}

const ATTRIBUTE_TYPES: { value: AttributeType; label: string; description: string }[] = [
  { value: 'enum', label: 'Select List', description: 'Choose from predefined options' },
  { value: 'text', label: 'Text', description: 'Free-form text input' },
  { value: 'boolean', label: 'Yes/No', description: 'Toggle between yes and no' },
  { value: 'number', label: 'Number', description: 'Numeric value' },
  { value: 'date', label: 'Date', description: 'Date picker' },
]

const COLOR_PRESETS = [
  '#ef4444', // Red
  '#f97316', // Orange
  '#f59e0b', // Amber
  '#22c55e', // Green
  '#14b8a6', // Teal
  '#3b82f6', // Blue
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#6b7280', // Gray
]

/**
 * AttributeForm component
 */
export const AttributeForm = memo(function AttributeForm({
  mode,
  attribute,
  onSubmit,
  onCancel,
  isSubmitting = false,
  error,
}: AttributeFormProps) {
  const [name, setName] = useState(attribute?.name || '')
  const [displayName, setDisplayName] = useState(attribute?.displayName || '')
  const [type, setType] = useState<AttributeType>(attribute?.type || 'enum')
  const [values, setValues] = useState<AttributeEnumValue[]>(
    attribute?.values || [{ value: '', label: '' }]
  )
  const [color, setColor] = useState(attribute?.color || COLOR_PRESETS[0])
  const [defaultValue, setDefaultValue] = useState<string>(
    attribute?.defaultValue !== undefined ? String(attribute.defaultValue) : ''
  )

  const isBuiltIn = attribute?.isBuiltIn || false
  const isEditMode = mode === 'edit'

  // Handle display name change with auto-generated internal name
  const handleDisplayNameChange = useCallback(
    (newDisplayName: string) => {
      setDisplayName(newDisplayName)
      // Auto-generate name from displayName for new attributes if name is empty
      if (!isEditMode && !name) {
        const generatedName = newDisplayName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_|_$/g, '')
        setName(generatedName)
      }
    },
    [isEditMode, name]
  )

  // Handle enum value change
  const handleValueChange = useCallback(
    (index: number, field: 'value' | 'label' | 'color', value: string) => {
      setValues((prev) => {
        const updated = [...prev]
        updated[index] = { ...updated[index], [field]: value }

        // Auto-generate value from label if value is empty
        if (field === 'label' && !updated[index].value) {
          updated[index].value = value
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
        }

        return updated
      })
    },
    []
  )

  // Add enum value
  const handleAddValue = useCallback(() => {
    setValues((prev) => [...prev, { value: '', label: '' }])
  }, [])

  // Remove enum value
  const handleRemoveValue = useCallback((index: number) => {
    setValues((prev) => prev.filter((_, i) => i !== index))
  }, [])

  // Handle form submission
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()

      const data: CreateAttributeInput | UpdateAttributeInput = isEditMode
        ? {
            displayName,
            values: type === 'enum' ? values.filter((v) => v.value && v.label) : undefined,
            color,
            defaultValue: defaultValue || undefined,
          }
        : {
            name,
            displayName,
            type,
            values: type === 'enum' ? values.filter((v) => v.value && v.label) : undefined,
            color,
            defaultValue: defaultValue || undefined,
            isBuiltIn: false,
            enabled: true,
            order: 0, // Will be set by service
          }

      await onSubmit(data)
    },
    [isEditMode, name, displayName, type, values, color, defaultValue, onSubmit]
  )

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">
            {isEditMode ? 'Edit Attribute' : 'Create Attribute'}
          </h2>
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-slate-500 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-6 py-4 space-y-5">
            {/* Error display */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Display Name */}
            <div>
              <label
                htmlFor="displayName"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Display Name *
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => handleDisplayNameChange(e.target.value)}
                placeholder="e.g., Project, Status, Priority"
                className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                required
                maxLength={100}
              />
            </div>

            {/* Internal Name (only for create mode) */}
            {!isEditMode && (
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">
                  Internal Name *
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) =>
                    setName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))
                  }
                  placeholder="e.g., project_name"
                  className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 font-mono text-sm"
                  required
                  maxLength={50}
                  pattern="[a-z0-9_]+"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Lowercase letters, numbers, and underscores only
                </p>
              </div>
            )}

            {/* Type selector (only for create mode or non-built-in) */}
            {(!isEditMode || !isBuiltIn) && !isEditMode && (
              <div>
                <span id="type-label" className="block text-sm font-medium text-slate-700 mb-2">
                  Type *
                </span>
                <div
                  className="grid grid-cols-2 gap-2"
                  role="radiogroup"
                  aria-labelledby="type-label"
                >
                  {ATTRIBUTE_TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setType(t.value)}
                      className={`
                        p-3 rounded-md border text-left transition-colors
                        ${
                          type === t.value
                            ? 'border-cyan-500 bg-cyan-50 ring-2 ring-cyan-200'
                            : 'border-slate-200 hover:border-slate-300'
                        }
                      `}
                    >
                      <div className="text-sm font-medium text-slate-900">{t.label}</div>
                      <div className="text-xs text-slate-500">{t.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Enum values (only for enum type) */}
            {type === 'enum' && (
              <div>
                <span id="options-label" className="block text-sm font-medium text-slate-700 mb-2">
                  Options *
                </span>
                <div className="space-y-2" aria-labelledby="options-label">
                  {values.map((v, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <GripVertical className="w-4 h-4 text-slate-400 cursor-grab flex-shrink-0" />
                      <input
                        type="text"
                        value={v.label}
                        onChange={(e) => handleValueChange(index, 'label', e.target.value)}
                        placeholder="Label"
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-sm"
                        required
                        maxLength={100}
                      />
                      <input
                        type="color"
                        value={v.color || COLOR_PRESETS[index % COLOR_PRESETS.length]}
                        onChange={(e) => handleValueChange(index, 'color', e.target.value)}
                        className="w-10 h-9 rounded border border-slate-300 cursor-pointer"
                        title="Color"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveValue(index)}
                        disabled={values.length <= 1}
                        className="p-2 text-slate-400 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="Remove option"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddValue}
                  className="mt-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Option
                </Button>
              </div>
            )}

            {/* Color picker */}
            <div>
              <label
                htmlFor="accent-color"
                className="block text-sm font-medium text-slate-700 mb-2"
              >
                Accent Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="accent-color"
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-10 h-10 rounded border border-slate-300 cursor-pointer"
                />
                <div className="flex gap-1">
                  {COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setColor(preset)}
                      className={`w-6 h-6 rounded-full border-2 transition-transform ${
                        color === preset ? 'border-slate-900 scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: preset }}
                      aria-label={`Select color ${preset}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Default value (for non-enum types) */}
            {type !== 'enum' && (
              <div>
                <label
                  htmlFor="defaultValue"
                  className="block text-sm font-medium text-slate-700 mb-1"
                >
                  Default Value (optional)
                </label>
                {type === 'boolean' ? (
                  <select
                    id="defaultValue"
                    value={defaultValue}
                    onChange={(e) => setDefaultValue(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                  >
                    <option value="">No default</option>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                ) : type === 'number' ? (
                  <input
                    id="defaultValue"
                    type="number"
                    value={defaultValue}
                    onChange={(e) => setDefaultValue(e.target.value)}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                  />
                ) : type === 'date' ? (
                  <input
                    id="defaultValue"
                    type="date"
                    value={defaultValue}
                    onChange={(e) => setDefaultValue(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                  />
                ) : (
                  <input
                    id="defaultValue"
                    type="text"
                    value={defaultValue}
                    onChange={(e) => setDefaultValue(e.target.value)}
                    placeholder="Enter default value"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                  />
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                isSubmitting ||
                !name ||
                !displayName ||
                (type === 'enum' && values.filter((v) => v.value && v.label).length === 0)
              }
            >
              {isSubmitting ? 'Saving...' : isEditMode ? 'Save Changes' : 'Create Attribute'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
})

export default AttributeForm
