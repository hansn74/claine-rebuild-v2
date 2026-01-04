import { useState, useEffect, useMemo } from 'react'
import { createReactiveQuery, watchDocument } from '@/services/database/reactive'
import type { RxDocument, MangoQuery } from 'rxdb'

interface UseDatabaseResult<T> {
  data: T[]
  loading: boolean
  error: Error | null
  refetch: () => void
}

interface UseDocumentResult<T> {
  data: T | null
  loading: boolean
  error: Error | null
  refetch: () => void
}

/**
 * React hook for reactive database queries
 * Automatically updates component when database changes
 *
 * @param collectionName - Name of the RxDB collection
 * @param query - Optional RxDB query object
 * @returns Object with data, loading, error, and refetch
 *
 * @example
 * ```tsx
 * function EmailList() {
 *   const { data, loading, error } = useDatabase('emails', {
 *     selector: { read: false },
 *     sort: [{ timestamp: 'desc' }]
 *   })
 *
 *   if (loading) return <div>Loading...</div>
 *   if (error) return <div>Error: {error.message}</div>
 *
 *   return (
 *     <ul>
 *       {data.map(email => (
 *         <li key={email.id}>{email.subject}</li>
 *       ))}
 *     </ul>
 *   )
 * }
 * ```
 */
export function useDatabase<T = unknown>(
  collectionName: string,
  query: MangoQuery<T> = {}
): UseDatabaseResult<T> {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [refetchTrigger, setRefetchTrigger] = useState(0)

  // Memoize the stringified query to avoid unnecessary re-renders
  const queryString = useMemo(() => JSON.stringify(query), [query])

  useEffect(() => {
    let isSubscribed = true

    // Create reactive query observable
    const query$ = createReactiveQuery<T>(collectionName, query)

    // Subscribe to changes
    const subscription = query$.subscribe({
      next: (docs: RxDocument<T>[]) => {
        if (!isSubscribed) return
        // Convert RxDocuments to plain objects
        const plainData = docs.map((doc) => doc.toJSON() as T)
        setData(plainData)
        setLoading(false)
      },
      error: (err: Error) => {
        if (!isSubscribed) return
        setError(err)
        setLoading(false)
      },
    })

    // Cleanup subscription on unmount
    return () => {
      isSubscribed = false
      subscription.unsubscribe()
    }
  }, [collectionName, query, queryString, refetchTrigger])

  const refetch = () => {
    setRefetchTrigger((prev) => prev + 1)
  }

  return { data, loading, error, refetch }
}

/**
 * React hook for watching a single document by ID
 * Automatically updates component when document changes
 *
 * @param collectionName - Name of the RxDB collection
 * @param id - Document ID to watch
 * @returns Object with data, loading, error, and refetch
 *
 * @example
 * ```tsx
 * function EmailDetail({ emailId }: { emailId: string }) {
 *   const { data, loading, error } = useDocument('emails', emailId)
 *
 *   if (loading) return <div>Loading...</div>
 *   if (error) return <div>Error: {error.message}</div>
 *   if (!data) return <div>Email not found</div>
 *
 *   return <div>{data.subject}</div>
 * }
 * ```
 */
export function useDocument<T = unknown>(collectionName: string, id: string): UseDocumentResult<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [refetchTrigger, setRefetchTrigger] = useState(0)

  useEffect(() => {
    let isSubscribed = true

    // Watch single document
    const doc$ = watchDocument<T>(collectionName, id)

    // Subscribe to changes
    const subscription = doc$.subscribe({
      next: (doc: RxDocument<T> | null) => {
        if (!isSubscribed) return
        setData(doc ? (doc.toJSON() as T) : null)
        setLoading(false)
      },
      error: (err: Error) => {
        if (!isSubscribed) return
        setError(err)
        setLoading(false)
      },
    })

    // Cleanup subscription on unmount
    return () => {
      isSubscribed = false
      subscription.unsubscribe()
    }
  }, [collectionName, id, refetchTrigger])

  const refetch = () => {
    setRefetchTrigger((prev) => prev + 1)
  }

  return { data, loading, error, refetch }
}
