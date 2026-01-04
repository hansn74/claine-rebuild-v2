/**
 * Built-in Attribute Presets
 *
 * Story 2.13: Custom Attributes System - Data Model & CRUD
 * Task 3: Create Built-in Attribute Presets
 *
 * AC 4: Built-in attribute presets available:
 * - Status (To-Do/In-Progress/Waiting/Done)
 * - Priority (High/Medium/Low)
 * - Context (Work/Personal/Projects)
 *
 * AC 5: User can enable/disable built-in presets
 */

import type { CreateAttributeInput, AttributeEnumValue } from '@/types/attributes'

/**
 * Status preset values
 * Green -> Yellow -> Orange -> Blue progression
 */
const STATUS_VALUES: AttributeEnumValue[] = [
  { value: 'todo', label: 'To-Do', color: '#22c55e' }, // Green
  { value: 'in-progress', label: 'In Progress', color: '#f59e0b' }, // Amber
  { value: 'waiting', label: 'Waiting', color: '#f97316' }, // Orange
  { value: 'done', label: 'Done', color: '#3b82f6' }, // Blue
]

/**
 * Priority preset values
 * Red -> Yellow -> Gray progression
 */
const PRIORITY_VALUES: AttributeEnumValue[] = [
  { value: 'high', label: 'High', color: '#ef4444' }, // Red
  { value: 'medium', label: 'Medium', color: '#f59e0b' }, // Amber
  { value: 'low', label: 'Low', color: '#6b7280' }, // Gray
]

/**
 * Context preset values
 * Blue -> Purple -> Teal
 */
const CONTEXT_VALUES: AttributeEnumValue[] = [
  { value: 'work', label: 'Work', color: '#3b82f6' }, // Blue
  { value: 'personal', label: 'Personal', color: '#8b5cf6' }, // Purple
  { value: 'projects', label: 'Projects', color: '#14b8a6' }, // Teal
]

/**
 * Status preset definition
 */
export const STATUS_PRESET: CreateAttributeInput = {
  name: 'status',
  displayName: 'Status',
  type: 'enum',
  values: STATUS_VALUES,
  defaultValue: 'todo',
  color: '#22c55e',
  icon: 'circle-check',
  isBuiltIn: true,
  enabled: true,
  order: 0,
}

/**
 * Priority preset definition
 */
export const PRIORITY_PRESET: CreateAttributeInput = {
  name: 'priority',
  displayName: 'Priority',
  type: 'enum',
  values: PRIORITY_VALUES,
  color: '#ef4444',
  icon: 'alert-triangle',
  isBuiltIn: true,
  enabled: true,
  order: 1,
}

/**
 * Context preset definition
 */
export const CONTEXT_PRESET: CreateAttributeInput = {
  name: 'context',
  displayName: 'Context',
  type: 'enum',
  values: CONTEXT_VALUES,
  color: '#3b82f6',
  icon: 'tag',
  isBuiltIn: true,
  enabled: true,
  order: 2,
}

/**
 * All built-in presets in order
 */
export const BUILT_IN_PRESETS: CreateAttributeInput[] = [
  STATUS_PRESET,
  PRIORITY_PRESET,
  CONTEXT_PRESET,
]

/**
 * Preset IDs for easy lookup
 */
export const PRESET_IDS = {
  STATUS: 'preset-status',
  PRIORITY: 'preset-priority',
  CONTEXT: 'preset-context',
} as const

export type PresetId = (typeof PRESET_IDS)[keyof typeof PRESET_IDS]
