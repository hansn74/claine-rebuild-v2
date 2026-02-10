/**
 * usePriorityScoring Hook
 *
 * Story 3.3: Priority Scoring Model
 * Task 5: Auto-scores visible emails in the active folder
 *
 * Queries the first 50 emails from the current folder,
 * filters to unscored, and delegates to priorityScoringService.
 */

import { useEffect, useRef } from 'react'
import { logger } from '@/services/logger'
import { getDatabase } from '@/services/database/init'
import { priorityScoringService } from '@/services/ai/priorityScoringService'
import { useFolderStore } from '@/store/folderStore'
import type { EmailDocument } from '@/services/database/schemas/email.schema'

export interface UsePriorityScoringOptions {
  enabled: boolean
  accountId: string | null | undefined
}

const BATCH_SIZE = 50

export function usePriorityScoring({ enabled, accountId }: UsePriorityScoringOptions): void {
  const selectedFolder = useFolderStore((s) => s.selectedFolder)
  const lastScoredSetRef = useRef<string>('')

  useEffect(() => {
    if (!enabled || !accountId) return

    let cancelled = false

    const scoreVisibleEmails = async () => {
      try {
        const db = getDatabase()

        const docs = await db.emails
          .find({
            selector: {
              accountId,
              folder: selectedFolder,
            },
            sort: [{ timestamp: 'desc' as const }],
            limit: BATCH_SIZE,
          })
          .exec()

        const emails = docs.map((doc) => doc.toJSON() as EmailDocument)

        // Deduplicate: build a key from email IDs to avoid re-triggering
        const setKey = emails.map((e) => e.id).join(',')
        if (setKey === lastScoredSetRef.current) return
        lastScoredSetRef.current = setKey

        if (cancelled) return

        const { scored, skipped } = await priorityScoringService.scoreBatch(emails)

        if (!cancelled && scored > 0) {
          logger.info('ai', 'Priority scoring complete for folder', {
            folder: selectedFolder,
            scored,
            skipped,
          })
        }
      } catch (error) {
        if (!cancelled) {
          logger.error('ai', 'Priority scoring failed', {
            error: error instanceof Error ? error.message : 'Unknown',
          })
        }
      }
    }

    scoreVisibleEmails()

    return () => {
      cancelled = true
    }
  }, [enabled, accountId, selectedFolder])
}
