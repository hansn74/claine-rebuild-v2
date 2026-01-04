/**
 * NumberRangeFilterInput Component
 *
 * Story 2.15: Attribute-Based Filtering & Search
 * Task 2.2: Min/max number inputs
 *
 * Allows filtering by number range (min and/or max)
 */

import React, { memo, useCallback, useState, useEffect, useMemo } from 'react'
import { cn } from '@/utils/cn'
import type { Attribute } from '@/types/attributes'
import type { FilterValue } from '@/store/attributeFilterStore'

interface NumberRangeFilterInputProps {
  /** Attribute definition */
  attribute: Attribute
  /** Currently selected values - stored as 'min:max' format */
  selectedValues: FilterValue[]
  /** Called when selection changes */
  onChange: (values: FilterValue[]) => void
  /** Debounce delay in ms */
  debounceMs?: number
}

/**
 * Parse number range from stored value
 */
function parseNumberRange(value: FilterValue): { min: string; max: string } {
  if (typeof value === 'string' && value.includes(':')) {
    const [min, max] = value.split(':')
    return { min: min || '', max: max || '' }
  }
  return { min: '', max: '' }
}

/**
 * Number range filter with min/max inputs
 */
export const NumberRangeFilterInput = memo(function NumberRangeFilterInput({
  attribute,
  selectedValues,
  onChange,
  debounceMs = 300,
}: NumberRangeFilterInputProps) {
  // Parse current range from selected values
  const currentRange = useMemo(() => {
    if (selectedValues.length > 0) {
      return parseNumberRange(selectedValues[0])
    }
    return { min: '', max: '' }
  }, [selectedValues])

  // Local state for input values
  const [minValue, setMinValue] = useState(currentRange.min)
  const [maxValue, setMaxValue] = useState(currentRange.max)

  // Sync external changes to local state
  useEffect(() => {
    if (currentRange.min !== minValue || currentRange.max !== maxValue) {
      setMinValue(currentRange.min)
      setMaxValue(currentRange.max)
    }
    // Only run when selectedValues changes externally
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedValues])

  // Debounce the onChange callback
  useEffect(() => {
    const timer = setTimeout(() => {
      if (minValue || maxValue) {
        onChange([`${minValue}:${maxValue}`])
      } else {
        onChange([])
      }
    }, debounceMs)

    return () => clearTimeout(timer)
  }, [minValue, maxValue, debounceMs, onChange])

  const handleMinChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setMinValue(e.target.value)
  }, [])

  const handleMaxChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setMaxValue(e.target.value)
  }, [])

  const handleClear = useCallback(() => {
    setMinValue('')
    setMaxValue('')
    onChange([])
  }, [onChange])

  const hasValue = minValue || maxValue

  return (
    <div className="space-y-2" role="group" aria-label={`Filter by ${attribute.displayName}`}>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={minValue}
          onChange={handleMinChange}
          placeholder="Min"
          className={cn(
            'flex-1 px-2 py-1.5 text-sm rounded-md border border-slate-200',
            'placeholder:text-slate-400',
            'focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500'
          )}
          aria-label={`${attribute.displayName} minimum value`}
        />
        <span className="text-slate-400 text-sm">to</span>
        <input
          type="number"
          value={maxValue}
          onChange={handleMaxChange}
          placeholder="Max"
          className={cn(
            'flex-1 px-2 py-1.5 text-sm rounded-md border border-slate-200',
            'placeholder:text-slate-400',
            'focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500'
          )}
          aria-label={`${attribute.displayName} maximum value`}
        />
      </div>
      {hasValue && (
        <button
          type="button"
          onClick={handleClear}
          className="text-xs text-cyan-600 hover:text-cyan-700"
        >
          Clear range
        </button>
      )}
    </div>
  )
})

export default NumberRangeFilterInput
