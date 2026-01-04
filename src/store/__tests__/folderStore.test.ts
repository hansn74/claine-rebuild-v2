/**
 * Folder Store Tests
 *
 * Story 2.9: Email Folders & Labels
 * Task 6.2: Unit tests for FolderStore
 *
 * Tests folder selection state and persistence.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useFolderStore } from '../folderStore'

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

describe('useFolderStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset store state
    useFolderStore.setState({
      selectedFolder: 'inbox',
      gmailLabels: [],
      outlookFolders: [],
      unreadCounts: {},
      loading: false,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('selectedFolder', () => {
    it('defaults to inbox', () => {
      expect(useFolderStore.getState().selectedFolder).toBe('inbox')
    })

    it('setSelectedFolder updates state and persists', () => {
      useFolderStore.getState().setSelectedFolder('archive')

      expect(useFolderStore.getState().selectedFolder).toBe('archive')
      expect(localStorageMock.setItem).toHaveBeenCalledWith('claine_folder_selection', 'archive')
    })

    it('setSelectedFolder handles various folder types', () => {
      const folders = ['inbox', 'sent', 'drafts', 'archive', 'trash', 'spam', 'Label_123']

      folders.forEach((folder) => {
        useFolderStore.getState().setSelectedFolder(folder)
        expect(useFolderStore.getState().selectedFolder).toBe(folder)
      })
    })
  })

  describe('gmailLabels', () => {
    it('setGmailLabels updates label list', () => {
      const labels = [
        { id: 'Label_1', name: 'Work', type: 'gmail-label' as const, unreadCount: 5 },
        { id: 'Label_2', name: 'Personal', type: 'gmail-label' as const, unreadCount: 3 },
      ]

      useFolderStore.getState().setGmailLabels(labels)

      expect(useFolderStore.getState().gmailLabels).toEqual(labels)
    })

    it('setGmailLabels replaces existing labels', () => {
      useFolderStore
        .getState()
        .setGmailLabels([
          { id: 'Label_1', name: 'Old', type: 'gmail-label' as const, unreadCount: 0 },
        ])

      const newLabels = [
        { id: 'Label_2', name: 'New', type: 'gmail-label' as const, unreadCount: 1 },
      ]
      useFolderStore.getState().setGmailLabels(newLabels)

      expect(useFolderStore.getState().gmailLabels).toEqual(newLabels)
    })
  })

  describe('outlookFolders', () => {
    it('setOutlookFolders updates folder list', () => {
      const folders = [
        { id: 'folder-1', name: 'Projects', type: 'outlook-folder' as const, unreadCount: 10 },
      ]

      useFolderStore.getState().setOutlookFolders(folders)

      expect(useFolderStore.getState().outlookFolders).toEqual(folders)
    })

    it('handles nested folders with parentId', () => {
      const folders = [
        { id: 'parent', name: 'Parent', type: 'outlook-folder' as const, unreadCount: 5 },
        {
          id: 'child',
          name: 'Child',
          type: 'outlook-folder' as const,
          unreadCount: 2,
          parentId: 'parent',
        },
      ]

      useFolderStore.getState().setOutlookFolders(folders)

      expect(useFolderStore.getState().outlookFolders).toEqual(folders)
      expect(useFolderStore.getState().outlookFolders[1].parentId).toBe('parent')
    })
  })

  describe('unreadCounts', () => {
    it('setUnreadCount updates a single folder count', () => {
      useFolderStore.getState().setUnreadCount('inbox', 10)

      expect(useFolderStore.getState().unreadCounts.inbox).toBe(10)
    })

    it('setUnreadCount preserves other counts', () => {
      useFolderStore.getState().setUnreadCounts({ inbox: 5, sent: 0, drafts: 2 })
      useFolderStore.getState().setUnreadCount('inbox', 10)

      expect(useFolderStore.getState().unreadCounts).toEqual({
        inbox: 10,
        sent: 0,
        drafts: 2,
      })
    })

    it('setUnreadCounts bulk updates all counts', () => {
      const counts = {
        inbox: 15,
        sent: 0,
        drafts: 3,
        archive: 0,
        trash: 1,
        spam: 5,
      }

      useFolderStore.getState().setUnreadCounts(counts)

      expect(useFolderStore.getState().unreadCounts).toEqual(counts)
    })
  })

  describe('loading', () => {
    it('setLoading updates loading state', () => {
      expect(useFolderStore.getState().loading).toBe(false)

      useFolderStore.getState().setLoading(true)
      expect(useFolderStore.getState().loading).toBe(true)

      useFolderStore.getState().setLoading(false)
      expect(useFolderStore.getState().loading).toBe(false)
    })
  })
})
