/**
 * BooleanFilterInput Component
 *
 * Story 2.15: Attribute-Based Filtering & Search
 * Task 2.2: Tri-state toggle (Yes/No/Any)
 *
 * Allows filtering by boolean values with a "No filter" option
 */

import { memo, useCallback } from 'react'
import { cn } from '@/utils/cn'
import type { Attribute } from '@/types/attributes'
import type { FilterValue } from '@/store/attributeFilterStore'

interface BooleanFilterInputProps {
  /** Attribute definition */
  attribute: Attribute
  /** Currently selected values */
  selectedValues: FilterValue[]
  /** Called when selection changes */
  onChange: (values: FilterValue[]) => void
}

type BooleanFilterState = 'any' | 'yes' | 'no'

/**
 * Tri-state toggle for boolean attributes
 * Options: Any (no filter), Yes (true), No (false)
 */
export const BooleanFilterInput = memo(function BooleanFilterInput({
  attribute,
  selectedValues,
  onChange,
}: BooleanFilterInputProps) {
  // Determine current state from selected values
  const currentState: BooleanFilterState = (() => {
    if (selectedValues.length === 0) return 'any'
    if (selectedValues.includes(true)) return 'yes'
    if (selectedValues.includes(false)) return 'no'
    return 'any'
  })()

  const handleSelect = useCallback(
    (state: BooleanFilterState) => {
      switch (state) {
        case 'any':
          onChange([])
          break
        case 'yes':
          onChange([true])
          break
        case 'no':
          onChange([false])
          break
      }
    },
    [onChange]
  )

  const options: { value: BooleanFilterState; label: string }[] = [
    { value: 'any', label: 'Any' },
    { value: 'yes', label: 'Yes' },
    { value: 'no', label: 'No' },
  ]

  return (
    <div
      className="flex rounded-md border border-slate-200 overflow-hidden"
      role="radiogroup"
      aria-label={`Filter by ${attribute.displayName}`}
    >
      {options.map((option) => {
        const isSelected = currentState === option.value

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => handleSelect(option.value)}
            className={cn(
              'flex-1 px-3 py-1.5 text-sm font-medium transition-colors',
              'border-r last:border-r-0 border-slate-200',
              isSelected ? 'bg-cyan-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
            )}
            role="radio"
            aria-checked={isSelected}
            aria-label={`${option.label}${isSelected ? ' (selected)' : ''}`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
})

export default BooleanFilterInput
