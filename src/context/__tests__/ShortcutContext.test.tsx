/**
 * ShortcutContext Tests
 *
 * Story 2.11: Keyboard Shortcuts & Power User Features
 * Task 1.6: Write unit tests for shortcut hooks
 *
 * Tests for the ShortcutContext and ShortcutProvider.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { useEffect } from 'react'
import { ShortcutProvider, useShortcuts, useActiveScope, useVimMode } from '../ShortcutContext'
import type { RegisteredShortcut, ShortcutContextValue } from '@/types/shortcuts'

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

// Test component that uses the shortcuts context
function TestComponent({ onRender }: { onRender?: () => void }) {
  const context = useShortcuts()
  onRender?.()
  return (
    <div>
      <div data-testid="active-scope">{context.activeScope}</div>
      <div data-testid="vim-mode">{context.vimModeEnabled ? 'enabled' : 'disabled'}</div>
      <div data-testid="shortcuts-count">{context.shortcuts.size}</div>
      <div data-testid="enabled">{context.enabled ? 'enabled' : 'disabled'}</div>
    </div>
  )
}

// Test component for active scope hook
function ActiveScopeTestComponent() {
  const activeScope = useActiveScope()
  return <div data-testid="active-scope-hook">{activeScope}</div>
}

// Test component for vim mode hook
function VimModeTestComponent() {
  const [vimEnabled, setVimEnabled] = useVimMode()
  return (
    <div>
      <div data-testid="vim-enabled">{vimEnabled ? 'yes' : 'no'}</div>
      <button data-testid="toggle-vim" onClick={() => setVimEnabled(!vimEnabled)}>
        Toggle
      </button>
    </div>
  )
}

describe('ShortcutContext', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  describe('ShortcutProvider', () => {
    it('provides default context values', () => {
      render(
        <ShortcutProvider>
          <TestComponent />
        </ShortcutProvider>
      )

      expect(screen.getByTestId('active-scope')).toHaveTextContent('global')
      expect(screen.getByTestId('vim-mode')).toHaveTextContent('disabled')
      expect(screen.getByTestId('shortcuts-count')).toHaveTextContent('0')
      expect(screen.getByTestId('enabled')).toHaveTextContent('enabled')
    })

    it('accepts initial scope prop', () => {
      render(
        <ShortcutProvider initialScope="inbox">
          <TestComponent />
        </ShortcutProvider>
      )

      expect(screen.getByTestId('active-scope')).toHaveTextContent('inbox')
    })

    it('loads vim mode preference from localStorage', () => {
      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify({ vimModeEnabled: true }))

      render(
        <ShortcutProvider>
          <TestComponent />
        </ShortcutProvider>
      )

      expect(screen.getByTestId('vim-mode')).toHaveTextContent('enabled')
    })
  })

  describe('setActiveScope', () => {
    it('changes the active scope', () => {
      let contextRef: ShortcutContextValue | null = null

      function CaptureContext({ onContext }: { onContext: (ctx: ShortcutContextValue) => void }) {
        const ctx = useShortcuts()
        useEffect(() => {
          onContext(ctx)
        }, [ctx, onContext])
        return <TestComponent />
      }

      render(
        <ShortcutProvider>
          <CaptureContext
            onContext={(ctx) => {
              contextRef = ctx
            }}
          />
        </ShortcutProvider>
      )

      expect(screen.getByTestId('active-scope')).toHaveTextContent('global')

      act(() => {
        contextRef?.setActiveScope('reading')
      })

      expect(screen.getByTestId('active-scope')).toHaveTextContent('reading')
    })
  })

  describe('registerShortcut and unregisterShortcut', () => {
    it('registers and unregisters shortcuts', () => {
      let contextRef: ShortcutContextValue | null = null

      function CaptureContext({ onContext }: { onContext: (ctx: ShortcutContextValue) => void }) {
        const ctx = useShortcuts()
        useEffect(() => {
          onContext(ctx)
        }, [ctx, onContext])
        return <TestComponent />
      }

      render(
        <ShortcutProvider>
          <CaptureContext
            onContext={(ctx) => {
              contextRef = ctx
            }}
          />
        </ShortcutProvider>
      )

      expect(screen.getByTestId('shortcuts-count')).toHaveTextContent('0')

      const testShortcut: RegisteredShortcut = {
        id: 'test-shortcut',
        description: 'Test shortcut',
        keys: 't',
        displayKeys: 't',
        scopes: ['global'],
        category: 'general',
        handler: vi.fn(),
        enabled: true,
      }

      act(() => {
        contextRef?.registerShortcut(testShortcut)
      })

      expect(screen.getByTestId('shortcuts-count')).toHaveTextContent('1')

      act(() => {
        contextRef?.unregisterShortcut('test-shortcut')
      })

      expect(screen.getByTestId('shortcuts-count')).toHaveTextContent('0')
    })
  })

  describe('setVimMode', () => {
    it('enables and saves vim mode to localStorage', () => {
      let contextRef: ShortcutContextValue | null = null

      function CaptureContext({ onContext }: { onContext: (ctx: ShortcutContextValue) => void }) {
        const ctx = useShortcuts()
        useEffect(() => {
          onContext(ctx)
        }, [ctx, onContext])
        return <TestComponent />
      }

      render(
        <ShortcutProvider>
          <CaptureContext
            onContext={(ctx) => {
              contextRef = ctx
            }}
          />
        </ShortcutProvider>
      )

      expect(screen.getByTestId('vim-mode')).toHaveTextContent('disabled')

      act(() => {
        contextRef?.setVimMode(true)
      })

      expect(screen.getByTestId('vim-mode')).toHaveTextContent('enabled')
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'claine-shortcut-preferences',
        expect.stringContaining('"vimModeEnabled":true')
      )
    })
  })

  describe('setEnabled', () => {
    it('enables and disables all shortcuts', () => {
      let contextRef: ShortcutContextValue | null = null

      function CaptureContext({ onContext }: { onContext: (ctx: ShortcutContextValue) => void }) {
        const ctx = useShortcuts()
        useEffect(() => {
          onContext(ctx)
        }, [ctx, onContext])
        return <TestComponent />
      }

      render(
        <ShortcutProvider>
          <CaptureContext
            onContext={(ctx) => {
              contextRef = ctx
            }}
          />
        </ShortcutProvider>
      )

      expect(screen.getByTestId('enabled')).toHaveTextContent('enabled')

      act(() => {
        contextRef?.setEnabled(false)
      })

      expect(screen.getByTestId('enabled')).toHaveTextContent('disabled')
    })
  })

  describe('getShortcutsForScope', () => {
    it('returns shortcuts active in the specified scope', () => {
      let contextRef: ShortcutContextValue | null = null

      function CaptureContext({ onContext }: { onContext: (ctx: ShortcutContextValue) => void }) {
        const ctx = useShortcuts()
        useEffect(() => {
          onContext(ctx)
        }, [ctx, onContext])
        return <TestComponent />
      }

      render(
        <ShortcutProvider>
          <CaptureContext
            onContext={(ctx) => {
              contextRef = ctx
            }}
          />
        </ShortcutProvider>
      )

      const globalShortcut: RegisteredShortcut = {
        id: 'global-shortcut',
        description: 'Global shortcut',
        keys: 'g',
        displayKeys: 'g',
        scopes: ['global'],
        category: 'general',
        handler: vi.fn(),
        enabled: true,
      }

      const inboxShortcut: RegisteredShortcut = {
        id: 'inbox-shortcut',
        description: 'Inbox shortcut',
        keys: 'i',
        displayKeys: 'i',
        scopes: ['inbox'],
        category: 'navigation',
        handler: vi.fn(),
        enabled: true,
      }

      act(() => {
        contextRef?.registerShortcut(globalShortcut)
        contextRef?.registerShortcut(inboxShortcut)
      })

      const globalShortcuts = contextRef?.getShortcutsForScope('global')
      const inboxShortcuts = contextRef?.getShortcutsForScope('inbox')

      expect(globalShortcuts).toHaveLength(1)
      expect(globalShortcuts?.[0].id).toBe('global-shortcut')

      expect(inboxShortcuts).toHaveLength(1)
      expect(inboxShortcuts?.[0].id).toBe('inbox-shortcut')
    })

    it('filters out vim-mode shortcuts when vim mode is disabled', () => {
      let contextRef: ShortcutContextValue | null = null

      function CaptureContext({ onContext }: { onContext: (ctx: ShortcutContextValue) => void }) {
        const ctx = useShortcuts()
        useEffect(() => {
          onContext(ctx)
        }, [ctx, onContext])
        return <TestComponent />
      }

      render(
        <ShortcutProvider>
          <CaptureContext
            onContext={(ctx) => {
              contextRef = ctx
            }}
          />
        </ShortcutProvider>
      )

      const vimShortcut: RegisteredShortcut = {
        id: 'vim-shortcut',
        description: 'Vim shortcut',
        keys: 'g g',
        displayKeys: 'gg',
        scopes: ['inbox'],
        category: 'vim',
        requiresVimMode: true,
        handler: vi.fn(),
        enabled: true,
      }

      act(() => {
        contextRef?.registerShortcut(vimShortcut)
      })

      // Vim mode disabled by default
      let inboxShortcuts = contextRef?.getShortcutsForScope('inbox')
      expect(inboxShortcuts).toHaveLength(0)

      // Enable vim mode
      act(() => {
        contextRef?.setVimMode(true)
      })

      inboxShortcuts = contextRef?.getShortcutsForScope('inbox')
      expect(inboxShortcuts).toHaveLength(1)
    })

    it('filters out disabled shortcuts', () => {
      let contextRef: ShortcutContextValue | null = null

      function CaptureContext({ onContext }: { onContext: (ctx: ShortcutContextValue) => void }) {
        const ctx = useShortcuts()
        useEffect(() => {
          onContext(ctx)
        }, [ctx, onContext])
        return <TestComponent />
      }

      render(
        <ShortcutProvider>
          <CaptureContext
            onContext={(ctx) => {
              contextRef = ctx
            }}
          />
        </ShortcutProvider>
      )

      const disabledShortcut: RegisteredShortcut = {
        id: 'disabled-shortcut',
        description: 'Disabled shortcut',
        keys: 'd',
        displayKeys: 'd',
        scopes: ['global'],
        category: 'general',
        handler: vi.fn(),
        enabled: false,
      }

      act(() => {
        contextRef?.registerShortcut(disabledShortcut)
      })

      const shortcuts = contextRef?.getShortcutsForScope('global')
      expect(shortcuts).toHaveLength(0)
    })
  })

  describe('getAllShortcuts', () => {
    it('returns all shortcuts sorted by category and keys', () => {
      let contextRef: ShortcutContextValue | null = null

      function CaptureContext({ onContext }: { onContext: (ctx: ShortcutContextValue) => void }) {
        const ctx = useShortcuts()
        useEffect(() => {
          onContext(ctx)
        }, [ctx, onContext])
        return <TestComponent />
      }

      render(
        <ShortcutProvider>
          <CaptureContext
            onContext={(ctx) => {
              contextRef = ctx
            }}
          />
        </ShortcutProvider>
      )

      const shortcuts: RegisteredShortcut[] = [
        {
          id: 'z-shortcut',
          description: 'Z shortcut',
          keys: 'z',
          displayKeys: 'z',
          scopes: ['global'],
          category: 'general',
          handler: vi.fn(),
          enabled: true,
        },
        {
          id: 'a-shortcut',
          description: 'A shortcut',
          keys: 'a',
          displayKeys: 'a',
          scopes: ['global'],
          category: 'actions',
          handler: vi.fn(),
          enabled: true,
        },
      ]

      act(() => {
        shortcuts.forEach((s) => contextRef?.registerShortcut(s))
      })

      const allShortcuts = contextRef?.getAllShortcuts()
      expect(allShortcuts).toHaveLength(2)
      // Should be sorted: actions comes before general
      expect(allShortcuts?.[0].category).toBe('actions')
      expect(allShortcuts?.[1].category).toBe('general')
    })
  })
})

describe('useActiveScope', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  it('returns the active scope from context', () => {
    render(
      <ShortcutProvider initialScope="reading">
        <ActiveScopeTestComponent />
      </ShortcutProvider>
    )

    expect(screen.getByTestId('active-scope-hook')).toHaveTextContent('reading')
  })
})

describe('useVimMode', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  it('returns vim mode state and setter', () => {
    render(
      <ShortcutProvider>
        <VimModeTestComponent />
      </ShortcutProvider>
    )

    expect(screen.getByTestId('vim-enabled')).toHaveTextContent('no')

    act(() => {
      screen.getByTestId('toggle-vim').click()
    })

    expect(screen.getByTestId('vim-enabled')).toHaveTextContent('yes')
  })
})

describe('useShortcuts outside provider', () => {
  it('default context throws on method calls', () => {
    // Suppress console error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    let contextRef: ShortcutContextValue | null = null

    function CaptureContext({ onContext }: { onContext: (ctx: ShortcutContextValue) => void }) {
      // This doesn't throw during render because the default context value is used
      // But method calls on the default context will throw
      const ctx = useShortcuts()
      useEffect(() => {
        onContext(ctx)
      }, [ctx, onContext])
      return null
    }

    // Render without provider - gets default context
    render(
      <CaptureContext
        onContext={(ctx) => {
          contextRef = ctx
        }}
      />
    )

    // Calling methods on the default context should throw
    expect(() => {
      contextRef?.setActiveScope('inbox')
    }).toThrow('ShortcutContext not initialized')

    consoleSpy.mockRestore()
  })
})
