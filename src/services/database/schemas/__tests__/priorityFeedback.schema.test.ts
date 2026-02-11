/**
 * Priority Feedback Schema Tests
 *
 * Story 3.6: Manual Priority Adjustment & Feedback Loop
 * Task 9: Schema validation and document structure tests
 */

import { describe, it, expect } from 'vitest'
import { priorityFeedbackSchema, type PriorityFeedbackDocument } from '../priorityFeedback.schema'

describe('priorityFeedbackSchema', () => {
  it('has version 0', () => {
    expect(priorityFeedbackSchema.version).toBe(0)
  })

  it('uses id as primary key', () => {
    expect(priorityFeedbackSchema.primaryKey).toBe('id')
  })

  it('defines all required fields', () => {
    expect(priorityFeedbackSchema.required).toContain('id')
    expect(priorityFeedbackSchema.required).toContain('emailId')
    expect(priorityFeedbackSchema.required).toContain('accountId')
    expect(priorityFeedbackSchema.required).toContain('senderEmail')
    expect(priorityFeedbackSchema.required).toContain('newPriority')
    expect(priorityFeedbackSchema.required).toContain('feedbackType')
    expect(priorityFeedbackSchema.required).toContain('createdAt')
  })

  it('defines indexes for accountId+createdAt, senderEmail, and emailId', () => {
    const indexes = priorityFeedbackSchema.indexes!
    expect(indexes).toContainEqual(['accountId', 'createdAt'])
    expect(indexes).toContain('senderEmail')
    expect(indexes).toContain('emailId')
  })

  it('allows null for original fields', () => {
    const props = priorityFeedbackSchema.properties
    expect((props.originalPriority as { type: string[] }).type).toContain('null')
    expect((props.originalScore as { type: string[] }).type).toContain('null')
    expect((props.originalConfidence as { type: string[] }).type).toContain('null')
    expect((props.originalModelVersion as { type: string[] }).type).toContain('null')
  })

  it('constrains feedbackType to override or confirm', () => {
    const feedbackTypeSchema = priorityFeedbackSchema.properties.feedbackType as { enum: string[] }
    expect(feedbackTypeSchema.enum).toEqual(['override', 'confirm'])
  })

  it('constrains newPriority to valid values', () => {
    const newPrioritySchema = priorityFeedbackSchema.properties.newPriority as { enum: string[] }
    expect(newPrioritySchema.enum).toEqual(['high', 'medium', 'low', 'none'])
  })

  it('satisfies PriorityFeedbackDocument interface shape', () => {
    const doc: PriorityFeedbackDocument = {
      id: 'pf-1',
      emailId: 'email-1',
      accountId: 'account-1',
      senderEmail: 'sender@test.com',
      originalPriority: 'high',
      originalScore: 85,
      originalConfidence: 90,
      originalModelVersion: 'test-model-v1',
      newPriority: 'low',
      feedbackType: 'override',
      createdAt: Date.now(),
    }
    expect(doc.id).toBe('pf-1')
    expect(doc.feedbackType).toBe('override')
  })
})
