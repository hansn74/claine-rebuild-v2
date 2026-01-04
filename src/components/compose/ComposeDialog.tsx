/**
 * ComposeDialog Component
 *
 * Story 2.3: Compose & Reply Interface
 * Task 2: Create Compose Dialog Component
 *
 * Features:
 * - Full-screen and floating compose modes (AC1)
 * - Minimize/maximize/close controls
 * - Keyboard shortcuts (Esc to close, Cmd/Ctrl+Enter to send)
 * - Integration with recipient inputs and rich text editor
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { X, Minus, Maximize2, Minimize2, Send, Trash2 } from 'lucide-react'
import { Button } from '@shared/components/ui/button'
import { cn } from '@/utils/cn'
import { logger } from '@/services/logger'
import { RecipientInput } from './RecipientInput'
import { RichTextEditor } from './RichTextEditor'
import { AttachmentUpload, type ComposeAttachment } from './AttachmentUpload'
import type { EmailAddress } from '@/services/database/schemas/email.schema'
import type { DraftType } from '@/services/database/schemas/draft.schema'

export type ComposeMode = 'floating' | 'fullscreen' | 'minimized'

export interface ComposeContext {
  type: DraftType
  to: EmailAddress[]
  cc: EmailAddress[]
  subject: string
  quotedContent: string
  replyToEmailId?: string
  threadId?: string
}

export interface ComposeDialogProps {
  /** Whether the dialog is open */
  open: boolean
  /** Called when dialog should close */
  onClose: () => void
  /** Initial context for reply/forward */
  initialContext?: ComposeContext
  /** Draft ID to load existing draft */
  draftId?: string
  /** Account ID for the draft */
  accountId: string
  /** Called when send is requested */
  onSend?: (data: {
    to: EmailAddress[]
    cc: EmailAddress[]
    bcc: EmailAddress[]
    subject: string
    body: { html: string; text: string }
    attachments: ComposeAttachment[]
  }) => Promise<void>
  /** Called when draft should be saved */
  onSaveDraft?: () => void
  /** Called when draft should be deleted */
  onDeleteDraft?: () => void
  /** Whether draft is being saved */
  isSaving?: boolean
  /** Last saved timestamp */
  lastSaved?: Date | null
}

/**
 * ComposeDialog component
 * Modal dialog for composing new emails and replies
 */
export function ComposeDialog({
  open,
  onClose,
  initialContext,
  accountId,
  onSend,
  onDeleteDraft,
  isSaving = false,
  lastSaved,
}: ComposeDialogProps) {
  // Compose mode state
  const [mode, setMode] = useState<ComposeMode>('floating')

  // Form state
  const [to, setTo] = useState<EmailAddress[]>(initialContext?.to ?? [])
  const [cc, setCc] = useState<EmailAddress[]>(initialContext?.cc ?? [])
  const [bcc, setBcc] = useState<EmailAddress[]>([])
  const [showCcBcc, setShowCcBcc] = useState((initialContext?.cc?.length ?? 0) > 0)
  const [subject, setSubject] = useState(initialContext?.subject ?? '')
  const [bodyHtml, setBodyHtml] = useState(initialContext?.quotedContent ?? '')
  const [bodyText, setBodyText] = useState('')
  const [attachments, setAttachments] = useState<ComposeAttachment[]>([])

  // Sending state
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  // Refs
  const dialogRef = useRef<HTMLDivElement>(null)
  const subjectInputRef = useRef<HTMLInputElement>(null)

  // Reset form when context changes
  useEffect(() => {
    if (initialContext) {
      setTo(initialContext.to)
      setCc(initialContext.cc)
      setBcc([])
      setSubject(initialContext.subject)
      setBodyHtml(initialContext.quotedContent)
      setShowCcBcc(initialContext.cc.length > 0)
    } else {
      // New compose - reset form
      setTo([])
      setCc([])
      setBcc([])
      setSubject('')
      setBodyHtml('')
      setShowCcBcc(false)
    }
    setBodyText('')
    setAttachments([])
    setSendError(null)
  }, [initialContext])

  // Focus subject input when dialog opens (for new messages) or when recipients are pre-filled
  useEffect(() => {
    if (open && subjectInputRef.current) {
      // Small delay to ensure dialog is rendered
      const timeout = setTimeout(() => {
        if (to.length > 0 && !subject) {
          subjectInputRef.current?.focus()
        }
      }, 100)
      return () => clearTimeout(timeout)
    }
  }, [open, to.length, subject])

  // Handle body content change from editor
  const handleBodyChange = useCallback((html: string, text: string) => {
    setBodyHtml(html)
    setBodyText(text)
  }, [])

  // Handle send
  const handleSend = useCallback(async () => {
    // Validate
    if (to.length === 0) {
      setSendError('Please add at least one recipient')
      return
    }

    if (!subject.trim()) {
      setSendError('Please add a subject')
      return
    }

    setSendError(null)
    setIsSending(true)

    try {
      logger.info('compose', 'Sending email', {
        accountId,
        toCount: to.length,
        ccCount: cc.length,
        bccCount: bcc.length,
        hasSubject: !!subject,
        attachmentCount: attachments.length,
      })

      await onSend?.({
        to,
        cc,
        bcc,
        subject,
        body: {
          html: bodyHtml,
          text: bodyText || stripHtml(bodyHtml),
        },
        attachments,
      })

      logger.info('compose', 'Email sent successfully')
      onClose()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send email'
      logger.error('compose', 'Failed to send email', { error: errorMessage })
      setSendError(errorMessage)
    } finally {
      setIsSending(false)
    }
  }, [to, cc, bcc, subject, bodyHtml, bodyText, attachments, accountId, onSend, onClose])

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to close
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }

      // Cmd/Ctrl+Enter to send
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        handleSend()
        return
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose, handleSend])

  // Handle delete draft
  const handleDelete = useCallback(() => {
    logger.debug('compose', 'Deleting draft')
    onDeleteDraft?.()
    onClose()
  }, [onDeleteDraft, onClose])

  // Mode controls
  const handleMinimize = useCallback(() => {
    setMode('minimized')
  }, [])

  const handleMaximize = useCallback(() => {
    setMode((prev) => (prev === 'fullscreen' ? 'floating' : 'fullscreen'))
  }, [])

  if (!open) return null

  // Minimized state
  if (mode === 'minimized') {
    return (
      <div
        className={cn(
          'fixed bottom-0 right-4 z-50',
          'w-72 bg-white rounded-t-lg shadow-lg border border-slate-200'
        )}
      >
        <div className="flex items-center justify-between px-3 py-2 bg-slate-100 rounded-t-lg">
          <span className="text-sm font-medium text-slate-700 truncate">
            {subject || 'New Message'}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleMaximize}
              className="p-1 text-slate-500 hover:text-slate-700 rounded hover:bg-slate-200"
              aria-label="Expand"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-slate-500 hover:text-slate-700 rounded hover:bg-slate-200"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Full dialog
  const isFullscreen = mode === 'fullscreen'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end">
      {/* Backdrop (only in floating mode) */}
      {!isFullscreen && (
        <div className="absolute inset-0 bg-black/20" onClick={onClose} aria-hidden="true" />
      )}

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="compose-title"
        className={cn(
          'relative bg-white shadow-xl flex flex-col',
          isFullscreen
            ? 'w-full h-full'
            : 'w-full max-w-2xl h-[600px] max-h-[80vh] m-4 mr-8 mb-8 rounded-lg border border-slate-200'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50 rounded-t-lg">
          <h2 id="compose-title" className="text-sm font-semibold text-slate-800">
            {initialContext?.type === 'reply'
              ? 'Reply'
              : initialContext?.type === 'reply-all'
                ? 'Reply All'
                : initialContext?.type === 'forward'
                  ? 'Forward'
                  : 'New Message'}
          </h2>

          <div className="flex items-center gap-1">
            {/* Save indicator */}
            {isSaving && <span className="text-xs text-slate-500 mr-2">Saving...</span>}
            {!isSaving && lastSaved && (
              <span className="text-xs text-slate-500 mr-2">Saved {formatTime(lastSaved)}</span>
            )}

            <button
              type="button"
              onClick={handleMinimize}
              className="p-1.5 text-slate-500 hover:text-slate-700 rounded hover:bg-slate-200"
              aria-label="Minimize"
            >
              <Minus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleMaximize}
              className="p-1.5 text-slate-500 hover:text-slate-700 rounded hover:bg-slate-200"
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-500 hover:text-slate-700 rounded hover:bg-slate-200"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Recipients - autoFocus is appropriate for modal dialogs per WCAG 2.1 */}
          <div className="px-4 py-2 border-b border-slate-100">
            <RecipientInput
              label="To"
              value={to}
              onChange={setTo}
              placeholder="Recipients"
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus={open && to.length === 0}
            />

            {showCcBcc ? (
              <>
                <RecipientInput label="Cc" value={cc} onChange={setCc} placeholder="Cc" />
                <RecipientInput label="Bcc" value={bcc} onChange={setBcc} placeholder="Bcc" />
              </>
            ) : (
              <button
                type="button"
                onClick={() => setShowCcBcc(true)}
                className="text-xs text-cyan-600 hover:text-cyan-800 mt-1"
              >
                Cc/Bcc
              </button>
            )}
          </div>

          {/* Subject */}
          <div className="px-4 py-2 border-b border-slate-100">
            <input
              ref={subjectInputRef}
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              className={cn('w-full text-sm outline-none', 'placeholder:text-slate-400')}
            />
          </div>

          {/* Body */}
          <div className="flex-1 overflow-hidden">
            <RichTextEditor
              content={bodyHtml}
              onChange={handleBodyChange}
              placeholder="Compose your message..."
            />
          </div>

          {/* Attachments */}
          <AttachmentUpload attachments={attachments} onChange={setAttachments} />

          {/* Error message */}
          {sendError && (
            <div className="px-4 py-2 bg-red-50 border-t border-red-100">
              <p className="text-sm text-red-600">{sendError}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50 rounded-b-lg">
          <div className="flex items-center gap-2">
            <Button onClick={handleSend} disabled={isSending || to.length === 0}>
              {isSending ? (
                <>
                  <span className="animate-spin mr-1">&#9696;</span>
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-1" />
                  Send
                </>
              )}
            </Button>

            <span className="text-xs text-slate-500">
              {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+Enter
            </span>
          </div>

          <Button variant="ghost" size="icon" onClick={handleDelete} aria-label="Discard draft">
            <Trash2 className="w-4 h-4 text-slate-500" />
          </Button>
        </div>
      </div>
    </div>
  )
}

/**
 * Strip HTML tags for plain text version
 */
function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return doc.body.textContent || ''
}

/**
 * Format time for "Saved X ago" display
 */
function formatTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)

  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return date.toLocaleDateString()
}
