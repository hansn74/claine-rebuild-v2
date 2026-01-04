/**
 * NumberAttributeInput Component
 *
 * Story 2.14: Apply Attributes to Emails - UI & Interaction
 * Task 3.2: Create input components for number-type attributes
 *
 * Number input with optional min/max constraints
 */

import { memo, useCallback, useRef, type ChangeEvent, type FocusEvent } from 'react'
import type { Attribute, AttributeValue } from '@/types/attributes'

interface NumberAttributeInputProps {
  /** Attribute definition */
  attribute: Attribute
  /** Current value */
  value: AttributeValue | undefined
  /** Called when value changes */
  onChange: (value: AttributeValue) => void
  /** Disabled state */
  disabled?: boolean
  /** ARIA label for accessibility */
  ariaLabel?: string
  /** Minimum value */
  min?: number
  /** Maximum value */
  max?: number
  /** Step increment */
  step?: number
  /** Debounce delay in ms (default: 300) */
  debounceMs?: number
}

/**
 * Convert value to string for display
 */
function valueToString(value: AttributeValue | undefined): string {
  return value === null || value === undefined ? '' : String(value)
}

/**
 * Number input for number-type attributes
 * Uses uncontrolled pattern with debounced save
 */
export const NumberAttributeInput = memo(function NumberAttributeInput({
  attribute,
  value,
  onChange,
  disabled = false,
  ariaLabel,
  min,
  max,
  step = 1,
  debounceMs = 300,
}: NumberAttributeInputProps) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value

      // Clear existing timeout
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }

      // Debounce the onChange callback
      debounceRef.current = setTimeout(() => {
        if (newValue === '') {
          onChange(null)
        } else {
          const num = parseFloat(newValue)
          if (!isNaN(num)) {
            onChange(num)
          }
        }
      }, debounceMs)
    },
    [onChange, debounceMs]
  )

  // Handle blur - save immediately without waiting for debounce
  const handleBlur = useCallback(
    (e: FocusEvent<HTMLInputElement>) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
        debounceRef.current = null
      }
      const newValue = e.target.value

      if (newValue === '') {
        if (value !== null && value !== undefined) {
          onChange(null)
        }
      } else {
        const num = parseFloat(newValue)
        if (!isNaN(num) && num !== value) {
          onChange(num)
        }
      }
    },
    [value, onChange]
  )

  // Use key to reset input when external value changes
  // This is the React-recommended pattern for syncing external state
  const key = `${attribute.id}-${valueToString(value)}`

  return (
    <input
      key={key}
      id={`attr-${attribute.id}`}
      type="number"
      defaultValue={valueToString(value)}
      onChange={handleChange}
      onBlur={handleBlur}
      disabled={disabled}
      placeholder="0"
      aria-label={ariaLabel || `Enter ${attribute.displayName}`}
      min={min}
      max={max}
      step={step}
      className={`
        w-full rounded-md border border-slate-300 px-3 py-2
        text-sm transition-colors
        focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500
        disabled:opacity-50 disabled:cursor-not-allowed
        placeholder:text-slate-400
        [appearance:textfield]
        [&::-webkit-outer-spin-button]:appearance-none
        [&::-webkit-inner-spin-button]:appearance-none
      `}
    />
  )
})

export default NumberAttributeInput
