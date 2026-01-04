/**
 * Thread Message Grouping Utility
 *
 * Story 2.2: Thread Detail View with Conversation History
 * Task 4: Implement Message Grouping
 *
 * Groups messages from the same sender within 5 minutes
 * for a cleaner thread display.
 */

import type { EmailDocument, EmailAddress } from '@/services/database/schemas/email.schema'

/**
 * Time threshold for grouping messages (5 minutes in milliseconds)
 */
const GROUPING_THRESHOLD_MS = 5 * 60 * 1000

/**
 * A group of messages from the same sender within the time threshold
 */
export interface MessageGroup {
  /** The sender of all messages in this group */
  sender: EmailAddress
  /** Messages in this group, chronologically ordered */
  messages: EmailDocument[]
  /** Timestamp of the first message in the group */
  startTimestamp: number
  /** Timestamp of the last message in the group */
  endTimestamp: number
}

/**
 * Group messages by sender and time proximity
 *
 * Messages from the same sender within 5 minutes of each other
 * are grouped together. This creates a cleaner thread display
 * similar to modern chat/email interfaces.
 *
 * @param emails - Array of emails sorted chronologically (oldest first)
 * @returns Array of message groups
 */
export function groupMessagesBySender(emails: EmailDocument[]): MessageGroup[] {
  if (emails.length === 0) {
    return []
  }

  const groups: MessageGroup[] = []

  for (const email of emails) {
    const lastGroup = groups[groups.length - 1]

    // Check if this email should be grouped with the previous one
    const shouldGroup =
      lastGroup &&
      lastGroup.sender.email.toLowerCase() === email.from.email.toLowerCase() &&
      email.timestamp - lastGroup.endTimestamp < GROUPING_THRESHOLD_MS

    if (shouldGroup) {
      // Add to existing group
      lastGroup.messages.push(email)
      lastGroup.endTimestamp = email.timestamp
    } else {
      // Create new group
      groups.push({
        sender: email.from,
        messages: [email],
        startTimestamp: email.timestamp,
        endTimestamp: email.timestamp,
      })
    }
  }

  return groups
}

/**
 * Get display name for a sender
 *
 * @param sender - Email address object
 * @returns Display name or email if no name available
 */
export function getSenderDisplayName(sender: EmailAddress): string {
  return sender.name?.trim() || sender.email
}

/**
 * Get avatar initials for a sender
 *
 * @param sender - Email address object
 * @returns 1-2 character initials
 */
export function getSenderInitials(sender: EmailAddress): string {
  const name = sender.name?.trim()
  if (name) {
    const parts = name.split(/\s+/)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return name[0].toUpperCase()
  }
  return sender.email[0].toUpperCase()
}
