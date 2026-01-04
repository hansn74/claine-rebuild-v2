/**
 * Folder Store
 *
 * Story 2.9: Email Folders & Labels
 * Task 1.5: Persist selected folder to localStorage/Zustand on app restart
 *
 * Manages folder selection state using Zustand with localStorage persistence.
 * Follows the pattern from settingsStore.ts for persistence.
 *
 * AC 6: Folder selection persists across app restarts
 */

import { create } from 'zustand'
import { logger } from '@/services/logger'

/**
 * localStorage key for persisting folder selection
 */
const FOLDER_KEY = 'claine_folder_selection'

/**
 * Standard folder types supported by the app
 * Maps to Gmail system labels and Outlook well-known folders
 */
export type StandardFolder = 'inbox' | 'sent' | 'drafts' | 'archive' | 'trash' | 'spam'

/**
 * Folder item representing a folder/label in the sidebar
 */
export interface FolderItem {
  id: string // Folder ID (e.g., 'INBOX', 'SENT', user label ID)
  name: string // Display name
  type: 'standard' | 'gmail-label' | 'outlook-folder'
  unreadCount: number // Unread email count
  color?: string // Gmail label color (hex)
  parentId?: string // Parent folder ID for nested folders (Outlook)
  icon?: string // Optional icon name
}

/**
 * Folder store state and actions
 */
export interface FolderStoreState {
  /** Currently selected folder ID */
  selectedFolder: string
  /** List of Gmail labels (user-created) */
  gmailLabels: FolderItem[]
  /** List of Outlook folders */
  outlookFolders: FolderItem[]
  /** Unread counts per folder */
  unreadCounts: Record<string, number>
  /** Loading state for folder sync */
  loading: boolean

  // Actions
  setSelectedFolder: (folderId: string) => void
  setGmailLabels: (labels: FolderItem[]) => void
  setOutlookFolders: (folders: FolderItem[]) => void
  setUnreadCount: (folderId: string, count: number) => void
  setUnreadCounts: (counts: Record<string, number>) => void
  setLoading: (loading: boolean) => void
}

/**
 * Load persisted folder selection from localStorage
 */
function loadPersistedFolder(): string {
  try {
    const stored = localStorage.getItem(FOLDER_KEY)
    if (stored) {
      return stored
    }
  } catch {
    // Ignore localStorage errors
  }
  return 'inbox' // Default to inbox
}

/**
 * Persist folder selection to localStorage
 */
function persistFolder(folderId: string): void {
  try {
    localStorage.setItem(FOLDER_KEY, folderId)
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Zustand store for folder selection and labels
 *
 * Usage:
 * ```tsx
 * function FolderSidebar() {
 *   const { selectedFolder, setSelectedFolder, unreadCounts } = useFolderStore()
 *
 *   return (
 *     <button
 *       onClick={() => setSelectedFolder('inbox')}
 *       className={selectedFolder === 'inbox' ? 'active' : ''}
 *     >
 *       Inbox ({unreadCounts.inbox || 0})
 *     </button>
 *   )
 * }
 * ```
 */
export const useFolderStore = create<FolderStoreState>((set) => ({
  // Initial state
  selectedFolder: loadPersistedFolder(),
  gmailLabels: [],
  outlookFolders: [],
  unreadCounts: {},
  loading: false,

  /**
   * Set the selected folder and persist to localStorage
   * AC 6: Folder selection persists across app restarts
   */
  setSelectedFolder: (folderId) => {
    set({ selectedFolder: folderId })
    persistFolder(folderId)
    logger.debug('folder-store', 'Folder selected', { folderId })
  },

  /**
   * Set Gmail labels (user-created labels from Gmail API)
   */
  setGmailLabels: (labels) => {
    set({ gmailLabels: labels })
    logger.debug('folder-store', 'Gmail labels updated', { count: labels.length })
  },

  /**
   * Set Outlook folders from Graph API
   */
  setOutlookFolders: (folders) => {
    set({ outlookFolders: folders })
    logger.debug('folder-store', 'Outlook folders updated', { count: folders.length })
  },

  /**
   * Update unread count for a single folder
   */
  setUnreadCount: (folderId, count) => {
    set((state) => ({
      unreadCounts: { ...state.unreadCounts, [folderId]: count },
    }))
  },

  /**
   * Bulk update unread counts
   */
  setUnreadCounts: (counts) => {
    set({ unreadCounts: counts })
    logger.debug('folder-store', 'Unread counts updated', { counts })
  },

  /**
   * Set loading state
   */
  setLoading: (loading) => {
    set({ loading })
  },
}))

/**
 * Expose folder store for E2E testing in development mode
 */
if (import.meta.env.DEV) {
  ;(window as unknown as { __TEST_FOLDER_STORE__: typeof useFolderStore }).__TEST_FOLDER_STORE__ =
    useFolderStore
}
