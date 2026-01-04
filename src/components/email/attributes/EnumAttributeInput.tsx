/**
 * EnumAttributeInput Component
 *
 * Story 2.14: Apply Attributes to Emails - UI & Interaction
 * Task 3.2: Create input components for enum-type attributes
 *
 * AC 3: Enum attributes show dropdown with values
 */

import { memo, useCallback, type ChangeEvent } from 'react'
import { ChevronDown } from 'lucide-react'
import type { Attribute, AttributeValue } from '@/types/attributes'

interface EnumAttributeInputProps {
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
 * Dropdown input for enum-type attributes
 * Displays colored options from attribute values array
 */
export const EnumAttributeInput = memo(function EnumAttributeInput({
  attribute,
  value,
  onChange,
  disabled = false,
  ariaLabel,
}: EnumAttributeInputProps) {
  const handleChange = useCallback(
    (e: ChangeEvent<HTMLSelectElement>) => {
      const newValue = e.target.value === '' ? null : e.target.value
      onChange(newValue)
    },
    [onChange]
  )

  // Find selected value's color for styling
  const selectedOption = attribute.values?.find((v) => v.value === value)

  return (
    <div className="relative">
      <select
        id={`attr-${attribute.id}`}
        value={value === null || value === undefined ? '' : String(value)}
        onChange={handleChange}
        disabled={disabled}
        aria-label={ariaLabel || `Select ${attribute.displayName}`}
        className={`
          w-full appearance-none rounded-md border px-3 py-2 pr-8
          text-sm transition-colors
          focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500
          disabled:opacity-50 disabled:cursor-not-allowed
          ${selectedOption?.color ? 'border-l-4' : 'border-slate-300'}
        `}
        style={selectedOption?.color ? { borderLeftColor: selectedOption.color } : undefined}
      >
        <option value="">Select {attribute.displayName}...</option>
        {attribute.values?.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown
        className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
        aria-hidden="true"
      />
    </div>
  )
})

export default EnumAttributeInput
