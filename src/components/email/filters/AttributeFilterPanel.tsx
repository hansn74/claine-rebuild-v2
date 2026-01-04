/**
 * AttributeFilterPanel Component
 *
 * Story 2.15: Attribute-Based Filtering & Search
 * Task 2.1: Filter panel showing all enabled attributes
 *
 * AC 1: Filter panel in sidebar showing all available attributes
 * AC 2: User can select attribute filters
 * AC 3: Multiple filters combined with AND logic
 * AC 5: Active filters shown as chips with clear/remove option
 */

import React, { memo, useCallback, useState } from 'react'
import { Filter, ChevronDown, ChevronRight, X } from 'lucide-react'
import { cn } from '@/utils/cn'
import { useAttributes } from '@/hooks/useAttributes'
import { useAttributeFilterStore, type FilterValue } from '@/store/attributeFilterStore'
import { FilterInputFactory } from './FilterInputFactory'
import type { Attribute } from '@/types/attributes'

interface AttributeFilterPanelProps {
  /** Additional className */
  className?: string
  /** Initially expanded */
  defaultExpanded?: boolean
}

/**
 * Collapsible filter section for a single attribute
 */
const AttributeFilterSection = memo(function AttributeFilterSection({
  attribute,
  selectedValues,
  onFilterChange,
  onClearFilter,
}: {
  attribute: Attribute
  selectedValues: FilterValue[]
  onFilterChange: (attributeId: string, values: FilterValue[]) => void
  onClearFilter: (attributeId: string) => void
}) {
  const [isExpanded, setIsExpanded] = useState(selectedValues.length > 0)
  const hasActiveFilter = selectedValues.length > 0

  const handleChange = useCallback(
    (values: FilterValue[]) => {
      // Use attribute.name as key since emails store attributes by name, not ID
      onFilterChange(attribute.name, values)
    },
    [attribute.name, onFilterChange]
  )

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      // Use attribute.name as key since emails store attributes by name, not ID
      onClearFilter(attribute.name)
    },
    [attribute.name, onClearFilter]
  )

  return (
    <div className="border-b border-slate-100 last:border-b-0">
      {/* Using div with role="button" to avoid nested button issue */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsExpanded(!isExpanded)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setIsExpanded(!isExpanded)
          }
        }}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 text-left transition-colors cursor-pointer',
          'hover:bg-slate-50',
          hasActiveFilter && 'bg-cyan-50'
        )}
        aria-expanded={isExpanded}
        aria-controls={`filter-section-${attribute.id}`}
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
        )}
        <span
          className={cn(
            'flex-1 text-sm font-medium',
            hasActiveFilter ? 'text-cyan-700' : 'text-slate-700'
          )}
        >
          {attribute.displayName}
        </span>
        {hasActiveFilter && (
          <>
            <span className="text-xs bg-cyan-600 text-white px-1.5 py-0.5 rounded-full">
              {selectedValues.length}
            </span>
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 rounded hover:bg-cyan-100 transition-colors"
              aria-label={`Clear ${attribute.displayName} filter`}
            >
              <X className="w-3.5 h-3.5 text-cyan-600" />
            </button>
          </>
        )}
      </div>

      {isExpanded && (
        <div id={`filter-section-${attribute.id}`} className="px-3 pb-3">
          <FilterInputFactory
            attribute={attribute}
            selectedValues={selectedValues}
            onChange={handleChange}
          />
        </div>
      )}
    </div>
  )
})

/**
 * Full attribute filter panel for sidebar
 * Lists all enabled attributes with collapsible sections
 */
export const AttributeFilterPanel = memo(function AttributeFilterPanel({
  className,
  defaultExpanded = true,
}: AttributeFilterPanelProps) {
  const { enabledAttributes, loading } = useAttributes()
  const { getFilterValues, setFilter, clearFilter, clearAllFilters, getActiveFilterCount } =
    useAttributeFilterStore()

  const [isPanelExpanded, setIsPanelExpanded] = useState(defaultExpanded)
  const activeFilterCount = getActiveFilterCount()

  const handleFilterChange = useCallback(
    (attributeId: string, values: FilterValue[]) => {
      setFilter(attributeId, values)
    },
    [setFilter]
  )

  const handleClearFilter = useCallback(
    (attributeId: string) => {
      clearFilter(attributeId)
    },
    [clearFilter]
  )

  // Don't render if no attributes available
  if (loading || enabledAttributes.length === 0) {
    return null
  }

  return (
    <div className={cn('bg-slate-50', className)}>
      {/* Panel Header - using div with role="button" to avoid nested button issue */}
      <div
        className={cn(
          'w-full flex items-center gap-2 px-4 py-2',
          'bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer'
        )}
        role="button"
        tabIndex={0}
        onClick={() => setIsPanelExpanded(!isPanelExpanded)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setIsPanelExpanded(!isPanelExpanded)
          }
        }}
        aria-expanded={isPanelExpanded}
        aria-controls="attribute-filter-panel"
      >
        <Filter className="w-4 h-4 text-slate-500" />
        <span className="flex-1 text-xs font-semibold text-slate-500 uppercase tracking-wider text-left">
          Filters
        </span>
        {activeFilterCount > 0 && (
          <>
            <span className="text-xs bg-cyan-600 text-white px-1.5 py-0.5 rounded-full">
              {activeFilterCount}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                clearAllFilters()
              }}
              className="text-xs text-cyan-600 hover:text-cyan-700 font-medium"
              aria-label="Clear all filters"
            >
              Clear all
            </button>
          </>
        )}
        {isPanelExpanded ? (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-400" />
        )}
      </div>

      {/* Filter Sections */}
      {isPanelExpanded && (
        <div
          id="attribute-filter-panel"
          className="bg-white border-y border-slate-200"
          role="region"
          aria-label="Attribute filters"
        >
          {enabledAttributes.map((attribute) => (
            <AttributeFilterSection
              key={attribute.id}
              attribute={attribute}
              selectedValues={getFilterValues(attribute.name)}
              onFilterChange={handleFilterChange}
              onClearFilter={handleClearFilter}
            />
          ))}
        </div>
      )}
    </div>
  )
})

export default AttributeFilterPanel
