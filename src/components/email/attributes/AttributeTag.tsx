/**
 * AttributeTag Component
 *
 * Story 2.14: Apply Attributes to Emails - UI & Interaction
 * Task 4.1: Single attribute tag display
 *
 * AC 8: Attribute tags displayed inline in inbox list
 * AC 9: Attribute tags displayed in thread detail view
 * AC 10: User can remove attributes (click X on tag)
 */

import { memo, useCallback, type MouseEvent } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { Attribute, AttributeValue } from '@/types/attributes'

export interface AttributeTagProps {
  /** Attribute definition */
  attribute: Attribute
  /** Current value */
  value: AttributeValue
  /** Called when remove button is clicked */
  onRemove?: () => void
  /** Show remove button */
  showRemove?: boolean
  /** Size variant */
  size?: 'sm' | 'md'
  /** Additional className */
  className?: string
}

/**
 * Get display label for an attribute value
 */
function getValueLabel(attribute: Attribute, value: AttributeValue): string {
  if (value === null || value === undefined) {
    return ''
  }

  switch (attribute.type) {
    case 'enum': {
      // Find matching enum value
      const option = attribute.values?.find((v) => v.value === value)
      return option?.label || String(value)
    }
    case 'boolean':
      return value === true ? 'Yes' : 'No'
    case 'date':
      // Format date for display
      try {
        const date = new Date(String(value))
        return date.toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
        })
      } catch {
        return String(value)
      }
    case 'number':
    case 'text':
    default:
      return String(value)
  }
}

/**
 * Get color for tag based on attribute type and value
 */
function getTagColor(attribute: Attribute, value: AttributeValue): string | undefined {
  if (attribute.type === 'enum') {
    // Find matching enum value color
    const option = attribute.values?.find((v) => v.value === value)
    return option?.color
  }
  // Use attribute's default color for other types
  return attribute.color
}

/**
 * Single attribute tag (pill/badge)
 * Displays attribute name:value with optional remove button
 */
export const AttributeTag = memo(function AttributeTag({
  attribute,
  value,
  onRemove,
  showRemove = true,
  size = 'md',
  className,
}: AttributeTagProps) {
  const label = getValueLabel(attribute, value)
  const color = getTagColor(attribute, value)

  const handleRemove = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()
      onRemove?.()
    },
    [onRemove]
  )

  // Don't render if no value
  if (label === '') {
    return null
  }

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5 gap-0.5',
    md: 'text-xs px-2 py-1 gap-1',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        'transition-colors',
        sizeClasses[size],
        className
      )}
      style={{
        backgroundColor: color ? `${color}20` : '#e5e7eb',
        color: color || '#374151',
        borderLeft: color ? `3px solid ${color}` : undefined,
      }}
      title={`${attribute.displayName}: ${label}`}
    >
      <span className="truncate max-w-[100px]">{label}</span>
      {showRemove && onRemove && (
        <button
          type="button"
          onClick={handleRemove}
          className={cn(
            'ml-0.5 rounded-full hover:bg-black/10 transition-colors',
            'focus:outline-none focus:ring-1 focus:ring-offset-1',
            size === 'sm' ? 'p-0.5' : 'p-0.5'
          )}
          style={{ outlineColor: color || '#374151' }}
          aria-label={`Remove ${attribute.displayName}`}
        >
          <X className={size === 'sm' ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
        </button>
      )}
    </span>
  )
})

export default AttributeTag
