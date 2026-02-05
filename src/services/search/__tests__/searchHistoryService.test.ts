/**
 * Search History Service Tests
 *
 * Story 2.21: Replace Lunr.js with MiniSearch
 * Task 9: Search history tests
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { searchHistoryService } from '../searchHistoryService'

describe('SearchHistoryService', () => {
  beforeEach(() => {
    searchHistoryService.clearHistory()
  })

  describe('getHistory', () => {
    it('should return empty array when no history', () => {
      expect(searchHistoryService.getHistory()).toEqual([])
    })

    it('should return stored searches', () => {
      searchHistoryService.addToHistory('test query')
      expect(searchHistoryService.getHistory()).toEqual(['test query'])
    })
  })

  describe('addToHistory', () => {
    it('should add search query to history', () => {
      searchHistoryService.addToHistory('budget')
      searchHistoryService.addToHistory('meeting')

      const history = searchHistoryService.getHistory()
      expect(history).toEqual(['meeting', 'budget'])
    })

    it('should deduplicate entries (most recent first)', () => {
      searchHistoryService.addToHistory('budget')
      searchHistoryService.addToHistory('meeting')
      searchHistoryService.addToHistory('budget') // duplicate

      const history = searchHistoryService.getHistory()
      expect(history).toEqual(['budget', 'meeting'])
    })

    it('should limit to 20 entries', () => {
      for (let i = 0; i < 25; i++) {
        searchHistoryService.addToHistory(`query-${i}`)
      }

      const history = searchHistoryService.getHistory()
      expect(history.length).toBe(20)
      // Most recent should be first
      expect(history[0]).toBe('query-24')
    })

    it('should trim whitespace', () => {
      searchHistoryService.addToHistory('  budget  ')
      // Empty trimmed string should be ignored
      searchHistoryService.addToHistory('   ')

      const history = searchHistoryService.getHistory()
      expect(history).toEqual(['budget'])
    })

    it('should ignore empty queries', () => {
      searchHistoryService.addToHistory('')
      expect(searchHistoryService.getHistory()).toEqual([])
    })
  })

  describe('clearHistory', () => {
    it('should clear all history', () => {
      searchHistoryService.addToHistory('query-1')
      searchHistoryService.addToHistory('query-2')

      searchHistoryService.clearHistory()

      expect(searchHistoryService.getHistory()).toEqual([])
    })
  })

  describe('persistence', () => {
    it('should persist across service accesses via localStorage', () => {
      searchHistoryService.addToHistory('persistent query')

      // Verify it's in localStorage
      const raw = localStorage.getItem('claine-search-history')
      expect(raw).not.toBeNull()
      expect(JSON.parse(raw!)).toContain('persistent query')
    })
  })
})
