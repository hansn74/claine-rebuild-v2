/**
 * Attribute Types
 * TypeScript type definitions for custom email attributes system
 *
 * Supports 5 attribute types:
 * - enum: Fixed value list (e.g., Status: To-Do, In-Progress, Done)
 * - text: Free-form text input
 * - date: Date picker value
 * - boolean: Yes/No toggle
 * - number: Numeric value
 */

/**
 * Available attribute types
 */
export type AttributeType = 'enum' | 'text' | 'date' | 'boolean' | 'number'

/**
 * Enum value definition for enum-type attributes
 * Includes value, display label, and optional color
 */
export interface AttributeEnumValue {
  value: string // Internal value (unique within attribute)
  label: string // Display label
  color?: string // Optional color for UI display (hex or tailwind class)
}

/**
 * Attribute document interface
 * Represents a custom attribute definition stored in RxDB
 */
export interface Attribute {
  id: string // Primary key - unique identifier
  name: string // Internal name (unique, case-insensitive)
  displayName: string // User-visible display name
  type: AttributeType // Attribute type
  values?: AttributeEnumValue[] // For enum type only - list of valid values
  defaultValue?: string | number | boolean | null // Default value when applying to email
  color?: string // Accent color for the attribute (hex or tailwind class)
  icon?: string // Lucide icon name for UI display
  isBuiltIn: boolean // Whether this is a system-provided preset
  enabled: boolean // Whether attribute is active/visible
  order: number // Sort order for display
  createdAt: number // Unix timestamp (ms) when created
  updatedAt: number // Unix timestamp (ms) when last modified
}

/**
 * Input type for creating a new attribute
 * Omits auto-generated fields
 */
export type CreateAttributeInput = Omit<Attribute, 'id' | 'createdAt' | 'updatedAt'>

/**
 * Input type for updating an existing attribute
 * All fields optional except built-in protection rules apply
 */
export type UpdateAttributeInput = Partial<Omit<Attribute, 'id' | 'createdAt' | 'isBuiltIn'>>

/**
 * Validation result for attribute operations
 */
export interface AttributeValidationResult {
  isValid: boolean
  errors: AttributeValidationError[]
}

/**
 * Validation error detail
 */
export interface AttributeValidationError {
  field: keyof Attribute | 'values'
  message: string
  code: AttributeErrorCode
}

/**
 * Error codes for attribute validation
 */
export type AttributeErrorCode =
  | 'DUPLICATE_NAME' // Attribute name already exists
  | 'INVALID_NAME' // Name is empty or too long
  | 'ENUM_VALUES_REQUIRED' // Enum type requires values array
  | 'ENUM_VALUES_EMPTY' // Enum values array is empty
  | 'DUPLICATE_ENUM_VALUE' // Duplicate value in enum values
  | 'INVALID_DEFAULT_VALUE' // Default value doesn't match type
  | 'CANNOT_DELETE_BUILTIN' // Cannot delete built-in attribute
  | 'CANNOT_MODIFY_BUILTIN_TYPE' // Cannot change type of built-in attribute
  | 'INVALID_ORDER' // Order must be non-negative integer

/**
 * Value that can be assigned to an attribute on an email
 * Type-safe union based on attribute type
 */
export type AttributeValue = string | number | boolean | null

/**
 * Map of attribute values assigned to an email
 * Keys are attribute IDs, values are the assigned values
 */
export type EmailAttributeValues = Record<string, AttributeValue>
