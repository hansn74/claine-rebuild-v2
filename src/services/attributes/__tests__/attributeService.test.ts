import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createRxDatabase, addRxPlugin, type RxDatabase } from 'rxdb'
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie'
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv'
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode'
import { RxDBUpdatePlugin } from 'rxdb/plugins/update'
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder'
import { attributeSchema } from '@/services/database/schemas/attribute.schema'
import { AttributeService } from '../attributeService'
import type { CreateAttributeInput } from '@/types/attributes'

// Add required plugins
addRxPlugin(RxDBDevModePlugin)
addRxPlugin(RxDBUpdatePlugin)
addRxPlugin(RxDBQueryBuilderPlugin)

// Mock the database getter
vi.mock('@/services/database/init', () => ({
  getDatabase: vi.fn(),
}))

// Get the mocked function
import { getDatabase } from '@/services/database/init'
const mockGetDatabase = vi.mocked(getDatabase)

describe('AttributeService', () => {
  let db: RxDatabase
  let service: AttributeService

  beforeEach(async () => {
    // Create a fresh test database
    db = await createRxDatabase({
      name: `test-attribute-service-${Date.now()}-${Math.random().toString(36).slice(2)}`,
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

    // Mock getDatabase to return our test database
    mockGetDatabase.mockReturnValue(db as ReturnType<typeof getDatabase>)

    // Get fresh service instance
    service = AttributeService.getInstance()
  })

  afterEach(async () => {
    vi.clearAllMocks()
    if (db && !db.destroyed) {
      await db.remove()
    }
  })

  describe('createAttribute', () => {
    it('should create a text attribute', async () => {
      const input: CreateAttributeInput = {
        name: 'project_name',
        displayName: 'Project Name',
        type: 'text',
        isBuiltIn: false,
        enabled: true,
        order: 0,
      }

      const result = await service.createAttribute(input)

      expect(result.name).toBe('project_name')
      expect(result.displayName).toBe('Project Name')
      expect(result.type).toBe('text')
      expect(result.isBuiltIn).toBe(false)
      expect(result.enabled).toBe(true)
      expect(result.id).toMatch(/^attr-/)
    })

    it('should create an enum attribute with values', async () => {
      const input: CreateAttributeInput = {
        name: 'status',
        displayName: 'Status',
        type: 'enum',
        values: [
          { value: 'todo', label: 'To-Do', color: '#22c55e' },
          { value: 'done', label: 'Done', color: '#3b82f6' },
        ],
        isBuiltIn: true,
        enabled: true,
        order: 0,
      }

      const result = await service.createAttribute(input)

      expect(result.type).toBe('enum')
      expect(result.values).toHaveLength(2)
      expect(result.values?.[0]).toEqual({ value: 'todo', label: 'To-Do', color: '#22c55e' })
      expect(result.id).toMatch(/^preset-status$/)
    })

    it('should create boolean attribute', async () => {
      const input: CreateAttributeInput = {
        name: 'is_urgent',
        displayName: 'Urgent',
        type: 'boolean',
        defaultValue: false,
        isBuiltIn: false,
        enabled: true,
        order: 0,
      }

      const result = await service.createAttribute(input)

      expect(result.type).toBe('boolean')
      expect(result.defaultValue).toBe(false)
    })

    it('should create number attribute', async () => {
      const input: CreateAttributeInput = {
        name: 'hours',
        displayName: 'Hours',
        type: 'number',
        defaultValue: 0,
        isBuiltIn: false,
        enabled: true,
        order: 0,
      }

      const result = await service.createAttribute(input)

      expect(result.type).toBe('number')
      expect(result.defaultValue).toBe(0)
    })

    it('should create date attribute', async () => {
      const input: CreateAttributeInput = {
        name: 'due_date',
        displayName: 'Due Date',
        type: 'date',
        isBuiltIn: false,
        enabled: true,
        order: 0,
      }

      const result = await service.createAttribute(input)

      expect(result.type).toBe('date')
    })

    it('should reject duplicate attribute name', async () => {
      const input: CreateAttributeInput = {
        name: 'status',
        displayName: 'Status',
        type: 'text',
        isBuiltIn: false,
        enabled: true,
        order: 0,
      }

      await service.createAttribute(input)

      await expect(service.createAttribute(input)).rejects.toThrow('already exists')
    })

    it('should reject duplicate name case-insensitively', async () => {
      const input1: CreateAttributeInput = {
        name: 'Status',
        displayName: 'Status',
        type: 'text',
        isBuiltIn: false,
        enabled: true,
        order: 0,
      }

      const input2: CreateAttributeInput = {
        name: 'status',
        displayName: 'Status Lower',
        type: 'text',
        isBuiltIn: false,
        enabled: true,
        order: 1,
      }

      await service.createAttribute(input1)

      await expect(service.createAttribute(input2)).rejects.toThrow('already exists')
    })

    it('should reject empty attribute name', async () => {
      const input: CreateAttributeInput = {
        name: '',
        displayName: 'Test',
        type: 'text',
        isBuiltIn: false,
        enabled: true,
        order: 0,
      }

      await expect(service.createAttribute(input)).rejects.toThrow('required')
    })

    it('should reject enum without values', async () => {
      const input: CreateAttributeInput = {
        name: 'status',
        displayName: 'Status',
        type: 'enum',
        isBuiltIn: false,
        enabled: true,
        order: 0,
      }

      await expect(service.createAttribute(input)).rejects.toThrow('values')
    })

    it('should reject enum with empty values array', async () => {
      const input: CreateAttributeInput = {
        name: 'status',
        displayName: 'Status',
        type: 'enum',
        values: [],
        isBuiltIn: false,
        enabled: true,
        order: 0,
      }

      await expect(service.createAttribute(input)).rejects.toThrow('at least one')
    })
  })

  describe('getAttributes', () => {
    it('should return empty array when no attributes', async () => {
      const result = await service.getAttributes()
      expect(result).toEqual([])
    })

    it('should return all attributes sorted by order', async () => {
      await service.createAttribute({
        name: 'attr_c',
        displayName: 'C',
        type: 'text',
        isBuiltIn: false,
        enabled: true,
        order: 2,
      })

      await service.createAttribute({
        name: 'attr_a',
        displayName: 'A',
        type: 'text',
        isBuiltIn: false,
        enabled: true,
        order: 0,
      })

      await service.createAttribute({
        name: 'attr_b',
        displayName: 'B',
        type: 'text',
        isBuiltIn: false,
        enabled: true,
        order: 1,
      })

      const result = await service.getAttributes()

      expect(result).toHaveLength(3)
      expect(result[0].name).toBe('attr_a')
      expect(result[1].name).toBe('attr_b')
      expect(result[2].name).toBe('attr_c')
    })
  })

  describe('getEnabledAttributes', () => {
    it('should return only enabled attributes', async () => {
      await service.createAttribute({
        name: 'enabled_attr',
        displayName: 'Enabled',
        type: 'text',
        isBuiltIn: false,
        enabled: true,
        order: 0,
      })

      await service.createAttribute({
        name: 'disabled_attr',
        displayName: 'Disabled',
        type: 'text',
        isBuiltIn: false,
        enabled: false,
        order: 1,
      })

      const result = await service.getEnabledAttributes()

      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('enabled_attr')
    })
  })

  describe('getAttributeById', () => {
    it('should return attribute by ID', async () => {
      const created = await service.createAttribute({
        name: 'test',
        displayName: 'Test',
        type: 'text',
        isBuiltIn: false,
        enabled: true,
        order: 0,
      })

      const result = await service.getAttributeById(created.id)

      expect(result).not.toBeNull()
      expect(result?.id).toBe(created.id)
      expect(result?.name).toBe('test')
    })

    it('should return null for non-existent ID', async () => {
      const result = await service.getAttributeById('non-existent')
      expect(result).toBeNull()
    })
  })

  describe('findByName', () => {
    it('should find attribute by name case-insensitively', async () => {
      await service.createAttribute({
        name: 'MyAttribute',
        displayName: 'My Attribute',
        type: 'text',
        isBuiltIn: false,
        enabled: true,
        order: 0,
      })

      const result = await service.findByName('myattribute')

      expect(result).not.toBeNull()
      expect(result?.name).toBe('MyAttribute')
    })

    it('should return null for non-existent name', async () => {
      const result = await service.findByName('nonexistent')
      expect(result).toBeNull()
    })
  })

  describe('updateAttribute', () => {
    it('should update attribute displayName', async () => {
      const created = await service.createAttribute({
        name: 'test',
        displayName: 'Test',
        type: 'text',
        isBuiltIn: false,
        enabled: true,
        order: 0,
      })

      const updated = await service.updateAttribute(created.id, {
        displayName: 'Updated Test',
      })

      expect(updated.displayName).toBe('Updated Test')
      expect(updated.updatedAt).toBeGreaterThan(created.updatedAt)
    })

    it('should update enum values', async () => {
      const created = await service.createAttribute({
        name: 'status',
        displayName: 'Status',
        type: 'enum',
        values: [{ value: 'todo', label: 'To-Do' }],
        isBuiltIn: false,
        enabled: true,
        order: 0,
      })

      const updated = await service.updateAttribute(created.id, {
        values: [
          { value: 'todo', label: 'To-Do' },
          { value: 'done', label: 'Done' },
        ],
      })

      expect(updated.values).toHaveLength(2)
    })

    it('should toggle enabled state', async () => {
      const created = await service.createAttribute({
        name: 'test',
        displayName: 'Test',
        type: 'text',
        isBuiltIn: false,
        enabled: true,
        order: 0,
      })

      const updated = await service.updateAttribute(created.id, { enabled: false })

      expect(updated.enabled).toBe(false)
    })

    it('should reject updating non-existent attribute', async () => {
      await expect(
        service.updateAttribute('non-existent', { displayName: 'Test' })
      ).rejects.toThrow('not found')
    })

    it('should reject changing type of built-in attribute', async () => {
      const created = await service.createAttribute({
        name: 'builtin',
        displayName: 'Built-in',
        type: 'enum',
        values: [{ value: 'v1', label: 'V1' }],
        isBuiltIn: true,
        enabled: true,
        order: 0,
      })

      await expect(service.updateAttribute(created.id, { type: 'text' })).rejects.toThrow(
        'built-in'
      )
    })
  })

  describe('deleteAttribute', () => {
    it('should delete custom attribute', async () => {
      const created = await service.createAttribute({
        name: 'test',
        displayName: 'Test',
        type: 'text',
        isBuiltIn: false,
        enabled: true,
        order: 0,
      })

      await service.deleteAttribute(created.id)

      const result = await service.getAttributeById(created.id)
      expect(result).toBeNull()
    })

    it('should reject deleting built-in attribute', async () => {
      const created = await service.createAttribute({
        name: 'builtin',
        displayName: 'Built-in',
        type: 'text',
        isBuiltIn: true,
        enabled: true,
        order: 0,
      })

      await expect(service.deleteAttribute(created.id)).rejects.toThrow('built-in')
    })

    it('should reject deleting non-existent attribute', async () => {
      await expect(service.deleteAttribute('non-existent')).rejects.toThrow('not found')
    })
  })

  describe('toggleAttribute', () => {
    it('should toggle attribute enabled state', async () => {
      const created = await service.createAttribute({
        name: 'test',
        displayName: 'Test',
        type: 'text',
        isBuiltIn: false,
        enabled: true,
        order: 0,
      })

      const toggled = await service.toggleAttribute(created.id, false)

      expect(toggled.enabled).toBe(false)
    })
  })

  describe('reorderAttributes', () => {
    it('should reorder attributes', async () => {
      const a = await service.createAttribute({
        name: 'attr_a',
        displayName: 'A',
        type: 'text',
        isBuiltIn: false,
        enabled: true,
        order: 0,
      })

      const b = await service.createAttribute({
        name: 'attr_b',
        displayName: 'B',
        type: 'text',
        isBuiltIn: false,
        enabled: true,
        order: 1,
      })

      const c = await service.createAttribute({
        name: 'attr_c',
        displayName: 'C',
        type: 'text',
        isBuiltIn: false,
        enabled: true,
        order: 2,
      })

      // Reorder: C, A, B
      await service.reorderAttributes([c.id, a.id, b.id])

      const result = await service.getAttributes()

      expect(result[0].name).toBe('attr_c')
      expect(result[1].name).toBe('attr_a')
      expect(result[2].name).toBe('attr_b')
    })
  })

  describe('getNextOrder', () => {
    it('should return 0 when no attributes', async () => {
      const result = await service.getNextOrder()
      expect(result).toBe(0)
    })

    it('should return max order + 1', async () => {
      await service.createAttribute({
        name: 'test',
        displayName: 'Test',
        type: 'text',
        isBuiltIn: false,
        enabled: true,
        order: 5,
      })

      const result = await service.getNextOrder()
      expect(result).toBe(6)
    })
  })

  describe('validateAttribute', () => {
    it('should validate valid attribute', async () => {
      const result = await service.validateAttribute({
        name: 'test',
        type: 'text',
      })

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject empty name', async () => {
      const result = await service.validateAttribute({
        name: '',
        type: 'text',
      })

      expect(result.isValid).toBe(false)
      expect(result.errors.some((e) => e.code === 'INVALID_NAME')).toBe(true)
    })

    it('should reject name too long', async () => {
      const result = await service.validateAttribute({
        name: 'a'.repeat(51),
        type: 'text',
      })

      expect(result.isValid).toBe(false)
      expect(result.errors.some((e) => e.code === 'INVALID_NAME')).toBe(true)
    })

    it('should detect duplicate name', async () => {
      await service.createAttribute({
        name: 'existing',
        displayName: 'Existing',
        type: 'text',
        isBuiltIn: false,
        enabled: true,
        order: 0,
      })

      const result = await service.validateAttribute({
        name: 'existing',
        type: 'text',
      })

      expect(result.isValid).toBe(false)
      expect(result.errors.some((e) => e.code === 'DUPLICATE_NAME')).toBe(true)
    })

    it('should allow same name when updating same attribute', async () => {
      const created = await service.createAttribute({
        name: 'existing',
        displayName: 'Existing',
        type: 'text',
        isBuiltIn: false,
        enabled: true,
        order: 0,
      })

      const result = await service.validateAttribute(
        {
          name: 'existing',
          type: 'text',
        },
        created.id
      )

      expect(result.isValid).toBe(true)
    })

    it('should require enum values for enum type', async () => {
      const result = await service.validateAttribute({
        name: 'test',
        type: 'enum',
      })

      expect(result.isValid).toBe(false)
      expect(result.errors.some((e) => e.code === 'ENUM_VALUES_REQUIRED')).toBe(true)
    })

    it('should reject empty enum values array', async () => {
      const result = await service.validateAttribute({
        name: 'test',
        type: 'enum',
        values: [],
      })

      expect(result.isValid).toBe(false)
      expect(result.errors.some((e) => e.code === 'ENUM_VALUES_EMPTY')).toBe(true)
    })

    it('should detect duplicate enum values', async () => {
      const result = await service.validateAttribute({
        name: 'test',
        type: 'enum',
        values: [
          { value: 'opt1', label: 'Option 1' },
          { value: 'Opt1', label: 'Option 1 Duplicate' },
        ],
      })

      expect(result.isValid).toBe(false)
      expect(result.errors.some((e) => e.code === 'DUPLICATE_ENUM_VALUE')).toBe(true)
    })

    it('should reject negative order', async () => {
      const result = await service.validateAttribute({
        name: 'test',
        type: 'text',
        order: -1,
      })

      expect(result.isValid).toBe(false)
      expect(result.errors.some((e) => e.code === 'INVALID_ORDER')).toBe(true)
    })
  })
})
