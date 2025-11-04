# Component Library & UI Patterns - Claine v1

## Document Overview

This document catalogs the complete UI component library, design patterns, and styling approaches in Claine Email Client v1. Created as reference material for the v2 rebuild to understand what exists, what works well, and what needs improvement.

**Source Project**: `/Users/hansnieuwenhuis/vscode/claine-rebuild/`
**Generated**: 2025-10-27
**Version**: 1.0

---

## Table of Contents

1. [Complete Component Inventory](#1-complete-component-inventory)
2. [Styling and Theming System](#2-styling-and-theming-system)
3. [Component Composition Patterns](#3-component-composition-patterns)
4. [Accessibility Features](#4-accessibility-features)
5. [Reusable Component Patterns](#5-reusable-component-patterns)
6. [Performance Considerations](#6-performance-considerations)
7. [What Works Well](#7-what-works-well)
8. [What Needs Improvement](#8-what-needs-improvement)
9. [Recommendations for V2](#9-recommendations-for-v2)

---

## 1. COMPLETE COMPONENT INVENTORY

### 1.1 Base UI Components (Shadcn/UI - 33 Components)

**Location**: `src/components/ui/`

All components built on Radix UI primitives with Tailwind CSS styling.

#### **Core Interactive Components**

| Component | File | LOC | Radix Primitive | Purpose |
|-----------|------|-----|-----------------|---------|
| **Button** | button.tsx | 60 | @radix-ui/react-slot | Primary action component with 5 variants × 4 sizes |
| **Input** | input.tsx | 22 | Native HTML | Text input with validation states |
| **Textarea** | textarea.tsx | ~30 | Native HTML | Multi-line text input |
| **Checkbox** | checkbox.tsx | 41 | @radix-ui/react-checkbox | Checkbox with indeterminate state |
| **Switch** | switch.tsx | ~40 | @radix-ui/react-switch | Toggle switch |
| **Radio Group** | radio-group.tsx | ~35 | @radix-ui/react-radio-group | Radio button group |

#### **Overlay Components**

| Component | File | LOC | Radix Primitive | Purpose |
|-----------|------|-----|-----------------|---------|
| **Dialog** | dialog.tsx | 126 | @radix-ui/react-dialog | Modal dialog with overlay |
| **Popover** | popover.tsx | ~40 | @radix-ui/react-popover | Floating popover |
| **Tooltip** | tooltip.tsx | 30 | @radix-ui/react-tooltip | Contextual tooltip |
| **Hover Card** | hover-card.tsx | - | @radix-ui/react-hover-card | Rich hover card |
| **Dropdown Menu** | dropdown-menu.tsx | 256 | @radix-ui/react-dropdown-menu | Complete dropdown system (15+ subcomponents) |

#### **Selection Components**

| Component | File | LOC | Radix Primitive | Purpose |
|-----------|------|-----|-----------------|---------|
| **Select** | select.tsx | 120+ | @radix-ui/react-select | Select dropdown |
| **Command** | command.tsx | - | cmdk | Command/search palette |

#### **Display Components**

| Component | File | LOC | Radix Primitive | Purpose |
|-----------|------|-----|-----------------|---------|
| **Card** | card.tsx | 93 | Custom | Card with 7 subcomponents |
| **Avatar** | avatar.tsx | 54 | @radix-ui/react-avatar | Avatar with image/fallback |
| **Badge** | badge.tsx | 47 | CVA-based | Inline badge |
| **Alert** | alert.tsx | 59 | CVA-based | Alert container |
| **Label** | label.tsx | ~20 | @radix-ui/react-label | Form label |
| **Separator** | separator.tsx | - | @radix-ui/react-separator | Visual divider |
| **Table** | table.tsx | - | Native HTML | Data table |

#### **Navigation Components**

| Component | File | LOC | Radix Primitive | Purpose |
|-----------|------|-----|-----------------|---------|
| **Tabs** | tabs.tsx | 53 | @radix-ui/react-tabs | Tab navigation |

#### **Feedback Components**

| Component | File | LOC | Radix Primitive | Purpose |
|-----------|------|-----|-----------------|---------|
| **Progress** | progress.tsx | ~35 | @radix-ui/react-progress | Progress bar |

#### **Custom UI Components**

| Component | File | LOC | Dependencies | Purpose |
|-----------|------|-----|--------------|---------|
| **Scroll Area** | scroll-area.tsx | - | @radix-ui/react-scroll-area | Custom scrolling with shadows |
| **Scroll to Bottom FAB** | scroll-to-bottom-fab.tsx | - | ResizeObserver | FAB with smart visibility (200px threshold) |
| **Theme Provider** | theme-provider.tsx | - | React Context | Theme management (light/dark/system) |
| **Mode Toggle** | mode-toggle.tsx | 41 | Dropdown Menu | Theme switcher |
| **Status Bar** | status-bar.tsx | - | Fixed positioning | Fixed bottom status bar (z-40) |
| **Sync Status Indicator** | sync-status-indicator.tsx | 103 | Polling | Real-time sync status (5s interval) |
| **Calendar** | calendar.tsx | - | react-day-picker | Date picker |
| **Icon Picker** | icon-picker.tsx | - | lucide-react | Icon selection interface |
| **Gmail Connector** | gmail-connector.tsx | - | GIS Auth | Gmail API integration UI |

**Total Base UI**: 33 files, ~3,160 LOC

---

### 1.2 Layout Components

**Location**: `src/components/layout/`

| Component | File | LOC | Key Features |
|-----------|------|-----|--------------|
| **Mail Layout** | mail-layout.tsx | 200+ | Main app wrapper with resizable panels (react-resizable-panels) |
| **Search Bar** | SearchBar.tsx | - | Search input with navigation |

**Layout Pattern**:
```
MailLayout (Top-level)
├── NavPanel (Left sidebar, collapsible with animation)
├── ContentPanel (Main content area, scrollable)
└── InfoPanel (Right sidebar, 40% default width)
```

**Persistence**: Panel sizes saved to localStorage

---

### 1.3 Mail-Specific Components

**Location**: `src/components/mail/`

| Component | File | Purpose |
|-----------|------|---------|
| **mail-nav.tsx** | Label list navigation |
| **nav-panel.tsx** | Navigation panel wrapper |
| **content-panel.tsx** | Thread list container |
| **mail-view.tsx** | Main mail view router |
| **thread-view.tsx** | Thread detail view |
| **info-panel.tsx** | Thread metadata/info |

---

### 1.4 Presentation Layer Components (79 Files)

**Location**: `src/presentation/components/`

#### **Thread Management (14 files)**

| Component | File | LOC | Key Features |
|-----------|------|-----|--------------|
| **Thread List** | thread/ThreadList.tsx | 260 | Virtual scrolling, keyboard shortcuts (End/Home/Ctrl+A/Esc), preload hook |
| **Thread List Item** | thread/ThreadListItem.tsx | 595 | Complex 6-column grid layout (checkbox\|unread\|sender\|subject-snippet\|attachment\|timestamp) |
| **Thread Detail** | thread/ThreadDetail.tsx | - | Full thread viewer |
| **Thread Filter Toolbar** | thread/ThreadFilterToolbarUnified.tsx | - | Global attribute filter system |
| **Thread Filter Badges** | thread/ThreadFilterBadges.tsx | - | Filter badge display |
| **Thread Faceted Filter** | thread/ThreadFacetedFilter.tsx | - | Advanced filtering UI |
| **Sender Hover Card** | thread/SenderHoverCard.tsx | - | Sender information popup |
| **Floating Action Bar** | thread/FloatingActionBar.tsx | 800+ | Fixed action bar (z-50) with navigation |

**Thread List Item Grid Layout**:
```
┌─────────┬────────┬───────────┬─────────────────────────┬────────────┬───────────┐
│ Select  │ Unread │  Sender   │   Subject + Snippet     │ Attachment │ Timestamp │
│ (24px)  │ (30px) │  (180px)  │        (1fr)           │   (30px)   │  (70px)   │
└─────────┴────────┴───────────┴─────────────────────────┴────────────┴───────────┘
```

#### **Workflow System (29 files)**

| Component | File | LOC | Dependencies | Purpose |
|-----------|------|-----|--------------|---------|
| **Flow Designer** | workflow/FlowDesigner.tsx | - | React Flow, dagre | Visual workflow builder |
| **Screen Flow Designer** | workflow/ScreenFlowDesignerDynamic.tsx | 1,113 | @xyflow/react | Main designer component |
| **Workflow Editor** | workflow/WorkflowEditor.tsx | 220+ | - | Workflow metadata editor |
| **Workflow Manager** | workflow/WorkflowManager.tsx | 992 | - | Workflow CRUD interface |
| **Screen Renderer** | workflow/ScreenRenderer.tsx | 817 | - | Dynamic form rendering |

**Node Types** (`workflow/nodes/` - 9 files):
- StartNode, EndNode
- ScreenNode, ActionNode, DecisionNode
- AssignmentNode, NavigationNode
- PlaceholderNode, PlusNode

**Edge Types** (`workflow/edges/`):
- CustomEdge, PlaceholderEdge

#### **Authentication Components (4 files)**

| Component | File | Implementation | Purpose |
|-----------|------|----------------|---------|
| **Gmail Login** | auth/GmailLogin.tsx | Basic HTML | OAuth initialization (no styled-components) |
| **GIS Gmail Login** | auth/GisGmailLogin.tsx | GIS library | Modern GIS authentication |
| **Protected Route** | auth/ProtectedRoute.tsx | React Router | Route protection wrapper |
| **Public Route** | auth/PublicRoute.tsx | React Router | Public route wrapper |

#### **Panel Components (3 files)**

| Component | File | Purpose |
|-----------|------|---------|
| **Multi Mode Panel** | panel/MultiModePanel.tsx | Tabs between Info/Workflows views |
| **Bulk Operations Panel** | panel/BulkOperationsPanel.tsx | Batch action interface |
| **Workflow Assignment Panel** | panel/WorkflowAssignmentPanel.tsx | Workflow assignment UI |

#### **Other Presentation Components**

**Categories**:
- **Sender**: SenderInfoPanel.tsx (sender statistics)
- **Label**: LabelNav.tsx, LabelSyncStatus.tsx
- **Common**: SyncStatusEnhanced.tsx (detailed sync monitor)
- **Initialization**: AppInitializer.tsx (app bootstrap)
- **Attributes**: AttributesManager.tsx (global attributes CRUD)
- **Migration**: 8 wizard components (ActiveInbox import)
- **Monitoring**: Sync and queue monitors

---

## 2. STYLING AND THEMING SYSTEM

### 2.1 Theme Architecture

**Primary Theme File**: `src/index.css` (142 lines)

**Technology Stack**:
- **Tailwind CSS v4** with `@tailwindcss/vite` plugin
- **OKLCH Color Space** for perceptually uniform colors
- **CSS Custom Properties** for semantic tokens
- **Dark Mode** via `.dark` class

#### **Color System**

**Light Mode** (Root):
```css
--primary: oklch(0.205 0 0)          /* Dark gray-blue */
--primary-foreground: oklch(0.985 0) /* Near white */
--accent: oklch(0.97 0 0)            /* Light gray */
--destructive: oklch(0.577 0.245 27.325) /* Red */
--muted: oklch(0.97 0 0)
--muted-foreground: oklch(0.455 0.005 286.375)
--card: oklch(1 0 0)                 /* White */
--border: oklch(0.918 0 0)           /* Light gray */
```

**Dark Mode** (`.dark`):
```css
--primary: oklch(0.922 0 0)        /* Light for dark bg */
--foreground: oklch(0.985 0 0)     /* White text */
--background: oklch(0.145 0 0)     /* Near black */
--accent: oklch(0.216 0 0)         /* Dark gray */
--destructive: oklch(0.701 0.217 29.234) /* Lighter red */
```

**Chart Colors** (5 colors for data visualization):
```css
--chart-1: oklch(0.686 0.195 142.495)
--chart-2: oklch(0.7 0.205 196.188)
--chart-3: oklch(0.622 0.154 254.624)
--chart-4: oklch(0.759 0.193 82.856)
--chart-5: oklch(0.809 0.188 49.201)
```

**Sidebar-Specific Tokens**:
```css
--sidebar-background: oklch(0.985 0 0)
--sidebar-foreground: oklch(0.205 0 0)
--sidebar-accent: oklch(0.97 0 0)
--sidebar-accent-foreground: oklch(0.205 0 0)
```

#### **Spacing and Sizing**

**Border Radius**:
```css
--radius: 0.625rem  /* 10px */
```

**Shadow System**:
- `shadow-xs`: Extra small
- `shadow-sm`: Small
- `shadow-md`: Medium
- `shadow-lg`: Large

**Legacy Spacing** (`styles.css`):
```css
--spacing-xs: 4px
--spacing-sm: 8px
--spacing-md: 16px
--spacing-lg: 24px
--spacing-xl: 32px
```

**Note**: Modern components use Tailwind units (p-4 = 1rem, p-6 = 1.5rem)

---

### 2.2 Component Styling Patterns

#### **Pattern 1: CVA (Class Variance Authority)**

**Example**: Button component (lines 7-36)

```typescript
import { cva, type VariantProps } from "class-variance-authority"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        destructive: "bg-destructive text-white shadow-sm hover:bg-destructive/90",
        outline: "border border-input bg-background shadow-xs hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline"
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 text-xs",
        lg: "h-10 rounded-md px-6",
        icon: "size-9"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
)
```

**Usage**:
```typescript
<Button variant="destructive" size="sm">Delete</Button>
```

**Matrix**: 5 variants × 4 sizes = 20 combinations

---

#### **Pattern 2: Direct cn() Merge**

**Example**: Input component

```typescript
import { cn } from "@/lib/utils"

<input
  className={cn(
    "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-base shadow-xs transition-colors",
    "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
    "placeholder:text-muted-foreground",
    "focus-visible:border-ring focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring/50",
    "disabled:cursor-not-allowed disabled:opacity-50",
    "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
    "dark:aria-invalid:border-destructive dark:aria-invalid:ring-destructive/40",
    "md:text-sm",
    className
  )}
/>
```

**cn() Utility** (`lib/utils.ts:6-8`):
```typescript
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

**Purpose**: Merges Tailwind classes intelligently, handling conflicts

---

#### **Pattern 3: Data Attributes for State**

**Example**: Dropdown menu item

```typescript
<DropdownMenuItem
  data-variant={variant}
  className={cn(
    "data-[variant=destructive]:text-destructive",
    "data-[variant=destructive]:focus:bg-destructive/10"
  )}
>
  {children}
</DropdownMenuItem>
```

**Benefits**:
- Clean state management
- CSS-driven styling
- No JavaScript logic needed

---

#### **Pattern 4: Radix UI Wrapper**

**Example**: Dialog component

```typescript
import * as DialogPrimitive from "@radix-ui/react-dialog"

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out",
        className
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

export { Dialog, DialogTrigger, DialogContent, ... }
```

**Pattern**:
1. Import Radix primitive
2. Export root as-is
3. Wrap subcomponents with styling
4. Use forwardRef for ref forwarding
5. Set displayName for debugging

---

### 2.3 Responsive Design

**Breakpoint Usage**:
- `sm:` - Small screens (640px+)
- `md:` - Medium screens (768px+)
- `lg:` - Large screens (1024px+)
- `xl:` - Extra large screens (1280px+)

**Example**: Dialog header (dialog.tsx:66)
```typescript
<div className="flex flex-col space-y-1.5 text-center sm:text-left">
  {/* ... */}
</div>
```

**Grid Systems**:
- Fixed column widths: `grid-cols-[24px_30px_180px_1fr_30px_70px]`
- Responsive grids: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`

---

### 2.4 Dark Mode Implementation

**Activation**: Via `dark` class on HTML root

**Storage**: Theme preference in localStorage (theme-provider.tsx:54)

**Theme Options**:
1. Light
2. Dark
3. System (follows OS preference)

**Example Styling**:
```typescript
className={cn(
  "bg-background text-foreground",
  "dark:bg-slate-900 dark:text-slate-100"
)}
```

**All components** use `dark:` prefix for dark mode variants.

---

## 3. COMPONENT COMPOSITION PATTERNS

### 3.1 Slot-based Composition

**Pattern**: Allows component to render as different elements

**Example**: Button component (lines 48-55)

```typescript
import { Slot } from "@radix-ui/react-slot"

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"

    return (
      <Comp
        data-slot="button"
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
```

**Usage**:
```typescript
<Button asChild>
  <Link to="/profile">Profile</Link>
</Button>
// Renders: <a href="/profile" className="...">Profile</a>
```

**Benefits**:
- Polymorphic components
- Styling reuse across elements
- No wrapper divs

---

### 3.2 Compound Component Pattern

**Pattern**: Related components that work together

**Example**: Card system (7 subcomponents)

```typescript
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
    <CardAction>
      <Button>Action</Button>
    </CardAction>
  </CardHeader>
  <CardContent>
    Main content here
  </CardContent>
  <CardFooter>
    Footer content
  </CardFooter>
</Card>
```

**Export Pattern**:
```typescript
export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent
}
```

**Benefits**:
- Semantic HTML structure
- Clear component relationships
- Flexible composition

---

### 3.3 Context-based State Sharing

**Example**: FloatingActionBar navigation (lines 61-73)

```typescript
const NavigationContext = React.createContext<{
  activeNavButton: string | null
  setActiveNavButton: (id: string | null) => void
}>({
  activeNavButton: null,
  setActiveNavButton: () => {}
})

function NavigationProvider({ children }: { children: React.ReactNode }) {
  const [activeNavButton, setActiveNavButton] = useState<string | null>(null)

  return (
    <NavigationContext.Provider value={{ activeNavButton, setActiveNavButton }}>
      {children}
    </NavigationContext.Provider>
  )
}

export function useNavigation() {
  const context = React.useContext(NavigationContext)
  if (!context) {
    throw new Error('useNavigation must be used within NavigationProvider')
  }
  return context
}
```

**Usage**:
```typescript
<NavigationProvider>
  <NavButton id="prev" />
  <NavButton id="next" />
</NavigationProvider>
```

---

### 3.4 Repository/Use Case Pattern

**Pattern**: Separation of data access and business logic

**Example**: ThreadList component (lines 144-146)

```typescript
const repositoryFactory = RepositoryFactory.getInstance()
const threadRepository = repositoryFactory.getThreadRepository()
const performThreadActionUseCase = new PerformThreadActionUseCase(
  threadRepository
)

// Execute use case
await performThreadActionUseCase.execute({
  threadId: thread.id,
  action: 'archive'
})
```

**Benefits**:
- Testable business logic
- Decoupled from data source
- Consistent error handling

---

## 4. ACCESSIBILITY FEATURES

### 4.1 Implemented Accessibility

| Feature | Example | File | Line | Impact |
|---------|---------|------|------|--------|
| **ARIA Labels** | `aria-label="Scroll to bottom"` | scroll-to-bottom-fab.tsx | 87 | Screen reader support |
| **ARIA Roles** | `role="alert"` | alert.tsx | 28 | Semantic meaning |
| **ARIA Invalid** | `aria-invalid:ring-destructive/20` | input.tsx | 12 | Validation feedback |
| **Screen Reader Only** | `<span className="sr-only">Close</span>` | dialog.tsx | 52 | Hidden visual content |
| **Semantic HTML** | `<h5>` for AlertTitle | alert.tsx | 39 | Document structure |
| **Focus Management** | `focus-visible:ring-ring/50` | input.tsx | 12 | Keyboard navigation |
| **Keyboard Shortcuts** | `e.key === 'End'` handler | ThreadList.tsx | 107-122 | Power user support |
| **Tab Order** | `tabIndex` attributes | Various | - | Navigation order |

### 4.2 Keyboard Shortcuts

**ThreadList** (lines 107-122):

| Key | Action |
|-----|--------|
| **End** | Select last thread |
| **Home** | Select first thread |
| **Ctrl+A** | Select all threads |
| **Escape** | Clear selection |
| **Arrow Up/Down** | Navigate threads |

**Implementation**:
```typescript
const handleKeyDown = useCallback((e: KeyboardEvent) => {
  if (e.key === 'End') {
    e.preventDefault()
    if (threads.length > 0) {
      onThreadSelect(threads[threads.length - 1])
      setSelectedThreadIds([threads[threads.length - 1].id])
    }
  } else if (e.key === 'Home') {
    e.preventDefault()
    if (threads.length > 0) {
      onThreadSelect(threads[0])
      setSelectedThreadIds([threads[0].id])
    }
  } else if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
    e.preventDefault()
    setSelectedThreadIds(threads.map(t => t.id))
  } else if (e.key === 'Escape') {
    setSelectedThreadIds([])
  }
}, [threads, onThreadSelect])
```

### 4.3 Focus Management

**Dialog Focus Trap**: Automatically traps focus within dialog (Radix UI)

**Input Focus States**:
- `focus:ring-2 focus:ring-ring`
- `focus-visible:outline-hidden`
- `focus-visible:ring-1`

**Button Focus States**:
- `focus-visible:outline-hidden`
- `focus-visible:ring-1 focus-visible:ring-ring`

### 4.4 Areas for Improvement

⚠️ **Gaps Identified**:

1. **GmailLogin.tsx**: Uses bare `<button>` without accessible naming
2. **Hover Cards**: Some lack keyboard support (ThreadListItem.tsx)
3. **Complex Modals**: May need explicit focus trap implementation
4. **Missing ARIA Descriptions**: Many interactive elements lack descriptions
5. **No Skip Links**: Missing "skip to content" links
6. **Color Contrast**: Not validated against WCAG AAA

---

## 5. REUSABLE COMPONENT PATTERNS

### 5.1 ScrollToBottomFAB Pattern

**File**: `scroll-to-bottom-fab.tsx`

**Features**:
- ResizeObserver for container size changes
- Scroll event listener with threshold (default 200px)
- Smart visibility toggle
- Remaining count badge
- Smooth scroll animation

**Interface**:
```typescript
interface ScrollToBottomFABProps {
  scrollContainerRef: React.RefObject<HTMLElement>
  threshold?: number
  showCount?: boolean
  remainingCount?: number
  className?: string
}
```

**Usage**:
```typescript
<ScrollToBottomFAB
  scrollContainerRef={scrollRef}
  threshold={200}
  showCount={true}
  remainingCount={unreadCount}
/>
```

---

### 5.2 SyncStatusIndicator Pattern

**File**: `sync-status-indicator.tsx` (103 lines)

**Features**:
- 5-second polling interval
- Online/offline event listeners
- Pending operation count
- Visual status indicator
- Cleanup on unmount

**Implementation**:
```typescript
useEffect(() => {
  const checkPendingCount = async () => {
    const count = await getPendingCount()
    setPendingCount(count)
  }

  checkPendingCount()
  const interval = setInterval(checkPendingCount, 5000)

  const handleOnline = () => setIsOnline(true)
  const handleOffline = () => setIsOnline(false)

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)

  return () => {
    clearInterval(interval)
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  }
}, [])
```

---

### 5.3 ThreadListItem Complex Layout

**File**: `thread/ThreadListItem.tsx` (595 lines)

**Grid Layout**:
```
[checkbox | unread | sender | subject-snippet | attachment | timestamp]
[  24px   |  30px  |  180px |      1fr        |    30px    |   70px   ]
```

**Features**:
- Hover state management with 200ms timeout
- Preload hook for next thread
- Sender extraction with Map for uniqueness
- Conditional rendering based on selection mode
- Hover card for sender details
- Accessibility support

**Key Pattern**: Dynamic column widths via grid template
```typescript
className="grid grid-cols-[24px_30px_180px_1fr_30px_70px]"
```

---

## 6. PERFORMANCE CONSIDERATIONS

### 6.1 React.memo Usage

**All workflow nodes** are memoized (lines 1 in each node file):
```typescript
export default memo(ScreenNode);
```

**Benefits**:
- Prevents re-renders when props unchanged
- Critical for ReactFlow performance
- Reduces reconciliation overhead

### 6.2 Performance Issues

#### **Issue 1: 5-Second Polling**
**File**: `sync-status-indicator.tsx`
```typescript
const interval = setInterval(checkPendingCount, 5000)
```
**Impact**: Continuous background activity, battery drain on mobile

#### **Issue 2: ResizeObserver**
**File**: `scroll-to-bottom-fab.tsx`
```typescript
const resizeObserver = new ResizeObserver(() => {
  checkScrollPosition()
})
```
**Impact**: Frequent callback executions on resize

#### **Issue 3: No Virtualization**
**ThreadList** renders ALL threads to DOM without windowing

**Impact**:
- 500 threads = 500 DOM nodes
- Slow scroll performance
- High memory usage

#### **Issue 4: Expensive Conversions**
**File**: `use-mail-threads.ts:42-164`
- Runs on every thread, every render
- No memoization
- Snippet selection with array sorting
- Unique sender extraction

**For 100 threads**: Takes 50-100ms

---

## 7. WHAT WORKS WELL

### 7.1 Strengths

✅ **Comprehensive Shadcn/UI Integration**
- 18+ Radix-based UI components
- Consistent styling through CVA and cn()
- Full accessibility primitives
- Production-ready components

✅ **Modern Tailwind v4 Setup**
- OKLCH color space (perceptually uniform)
- CSS custom properties for theming
- Vite-based plugin (no config file needed)
- Fast build times

✅ **Excellent Component Composition**
- Slot-based flexible API
- Compound component patterns
- Clear responsibility separation
- Reusable patterns throughout

✅ **Solid Accessibility Foundation**
- ARIA attributes in place
- Semantic HTML usage
- Focus management in most components
- Keyboard navigation support

✅ **Reusable Patterns**
- ScrollToBottomFAB with smart threshold
- SyncStatusIndicator with polling
- ThreadListItem with complex grid system
- Context-based state sharing

✅ **Clean Architecture**
- Repository pattern for data access
- Use case classes for business logic
- Proper separation of concerns
- Testable components

✅ **Developer Experience**
- TypeScript throughout
- Logger utility for debugging
- Debug panel toggle (localStorage)
- Component displayName for React DevTools

---

## 8. WHAT NEEDS IMPROVEMENT

### 8.1 Critical Issues

❌ **Inconsistent Styling Approaches**
- Two CSS files: `index.css` (modern) + `styles.css` (legacy)
- Mix of inline styles and Tailwind classes
- Some hardcoded colors instead of theme tokens
- **Example**: StartNode.tsx uses inline styles
- **Example**: SyncStatusIndicator.tsx uses "text-blue-500" instead of semantic token

❌ **Accessibility Gaps**
- Basic GmailLogin.tsx has no semantic structure
- Some hover interactions lack keyboard support
- Focus traps not implemented in complex modals
- Missing `data-testid` consistency for testing
- No ARIA live regions for dynamic content

❌ **Component Library Organization**
- No clear export structure (no index.ts files)
- Presentation components mixed with business logic
- Some components exceed 500+ lines (ThreadListItem: 595, FloatingActionBar: 800+)
- No component documentation
- No Storybook or visual regression testing

❌ **Theme Token Usage**
- Not all components use semantic color tokens
- Hard-coded colors in multiple places
- Inconsistent spacing units (Tailwind vs CSS vars)
- No design tokens reference guide

❌ **Performance Concerns**
- ThreadList polling at 5s interval (SyncStatusIndicator)
- ResizeObserver on scroll container (ScrollToBottomFAB)
- No virtualization in large lists
- No memoization of expensive computations
- Large components (595 lines) without splitting

❌ **Type Safety**
- Some `any` types in legacy presentation components
- Prop spreading without validation
- Missing stricter TypeScript settings
- No prop type documentation

❌ **Documentation**
- No Storybook setup
- Missing component prop documentation
- No design tokens reference guide
- No component usage examples

---

## 9. RECOMMENDATIONS FOR V2

### 9.1 Priority 1: Consolidate Styling

**Action Items**:
1. Migrate all styles to modern Tailwind v4
2. Remove `styles.css` legacy CSS
3. Create theme token system with semantic naming
4. Standardize color token usage across all components
5. Document design tokens

**Example Token System**:
```typescript
// tokens.ts
export const tokens = {
  colors: {
    primary: 'var(--primary)',
    destructive: 'var(--destructive)',
    success: 'var(--success)',
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
  }
}
```

---

### 9.2 Priority 2: Reorganize Component Structure

**Proposed Structure**:
```
src/components/
├── ui/                 (base UI components from shadcn)
│   ├── button/
│   │   ├── button.tsx
│   │   ├── button.test.tsx
│   │   └── button.stories.tsx
│   └── index.ts        (barrel exports)
├── layout/             (layout wrappers)
│   ├── mail-layout/
│   │   ├── mail-layout.tsx
│   │   ├── mail-layout.test.tsx
│   │   └── mail-layout.stories.tsx
│   └── index.ts
├── composition/        (compound components)
│   ├── card/
│   │   ├── card.tsx
│   │   ├── card-header.tsx
│   │   ├── card-content.tsx
│   │   ├── card-footer.tsx
│   │   └── index.ts
│   └── index.ts
└── hooks/              (reusable hooks)
    ├── use-theme.ts
    ├── use-scroll-to-bottom.ts
    └── index.ts

src/presentation/
├── components/
│   ├── thread/
│   │   ├── thread-list/
│   │   │   ├── thread-list.tsx
│   │   │   ├── thread-list-item.tsx
│   │   │   ├── use-thread-list.ts
│   │   │   └── index.ts
│   │   └── index.ts
│   ├── workflow/
│   │   ├── designer/
│   │   ├── nodes/
│   │   ├── edges/
│   │   └── index.ts
│   └── index.ts
├── hooks/              (presentation hooks)
└── context/            (React Context providers)
```

**Benefits**:
- Clear boundaries
- Easy to find components
- Co-located tests and stories
- Barrel exports for clean imports

---

### 9.3 Priority 3: Split Large Components

**ThreadListItem** (595 lines) → Split into:
1. `ThreadListItem` (container)
2. `ThreadCheckbox` (selection)
3. `ThreadSender` (sender display)
4. `ThreadSubject` (subject + snippet)
5. `ThreadMetadata` (attachment + timestamp)

**FloatingActionBar** (800+ lines) → Split into:
1. `FloatingActionBar` (container)
2. `ActionButtons` (action handlers)
3. `NavigationButtons` (navigation)
4. `NavigationProvider` (context)

**Workflow Nodes** → Common wrapper + type-specific variants:
```typescript
// BaseNode.tsx
export function BaseNode({ children, ...props }) {
  return (
    <div className="node-base">
      {children}
    </div>
  )
}

// ScreenNode.tsx
export const ScreenNode = memo((props) => (
  <BaseNode {...props}>
    <ScreenNodeContent {...props} />
  </BaseNode>
))
```

---

### 9.4 Priority 4: Improve Accessibility

**Action Items**:
1. Add Radix Dialog focus traps to all modals
2. Implement keyboard navigation for all interactions
3. Standardize ARIA naming patterns
4. Add ARIA live regions for dynamic content
5. Validate color contrast (WCAG AAA)
6. Add skip links for main content
7. Test with screen readers (NVDA, JAWS)

**Example Focus Trap**:
```typescript
<Dialog>
  <DialogContent onOpenAutoFocus={(e) => {
    // Focus first input on open
    const firstInput = e.currentTarget.querySelector('input')
    firstInput?.focus()
  }}>
    {/* Content */}
  </DialogContent>
</Dialog>
```

---

### 9.5 Priority 5: Performance Optimization

**Action Items**:
1. Virtualize large lists with `react-virtual`
2. Memoize expensive renders with `React.memo`
3. Debounce sync polling (5s → 10s or on-demand)
4. Lazy load workflow designer
5. Code split routes
6. Optimize images (use WebP, lazy load)
7. Implement performance monitoring

**Example Virtualization**:
```typescript
import { useVirtualizer } from '@tanstack/react-virtual'

function ThreadList({ threads }) {
  const parentRef = useRef(null)

  const virtualizer = useVirtualizer({
    count: threads.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64, // Thread height
    overscan: 5
  })

  return (
    <div ref={parentRef} style={{ height: '100vh', overflow: 'auto' }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map(virtualItem => (
          <ThreadListItem
            key={threads[virtualItem.index].id}
            thread={threads[virtualItem.index]}
            style={{
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`
            }}
          />
        ))}
      </div>
    </div>
  )
}
```

---

### 9.6 Priority 6: Add Documentation

**Action Items**:
1. Set up Storybook for component library
2. Create design token documentation
3. Add prop documentation with TypeScript
4. Write composition pattern guide
5. Create accessibility guidelines
6. Document keyboard shortcuts
7. Add visual regression testing

**Example Storybook Story**:
```typescript
// button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react'
import { Button } from './button'

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  parameters: {
    docs: {
      description: {
        component: 'Primary action component with multiple variants and sizes.'
      }
    }
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link']
    },
    size: {
      control: 'select',
      options: ['default', 'sm', 'lg', 'icon']
    }
  }
}

export default meta
type Story = StoryObj<typeof Button>

export const Default: Story = {
  args: {
    children: 'Button',
    variant: 'default',
    size: 'default'
  }
}

export const AllVariants: Story = {
  render: () => (
    <div className="flex gap-2">
      <Button variant="default">Default</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="outline">Outline</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="ghost">Ghost</Button>
      <Button variant="link">Link</Button>
    </div>
  )
}
```

---

## Conclusion

The Claine v1 component library demonstrates **solid fundamentals** with comprehensive Shadcn/UI integration, modern Tailwind v4, and good accessibility practices. However, it shows signs of **rapid iteration** with:

- Inconsistent styling approaches (2 CSS systems)
- Some accessibility gaps
- Components that have grown too large (595+ lines)
- Missing documentation and testing infrastructure

For v2, focus on:
1. **Consolidating patterns** (single CSS system)
2. **Splitting complex components** (< 300 lines each)
3. **Documenting the design system** (Storybook + guidelines)
4. **Improving accessibility** (WCAG AAA compliance)
5. **Optimizing performance** (virtualization, memoization)

The foundation is strong - with targeted improvements, v2 can have a **world-class component library**.

---

**Document Version**: 1.0
**Generated**: 2025-10-27
**Total Components Documented**: 112+
**Total Patterns Documented**: 15+

---
