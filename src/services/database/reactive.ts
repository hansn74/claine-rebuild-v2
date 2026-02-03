/* eslint-disable @typescript-eslint/no-explicit-any */
import { getDatabase } from './init'
import type { RxCollection, RxDocument, MangoQuery } from 'rxdb'
import { Observable, merge, Subscription } from 'rxjs'
import { debounceTime, auditTime, distinctUntilChanged, share } from 'rxjs/operators'
import { batchMode, BatchModeController } from './batchMode'

/**
 * Options for createBatchedObservable
 */
export interface BatchedObservableOptions {
  /** Trailing debounce window in ms (default: 100) */
  debounceMs?: number
  /** Maximum wait cap in ms to prevent indefinite buffering (default: 500) */
  maxWaitMs?: number
  /** BatchModeController instance (defaults to singleton, override for testing) */
  batchController?: BatchModeController
}

/**
 * Wrap a source observable with batch-aware behavior.
 *
 * Story 1.18: Batched Reactive Query Triggers (AC 1-4, 5-7)
 *
 * When batch mode is OFF: passes through emissions immediately.
 * When batch mode is ON: applies debounceTime + auditTime to reduce render cycles.
 *
 * Reacts dynamically to batch mode transitions mid-stream.
 *
 * @param source$ - The source observable to wrap
 * @param options - Configuration options
 * @returns Observable that batches when batchMode is active
 */
export function createBatchedObservable<T>(
  source$: Observable<T>,
  options: BatchedObservableOptions = {}
): Observable<T> {
  const { debounceMs = 100, maxWaitMs = 500, batchController = batchMode } = options

  return new Observable<T>((subscriber) => {
    let currentSub: Subscription | null = null

    const setupStream = () => {
      currentSub?.unsubscribe()

      if (batchController.isActive()) {
        // Batched: share() ensures single source subscription so distinctUntilChanged
        // can deduplicate by reference when both debounce and audit emit close together
        const shared$ = source$.pipe(share())
        currentSub = merge(
          shared$.pipe(debounceTime(debounceMs)),
          shared$.pipe(auditTime(maxWaitMs))
        )
          .pipe(distinctUntilChanged())
          .subscribe({
            next: (value) => subscriber.next(value),
            error: (err) => subscriber.error(err),
          })
      } else {
        // Passthrough: immediate emissions
        currentSub = source$.subscribe({
          next: (value) => subscriber.next(value),
          error: (err) => subscriber.error(err),
        })
      }
    }

    setupStream()
    const unsubMode = batchController.subscribe(setupStream)

    return () => {
      currentSub?.unsubscribe()
      unsubMode()
    }
  })
}

/**
 * Create a reactive query observable
 *
 * Story 1.18: Now wraps with createBatchedObservable for batch-aware updates.
 *
 * @param collectionName - Name of the collection
 * @param query - RxDB query object
 * @returns Observable that emits when data changes (batched during bulk ops)
 */
export function createReactiveQuery<T = unknown>(
  collectionName: string,
  query: MangoQuery<T> = {}
): Observable<RxDocument<T>[]> {
  const db = getDatabase()
  const collection = (db as any)[collectionName] as RxCollection<T>

  if (!collection) {
    throw new Error(`Collection "${collectionName}" does not exist`)
  }

  return createBatchedObservable(collection.find(query).$)
}

/**
 * Subscribe to a single document by ID
 *
 * Story 1.18: Now wraps with createBatchedObservable (lower debounce for single docs).
 *
 * @param collectionName - Name of the collection
 * @param id - Document ID
 * @returns Observable that emits when document changes
 */
export function watchDocument<T = unknown>(
  collectionName: string,
  id: string
): Observable<RxDocument<T> | null> {
  const db = getDatabase()
  const collection = (db as any)[collectionName] as RxCollection<T>

  if (!collection) {
    throw new Error(`Collection "${collectionName}" does not exist`)
  }

  return createBatchedObservable(collection.findOne(id).$, { debounceMs: 50 })
}

/**
 * Subscribe to all documents in a collection
 * @param collectionName - Name of the collection
 * @returns Observable that emits on any collection change
 */
export function watchCollection<T = unknown>(collectionName: string): Observable<RxDocument<T>[]> {
  return createReactiveQuery<T>(collectionName, {})
}
