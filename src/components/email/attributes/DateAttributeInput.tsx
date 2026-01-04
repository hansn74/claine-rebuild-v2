/**
 * DateAttributeInput Component
 *
 * Story 2.14: Apply Attributes to Emails - UI & Interaction
 * Task 3.2: Create input components for date-type attributes
 *
 * AC 5: Date attributes show date picker
 */

import { memo, useCallback, type ChangeEvent } from 'react'
import { Calendar } from 'lucide-react'
import type { Attribute, AttributeValue } from '@/types/attributes'

interface DateAttributeInputProps {
  /** Attribute definition */
  attribute: Attribute
  /** Current value (ISO date string YYYY-MM-DD) */
  value: AttributeValue | undefined
  /** Called when value changes */
  onChange: (value: AttributeValue) => void
  /** Disabled state */
  disabled?: boolean
  /** ARIA label for accessibility */
  ariaLabel?: string
}

/**
 * Date picker input for date-type attributes
 * Uses native HTML5 date input for cross-browser compatibility
 */
export const DateAttributeInput = memo(function DateAttributeInput({
  attribute,
  value,
  onChange,
  disabled = false,
  ariaLabel,
}: DateAttributeInputProps) {
  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value === '' ? null : e.target.value
      onChange(newValue)
    },
    [onChange]
  )

  // Clear the date
  const handleClear = useCallback(() => {
    onChange(null)
  }, [onChange])

  const dateValue = value === null || value === undefined ? '' : String(value)

  return (
    <div className="relative">
      <input
        id={`attr-${attribute.id}`}
        type="date"
        value={dateValue}
        onChange={handleChange}
        disabled={disabled}
        aria-label={ariaLabel || `Select ${attribute.displayName}`}
        className={`
          w-full rounded-md border border-slate-300 px-3 py-2 pr-8
          text-sm transition-colors
          focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500
          disabled:opacity-50 disabled:cursor-not-allowed
          [&::-webkit-calendar-picker-indicator]:opacity-0
          [&::-webkit-calendar-picker-indicator]:absolute
          [&::-webkit-calendar-picker-indicator]:right-0
          [&::-webkit-calendar-picker-indicator]:w-8
          [&::-webkit-calendar-picker-indicator]:h-full
          [&::-webkit-calendar-picker-indicator]:cursor-pointer
        `}
      />
      <Calendar
        className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
        aria-hidden="true"
      />
      {dateValue && !disabled && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-8 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
          aria-label="Clear date"
        >
          &times;
        </button>
      )}
    </div>
  )
})

export default DateAttributeInput
