import type { RxJsonSchema } from 'rxdb'

/**
 * AI Metadata document type for storing detailed AI processing history
 * This collection stores comprehensive AI analysis results separately from emails
 * allowing for historical tracking and analysis of AI processing evolution
 *
 * Note: Emails also have embedded aiMetadata for convenience.
 * This collection is for detailed processing history and analytics.
 */
export interface AIMetadataDocument {
  id: string // Primary key - metadata identifier
  emailId: string // Foreign key to email collection
  triageScore: number // AI triage score (0-100)
  priority: 'high' | 'medium' | 'low' | 'none' // AI-suggested priority
  suggestedAttributes: {
    [key: string]: {
      value: string | number | boolean
      confidence: number // Confidence score (0-100)
    }
  }
  confidence: number // Overall confidence (0-100)
  reasoning: string // Explainable reasoning
  modelVersion: string // AI model version
  processedAt: number // Unix timestamp
}

/**
 * RxDB schema for AI Metadata collection
 * Version 0 - Initial schema design
 *
 * Indexes:
 * - emailId: For looking up AI metadata by email
 * - processedAt: For chronological queries
 * - modelVersion: For tracking which model versions processed which emails
 */
export const aiMetadataSchema: RxJsonSchema<AIMetadataDocument> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 200,
    },
    emailId: {
      type: 'string',
      maxLength: 200,
    },
    triageScore: {
      type: 'number',
      minimum: 0,
      maximum: 100,
    },
    priority: {
      type: 'string',
      enum: ['high', 'medium', 'low', 'none'],
    },
    suggestedAttributes: {
      type: 'object',
      additionalProperties: true, // Flexible structure for AI suggestions
    },
    confidence: {
      type: 'number',
      minimum: 0,
      maximum: 100,
    },
    reasoning: {
      type: 'string',
      maxLength: 5000,
    },
    modelVersion: {
      type: 'string',
      maxLength: 100,
    },
    processedAt: {
      type: 'number',
      minimum: 0,
      maximum: 9999999999999, // Year 2286
      multipleOf: 1,
    },
  },
  required: [
    'id',
    'emailId',
    'triageScore',
    'priority',
    'suggestedAttributes',
    'confidence',
    'reasoning',
    'modelVersion',
    'processedAt',
  ],
  indexes: [
    'emailId', // Lookup AI metadata by email
    'processedAt', // Chronological queries
    'modelVersion', // Track model version usage
  ],
}
