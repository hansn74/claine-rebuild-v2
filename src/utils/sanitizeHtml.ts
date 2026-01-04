/**
 * HTML Sanitization Utility
 *
 * Story 2.2: Thread Detail View with Conversation History
 * Task 9: HTML Sanitization
 *
 * Sanitize email HTML content for safe rendering using DOMPurify.
 * Follows OWASP XSS prevention guidelines.
 */

import DOMPurify from 'dompurify'

/**
 * Sanitize email HTML content for safe rendering
 * Strips potentially dangerous content (scripts, iframes, etc.)
 * while preserving standard email formatting elements.
 *
 * @param html - Raw HTML content from email
 * @returns Sanitized HTML safe for dangerouslySetInnerHTML
 */
export function sanitizeEmailHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    // Allowed HTML tags for email content
    ALLOWED_TAGS: [
      // Text formatting
      'p',
      'br',
      'strong',
      'b',
      'em',
      'i',
      'u',
      's',
      'strike',
      // Links and media
      'a',
      'img',
      // Lists
      'ul',
      'ol',
      'li',
      // Tables
      'table',
      'thead',
      'tbody',
      'tfoot',
      'tr',
      'th',
      'td',
      'caption',
      'colgroup',
      'col',
      // Structure
      'div',
      'span',
      'header',
      'footer',
      'section',
      'article',
      // Headings
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      // Quotes and code
      'blockquote',
      'pre',
      'code',
      // Other
      'hr',
      'address',
      'small',
      'sub',
      'sup',
      'mark',
      // Font tag (common in old HTML emails)
      'font',
      'center',
    ],
    // Allowed attributes
    ALLOWED_ATTR: [
      // Links
      'href',
      'target',
      'rel',
      // Images
      'src',
      'alt',
      'title',
      'width',
      'height',
      // Style and class
      'class',
      'style',
      // Table attributes
      'border',
      'cellpadding',
      'cellspacing',
      'colspan',
      'rowspan',
      'align',
      'valign',
      'bgcolor',
      // Font attributes (for old HTML emails)
      'color',
      'size',
      'face',
      // Misc
      'id',
      'name',
    ],
    // Security settings
    ALLOW_DATA_ATTR: false, // No data-* attributes
    FORBID_TAGS: [
      'script',
      'iframe',
      'object',
      'embed',
      'form',
      'input',
      'button',
      'select',
      'textarea',
      'style',
      'link',
      'meta',
      'base',
      'noscript',
    ],
    FORBID_ATTR: [
      'onerror',
      'onclick',
      'onload',
      'onmouseover',
      'onmouseout',
      'onfocus',
      'onblur',
      'onchange',
      'onsubmit',
      'onkeydown',
      'onkeyup',
      'onkeypress',
    ],
    // Add target="_blank" and rel="noopener noreferrer" to all links
    ADD_ATTR: ['target', 'rel'],
  })
}

/**
 * Configure DOMPurify to add security attributes to links
 * Called once during app initialization
 */
export function configureDOMPurify(): void {
  // Add hook to add target="_blank" and rel="noopener noreferrer" to links
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      node.setAttribute('target', '_blank')
      node.setAttribute('rel', 'noopener noreferrer')
    }
    // Block data: URIs in img src (potential XSS vector)
    if (node.tagName === 'IMG') {
      const src = node.getAttribute('src')
      if (src && src.startsWith('data:') && !src.startsWith('data:image/')) {
        node.removeAttribute('src')
      }
    }
  })
}

// Auto-configure on import
configureDOMPurify()

/**
 * Alias for sanitizeEmailHtml for backward compatibility
 */
export const sanitizeHtml = sanitizeEmailHtml
