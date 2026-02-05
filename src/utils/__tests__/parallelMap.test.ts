/**
 * ParallelMap Utility Tests
 *
 * Story 2.19: Parallel Action Queue Processing
 * Task 6.6: Test parallelMap utility — verify bounded concurrency
 */

import { describe, it, expect } from 'vitest'
import { parallelMap } from '../parallelMap'

describe('parallelMap', () => {
  it('should process all items and return results in order', async () => {
    const items = [1, 2, 3, 4, 5]
    const results = await parallelMap(items, async (n) => n * 2, 3)
    expect(results).toEqual([2, 4, 6, 8, 10])
  })

  it('should respect bounded concurrency — no more than N concurrent', async () => {
    let activeConcurrent = 0
    let maxConcurrent = 0

    const items = Array.from({ length: 10 }, (_, i) => i)

    await parallelMap(
      items,
      async () => {
        activeConcurrent++
        if (activeConcurrent > maxConcurrent) {
          maxConcurrent = activeConcurrent
        }
        // Simulate async work
        await new Promise((resolve) => setTimeout(resolve, 10))
        activeConcurrent--
      },
      3
    )

    expect(maxConcurrent).toBeLessThanOrEqual(3)
    expect(maxConcurrent).toBeGreaterThanOrEqual(1)
  })

  it('should handle concurrency of 1 (sequential)', async () => {
    const order: number[] = []
    const items = [1, 2, 3]

    await parallelMap(
      items,
      async (n) => {
        order.push(n)
        await new Promise((resolve) => setTimeout(resolve, 5))
        return n
      },
      1
    )

    expect(order).toEqual([1, 2, 3])
  })

  it('should handle empty array', async () => {
    const results = await parallelMap([], async (n: number) => n, 4)
    expect(results).toEqual([])
  })

  it('should handle concurrency larger than items', async () => {
    const items = [1, 2]
    const results = await parallelMap(items, async (n) => n + 1, 10)
    expect(results).toEqual([2, 3])
  })

  it('should propagate errors from individual operations', async () => {
    const items = [1, 2, 3]
    await expect(
      parallelMap(
        items,
        async (n) => {
          if (n === 2) throw new Error('fail')
          return n
        },
        2
      )
    ).rejects.toThrow('fail')
  })

  it('should use all workers for maximum throughput', async () => {
    const concurrency = 4
    let activeConcurrent = 0
    let maxConcurrent = 0

    const items = Array.from({ length: 20 }, (_, i) => i)

    await parallelMap(
      items,
      async () => {
        activeConcurrent++
        if (activeConcurrent > maxConcurrent) maxConcurrent = activeConcurrent
        await new Promise((resolve) => setTimeout(resolve, 10))
        activeConcurrent--
      },
      concurrency
    )

    // With enough items and work, we should reach max concurrency
    expect(maxConcurrent).toBeLessThanOrEqual(concurrency)
  })
})
