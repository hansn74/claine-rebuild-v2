/**
 * Attribute Service
 *
 * Manages custom attribute definitions in RxDB.
 * Provides CRUD operations with validation for attribute management.
 *
 * AC 1: RxDB schema extended with attributes collection
 * AC 2: Supports enum, text, date, boolean, number types
 * AC 6: Validation - duplicate attribute names prevented, enum values validated
 * AC 7: Attributes persist in RxDB and sync across app restarts
 */

import { nanoid } from 'nanoid'
import { getDatabase } from '@/services/database/init'
import { logger } from '@/services/logger'
import type { AttributeDocument } from '@/services/database/schemas'
import type {
  Attribute,
  AttributeType,
  AttributeValidationResult,
  AttributeValidationError,
  CreateAttributeInput,
  UpdateAttributeInput,
} from '@/types/attributes'

/**
 * Maximum attribute name length
 */
const MAX_NAME_LENGTH = 50

/**
 * Maximum number of enum values per attribute
 */
const MAX_ENUM_VALUES = 50

/**
 * Convert database document to domain model
 */
function documentToAttribute(doc: AttributeDocument): Attribute {
  return {
    id: doc.id,
    name: doc.name,
    displayName: doc.displayName,
    type: doc.type as AttributeType,
    values: doc.values?.map((v) => ({
      value: v.value,
      label: v.label,
      color: v.color,
    })),
    defaultValue: parseDefaultValue(doc.defaultValue, doc.type as AttributeType),
    color: doc.color,
    icon: doc.icon,
    isBuiltIn: doc.isBuiltIn,
    enabled: doc.enabled,
    order: doc.order,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

/**
 * Parse string default value to appropriate type
 */
function parseDefaultValue(
  value: string | undefined,
  type: AttributeType
): string | number | boolean | null | undefined {
  if (value === undefined || value === null) return undefined

  switch (type) {
    case 'boolean':
      return value === 'true'
    case 'number': {
      const num = parseFloat(value)
      return isNaN(num) ? undefined : num
    }
    case 'date':
    case 'text':
    case 'enum':
    default:
      return value
  }
}

/**
 * Serialize default value to string for storage
 */
function serializeDefaultValue(
  value: string | number | boolean | null | undefined
): string | undefined {
  if (value === undefined || value === null) return undefined
  return String(value)
}

/**
 * Attribute Service
 *
 * Singleton service that manages attribute definitions.
 * Provides CRUD operations with validation.
 */
export class AttributeService {
  private static instance: AttributeService
  private initialized = false

  private constructor() {
    // Private constructor for singleton pattern
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): AttributeService {
    if (!AttributeService.instance) {
      AttributeService.instance = new AttributeService()
    }
    return AttributeService.instance
  }

  /**
   * Initialize the service
   * Called on app startup
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    logger.info('attributes', 'Initializing attribute service')
    this.initialized = true
  }

  /**
   * Validate an attribute before create/update
   * AC 6: Validation - duplicate names prevented, enum values validated
   *
   * @param attr - Attribute data to validate
   * @param existingId - If updating, the ID of the existing attribute (to exclude from duplicate check)
   * @returns Validation result with any errors
   */
  async validateAttribute(
    attr: Partial<CreateAttributeInput>,
    existingId?: string
  ): Promise<AttributeValidationResult> {
    const errors: AttributeValidationError[] = []

    // Name validation
    if (!attr.name || attr.name.trim().length === 0) {
      errors.push({
        field: 'name',
        message: 'Attribute name is required',
        code: 'INVALID_NAME',
      })
    } else if (attr.name.length > MAX_NAME_LENGTH) {
      errors.push({
        field: 'name',
        message: `Attribute name must be ${MAX_NAME_LENGTH} characters or less`,
        code: 'INVALID_NAME',
      })
    } else {
      // Check for duplicate name (case-insensitive)
      const duplicate = await this.findByName(attr.name)
      if (duplicate && duplicate.id !== existingId) {
        errors.push({
          field: 'name',
          message: `An attribute named "${attr.name}" already exists`,
          code: 'DUPLICATE_NAME',
        })
      }
    }

    // Enum type validation
    if (attr.type === 'enum') {
      if (!attr.values || !Array.isArray(attr.values)) {
        errors.push({
          field: 'values',
          message: 'Enum attributes require a values array',
          code: 'ENUM_VALUES_REQUIRED',
        })
      } else if (attr.values.length === 0) {
        errors.push({
          field: 'values',
          message: 'Enum attributes must have at least one value',
          code: 'ENUM_VALUES_EMPTY',
        })
      } else if (attr.values.length > MAX_ENUM_VALUES) {
        errors.push({
          field: 'values',
          message: `Enum attributes can have at most ${MAX_ENUM_VALUES} values`,
          code: 'ENUM_VALUES_EMPTY',
        })
      } else {
        // Check for duplicate enum values
        const valueSet = new Set<string>()
        for (const v of attr.values) {
          const normalizedValue = v.value.toLowerCase()
          if (valueSet.has(normalizedValue)) {
            errors.push({
              field: 'values',
              message: `Duplicate enum value: "${v.value}"`,
              code: 'DUPLICATE_ENUM_VALUE',
            })
            break
          }
          valueSet.add(normalizedValue)
        }
      }
    }

    // Order validation
    if (attr.order !== undefined && (attr.order < 0 || !Number.isInteger(attr.order))) {
      errors.push({
        field: 'order',
        message: 'Order must be a non-negative integer',
        code: 'INVALID_ORDER',
      })
    }

    return {
      isValid: errors.length === 0,
      errors,
    }
  }

  /**
   * Create a new attribute
   *
   * @param input - Attribute data (without id, createdAt, updatedAt)
   * @returns Created attribute
   * @throws Error if validation fails
   */
  async createAttribute(input: CreateAttributeInput): Promise<Attribute> {
    const db = getDatabase()
    const collection = db.attributes
    if (!collection) {
      throw new Error('Attributes collection not initialized')
    }

    // Validate
    const validation = await this.validateAttribute(input)
    if (!validation.isValid) {
      const errorMessages = validation.errors.map((e) => e.message).join(', ')
      throw new Error(`Validation failed: ${errorMessages}`)
    }

    const now = Date.now()
    const doc: AttributeDocument = {
      id: input.isBuiltIn ? `preset-${input.name.toLowerCase()}` : `attr-${nanoid(10)}`,
      name: input.name.trim(),
      displayName: input.displayName.trim(),
      type: input.type,
      values: input.values?.map((v) => ({
        value: v.value,
        label: v.label,
        color: v.color,
      })),
      defaultValue: serializeDefaultValue(input.defaultValue),
      color: input.color,
      icon: input.icon,
      isBuiltIn: input.isBuiltIn,
      enabled: input.enabled,
      order: input.order,
      createdAt: now,
      updatedAt: now,
    }

    await collection.insert(doc)

    logger.info('attributes', 'Attribute created', {
      id: doc.id,
      name: doc.name,
      type: doc.type,
    })

    return documentToAttribute(doc)
  }

  /**
   * Get all attributes
   * Sorted by order
   *
   * @returns Array of all attributes
   */
  async getAttributes(): Promise<Attribute[]> {
    const db = getDatabase()
    const collection = db.attributes
    if (!collection) {
      return []
    }

    const docs = await collection.find().sort({ order: 'asc' }).exec()

    return docs.map((doc) => documentToAttribute(doc.toJSON() as AttributeDocument))
  }

  /**
   * Get only enabled attributes
   * Sorted by order
   *
   * @returns Array of enabled attributes
   */
  async getEnabledAttributes(): Promise<Attribute[]> {
    const db = getDatabase()
    const collection = db.attributes
    if (!collection) {
      return []
    }

    const docs = await collection
      .find({
        selector: { enabled: true },
      })
      .sort({ order: 'asc' })
      .exec()

    return docs.map((doc) => documentToAttribute(doc.toJSON() as AttributeDocument))
  }

  /**
   * Get a single attribute by ID
   *
   * @param id - Attribute ID
   * @returns Attribute or null if not found
   */
  async getAttributeById(id: string): Promise<Attribute | null> {
    const db = getDatabase()
    const collection = db.attributes
    if (!collection) {
      return null
    }

    const doc = await collection.findOne(id).exec()
    if (!doc) {
      return null
    }

    return documentToAttribute(doc.toJSON() as AttributeDocument)
  }

  /**
   * Find attribute by name (case-insensitive)
   *
   * @param name - Attribute name
   * @returns Attribute or null if not found
   */
  async findByName(name: string): Promise<Attribute | null> {
    const db = getDatabase()
    const collection = db.attributes
    if (!collection) {
      return null
    }

    // RxDB doesn't support case-insensitive queries directly,
    // so we fetch by exact match first, then fallback to all if needed
    const normalizedName = name.toLowerCase().trim()

    // Try exact match first
    const docs = await collection.find().exec()
    const match = docs.find((doc) => doc.name.toLowerCase() === normalizedName)

    if (!match) {
      return null
    }

    return documentToAttribute(match.toJSON() as AttributeDocument)
  }

  /**
   * Update an existing attribute
   *
   * @param id - Attribute ID to update
   * @param updates - Fields to update
   * @returns Updated attribute
   * @throws Error if not found, validation fails, or attempting to change built-in type
   */
  async updateAttribute(id: string, updates: UpdateAttributeInput): Promise<Attribute> {
    const db = getDatabase()
    const collection = db.attributes
    if (!collection) {
      throw new Error('Attributes collection not initialized')
    }

    const existing = await collection.findOne(id).exec()
    if (!existing) {
      throw new Error(`Attribute not found: ${id}`)
    }

    const existingData = existing.toJSON() as AttributeDocument

    // Prevent changing type of built-in attributes
    if (existingData.isBuiltIn && updates.type && updates.type !== existingData.type) {
      throw new Error('Cannot change the type of a built-in attribute')
    }

    // Merge updates with existing data for validation
    const merged: Partial<CreateAttributeInput> = {
      name: updates.name ?? existingData.name,
      displayName: updates.displayName ?? existingData.displayName,
      type: (updates.type ?? existingData.type) as AttributeType,
      values:
        updates.values ??
        existingData.values?.map((v) => ({
          value: v.value,
          label: v.label,
          color: v.color,
        })),
      enabled: updates.enabled ?? existingData.enabled,
      order: updates.order ?? existingData.order,
    }

    // Validate merged data
    const validation = await this.validateAttribute(merged, id)
    if (!validation.isValid) {
      const errorMessages = validation.errors.map((e) => e.message).join(', ')
      throw new Error(`Validation failed: ${errorMessages}`)
    }

    // Build update object
    const updateFields: Record<string, unknown> = {
      updatedAt: Date.now(),
    }

    if (updates.name !== undefined) {
      updateFields.name = updates.name.trim()
    }
    if (updates.displayName !== undefined) {
      updateFields.displayName = updates.displayName.trim()
    }
    if (updates.type !== undefined) {
      updateFields.type = updates.type
    }
    if (updates.values !== undefined) {
      updateFields.values = updates.values.map((v) => ({
        value: v.value,
        label: v.label,
        color: v.color,
      }))
    }
    if (updates.defaultValue !== undefined) {
      updateFields.defaultValue = serializeDefaultValue(updates.defaultValue)
    }
    if (updates.color !== undefined) {
      updateFields.color = updates.color
    }
    if (updates.icon !== undefined) {
      updateFields.icon = updates.icon
    }
    if (updates.enabled !== undefined) {
      updateFields.enabled = updates.enabled
    }
    if (updates.order !== undefined) {
      updateFields.order = updates.order
    }

    await existing.update({
      $set: updateFields,
    })

    logger.info('attributes', 'Attribute updated', { id, updates: Object.keys(updateFields) })

    // Fetch updated document
    const updated = await collection.findOne(id).exec()
    if (!updated) {
      throw new Error('Failed to fetch updated attribute')
    }

    return documentToAttribute(updated.toJSON() as AttributeDocument)
  }

  /**
   * Delete an attribute
   * AC 6: Built-in attributes cannot be deleted
   *
   * @param id - Attribute ID to delete
   * @throws Error if not found or is a built-in attribute
   */
  async deleteAttribute(id: string): Promise<void> {
    const db = getDatabase()
    const collection = db.attributes
    if (!collection) {
      throw new Error('Attributes collection not initialized')
    }

    const existing = await collection.findOne(id).exec()
    if (!existing) {
      throw new Error(`Attribute not found: ${id}`)
    }

    if (existing.isBuiltIn) {
      throw new Error('Cannot delete a built-in attribute. You can disable it instead.')
    }

    await existing.remove()

    logger.info('attributes', 'Attribute deleted', { id })
  }

  /**
   * Toggle enabled state of an attribute
   * AC 5: User can enable/disable built-in presets
   *
   * @param id - Attribute ID
   * @param enabled - New enabled state
   * @returns Updated attribute
   */
  async toggleAttribute(id: string, enabled: boolean): Promise<Attribute> {
    return this.updateAttribute(id, { enabled })
  }

  /**
   * Reorder attributes
   * Updates the order field for a list of attribute IDs
   *
   * @param orderedIds - Array of attribute IDs in desired order
   */
  async reorderAttributes(orderedIds: string[]): Promise<void> {
    const db = getDatabase()
    const collection = db.attributes
    if (!collection) {
      throw new Error('Attributes collection not initialized')
    }

    const now = Date.now()

    for (let i = 0; i < orderedIds.length; i++) {
      const id = orderedIds[i]
      const doc = await collection.findOne(id).exec()
      if (doc) {
        await doc.update({
          $set: { order: i, updatedAt: now },
        })
      }
    }

    logger.info('attributes', 'Attributes reordered', { count: orderedIds.length })
  }

  /**
   * Get the next available order number
   *
   * @returns Next order number (max + 1)
   */
  async getNextOrder(): Promise<number> {
    const db = getDatabase()
    const collection = db.attributes
    if (!collection) {
      return 0
    }

    const docs = await collection.find().sort({ order: 'desc' }).exec()
    if (docs.length === 0) {
      return 0
    }

    return (docs[0].order ?? 0) + 1
  }

  /**
   * Check if any attributes exist
   *
   * @returns true if at least one attribute exists
   */
  async hasAttributes(): Promise<boolean> {
    const db = getDatabase()
    const collection = db.attributes
    if (!collection) {
      return false
    }

    const count = await collection.count().exec()
    return count > 0
  }
}

// Export singleton instance getter
export const attributeService = AttributeService.getInstance()
