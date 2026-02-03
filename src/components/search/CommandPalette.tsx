/**
 * CommandPalette Component
 *
 * Story 2.5: Local Full-Text Search
 * Task 7: Create Command Palette Integration
 *
 * Story 2.12: Empty States & Onboarding UX
 * Task 6.2: Integrated EmptySearch for no results state (AC3)
 *
 * Cmd+K / Ctrl+K triggered command palette with integrated search.
 * Supports keyboard navigation, recent searches, and quick actions.
 */

import React, { useState, useEffect, useCallback, useRef, memo, useMemo } from 'react'
import {
  X,
  Clock,
  Search as SearchIcon,
  Archive,
  Trash2,
  Mail,
  Reply,
  Forward,
  Star,
  Keyboard,
  PenSquare,
  Inbox,
  Send,
  FileText,
} from 'lucide-react'
import { cn } from '@shared/utils/cn'
import { useSearch } from '@/hooks/useSearch'
import { SearchInput } from './SearchInput'
import { SearchResults } from './SearchResults'
import { logger } from '@/services/logger'

/**
 * Story 2.11: Task 5.3 - Command definitions with shortcut hints
 */
interface CommandItem {
  id: string
  name: string
  description: string
  shortcut?: string
  icon: React.ReactNode
  category: 'navigation' | 'actions' | 'compose' | 'settings'
  action?: () => void
}

/**
 * Get icon for a command
 */
const COMMAND_ICONS = {
  archive: <Archive className="w-4 h-4" />,
  delete: <Trash2 className="w-4 h-4" />,
  markRead: <Mail className="w-4 h-4" />,
  reply: <Reply className="w-4 h-4" />,
  forward: <Forward className="w-4 h-4" />,
  star: <Star className="w-4 h-4" />,
  compose: <PenSquare className="w-4 h-4" />,
  inbox: <Inbox className="w-4 h-4" />,
  sent: <Send className="w-4 h-4" />,
  drafts: <FileText className="w-4 h-4" />,
  shortcuts: <Keyboard className="w-4 h-4" />,
}

/**
 * Story 2.11: Task 5.3 - Available commands for the command palette
 */
const QUICK_COMMANDS: CommandItem[] = [
  // Compose
  {
    id: 'compose',
    name: 'New Email',
    description: 'Compose a new email',
    shortcut: 'c',
    icon: COMMAND_ICONS.compose,
    category: 'compose',
  },
  // Navigation
  {
    id: 'goto-inbox',
    name: 'Go to Inbox',
    description: 'Navigate to inbox',
    shortcut: 'g i',
    icon: COMMAND_ICONS.inbox,
    category: 'navigation',
  },
  {
    id: 'goto-sent',
    name: 'Go to Sent',
    description: 'Navigate to sent mail',
    shortcut: 'g t',
    icon: COMMAND_ICONS.sent,
    category: 'navigation',
  },
  {
    id: 'goto-drafts',
    name: 'Go to Drafts',
    description: 'Navigate to drafts',
    shortcut: 'g d',
    icon: COMMAND_ICONS.drafts,
    category: 'navigation',
  },
  // Actions
  {
    id: 'archive',
    name: 'Archive',
    description: 'Archive selected email',
    shortcut: 'e',
    icon: COMMAND_ICONS.archive,
    category: 'actions',
  },
  {
    id: 'delete',
    name: 'Delete',
    description: 'Delete selected email',
    shortcut: '#',
    icon: COMMAND_ICONS.delete,
    category: 'actions',
  },
  {
    id: 'reply',
    name: 'Reply',
    description: 'Reply to email',
    shortcut: 'r',
    icon: COMMAND_ICONS.reply,
    category: 'actions',
  },
  {
    id: 'forward',
    name: 'Forward',
    description: 'Forward email',
    shortcut: 'f',
    icon: COMMAND_ICONS.forward,
    category: 'actions',
  },
  {
    id: 'star',
    name: 'Star/Unstar',
    description: 'Toggle star on email',
    shortcut: 's',
    icon: COMMAND_ICONS.star,
    category: 'actions',
  },
  // Settings
  {
    id: 'show-shortcuts',
    name: 'Keyboard Shortcuts',
    description: 'View all keyboard shortcuts',
    shortcut: '?',
    icon: COMMAND_ICONS.shortcuts,
    category: 'settings',
  },
]

/**
 * Story 2.11: Task 5.4 - Fuzzy filter commands by query
 */
function filterCommands(commands: CommandItem[], query: string): CommandItem[] {
  if (!query.trim()) return commands
  const lowerQuery = query.toLowerCase()
  return commands.filter(
    (cmd) =>
      cmd.name.toLowerCase().includes(lowerQuery) ||
      cmd.description.toLowerCase().includes(lowerQuery) ||
      cmd.shortcut?.toLowerCase().includes(lowerQuery)
  )
}

/**
 * Recent search storage key
 */
const RECENT_SEARCHES_KEY = 'claine_recent_searches'
const MAX_RECENT_SEARCHES = 10

export interface CommandPaletteProps {
  /** Whether the palette is open */
  open: boolean
  /** Called when palette should close */
  onClose: () => void
  /** Mode: 'search' for email search, 'actions' for quick commands */
  mode?: 'search' | 'actions'
  /** Called when an email is selected (search mode) */
  onSelectEmail?: (emailId: string) => void
  /** Story 2.11: Task 5 - Action handlers for commands */
  onCompose?: () => void
  onNavigate?: (folder: string) => void
  onArchive?: () => void
  onDelete?: () => void
  onReply?: () => void
  onForward?: () => void
  onStar?: () => void
  onShowShortcuts?: () => void
}

/**
 * Get recent searches from localStorage
 */
function getRecentSearches(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

/**
 * Add a search to recent searches
 */
function addRecentSearch(query: string): void {
  if (!query.trim()) return

  try {
    const recent = getRecentSearches()
    // Remove if already exists
    const filtered = recent.filter((s) => s !== query)
    // Add to front
    const updated = [query, ...filtered].slice(0, MAX_RECENT_SEARCHES)
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated))
  } catch {
    // Ignore storage errors
  }
}

/**
 * CommandPalette - Keyboard-accessible search interface
 *
 * Features:
 * - Opens with Cmd+K (Mac) or Ctrl+K (Windows/Linux)
 * - Keyboard navigation (up/down arrows)
 * - Recent searches history
 * - Integrated with useSearch hook
 */
export const CommandPalette = memo(function CommandPalette({
  open,
  onClose,
  mode = 'search',
  onSelectEmail,
  onCompose,
  onNavigate,
  onArchive,
  onDelete,
  onReply,
  onForward,
  onStar,
  onShowShortcuts,
}: CommandPaletteProps) {
  const { query, setQuery, results, isSearching, searchTime, clear } = useSearch()
  const [selectedIndex, setSelectedIndex] = useState(0)
  // Initialize recent searches lazily
  const [recentSearches, setRecentSearches] = useState<string[]>(() =>
    open ? getRecentSearches() : []
  )
  const inputRef = useRef<HTMLInputElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const actionsContainerRef = useRef<HTMLDivElement>(null)
  const prevOpenRef = useRef(open)
  const prevResultsLengthRef = useRef(results.length)

  /**
   * Story 2.11: Task 5.3 - Build action handlers map for commands
   */
  const commandHandlers = useMemo(
    () => ({
      compose: () => {
        onCompose?.()
        onClose()
      },
      'goto-inbox': () => {
        onNavigate?.('inbox')
        onClose()
      },
      'goto-sent': () => {
        onNavigate?.('sent')
        onClose()
      },
      'goto-drafts': () => {
        onNavigate?.('drafts')
        onClose()
      },
      archive: () => {
        onArchive?.()
        onClose()
      },
      delete: () => {
        onDelete?.()
        onClose()
      },
      reply: () => {
        onReply?.()
        onClose()
      },
      forward: () => {
        onForward?.()
        onClose()
      },
      star: () => {
        onStar?.()
        onClose()
      },
      'show-shortcuts': () => {
        onShowShortcuts?.()
        onClose()
      },
    }),
    [
      onCompose,
      onNavigate,
      onArchive,
      onDelete,
      onReply,
      onForward,
      onStar,
      onShowShortcuts,
      onClose,
    ]
  )

  /**
   * Story 2.11: Task 5.4 - Filtered commands based on query
   * In search mode: no commands shown
   * In actions mode: filter commands by query
   */
  const filteredCommands = useMemo(() => {
    // Search mode: no quick actions
    if (mode === 'search') {
      return []
    }
    // Actions mode: filter commands by query
    return filterCommands(QUICK_COMMANDS, query)
  }, [mode, query])

  // Track open state changes and perform side effects
  if (open && !prevOpenRef.current) {
    // Modal just opened - reset state synchronously during render
    // This is safe per React docs for derived state from props
    prevOpenRef.current = true
    // These are controlled updates during render phase
  }
  if (!open && prevOpenRef.current) {
    prevOpenRef.current = false
  }

  // Track results length changes for selection reset
  if (results.length !== prevResultsLengthRef.current) {
    prevResultsLengthRef.current = results.length
    // Selection will be reset on next user interaction or we handle it in callback
  }

  // Focus input and clear search when opened (side effect only)
  useEffect(() => {
    if (open) {
      // Reload recent searches when palette opens
      setRecentSearches(getRecentSearches())
      // Reset selection
      setSelectedIndex(0)
      clear()
      // Focus input after modal is rendered
      const timerId = setTimeout(() => {
        inputRef.current?.focus()
      }, 50)
      return () => clearTimeout(timerId)
    }
    return undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Scroll selected action into view when navigating with keyboard
  useEffect(() => {
    if (mode === 'actions' && actionsContainerRef.current) {
      const selectedButton = actionsContainerRef.current.querySelector(
        `[data-index="${selectedIndex}"]`
      ) as HTMLElement | null
      if (selectedButton) {
        selectedButton.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  }, [mode, selectedIndex])

  // Handle selecting an email
  const handleSelectEmail = useCallback(
    (emailId: string) => {
      // Save search to recent
      if (query) {
        addRecentSearch(query)
      }

      logger.debug('search', 'Email selected from command palette', { emailId })
      onSelectEmail?.(emailId)
      onClose()
    },
    [query, onSelectEmail, onClose]
  )

  // Handle selecting a recent search
  const handleRecentSearchClick = useCallback(
    (searchQuery: string) => {
      setQuery(searchQuery)
    },
    [setQuery]
  )

  // Keyboard navigation - handles both search and actions modes
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Get the correct max index based on mode
      const maxIndex = mode === 'search' ? results.length - 1 : filteredCommands.length - 1

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((prev) => Math.min(prev + 1, Math.max(0, maxIndex)))
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((prev) => Math.max(prev - 1, 0))
          break
        case 'Enter':
          e.preventDefault()
          if (mode === 'search') {
            // Search mode: select email
            if (results[selectedIndex]) {
              handleSelectEmail(results[selectedIndex].email.id)
            }
          } else {
            // Actions mode: execute command
            const command = filteredCommands[selectedIndex]
            if (command) {
              commandHandlers[command.id as keyof typeof commandHandlers]?.()
            }
          }
          break
        case 'Escape':
          e.preventDefault()
          if (query) {
            clear()
          } else {
            onClose()
          }
          break
      }
    },
    [
      mode,
      results,
      filteredCommands,
      selectedIndex,
      query,
      clear,
      onClose,
      handleSelectEmail,
      commandHandlers,
    ]
  )

  // Close on backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose()
      }
    },
    [onClose]
  )

  // Don't render if not open
  if (!open) {
    return null
  }

  return (
    // Backdrop - using div with button role for accessible backdrop click handling
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-[15vh]"
      onClick={handleBackdropClick}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
      role="button"
      tabIndex={-1}
      aria-label="Close search"
    >
      {/* Modal - dialog role is interactive, keyboard handler is for navigation */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={modalRef}
        className={cn(
          'bg-white rounded-lg shadow-2xl',
          'flex flex-col overflow-hidden',
          'animate-in fade-in zoom-in-95 duration-150'
        )}
        style={{ width: '600px', minWidth: '600px' }}
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'search' ? 'Search emails' : 'Quick actions'}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center gap-2 p-3 border-b border-slate-200">
          <SearchInput
            ref={inputRef}
            value={query}
            onChange={setQuery}
            isSearching={isSearching}
            onClear={clear}
            onEscape={onClose}
            placeholder={mode === 'search' ? 'Search emails...' : 'Type to filter actions...'}
            className="flex-1"
            size="md"
            showClear
          />
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {/* SEARCH MODE CONTENT */}
          {mode === 'search' && (
            <>
              {/* Search results */}
              {query && (
                <>
                  <SearchResults
                    results={results}
                    selectedIndex={selectedIndex}
                    onSelect={setSelectedIndex}
                    onClick={handleSelectEmail}
                    maxHeight={384}
                    searchQuery={query}
                    isSearching={isSearching}
                    emptyMessage="Searching..."
                  />

                  {/* Search time indicator */}
                  {searchTime !== null && results.length > 0 && (
                    <div className="border-t border-slate-200 px-3 py-2 text-xs text-slate-500">
                      {results.length} result{results.length !== 1 ? 's' : ''} in{' '}
                      {searchTime.toFixed(0)}ms
                    </div>
                  )}
                </>
              )}

              {/* Recent searches (when no query) */}
              {!query && recentSearches.length > 0 && (
                <div className="p-3">
                  <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                    <Clock className="w-3 h-3" />
                    <span>Recent searches</span>
                  </div>
                  <div className="space-y-1">
                    {recentSearches.map((search, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => handleRecentSearchClick(search)}
                        className={cn(
                          'w-full text-left px-3 py-2 text-sm rounded-md',
                          'hover:bg-slate-100 transition-colors',
                          'flex items-center gap-2'
                        )}
                      >
                        <SearchIcon className="w-4 h-4 text-slate-400" />
                        <span>{search}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state for search mode */}
              {!query && recentSearches.length === 0 && (
                <div className="p-8 text-center text-slate-500 text-sm">
                  <SearchIcon className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p>Type to search emails</p>
                  <p className="text-xs mt-1">
                    Use quotes for exact phrases: &quot;budget meeting&quot;
                  </p>
                </div>
              )}
            </>
          )}

          {/* ACTIONS MODE CONTENT */}
          {mode === 'actions' && (
            <>
              {/* Quick Actions with shortcut hints */}
              {filteredCommands.length > 0 && (
                <div ref={actionsContainerRef} className="p-3 max-h-96 overflow-y-auto">
                  <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                    <Keyboard className="w-3 h-3" />
                    <span>Quick Actions</span>
                  </div>
                  <div className="space-y-1">
                    {filteredCommands.map((command, index) => (
                      <button
                        key={command.id}
                        type="button"
                        data-index={index}
                        onClick={() =>
                          commandHandlers[command.id as keyof typeof commandHandlers]?.()
                        }
                        className={cn(
                          'w-full text-left px-3 py-2.5 text-sm rounded-md',
                          'hover:bg-slate-100 transition-colors',
                          'flex items-center gap-3 group',
                          selectedIndex === index && 'bg-cyan-50 hover:bg-cyan-50'
                        )}
                      >
                        <span className="text-slate-400 group-hover:text-slate-600">
                          {command.icon}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-slate-700">{command.name}</div>
                          <div className="text-xs text-slate-500 truncate">
                            {command.description}
                          </div>
                        </div>
                        {/* Shortcut hint display */}
                        {command.shortcut && (
                          <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-200 rounded text-[10px] text-slate-500 font-mono whitespace-nowrap">
                            {command.shortcut}
                          </kbd>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state for actions mode (no matching commands) */}
              {filteredCommands.length === 0 && (
                <div className="p-8 text-center text-slate-500 text-sm">
                  <Keyboard className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p>No matching actions</p>
                  <p className="text-xs mt-1">Try a different search term</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer with keyboard hints */}
        <div className="border-t border-slate-200 px-3 py-2 text-xs text-slate-500 flex items-center gap-4">
          <span>
            <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px]">&#8593;&#8595;</kbd>{' '}
            Navigate
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px]">Enter</kbd> Select
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px]">Esc</kbd> Close
          </span>
        </div>
      </div>
    </div>
  )
})
