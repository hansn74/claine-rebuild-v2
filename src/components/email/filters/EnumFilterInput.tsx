/**
 * EnumFilterInput Component
 *
 * Story 2.15: Attribute-Based Filtering & Search
 * Task 2.2: Multi-select checkboxes for enum values
 *
 * Allows selecting multiple enum values as filter criteria
 */

import { memo, useCallback } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { Attribute } from '@/types/attributes'
import type { FilterValue } from '@/store/attributeFilterStore'

interface EnumFilterInputProps {
  /** Attribute definition with enum values */
  attribute: Attribute
  /** Currently selected values */
  selectedValues: FilterValue[]
  /** Called when selection changes */
  onChange: (values: FilterValue[]) => void
}

/**
 * Multi-select checkbox list for enum-type attributes
 * Displays all enum values with checkboxes for filtering
 */
export const EnumFilterInput = memo(function EnumFilterInput({
  attribute,
  selectedValues,
  onChange,
}: EnumFilterInputProps) {
  const handleToggle = useCallback(
    (value: string) => {
      const currentSet = new Set(selectedValues.map(String))
      if (currentSet.has(value)) {
        currentSet.delete(value)
      } else {
        currentSet.add(value)
      }
      onChange(Array.from(currentSet))
    },
    [selectedValues, onChange]
  )

  if (!attribute.values || attribute.values.length === 0) {
    return <div className="text-xs text-slate-500 italic px-2 py-1">No values defined</div>
  }

  return (
    <div className="space-y-1" role="group" aria-label={`Filter by ${attribute.displayName}`}>
      {attribute.values.map((option) => {
        const isSelected = selectedValues.map(String).includes(option.value)

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => handleToggle(option.value)}
            className={cn(
              'w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm text-left transition-colors',
              isSelected ? 'bg-cyan-50 text-cyan-700' : 'text-slate-700 hover:bg-slate-100'
            )}
            role="checkbox"
            aria-checked={isSelected}
            aria-label={`${option.label}${isSelected ? ' (selected)' : ''}`}
          >
            <span
              className={cn(
                'w-4 h-4 rounded border flex items-center justify-center flex-shrink-0',
                isSelected ? 'bg-cyan-600 border-cyan-600' : 'border-slate-300 bg-white'
              )}
            >
              {isSelected && <Check className="w-3 h-3 text-white" />}
            </span>
            {option.color && (
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: option.color }}
              />
            )}
            <span className="flex-1 truncate">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
})

export default EnumFilterInput
