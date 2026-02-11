/**
 * useModelLoader Hook
 *
 * Story 3.1: Local LLM Integration (Browser-Based Inference)
 * Task 5: Background model loading with UI (AC: 6)
 *
 * Provides React integration for lazy model loading with:
 * - Download progress tracking (percentage, bytes, ETA)
 * - Cancel support
 * - Exponential backoff retry on failure
 * - aiCapabilityStore status synchronization
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { aiInferenceService } from '@/services/ai'
import { useAICapabilityStore } from '@/store/aiCapabilityStore'
import { logger } from '@/services/logger'
import type { ModelLoadProgress } from '@/services/ai/types'

/**
 * Retry configuration
 */
const MAX_RETRIES = 3
const INITIAL_BACKOFF_MS = 1000

/**
 * Model loader state returned by the hook
 */
export interface UseModelLoaderReturn {
  /** Start loading the model */
  loadModel: () => void
  /** Cancel an in-progress load */
  cancelLoad: () => void
  /** Retry after a failure */
  retry: () => void
  /** Whether the model is currently loading */
  isLoading: boolean
  /** Whether the model is loaded and ready */
  isReady: boolean
  /** Whether model loading has failed */
  isError: boolean
  /** Loading progress details */
  progress: ModelLoadProgress | null
  /** Error message if loading failed */
  error: string | null
  /** Number of retry attempts made */
  retryCount: number
}

/**
 * Hook for lazy model loading with progress tracking and retry logic.
 *
 * The model is NOT loaded on mount — call `loadModel()` when the user
 * first triggers an AI feature.
 */
export function useModelLoader(): UseModelLoaderReturn {
  const [isLoading, setIsLoading] = useState(false)
  const [isReady, setIsReady] = useState(() => aiInferenceService.isModelLoaded())
  const [isError, setIsError] = useState(false)
  const [progress, setProgress] = useState<ModelLoadProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  const cancelledRef = useRef(false)
  const mountedRef = useRef(true)
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const doLoadRef = useRef<(attempt: number) => void>(() => {})

  const setStatus = useAICapabilityStore((s) => s.setStatus)

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
      }
    }
  }, [])

  // Subscribe to inference service progress updates
  useEffect(() => {
    const unsubscribe = aiInferenceService.subscribe(() => {
      if (!mountedRef.current) return
      const loadProgress = aiInferenceService.getLoadProgress()
      if (loadProgress) {
        setProgress(loadProgress)
      }
    })
    return unsubscribe
  }, [])

  const doLoad = useCallback(
    async (attempt: number) => {
      if (!mountedRef.current) return

      cancelledRef.current = false
      setIsLoading(true)
      setIsError(false)
      setError(null)
      setStatus('loading')

      logger.info('ai', 'Starting model load', { attempt })

      try {
        await aiInferenceService.loadModel()

        if (!mountedRef.current || cancelledRef.current) return

        setIsLoading(false)
        setIsReady(true)
        setRetryCount(0)
        setStatus('ready')

        logger.info('ai', 'Model loaded successfully')
      } catch (err) {
        if (!mountedRef.current || cancelledRef.current) return

        const errorMessage = err instanceof Error ? err.message : 'Failed to load model'

        logger.error('ai', 'Model load failed', {
          attempt,
          error: errorMessage,
        })

        setIsLoading(false)

        if (attempt < MAX_RETRIES) {
          // Schedule retry with exponential backoff
          const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt)
          setRetryCount(attempt + 1)
          setStatus('loading')

          logger.info('ai', 'Scheduling retry', {
            attempt: attempt + 1,
            backoffMs,
          })

          retryTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current && !cancelledRef.current) {
              doLoadRef.current(attempt + 1)
            }
          }, backoffMs)
        } else {
          // Max retries exhausted
          setIsError(true)
          setError(errorMessage)
          setRetryCount(attempt)
          setStatus('error')

          logger.error('ai', 'Model load failed after max retries', {
            attempts: attempt,
          })
        }
      }
    },
    [setStatus]
  )

  // Keep ref in sync for recursive setTimeout calls
  useEffect(() => {
    doLoadRef.current = doLoad
  }, [doLoad])

  const loadModel = useCallback(() => {
    if (isLoading || isReady) return
    setRetryCount(0)
    doLoad(0)
  }, [isLoading, isReady, doLoad])

  const cancelLoad = useCallback(() => {
    cancelledRef.current = true
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current)
      retryTimeoutRef.current = null
    }
    setIsLoading(false)
    setIsError(false)
    setError(null)
    setProgress(null)
    setRetryCount(0)
    setStatus('uninitialized')

    logger.info('ai', 'Model load cancelled by user')
  }, [setStatus])

  const retry = useCallback(() => {
    if (isLoading) return
    setRetryCount(0)
    doLoad(0)
  }, [isLoading, doLoad])

  return {
    loadModel,
    cancelLoad,
    retry,
    isLoading,
    isReady,
    isError,
    progress,
    error,
    retryCount,
  }
}
