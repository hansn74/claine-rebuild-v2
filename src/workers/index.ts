/**
 * Web Workers
 *
 * Story 2.10: Performance Optimization & Benchmarking
 * Task 5: Web Workers for Heavy Computation
 *
 * Exports worker types and utilities for background processing.
 */

// Export all types
export * from './types'

// Re-export worker manager from utils
export { WorkerManager, workerManager } from '@/utils/workers/workerManager'
