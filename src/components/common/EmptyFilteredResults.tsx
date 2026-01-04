/**
 * EmptyFilteredResults Component
 *
 * Story 2.15: Attribute-Based Filtering & Search
 * Task 7: Empty State for Filtered Results
 *
 * AC 9: Empty state when no emails match filters: "No emails found with these criteria"
 *
 * Displays when filters are active but no emails match the criteria.
 * Provides a clear action to remove filters and try again.
 */

import { FilterX } from 'lucide-react'
import { cn } from '@/utils/cn'
import { useAttributeFilterStore } from '@/store/attributeFilterStore'
import { useAttributes } from '@/hooks/useAttributes'
import { EmptyState, type EmptyStateProps } from './EmptyState'
import type { FilterValue } from '@/store/attributeFilterStore'

export interface EmptyFilteredResultsProps
  extends Omit<EmptyStateProps, 'icon' | 'title' | 'description' | 'action'> {
  /** Override title */
  title?: string
  /** Override description */
  description?: string
}

/**
 * Get a summary of active filters for display
 */
function useActiveFilterSummary(): string {
  const { getActiveFilterEntries } = useAttributeFilterStore()
  const { getAttributeById } = useAttributes()

  const entries = getActiveFilterEntries()
  if (entries.length === 0) return ''

  const summaries = entries.slice(0, 3).map(([attributeId, values]) => {
    const attribute = getAttributeById(attributeId)
    if (!attribute) return null

    const valueLabels = values.slice(0, 2).map((v: FilterValue) => {
      if (attribute.type === 'enum') {
        const option = attribute.values?.find((opt) => opt.value === String(v))
        return option?.label || String(v)
      }
      if (attribute.type === 'boolean') {
        return v === true ? 'Yes' : 'No'
      }
      return String(v)
    })

    const valueStr = valueLabels.join(', ')
    const moreCount = values.length - 2
    const suffix = moreCount > 0 ? ` +${moreCount}` : ''

    return `${attribute.displayName}: ${valueStr}${suffix}`
  })

  const validSummaries = summaries.filter(Boolean)
  const moreFilters = entries.length - 3

  if (moreFilters > 0) {
    validSummaries.push(`+${moreFilters} more filters`)
  }

  return validSummaries.join(' • ')
}

/**
 * EmptyFilteredResults - Empty state when filters match no emails
 *
 * Features:
 * - Shows "No emails found with these criteria" message
 * - Displays active filter summary
 * - Provides "Clear filters" action button
 */
export function EmptyFilteredResults({
  title = 'No emails found with these criteria',
  description,
  className,
  ...props
}: EmptyFilteredResultsProps) {
  const { clearAllFilters, getActiveFilterCount } = useAttributeFilterStore()
  const filterCount = getActiveFilterCount()
  const filterSummary = useActiveFilterSummary()

  const defaultDescription = filterSummary
    ? `Filters applied: ${filterSummary}`
    : `${filterCount} filter${filterCount === 1 ? '' : 's'} active`

  return (
    <EmptyState
      icon={<FilterX className="w-8 h-8 text-slate-400" strokeWidth={1.5} aria-hidden="true" />}
      title={title}
      description={description ?? defaultDescription}
      action={
        <button
          type="button"
          onClick={clearAllFilters}
          className={cn(
            'px-4 py-2 rounded-md text-sm font-medium',
            'bg-cyan-600 text-white',
            'hover:bg-cyan-700 transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2'
          )}
        >
          Clear all filters
        </button>
      }
      className={cn('text-center', className)}
      testId="empty-filtered-results"
      {...props}
    />
  )
}

export default EmptyFilteredResults
