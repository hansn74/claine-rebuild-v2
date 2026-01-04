/**
 * TextFilterInput Component
 *
 * Story 2.15: Attribute-Based Filtering & Search
 * Task 2.2: Text contains search input
 *
 * Allows filtering by text content (contains match)
 */

import React, { memo, useCallback, useState, useEffect } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { Attribute } from '@/types/attributes'
import type { FilterValue } from '@/store/attributeFilterStore'

interface TextFilterInputProps {
  /** Attribute definition */
  attribute: Attribute
  /** Currently selected values */
  selectedValues: FilterValue[]
  /** Called when selection changes */
  onChange: (values: FilterValue[]) => void
  /** Debounce delay in ms */
  debounceMs?: number
}

/**
 * Text input for filtering by text content
 * Includes debounce to avoid excessive re-renders
 */
export const TextFilterInput = memo(function TextFilterInput({
  attribute,
  selectedValues,
  onChange,
  debounceMs = 300,
}: TextFilterInputProps) {
  // Local state for input value
  const [inputValue, setInputValue] = useState(
    selectedValues.length > 0 ? String(selectedValues[0]) : ''
  )

  // Sync external changes to local state
  useEffect(() => {
    const externalValue = selectedValues.length > 0 ? String(selectedValues[0]) : ''
    if (externalValue !== inputValue) {
      setInputValue(externalValue)
    }
    // Only run when selectedValues changes externally
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedValues])

  // Debounce the onChange callback
  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = inputValue.trim()
      if (trimmed) {
        onChange([trimmed])
      } else {
        onChange([])
      }
    }, debounceMs)

    return () => clearTimeout(timer)
  }, [inputValue, debounceMs, onChange])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
  }, [])

  const handleClear = useCallback(() => {
    setInputValue('')
    onChange([])
  }, [onChange])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClear()
      }
    },
    [handleClear]
  )

  return (
    <div className="relative">
      <Search
        className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
        aria-hidden="true"
      />
      <input
        type="text"
        value={inputValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={`Search ${attribute.displayName}...`}
        className={cn(
          'w-full pl-8 pr-8 py-1.5 text-sm rounded-md border border-slate-200',
          'placeholder:text-slate-400',
          'focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500'
        )}
        aria-label={`Filter by ${attribute.displayName}`}
      />
      {inputValue && (
        <button
          type="button"
          onClick={handleClear}
          className={cn(
            'absolute right-2 top-1/2 -translate-y-1/2',
            'p-0.5 rounded-full hover:bg-slate-100 transition-colors'
          )}
          aria-label="Clear filter"
        >
          <X className="w-3 h-3 text-slate-500" />
        </button>
      )}
    </div>
  )
})

export default TextFilterInput
