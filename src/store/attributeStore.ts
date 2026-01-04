/**
 * Attribute Store
 * Manages attribute state using Zustand
 *
 * Story 2.13: Custom Attributes System - Data Model & CRUD
 * Task 4: Create Zustand Store for Attributes
 *
 * Features:
 * - Track attribute definitions
 * - Subscribe to RxDB changes for reactive updates
 * - Optimistic updates with rollback on error
 */

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { attributeService } from '@/services/attributes/attributeService'
import { logger } from '@/services/logger'
import type {
  Attribute,
  CreateAttributeInput,
  UpdateAttributeInput,
  AttributeValidationResult,
} from '@/types/attributes'

/**
 * Attribute store state and actions
 */
interface AttributeState {
  attributes: Attribute[]
  loading: boolean
  error: string | null
  initialized: boolean

  // Actions
  fetchAttributes: () => Promise<void>
  addAttribute: (input: CreateAttributeInput) => Promise<Attribute>
  updateAttribute: (id: string, updates: UpdateAttributeInput) => Promise<Attribute>
  deleteAttribute: (id: string) => Promise<void>
  toggleAttribute: (id: string, enabled: boolean) => Promise<void>
  reorderAttributes: (orderedIds: string[]) => Promise<void>
  validateAttribute: (
    input: Partial<CreateAttributeInput>,
    existingId?: string
  ) => Promise<AttributeValidationResult>

  // Getters
  getAttributeById: (id: string) => Attribute | undefined
  getEnabledAttributes: () => Attribute[]
  getBuiltInAttributes: () => Attribute[]
  getCustomAttributes: () => Attribute[]

  // Internal
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setAttributes: (attributes: Attribute[]) => void
  clearError: () => void
}

/**
 * Attribute store using Zustand
 * Follows project conventions from accountStore.ts
 */
export const useAttributeStore = create<AttributeState>()(
  subscribeWithSelector((set, get) => ({
    attributes: [],
    loading: false,
    error: null,
    initialized: false,

    /**
     * Fetch all attributes from RxDB
     */
    fetchAttributes: async () => {
      set({ loading: true, error: null })

      try {
        const attributes = await attributeService.getAttributes()
        set({ attributes, loading: false, initialized: true })
        logger.debug('attributeStore', 'Attributes loaded', { count: attributes.length })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load attributes'
        logger.error('attributeStore', 'Failed to fetch attributes', { error: message })
        set({ error: message, loading: false })
      }
    },

    /**
     * Add a new attribute
     * Uses optimistic update pattern
     */
    addAttribute: async (input: CreateAttributeInput) => {
      const { attributes } = get()
      set({ error: null })

      try {
        const created = await attributeService.createAttribute(input)

        // Add to store sorted by order
        const newAttributes = [...attributes, created].sort((a, b) => a.order - b.order)
        set({ attributes: newAttributes })

        logger.info('attributeStore', 'Attribute added', { id: created.id, name: created.name })
        return created
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create attribute'
        logger.error('attributeStore', 'Failed to add attribute', { error: message })
        set({ error: message })
        throw error
      }
    },

    /**
     * Update an existing attribute
     * Uses optimistic update pattern
     */
    updateAttribute: async (id: string, updates: UpdateAttributeInput) => {
      const { attributes } = get()
      const existingIndex = attributes.findIndex((a) => a.id === id)

      if (existingIndex === -1) {
        const error = `Attribute not found: ${id}`
        set({ error })
        throw new Error(error)
      }

      // Store original for rollback
      const original = attributes[existingIndex]

      // Optimistic update
      const optimistic = { ...original, ...updates, updatedAt: Date.now() }
      const optimisticAttributes = [...attributes]
      optimisticAttributes[existingIndex] = optimistic
      set({ attributes: optimisticAttributes, error: null })

      try {
        const updated = await attributeService.updateAttribute(id, updates)

        // Update with server response
        const newAttributes = [...get().attributes]
        const idx = newAttributes.findIndex((a) => a.id === id)
        if (idx !== -1) {
          newAttributes[idx] = updated
        }
        set({ attributes: newAttributes.sort((a, b) => a.order - b.order) })

        logger.info('attributeStore', 'Attribute updated', { id })
        return updated
      } catch (error) {
        // Rollback optimistic update
        const rollbackAttributes = [...get().attributes]
        const rollbackIdx = rollbackAttributes.findIndex((a) => a.id === id)
        if (rollbackIdx !== -1) {
          rollbackAttributes[rollbackIdx] = original
        }

        const message = error instanceof Error ? error.message : 'Failed to update attribute'
        logger.error('attributeStore', 'Failed to update attribute', { id, error: message })
        set({ attributes: rollbackAttributes, error: message })
        throw error
      }
    },

    /**
     * Delete an attribute
     */
    deleteAttribute: async (id: string) => {
      const { attributes } = get()
      const existingIndex = attributes.findIndex((a) => a.id === id)

      if (existingIndex === -1) {
        const error = `Attribute not found: ${id}`
        set({ error })
        throw new Error(error)
      }

      // Store original for rollback
      const original = attributes[existingIndex]

      // Optimistic delete
      const optimisticAttributes = attributes.filter((a) => a.id !== id)
      set({ attributes: optimisticAttributes, error: null })

      try {
        await attributeService.deleteAttribute(id)
        logger.info('attributeStore', 'Attribute deleted', { id })
      } catch (error) {
        // Rollback optimistic delete
        const rollbackAttributes = [...get().attributes, original].sort((a, b) => a.order - b.order)

        const message = error instanceof Error ? error.message : 'Failed to delete attribute'
        logger.error('attributeStore', 'Failed to delete attribute', { id, error: message })
        set({ attributes: rollbackAttributes, error: message })
        throw error
      }
    },

    /**
     * Toggle attribute enabled state
     */
    toggleAttribute: async (id: string, enabled: boolean) => {
      await get().updateAttribute(id, { enabled })
    },

    /**
     * Reorder attributes
     */
    reorderAttributes: async (orderedIds: string[]) => {
      const { attributes } = get()

      // Build optimistic reorder
      const orderMap = new Map(orderedIds.map((id, index) => [id, index]))
      const optimisticAttributes = [...attributes].sort((a, b) => {
        const aOrder = orderMap.get(a.id) ?? a.order
        const bOrder = orderMap.get(b.id) ?? b.order
        return aOrder - bOrder
      })

      // Update order values
      const updatedAttributes = optimisticAttributes.map((attr, index) => ({
        ...attr,
        order: index,
      }))

      const original = attributes
      set({ attributes: updatedAttributes, error: null })

      try {
        await attributeService.reorderAttributes(orderedIds)
        logger.info('attributeStore', 'Attributes reordered', { count: orderedIds.length })
      } catch (error) {
        // Rollback
        const message = error instanceof Error ? error.message : 'Failed to reorder attributes'
        logger.error('attributeStore', 'Failed to reorder attributes', { error: message })
        set({ attributes: original, error: message })
        throw error
      }
    },

    /**
     * Validate attribute input
     */
    validateAttribute: async (input: Partial<CreateAttributeInput>, existingId?: string) => {
      return attributeService.validateAttribute(input, existingId)
    },

    /**
     * Get attribute by ID
     */
    getAttributeById: (id: string) => {
      return get().attributes.find((a) => a.id === id)
    },

    /**
     * Get only enabled attributes
     */
    getEnabledAttributes: () => {
      return get().attributes.filter((a) => a.enabled)
    },

    /**
     * Get built-in (preset) attributes
     */
    getBuiltInAttributes: () => {
      return get().attributes.filter((a) => a.isBuiltIn)
    },

    /**
     * Get custom (user-created) attributes
     */
    getCustomAttributes: () => {
      return get().attributes.filter((a) => !a.isBuiltIn)
    },

    /**
     * Set loading state
     */
    setLoading: (loading: boolean) => set({ loading }),

    /**
     * Set error state
     */
    setError: (error: string | null) => set({ error }),

    /**
     * Set attributes directly (for subscription updates)
     */
    setAttributes: (attributes: Attribute[]) =>
      set({ attributes: attributes.sort((a, b) => a.order - b.order) }),

    /**
     * Clear error
     */
    clearError: () => set({ error: null }),
  }))
)

/**
 * Expose attribute store for E2E testing in development mode
 */
if (import.meta.env.DEV) {
  ;(
    window as unknown as { __TEST_ATTRIBUTE_STORE__: typeof useAttributeStore }
  ).__TEST_ATTRIBUTE_STORE__ = useAttributeStore
}
