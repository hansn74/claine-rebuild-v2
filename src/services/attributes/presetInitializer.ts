/**
 * Preset Initializer
 *
 * Story 2.13: Custom Attributes System - Data Model & CRUD
 * Task 3.2: Implement preset initialization on first app launch
 *
 * Handles initialization of built-in attribute presets when:
 * - Database is created for the first time
 * - Presets are missing after a database migration
 */

import { attributeService } from './attributeService'
import { BUILT_IN_PRESETS, PRESET_IDS } from './presets'
import { logger } from '@/services/logger'

const PRESETS_INITIALIZED_KEY = 'claine_attribute_presets_initialized'

/**
 * Check if presets have been initialized
 */
function hasInitializedPresets(): boolean {
  try {
    return localStorage.getItem(PRESETS_INITIALIZED_KEY) === 'true'
  } catch {
    return false
  }
}

/**
 * Mark presets as initialized
 */
function markPresetsInitialized(): void {
  try {
    localStorage.setItem(PRESETS_INITIALIZED_KEY, 'true')
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Initialize built-in attribute presets
 *
 * This should be called during app initialization after the database is ready.
 * It will:
 * 1. Check if presets already exist
 * 2. Create any missing presets
 * 3. Mark initialization as complete
 *
 * @returns Number of presets created (0 if all existed)
 */
export async function initializeAttributePresets(): Promise<number> {
  try {
    logger.debug('presets', 'Starting attribute preset initialization...')

    // Check if we have any attributes already
    const hasAttributes = await attributeService.hasAttributes()
    logger.debug('presets', 'Has existing attributes', { hasAttributes })

    // Only skip if we have attributes AND localStorage flag is set
    // If database was cleared but localStorage wasn't, we need to recreate presets
    if (hasAttributes && hasInitializedPresets()) {
      logger.debug('presets', 'Presets already initialized, skipping')
      return 0
    }

    // If localStorage says initialized but no attributes exist, reset the flag
    if (!hasAttributes && hasInitializedPresets()) {
      logger.info('presets', 'Database cleared but localStorage flag exists, resetting...')
      resetPresetInitialization()
    }

    logger.debug('presets', 'Creating presets...')

    let createdCount = 0

    // Check each preset and create if missing
    for (const preset of BUILT_IN_PRESETS) {
      const existing = await attributeService.findByName(preset.name)

      if (!existing) {
        try {
          await attributeService.createAttribute(preset)
          createdCount++
          logger.info('presets', `Created preset: ${preset.displayName}`, {
            name: preset.name,
            type: preset.type,
          })
        } catch (error) {
          // Log but continue with other presets
          logger.error('presets', `Failed to create preset: ${preset.name}`, {
            error: error instanceof Error ? error.message : String(error),
          })
        }
      } else {
        logger.debug('presets', `Preset already exists: ${preset.displayName}`)
      }
    }

    // Mark as initialized
    markPresetsInitialized()

    if (createdCount > 0) {
      logger.info('presets', `Initialized ${createdCount} attribute presets`)
    }

    return createdCount
  } catch (error) {
    logger.error('presets', 'Failed to initialize presets', {
      error: error instanceof Error ? error.message : String(error),
    })
    return 0
  }
}

/**
 * Reset preset initialization flag
 * Used for testing or when user wants to re-initialize
 */
export function resetPresetInitialization(): void {
  try {
    localStorage.removeItem(PRESETS_INITIALIZED_KEY)
  } catch {
    // Ignore
  }
}

/**
 * Get preset by ID
 */
export function getPresetById(presetId: string): (typeof BUILT_IN_PRESETS)[number] | undefined {
  switch (presetId) {
    case PRESET_IDS.STATUS:
      return BUILT_IN_PRESETS[0]
    case PRESET_IDS.PRIORITY:
      return BUILT_IN_PRESETS[1]
    case PRESET_IDS.CONTEXT:
      return BUILT_IN_PRESETS[2]
    default:
      return undefined
  }
}
