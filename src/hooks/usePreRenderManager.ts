/**
 * Pre-Render Manager Hook
 *
 * Story 2.20: Pre-Render Adjacent Email Thread Views
 * Task 1: Pre-Render Manager Hook (AC: 1, 2, 4, 5, 6, 7)
 *
 * Manages the lifecycle of pre-rendered thread views for adjacent emails.
 * When an email is selected, computes the next/previous threadIds and
 * schedules their pre-rendering after the current view has settled.
 *
 * Key behaviors:
 * - Computes adjacent threadIds from the email list (1.2)
 * - Debounces pre-render scheduling for rapid j/j/j navigation (1.3)
 * - Tracks "ready" state for each pre-rendered view (1.4)
 * - Discards stale pre-renders when selection moves beyond 2 positions (1.5)
 * - Exposes consume* functions for the swap operation (1.6)
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { logger } from '@/services/logger'

declare global {
  interface Navigator {
    deviceMemory?: number
  }
}

export interface PreRenderState {
  nextThreadId: string | null
  prevThreadId: string | null
  nextReady: boolean
  prevReady: boolean
  consumeNext: () => string | null
  consumePrev: () => string | null
  setNextReady: () => void
  setPrevReady: () => void
  paused: boolean
  disabled: boolean
}

interface EmailItem {
  id: string
  threadId: string
}

/**
 * Check device memory at module level (synchronous, no effect needed).
 * This avoids the lint issue of calling setState inside an effect for
 * a value that never changes during the component lifecycle.
 */
function checkDeviceDisabled(): boolean {
  if (typeof navigator.deviceMemory === 'number' && navigator.deviceMemory < 4) {
    return true
  }
  return false
}

/**
 * Hook to manage pre-rendering of adjacent email thread views.
 *
 * @param currentEmailId - Currently selected email ID
 * @param emails - Ordered array of emails in the list
 * @returns Pre-render state including threadIds, ready flags, and consume functions
 */
export function usePreRenderManager(
  currentEmailId: string | null,
  emails: EmailItem[]
): PreRenderState {
  // Task 2.3: Check device memory once on first render (stable across lifecycle)
  const [disabled] = useState(() => {
    const isDisabled = checkDeviceDisabled()
    if (isDisabled) {
      logger.debug('performance', 'Pre-rendering disabled: low memory device', {
        deviceMemory: navigator.deviceMemory,
      })
    }
    return isDisabled
  })

  const [nextThreadId, setNextThreadId] = useState<string | null>(null)
  const [prevThreadId, setPrevThreadId] = useState<string | null>(null)
  const [nextReady, setNextReadyState] = useState(false)
  const [prevReady, setPrevReadyState] = useState(false)
  const pausedRef = useRef(false)
  const [paused, setPaused] = useState(false)

  // Refs for debounce and cleanup
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const idleCallbackRef = useRef<number | null>(null)

  // Task 2.2: Subscribe to visibility changes (external system subscription)
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible'
      pausedRef.current = !isVisible
      setPaused(!isVisible)
      logger.debug(
        'performance',
        `Pre-rendering ${isVisible ? 'resumed' : 'paused'}: tab visibility`
      )
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  // Task 1.2: Compute adjacent threadIds from emails array
  const adjacent = useMemo(() => {
    if (!currentEmailId || emails.length === 0) {
      return { nextId: null, prevId: null, currentIndex: -1 }
    }

    const currentIndex = emails.findIndex((e) => e.id === currentEmailId)
    if (currentIndex === -1) {
      return { nextId: null, prevId: null, currentIndex: -1 }
    }

    const nextEmail = emails[currentIndex + 1]
    const prevEmail = emails[currentIndex - 1]

    return {
      nextId: nextEmail?.threadId ?? null,
      prevId: prevEmail?.threadId ?? null,
      currentIndex,
    }
  }, [currentEmailId, emails])

  // Task 1.5: Discard stale pre-renders and schedule new ones
  // Uses refs to track pending state updates to avoid synchronous setState in effect
  const nextThreadIdRef = useRef<string | null>(null)
  const prevThreadIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (disabled) return

    // Clean up pending timers
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    if (idleCallbackRef.current !== null) {
      if (typeof cancelIdleCallback === 'function') {
        cancelIdleCallback(idleCallbackRef.current)
      }
      idleCallbackRef.current = null
    }

    // If no email selected, clear via deferred callback to avoid sync setState in effect
    if (!currentEmailId || adjacent.currentIndex === -1) {
      debounceTimerRef.current = setTimeout(() => {
        setNextThreadId(null)
        setPrevThreadId(null)
        setNextReadyState(false)
        setPrevReadyState(false)
        nextThreadIdRef.current = null
        prevThreadIdRef.current = null
      }, 0)
      return
    }

    // Task 1.3: Debounce 100ms to handle rapid j/j/j navigation
    debounceTimerRef.current = setTimeout(() => {
      if (pausedRef.current) return

      // Schedule after current view has settled using requestIdleCallback
      const schedulePreRender = () => {
        // Update next threadId
        if (nextThreadIdRef.current !== adjacent.nextId) {
          nextThreadIdRef.current = adjacent.nextId
          setNextThreadId(adjacent.nextId)
          setNextReadyState(false)
        }

        // Update prev threadId
        if (prevThreadIdRef.current !== adjacent.prevId) {
          prevThreadIdRef.current = adjacent.prevId
          setPrevThreadId(adjacent.prevId)
          setPrevReadyState(false)
        }

        logger.debug('performance', 'Pre-render scheduled', {
          currentEmailId,
          nextThreadId: adjacent.nextId,
          prevThreadId: adjacent.prevId,
        })
      }

      // Task 1.3: Use requestIdleCallback with setTimeout(0) fallback for Safari
      if (typeof requestIdleCallback === 'function') {
        idleCallbackRef.current = requestIdleCallback(schedulePreRender)
      } else {
        // Fallback for Safari
        setTimeout(schedulePreRender, 0)
      }
    }, 100)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      if (idleCallbackRef.current !== null && typeof cancelIdleCallback === 'function') {
        cancelIdleCallback(idleCallbackRef.current)
      }
    }
  }, [currentEmailId, adjacent, disabled])

  // Task 1.4: Functions to mark pre-rendered views as ready
  const setNextReady = useCallback(() => {
    setNextReadyState(true)
  }, [])

  const setPrevReady = useCallback(() => {
    setPrevReadyState(true)
  }, [])

  // Task 1.6: Consume functions — return threadId and reset ready state
  const consumeNext = useCallback((): string | null => {
    const id = nextThreadId
    setNextReadyState(false)
    return id
  }, [nextThreadId])

  const consumePrev = useCallback((): string | null => {
    const id = prevThreadId
    setPrevReadyState(false)
    return id
  }, [prevThreadId])

  // If disabled, return all nulls
  if (disabled) {
    return {
      nextThreadId: null,
      prevThreadId: null,
      nextReady: false,
      prevReady: false,
      consumeNext: () => null,
      consumePrev: () => null,
      setNextReady: () => {},
      setPrevReady: () => {},
      paused: false,
      disabled: true,
    }
  }

  return {
    nextThreadId,
    prevThreadId,
    nextReady,
    prevReady,
    consumeNext,
    consumePrev,
    setNextReady,
    setPrevReady,
    paused,
    disabled,
  }
}
