/**
 * Mock Email Data Generator for CI Testing
 *
 * Provides utilities for generating realistic mock email data
 * for testing sync engine functionality without real API calls.
 *
 * @tag @sync
 */

import type {
  EmailDocument,
  EmailAddress,
  EmailBody,
  Attachment,
} from '../../database/schemas/email.schema'

/**
 * Configuration for mock email generation
 */
export interface MockEmailConfig {
  /** Start timestamp for emails (default: now - 90 days) */
  startDate?: number
  /** End timestamp for emails (default: now) */
  endDate?: number
  /** Account ID for all emails (default: 'mock-account-1') */
  accountId?: string
  /** Percentage of unread emails (default: 30) */
  unreadPercent?: number
  /** Percentage of emails with attachments (default: 20) */
  attachmentPercent?: number
  /** Provider for historyId generation ('gmail' | 'outlook') */
  provider?: 'gmail' | 'outlook'
  /** Include AI metadata (default: false) */
  includeAiMetadata?: boolean
}

/**
 * Mock sender data for realistic email generation
 */
const MOCK_SENDERS: EmailAddress[] = [
  { name: 'John Smith', email: 'john.smith@company.com' },
  { name: 'Sarah Johnson', email: 'sarah.j@startup.io' },
  { name: 'Newsletter', email: 'news@digest.com' },
  { name: 'GitHub', email: 'noreply@github.com' },
  { name: 'Support Team', email: 'support@service.com' },
  { name: 'Alice Wong', email: 'alice.wong@enterprise.org' },
  { name: 'Bob Martinez', email: 'bob@freelance.dev' },
  { name: 'HR Department', email: 'hr@company.com' },
  { name: 'Sales Team', email: 'sales@vendor.com' },
  { name: 'Project Updates', email: 'updates@project-mgmt.com' },
]

/**
 * Mock subject lines for realistic email generation
 */
const MOCK_SUBJECTS = [
  'Re: Project Update - Q4 Planning',
  'Meeting Tomorrow at 2pm',
  'Your Weekly Newsletter',
  'Invoice #12345 - Payment Confirmation',
  'Action Required: Security Update',
  'New Feature Release Notes',
  'Question about the proposal',
  'Team Standup Notes',
  'Document Review Request',
  'Follow up from our call',
  'FW: Important Announcement',
  'Quick question',
  'Updated Schedule',
  'Your order has shipped',
  'Feedback on your recent submission',
]

/**
 * Mock email body templates
 */
const MOCK_BODIES: EmailBody[] = [
  {
    html: '<p>Hi team,</p><p>Here is the weekly update on our progress.</p><p>Best,<br>John</p>',
    text: 'Hi team,\n\nHere is the weekly update on our progress.\n\nBest,\nJohn',
  },
  {
    html: '<p>Thanks for reaching out. I will review this and get back to you.</p>',
    text: 'Thanks for reaching out. I will review this and get back to you.',
  },
  {
    html: '<p>Please find the attached document for your review.</p><p>Let me know if you have any questions.</p>',
    text: 'Please find the attached document for your review.\n\nLet me know if you have any questions.',
  },
  {
    html: '<p>Your request has been processed successfully.</p><p>Reference: <strong>REF-123456</strong></p>',
    text: 'Your request has been processed successfully.\n\nReference: REF-123456',
  },
]

/**
 * Mock attachment templates
 */
const MOCK_ATTACHMENTS: Attachment[] = [
  {
    id: 'att-1',
    filename: 'document.pdf',
    mimeType: 'application/pdf',
    size: 125000,
    isInline: false,
  },
  {
    id: 'att-2',
    filename: 'spreadsheet.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    size: 45000,
    isInline: false,
  },
  {
    id: 'att-3',
    filename: 'presentation.pptx',
    mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    size: 350000,
    isInline: false,
  },
  {
    id: 'att-4',
    filename: 'image.png',
    mimeType: 'image/png',
    size: 75000,
    isInline: true,
    contentId: 'img001',
  },
  {
    id: 'att-5',
    filename: 'report.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    size: 95000,
    isInline: false,
  },
]

/**
 * Generate a unique ID for mock data
 */
function generateId(prefix: string, index: number): string {
  return `${prefix}-${Date.now()}-${index.toString().padStart(6, '0')}`
}

/**
 * Get a random item from an array
 */
function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/**
 * Generate mock emails for testing
 *
 * @param count - Number of emails to generate
 * @param config - Configuration options
 * @returns Array of mock EmailDocument objects
 *
 * @example
 * ```typescript
 * // Generate 100 emails for the last 30 days
 * const emails = generateMockEmails(100, {
 *   startDate: Date.now() - 30 * 24 * 60 * 60 * 1000,
 *   accountId: 'test-account',
 * })
 * ```
 */
export function generateMockEmails(count: number, config: MockEmailConfig = {}): EmailDocument[] {
  const {
    startDate = Date.now() - 90 * 24 * 60 * 60 * 1000, // 90 days ago
    endDate = Date.now(),
    accountId = 'mock-account-1',
    unreadPercent = 30,
    attachmentPercent = 20,
    provider = 'gmail',
    includeAiMetadata = false,
  } = config

  const emails: EmailDocument[] = []
  const timeRange = endDate - startDate

  // Create threads (group emails into conversations)
  const threadCount = Math.ceil(count / 3) // Average 3 emails per thread
  const threadIds: string[] = []
  for (let i = 0; i < threadCount; i++) {
    threadIds.push(generateId('thread', i))
  }

  for (let i = 0; i < count; i++) {
    const timestamp = startDate + Math.random() * timeRange
    const threadId = randomItem(threadIds)
    const sender = randomItem(MOCK_SENDERS)
    const body = randomItem(MOCK_BODIES)
    const subject = randomItem(MOCK_SUBJECTS)
    const isUnread = Math.random() * 100 < unreadPercent
    const hasAttachments = Math.random() * 100 < attachmentPercent
    const attachments = hasAttachments ? [randomItem(MOCK_ATTACHMENTS)] : []

    const email: EmailDocument = {
      id: generateId('msg', i),
      threadId,
      from: sender,
      to: [{ name: 'Me', email: `testuser@${provider === 'gmail' ? 'gmail.com' : 'outlook.com'}` }],
      subject,
      body,
      timestamp,
      accountId,
      attachments: attachments.map((att, idx) => ({ ...att, id: `${att.id}-${i}-${idx}` })),
      snippet: body.text?.substring(0, 200) || '',
      labels: isUnread ? ['INBOX', 'UNREAD'] : ['INBOX'],
      folder: 'INBOX',
      read: !isUnread,
      starred: Math.random() < 0.1,
      importance: Math.random() < 0.1 ? 'high' : Math.random() < 0.8 ? 'normal' : 'low',
      attributes: {},
    }

    // Add provider-specific fields
    if (provider === 'gmail') {
      email.historyId = (1000000 + i).toString()
    }

    // Optionally add AI metadata
    if (includeAiMetadata) {
      email.aiMetadata = {
        triageScore: Math.floor(Math.random() * 100),
        priority: Math.random() < 0.2 ? 'high' : Math.random() < 0.5 ? 'medium' : 'low',
        suggestedAttributes: {},
        confidence: Math.floor(50 + Math.random() * 50),
        reasoning: 'Mock AI analysis for testing',
        modelVersion: 'mock-v1.0',
        processedAt: Date.now(),
      }
    }

    emails.push(email)
  }

  // Sort by timestamp (newest first)
  return emails.sort((a, b) => b.timestamp - a.timestamp)
}

/**
 * Generate mock Gmail API messages.list response
 *
 * @param count - Number of messages
 * @param nextPageToken - Optional page token
 * @returns Gmail-style messages.list response
 */
export function mockGmailListResponse(
  count: number,
  nextPageToken?: string
): {
  messages: { id: string; threadId: string }[]
  nextPageToken?: string
  resultSizeEstimate: number
} {
  const messages = []
  for (let i = 0; i < count; i++) {
    messages.push({
      id: generateId('msg', i),
      threadId: generateId('thread', Math.floor(i / 3)),
    })
  }

  return {
    messages,
    nextPageToken,
    resultSizeEstimate: count,
  }
}

/**
 * Generate mock Gmail History API response
 *
 * @param startHistoryId - Starting history ID
 * @param addedCount - Number of added messages
 * @param deletedCount - Number of deleted messages
 * @returns Gmail-style history response
 */
export function mockGmailHistoryResponse(
  startHistoryId: string,
  addedCount: number = 5,
  deletedCount: number = 0
): {
  history: Array<{
    id: string
    messagesAdded?: Array<{ message: { id: string; threadId: string } }>
    messagesDeleted?: Array<{ message: { id: string; threadId: string } }>
  }>
  historyId: string
} {
  const history: Array<{
    id: string
    messagesAdded?: Array<{ message: { id: string; threadId: string } }>
    messagesDeleted?: Array<{ message: { id: string; threadId: string } }>
  }> = []

  const baseHistoryId = parseInt(startHistoryId, 10) || 1000000
  let currentHistoryId = baseHistoryId

  // Generate messagesAdded history records
  for (let i = 0; i < addedCount; i++) {
    currentHistoryId++
    history.push({
      id: currentHistoryId.toString(),
      messagesAdded: [
        {
          message: {
            id: generateId('msg-new', i),
            threadId: generateId('thread-new', Math.floor(i / 2)),
          },
        },
      ],
    })
  }

  // Generate messagesDeleted history records
  for (let i = 0; i < deletedCount; i++) {
    currentHistoryId++
    history.push({
      id: currentHistoryId.toString(),
      messagesDeleted: [
        {
          message: {
            id: generateId('msg-deleted', i),
            threadId: generateId('thread-deleted', i),
          },
        },
      ],
    })
  }

  return {
    history,
    historyId: currentHistoryId.toString(),
  }
}

/**
 * Generate mock Gmail API messages.get response
 *
 * @param id - Message ID
 * @param threadId - Thread ID
 * @param config - Additional configuration
 * @returns Gmail-style message response
 */
export function mockGmailMessageResponse(
  id: string,
  threadId: string,
  config: { hasAttachment?: boolean; isUnread?: boolean; timestamp?: number } = {}
): Record<string, unknown> {
  const { hasAttachment = false, isUnread = true, timestamp = Date.now() } = config

  const sender = randomItem(MOCK_SENDERS)
  const subject = randomItem(MOCK_SUBJECTS)
  const body = randomItem(MOCK_BODIES)

  const headers = [
    { name: 'From', value: `${sender.name} <${sender.email}>` },
    { name: 'To', value: 'testuser@gmail.com' },
    { name: 'Subject', value: subject },
    { name: 'Date', value: new Date(timestamp).toUTCString() },
  ]

  const labelIds = ['INBOX']
  if (isUnread) labelIds.push('UNREAD')

  const response: Record<string, unknown> = {
    id,
    threadId,
    historyId: (1000000 + parseInt(id.split('-').pop() || '0', 10)).toString(),
    internalDate: timestamp.toString(),
    snippet: body.text?.substring(0, 200) || '',
    labelIds,
    payload: {
      mimeType: hasAttachment ? 'multipart/mixed' : 'text/plain',
      headers,
      body: hasAttachment ? {} : { data: Buffer.from(body.text || '').toString('base64') },
      parts: hasAttachment
        ? [
            {
              mimeType: 'text/plain',
              body: { data: Buffer.from(body.text || '').toString('base64') },
            },
            {
              partId: '1',
              mimeType: 'application/pdf',
              filename: 'attachment.pdf',
              body: { attachmentId: 'attachment-1', size: 12345 },
            },
          ]
        : undefined,
    },
  }

  return response
}

/**
 * Generate mock Outlook API messages response
 *
 * @param count - Number of messages
 * @param skipToken - Optional skip token for pagination
 */
export function mockOutlookListResponse(
  count: number,
  skipToken?: string
): {
  value: Array<{
    id: string
    conversationId: string
    subject: string
    from: { emailAddress: { name: string; address: string } }
    receivedDateTime: string
    isRead: boolean
  }>
  '@odata.nextLink'?: string
} {
  const value = []
  for (let i = 0; i < count; i++) {
    const sender = randomItem(MOCK_SENDERS)
    value.push({
      id: generateId('msg', i),
      conversationId: generateId('conv', Math.floor(i / 3)),
      subject: randomItem(MOCK_SUBJECTS),
      from: {
        emailAddress: {
          name: sender.name,
          address: sender.email,
        },
      },
      receivedDateTime: new Date(Date.now() - i * 3600000).toISOString(),
      isRead: Math.random() > 0.3,
    })
  }

  return {
    value,
    '@odata.nextLink': skipToken
      ? `https://graph.microsoft.com/v1.0/me/messages?$skip=${skipToken}`
      : undefined,
  }
}
