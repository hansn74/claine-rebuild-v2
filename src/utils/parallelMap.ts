/**
 * Parallel Map Utility
 *
 * Story 2.19: Parallel Action Queue Processing
 * Task 3.3: Bounded concurrency utility
 *
 * Processes items with bounded concurrency using a simple worker pool pattern.
 * Each worker picks up the next available item when done, ensuring
 * at most `concurrency` items are processed simultaneously.
 */

/**
 * Maps over items with bounded concurrency.
 *
 * @param items - Array of items to process
 * @param fn - Async function to apply to each item
 * @param concurrency - Maximum number of concurrent operations
 * @returns Array of results in the same order as input items
 */
export async function parallelMap<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let index = 0

  // Safety: index++ is safe here because JavaScript is single-threaded.
  // Workers yield at `await fn(...)`, and only one worker resumes per microtask,
  // so two workers never read/increment `index` simultaneously.
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const i = index++
      results[i] = await fn(items[i])
    }
  })

  await Promise.all(workers)
  return results
}
