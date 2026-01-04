/**
 * MoveToFolderDropdown Component
 *
 * Story 2.9: Email Folders & Labels
 * Task 4.2: Add "Move to" dropdown/menu to email list and thread view
 *
 * Dropdown menu for moving emails to different folders/labels.
 * Shows standard folders and custom labels from Gmail/Outlook.
 */

import { useState, useRef, useEffect } from 'react'
import {
  Inbox,
  Archive,
  Trash2,
  AlertCircle,
  Tag,
  Folder,
  FolderInput,
  ChevronDown,
} from 'lucide-react'
import { cn } from '@/utils/cn'
import { useFolderStore } from '@/store/folderStore'
import { useMoveToFolder } from '@/hooks/useMoveToFolder'

/**
 * Standard folder configuration
 */
const STANDARD_FOLDERS = [
  { id: 'inbox', name: 'Inbox', icon: Inbox },
  { id: 'archive', name: 'Archive', icon: Archive },
  { id: 'trash', name: 'Trash', icon: Trash2 },
  { id: 'spam', name: 'Spam', icon: AlertCircle },
] as const

interface MoveToFolderDropdownProps {
  /** Email ID(s) to move */
  emailIds: string | string[]
  /** Current folder of the email(s) */
  currentFolder?: string
  /** Callback when move completes */
  onMoveComplete?: () => void
  /** Variant: 'button' shows a button with dropdown, 'icon' shows just an icon */
  variant?: 'button' | 'icon'
  /** Custom className */
  className?: string
  /** Disabled state */
  disabled?: boolean
}

/**
 * MoveToFolderDropdown - Dropdown for moving emails
 *
 * Usage:
 * ```tsx
 * <MoveToFolderDropdown
 *   emailIds={selectedEmailIds}
 *   currentFolder="inbox"
 *   onMoveComplete={() => setSelected([])}
 * />
 * ```
 */
export function MoveToFolderDropdown({
  emailIds,
  currentFolder,
  onMoveComplete,
  variant = 'button',
  className,
  disabled = false,
}: MoveToFolderDropdownProps) {
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Get labels and folders from store
  const gmailLabels = useFolderStore((state) => state.gmailLabels)
  const outlookFolders = useFolderStore((state) => state.outlookFolders)

  // Move functionality
  const { moveEmail, moveEmails, loading, error } = useMoveToFolder()

  // Normalize emailIds to array
  const emailIdArray = Array.isArray(emailIds) ? emailIds : [emailIds]
  const isBulk = emailIdArray.length > 1

  // Handle click outside to close dropdown
  useEffect(() => {
    if (!open) return

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }

    window.addEventListener('click', handleClickOutside)
    return () => window.removeEventListener('click', handleClickOutside)
  }, [open])

  // Handle escape key
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open])

  // Handle move to folder
  const handleMove = async (targetFolder: string) => {
    setOpen(false)

    if (isBulk) {
      await moveEmails(emailIdArray, targetFolder)
    } else {
      await moveEmail(emailIdArray[0], targetFolder)
    }

    onMoveComplete?.()
  }

  return (
    <div ref={dropdownRef} className={cn('relative', className)}>
      {/* Trigger button */}
      {variant === 'button' ? (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          disabled={disabled || loading}
          className={cn(
            'flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md',
            'border border-slate-300 bg-white text-slate-700',
            'hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-500',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          <FolderInput className="w-4 h-4" />
          Move to
          <ChevronDown className="w-3 h-3" />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          disabled={disabled || loading}
          className={cn(
            'p-2 rounded-md text-slate-600 hover:bg-slate-100',
            'focus:outline-none focus:ring-2 focus:ring-cyan-500',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
          title="Move to folder"
        >
          <FolderInput className="w-5 h-5" />
        </button>
      )}

      {/* Dropdown menu */}
      {open && (
        <div
          className={cn(
            'absolute z-50 mt-1 w-56 bg-white rounded-md shadow-lg',
            'border border-slate-200 py-1',
            'animate-in fade-in slide-in-from-top-2 duration-150'
          )}
          style={{ right: 0 }}
        >
          {/* Standard folders */}
          <div className="py-1">
            <div className="px-3 py-1 text-xs font-semibold text-slate-500 uppercase">Folders</div>
            {STANDARD_FOLDERS.map((folder) => {
              const Icon = folder.icon
              const isCurrentFolder = currentFolder === folder.id

              return (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => handleMove(folder.id)}
                  disabled={isCurrentFolder}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 text-sm text-left',
                    isCurrentFolder
                      ? 'text-slate-400 cursor-not-allowed'
                      : 'text-slate-700 hover:bg-slate-100'
                  )}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {folder.name}
                  {isCurrentFolder && (
                    <span className="ml-auto text-xs text-slate-400">(current)</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Gmail labels */}
          {gmailLabels.length > 0 && (
            <div className="border-t border-slate-100 py-1">
              <div className="px-3 py-1 text-xs font-semibold text-slate-500 uppercase">Labels</div>
              {gmailLabels.slice(0, 10).map((label) => (
                <button
                  key={label.id}
                  type="button"
                  onClick={() => handleMove(label.id)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 text-left"
                >
                  <Tag
                    className="w-4 h-4 flex-shrink-0"
                    style={label.color ? { color: label.color } : undefined}
                  />
                  <span className="truncate">{label.name}</span>
                </button>
              ))}
              {gmailLabels.length > 10 && (
                <div className="px-3 py-1 text-xs text-slate-500">
                  +{gmailLabels.length - 10} more labels
                </div>
              )}
            </div>
          )}

          {/* Outlook folders */}
          {outlookFolders.length > 0 && (
            <div className="border-t border-slate-100 py-1">
              <div className="px-3 py-1 text-xs font-semibold text-slate-500 uppercase">
                Folders
              </div>
              {outlookFolders.slice(0, 10).map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => handleMove(folder.id)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 text-left"
                >
                  <Folder className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{folder.name}</span>
                </button>
              ))}
              {outlookFolders.length > 10 && (
                <div className="px-3 py-1 text-xs text-slate-500">
                  +{outlookFolders.length - 10} more folders
                </div>
              )}
            </div>
          )}

          {/* Error display */}
          {error && (
            <div className="px-3 py-2 text-xs text-red-600 bg-red-50 border-t border-red-100">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
