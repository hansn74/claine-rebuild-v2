/**
 * AttributePanel Component
 *
 * Story 2.14: Apply Attributes to Emails - UI & Interaction
 * Task 3.1: Main panel for displaying and editing email attributes
 *
 * AC 1: User sees attributes panel in thread detail view
 * AC 2: User can select/apply multiple attributes to a single email
 * AC 3: Enum attributes show dropdown with values
 * AC 4: Text attributes show input field
 * AC 5: Date attributes show date picker
 * AC 6: Boolean attributes show checkbox
 */

import { memo, useCallback, useState, useEffect } from 'react'
import { Tag, Loader2 } from 'lucide-react'
import { cn } from '@/utils/cn'
import { useAttributes } from '@/hooks/useAttributes'
import { emailAttributeService } from '@/services/email/emailAttributeService'
import { logger } from '@/services/logger'
import { AttributeInputFactory } from './AttributeInputFactory'
import type { AttributeValue, EmailAttributeValues } from '@/types/attributes'

export interface AttributePanelProps {
  /** Email ID to edit attributes for */
  emailId: string
  /** Initial attributes (from email document) */
  initialAttributes?: EmailAttributeValues
  /** Optional className for styling */
  className?: string
  /** Collapsed state (show only header) */
  collapsed?: boolean
  /** Called when collapsed state changes */
  onCollapsedChange?: (collapsed: boolean) => void
}

/**
 * Panel for viewing and editing email attributes
 * Lists all enabled attributes with appropriate input controls
 */
export const AttributePanel = memo(function AttributePanel({
  emailId,
  initialAttributes = {},
  className,
  collapsed = false,
  onCollapsedChange,
}: AttributePanelProps) {
  // Load enabled attributes from store
  const { enabledAttributes, loading: attributesLoading } = useAttributes()

  // Local state for attribute values (for optimistic UI)
  const [localAttributes, setLocalAttributes] = useState<EmailAttributeValues>(initialAttributes)

  // Track which attributes are saving
  const [savingAttributes, setSavingAttributes] = useState<Set<string>>(new Set())

  // Track errors
  const [errors, setErrors] = useState<Map<string, string>>(new Map())

  // Sync local state with initial attributes when they change
  useEffect(() => {
    setLocalAttributes(initialAttributes)
  }, [initialAttributes])

  // Handle attribute value change
  const handleAttributeChange = useCallback(
    async (attributeId: string, value: AttributeValue) => {
      // Optimistic update
      setLocalAttributes((prev) => {
        const updated: EmailAttributeValues = { ...prev }
        updated[attributeId] = value
        return updated
      })

      // Clear any previous error for this attribute
      setErrors((prev) => {
        const next = new Map(prev)
        next.delete(attributeId)
        return next
      })

      // Mark as saving
      setSavingAttributes((prev) => new Set(prev).add(attributeId))

      try {
        // Save to database
        const result = await emailAttributeService.setEmailAttribute(emailId, attributeId, value)

        if (!result.success) {
          // Rollback on error
          setLocalAttributes((prev) => {
            const updated: EmailAttributeValues = { ...prev }
            if (result.previousAttributes && attributeId in result.previousAttributes) {
              updated[attributeId] = result.previousAttributes[attributeId]
            } else {
              delete updated[attributeId]
            }
            return updated
          })
          setErrors((prev) => new Map(prev).set(attributeId, result.error || 'Failed to save'))
        }

        logger.debug('ui', 'Attribute changed', {
          emailId,
          attributeId,
          value,
          success: result.success,
        })
      } catch (error) {
        // Rollback on exception
        setLocalAttributes(initialAttributes)
        setErrors((prev) =>
          new Map(prev).set(
            attributeId,
            error instanceof Error ? error.message : 'Failed to save attribute'
          )
        )
      } finally {
        // Remove saving state
        setSavingAttributes((prev) => {
          const next = new Set(prev)
          next.delete(attributeId)
          return next
        })
      }
    },
    [emailId, initialAttributes]
  )

  // Toggle collapsed state
  const handleToggleCollapsed = useCallback(() => {
    onCollapsedChange?.(!collapsed)
  }, [collapsed, onCollapsedChange])

  // Count attributes with values
  const attributeCount = Object.entries(localAttributes).filter(
    ([, v]) => v !== null && v !== undefined
  ).length

  if (attributesLoading) {
    return (
      <div className={cn('bg-white rounded-lg border border-slate-200 p-4', className)}>
        <div className="flex items-center gap-2 text-slate-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading attributes...</span>
        </div>
      </div>
    )
  }

  if (enabledAttributes.length === 0) {
    return null
  }

  return (
    <div className={cn('bg-white rounded-lg border border-slate-200', className)}>
      {/* Header */}
      <button
        type="button"
        onClick={handleToggleCollapsed}
        className={cn(
          'w-full flex items-center justify-between px-4 py-3 text-left',
          'hover:bg-slate-50 transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-inset focus:ring-cyan-500',
          collapsed ? 'rounded-lg' : 'rounded-t-lg border-b border-slate-200'
        )}
        aria-expanded={!collapsed}
        aria-controls="attribute-panel-content"
      >
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-slate-500" aria-hidden="true" />
          <span className="font-medium text-slate-900">Attributes</span>
          {attributeCount > 0 && (
            <span className="bg-cyan-100 text-cyan-700 text-xs font-medium px-2 py-0.5 rounded-full">
              {attributeCount}
            </span>
          )}
        </div>
        <svg
          className={cn('w-4 h-4 text-slate-400 transition-transform', !collapsed && 'rotate-180')}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Content */}
      {!collapsed && (
        <div
          id="attribute-panel-content"
          className="px-4 py-3 space-y-4"
          role="group"
          aria-label="Email attributes"
        >
          {enabledAttributes.map((attribute) => {
            const isSaving = savingAttributes.has(attribute.id)
            const error = errors.get(attribute.id)

            return (
              <div key={attribute.id} className="space-y-1">
                {/* Label */}
                <label
                  htmlFor={`attr-${attribute.id}`}
                  className="flex items-center gap-2 text-sm font-medium text-slate-700"
                >
                  {attribute.color && (
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: attribute.color }}
                      aria-hidden="true"
                    />
                  )}
                  {attribute.displayName}
                  {isSaving && (
                    <Loader2
                      className="w-3 h-3 animate-spin text-slate-400"
                      aria-label="Saving..."
                    />
                  )}
                </label>

                {/* Input */}
                <AttributeInputFactory
                  attribute={attribute}
                  value={localAttributes[attribute.id]}
                  onChange={(value) => handleAttributeChange(attribute.id, value)}
                  disabled={isSaving}
                  ariaLabel={`${attribute.displayName} attribute`}
                />

                {/* Error message */}
                {error && (
                  <p className="text-xs text-red-600" role="alert">
                    {error}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
})

export default AttributePanel
