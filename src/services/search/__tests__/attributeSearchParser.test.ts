/**
 * Attribute Search Parser Tests
 *
 * Story 2.15: Attribute-Based Filtering & Search
 * Task 6.4: Unit tests for attribute search parsing
 */

import { describe, it, expect } from 'vitest'
import {
  parseAttributeSearchQuery,
  formatParsedQuery,
  getAttributeSearchHints,
} from '../attributeSearchParser'

describe('attributeSearchParser', () => {
  describe('parseAttributeSearchQuery', () => {
    it('should parse simple attribute:value syntax', () => {
      const result = parseAttributeSearchQuery('Status:To-Do')

      expect(result.hasAttributeFilters).toBe(true)
      expect(result.attributeFilters.get('status')).toEqual(['To-Do'])
      expect(result.textQuery).toBe('')
    })

    it('should parse multiple attribute filters', () => {
      const result = parseAttributeSearchQuery('Status:To-Do Priority:High')

      expect(result.hasAttributeFilters).toBe(true)
      expect(result.attributeFilters.get('status')).toEqual(['To-Do'])
      expect(result.attributeFilters.get('priority')).toEqual(['High'])
      expect(result.textQuery).toBe('')
    })

    it('should extract text query from mixed input', () => {
      const result = parseAttributeSearchQuery('Status:To-Do meeting notes')

      expect(result.hasAttributeFilters).toBe(true)
      expect(result.attributeFilters.get('status')).toEqual(['To-Do'])
      expect(result.textQuery).toBe('meeting notes')
    })

    it('should handle quoted values with spaces', () => {
      const result = parseAttributeSearchQuery('Project:"My Project"')

      expect(result.hasAttributeFilters).toBe(true)
      expect(result.attributeFilters.get('project')).toEqual(['My Project'])
    })

    it('should handle single-quoted values', () => {
      const result = parseAttributeSearchQuery("Category:'Work Related'")

      expect(result.hasAttributeFilters).toBe(true)
      expect(result.attributeFilters.get('category')).toEqual(['Work Related'])
    })

    it('should preserve case in values but normalize attribute names', () => {
      const result = parseAttributeSearchQuery('STATUS:In-Progress Priority:HIGH')

      expect(result.attributeFilters.get('status')).toEqual(['In-Progress'])
      expect(result.attributeFilters.get('priority')).toEqual(['HIGH'])
    })

    it('should handle multiple values for same attribute', () => {
      const result = parseAttributeSearchQuery('Status:To-Do Status:In-Progress')

      expect(result.attributeFilters.get('status')).toEqual(['To-Do', 'In-Progress'])
    })

    it('should return empty filters for plain text query', () => {
      const result = parseAttributeSearchQuery('budget meeting')

      expect(result.hasAttributeFilters).toBe(false)
      expect(result.attributeFilters.size).toBe(0)
      expect(result.textQuery).toBe('budget meeting')
    })

    it('should handle empty query', () => {
      const result = parseAttributeSearchQuery('')

      expect(result.hasAttributeFilters).toBe(false)
      expect(result.textQuery).toBe('')
    })

    it('should handle complex mixed query', () => {
      const result = parseAttributeSearchQuery('Status:To-Do "budget meeting" Priority:High notes')

      expect(result.attributeFilters.get('status')).toEqual(['To-Do'])
      expect(result.attributeFilters.get('priority')).toEqual(['High'])
      expect(result.textQuery).toBe('"budget meeting" notes')
    })

    it('should handle attribute with numbers in name', () => {
      const result = parseAttributeSearchQuery('Field1:value test')

      expect(result.attributeFilters.get('field1')).toEqual(['value'])
      expect(result.textQuery).toBe('test')
    })
  })

  describe('formatParsedQuery', () => {
    it('should format parsed query back to string', () => {
      const parsed = parseAttributeSearchQuery('Status:To-Do meeting')
      const formatted = formatParsedQuery(parsed)

      expect(formatted).toContain('status:To-Do')
      expect(formatted).toContain('meeting')
    })

    it('should quote values with spaces', () => {
      const parsed = parseAttributeSearchQuery('Project:"My Project"')
      const formatted = formatParsedQuery(parsed)

      expect(formatted).toBe('project:"My Project"')
    })

    it('should handle empty text query', () => {
      const parsed = parseAttributeSearchQuery('Status:To-Do')
      const formatted = formatParsedQuery(parsed)

      expect(formatted).toBe('status:To-Do')
    })
  })

  describe('getAttributeSearchHints', () => {
    it('should return an array of hints', () => {
      const hints = getAttributeSearchHints()

      expect(Array.isArray(hints)).toBe(true)
      expect(hints.length).toBeGreaterThan(0)
    })

    it('should include common attribute hints', () => {
      const hints = getAttributeSearchHints()
      const labels = hints.map((h) => h.label)

      expect(labels).toContain('Status:')
      expect(labels).toContain('Priority:')
    })

    it('should include hint for quoted values', () => {
      const hints = getAttributeSearchHints()
      const quotedHint = hints.find((h) => h.label.includes('"'))

      expect(quotedHint).toBeDefined()
      expect(quotedHint?.description).toContain('spaces')
    })
  })
})
