/**
 * Batch Mode Controller
 *
 * Story 1.18: Batched Reactive Query Triggers
 * Task 1: Create Batch Mode Controller (AC: 5-7)
 *
 * Controls whether reactive query subscriptions should batch updates.
 * Uses reference counting for safe nested enter/exit calls.
 * Follows the singleton + listener pattern from circuitBreaker.ts (Story 1.19).
 */

/**
 * BatchModeController manages a global batch mode flag.
 *
 * When active, reactive observables debounce their emissions to reduce
 * re-renders during bulk operations (sync, bulk actions).
 *
 * Uses reference counting so nested enter/exit calls are safe:
 * - enter() increments the counter
 * - exit() decrements; only transitions to inactive when counter reaches 0
 */
export class BatchModeController {
  private refCount = 0
  private listeners: Set<() => void> = new Set()

  /**
   * Enter batch mode. Increments reference count.
   * Notifies listeners only on the inactive -> active transition.
   */
  enter(): void {
    const wasActive = this.refCount > 0
    this.refCount++

    if (!wasActive) {
      this.notifyListeners()
    }
  }

  /**
   * Exit batch mode. Decrements reference count.
   * Notifies listeners only on the active -> inactive transition.
   * Does not go below zero.
   */
  exit(): void {
    if (this.refCount <= 0) {
      return
    }

    this.refCount--

    if (this.refCount === 0) {
      this.notifyListeners()
    }
  }

  /**
   * Check if batch mode is currently active.
   */
  isActive(): boolean {
    return this.refCount > 0
  }

  /**
   * Subscribe to batch mode state changes.
   * Listener is called only on transitions (active <-> inactive).
   *
   * @returns Unsubscribe function
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener()
      } catch (error) {
        console.error('Error in batch mode listener:', error)
      }
    })
  }
}

/** Singleton instance */
export const batchMode = new BatchModeController()
