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
import { searchHistoryService } from '@/services/search'
import { getOperatorSearchHints } from '@/services/search/searchOperatorParser'
import { getAttributeSearchHints } from '@/services/search/attributeSearchParser'
import { useActiveScope } from '@/context/ShortcutContext'
import { useCommandUsage } from '@/hooks/useCommandUsage'
import type { ShortcutScope } from '@/types/shortcuts'

/**
 * Story 2.11: Task 5.3 - Command definitions with shortcut hints
 * Story 2.23: Added scopes for context-aware ranking
 */
interface CommandItem {
  id: string
  name: string
  description: string
  shortcut?: string
  icon: React.ReactNode
  category: 'navigation' | 'actions' | 'compose' | 'settings'
  /** Scopes where this command is most relevant (Story 2.23) */
  scopes?: ShortcutScope[]
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
 * Story 2.23: Added scopes for context-aware ranking
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
    scopes: ['global', 'inbox', 'reading'],
  },
  // Navigation
  {
    id: 'goto-inbox',
    name: 'Go to Inbox',
    description: 'Navigate to inbox',
    shortcut: 'g i',
    icon: COMMAND_ICONS.inbox,
    category: 'navigation',
    scopes: ['global', 'inbox'],
  },
  {
    id: 'goto-sent',
    name: 'Go to Sent',
    description: 'Navigate to sent mail',
    shortcut: 'g t',
    icon: COMMAND_ICONS.sent,
    category: 'navigation',
    scopes: ['global', 'inbox'],
  },
  {
    id: 'goto-drafts',
    name: 'Go to Drafts',
    description: 'Navigate to drafts',
    shortcut: 'g d',
    icon: COMMAND_ICONS.drafts,
    category: 'navigation',
    scopes: ['global', 'inbox'],
  },
  // Actions
  {
    id: 'archive',
    name: 'Archive',
    description: 'Archive selected email',
    shortcut: 'e',
    icon: COMMAND_ICONS.archive,
    category: 'actions',
    scopes: ['inbox', 'reading'],
  },
  {
    id: 'delete',
    name: 'Delete',
    description: 'Delete selected email',
    shortcut: '#',
    icon: COMMAND_ICONS.delete,
    category: 'actions',
    scopes: ['inbox', 'reading'],
  },
  {
    id: 'reply',
    name: 'Reply',
    description: 'Reply to email',
    shortcut: 'r',
    icon: COMMAND_ICONS.reply,
    category: 'actions',
    scopes: ['reading'],
  },
  {
    id: 'forward',
    name: 'Forward',
    description: 'Forward email',
    shortcut: 'f',
    icon: COMMAND_ICONS.forward,
    category: 'actions',
    scopes: ['reading'],
  },
  {
    id: 'star',
    name: 'Star/Unstar',
    description: 'Toggle star on email',
    shortcut: 's',
    icon: COMMAND_ICONS.star,
    category: 'actions',
    scopes: ['inbox', 'reading'],
  },
  // Settings
  {
    id: 'show-shortcuts',
    name: 'Keyboard Shortcuts',
    description: 'View all keyboard shortcuts',
    shortcut: '?',
    icon: COMMAND_ICONS.shortcuts,
    category: 'settings',
    scopes: ['global'],
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

// Recent search history is managed by searchHistoryService (max 20, localStorage)

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
 * Get recent searches from centralized searchHistoryService
 */
function getRecentSearches(): string[] {
  return searchHistoryService.getHistory()
}

/**
 * Add a search to recent searches via centralized service
 */
function addRecentSearch(query: string): void {
  searchHistoryService.addToHistory(query)
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
  const { query, setQuery, results, isSearching, searchTime, clear, activeOperators } = useSearch()
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

  // Story 2.23: Context-aware command ranking
  const activeScope = useActiveScope()
  const { recordCommandUsage, getRecentCommands } = useCommandUsage()

  /**
   * Story 2.11: Task 5.3 - Build action handlers map for commands
   * Story 2.23: Record command usage for context-aware ranking
   */
  const commandHandlers = useMemo(
    () => ({
      compose: () => {
        recordCommandUsage('compose')
        onCompose?.()
        onClose()
      },
      'goto-inbox': () => {
        recordCommandUsage('goto-inbox')
        onNavigate?.('inbox')
        onClose()
      },
      'goto-sent': () => {
        recordCommandUsage('goto-sent')
        onNavigate?.('sent')
        onClose()
      },
      'goto-drafts': () => {
        recordCommandUsage('goto-drafts')
        onNavigate?.('drafts')
        onClose()
      },
      archive: () => {
        recordCommandUsage('archive')
        onArchive?.()
        onClose()
      },
      delete: () => {
        recordCommandUsage('delete')
        onDelete?.()
        onClose()
      },
      reply: () => {
        recordCommandUsage('reply')
        onReply?.()
        onClose()
      },
      forward: () => {
        recordCommandUsage('forward')
        onForward?.()
        onClose()
      },
      star: () => {
        recordCommandUsage('star')
        onStar?.()
        onClose()
      },
      'show-shortcuts': () => {
        recordCommandUsage('show-shortcuts')
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
      recordCommandUsage,
    ]
  )

  /**
   * Story 2.11: Task 5.4 - Filtered commands based on query
   * Story 2.23: Context-aware ranking (recent → scope-relevant → alphabetical)
   * In search mode: no commands shown
   * In actions mode: filter commands by query, then rank
   */
  const { filteredCommands, recentCommandIds } = useMemo(() => {
    // Search mode: no quick actions
    if (mode === 'search') {
      return { filteredCommands: [], recentCommandIds: [] as string[] }
    }
    // Actions mode: filter commands by query
    const filtered = filterCommands(QUICK_COMMANDS, query)

    // Get recent commands for ranking
    const recentIds = getRecentCommands()

    // Sort: recent first, then scope-relevant, then alphabetical
    const sorted = filtered.sort((a, b) => {
      const aRecentIndex = recentIds.indexOf(a.id)
      const bRecentIndex = recentIds.indexOf(b.id)
      const aIsRecent = aRecentIndex !== -1
      const bIsRecent = bRecentIndex !== -1

      // Recent commands come first (ordered by recency)
      if (aIsRecent && !bIsRecent) return -1
      if (!aIsRecent && bIsRecent) return 1
      if (aIsRecent && bIsRecent) return aRecentIndex - bRecentIndex

      // Then scope-relevant commands
      const aInScope = a.scopes?.includes(activeScope) ?? false
      const bInScope = b.scopes?.includes(activeScope) ?? false
      if (aInScope && !bInScope) return -1
      if (!aInScope && bInScope) return 1

      // Finally alphabetical
      return a.name.localeCompare(b.name)
    })

    return { filteredCommands: sorted, recentCommandIds: recentIds }
  }, [mode, query, activeScope, getRecentCommands])

  // Determine which commands are in the "Recent" section (AC #6)
  const hasRecentSection =
    recentCommandIds.length > 0 && filteredCommands.some((cmd) => recentCommandIds.includes(cmd.id))

  /**
   * Story 2.22: Task 4.2/4.3 - Dynamic operator/attribute hints
   * Show combined hints when user types a colon (:) at end of a word
   */
  const operatorHints = useMemo(() => {
    if (mode !== 'search' || !query) return []
    // Check if the cursor is at an operator prefix (word ending with colon)
    const match = query.match(/(?:^|\s)(\w+):$/)
    if (!match) return []
    const prefix = match[1].toLowerCase()
    const allHints = [...getOperatorSearchHints(), ...getAttributeSearchHints()]
    return allHints.filter((h) => h.label.toLowerCase().startsWith(prefix))
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

  // Handle removing an operator chip (Story 2.22: Task 5.4)
  const handleRemoveOperator = useCallback(
    (operatorIndex: number) => {
      const op = activeOperators[operatorIndex]
      if (!op) return
      // Build a regex that matches the operator with any quote style (", ', or none)
      const escapedType = op.type.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const escapedValue = op.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      // Match type:value, type:"value", or type:'value'
      const regex = new RegExp(`${escapedType}:(?:["']${escapedValue}["']|${escapedValue})`, 'i')
      const newQuery = query.replace(regex, '').trim().replace(/\s+/g, ' ')
      setQuery(newQuery)
    },
    [activeOperators, query, setQuery]
  )

  // Handle selecting a recent search
  const handleRecentSearchClick = useCallback(
    (searchQuery: string) => {
      setQuery(searchQuery)
    },
    [setQuery]
  )

  // Handle selecting an operator hint (Story 2.22: Task 4.2/4.3)
  const handleHintClick = useCallback(
    (hintValue: string) => {
      if (!hintValue) return
      // Replace the partial operator prefix with the full hint value
      const newQuery = query.replace(/(\w+):$/, hintValue)
      setQuery(newQuery)
      inputRef.current?.focus()
    },
    [query, setQuery]
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
              {/* Active operator chips (Story 2.22: AC 11) */}
              {activeOperators.length > 0 && (
                <div className="flex flex-wrap gap-1.5 px-3 py-2 border-b border-slate-200">
                  {activeOperators.map((op, index) => (
                    <span
                      key={`${op.type}-${op.value}-${index}`}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-cyan-50 text-cyan-700 text-xs rounded-full border border-cyan-200"
                    >
                      {op.type}:{op.value}
                      <button
                        type="button"
                        onClick={() => handleRemoveOperator(index)}
                        className="ml-0.5 hover:text-cyan-900 transition-colors"
                        aria-label={`Remove ${op.type}:${op.value} filter`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* Operator/attribute hints (Story 2.22: Task 4.2/4.3) */}
              {operatorHints.length > 0 && (
                <div className="border-b border-slate-200 px-3 py-2">
                  <div className="text-xs text-slate-500 mb-1.5">Suggestions</div>
                  <div className="flex flex-wrap gap-1.5">
                    {operatorHints.map((hint) => (
                      <button
                        key={hint.label}
                        type="button"
                        onClick={() => handleHintClick(hint.value)}
                        className="inline-flex items-center gap-1.5 px-2 py-1 bg-slate-50 hover:bg-slate-100 text-sm rounded border border-slate-200 transition-colors"
                        title={hint.description}
                      >
                        <span className="font-mono text-cyan-700">{hint.label}</span>
                        <span className="text-xs text-slate-400">{hint.description}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

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
                    <span className="flex-1">Recent searches</span>
                    <button
                      type="button"
                      onClick={() => {
                        searchHistoryService.clearHistory()
                        setRecentSearches([])
                      }}
                      className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      Clear
                    </button>
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
                  <p className="text-xs mt-1">Try from:, to:, has:attachment, before:, after:</p>
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
                  <div className="space-y-1">
                    {filteredCommands.map((command, index) => {
                      // Check if this is the first recent command (to show header)
                      const isFirstRecent =
                        index === 0 && hasRecentSection && recentCommandIds.includes(command.id)
                      // Check if this is the first non-recent command (to show "All Actions" header)
                      const isFirstNonRecent =
                        hasRecentSection &&
                        !recentCommandIds.includes(command.id) &&
                        (index === 0 || recentCommandIds.includes(filteredCommands[index - 1]?.id))

                      return (
                        <React.Fragment key={command.id}>
                          {/* Recent section header (AC #6) */}
                          {isFirstRecent && (
                            <div className="flex items-center gap-2 text-xs text-slate-500 mb-2 mt-1">
                              <Clock className="w-3 h-3" />
                              <span>Recent</span>
                            </div>
                          )}
                          {/* All Actions header after recent section */}
                          {isFirstNonRecent && (
                            <div className="flex items-center gap-2 text-xs text-slate-500 mb-2 mt-3 pt-2 border-t border-slate-100">
                              <Keyboard className="w-3 h-3" />
                              <span>All Actions</span>
                            </div>
                          )}
                          {/* Show "Quick Actions" header if no recent section */}
                          {!hasRecentSection && index === 0 && (
                            <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                              <Keyboard className="w-3 h-3" />
                              <span>Quick Actions</span>
                            </div>
                          )}
                          <button
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
                        </React.Fragment>
                      )
                    })}
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
