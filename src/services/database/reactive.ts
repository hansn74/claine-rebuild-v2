import { getDatabase } from './init'
import type { RxCollection, RxDocument, MangoQuery } from 'rxdb'
import { Observable } from 'rxjs'

/**
 * Create a reactive query observable
 * @param collectionName - Name of the collection
 * @param query - RxDB query object
 * @returns Observable that emits when data changes
 */
export function createReactiveQuery<T = unknown>(
  collectionName: string,
  query: MangoQuery<T> = {}
): Observable<RxDocument<T>[]> {
  const db = getDatabase()
  const collection = db[collectionName] as RxCollection<T>

  if (!collection) {
    throw new Error(`Collection "${collectionName}" does not exist`)
  }

  // Create reactive query that emits on any change
  return collection.find(query).$
}

/**
 * Subscribe to a single document by ID
 * @param collectionName - Name of the collection
 * @param id - Document ID
 * @returns Observable that emits when document changes
 */
export function watchDocument<T = unknown>(
  collectionName: string,
  id: string
): Observable<RxDocument<T> | null> {
  const db = getDatabase()
  const collection = db[collectionName] as RxCollection<T>

  if (!collection) {
    throw new Error(`Collection "${collectionName}" does not exist`)
  }

  return collection.findOne(id).$
}

/**
 * Subscribe to all documents in a collection
 * @param collectionName - Name of the collection
 * @returns Observable that emits on any collection change
 */
export function watchCollection<T = unknown>(collectionName: string): Observable<RxDocument<T>[]> {
  return createReactiveQuery<T>(collectionName, {})
}
