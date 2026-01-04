/**
 * ShortcutOverlay Component
 *
 * Story 2.11: Keyboard Shortcuts & Power User Features
 * Task 6: Implement Shortcut Overlay (? key)
 *
 * AC 1: Shortcut cheat sheet accessible (? key)
 *
 * Displays all available keyboard shortcuts grouped by category.
 * Features search/filter, active scope indicator, and focus trap for accessibility.
 */

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react'
import { X, Search, Keyboard } from 'lucide-react'
import { useShortcuts, useActiveScope } from '@/context/ShortcutContext'
import { DEFAULT_SHORTCUTS, type ShortcutCategory } from '@/types/shortcuts'
import { cn } from '@/utils/cn'

interface ShortcutOverlayProps {
  open: boolean
  onClose: () => void
}

/**
 * Category display names and order
 */
const CATEGORY_CONFIG: Record<ShortcutCategory, { label: string; order: number }> = {
  navigation: { label: 'Navigation', order: 1 },
  actions: { label: 'Actions', order: 2 },
  composition: { label: 'Composition', order: 3 },
  search: { label: 'Search', order: 4 },
  general: { label: 'General', order: 5 },
  vim: { label: 'Vim Mode', order: 6 },
}

/**
 * Group shortcuts by category
 */
function groupShortcutsByCategory(
  shortcuts: typeof DEFAULT_SHORTCUTS,
  vimModeEnabled: boolean,
  filter: string
) {
  const groups = new Map<ShortcutCategory, typeof DEFAULT_SHORTCUTS>()

  // Filter and group
  shortcuts.forEach((shortcut) => {
    // Skip vim shortcuts if vim mode is disabled
    if (shortcut.requiresVimMode && !vimModeEnabled) return

    // Apply search filter
    if (filter) {
      const lowerFilter = filter.toLowerCase()
      const matchesDescription = shortcut.description.toLowerCase().includes(lowerFilter)
      const matchesKeys = shortcut.keys.toLowerCase().includes(lowerFilter)
      const matchesDisplayKeys = shortcut.displayKeys.toLowerCase().includes(lowerFilter)
      if (!matchesDescription && !matchesKeys && !matchesDisplayKeys) return
    }

    const existing = groups.get(shortcut.category) || []
    groups.set(shortcut.category, [...existing, shortcut])
  })

  // Sort categories by order
  const sortedCategories = Array.from(groups.entries()).sort(
    ([a], [b]) => CATEGORY_CONFIG[a].order - CATEGORY_CONFIG[b].order
  )

  return sortedCategories
}

/**
 * Keyboard shortcut key display component
 */
function KeyDisplay({ keys }: { keys: string }) {
  // Parse display keys into individual parts
  const parts = keys.split(/\s+/).filter(Boolean)

  return (
    <span className="flex items-center gap-1">
      {parts.map((part, index) => (
        <kbd
          key={index}
          className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 text-xs font-medium bg-slate-100 border border-slate-300 rounded shadow-sm"
        >
          {part}
        </kbd>
      ))}
    </span>
  )
}

/**
 * ShortcutOverlay - Keyboard shortcuts cheat sheet modal
 */
export default function ShortcutOverlay({ open, onClose }: ShortcutOverlayProps) {
  const [filter, setFilter] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  const { vimModeEnabled } = useShortcuts()
  const activeScope = useActiveScope()

  // Group shortcuts
  const groupedShortcuts = groupShortcutsByCategory(DEFAULT_SHORTCUTS, vimModeEnabled, filter)

  // Focus input on open
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus()
    }
  }, [open])

  // Handle escape key to close
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  // Focus trap (Task 6.7)
  useEffect(() => {
    if (!open || !overlayRef.current) return

    const overlay = overlayRef.current
    const focusableElements = overlay.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const firstFocusable = focusableElements[0]
    const lastFocusable = focusableElements[focusableElements.length - 1]

    const handleTabKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Tab') return

      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          e.preventDefault()
          lastFocusable?.focus()
        }
      } else {
        if (document.activeElement === lastFocusable) {
          e.preventDefault()
          firstFocusable?.focus()
        }
      }
    }

    window.addEventListener('keydown', handleTabKey)
    return () => window.removeEventListener('keydown', handleTabKey)
  }, [open])

  // Handle filter change
  const handleFilterChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setFilter(e.target.value)
  }, [])

  // Clear filter
  const handleClearFilter = useCallback(() => {
    setFilter('')
    inputRef.current?.focus()
  }, [])

  // Handle dialog keyboard events (escape handled by window listener)
  const handleDialogKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    // Prevent backdrop click handler from firing
    e.stopPropagation()
  }, [])

  if (!open) return null

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={overlayRef}
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleDialogKeyDown}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcut-overlay-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-slate-600" />
            <h2 id="shortcut-overlay-title" className="text-lg font-semibold text-slate-900">
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-slate-100 transition-colors"
            aria-label="Close shortcuts overlay"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Search and scope indicator */}
        <div className="p-4 border-b border-slate-200 space-y-3">
          {/* Search input (Task 6.4) */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              value={filter}
              onChange={handleFilterChange}
              placeholder="Search shortcuts..."
              className="w-full pl-10 pr-8 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              aria-label="Search shortcuts"
            />
            {filter && (
              <button
                type="button"
                onClick={handleClearFilter}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-slate-100"
                aria-label="Clear search"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            )}
          </div>

          {/* Active scope indicator (Task 6.5) */}
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span>Active scope:</span>
            <span className="px-2 py-0.5 bg-cyan-100 text-cyan-700 rounded-md font-medium capitalize">
              {activeScope}
            </span>
            {vimModeEnabled && (
              <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-md font-medium">
                Vim Mode
              </span>
            )}
          </div>
        </div>

        {/* Shortcut list */}
        <div className="flex-1 overflow-y-auto p-4">
          {groupedShortcuts.length === 0 ? (
            <div className="text-center py-8 text-slate-500">No shortcuts match your search</div>
          ) : (
            <div className="space-y-6">
              {groupedShortcuts.map(([category, shortcuts]) => (
                <div key={category}>
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
                    {CATEGORY_CONFIG[category].label}
                  </h3>
                  <div className="space-y-2">
                    {shortcuts.map((shortcut) => (
                      <div
                        key={shortcut.id}
                        className={cn(
                          'flex items-center justify-between py-2 px-3 rounded-md',
                          shortcut.scopes.includes(activeScope) ? 'bg-cyan-50' : 'hover:bg-slate-50'
                        )}
                      >
                        <span className="text-slate-700">{shortcut.description}</span>
                        <KeyDisplay keys={shortcut.displayKeys} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50">
          <p className="text-sm text-slate-500 text-center">
            Press <kbd className="px-1.5 py-0.5 bg-slate-200 rounded text-xs">Esc</kbd> to close
          </p>
        </div>
      </div>
    </div>
  )
}
