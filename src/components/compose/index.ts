/**
 * Compose Components
 *
 * Story 2.3: Compose & Reply Interface
 * Story 2.8: Attachment Handling (Task 4)
 *
 * Export all compose-related components for easy importing
 */

export { ComposeDialog } from './ComposeDialog'
export type { ComposeDialogProps, ComposeContext, ComposeMode } from './ComposeDialog'

export { RecipientInput } from './RecipientInput'
export { RichTextEditor } from './RichTextEditor'

// Attachment upload component and utilities
export { AttachmentUpload, fileToBase64, prepareAttachmentsForSend } from './AttachmentUpload'
export type { ComposeAttachment } from './AttachmentUpload'
