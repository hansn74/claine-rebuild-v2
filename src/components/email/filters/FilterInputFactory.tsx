/**
 * FilterInputFactory Component
 *
 * Story 2.15: Attribute-Based Filtering & Search
 * Task 2.3: Factory to render correct filter based on attribute type
 *
 * Routes to the appropriate filter input component based on attribute type.
 */

import { memo } from 'react'
import type { Attribute } from '@/types/attributes'
import type { FilterValue } from '@/store/attributeFilterStore'
import { EnumFilterInput } from './EnumFilterInput'
import { BooleanFilterInput } from './BooleanFilterInput'
import { DateRangeFilterInput } from './DateRangeFilterInput'
import { TextFilterInput } from './TextFilterInput'
import { NumberRangeFilterInput } from './NumberRangeFilterInput'

interface FilterInputFactoryProps {
  /** Attribute definition */
  attribute: Attribute
  /** Currently selected filter values */
  selectedValues: FilterValue[]
  /** Called when filter values change */
  onChange: (values: FilterValue[]) => void
}

/**
 * Factory component that renders the appropriate filter input
 * based on the attribute type
 */
export const FilterInputFactory = memo(function FilterInputFactory({
  attribute,
  selectedValues,
  onChange,
}: FilterInputFactoryProps) {
  switch (attribute.type) {
    case 'enum':
      return (
        <EnumFilterInput
          attribute={attribute}
          selectedValues={selectedValues}
          onChange={onChange}
        />
      )

    case 'boolean':
      return (
        <BooleanFilterInput
          attribute={attribute}
          selectedValues={selectedValues}
          onChange={onChange}
        />
      )

    case 'date':
      return (
        <DateRangeFilterInput
          attribute={attribute}
          selectedValues={selectedValues}
          onChange={onChange}
        />
      )

    case 'text':
      return (
        <TextFilterInput
          attribute={attribute}
          selectedValues={selectedValues}
          onChange={onChange}
        />
      )

    case 'number':
      return (
        <NumberRangeFilterInput
          attribute={attribute}
          selectedValues={selectedValues}
          onChange={onChange}
        />
      )

    default:
      // Fallback to text filter for unknown types
      return (
        <TextFilterInput
          attribute={attribute}
          selectedValues={selectedValues}
          onChange={onChange}
        />
      )
  }
})

export default FilterInputFactory
