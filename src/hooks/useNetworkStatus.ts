/**
 * Network Status Hook
 *
 * Provides real-time network connectivity status.
 * Combines browser online/offline events with actual connectivity checks.
 *
 * Story 2.4: Offline-First Send Queue
 * - AC 1: Detect when offline to queue emails
 * - FR007: Support offline functionality
 * - NFR002: Gracefully handle network interruptions
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { logger } from '@/services/logger'

/**
 * Network status state
 */
export interface NetworkStatus {
  /** Whether the app has network connectivity */
  isOnline: boolean
  /** Timestamp of last connectivity check */
  lastChecked: Date | null
  /** Whether a connectivity check is in progress */
  checking: boolean
}

/**
 * Configuration options for network status hook
 */
export interface UseNetworkStatusOptions {
  /** Interval for periodic connectivity checks in ms (default: 30000 = 30s) */
  checkInterval?: number
  /** Debounce delay for online/offline events in ms (default: 1000 = 1s) */
  debounceMs?: number
  /** Timeout for connectivity check requests in ms (default: 5000 = 5s) */
  checkTimeout?: number
  /** Custom URL to check connectivity (default: /api/health or current origin) */
  checkUrl?: string
}

const DEFAULT_OPTIONS: Required<UseNetworkStatusOptions> = {
  checkInterval: 30000, // 30 seconds
  debounceMs: 1000, // 1 second
  checkTimeout: 5000, // 5 seconds
  checkUrl: '', // Will use origin
}

/**
 * Hook to monitor network connectivity status
 *
 * Uses a combination of:
 * 1. Browser's navigator.onLine property
 * 2. Online/offline events (with debounce)
 * 3. Actual connectivity checks via fetch
 *
 * @param options - Configuration options
 * @returns Network status state
 */
export function useNetworkStatus(options: UseNetworkStatusOptions = {}): NetworkStatus {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  const [status, setStatus] = useState<NetworkStatus>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    lastChecked: null,
    checking: false,
  })

  const debounceTimerRef = useRef<number | null>(null)
  const checkIntervalRef = useRef<number | null>(null)

  /**
   * Perform actual connectivity check
   * navigator.onLine is unreliable - it only checks if there's a network interface
   * This does an actual request to verify connectivity
   */
  const checkConnectivity = useCallback(async (): Promise<boolean> => {
    setStatus((prev) => ({ ...prev, checking: true }))

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), opts.checkTimeout)

      // Use current origin or specified URL
      // Note: Using vite.svg since favicon.ico doesn't exist in this project
      const checkUrl = opts.checkUrl || `${window.location.origin}/vite.svg`

      const response = await fetch(checkUrl, {
        method: 'HEAD',
        mode: 'no-cors', // Avoid CORS issues
        cache: 'no-store',
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      // In no-cors mode, we can't read the response status
      // But if fetch completes without throwing, we have connectivity
      const isOnline = response.type === 'opaque' || response.ok

      setStatus({
        isOnline,
        lastChecked: new Date(),
        checking: false,
      })

      logger.debug('sendQueue', 'Connectivity check completed', { isOnline })
      return isOnline
    } catch (error) {
      // Fetch failed - we're offline or the server is down
      setStatus({
        isOnline: false,
        lastChecked: new Date(),
        checking: false,
      })

      logger.debug('sendQueue', 'Connectivity check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      return false
    }
  }, [opts.checkTimeout, opts.checkUrl])

  /**
   * Handle browser online/offline events with debounce
   */
  const handleOnlineStatusChange = useCallback(
    (online: boolean) => {
      // Clear existing debounce timer
      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current)
      }

      // Debounce to avoid rapid state changes
      debounceTimerRef.current = window.setTimeout(() => {
        logger.debug('sendQueue', `Browser reports ${online ? 'online' : 'offline'}`)

        if (online) {
          // Verify with actual connectivity check
          checkConnectivity()
        } else {
          // Trust offline event immediately
          setStatus({
            isOnline: false,
            lastChecked: new Date(),
            checking: false,
          })
        }
      }, opts.debounceMs)
    },
    [checkConnectivity, opts.debounceMs]
  )

  useEffect(() => {
    // Event handlers
    const handleOnline = () => handleOnlineStatusChange(true)
    const handleOffline = () => handleOnlineStatusChange(false)

    // Subscribe to online/offline events
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Initial connectivity check - defer to avoid synchronous setState
    const initialCheckTimer = window.setTimeout(() => {
      checkConnectivity()
    }, 0)

    // Set up periodic connectivity check (only when browser says we're online)
    if (opts.checkInterval > 0) {
      checkIntervalRef.current = window.setInterval(() => {
        if (navigator.onLine) {
          checkConnectivity()
        }
      }, opts.checkInterval)
    }

    // Cleanup
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)

      clearTimeout(initialCheckTimer)

      if (debounceTimerRef.current !== null) {
        clearTimeout(debounceTimerRef.current)
      }

      if (checkIntervalRef.current !== null) {
        clearInterval(checkIntervalRef.current)
      }
    }
  }, [checkConnectivity, handleOnlineStatusChange, opts.checkInterval])

  return status
}

/**
 * Simple version of the hook that only returns boolean online status
 * Useful for components that don't need the full status object
 */
export function useIsOnline(options: UseNetworkStatusOptions = {}): boolean {
  const { isOnline } = useNetworkStatus(options)
  return isOnline
}
