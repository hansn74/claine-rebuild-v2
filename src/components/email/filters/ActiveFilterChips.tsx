/**
 * ActiveFilterChips Component
 *
 * Story 2.15: Attribute-Based Filtering & Search
 * Task 3: Active Filter Chips Component
 *
 * AC 5: Active filters shown as chips with clear/remove option
 *
 * Features:
 * - Display active filters as dismissible chips
 * - Show attribute name and value(s)
 * - X button to remove individual filter
 * - "Clear all" button when multiple filters active
 * - Animated add/remove for visual feedback
 */

import { memo, useCallback, useMemo } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/utils/cn'
import { useAttributes } from '@/hooks/useAttributes'
import { useAttributeFilterStore, type FilterValue } from '@/store/attributeFilterStore'
import type { Attribute } from '@/types/attributes'

interface ActiveFilterChipsProps {
  /** Additional className */
  className?: string
}

/**
 * Get display label for a filter value based on attribute type
 */
function getFilterValueLabel(attribute: Attribute, value: FilterValue): string {
  if (value === null || value === undefined) {
    return ''
  }

  switch (attribute.type) {
    case 'enum': {
      // Find matching enum value label
      const option = attribute.values?.find((v) => v.value === String(value))
      return option?.label || String(value)
    }
    case 'boolean':
      return value === true ? 'Yes' : 'No'
    case 'date': {
      // Parse date range format "from:to"
      if (typeof value === 'string' && value.includes(':')) {
        const [from, to] = value.split(':')
        if (from && to) {
          return `${formatDate(from)} - ${formatDate(to)}`
        } else if (from) {
          return `After ${formatDate(from)}`
        } else if (to) {
          return `Before ${formatDate(to)}`
        }
      }
      return String(value)
    }
    case 'number': {
      // Parse number range format "min:max"
      if (typeof value === 'string' && value.includes(':')) {
        const [min, max] = value.split(':')
        if (min && max) {
          return `${min} - ${max}`
        } else if (min) {
          return `>= ${min}`
        } else if (max) {
          return `<= ${max}`
        }
      }
      return String(value)
    }
    case 'text':
    default:
      return `"${String(value)}"`
  }
}

/**
 * Format date for display
 */
function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    })
  } catch {
    return dateStr
  }
}

/**
 * Get color for filter chip based on attribute and value
 */
function getFilterColor(attribute: Attribute, value: FilterValue): string | undefined {
  if (attribute.type === 'enum') {
    const option = attribute.values?.find((v) => v.value === String(value))
    return option?.color
  }
  return attribute.color
}

/**
 * Single filter chip component
 */
const FilterChip = memo(function FilterChip({
  attribute,
  value,
  onRemove,
}: {
  attribute: Attribute
  value: FilterValue
  onRemove: () => void
}) {
  const label = getFilterValueLabel(attribute, value)
  const color = getFilterColor(attribute, value)

  if (!label) return null

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
        'transition-all duration-200 ease-in-out',
        'animate-in fade-in-0 zoom-in-95'
      )}
      style={{
        backgroundColor: color ? `${color}20` : '#cffafe',
        color: color || '#0e7490',
        borderLeft: color ? `3px solid ${color}` : '3px solid #06b6d4',
      }}
    >
      <span className="font-semibold">{attribute.displayName}:</span>
      <span className="truncate max-w-[120px]">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        className={cn(
          'p-0.5 rounded-full transition-colors',
          'hover:bg-black/10 focus:outline-none focus:ring-1 focus:ring-offset-1'
        )}
        style={{ outlineColor: color || '#0e7490' }}
        aria-label={`Remove ${attribute.displayName}: ${label} filter`}
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  )
})

/**
 * Active filter chips bar
 * Displays all active filters with remove buttons
 */
export const ActiveFilterChips = memo(function ActiveFilterChips({
  className,
}: ActiveFilterChipsProps) {
  const { getAttributeById } = useAttributes()
  const { getActiveFilterEntries, removeFilterValue, clearAllFilters, hasActiveFilters } =
    useAttributeFilterStore()

  const activeFilters = getActiveFilterEntries()

  // Build flat list of chip data for rendering
  const chips = useMemo(() => {
    const result: { attribute: Attribute; value: FilterValue; key: string }[] = []

    for (const [attributeId, values] of activeFilters) {
      const attribute = getAttributeById(attributeId)
      if (!attribute) continue

      // For range types (date, number), show as single chip
      if (attribute.type === 'date' || attribute.type === 'number') {
        if (values.length > 0) {
          result.push({
            attribute,
            value: values[0],
            key: `${attributeId}-range`,
          })
        }
      } else {
        // For other types, show each value as separate chip
        for (const value of values) {
          result.push({
            attribute,
            value,
            key: `${attributeId}-${String(value)}`,
          })
        }
      }
    }

    return result
  }, [activeFilters, getAttributeById])

  const handleRemove = useCallback(
    (attributeId: string, value: FilterValue, attributeType: string) => {
      // For range types, clear the entire filter
      if (attributeType === 'date' || attributeType === 'number') {
        const { clearFilter } = useAttributeFilterStore.getState()
        clearFilter(attributeId)
      } else {
        removeFilterValue(attributeId, value)
      }
    },
    [removeFilterValue]
  )

  // Don't render if no active filters
  if (!hasActiveFilters()) {
    return null
  }

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 px-4 py-2',
        'bg-slate-50 border-b border-slate-200',
        className
      )}
      role="region"
      aria-label="Active filters"
    >
      <span className="text-xs font-medium text-slate-500">Filters:</span>

      {chips.map((chip) => (
        <FilterChip
          key={chip.key}
          attribute={chip.attribute}
          value={chip.value}
          onRemove={() => handleRemove(chip.attribute.id, chip.value, chip.attribute.type)}
        />
      ))}

      {chips.length > 1 && (
        <button
          type="button"
          onClick={clearAllFilters}
          className={cn(
            'text-xs font-medium text-cyan-600 hover:text-cyan-700',
            'px-2 py-1 rounded hover:bg-cyan-50 transition-colors'
          )}
        >
          Clear all
        </button>
      )}
    </div>
  )
})

export default ActiveFilterChips
