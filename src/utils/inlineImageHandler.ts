/**
 * Inline Image Handler Utility
 *
 * Story 2.2: Thread Detail View with Conversation History
 * Task 7: Implement Inline Image Lazy Loading
 *
 * Handles mapping of Content-ID references to attachment URLs
 * and provides utilities for inline image processing.
 */

import type { Attachment } from '@/services/database/schemas/email.schema'

/**
 * Content-ID to URL mapping
 */
export interface ContentIdMap {
  [contentId: string]: string
}

/**
 * Build a map of Content-ID to attachment data URLs
 *
 * @param attachments - Array of email attachments
 * @param getAttachmentUrl - Function to get URL for attachment
 * @returns Map of contentId to URL
 */
export function buildContentIdMap(
  attachments: Attachment[],
  getAttachmentUrl?: (attachment: Attachment) => string
): ContentIdMap {
  const map: ContentIdMap = {}

  for (const attachment of attachments) {
    if (attachment.isInline && attachment.contentId) {
      // Remove < and > from contentId if present
      const cleanId = attachment.contentId.replace(/^<|>$/g, '')
      map[cleanId] = getAttachmentUrl
        ? getAttachmentUrl(attachment)
        : `/api/attachments/${attachment.id}` // Default placeholder URL
    }
  }

  return map
}

/**
 * Replace cid: references in HTML with actual URLs
 *
 * Email clients use cid: protocol for inline images.
 * This replaces them with actual URLs.
 *
 * @param html - HTML content with cid: references
 * @param contentIdMap - Map of contentId to URL
 * @returns HTML with cid: replaced by URLs
 */
export function replaceCidReferences(html: string, contentIdMap: ContentIdMap): string {
  // Match cid:xxx patterns in src attributes
  return html.replace(/src=["']cid:([^"']+)["']/gi, (_match, contentId) => {
    const cleanId = contentId.replace(/^<|>$/g, '')
    const url = contentIdMap[cleanId]
    if (url) {
      return `src="${url}"`
    }
    // If no mapping found, leave as placeholder
    return `src="" data-missing-cid="${cleanId}"`
  })
}

/**
 * Check if an attachment is an image
 *
 * @param mimeType - MIME type of the attachment
 * @returns Whether the attachment is an image
 */
export function isImageMimeType(mimeType: string): boolean {
  return mimeType.startsWith('image/')
}

/**
 * Get file extension from MIME type
 *
 * @param mimeType - MIME type string
 * @returns File extension without dot
 */
export function getExtensionFromMimeType(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'image/bmp': 'bmp',
    'image/tiff': 'tiff',
  }

  return mimeToExt[mimeType.toLowerCase()] || 'img'
}
