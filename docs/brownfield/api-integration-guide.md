# Gmail API Integration Guide - Claine v1

## Document Overview

This document provides a comprehensive guide to the Gmail API integration in Claine Email Client v1, including authentication flows, rate limiting strategies, error handling patterns, and best practices. Created as reference material for the v2 rebuild.

**Source Project**: `/Users/hansnieuwenhuis/vscode/claine-rebuild/`
**Generated**: 2025-10-27
**Version**: 1.0

---

## Table of Contents

1. [Complete API Endpoint Inventory](#1-complete-api-endpoint-inventory)
2. [Authentication Architecture](#2-authentication-architecture)
3. [Rate Limiting Strategy](#3-rate-limiting-strategy)
4. [Error Handling Patterns](#4-error-handling-patterns)
5. [Batch Request Implementation](#5-batch-request-implementation)
6. [Quota Management](#6-quota-management)
7. [Retry Strategies](#7-retry-strategies)
8. [Best Practices & Anti-Patterns](#8-best-practices--anti-patterns)
9. [Key Files Reference](#9-key-files-reference)
10. [Recommendations for V2](#10-recommendations-for-v2)

---

## 1. COMPLETE API ENDPOINT INVENTORY

### 1.1 Gmail API Endpoints Used

**Primary Service**: `GmailApiService.ts` (1,478 lines)

#### **User/Profile Operations**

| Endpoint | Method | Quota Cost | Purpose | File Location |
|----------|--------|------------|---------|---------------|
| `users.getProfile` | GET | 1 | Get user profile and historyId | GmailApiService.ts:1326-1351 |
| | | | Also: GisAuthService.ts:358-369 |

#### **Labels Operations**

| Endpoint | Method | Quota Cost | Purpose | File Location |
|----------|--------|------------|---------|---------------|
| `labels.list` | GET | 1 | List all labels | Lines 259-264, 447-451, 619-624, 683-688, 743-746 |
| `labels.get` | GET | 1 | Get single label with counts | Lines 516-576, 1159-1163 |
| `labels.create` | POST | 5 | Create new label | Lines 1356-1418 |

#### **Thread Operations**

| Endpoint | Method | Quota Cost | Purpose | File Location |
|----------|--------|------------|---------|---------------|
| `threads.list` | GET | 10 | List threads with pagination | Lines 1105-1148 |
| `threads.get` | GET | 10 | Get full thread with messages | Lines 725-764, 734-737 |
| `threads.modify` | POST | 10 | Add/remove labels | Lines 1204-1224 |
| `threads.trash` | POST | 10 | Move thread to trash | Lines 1262-1281 |
| `threads.delete` | DELETE | 20 | Permanently delete | Lines 1287-1306 |

#### **Message Operations**

| Endpoint | Method | Quota Cost | Purpose | File Location |
|----------|--------|------------|---------|---------------|
| `messages.attachments.get` | GET | 5 | Download attachment | Lines 1232-1257 |

#### **History API (Incremental Sync)**

| Endpoint | Method | Quota Cost | Purpose | File Location |
|----------|--------|------------|---------|---------------|
| `history.list` | GET | 2 | Get changes since historyId | Lines 1423-1474 |

#### **Batch Operations**

| Operation | Quota Cost | Purpose | File Location |
|-----------|------------|---------|---------------|
| Batch thread fetch | Sum of ops | Fetch up to 20 threads in single request | Lines 773-944 |
| Batch label fetch | Sum of ops | Fetch up to 20 labels in single request | Lines 953-1103 |

**Total Quota Available**: 1 billion units/day per project
**Typical Personal Use**: ~10,000-50,000 units/day

---

## 2. AUTHENTICATION ARCHITECTURE

### 2.1 OAuth 2.0 with Google Identity Services (GIS)

**Primary Service**: `GisAuthService.ts` (850 lines, Singleton)

#### **Initialization Flow**

**File**: GisAuthService.ts, Lines 98-347

```
1. Check Environment Variables
   ├─ VITE_GOOGLE_CLIENT_ID (required)
   └─ VITE_GOOGLE_API_KEY (required)

2. Validate Credentials
   └─ Check not placeholder values (Lines 121-126)

3. Load GAPI Client Library
   ├─ Load gapi-script (Lines 154-198)
   └─ Initialize gapi.client with Gmail discovery doc

4. Load Auth State from localStorage (Line 166)
   └─ Restore previous session if valid

5. Initialize OAuth 2.0 Token Client (Lines 201-303)
   ├─ Configure with client ID and scopes
   └─ Register callback handler

6. Post-Init Token Refresh (Lines 310-315)
   └─ Silent refresh if token expired
```

#### **OAuth Scopes Requested**

**File**: GisAuthService.ts, Lines 72-78

```typescript
private readonly SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.labels',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
]
```

**Permissions**:
- `gmail.readonly`: Read all Gmail data
- `gmail.modify`: Modify labels, archive, delete (no send)
- `gmail.labels`: Create and manage labels
- `userinfo.email`: Access user email address
- `userinfo.profile`: Access profile info (name, picture)

---

### 2.2 Token Lifecycle Management

#### **Token Storage Architecture**

| Storage | Contains | Security Risk | Location |
|---------|----------|---------------|----------|
| **Memory** | accessToken, userProfile | Lost on refresh | GisAuthService:42-55 |
| **localStorage** | Access token, refresh token, expiry, profile | **CRITICAL RISK** | Lines 57-62, 744-774 |
| **gapi.client** | Current access token | Lost on reload | Line 683 |

**localStorage Keys**:
```typescript
gmail_auth_signed_in              // boolean
gmail_auth_access_token           // ⚠️ Security issue
gmail_auth_access_token_expires_at // timestamp
gmail_auth_refresh_token          // ⚠️ CRITICAL security issue
gmail_auth_user_profile           // JSON string
```

#### **Token Refresh Flow**

**File**: GisAuthService.ts, Lines 496-568

```
Check Token Validity (with 5-minute buffer)
  ├─ If valid: Return current token
  └─ If invalid or expired:
      ├─ Check for active refresh promise (de-duplicate)
      ├─ Call tokenClient.requestAccessToken({prompt: 'none'})
      ├─ Wait for callback with new token
      ├─ Update gapi.client token
      └─ Save to localStorage
```

**Token Expiry Buffer**: 5 minutes before actual expiry (Line 65)

**Reason**: Prevents mid-request token expiration

#### **Sign-In Flow**

**File**: GisAuthService.ts, Lines 374-423

```
User clicks "Sign In"
  ↓
Initialize if needed
  ↓
Check if already authenticated
  ├─ If valid token exists: Skip signin
  └─ If not authenticated:
      ├─ Call tokenClient.requestAccessToken({prompt: ''})
      ├─ User sees Google account chooser
      ├─ User grants permissions
      ├─ Token callback receives access token + refresh token
      ├─ Store tokens (memory + localStorage)
      ├─ Fetch user profile
      ├─ Emit 'gmail-auth-changed' event
      └─ Start RxDB server replication
```

#### **Sign-Out Flow**

**File**: GisAuthService.ts, Lines 428-463

```
User clicks "Sign Out"
  ↓
Stop RxDB server replication
  ↓
Revoke token via Google API
  ├─ window.google.accounts.id.revoke(email)
  └─ Fire-and-forget (no error handling)
  ↓
Clear gapi.client token
  ↓
Clear localStorage
  ↓
Emit 'gmail-auth-changed' event
  ↓
Mark service as signed out
```

**Issue**: Revocation is fire-and-forget, no confirmation (Line 438-448)

---

### 2.3 GmailApiService Integration

**File**: GmailApiService.ts, Lines 59-78

**Before Every API Call**:
```typescript
private async ensureValidToken(): Promise<void> {
  const token = await this.authService.ensureValidToken()
  gapi.client.setToken({ access_token: token })
}
```

**Pattern**: All API methods call `ensureValidToken()` first

**Auto-Refresh**: If token expired, automatically refreshes before request

#### **Authentication Error Handling**

**File**: GmailApiService.ts, Lines 197-227

```typescript
private async handleAuthError(error: any): Promise<void> {
  // 401 = Authentication failed
  this.isInitialized = false

  // Verify auth service state
  const isSignedIn = await this.authService.isAuthenticated()

  if (isSignedIn) {
    // Token exists but invalid - sign out
    await this.authService.signOut()
    await new Promise(resolve => setTimeout(resolve, 300))
  }

  // Reinitialize (may trigger signin prompt)
  await this.authService.initialize()

  // Try to get refreshed token
  const token = await this.authService.getRefreshedAccessToken()

  if (token) {
    // Reinitialize Gmail service
    await this.initialize()
  }
}
```

**Triggered on**: 401 errors from Gmail API

---

## 3. RATE LIMITING STRATEGY

### 3.1 Architecture

**Service**: `GmailRateLimiter.ts` (583 lines, Singleton)

**Two-Level Limiting**:

```
Request Flow:
  ↓
1. Concurrency Limiter (Bottleneck)
   ├─ Max: 5 simultaneous requests
   ├─ Min Time: 50ms between request starts
   └─ Retry on 429 (rate limit)
   ↓
2. Quota Limiter (Bottleneck)
   ├─ Max: 1000 (effectively unlimited)
   ├─ Min Time: 1ms
   └─ Tracks quota usage via sliding window
   ↓
3. Sliding Window Quota Check
   ├─ Window: 60 seconds
   ├─ Limit: 15,000 quota units
   └─ Reserve quota atomically before execution
```

### 3.2 Quota Configuration

**File**: types.ts, Lines 42-94

**Cost Matrix**:

| Operation | Cost | Notes |
|-----------|------|-------|
| **High Cost** | | |
| threads.delete | 20 | Permanent deletion |
| messages.send | 100 | Sending email |
| messages.batchDelete | 50 | Batch deletion |
| **Medium Cost** | | |
| threads.get | 10 | Full thread data |
| threads.list | 10 | Thread listing |
| threads.modify | 10 | Label changes |
| threads.trash | 10 | Move to trash |
| labels.create | 5 | Create label |
| messages.attachments.get | 5 | Download file |
| **Low Cost** | | |
| labels.list | 1 | List labels |
| labels.get | 1 | Single label |
| users.getProfile | 1 | User info |
| history.list | 2 | Incremental sync |
| **Variable** | | |
| batch | Sum of ops | Calculated dynamically |

### 3.3 Sliding Window Implementation

**File**: GmailRateLimiter.ts, Lines 105-177

```typescript
// Quota history structure
private quotaHistory: Array<{
  timestamp: number
  cost: number
  method: string
}>

// Calculate current usage
calculateCurrentQuotaUsage(): number {
  const now = Date.now()
  const cutoff = now - this.QUOTA_WINDOW

  // Remove old entries
  this.quotaHistory = this.quotaHistory.filter(
    entry => entry.timestamp > cutoff
  )

  // Sum remaining costs
  return this.quotaHistory.reduce((sum, entry) => sum + entry.cost, 0)
}

// Check if can proceed
canProceed(cost: number): boolean {
  const currentUsage = this.calculateCurrentQuotaUsage()
  const available = this.QUOTA_LIMIT - currentUsage
  return cost <= available
}
```

**Window**: 60-second rolling period
**Limit**: 15,000 quota units per minute

---

### 3.4 Request Scheduling

**File**: GmailRateLimiter.ts, Lines 268-399

```typescript
async schedule<T>(
  methodName: string,
  operation: () => Promise<T>,
  priority: Priority = Priority.NORMAL,
  batchOperations?: string[]
): Promise<T> {
  // Calculate quota cost
  const quotaCost = this.calculateQuotaCost(methodName, batchOperations)

  // Acquire quota mutex (atomic check + reserve)
  const reservationId = await this.quotaMutex.schedule(async () => {
    // Wait until quota available
    while (!this.canProceed(quotaCost)) {
      const waitTime = this.getTimeUntilQuotaAvailable(quotaCost)
      await new Promise(resolve => setTimeout(resolve, waitTime + 100))
    }

    // Reserve quota immediately
    return this.reserveQuota(methodName, quotaCost)
  })

  try {
    // Schedule to concurrency limiter (5 concurrent max)
    const result = await this.concurrencyLimiter.schedule(
      { priority },
      async () => {
        // Schedule to quota limiter (minimal weight)
        return await this.quotaLimiter.schedule(
          { weight: 1 },
          async () => {
            try {
              // Execute operation
              const result = await operation()

              // Confirm reservation on success
              this.confirmReservation(reservationId, methodName, quotaCost)

              return result
            } catch (error) {
              if (this.isRateLimitError(error)) {
                // Release and retry with backoff
                this.releaseReservation(reservationId, methodName, quotaCost)
                await this.handleRateLimitError(error)
                return this.schedule(methodName, operation, Priority.HIGH, batchOperations)
              } else if (this.isQuotaError(error)) {
                // Release and retry after cooldown
                this.releaseReservation(reservationId, methodName, quotaCost)
                await new Promise(resolve => setTimeout(resolve, 10000))
                return this.schedule(methodName, operation, Priority.HIGH, batchOperations)
              } else {
                // Release and rethrow
                this.releaseReservation(reservationId, methodName, quotaCost)
                throw error
              }
            }
          }
        )
      }
    )

    return result
  } catch (error) {
    // Cleanup on outer error
    this.releaseReservation(reservationId, methodName, quotaCost)
    throw error
  }
}
```

**Priority Levels**:
- `Priority.LOW` = 1
- `Priority.NORMAL` = 5
- `Priority.HIGH` = 9

**Higher priority** = executed first when multiple requests queued

---

### 3.5 Quota Reservation System

**File**: GmailRateLimiter.ts, Lines 214-259

**Three Operations**:

1. **Reserve**: Create placeholder in history
```typescript
reserveQuota(method: string, cost: number): string {
  const reservationId = `reservation_${Date.now()}_${Math.random()}`

  this.quotaHistory.push({
    timestamp: Date.now(),
    cost,
    method: `RESERVED:${reservationId}`
  })

  return reservationId
}
```

2. **Confirm**: Convert reservation to actual usage
```typescript
confirmReservation(reservationId: string, method: string, cost: number): void {
  const entry = this.quotaHistory.find(
    e => e.method === `RESERVED:${reservationId}`
  )

  if (entry) {
    entry.method = method // Update to actual method name
  }
}
```

3. **Release**: Remove reservation on error
```typescript
releaseReservation(reservationId: string, method: string, cost: number): void {
  this.quotaHistory = this.quotaHistory.filter(
    e => e.method !== `RESERVED:${reservationId}`
  )
}
```

**Purpose**: Prevents double-counting quota in concurrent scenarios

---

## 4. ERROR HANDLING PATTERNS

### 4.1 Error Type Detection

**File**: GmailRateLimiter.ts, Lines 10-23

```typescript
interface GmailApiError {
  status: number
  result?: {
    error?: {
      code: number
      message: string
      errors?: Array<{
        message: string
        domain: string
        reason: string
      }>
    }
  }
}

// Error detection
isRateLimitError(error: any): error is GmailApiError {
  return error?.status === 429
}

isQuotaError(error: any): boolean {
  const message = error?.result?.error?.message || error?.message || ''
  return message.toLowerCase().includes('quota') ||
         message.toLowerCase().includes('rate limit') ||
         message.toLowerCase().includes('too many requests') ||
         message.toLowerCase().includes('user rate limit exceeded') ||
         message.toLowerCase().includes('resource exhausted')
}
```

### 4.2 HTTP Status Code Handling

| Status | Meaning | Handler | Recovery |
|--------|---------|---------|----------|
| **200** | Success | Parse response | Continue |
| **401** | Unauthorized | handleAuthError() | Sign out + reinit |
| **403** | Forbidden (quota) | Throw QUOTA_EXCEEDED | Caller handles |
| **429** | Rate limit | Exponential backoff | Automatic retry |
| **404** | Not found | Log warning | Return null |
| **500** | Server error | Log error | Return null or retry |

### 4.3 Per-Operation Error Handling

#### **Labels Operations**

**File**: GmailApiService.ts, Lines 300-306

```typescript
try {
  const response = await gapi.client.gmail.users.labels.list({
    userId: 'me'
  })
  return response.result.labels || []
} catch (error) {
  if (error.status === 401 || error.result?.error?.code === 401) {
    await this.handleAuthError(error)
  }
  return [] // Graceful degradation
}
```

**Pattern**: Return empty array on error, log but don't throw

#### **Thread Operations**

**File**: GmailApiService.ts, Lines 718-722

```typescript
try {
  const threads = await this.getThreadsInBatches(threadIds, priority)
  return threads
} catch (error) {
  if (error.status === 401) {
    await this.handleAuthError(error)
    throw error // Re-throw after handling
  }
  return [] // Graceful degradation
}
```

#### **Batch Operations**

**File**: GmailApiService.ts, Lines 842-878

```typescript
// Process batch response
for (const requestIdKey in batchResponse.result) {
  const individualResponse = batchResponse.result[requestIdKey]

  if (individualResponse.status === 200) {
    // Success - parse and add to results
    const thread = this.parseThread(individualResponse.result, labelCache)
    threadsResultMap.set(originalThreadId, thread)
  } else if (individualResponse.status === 429) {
    // Rate limit - mark for individual retry
    threadsResultMap.set(originalThreadId, null)
  } else {
    // Other error - log and mark null
    logger.warn(`Failed to fetch thread ${originalThreadId}`, {
      status: individualResponse.status
    })
    threadsResultMap.set(originalThreadId, null)
  }
}

// Retry failed items individually
const failedThreadIds = Array.from(threadsResultMap.entries())
  .filter(([id, thread]) => thread === null)
  .map(([id]) => id)

if (failedThreadIds.length > 10) {
  // Retry as batch
  return this.fetchMultipleThreadDetailsBatch(failedThreadIds, Priority.LOW)
} else {
  // Retry individually
  for (const threadId of failedThreadIds) {
    const thread = await this.getThread(threadId)
    threadsResultMap.set(threadId, thread)
  }
}
```

**Strategy**: Batch errors trigger individual retries

---

## 5. BATCH REQUEST IMPLEMENTATION

### 5.1 Native Gmail Batch API

**File**: GmailApiService.ts, Lines 773-944

**Limits**:
- **Batch size**: 20 requests per batch (GMAIL_API_BATCH_REQUEST_LIMIT)
- **Format**: Multipart MIME format
- **Cost**: Sum of individual operation costs

#### **Thread Batch Fetching**

```typescript
async fetchMultipleThreadDetailsBatch(
  threadIds: string[],
  priority: Priority = Priority.NORMAL
): Promise<Map<string, Thread | null>> {

  const threadsResultMap = new Map<string, Thread | null>()

  // Process in chunks of 20
  for (let i = 0; i < threadIds.length; i += this.GMAIL_API_BATCH_REQUEST_LIMIT) {
    const chunk = threadIds.slice(i, i + this.GMAIL_API_BATCH_REQUEST_LIMIT)

    // Create batch request
    const batch = gapi.client.newBatch()

    // Add each thread to batch
    for (const threadId of chunk) {
      batch.add(
        gapi.client.gmail.users.threads.get({
          userId: 'me',
          id: threadId,
          format: 'full'
        }),
        {
          id: `thread_request_${threadId}`,
          callback: () => {} // No-op, we'll process from batch.result
        }
      )
    }

    // Execute with retry loop (max 3 retries)
    let batchResponse: any = null
    let retryCount = 0

    while (retryCount < 3 && !batchResponse) {
      try {
        batchResponse = await this.rateLimiter.schedule(
          'batch',
          async () => await batch.then(),
          priority,
          chunk.map(() => 'threads.get') // For quota calculation
        )
        break // Success
      } catch (error) {
        if (error.status === 429) {
          retryCount++
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)))
        } else {
          throw error
        }
      }
    }

    // Process batch results
    for (const requestIdKey in batchResponse.result) {
      const originalThreadId = requestIdKey.replace('thread_request_', '')
      const individualResponse = batchResponse.result[requestIdKey]

      if (individualResponse.status === 200 && individualResponse.result) {
        const thread = this.parseThread(individualResponse.result, labelCache)
        threadsResultMap.set(originalThreadId, thread)
      } else {
        threadsResultMap.set(originalThreadId, null)
      }
    }
  }

  return threadsResultMap
}
```

**Benefits**:
- 20x reduction in HTTP overhead
- Single quota reservation
- Automatic retry on 429

---

### 5.2 Sequential Chunked Fetching

**File**: GmailApiService.ts, Lines 665-723

**Alternative Pattern**:

```typescript
async getThreadsInBatches(
  threadIds: string[],
  priority: Priority = Priority.NORMAL
): Promise<Thread[]> {

  const threads: Thread[] = []

  // Process in chunks of 30
  for (let i = 0; i < threadIds.length; i += this.BATCH_SIZE) {
    const chunk = threadIds.slice(i, i + this.BATCH_SIZE)

    // Concurrent requests within chunk
    const chunkThreads = await Promise.all(
      chunk.map(threadId =>
        this.rateLimiter.schedule(
          'threads.get',
          async () => {
            const response = await gapi.client.gmail.users.threads.get({
              userId: 'me',
              id: threadId,
              format: 'full'
            })
            return this.parseThread(response.result, labelCache)
          },
          priority
        ).catch(error => {
          logger.error('Error fetching thread', { threadId, error })
          return null
        })
      )
    )

    threads.push(...chunkThreads.filter(t => t !== null))
  }

  return threads
}
```

**Comparison**:

| Pattern | Batch Size | HTTP Requests | Error Handling | Use Case |
|---------|------------|---------------|----------------|----------|
| **Native Batch** | 20 | 1 per 20 threads | Batch retry + individual | High volume |
| **Sequential Chunked** | 30 | 30 per 30 threads | Individual catch | Flexibility |

---

## 6. QUOTA MANAGEMENT

### 6.1 Monitoring

**File**: GmailRateLimiter.ts, Lines 522-582

```typescript
getStats() {
  return {
    concurrency: {
      running: this.concurrencyLimiter.counts().EXECUTING,
      queued: this.concurrencyLimiter.counts().QUEUED
    },
    quota: {
      running: this.quotaLimiter.counts().EXECUTING,
      queued: this.quotaLimiter.counts().QUEUED
    },
    currentUsage: this.calculateCurrentQuotaUsage(),
    quotaLimit: this.QUOTA_LIMIT,
    quotaPercentage: (this.calculateCurrentQuotaUsage() / this.QUOTA_LIMIT) * 100,
    historySize: this.quotaHistory.length,
    oldestEntry: this.quotaHistory[0]?.timestamp
  }
}

getQuotaDetails() {
  const currentUsage = this.calculateCurrentQuotaUsage()
  return {
    currentUsage,
    available: this.QUOTA_LIMIT - currentUsage,
    percentage: (currentUsage / this.QUOTA_LIMIT) * 100,
    recentOperations: this.quotaHistory.slice(-10).map(entry => ({
      method: entry.method,
      cost: entry.cost,
      age: Date.now() - entry.timestamp
    })),
    historySize: this.quotaHistory.length
  }
}

isQuotaNearLimit(threshold: number = 0.8): boolean {
  const usage = this.calculateCurrentQuotaUsage()
  return usage >= (this.QUOTA_LIMIT * threshold)
}
```

**Alert Threshold**: 80% capacity (12,000 / 15,000 units)

---

### 6.2 Wait Time Calculation

**File**: GmailRateLimiter.ts, Lines 154-177

```typescript
getTimeUntilQuotaAvailable(requiredCost: number): number {
  const currentUsage = this.calculateCurrentQuotaUsage()
  const available = this.QUOTA_LIMIT - currentUsage

  // If sufficient quota, no wait needed
  if (available >= requiredCost) {
    return 0
  }

  // Calculate how much quota needs to free up
  const deficit = requiredCost - available

  // Sort history by timestamp (oldest first)
  const sorted = [...this.quotaHistory].sort((a, b) => a.timestamp - b.timestamp)

  // Find oldest entries that must expire
  let accumulated = 0
  let oldestRelevantTimestamp = Date.now()

  for (const entry of sorted) {
    accumulated += entry.cost
    if (accumulated >= deficit) {
      oldestRelevantTimestamp = entry.timestamp
      break
    }
  }

  // Calculate when oldest relevant entry expires
  const expiryTime = oldestRelevantTimestamp + this.QUOTA_WINDOW
  const waitTime = Math.max(0, expiryTime - Date.now())

  return waitTime
}
```

**Strategy**: Calculate minimum wait for quota to become available

---

## 7. RETRY STRATEGIES

### 7.1 Exponential Backoff

**File**: GmailRateLimiter.ts, Lines 436-489

```typescript
async handleRateLimitError(error: GmailApiError): Promise<void> {
  this.retryAttempts++

  // Calculate backoff with jitter
  const baseDelay = 1000 * Math.pow(2, this.retryAttempts) // 2s, 4s, 8s, 16s, 32s, 64s
  const jitter = Math.random() * 1000
  const delay = Math.min(baseDelay + jitter, 64000) // Cap at 64 seconds

  // Pause quota limiter
  this.quotaLimiter.updateSettings({ reservoir: 0 })

  // Wait
  await new Promise(resolve => setTimeout(resolve, delay))

  // Restore quota limiter
  this.quotaLimiter.updateSettings({ reservoir: 1000 })

  // Reset quota to conservative value
  const conservativeQuota = Math.floor(this.QUOTA_LIMIT * 0.66)
  this.quotaHistory = this.quotaHistory.filter(
    entry => entry.timestamp > Date.now() - this.QUOTA_WINDOW
  )

  // Circuit breaker: Force cooldown after 5+ retries
  if (this.retryAttempts > 5) {
    await new Promise(resolve => setTimeout(resolve, 30000)) // 30s cooldown
    this.retryAttempts = 0
  }
}
```

**Backoff Sequence**: ~2s → ~5s → ~11s → ~23s → ~47s → 64s (capped)

**Jitter**: 0-1000ms random delay to prevent thundering herd

---

### 7.2 Batch Failure Retry

**File**: GmailApiService.ts, Lines 882-927

```typescript
// Collect failed thread IDs
const failedThreadIds = Array.from(threadsResultMap.entries())
  .filter(([id, thread]) => thread === null)
  .map(([id]) => id)

if (failedThreadIds.length === 0) {
  return threadsResultMap
}

// Strategy based on failure count
if (failedThreadIds.length > 10) {
  // Many failures - retry as batch with LOW priority
  logger.info('Retrying failed threads as batch', {
    count: failedThreadIds.length
  })

  const retryResults = await this.fetchMultipleThreadDetailsBatch(
    failedThreadIds,
    Priority.LOW
  )

  // Merge retry results
  for (const [id, thread] of retryResults.entries()) {
    threadsResultMap.set(id, thread)
  }
} else {
  // Few failures - retry individually
  logger.info('Retrying failed threads individually', {
    count: failedThreadIds.length
  })

  for (const threadId of failedThreadIds) {
    try {
      const thread = await this.getThread(threadId)
      threadsResultMap.set(threadId, thread)
    } catch (error) {
      logger.error('Individual thread retry failed', { threadId, error })
      // Keep as null
    }
  }
}
```

**Strategy**:
- **> 10 failures**: Retry as batch
- **≤ 10 failures**: Retry individually

---

### 7.3 Authentication Error Recovery

**File**: GmailApiService.ts, Lines 197-227

```typescript
async handleAuthError(error: any): Promise<void> {
  this.isInitialized = false

  // Check current auth state
  const isSignedIn = await this.authService.isAuthenticated()

  if (isSignedIn) {
    // Token exists but invalid
    await this.authService.signOut()
    await new Promise(resolve => setTimeout(resolve, 300))
  }

  // Reinitialize auth (may prompt user)
  await this.authService.initialize()

  // Attempt token refresh
  try {
    const token = await this.authService.getRefreshedAccessToken()

    if (token) {
      // Reinitialize Gmail service
      await this.initialize()
    }
  } catch (refreshError) {
    logger.error('Failed to refresh token', refreshError)
    throw refreshError
  }
}
```

**Triggered on**: 401 Unauthorized errors

**Steps**: Sign out → Reinit → Refresh token → Reinit service

---

## 8. BEST PRACTICES & ANTI-PATTERNS

### 8.1 Best Practices ✅

#### **1. Singleton Pattern Throughout**
- `GmailApiService`, `GmailRateLimiter`, `GisAuthService`
- Single instance ensures consistent state

#### **2. Atomic Quota Reservation**
- Reserve → Execute → Confirm or Release
- Prevents race conditions in concurrent scenarios

#### **3. Progressive Loading**
```typescript
async getLabelsWithProgressiveLoading(
  onProgressUpdate?: (labels: Label[]) => void
): Promise<Label[]> {
  // Quick return with basic data
  const basicLabels = await this.getLabels()

  // Background: Fetch detailed counts
  this.fetchLabelDetails(basicLabels, onProgressUpdate)

  return basicLabels
}
```

#### **4. Batch Optimization**
- Reduces 20 HTTP requests to 1
- Single quota reservation
- Automatic retry fallback

#### **5. Comprehensive Logging**
```typescript
logger.info('Gmail API operation', {
  operation: 'threads.get',
  threadId,
  quotaUsage: this.rateLimiter.getStats().currentUsage,
  priority
})
```

#### **6. Token Lifecycle with Buffer**
- 5-minute expiry buffer
- Automatic refresh on demand
- De-duplicate refresh promises

#### **7. Error Differentiation**
- 429 (rate limit) → Automatic retry
- 403 (quota) → Caller handles
- 401 (auth) → Sign out + reinit

#### **8. Graceful Degradation**
```typescript
try {
  return await operation()
} catch (error) {
  logger.error('Operation failed', error)
  return [] // Return empty instead of crash
}
```

---

### 8.2 Anti-Patterns & Concerns ❌

#### **1. SECURITY: Tokens in localStorage**
**File**: GisAuthService.ts, Lines 744-774

```typescript
// ⚠️ CRITICAL SECURITY ISSUE
localStorage.setItem(this.STORAGE_KEY_ACCESS_TOKEN, this.accessToken)
localStorage.setItem(this.STORAGE_KEY_REFRESH_TOKEN, this.refreshToken)
```

**Issue**: localStorage vulnerable to XSS attacks
**Impact**: Token theft → Full Gmail access
**Solution**: Use httpOnly cookies or secure backend storage

#### **2. Hard-coded Magic Numbers**
```typescript
const BATCH_SIZE = 30                        // Line 40
const GMAIL_API_BATCH_REQUEST_LIMIT = 20     // Line 42
const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000 // Line 65
```

**Issue**: No configuration system
**Solution**: Environment variables or config file

#### **3. Missing Operation Idempotency**
- No request ID tracking
- Retries could cause duplicate effects
- No idempotency-key headers

**Impact**: Same operation executed multiple times

#### **4. Label Cache Never Invalidated**
```typescript
// ⚠️ Cache can become stale
private labelCache: Label[] | null = null

// Comment: "Don't clear cache during sync to avoid race conditions"
```

**Issue**: No TTL or refresh strategy
**Solution**: Implement cache expiry or change detection

#### **5. Memory Leak Risk**
```typescript
// quotaHistory never pruned, only old entries removed
private quotaHistory: Array<{...}>
```

**Issue**: Could grow unbounded over long sessions
**Solution**: Implement max size or periodic cleanup

#### **6. Fire-and-Forget Revocation**
```typescript
// ⚠️ No error handling
window.google.accounts.id.revoke(email, (done) => {
  // Callback ignored
})
```

**Issue**: Revocation may fail silently
**Solution**: Wait for confirmation, handle errors

#### **7. Inefficient Sliding Window**
```typescript
// O(n) filter on every calculation
calculateCurrentQuotaUsage() {
  this.quotaHistory = this.quotaHistory.filter(...)
  return this.quotaHistory.reduce(...)
}
```

**Issue**: Frequent O(n) operations
**Solution**: Maintain sorted index or use different structure

---

## 9. KEY FILES REFERENCE

### 9.1 Primary Files

| File | LOC | Purpose | Key Lines |
|------|-----|---------|-----------|
| **GmailApiService.ts** | 1,478 | Main API client | All operations |
| **GisAuthService.ts** | 850 | OAuth 2.0 auth | 1-850 |
| **GmailRateLimiter.ts** | 583 | Rate limiting | 1-583 |
| **ThreadParser.ts** | 432 | Response parsing | 1-432 |
| **types.ts** | 277 | Type definitions | 1-277 |

### 9.2 Critical Code Sections

#### **GmailApiService.ts**

| Feature | Lines | Description |
|---------|-------|-------------|
| Initialization | 80-191 | GAPI client loading |
| Auth Management | 59-78, 197-227 | Token validation, error recovery |
| Labels Operations | 234-576, 615-631 | List, get, create labels |
| Thread Operations | 578-764, 1105-1148 | List, get, modify threads |
| Batch Threading | 773-944 | Batch thread fetching |
| Batch Labels | 953-1103 | Batch label fetching |
| History API | 1326-1474 | Incremental sync |

#### **GisAuthService.ts**

| Feature | Lines | Description |
|---------|-------|-------------|
| Initialization | 98-347 | GAPI + GIS setup |
| Token Refresh | 496-568 | Silent token refresh |
| Sign-In | 374-423 | Interactive OAuth flow |
| Sign-Out | 428-463 | Token revocation |
| Token Validity | 468-490 | 5-minute buffer check |
| State Management | 672-801 | localStorage persistence |

#### **GmailRateLimiter.ts**

| Feature | Lines | Description |
|---------|-------|-------------|
| Quota Calculation | 105-177 | Sliding window, time until available |
| Quota Reservation | 214-259 | Reserve/confirm/release |
| Request Scheduling | 268-399 | Multi-limiter chaining |
| Rate Limit Error | 436-489 | Exponential backoff |
| Monitoring | 522-582 | Stats and quota details |

---

## 10. RECOMMENDATIONS FOR V2

### 10.1 Critical Fixes (P0)

#### **1. Remove Tokens from localStorage**

**Current**:
```typescript
localStorage.setItem('gmail_auth_access_token', accessToken)
localStorage.setItem('gmail_auth_refresh_token', refreshToken)
```

**V2 Solution**:
```typescript
// Backend-for-Frontend (BFF) pattern
// Access token: In-memory only
// Refresh token: httpOnly cookie

// Server endpoint
app.post('/auth/refresh', async (req, res) => {
  const refreshToken = req.cookies.refresh_token // httpOnly cookie
  const newAccessToken = await refreshGoogleToken(refreshToken)
  res.json({ accessToken: newAccessToken })
})

// Client
async function getAccessToken() {
  const response = await fetch('/auth/refresh', {
    credentials: 'include' // Send cookies
  })
  const { accessToken } = await response.json()
  return accessToken
}
```

#### **2. Implement OAuth 2.0 with PKCE**

**Current**: Implicit flow (deprecated)

**V2**: Authorization Code Flow with PKCE

```typescript
// Generate code verifier and challenge
const codeVerifier = generateCodeVerifier()
const codeChallenge = await generateCodeChallenge(codeVerifier)

// Authorization request
const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
  `client_id=${CLIENT_ID}&` +
  `redirect_uri=${REDIRECT_URI}&` +
  `response_type=code&` +
  `scope=${SCOPES}&` +
  `code_challenge=${codeChallenge}&` +
  `code_challenge_method=S256`

// Exchange code for tokens (server-side)
const tokens = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  body: JSON.stringify({
    code,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET, // Server-side only
    redirect_uri: REDIRECT_URI,
    grant_type: 'authorization_code',
    code_verifier: codeVerifier
  })
})
```

---

### 10.2 High Priority (P1)

#### **3. Add Request Idempotency**

```typescript
interface ApiRequest {
  idempotencyKey: string
  operation: string
  params: any
}

// Client generates unique key
const idempotencyKey = `${userId}_${operation}_${Date.now()}_${Math.random()}`

// Server tracks completed operations
const completedOperations = new Map<string, any>()

async function executeWithIdempotency(request: ApiRequest) {
  if (completedOperations.has(request.idempotencyKey)) {
    return completedOperations.get(request.idempotencyKey)
  }

  const result = await executeOperation(request)
  completedOperations.set(request.idempotencyKey, result)

  return result
}
```

#### **4. Implement Cache Invalidation**

```typescript
class LabelCache {
  private cache: Label[] | null = null
  private lastFetch: number = 0
  private readonly TTL = 5 * 60 * 1000 // 5 minutes

  async getLabels(): Promise<Label[]> {
    const now = Date.now()

    if (this.cache && (now - this.lastFetch) < this.TTL) {
      return this.cache
    }

    this.cache = await fetchLabelsFromAPI()
    this.lastFetch = now

    return this.cache
  }

  invalidate() {
    this.cache = null
  }
}
```

#### **5. Add Operation Timeout**

```typescript
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = 30000
): Promise<T> {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
  })

  return Promise.race([promise, timeout])
}

// Usage
const result = await withTimeout(
  this.rateLimiter.schedule('threads.get', operation),
  30000 // 30 second timeout
)
```

---

### 10.3 Medium Priority (P2)

#### **6. Optimize Sliding Window**

```typescript
class OptimizedQuotaTracker {
  private quotaBuckets: Map<number, number> // bucket timestamp → cost
  private readonly BUCKET_SIZE = 1000 // 1 second buckets

  addQuota(cost: number) {
    const bucket = Math.floor(Date.now() / this.BUCKET_SIZE)
    this.quotaBuckets.set(bucket, (this.quotaBuckets.get(bucket) || 0) + cost)
  }

  getCurrentUsage(): number {
    const now = Date.now()
    const cutoff = (now - 60000) / this.BUCKET_SIZE

    let total = 0
    for (const [bucket, cost] of this.quotaBuckets.entries()) {
      if (bucket >= cutoff) {
        total += cost
      } else {
        this.quotaBuckets.delete(bucket) // Cleanup old buckets
      }
    }

    return total
  }
}
```

#### **7. Add Metrics & Monitoring**

```typescript
interface ApiMetrics {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  averageLatency: number
  p95Latency: number
  quotaUsage: number
  rateLimitHits: number
}

class MetricsCollector {
  private metrics: ApiMetrics = {...}

  recordRequest(operation: string, duration: number, success: boolean) {
    this.metrics.totalRequests++
    if (success) this.metrics.successfulRequests++
    else this.metrics.failedRequests++

    this.updateLatency(duration)
  }

  export(): ApiMetrics {
    return { ...this.metrics }
  }
}
```

#### **8. Configuration System**

```typescript
// config.ts
export const config = {
  gmail: {
    batchSize: parseInt(process.env.GMAIL_BATCH_SIZE || '30'),
    batchRequestLimit: parseInt(process.env.GMAIL_BATCH_REQUEST_LIMIT || '20'),
    quotaLimit: parseInt(process.env.GMAIL_QUOTA_LIMIT || '15000'),
    quotaWindow: parseInt(process.env.GMAIL_QUOTA_WINDOW || '60000'),
    maxConcurrent: parseInt(process.env.GMAIL_MAX_CONCURRENT || '5'),
    tokenExpiryBuffer: parseInt(process.env.TOKEN_EXPIRY_BUFFER || '300000')
  },
  auth: {
    clientId: process.env.VITE_GOOGLE_CLIENT_ID!,
    apiKey: process.env.VITE_GOOGLE_API_KEY!
  }
}
```

---

## Conclusion

The Gmail API integration in Claine v1 demonstrates **solid engineering** with:

✅ **Strengths**:
- Sophisticated rate limiting with sliding window
- Comprehensive quota management
- Effective batch request optimization
- Good error handling patterns
- Automatic retry with exponential backoff

❌ **Critical Issues**:
- **Security**: Tokens in localStorage (XSS vulnerability)
- **Architecture**: Implicit OAuth flow (deprecated)
- Missing idempotency (duplicate operations risk)
- No request timeouts
- Label cache never invalidated

For v2, prioritize:
1. **Secure token storage** (httpOnly cookies)
2. **OAuth 2.0 with PKCE** (modern flow)
3. **Request idempotency** (prevent duplicates)
4. **Cache invalidation** (prevent stale data)
5. **Operation timeouts** (prevent hangs)

The foundation is strong - with targeted security and architecture improvements, v2 can have a **production-ready, secure Gmail API integration**.

---

**Document Version**: 1.0
**Generated**: 2025-10-27
**Total API Endpoints**: 12
**Total Code Analyzed**: 3,643 lines

---
