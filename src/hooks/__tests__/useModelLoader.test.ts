/**
 * useModelLoader Hook Tests
 *
 * Story 3.1: Local LLM Integration (Browser-Based Inference)
 * Task 5: Background model loading with UI (AC: 6)
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useModelLoader } from '../useModelLoader'

// Track subscribe callbacks
let subscribeCallback: (() => void) | null = null

// Mock aiInferenceService
const mockLoadModel = vi.fn()
const mockIsModelLoaded = vi.fn().mockReturnValue(false)
const mockGetLoadProgress = vi.fn().mockReturnValue(null)
const mockSubscribe = vi.fn((cb: () => void) => {
  subscribeCallback = cb
  return () => {
    subscribeCallback = null
  }
})

vi.mock('@/services/ai', () => ({
  aiInferenceService: {
    loadModel: (...args: unknown[]) => mockLoadModel(...args),
    isModelLoaded: () => mockIsModelLoaded(),
    getLoadProgress: () => mockGetLoadProgress(),
    subscribe: (cb: () => void) => mockSubscribe(cb),
  },
}))

// Mock store
const mockSetStatus = vi.fn()
vi.mock('@/store/aiCapabilityStore', () => ({
  useAICapabilityStore: (selector: (s: { setStatus: typeof mockSetStatus }) => unknown) =>
    selector({ setStatus: mockSetStatus }),
}))

// Mock logger
vi.mock('@/services/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe('useModelLoader', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.useFakeTimers()
    subscribeCallback = null
    mockLoadModel.mockResolvedValue(undefined)
    mockIsModelLoaded.mockReturnValue(false)
    mockGetLoadProgress.mockReturnValue(null)
    mockSubscribe.mockImplementation((cb: () => void) => {
      subscribeCallback = cb
      return () => {
        subscribeCallback = null
      }
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('initial state', () => {
    it('should return idle state on mount', () => {
      const { result } = renderHook(() => useModelLoader())

      expect(result.current.isLoading).toBe(false)
      expect(result.current.isReady).toBe(false)
      expect(result.current.isError).toBe(false)
      expect(result.current.progress).toBeNull()
      expect(result.current.error).toBeNull()
      expect(result.current.retryCount).toBe(0)
    })

    it('should detect already-loaded model', () => {
      mockIsModelLoaded.mockReturnValue(true)

      const { result } = renderHook(() => useModelLoader())

      expect(result.current.isReady).toBe(true)
    })

    it('should subscribe to service updates', () => {
      renderHook(() => useModelLoader())

      expect(mockSubscribe).toHaveBeenCalled()
    })
  })

  describe('loadModel', () => {
    it('should load model and transition to ready', async () => {
      const { result } = renderHook(() => useModelLoader())

      await act(async () => {
        result.current.loadModel()
      })

      expect(mockLoadModel).toHaveBeenCalled()
      expect(result.current.isLoading).toBe(false)
      expect(result.current.isReady).toBe(true)
      expect(mockSetStatus).toHaveBeenCalledWith('loading')
      expect(mockSetStatus).toHaveBeenCalledWith('ready')
    })

    it('should not load if already loading', async () => {
      mockLoadModel.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      )

      const { result } = renderHook(() => useModelLoader())

      act(() => {
        result.current.loadModel()
      })

      expect(result.current.isLoading).toBe(true)

      act(() => {
        result.current.loadModel() // Should be ignored
      })

      expect(mockLoadModel).toHaveBeenCalledTimes(1)
    })

    it('should not load if already ready', async () => {
      mockIsModelLoaded.mockReturnValue(true)

      const { result } = renderHook(() => useModelLoader())

      act(() => {
        result.current.loadModel()
      })

      expect(mockLoadModel).not.toHaveBeenCalled()
    })
  })

  describe('progress tracking', () => {
    it('should update progress from service subscription', async () => {
      const mockProgress = {
        status: 'downloading' as const,
        progress: 42,
        downloadedBytes: 420_000_000,
        totalBytes: 1_000_000_000,
        estimatedTimeRemainingMs: 15000,
      }

      mockGetLoadProgress.mockReturnValue(mockProgress)

      const { result } = renderHook(() => useModelLoader())

      // Simulate service emitting progress
      act(() => {
        if (subscribeCallback) subscribeCallback()
      })

      expect(result.current.progress).toEqual(mockProgress)
    })
  })

  describe('error handling and retry', () => {
    it('should retry with exponential backoff on failure', async () => {
      mockLoadModel
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(undefined)

      const { result } = renderHook(() => useModelLoader())

      // First attempt fails
      await act(async () => {
        result.current.loadModel()
      })

      expect(result.current.retryCount).toBe(1)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.isError).toBe(false) // Not yet, still retrying

      // Advance past first backoff (1000ms)
      await act(async () => {
        vi.advanceTimersByTime(1000)
      })

      // Second attempt also fails
      expect(result.current.retryCount).toBe(2)

      // Advance past second backoff (2000ms)
      await act(async () => {
        vi.advanceTimersByTime(2000)
      })

      // Third attempt succeeds
      expect(result.current.isReady).toBe(true)
      expect(result.current.isError).toBe(false)
      expect(result.current.retryCount).toBe(0)
    })

    it('should set error state after max retries', async () => {
      mockLoadModel.mockRejectedValue(new Error('Persistent failure'))

      const { result } = renderHook(() => useModelLoader())

      // First attempt
      await act(async () => {
        result.current.loadModel()
      })

      // Advance through all retries
      await act(async () => {
        vi.advanceTimersByTime(1000) // retry 1
      })
      await act(async () => {
        vi.advanceTimersByTime(2000) // retry 2
      })
      await act(async () => {
        vi.advanceTimersByTime(4000) // retry 3
      })

      expect(result.current.isError).toBe(true)
      expect(result.current.error).toBe('Persistent failure')
      expect(result.current.retryCount).toBe(3)
      expect(mockSetStatus).toHaveBeenCalledWith('error')
    })
  })

  describe('cancelLoad', () => {
    it('should cancel loading and reset state', () => {
      mockLoadModel.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      )

      const { result } = renderHook(() => useModelLoader())

      act(() => {
        result.current.loadModel()
      })

      expect(result.current.isLoading).toBe(true)

      act(() => {
        result.current.cancelLoad()
      })

      expect(result.current.isLoading).toBe(false)
      expect(result.current.isError).toBe(false)
      expect(result.current.error).toBeNull()
      expect(result.current.progress).toBeNull()
      expect(result.current.retryCount).toBe(0)
      expect(mockSetStatus).toHaveBeenCalledWith('uninitialized')
    })

    it('should cancel pending retry timer', async () => {
      mockLoadModel.mockRejectedValueOnce(new Error('Fail')).mockResolvedValueOnce(undefined)

      const { result } = renderHook(() => useModelLoader())

      // First attempt fails, schedules retry
      await act(async () => {
        result.current.loadModel()
      })

      expect(result.current.retryCount).toBe(1)

      // Cancel before retry fires
      act(() => {
        result.current.cancelLoad()
      })

      // Advance timers — retry should NOT fire
      await act(async () => {
        vi.advanceTimersByTime(5000)
      })

      expect(mockLoadModel).toHaveBeenCalledTimes(1) // Only initial attempt
      expect(result.current.retryCount).toBe(0)
    })
  })

  describe('retry', () => {
    it('should reset retry count and start fresh', async () => {
      // Use mockRejectedValue for consistent rejection during retry exhaustion
      mockLoadModel.mockRejectedValue(new Error('Fail'))

      const { result } = renderHook(() => useModelLoader())

      // Exhaust all retries
      await act(async () => {
        result.current.loadModel()
      })
      await act(async () => {
        vi.advanceTimersByTime(1000)
      })
      await act(async () => {
        vi.advanceTimersByTime(2000)
      })
      await act(async () => {
        vi.advanceTimersByTime(4000)
      })

      expect(result.current.isError).toBe(true)

      // Switch to success for manual retry
      mockLoadModel.mockResolvedValueOnce(undefined)

      await act(async () => {
        result.current.retry()
      })

      expect(result.current.isReady).toBe(true)
      expect(result.current.isError).toBe(false)
      expect(result.current.retryCount).toBe(0)
    })

    it('should not retry while loading', async () => {
      mockLoadModel.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      )

      const { result } = renderHook(() => useModelLoader())

      act(() => {
        result.current.loadModel()
      })

      act(() => {
        result.current.retry() // Should be ignored
      })

      expect(mockLoadModel).toHaveBeenCalledTimes(1)
    })
  })

  describe('cleanup', () => {
    it('should unsubscribe from service on unmount', () => {
      const { unmount } = renderHook(() => useModelLoader())

      expect(subscribeCallback).not.toBeNull()

      unmount()

      expect(subscribeCallback).toBeNull()
    })
  })
})
