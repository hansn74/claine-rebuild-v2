/**
 * EmptyState Component Tests
 *
 * Story 2.12: Empty States & Onboarding UX
 * Task 1.6: Write unit tests for EmptyState component variants
 *
 * Tests for base EmptyState component and all variants
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Inbox, Search } from 'lucide-react'
import { EmptyState } from '../EmptyState'
import { EmptyInbox } from '../EmptyInbox'
import { EmptySearch } from '../EmptySearch'
import { EmptyFolder } from '../EmptyFolder'
import { Button } from '@shared/components/ui/button'

describe('EmptyState', () => {
  describe('base component', () => {
    it('should render title', () => {
      render(<EmptyState title="No items found" />)

      expect(screen.getByText('No items found')).toBeInTheDocument()
    })

    it('should render description when provided', () => {
      render(<EmptyState title="No items" description="Try a different search" />)

      expect(screen.getByText('Try a different search')).toBeInTheDocument()
    })

    it('should not render description when not provided', () => {
      render(<EmptyState title="No items" />)

      expect(screen.queryByText('Try a different search')).not.toBeInTheDocument()
    })

    it('should render icon when provided as ReactNode', () => {
      render(<EmptyState title="No items" icon={<Inbox data-testid="inbox-icon" />} />)

      expect(screen.getByTestId('inbox-icon')).toBeInTheDocument()
    })

    it('should render icon when provided as LucideIcon', () => {
      render(<EmptyState title="No items" icon={Search} />)

      // Icon should be rendered with aria-hidden
      const icon = document.querySelector('svg[aria-hidden="true"]')
      expect(icon).toBeInTheDocument()
    })

    it('should render action slot when provided', () => {
      render(<EmptyState title="No items" action={<Button>Add Item</Button>} />)

      expect(screen.getByRole('button', { name: 'Add Item' })).toBeInTheDocument()
    })

    it('should apply custom className', () => {
      render(<EmptyState title="Test" className="custom-class" testId="empty" />)

      expect(screen.getByTestId('empty')).toHaveClass('custom-class')
    })

    it('should have role="status" by default', () => {
      render(<EmptyState title="Test" testId="empty" />)

      expect(screen.getByTestId('empty')).toHaveAttribute('role', 'status')
    })

    it('should support custom role', () => {
      render(<EmptyState title="Test" role="alert" testId="empty" />)

      expect(screen.getByTestId('empty')).toHaveAttribute('role', 'alert')
    })

    it('should have aria-live="polite" for status role', () => {
      render(<EmptyState title="Test" testId="empty" />)

      expect(screen.getByTestId('empty')).toHaveAttribute('aria-live', 'polite')
    })

    it('should use compact styling when compact=true', () => {
      render(<EmptyState title="Test" compact testId="empty" />)

      expect(screen.getByTestId('empty')).toHaveClass('py-8')
    })

    it('should use standard styling when compact=false', () => {
      render(<EmptyState title="Test" testId="empty" />)

      expect(screen.getByTestId('empty')).toHaveClass('py-16')
    })
  })
})

describe('EmptyInbox', () => {
  it('should render default variant', () => {
    render(<EmptyInbox />)

    expect(screen.getByText("You're all caught up!")).toBeInTheDocument()
    expect(screen.getByText('No unread emails. Enjoy your day.')).toBeInTheDocument()
  })

  it('should render archived variant', () => {
    render(<EmptyInbox variant="archived" />)

    expect(screen.getByText('Inbox Zero achieved!')).toBeInTheDocument()
    expect(screen.getByText('All emails have been processed.')).toBeInTheDocument()
  })

  it('should render filtered variant', () => {
    render(<EmptyInbox variant="filtered" />)

    expect(screen.getByText('No matching emails')).toBeInTheDocument()
    expect(screen.getByText('Try adjusting your filters.')).toBeInTheDocument()
  })

  it('should support custom title override', () => {
    render(<EmptyInbox title="Custom Title" />)

    expect(screen.getByText('Custom Title')).toBeInTheDocument()
  })

  it('should support custom description override', () => {
    render(<EmptyInbox description="Custom description" />)

    expect(screen.getByText('Custom description')).toBeInTheDocument()
  })

  it('should have correct test id', () => {
    render(<EmptyInbox />)

    expect(screen.getByTestId('empty-inbox')).toBeInTheDocument()
  })

  it('should render checkmark icon', () => {
    render(<EmptyInbox />)

    // Check for SVG icon
    const svg = document.querySelector('svg')
    expect(svg).toBeInTheDocument()
  })
})

describe('EmptySearch', () => {
  it('should render without query', () => {
    render(<EmptySearch />)

    expect(screen.getByText('No results found')).toBeInTheDocument()
  })

  it('should render with query', () => {
    render(<EmptySearch query="meeting notes" />)

    expect(screen.getByText('No results for "meeting notes"')).toBeInTheDocument()
  })

  it('should render search tips by default', () => {
    render(<EmptySearch />)

    expect(screen.getByText('Search tips:')).toBeInTheDocument()
    expect(screen.getByText('Use keywords from the email subject or body')).toBeInTheDocument()
  })

  it('should hide tips when showTips=false', () => {
    render(<EmptySearch showTips={false} />)

    expect(screen.queryByText('Search tips:')).not.toBeInTheDocument()
  })

  it('should support custom title', () => {
    render(<EmptySearch title="Custom search title" />)

    expect(screen.getByText('Custom search title')).toBeInTheDocument()
  })

  it('should support custom description', () => {
    render(<EmptySearch description="Custom search description" showTips={false} />)

    expect(screen.getByText('Custom search description')).toBeInTheDocument()
  })

  it('should have correct test id', () => {
    render(<EmptySearch />)

    expect(screen.getByTestId('empty-search')).toBeInTheDocument()
  })
})

describe('EmptyFolder', () => {
  it('should render sent folder', () => {
    render(<EmptyFolder folder="sent" />)

    expect(screen.getByText('No sent emails')).toBeInTheDocument()
    expect(screen.getByText('Emails you send will appear here.')).toBeInTheDocument()
    expect(screen.getByTestId('empty-folder-sent')).toBeInTheDocument()
  })

  it('should render drafts folder', () => {
    render(<EmptyFolder folder="drafts" />)

    expect(screen.getByText('No drafts')).toBeInTheDocument()
    expect(screen.getByText('Start composing to save a draft.')).toBeInTheDocument()
    expect(screen.getByTestId('empty-folder-drafts')).toBeInTheDocument()
  })

  it('should render archive folder', () => {
    render(<EmptyFolder folder="archive" />)

    expect(screen.getByText('Archive is empty')).toBeInTheDocument()
    expect(screen.getByText('Archived emails will appear here.')).toBeInTheDocument()
    expect(screen.getByTestId('empty-folder-archive')).toBeInTheDocument()
  })

  it('should render trash folder', () => {
    render(<EmptyFolder folder="trash" />)

    expect(screen.getByText('Trash is empty')).toBeInTheDocument()
    expect(screen.getByText('Deleted emails will appear here.')).toBeInTheDocument()
    expect(screen.getByTestId('empty-folder-trash')).toBeInTheDocument()
  })

  it('should render generic folder', () => {
    render(<EmptyFolder folder="generic" />)

    expect(screen.getByText('This folder is empty')).toBeInTheDocument()
    expect(screen.getByText('No emails in this folder.')).toBeInTheDocument()
    expect(screen.getByTestId('empty-folder-generic')).toBeInTheDocument()
  })

  it('should use custom folder name in title', () => {
    render(<EmptyFolder folder="generic" folderName="Important" />)

    expect(screen.getByText('No emails in Important')).toBeInTheDocument()
  })

  it('should support custom title override', () => {
    render(<EmptyFolder folder="sent" title="Custom folder title" />)

    expect(screen.getByText('Custom folder title')).toBeInTheDocument()
  })

  it('should support custom description override', () => {
    render(<EmptyFolder folder="sent" description="Custom folder description" />)

    expect(screen.getByText('Custom folder description')).toBeInTheDocument()
  })
})
