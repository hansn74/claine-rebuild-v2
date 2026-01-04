/**
 * Email Services Module
 *
 * Provides email sending, queue management, and action services.
 *
 * Usage:
 *   import { sendQueueService, emailActionsService } from '@/services/email'
 *
 *   // Queue an email for sending
 *   await sendQueueService.queueEmail(draft)
 *
 *   // Process the queue
 *   await sendQueueService.processQueue()
 *
 *   // Cancel a queued email
 *   await sendQueueService.cancelQueuedEmail(id)
 *
 *   // Email actions (archive, delete, mark read/unread)
 *   await emailActionsService.archiveEmail(emailId)
 *   await emailActionsService.deleteEmail(emailId)
 *   await emailActionsService.toggleReadStatus(emailId)
 */

export { SendQueueService, sendQueueService } from './sendQueueService'
export type { ISendProvider, SendQueueEvent } from './sendQueueService'

export { GmailSendService, gmailSendService } from './gmailSendService'
export { OutlookSendService, outlookSendService } from './outlookSendService'

export { GmailActionsService, gmailActionsService } from './gmailActionsService'

export { EmailActionsService, emailActionsService } from './emailActionsService'
export type { EmailAction, EmailActionType, EmailActionEvent } from './emailActionsService'

export { EmailActionQueue, emailActionQueue } from './emailActionQueue'
export type { IActionSyncProvider, ActionQueueEvent } from './emailActionQueue'

export {
  getOptimisticState,
  hasPendingAction,
  setActionPending,
  setActionCompleted,
  setActionFailed,
  rollbackAction,
  clearAllOptimisticStates,
  getPendingEmailIds,
  applyOptimisticState,
  filterByOptimisticState,
  subscribeToOptimisticState,
} from './optimisticUpdates'
export type { OptimisticState } from './optimisticUpdates'

export { AttachmentService, attachmentService } from './attachmentService'

export { LabelService, labelService } from './labelService'

export { MoveService, moveService } from './moveService'
export type { MoveResult } from './moveService'

export { EmailAttributeService, emailAttributeService } from './emailAttributeService'
export type { EmailAttributeEvent, EmailAttributeResult } from './emailAttributeService'
