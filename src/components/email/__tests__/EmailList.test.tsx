/**
 * Unit tests for EmailList component
 * Story 2.1: Virtualized Inbox Rendering
 *
 * Tests integration with VirtualEmailList:
 * - AC1: @tanstack/react-virtual implemented for inbox list
 * - AC5: Empty state when no emails synced
 * - AC6: Loading state during sync
 * - AC2: Sorted by date (via hook integration)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EmailList } from '../EmailList'
import * as useEmailsModule from '@/hooks/useEmails'
import type { EmailDocument } from '@/services/database/schemas/email.schema'

// Mock the useEmails hook
vi.mock('@/hooks/useEmails', () => ({
  useEmails: vi.fn(),
}))

// Mock the email list store
vi.mock('@/store/emailListStore', () => ({
  useEmailListStore: vi.fn(() => ({
    scrollOffset: 0,
    setScrollOffset: vi.fn(),
  })),
}))

// Mock logger
vi.mock('@/services/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock ShortcutContext
vi.mock('@/context/ShortcutContext', () => ({
  useShortcuts: vi.fn(() => ({
    setActiveScope: vi.fn(),
    vimModeEnabled: false,
  })),
}))

// Mock useThread hook (ThreadDetailView uses this)
vi.mock('@/hooks/useThread', () => ({
  useThread: vi.fn(() => ({
    emails: [],
    loading: false,
    error: null,
  })),
}))

// Mock attribute filter store
vi.mock('@/store/attributeFilterStore', () => ({
  useAttributeFilterStore: vi.fn((selector) => {
    const state = {
      activeFilters: new Map(),
      getActiveFilterEntries: vi.fn(() => []),
      removeFilterValue: vi.fn(),
      clearAllFilters: vi.fn(),
      hasActiveFilters: vi.fn(() => false),
    }
    return selector ? selector(state) : state
  }),
}))

// Mock navigation shortcuts hook
vi.mock('@/hooks/useEmailShortcut', () => ({
  useNavigationShortcuts: vi.fn(),
  useActionShortcuts: vi.fn(),
}))

// Mock useAttributes hook
vi.mock('@/hooks/useAttributes', () => ({
  useAttributes: vi.fn(() => ({
    getAttributeById: vi.fn(),
  })),
}))

// Mock stores used by EmailList
vi.mock('@/store/emailStore', () => ({
  useEmailStore: vi.fn((selector) => {
    const state = {
      selectedEmailId: null,
      selectedThreadId: null,
      setSelectedEmail: vi.fn(),
      archiveEmails: vi.fn(),
      archiveEmail: vi.fn(),
      deleteEmails: vi.fn(),
      deleteEmail: vi.fn(),
      markAsRead: vi.fn(),
      markAsUnread: vi.fn(),
      toggleReadStatus: vi.fn(),
      isActionLoading: false,
    }
    return selector ? selector(state) : state
  }),
}))

vi.mock('@/store/selectionStore', () => ({
  useSelectionStore: vi.fn(() => ({
    selectedIds: new Set(),
    selectAll: vi.fn(),
    clearSelection: vi.fn(),
  })),
}))

vi.mock('@/store/folderStore', () => ({
  useFolderStore: vi.fn((selector) => {
    const state = { selectedFolder: 'INBOX' }
    return selector ? selector(state) : state
  }),
}))

// Mock keyboard shortcuts and undo hooks
vi.mock('@/hooks/useEmailKeyboardShortcuts', () => ({
  useEmailKeyboardShortcuts: vi.fn(),
}))

vi.mock('@/hooks/useUndoAction', () => ({
  useUndoAction: vi.fn(),
}))

// Mock pre-render manager
vi.mock('@/hooks/usePreRenderManager', () => ({
  usePreRenderManager: vi.fn(() => ({
    nextThreadId: null,
    prevThreadId: null,
    nextReady: false,
    prevReady: false,
    setNextReady: vi.fn(),
    setPrevReady: vi.fn(),
    consumeNext: vi.fn(),
    consumePrev: vi.fn(),
  })),
}))

// Mock compose store
vi.mock('@/store/composeStore', () => ({
  useComposeStore: vi.fn((selector) => {
    const state = {
      openComposeWithContext: vi.fn(),
      openDraft: vi.fn(),
    }
    return selector ? selector(state) : state
  }),
}))

// Mock email data
const mockEmails: EmailDocument[] = [
  {
    id: 'email-1',
    accountId: 'account-1',
    threadId: 'thread-1',
    subject: 'Newest Email',
    from: { name: 'Alice', email: 'alice@example.com' },
    to: [{ name: 'Bob', email: 'bob@example.com' }],
    timestamp: Date.now(),
    read: false,
    starred: false,
    labels: ['INBOX'],
    folder: 'INBOX',
    snippet: 'This is the newest email',
    body: { text: 'Body text' },
    attachments: [],
    importance: 'normal' as const,
    attributes: {},
  },
  {
    id: 'email-2',
    accountId: 'account-1',
    threadId: 'thread-2',
    subject: 'Older Email',
    from: { name: 'Charlie', email: 'charlie@example.com' },
    to: [{ name: 'Bob', email: 'bob@example.com' }],
    timestamp: Date.now() - 1000 * 60 * 60, // 1 hour ago
    read: true,
    starred: false,
    labels: ['INBOX'],
    folder: 'INBOX',
    snippet: 'This is an older email',
    body: { text: 'Body text' },
    attachments: [],
    importance: 'normal' as const,
    attributes: {},
  },
]

describe('EmailList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('AC6: Loading state during sync', () => {
    it('displays loading spinner when loading', () => {
      vi.mocked(useEmailsModule.useEmails).mockReturnValue({
        emails: [],
        loading: true,
        error: null,
        count: 0,
      })

      const { container } = render(<EmailList />)

      // Loading spinner has animate-spin class
      expect(container.querySelector('.animate-spin')).toBeInTheDocument()
    })

    it('shows loading animation', () => {
      vi.mocked(useEmailsModule.useEmails).mockReturnValue({
        emails: [],
        loading: true,
        error: null,
        count: 0,
      })

      render(<EmailList />)

      // Check for the spinner element
      const spinner = document.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
    })
  })

  describe('AC5: Empty state when no emails synced', () => {
    it('displays empty state when no emails', () => {
      vi.mocked(useEmailsModule.useEmails).mockReturnValue({
        emails: [],
        loading: false,
        error: null,
        count: 0,
      })

      render(<EmailList />)

      // EmptyInbox renders "You're all caught up!"
      expect(screen.getByText("You're all caught up!")).toBeInTheDocument()
    })

    it('shows helpful guidance in empty state', () => {
      vi.mocked(useEmailsModule.useEmails).mockReturnValue({
        emails: [],
        loading: false,
        error: null,
        count: 0,
      })

      render(<EmailList />)

      // EmptyInbox shows "No unread emails. Enjoy your day."
      expect(screen.getByText(/No unread emails/)).toBeInTheDocument()
    })
  })

  describe('Email list rendering with virtualization', () => {
    it('renders virtualized email list structure when emails exist', () => {
      vi.mocked(useEmailsModule.useEmails).mockReturnValue({
        emails: mockEmails,
        loading: false,
        error: null,
        count: mockEmails.length,
      })

      const { container } = render(<EmailList />)

      // Verify virtualized container structure is rendered
      // Note: In jsdom, virtualizer may not render actual email rows
      // because scroll element dimensions are zero
      expect(container.querySelector('.overflow-auto')).toBeInTheDocument()
    })

    it('displays email count in header', () => {
      vi.mocked(useEmailsModule.useEmails).mockReturnValue({
        emails: mockEmails,
        loading: false,
        error: null,
        count: mockEmails.length,
      })

      render(<EmailList />)

      expect(screen.getByText('2 emails')).toBeInTheDocument()
    })

    it('shows inbox header', () => {
      vi.mocked(useEmailsModule.useEmails).mockReturnValue({
        emails: mockEmails,
        loading: false,
        error: null,
        count: mockEmails.length,
      })

      // The folder comes from useFolderStore which is mocked to return 'INBOX'
      render(<EmailList />)

      expect(screen.getByText('INBOX')).toBeInTheDocument()
    })
  })

  describe('Error handling', () => {
    it('displays error state when error occurs', () => {
      vi.mocked(useEmailsModule.useEmails).mockReturnValue({
        emails: [],
        loading: false,
        error: new Error('Database connection failed'),
        count: 0,
      })

      render(<EmailList />)

      // ErrorState with type="sync" renders "Sync failed"
      expect(screen.getByText('Sync failed')).toBeInTheDocument()
      expect(screen.getByText('Database connection failed')).toBeInTheDocument()
    })
  })

  describe('AC2: Sort order (via hook)', () => {
    it('passes desc sort order to useEmails hook', () => {
      vi.mocked(useEmailsModule.useEmails).mockReturnValue({
        emails: [],
        loading: false,
        error: null,
        count: 0,
      })

      render(<EmailList />)

      expect(useEmailsModule.useEmails).toHaveBeenCalledWith(
        expect.objectContaining({
          sortOrder: 'desc',
        })
      )
    })
  })

  describe('Account filtering', () => {
    it('passes accountId to useEmails when provided', () => {
      vi.mocked(useEmailsModule.useEmails).mockReturnValue({
        emails: [],
        loading: false,
        error: null,
        count: 0,
      })

      render(<EmailList accountId="test-account" />)

      expect(useEmailsModule.useEmails).toHaveBeenCalledWith(
        expect.objectContaining({
          accountId: 'test-account',
        })
      )
    })
  })

  describe('Email detail panel', () => {
    it('shows "Select an email" prompt when no email selected', () => {
      vi.mocked(useEmailsModule.useEmails).mockReturnValue({
        emails: mockEmails,
        loading: false,
        error: null,
        count: mockEmails.length,
      })

      render(<EmailList />)

      // ThreadDetailView EmptyState shows "Select a conversation"
      expect(screen.getByText('Select a conversation')).toBeInTheDocument()
    })
  })
})
