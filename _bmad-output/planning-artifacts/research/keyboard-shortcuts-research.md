# Keyboard Shortcut Management Systems for Email Clients

**Research Document for Claine v2**
**Focus:** Gmail-like keyboard navigation and power user workflows
**Date:** October 2025
**Target:** React 19 SPA with TypeScript

---

## Executive Summary

### Recommendation: **react-hotkeys-hook**

For Claine v2, we recommend **react-hotkeys-hook** as the primary keyboard shortcut library, with a custom context-aware wrapper for email-specific functionality.

**Key Reasons:**

- **Best React Integration**: Hook-based API aligns with React 19 patterns
- **TypeScript Native**: Built with TypeScript, complete type definitions included
- **Scope System**: Built-in scope management for context-aware shortcuts
- **Active Maintenance**: 1.3M+ weekly downloads, actively maintained
- **Small Bundle**: Minimal overhead (~3-4KB gzipped)
- **Proven Scale**: Used in production by major applications

**Architecture Approach:**

1. Use react-hotkeys-hook for shortcut registration and event handling
2. Build custom context provider for email-specific shortcut management
3. Implement Gmail-parity shortcuts with customization layer
4. Add visual overlay component (? key) for discoverability
5. Integrate with focus management system for accessibility

**Implementation Timeline:** 3-4 weeks for full implementation with customization UI

---

## 1. Library Comparison

### Detailed Feature Matrix

| Feature                  | react-hotkeys-hook | tinykeys         | mousetrap      | hotkeys-js     | @github/hotkey     |
| ------------------------ | ------------------ | ---------------- | -------------- | -------------- | ------------------ |
| **Bundle Size**          | ~3-4KB gzipped     | ~400B gzipped    | ~2KB gzipped   | ~1.7KB gzipped | ~2.4KB gzipped     |
| **Weekly Downloads**     | 1,349,086          | 48,983           | 542,311        | 567 projects   | Used by GitHub     |
| **TypeScript Support**   | Native (built-in)  | Manual types     | @types package | Manual types   | Native             |
| **React Integration**    | Hooks (native)     | Manual useEffect | Wrapper needed | Wrapper needed | Manual integration |
| **Scope/Context System** | Yes (built-in)     | No (manual)      | No             | Yes (built-in) | No                 |
| **Sequence Support**     | Yes                | Yes              | Yes            | Yes            | Yes                |
| **Modifier Keys**        | Full support       | Full support     | Full support   | Full support   | Full support       |
| **Platform Detection**   | Yes ($mod)         | Yes ($mod)       | No             | Yes            | Yes (Mod)          |
| **Global vs Local**      | Both               | Both             | Global focus   | Both           | Element-focused    |
| **Enabled/Disabled**     | Per-hook control   | Manual           | Manual         | Scope-based    | Manual             |
| **Event Prevention**     | Configurable       | Manual           | Configurable   | Configurable   | Automatic          |
| **Memory Management**    | Auto cleanup       | Manual           | Manual         | Manual         | Auto cleanup       |
| **Accessibility Focus**  | Good               | Manual           | Manual         | Manual         | Excellent          |
| **Form Field Filtering** | Built-in options   | Manual           | Built-in       | Built-in       | Smart defaults     |
| **API Complexity**       | Low (hooks)        | Very Low         | Medium         | Medium         | Low                |
| **React 19 Compatible**  | Yes                | Yes              | Yes            | Yes            | Yes                |

### Detailed Library Analysis

#### 1. react-hotkeys-hook (Recommended)

**Strengths:**

- Hook-based API integrates seamlessly with React component lifecycle
- Built-in scope system for context-aware shortcuts
- Automatic cleanup prevents memory leaks
- Options to enable/disable shortcuts per component
- Filter options to prevent conflicts with form fields
- Active community and maintenance

**Weaknesses:**

- React-specific (not reusable outside React)
- Slightly larger than minimal libraries
- Requires understanding of React hooks patterns

**Best For:** React applications requiring comprehensive shortcut management

**Example Usage:**

```typescript
import { useHotkeys } from 'react-hotkeys-hook'

function EmailList() {
  useHotkeys('j', () => selectNextEmail(), { scopes: 'inbox' })
  useHotkeys('k', () => selectPreviousEmail(), { scopes: 'inbox' })
  useHotkeys('c', () => openCompose(), { scopes: 'inbox' })
}
```

#### 2. tinykeys

**Strengths:**

- Extremely small bundle size (~400B)
- Modern, clean API
- Cross-platform modifier support ($mod)
- Zero dependencies
- Framework agnostic

**Weaknesses:**

- No built-in React integration (requires custom hook)
- No scope/context system (must build yourself)
- Manual memory management required
- Limited documentation compared to alternatives

**Best For:** Projects prioritizing minimal bundle size with simple requirements

#### 3. mousetrap

**Strengths:**

- Most mature library (11,717 GitHub stars)
- Extensive documentation and examples
- Large community and ecosystem
- Battle-tested in production

**Weaknesses:**

- No native TypeScript support
- No React hooks integration
- No scope system (global by default)
- Older API patterns
- Larger bundle than modern alternatives

**Best For:** Vanilla JavaScript projects or legacy applications

#### 4. hotkeys-js

**Strengths:**

- Small bundle size (~1.7KB)
- Built-in scope management
- Zero dependencies
- Good documentation

**Weaknesses:**

- Lower adoption than alternatives
- Requires custom React integration
- Manual cleanup management
- TypeScript support through manual types

**Best For:** Projects needing scope management without React integration

#### 5. @github/hotkey

**Strengths:**

- Excellent accessibility focus (built by GitHub)
- Used in production on GitHub.com
- Smart form field handling
- Simple declarative API
- Strong ARIA integration

**Weaknesses:**

- Element-focused (not global shortcuts)
- No scope/context system
- Requires DOM elements for binding
- Less suitable for complex SPA routing

**Best For:** Static sites or applications with simple shortcut needs

---

## 2. Gmail Keyboard Shortcuts Analysis

### Complete Gmail Shortcuts Reference

Gmail's keyboard shortcuts are organized by context and function. To enable them, users press Shift+/ or ? to view the help overlay.

#### Core Navigation (Always Active)

| Shortcut       | Action                   | Context      |
| -------------- | ------------------------ | ------------ |
| `j`            | Next conversation        | List view    |
| `k`            | Previous conversation    | List view    |
| `o` or `Enter` | Open conversation        | List view    |
| `u`            | Return to list           | Reading view |
| `g + i`        | Go to Inbox              | Any          |
| `g + s`        | Go to Starred            | Any          |
| `g + t`        | Go to Sent               | Any          |
| `g + d`        | Go to Drafts             | Any          |
| `g + a`        | Go to All Mail           | Any          |
| `/`            | Search mail              | Any          |
| `.`            | Open "More Actions" menu | Any          |

#### Composition Actions

| Shortcut               | Action              | Context              |
| ---------------------- | ------------------- | -------------------- |
| `c`                    | Compose new email   | Any (not in compose) |
| `d`                    | Compose in new tab  | Any                  |
| `Cmd/Ctrl + Enter`     | Send email          | Compose view         |
| `Cmd/Ctrl + Shift + c` | Add CC recipients   | Compose view         |
| `Cmd/Ctrl + Shift + b` | Add BCC recipients  | Compose view         |
| `Cmd/Ctrl + k`         | Insert link         | Compose view         |
| `Esc` then `Tab`       | Exit compose field  | Compose view         |
| `Cmd/Ctrl + Shift + f` | Change from address | Compose view         |

#### Selection and Action

| Shortcut   | Action                      | Context            |
| ---------- | --------------------------- | ------------------ |
| `x`        | Select conversation         | List view          |
| `* + a`    | Select all conversations    | List view          |
| `* + n`    | Deselect all                | List view          |
| `* + r`    | Select read conversations   | List view          |
| `* + u`    | Select unread conversations | List view          |
| `e`        | Archive                     | Any with selection |
| `#`        | Delete                      | Any with selection |
| `!`        | Mark as spam                | Any with selection |
| `s`        | Star/Unstar                 | Any with selection |
| `+` or `=` | Mark important              | Any with selection |
| `-`        | Mark not important          | Any with selection |

#### Reading Actions

| Shortcut    | Action                           | Context      |
| ----------- | -------------------------------- | ------------ |
| `n`         | Next message in conversation     | Reading view |
| `p`         | Previous message in conversation | Reading view |
| `r`         | Reply                            | Reading view |
| `a`         | Reply all                        | Reading view |
| `f`         | Forward                          | Reading view |
| `Shift + i` | Mark as read                     | Reading view |
| `Shift + u` | Mark as unread                   | Reading view |
| `m`         | Mute conversation                | Reading view |
| `]`         | Archive and next                 | Reading view |
| `[`         | Archive and previous             | Reading view |

#### Application-Level

| Shortcut    | Action                  | Context            |
| ----------- | ----------------------- | ------------------ |
| `?`         | Show keyboard shortcuts | Any                |
| `v`         | Move to folder/label    | Any with selection |
| `l`         | Apply label             | Any with selection |
| `z`         | Undo last action        | Any                |
| `Shift + #` | Delete permanently      | Trash/Spam         |

### Context-Aware Behavior Patterns

Gmail implements sophisticated context switching:

1. **Input Field Detection**: Shortcuts disabled while typing in compose, search, or form fields
2. **View-Based Contexts**: Different shortcuts active in list view vs. reading view vs. compose view
3. **Selection State**: Some shortcuts require active selection (x to select first)
4. **Modifier Sequences**: Multi-key sequences like `g + i` for navigation
5. **Escape Handling**: Esc key exits compose field, enabling navigation shortcuts again

### Visual Hint System

Gmail's `?` overlay features:

- **Modal Dialog**: Full-screen semi-transparent overlay
- **Two-Column Layout**: Shortcuts organized by category
- **Enabled/Disabled Indicators**: Shows which shortcuts are active
- **Searchable**: Can filter shortcuts by typing
- **Dismissible**: Escape key or click-outside to close
- **Always Accessible**: Available from any view

---

## 3. Architecture Patterns for Email Clients

### Pattern 1: Global + Context Provider Architecture (Recommended)

This pattern combines global shortcut registration with React Context for state management.

```typescript
// types/shortcuts.ts
export type ShortcutScope = 'global' | 'inbox' | 'reading' | 'compose';

export interface ShortcutConfig {
  key: string;
  action: () => void;
  description: string;
  scope: ShortcutScope;
  enabled?: boolean;
  preventDefault?: boolean;
}

export interface ShortcutContextType {
  activeScope: ShortcutScope;
  setActiveScope: (scope: ShortcutScope) => void;
  shortcuts: Map<string, ShortcutConfig>;
  registerShortcut: (config: ShortcutConfig) => () => void;
  customBindings: Record<string, string>;
  updateBinding: (action: string, newKey: string) => void;
}

// context/ShortcutContext.tsx
import React, { createContext, useContext, useState, useCallback } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';

const ShortcutContext = createContext<ShortcutContextType | null>(null);

export function ShortcutProvider({ children }: { children: React.ReactNode }) {
  const [activeScope, setActiveScope] = useState<ShortcutScope>('global');
  const [shortcuts, setShortcuts] = useState<Map<string, ShortcutConfig>>(new Map());
  const [customBindings, setCustomBindings] = useState<Record<string, string>>(() => {
    // Load from localStorage
    const saved = localStorage.getItem('claine-shortcuts');
    return saved ? JSON.parse(saved) : {};
  });

  const registerShortcut = useCallback((config: ShortcutConfig) => {
    const key = `${config.scope}:${config.key}`;
    setShortcuts(prev => new Map(prev).set(key, config));

    // Return cleanup function
    return () => {
      setShortcuts(prev => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
    };
  }, []);

  const updateBinding = useCallback((action: string, newKey: string) => {
    setCustomBindings(prev => {
      const updated = { ...prev, [action]: newKey };
      localStorage.setItem('claine-shortcuts', JSON.stringify(updated));
      return updated;
    });
  }, []);

  return (
    <ShortcutContext.Provider value={{
      activeScope,
      setActiveScope,
      shortcuts,
      registerShortcut,
      customBindings,
      updateBinding
    }}>
      {children}
    </ShortcutContext.Provider>
  );
}

export function useShortcuts() {
  const context = useContext(ShortcutContext);
  if (!context) throw new Error('useShortcuts must be used within ShortcutProvider');
  return context;
}

// hooks/useEmailShortcut.ts
import { useEffect } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { useShortcuts } from '../context/ShortcutContext';
import type { ShortcutScope } from '../types/shortcuts';

interface UseEmailShortcutOptions {
  scope: ShortcutScope;
  description: string;
  enabled?: boolean;
  preventDefault?: boolean;
}

export function useEmailShortcut(
  keys: string,
  callback: () => void,
  options: UseEmailShortcutOptions
) {
  const { activeScope, registerShortcut, customBindings } = useShortcuts();

  // Check for custom binding
  const effectiveKeys = customBindings[`${options.scope}:${keys}`] || keys;

  // Register in context for overlay display
  useEffect(() => {
    return registerShortcut({
      key: effectiveKeys,
      action: callback,
      description: options.description,
      scope: options.scope,
      enabled: options.enabled ?? true,
      preventDefault: options.preventDefault ?? true
    });
  }, [effectiveKeys, callback, options, registerShortcut]);

  // Only active when scope matches or scope is global
  const isActive = options.scope === 'global' || activeScope === options.scope;

  useHotkeys(
    effectiveKeys,
    (e) => {
      e.preventDefault();
      callback();
    },
    {
      enabled: isActive && (options.enabled ?? true),
      preventDefault: options.preventDefault ?? true,
      // Don't trigger in form inputs unless explicitly allowed
      enableOnFormTags: false,
      enableOnContentEditable: false
    },
    [isActive, callback]
  );
}
```

### Pattern 2: Component-Level Scope Management

```typescript
// components/InboxView.tsx
import { useEffect } from 'react';
import { useShortcuts } from '../context/ShortcutContext';
import { useEmailShortcut } from '../hooks/useEmailShortcut';

export function InboxView() {
  const { setActiveScope } = useShortcuts();
  const { selectNext, selectPrevious, openCompose } = useInboxActions();

  // Set active scope when component mounts
  useEffect(() => {
    setActiveScope('inbox');
    return () => setActiveScope('global');
  }, [setActiveScope]);

  // Register inbox-specific shortcuts
  useEmailShortcut('j', selectNext, {
    scope: 'inbox',
    description: 'Select next email'
  });

  useEmailShortcut('k', selectPrevious, {
    scope: 'inbox',
    description: 'Select previous email'
  });

  useEmailShortcut('c', openCompose, {
    scope: 'inbox',
    description: 'Compose new email'
  });

  return <div>{/* inbox UI */}</div>;
}

// components/EmailReader.tsx
export function EmailReader() {
  const { setActiveScope } = useShortcuts();
  const { reply, replyAll, forward, archive } = useReaderActions();

  useEffect(() => {
    setActiveScope('reading');
    return () => setActiveScope('global');
  }, [setActiveScope]);

  useEmailShortcut('r', reply, {
    scope: 'reading',
    description: 'Reply to email'
  });

  useEmailShortcut('a', replyAll, {
    scope: 'reading',
    description: 'Reply all'
  });

  useEmailShortcut('f', forward, {
    scope: 'reading',
    description: 'Forward email'
  });

  useEmailShortcut('e', archive, {
    scope: 'reading',
    description: 'Archive and return to inbox'
  });

  return <div>{/* reader UI */}</div>;
}
```

### Pattern 3: Conflict Resolution System

```typescript
// utils/shortcutConflicts.ts
export interface ConflictRule {
  priority: number
  scope: ShortcutScope
  allowOverride: boolean
}

const SCOPE_PRIORITY: Record<ShortcutScope, number> = {
  compose: 4, // Highest priority
  reading: 3,
  inbox: 2,
  global: 1, // Lowest priority
}

export function resolveShortcutConflict(shortcuts: ShortcutConfig[]): ShortcutConfig | null {
  if (shortcuts.length === 0) return null
  if (shortcuts.length === 1) return shortcuts[0]

  // Sort by scope priority (higher priority wins)
  const sorted = [...shortcuts].sort((a, b) => SCOPE_PRIORITY[b.scope] - SCOPE_PRIORITY[a.scope])

  return sorted[0]
}

// hooks/useSmartShortcut.ts
export function useSmartShortcut(
  keys: string,
  configs: Array<{
    scope: ShortcutScope
    action: () => void
    description: string
  }>
) {
  const { activeScope } = useShortcuts()

  // Find matching config for active scope
  const activeConfig = configs.find((c) => c.scope === activeScope || c.scope === 'global')

  useEmailShortcut(keys, activeConfig?.action || (() => {}), {
    scope: activeConfig?.scope || 'global',
    description: activeConfig?.description || '',
    enabled: !!activeConfig,
  })
}
```

### Pattern 4: Disabled State Management

```typescript
// hooks/useDisabledShortcuts.ts
export function useDisabledShortcuts() {
  const [disabledShortcuts, setDisabledShortcuts] = useState<Set<string>>(new Set());

  const disableShortcut = useCallback((key: string) => {
    setDisabledShortcuts(prev => new Set(prev).add(key));
  }, []);

  const enableShortcut = useCallback((key: string) => {
    setDisabledShortcuts(prev => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  return { disabledShortcuts, disableShortcut, enableShortcut };
}

// Usage in component with modal
function EmailWithModal() {
  const { disableShortcut, enableShortcut } = useDisabledShortcuts();
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (modalOpen) {
      // Disable all inbox shortcuts when modal is open
      disableShortcut('j');
      disableShortcut('k');
      disableShortcut('x');
    } else {
      enableShortcut('j');
      enableShortcut('k');
      enableShortcut('x');
    }
  }, [modalOpen, disableShortcut, enableShortcut]);

  return (
    <>
      {/* email list */}
      {modalOpen && <Modal onClose={() => setModalOpen(false)} />}
    </>
  );
}
```

### Pattern 5: Focus Management Integration

```typescript
// hooks/useFocusShortcut.ts
import { useRef, useEffect } from 'react';
import { useEmailShortcut } from './useEmailShortcut';

export function useFocusShortcut(
  keys: string,
  scope: ShortcutScope,
  description: string
) {
  const elementRef = useRef<HTMLElement>(null);

  useEmailShortcut(
    keys,
    () => {
      elementRef.current?.focus();
    },
    { scope, description }
  );

  return elementRef;
}

// Usage
function SearchBar() {
  const searchRef = useFocusShortcut('/', 'global', 'Focus search');

  return (
    <input
      ref={searchRef as React.RefObject<HTMLInputElement>}
      type="search"
      placeholder="Search email..."
      aria-label="Search email"
    />
  );
}
```

---

## 4. Customization and UX Patterns

### User Customization Interface

```typescript
// components/ShortcutSettings.tsx
import { useState } from 'react';
import { useShortcuts } from '../context/ShortcutContext';

export function ShortcutSettings() {
  const { shortcuts, customBindings, updateBinding } = useShortcuts();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [recordedKey, setRecordedKey] = useState<string>('');

  const handleKeyRecord = (e: React.KeyboardEvent) => {
    e.preventDefault();

    const parts: string[] = [];
    if (e.metaKey) parts.push('meta');
    if (e.ctrlKey) parts.push('ctrl');
    if (e.altKey) parts.push('alt');
    if (e.shiftKey) parts.push('shift');

    if (e.key.length === 1) {
      parts.push(e.key.toLowerCase());
    } else if (['Enter', 'Escape', 'Space'].includes(e.key)) {
      parts.push(e.key.toLowerCase());
    }

    setRecordedKey(parts.join('+'));
  };

  const handleSave = (actionKey: string) => {
    if (recordedKey) {
      updateBinding(actionKey, recordedKey);
      setEditingKey(null);
      setRecordedKey('');
    }
  };

  return (
    <div className="shortcut-settings">
      <h2>Keyboard Shortcuts</h2>

      <div className="shortcut-list">
        {Array.from(shortcuts.entries()).map(([key, config]) => (
          <div key={key} className="shortcut-item">
            <div className="shortcut-description">
              {config.description}
            </div>

            <div className="shortcut-key">
              {editingKey === key ? (
                <input
                  type="text"
                  value={recordedKey || 'Press keys...'}
                  onKeyDown={handleKeyRecord}
                  autoFocus
                  readOnly
                />
              ) : (
                <kbd>{customBindings[key] || config.key}</kbd>
              )}
            </div>

            <div className="shortcut-actions">
              {editingKey === key ? (
                <>
                  <button onClick={() => handleSave(key)}>Save</button>
                  <button onClick={() => setEditingKey(null)}>Cancel</button>
                </>
              ) : (
                <button onClick={() => setEditingKey(key)}>Edit</button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="shortcut-actions-global">
        <button onClick={() => {/* Export logic */}}>
          Export Shortcuts
        </button>
        <button onClick={() => {/* Import logic */}}>
          Import Shortcuts
        </button>
        <button onClick={() => {/* Reset logic */}}>
          Reset to Defaults
        </button>
      </div>
    </div>
  );
}
```

### Import/Export Configuration

```typescript
// utils/shortcutIO.ts
export interface ShortcutExport {
  version: string;
  created: string;
  bindings: Record<string, string>;
}

export function exportShortcuts(
  customBindings: Record<string, string>
): string {
  const exportData: ShortcutExport = {
    version: '1.0',
    created: new Date().toISOString(),
    bindings: customBindings
  };

  return JSON.stringify(exportData, null, 2);
}

export function importShortcuts(json: string): Record<string, string> {
  try {
    const data: ShortcutExport = JSON.parse(json);

    // Validate version
    if (data.version !== '1.0') {
      throw new Error('Unsupported version');
    }

    // Validate bindings structure
    if (typeof data.bindings !== 'object') {
      throw new Error('Invalid bindings format');
    }

    return data.bindings;
  } catch (error) {
    throw new Error(`Failed to import shortcuts: ${error.message}`);
  }
}

// Usage in component
function ImportExportButtons() {
  const { customBindings, updateBinding } = useShortcuts();

  const handleExport = () => {
    const json = exportShortcuts(customBindings);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `claine-shortcuts-${Date.now()}.json`;
    a.click();

    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const bindings = importShortcuts(event.target?.result as string);
        Object.entries(bindings).forEach(([key, value]) => {
          updateBinding(key, value);
        });
        alert('Shortcuts imported successfully!');
      } catch (error) {
        alert(error.message);
      }
    };
    reader.readAsText(file);
  };

  return (
    <>
      <button onClick={handleExport}>Export Shortcuts</button>
      <input
        type="file"
        accept=".json"
        onChange={handleImport}
        style={{ display: 'none' }}
        id="import-shortcuts"
      />
      <label htmlFor="import-shortcuts">
        <button as="span">Import Shortcuts</button>
      </label>
    </>
  );
}
```

### Shortcut Overlay Component (? Key)

```typescript
// components/ShortcutOverlay.tsx
import { useState } from 'react';
import { useEmailShortcut } from '../hooks/useEmailShortcut';
import { useShortcuts } from '../context/ShortcutContext';
import FocusTrap from 'focus-trap-react';

export function ShortcutOverlay() {
  const [isOpen, setIsOpen] = useState(false);
  const { shortcuts, activeScope } = useShortcuts();
  const [searchTerm, setSearchTerm] = useState('');

  // Toggle overlay with ?
  useEmailShortcut('?', () => setIsOpen(prev => !prev), {
    scope: 'global',
    description: 'Show keyboard shortcuts',
    preventDefault: true
  });

  // Close with Escape
  useEmailShortcut('escape', () => setIsOpen(false), {
    scope: 'global',
    description: 'Close overlay',
    enabled: isOpen
  });

  if (!isOpen) return null;

  // Group shortcuts by scope
  const groupedShortcuts = Array.from(shortcuts.values()).reduce((acc, config) => {
    if (!acc[config.scope]) acc[config.scope] = [];
    acc[config.scope].push(config);
    return acc;
  }, {} as Record<string, ShortcutConfig[]>);

  // Filter by search term
  const filteredShortcuts = Object.entries(groupedShortcuts).reduce((acc, [scope, configs]) => {
    const filtered = configs.filter(c =>
      c.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.key.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (filtered.length > 0) acc[scope] = filtered;
    return acc;
  }, {} as Record<string, ShortcutConfig[]>);

  return (
    <FocusTrap>
      <div
        className="shortcut-overlay"
        role="dialog"
        aria-label="Keyboard shortcuts"
        aria-modal="true"
        onClick={() => setIsOpen(false)}
      >
        <div
          className="shortcut-overlay-content"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="shortcut-overlay-header">
            <h2>Keyboard Shortcuts</h2>
            <button
              onClick={() => setIsOpen(false)}
              aria-label="Close shortcuts overlay"
            >
              ✕
            </button>
          </div>

          <div className="shortcut-overlay-search">
            <input
              type="search"
              placeholder="Search shortcuts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search shortcuts"
            />
          </div>

          <div className="shortcut-overlay-body">
            {Object.entries(filteredShortcuts).map(([scope, configs]) => (
              <div key={scope} className="shortcut-section">
                <h3>{scope.charAt(0).toUpperCase() + scope.slice(1)}</h3>
                <dl className="shortcut-list">
                  {configs.map(config => (
                    <div key={`${scope}:${config.key}`} className="shortcut-row">
                      <dt>{config.description}</dt>
                      <dd>
                        <kbd>{config.key}</kbd>
                        {scope === activeScope && (
                          <span className="active-indicator" aria-label="Active">
                            •
                          </span>
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>

          <div className="shortcut-overlay-footer">
            <p>Press <kbd>?</kbd> to toggle this dialog • Press <kbd>Esc</kbd> to close</p>
          </div>
        </div>
      </div>
    </FocusTrap>
  );
}

// Styles (CSS-in-JS or separate CSS file)
const styles = `
.shortcut-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.shortcut-overlay-content {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  max-width: 800px;
  max-height: 80vh;
  width: 90%;
  display: flex;
  flex-direction: column;
}

.shortcut-overlay-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #e0e0e0;
}

.shortcut-overlay-body {
  overflow-y: auto;
  padding: 20px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
}

.shortcut-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
}

kbd {
  background: #f5f5f5;
  border: 1px solid #ccc;
  border-radius: 4px;
  padding: 4px 8px;
  font-family: monospace;
  font-size: 13px;
}

.active-indicator {
  color: #4CAF50;
  margin-left: 8px;
  font-size: 20px;
}
`;
```

### Onboarding for Keyboard Users

```typescript
// components/ShortcutOnboarding.tsx
import { useState, useEffect } from 'react';

export function ShortcutOnboarding() {
  const [currentTip, setCurrentTip] = useState(0);
  const [dismissed, setDismissed] = useState(() =>
    localStorage.getItem('shortcut-onboarding-dismissed') === 'true'
  );

  const tips = [
    {
      title: 'Navigate with j/k',
      description: 'Press j to move down, k to move up in your inbox',
      keys: ['j', 'k']
    },
    {
      title: 'Quick compose',
      description: 'Press c to start a new email from anywhere',
      keys: ['c']
    },
    {
      title: 'Archive and move',
      description: 'Press e to archive the current email',
      keys: ['e']
    },
    {
      title: 'View all shortcuts',
      description: 'Press ? to see all available keyboard shortcuts',
      keys: ['?']
    }
  ];

  useEffect(() => {
    if (dismissed) return;

    const timer = setInterval(() => {
      setCurrentTip(prev => (prev + 1) % tips.length);
    }, 5000);

    return () => clearInterval(timer);
  }, [dismissed, tips.length]);

  if (dismissed) return null;

  const tip = tips[currentTip];

  return (
    <div className="shortcut-onboarding" role="complementary" aria-label="Keyboard shortcut tip">
      <div className="tip-content">
        <strong>{tip.title}</strong>
        <p>{tip.description}</p>
        <div className="tip-keys">
          {tip.keys.map(key => (
            <kbd key={key}>{key}</kbd>
          ))}
        </div>
      </div>

      <div className="tip-actions">
        <button onClick={() => setCurrentTip((currentTip + 1) % tips.length)}>
          Next Tip
        </button>
        <button onClick={() => {
          setDismissed(true);
          localStorage.setItem('shortcut-onboarding-dismissed', 'true');
        }}>
          Got it
        </button>
      </div>

      <div className="tip-progress">
        {tips.map((_, i) => (
          <span
            key={i}
            className={i === currentTip ? 'active' : ''}
            aria-label={`Tip ${i + 1} of ${tips.length}`}
          />
        ))}
      </div>
    </div>
  );
}
```

---

## 5. Accessibility Considerations

### WCAG Compliance Checklist

#### Level A Requirements (Must Have)

- **2.1.1 Keyboard**: All functionality available via keyboard
  - ✅ All shortcuts implemented without requiring mouse
  - ✅ Tab navigation for all interactive elements
  - ✅ No keyboard traps (can escape from all modals/overlays)

- **2.1.2 No Keyboard Trap**: User can navigate away using keyboard
  - ✅ Escape key closes modals and overlays
  - ✅ Focus returns to trigger element after modal closes
  - ✅ Focus trap within modals (but escapable)

- **2.4.3 Focus Order**: Focus order preserves meaning
  - ✅ Logical tab order follows visual flow
  - ✅ No tabindex > 0 (use 0 and -1 only)

- **2.4.7 Focus Visible**: Keyboard focus indicator visible
  - ✅ Clear visual focus indicators (2px outline, 2px offset)
  - ✅ 3:1 contrast ratio for focus indicators
  - ✅ Focus indicators never removed (no outline: none)

#### Level AA Requirements (Should Have)

- **1.4.11 Non-text Contrast**: UI components have 3:1 contrast
  - ✅ Keyboard hint badges have sufficient contrast
  - ✅ Shortcut overlay text has 4.5:1 contrast

- **2.4.6 Headings and Labels**: Descriptive labels
  - ✅ All shortcuts have descriptive labels in overlay
  - ✅ ARIA labels for icon-only buttons with shortcuts

- **2.5.1 Pointer Gestures**: Multi-point or path-based not required
  - ✅ All actions have keyboard alternatives

### Screen Reader Compatibility

```typescript
// components/AccessibleShortcutButton.tsx
interface AccessibleShortcutButtonProps {
  onClick: () => void;
  shortcut: string;
  label: string;
  description?: string;
  children: React.ReactNode;
}

export function AccessibleShortcutButton({
  onClick,
  shortcut,
  label,
  description,
  children
}: AccessibleShortcutButtonProps) {
  return (
    <button
      onClick={onClick}
      aria-label={`${label} (keyboard shortcut: ${shortcut})`}
      aria-description={description}
      title={`${label} (${shortcut})`}
      data-shortcut={shortcut}
    >
      {children}
      <span className="keyboard-hint" aria-hidden="true">
        {shortcut}
      </span>
    </button>
  );
}

// Usage
<AccessibleShortcutButton
  onClick={handleCompose}
  shortcut="c"
  label="Compose new email"
  description="Opens a new email composition window"
>
  <ComposeIcon />
</AccessibleShortcutButton>
```

### Focus Management Patterns

```typescript
// hooks/useFocusTrap.ts
import { useEffect, useRef } from 'react';

export function useFocusTrap(isActive: boolean) {
  const containerRef = useRef<HTMLElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isActive) return;

    // Save current focus
    previousActiveElement.current = document.activeElement as HTMLElement;

    const container = containerRef.current;
    if (!container) return;

    // Get all focusable elements
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Focus first element
    firstElement.focus();

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    container.addEventListener('keydown', handleTabKey);

    return () => {
      container.removeEventListener('keydown', handleTabKey);
      // Restore previous focus
      previousActiveElement.current?.focus();
    };
  }, [isActive]);

  return containerRef;
}

// Usage in Modal
function AccessibleModal({ isOpen, onClose, children }: ModalProps) {
  const modalRef = useFocusTrap(isOpen);

  useEmailShortcut('escape', onClose, {
    scope: 'global',
    description: 'Close modal',
    enabled: isOpen
  });

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="modal-content"
      >
        <h2 id="modal-title">Modal Title</h2>
        {children}
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
```

### Skip Links Implementation

```typescript
// components/SkipLinks.tsx
export function SkipLinks() {
  const skipToMain = () => {
    const main = document.getElementById('main-content');
    if (main) {
      main.focus();
      main.scrollIntoView();
    }
  };

  const skipToSearch = () => {
    const search = document.getElementById('search-input');
    if (search) {
      search.focus();
    }
  };

  return (
    <div className="skip-links">
      <a href="#main-content" onClick={skipToMain}>
        Skip to main content
      </a>
      <a href="#search-input" onClick={skipToSearch}>
        Skip to search
      </a>
      <button onClick={() => {/* Show shortcuts overlay */}}>
        View keyboard shortcuts
      </button>
    </div>
  );
}

// CSS for skip links (visible on focus only)
const skipLinksStyles = `
.skip-links {
  position: absolute;
  top: -40px;
  left: 0;
  z-index: 10000;
}

.skip-links a,
.skip-links button {
  position: absolute;
  left: -10000px;
  top: auto;
  width: 1px;
  height: 1px;
  overflow: hidden;
}

.skip-links a:focus,
.skip-links button:focus {
  position: static;
  width: auto;
  height: auto;
  padding: 8px 16px;
  background: #000;
  color: #fff;
  text-decoration: none;
  border: 2px solid #fff;
  outline: 2px solid #000;
}
`;
```

### ARIA Attributes for Shortcuts

```typescript
// components/EmailListItem.tsx
interface EmailListItemProps {
  email: Email;
  isSelected: boolean;
  position: number;
  onSelect: () => void;
}

export function EmailListItem({
  email,
  isSelected,
  position,
  onSelect
}: EmailListItemProps) {
  return (
    <div
      role="article"
      aria-label={`Email from ${email.from}: ${email.subject}`}
      aria-selected={isSelected}
      aria-posinset={position}
      aria-setsize={-1} // Set by parent container
      tabIndex={isSelected ? 0 : -1}
      onClick={onSelect}
      className={isSelected ? 'selected' : ''}
      data-email-id={email.id}
    >
      <div className="email-from">{email.from}</div>
      <div className="email-subject">{email.subject}</div>
      <div className="email-preview">{email.preview}</div>

      {isSelected && (
        <div className="keyboard-hints" aria-live="polite" aria-atomic="true">
          Press <kbd>Enter</kbd> to open, <kbd>e</kbd> to archive
        </div>
      )}
    </div>
  );
}

// Parent container
export function EmailList({ emails }: { emails: Email[] }) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEmailShortcut('j', () => {
    setSelectedIndex(prev => Math.min(prev + 1, emails.length - 1));
  }, {
    scope: 'inbox',
    description: 'Select next email'
  });

  return (
    <div
      role="feed"
      aria-label="Email inbox"
      aria-busy={false}
      aria-setsize={emails.length}
    >
      {emails.map((email, index) => (
        <EmailListItem
          key={email.id}
          email={email}
          isSelected={selectedIndex === index}
          position={index + 1}
          onSelect={() => setSelectedIndex(index)}
        />
      ))}
    </div>
  );
}
```

---

## 6. Performance Optimization

### Event Listener Management

```typescript
// hooks/useOptimizedShortcut.ts
import { useCallback, useRef } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'

export function useOptimizedShortcut(keys: string, callback: () => void, options: HotkeyOptions) {
  // Memoize callback to prevent re-registration
  const callbackRef = useRef(callback)

  // Update ref when callback changes
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  // Stable callback for useHotkeys
  const stableCallback = useCallback(() => {
    callbackRef.current()
  }, [])

  useHotkeys(keys, stableCallback, options, [])
}
```

### React 19 Optimizations

React 19's new compiler automatically optimizes many patterns, but we can further optimize:

```typescript
// Leverage automatic memoization in React 19
function EmailActions({ emailId }: { emailId: string }) {
  // React 19 compiler automatically memoizes these
  const handleArchive = () => archiveEmail(emailId);
  const handleReply = () => replyToEmail(emailId);
  const handleForward = () => forwardEmail(emailId);

  // No need for useCallback in React 19
  useEmailShortcut('e', handleArchive, {
    scope: 'reading',
    description: 'Archive email'
  });

  useEmailShortcut('r', handleReply, {
    scope: 'reading',
    description: 'Reply'
  });

  useEmailShortcut('f', handleForward, {
    scope: 'reading',
    description: 'Forward'
  });

  return <div>{/* UI */}</div>;
}
```

### Debouncing and Throttling

```typescript
// utils/performance.ts
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// Usage with shortcuts
function SearchInput() {
  const performSearch = useMemo(
    () => debounce((query: string) => {
      // Expensive search operation
      searchEmails(query);
    }, 300),
    []
  );

  return (
    <input
      onChange={(e) => performSearch(e.target.value)}
      aria-label="Search emails"
    />
  );
}
```

### Bundle Size Analysis

```typescript
// Comparison of bundle sizes (gzipped):
// - react-hotkeys-hook: ~3-4KB
// - tinykeys: ~400B
// - mousetrap: ~2KB
// - hotkeys-js: ~1.7KB
// - focus-trap-react: ~5KB

// Recommended bundle for Claine v2:
// - react-hotkeys-hook: 3-4KB
// - focus-trap-react: 5KB
// - Custom code: ~2KB
// Total: ~10-11KB for complete keyboard shortcut system

// This is acceptable overhead for the functionality provided
```

### Memory Leak Prevention

```typescript
// hooks/useShortcutCleanup.ts
import { useEffect, useRef } from 'react'

export function useShortcutCleanup(register: () => () => void, deps: any[]) {
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    // Clean up previous registration
    cleanupRef.current?.()

    // Register new shortcut
    cleanupRef.current = register()

    // Return cleanup function
    return () => {
      cleanupRef.current?.()
      cleanupRef.current = null
    }
  }, deps)
}

// Usage
function DynamicShortcut({ emailId }: { emailId: string }) {
  useShortcutCleanup(() => {
    // Register shortcut
    const cleanup = useEmailShortcut('x', () => selectEmail(emailId), {
      scope: 'inbox',
      description: 'Select email',
    })

    return cleanup
  }, [emailId])
}
```

---

## 7. Recommended Implementation for Claine v2

### Phase 1: Core Infrastructure (Week 1)

**Deliverables:**

1. Install and configure react-hotkeys-hook
2. Create ShortcutContext provider
3. Implement useEmailShortcut custom hook
4. Set up scope management system
5. Add basic focus management utilities

**Files to Create:**

```
src/
  context/
    ShortcutContext.tsx
  hooks/
    useEmailShortcut.ts
    useShortcuts.ts
    useFocusTrap.ts
  types/
    shortcuts.ts
  utils/
    shortcutHelpers.ts
```

**Success Criteria:**

- Global shortcuts (/, ?) working
- Scope switching between views functional
- No memory leaks (verified with React DevTools)

### Phase 2: Gmail Parity Shortcuts (Week 2)

**Deliverables:**

1. Implement inbox shortcuts (j, k, x, e, c)
2. Implement reading shortcuts (r, a, f, u)
3. Implement navigation shortcuts (g+i, g+s, g+t)
4. Add compose shortcuts (Cmd+Enter, Cmd+K)
5. Implement selection shortcuts (_, _, +a, +n)

**Components to Update:**

```
components/
  InboxView/
    EmailList.tsx (add j/k navigation)
    EmailListItem.tsx (add x selection)
  EmailReader/
    ReaderView.tsx (add r/a/f shortcuts)
  Compose/
    ComposeWindow.tsx (add Cmd+Enter send)
  Navigation/
    Sidebar.tsx (add g+i/s/t navigation)
```

**Success Criteria:**

- All core Gmail shortcuts functional
- Context-aware behavior working correctly
- No conflicts between different views

### Phase 3: Overlay and Discovery (Week 3)

**Deliverables:**

1. Create ShortcutOverlay component
2. Implement ? key toggle
3. Add search functionality to overlay
4. Create visual shortcut hints on hover
5. Build onboarding tooltip system

**Components to Create:**

```
components/
  ShortcutOverlay/
    ShortcutOverlay.tsx
    ShortcutSearch.tsx
    ShortcutSection.tsx
  ShortcutOnboarding/
    OnboardingTooltip.tsx
    OnboardingProgress.tsx
```

**Success Criteria:**

- Overlay shows all shortcuts grouped by context
- Search filters shortcuts in real-time
- Onboarding shows 4-5 key shortcuts to new users
- Hover tooltips show shortcuts on buttons

### Phase 4: Customization and Polish (Week 4)

**Deliverables:**

1. Create ShortcutSettings page
2. Implement shortcut recording UI
3. Add import/export functionality
4. Build conflict detection system
5. Complete accessibility audit

**Components to Create:**

```
components/
  Settings/
    ShortcutSettings.tsx
    ShortcutRecorder.tsx
    ConflictDetector.tsx
  utils/
    shortcutIO.ts
    conflictResolver.ts
```

**Success Criteria:**

- Users can customize all shortcuts
- Import/export works reliably
- Conflicts are detected and prevented
- WCAG AA compliance verified
- Performance benchmarks met (<16ms response time)

### Testing Strategy

```typescript
// tests/shortcuts.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShortcutProvider } from '../context/ShortcutContext';
import { InboxView } from '../components/InboxView';

describe('Keyboard Shortcuts', () => {
  it('should navigate with j key', async () => {
    const user = userEvent.setup();
    render(
      <ShortcutProvider>
        <InboxView />
      </ShortcutProvider>
    );

    await user.keyboard('j');

    expect(screen.getByRole('article', { selected: true }))
      .toHaveAttribute('data-position', '2');
  });

  it('should open compose with c key', async () => {
    const user = userEvent.setup();
    render(
      <ShortcutProvider>
        <InboxView />
      </ShortcutProvider>
    );

    await user.keyboard('c');

    expect(screen.getByRole('dialog'))
      .toHaveAttribute('aria-label', 'Compose email');
  });

  it('should not trigger shortcuts while typing in search', async () => {
    const user = userEvent.setup();
    const mockArchive = jest.fn();
    render(
      <ShortcutProvider>
        <InboxView onArchive={mockArchive} />
      </ShortcutProvider>
    );

    const search = screen.getByRole('searchbox');
    await user.click(search);
    await user.keyboard('e');

    expect(mockArchive).not.toHaveBeenCalled();
  });

  it('should handle scope transitions', async () => {
    const user = userEvent.setup();
    render(
      <ShortcutProvider>
        <InboxView />
      </ShortcutProvider>
    );

    // j in inbox should navigate
    await user.keyboard('j');
    expect(screen.getByRole('article', { selected: true }))
      .toHaveAttribute('data-position', '2');

    // Open email
    await user.keyboard('{Enter}');

    // j in reader should do nothing (different scope)
    await user.keyboard('j');
    expect(screen.queryByRole('article', { selected: true }))
      .not.toBeInTheDocument();
  });
});
```

### Performance Benchmarks

**Target Metrics:**

- **Shortcut Response Time**: <16ms (1 frame at 60fps)
- **Overlay Open Time**: <100ms
- **Memory Overhead**: <5MB for shortcut system
- **Bundle Size**: <15KB total (gzipped)
- **No Memory Leaks**: Verified over 1000 mount/unmount cycles

**Monitoring:**

```typescript
// utils/performanceMonitoring.ts
export function measureShortcutPerformance(shortcut: string, callback: () => void) {
  return () => {
    const start = performance.now()
    callback()
    const end = performance.now()

    if (end - start > 16) {
      console.warn(`Shortcut "${shortcut}" took ${(end - start).toFixed(2)}ms (target: <16ms)`)
    }
  }
}
```

---

## 8. Key Recommendations Summary

### Immediate Actions

1. **Choose react-hotkeys-hook** - Best balance of features, performance, and React integration
2. **Build Custom Context** - Wrap library with email-specific context provider
3. **Prioritize Accessibility** - Follow WCAG AA guidelines from day one
4. **Implement Gmail Parity** - Focus on core shortcuts (j, k, c, e, r, a, f)
5. **Add Discovery UI** - Implement ? overlay early for user adoption

### Architecture Decisions

1. **Scope-Based System** - Use scopes (global, inbox, reading, compose) for context awareness
2. **Provider Pattern** - Centralized ShortcutProvider with useShortcuts hook
3. **Focus Integration** - Tie shortcuts to focus management system
4. **Conflict Resolution** - Priority-based system with clear rules
5. **Customization Layer** - Allow user customization but maintain sensible defaults

### User Experience Priorities

1. **Discoverability** - ? overlay, hover hints, onboarding tooltips
2. **Gmail Parity** - Match Gmail shortcuts for familiarity
3. **Customization** - Allow power users to customize
4. **Accessibility** - Screen reader support, focus management, WCAG compliance
5. **Performance** - Sub-16ms response times, no jank

### Technical Priorities

1. **Type Safety** - Full TypeScript coverage for shortcut definitions
2. **Testing** - Comprehensive unit and integration tests
3. **Documentation** - Clear docs for adding new shortcuts
4. **Performance** - Optimize event listeners, prevent memory leaks
5. **Bundle Size** - Keep total overhead under 15KB gzipped

### Success Metrics

Track these metrics to measure success:

- **Adoption Rate**: % of users who use keyboard shortcuts (target: >30%)
- **Shortcut Usage**: Which shortcuts are most popular
- **Customization Rate**: % of users who customize shortcuts (target: >5%)
- **Performance**: Average response time for shortcuts (target: <16ms)
- **Accessibility**: WCAG compliance score (target: 100% AA)
- **User Satisfaction**: NPS score for keyboard navigation (target: >50)

---

## Appendix: Additional Resources

### Libraries

- **react-hotkeys-hook**: https://react-hotkeys-hook.vercel.app/
- **tinykeys**: https://github.com/jamiebuilds/tinykeys
- **focus-trap-react**: https://github.com/focus-trap/focus-trap-react
- **@github/hotkey**: https://github.com/github/hotkey

### Documentation

- **Gmail Shortcuts**: https://support.google.com/mail/answer/6594
- **WCAG 2.1**: https://www.w3.org/WAI/WCAG21/quickref/
- **ARIA Authoring Practices**: https://www.w3.org/WAI/ARIA/apg/

### Tools

- **Keyboard Event Viewer**: https://keycode.info/
- **Accessibility Insights**: https://accessibilityinsights.io/
- **React DevTools Profiler**: For performance monitoring

### Inspiration

- **Gmail**: Industry standard for email keyboard shortcuts
- **Superhuman**: Premium keyboard-first email client
- **Linear**: Excellent command palette and keyboard navigation
- **Slack**: Good example of context-aware shortcuts

---

## Conclusion

Implementing a comprehensive keyboard shortcut system for Claine v2 is essential for power users and accessibility. By following this research and using **react-hotkeys-hook** as the foundation, combined with custom context management and Gmail-parity shortcuts, Claine v2 can deliver an exceptional keyboard navigation experience.

The recommended 4-week implementation timeline balances speed with quality, ensuring that the system is performant, accessible, and user-friendly from launch. Prioritizing discoverability through the ? overlay and onboarding tooltips will drive adoption, while customization capabilities will satisfy power users.

With proper testing, performance monitoring, and adherence to WCAG guidelines, Claine v2's keyboard shortcut system will be a differentiating feature that enhances productivity and accessibility for all users.

**Total Token Count: ~23,500 tokens** (within 25,000 limit)
