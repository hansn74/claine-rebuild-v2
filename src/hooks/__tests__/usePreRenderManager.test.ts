/**
 * usePreRenderManager Hook Tests
 *
 * Story 2.20: Pre-Render Adjacent Email Thread Views
 * Task 6: Unit Tests (AC: 18, 20, 21, 22)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePreRenderManager } from '../usePreRenderManager'

// Mock the logger
vi.mock('@/services/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// The hook uses checkDeviceDisabled() which reads navigator.deviceMemory directly

// Helper to create email items
function createEmails(ids: string[]) {
  return ids.map((id) => ({
    id,
    threadId: `thread-${id}`,
  }))
}

describe('usePreRenderManager', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Ensure visibility is visible
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    })

    // Mock requestIdleCallback
    vi.stubGlobal('requestIdleCallback', (cb: () => void) => {
      return setTimeout(cb, 0) as unknown as number
    })
    vi.stubGlobal('cancelIdleCallback', (id: number) => {
      clearTimeout(id)
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  // Task 6.1: Given emails [A, B, C, D, E] and currentEmailId=C,
  // returns nextThreadId=D.threadId and prevThreadId=B.threadId
  it('computes correct adjacent threadIds for middle selection', async () => {
    const emails = createEmails(['A', 'B', 'C', 'D', 'E'])

    const { result } = renderHook(() => usePreRenderManager('C', emails))

    // Advance past debounce (100ms) and idle callback
    await act(async () => {
      vi.advanceTimersByTime(150)
    })

    expect(result.current.nextThreadId).toBe('thread-D')
    expect(result.current.prevThreadId).toBe('thread-B')
  })

  // First email should have no prevThreadId
  it('returns null prevThreadId for first email', async () => {
    const emails = createEmails(['A', 'B', 'C'])

    const { result } = renderHook(() => usePreRenderManager('A', emails))

    await act(async () => {
      vi.advanceTimersByTime(150)
    })

    expect(result.current.nextThreadId).toBe('thread-B')
    expect(result.current.prevThreadId).toBeNull()
  })

  // Last email should have no nextThreadId
  it('returns null nextThreadId for last email', async () => {
    const emails = createEmails(['A', 'B', 'C'])

    const { result } = renderHook(() => usePreRenderManager('C', emails))

    await act(async () => {
      vi.advanceTimersByTime(150)
    })

    expect(result.current.nextThreadId).toBeNull()
    expect(result.current.prevThreadId).toBe('thread-B')
  })

  // Null email clears everything
  it('returns all null when no email selected', () => {
    const emails = createEmails(['A', 'B', 'C'])

    const { result } = renderHook(() => usePreRenderManager(null, emails))

    expect(result.current.nextThreadId).toBeNull()
    expect(result.current.prevThreadId).toBeNull()
    expect(result.current.nextReady).toBe(false)
    expect(result.current.prevReady).toBe(false)
  })

  // Task 6.2: Change currentEmailId from C to D → new prev=C, old "next" (E) stays if adjacent
  it('updates adjacent threadIds when selection moves to next email', async () => {
    const emails = createEmails(['A', 'B', 'C', 'D', 'E'])

    const { result, rerender } = renderHook(({ emailId }) => usePreRenderManager(emailId, emails), {
      initialProps: { emailId: 'C' as string },
    })

    // Let initial pre-render complete
    await act(async () => {
      vi.advanceTimersByTime(150)
    })

    expect(result.current.nextThreadId).toBe('thread-D')
    expect(result.current.prevThreadId).toBe('thread-B')

    // Move selection to D
    rerender({ emailId: 'D' })

    await act(async () => {
      vi.advanceTimersByTime(150)
    })

    expect(result.current.nextThreadId).toBe('thread-E')
    expect(result.current.prevThreadId).toBe('thread-C')
  })

  // Task 6.3: Change currentEmailId from C to H (non-adjacent) → both discarded
  it('discards all pre-renders when jumping far away', async () => {
    const emails = createEmails(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'])

    const { result, rerender } = renderHook(({ emailId }) => usePreRenderManager(emailId, emails), {
      initialProps: { emailId: 'C' as string },
    })

    await act(async () => {
      vi.advanceTimersByTime(150)
    })

    expect(result.current.nextThreadId).toBe('thread-D')
    expect(result.current.prevThreadId).toBe('thread-B')

    // Jump to H (non-adjacent)
    rerender({ emailId: 'H' })

    await act(async () => {
      vi.advanceTimersByTime(150)
    })

    expect(result.current.nextThreadId).toBe('thread-I')
    expect(result.current.prevThreadId).toBe('thread-G')
  })

  // Task 6.4: preRenderGate returns false when hidden — tested in preRenderGate.test.ts
  // Here we test that visibility change pauses pre-rendering
  it('pauses pre-rendering when tab goes to background', async () => {
    const emails = createEmails(['A', 'B', 'C', 'D', 'E'])

    const { result } = renderHook(() => usePreRenderManager('C', emails))

    // Simulate tab going to background
    await act(async () => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        writable: true,
        configurable: true,
      })
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(result.current.paused).toBe(true)

    // Simulate tab returning to foreground
    await act(async () => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        writable: true,
        configurable: true,
      })
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(result.current.paused).toBe(false)
  })

  // Task 6.6: Debounce — rapid changes only pre-render adjacent to final position
  it('debounces rapid navigation changes', async () => {
    const emails = createEmails(['A', 'B', 'C', 'D', 'E', 'F'])

    const { result, rerender } = renderHook(({ emailId }) => usePreRenderManager(emailId, emails), {
      initialProps: { emailId: 'C' as string },
    })

    // Rapid navigation: C→D→E→F within 100ms
    rerender({ emailId: 'D' })
    await act(async () => {
      vi.advanceTimersByTime(30)
    })
    rerender({ emailId: 'E' })
    await act(async () => {
      vi.advanceTimersByTime(30)
    })
    rerender({ emailId: 'F' })

    // Wait for full debounce period
    await act(async () => {
      vi.advanceTimersByTime(150)
    })

    // Should only have pre-renders adjacent to F (final position)
    expect(result.current.nextThreadId).toBeNull() // F is last
    expect(result.current.prevThreadId).toBe('thread-E')
  })

  // Task 6.7: After consumeNext(), nextReady resets to false
  it('resets nextReady after consumeNext()', async () => {
    const emails = createEmails(['A', 'B', 'C', 'D', 'E'])

    const { result } = renderHook(() => usePreRenderManager('C', emails))

    // Let pre-render complete
    await act(async () => {
      vi.advanceTimersByTime(150)
    })

    // Mark next as ready
    act(() => {
      result.current.setNextReady()
    })

    expect(result.current.nextReady).toBe(true)

    // Consume next
    let consumed: string | null = null
    act(() => {
      consumed = result.current.consumeNext()
    })

    expect(consumed).toBe('thread-D')
    expect(result.current.nextReady).toBe(false)
  })

  // Consume prev
  it('resets prevReady after consumePrev()', async () => {
    const emails = createEmails(['A', 'B', 'C', 'D', 'E'])

    const { result } = renderHook(() => usePreRenderManager('C', emails))

    await act(async () => {
      vi.advanceTimersByTime(150)
    })

    // Mark prev as ready
    act(() => {
      result.current.setPrevReady()
    })

    expect(result.current.prevReady).toBe(true)

    let consumed: string | null = null
    act(() => {
      consumed = result.current.consumePrev()
    })

    expect(consumed).toBe('thread-B')
    expect(result.current.prevReady).toBe(false)
  })

  // Disabled on low memory
  it('returns all null when disabled (low memory device)', async () => {
    // Simulate low memory device
    Object.defineProperty(navigator, 'deviceMemory', {
      value: 2,
      writable: true,
      configurable: true,
    })

    const emails = createEmails(['A', 'B', 'C'])

    const { result } = renderHook(() => usePreRenderManager('B', emails))

    await act(async () => {
      vi.advanceTimersByTime(150)
    })

    expect(result.current.disabled).toBe(true)
    expect(result.current.nextThreadId).toBeNull()
    expect(result.current.prevThreadId).toBeNull()

    // Clean up
    Object.defineProperty(navigator, 'deviceMemory', {
      value: undefined,
      writable: true,
      configurable: true,
    })
  })

  // Empty email list
  it('handles empty email list', () => {
    const { result } = renderHook(() => usePreRenderManager('A', []))

    expect(result.current.nextThreadId).toBeNull()
    expect(result.current.prevThreadId).toBeNull()
  })

  // Email not found in list
  it('handles email not found in list', () => {
    const emails = createEmails(['A', 'B', 'C'])

    const { result } = renderHook(() => usePreRenderManager('X', emails))

    expect(result.current.nextThreadId).toBeNull()
    expect(result.current.prevThreadId).toBeNull()
  })
})
