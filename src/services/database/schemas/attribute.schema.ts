import type { RxJsonSchema } from 'rxdb'

/**
 * Attribute types enum for schema validation
 */
export const ATTRIBUTE_TYPES = ['enum', 'text', 'date', 'boolean', 'number'] as const

/**
 * Attribute document type representing a custom attribute definition
 *
 * Design Philosophy:
 * - Stores attribute metadata, not email attribute values (those go in EmailDocument.attributes)
 * - Supports built-in presets (Status, Priority, Context) that cannot be deleted
 * - Enum type requires values array with value/label pairs
 * - Order field for user-defined sorting in UI
 *
 * Attribute Types:
 * - enum: Fixed value list (values array required)
 * - text: Free-form text input
 * - date: Unix timestamp
 * - boolean: true/false
 * - number: Numeric value
 */
export interface AttributeDocument {
  id: string // Primary key - unique identifier (nanoid or preset-{name})
  name: string // Internal name (unique, case-insensitive, max 50 chars)
  displayName: string // User-visible display name (max 100 chars)
  type: 'enum' | 'text' | 'date' | 'boolean' | 'number' // Attribute type
  values?: AttributeEnumValueDoc[] // For enum type - list of valid values
  defaultValue?: string // Default value (stored as string, parsed by type)
  color?: string // Accent color (hex code or tailwind class, max 50 chars)
  icon?: string // Lucide icon name (max 50 chars)
  isBuiltIn: boolean // System preset that cannot be deleted
  enabled: boolean // Whether attribute is active/visible
  order: number // Sort order for display (0-based)
  createdAt: number // Unix timestamp (ms) when created
  updatedAt: number // Unix timestamp (ms) when last modified
}

/**
 * Enum value subdocument for enum-type attributes
 */
export interface AttributeEnumValueDoc {
  value: string // Internal value (unique within attribute, max 100 chars)
  label: string // Display label (max 100 chars)
  color?: string // Optional color for UI display (max 50 chars)
}

/**
 * RxDB schema for Attribute collection
 * Version 0 - Initial schema design
 *
 * Indexes:
 * - name: For unique name lookup (case-insensitive handled at application level)
 * - order: For sorted display
 * - enabled: For filtering active attributes
 * - isBuiltIn: For separating presets from custom
 *
 * Note: Array fields (values) cannot be directly indexed in RxDB.
 * Use application-level validation for enum values.
 */
export const attributeSchema: RxJsonSchema<AttributeDocument> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 100,
    },
    name: {
      type: 'string',
      maxLength: 50,
    },
    displayName: {
      type: 'string',
      maxLength: 100,
    },
    type: {
      type: 'string',
      enum: ATTRIBUTE_TYPES as unknown as string[],
    },
    values: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          value: {
            type: 'string',
            maxLength: 100,
          },
          label: {
            type: 'string',
            maxLength: 100,
          },
          color: {
            type: 'string',
            maxLength: 50,
          },
        },
        required: ['value', 'label'],
      },
    },
    defaultValue: {
      type: 'string',
      maxLength: 200,
    },
    color: {
      type: 'string',
      maxLength: 50,
    },
    icon: {
      type: 'string',
      maxLength: 50,
    },
    isBuiltIn: {
      type: 'boolean',
    },
    enabled: {
      type: 'boolean',
    },
    order: {
      type: 'number',
      minimum: 0,
      maximum: 999999,
      multipleOf: 1,
    },
    createdAt: {
      type: 'number',
      minimum: 0,
      maximum: 9999999999999, // Year 2286
      multipleOf: 1,
    },
    updatedAt: {
      type: 'number',
      minimum: 0,
      maximum: 9999999999999, // Year 2286
      multipleOf: 1,
    },
  },
  required: [
    'id',
    'name',
    'displayName',
    'type',
    'isBuiltIn',
    'enabled',
    'order',
    'createdAt',
    'updatedAt',
  ],
  indexes: [
    'name', // For unique name lookup
    'order', // For sorted display
    'enabled', // For filtering active attributes
    'isBuiltIn', // For separating presets from custom
    ['enabled', 'order'], // Compound: active attributes sorted by order
  ],
}
