/**
 * Priority Display Utilities
 *
 * Story 3.3: Priority Scoring Model
 * Task 1: Map internal priority values to user-facing display
 */

export type Priority = 'high' | 'medium' | 'low' | 'none'

export interface PriorityDisplayInfo {
  label: string
  color: string
  bgClass: string
  textClass: string
  description: string
}

const PRIORITY_DISPLAY_MAP: Record<Priority, PriorityDisplayInfo> = {
  high: {
    label: 'Urgent',
    color: 'red-600',
    bgClass: 'bg-red-100',
    textClass: 'text-red-600',
    description: 'Requires immediate attention',
  },
  medium: {
    label: 'Important',
    color: 'amber-500',
    bgClass: 'bg-amber-100',
    textClass: 'text-amber-500',
    description: 'Should be addressed soon',
  },
  low: {
    label: 'Updates',
    color: 'blue-500',
    bgClass: 'bg-blue-100',
    textClass: 'text-blue-500',
    description: 'Informational updates',
  },
  none: {
    label: 'Low',
    color: 'gray-500',
    bgClass: 'bg-gray-100',
    textClass: 'text-gray-500',
    description: 'Low priority or informational',
  },
}

export const PRIORITY_THRESHOLDS = {
  high: 80,
  medium: 60,
  low: 40,
} as const

export const USER_OVERRIDE_MODEL_VERSION = 'user-override-v1'

/**
 * Get user-facing display info for a priority level.
 * Returns null for undefined/null input.
 */
export function getPriorityDisplay(
  priority: Priority | undefined | null
): PriorityDisplayInfo | null {
  if (!priority) return null
  return PRIORITY_DISPLAY_MAP[priority] ?? null
}

/**
 * Check if the aiMetadata represents a user override
 */
export function isUserOverride(aiMetadata: { modelVersion?: string } | undefined | null): boolean {
  return aiMetadata?.modelVersion === USER_OVERRIDE_MODEL_VERSION
}
