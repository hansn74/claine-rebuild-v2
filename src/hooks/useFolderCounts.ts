/**
 * Hook for reactive unread counts per folder
 *
 * Story 2.9: Email Folders & Labels
 * Task 5.3: Calculate unread counts per folder from RxDB queries
 * Task 5.4: Implement reactive unread count updates when emails change
 *
 * Uses RxDB reactive queries to automatically update unread counts
 * when emails are added, modified, or deleted.
 */

import { useEffect } from 'react'
import { getDatabase, isDatabaseInitialized } from '@/services/database/init'
import { useFolderStore } from '@/store/folderStore'
import { useDatabaseStore } from '@/store/database'
import { logger } from '@/services/logger'

/**
 * Standard folder IDs that map to email schema folder field
 */
const STANDARD_FOLDERS = ['inbox', 'sent', 'drafts', 'archive', 'trash', 'spam']

/**
 * Hook to subscribe to unread count updates for all folders
 *
 * Usage:
 * ```tsx
 * function FolderSidebar() {
 *   useFolderCounts() // Sets up subscriptions
 *   const { unreadCounts } = useFolderStore()
 *
 *   return <div>Inbox ({unreadCounts.inbox || 0})</div>
 * }
 * ```
 */
export function useFolderCounts(): void {
  const setUnreadCounts = useFolderStore((state) => state.setUnreadCounts)
  const initialized = useDatabaseStore((state) => state.initialized)

  useEffect(() => {
    // Don't setup subscriptions until database is initialized
    if (!initialized || !isDatabaseInitialized()) {
      return
    }

    const subscriptions: Array<{ unsubscribe: () => void }> = []

    const setupSubscriptions = async () => {
      try {
        const db = getDatabase()

        if (!db.emails) {
          logger.debug('folder-counts', 'Emails collection not available')
          return
        }

        // Create a single subscription that watches all unread emails
        // and calculates counts by folder
        const query = db.emails.find({
          selector: {
            read: false,
          },
        })

        const subscription = query.$.subscribe({
          next: (results) => {
            // Calculate counts by folder
            const counts: Record<string, number> = {}

            // Initialize standard folders to 0
            STANDARD_FOLDERS.forEach((folder) => {
              counts[folder] = 0
            })

            // Count unread emails per folder
            results.forEach((doc) => {
              const email = doc.toJSON()
              const folder = email.folder?.toLowerCase() || 'inbox'

              // Map Gmail system labels to standard folders
              const normalizedFolder = normalizeFolder(folder)

              if (counts[normalizedFolder] !== undefined) {
                counts[normalizedFolder]++
              } else {
                // Custom label/folder
                counts[normalizedFolder] = (counts[normalizedFolder] || 0) + 1
              }

              // Also count by labels for Gmail
              if (email.labels && Array.isArray(email.labels)) {
                email.labels.forEach((label: string) => {
                  const normalizedLabel = normalizeFolder(label)
                  if (normalizedLabel !== normalizedFolder) {
                    counts[normalizedLabel] = (counts[normalizedLabel] || 0) + 1
                  }
                })
              }
            })

            setUnreadCounts(counts)
            logger.debug('folder-counts', 'Unread counts updated', { counts })
          },
          error: (err) => {
            logger.error('folder-counts', 'Subscription error', {
              error: err.message,
            })
          },
        })

        subscriptions.push(subscription)
      } catch (err) {
        logger.error('folder-counts', 'Failed to setup subscriptions', {
          error: err instanceof Error ? err.message : String(err),
        })
      }
    }

    setupSubscriptions()

    // Cleanup subscriptions on unmount
    return () => {
      subscriptions.forEach((sub) => sub.unsubscribe())
    }
  }, [setUnreadCounts, initialized])
}

/**
 * Normalize folder names to standard folder IDs
 * Maps Gmail system labels and Outlook well-known folders to our standard IDs
 */
function normalizeFolder(folder: string): string {
  const normalized = folder.toLowerCase()

  // Gmail system labels mapping
  const gmailMapping: Record<string, string> = {
    inbox: 'inbox',
    sent: 'sent',
    draft: 'drafts',
    drafts: 'drafts',
    trash: 'trash',
    spam: 'spam',
    archive: 'archive',
    // Gmail API label IDs
    INBOX: 'inbox',
    SENT: 'sent',
    DRAFT: 'drafts',
    TRASH: 'trash',
    SPAM: 'spam',
  }

  // Outlook well-known folders mapping
  const outlookMapping: Record<string, string> = {
    inbox: 'inbox',
    sentitems: 'sent',
    'sent items': 'sent',
    drafts: 'drafts',
    deleteditems: 'trash',
    'deleted items': 'trash',
    junkemail: 'spam',
    'junk email': 'spam',
    archive: 'archive',
  }

  return gmailMapping[folder] || gmailMapping[normalized] || outlookMapping[normalized] || folder
}

/**
 * Hook to get unread count for a specific folder
 * Returns 0 if folder has no unread emails
 */
export function useFolderUnreadCount(folderId: string): number {
  const unreadCounts = useFolderStore((state) => state.unreadCounts)
  return unreadCounts[folderId] || 0
}
