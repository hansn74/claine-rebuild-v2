/**
 * Attributes Service
 *
 * Story 2.13: Custom Attributes System - Data Model & CRUD
 *
 * Exports all attribute-related services and utilities.
 */

export { attributeService, AttributeService } from './attributeService'

export {
  STATUS_PRESET,
  PRIORITY_PRESET,
  CONTEXT_PRESET,
  BUILT_IN_PRESETS,
  PRESET_IDS,
  type PresetId,
} from './presets'

export {
  initializeAttributePresets,
  resetPresetInitialization,
  getPresetById,
} from './presetInitializer'
