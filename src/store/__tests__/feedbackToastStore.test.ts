/**
 * Feedback Toast Store Tests
 *
 * Story 3.6: Manual Priority Adjustment & Feedback Loop
 * Task 9: Tests for showToast, dismissToast, state management
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useFeedbackToastStore } from '../feedbackToastStore'

describe('feedbackToastStore', () => {
  beforeEach(() => {
    useFeedbackToastStore.setState({ activeToast: null })
  })

  it('defaults to null activeToast', () => {
    expect(useFeedbackToastStore.getState().activeToast).toBeNull()
  })

  it('shows a toast with message and senderEmail', () => {
    useFeedbackToastStore.getState().showToast('AI learned something', 'alice@test.com')

    const state = useFeedbackToastStore.getState()
    expect(state.activeToast).not.toBeNull()
    expect(state.activeToast!.message).toBe('AI learned something')
    expect(state.activeToast!.senderEmail).toBe('alice@test.com')
  })

  it('dismisses the active toast', () => {
    useFeedbackToastStore.getState().showToast('Test message', 'bob@test.com')
    useFeedbackToastStore.getState().dismissToast()

    expect(useFeedbackToastStore.getState().activeToast).toBeNull()
  })

  it('replaces existing toast when showing new one', () => {
    useFeedbackToastStore.getState().showToast('First', 'a@test.com')
    useFeedbackToastStore.getState().showToast('Second', 'b@test.com')

    const state = useFeedbackToastStore.getState()
    expect(state.activeToast!.message).toBe('Second')
    expect(state.activeToast!.senderEmail).toBe('b@test.com')
  })

  it('dismissing when no toast is a no-op', () => {
    useFeedbackToastStore.getState().dismissToast()
    expect(useFeedbackToastStore.getState().activeToast).toBeNull()
  })
})
