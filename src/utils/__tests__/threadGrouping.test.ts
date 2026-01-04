/**
 * Thread Grouping Utility Tests
 *
 * Story 2.2: Thread Detail View with Conversation History
 * Task 11: Testing & Performance
 */

import { describe, it, expect } from 'vitest'
import { groupMessagesBySender, getSenderDisplayName, getSenderInitials } from '../threadGrouping'
import type { EmailDocument } from '@/services/database/schemas/email.schema'

/**
 * Generate mock email for testing
 */
function generateMockEmail(
  id: string,
  fromEmail: string,
  fromName: string,
  timestamp: number
): EmailDocument {
  return {
    id,
    threadId: 'thread-1',
    from: { name: fromName, email: fromEmail },
    to: [{ name: 'Recipient', email: 'recipient@example.com' }],
    cc: [],
    bcc: [],
    subject: 'Test Subject',
    body: { text: 'Test body' },
    timestamp,
    accountId: 'account-1',
    attachments: [],
    snippet: 'Test snippet',
    labels: ['inbox'],
    folder: 'inbox',
    read: true,
    starred: false,
    importance: 'normal',
    attributes: {},
  }
}

describe('groupMessagesBySender', () => {
  describe('Basic Grouping', () => {
    it('should return empty array for empty input', () => {
      const result = groupMessagesBySender([])
      expect(result).toEqual([])
    })

    it('should create single group for single email', () => {
      const emails = [generateMockEmail('1', 'john@example.com', 'John', 1000)]

      const result = groupMessagesBySender(emails)

      expect(result).toHaveLength(1)
      expect(result[0].sender.email).toBe('john@example.com')
      expect(result[0].messages).toHaveLength(1)
    })

    it('should group consecutive emails from same sender', () => {
      const baseTime = Date.now()
      const emails = [
        generateMockEmail('1', 'john@example.com', 'John', baseTime),
        generateMockEmail('2', 'john@example.com', 'John', baseTime + 60000), // 1 min later
        generateMockEmail('3', 'john@example.com', 'John', baseTime + 120000), // 2 min later
      ]

      const result = groupMessagesBySender(emails)

      expect(result).toHaveLength(1)
      expect(result[0].messages).toHaveLength(3)
    })
  })

  describe('Time Proximity Grouping', () => {
    it('should group messages within 5 minutes', () => {
      const baseTime = Date.now()
      const emails = [
        generateMockEmail('1', 'john@example.com', 'John', baseTime),
        generateMockEmail('2', 'john@example.com', 'John', baseTime + 4 * 60 * 1000), // 4 min later
      ]

      const result = groupMessagesBySender(emails)

      expect(result).toHaveLength(1)
      expect(result[0].messages).toHaveLength(2)
    })

    it('should NOT group messages more than 5 minutes apart', () => {
      const baseTime = Date.now()
      const emails = [
        generateMockEmail('1', 'john@example.com', 'John', baseTime),
        generateMockEmail('2', 'john@example.com', 'John', baseTime + 6 * 60 * 1000), // 6 min later
      ]

      const result = groupMessagesBySender(emails)

      expect(result).toHaveLength(2)
      expect(result[0].messages).toHaveLength(1)
      expect(result[1].messages).toHaveLength(1)
    })
  })

  describe('Different Senders', () => {
    it('should create separate groups for different senders', () => {
      const baseTime = Date.now()
      const emails = [
        generateMockEmail('1', 'john@example.com', 'John', baseTime),
        generateMockEmail('2', 'jane@example.com', 'Jane', baseTime + 60000), // 1 min later, different sender
      ]

      const result = groupMessagesBySender(emails)

      expect(result).toHaveLength(2)
      expect(result[0].sender.email).toBe('john@example.com')
      expect(result[1].sender.email).toBe('jane@example.com')
    })

    it('should handle case-insensitive email matching', () => {
      const baseTime = Date.now()
      const emails = [
        generateMockEmail('1', 'john@example.com', 'John', baseTime),
        generateMockEmail('2', 'JOHN@EXAMPLE.COM', 'John', baseTime + 60000), // Same email, different case
      ]

      const result = groupMessagesBySender(emails)

      expect(result).toHaveLength(1)
      expect(result[0].messages).toHaveLength(2)
    })
  })

  describe('Group Timestamps', () => {
    it('should set correct start and end timestamps', () => {
      const baseTime = Date.now()
      const emails = [
        generateMockEmail('1', 'john@example.com', 'John', baseTime),
        generateMockEmail('2', 'john@example.com', 'John', baseTime + 120000), // 2 min later
      ]

      const result = groupMessagesBySender(emails)

      expect(result[0].startTimestamp).toBe(baseTime)
      expect(result[0].endTimestamp).toBe(baseTime + 120000)
    })
  })

  describe('Complex Scenarios', () => {
    it('should handle alternating senders', () => {
      const baseTime = Date.now()
      const emails = [
        generateMockEmail('1', 'john@example.com', 'John', baseTime),
        generateMockEmail('2', 'jane@example.com', 'Jane', baseTime + 60000),
        generateMockEmail('3', 'john@example.com', 'John', baseTime + 120000),
        generateMockEmail('4', 'jane@example.com', 'Jane', baseTime + 180000),
      ]

      const result = groupMessagesBySender(emails)

      expect(result).toHaveLength(4) // Each message is a separate group
    })

    it('should handle back-to-back replies within time window', () => {
      const baseTime = Date.now()
      const emails = [
        generateMockEmail('1', 'john@example.com', 'John', baseTime),
        generateMockEmail('2', 'john@example.com', 'John', baseTime + 60000),
        generateMockEmail('3', 'jane@example.com', 'Jane', baseTime + 120000),
        generateMockEmail('4', 'jane@example.com', 'Jane', baseTime + 180000),
      ]

      const result = groupMessagesBySender(emails)

      expect(result).toHaveLength(2) // John's group and Jane's group
      expect(result[0].messages).toHaveLength(2)
      expect(result[1].messages).toHaveLength(2)
    })
  })
})

describe('getSenderDisplayName', () => {
  it('should return name when available', () => {
    const result = getSenderDisplayName({ name: 'John Doe', email: 'john@example.com' })
    expect(result).toBe('John Doe')
  })

  it('should return email when name is empty', () => {
    const result = getSenderDisplayName({ name: '', email: 'john@example.com' })
    expect(result).toBe('john@example.com')
  })

  it('should return email when name is whitespace only', () => {
    const result = getSenderDisplayName({ name: '   ', email: 'john@example.com' })
    expect(result).toBe('john@example.com')
  })
})

describe('getSenderInitials', () => {
  it('should return first letter of name', () => {
    const result = getSenderInitials({ name: 'John', email: 'john@example.com' })
    expect(result).toBe('J')
  })

  it('should return two initials for full name', () => {
    const result = getSenderInitials({ name: 'John Doe', email: 'john@example.com' })
    expect(result).toBe('JD')
  })

  it('should return first and last initial for multi-part names', () => {
    const result = getSenderInitials({ name: 'John Michael Doe', email: 'john@example.com' })
    expect(result).toBe('JD')
  })

  it('should return first letter of email when no name', () => {
    const result = getSenderInitials({ name: '', email: 'john@example.com' })
    expect(result).toBe('J')
  })

  it('should uppercase initials', () => {
    const result = getSenderInitials({ name: 'john doe', email: 'john@example.com' })
    expect(result).toBe('JD')
  })
})
