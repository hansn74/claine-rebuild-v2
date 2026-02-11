/**
 * Email Analysis Tests
 *
 * Story 3.2: Email Analysis Engine
 * Task 1: Feature extraction tests
 */

import { describe, it, expect, vi } from 'vitest'
import { extractEmailFeatures, buildAnalysisPrompt, parseAnalysisResponse } from '../emailAnalysis'
import type { EmailDocument } from '@/services/database/schemas/email.schema'

vi.mock('@/services/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

function createEmail(overrides?: Partial<EmailDocument>): EmailDocument {
  return {
    id: 'email-1',
    threadId: 'thread-1',
    from: { name: 'Alice Smith', email: 'alice@example.com' },
    to: [{ name: 'Bob Jones', email: 'bob@company.com' }],
    subject: 'Project update',
    body: { text: 'Here is the latest project status.' },
    timestamp: Date.now(),
    accountId: 'account-1',
    attachments: [],
    snippet: 'Here is the latest project status.',
    labels: ['inbox'],
    folder: 'inbox',
    read: false,
    starred: false,
    importance: 'normal' as const,
    attributes: {},
    ...overrides,
  }
}

describe('extractEmailFeatures', () => {
  it('should extract basic features', () => {
    const email = createEmail()
    const features = extractEmailFeatures(email)

    expect(features.emailId).toBe('email-1')
    expect(features.senderEmail).toBe('alice@example.com')
    expect(features.senderDomain).toBe('example.com')
    expect(features.isAutomatedSender).toBe(false)
    expect(features.subject).toBe('Project update')
    expect(features.isReply).toBe(false)
    expect(features.isForward).toBe(false)
    expect(features.hasAttachments).toBe(false)
    expect(features.recipientCount).toBe(1)
    expect(features.threadId).toBe('thread-1')
  })

  it('should detect reply prefix', () => {
    const features = extractEmailFeatures(createEmail({ subject: 'Re: Project update' }))
    expect(features.isReply).toBe(true)
    expect(features.isForward).toBe(false)
  })

  it('should detect forward prefix', () => {
    const features = extractEmailFeatures(createEmail({ subject: 'Fwd: Project update' }))
    expect(features.isForward).toBe(true)
  })

  it('should detect automated sender', () => {
    const features = extractEmailFeatures(
      createEmail({ from: { name: 'System', email: 'noreply@service.com' } })
    )
    expect(features.isAutomatedSender).toBe(true)
  })

  it('should detect urgency keywords', () => {
    const features = extractEmailFeatures(
      createEmail({
        subject: 'URGENT: Need response ASAP',
        body: { text: 'This is urgent and needs immediate attention.' },
      })
    )
    expect(features.urgencyKeywords).toContain('urgent')
    expect(features.urgencyKeywords).toContain('asap')
    expect(features.urgencyScore).toBeGreaterThan(0)
  })

  it('should detect deadline content signal', () => {
    const features = extractEmailFeatures(
      createEmail({
        body: { text: 'The deadline is end of day Friday.' },
      })
    )
    expect(features.contentSignals).toContain('deadline')
  })

  it('should detect question content signal', () => {
    const features = extractEmailFeatures(
      createEmail({
        body: { text: 'Can you review this document and let me know?' },
      })
    )
    expect(features.contentSignals).toContain('question')
  })

  it('should detect request content signal', () => {
    const features = extractEmailFeatures(
      createEmail({
        body: { text: 'Please send me the report by tomorrow.' },
      })
    )
    expect(features.contentSignals).toContain('request')
  })

  it('should detect meeting signal', () => {
    const features = extractEmailFeatures(
      createEmail({
        body: { text: "Let's schedule a meeting to discuss this." },
      })
    )
    expect(features.contentSignals).toContain('meeting')
  })

  it('should detect newsletter signal', () => {
    const features = extractEmailFeatures(
      createEmail({
        body: { text: 'Weekly digest. Click here to unsubscribe from these emails.' },
      })
    )
    expect(features.contentSignals).toContain('newsletter')
  })

  it('should detect automated signal from noreply sender', () => {
    const features = extractEmailFeatures(
      createEmail({
        from: { name: 'Notifications', email: 'notifications@github.com' },
        body: { text: 'You have a new pull request.' },
      })
    )
    expect(features.contentSignals).toContain('automated')
  })

  it('should count recipients including cc', () => {
    const features = extractEmailFeatures(
      createEmail({
        to: [
          { name: 'Bob', email: 'bob@co.com' },
          { name: 'Charlie', email: 'charlie@co.com' },
        ],
        cc: [{ name: 'Dave', email: 'dave@co.com' }],
      })
    )
    expect(features.recipientCount).toBe(3)
  })

  it('should extract plain text from HTML body', () => {
    const features = extractEmailFeatures(
      createEmail({
        body: {
          html: '<p>Hello <b>World</b></p><style>.hidden{}</style>',
          text: undefined,
        },
      })
    )
    expect(features.bodyText).toContain('Hello')
    expect(features.bodyText).toContain('World')
    expect(features.bodyText).not.toContain('<p>')
    expect(features.bodyText).not.toContain('.hidden')
  })

  it('should fall back to snippet when no body', () => {
    const features = extractEmailFeatures(
      createEmail({
        body: {},
        snippet: 'Preview text here',
      })
    )
    expect(features.bodyText).toBe('Preview text here')
  })

  it('should detect attachments', () => {
    const features = extractEmailFeatures(
      createEmail({
        attachments: [
          {
            id: 'att-1',
            filename: 'doc.pdf',
            mimeType: 'application/pdf',
            size: 1000,
            isInline: false,
          },
        ],
      })
    )
    expect(features.hasAttachments).toBe(true)
  })
})

describe('buildAnalysisPrompt', () => {
  it('should build prompt with email features', () => {
    const features = extractEmailFeatures(createEmail())
    const { systemPrompt, userPrompt } = buildAnalysisPrompt(features)

    expect(systemPrompt).toContain('priority')
    expect(systemPrompt).toContain('JSON')
    expect(userPrompt).toContain('alice@example.com')
    expect(userPrompt).toContain('Project update')
  })

  it('should include sender context when provided', () => {
    const features = extractEmailFeatures(createEmail())
    const { userPrompt } = buildAnalysisPrompt(features, 'Frequent contact (15 emails in 30 days)')
    expect(userPrompt).toContain('Frequent contact')
  })

  it('should include thread context when provided', () => {
    const features = extractEmailFeatures(createEmail())
    const { userPrompt } = buildAnalysisPrompt(
      features,
      undefined,
      'Thread with 5 messages, 3 participants'
    )
    expect(userPrompt).toContain('Thread with 5 messages')
  })

  it('should include urgency keywords when detected', () => {
    const features = extractEmailFeatures(
      createEmail({
        subject: 'URGENT: Need help',
        body: { text: 'This is urgent!' },
      })
    )
    const { userPrompt } = buildAnalysisPrompt(features)
    expect(userPrompt).toContain('Urgency keywords detected')
    expect(userPrompt).toContain('urgent')
  })
})

describe('parseAnalysisResponse', () => {
  it('should parse valid JSON response', () => {
    const result = parseAnalysisResponse(
      '{"priority":"high","score":85,"reasoning":"Client deadline","signals":["deadline","request"]}'
    )
    expect(result).not.toBeNull()
    expect(result!.priority).toBe('high')
    expect(result!.score).toBe(85)
    expect(result!.reasoning).toBe('Client deadline')
    expect(result!.signals).toContain('deadline')
    expect(result!.signals).toContain('request')
  })

  it('should extract JSON from surrounding text', () => {
    const result = parseAnalysisResponse(
      'Here is the analysis: {"priority":"low","score":20,"reasoning":"Newsletter","signals":["newsletter"]}'
    )
    expect(result).not.toBeNull()
    expect(result!.priority).toBe('low')
  })

  it('should clamp score to 0-100', () => {
    const result = parseAnalysisResponse(
      '{"priority":"high","score":150,"reasoning":"test","signals":[]}'
    )
    expect(result!.score).toBe(100)
  })

  it('should default invalid priority to none', () => {
    const result = parseAnalysisResponse(
      '{"priority":"critical","score":90,"reasoning":"test","signals":[]}'
    )
    expect(result!.priority).toBe('none')
  })

  it('should filter invalid signals', () => {
    const result = parseAnalysisResponse(
      '{"priority":"high","score":80,"reasoning":"test","signals":["deadline","invalid","question"]}'
    )
    expect(result!.signals).toEqual(['deadline', 'question'])
  })

  it('should return null for non-JSON response', () => {
    const result = parseAnalysisResponse('I cannot analyze this email.')
    expect(result).toBeNull()
  })

  it('should return null for malformed JSON', () => {
    const result = parseAnalysisResponse('{invalid json}')
    expect(result).toBeNull()
  })
})
