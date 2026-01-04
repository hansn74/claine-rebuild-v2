/**
 * TextAttributeInput Component
 *
 * Story 2.14: Apply Attributes to Emails - UI & Interaction
 * Task 3.2: Create input components for text-type attributes
 *
 * AC 4: Text attributes show input field
 */

import { memo, useCallback, useRef, type ChangeEvent, type FocusEvent } from 'react'
import type { Attribute, AttributeValue } from '@/types/attributes'

interface TextAttributeInputProps {
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
 * Text input for text-type attributes
 * Uses uncontrolled pattern with debounced save
 */
export const TextAttributeInput = memo(function TextAttributeInput({
  attribute,
  value,
  onChange,
  disabled = false,
  ariaLabel,
  debounceMs = 300,
}: TextAttributeInputProps) {
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
        onChange(newValue === '' ? null : newValue)
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
      const finalValue = newValue === '' ? null : newValue
      if (finalValue !== value) {
        onChange(finalValue)
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
      type="text"
      defaultValue={valueToString(value)}
      onChange={handleChange}
      onBlur={handleBlur}
      disabled={disabled}
      placeholder={`Enter ${attribute.displayName.toLowerCase()}...`}
      aria-label={ariaLabel || `Enter ${attribute.displayName}`}
      className={`
        w-full rounded-md border border-slate-300 px-3 py-2
        text-sm transition-colors
        focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500
        disabled:opacity-50 disabled:cursor-not-allowed
        placeholder:text-slate-400
      `}
      maxLength={500}
    />
  )
})

export default TextAttributeInput
