import { getDatabase } from './init'
import type { RxCollection, RxDocument } from 'rxdb'

/**
 * Generic CRUD operations for RxDB collections
 * These methods provide a unified interface for database operations
 */

export interface CreateOptions {
  validate?: boolean
}

export interface ReadOptions {
  limit?: number
  skip?: number
  sort?: Record<string, 1 | -1>
}

export interface UpdateOptions {
  upsert?: boolean
  checkConflict?: boolean
}

export interface DeleteOptions {
  softDelete?: boolean
}

/**
 * Create a new document in a collection
 * @param collectionName - Name of the collection
 * @param data - Document data to insert
 * @param options - Creation options
 * @returns The created document
 */
export async function create<T>(
  collectionName: string,
  data: T,
  _options: CreateOptions = {}
): Promise<RxDocument<T>> {
  const db = getDatabase()
  const collection = db[collectionName] as RxCollection<T>

  if (!collection) {
    throw new Error(`Collection "${collectionName}" does not exist`)
  }

  try {
    // RxDB handles validation automatically based on schema
    const doc = await collection.insert(data)
    return doc
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('already exists')) {
        throw new Error(`Document with this ID already exists in "${collectionName}"`)
      }
      if (error.message.includes('schema')) {
        throw new Error(`Validation failed: ${error.message}`)
      }
    }
    throw error
  }
}

/**
 * Read documents from a collection
 * @param collectionName - Name of the collection
 * @param query - Query object (RxDB query format)
 * @param options - Read options (limit, skip, sort)
 * @returns Array of matching documents
 */
export async function read<T>(
  collectionName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any = {},
  options: ReadOptions = {}
): Promise<RxDocument<T>[]> {
  const db = getDatabase()
  const collection = db[collectionName] as RxCollection<T>

  if (!collection) {
    throw new Error(`Collection "${collectionName}" does not exist`)
  }

  try {
    let rxQuery = collection.find(query)

    // Apply options
    if (options.limit) {
      rxQuery = rxQuery.limit(options.limit)
    }
    if (options.skip) {
      rxQuery = rxQuery.skip(options.skip)
    }
    if (options.sort) {
      // Convert sort object to RxDB format
      for (const [field, direction] of Object.entries(options.sort)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rxQuery = rxQuery.sort({ [field]: direction === 1 ? 'asc' : 'desc' } as any)
      }
    }

    const docs = await rxQuery.exec()
    return docs
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Query failed: ${error.message}`)
    }
    throw error
  }
}

/**
 * Read a single document by ID
 * @param collectionName - Name of the collection
 * @param id - Document ID
 * @returns The document or null if not found
 */
export async function readOne<T>(
  collectionName: string,
  id: string
): Promise<RxDocument<T> | null> {
  const db = getDatabase()
  const collection = db[collectionName] as RxCollection<T>

  if (!collection) {
    throw new Error(`Collection "${collectionName}" does not exist`)
  }

  const doc = await collection.findOne(id).exec()
  return doc
}

/**
 * Update a document in a collection
 * @param collectionName - Name of the collection
 * @param id - Document ID
 * @param data - Partial data to update
 * @param options - Update options
 * @returns The updated document
 */
export async function update<T>(
  collectionName: string,
  id: string,
  data: Partial<T>,
  options: UpdateOptions = {}
): Promise<RxDocument<T>> {
  const db = getDatabase()
  const collection = db[collectionName] as RxCollection<T>

  if (!collection) {
    throw new Error(`Collection "${collectionName}" does not exist`)
  }

  try {
    const doc = await collection.findOne(id).exec()

    if (!doc) {
      if (options.upsert) {
        // Create new document if it doesn't exist
        return await create(collectionName, { ...data, id } as T)
      }
      throw new Error(`Document with ID "${id}" not found`)
    }

    // Check for conflicts if enabled
    if (options.checkConflict) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const currentRev = (doc as any)._rev
      await doc.update({ $set: data })
      const updatedDoc = await collection.findOne(id).exec()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (updatedDoc && (updatedDoc as any)._rev === currentRev) {
        throw new Error('Update conflict detected')
      }
      return updatedDoc!
    }

    // Standard update
    await doc.update({ $set: data })
    // Re-fetch to get updated document
    const updatedDoc = await collection.findOne(id).exec()
    return updatedDoc!
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('schema')) {
        throw new Error(`Validation failed: ${error.message}`)
      }
    }
    throw error
  }
}

/**
 * Delete a document from a collection
 * @param collectionName - Name of the collection
 * @param id - Document ID
 * @param options - Delete options
 * @returns True if deleted successfully
 */
export async function remove(
  collectionName: string,
  id: string,
  options: DeleteOptions = {}
): Promise<boolean> {
  const db = getDatabase()
  const collection = db[collectionName] as RxCollection

  if (!collection) {
    throw new Error(`Collection "${collectionName}" does not exist`)
  }

  try {
    const doc = await collection.findOne(id).exec()

    if (!doc) {
      return false
    }

    if (options.softDelete) {
      // Soft delete: set deletedAt timestamp instead of removing
      // Don't use _deleted as it's a special RxDB field that gets filtered
      await doc.update({
        $set: {
          deletedAt: new Date().toISOString(),
        },
      })
    } else {
      // Hard delete: remove from database
      await doc.remove()
    }

    return true
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Delete failed: ${error.message}`)
    }
    throw error
  }
}

/**
 * Count documents in a collection
 * @param collectionName - Name of the collection
 * @param query - Query object (optional)
 * @returns Number of matching documents
 */
export async function count(
  collectionName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any = {}
): Promise<number> {
  const db = getDatabase()
  const collection = db[collectionName] as RxCollection

  if (!collection) {
    throw new Error(`Collection "${collectionName}" does not exist`)
  }

  const result = await collection.count(query).exec()
  return result
}

/**
 * Bulk insert documents
 * @param collectionName - Name of the collection
 * @param documents - Array of documents to insert
 * @returns Array of created documents
 */
export async function bulkInsert<T>(
  collectionName: string,
  documents: T[]
): Promise<RxDocument<T>[]> {
  const db = getDatabase()
  const collection = db[collectionName] as RxCollection<T>

  if (!collection) {
    throw new Error(`Collection "${collectionName}" does not exist`)
  }

  try {
    const result = await collection.bulkInsert(documents)
    return result.success
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Bulk insert failed: ${error.message}`)
    }
    throw error
  }
}
