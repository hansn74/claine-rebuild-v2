/**
 * ThreadDetailView Component
 *
 * Story 2.2: Thread Detail View with Conversation History
 * Task 2: Create ThreadDetailView Component
 *
 * Story 2.6: Email Actions (Archive, Delete, Mark Read/Unread)
 * Task 9.2: Add action buttons to thread header
 *
 * Story 2.14: Apply Attributes to Emails - UI & Interaction
 * Task 5: Integrate AttributePanel and AttributeTagList
 *
 * Displays full email thread with conversation history.
 * Features:
 * - All messages in chronological order (AC1)
 * - Message grouping by sender/time (AC2)
 * - Thread header with subject, participant count, message count
 * - Action buttons for archive, delete, mark read/unread (AC1-3)
 * - Attribute panel with keyboard shortcut (AC1, AC9)
 * - Attribute tags in header (AC9)
 * - Loading, empty, and error states
 */

import { useMemo, useCallback, useState, useEffect } from 'react'
import { Mail, Users, MessageSquare, ArrowLeft, Tag } from 'lucide-react'
import { cn } from '@/utils/cn'
import { useThread } from '@/hooks/useThread'
import { groupMessagesBySender } from '@/utils/threadGrouping'
import { ThreadMessage } from './ThreadMessage'
import { EmailActionBar } from './EmailActionBar'
import { useEmailStore } from '@/store/emailStore'
import { logger } from '@/services/logger'
import { emailAttributeService } from '@/services/email/emailAttributeService'
import { AttributePanel, AttributeTagList } from './attributes'
import type { Attachment } from '@/services/database/schemas/email.schema'
import type { EmailAttributeValues } from '@/types/attributes'

interface ThreadDetailViewProps {
  /** Thread ID to display */
  threadId: string | null
  /** Optional callback to go back to inbox */
  onBack?: () => void
  /** Optional handler for attachment downloads */
  onDownloadAttachment?: (attachment: Attachment) => void
  /** Optional className for styling */
  className?: string
}

/**
 * Loading state component
 */
function LoadingState() {
  return (
    <div className="flex-1 flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500 mx-auto mb-3" />
        <p className="text-slate-500 text-sm">Loading thread...</p>
      </div>
    </div>
  )
}

/**
 * Empty state component (no thread selected)
 */
function EmptyState() {
  return (
    <div className="flex-1 flex items-center justify-center bg-slate-50 text-slate-500">
      <div className="text-center">
        <Mail className="w-12 h-12 mx-auto mb-3 text-slate-300" aria-hidden="true" />
        <p className="text-lg font-medium">Select a conversation</p>
        <p className="text-sm mt-1">Choose an email from the list to view the thread</p>
      </div>
    </div>
  )
}

/**
 * Error state component
 */
function ErrorState({ error }: { error: Error }) {
  return (
    <div className="flex-1 flex items-center justify-center bg-red-50 text-red-600">
      <div className="text-center max-w-md px-4">
        <div className="text-4xl mb-3">&#9888;</div>
        <p className="font-medium">Failed to load thread</p>
        <p className="text-sm mt-1 text-red-500">{error.message}</p>
      </div>
    </div>
  )
}

/**
 * Thread header with subject, metadata, actions, and attribute tags
 */
function ThreadHeader({
  subject,
  participantCount,
  messageCount,
  isRead,
  attributes,
  onBack,
  onArchive,
  onDelete,
  onToggleRead,
  onToggleAttributePanel,
  onRemoveAttribute,
  isLoading,
  showAttributeToggle,
}: {
  subject: string
  participantCount: number
  messageCount: number
  isRead: boolean
  attributes: EmailAttributeValues
  onBack?: () => void
  onArchive: () => void
  onDelete: () => void
  onToggleRead: () => void
  onToggleAttributePanel: () => void
  onRemoveAttribute: (attributeId: string) => void
  isLoading?: boolean
  showAttributeToggle?: boolean
}) {
  return (
    <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3">
      <div className="flex items-start gap-3">
        {/* Back button (mobile) */}
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className={cn(
              'p-1.5 -ml-1.5 rounded hover:bg-slate-100',
              'text-slate-500 hover:text-slate-700',
              'focus:outline-none focus:ring-2 focus:ring-cyan-500'
            )}
            aria-label="Back to inbox"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}

        {/* Subject and metadata */}
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-slate-900 truncate">
            {subject || '(No subject)'}
          </h1>
          <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
            <span className="flex items-center gap-1">
              <Users className="w-4 h-4" aria-hidden="true" />
              {participantCount} participant{participantCount !== 1 ? 's' : ''}
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="w-4 h-4" aria-hidden="true" />
              {messageCount} message{messageCount !== 1 ? 's' : ''}
            </span>
          </div>
          {/* Attribute tags */}
          <AttributeTagList
            attributes={attributes}
            onRemove={onRemoveAttribute}
            showRemove={true}
            maxTags={3}
            size="sm"
            className="mt-2"
          />
        </div>

        {/* Attribute toggle button */}
        {showAttributeToggle && (
          <button
            type="button"
            onClick={onToggleAttributePanel}
            className={cn(
              'p-1.5 rounded hover:bg-slate-100',
              'text-slate-500 hover:text-slate-700',
              'focus:outline-none focus:ring-2 focus:ring-cyan-500'
            )}
            aria-label="Toggle attributes panel (a)"
            title="Toggle attributes (a)"
          >
            <Tag className="w-5 h-5" />
          </button>
        )}

        {/* Action buttons */}
        <EmailActionBar
          isRead={isRead}
          onArchive={onArchive}
          onDelete={onDelete}
          onToggleRead={onToggleRead}
          isLoading={isLoading}
        />
      </div>
    </div>
  )
}

/**
 * Main thread detail view component
 * Displays all messages in a thread with grouping
 */
export function ThreadDetailView({
  threadId,
  onBack,
  onDownloadAttachment,
  className,
}: ThreadDetailViewProps) {
  // Fetch thread data
  const { emails, loading, error, threadSubject, participantCount, messageCount } =
    useThread(threadId)

  // Email store actions
  const { archiveEmail, deleteEmail, toggleReadStatus, isActionLoading } = useEmailStore()

  // Attribute panel state
  const [isAttributePanelOpen, setIsAttributePanelOpen] = useState(false)

  // Group messages by sender and time proximity
  const messageGroups = useMemo(() => {
    const groups = groupMessagesBySender(emails)

    logger.debug('ui', 'Thread messages grouped', {
      threadId,
      messageCount: emails.length,
      groupCount: groups.length,
    })

    return groups
  }, [emails, threadId])

  // Check if thread is read (all messages are read)
  const isThreadRead = useMemo(() => {
    return emails.length > 0 && emails.every((e) => e.read)
  }, [emails])

  // Get the first email and its attributes (actions apply to first email in thread)
  const firstEmail = emails[0]
  const firstEmailId = firstEmail?.id
  const firstEmailAttributes: EmailAttributeValues = firstEmail?.attributes || {}

  // Handle archive
  const handleArchive = useCallback(() => {
    if (!firstEmailId) return
    archiveEmail(firstEmailId)
    onBack?.()
  }, [firstEmailId, archiveEmail, onBack])

  // Handle delete
  const handleDelete = useCallback(() => {
    if (!firstEmailId) return
    deleteEmail(firstEmailId)
    onBack?.()
  }, [firstEmailId, deleteEmail, onBack])

  // Handle toggle read
  const handleToggleRead = useCallback(() => {
    if (!firstEmailId) return
    toggleReadStatus(firstEmailId)
  }, [firstEmailId, toggleReadStatus])

  // Handle attachment download
  const handleDownloadAttachment = useCallback(
    (attachment: Attachment) => {
      logger.info('ui', 'Attachment download requested', {
        attachmentId: attachment.id,
        filename: attachment.filename,
      })
      onDownloadAttachment?.(attachment)
    },
    [onDownloadAttachment]
  )

  // Toggle attribute panel
  const handleToggleAttributePanel = useCallback(() => {
    setIsAttributePanelOpen((prev) => !prev)
  }, [])

  // Handle attribute removal from tags
  const handleRemoveAttribute = useCallback(
    async (attributeId: string) => {
      if (!firstEmailId) return
      await emailAttributeService.removeEmailAttribute(firstEmailId, attributeId)
    },
    [firstEmailId]
  )

  // Keyboard shortcut handler (a key to toggle attribute panel)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle 'a' key when not in an input/textarea
      if (
        e.key === 'a' &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement) &&
        !(e.target instanceof HTMLSelectElement)
      ) {
        e.preventDefault()
        setIsAttributePanelOpen((prev) => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // No thread selected
  if (!threadId) {
    return <EmptyState />
  }

  // Loading state
  if (loading) {
    return <LoadingState />
  }

  // Error state
  if (error) {
    return <ErrorState error={error} />
  }

  // Empty thread (no messages found)
  if (emails.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50 text-slate-500">
        <div className="text-center">
          <Mail className="w-12 h-12 mx-auto mb-3 text-slate-300" aria-hidden="true" />
          <p className="text-lg font-medium">Thread not found</p>
          <p className="text-sm mt-1">This conversation may have been deleted</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex-1 flex flex-col overflow-hidden bg-slate-50 min-w-0', className)}>
      {/* Thread header with actions */}
      <ThreadHeader
        subject={threadSubject || ''}
        participantCount={participantCount}
        messageCount={messageCount}
        isRead={isThreadRead}
        attributes={firstEmailAttributes}
        onBack={onBack}
        onArchive={handleArchive}
        onDelete={handleDelete}
        onToggleRead={handleToggleRead}
        onToggleAttributePanel={handleToggleAttributePanel}
        onRemoveAttribute={handleRemoveAttribute}
        isLoading={isActionLoading}
        showAttributeToggle={true}
      />

      {/* Attribute panel (collapsible) */}
      {isAttributePanelOpen && firstEmailId && (
        <div className="px-4 py-2 border-b border-slate-200 bg-white">
          <AttributePanel
            emailId={firstEmailId}
            initialAttributes={firstEmailAttributes}
            collapsed={false}
          />
        </div>
      )}

      {/* Message list */}
      <div className="flex-1 overflow-auto p-4">
        <div className="space-y-3">
          {messageGroups.map((group, groupIndex) => (
            <div key={`group-${groupIndex}-${group.startTimestamp}`} className="space-y-2">
              {group.messages.map((email, messageIndex) => {
                // Determine if this is the very last message in the entire thread
                const isLastGroup = groupIndex === messageGroups.length - 1
                const isLastInGroup = messageIndex === group.messages.length - 1
                const isLastMessage = isLastGroup && isLastInGroup

                // First message in group shows full header
                const isFirstInGroup = messageIndex === 0

                return (
                  <ThreadMessage
                    key={email.id}
                    email={email}
                    isLastMessage={isLastMessage}
                    isFirstInGroup={isFirstInGroup}
                    onDownloadAttachment={handleDownloadAttachment}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
