/**
 * SearchInput Component
 *
 * Story 2.5: Local Full-Text Search
 * Task 6.1: Create SearchInput component with keyboard focus (/)
 *
 * Search input field with keyboard shortcut support and search operators help.
 */

import React, { forwardRef, useEffect, useRef } from 'react'
import { Search, X, Loader2 } from 'lucide-react'
import { cn } from '@shared/utils/cn'

export interface SearchInputProps {
  /** Current search query value */
  value: string
  /** Called when query changes */
  onChange: (value: string) => void
  /** Placeholder text */
  placeholder?: string
  /** Whether search is in progress */
  isSearching?: boolean
  /** Show clear button when there's input */
  showClear?: boolean
  /** Called when clear button is clicked */
  onClear?: () => void
  /** Called when Escape is pressed */
  onEscape?: () => void
  /** Called when Enter is pressed */
  onSubmit?: () => void
  /** Additional className */
  className?: string
  /** Whether to auto-focus on mount */
  autoFocus?: boolean
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
}

/**
 * SearchInput - Input field for search queries
 *
 * Features:
 * - Search icon indicator
 * - Loading spinner during search
 * - Clear button
 * - Keyboard shortcuts (Escape to clear/close)
 */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  {
    value,
    onChange,
    placeholder = 'Search emails... (use quotes for exact match)',
    isSearching = false,
    showClear = true,
    onClear,
    onEscape,
    onSubmit,
    className,
    autoFocus = false,
    size = 'md',
  },
  forwardedRef
) {
  const internalRef = useRef<HTMLInputElement>(null)
  const ref = (forwardedRef as React.RefObject<HTMLInputElement>) || internalRef

  // Auto-focus on mount
  useEffect(() => {
    if (autoFocus && ref.current) {
      ref.current.focus()
    }
  }, [autoFocus, ref])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      if (value && onClear) {
        onClear()
      } else if (onEscape) {
        onEscape()
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      onSubmit?.()
    }
  }

  const handleClear = () => {
    onChange('')
    onClear?.()
    ref.current?.focus()
  }

  const sizeClasses = {
    sm: 'h-8 text-sm pl-8 pr-8',
    md: 'h-10 text-base pl-10 pr-10',
    lg: 'h-12 text-lg pl-12 pr-12',
  }

  const iconSizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  }

  const iconPositionClasses = {
    sm: 'left-2',
    md: 'left-3',
    lg: 'left-3.5',
  }

  const clearPositionClasses = {
    sm: 'right-2',
    md: 'right-3',
    lg: 'right-3.5',
  }

  return (
    <div className={cn('relative', className)}>
      {/* Search icon or loading spinner */}
      <div
        className={cn(
          'absolute top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none',
          iconPositionClasses[size]
        )}
      >
        {isSearching ? (
          <Loader2 className={cn(iconSizeClasses[size], 'animate-spin')} />
        ) : (
          <Search className={iconSizeClasses[size]} />
        )}
      </div>

      {/* Input field */}
      <input
        ref={ref}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={cn(
          'w-full rounded-md border border-slate-300 bg-white',
          'focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent',
          'placeholder:text-slate-400',
          'transition-colors',
          sizeClasses[size]
        )}
        aria-label="Search"
        role="searchbox"
      />

      {/* Clear button */}
      {showClear && value && (
        <button
          type="button"
          onClick={handleClear}
          className={cn(
            'absolute top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600',
            'focus:outline-none focus:text-slate-600',
            'transition-colors',
            clearPositionClasses[size]
          )}
          aria-label="Clear search"
        >
          <X className={iconSizeClasses[size]} />
        </button>
      )}
    </div>
  )
})
