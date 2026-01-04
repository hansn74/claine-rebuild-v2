/**
 * Lazy Loading Preload Utilities
 *
 * Story 2.10: Performance Optimization & Benchmarking
 * Task 6.6: Configure preloading for likely navigation paths
 *
 * Provides utilities for preloading lazy-loaded components
 * to improve perceived performance.
 */

/**
 * Component import function type
 */
type ComponentImport<T = unknown> = () => Promise<{ default: T }>

/**
 * Preloadable lazy component with preload method
 */
export interface PreloadableLazyComponent<T> {
  (): Promise<{ default: T }>
  preload: () => Promise<{ default: T }>
}

/**
 * Create a preloadable lazy import
 *
 * Wraps a dynamic import so it can be preloaded before needed.
 *
 * @example
 * ```typescript
 * const ComposeDialog = preloadable(
 *   () => import('@/components/compose').then(m => ({ default: m.ComposeDialog }))
 * )
 *
 * // Preload on hover
 * onMouseEnter={() => ComposeDialog.preload()}
 *
 * // Use with React.lazy
 * const LazyComposeDialog = lazy(ComposeDialog)
 * ```
 */
export function preloadable<T>(importFn: ComponentImport<T>): PreloadableLazyComponent<T> {
  let cache: Promise<{ default: T }> | null = null

  const loader: PreloadableLazyComponent<T> = () => {
    if (!cache) {
      cache = importFn()
    }
    return cache
  }

  loader.preload = () => {
    if (!cache) {
      cache = importFn()
    }
    return cache
  }

  return loader
}

/**
 * Preload multiple components
 *
 * @param imports Array of preloadable imports to load
 */
export function preloadAll(imports: PreloadableLazyComponent<unknown>[]): Promise<unknown[]> {
  return Promise.all(imports.map((fn) => fn.preload()))
}

/**
 * Preload component after idle time
 *
 * Uses requestIdleCallback to preload during browser idle time.
 *
 * @param importFn Component import function
 * @param timeout Maximum wait time before forcing preload (ms)
 */
export function preloadWhenIdle<T>(importFn: PreloadableLazyComponent<T>, timeout = 4000): void {
  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(
      () => {
        importFn.preload()
      },
      { timeout }
    )
  } else {
    // Fallback for browsers without requestIdleCallback
    setTimeout(() => {
      importFn.preload()
    }, 200)
  }
}

/**
 * Preload component on network idle
 *
 * Uses the Network Information API if available to wait for
 * a good network connection before preloading.
 *
 * @param importFn Component import function
 */
export function preloadOnGoodNetwork<T>(importFn: PreloadableLazyComponent<T>): void {
  const connection = (navigator as unknown as { connection?: { effectiveType?: string } })
    .connection

  if (connection?.effectiveType) {
    // Only preload on 4g or better
    if (connection.effectiveType === '4g') {
      preloadWhenIdle(importFn)
    }
  } else {
    // No network info available, preload anyway
    preloadWhenIdle(importFn)
  }
}

/**
 * Component preload map for commonly used lazy components
 */
export const lazyComponents = {
  composeDialog: preloadable(() =>
    import('@/components/compose').then((m) => ({ default: m.ComposeDialog }))
  ),
  commandPalette: preloadable(() =>
    import('@/components/search').then((m) => ({ default: m.CommandPalette }))
  ),
}

/**
 * Preload all critical components after initial render
 */
export function preloadCriticalComponents(): void {
  // Preload compose and search after page loads
  preloadWhenIdle(lazyComponents.composeDialog)
  preloadWhenIdle(lazyComponents.commandPalette)
}
