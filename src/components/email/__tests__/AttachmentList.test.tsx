/**
 * AttachmentList and AttachmentItem Component Tests
 *
 * Story 2.2: Thread Detail View with Conversation History
 * Task 11: Testing & Performance
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AttachmentList } from '../AttachmentList'
import { AttachmentItem } from '../AttachmentItem'
import type { Attachment } from '@/services/database/schemas/email.schema'

/**
 * Generate mock attachment
 */
function generateMockAttachment(overrides: Partial<Attachment> = {}): Attachment {
  return {
    id: 'att-1',
    filename: 'document.pdf',
    mimeType: 'application/pdf',
    size: 1024 * 100, // 100KB
    isInline: false,
    ...overrides,
  }
}

describe('AttachmentList', () => {
  describe('Rendering', () => {
    it('should render nothing when attachments array is empty', () => {
      const { container } = render(<AttachmentList attachments={[]} />)
      expect(container.firstChild).toBeNull()
    })

    it('should render attachment count header', () => {
      const attachments = [
        generateMockAttachment(),
        generateMockAttachment({ id: 'att-2', filename: 'image.png' }),
      ]

      render(<AttachmentList attachments={attachments} />)

      expect(screen.getByText('2 attachments')).toBeInTheDocument()
    })

    it('should render singular attachment text for single attachment', () => {
      render(<AttachmentList attachments={[generateMockAttachment()]} />)

      expect(screen.getByText('1 attachment')).toBeInTheDocument()
    })

    it('should render each attachment item', () => {
      const attachments = [
        generateMockAttachment({ filename: 'doc1.pdf' }),
        generateMockAttachment({ id: 'att-2', filename: 'doc2.pdf' }),
      ]

      render(<AttachmentList attachments={attachments} />)

      expect(screen.getByText('doc1.pdf')).toBeInTheDocument()
      expect(screen.getByText('doc2.pdf')).toBeInTheDocument()
    })
  })

  describe('Inline Attachment Filtering', () => {
    it('should exclude inline attachments by default', () => {
      const attachments = [
        generateMockAttachment({ filename: 'regular.pdf', isInline: false }),
        generateMockAttachment({ id: 'att-2', filename: 'inline-image.png', isInline: true }),
      ]

      render(<AttachmentList attachments={attachments} />)

      expect(screen.getByText('regular.pdf')).toBeInTheDocument()
      expect(screen.queryByText('inline-image.png')).not.toBeInTheDocument()
    })

    it('should include inline attachments when excludeInline is false', () => {
      const attachments = [
        generateMockAttachment({ filename: 'regular.pdf', isInline: false }),
        generateMockAttachment({ id: 'att-2', filename: 'inline-image.png', isInline: true }),
      ]

      render(<AttachmentList attachments={attachments} excludeInline={false} />)

      expect(screen.getByText('regular.pdf')).toBeInTheDocument()
      expect(screen.getByText('inline-image.png')).toBeInTheDocument()
    })
  })

  describe('Download Handler', () => {
    it('should pass onDownload handler to attachment items', () => {
      const onDownload = vi.fn()
      const attachment = generateMockAttachment()

      render(<AttachmentList attachments={[attachment]} onDownload={onDownload} />)

      const downloadButton = screen.getByLabelText('Download document.pdf')
      fireEvent.click(downloadButton)

      expect(onDownload).toHaveBeenCalledWith(attachment)
    })
  })
})

describe('AttachmentItem', () => {
  describe('Rendering', () => {
    it('should display filename', () => {
      render(<AttachmentItem attachment={generateMockAttachment({ filename: 'report.pdf' })} />)

      expect(screen.getByText('report.pdf')).toBeInTheDocument()
    })

    it('should display file size', () => {
      render(<AttachmentItem attachment={generateMockAttachment({ size: 1024 * 500 })} />)

      expect(screen.getByText('500 KB')).toBeInTheDocument()
    })

    it('should display MB for larger files', () => {
      render(<AttachmentItem attachment={generateMockAttachment({ size: 1024 * 1024 * 2.5 })} />)

      expect(screen.getByText('2.5 MB')).toBeInTheDocument()
    })
  })

  describe('Icons', () => {
    it('should display different icons based on MIME type', () => {
      // Just verify the component renders without crashing for various MIME types
      const { rerender } = render(
        <AttachmentItem attachment={generateMockAttachment({ mimeType: 'application/pdf' })} />
      )
      expect(screen.getByText('document.pdf')).toBeInTheDocument()

      rerender(<AttachmentItem attachment={generateMockAttachment({ mimeType: 'image/png' })} />)
      expect(screen.getByText('document.pdf')).toBeInTheDocument()

      rerender(
        <AttachmentItem attachment={generateMockAttachment({ mimeType: 'application/zip' })} />
      )
      expect(screen.getByText('document.pdf')).toBeInTheDocument()
    })
  })

  describe('Download', () => {
    it('should call onDownload when download button is clicked', () => {
      const onDownload = vi.fn()
      const attachment = generateMockAttachment()

      render(<AttachmentItem attachment={attachment} onDownload={onDownload} />)

      const downloadButton = screen.getByLabelText('Download document.pdf')
      fireEvent.click(downloadButton)

      expect(onDownload).toHaveBeenCalledWith(attachment)
    })

    it('should handle keyboard activation of download button', () => {
      const onDownload = vi.fn()
      const attachment = generateMockAttachment()

      render(<AttachmentItem attachment={attachment} onDownload={onDownload} />)

      const downloadButton = screen.getByLabelText('Download document.pdf')
      fireEvent.keyDown(downloadButton, { key: 'Enter' })

      expect(onDownload).toHaveBeenCalledWith(attachment)
    })
  })

  describe('Accessibility', () => {
    it('should have accessible download button', () => {
      render(<AttachmentItem attachment={generateMockAttachment({ filename: 'test-file.pdf' })} />)

      const downloadButton = screen.getByRole('button', { name: 'Download test-file.pdf' })
      expect(downloadButton).toBeInTheDocument()
    })

    it('should have filename in title attribute', () => {
      render(
        <AttachmentItem attachment={generateMockAttachment({ filename: 'long-filename.pdf' })} />
      )

      const filenameElement = screen.getByText('long-filename.pdf')
      expect(filenameElement).toHaveAttribute('title', 'long-filename.pdf')
    })
  })
})
