/**
 * useQueueProcessor Hook
 *
 * Story 2.4: Offline-First Send Queue
 * Task 8: Background Queue Processing
 *
 * Automatically processes the send queue when the app comes online.
 * Monitors network status and triggers queue processing.
 *
 * AC 1: Emails sent while offline are queued locally and sent automatically when online
 * AC 5: Failed sends retry automatically with exponential backoff
 */

import { useEffect, useRef, useCallback, type ReactNode } from 'react'
import { sendQueueService } from '@/services/email/sendQueueService'
import { gmailSendService } from '@/services/email/gmailSendService'
import { outlookSendService } from '@/services/email/outlookSendService'
import { useNetworkStatus } from './useNetworkStatus'
import { logger } from '@/services/logger'

/**
 * Configuration for queue processor
 */
export interface QueueProcessorConfig {
  /** How often to check for pending items when online (ms) */
  pollingInterval?: number
  /** Maximum number of concurrent sends */
  maxConcurrent?: number
  /** Whether auto-processing is enabled */
  enabled?: boolean
}

const DEFAULT_CONFIG: Required<QueueProcessorConfig> = {
  pollingInterval: 30000, // 30 seconds
  maxConcurrent: 2,
  enabled: true,
}

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

  logger.debug('queueProcessor', 'Send providers registered')
}

/**
 * Hook to automatically process send queue in the background
 *
 * Should be used at the app root level to ensure queue processing
 * happens whenever the app is online.
 *
 * @param config - Optional configuration
 */
export function useQueueProcessor(config: QueueProcessorConfig = {}): void {
  const opts = { ...DEFAULT_CONFIG, ...config }

  const { isOnline } = useNetworkStatus()
  const wasOnlineRef = useRef(isOnline)
  const processingRef = useRef(false)
  const pollingTimerRef = useRef<number | null>(null)
  const initializedRef = useRef(false)

  // Process queue with concurrency control
  const processQueue = useCallback(async () => {
    if (processingRef.current || !isOnline) return

    processingRef.current = true

    try {
      const pendingCount = await sendQueueService.getPendingCount()

      if (pendingCount > 0) {
        logger.info('queueProcessor', 'Processing queue', { pendingCount })
        await sendQueueService.processQueue(opts.maxConcurrent)
      }
    } catch (error) {
      logger.error('queueProcessor', 'Queue processing failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    } finally {
      processingRef.current = false
    }
  }, [isOnline, opts.maxConcurrent])

  // Initialize on mount
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    // Register providers
    registerProviders()

    // Initialize the service
    sendQueueService.initialize().then(() => {
      logger.debug('queueProcessor', 'Send queue service initialized')
    })
  }, [])

  // Process queue when coming online
  useEffect(() => {
    if (!opts.enabled) return

    // Detect transition from offline to online
    if (isOnline && !wasOnlineRef.current) {
      logger.info('queueProcessor', 'Network restored, processing queue')
      // Small delay to ensure network is stable
      const timer = setTimeout(() => {
        processQueue()
      }, 2000)

      return () => clearTimeout(timer)
    }

    wasOnlineRef.current = isOnline
  }, [isOnline, opts.enabled, processQueue])

  // Set up polling interval for periodic processing
  useEffect(() => {
    if (!opts.enabled || !isOnline || opts.pollingInterval <= 0) {
      // Clear existing timer
      if (pollingTimerRef.current !== null) {
        clearInterval(pollingTimerRef.current)
        pollingTimerRef.current = null
      }
      return
    }

    // Set up polling
    pollingTimerRef.current = window.setInterval(() => {
      processQueue()
    }, opts.pollingInterval)

    // Initial processing
    processQueue()

    return () => {
      if (pollingTimerRef.current !== null) {
        clearInterval(pollingTimerRef.current)
        pollingTimerRef.current = null
      }
    }
  }, [isOnline, opts.enabled, opts.pollingInterval, processQueue])

  // Subscribe to queue events for logging
  useEffect(() => {
    const subscription = sendQueueService.getEvents$().subscribe({
      next: (event) => {
        switch (event.type) {
          case 'sent':
            logger.info('queueProcessor', 'Email sent successfully', {
              id: event.item.id,
              messageId: event.messageId,
            })
            break
          case 'failed':
            logger.warn('queueProcessor', 'Email send failed', {
              id: event.item.id,
              error: event.error,
            })
            break
          case 'retry-scheduled':
            logger.debug('queueProcessor', 'Retry scheduled', {
              id: event.item.id,
              delayMs: event.delayMs,
            })
            break
        }
      },
    })

    return () => subscription.unsubscribe()
  }, [])

  // Clean up old items periodically
  useEffect(() => {
    if (!opts.enabled) return

    // Clean up every 5 minutes
    const cleanupTimer = setInterval(
      async () => {
        try {
          const cleaned = await sendQueueService.cleanupOldItems()
          if (cleaned > 0) {
            logger.debug('queueProcessor', 'Cleaned up old queue items', { count: cleaned })
          }
        } catch {
          // Ignore cleanup errors
        }
      },
      5 * 60 * 1000
    )

    return () => clearInterval(cleanupTimer)
  }, [opts.enabled])
}

/**
 * Provider for queue processing at app root
 *
 * Use this component to wrap your app and enable background queue processing.
 *
 * @example
 * ```tsx
 * function App() {
 *   return (
 *     <QueueProcessorProvider>
 *       <YourApp />
 *     </QueueProcessorProvider>
 *   )
 * }
 * ```
 */
export function QueueProcessorProvider({
  children,
  config,
}: {
  children: ReactNode
  config?: QueueProcessorConfig
}) {
  useQueueProcessor(config)
  return <>{children}</>
}
