import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createRxDatabase, addRxPlugin, type RxDatabase } from 'rxdb'
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie'
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv'
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode'
import { aiMetadataSchema, type AIMetadataDocument } from '../aiMetadata.schema'

addRxPlugin(RxDBDevModePlugin)

describe('AI Metadata Schema', () => {
  let db: RxDatabase

  beforeEach(async () => {
    db = await createRxDatabase({
      name: `test-ai-metadata-schema-${Date.now()}`,
      storage: wrappedValidateAjvStorage({ storage: getRxStorageDexie() }),
      multiInstance: false,
      ignoreDuplicate: true,
    })

    await db.addCollections({
      aimetadata: {
        schema: aiMetadataSchema,
      },
    })
  })

  afterEach(async () => {
    if (db) {
      await db.remove()
    }
  })

  describe('Required Fields', () => {
    it('should validate required fields are present', async () => {
      const validMetadata: AIMetadataDocument = {
        id: 'ai-meta-1',
        emailId: 'email-123',
        triageScore: 85,
        priority: 'high',
        suggestedAttributes: {
          Project: { value: 'Alpha', confidence: 90 },
          Status: { value: 'To-Do', confidence: 85 },
        },
        confidence: 85,
        reasoning: 'Email contains project-related keywords and has urgent tone',
        modelVersion: 'v1.0.0',
        processedAt: Date.now(),
      }

      const doc = await db.aimetadata.insert(validMetadata)
      expect(doc.id).toBe('ai-meta-1')
      expect(doc.emailId).toBe('email-123')
      expect(doc.triageScore).toBe(85)
    })

    it('should reject metadata missing required field', async () => {
      const invalidMetadata = {
        id: 'ai-meta-2',
        emailId: 'email-456',
        triageScore: 75,
        priority: 'medium',
        // Missing: suggestedAttributes, confidence, reasoning, modelVersion, processedAt
      }

      await expect(db.aimetadata.insert(invalidMetadata)).rejects.toThrow()
    })
  })

  describe('Confidence Score Validation', () => {
    it('should accept valid confidence scores (0-100)', async () => {
      const metadata: AIMetadataDocument = {
        id: 'ai-meta-3',
        emailId: 'email-789',
        triageScore: 0, // Minimum valid
        priority: 'none',
        suggestedAttributes: {},
        confidence: 100, // Maximum valid
        reasoning: 'Test',
        modelVersion: 'v1.0',
        processedAt: Date.now(),
      }

      const doc = await db.aimetadata.insert(metadata)
      expect(doc.triageScore).toBe(0)
      expect(doc.confidence).toBe(100)
    })

    it('should reject confidence score >100', async () => {
      const invalidMetadata = {
        id: 'ai-meta-4',
        emailId: 'email-abc',
        triageScore: 150, // Invalid: >100
        priority: 'high',
        suggestedAttributes: {},
        confidence: 85,
        reasoning: 'Test',
        modelVersion: 'v1.0',
        processedAt: Date.now(),
      }

      await expect(db.aimetadata.insert(invalidMetadata)).rejects.toThrow()
    })

    it('should reject confidence score <0', async () => {
      const invalidMetadata = {
        id: 'ai-meta-5',
        emailId: 'email-def',
        triageScore: -10, // Invalid: <0
        priority: 'high',
        suggestedAttributes: {},
        confidence: 85,
        reasoning: 'Test',
        modelVersion: 'v1.0',
        processedAt: Date.now(),
      }

      await expect(db.aimetadata.insert(invalidMetadata)).rejects.toThrow()
    })
  })

  describe('Priority Enum Validation', () => {
    it('should accept valid priority values', async () => {
      const priorities: Array<'high' | 'medium' | 'low' | 'none'> = [
        'high',
        'medium',
        'low',
        'none',
      ]

      for (let i = 0; i < priorities.length; i++) {
        const metadata: AIMetadataDocument = {
          id: `ai-meta-priority-${i}`,
          emailId: `email-${i}`,
          triageScore: 50,
          priority: priorities[i],
          suggestedAttributes: {},
          confidence: 50,
          reasoning: 'Test',
          modelVersion: 'v1.0',
          processedAt: Date.now(),
        }

        const doc = await db.aimetadata.insert(metadata)
        expect(doc.priority).toBe(priorities[i])
      }
    })

    it('should reject invalid priority value', async () => {
      const invalidMetadata = {
        id: 'ai-meta-6',
        emailId: 'email-ghi',
        triageScore: 85,
        priority: 'critical', // Invalid enum value
        suggestedAttributes: {},
        confidence: 85,
        reasoning: 'Test',
        modelVersion: 'v1.0',
        processedAt: Date.now(),
      }

      await expect(db.aimetadata.insert(invalidMetadata)).rejects.toThrow()
    })
  })

  describe('Suggested Attributes', () => {
    it('should accept flexible suggestedAttributes structure', async () => {
      const metadata: AIMetadataDocument = {
        id: 'ai-meta-7',
        emailId: 'email-jkl',
        triageScore: 90,
        priority: 'high',
        suggestedAttributes: {
          Project: { value: 'Alpha', confidence: 95 },
          Status: { value: 'In-Progress', confidence: 88 },
          Priority: { value: 'High', confidence: 92 },
          DueDate: { value: '2025-12-31', confidence: 75 },
          IsUrgent: { value: true, confidence: 90 },
          EstimatedHours: { value: 5.5, confidence: 60 },
        },
        confidence: 85,
        reasoning: 'Multiple high-confidence signals detected',
        modelVersion: 'v1.2.0',
        processedAt: Date.now(),
      }

      const doc = await db.aimetadata.insert(metadata)
      expect(Object.keys(doc.suggestedAttributes).length).toBe(6)
      expect(doc.suggestedAttributes.Project.value).toBe('Alpha')
      expect(doc.suggestedAttributes.IsUrgent.value).toBe(true)
      expect(doc.suggestedAttributes.EstimatedHours.value).toBe(5.5)
    })
  })

  describe('Model Version Tracking', () => {
    it('should accept modelVersion string', async () => {
      const metadata: AIMetadataDocument = {
        id: 'ai-meta-8',
        emailId: 'email-mno',
        triageScore: 80,
        priority: 'medium',
        suggestedAttributes: {},
        confidence: 80,
        reasoning: 'Standard processing',
        modelVersion: 'ollama-llama3.2:3b-v2.1',
        processedAt: Date.now(),
      }

      const doc = await db.aimetadata.insert(metadata)
      expect(doc.modelVersion).toBe('ollama-llama3.2:3b-v2.1')
    })
  })

  describe('Indexes', () => {
    it('should have emailId index for lookups', () => {
      const indexes = aiMetadataSchema.indexes || []
      expect(indexes).toContain('emailId')
    })

    it('should have processedAt index for chronological queries', () => {
      const indexes = aiMetadataSchema.indexes || []
      expect(indexes).toContain('processedAt')
    })

    it('should have modelVersion index for tracking', () => {
      const indexes = aiMetadataSchema.indexes || []
      expect(indexes).toContain('modelVersion')
    })
  })
})
