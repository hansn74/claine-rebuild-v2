import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest'
import { addRxPlugin } from 'rxdb'
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder'
import { initDatabase, closeDatabase, getDatabase, __resetDatabaseForTesting } from '../init'
import { create, read, readOne, update, remove, count, bulkInsert } from '../crud'

// Add required plugin for .limit() and .skip() methods
addRxPlugin(RxDBQueryBuilderPlugin)

// Test schema for a simple "notes" collection
const testSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object' as const,
  properties: {
    id: {
      type: 'string',
      maxLength: 100,
    },
    title: {
      type: 'string',
      maxLength: 200, // Required for indexed fields
    },
    content: {
      type: 'string',
    },
    createdAt: {
      type: 'string',
      format: 'date-time',
    },
    // Support soft delete timestamp (without underscore prefix)
    deletedAt: {
      type: 'string',
      format: 'date-time',
    },
  },
  required: ['id', 'title'],
  indexes: ['title'], // Add index for count queries
}

describe.sequential('CRUD Operations', () => {
  // Reuse same database name to avoid RxDB collection limit (16 collections max in open-source)
  const testDbName = 'testdb-crud'

  // Create database and collections once to avoid RxDB collection limit
  beforeAll(async () => {
    const db = await initDatabase(testDbName)
    await db.addCollections({
      notes: {
        schema: testSchema,
      },
    })
  })

  // Clear data between tests instead of destroying database
  beforeEach(async () => {
    const db = getDatabase()
    // Clear all documents from notes collection
    await db.notes.find().remove()
  })

  // Clean up after all tests complete
  afterAll(async () => {
    await closeDatabase(true)
    __resetDatabaseForTesting()
  })

  describe('create', () => {
    it('should create a new document', async () => {
      const testNote = {
        id: 'note-1',
        title: 'Test Note',
        content: 'This is a test',
        createdAt: new Date().toISOString(),
      }

      const doc = await create('notes', testNote)

      expect(doc).toBeDefined()
      expect(doc.id).toBe('note-1')
      expect(doc.title).toBe('Test Note')
    })

    it('should throw error for duplicate ID', async () => {
      const testNote = {
        id: 'note-1',
        title: 'Test Note',
        content: 'This is a test',
        createdAt: new Date().toISOString(),
      }

      await create('notes', testNote)

      await expect(create('notes', testNote)).rejects.toThrow('Document update conflict')
    })

    it('should throw error for invalid collection', async () => {
      await expect(create('invalid-collection', { id: 'test' })).rejects.toThrow(
        'Collection "invalid-collection" does not exist'
      )
    })

    it('should validate against schema', async () => {
      const invalidNote = {
        id: 'note-1',
        // Missing required 'title' field
        content: 'This is a test',
      }

      await expect(create('notes', invalidNote)).rejects.toThrow()
    })
  })

  describe('read', () => {
    beforeEach(async () => {
      // Insert test data
      await create('notes', {
        id: 'note-1',
        title: 'First Note',
        content: 'Content 1',
        createdAt: '2025-01-01T00:00:00Z',
      })
      await create('notes', {
        id: 'note-2',
        title: 'Second Note',
        content: 'Content 2',
        createdAt: '2025-01-02T00:00:00Z',
      })
      await create('notes', {
        id: 'note-3',
        title: 'Third Note',
        content: 'Content 3',
        createdAt: '2025-01-03T00:00:00Z',
      })
    })

    it('should read all documents', async () => {
      const docs = await read('notes')

      expect(docs).toHaveLength(3)
    })

    it('should read documents with query', async () => {
      const docs = await read('notes', {
        selector: { title: 'First Note' },
      })

      expect(docs).toHaveLength(1)
      expect(docs[0].title).toBe('First Note')
    })

    it('should support limit option', async () => {
      const docs = await read('notes', {}, { limit: 2 })

      expect(docs).toHaveLength(2)
    })

    it('should support skip option', async () => {
      const docs = await read('notes', {}, { skip: 1, limit: 2 })

      expect(docs).toHaveLength(2)
    })

    it('should support sorting', async () => {
      const docs = await read('notes', {}, { sort: { createdAt: -1 } })

      expect(docs[0].id).toBe('note-3') // Latest first
    })
  })

  describe('readOne', () => {
    beforeEach(async () => {
      await create('notes', {
        id: 'note-1',
        title: 'Test Note',
        content: 'Content',
        createdAt: new Date().toISOString(),
      })
    })

    it('should read a single document by ID', async () => {
      const doc = await readOne('notes', 'note-1')

      expect(doc).toBeDefined()
      expect(doc?.id).toBe('note-1')
    })

    it('should return null for non-existent document', async () => {
      const doc = await readOne('notes', 'non-existent')

      expect(doc).toBeNull()
    })
  })

  describe('update', () => {
    beforeEach(async () => {
      await create('notes', {
        id: 'note-1',
        title: 'Original Title',
        content: 'Original Content',
        createdAt: new Date().toISOString(),
      })
    })

    it('should update an existing document', async () => {
      const updatedDoc = await update('notes', 'note-1', {
        title: 'Updated Title',
      })

      expect(updatedDoc.title).toBe('Updated Title')
      expect(updatedDoc.content).toBe('Original Content') // Unchanged
    })

    it('should throw error for non-existent document', async () => {
      await expect(update('notes', 'non-existent', { title: 'New Title' })).rejects.toThrow(
        'not found'
      )
    })

    it('should upsert when document does not exist', async () => {
      const doc = await update(
        'notes',
        'note-2',
        {
          title: 'New Note',
          content: 'New Content',
          createdAt: new Date().toISOString(),
        },
        { upsert: true }
      )

      expect(doc.id).toBe('note-2')
      expect(doc.title).toBe('New Note')
    })
  })

  describe('remove', () => {
    beforeEach(async () => {
      await create('notes', {
        id: 'note-1',
        title: 'Test Note',
        content: 'Content',
        createdAt: new Date().toISOString(),
      })
    })

    it('should delete a document', async () => {
      const result = await remove('notes', 'note-1')

      expect(result).toBe(true)

      const doc = await readOne('notes', 'note-1')
      expect(doc).toBeNull()
    })

    it('should return false for non-existent document', async () => {
      const result = await remove('notes', 'non-existent')

      expect(result).toBe(false)
    })

    it('should soft delete when option is enabled', async () => {
      await remove('notes', 'note-1', { softDelete: true })

      // Verify soft delete by checking deletedAt field
      const doc = await readOne('notes', 'note-1')
      expect(doc).not.toBeNull()
      expect(doc?.deletedAt).toBeDefined()

      // Verify document still exists (not hard deleted)
      const allDocs = await read('notes')
      expect(allDocs.length).toBe(1)
    })
  })

  describe('count', () => {
    beforeEach(async () => {
      await create('notes', {
        id: 'note-1',
        title: 'First',
        content: 'Content 1',
        createdAt: new Date().toISOString(),
      })
      await create('notes', {
        id: 'note-2',
        title: 'Second',
        content: 'Content 2',
        createdAt: new Date().toISOString(),
      })
    })

    it('should count all documents', async () => {
      const total = await count('notes')

      expect(total).toBe(2)
    })

    it('should count documents with query', async () => {
      const total = await count('notes', {
        selector: { title: 'First' },
      })

      expect(total).toBe(1)
    })
  })

  describe('bulkInsert', () => {
    it('should insert multiple documents', async () => {
      const notes = [
        {
          id: 'note-1',
          title: 'First',
          content: 'Content 1',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'note-2',
          title: 'Second',
          content: 'Content 2',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'note-3',
          title: 'Third',
          content: 'Content 3',
          createdAt: new Date().toISOString(),
        },
      ]

      const docs = await bulkInsert('notes', notes)

      expect(docs).toHaveLength(3)

      const allDocs = await read('notes')
      expect(allDocs).toHaveLength(3)
    })
  })
})
