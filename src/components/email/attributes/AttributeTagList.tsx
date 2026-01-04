/**
 * AttributeTagList Component
 *
 * Story 2.14: Apply Attributes to Emails - UI & Interaction
 * Task 4.2: Display multiple attribute tags
 *
 * AC 8: Attribute tags displayed inline in inbox list
 * AC 9: Attribute tags displayed in thread detail view
 * AC 10: User can remove attributes (click X on tag)
 */

import { memo, useMemo, useCallback, useState } from 'react'
import { cn } from '@/utils/cn'
import { useAttributes } from '@/hooks/useAttributes'
import { AttributeTag } from './AttributeTag'
import type { EmailAttributeValues, AttributeValue } from '@/types/attributes'

export interface AttributeTagListProps {
  /** Email attributes (map of attributeId -> value) */
  attributes: EmailAttributeValues
  /** Called when an attribute is removed */
  onRemove?: (attributeId: string) => void
  /** Show remove buttons */
  showRemove?: boolean
  /** Maximum tags to show before truncating */
  maxTags?: number
  /** Size variant */
  size?: 'sm' | 'md'
  /** Additional className */
  className?: string
  /** Layout direction */
  direction?: 'horizontal' | 'vertical'
}

/**
 * Display list of attribute tags
 * Handles overflow with count indicator and tooltip
 */
export const AttributeTagList = memo(function AttributeTagList({
  attributes,
  onRemove,
  showRemove = false,
  maxTags = 3,
  size = 'md',
  className,
  direction = 'horizontal',
}: AttributeTagListProps) {
  const { getAttributeByName } = useAttributes()
  const [showAll, setShowAll] = useState(false)

  // Get attribute definitions for values we have
  // Note: Email attributes use attribute NAME as key (e.g., 'category'), not ID
  const tagsData = useMemo(() => {
    const result: Array<{
      attributeName: string
      attribute: ReturnType<typeof getAttributeByName>
      value: AttributeValue
    }> = []

    for (const [attributeName, value] of Object.entries(attributes)) {
      // Skip null/undefined values
      if (value === null || value === undefined) continue

      // Get attribute definition by name (not ID)
      const attribute = getAttributeByName(attributeName)
      if (attribute && attribute.enabled) {
        result.push({ attributeName, attribute, value })
      }
    }

    // Sort by attribute order
    result.sort((a, b) => (a.attribute?.order || 0) - (b.attribute?.order || 0))

    return result
  }, [attributes, getAttributeByName])

  // Handle remove
  const handleRemove = useCallback(
    (attributeName: string) => {
      onRemove?.(attributeName)
    },
    [onRemove]
  )

  // Toggle show all
  const handleToggleShowAll = useCallback(() => {
    setShowAll((prev) => !prev)
  }, [])

  // No tags to display
  if (tagsData.length === 0) {
    return null
  }

  // Determine visible tags
  const visibleTags = showAll ? tagsData : tagsData.slice(0, maxTags)
  const hiddenCount = tagsData.length - maxTags

  const directionClasses = {
    horizontal: 'flex flex-row flex-wrap items-center gap-1',
    vertical: 'flex flex-col items-start gap-1',
  }

  return (
    <div
      className={cn(directionClasses[direction], className)}
      role="list"
      aria-label="Attribute tags"
    >
      {visibleTags.map(({ attributeName, attribute, value }) =>
        attribute ? (
          <AttributeTag
            key={attributeName}
            attribute={attribute}
            value={value}
            onRemove={showRemove ? () => handleRemove(attributeName) : undefined}
            showRemove={showRemove}
            size={size}
          />
        ) : null
      )}

      {/* Overflow indicator */}
      {!showAll && hiddenCount > 0 && (
        <button
          type="button"
          onClick={handleToggleShowAll}
          className={cn(
            'inline-flex items-center justify-center rounded-full',
            'bg-slate-200 text-slate-600 font-medium',
            'hover:bg-slate-300 transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-cyan-500',
            size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-xs px-2 py-1'
          )}
          aria-label={`Show ${hiddenCount} more attributes`}
          title={tagsData
            .slice(maxTags)
            .map((t) => t.attribute?.displayName)
            .join(', ')}
        >
          +{hiddenCount}
        </button>
      )}

      {/* Collapse button when expanded */}
      {showAll && hiddenCount > 0 && (
        <button
          type="button"
          onClick={handleToggleShowAll}
          className={cn(
            'inline-flex items-center justify-center rounded-full',
            'bg-slate-200 text-slate-600 font-medium',
            'hover:bg-slate-300 transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-cyan-500',
            size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-xs px-2 py-1'
          )}
          aria-label="Show fewer attributes"
        >
          Less
        </button>
      )}
    </div>
  )
})

export default AttributeTagList
