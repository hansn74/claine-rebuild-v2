/**
 * ActionAnnouncer Component
 *
 * Story 2.11: Keyboard Shortcuts & Power User Features
 * Task 9.2: Announce shortcut actions to screen readers using aria-live regions
 *
 * Provides an accessible announcement system for keyboard shortcut actions.
 * Uses aria-live regions to announce actions to screen reader users.
 */

import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react'

type AnnouncementPriority = 'polite' | 'assertive'

interface AnnouncerContextValue {
  announce: (message: string, priority?: AnnouncementPriority) => void
}

const AnnouncerContext = createContext<AnnouncerContextValue | null>(null)

/**
 * Hook to access the announcer context
 */
export function useAnnouncer(): AnnouncerContextValue {
  const context = useContext(AnnouncerContext)
  if (!context) {
    // Return a no-op if used outside provider
    return {
      announce: () => {},
    }
  }
  return context
}

interface ActionAnnouncerProps {
  children: ReactNode
}

/**
 * ActionAnnouncer - Provider for screen reader announcements
 *
 * This component manages aria-live regions for announcing actions to screen readers.
 * Use the useAnnouncer hook to announce keyboard shortcut actions.
 *
 * @example
 * ```tsx
 * const { announce } = useAnnouncer()
 *
 * const handleArchive = () => {
 *   archiveEmail(emailId)
 *   announce('Email archived')
 * }
 * ```
 */
export default function ActionAnnouncer({ children }: ActionAnnouncerProps) {
  const [politeMessage, setPoliteMessage] = useState('')
  const [assertiveMessage, setAssertiveMessage] = useState('')

  // Use a ref to track message IDs for clearing
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const announce = useCallback((message: string, priority: AnnouncementPriority = 'polite') => {
    // Clear any pending timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Set the message based on priority
    if (priority === 'assertive') {
      setAssertiveMessage(message)
    } else {
      setPoliteMessage(message)
    }

    // Clear the message after a delay to allow for repeated announcements
    timeoutRef.current = setTimeout(() => {
      if (priority === 'assertive') {
        setAssertiveMessage('')
      } else {
        setPoliteMessage('')
      }
    }, 1000)
  }, [])

  const contextValue: AnnouncerContextValue = {
    announce,
  }

  return (
    <AnnouncerContext.Provider value={contextValue}>
      {children}
      {/* Polite announcements - used for most actions */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {politeMessage}
      </div>
      {/* Assertive announcements - used for urgent notifications */}
      <div role="alert" aria-live="assertive" aria-atomic="true" className="sr-only">
        {assertiveMessage}
      </div>
    </AnnouncerContext.Provider>
  )
}

export { AnnouncerContext }
