import { describe, it, expect } from 'vitest'
import {
  resolveMetadataConflict,
  resolveLabelConflict,
  resolveAttributeConflict,
  resolveKeepLocal,
  resolveKeepServer,
  resolveMerged,
  autoResolve,
} from '../resolutionStrategies'
import type { ConflictEmailData } from '../conflictDetection'

/**
 * Tests for Conflict Resolution Strategies
 *
 * AC4: Last-write-wins applied for metadata (read status, starred, archived)
 * AC5: Merge strategy applied for labels/attributes (union of both sets)
 * AC16: Test: User resolves conflict → correct version saved
 */

describe('Resolution Strategies', () => {
  const createEmailData = (overrides: Partial<ConflictEmailData> = {}): ConflictEmailData => ({
    id: 'test-email-1',
    timestamp: 1700000000000,
    subject: 'Test Subject',
    body: {
      html: '<p>Test body</p>',
      text: 'Test body',
    },
    read: false,
    starred: false,
    importance: 'normal',
    labels: ['INBOX'],
    attributes: {},
    ...overrides,
  })

  describe('AC4: resolveMetadataConflict (last-write-wins)', () => {
    it('should use local values when local is newer', () => {
      const localEmail = createEmailData({
        read: true,
        starred: true,
        importance: 'high',
        localModifiedAt: 1700000002000,
      })
      const serverEmail = createEmailData({
        read: false,
        starred: false,
        importance: 'low',
        timestamp: 1700000001000,
      })

      const result = resolveMetadataConflict(localEmail, serverEmail)

      expect(result.resolvedData.read).toBe(true)
      expect(result.resolvedData.starred).toBe(true)
      expect(result.resolvedData.importance).toBe('high')
      expect(result.strategy).toBe('auto-lww')
    })

    it('should use server values when server is newer', () => {
      const localEmail = createEmailData({
        read: true,
        starred: true,
        importance: 'high',
        localModifiedAt: 1700000001000,
      })
      const serverEmail = createEmailData({
        read: false,
        starred: false,
        importance: 'low',
        timestamp: 1700000002000,
      })

      const result = resolveMetadataConflict(localEmail, serverEmail)

      expect(result.resolvedData.read).toBe(false)
      expect(result.resolvedData.starred).toBe(false)
      expect(result.resolvedData.importance).toBe('low')
      expect(result.strategy).toBe('auto-lww')
    })

    it('should track which fields were changed', () => {
      const localEmail = createEmailData({
        read: true,
        starred: false, // Same as server
        importance: 'high',
        localModifiedAt: 1700000002000,
      })
      const serverEmail = createEmailData({
        read: false,
        starred: false, // Same as local
        importance: 'low',
        timestamp: 1700000001000,
      })

      const result = resolveMetadataConflict(localEmail, serverEmail)

      // Should only log changed fields
      expect(result.changesApplied.some((c) => c.includes('read'))).toBe(true)
      expect(result.changesApplied.some((c) => c.includes('importance'))).toBe(true)
      expect(result.changesApplied.some((c) => c.includes('starred'))).toBe(false)
    })

    it('should clear localModifiedAt after resolution', () => {
      const localEmail = createEmailData({ localModifiedAt: 1700000002000 })
      const serverEmail = createEmailData({ timestamp: 1700000001000 })

      const result = resolveMetadataConflict(localEmail, serverEmail)

      expect(result.resolvedData.localModifiedAt).toBeUndefined()
    })
  })

  describe('AC5: resolveLabelConflict (union merge)', () => {
    it('should merge labels from both versions (union)', () => {
      const localEmail = createEmailData({
        labels: ['INBOX', 'LOCAL-LABEL', 'SHARED'],
      })
      const serverEmail = createEmailData({
        labels: ['INBOX', 'SERVER-LABEL', 'SHARED'],
      })

      const result = resolveLabelConflict(localEmail, serverEmail)

      expect(result.resolvedData.labels).toContain('INBOX')
      expect(result.resolvedData.labels).toContain('LOCAL-LABEL')
      expect(result.resolvedData.labels).toContain('SERVER-LABEL')
      expect(result.resolvedData.labels).toContain('SHARED')
      expect(result.resolvedData.labels).toHaveLength(4)
      expect(result.strategy).toBe('auto-merge')
    })

    it('should handle empty local labels', () => {
      const localEmail = createEmailData({ labels: [] })
      const serverEmail = createEmailData({ labels: ['SERVER-LABEL'] })

      const result = resolveLabelConflict(localEmail, serverEmail)

      expect(result.resolvedData.labels).toEqual(['SERVER-LABEL'])
    })

    it('should handle empty server labels', () => {
      const localEmail = createEmailData({ labels: ['LOCAL-LABEL'] })
      const serverEmail = createEmailData({ labels: [] })

      const result = resolveLabelConflict(localEmail, serverEmail)

      expect(result.resolvedData.labels).toEqual(['LOCAL-LABEL'])
    })

    it('should track added labels in changesApplied', () => {
      const localEmail = createEmailData({ labels: ['INBOX', 'LOCAL-ONLY'] })
      const serverEmail = createEmailData({ labels: ['INBOX', 'SERVER-ONLY'] })

      const result = resolveLabelConflict(localEmail, serverEmail)

      expect(result.changesApplied.some((c) => c.includes('LOCAL-ONLY'))).toBe(true)
      expect(result.changesApplied.some((c) => c.includes('SERVER-ONLY'))).toBe(true)
    })
  })

  describe('resolveAttributeConflict (per-key last-write-wins)', () => {
    it('should merge attributes from both versions', () => {
      const localEmail = createEmailData({
        attributes: { local: 'value', shared: 'local-value' },
        localModifiedAt: 1700000002000,
      })
      const serverEmail = createEmailData({
        attributes: { server: 'value', shared: 'server-value' },
        timestamp: 1700000001000,
      })

      const result = resolveAttributeConflict(localEmail, serverEmail)

      expect(result.resolvedData.attributes.local).toBe('value')
      expect(result.resolvedData.attributes.server).toBe('value')
      // Local is newer, so local value wins for shared key
      expect(result.resolvedData.attributes.shared).toBe('local-value')
      expect(result.strategy).toBe('auto-merge')
    })

    it('should use server value when server is newer for conflicting keys', () => {
      const localEmail = createEmailData({
        attributes: { shared: 'local-value' },
        localModifiedAt: 1700000001000,
      })
      const serverEmail = createEmailData({
        attributes: { shared: 'server-value' },
        timestamp: 1700000002000,
      })

      const result = resolveAttributeConflict(localEmail, serverEmail)

      expect(result.resolvedData.attributes.shared).toBe('server-value')
    })

    it('should keep attributes that only exist in local', () => {
      const localEmail = createEmailData({
        attributes: { localOnly: 'value' },
      })
      const serverEmail = createEmailData({
        attributes: {},
      })

      const result = resolveAttributeConflict(localEmail, serverEmail)

      expect(result.resolvedData.attributes.localOnly).toBe('value')
    })

    it('should keep attributes that only exist in server', () => {
      const localEmail = createEmailData({
        attributes: {},
      })
      const serverEmail = createEmailData({
        attributes: { serverOnly: 'value' },
      })

      const result = resolveAttributeConflict(localEmail, serverEmail)

      expect(result.resolvedData.attributes.serverOnly).toBe('value')
    })
  })

  describe('AC16: Manual resolution strategies', () => {
    describe('resolveKeepLocal', () => {
      it('should return local data with localModifiedAt cleared', () => {
        const localEmail = createEmailData({
          subject: 'Local Subject',
          body: { text: 'Local body' },
          localModifiedAt: 1700000002000,
        })

        const result = resolveKeepLocal(localEmail)

        expect(result.resolvedData.subject).toBe('Local Subject')
        expect(result.resolvedData.body.text).toBe('Local body')
        expect(result.resolvedData.localModifiedAt).toBeUndefined()
        expect(result.strategy).toBe('local')
      })
    })

    describe('resolveKeepServer', () => {
      it('should return server data', () => {
        const serverEmail = createEmailData({
          subject: 'Server Subject',
          body: { text: 'Server body' },
        })

        const result = resolveKeepServer(serverEmail)

        expect(result.resolvedData.subject).toBe('Server Subject')
        expect(result.resolvedData.body.text).toBe('Server body')
        expect(result.strategy).toBe('server')
      })
    })

    describe('resolveMerged', () => {
      it('should return merged data with custom changes description', () => {
        const mergedEmail = createEmailData({
          subject: 'Merged Subject',
          body: { text: 'Merged body from user' },
          localModifiedAt: 1700000002000,
        })

        const result = resolveMerged(mergedEmail, ['subject merged', 'body edited'])

        expect(result.resolvedData.subject).toBe('Merged Subject')
        expect(result.resolvedData.body.text).toBe('Merged body from user')
        expect(result.resolvedData.localModifiedAt).toBeUndefined()
        expect(result.strategy).toBe('merged')
        expect(result.changesApplied).toContain('subject merged')
        expect(result.changesApplied).toContain('body edited')
      })

      it('should use default changes description when not provided', () => {
        const mergedEmail = createEmailData({})

        const result = resolveMerged(mergedEmail)

        expect(result.changesApplied).toContain('manually merged by user')
      })
    })
  })

  describe('autoResolve', () => {
    it('should auto-resolve metadata conflicts', () => {
      const localEmail = createEmailData({
        read: true,
        localModifiedAt: 1700000002000,
      })
      const serverEmail = createEmailData({
        read: false,
        timestamp: 1700000001000,
      })

      const result = autoResolve('metadata', localEmail, serverEmail)

      expect(result).not.toBeNull()
      expect(result?.strategy).toBe('auto-lww')
    })

    it('should auto-resolve label conflicts', () => {
      const localEmail = createEmailData({ labels: ['LOCAL'] })
      const serverEmail = createEmailData({ labels: ['SERVER'] })

      const result = autoResolve('labels', localEmail, serverEmail)

      expect(result).not.toBeNull()
      expect(result?.strategy).toBe('auto-merge')
    })

    it('should return null for content conflicts (requires manual)', () => {
      const localEmail = createEmailData({ subject: 'Local' })
      const serverEmail = createEmailData({ subject: 'Server' })

      const result = autoResolve('content', localEmail, serverEmail)

      expect(result).toBeNull()
    })
  })
})
