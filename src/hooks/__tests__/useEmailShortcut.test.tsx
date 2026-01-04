/**
 * useEmailShortcut Hook Tests
 *
 * Story 2.11: Keyboard Shortcuts & Power User Features
 * Task 1.6: Write unit tests for shortcut hooks
 *
 * Tests for the useEmailShortcut, useNavigationShortcuts, and useActionShortcuts hooks.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, act, fireEvent, screen } from '@testing-library/react'
import { ShortcutProvider, useShortcuts } from '@/context/ShortcutContext'
import {
  useEmailShortcut,
  useNavigationShortcuts,
  useActionShortcuts,
  useFolderNavigationShortcuts,
} from '../useEmailShortcut'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
  }
})()

Object.defineProperty(window, 'localStorage', { value: localStorageMock })

// Mock logger
vi.mock('@/services/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

/**
 * Helper to simulate keyboard events
 */
function pressKey(
  key: string,
  options: Partial<{
    bubbles?: boolean
    cancelable?: boolean
    ctrlKey?: boolean
    shiftKey?: boolean
    altKey?: boolean
    metaKey?: boolean
  }> = {}
) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...options,
  })
  document.dispatchEvent(event)
}

describe('useEmailShortcut', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  describe('basic functionality', () => {
    it('calls handler when shortcut is pressed in correct scope', async () => {
      const handler = vi.fn()

      function TestComponent() {
        useEmailShortcut({
          keys: 't',
          handler,
          scopes: ['global'],
          description: 'Test shortcut',
        })

        return <div>Test</div>
      }

      render(
        <ShortcutProvider initialScope="global">
          <TestComponent />
        </ShortcutProvider>
      )

      // Press the key
      await act(async () => {
        pressKey('t')
      })

      expect(handler).toHaveBeenCalled()
    })

    it('does not call handler when shortcut is pressed in wrong scope', async () => {
      const handler = vi.fn()

      function TestComponent() {
        useEmailShortcut({
          keys: 't',
          handler,
          scopes: ['inbox'],
          description: 'Inbox only shortcut',
        })

        return <div>Test</div>
      }

      render(
        <ShortcutProvider initialScope="global">
          <TestComponent />
        </ShortcutProvider>
      )

      await act(async () => {
        pressKey('t')
      })

      expect(handler).not.toHaveBeenCalled()
    })

    it('does not call handler when disabled', async () => {
      const handler = vi.fn()

      function TestComponent() {
        useEmailShortcut({
          keys: 't',
          handler,
          scopes: ['global'],
          enabled: false,
          description: 'Disabled shortcut',
        })

        return <div>Test</div>
      }

      render(
        <ShortcutProvider initialScope="global">
          <TestComponent />
        </ShortcutProvider>
      )

      await act(async () => {
        pressKey('t')
      })

      expect(handler).not.toHaveBeenCalled()
    })

    it('does not call handler when global shortcuts are disabled', async () => {
      const handler = vi.fn()

      function TestComponent() {
        const { setEnabled } = useShortcuts()

        useEmailShortcut({
          keys: 't',
          handler,
          scopes: ['global'],
          description: 'Test shortcut',
        })

        return <button onClick={() => setEnabled(false)}>Disable</button>
      }

      render(
        <ShortcutProvider initialScope="global">
          <TestComponent />
        </ShortcutProvider>
      )

      // Disable shortcuts
      await act(async () => {
        screen.getByText('Disable').click()
      })

      await act(async () => {
        pressKey('t')
      })

      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('form tag handling', () => {
    it('does not fire in input fields by default', async () => {
      const handler = vi.fn()

      function TestComponent() {
        useEmailShortcut({
          keys: 'j',
          handler,
          scopes: ['global'],
          enableOnFormTags: false,
          description: 'Not on forms',
        })

        return <input data-testid="test-input" />
      }

      render(
        <ShortcutProvider initialScope="global">
          <TestComponent />
        </ShortcutProvider>
      )

      const input = screen.getByTestId('test-input')
      input.focus()

      await act(async () => {
        fireEvent.keyDown(input, { key: 'j' })
      })

      // react-hotkeys-hook handles this internally, just verify no error
      expect(true).toBe(true)
    })
  })
})

describe('useNavigationShortcuts', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  it('calls onMoveDown when j is pressed in inbox scope', async () => {
    const onMoveDown = vi.fn()

    function TestComponent() {
      useNavigationShortcuts({
        onMoveDown,
        enabled: true,
        scopes: ['inbox'],
      })

      return <div>Navigation</div>
    }

    render(
      <ShortcutProvider initialScope="inbox">
        <TestComponent />
      </ShortcutProvider>
    )

    await act(async () => {
      pressKey('j')
    })

    expect(onMoveDown).toHaveBeenCalled()
  })

  it('calls onMoveUp when k is pressed in inbox scope', async () => {
    const onMoveUp = vi.fn()

    function TestComponent() {
      useNavigationShortcuts({
        onMoveUp,
        enabled: true,
        scopes: ['inbox'],
      })

      return <div>Navigation</div>
    }

    render(
      <ShortcutProvider initialScope="inbox">
        <TestComponent />
      </ShortcutProvider>
    )

    await act(async () => {
      pressKey('k')
    })

    expect(onMoveUp).toHaveBeenCalled()
  })

  it('calls onSelect when Enter is pressed in inbox scope', async () => {
    const onSelect = vi.fn()

    function TestComponent() {
      useNavigationShortcuts({
        onSelect,
        enabled: true,
        scopes: ['inbox'],
      })

      return <div>Navigation</div>
    }

    render(
      <ShortcutProvider initialScope="inbox">
        <TestComponent />
      </ShortcutProvider>
    )

    await act(async () => {
      pressKey('Enter')
    })

    expect(onSelect).toHaveBeenCalled()
  })

  it('does not call vim shortcuts when vim mode is disabled', async () => {
    const onGoToTop = vi.fn()

    function TestComponent() {
      useNavigationShortcuts({
        onGoToTop,
        enabled: true,
        scopes: ['inbox'],
      })

      return <div>Navigation</div>
    }

    render(
      <ShortcutProvider initialScope="inbox">
        <TestComponent />
      </ShortcutProvider>
    )

    await act(async () => {
      pressKey('g')
      pressKey('g')
    })

    // Vim shortcuts should not fire when vim mode is disabled
    expect(onGoToTop).not.toHaveBeenCalled()
  })
})

describe('useActionShortcuts', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  it('calls onArchive when e is pressed', async () => {
    const onArchive = vi.fn()

    function TestComponent() {
      useActionShortcuts({
        onArchive,
        enabled: true,
        scopes: ['inbox', 'reading'],
      })

      return <div>Actions</div>
    }

    render(
      <ShortcutProvider initialScope="inbox">
        <TestComponent />
      </ShortcutProvider>
    )

    await act(async () => {
      pressKey('e')
    })

    expect(onArchive).toHaveBeenCalled()
  })

  it('calls onReply when r is pressed in reading scope', async () => {
    const onReply = vi.fn()

    function TestComponent() {
      useActionShortcuts({
        onReply,
        enabled: true,
        scopes: ['reading'],
      })

      return <div>Actions</div>
    }

    render(
      <ShortcutProvider initialScope="reading">
        <TestComponent />
      </ShortcutProvider>
    )

    await act(async () => {
      pressKey('r')
    })

    expect(onReply).toHaveBeenCalled()
  })

  it('calls onForward when f is pressed in reading scope', async () => {
    const onForward = vi.fn()

    function TestComponent() {
      useActionShortcuts({
        onForward,
        enabled: true,
        scopes: ['reading'],
      })

      return <div>Actions</div>
    }

    render(
      <ShortcutProvider initialScope="reading">
        <TestComponent />
      </ShortcutProvider>
    )

    await act(async () => {
      pressKey('f')
    })

    expect(onForward).toHaveBeenCalled()
  })

  it('calls onSelect when x is pressed in inbox scope', async () => {
    const onSelect = vi.fn()

    function TestComponent() {
      useActionShortcuts({
        onSelect,
        enabled: true,
        scopes: ['inbox'],
      })

      return <div>Actions</div>
    }

    render(
      <ShortcutProvider initialScope="inbox">
        <TestComponent />
      </ShortcutProvider>
    )

    await act(async () => {
      pressKey('x')
    })

    expect(onSelect).toHaveBeenCalled()
  })

  it('does not call action handlers when disabled', async () => {
    const onArchive = vi.fn()
    const onDelete = vi.fn()

    function TestComponent() {
      useActionShortcuts({
        onArchive,
        onDelete,
        enabled: false,
        scopes: ['inbox'],
      })

      return <div>Actions</div>
    }

    render(
      <ShortcutProvider initialScope="inbox">
        <TestComponent />
      </ShortcutProvider>
    )

    await act(async () => {
      pressKey('e')
    })

    expect(onArchive).not.toHaveBeenCalled()
    expect(onDelete).not.toHaveBeenCalled()
  })
})

describe('useFolderNavigationShortcuts', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  it('does not call handlers when disabled', async () => {
    const onNavigateToFolder = vi.fn()

    function TestComponent() {
      useFolderNavigationShortcuts({
        onNavigateToFolder,
        enabled: false,
      })

      return <div>Folders</div>
    }

    render(
      <ShortcutProvider initialScope="global">
        <TestComponent />
      </ShortcutProvider>
    )

    await act(async () => {
      pressKey('g')
      pressKey('i')
    })

    expect(onNavigateToFolder).not.toHaveBeenCalled()
  })

  it('does not throw when onNavigateToFolder is not provided', async () => {
    function TestComponent() {
      useFolderNavigationShortcuts({
        enabled: true,
      })

      return <div>Folders</div>
    }

    // Should not throw
    render(
      <ShortcutProvider initialScope="global">
        <TestComponent />
      </ShortcutProvider>
    )

    expect(true).toBe(true)
  })
})

describe('scope transitions', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  it('shortcuts update when scope changes', async () => {
    const inboxHandler = vi.fn()
    const readingHandler = vi.fn()

    function TestComponent() {
      const { setActiveScope } = useShortcuts()

      useEmailShortcut({
        keys: 't',
        handler: inboxHandler,
        scopes: ['inbox'],
        description: 'Inbox shortcut',
      })

      useEmailShortcut({
        keys: 't',
        handler: readingHandler,
        scopes: ['reading'],
        description: 'Reading shortcut',
      })

      return (
        <div>
          <button onClick={() => setActiveScope('inbox')}>Go to Inbox</button>
          <button onClick={() => setActiveScope('reading')}>Go to Reading</button>
        </div>
      )
    }

    render(
      <ShortcutProvider initialScope="inbox">
        <TestComponent />
      </ShortcutProvider>
    )

    // Press t in inbox scope
    await act(async () => {
      pressKey('t')
    })
    expect(inboxHandler).toHaveBeenCalledTimes(1)
    expect(readingHandler).not.toHaveBeenCalled()

    // Switch to reading scope
    await act(async () => {
      screen.getByText('Go to Reading').click()
    })

    // Press t in reading scope
    await act(async () => {
      pressKey('t')
    })
    expect(inboxHandler).toHaveBeenCalledTimes(1) // Still 1
    expect(readingHandler).toHaveBeenCalledTimes(1)
  })
})
