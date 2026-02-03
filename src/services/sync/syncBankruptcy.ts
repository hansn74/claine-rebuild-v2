/**
 * Sync Bankruptcy Detection Service
 *
 * Story 1.16: Sync Bankruptcy Detection
 * Tasks 1-2: Core logic + fresh sync reset
 *
 * Detects when delta sync catch-up is slower than starting fresh.
 * When a user has been offline for an extended period (>7 days),
 * proactively declares bankruptcy to avoid slow incremental catch-up.
 *
 * Follows singleton pattern from adaptiveInterval.ts and circuitBreaker.ts.
 */

import { Subject } from 'rxjs'
import type { AppDatabase } from '../database/types'
import { batchMode } from '../database/batchMode'
import { adaptiveInterval } from './adaptiveInterval'
import { logger } from '@/services/logger'

/** Default staleness threshold: 7 days in milliseconds */
const DEFAULT_STALENESS_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000 // 604_800_000

export interface BankruptcyConfig {
  stalenessThresholdMs: number
}

export interface BankruptcyDecision {
  bankrupt: boolean
  reason: string
}

export interface BankruptcyEvent {
  accountId: string
  provider: string
  reason: string
  timestamp: number
}

/**
 * Sync Bankruptcy Service
 *
 * Evaluates staleness before each sync and declares bankruptcy
 * when catching up via delta is slower than a fresh sync.
 */
export class SyncBankruptcyService {
  private config: BankruptcyConfig
  private events$ = new Subject<BankruptcyEvent>()

  constructor(config?: Partial<BankruptcyConfig>) {
    // AC 3: Configurable thresholds with env var support
    const envDays = parseInt(import.meta.env.VITE_BANKRUPTCY_THRESHOLD_DAYS || '', 10)
    const envThresholdMs = Number.isFinite(envDays)
      ? envDays * 24 * 60 * 60 * 1000
      : DEFAULT_STALENESS_THRESHOLD_MS

    this.config = {
      stalenessThresholdMs: config?.stalenessThresholdMs ?? envThresholdMs,
    }
  }

  /**
   * Evaluate whether an account should declare sync bankruptcy (AC 1-5)
   *
   * @param accountId - Account identifier
   * @param provider - Email provider ('gmail' | 'outlook')
   * @param lastSyncAt - Timestamp of last successful sync
   * @returns BankruptcyDecision with bankrupt flag and reason
   */
  shouldDeclareBankruptcy(
    accountId: string,
    provider: 'gmail' | 'outlook',
    lastSyncAt: number
  ): BankruptcyDecision {
    const now = Date.now()
    const staleness = now - lastSyncAt
    const stalenessdays = staleness / (24 * 60 * 60 * 1000)

    // AC 2: Check staleness threshold
    if (staleness <= this.config.stalenessThresholdMs) {
      return { bankrupt: false, reason: 'Within staleness threshold' }
    }

    // AC 5: Gmail-specific: staleness >7 days is sufficient proxy for historyId gap
    if (provider === 'gmail') {
      const reason = `Gmail account stale for ${stalenessdays.toFixed(1)} days (threshold: ${(this.config.stalenessThresholdMs / (24 * 60 * 60 * 1000)).toFixed(0)} days). Fresh sync preferred over incremental catch-up.`

      // AC 7: Log bankruptcy decision
      logger.info('sync-bankruptcy', 'Bankruptcy declared', {
        accountId,
        provider,
        reason,
        stalenessDays: stalenessdays.toFixed(1),
        lastSyncAt,
      })

      return { bankrupt: true, reason }
    }

    // AC 6: Outlook — staleness alone is sufficient; proactive detection avoids wasted 410 round-trip
    if (provider === 'outlook') {
      const reason = `Outlook account stale for ${stalenessdays.toFixed(1)} days (threshold: ${(this.config.stalenessThresholdMs / (24 * 60 * 60 * 1000)).toFixed(0)} days). Fresh sync preferred to avoid expired deltaLink.`

      // AC 7: Log bankruptcy decision
      logger.info('sync-bankruptcy', 'Bankruptcy declared', {
        accountId,
        provider,
        reason,
        stalenessDays: stalenessdays.toFixed(1),
        lastSyncAt,
      })

      return { bankrupt: true, reason }
    }

    return { bankrupt: false, reason: 'Unknown provider' }
  }

  /**
   * Perform fresh sync reset for an account (AC 8, 10)
   *
   * Clears stale email data while preserving user-created data (drafts, attributes).
   * Resets sync state to force a fresh initial sync.
   *
   * @param accountId - Account identifier
   * @param provider - Email provider ('gmail' | 'outlook')
   * @param db - Database instance
   */
  async performFreshSyncReset(accountId: string, provider: string, db: AppDatabase): Promise<void> {
    let emailsDeleted = 0

    try {
      // AC 8: Delete only emails for the affected accountId
      // Use batch mode to prevent reactive query storms during bulk delete
      batchMode.enter()

      try {
        if (db.emails) {
          const removed = await db.emails.find({ selector: { accountId } }).remove()
          emailsDeleted = removed.length
        }
      } finally {
        batchMode.exit()
      }

      // AC 10: Do NOT delete drafts, custom attributes, or other user-created data

      // Reset sync state: initialSyncComplete = false, clear tokens, reset progress
      if (db.syncState) {
        const syncState = await db.syncState.findOne(accountId).exec()
        if (syncState) {
          await syncState.update({
            $set: {
              initialSyncComplete: false,
              syncToken: '',
              pageToken: '',
              emailsSynced: 0,
              progressPercentage: 0,
              totalEmailsToSync: 0,
              estimatedTimeRemaining: 0,
              status: 'idle',
            },
          })
        }
      }

      // Reset adaptive interval for the account
      adaptiveInterval.reset(accountId)

      // Log the reset
      logger.info('sync-bankruptcy', 'Fresh sync reset complete', {
        accountId,
        emailsDeleted,
      })

      // Emit bankruptcy event for UI notification
      this.events$.next({
        accountId,
        provider,
        reason: `Fresh sync reset: ${emailsDeleted} emails cleared`,
        timestamp: Date.now(),
      })
    } catch (error) {
      logger.error('sync-bankruptcy', 'Fresh sync reset failed', {
        accountId,
        error,
      })
      throw error
    }
  }

  /**
   * Get the bankruptcy event observable for UI subscriptions
   */
  getEvents$() {
    return this.events$.asObservable()
  }

  /**
   * Get current configuration (for testing/debugging)
   */
  getConfig(): BankruptcyConfig {
    return { ...this.config }
  }
}

/** Singleton instance */
export const syncBankruptcy = new SyncBankruptcyService()
