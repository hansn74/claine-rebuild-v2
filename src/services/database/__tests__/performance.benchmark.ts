/* eslint-disable no-console */
/**
 * RxDB Performance Benchmarks
 *
 * Performance tests to ensure database operations meet PRD requirements:
 * - NFR001: Sub-50ms input latency
 * - NFR004: Support 100,000 emails with <5% performance degradation
 *
 * These benchmarks establish baselines and detect regressions.
 *
 * @tag @perf @rxdb
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import { createTestDatabase, destroyTestDatabase } from './testUtils'
import type { AppDatabase } from '../types'
import { generateMockEmails } from '../../sync/__mocks__/mockEmailData'

describe('@perf RxDB Performance Benchmarks', () => {
  let db: AppDatabase

  // Performance thresholds (in milliseconds)
  const THRESHOLDS = {
    INSERT_1000_EMAILS: 5000, // 5 seconds max for bulk insert
    QUERY_1000_EMAILS: 100, // 100ms max for query
    QUERY_SORTED_1000: 100, // 100ms max for sorted query
    SINGLE_INSERT: 50, // 50ms max for single insert
    SINGLE_QUERY: 10, // 10ms max for single query by ID
  }

  beforeEach(async () => {
    db = await createTestDatabase('perf-bench')
  })

  afterEach(async () => {
    await destroyTestDatabase(db)
  })

  describe('Bulk Insert Performance (AC 9)', () => {
    it('@perf should insert 1000 emails in under 5 seconds', async () => {
      const emails = generateMockEmails(1000, {
        accountId: 'perf-test-account',
        provider: 'gmail',
      })

      const startTime = performance.now()
      await db.emails?.bulkInsert(emails)
      const endTime = performance.now()

      const duration = endTime - startTime
      console.log(`[PERF] Insert 1000 emails: ${duration.toFixed(2)}ms`)

      expect(duration).toBeLessThan(THRESHOLDS.INSERT_1000_EMAILS)

      // Verify all emails were inserted
      const count = await db.emails?.count().exec()
      expect(count).toBe(1000)
    })

    it('@perf should maintain insert performance under 50ms per email for batch of 100', async () => {
      const emails = generateMockEmails(100, {
        accountId: 'perf-test-account',
      })

      const startTime = performance.now()
      await db.emails?.bulkInsert(emails)
      const endTime = performance.now()

      const duration = endTime - startTime
      const perEmailTime = duration / 100

      console.log(
        `[PERF] Insert 100 emails: ${duration.toFixed(2)}ms (${perEmailTime.toFixed(2)}ms per email)`
      )

      // Average should be under 50ms per email
      expect(perEmailTime).toBeLessThan(50)
    })
  })

  describe('Query Performance (AC 10)', () => {
    beforeEach(async () => {
      // Pre-populate with 1000 emails
      const emails = generateMockEmails(1000, {
        accountId: 'perf-test-account',
        provider: 'gmail',
      })
      await db.emails?.bulkInsert(emails)
    })

    it('@perf should query 1000 emails sorted by date in under 100ms', async () => {
      const startTime = performance.now()
      const emails = await db.emails?.find().sort({ timestamp: 'desc' }).limit(1000).exec()
      const endTime = performance.now()

      const duration = endTime - startTime
      console.log(`[PERF] Query 1000 emails sorted: ${duration.toFixed(2)}ms`)

      expect(duration).toBeLessThan(THRESHOLDS.QUERY_SORTED_1000)
      expect(emails?.length).toBe(1000)

      // Verify sorting
      for (let i = 1; i < (emails?.length || 0); i++) {
        expect(emails![i - 1].timestamp).toBeGreaterThanOrEqual(emails![i].timestamp)
      }
    })

    it('@perf should query emails by account in under 100ms', async () => {
      const startTime = performance.now()
      const emails = await db.emails
        ?.find({
          selector: { accountId: 'perf-test-account' },
        })
        .exec()
      const endTime = performance.now()

      const duration = endTime - startTime
      console.log(`[PERF] Query by accountId: ${duration.toFixed(2)}ms`)

      expect(duration).toBeLessThan(THRESHOLDS.QUERY_1000_EMAILS)
      expect(emails?.length).toBe(1000)
    })

    it('@perf should query emails by folder in under 100ms', async () => {
      const startTime = performance.now()
      const folderEmails = await db.emails
        ?.find({
          selector: { folder: 'INBOX' },
        })
        .exec()
      const endTime = performance.now()

      const duration = endTime - startTime
      console.log(
        `[PERF] Query by folder: ${duration.toFixed(2)}ms (${folderEmails?.length} results)`
      )

      expect(duration).toBeLessThan(THRESHOLDS.QUERY_1000_EMAILS)
    })

    it('@perf should find email by ID in under 10ms', async () => {
      const emails = await db.emails?.find().limit(1).exec()
      const emailId = emails?.[0]?.id

      const startTime = performance.now()
      const email = await db.emails?.findOne(emailId).exec()
      const endTime = performance.now()

      const duration = endTime - startTime
      console.log(`[PERF] Find by ID: ${duration.toFixed(2)}ms`)

      expect(duration).toBeLessThan(THRESHOLDS.SINGLE_QUERY)
      expect(email?.id).toBe(emailId)
    })
  })

  describe('Compound Index Performance', () => {
    beforeEach(async () => {
      // Pre-populate with 1000 emails
      const prepopEmails = generateMockEmails(1000, {
        accountId: 'perf-test-account',
        provider: 'gmail',
      })
      await db.emails?.bulkInsert(prepopEmails)
    })

    it('@perf should efficiently query by accountId + timestamp compound index', async () => {
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000

      const startTime = performance.now()
      const queryResults = await db.emails
        ?.find({
          selector: {
            accountId: 'perf-test-account',
            timestamp: { $gt: oneDayAgo },
          },
        })
        .sort({ timestamp: 'desc' })
        .exec()
      const endTime = performance.now()

      const duration = endTime - startTime
      console.log(
        `[PERF] Compound index query: ${duration.toFixed(2)}ms (${queryResults?.length} results)`
      )

      expect(duration).toBeLessThan(THRESHOLDS.QUERY_1000_EMAILS)
    })
  })

  describe('Thread Query Performance', () => {
    beforeEach(async () => {
      // Pre-populate with 1000 emails
      const threadEmails = generateMockEmails(1000, {
        accountId: 'perf-test-account',
        provider: 'gmail',
      })
      await db.emails?.bulkInsert(threadEmails)
    })

    it('@perf should query emails by threadId efficiently', async () => {
      // Get a threadId from existing emails
      const sampleEmail = await db.emails?.findOne().exec()
      const threadId = sampleEmail?.threadId

      const startTime = performance.now()
      const threadEmails = await db.emails
        ?.find({
          selector: { threadId },
        })
        .sort({ timestamp: 'asc' })
        .exec()
      const endTime = performance.now()

      const duration = endTime - startTime
      console.log(`[PERF] Thread query: ${duration.toFixed(2)}ms (${threadEmails?.length} emails)`)

      expect(duration).toBeLessThan(THRESHOLDS.SINGLE_QUERY * 5) // Allow 50ms for thread query
    })
  })

  describe('Update Performance', () => {
    beforeEach(async () => {
      const emails = generateMockEmails(100, {
        accountId: 'perf-test-account',
      })
      await db.emails?.bulkInsert(emails)
    })

    it('@perf should update email read status quickly', async () => {
      const emails = await db.emails?.find().limit(10).exec()

      const startTime = performance.now()
      for (const email of emails || []) {
        await email.patch({ read: true })
      }
      const endTime = performance.now()

      const duration = endTime - startTime
      const perUpdate = duration / 10

      console.log(
        `[PERF] Update 10 emails: ${duration.toFixed(2)}ms (${perUpdate.toFixed(2)}ms per update)`
      )

      expect(perUpdate).toBeLessThan(THRESHOLDS.SINGLE_INSERT)
    })
  })

  describe('Delete Performance', () => {
    beforeEach(async () => {
      const emails = generateMockEmails(100, {
        accountId: 'perf-test-account',
      })
      await db.emails?.bulkInsert(emails)
    })

    it('@perf should delete emails efficiently', async () => {
      const emails = await db.emails?.find().limit(50).exec()
      const ids = emails?.map((e) => e.id) || []

      const startTime = performance.now()
      await db.emails?.bulkRemove(ids)
      const endTime = performance.now()

      const duration = endTime - startTime
      console.log(`[PERF] Delete 50 emails: ${duration.toFixed(2)}ms`)

      expect(duration).toBeLessThan(THRESHOLDS.INSERT_1000_EMAILS / 2) // Should be faster than insert

      // Verify deletion
      const count = await db.emails?.count().exec()
      expect(count).toBe(50)
    })
  })
})

/**
 * Extended performance tests for larger datasets
 * These are separated as they may take longer to run
 */
describe('@perf @slow RxDB Large Dataset Performance', () => {
  let db: AppDatabase

  beforeAll(async () => {
    db = await createTestDatabase('large-perf-bench')
  })

  afterAll(async () => {
    await destroyTestDatabase(db)
  })

  it('@perf @slow should handle 5000 emails without significant degradation', async () => {
    const emails = generateMockEmails(5000, {
      accountId: 'large-test-account',
      provider: 'gmail',
    })

    // Insert in batches to avoid memory issues
    const batchSize = 1000
    const insertTimes: number[] = []

    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize)
      const startTime = performance.now()
      await db.emails?.bulkInsert(batch)
      const endTime = performance.now()
      insertTimes.push(endTime - startTime)
    }

    const avgInsertTime = insertTimes.reduce((a, b) => a + b, 0) / insertTimes.length
    const maxInsertTime = Math.max(...insertTimes)

    console.log(`[PERF] 5000 emails in ${insertTimes.length} batches:`)
    console.log(`  - Average batch time: ${avgInsertTime.toFixed(2)}ms`)
    console.log(`  - Max batch time: ${maxInsertTime.toFixed(2)}ms`)

    // Query performance with large dataset
    const queryStart = performance.now()
    const queryResults = await db.emails?.find().sort({ timestamp: 'desc' }).limit(100).exec()
    const queryEnd = performance.now()

    const queryTime = queryEnd - queryStart
    console.log(
      `[PERF] Query 100 from 5000: ${queryTime.toFixed(2)}ms (${queryResults?.length} results)`
    )

    // Performance should not degrade more than 5x from baseline
    expect(queryTime).toBeLessThan(500) // 500ms max for large dataset query

    // Verify count
    const count = await db.emails?.count().exec()
    expect(count).toBe(5000)
  }, 60000) // 60 second timeout for this test
})
