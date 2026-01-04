/**
 * RecipientInput Component
 *
 * Story 2.3: Compose & Reply Interface
 * Task 3: Create Recipient Input Components
 *
 * Features:
 * - Email validation (AC4)
 * - Chips with remove functionality
 * - Autocomplete dropdown from contacts
 * - Support for multiple recipients
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/utils/cn'
import { logger } from '@/services/logger'
import type { EmailAddress } from '@/services/database/schemas/email.schema'

interface RecipientInputProps {
  /** Field label */
  label: string
  /** Current recipients */
  value: EmailAddress[]
  /** Called when recipients change */
  onChange: (recipients: EmailAddress[]) => void
  /** Placeholder text */
  placeholder?: string
  /** Auto focus the input */
  autoFocus?: boolean
  /** Available contacts for autocomplete */
  contacts?: EmailAddress[]
}

// Email validation regex (RFC 5322 simplified)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Parse input string to EmailAddress
 */
function parseEmailInput(input: string): EmailAddress | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  // Try to parse "Name <email>" format
  const namedMatch = trimmed.match(/^(.+?)\s*<(.+?)>$/)
  if (namedMatch) {
    const name = namedMatch[1].trim()
    const email = namedMatch[2].trim().toLowerCase()
    if (EMAIL_REGEX.test(email)) {
      return { name, email }
    }
    return null
  }

  // Plain email format
  const email = trimmed.toLowerCase()
  if (EMAIL_REGEX.test(email)) {
    return { name: '', email }
  }

  return null
}

/**
 * RecipientChip component - displays a single recipient
 */
function RecipientChip({ recipient, onRemove }: { recipient: EmailAddress; onRemove: () => void }) {
  const displayText = recipient.name || recipient.email

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full',
        'bg-cyan-100 text-cyan-800 text-sm'
      )}
    >
      <span className="truncate max-w-[200px]" title={recipient.email}>
        {displayText}
      </span>
      <button
        type="button"
        onClick={onRemove}
        className="p-0.5 hover:bg-cyan-200 rounded-full"
        aria-label={`Remove ${displayText}`}
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  )
}

/**
 * RecipientInput component
 * Input field for email recipients with validation and chips
 */
export function RecipientInput({
  label,
  value,
  onChange,
  placeholder = 'Add recipients',
  autoFocus = false,
  contacts = [],
}: RecipientInputProps) {
  const [inputValue, setInputValue] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [validationError, setValidationError] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Handle autoFocus manually via effect to satisfy a11y requirements
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus()
    }
  }, [autoFocus])

  // Filter contacts based on input
  const filteredContacts = useMemo(() => {
    if (!inputValue.trim()) return contacts.slice(0, 5)

    const search = inputValue.toLowerCase()
    return contacts
      .filter(
        (contact) =>
          !value.some((v) => v.email === contact.email) &&
          (contact.email.toLowerCase().includes(search) ||
            contact.name.toLowerCase().includes(search))
      )
      .slice(0, 5)
  }, [inputValue, contacts, value])

  // Add recipient
  const addRecipient = useCallback(
    (recipient: EmailAddress) => {
      // Check for duplicates
      if (value.some((v) => v.email === recipient.email)) {
        setValidationError('Recipient already added')
        return
      }

      logger.debug('compose', 'Adding recipient', { email: recipient.email })
      onChange([...value, recipient])
      setInputValue('')
      setValidationError(null)
      setIsOpen(false)
      setHighlightedIndex(-1)
      inputRef.current?.focus()
    },
    [value, onChange]
  )

  // Remove recipient
  const removeRecipient = useCallback(
    (index: number) => {
      const removed = value[index]
      logger.debug('compose', 'Removing recipient', { email: removed.email })
      onChange(value.filter((_, i) => i !== index))
    },
    [value, onChange]
  )

  // Handle input change
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value
      setInputValue(newValue)
      setValidationError(null)
      setIsOpen(newValue.length > 0 || contacts.length > 0)
      setHighlightedIndex(-1)
    },
    [contacts.length]
  )

  // Handle input blur - validate and add if valid email
  const handleBlur = useCallback(() => {
    if (!inputValue.trim()) {
      setIsOpen(false)
      return
    }

    const parsed = parseEmailInput(inputValue)
    if (parsed) {
      addRecipient(parsed)
    } else if (inputValue.includes('@')) {
      setValidationError('Invalid email address')
    }

    // Delay closing to allow click on dropdown
    setTimeout(() => setIsOpen(false), 200)
  }, [inputValue, addRecipient])

  // Handle key down
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' || e.key === 'Tab' || e.key === ',') {
        e.preventDefault()

        // If dropdown is open and item is highlighted, select it
        if (isOpen && highlightedIndex >= 0 && highlightedIndex < filteredContacts.length) {
          addRecipient(filteredContacts[highlightedIndex])
          return
        }

        // Otherwise try to add from input
        const parsed = parseEmailInput(inputValue)
        if (parsed) {
          addRecipient(parsed)
        } else if (inputValue.trim()) {
          setValidationError('Invalid email address')
        }
        return
      }

      if (e.key === 'Backspace' && !inputValue && value.length > 0) {
        // Remove last recipient
        removeRecipient(value.length - 1)
        return
      }

      if (e.key === 'ArrowDown' && isOpen) {
        e.preventDefault()
        setHighlightedIndex((prev) => (prev < filteredContacts.length - 1 ? prev + 1 : prev))
        return
      }

      if (e.key === 'ArrowUp' && isOpen) {
        e.preventDefault()
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1))
        return
      }

      if (e.key === 'Escape') {
        setIsOpen(false)
        setHighlightedIndex(-1)
      }
    },
    [isOpen, highlightedIndex, filteredContacts, inputValue, value, addRecipient, removeRecipient]
  )

  // Handle click on contact
  const handleContactClick = useCallback(
    (contact: EmailAddress) => {
      addRecipient(contact)
    },
    [addRecipient]
  )

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={containerRef} className="relative">
      <div
        className={cn(
          'flex items-center gap-1 flex-wrap py-1',
          'border-b border-transparent',
          'focus-within:border-cyan-500 transition-colors'
        )}
      >
        <label className="text-sm text-slate-500 w-8 flex-shrink-0">{label}</label>

        {/* Recipient chips */}
        {value.map((recipient, index) => (
          <RecipientChip
            key={`${recipient.email}-${index}`}
            recipient={recipient}
            onRemove={() => removeRecipient(index)}
          />
        ))}

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          onFocus={() => setIsOpen(contacts.length > 0 || inputValue.length > 0)}
          placeholder={value.length === 0 ? placeholder : ''}
          className={cn(
            'flex-1 min-w-[120px] text-sm outline-none bg-transparent',
            'placeholder:text-slate-400'
          )}
        />
      </div>

      {/* Validation error */}
      {validationError && <p className="text-xs text-red-500 mt-1">{validationError}</p>}

      {/* Autocomplete dropdown */}
      {isOpen && filteredContacts.length > 0 && (
        <div
          className={cn(
            'absolute left-0 right-0 mt-1 z-10',
            'bg-white border border-slate-200 rounded-lg shadow-lg',
            'max-h-48 overflow-auto'
          )}
        >
          {filteredContacts.map((contact, index) => (
            <button
              key={contact.email}
              type="button"
              onClick={() => handleContactClick(contact)}
              onMouseEnter={() => setHighlightedIndex(index)}
              className={cn(
                'w-full px-3 py-2 text-left text-sm',
                'hover:bg-slate-100',
                index === highlightedIndex && 'bg-cyan-50'
              )}
            >
              <div className="font-medium text-slate-900">{contact.name || contact.email}</div>
              {contact.name && <div className="text-slate-500 text-xs">{contact.email}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
