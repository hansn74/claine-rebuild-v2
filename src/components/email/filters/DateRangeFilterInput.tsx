/**
 * DateRangeFilterInput Component
 *
 * Story 2.15: Attribute-Based Filtering & Search
 * Task 2.2: Date range picker (from/to)
 *
 * Allows filtering by date range with presets
 */

import React, { memo, useCallback, useState, useMemo } from 'react'
import { Calendar } from 'lucide-react'
import { cn } from '@/utils/cn'
import type { Attribute } from '@/types/attributes'
import type { FilterValue } from '@/store/attributeFilterStore'

interface DateRangeFilterInputProps {
  /** Attribute definition */
  attribute: Attribute
  /** Currently selected values - stored as 'from:to' format */
  selectedValues: FilterValue[]
  /** Called when selection changes */
  onChange: (values: FilterValue[]) => void
}

/**
 * Format date for input[type="date"]
 */
function formatDateForInput(date: Date): string {
  return date.toISOString().split('T')[0]
}

/**
 * Parse date range from stored value
 */
function parseDateRange(value: FilterValue): { from: string; to: string } {
  if (typeof value === 'string' && value.includes(':')) {
    const [from, to] = value.split(':')
    return { from: from || '', to: to || '' }
  }
  return { from: '', to: '' }
}

/**
 * Date range presets
 */
const DATE_PRESETS = [
  {
    label: 'Today',
    getRange: () => {
      const today = formatDateForInput(new Date())
      return { from: today, to: today }
    },
  },
  {
    label: 'Last 7 days',
    getRange: () => {
      const today = new Date()
      const weekAgo = new Date(today)
      weekAgo.setDate(weekAgo.getDate() - 7)
      return { from: formatDateForInput(weekAgo), to: formatDateForInput(today) }
    },
  },
  {
    label: 'Last 30 days',
    getRange: () => {
      const today = new Date()
      const monthAgo = new Date(today)
      monthAgo.setDate(monthAgo.getDate() - 30)
      return { from: formatDateForInput(monthAgo), to: formatDateForInput(today) }
    },
  },
  {
    label: 'This month',
    getRange: () => {
      const today = new Date()
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
      return { from: formatDateForInput(startOfMonth), to: formatDateForInput(today) }
    },
  },
]

/**
 * Date range filter with from/to inputs and presets
 */
export const DateRangeFilterInput = memo(function DateRangeFilterInput({
  attribute,
  selectedValues,
  onChange,
}: DateRangeFilterInputProps) {
  const [showCustom, setShowCustom] = useState(false)

  // Parse current date range
  const { from, to } = useMemo(() => {
    if (selectedValues.length > 0) {
      return parseDateRange(selectedValues[0])
    }
    return { from: '', to: '' }
  }, [selectedValues])

  const handlePresetClick = useCallback(
    (preset: (typeof DATE_PRESETS)[0]) => {
      const range = preset.getRange()
      onChange([`${range.from}:${range.to}`])
      setShowCustom(false)
    },
    [onChange]
  )

  const handleFromChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newFrom = e.target.value
      if (newFrom || to) {
        onChange([`${newFrom}:${to}`])
      } else {
        onChange([])
      }
    },
    [to, onChange]
  )

  const handleToChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newTo = e.target.value
      if (from || newTo) {
        onChange([`${from}:${newTo}`])
      } else {
        onChange([])
      }
    },
    [from, onChange]
  )

  const handleClear = useCallback(() => {
    onChange([])
    setShowCustom(false)
  }, [onChange])

  const hasValue = from || to

  return (
    <div className="space-y-2" role="group" aria-label={`Filter by ${attribute.displayName}`}>
      {/* Presets */}
      <div className="flex flex-wrap gap-1">
        {DATE_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => handlePresetClick(preset)}
            className={cn(
              'px-2 py-1 text-xs rounded-md transition-colors',
              'border border-slate-200',
              'text-slate-600 hover:bg-slate-100'
            )}
          >
            {preset.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowCustom(!showCustom)}
          className={cn(
            'px-2 py-1 text-xs rounded-md transition-colors',
            'border border-slate-200',
            showCustom
              ? 'bg-cyan-50 text-cyan-700 border-cyan-200'
              : 'text-slate-600 hover:bg-slate-100'
          )}
        >
          <Calendar className="w-3 h-3 inline-block mr-1" />
          Custom
        </button>
      </div>

      {/* Custom date inputs */}
      {(showCustom || hasValue) && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <label htmlFor={`date-from-${attribute.id}`} className="text-xs text-slate-500 w-10">
              From
            </label>
            <input
              id={`date-from-${attribute.id}`}
              type="date"
              value={from}
              onChange={handleFromChange}
              className={cn(
                'flex-1 px-2 py-1 text-sm rounded-md border border-slate-200',
                'focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500'
              )}
              aria-label={`${attribute.displayName} from date`}
            />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor={`date-to-${attribute.id}`} className="text-xs text-slate-500 w-10">
              To
            </label>
            <input
              id={`date-to-${attribute.id}`}
              type="date"
              value={to}
              onChange={handleToChange}
              min={from}
              className={cn(
                'flex-1 px-2 py-1 text-sm rounded-md border border-slate-200',
                'focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500'
              )}
              aria-label={`${attribute.displayName} to date`}
            />
          </div>
          {hasValue && (
            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-cyan-600 hover:text-cyan-700"
            >
              Clear dates
            </button>
          )}
        </div>
      )}
    </div>
  )
})

export default DateRangeFilterInput
