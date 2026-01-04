import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createRxDatabase, addRxPlugin, type RxDatabase } from 'rxdb'
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie'
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv'
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode'
import { attributeSchema, ATTRIBUTE_TYPES, type AttributeDocument } from '../attribute.schema'

// Add dev mode plugin for validation
addRxPlugin(RxDBDevModePlugin)

describe('Attribute Schema', () => {
  let db: RxDatabase

  beforeEach(async () => {
    // Create a test database with validation
    db = await createRxDatabase({
      name: `test-attribute-schema-${Date.now()}`,
      storage: wrappedValidateAjvStorage({ storage: getRxStorageDexie() }),
      multiInstance: false,
      ignoreDuplicate: true,
    })

    // Add attributes collection
    await db.addCollections({
      attributes: {
        schema: attributeSchema,
      },
    })
  })

  afterEach(async () => {
    if (db) {
      await db.remove()
    }
  })

  describe('Required Fields', () => {
    it('should validate all required fields are present', async () => {
      const validAttribute: AttributeDocument = {
        id: 'attr-test-1',
        name: 'status',
        displayName: 'Status',
        type: 'enum',
        values: [
          { value: 'todo', label: 'To-Do', color: '#ef4444' },
          { value: 'done', label: 'Done', color: '#22c55e' },
        ],
        isBuiltIn: false,
        enabled: true,
        order: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      const doc = await db.attributes.insert(validAttribute)
      expect(doc.id).toBe('attr-test-1')
      expect(doc.name).toBe('status')
      expect(doc.displayName).toBe('Status')
      expect(doc.type).toBe('enum')
    })

    it('should reject attribute missing required field (name)', async () => {
      const invalidAttribute = {
        id: 'attr-test-2',
        // Missing 'name' field
        displayName: 'Test',
        type: 'text',
        isBuiltIn: false,
        enabled: true,
        order: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      await expect(db.attributes.insert(invalidAttribute)).rejects.toThrow()
    })

    it('should reject attribute missing required field (type)', async () => {
      const invalidAttribute = {
        id: 'attr-test-3',
        name: 'test',
        displayName: 'Test',
        // Missing 'type' field
        isBuiltIn: false,
        enabled: true,
        order: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      await expect(db.attributes.insert(invalidAttribute)).rejects.toThrow()
    })
  })

  describe('Attribute Types', () => {
    it('should accept all valid attribute types', async () => {
      const types: Array<'enum' | 'text' | 'date' | 'boolean' | 'number'> = [
        'enum',
        'text',
        'date',
        'boolean',
        'number',
      ]

      for (const type of types) {
        const attribute: AttributeDocument = {
          id: `attr-type-${type}`,
          name: `test_${type}`,
          displayName: `Test ${type}`,
          type,
          isBuiltIn: false,
          enabled: true,
          order: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }

        // Add values for enum type
        if (type === 'enum') {
          attribute.values = [{ value: 'opt1', label: 'Option 1' }]
        }

        const doc = await db.attributes.insert(attribute)
        expect(doc.type).toBe(type)
      }
    })

    it('should have ATTRIBUTE_TYPES constant with all types', () => {
      expect(ATTRIBUTE_TYPES).toEqual(['enum', 'text', 'date', 'boolean', 'number'])
    })

    it('should reject invalid attribute type', async () => {
      const invalidAttribute = {
        id: 'attr-invalid-type',
        name: 'test',
        displayName: 'Test',
        type: 'invalid-type', // Invalid type
        isBuiltIn: false,
        enabled: true,
        order: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      await expect(db.attributes.insert(invalidAttribute)).rejects.toThrow()
    })
  })

  describe('Enum Values', () => {
    it('should accept enum attribute with values array', async () => {
      const enumAttribute: AttributeDocument = {
        id: 'attr-enum-1',
        name: 'priority',
        displayName: 'Priority',
        type: 'enum',
        values: [
          { value: 'high', label: 'High', color: '#ef4444' },
          { value: 'medium', label: 'Medium', color: '#f59e0b' },
          { value: 'low', label: 'Low', color: '#6b7280' },
        ],
        isBuiltIn: true,
        enabled: true,
        order: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      const doc = await db.attributes.insert(enumAttribute)
      expect(doc.values).toHaveLength(3)
      expect(doc.values![0]).toEqual({ value: 'high', label: 'High', color: '#ef4444' })
      expect(doc.values![1].value).toBe('medium')
      expect(doc.values![2].label).toBe('Low')
    })

    it('should accept enum value without optional color', async () => {
      const enumAttribute: AttributeDocument = {
        id: 'attr-enum-2',
        name: 'context',
        displayName: 'Context',
        type: 'enum',
        values: [
          { value: 'work', label: 'Work' }, // No color
          { value: 'personal', label: 'Personal' },
        ],
        isBuiltIn: false,
        enabled: true,
        order: 2,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      const doc = await db.attributes.insert(enumAttribute)
      expect(doc.values![0].color).toBeUndefined()
    })

    it('should reject enum value missing required field (label)', async () => {
      const invalidAttribute = {
        id: 'attr-enum-invalid',
        name: 'test',
        displayName: 'Test',
        type: 'enum',
        values: [
          { value: 'opt1' }, // Missing label
        ],
        isBuiltIn: false,
        enabled: true,
        order: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      await expect(db.attributes.insert(invalidAttribute)).rejects.toThrow()
    })
  })

  describe('Optional Fields', () => {
    it('should accept optional defaultValue', async () => {
      const attribute: AttributeDocument = {
        id: 'attr-default-1',
        name: 'status',
        displayName: 'Status',
        type: 'enum',
        values: [
          { value: 'todo', label: 'To-Do' },
          { value: 'done', label: 'Done' },
        ],
        defaultValue: 'todo',
        isBuiltIn: false,
        enabled: true,
        order: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      const doc = await db.attributes.insert(attribute)
      expect(doc.defaultValue).toBe('todo')
    })

    it('should accept optional color', async () => {
      const attribute: AttributeDocument = {
        id: 'attr-color-1',
        name: 'project',
        displayName: 'Project',
        type: 'text',
        color: '#3b82f6',
        isBuiltIn: false,
        enabled: true,
        order: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      const doc = await db.attributes.insert(attribute)
      expect(doc.color).toBe('#3b82f6')
    })

    it('should accept optional icon', async () => {
      const attribute: AttributeDocument = {
        id: 'attr-icon-1',
        name: 'category',
        displayName: 'Category',
        type: 'text',
        icon: 'tag',
        isBuiltIn: false,
        enabled: true,
        order: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      const doc = await db.attributes.insert(attribute)
      expect(doc.icon).toBe('tag')
    })
  })

  describe('Built-in Presets', () => {
    it('should accept built-in attribute with isBuiltIn=true', async () => {
      const builtInAttribute: AttributeDocument = {
        id: 'preset-status',
        name: 'status',
        displayName: 'Status',
        type: 'enum',
        values: [
          { value: 'todo', label: 'To-Do', color: '#22c55e' },
          { value: 'in-progress', label: 'In Progress', color: '#f59e0b' },
          { value: 'waiting', label: 'Waiting', color: '#ef4444' },
          { value: 'done', label: 'Done', color: '#3b82f6' },
        ],
        isBuiltIn: true,
        enabled: true,
        order: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      const doc = await db.attributes.insert(builtInAttribute)
      expect(doc.isBuiltIn).toBe(true)
    })

    it('should support disabling attributes with enabled=false', async () => {
      const disabledAttribute: AttributeDocument = {
        id: 'attr-disabled-1',
        name: 'archived',
        displayName: 'Archived',
        type: 'boolean',
        enabled: false,
        isBuiltIn: true,
        order: 10,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      const doc = await db.attributes.insert(disabledAttribute)
      expect(doc.enabled).toBe(false)
    })
  })

  describe('Ordering', () => {
    it('should accept order as non-negative integer', async () => {
      const attribute: AttributeDocument = {
        id: 'attr-order-1',
        name: 'test',
        displayName: 'Test',
        type: 'text',
        isBuiltIn: false,
        enabled: true,
        order: 5,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      const doc = await db.attributes.insert(attribute)
      expect(doc.order).toBe(5)
    })

    it('should reject negative order', async () => {
      const invalidAttribute = {
        id: 'attr-order-invalid',
        name: 'test',
        displayName: 'Test',
        type: 'text',
        isBuiltIn: false,
        enabled: true,
        order: -1, // Invalid negative order
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      await expect(db.attributes.insert(invalidAttribute)).rejects.toThrow()
    })
  })

  describe('Timestamps', () => {
    it('should accept valid timestamp values', async () => {
      const now = Date.now()
      const attribute: AttributeDocument = {
        id: 'attr-timestamps-1',
        name: 'test',
        displayName: 'Test',
        type: 'text',
        isBuiltIn: false,
        enabled: true,
        order: 0,
        createdAt: now,
        updatedAt: now,
      }

      const doc = await db.attributes.insert(attribute)
      expect(doc.createdAt).toBe(now)
      expect(doc.updatedAt).toBe(now)
    })
  })

  describe('String Length Constraints', () => {
    it('should reject name exceeding maxLength (50 chars)', async () => {
      const invalidAttribute = {
        id: 'attr-name-long',
        name: 'a'.repeat(51), // 51 chars, exceeds 50 max
        displayName: 'Test',
        type: 'text',
        isBuiltIn: false,
        enabled: true,
        order: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      await expect(db.attributes.insert(invalidAttribute)).rejects.toThrow()
    })

    it('should accept name at maxLength (50 chars)', async () => {
      const attribute: AttributeDocument = {
        id: 'attr-name-max',
        name: 'a'.repeat(50), // Exactly 50 chars
        displayName: 'Test',
        type: 'text',
        isBuiltIn: false,
        enabled: true,
        order: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      const doc = await db.attributes.insert(attribute)
      expect(doc.name.length).toBe(50)
    })
  })

  describe('Indexes', () => {
    it('should have name index for unique lookup', () => {
      const indexes = attributeSchema.indexes || []
      expect(indexes).toContain('name')
    })

    it('should have order index for sorted display', () => {
      const indexes = attributeSchema.indexes || []
      expect(indexes).toContain('order')
    })

    it('should have enabled index for filtering active attributes', () => {
      const indexes = attributeSchema.indexes || []
      expect(indexes).toContain('enabled')
    })

    it('should have isBuiltIn index for separating presets', () => {
      const indexes = attributeSchema.indexes || []
      expect(indexes).toContain('isBuiltIn')
    })

    it('should have compound index for enabled + order', () => {
      const indexes = attributeSchema.indexes || []
      const hasCompoundIndex = indexes.some(
        (idx) => Array.isArray(idx) && idx.includes('enabled') && idx.includes('order')
      )
      expect(hasCompoundIndex).toBe(true)
    })
  })

  describe('Complete Attribute Scenarios', () => {
    it('should create complete Status preset', async () => {
      const statusPreset: AttributeDocument = {
        id: 'preset-status',
        name: 'status',
        displayName: 'Status',
        type: 'enum',
        values: [
          { value: 'todo', label: 'To-Do', color: '#22c55e' },
          { value: 'in-progress', label: 'In Progress', color: '#f59e0b' },
          { value: 'waiting', label: 'Waiting', color: '#ef4444' },
          { value: 'done', label: 'Done', color: '#3b82f6' },
        ],
        defaultValue: 'todo',
        color: '#22c55e',
        icon: 'circle-check',
        isBuiltIn: true,
        enabled: true,
        order: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      const doc = await db.attributes.insert(statusPreset)
      expect(doc.id).toBe('preset-status')
      expect(doc.isBuiltIn).toBe(true)
      expect(doc.values).toHaveLength(4)
    })

    it('should create complete Priority preset', async () => {
      const priorityPreset: AttributeDocument = {
        id: 'preset-priority',
        name: 'priority',
        displayName: 'Priority',
        type: 'enum',
        values: [
          { value: 'high', label: 'High', color: '#ef4444' },
          { value: 'medium', label: 'Medium', color: '#f59e0b' },
          { value: 'low', label: 'Low', color: '#6b7280' },
        ],
        color: '#ef4444',
        icon: 'alert-triangle',
        isBuiltIn: true,
        enabled: true,
        order: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      const doc = await db.attributes.insert(priorityPreset)
      expect(doc.id).toBe('preset-priority')
      expect(doc.values).toHaveLength(3)
    })

    it('should create custom text attribute', async () => {
      const customAttribute: AttributeDocument = {
        id: 'attr-project-name',
        name: 'project_name',
        displayName: 'Project Name',
        type: 'text',
        defaultValue: '',
        color: '#8b5cf6',
        icon: 'folder',
        isBuiltIn: false,
        enabled: true,
        order: 10,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      const doc = await db.attributes.insert(customAttribute)
      expect(doc.type).toBe('text')
      expect(doc.isBuiltIn).toBe(false)
    })

    it('should create boolean attribute', async () => {
      const booleanAttribute: AttributeDocument = {
        id: 'attr-urgent',
        name: 'is_urgent',
        displayName: 'Urgent',
        type: 'boolean',
        defaultValue: 'false',
        color: '#ef4444',
        icon: 'alert-circle',
        isBuiltIn: false,
        enabled: true,
        order: 5,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      const doc = await db.attributes.insert(booleanAttribute)
      expect(doc.type).toBe('boolean')
    })

    it('should create date attribute', async () => {
      const dateAttribute: AttributeDocument = {
        id: 'attr-due-date',
        name: 'due_date',
        displayName: 'Due Date',
        type: 'date',
        icon: 'calendar',
        isBuiltIn: false,
        enabled: true,
        order: 6,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      const doc = await db.attributes.insert(dateAttribute)
      expect(doc.type).toBe('date')
    })

    it('should create number attribute', async () => {
      const numberAttribute: AttributeDocument = {
        id: 'attr-hours',
        name: 'billable_hours',
        displayName: 'Billable Hours',
        type: 'number',
        defaultValue: '0',
        icon: 'clock',
        isBuiltIn: false,
        enabled: true,
        order: 7,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      const doc = await db.attributes.insert(numberAttribute)
      expect(doc.type).toBe('number')
    })
  })
})
