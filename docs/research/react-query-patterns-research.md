# React Query Advanced Patterns for Email Synchronization

**Research Document for Claine v2**
**Date:** 2025-10-28
**Target:** React 19 SPA with TypeScript, Gmail API, IMAP, RxDB
**Focus:** Email synchronization, infinite lists, offline support, cache management

---

## Executive Summary

This document outlines advanced React Query (TanStack Query v5) patterns specifically tailored for email synchronization in Claine v2. Email clients present unique challenges: large datasets, real-time updates, offline mutations, and complex threading. React Query v5 provides powerful primitives for handling these scenarios through infinite queries, optimistic updates, intelligent caching, and offline persistence.

### Key Patterns for Email Synchronization

1. **Infinite Email Lists**: Use `useInfiniteQuery` with cursor-based pagination (Gmail's `pageToken`) for seamless email loading
2. **Optimistic Updates**: Apply mutations locally with rollback on failure for instant UI feedback
3. **Smart Cache Management**: Leverage stale-while-revalidate, targeted invalidation, and prefetching
4. **Offline Queue**: Persist mutations with automatic synchronization when connectivity restores
5. **Server/Client State Separation**: Use React Query for server state (emails) and RxDB for client state (local preferences, drafts)
6. **Performance Optimization**: Disable structural sharing for large email datasets, debounce search queries

### Critical Considerations

- **React Query + RxDB**: Use RxDB for local-first storage and React Query for server synchronization (separate concerns)
- **Gmail API vs IMAP**: Gmail API provides superior threading support and higher-level abstractions
- **Conflict Resolution**: Implement last-write-wins or manual resolution strategies for offline sync
- **Memory Management**: Disable structural sharing for email lists exceeding several megabytes

---

## 1. React Query v5 Features for Email Clients

### 1.1 What's New in v5

React Query evolved into **TanStack Query v5** with significant improvements relevant to email applications:

#### Suspense Support (Stable)
```typescript
import { useSuspenseQuery, useSuspenseInfiniteQuery } from '@tanstack/react-query'

// Full suspense support for email loading
function EmailList() {
  const { data } = useSuspenseInfiniteQuery({
    queryKey: ['emails', 'inbox'],
    queryFn: fetchEmails,
    getNextPageParam: (lastPage) => lastPage.nextPageToken,
    initialPageParam: null,
  })

  return <EmailListView emails={data.pages.flatMap(p => p.messages)} />
}
```

#### API Improvements
- **State Naming**: `isLoading` → `isPending` (more accurate lifecycle representation)
- **Cache Timing**: `cacheTime` → `gcTime` (garbage collection time)
- **Better TypeScript**: Enhanced type inference and safety
- **Consistent API**: More predictable behavior across query types

#### Key Features for Email Apps
- **Automatic Deduplication**: Multiple components requesting same email thread share one request
- **Stale-While-Revalidate**: Show cached emails instantly while fetching updates in background
- **Offline Support**: Queue mutations when offline, sync when online
- **Query Cancellation**: Abort in-flight requests when user navigates away

### 1.2 Query vs Mutation Patterns

#### Queries: Read Operations
Use queries for fetching emails, threads, labels, and search results:

```typescript
// Email list query
const emailsQuery = useQuery({
  queryKey: ['emails', folderId, filters],
  queryFn: () => fetchEmails(folderId, filters),
  staleTime: 30000, // Consider fresh for 30s
  gcTime: 5 * 60 * 1000, // Keep in cache for 5min
})

// Email detail query
const emailQuery = useQuery({
  queryKey: ['email', emailId],
  queryFn: () => fetchEmailDetail(emailId),
  staleTime: Infinity, // Email content doesn't change
})

// Thread query with dependent queries
const threadQuery = useQuery({
  queryKey: ['thread', threadId],
  queryFn: () => fetchThread(threadId),
  select: (data) => ({
    ...data,
    messages: data.messages.sort((a, b) => a.internalDate - b.internalDate)
  }),
})
```

#### Mutations: Write Operations
Use mutations for email actions (archive, delete, star, send, etc.):

```typescript
const archiveMutation = useMutation({
  mutationFn: (emailId: string) => archiveEmail(emailId),
  onMutate: async (emailId) => {
    // Optimistic update (see section 3)
    await queryClient.cancelQueries({ queryKey: ['emails'] })
    const previousEmails = queryClient.getQueryData(['emails'])

    queryClient.setQueryData(['emails'], (old: any) => ({
      ...old,
      pages: old.pages.map(page => ({
        ...page,
        messages: page.messages.filter(m => m.id !== emailId)
      }))
    }))

    return { previousEmails }
  },
  onError: (err, emailId, context) => {
    // Rollback on failure
    queryClient.setQueryData(['emails'], context?.previousEmails)
  },
  onSettled: () => {
    // Always refetch to ensure consistency
    queryClient.invalidateQueries({ queryKey: ['emails'] })
  },
})
```

### 1.3 Server State vs Client State Separation

**Critical Architecture Decision**: React Query and RxDB serve different purposes.

#### React Query: Server State
Use React Query for data that originates from the server:
- Email messages and threads
- Labels and folders
- Search results
- User profile and settings (server-stored)

#### RxDB: Client State
Use RxDB for local-first data:
- Draft emails (not yet sent)
- Local preferences (UI state, collapsed threads)
- Cached attachments
- Offline mutation queue metadata

#### Integration Pattern
```typescript
// React Query for server emails
const { data: serverEmails } = useQuery({
  queryKey: ['emails', 'inbox'],
  queryFn: fetchGmailEmails,
})

// RxDB for local drafts
const [localDrafts, setLocalDrafts] = useState<Draft[]>([])

useEffect(() => {
  const subscription = rxDatabase.drafts
    .find()
    .sort({ updatedAt: -1 })
    .$.subscribe(drafts => setLocalDrafts(drafts))

  return () => subscription.unsubscribe()
}, [])

// Merge for display
const combinedEmails = useMemo(() => {
  return [...serverEmails, ...localDrafts.map(draftToEmail)]
}, [serverEmails, localDrafts])
```

**Recommendation for Claine v2**: Use React Query as the primary data fetching layer with RxDB as a supplementary local storage for drafts and offline metadata. Avoid duplicating server state in RxDB to prevent sync complexity.

---

## 2. Infinite Query Patterns for Email Lists

### 2.1 useInfiniteQuery Fundamentals

Email lists are perfect candidates for infinite queries due to their unbounded nature and pagination requirements.

#### Basic Implementation
```typescript
import { useInfiniteQuery } from '@tanstack/react-query'

interface EmailPage {
  messages: Email[]
  nextPageToken?: string
  resultSizeEstimate: number
}

function useEmailList(labelId: string, filters?: EmailFilters) {
  return useInfiniteQuery({
    queryKey: ['emails', labelId, filters],
    queryFn: ({ pageParam }) => fetchEmailPage(labelId, pageParam, filters),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextPageToken ?? undefined,
    staleTime: 30000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    select: (data) => ({
      pages: data.pages,
      allEmails: data.pages.flatMap(page => page.messages),
      totalEstimate: data.pages[0]?.resultSizeEstimate ?? 0,
    }),
  })
}

// Usage in component
function EmailListView() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPending,
    error,
  } = useEmailList('INBOX')

  return (
    <div>
      {isPending ? (
        <Spinner />
      ) : error ? (
        <Error message={error.message} />
      ) : (
        <>
          <VirtualList emails={data.allEmails} />
          {hasNextPage && (
            <LoadMoreButton
              onClick={() => fetchNextPage()}
              loading={isFetchingNextPage}
            />
          )}
        </>
      )}
    </div>
  )
}
```

### 2.2 Gmail API Pagination Strategy

Gmail API uses **cursor-based pagination** with `pageToken`:

#### Fetching with pageToken
```typescript
async function fetchEmailPage(
  labelId: string,
  pageToken: string | null,
  filters?: EmailFilters
): Promise<EmailPage> {
  const params = new URLSearchParams({
    labelIds: labelId,
    maxResults: '50', // Optimal batch size
    ...(pageToken && { pageToken }),
    ...(filters?.q && { q: filters.q }), // Search query
  })

  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  )

  const data = await response.json()

  // Fetch full message details in parallel
  const messages = await Promise.all(
    data.messages.map(async (msg) => {
      const detail = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      return detail.json()
    })
  )

  return {
    messages,
    nextPageToken: data.nextPageToken,
    resultSizeEstimate: data.resultSizeEstimate,
  }
}
```

**Optimization Tip**: Use `format=metadata` or `format=minimal` in list calls to reduce payload size, then fetch full details on-demand.

### 2.3 Scroll Position Restoration

React Query caches infinite query results, enabling automatic scroll restoration when navigating back to a list.

#### Automatic Restoration (Out of the Box)
```typescript
// Works automatically if:
// 1. gcTime is sufficient (default 5min)
// 2. Query hasn't been garbage collected
// 3. Same queryKey is used

function EmailList() {
  const { data } = useInfiniteQuery({
    queryKey: ['emails', 'inbox'],
    // ...
    gcTime: 10 * 60 * 1000, // 10min for better back-navigation
  })

  // Browser automatically restores scroll position
  return <VirtualList emails={data.allEmails} />
}
```

#### Manual Scroll Restoration with Virtual Lists
For complex virtual lists (e.g., with TanStack Virtual), you need manual tracking:

```typescript
import { useVirtualizer } from '@tanstack/react-virtual'
import { useRef, useEffect } from 'react'

function VirtualEmailList({ emails }: { emails: Email[] }) {
  const parentRef = useRef<HTMLDivElement>(null)
  const scrollPosition = useRef(0)

  // Save scroll position before unmounting
  useEffect(() => {
    const parent = parentRef.current
    if (!parent) return

    const saveScroll = () => {
      scrollPosition.current = parent.scrollTop
    }

    return () => saveScroll()
  }, [])

  const virtualizer = useVirtualizer({
    count: emails.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60, // Estimated row height
    overscan: 10,
  })

  // Restore scroll position after mounting
  useEffect(() => {
    if (parentRef.current && scrollPosition.current > 0) {
      parentRef.current.scrollTop = scrollPosition.current
    }
  }, [emails.length])

  return (
    <div ref={parentRef} style={{ height: '100vh', overflow: 'auto' }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <EmailRow
            key={emails[virtualRow.index].id}
            email={emails[virtualRow.index]}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          />
        ))}
      </div>
    </div>
  )
}
```

### 2.4 Jump-to-Date Functionality

Implementing "jump to date" requires custom pagination logic, as Gmail API doesn't natively support date-based cursors.

#### Strategy 1: Search-Based Approach
```typescript
function useJumpToDate(labelId: string) {
  const queryClient = useQueryClient()

  return async (targetDate: Date) => {
    // Use Gmail search query for date range
    const dateStr = format(targetDate, 'yyyy/MM/dd')
    const query = `after:${dateStr} before:${addDays(targetDate, 1).toISOString().split('T')[0]}`

    // Create new query with date filter
    await queryClient.prefetchInfiniteQuery({
      queryKey: ['emails', labelId, { jumpToDate: dateStr }],
      queryFn: ({ pageParam }) =>
        fetchEmailPage(labelId, pageParam, { q: query }),
      initialPageParam: null,
      pages: 1,
    })

    // Update current query key to include date filter
    // This effectively "jumps" to the date
  }
}
```

#### Strategy 2: Index-Based Search
```typescript
// Requires building a local index in RxDB
async function jumpToDateWithIndex(targetDate: Date) {
  // Query RxDB for approximate page token based on date
  const approximateToken = await rxDatabase.emailIndex
    .findOne({ date: { $lte: targetDate } })
    .sort({ date: -1 })
    .exec()

  if (approximateToken) {
    // Start infinite query from this token
    return useInfiniteQuery({
      queryKey: ['emails', 'inbox', { startToken: approximateToken.pageToken }],
      initialPageParam: approximateToken.pageToken,
      // ...
    })
  }
}
```

**Recommendation**: For Claine v2, use search-based approach initially. Build RxDB index over time as emails are fetched for more precise jumping.

### 2.5 Infinite Scroll with Intersection Observer

```typescript
import { useIntersection } from 'react-use'

function InfiniteEmailList() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: ['emails', 'inbox'],
      queryFn: fetchEmailPage,
      initialPageParam: null,
      getNextPageParam: (lastPage) => lastPage.nextPageToken,
    })

  const loadMoreRef = useRef<HTMLDivElement>(null)
  const intersection = useIntersection(loadMoreRef, {
    root: null,
    rootMargin: '200px', // Load before reaching bottom
    threshold: 0,
  })

  useEffect(() => {
    if (intersection?.isIntersecting && hasNextPage && !isFetchingNextPage) {
      fetchNextPage()
    }
  }, [intersection, hasNextPage, isFetchingNextPage, fetchNextPage])

  return (
    <div>
      {data?.pages.flatMap((page) =>
        page.messages.map((email) => (
          <EmailRow key={email.id} email={email} />
        ))
      )}
      {hasNextPage && <div ref={loadMoreRef}>Loading more...</div>}
    </div>
  )
}
```

---

## 3. Optimistic Updates for Email Actions

### 3.1 Optimistic Update Pattern

Optimistic updates provide instant UI feedback by updating the cache before the server responds.

#### Complete Archive Example
```typescript
interface ArchiveEmailVariables {
  emailId: string
  labelId: string
}

function useArchiveEmail() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ emailId }: ArchiveEmailVariables) => {
      const response = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${emailId}/modify`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            removeLabelIds: ['INBOX'],
            addLabelIds: [],
          }),
        }
      )

      if (!response.ok) {
        throw new Error('Failed to archive email')
      }

      return response.json()
    },

    onMutate: async ({ emailId, labelId }) => {
      // 1. Cancel outgoing refetches (prevent overwriting optimistic update)
      await queryClient.cancelQueries({ queryKey: ['emails', labelId] })

      // 2. Snapshot previous state for rollback
      const previousEmails = queryClient.getQueryData<{
        pages: EmailPage[]
      }>(['emails', labelId])

      // 3. Optimistically update cache
      queryClient.setQueryData<{ pages: EmailPage[] }>(
        ['emails', labelId],
        (old) => {
          if (!old) return old

          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              messages: page.messages.filter((msg) => msg.id !== emailId),
            })),
          }
        }
      )

      // 4. Return context for rollback
      return { previousEmails }
    },

    onError: (err, { emailId, labelId }, context) => {
      // Rollback to previous state
      if (context?.previousEmails) {
        queryClient.setQueryData(['emails', labelId], context.previousEmails)
      }

      // Show error toast
      toast.error('Failed to archive email')
    },

    onSettled: (data, error, { labelId }) => {
      // Always refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['emails', labelId] })
    },
  })
}

// Usage
function EmailRow({ email }: { email: Email }) {
  const archiveMutation = useArchiveEmail()

  return (
    <div>
      <EmailContent email={email} />
      <button
        onClick={() =>
          archiveMutation.mutate({ emailId: email.id, labelId: 'INBOX' })
        }
        disabled={archiveMutation.isPending}
      >
        Archive
      </button>
    </div>
  )
}
```

### 3.2 Batch Optimistic Updates

For bulk actions (e.g., archive multiple emails):

```typescript
function useBulkArchive() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (emailIds: string[]) => {
      // Gmail API batchModify endpoint
      const response = await fetch(
        'https://gmail.googleapis.com/gmail/v1/users/me/messages/batchModify',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ids: emailIds,
            removeLabelIds: ['INBOX'],
          }),
        }
      )

      if (!response.ok) {
        throw new Error('Bulk archive failed')
      }

      return response.json()
    },

    onMutate: async (emailIds) => {
      await queryClient.cancelQueries({ queryKey: ['emails'] })

      const previousData = queryClient.getQueryData(['emails', 'INBOX'])

      // Remove all archived emails from cache
      queryClient.setQueryData(['emails', 'INBOX'], (old: any) => ({
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          messages: page.messages.filter((msg) => !emailIds.includes(msg.id)),
        })),
      }))

      return { previousData }
    },

    onError: (err, emailIds, context) => {
      queryClient.setQueryData(['emails', 'INBOX'], context?.previousData)
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['emails'] })
    },
  })
}
```

### 3.3 Optimistic Star/Unstar Toggle

```typescript
function useToggleStar() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      emailId,
      isStarred,
    }: {
      emailId: string
      isStarred: boolean
    }) => {
      return fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${emailId}/modify`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            [isStarred ? 'removeLabelIds' : 'addLabelIds']: ['STARRED'],
          }),
        }
      )
    },

    onMutate: async ({ emailId, isStarred }) => {
      await queryClient.cancelQueries({ queryKey: ['emails'] })

      const previousData = queryClient.getQueryData(['emails'])

      // Toggle star in cache
      queryClient.setQueriesData({ queryKey: ['emails'] }, (old: any) => {
        if (!old) return old

        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            messages: page.messages.map((msg) =>
              msg.id === emailId
                ? {
                    ...msg,
                    labelIds: isStarred
                      ? msg.labelIds.filter((l) => l !== 'STARRED')
                      : [...msg.labelIds, 'STARRED'],
                  }
                : msg
            ),
          })),
        }
      })

      return { previousData }
    },

    onError: (err, variables, context) => {
      queryClient.setQueryData(['emails'], context?.previousData)
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['emails'] })
    },
  })
}
```

### 3.4 When NOT to Use Optimistic Updates

**Avoid optimistic updates for:**
- **Send email**: Failure is common (invalid recipients, network issues), rollback UX is poor
- **Delete permanently**: Irreversible actions should show confirmation
- **Complex multi-step operations**: Risk of partial failures and inconsistent state
- **Operations with unpredictable server-side effects**: Server might transform data unexpectedly

**Ideal use cases:**
- Toggle buttons (star, important, read/unread)
- Archive/move to folder
- Add/remove labels
- Any operation where failure is rare and rollback is straightforward

---

## 4. Cache Management Strategies

### 4.1 Cache Invalidation Patterns

React Query's `invalidateQueries` marks queries as stale and triggers refetch for active queries.

#### Targeted Invalidation
```typescript
function useSendEmail() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: sendEmail,
    onSuccess: () => {
      // Invalidate only sent folder
      queryClient.invalidateQueries({ queryKey: ['emails', 'SENT'] })

      // Invalidate drafts
      queryClient.invalidateQueries({ queryKey: ['drafts'] })

      // Don't invalidate inbox (not affected)
    },
  })
}
```

#### Prefix-Based Invalidation
```typescript
// Invalidate all email queries
queryClient.invalidateQueries({ queryKey: ['emails'] })

// Invalidate specific folder
queryClient.invalidateQueries({ queryKey: ['emails', 'INBOX'] })

// Invalidate with filters
queryClient.invalidateQueries({
  queryKey: ['emails'],
  predicate: (query) => {
    const [, labelId] = query.queryKey
    return labelId === 'INBOX' || labelId === 'UNREAD'
  },
})
```

#### Over-Invalidation vs Under-Invalidation
```typescript
// ❌ Over-invalidation: refetches everything unnecessarily
queryClient.invalidateQueries() // Invalidates ALL queries

// ✅ Targeted: only invalidates affected queries
queryClient.invalidateQueries({ queryKey: ['emails', affectedLabelId] })

// ❌ Under-invalidation: UI shows stale data
// Forgetting to invalidate related queries after mutation

// ✅ Comprehensive: invalidates all related queries
queryClient.invalidateQueries({ queryKey: ['emails', 'INBOX'] })
queryClient.invalidateQueries({ queryKey: ['unreadCount'] })
```

### 4.2 Prefetching Strategies

#### Hover Prefetch
```typescript
function EmailRow({ email }: { email: Email }) {
  const queryClient = useQueryClient()

  const prefetchEmailDetail = () => {
    queryClient.prefetchQuery({
      queryKey: ['email', email.id],
      queryFn: () => fetchEmailDetail(email.id),
      staleTime: 5 * 60 * 1000, // Cache for 5min
    })
  }

  return (
    <div onMouseEnter={prefetchEmailDetail}>
      <EmailPreview email={email} />
    </div>
  )
}
```

#### Predictive Prefetch
```typescript
function useEmailList(labelId: string) {
  const queryClient = useQueryClient()
  const { data } = useInfiniteQuery({
    queryKey: ['emails', labelId],
    queryFn: fetchEmailPage,
    // ...
  })

  // Prefetch next page when scrolling
  useEffect(() => {
    if (data?.pages.length) {
      const lastPage = data.pages[data.pages.length - 1]
      if (lastPage.nextPageToken) {
        queryClient.prefetchInfiniteQuery({
          queryKey: ['emails', labelId],
          queryFn: fetchEmailPage,
          initialPageParam: lastPage.nextPageToken,
          pages: 1, // Only prefetch next page
        })
      }
    }
  }, [data, queryClient, labelId])

  return data
}
```

#### Adjacent Email Prefetch
```typescript
function EmailDetail({ emailId }: { emailId: string }) {
  const queryClient = useQueryClient()
  const { data: emailList } = useQuery({ queryKey: ['emails', 'INBOX'] })

  useEffect(() => {
    if (!emailList) return

    // Find current email index
    const currentIndex = emailList.messages.findIndex((e) => e.id === emailId)
    if (currentIndex === -1) return

    // Prefetch previous and next emails
    const prevEmail = emailList.messages[currentIndex - 1]
    const nextEmail = emailList.messages[currentIndex + 1]

    if (prevEmail) {
      queryClient.prefetchQuery({
        queryKey: ['email', prevEmail.id],
        queryFn: () => fetchEmailDetail(prevEmail.id),
      })
    }

    if (nextEmail) {
      queryClient.prefetchQuery({
        queryKey: ['email', nextEmail.id],
        queryFn: () => fetchEmailDetail(nextEmail.id),
      })
    }
  }, [emailId, emailList, queryClient])

  return <EmailContent emailId={emailId} />
}
```

### 4.3 Cache Warming

Pre-populate cache on application startup:

```typescript
function useWarmCache() {
  const queryClient = useQueryClient()

  useEffect(() => {
    // Warm cache on mount
    const warmCache = async () => {
      // Prefetch inbox
      await queryClient.prefetchInfiniteQuery({
        queryKey: ['emails', 'INBOX'],
        queryFn: fetchEmailPage,
        initialPageParam: null,
        pages: 1,
      })

      // Prefetch unread count
      await queryClient.prefetchQuery({
        queryKey: ['unreadCount'],
        queryFn: fetchUnreadCount,
      })

      // Prefetch labels
      await queryClient.prefetchQuery({
        queryKey: ['labels'],
        queryFn: fetchLabels,
      })
    }

    warmCache()
  }, [queryClient])
}

// Use in root App component
function App() {
  useWarmCache()
  return <Router />
}
```

### 4.4 Stale-While-Revalidate Configuration

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000, // 30s: data is fresh
      gcTime: 5 * 60 * 1000, // 5min: keep in cache
      refetchOnWindowFocus: true, // Refetch on tab focus
      refetchOnMount: true, // Refetch on component mount
      refetchOnReconnect: true, // Refetch when online again
      retry: 3, // Retry failed requests 3 times
    },
  },
})

// Per-query customization
const { data } = useQuery({
  queryKey: ['email', emailId],
  queryFn: fetchEmailDetail,
  staleTime: Infinity, // Email content never stale
  gcTime: 30 * 60 * 1000, // 30min cache
})
```

**Stale-While-Revalidate Behavior:**
1. Query returns cached data immediately (even if stale)
2. Background refetch starts if data is stale
3. UI updates when fresh data arrives
4. Users see instant response with eventual consistency

### 4.5 Cache Size Limits

React Query doesn't enforce cache size limits, but you can implement manual cleanup:

```typescript
function useCacheSizeManagement() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const interval = setInterval(() => {
      const cache = queryClient.getQueryCache()
      const queries = cache.getAll()

      // Remove old inactive queries
      queries.forEach((query) => {
        const { queryKey, state } = query
        const isEmailQuery = queryKey[0] === 'emails'
        const isInactive = state.fetchStatus === 'idle'
        const isOld = Date.now() - state.dataUpdatedAt > 10 * 60 * 1000 // 10min

        if (isEmailQuery && isInactive && isOld) {
          queryClient.removeQueries({ queryKey })
        }
      })
    }, 60000) // Check every minute

    return () => clearInterval(interval)
  }, [queryClient])
}
```

**Alternative: Limit Pages in Infinite Queries**
```typescript
const { data } = useInfiniteQuery({
  queryKey: ['emails', 'INBOX'],
  queryFn: fetchEmailPage,
  // ...
  maxPages: 10, // Only keep 10 pages in memory
})
```

---

## 5. Offline Support Implementation

### 5.1 Offline Mutation Queue Setup

Install persistence packages:
```bash
npm install @tanstack/react-query-persist-client
npm install @tanstack/query-sync-storage-persister
```

#### Configure QueryClient for Offline
```typescript
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
    },
    mutations: {
      // Critical for offline support
      gcTime: Infinity, // Keep mutations in cache forever
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      networkMode: 'offlineFirst', // Queue when offline
    },
  },
})

const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'claine-query-cache',
  serialize: JSON.stringify,
  deserialize: JSON.parse,
})

function App() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 1000 * 60 * 60 * 24, // 24 hours
        buster: 'v1', // Increment to invalidate old cache
      }}
    >
      <AppRouter />
    </PersistQueryClientProvider>
  )
}
```

### 5.2 Network Status Management

React Query needs to know when network status changes:

```typescript
import { onlineManager } from '@tanstack/react-query'

function useNetworkStatus() {
  useEffect(() => {
    // Listen to online/offline events
    const handleOnline = () => onlineManager.setOnline(true)
    const handleOffline = () => onlineManager.setOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return onlineManager.isOnline()
}

// Usage
function StatusBar() {
  const isOnline = useNetworkStatus()

  return (
    <div className={isOnline ? 'online' : 'offline'}>
      {isOnline ? 'Connected' : 'Offline - Changes will sync when online'}
    </div>
  )
}
```

### 5.3 Offline Mutation Example

```typescript
function useArchiveEmailOffline() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ emailId }: { emailId: string }) => {
      // This will be called when online
      return archiveEmail(emailId)
    },

    // Specify mutation key for persistence
    mutationKey: ['archive', emailId],

    // Optimistic update works offline too
    onMutate: async ({ emailId }) => {
      await queryClient.cancelQueries({ queryKey: ['emails'] })

      const previousEmails = queryClient.getQueryData(['emails', 'INBOX'])

      queryClient.setQueryData(['emails', 'INBOX'], (old: any) => ({
        ...old,
        pages: old.pages.map((page) => ({
          ...page,
          messages: page.messages.filter((msg) => msg.id !== emailId),
        })),
      }))

      return { previousEmails }
    },

    onError: (err, variables, context) => {
      // Rollback only if not a network error
      if (err.message !== 'Network request failed') {
        queryClient.setQueryData(['emails', 'INBOX'], context?.previousEmails)
      }
    },

    onSuccess: () => {
      // Invalidate after successful sync
      queryClient.invalidateQueries({ queryKey: ['emails'] })
    },

    // Network mode determines behavior
    networkMode: 'offlineFirst', // Queue mutations when offline
  })
}
```

### 5.4 Mutation Queue Visibility

Show pending mutations to user:

```typescript
import { useMutationState } from '@tanstack/react-query'

function PendingMutationsIndicator() {
  const pendingMutations = useMutationState({
    filters: { status: 'pending' },
    select: (mutation) => ({
      mutationKey: mutation.state.mutationKey,
      variables: mutation.state.variables,
      submittedAt: mutation.state.submittedAt,
    }),
  })

  if (pendingMutations.length === 0) return null

  return (
    <div className="pending-mutations-banner">
      <InfoIcon />
      {pendingMutations.length} action(s) pending sync
      <button onClick={() => window.location.reload()}>
        Retry Now
      </button>
    </div>
  )
}
```

### 5.5 Background Sync API Integration

For PWAs, integrate with Background Sync API:

```typescript
function useBackgroundSync() {
  const queryClient = useQueryClient()

  useEffect(() => {
    if ('serviceWorker' in navigator && 'sync' in navigator.serviceWorker) {
      navigator.serviceWorker.ready.then((registration) => {
        // Register sync event
        registration.sync.register('sync-mutations')
      })

      // Listen for sync completion
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'SYNC_COMPLETE') {
          // Refetch after background sync
          queryClient.invalidateQueries({ queryKey: ['emails'] })
        }
      })
    }
  }, [queryClient])
}

// In service worker (service-worker.ts)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-mutations') {
    event.waitUntil(
      // Retry failed mutations
      fetch('/api/sync-mutations', {
        method: 'POST',
        body: JSON.stringify({
          mutations: getPendingMutations(),
        }),
      })
    )
  }
})
```

### 5.6 Conflict Resolution

Handle conflicts when offline changes conflict with server state:

```typescript
function useArchiveWithConflictResolution() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: archiveEmail,

    onError: async (error, variables, context) => {
      // Check if conflict error (409)
      if (error.status === 409) {
        // Fetch latest server state
        const latestData = await queryClient.fetchQuery({
          queryKey: ['email', variables.emailId],
        })

        // Show conflict resolution UI
        showConflictDialog({
          localVersion: context?.previousEmails,
          serverVersion: latestData,
          onResolve: (resolution) => {
            if (resolution === 'use-server') {
              queryClient.setQueryData(['email', variables.emailId], latestData)
            } else if (resolution === 'retry') {
              // Retry mutation
              archiveMutation.mutate(variables)
            }
          },
        })
      } else {
        // Other errors: rollback
        queryClient.setQueryData(['emails'], context?.previousEmails)
      }
    },
  })
}
```

**Conflict Resolution Strategies:**
1. **Last-Write-Wins**: Server version overwrites local changes (simple, data loss risk)
2. **Optimistic Concurrency Control**: Use version numbers/ETags, reject conflicts
3. **Manual Resolution**: Show dialog for user to choose which version to keep
4. **Merge Strategy**: Automatically merge non-conflicting changes (complex)

**Recommendation for Claine v2**: Use Last-Write-Wins for most operations with manual resolution for critical actions (send email, permanent delete).

---

## 6. Performance Optimization

### 6.1 Query Deduplication

React Query automatically deduplicates requests with the same query key:

```typescript
// Multiple components requesting same data
function EmailDetail() {
  const { data } = useQuery({
    queryKey: ['email', emailId],
    queryFn: fetchEmailDetail,
  })
  // ...
}

function EmailMetadata() {
  // Same query key = shared request
  const { data } = useQuery({
    queryKey: ['email', emailId],
    queryFn: fetchEmailDetail,
  })
  // ...
}

// Result: Only ONE network request, both components receive data
```

**Caveat**: Mutations are NOT deduplicated (side effects on server).

### 6.2 Structural Sharing

React Query preserves object references when data doesn't change:

```typescript
// First fetch
const data1 = { messages: [{ id: '1', subject: 'Test' }] }

// Second fetch (no changes)
const data2 = { messages: [{ id: '1', subject: 'Test' }] }

// With structural sharing: data1.messages[0] === data2.messages[0]
// Without: data1.messages[0] !== data2.messages[0]
```

#### Disable for Large Email Lists

For email lists with thousands of messages, structural sharing can become expensive:

```typescript
const { data } = useInfiniteQuery({
  queryKey: ['emails', 'INBOX'],
  queryFn: fetchEmailPage,
  structuralSharing: false, // Disable for performance
})
```

**When to disable:**
- Email lists with >1000 messages
- Frequent updates (real-time sync)
- Large payload sizes (>1MB per page)

**When to keep enabled:**
- Small datasets
- Infrequent updates
- Need stable object references for React.memo

### 6.3 Select Optimization

Use `select` to transform data and prevent unnecessary re-renders:

```typescript
// ❌ Bad: Component re-renders on ANY data change
function UnreadCount() {
  const { data } = useQuery({ queryKey: ['emails'], queryFn: fetchEmails })
  const unreadCount = data?.messages.filter((e) => e.unread).length
  return <div>{unreadCount}</div>
}

// ✅ Good: Component only re-renders when unread count changes
function UnreadCount() {
  const unreadCount = useQuery({
    queryKey: ['emails'],
    queryFn: fetchEmails,
    select: (data) => data.messages.filter((e) => e.unread).length,
  })
  return <div>{unreadCount}</div>
}
```

**Performance Tip**: `select` runs on every render, so memoize expensive selectors:

```typescript
const selectUnreadEmails = useCallback(
  (data: EmailList) => data.messages.filter((e) => e.unread),
  []
)

const { data: unreadEmails } = useQuery({
  queryKey: ['emails'],
  queryFn: fetchEmails,
  select: selectUnreadEmails,
})
```

### 6.4 React 19 Concurrent Rendering

React 19's concurrent rendering works seamlessly with React Query:

#### Suspense Integration
```typescript
import { useSuspenseQuery } from '@tanstack/react-query'
import { Suspense } from 'react'

function EmailListSuspense() {
  return (
    <Suspense fallback={<EmailListSkeleton />}>
      <EmailList />
    </Suspense>
  )
}

function EmailList() {
  // Suspends until data loads
  const { data } = useSuspenseQuery({
    queryKey: ['emails', 'INBOX'],
    queryFn: fetchEmails,
  })

  return <VirtualList emails={data.messages} />
}
```

#### useTransition for Non-Urgent Updates
```typescript
import { useTransition } from 'react'

function EmailSearch() {
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [isPending, startTransition] = useTransition()

  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchQuery(value)

    // Mark search query update as non-urgent
    startTransition(() => {
      setDebouncedQuery(value)
    })
  }

  const { data } = useQuery({
    queryKey: ['emails', 'search', debouncedQuery],
    queryFn: () => searchEmails(debouncedQuery),
    enabled: debouncedQuery.length > 0,
  })

  return (
    <div>
      <input
        value={searchQuery}
        onChange={handleSearchChange}
        placeholder="Search emails..."
      />
      {isPending && <Spinner />}
      {data && <SearchResults results={data.messages} />}
    </div>
  )
}
```

### 6.5 Memory Management

#### Limit Infinite Query Pages
```typescript
const { data, fetchNextPage } = useInfiniteQuery({
  queryKey: ['emails', 'INBOX'],
  queryFn: fetchEmailPage,
  maxPages: 10, // Only keep 10 pages in memory
  // User can still fetch more, but old pages are dropped
})
```

#### Manual Garbage Collection
```typescript
import { useQueryClient } from '@tanstack/react-query'

function useEmailMemoryManagement() {
  const queryClient = useQueryClient()

  useEffect(() => {
    // Clear old email queries on unmount
    return () => {
      queryClient.removeQueries({
        queryKey: ['emails'],
        predicate: (query) => {
          const lastFetched = query.state.dataUpdatedAt
          const isOld = Date.now() - lastFetched > 15 * 60 * 1000 // 15min
          return isOld
        },
      })
    }
  }, [queryClient])
}
```

### 6.6 notifyOnChangeProps Optimization

Fine-tune which state changes trigger re-renders:

```typescript
// Only re-render when data or error changes (not loading state)
const { data } = useQuery({
  queryKey: ['email', emailId],
  queryFn: fetchEmailDetail,
  notifyOnChangeProps: ['data', 'error'],
})

// Or use 'tracked' for automatic tracking
const { data, error } = useQuery({
  queryKey: ['email', emailId],
  queryFn: fetchEmailDetail,
  notifyOnChangeProps: 'tracked', // Only notifies for used properties
})
```

---

## 7. Real-World Email Patterns

### 7.1 Email Threading Queries

Gmail API provides built-in threading support:

```typescript
interface Thread {
  id: string
  snippet: string
  messages: Message[]
}

function useEmailThread(threadId: string) {
  return useQuery({
    queryKey: ['thread', threadId],
    queryFn: async (): Promise<Thread> => {
      const response = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=full`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      )
      const data = await response.json()

      return {
        id: data.id,
        snippet: data.snippet,
        messages: data.messages.sort(
          (a, b) => a.internalDate - b.internalDate
        ),
      }
    },
    staleTime: 5 * 60 * 1000, // Threads don't change often
  })
}

// Usage: Display thread with all messages
function ThreadView({ threadId }: { threadId: string }) {
  const { data: thread, isPending } = useEmailThread(threadId)

  if (isPending) return <Skeleton />

  return (
    <div className="thread">
      {thread.messages.map((message, index) => (
        <MessageCard
          key={message.id}
          message={message}
          isFirst={index === 0}
          isLast={index === thread.messages.length - 1}
        />
      ))}
    </div>
  )
}
```

#### IMAP Threading

IMAP requires X-GM-THRID extension:

```typescript
// IMAP doesn't have native thread support
// Need to use References/In-Reply-To headers to build threads manually

async function fetchIMAPThread(messageId: string): Promise<Thread> {
  // 1. Fetch message headers
  const message = await imapClient.fetchOne(messageId, {
    envelope: true,
    struct: true,
  })

  // 2. Extract thread references from headers
  const references = message.envelope.references || []
  const inReplyTo = message.envelope.inReplyTo

  // 3. Fetch all related messages
  const threadMessages = await Promise.all(
    [...references, inReplyTo].map((ref) =>
      imapClient.search({ header: ['Message-ID', ref] })
    )
  )

  // 4. Build thread structure
  return buildThreadTree(threadMessages)
}
```

**Recommendation**: Use Gmail API for threading. IMAP threading is complex and less reliable.

### 7.2 Email Search with Debouncing

```typescript
import { useDebounce } from 'use-debounce'

function useEmailSearch(query: string) {
  // Debounce search query
  const [debouncedQuery] = useDebounce(query, 300)

  return useQuery({
    queryKey: ['emails', 'search', debouncedQuery],
    queryFn: () => searchEmails(debouncedQuery),
    enabled: debouncedQuery.length >= 3, // Minimum 3 characters
    staleTime: 60000, // Cache search results for 1min
  })
}

async function searchEmails(query: string): Promise<EmailSearchResult> {
  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  )

  const data = await response.json()

  // Fetch message details in parallel
  const messages = await Promise.all(
    data.messages.map(async (msg) => {
      const detail = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      )
      return detail.json()
    })
  )

  return {
    messages,
    query,
    totalResults: data.resultSizeEstimate,
  }
}

// Usage
function EmailSearchBar() {
  const [query, setQuery] = useState('')
  const { data, isFetching } = useEmailSearch(query)

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search emails..."
      />
      {isFetching && <Spinner />}
      {data && <SearchResults results={data.messages} />}
    </div>
  )
}
```

### 7.3 Real-Time Email Sync

Use polling or webhooks for real-time updates:

#### Polling Strategy
```typescript
function useRealtimeEmails(labelId: string) {
  return useQuery({
    queryKey: ['emails', labelId],
    queryFn: () => fetchEmails(labelId),
    refetchInterval: 30000, // Poll every 30 seconds
    refetchIntervalInBackground: false, // Stop when tab inactive
  })
}
```

#### Gmail Push Notifications (Webhooks)
```typescript
// Set up watch request with Gmail API
async function setupGmailWatch(): Promise<void> {
  await fetch('https://gmail.googleapis.com/gmail/v1/users/me/watch', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      topicName: 'projects/my-project/topics/gmail',
      labelIds: ['INBOX'],
    }),
  })
}

// When webhook received, invalidate queries
function handleGmailWebhook(notification: GmailNotification) {
  const queryClient = useQueryClient()

  queryClient.invalidateQueries({
    queryKey: ['emails', notification.labelId],
  })
}
```

#### WebSocket Real-Time Sync
```typescript
function useWebSocketSync() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const ws = new WebSocket('wss://api.claine.app/sync')

    ws.onmessage = (event) => {
      const update = JSON.parse(event.data)

      switch (update.type) {
        case 'NEW_EMAIL':
          // Invalidate to refetch
          queryClient.invalidateQueries({ queryKey: ['emails', 'INBOX'] })
          break

        case 'EMAIL_UPDATED':
          // Update specific email in cache
          queryClient.setQueryData(['email', update.emailId], update.data)
          break

        case 'EMAIL_DELETED':
          // Remove from cache
          queryClient.removeQueries({ queryKey: ['email', update.emailId] })
          queryClient.invalidateQueries({ queryKey: ['emails'] })
          break
      }
    }

    return () => ws.close()
  }, [queryClient])
}
```

### 7.4 Email Attachments Handling

```typescript
interface Attachment {
  id: string
  filename: string
  mimeType: string
  size: number
  data?: string // Base64 encoded
}

function useAttachment(emailId: string, attachmentId: string) {
  return useQuery({
    queryKey: ['attachment', emailId, attachmentId],
    queryFn: async (): Promise<Attachment> => {
      const response = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${emailId}/attachments/${attachmentId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      )
      return response.json()
    },
    staleTime: Infinity, // Attachments never change
    gcTime: 30 * 60 * 1000, // Cache for 30min
    enabled: false, // Manual fetch on user click
  })
}

function AttachmentButton({ attachment, emailId }: AttachmentButtonProps) {
  const { data, refetch, isFetching } = useAttachment(emailId, attachment.id)

  const handleDownload = async () => {
    const result = await refetch()
    if (result.data?.data) {
      // Convert base64 to blob and download
      const blob = base64ToBlob(result.data.data, attachment.mimeType)
      downloadBlob(blob, attachment.filename)
    }
  }

  return (
    <button onClick={handleDownload} disabled={isFetching}>
      {isFetching ? 'Downloading...' : `Download ${attachment.filename}`}
    </button>
  )
}
```

### 7.5 Draft Auto-Save

```typescript
function useDraftAutoSave(draftId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (draftContent: DraftContent) => {
      // Save to RxDB (local) immediately
      await rxDatabase.drafts.upsert({
        id: draftId,
        ...draftContent,
        updatedAt: Date.now(),
      })

      // Then sync to server
      return saveDraftToServer(draftId, draftContent)
    },

    // Debounce auto-save
    mutationKey: ['draft', draftId, 'autosave'],

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drafts'] })
    },
  })
}

function DraftEditor({ draftId }: { draftId: string }) {
  const [content, setContent] = useState('')
  const autoSaveMutation = useDraftAutoSave(draftId)

  // Debounced auto-save
  const [debouncedContent] = useDebounce(content, 1000)

  useEffect(() => {
    if (debouncedContent) {
      autoSaveMutation.mutate({ body: debouncedContent })
    }
  }, [debouncedContent])

  return (
    <div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
      />
      {autoSaveMutation.isPending && <span>Saving...</span>}
      {autoSaveMutation.isSuccess && <span>Saved</span>}
    </div>
  )
}
```

---

## 8. Cache Strategy Decision Tree

```
┌─────────────────────────────────────────────────────────────┐
│ What type of email data are you fetching?                  │
└────────────────────┬────────────────────────────────────────┘
                     │
        ┌────────────┴────────────┐
        │                         │
    [Email List]           [Email Detail]
        │                         │
        │                         │
        ▼                         ▼
  useInfiniteQuery            useQuery
  staleTime: 30s              staleTime: Infinity
  gcTime: 5min                gcTime: 30min
        │                         │
        │                         │
        ▼                         ▼
  How many emails?          Prefetch on hover?
        │                         │
    <1000     >1000           Yes     No
        │         │             │       │
        │         ▼             ▼       ▼
        │   Disable          Add      Just
        │   structural    prefetch   fetch
        ▼   sharing           │        │
  Enable                      │        │
  structural                  └────┬───┘
  sharing                          │
        │                          │
        └──────────┬───────────────┘
                   │
                   ▼
           Offline support needed?
                   │
              Yes      No
                │        │
                ▼        ▼
          Configure    Standard
          persistence  setup
                │        │
                └────┬───┘
                     │
                     ▼
           Real-time updates?
                     │
              Yes         No
                │           │
                ▼           ▼
          WebSocket/    Polling
          Polling       disabled
```

### Decision Table

| Data Type | Query Type | staleTime | gcTime | Prefetch | Structural Sharing | Offline |
|-----------|------------|-----------|--------|----------|-------------------|---------|
| Email List (Inbox) | `useInfiniteQuery` | 30s | 5min | Next page | Disable if >1000 | Yes |
| Email Detail | `useQuery` | Infinity | 30min | On hover | Yes | No |
| Thread | `useQuery` | 5min | 30min | Adjacent | Yes | No |
| Search Results | `useQuery` | 1min | 5min | No | Disable | No |
| Labels | `useQuery` | 10min | Infinity | On mount | Yes | No |
| Drafts | RxDB + `useQuery` | N/A | N/A | No | N/A | Yes |
| Attachments | `useQuery` | Infinity | 30min | No | N/A | Optional |
| Unread Count | `useQuery` | 30s | 5min | Yes | N/A | No |

---

## 9. Error Handling Patterns

### 9.1 Error Boundary Integration

```typescript
import { ErrorBoundary } from 'react-error-boundary'
import { useQueryErrorResetBoundary } from '@tanstack/react-query'

function EmailApp() {
  const { reset } = useQueryErrorResetBoundary()

  return (
    <ErrorBoundary
      onReset={reset}
      fallbackRender={({ error, resetErrorBoundary }) => (
        <div>
          <h2>Something went wrong loading emails</h2>
          <pre>{error.message}</pre>
          <button onClick={resetErrorBoundary}>Try again</button>
        </div>
      )}
    >
      <EmailList />
    </ErrorBoundary>
  )
}
```

### 9.2 Retry Logic

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Don't retry on 404 (email not found)
        if (error.status === 404) return false

        // Don't retry on 401 (authentication error)
        if (error.status === 401) return false

        // Retry up to 3 times for network errors
        if (failureCount < 3) return true

        return false
      },
      retryDelay: (attemptIndex) =>
        Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
    },
  },
})
```

### 9.3 Error Toast Notifications

```typescript
function useEmailQuery(emailId: string) {
  return useQuery({
    queryKey: ['email', emailId],
    queryFn: () => fetchEmailDetail(emailId),
    meta: {
      errorMessage: 'Failed to load email',
    },
  })
}

// Global error handler
queryClient.getQueryCache().config = {
  onError: (error, query) => {
    const errorMessage = query.meta?.errorMessage ?? 'An error occurred'
    toast.error(`${errorMessage}: ${error.message}`)
  },
}

queryClient.getMutationCache().config = {
  onError: (error, variables, context, mutation) => {
    const errorMessage = mutation.meta?.errorMessage ?? 'Action failed'
    toast.error(`${errorMessage}: ${error.message}`)
  },
}
```

### 9.4 Network Error Recovery

```typescript
function useNetworkErrorRecovery() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const handleOnline = () => {
      // Refetch all stale queries when coming back online
      queryClient.refetchQueries({
        predicate: (query) => query.state.status === 'error',
      })
    }

    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [queryClient])
}
```

### 9.5 Authentication Error Handling

```typescript
function useAuthErrorInterceptor() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  useEffect(() => {
    // Intercept 401 errors globally
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (
        event.type === 'updated' &&
        event.query.state.error?.status === 401
      ) {
        // Clear all queries
        queryClient.clear()

        // Redirect to login
        navigate('/login')

        toast.error('Your session has expired. Please log in again.')
      }
    })

    return unsubscribe
  }, [queryClient, navigate])
}
```

---

## 10. Performance Optimization Checklist

### Pre-Launch Checklist

- [ ] **Infinite Queries**: Use `useInfiniteQuery` for all email lists
- [ ] **Structural Sharing**: Disable for lists >1000 emails
- [ ] **Prefetching**: Implement hover prefetch for email details
- [ ] **Cache Limits**: Set appropriate `gcTime` for each query type
- [ ] **Debouncing**: Debounce search queries (300ms minimum)
- [ ] **Select Optimization**: Use `select` for derived data (unread counts, filters)
- [ ] **Pagination**: Use cursor-based pagination with Gmail API `pageToken`
- [ ] **Error Handling**: Implement retry logic with exponential backoff
- [ ] **Offline Support**: Configure mutation persistence for critical actions
- [ ] **Memory Management**: Implement cache cleanup for inactive queries
- [ ] **Network Status**: Listen to online/offline events
- [ ] **Real-Time Sync**: Choose between polling (simple) or WebSocket (advanced)

### Monitoring Metrics

Track these metrics in production:

```typescript
import { useQueryClient } from '@tanstack/react-query'

function usePerformanceMonitoring() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const interval = setInterval(() => {
      const cache = queryClient.getQueryCache()
      const queries = cache.getAll()

      const metrics = {
        totalQueries: queries.length,
        activeQueries: queries.filter((q) => q.getObserversCount() > 0).length,
        staleCounts: queries.filter((q) => q.state.isInvalidated).length,
        errorCount: queries.filter((q) => q.state.status === 'error').length,
        cacheSize: JSON.stringify(cache).length / 1024, // KB
      }

      // Send to analytics
      analytics.track('react_query_metrics', metrics)
    }, 60000) // Every minute

    return () => clearInterval(interval)
  }, [queryClient])
}
```

**Key Metrics:**
- **Cache Size**: Should stay under 10MB for optimal performance
- **Active Queries**: Monitor for memory leaks (should decrease when unmounting)
- **Error Rate**: Track failed queries and mutations
- **Fetch Duration**: Measure time to fetch and render email lists
- **Offline Queue Size**: Number of pending mutations waiting for sync

---

## 11. Recommendations for Claine v2

### 11.1 Recommended Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Claine v2 Architecture                │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐         ┌──────────────┐             │
│  │   React 19   │────────▶│ React Query  │             │
│  │  Components  │         │   (Server)   │             │
│  └──────────────┘         └───────┬──────┘             │
│                                    │                     │
│                           ┌────────┴────────┐           │
│                           │                 │           │
│                      ┌────▼──────┐    ┌────▼──────┐    │
│                      │  Gmail    │    │   IMAP    │    │
│                      │   API     │    │   (Opt)   │    │
│                      └───────────┘    └───────────┘    │
│                                                          │
│  ┌──────────────┐                                       │
│  │    RxDB      │◀────── Local State Only              │
│  │  (Client)    │        (Drafts, Preferences)         │
│  └──────────────┘                                       │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 11.2 Implementation Priorities

#### Phase 1: Foundation (Week 1-2)
1. Set up React Query with persistence
2. Implement `useInfiniteQuery` for inbox
3. Basic Gmail API integration with pagination
4. Email detail view with caching
5. Network status management

#### Phase 2: Optimizations (Week 3-4)
1. Optimistic updates (archive, star, label)
2. Prefetching (hover, adjacent emails)
3. Search with debouncing
4. Scroll position restoration
5. Error handling and retry logic

#### Phase 3: Offline & Advanced (Week 5-6)
1. Offline mutation queue
2. Conflict resolution
3. Draft auto-save (RxDB)
4. Real-time sync (polling initially, WebSocket later)
5. Email threading
6. Performance monitoring

### 11.3 Configuration Template

```typescript
// src/lib/react-query-config.ts
import { QueryClient } from '@tanstack/react-query'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000, // 30 seconds
      gcTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      refetchOnReconnect: true,
      retry: 3,
      retryDelay: (attemptIndex) =>
        Math.min(1000 * 2 ** attemptIndex, 30000),
      networkMode: 'online', // Default
    },
    mutations: {
      gcTime: Infinity, // Keep mutations for offline support
      retry: 3,
      retryDelay: (attemptIndex) =>
        Math.min(1000 * 2 ** attemptIndex, 30000),
      networkMode: 'offlineFirst', // Queue when offline
    },
  },
})

export const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'claine-v2-cache',
  serialize: JSON.stringify,
  deserialize: JSON.parse,
})

// Global error handlers
queryClient.getQueryCache().config = {
  onError: (error, query) => {
    const errorMessage =
      query.meta?.errorMessage ?? 'Failed to load data'
    console.error(`${errorMessage}:`, error)
  },
}

queryClient.getMutationCache().config = {
  onError: (error, variables, context, mutation) => {
    const errorMessage = mutation.meta?.errorMessage ?? 'Action failed'
    console.error(`${errorMessage}:`, error)
  },
}
```

### 11.4 Gmail API vs IMAP Decision

**Recommendation: Start with Gmail API**

| Feature | Gmail API | IMAP |
|---------|-----------|------|
| **Threading** | Native support | Manual implementation (complex) |
| **Labels** | First-class support | Folder-based only |
| **Search** | Advanced query syntax | Basic SEARCH command |
| **Pagination** | `pageToken` (cursor-based) | UID ranges (offset-based) |
| **Rate Limits** | Generous (250 quota units/user/sec) | Connection limits |
| **Push Notifications** | Yes (webhooks) | IDLE command (one folder) |
| **Attachments** | Separate API calls | Inline with message |
| **Performance** | Optimized for modern apps | Legacy protocol |

**When to Add IMAP:**
- Phase 2+ after Gmail API is stable
- For supporting non-Gmail accounts
- If advanced folder synchronization needed

### 11.5 Key Takeaways

1. **Use React Query for Server State Only**: Don't duplicate email data in RxDB
2. **Infinite Queries are Essential**: Email lists require cursor-based pagination
3. **Disable Structural Sharing for Large Lists**: Performance bottleneck above 1000 emails
4. **Optimistic Updates for UX**: Archive, star, label should feel instant
5. **Offline Support is Critical**: Users expect email clients to work offline
6. **Gmail API Over IMAP**: Better threading, labels, and performance
7. **Prefetch Aggressively**: Hover prefetch makes navigation feel instant
8. **Monitor Cache Size**: Keep under 10MB for optimal performance
9. **Debounce Search**: Minimum 300ms to avoid excessive API calls
10. **Error Handling is Non-Negotiable**: Network failures are common in email apps

---

## 12. Implementation Roadmap

### Month 1: Core Functionality

**Week 1-2: Foundation**
- [ ] Set up React Query v5 with TypeScript
- [ ] Configure persistence with localStorage
- [ ] Implement Gmail API client with OAuth2
- [ ] Create `useInfiniteQuery` for inbox
- [ ] Basic email list rendering with virtualization

**Week 3-4: Email Operations**
- [ ] Email detail view with caching
- [ ] Optimistic updates (archive, star, read/unread)
- [ ] Label management
- [ ] Network status indicator
- [ ] Error boundaries and retry logic

### Month 2: Optimization & Offline

**Week 5-6: Performance**
- [ ] Prefetching (hover, adjacent, next page)
- [ ] Debounced search
- [ ] Scroll position restoration
- [ ] Disable structural sharing for large lists
- [ ] Performance monitoring dashboard

**Week 7-8: Offline Support**
- [ ] Offline mutation queue
- [ ] RxDB integration for drafts
- [ ] Conflict resolution UI
- [ ] Background Sync API (PWA)
- [ ] Draft auto-save

### Month 3: Advanced Features

**Week 9-10: Real-Time & Threading**
- [ ] Gmail push notifications (webhooks)
- [ ] Email threading display
- [ ] Jump-to-date functionality
- [ ] Attachment handling
- [ ] Bulk operations

**Week 11-12: Polish & Testing**
- [ ] E2E testing with Playwright
- [ ] Performance testing (Lighthouse)
- [ ] Offline scenario testing
- [ ] Error scenario testing
- [ ] Documentation

### Success Metrics

**Performance Targets:**
- Time to Interactive: <2s
- Email List Load: <500ms
- Email Detail Load: <300ms
- Search Response: <200ms (after debounce)
- Cache Size: <10MB
- Offline Queue: <100 pending mutations

**User Experience Goals:**
- Instant UI feedback (optimistic updates)
- Seamless offline/online transitions
- No scroll jumps or layout shifts
- Fast search (<1s perceived response)
- Reliable conflict resolution

---

## Appendix: Code Examples Repository

All code examples in this document are production-ready patterns suitable for Claine v2. Key files to create:

```
src/
├── lib/
│   ├── react-query-config.ts         # QueryClient setup
│   └── gmail-api-client.ts           # Gmail API wrapper
├── hooks/
│   ├── useEmailList.ts               # Infinite query for lists
│   ├── useEmailDetail.ts             # Single email query
│   ├── useArchiveEmail.ts            # Optimistic archive mutation
│   ├── useEmailSearch.ts             # Debounced search
│   ├── useNetworkStatus.ts           # Online/offline detection
│   └── useOfflineQueue.ts            # Pending mutations display
├── components/
│   ├── EmailList.tsx                 # Virtual list with infinite scroll
│   ├── EmailDetail.tsx               # Email detail view
│   ├── EmailSearch.tsx               # Search with debouncing
│   └── OfflineBanner.tsx             # Offline status indicator
└── types/
    └── gmail.ts                       # Gmail API TypeScript types
```

---

## References

1. [TanStack Query v5 Documentation](https://tanstack.com/query/latest)
2. [Gmail API Documentation](https://developers.google.com/gmail/api)
3. [React Query Render Optimizations - TkDodo](https://tkdodo.eu/blog/react-query-render-optimizations)
4. [Offline React Query - TkDodo](https://tkdodo.eu/blog/offline-react-query)
5. [React 19 Concurrent Rendering](https://react.dev/blog/2024/04/25/react-19)
6. [RxDB Documentation](https://rxdb.info/)

---

**Document Version:** 1.0
**Last Updated:** 2025-10-28
**Status:** Draft for Review

---

## Summary

This research document provides comprehensive patterns for implementing React Query v5 in Claine v2's email synchronization system. Key patterns include infinite queries with cursor-based pagination, optimistic updates with rollback, intelligent cache management with prefetching, and offline support with mutation queuing. The document emphasizes separating server state (React Query) from client state (RxDB), using Gmail API for superior threading and performance, and disabling structural sharing for large email lists. Implementation should follow a phased approach: foundation (weeks 1-2), optimizations (weeks 3-4), and offline/advanced features (weeks 5-6). Critical success metrics include sub-second load times, seamless offline transitions, and cache sizes under 10MB.
