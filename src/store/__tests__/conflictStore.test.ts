import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useConflictStore } from '../conflictStore'
import type { PendingConflict, ConflictEmailData } from '@/services/sync/conflictDetection'

/**
 * Tests for Conflict Store
 *
 * AC9: Conflict resolution decisions saved for similar future conflicts
 */

describe('ConflictStore', () => {
  beforeEach(() => {
    // Reset store state
    useConflictStore.setState({
      pendingConflicts: [],
      preferences: {
        metadata: 'always-ask',
        labels: 'always-ask',
        content: 'always-ask',
      },
      loading: false,
    })

    // Clear localStorage
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    })
  })

  const createEmailData = (overrides: Partial<ConflictEmailData> = {}): ConflictEmailData => ({
    id: 'test-email-1',
    timestamp: 1700000000000,
    subject: 'Test Subject',
    body: { html: '<p>Test</p>', text: 'Test' },
    read: false,
    starred: false,
    importance: 'normal',
    labels: ['INBOX'],
    attributes: {},
    ...overrides,
  })

  const createPendingConflict = (overrides: Partial<PendingConflict> = {}): PendingConflict => ({
    id: 'conflict-1',
    emailId: 'email-1',
    accountId: 'account-1',
    type: 'content',
    localVersion: createEmailData(),
    serverVersion: createEmailData(),
    conflictingFields: ['subject'],
    detectedAt: Date.now(),
    ...overrides,
  })

  describe('pendingConflicts management', () => {
    it('should add pending conflict', () => {
      const conflict = createPendingConflict()

      useConflictStore.getState().addPendingConflict(conflict)

      expect(useConflictStore.getState().pendingConflicts).toHaveLength(1)
      expect(useConflictStore.getState().pendingConflicts[0].id).toBe('conflict-1')
    })

    it('should not add duplicate conflicts', () => {
      const conflict = createPendingConflict()

      useConflictStore.getState().addPendingConflict(conflict)
      useConflictStore.getState().addPendingConflict(conflict)

      expect(useConflictStore.getState().pendingConflicts).toHaveLength(1)
    })

    it('should remove pending conflict', () => {
      const conflict = createPendingConflict()

      useConflictStore.getState().addPendingConflict(conflict)
      useConflictStore.getState().removePendingConflict('conflict-1')

      expect(useConflictStore.getState().pendingConflicts).toHaveLength(0)
    })

    it('should clear all pending conflicts', () => {
      useConflictStore.getState().addPendingConflict(createPendingConflict({ id: 'c1' }))
      useConflictStore.getState().addPendingConflict(createPendingConflict({ id: 'c2' }))
      useConflictStore.getState().addPendingConflict(createPendingConflict({ id: 'c3' }))

      useConflictStore.getState().clearPendingConflicts()

      expect(useConflictStore.getState().pendingConflicts).toHaveLength(0)
    })

    it('should get pending count', () => {
      useConflictStore.getState().addPendingConflict(createPendingConflict({ id: 'c1' }))
      useConflictStore.getState().addPendingConflict(createPendingConflict({ id: 'c2' }))

      expect(useConflictStore.getState().getPendingCount()).toBe(2)
    })

    it('should get specific pending conflict by ID', () => {
      const conflict = createPendingConflict({ id: 'specific-conflict' })
      useConflictStore.getState().addPendingConflict(conflict)

      const found = useConflictStore.getState().getPendingConflict('specific-conflict')

      expect(found).toBeDefined()
      expect(found?.id).toBe('specific-conflict')
    })

    it('should return undefined for non-existent conflict', () => {
      const found = useConflictStore.getState().getPendingConflict('non-existent')

      expect(found).toBeUndefined()
    })

    it('should get conflicts for specific account', () => {
      useConflictStore
        .getState()
        .addPendingConflict(createPendingConflict({ id: 'c1', accountId: 'account-1' }))
      useConflictStore
        .getState()
        .addPendingConflict(createPendingConflict({ id: 'c2', accountId: 'account-2' }))
      useConflictStore
        .getState()
        .addPendingConflict(createPendingConflict({ id: 'c3', accountId: 'account-1' }))

      const account1Conflicts = useConflictStore.getState().getConflictsForAccount('account-1')

      expect(account1Conflicts).toHaveLength(2)
      expect(account1Conflicts.every((c) => c.accountId === 'account-1')).toBe(true)
    })
  })

  describe('resolveConflict', () => {
    it('should resolve conflict with local version', () => {
      const conflict = createPendingConflict({
        localVersion: createEmailData({ subject: 'Local Subject' }),
        serverVersion: createEmailData({ subject: 'Server Subject' }),
      })
      useConflictStore.getState().addPendingConflict(conflict)

      const result = useConflictStore.getState().resolveConflict('conflict-1', 'local')

      expect(result).not.toBeNull()
      expect(result?.strategy).toBe('local')
      expect(result?.resolvedData.subject).toBe('Local Subject')
      // Should be removed from pending
      expect(useConflictStore.getState().pendingConflicts).toHaveLength(0)
    })

    it('should resolve conflict with server version', () => {
      const conflict = createPendingConflict({
        localVersion: createEmailData({ subject: 'Local Subject' }),
        serverVersion: createEmailData({ subject: 'Server Subject' }),
      })
      useConflictStore.getState().addPendingConflict(conflict)

      const result = useConflictStore.getState().resolveConflict('conflict-1', 'server')

      expect(result).not.toBeNull()
      expect(result?.strategy).toBe('server')
      expect(result?.resolvedData.subject).toBe('Server Subject')
    })

    it('should resolve conflict with merged data', () => {
      const conflict = createPendingConflict()
      useConflictStore.getState().addPendingConflict(conflict)

      const mergedData = createEmailData({ subject: 'Merged Subject' })
      const result = useConflictStore.getState().resolveConflict('conflict-1', 'merged', mergedData)

      expect(result).not.toBeNull()
      expect(result?.strategy).toBe('merged')
      expect(result?.resolvedData.subject).toBe('Merged Subject')
    })

    it('should return null when resolving non-existent conflict', () => {
      const result = useConflictStore.getState().resolveConflict('non-existent', 'local')

      expect(result).toBeNull()
    })

    it('should return null when merging without merged data', () => {
      const conflict = createPendingConflict()
      useConflictStore.getState().addPendingConflict(conflict)

      const result = useConflictStore.getState().resolveConflict('conflict-1', 'merged')

      expect(result).toBeNull()
    })
  })

  describe('AC9: Preference management', () => {
    it('should set preference for conflict type', () => {
      useConflictStore.getState().setPreference('metadata', 'always-local')

      expect(useConflictStore.getState().preferences.metadata).toBe('always-local')
    })

    it('should persist preferences to localStorage', () => {
      const setItemMock = vi.fn()
      vi.stubGlobal('localStorage', {
        getItem: vi.fn(),
        setItem: setItemMock,
        removeItem: vi.fn(),
      })

      useConflictStore.getState().setPreference('labels', 'always-server')

      expect(setItemMock).toHaveBeenCalledWith('claine_conflict_preferences', expect.any(String))
    })

    it('should check if auto-resolve is enabled for metadata', () => {
      useConflictStore.getState().setPreference('metadata', 'always-local')

      expect(useConflictStore.getState().shouldAutoResolve('metadata')).toBe(true)
    })

    it('should check if auto-resolve is enabled for labels', () => {
      useConflictStore.getState().setPreference('labels', 'always-server')

      expect(useConflictStore.getState().shouldAutoResolve('labels')).toBe(true)
    })

    it('should never auto-resolve content conflicts', () => {
      useConflictStore.getState().setPreference('content', 'always-local')

      // Content conflicts should NEVER auto-resolve, regardless of preference
      expect(useConflictStore.getState().shouldAutoResolve('content')).toBe(false)
    })

    it('should return false for always-ask preference', () => {
      useConflictStore.getState().setPreference('metadata', 'always-ask')

      expect(useConflictStore.getState().shouldAutoResolve('metadata')).toBe(false)
    })

    it('should get auto-resolution strategy for local preference', () => {
      useConflictStore.getState().setPreference('metadata', 'always-local')

      expect(useConflictStore.getState().getAutoResolutionStrategy('metadata')).toBe('local')
    })

    it('should get auto-resolution strategy for server preference', () => {
      useConflictStore.getState().setPreference('labels', 'always-server')

      expect(useConflictStore.getState().getAutoResolutionStrategy('labels')).toBe('server')
    })

    it('should return null for always-ask strategy', () => {
      useConflictStore.getState().setPreference('metadata', 'always-ask')

      expect(useConflictStore.getState().getAutoResolutionStrategy('metadata')).toBeNull()
    })

    it('should always return null for content strategy', () => {
      useConflictStore.getState().setPreference('content', 'always-local')

      expect(useConflictStore.getState().getAutoResolutionStrategy('content')).toBeNull()
    })
  })
})
