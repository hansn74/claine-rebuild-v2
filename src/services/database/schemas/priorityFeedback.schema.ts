/**
 * Priority Feedback Schema
 *
 * Story 3.6: Manual Priority Adjustment & Feedback Loop
 * Task 1: RxDB schema for storing user priority feedback
 *
 * Records user corrections to AI priority assignments,
 * enabling the system to learn from feedback patterns.
 */

import type { RxJsonSchema } from 'rxdb'
import type { Priority } from '@/services/ai/priorityDisplay'

export interface PriorityFeedbackDocument {
  id: string
  emailId: string
  accountId: string
  senderEmail: string
  originalPriority: Priority | null
  originalScore: number | null
  originalConfidence: number | null
  originalModelVersion: string | null
  newPriority: Priority
  feedbackType: 'override' | 'confirm'
  createdAt: number
}

export const priorityFeedbackSchema: RxJsonSchema<PriorityFeedbackDocument> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 100,
    },
    emailId: {
      type: 'string',
      maxLength: 200,
    },
    accountId: {
      type: 'string',
      maxLength: 100,
    },
    senderEmail: {
      type: 'string',
      maxLength: 320,
    },
    originalPriority: {
      type: ['string', 'null'],
      maxLength: 20,
    },
    originalScore: {
      type: ['number', 'null'],
      minimum: 0,
      maximum: 100,
    },
    originalConfidence: {
      type: ['number', 'null'],
      minimum: 0,
      maximum: 100,
    },
    originalModelVersion: {
      type: ['string', 'null'],
      maxLength: 100,
    },
    newPriority: {
      type: 'string',
      enum: ['high', 'medium', 'low', 'none'],
      maxLength: 20,
    },
    feedbackType: {
      type: 'string',
      enum: ['override', 'confirm'],
      maxLength: 20,
    },
    createdAt: {
      type: 'number',
      minimum: 0,
      maximum: 9999999999999,
      multipleOf: 1,
    },
  },
  required: [
    'id',
    'emailId',
    'accountId',
    'senderEmail',
    'newPriority',
    'feedbackType',
    'createdAt',
  ],
  indexes: [['accountId', 'createdAt'], 'senderEmail', 'emailId'],
}
