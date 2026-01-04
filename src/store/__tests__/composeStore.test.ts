/**
 * Compose Store Tests
 *
 * Story 2.3: Compose & Reply Interface
 * Task 10: Testing
 *
 * Tests for global compose state management with Zustand
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useComposeStore } from '../composeStore'
import type { ComposeContext } from '@/components/compose/ComposeDialog'

describe('composeStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    useComposeStore.setState({
      isOpen: false,
      context: null,
      draftId: null,
    })
  })

  describe('initial state', () => {
    it('should have isOpen false initially', () => {
      const state = useComposeStore.getState()
      expect(state.isOpen).toBe(false)
    })

    it('should have null context initially', () => {
      const state = useComposeStore.getState()
      expect(state.context).toBeNull()
    })

    it('should have null draftId initially', () => {
      const state = useComposeStore.getState()
      expect(state.draftId).toBeNull()
    })
  })

  describe('openCompose', () => {
    it('should set isOpen to true', () => {
      useComposeStore.getState().openCompose()

      expect(useComposeStore.getState().isOpen).toBe(true)
    })

    it('should clear context and draftId', () => {
      // First set some state
      useComposeStore.setState({
        context: {
          type: 'reply',
          to: [],
          cc: [],
          subject: 'Test',
          quotedContent: '',
        },
        draftId: 'draft-old',
      })

      // Then open fresh compose
      useComposeStore.getState().openCompose()

      expect(useComposeStore.getState().context).toBeNull()
      expect(useComposeStore.getState().draftId).toBeNull()
    })
  })

  describe('openComposeWithContext', () => {
    const replyContext: ComposeContext = {
      type: 'reply',
      to: [{ name: 'John', email: 'john@example.com' }],
      cc: [],
      subject: 'Re: Test',
      quotedContent: '<p>Original message</p>',
      replyToEmailId: 'email-123',
      threadId: 'thread-456',
    }

    it('should set isOpen to true', () => {
      useComposeStore.getState().openComposeWithContext(replyContext)

      expect(useComposeStore.getState().isOpen).toBe(true)
    })

    it('should set context', () => {
      useComposeStore.getState().openComposeWithContext(replyContext)

      expect(useComposeStore.getState().context).toEqual(replyContext)
    })

    it('should clear draftId', () => {
      // First set a draft ID
      useComposeStore.setState({ draftId: 'old-draft' })

      useComposeStore.getState().openComposeWithContext(replyContext)

      expect(useComposeStore.getState().draftId).toBeNull()
    })

    it('should handle reply-all context', () => {
      const replyAllContext: ComposeContext = {
        type: 'reply-all',
        to: [{ name: 'John', email: 'john@example.com' }],
        cc: [{ name: 'Jane', email: 'jane@example.com' }],
        subject: 'Re: Test',
        quotedContent: '',
      }

      useComposeStore.getState().openComposeWithContext(replyAllContext)

      expect(useComposeStore.getState().context?.type).toBe('reply-all')
      expect(useComposeStore.getState().context?.cc).toHaveLength(1)
    })

    it('should handle forward context', () => {
      const forwardContext: ComposeContext = {
        type: 'forward',
        to: [],
        cc: [],
        subject: 'Fwd: Test',
        quotedContent: '<div>Forwarded content</div>',
      }

      useComposeStore.getState().openComposeWithContext(forwardContext)

      expect(useComposeStore.getState().context?.type).toBe('forward')
      expect(useComposeStore.getState().context?.to).toHaveLength(0)
    })
  })

  describe('openDraft', () => {
    it('should set isOpen to true', () => {
      useComposeStore.getState().openDraft('draft-123')

      expect(useComposeStore.getState().isOpen).toBe(true)
    })

    it('should set draftId', () => {
      useComposeStore.getState().openDraft('draft-123')

      expect(useComposeStore.getState().draftId).toBe('draft-123')
    })

    it('should clear context', () => {
      // First set some context
      useComposeStore.setState({
        context: {
          type: 'reply',
          to: [],
          cc: [],
          subject: 'Test',
          quotedContent: '',
        },
      })

      useComposeStore.getState().openDraft('draft-123')

      expect(useComposeStore.getState().context).toBeNull()
    })
  })

  describe('closeCompose', () => {
    it('should set isOpen to false', () => {
      // First open
      useComposeStore.getState().openCompose()
      expect(useComposeStore.getState().isOpen).toBe(true)

      // Then close
      useComposeStore.getState().closeCompose()
      expect(useComposeStore.getState().isOpen).toBe(false)
    })

    it('should clear context on close', () => {
      const context: ComposeContext = {
        type: 'reply',
        to: [{ name: 'John', email: 'john@example.com' }],
        cc: [],
        subject: 'Test',
        quotedContent: '',
      }

      useComposeStore.getState().openComposeWithContext(context)
      useComposeStore.getState().closeCompose()

      expect(useComposeStore.getState().context).toBeNull()
    })

    it('should clear draftId on close', () => {
      useComposeStore.getState().openDraft('draft-123')
      useComposeStore.getState().closeCompose()

      expect(useComposeStore.getState().draftId).toBeNull()
    })
  })

  describe('workflow scenarios', () => {
    it('should support new compose workflow', () => {
      // User clicks compose button
      useComposeStore.getState().openCompose()

      expect(useComposeStore.getState().isOpen).toBe(true)
      expect(useComposeStore.getState().context).toBeNull()
      expect(useComposeStore.getState().draftId).toBeNull()
    })

    it('should support reply workflow', () => {
      // User clicks reply on an email
      const context: ComposeContext = {
        type: 'reply',
        to: [{ name: 'Sender', email: 'sender@example.com' }],
        cc: [],
        subject: 'Re: Original Subject',
        quotedContent: 'On Dec 1, Sender wrote...',
        replyToEmailId: 'email-original',
        threadId: 'thread-123',
      }

      useComposeStore.getState().openComposeWithContext(context)

      expect(useComposeStore.getState().isOpen).toBe(true)
      expect(useComposeStore.getState().context?.type).toBe('reply')
      expect(useComposeStore.getState().context?.to).toHaveLength(1)
    })

    it('should support draft resume workflow', () => {
      // User resumes a draft
      useComposeStore.getState().openDraft('draft-saved')

      expect(useComposeStore.getState().isOpen).toBe(true)
      expect(useComposeStore.getState().draftId).toBe('draft-saved')
      expect(useComposeStore.getState().context).toBeNull()
    })

    it('should support complete compose cycle', () => {
      // 1. Open new compose
      useComposeStore.getState().openCompose()
      expect(useComposeStore.getState().isOpen).toBe(true)

      // 2. Close
      useComposeStore.getState().closeCompose()
      expect(useComposeStore.getState().isOpen).toBe(false)

      // 3. Open reply
      const context: ComposeContext = {
        type: 'reply',
        to: [{ name: 'John', email: 'john@example.com' }],
        cc: [],
        subject: 'Re: Test',
        quotedContent: '',
      }
      useComposeStore.getState().openComposeWithContext(context)
      expect(useComposeStore.getState().context).toEqual(context)

      // 4. Close
      useComposeStore.getState().closeCompose()
      expect(useComposeStore.getState().context).toBeNull()

      // 5. Open draft
      useComposeStore.getState().openDraft('draft-456')
      expect(useComposeStore.getState().draftId).toBe('draft-456')
    })
  })
})
