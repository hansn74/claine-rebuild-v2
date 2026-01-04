/**
 * useSendQueue Hook
 *
 * Story 2.4: Offline-First Send Queue
 * Task 6: Integrate Send Queue with Compose Dialog
 *
 * Features:
 * - Queue emails for sending (works offline)
 * - Optimistic UI feedback
 * - Delete draft after queueing
 * - Network status awareness
 */

import { useState, useCallback, useEffect } from 'react'
import { sendQueueService } from '@/services/email/sendQueueService'
import { gmailSendService } from '@/services/email/gmailSendService'
import { outlookSendService } from '@/services/email/outlookSendService'
import { getDatabase, isDatabaseInitialized } from '@/services/database/init'
import { logger } from '@/services/logger'
import { useIsOnline } from './useNetworkStatus'
import type { DraftDocument, DraftType } from '@/services/database/schemas/draft.schema'
import type { EmailAddress, EmailBody } from '@/services/database/schemas/email.schema'

/**
 * Provider registration flag
 */
let providersRegistered = false

/**
 * Register send providers with the queue service
 */
function registerProviders(): void {
  if (providersRegistered) return

  sendQueueService.registerProvider('gmail', gmailSendService)
  sendQueueService.registerProvider('outlook', outlookSendService)
  providersRegistered = true

  logger.debug('sendQueue', 'Send providers registered')
}

/**
 * Data for sending an email
 */
export interface SendEmailData {
  to: EmailAddress[]
  cc: EmailAddress[]
  bcc: EmailAddress[]
  subject: string
  body: EmailBody
  type?: DraftType
  replyToEmailId?: string
  threadId?: string
}

/**
 * Result of send operation
 */
export interface SendResult {
  /** Whether the email was queued (not necessarily sent yet) */
  queued: boolean
  /** Queue item ID */
  queueId: string
  /** Message shown to user */
  message: string
  /** Whether the email was sent immediately (online) */
  sentImmediately: boolean
}

/**
 * Result interface for useSendQueue hook
 */
export interface UseSendQueueResult {
  /** Send an email (queues it and optionally sends immediately if online) */
  sendEmail: (accountId: string, data: SendEmailData, draftId?: string) => Promise<SendResult>
  /** Whether currently sending */
  isSending: boolean
  /** Last error message */
  error: string | null
  /** Whether online */
  isOnline: boolean
  /** Pending queue count */
  pendingCount: number
  /** Failed queue count */
  failedCount: number
}

/**
 * useSendQueue hook
 *
 * Provides send queue functionality for compose components.
 * Handles offline queueing and optimistic UI feedback.
 *
 * @returns Send queue functions and state
 */
export function useSendQueue(): UseSendQueueResult {
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [failedCount, setFailedCount] = useState(0)

  const isOnline = useIsOnline()

  // Register providers on mount
  useEffect(() => {
    registerProviders()
  }, [])

  // Update queue counts periodically
  useEffect(() => {
    const updateCounts = async () => {
      const pending = await sendQueueService.getPendingCount()
      const failed = await sendQueueService.getFailedCount()
      setPendingCount(pending)
      setFailedCount(failed)
    }

    updateCounts()

    // Update every 5 seconds
    const interval = setInterval(updateCounts, 5000)
    return () => clearInterval(interval)
  }, [])

  /**
   * Send an email by queueing it
   *
   * @param accountId - Account to send from
   * @param data - Email data
   * @param draftId - Optional draft ID to delete after queueing
   * @returns Send result
   */
  const sendEmail = useCallback(
    async (accountId: string, data: SendEmailData, draftId?: string): Promise<SendResult> => {
      setIsSending(true)
      setError(null)

      try {
        // Create a draft document structure for the queue
        const draftDoc: DraftDocument = {
          id: draftId || `temp-${Date.now()}`,
          accountId,
          type: data.type || 'new',
          to: data.to,
          cc: data.cc,
          bcc: data.bcc || [],
          subject: data.subject,
          body: data.body,
          replyToEmailId: data.replyToEmailId,
          threadId: data.threadId,
          createdAt: Date.now(),
          lastSaved: Date.now(),
        }

        // Queue the email
        const queueItem = await sendQueueService.queueEmail(draftDoc)

        logger.info('sendQueue', 'Email queued for sending', {
          queueId: queueItem.id,
          accountId,
          isOnline,
        })

        // Delete the draft if it exists
        if (draftId && isDatabaseInitialized()) {
          try {
            const db = getDatabase()
            if (db.drafts) {
              const draft = await db.drafts.findOne(draftId).exec()
              if (draft) {
                await draft.remove()
                logger.debug('sendQueue', 'Draft deleted after queueing', { draftId })
              }
            }
          } catch (deleteError) {
            // Don't fail the send operation if draft deletion fails
            logger.warn('sendQueue', 'Failed to delete draft after queueing', {
              draftId,
              error: deleteError instanceof Error ? deleteError.message : 'Unknown error',
            })
          }
        }

        // Process queue immediately if online
        let sentImmediately = false
        if (isOnline) {
          try {
            await sendQueueService.processQueue(1) // Process just this item
            sentImmediately = true
          } catch (processError) {
            // Don't fail - item is queued and will retry
            logger.warn('sendQueue', 'Immediate send failed, will retry', {
              queueId: queueItem.id,
              error: processError instanceof Error ? processError.message : 'Unknown error',
            })
          }
        }

        // Update counts
        const pending = await sendQueueService.getPendingCount()
        const failed = await sendQueueService.getFailedCount()
        setPendingCount(pending)
        setFailedCount(failed)

        // Return result with appropriate message
        const message = isOnline
          ? sentImmediately
            ? 'Email sent'
            : 'Email queued - sending...'
          : 'Email queued - will send when online'

        return {
          queued: true,
          queueId: queueItem.id,
          message,
          sentImmediately,
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to queue email'
        setError(errorMessage)
        logger.error('sendQueue', 'Failed to queue email', { error: errorMessage })

        throw new Error(errorMessage)
      } finally {
        setIsSending(false)
      }
    },
    [isOnline]
  )

  return {
    sendEmail,
    isSending,
    error,
    isOnline,
    pendingCount,
    failedCount,
  }
}
