/**
 * FolderSidebar Component
 *
 * Story 2.9: Email Folders & Labels
 * Task 1: Folder Sidebar Component (AC: 1, 5)
 *
 * Displays standard folders and custom labels/folders in a sidebar.
 * Features:
 * - Standard folders: Inbox, Sent, Drafts, Archive, Trash (AC 1)
 * - Unread count badges per folder (AC 5)
 * - Active folder highlighting (Task 1.4)
 * - Folder icons using lucide-react (Task 1.6)
 * - Gmail labels with colors (AC 2, via props)
 * - Outlook folders with hierarchy (AC 3, via props)
 */

import { useMemo } from 'react'
import {
  Inbox,
  Send,
  FileText,
  Archive,
  Trash2,
  AlertCircle,
  Tag,
  Folder,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { useFolderStore, type FolderItem } from '@/store/folderStore'
import { AttributeFilterPanel } from './filters/AttributeFilterPanel'

/**
 * Standard folder configuration
 */
const STANDARD_FOLDERS = [
  { id: 'inbox', name: 'Inbox', icon: Inbox },
  { id: 'sent', name: 'Sent', icon: Send },
  { id: 'drafts', name: 'Drafts', icon: FileText },
  { id: 'archive', name: 'Archive', icon: Archive },
  { id: 'trash', name: 'Trash', icon: Trash2 },
  { id: 'spam', name: 'Spam', icon: AlertCircle },
] as const

interface FolderSidebarProps {
  className?: string
}

/**
 * Sidebar component showing standard folders and custom labels
 *
 * Usage:
 * ```tsx
 * function Layout() {
 *   return (
 *     <div className="flex">
 *       <FolderSidebar />
 *       <EmailList />
 *     </div>
 *   )
 * }
 * ```
 */
export function FolderSidebar({ className }: FolderSidebarProps) {
  const { selectedFolder, setSelectedFolder, gmailLabels, outlookFolders, unreadCounts } =
    useFolderStore()

  // Separate top-level and nested Outlook folders
  const { topLevelOutlookFolders, nestedOutlookFolders } = useMemo(() => {
    const topLevel: FolderItem[] = []
    const nested: Record<string, FolderItem[]> = {}

    outlookFolders.forEach((folder) => {
      if (folder.parentId) {
        if (!nested[folder.parentId]) {
          nested[folder.parentId] = []
        }
        nested[folder.parentId].push(folder)
      } else {
        topLevel.push(folder)
      }
    })

    return { topLevelOutlookFolders: topLevel, nestedOutlookFolders: nested }
  }, [outlookFolders])

  return (
    <nav className={cn('flex flex-col py-2 bg-slate-50', className)}>
      {/* Standard Folders Section */}
      <div className="px-2">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-2 py-1">
          Folders
        </div>
        {STANDARD_FOLDERS.map((folder) => {
          const Icon = folder.icon
          const unreadCount = unreadCounts[folder.id] || 0
          const isActive = selectedFolder === folder.id

          return (
            <button
              key={folder.id}
              type="button"
              onClick={() => setSelectedFolder(folder.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                isActive
                  ? 'bg-cyan-100 text-cyan-700 font-medium'
                  : 'text-slate-700 hover:bg-slate-100'
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1 text-left truncate">{folder.name}</span>
              {unreadCount > 0 && (
                <span
                  className={cn(
                    'px-1.5 py-0.5 text-xs font-medium rounded-full',
                    isActive ? 'bg-cyan-200 text-cyan-800' : 'bg-slate-200 text-slate-700'
                  )}
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Gmail Labels Section */}
      {gmailLabels.length > 0 && (
        <div className="px-2 mt-4">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-2 py-1">
            Labels
          </div>
          {gmailLabels.map((label) => {
            const unreadCount = unreadCounts[label.id] || 0
            const isActive = selectedFolder === label.id

            return (
              <button
                key={label.id}
                type="button"
                onClick={() => setSelectedFolder(label.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                  isActive
                    ? 'bg-cyan-100 text-cyan-700 font-medium'
                    : 'text-slate-700 hover:bg-slate-100'
                )}
              >
                <Tag
                  className="w-4 h-4 flex-shrink-0"
                  style={label.color ? { color: label.color } : undefined}
                />
                <span className="flex-1 text-left truncate">{label.name}</span>
                {unreadCount > 0 && (
                  <span
                    className={cn(
                      'px-1.5 py-0.5 text-xs font-medium rounded-full',
                      isActive ? 'bg-cyan-200 text-cyan-800' : 'bg-slate-200 text-slate-700'
                    )}
                  >
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Outlook Folders Section */}
      {outlookFolders.length > 0 && (
        <div className="px-2 mt-4">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-2 py-1">
            Folders
          </div>
          {topLevelOutlookFolders.map((folder) => (
            <OutlookFolderItem
              key={folder.id}
              folder={folder}
              nestedFolders={nestedOutlookFolders}
              selectedFolder={selectedFolder}
              onSelect={setSelectedFolder}
              unreadCounts={unreadCounts}
              depth={0}
            />
          ))}
        </div>
      )}

      {/* Story 2.15: Attribute Filter Panel (AC 1) */}
      <div className="mt-4 border-t border-slate-200">
        <AttributeFilterPanel />
      </div>
    </nav>
  )
}

/**
 * Recursive component for rendering Outlook folder hierarchy
 */
interface OutlookFolderItemProps {
  folder: FolderItem
  nestedFolders: Record<string, FolderItem[]>
  selectedFolder: string
  onSelect: (folderId: string) => void
  unreadCounts: Record<string, number>
  depth: number
}

function OutlookFolderItem({
  folder,
  nestedFolders,
  selectedFolder,
  onSelect,
  unreadCounts,
  depth,
}: OutlookFolderItemProps) {
  const children = nestedFolders[folder.id] || []
  const hasChildren = children.length > 0
  const unreadCount = unreadCounts[folder.id] || 0
  const isActive = selectedFolder === folder.id

  return (
    <div>
      <button
        type="button"
        onClick={() => onSelect(folder.id)}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
          isActive ? 'bg-cyan-100 text-cyan-700 font-medium' : 'text-slate-700 hover:bg-slate-100'
        )}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        {hasChildren && <ChevronRight className="w-3 h-3 flex-shrink-0 text-slate-400" />}
        <Folder className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1 text-left truncate">{folder.name}</span>
        {unreadCount > 0 && (
          <span
            className={cn(
              'px-1.5 py-0.5 text-xs font-medium rounded-full',
              isActive ? 'bg-cyan-200 text-cyan-800' : 'bg-slate-200 text-slate-700'
            )}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Nested folders */}
      {hasChildren && (
        <div>
          {children.map((child) => (
            <OutlookFolderItem
              key={child.id}
              folder={child}
              nestedFolders={nestedFolders}
              selectedFolder={selectedFolder}
              onSelect={onSelect}
              unreadCounts={unreadCounts}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}
