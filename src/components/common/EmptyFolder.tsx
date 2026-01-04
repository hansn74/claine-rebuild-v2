/**
 * EmptyFolder Component
 *
 * Story 2.12: Empty States & Onboarding UX
 * Task 1.4: Create EmptyFolder.tsx variant: Generic empty folder state
 *
 * Specialized empty state for system folders like Sent, Drafts, Archive, Trash.
 * Provides context-appropriate messages for each folder type.
 *
 * Usage:
 *   <EmptyFolder folder="sent" />
 *   <EmptyFolder folder="drafts" />
 */

import { FolderOpen, Send, FileText, Archive, Trash2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@shared/utils/cn'
import { EmptyState, type EmptyStateProps } from './EmptyState'

export type FolderType = 'sent' | 'drafts' | 'archive' | 'trash' | 'generic'

export interface EmptyFolderProps extends Omit<EmptyStateProps, 'icon' | 'title' | 'description'> {
  /** Type of folder to display empty state for */
  folder: FolderType
  /** Optional folder name for custom display */
  folderName?: string
  /** Override title */
  title?: string
  /** Override description */
  description?: string
}

interface FolderConfig {
  icon: LucideIcon
  title: string
  description: string
  iconColor: string
}

const folderConfigs: Record<FolderType, FolderConfig> = {
  sent: {
    icon: Send,
    title: 'No sent emails',
    description: 'Emails you send will appear here.',
    iconColor: 'text-cyan-500',
  },
  drafts: {
    icon: FileText,
    title: 'No drafts',
    description: 'Start composing to save a draft.',
    iconColor: 'text-amber-500',
  },
  archive: {
    icon: Archive,
    title: 'Archive is empty',
    description: 'Archived emails will appear here.',
    iconColor: 'text-slate-500',
  },
  trash: {
    icon: Trash2,
    title: 'Trash is empty',
    description: 'Deleted emails will appear here.',
    iconColor: 'text-red-400',
  },
  generic: {
    icon: FolderOpen,
    title: 'This folder is empty',
    description: 'No emails in this folder.',
    iconColor: 'text-slate-400',
  },
}

/**
 * EmptyFolder - Empty state for system folders
 *
 * Features:
 * - Folder-specific icons and colors
 * - Contextual messages for each folder type
 * - Support for custom folder names
 */
export function EmptyFolder({
  folder,
  folderName,
  title,
  description,
  className,
  ...props
}: EmptyFolderProps) {
  const config = folderConfigs[folder]
  const Icon = config.icon

  const displayTitle = title ?? (folderName ? `No emails in ${folderName}` : config.title)

  return (
    <EmptyState
      icon={
        <Icon className={cn('w-8 h-8', config.iconColor)} strokeWidth={1.5} aria-hidden="true" />
      }
      title={displayTitle}
      description={description ?? config.description}
      className={className}
      testId={`empty-folder-${folder}`}
      {...props}
    />
  )
}

export default EmptyFolder
