/**
 * AttributeInputFactory Component
 *
 * Story 2.14: Apply Attributes to Emails - UI & Interaction
 * Task 3.2: Factory for rendering attribute inputs based on type
 *
 * Renders the appropriate input component based on attribute type.
 */

import { memo } from 'react'
import type { Attribute, AttributeValue } from '@/types/attributes'
import { EnumAttributeInput } from './EnumAttributeInput'
import { TextAttributeInput } from './TextAttributeInput'
import { DateAttributeInput } from './DateAttributeInput'
import { BooleanAttributeInput } from './BooleanAttributeInput'
import { NumberAttributeInput } from './NumberAttributeInput'

interface AttributeInputFactoryProps {
  /** Attribute definition */
  attribute: Attribute
  /** Current value */
  value: AttributeValue | undefined
  /** Called when value changes */
  onChange: (value: AttributeValue) => void
  /** Disabled state */
  disabled?: boolean
  /** ARIA label override */
  ariaLabel?: string
}

/**
 * Factory component that renders the appropriate input
 * based on the attribute type
 */
export const AttributeInputFactory = memo(function AttributeInputFactory({
  attribute,
  value,
  onChange,
  disabled = false,
  ariaLabel,
}: AttributeInputFactoryProps) {
  switch (attribute.type) {
    case 'enum':
      return (
        <EnumAttributeInput
          attribute={attribute}
          value={value}
          onChange={onChange}
          disabled={disabled}
          ariaLabel={ariaLabel}
        />
      )

    case 'text':
      return (
        <TextAttributeInput
          attribute={attribute}
          value={value}
          onChange={onChange}
          disabled={disabled}
          ariaLabel={ariaLabel}
        />
      )

    case 'date':
      return (
        <DateAttributeInput
          attribute={attribute}
          value={value}
          onChange={onChange}
          disabled={disabled}
          ariaLabel={ariaLabel}
        />
      )

    case 'boolean':
      return (
        <BooleanAttributeInput
          attribute={attribute}
          value={value}
          onChange={onChange}
          disabled={disabled}
          ariaLabel={ariaLabel}
        />
      )

    case 'number':
      return (
        <NumberAttributeInput
          attribute={attribute}
          value={value}
          onChange={onChange}
          disabled={disabled}
          ariaLabel={ariaLabel}
        />
      )

    default:
      // Fallback to text input for unknown types
      return (
        <TextAttributeInput
          attribute={attribute}
          value={value}
          onChange={onChange}
          disabled={disabled}
          ariaLabel={ariaLabel}
        />
      )
  }
})

export default AttributeInputFactory
