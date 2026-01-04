/**
 * AttachmentUpload Component Tests
 *
 * Story 2.8: Attachment Handling
 * Task 5.3: Component tests for AttachmentUpload
 *
 * Tests drag-and-drop, click-to-upload, and file management functionality.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  AttachmentUpload,
  fileToBase64,
  prepareAttachmentsForSend,
  type ComposeAttachment,
} from '../AttachmentUpload'

// Mock logger
vi.mock('@/services/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

describe('AttachmentUpload', () => {
  const mockOnChange = vi.fn()
  const defaultProps = {
    attachments: [] as ComposeAttachment[],
    onChange: mockOnChange,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render attach button and drag hint', () => {
    render(<AttachmentUpload {...defaultProps} />)

    expect(screen.getByRole('button', { name: /attach/i })).toBeInTheDocument()
    expect(screen.getByText(/drag files here/i)).toBeInTheDocument()
  })

  it('should open file picker when attach button is clicked', async () => {
    render(<AttachmentUpload {...defaultProps} />)

    const attachButton = screen.getByRole('button', { name: /attach/i })
    const fileInput = screen.getByLabelText(/attach files/i)
    const clickSpy = vi.spyOn(fileInput, 'click')

    await userEvent.click(attachButton)

    expect(clickSpy).toHaveBeenCalled()
  })

  it('should add files when selected via file picker', async () => {
    render(<AttachmentUpload {...defaultProps} />)

    const fileInput = screen.getByLabelText(/attach files/i)

    const testFile = new File(['test content'], 'test.txt', { type: 'text/plain' })

    fireEvent.change(fileInput, { target: { files: [testFile] } })

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalled()
    })

    const calledWith = mockOnChange.mock.calls[0][0]
    expect(calledWith).toHaveLength(1)
    expect(calledWith[0].filename).toBe('test.txt')
    expect(calledWith[0].mimeType).toBe('text/plain')
    expect(calledWith[0].size).toBe(12)
    expect(calledWith[0].file).toBe(testFile)
  })

  it('should handle drag-and-drop', async () => {
    render(<AttachmentUpload {...defaultProps} />)

    const dropZone = screen.getByRole('button', { name: /attach/i }).parentElement!

    const testFile = new File(['test content'], 'dropped.txt', { type: 'text/plain' })
    const dataTransfer = {
      files: [testFile],
      types: ['Files'],
    }

    // Simulate drag over
    fireEvent.dragOver(dropZone, { dataTransfer })

    // Check for drag indicator
    expect(screen.getByText(/drop files to attach/i)).toBeInTheDocument()

    // Simulate drop
    fireEvent.drop(dropZone, { dataTransfer })

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalled()
    })

    const calledWith = mockOnChange.mock.calls[0][0]
    expect(calledWith[0].filename).toBe('dropped.txt')
  })

  it('should display error for files exceeding size limit', async () => {
    render(<AttachmentUpload {...defaultProps} maxSize={100} />)

    const fileInput = screen.getByLabelText(/attach files/i)

    // Create a file larger than 100 bytes
    const largeFile = new File(['x'.repeat(200)], 'large.txt', { type: 'text/plain' })

    fireEvent.change(fileInput, { target: { files: [largeFile] } })

    await waitFor(() => {
      expect(screen.getByText(/exceeds.*limit/i)).toBeInTheDocument()
    })

    // onChange should not have been called with large file
    expect(mockOnChange).not.toHaveBeenCalled()
  })

  it('should display error for duplicate files', async () => {
    // Create existing file with same content and size that will be used for duplicate
    const existingContent = 'existing content'
    const existingAttachment: ComposeAttachment = {
      id: 'existing-1',
      filename: 'existing.txt',
      mimeType: 'text/plain',
      size: existingContent.length, // Match actual file size
      file: new File([existingContent], 'existing.txt', { type: 'text/plain' }),
    }

    render(<AttachmentUpload {...defaultProps} attachments={[existingAttachment]} />)

    const fileInput = screen.getByLabelText(/attach files/i)

    // Duplicate has same filename and size
    const duplicateFile = new File([existingContent], 'existing.txt', { type: 'text/plain' })

    fireEvent.change(fileInput, { target: { files: [duplicateFile] } })

    await waitFor(() => {
      expect(screen.getByText(/already attached/i)).toBeInTheDocument()
    })
  })

  it('should display attached files', () => {
    const attachments: ComposeAttachment[] = [
      {
        id: '1',
        filename: 'document.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        file: new File([''], 'document.pdf'),
      },
      {
        id: '2',
        filename: 'image.png',
        mimeType: 'image/png',
        size: 2048,
        file: new File([''], 'image.png'),
      },
    ]

    render(<AttachmentUpload {...defaultProps} attachments={attachments} />)

    expect(screen.getByText('document.pdf')).toBeInTheDocument()
    expect(screen.getByText('image.png')).toBeInTheDocument()
    expect(screen.getByText('(1 KB)')).toBeInTheDocument()
    expect(screen.getByText('(2 KB)')).toBeInTheDocument()
  })

  it('should display total size when multiple attachments', () => {
    const attachments: ComposeAttachment[] = [
      {
        id: '1',
        filename: 'doc1.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        file: new File([''], 'doc1.pdf'),
      },
      {
        id: '2',
        filename: 'doc2.pdf',
        mimeType: 'application/pdf',
        size: 2048,
        file: new File([''], 'doc2.pdf'),
      },
    ]

    render(<AttachmentUpload {...defaultProps} attachments={attachments} />)

    expect(screen.getByText(/total.*3.*KB.*2 files/i)).toBeInTheDocument()
  })

  it('should remove attachment when remove button clicked', async () => {
    const attachments: ComposeAttachment[] = [
      {
        id: '1',
        filename: 'remove-me.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        file: new File([''], 'remove-me.pdf'),
      },
    ]

    render(<AttachmentUpload {...defaultProps} attachments={attachments} />)

    const removeButton = screen.getByRole('button', { name: /remove remove-me.pdf/i })
    await userEvent.click(removeButton)

    expect(mockOnChange).toHaveBeenCalledWith([])
  })

  it('should handle multiple files in one drop', async () => {
    render(<AttachmentUpload {...defaultProps} />)

    const dropZone = screen.getByRole('button', { name: /attach/i }).parentElement!

    const files = [
      new File(['content1'], 'file1.txt', { type: 'text/plain' }),
      new File(['content2'], 'file2.txt', { type: 'text/plain' }),
      new File(['content3'], 'file3.txt', { type: 'text/plain' }),
    ]

    fireEvent.drop(dropZone, { dataTransfer: { files } })

    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalled()
    })

    const calledWith = mockOnChange.mock.calls[0][0]
    expect(calledWith).toHaveLength(3)
  })

  it('should hide drag hint when attachments exist', () => {
    const attachments: ComposeAttachment[] = [
      {
        id: '1',
        filename: 'doc.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        file: new File([''], 'doc.pdf'),
      },
    ]

    render(<AttachmentUpload {...defaultProps} attachments={attachments} />)

    expect(screen.queryByText(/drag files here/i)).not.toBeInTheDocument()
  })
})

describe('fileToBase64', () => {
  it('should convert file to base64 string', async () => {
    const content = 'Hello, World!'
    const file = new File([content], 'test.txt', { type: 'text/plain' })

    const base64 = await fileToBase64(file)

    // Verify it's valid base64 by decoding
    const decoded = atob(base64)
    expect(decoded).toBe(content)
  })

  it('should handle binary files', async () => {
    const binaryData = new Uint8Array([0x00, 0xff, 0x10, 0x20])
    const file = new File([binaryData], 'binary.bin', { type: 'application/octet-stream' })

    const base64 = await fileToBase64(file)

    // Should be valid base64
    expect(() => atob(base64)).not.toThrow()
  })
})

describe('prepareAttachmentsForSend', () => {
  it('should convert ComposeAttachment array to SendQueueAttachment format', async () => {
    const composeAttachments: ComposeAttachment[] = [
      {
        id: '1',
        filename: 'test.txt',
        mimeType: 'text/plain',
        size: 13,
        file: new File(['Hello, World!'], 'test.txt', { type: 'text/plain' }),
      },
    ]

    const sendAttachments = await prepareAttachmentsForSend(composeAttachments)

    expect(sendAttachments).toHaveLength(1)
    expect(sendAttachments[0].id).toBe('1')
    expect(sendAttachments[0].filename).toBe('test.txt')
    expect(sendAttachments[0].mimeType).toBe('text/plain')
    expect(sendAttachments[0].size).toBe(13)
    expect(sendAttachments[0].content).toBe(btoa('Hello, World!'))
  })

  it('should handle multiple attachments', async () => {
    const composeAttachments: ComposeAttachment[] = [
      {
        id: '1',
        filename: 'file1.txt',
        mimeType: 'text/plain',
        size: 5,
        file: new File(['file1'], 'file1.txt', { type: 'text/plain' }),
      },
      {
        id: '2',
        filename: 'file2.txt',
        mimeType: 'text/plain',
        size: 5,
        file: new File(['file2'], 'file2.txt', { type: 'text/plain' }),
      },
    ]

    const sendAttachments = await prepareAttachmentsForSend(composeAttachments)

    expect(sendAttachments).toHaveLength(2)
    expect(sendAttachments[0].content).toBe(btoa('file1'))
    expect(sendAttachments[1].content).toBe(btoa('file2'))
  })

  it('should return empty array for empty input', async () => {
    const sendAttachments = await prepareAttachmentsForSend([])
    expect(sendAttachments).toEqual([])
  })
})
