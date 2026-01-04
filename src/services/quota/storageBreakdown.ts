/**
 * Storage Breakdown Service
 * Calculates storage usage breakdown by account, age, and size
 *
 * AC 6: Cleanup wizard shows storage breakdown by account, age, and size
 * AC 8: Cleanup preview shows estimated space that will be freed before execution
 */

import type { AppDatabase } from '../database/types'

/**
 * Storage breakdown by account
 */
export interface AccountStorageBreakdown {
  accountId: string
  emailCount: number
  estimatedSize: number // Estimated size in bytes
}

/**
 * Storage breakdown by age bucket
 */
export interface AgeStorageBreakdown {
  bucket: '< 1 year' | '1-2 years' | '2-3 years' | '> 3 years'
  emailCount: number
  estimatedSize: number
  oldestTimestamp: number
  newestTimestamp: number
}

/**
 * Storage breakdown by email size
 */
export interface SizeStorageBreakdown {
  bucket: '< 1MB' | '1-5MB' | '5-10MB' | '> 10MB'
  emailCount: number
  totalSize: number
}

/**
 * Complete storage breakdown
 */
export interface StorageBreakdown {
  byAccount: AccountStorageBreakdown[]
  byAge: AgeStorageBreakdown[]
  bySize: SizeStorageBreakdown[]
  totalEmails: number
  totalEstimatedSize: number
}

/**
 * Cleanup criteria for estimating freed space
 */
export interface CleanupCriteria {
  accountIds?: string[] // Clean up specific accounts
  olderThanDays?: number // Clean up emails older than N days
  minSizeBytes?: number // Clean up emails larger than N bytes
}

/**
 * Cleanup estimation result
 */
export interface CleanupEstimate {
  emailCount: number
  estimatedFreedBytes: number
  affectedAccounts: string[]
}

// Average email size estimate when we don't have exact sizes stored
// Based on typical email sizes (10KB for plain text, 50KB with HTML, 100KB+ with attachments)
const AVERAGE_EMAIL_SIZE_BYTES = 50 * 1024 // 50KB average

// Size bucket thresholds in bytes
const SIZE_1MB = 1024 * 1024
const SIZE_5MB = 5 * 1024 * 1024
const SIZE_10MB = 10 * 1024 * 1024

// Age bucket thresholds in milliseconds
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000
const TWO_YEARS_MS = 2 * ONE_YEAR_MS
const THREE_YEARS_MS = 3 * ONE_YEAR_MS

/**
 * Get storage breakdown by account
 *
 * AC 6: Account storage breakdown for cleanup wizard
 *
 * @param db - RxDB database instance
 * @returns Array of account storage breakdowns
 */
export async function getStorageBreakdownByAccount(
  db: AppDatabase
): Promise<AccountStorageBreakdown[]> {
  if (!db.emails) {
    return []
  }

  // Get all emails grouped by accountId
  const emails = await db.emails.find().exec()

  // Group by accountId
  const accountMap = new Map<string, { count: number; estimatedSize: number }>()

  for (const email of emails) {
    const accountId = email.accountId
    const current = accountMap.get(accountId) || { count: 0, estimatedSize: 0 }

    // Estimate email size based on body length and attachments
    const bodySize = (email.body?.html?.length || 0) + (email.body?.text?.length || 0)
    const attachmentSize = email.attachments?.reduce((sum, att) => sum + (att.size || 0), 0) || 0
    const estimatedSize = Math.max(bodySize + attachmentSize, AVERAGE_EMAIL_SIZE_BYTES)

    accountMap.set(accountId, {
      count: current.count + 1,
      estimatedSize: current.estimatedSize + estimatedSize,
    })
  }

  const result: AccountStorageBreakdown[] = []
  for (const [accountId, data] of accountMap) {
    result.push({
      accountId,
      emailCount: data.count,
      estimatedSize: data.estimatedSize,
    })
  }

  // Sort by size descending
  return result.sort((a, b) => b.estimatedSize - a.estimatedSize)
}

/**
 * Get storage breakdown by age
 *
 * AC 6: Age-based storage breakdown for cleanup wizard
 *
 * @param db - RxDB database instance
 * @returns Array of age bucket breakdowns
 */
export async function getStorageBreakdownByAge(db: AppDatabase): Promise<AgeStorageBreakdown[]> {
  if (!db.emails) {
    return []
  }

  const emails = await db.emails.find().exec()
  const now = Date.now()

  // Initialize buckets
  const buckets: Record<string, { count: number; size: number; oldest: number; newest: number }> = {
    '< 1 year': { count: 0, size: 0, oldest: Infinity, newest: 0 },
    '1-2 years': { count: 0, size: 0, oldest: Infinity, newest: 0 },
    '2-3 years': { count: 0, size: 0, oldest: Infinity, newest: 0 },
    '> 3 years': { count: 0, size: 0, oldest: Infinity, newest: 0 },
  }

  for (const email of emails) {
    const age = now - email.timestamp
    let bucket: string

    if (age < ONE_YEAR_MS) {
      bucket = '< 1 year'
    } else if (age < TWO_YEARS_MS) {
      bucket = '1-2 years'
    } else if (age < THREE_YEARS_MS) {
      bucket = '2-3 years'
    } else {
      bucket = '> 3 years'
    }

    // Estimate email size
    const bodySize = (email.body?.html?.length || 0) + (email.body?.text?.length || 0)
    const attachmentSize = email.attachments?.reduce((sum, att) => sum + (att.size || 0), 0) || 0
    const estimatedSize = Math.max(bodySize + attachmentSize, AVERAGE_EMAIL_SIZE_BYTES)

    const bucketData = buckets[bucket]
    bucketData.count++
    bucketData.size += estimatedSize
    bucketData.oldest = Math.min(bucketData.oldest, email.timestamp)
    bucketData.newest = Math.max(bucketData.newest, email.timestamp)
  }

  const result: AgeStorageBreakdown[] = []
  const bucketOrder: Array<'< 1 year' | '1-2 years' | '2-3 years' | '> 3 years'> = [
    '< 1 year',
    '1-2 years',
    '2-3 years',
    '> 3 years',
  ]

  for (const bucket of bucketOrder) {
    const data = buckets[bucket]
    if (data.count > 0) {
      result.push({
        bucket,
        emailCount: data.count,
        estimatedSize: data.size,
        oldestTimestamp: data.oldest,
        newestTimestamp: data.newest,
      })
    }
  }

  return result
}

/**
 * Get storage breakdown by email size
 *
 * AC 6: Size-based storage breakdown for cleanup wizard
 *
 * @param db - RxDB database instance
 * @returns Array of size bucket breakdowns
 */
export async function getStorageBreakdownBySize(db: AppDatabase): Promise<SizeStorageBreakdown[]> {
  if (!db.emails) {
    return []
  }

  const emails = await db.emails.find().exec()

  // Initialize buckets
  const buckets: Record<string, { count: number; totalSize: number }> = {
    '< 1MB': { count: 0, totalSize: 0 },
    '1-5MB': { count: 0, totalSize: 0 },
    '5-10MB': { count: 0, totalSize: 0 },
    '> 10MB': { count: 0, totalSize: 0 },
  }

  for (const email of emails) {
    // Estimate email size
    const bodySize = (email.body?.html?.length || 0) + (email.body?.text?.length || 0)
    const attachmentSize = email.attachments?.reduce((sum, att) => sum + (att.size || 0), 0) || 0
    const estimatedSize = Math.max(bodySize + attachmentSize, AVERAGE_EMAIL_SIZE_BYTES)

    let bucket: string
    if (estimatedSize < SIZE_1MB) {
      bucket = '< 1MB'
    } else if (estimatedSize < SIZE_5MB) {
      bucket = '1-5MB'
    } else if (estimatedSize < SIZE_10MB) {
      bucket = '5-10MB'
    } else {
      bucket = '> 10MB'
    }

    buckets[bucket].count++
    buckets[bucket].totalSize += estimatedSize
  }

  const result: SizeStorageBreakdown[] = []
  const bucketOrder: Array<'< 1MB' | '1-5MB' | '5-10MB' | '> 10MB'> = [
    '< 1MB',
    '1-5MB',
    '5-10MB',
    '> 10MB',
  ]

  for (const bucket of bucketOrder) {
    const data = buckets[bucket]
    if (data.count > 0) {
      result.push({
        bucket,
        emailCount: data.count,
        totalSize: data.totalSize,
      })
    }
  }

  return result
}

/**
 * Get complete storage breakdown
 *
 * @param db - RxDB database instance
 * @returns Complete storage breakdown
 */
export async function getStorageBreakdown(db: AppDatabase): Promise<StorageBreakdown> {
  const [byAccount, byAge, bySize] = await Promise.all([
    getStorageBreakdownByAccount(db),
    getStorageBreakdownByAge(db),
    getStorageBreakdownBySize(db),
  ])

  const totalEmails = byAccount.reduce((sum, acc) => sum + acc.emailCount, 0)
  const totalEstimatedSize = byAccount.reduce((sum, acc) => sum + acc.estimatedSize, 0)

  return {
    byAccount,
    byAge,
    bySize,
    totalEmails,
    totalEstimatedSize,
  }
}

/**
 * Estimate storage reduction for given cleanup criteria
 *
 * AC 8: Cleanup preview shows estimated space that will be freed
 *
 * @param db - RxDB database instance
 * @param criteria - Cleanup criteria
 * @returns Cleanup estimation
 */
export async function estimateStorageReduction(
  db: AppDatabase,
  criteria: CleanupCriteria
): Promise<CleanupEstimate> {
  if (!db.emails) {
    return {
      emailCount: 0,
      estimatedFreedBytes: 0,
      affectedAccounts: [],
    }
  }

  // Build query selector based on criteria
  type EmailSelector = {
    accountId?: { $in: string[] }
    timestamp?: { $lt: number }
  }
  const selector: EmailSelector = {}

  if (criteria.accountIds && criteria.accountIds.length > 0) {
    selector.accountId = { $in: criteria.accountIds }
  }

  if (criteria.olderThanDays) {
    const cutoffTime = Date.now() - criteria.olderThanDays * 24 * 60 * 60 * 1000
    selector.timestamp = { $lt: cutoffTime }
  }

  // Get matching emails
  const emails = await db.emails.find({ selector }).exec()

  let count = 0
  let totalSize = 0
  const affectedAccountsSet = new Set<string>()

  for (const email of emails) {
    // If size criteria specified, filter in application
    if (criteria.minSizeBytes) {
      const bodySize = (email.body?.html?.length || 0) + (email.body?.text?.length || 0)
      const attachmentSize = email.attachments?.reduce((sum, att) => sum + (att.size || 0), 0) || 0
      const estimatedSize = Math.max(bodySize + attachmentSize, AVERAGE_EMAIL_SIZE_BYTES)

      if (estimatedSize < criteria.minSizeBytes) {
        continue
      }
    }

    // Estimate email size
    const bodySize = (email.body?.html?.length || 0) + (email.body?.text?.length || 0)
    const attachmentSize = email.attachments?.reduce((sum, att) => sum + (att.size || 0), 0) || 0
    const estimatedSize = Math.max(bodySize + attachmentSize, AVERAGE_EMAIL_SIZE_BYTES)

    count++
    totalSize += estimatedSize
    affectedAccountsSet.add(email.accountId)
  }

  return {
    emailCount: count,
    estimatedFreedBytes: totalSize,
    affectedAccounts: Array.from(affectedAccountsSet),
  }
}

/**
 * Format bytes to human-readable string
 *
 * AC 2: Usage displayed in human-readable format
 *
 * @param bytes - Number of bytes
 * @returns Human-readable string (e.g., "1.5 GB")
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
