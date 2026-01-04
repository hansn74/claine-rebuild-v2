/**
 * BooleanAttributeInput Component
 *
 * Story 2.14: Apply Attributes to Emails - UI & Interaction
 * Task 3.2: Create input components for boolean-type attributes
 *
 * AC 6: Boolean attributes show checkbox
 */

import { memo, useCallback } from 'react'
import { Check } from 'lucide-react'
import type { Attribute, AttributeValue } from '@/types/attributes'

interface BooleanAttributeInputProps {
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
}

/**
 * Checkbox/toggle input for boolean-type attributes
 * Three states: true, false, null (unset)
 */
export const BooleanAttributeInput = memo(function BooleanAttributeInput({
  attribute,
  value,
  onChange,
  disabled = false,
  ariaLabel,
}: BooleanAttributeInputProps) {
  const isChecked = value === true

  const handleChange = useCallback(() => {
    // Toggle between true and false (not null, to match user expectation)
    onChange(!isChecked)
  }, [isChecked, onChange])

  return (
    <label
      htmlFor={`attr-${attribute.id}`}
      className={`
        flex items-center gap-2 cursor-pointer
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      <div className="relative">
        <input
          id={`attr-${attribute.id}`}
          type="checkbox"
          checked={isChecked}
          onChange={handleChange}
          disabled={disabled}
          aria-label={ariaLabel || attribute.displayName}
          className="sr-only peer"
        />
        <div
          className={`
            w-5 h-5 rounded border-2 transition-colors
            flex items-center justify-center
            peer-focus:ring-2 peer-focus:ring-cyan-500 peer-focus:ring-offset-1
            ${isChecked ? 'bg-cyan-600 border-cyan-600 text-white' : 'bg-white border-slate-300'}
            ${!disabled ? 'hover:border-slate-400' : ''}
          `}
        >
          {isChecked && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
        </div>
      </div>
      <span className="text-sm text-slate-700">{isChecked ? 'Yes' : 'No'}</span>
    </label>
  )
})

export default BooleanAttributeInput
