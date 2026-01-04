/**
 * SkipLinks Component
 *
 * Story 2.11: Keyboard Shortcuts & Power User Features
 * Task 9.4: Add skip links component for keyboard-only users
 *
 * Provides skip navigation links for keyboard-only users to bypass repetitive content.
 * Links are visually hidden but become visible when focused.
 */

import { useCallback } from 'react'

interface SkipLink {
  id: string
  label: string
  targetId: string
}

/**
 * Default skip links for email client navigation
 */
const DEFAULT_SKIP_LINKS: SkipLink[] = [
  { id: 'skip-main', label: 'Skip to main content', targetId: 'main-content' },
  { id: 'skip-search', label: 'Skip to search', targetId: 'search-input' },
  { id: 'skip-email-list', label: 'Skip to email list', targetId: 'email-list' },
]

interface SkipLinksProps {
  links?: SkipLink[]
}

/**
 * SkipLinks - Hidden navigation links for keyboard users
 *
 * These links are visually hidden until focused, allowing keyboard users
 * to quickly navigate to important page sections.
 */
export default function SkipLinks({ links = DEFAULT_SKIP_LINKS }: SkipLinksProps) {
  const handleClick = useCallback((targetId: string) => {
    const element = document.getElementById(targetId)
    if (element) {
      // Set tabindex to make element focusable if needed
      if (!element.hasAttribute('tabindex')) {
        element.setAttribute('tabindex', '-1')
      }
      element.focus()
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  return (
    <nav
      aria-label="Skip links"
      className="sr-only focus-within:not-sr-only focus-within:fixed focus-within:top-0 focus-within:left-0 focus-within:z-[9999] focus-within:p-2 focus-within:bg-white focus-within:shadow-lg"
    >
      <ul className="flex gap-2">
        {links.map((link) => (
          <li key={link.id}>
            <a
              href={`#${link.targetId}`}
              onClick={(e) => {
                e.preventDefault()
                handleClick(link.targetId)
              }}
              className="sr-only focus:not-sr-only focus:px-4 focus:py-2 focus:bg-cyan-600 focus:text-white focus:rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2"
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export { DEFAULT_SKIP_LINKS }
export type { SkipLink }
