/**
 * useAttributes Hook
 *
 * Story 2.13: Custom Attributes System - Data Model & CRUD
 * Task 2.3: Create useAttributes hook for React components
 *
 * Provides a convenient interface to the attribute store for React components.
 * Handles initialization and provides commonly used selectors.
 *
 * Usage:
 *   const { attributes, loading, addAttribute, ... } = useAttributes()
 */

import { useEffect, useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useAttributeStore } from '@/store/attributeStore'
import type { Attribute, CreateAttributeInput, UpdateAttributeInput } from '@/types/attributes'

/**
 * Hook return type
 */
export interface UseAttributesReturn {
  // State
  attributes: Attribute[]
  enabledAttributes: Attribute[]
  builtInAttributes: Attribute[]
  customAttributes: Attribute[]
  loading: boolean
  error: string | null
  initialized: boolean

  // Actions
  addAttribute: (input: CreateAttributeInput) => Promise<Attribute>
  updateAttribute: (id: string, updates: UpdateAttributeInput) => Promise<Attribute>
  deleteAttribute: (id: string) => Promise<void>
  toggleAttribute: (id: string, enabled: boolean) => Promise<void>
  reorderAttributes: (orderedIds: string[]) => Promise<void>
  refreshAttributes: () => Promise<void>
  clearError: () => void

  // Getters
  getAttributeById: (id: string) => Attribute | undefined
  getAttributeByName: (name: string) => Attribute | undefined
}

/**
 * useAttributes - Access and manage attributes from React components
 *
 * Features:
 * - Auto-fetches attributes on mount if not initialized
 * - Provides computed properties for filtered lists
 * - Exposes store actions with consistent interface
 */
export function useAttributes(): UseAttributesReturn {
  // Select state with shallow comparison for performance
  const {
    attributes,
    loading,
    error,
    initialized,
    fetchAttributes,
    addAttribute,
    updateAttribute,
    deleteAttribute,
    toggleAttribute,
    reorderAttributes,
    getAttributeById,
    getEnabledAttributes,
    getBuiltInAttributes,
    getCustomAttributes,
    clearError,
  } = useAttributeStore(
    useShallow((state) => ({
      attributes: state.attributes,
      loading: state.loading,
      error: state.error,
      initialized: state.initialized,
      fetchAttributes: state.fetchAttributes,
      addAttribute: state.addAttribute,
      updateAttribute: state.updateAttribute,
      deleteAttribute: state.deleteAttribute,
      toggleAttribute: state.toggleAttribute,
      reorderAttributes: state.reorderAttributes,
      getAttributeById: state.getAttributeById,
      getEnabledAttributes: state.getEnabledAttributes,
      getBuiltInAttributes: state.getBuiltInAttributes,
      getCustomAttributes: state.getCustomAttributes,
      clearError: state.clearError,
    }))
  )

  // Auto-fetch on mount if not initialized
  useEffect(() => {
    if (!initialized && !loading) {
      fetchAttributes()
    }
  }, [initialized, loading, fetchAttributes])

  // Computed filtered lists
  const enabledAttributes = getEnabledAttributes()
  const builtInAttributes = getBuiltInAttributes()
  const customAttributes = getCustomAttributes()

  // Get attribute by name (case-insensitive)
  const getAttributeByName = useCallback(
    (name: string): Attribute | undefined => {
      const normalizedName = name.toLowerCase().trim()
      return attributes.find((a) => a.name.toLowerCase() === normalizedName)
    },
    [attributes]
  )

  return {
    // State
    attributes,
    enabledAttributes,
    builtInAttributes,
    customAttributes,
    loading,
    error,
    initialized,

    // Actions
    addAttribute,
    updateAttribute,
    deleteAttribute,
    toggleAttribute,
    reorderAttributes,
    refreshAttributes: fetchAttributes,
    clearError,

    // Getters
    getAttributeById,
    getAttributeByName,
  }
}

export default useAttributes
