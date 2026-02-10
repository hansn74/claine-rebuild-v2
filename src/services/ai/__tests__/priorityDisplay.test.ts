/**
 * Priority Display Tests
 *
 * Story 3.3: Priority Scoring Model
 * Task 9: priorityDisplay utility tests
 */

import { describe, it, expect } from 'vitest'
import {
  getPriorityDisplay,
  isUserOverride,
  PRIORITY_THRESHOLDS,
  USER_OVERRIDE_MODEL_VERSION,
} from '../priorityDisplay'

describe('getPriorityDisplay', () => {
  it('returns display info for high priority', () => {
    const display = getPriorityDisplay('high')
    expect(display).not.toBeNull()
    expect(display!.label).toBe('Urgent')
    expect(display!.textClass).toBe('text-red-600')
    expect(display!.bgClass).toBe('bg-red-100')
  })

  it('returns display info for medium priority', () => {
    const display = getPriorityDisplay('medium')
    expect(display).not.toBeNull()
    expect(display!.label).toBe('Important')
    expect(display!.textClass).toBe('text-amber-500')
  })

  it('returns display info for low priority', () => {
    const display = getPriorityDisplay('low')
    expect(display).not.toBeNull()
    expect(display!.label).toBe('Updates')
    expect(display!.textClass).toBe('text-blue-500')
  })

  it('returns display info for none priority', () => {
    const display = getPriorityDisplay('none')
    expect(display).not.toBeNull()
    expect(display!.label).toBe('Low')
    expect(display!.textClass).toBe('text-gray-500')
  })

  it('returns null for undefined priority', () => {
    expect(getPriorityDisplay(undefined)).toBeNull()
  })

  it('returns null for null priority', () => {
    expect(getPriorityDisplay(null)).toBeNull()
  })

  it('includes description for each priority', () => {
    for (const priority of ['high', 'medium', 'low', 'none'] as const) {
      const display = getPriorityDisplay(priority)
      expect(display!.description).toBeTruthy()
    }
  })
})

describe('isUserOverride', () => {
  it('returns true for user override model version', () => {
    expect(isUserOverride({ modelVersion: USER_OVERRIDE_MODEL_VERSION })).toBe(true)
  })

  it('returns false for AI model versions', () => {
    expect(isUserOverride({ modelVersion: 'heuristic-v1' })).toBe(false)
    expect(isUserOverride({ modelVersion: 'llm-model-v1' })).toBe(false)
  })

  it('returns false for undefined aiMetadata', () => {
    expect(isUserOverride(undefined)).toBe(false)
  })

  it('returns false for null aiMetadata', () => {
    expect(isUserOverride(null)).toBe(false)
  })

  it('returns false when modelVersion is missing', () => {
    expect(isUserOverride({})).toBe(false)
  })
})

describe('PRIORITY_THRESHOLDS', () => {
  it('has correct threshold values', () => {
    expect(PRIORITY_THRESHOLDS.high).toBe(80)
    expect(PRIORITY_THRESHOLDS.medium).toBe(60)
    expect(PRIORITY_THRESHOLDS.low).toBe(40)
  })
})
