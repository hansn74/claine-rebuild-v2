/**
 * usePriorityGroupedEmails Hook
 *
 * Story 3.4: Priority-Based Inbox View
 * Task 2: Pure transformation from flat email list to grouped virtual items
 *
 * Takes flat emails + collapsedSections, returns flat array of virtual items
 * (headers + emails) suitable for virtualized rendering.
 */

import { useMemo } from 'react'
import type { EmailDocument } from '@/services/database/schemas/email.schema'
import type { Priority } from '@/services/ai/priorityDisplay'

export type PriorityVirtualItem =
  | {
      type: 'header'
      sectionKey: string
      priority: Priority | 'uncategorized'
      count: number
      isCollapsed: boolean
    }
  | {
      type: 'email'
      email: EmailDocument
      sectionKey: string
    }

const SECTION_ORDER: Array<Priority | 'uncategorized'> = [
  'high',
  'medium',
  'low',
  'none',
  'uncategorized',
]

export function usePriorityGroupedEmails(
  emails: EmailDocument[],
  collapsedSections: Set<string>
): PriorityVirtualItem[] {
  return useMemo(() => {
    // Group emails by priority
    const groups = new Map<Priority | 'uncategorized', EmailDocument[]>()

    for (const email of emails) {
      const priority = email.aiMetadata?.priority
      const key: Priority | 'uncategorized' = priority || 'uncategorized'
      const group = groups.get(key)
      if (group) {
        group.push(email)
      } else {
        groups.set(key, [email])
      }
    }

    // Sort each group by timestamp descending
    for (const group of groups.values()) {
      group.sort((a, b) => b.timestamp - a.timestamp)
    }

    // Build flat virtual item array in section order
    const items: PriorityVirtualItem[] = []

    for (const priority of SECTION_ORDER) {
      const group = groups.get(priority)
      if (!group || group.length === 0) continue

      const sectionKey = priority
      const isCollapsed = collapsedSections.has(sectionKey)

      items.push({
        type: 'header',
        sectionKey,
        priority,
        count: group.length,
        isCollapsed,
      })

      if (!isCollapsed) {
        for (const email of group) {
          items.push({
            type: 'email',
            email,
            sectionKey,
          })
        }
      }
    }

    return items
  }, [emails, collapsedSections])
}
