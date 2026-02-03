/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Demo Mode Data Generator
 * Creates sample email data for visual testing and development
 *
 * Usage:
 * - Call loadDemoData() to populate the database with sample emails
 * - Call clearDemoData() to remove demo emails
 */

import { getDatabase } from '@/services/database/init'
import type { EmailDocument } from '@/services/database/schemas/email.schema'
import type { AttributeDocument } from '@/services/database/schemas/attribute.schema'
import { logger } from '@/services/logger'

const DEMO_ACCOUNT_ID = 'demo-account'

/**
 * Demo attribute definitions matching values used in demo emails
 * Story 2.15: Required for attribute filter panel to display
 */
function generateDemoAttributes(): AttributeDocument[] {
  const now = Date.now()

  return [
    {
      id: 'demo-attr-priority',
      name: 'priority',
      displayName: 'Priority',
      type: 'enum',
      values: [
        { value: 'urgent', label: 'Urgent' },
        { value: 'high', label: 'High' },
        { value: 'normal', label: 'Normal' },
        { value: 'low', label: 'Low' },
      ],
      enabled: true,
      isBuiltIn: false,
      order: 1,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'demo-attr-project',
      name: 'project',
      displayName: 'Project',
      type: 'text',
      enabled: true,
      isBuiltIn: false,
      order: 2,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'demo-attr-type',
      name: 'type',
      displayName: 'Type',
      type: 'enum',
      values: [
        { value: 'code-review', label: 'Code Review' },
        { value: 'billing', label: 'Billing' },
        { value: 'meeting', label: 'Meeting' },
        { value: 'task', label: 'Task' },
      ],
      enabled: true,
      isBuiltIn: false,
      order: 3,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'demo-attr-category',
      name: 'category',
      displayName: 'Category',
      type: 'enum',
      values: [
        { value: 'newsletter', label: 'Newsletter' },
        { value: 'work', label: 'Work' },
        { value: 'personal', label: 'Personal' },
        { value: 'team', label: 'Team' },
      ],
      enabled: true,
      isBuiltIn: false,
      order: 4,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'demo-attr-client',
      name: 'client',
      displayName: 'Client',
      type: 'text',
      enabled: true,
      isBuiltIn: false,
      order: 5,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'demo-attr-sprint',
      name: 'sprint',
      displayName: 'Sprint',
      type: 'text',
      enabled: true,
      isBuiltIn: false,
      order: 6,
      createdAt: now,
      updatedAt: now,
    },
  ]
}

/**
 * Sample email data showcasing different states and features
 */
function generateDemoEmails(): EmailDocument[] {
  const now = Date.now()
  const hour = 60 * 60 * 1000
  const day = 24 * hour

  return [
    // Unread, high priority, recent
    {
      id: 'demo-1',
      threadId: 'thread-demo-1',
      from: { name: 'Sarah Chen', email: 'sarah.chen@startup.io' },
      to: [{ name: 'You', email: 'user@example.com' }],
      subject: 'Q4 Strategy Review - Action Required',
      body: {
        text: 'Hi team, Please review the attached Q4 strategy document before our meeting tomorrow. We need to finalize the roadmap priorities.',
        html: '<p>Hi team,</p><p>Please review the attached Q4 strategy document before our meeting tomorrow. We need to finalize the roadmap priorities.</p>',
      },
      timestamp: now - 2 * hour,
      accountId: DEMO_ACCOUNT_ID,
      attachments: [
        {
          id: 'att-1',
          filename: 'Q4-Strategy.pdf',
          mimeType: 'application/pdf',
          size: 245000,
          isInline: false,
        },
      ],
      snippet:
        'Hi team, Please review the attached Q4 strategy document before our meeting tomorrow...',
      labels: ['inbox', 'important'],
      folder: 'inbox',
      read: false,
      starred: true,
      importance: 'high',
      attributes: { priority: 'urgent', project: 'Q4 Planning' },
      aiMetadata: {
        triageScore: 95,
        priority: 'high',
        confidence: 92,
        reasoning: 'Action required with deadline, attachment needs review',
        modelVersion: 'claine-v1',
        processedAt: now,
        suggestedAttributes: {},
      },
    },
    // Unread, medium priority
    {
      id: 'demo-2',
      threadId: 'thread-demo-2',
      from: { name: 'GitHub', email: 'notifications@github.com' },
      to: [{ name: 'You', email: 'user@example.com' }],
      subject: '[claine-rebuild] PR #142: Add virtualized email list',
      body: {
        text: 'marcusdev requested your review on this pull request. The PR implements @tanstack/react-virtual for efficient rendering.',
      },
      timestamp: now - 5 * hour,
      accountId: DEMO_ACCOUNT_ID,
      attachments: [],
      snippet:
        'marcusdev requested your review on this pull request. The PR implements @tanstack/react-virtual...',
      labels: ['inbox'],
      folder: 'inbox',
      read: false,
      starred: false,
      importance: 'normal',
      attributes: { type: 'code-review' },
    },
    // Read, with AI draft ready
    {
      id: 'demo-3',
      threadId: 'thread-demo-3',
      from: { name: 'Alex Rivera', email: 'alex.r@company.com' },
      to: [{ name: 'You', email: 'user@example.com' }],
      subject: 'Re: Design system feedback',
      body: {
        text: 'Thanks for the feedback on the color palette! I agree that cyan works better than the original blue. Let me update the Figma file.',
      },
      timestamp: now - 1 * day,
      accountId: DEMO_ACCOUNT_ID,
      attachments: [],
      snippet:
        'Thanks for the feedback on the color palette! I agree that cyan works better than the original blue...',
      labels: ['inbox'],
      folder: 'inbox',
      read: true,
      starred: false,
      importance: 'normal',
      attributes: {},
      aiMetadata: {
        triageScore: 45,
        priority: 'low',
        confidence: 88,
        reasoning: 'FYI update, no action needed',
        modelVersion: 'claine-v1',
        processedAt: now,
        suggestedAttributes: {},
      },
    },
    // Unread newsletter
    {
      id: 'demo-4',
      threadId: 'thread-demo-4',
      from: { name: 'TechCrunch Daily', email: 'newsletter@techcrunch.com' },
      to: [{ name: 'You', email: 'user@example.com' }],
      subject: 'The AI startup that raised $100M in stealth mode',
      body: {
        text: "Good morning! Here are today's top stories: A mysterious AI startup has emerged from stealth with $100M in funding...",
      },
      timestamp: now - 6 * hour,
      accountId: DEMO_ACCOUNT_ID,
      attachments: [],
      snippet:
        "Good morning! Here are today's top stories: A mysterious AI startup has emerged from stealth...",
      labels: ['inbox', 'newsletter'],
      folder: 'inbox',
      read: false,
      starred: false,
      importance: 'low',
      attributes: { category: 'newsletter' },
    },
    // Read, starred, older
    {
      id: 'demo-5',
      threadId: 'thread-demo-5',
      from: { name: 'Jennifer Wu', email: 'jennifer.wu@client.org' },
      to: [{ name: 'You', email: 'user@example.com' }],
      subject: 'Contract renewal discussion',
      body: {
        text: 'Hi, I wanted to follow up on our conversation about the contract renewal. Can we schedule a call for next week?',
      },
      timestamp: now - 3 * day,
      accountId: DEMO_ACCOUNT_ID,
      attachments: [
        {
          id: 'att-2',
          filename: 'Contract_Draft_v2.docx',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          size: 45000,
          isInline: false,
        },
      ],
      snippet:
        'Hi, I wanted to follow up on our conversation about the contract renewal. Can we schedule...',
      labels: ['inbox'],
      folder: 'inbox',
      read: true,
      starred: true,
      importance: 'high',
      attributes: { client: 'Enterprise Co' },
    },
    // Read, low priority
    {
      id: 'demo-6',
      threadId: 'thread-demo-6',
      from: { name: 'Slack', email: 'feedback@slack.com' },
      to: [{ name: 'You', email: 'user@example.com' }],
      subject: 'Your weekly Slack activity summary',
      body: {
        text: "Here's your weekly activity summary: 127 messages sent, 45 channels active, 12 huddles joined.",
      },
      timestamp: now - 2 * day,
      accountId: DEMO_ACCOUNT_ID,
      attachments: [],
      snippet:
        "Here's your weekly activity summary: 127 messages sent, 45 channels active, 12 huddles...",
      labels: ['inbox'],
      folder: 'inbox',
      read: true,
      starred: false,
      importance: 'low',
      attributes: {},
    },
    // Unread, team thread
    {
      id: 'demo-7',
      threadId: 'thread-demo-7',
      from: { name: 'Mike Johnson', email: 'mike.j@team.io' },
      to: [{ name: 'You', email: 'user@example.com' }],
      cc: [{ name: 'Lisa Park', email: 'lisa@team.io' }],
      subject: 'Sprint retrospective notes',
      body: {
        text: "Team, Here are the key takeaways from yesterday's retro: 1. Better documentation needed 2. More pair programming 3. Celebrate wins more often!",
      },
      timestamp: now - 4 * hour,
      accountId: DEMO_ACCOUNT_ID,
      attachments: [],
      snippet:
        "Team, Here are the key takeaways from yesterday's retro: 1. Better documentation needed...",
      labels: ['inbox', 'team'],
      folder: 'inbox',
      read: false,
      starred: false,
      importance: 'normal',
      attributes: { sprint: '2024-Q4-S3' },
    },
    // Read, very old
    {
      id: 'demo-8',
      threadId: 'thread-demo-8',
      from: { name: 'Amazon Web Services', email: 'no-reply@aws.amazon.com' },
      to: [{ name: 'You', email: 'user@example.com' }],
      subject: 'Your December AWS bill is available',
      body: {
        text: 'Your AWS bill for December 2024 is now available. Total: $127.45. View your bill in the AWS Console.',
      },
      timestamp: now - 7 * day,
      accountId: DEMO_ACCOUNT_ID,
      attachments: [],
      snippet:
        'Your AWS bill for December 2024 is now available. Total: $127.45. View your bill...',
      labels: ['inbox'],
      folder: 'inbox',
      read: true,
      starred: false,
      importance: 'normal',
      attributes: { type: 'billing' },
    },
    // Unread, personal
    {
      id: 'demo-9',
      threadId: 'thread-demo-9',
      from: { name: 'Mom', email: 'mom@family.net' },
      to: [{ name: 'You', email: 'user@example.com' }],
      subject: 'Sunday dinner?',
      body: {
        text: 'Hey sweetie! Are you coming over for Sunday dinner? Dad is making his famous lasagna. Let me know! Love, Mom',
      },
      timestamp: now - 1 * hour,
      accountId: DEMO_ACCOUNT_ID,
      attachments: [],
      snippet:
        'Hey sweetie! Are you coming over for Sunday dinner? Dad is making his famous lasagna...',
      labels: ['inbox', 'personal'],
      folder: 'inbox',
      read: false,
      starred: false,
      importance: 'normal',
      attributes: {},
    },
    // Read with multiple attachments
    {
      id: 'demo-10',
      threadId: 'thread-demo-10',
      from: { name: 'Design Team', email: 'design@company.com' },
      to: [{ name: 'You', email: 'user@example.com' }],
      subject: 'Brand assets for the new website',
      body: {
        text: 'Hi! As requested, here are the brand assets for the website redesign. Please find attached: logo variants, color palette, and typography guide.',
      },
      timestamp: now - 5 * day,
      accountId: DEMO_ACCOUNT_ID,
      attachments: [
        {
          id: 'att-3',
          filename: 'Logo_Pack.zip',
          mimeType: 'application/zip',
          size: 2500000,
          isInline: false,
        },
        {
          id: 'att-4',
          filename: 'Brand_Colors.png',
          mimeType: 'image/png',
          size: 150000,
          isInline: false,
        },
        {
          id: 'att-5',
          filename: 'Typography_Guide.pdf',
          mimeType: 'application/pdf',
          size: 890000,
          isInline: false,
        },
      ],
      snippet:
        'Hi! As requested, here are the brand assets for the website redesign. Please find attached...',
      labels: ['inbox'],
      folder: 'inbox',
      read: true,
      starred: true,
      importance: 'normal',
      attributes: { project: 'Website Redesign' },
    },
  ]
}

/**
 * Helper to create collection with timeout (AJV validation can cause hang)
 */
async function createCollectionWithTimeout<T>(
  db: ReturnType<typeof getDatabase>,
  name: string,
  schema: T,
  timeoutMs: number = 5000
): Promise<boolean> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      logger.warn('db', `Collection ${name} creation timed out (AJV validation issue)`)
      resolve(false)
    }, timeoutMs)

    db.addCollections({ [name]: { schema } } as any)
      .then(() => {
        clearTimeout(timeout)
        logger.info('db', `${name} collection created`)
        resolve(true)
      })
      .catch((error) => {
        clearTimeout(timeout)
        logger.error('db', `Failed to create ${name} collection`, { error })
        resolve(false)
      })
  })
}

/**
 * Load demo data into the database
 */
export async function loadDemoData(): Promise<void> {
  const db = getDatabase()

  // Check if emails collection exists, create if needed
  if (!db.emails) {
    logger.info('db', 'Creating emails collection for demo mode...')
    const { emailSchema } = await import('@/services/database/schemas/email.schema')
    const success = await createCollectionWithTimeout(db, 'emails', emailSchema)
    if (!success) {
      logger.error('db', 'Cannot load demo data: emails collection creation failed/timed out')
      logger.error('db', 'Try refreshing the page or restarting the dev server')
      return
    }
  }

  // Check if attributes collection exists, create if needed
  if (!db.attributes) {
    logger.info('db', 'Creating attributes collection for demo mode...')
    const { attributeSchema } = await import('@/services/database/schemas/attribute.schema')
    // Don't block on attributes - emails can still be loaded
    await createCollectionWithTimeout(db, 'attributes', attributeSchema)
  }

  const demoEmails = generateDemoEmails()
  const demoAttributes = generateDemoAttributes()

  // Insert demo emails (upsert to avoid duplicates)
  let insertedCount = 0
  if (db.emails) {
    for (const email of demoEmails) {
      try {
        await db.emails.upsert(email)
        insertedCount++
      } catch (error) {
        logger.warn('db', `Failed to insert demo email ${email.id}`, { error })
      }
    }

    logger.info('db', `Loaded ${insertedCount}/${demoEmails.length} demo emails`)
  }

  // Insert demo attributes (upsert to avoid duplicates)
  if (db.attributes) {
    let attrInsertedCount = 0
    for (const attribute of demoAttributes) {
      try {
        await db.attributes.upsert(attribute)
        attrInsertedCount++
      } catch (error) {
        logger.warn('db', `Failed to insert demo attribute ${attribute.id}`, { error })
      }
    }
    logger.info('db', `Loaded ${attrInsertedCount}/${demoAttributes.length} demo attributes`)
  }
}

/**
 * Clear demo data from the database
 */
export async function clearDemoData(): Promise<void> {
  const db = getDatabase()

  // Remove demo emails
  if (db.emails) {
    const demoEmails = await db.emails
      .find({
        selector: { accountId: DEMO_ACCOUNT_ID },
      })
      .exec()

    for (const email of demoEmails) {
      await email.remove()
    }

    logger.info('db', `Cleared ${demoEmails.length} demo emails`)
  }

  // Remove demo attributes
  if (db.attributes) {
    const demoAttributes = await db.attributes
      .find({
        selector: { id: { $regex: '^demo-attr-' } },
      })
      .exec()

    for (const attr of demoAttributes) {
      await attr.remove()
    }

    logger.info('db', `Cleared ${demoAttributes.length} demo attributes`)
  }
}

/**
 * Check if demo data is loaded
 */
export async function isDemoDataLoaded(): Promise<boolean> {
  const db = getDatabase()

  if (!db.emails) {
    return false
  }

  const count = await db.emails
    .count({
      selector: { accountId: DEMO_ACCOUNT_ID },
    })
    .exec()

  return count > 0
}
