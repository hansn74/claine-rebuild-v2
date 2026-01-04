import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConflictResolutionModal } from '../ConflictResolutionModal'
import type { PendingConflict, ConflictEmailData } from '@/services/sync/conflictDetection'

/**
 * Tests for ConflictResolutionModal Component
 *
 * AC6: User prompted with diff view for body/subject conflicts
 * AC7: User can choose: Keep Local, Keep Server, or Merge manually
 * AC8: Conflict resolution UI shows local version, server version, side-by-side diff
 * AC16: Test: User resolves conflict → correct version saved
 */

describe('ConflictResolutionModal', () => {
  const createEmailData = (overrides: Partial<ConflictEmailData> = {}): ConflictEmailData => ({
    id: 'test-email-1',
    timestamp: 1700000000000,
    subject: 'Test Subject',
    body: { html: '<p>Test body</p>', text: 'Test body' },
    read: false,
    starred: false,
    importance: 'normal',
    labels: ['INBOX'],
    attributes: {},
    ...overrides,
  })

  const createConflict = (overrides: Partial<PendingConflict> = {}): PendingConflict => ({
    id: 'conflict-1',
    emailId: 'email-1',
    accountId: 'account-1',
    type: 'content',
    localVersion: createEmailData({
      subject: 'Local Subject',
      body: { text: 'Local body text', html: '<p>Local body text</p>' },
      localModifiedAt: 1700000002000,
    }),
    serverVersion: createEmailData({
      subject: 'Server Subject',
      body: { text: 'Server body text', html: '<p>Server body text</p>' },
      timestamp: 1700000001000,
    }),
    conflictingFields: ['subject', 'body'],
    detectedAt: Date.now(),
    ...overrides,
  })

  let mockOnResolve: ReturnType<typeof vi.fn>
  let mockOnCancel: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockOnResolve = vi.fn()
    mockOnCancel = vi.fn()
  })

  describe('AC8: Side-by-side display', () => {
    it('should display local version with title', () => {
      const conflict = createConflict()
      render(
        <ConflictResolutionModal
          conflict={conflict}
          onResolve={mockOnResolve}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.getByText('Your Local Version')).toBeInTheDocument()
    })

    it('should display server version with title', () => {
      const conflict = createConflict()
      render(
        <ConflictResolutionModal
          conflict={conflict}
          onResolve={mockOnResolve}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.getByText('Server Version')).toBeInTheDocument()
    })

    it('should display conflicting fields in header', () => {
      const conflict = createConflict({ conflictingFields: ['subject', 'body'] })
      render(
        <ConflictResolutionModal
          conflict={conflict}
          onResolve={mockOnResolve}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.getByText(/subject, body/i)).toBeInTheDocument()
    })

    it('should display both versions with different subjects', () => {
      const conflict = createConflict()
      render(
        <ConflictResolutionModal
          conflict={conflict}
          onResolve={mockOnResolve}
          onCancel={mockOnCancel}
        />
      )

      // Both subjects should be visible
      expect(screen.getByText('Local Subject')).toBeInTheDocument()
      expect(screen.getByText('Server Subject')).toBeInTheDocument()
    })

    it('should display both versions with different body text', () => {
      const conflict = createConflict()
      render(
        <ConflictResolutionModal
          conflict={conflict}
          onResolve={mockOnResolve}
          onCancel={mockOnCancel}
        />
      )

      // Both body texts should be visible
      expect(screen.getByText('Local body text')).toBeInTheDocument()
      expect(screen.getByText('Server body text')).toBeInTheDocument()
    })
  })

  describe('AC7: Resolution buttons', () => {
    it('should display Keep Local button', () => {
      const conflict = createConflict()
      render(
        <ConflictResolutionModal
          conflict={conflict}
          onResolve={mockOnResolve}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.getByText('Keep Local')).toBeInTheDocument()
    })

    it('should display Keep Server button', () => {
      const conflict = createConflict()
      render(
        <ConflictResolutionModal
          conflict={conflict}
          onResolve={mockOnResolve}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.getByText('Keep Server')).toBeInTheDocument()
    })

    it('should display Merge Manually button', () => {
      const conflict = createConflict()
      render(
        <ConflictResolutionModal
          conflict={conflict}
          onResolve={mockOnResolve}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.getByText('Merge Manually')).toBeInTheDocument()
    })

    it('should display Cancel button', () => {
      const conflict = createConflict()
      render(
        <ConflictResolutionModal
          conflict={conflict}
          onResolve={mockOnResolve}
          onCancel={mockOnCancel}
        />
      )

      expect(screen.getByText('Cancel')).toBeInTheDocument()
    })
  })

  describe('AC16: Resolution actions', () => {
    it('should call onResolve with "local" when Keep Local is clicked', () => {
      const conflict = createConflict()
      render(
        <ConflictResolutionModal
          conflict={conflict}
          onResolve={mockOnResolve}
          onCancel={mockOnCancel}
        />
      )

      fireEvent.click(screen.getByText('Keep Local'))

      expect(mockOnResolve).toHaveBeenCalledWith('local')
    })

    it('should call onResolve with "server" when Keep Server is clicked', () => {
      const conflict = createConflict()
      render(
        <ConflictResolutionModal
          conflict={conflict}
          onResolve={mockOnResolve}
          onCancel={mockOnCancel}
        />
      )

      fireEvent.click(screen.getByText('Keep Server'))

      expect(mockOnResolve).toHaveBeenCalledWith('server')
    })

    it('should call onCancel when Cancel is clicked', () => {
      const conflict = createConflict()
      render(
        <ConflictResolutionModal
          conflict={conflict}
          onResolve={mockOnResolve}
          onCancel={mockOnCancel}
        />
      )

      fireEvent.click(screen.getByText('Cancel'))

      expect(mockOnCancel).toHaveBeenCalled()
    })

    it('should call onCancel when clicking backdrop', () => {
      const conflict = createConflict()
      const { container } = render(
        <ConflictResolutionModal
          conflict={conflict}
          onResolve={mockOnResolve}
          onCancel={mockOnCancel}
        />
      )

      // Click the backdrop (first div with bg-black/50)
      const backdrop = container.querySelector('.bg-black\\/50')
      if (backdrop) {
        fireEvent.click(backdrop)
      }

      expect(mockOnCancel).toHaveBeenCalled()
    })
  })

  describe('Merge editor', () => {
    it('should show merge editor when Merge Manually is clicked', () => {
      const conflict = createConflict()
      render(
        <ConflictResolutionModal
          conflict={conflict}
          onResolve={mockOnResolve}
          onCancel={mockOnCancel}
        />
      )

      fireEvent.click(screen.getByText('Merge Manually'))

      // Should see input fields for editing
      expect(screen.getByLabelText(/Subject/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/Body/i)).toBeInTheDocument()
    })

    it('should show Apply Merged Version button in merge editor', () => {
      const conflict = createConflict()
      render(
        <ConflictResolutionModal
          conflict={conflict}
          onResolve={mockOnResolve}
          onCancel={mockOnCancel}
        />
      )

      fireEvent.click(screen.getByText('Merge Manually'))

      expect(screen.getByText('Apply Merged Version')).toBeInTheDocument()
    })

    it('should show Back to Comparison button in merge editor', () => {
      const conflict = createConflict()
      render(
        <ConflictResolutionModal
          conflict={conflict}
          onResolve={mockOnResolve}
          onCancel={mockOnCancel}
        />
      )

      fireEvent.click(screen.getByText('Merge Manually'))

      expect(screen.getByText('Back to Comparison')).toBeInTheDocument()
    })

    it('should return to comparison view when Back is clicked', () => {
      const conflict = createConflict()
      render(
        <ConflictResolutionModal
          conflict={conflict}
          onResolve={mockOnResolve}
          onCancel={mockOnCancel}
        />
      )

      // Go to merge editor
      fireEvent.click(screen.getByText('Merge Manually'))

      // Go back
      fireEvent.click(screen.getByText('Back to Comparison'))

      // Should see comparison view again
      expect(screen.getByText('Your Local Version')).toBeInTheDocument()
      expect(screen.getByText('Server Version')).toBeInTheDocument()
    })

    it('should call onResolve with "merged" and edited data when Apply is clicked', () => {
      const conflict = createConflict()
      render(
        <ConflictResolutionModal
          conflict={conflict}
          onResolve={mockOnResolve}
          onCancel={mockOnCancel}
        />
      )

      // Go to merge editor
      fireEvent.click(screen.getByText('Merge Manually'))

      // Edit subject
      const subjectInput = screen.getByLabelText(/Subject/i)
      fireEvent.change(subjectInput, { target: { value: 'Merged Subject' } })

      // Edit body
      const bodyInput = screen.getByLabelText(/Body/i)
      fireEvent.change(bodyInput, { target: { value: 'Merged body text' } })

      // Apply
      fireEvent.click(screen.getByText('Apply Merged Version'))

      expect(mockOnResolve).toHaveBeenCalledWith(
        'merged',
        expect.objectContaining({
          subject: 'Merged Subject',
          body: expect.objectContaining({
            text: 'Merged body text',
          }),
        })
      )
    })
  })

  describe('Metadata conflicts display', () => {
    it('should show read status when it differs', () => {
      const conflict = createConflict({
        localVersion: createEmailData({ read: true, localModifiedAt: 1700000002000 }),
        serverVersion: createEmailData({ read: false }),
        conflictingFields: ['read'],
        type: 'metadata',
      })
      render(
        <ConflictResolutionModal
          conflict={conflict}
          onResolve={mockOnResolve}
          onCancel={mockOnCancel}
        />
      )

      // Should show read status field (appears twice - once for local, once for server)
      expect(screen.getAllByText('Read Status')).toHaveLength(2)
    })

    it('should show starred status when it differs', () => {
      const conflict = createConflict({
        localVersion: createEmailData({ starred: true, localModifiedAt: 1700000002000 }),
        serverVersion: createEmailData({ starred: false }),
        conflictingFields: ['starred'],
        type: 'metadata',
      })
      render(
        <ConflictResolutionModal
          conflict={conflict}
          onResolve={mockOnResolve}
          onCancel={mockOnCancel}
        />
      )

      // Should show starred field (appears twice - once for local, once for server)
      expect(screen.getAllByText('Starred')).toHaveLength(2)
    })

    it('should show labels when they differ', () => {
      const conflict = createConflict({
        localVersion: createEmailData({ labels: ['LOCAL-LABEL'], localModifiedAt: 1700000002000 }),
        serverVersion: createEmailData({ labels: ['SERVER-LABEL'] }),
        conflictingFields: ['labels'],
        type: 'labels',
      })
      render(
        <ConflictResolutionModal
          conflict={conflict}
          onResolve={mockOnResolve}
          onCancel={mockOnCancel}
        />
      )

      // Should show labels field (appears twice - once for local, once for server)
      expect(screen.getAllByText('Labels')).toHaveLength(2)
    })
  })
})
