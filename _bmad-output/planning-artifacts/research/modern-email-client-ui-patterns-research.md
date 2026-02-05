# Modern Email Client UI Patterns: Research for Claine v2

**Research Date:** October 2024
**Target Stack:** React 19, React Router 7.4.0, Shadcn/UI, Tailwind CSS v4 with OKLCH
**Primary Goal:** Sub-millisecond navigation with modern UX patterns

---

## Executive Summary

### Key Trends in 2024-2025 Email Clients

Modern email clients are converging around several core design principles and features:

1. **Speed as a Feature**: Superhuman has set the bar with sub-100ms interactions through advanced caching, server-side optimizations, and keyboard-first design. Speed is no longer just a technical requirement—it's a core UX differentiator.

2. **AI-Native Interfaces**: Email summarization, smart replies, and AI-powered prioritization have moved from experimental to expected. Leading implementations (Apple Intelligence, Google Gemini, Superhuman AI) integrate AI contextually through sidebar patterns rather than replacing core workflows.

3. **Command Palette Dominance**: The ⌘K pattern has become standard for power users. Expect keyboard shortcuts to be comprehensive, learnable, and accessible through a searchable command interface.

4. **Mobile-First Reality**: 71.5% of email is consumed on mobile devices. Swipe gestures (archive, delete, snooze) and responsive layouts are mandatory, not optional.

5. **Simplified Visual Design**: The trend is toward minimalism with generous whitespace, clear visual hierarchy, and reduced chrome. Users want to focus on content, not UI.

6. **Flexible Layout Options**: Users expect to customize their reading pane position (right, bottom, hidden) and view density (compact, single, preview) based on their workflow and screen size.

### Critical Performance Targets

Based on industry benchmarks:

- **Initial load**: < 1 second
- **Navigation between emails**: < 100ms (Superhuman standard)
- **Search results**: < 200ms
- **Compose window open**: < 150ms
- **Keyboard shortcut response**: < 50ms

---

## 1. Modern Email Client UI Layouts

### Three-Pane Layout: The Industry Standard

The three-pane interface remains dominant across all major email clients (Gmail, Outlook, Apple Mail, Superhuman, Hey.com). The typical structure:

```
┌─────────────┬──────────────┬─────────────────────┐
│   Sidebar   │  Email List  │   Reading Pane     │
│  (Folders/  │  (Inbox)     │   (Email Content)  │
│   Labels)   │              │                     │
│             │              │                     │
└─────────────┴──────────────┴─────────────────────┘
```

#### Best Practices for Layout Configuration

**Reading Pane Positioning:**

- **Right (Default for widescreen)**: Optimal for monitors > 1920px width
  - Shows more emails in list (15-20 visible)
  - Natural left-to-right reading flow
  - Used by: Gmail (web), Superhuman, Outlook (default)

- **Bottom**: Better for smaller screens (1280-1600px)
  - More horizontal space for email content
  - Easier to scan subject lines
  - Better for portrait-oriented content

- **Hidden**: For focused, inbox-zero workflows
  - Maximizes email list view (30+ emails visible)
  - Opens emails in full-screen or modal
  - Used by: Apple Mail (optional), Hey.com

**Responsive Breakpoints:**

```css
/* Desktop: Three-pane */
@media (min-width: 1024px) { ... }

/* Tablet: Two-pane (sidebar + list, or list + reading) */
@media (min-width: 768px) and (max-width: 1023px) { ... }

/* Mobile: Single pane with navigation */
@media (max-width: 767px) { ... }
```

### Two-Pane Layouts: Emerging Patterns

**Hey.com's Innovative Approach:**

- Abandons traditional folder structure
- Uses three primary views: Imbox (important), Feed (newsletters), Paper Trail (receipts/notifications)
- Emphasizes screening new senders (Gatekeeper feature)
- Full-width reading experience

**Mobile-Native Pattern:**

- Gmail mobile: List view → Full-screen reading view
- Swipe gestures replace right-click menus
- Bottom navigation bar with compose, search, menu

### Adaptive Layout Recommendations for Claine v2

```tsx
// Layout system with user preference storage
interface LayoutConfig {
  readingPanePosition: 'right' | 'bottom' | 'hidden'
  sidebarWidth: number
  listWidth: number
  density: 'compact' | 'comfortable' | 'spacious'
}

// Shadcn/UI ResizablePanelGroup implementation
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'

;<ResizablePanelGroup direction="horizontal">
  <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
    <Sidebar />
  </ResizablePanel>
  <ResizableHandle />
  <ResizablePanel defaultSize={35} minSize={25}>
    <EmailList />
  </ResizablePanel>
  <ResizableHandle />
  <ResizablePanel defaultSize={45} minSize={35}>
    <ReadingPane />
  </ResizablePanel>
</ResizablePanelGroup>
```

**Key Features to Implement:**

- User-resizable panel widths (persist to localStorage)
- Keyboard shortcuts to toggle panes (⌘/ for sidebar, ⌘. for reading pane)
- Responsive collapse logic based on viewport width
- View density presets affecting padding, font size, and line height

---

## 2. Navigation Patterns

### Keyboard Shortcuts: Gmail-Style J/K Navigation

The J/K navigation pattern (from Vim) is now ubiquitous in email clients:

**Core Navigation Shortcuts:**

```
j / ↓     - Next email (move down)
k / ↑     - Previous email (move up)
Enter     - Open selected email
u         - Return to list
[         - Archive and previous
]         - Archive and next
#         - Delete
e         - Archive
s         - Star/flag
```

**Implementation with Shadcn/UI:**

```tsx
import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

function useEmailKeyboardNavigation(emails: Email[], currentIndex: number) {
  const navigate = useNavigate()

  useEffect(() => {
    function handleKeyPress(e: KeyboardEvent) {
      // Ignore if user is typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      switch (e.key) {
        case 'j':
        case 'ArrowDown':
          e.preventDefault()
          const nextEmail = emails[currentIndex + 1]
          if (nextEmail) navigate(`/email/${nextEmail.id}`)
          break

        case 'k':
        case 'ArrowUp':
          e.preventDefault()
          const prevEmail = emails[currentIndex - 1]
          if (prevEmail) navigate(`/email/${prevEmail.id}`)
          break

        case 'Enter':
          e.preventDefault()
          const email = emails[currentIndex]
          navigate(`/email/${email.id}/full`)
          break

        case 'u':
          e.preventDefault()
          navigate('/inbox')
          break
      }
    }

    document.addEventListener('keydown', handleKeyPress)
    return () => document.removeEventListener('keydown', handleKeyPress)
  }, [emails, currentIndex, navigate])
}
```

### Command Palette (⌘K): The New Standard

Command palettes have become expected functionality, popularized by Slack, Linear, and Superhuman.

**Key Characteristics:**

- Invoked with ⌘K (Mac) or Ctrl+K (Windows/Linux)
- Fuzzy search across commands, emails, contacts
- Contextual actions based on current view
- Keyboard-navigable with arrow keys and Enter

**Implementation with Shadcn/UI Command Component:**

```tsx
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'

function CommandPalette() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Actions">
          <CommandItem>
            <Mail className="mr-2 h-4 w-4" />
            <span>Compose New Email</span>
            <CommandShortcut>⌘N</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <Archive className="mr-2 h-4 w-4" />
            <span>Archive Current Email</span>
            <CommandShortcut>E</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <Clock className="mr-2 h-4 w-4" />
            <span>Snooze Email</span>
            <CommandShortcut>H</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => navigate('/inbox')}>
            <Inbox className="mr-2 h-4 w-4" />
            <span>Go to Inbox</span>
            <CommandShortcut>G I</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => navigate('/sent')}>
            <Send className="mr-2 h-4 w-4" />
            <span>Go to Sent</span>
            <CommandShortcut>G S</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Recent Emails">
          {recentEmails.map((email) => (
            <CommandItem key={email.id} onSelect={() => navigate(`/email/${email.id}`)}>
              <Mail className="mr-2 h-4 w-4" />
              <span>{email.subject}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
```

**Command Categories for Email Client:**

1. **Actions** (on current email or selection)
   - Archive, Delete, Mark as Read/Unread, Star, Move to Folder, Snooze, Reply, Forward

2. **Navigation** (with "Go to" pattern)
   - Inbox, Sent, Drafts, Starred, Trash, specific folders/labels

3. **Composition**
   - New email, Reply, Reply All, Forward, Insert template

4. **Search & Filter**
   - Search emails, Search contacts, Filter by sender, Filter by label

5. **Settings & Preferences**
   - Change theme, Adjust density, Toggle reading pane, Keyboard shortcuts help

### Quick Actions and Hover States

**Best Practices from Industry Leaders:**

**Superhuman's Hover Actions:**

- Actions appear on hover without shifting layout
- Semi-transparent overlay on email row
- Icons fade in with 150ms transition
- Actions: Archive, Snooze, Mark Done, Remind, Move

**Gmail's Action Pattern:**

- Checkbox for selection (always visible on mobile)
- Actions appear on hover (desktop only)
- Right-aligned: Archive, Delete, Mark as Read, Snooze, Move

**Implementation Pattern:**

```tsx
// Email list item with hover actions
<div className="group relative flex items-center gap-4 px-4 py-3 hover:bg-accent transition-colors">
  <Checkbox className="opacity-0 group-hover:opacity-100 transition-opacity" />

  <div className="flex-1">
    <div className="font-semibold">{email.from}</div>
    <div className="text-sm text-muted-foreground">{email.subject}</div>
  </div>

  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
    <Button variant="ghost" size="icon" onClick={handleArchive}>
      <Archive className="h-4 w-4" />
    </Button>
    <Button variant="ghost" size="icon" onClick={handleSnooze}>
      <Clock className="h-4 w-4" />
    </Button>
    <Button variant="ghost" size="icon" onClick={handleDelete}>
      <Trash className="h-4 w-4" />
    </Button>
  </div>
</div>
```

### Gesture Controls: Mobile-First Interactions

**Standard Swipe Patterns (2024):**

**Left Swipe:**

- Gmail: Archive
- Apple Mail: Flag or Move to Trash (configurable)
- Spark: Swipe partway = Archive, Swipe fully = Delete

**Right Swipe:**

- Gmail: Mark as Read/Unread
- Apple Mail: Mark as Read
- Spark: Snooze

**Implementation with React:**

```tsx
import { useSwipeable } from 'react-swipeable'

function EmailListItem({ email, onArchive, onSnooze }) {
  const [swipeState, setSwipeState] = useState<'idle' | 'archive' | 'snooze'>('idle')
  const [swipeX, setSwipeX] = useState(0)

  const handlers = useSwipeable({
    onSwiping: (eventData) => {
      const { deltaX } = eventData
      setSwipeX(deltaX)

      if (deltaX < -80) setSwipeState('archive')
      else if (deltaX > 80) setSwipeState('snooze')
      else setSwipeState('idle')
    },
    onSwiped: (eventData) => {
      if (swipeState === 'archive') onArchive(email.id)
      else if (swipeState === 'snooze') onSnooze(email.id)

      setSwipeState('idle')
      setSwipeX(0)
    },
    trackMouse: false,
    trackTouch: true,
  })

  return (
    <div {...handlers} className="relative overflow-hidden">
      {/* Background actions */}
      <div className="absolute inset-0 flex justify-between items-center px-4">
        <div
          className={cn(
            'flex items-center gap-2 text-blue-600 transition-opacity',
            swipeState === 'snooze' ? 'opacity-100' : 'opacity-0'
          )}
        >
          <Clock className="h-5 w-5" />
          <span>Snooze</span>
        </div>
        <div
          className={cn(
            'flex items-center gap-2 text-green-600 transition-opacity',
            swipeState === 'archive' ? 'opacity-100' : 'opacity-0'
          )}
        >
          <span>Archive</span>
          <Archive className="h-5 w-5" />
        </div>
      </div>

      {/* Email content - slides with swipe */}
      <div
        className="relative bg-background transition-transform"
        style={{ transform: `translateX(${swipeX}px)` }}
      >
        {/* Email content here */}
      </div>
    </div>
  )
}
```

---

## 3. Reading Experience

### Thread Conversation View

**Design Patterns (2024):**

**Gmail's Approach:**

- All messages in thread shown vertically
- Older messages collapsed by default
- "X older messages" expandable line
- Newest message always visible at bottom
- Unread messages have bold headers

**Superhuman's Enhancement:**

- Every conversation gets a 1-line AI summary at top
- Summary updates in real-time as new emails arrive
- Collapsed messages show first line preview
- Smooth expand/collapse animations

**Slack's Threaded Conversation Learning:**

- Threads shown in sidebar "flex pane" rather than inline
- Preserves context while showing thread detail
- Click thread → opens in side panel
- Can keep main view and thread view open simultaneously

**Implementation Pattern:**

```tsx
interface ThreadView {
  summary: string // AI-generated
  messages: Message[]
  totalCount: number
  unreadCount: number
}

function EmailThread({ thread }: { thread: ThreadView }) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  // Auto-expand unread and latest message
  useEffect(() => {
    const toExpand = new Set<string>()

    // Always expand latest message
    if (thread.messages.length > 0) {
      toExpand.add(thread.messages[thread.messages.length - 1].id)
    }

    // Expand all unread messages
    thread.messages.forEach((msg) => {
      if (!msg.isRead) toExpand.add(msg.id)
    })

    setExpandedIds(toExpand)
  }, [thread])

  const toggleMessage = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {/* AI Summary at top */}
      {thread.summary && (
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-2">
              <Sparkles className="h-4 w-4 mt-0.5 text-primary" />
              <p className="text-sm">{thread.summary}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Collapsed message indicator */}
      {thread.totalCount > 2 && (
        <Button
          variant="ghost"
          className="text-sm text-muted-foreground"
          onClick={() => {
            // Expand all messages
            setExpandedIds(new Set(thread.messages.map((m) => m.id)))
          }}
        >
          {thread.totalCount - expandedIds.size} older messages
        </Button>
      )}

      {/* Message list */}
      {thread.messages.map((message) => {
        const isExpanded = expandedIds.has(message.id)

        return (
          <Card key={message.id} className={cn(!message.isRead && 'border-l-4 border-l-primary')}>
            <CardHeader
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => toggleMessage(message.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className={cn('text-base', !message.isRead && 'font-bold')}>
                      {message.from.name}
                    </CardTitle>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(message.date)}
                    </span>
                  </div>
                  {!isExpanded && (
                    <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                      {message.preview}
                    </p>
                  )}
                </div>
                <ChevronDown
                  className={cn('h-4 w-4 transition-transform', isExpanded && 'rotate-180')}
                />
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent>
                <div
                  className="prose prose-sm dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(message.body) }}
                />

                {message.attachments.length > 0 && (
                  <div className="mt-4 space-y-2">
                    {message.attachments.map((att) => (
                      <AttachmentPreview key={att.id} attachment={att} />
                    ))}
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        )
      })}
    </div>
  )
}
```

### Image Loading Strategies

**Best Practices (2024):**

1. **Lazy Loading with Intersection Observer**

```tsx
function EmailImage({ src, alt }: { src: string; alt: string }) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [shouldLoad, setShouldLoad] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    if (!imgRef.current) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true)
          observer.disconnect()
        }
      },
      { rootMargin: '50px' } // Start loading 50px before visible
    )

    observer.observe(imgRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="relative">
      {!isLoaded && <Skeleton className="absolute inset-0" />}
      <img
        ref={imgRef}
        src={shouldLoad ? src : undefined}
        alt={alt}
        onLoad={() => setIsLoaded(true)}
        className={cn('transition-opacity duration-300', isLoaded ? 'opacity-100' : 'opacity-0')}
      />
    </div>
  )
}
```

2. **Privacy-First Loading**

- Load images through proxy to prevent tracking pixels
- Show "Load Images" button for external images (Gmail pattern)
- Automatically load from trusted senders

3. **Responsive Image Sizing**

- Constrain max-width to reading pane width
- Use `object-fit: contain` for oversized images
- Provide click-to-expand lightbox for images

### Dark Mode Optimizations

**Color Strategies for Email Content:**

**Problem**: HTML emails use hardcoded colors that break in dark mode

**Solutions:**

1. **Content Inversion (Gmail approach)**

```css
/* Invert light backgrounds to dark */
@media (prefers-color-scheme: dark) {
  .email-content {
    filter: invert(1) hue-rotate(180deg);
  }

  .email-content img {
    filter: invert(1) hue-rotate(180deg);
  }
}
```

2. **Intelligent Color Remapping (Superhuman approach)**

- Parse HTML and remap common colors
- #000000 → var(--foreground)
- #FFFFFF → var(--background)
- Preserve brand colors and images

3. **OKLCH Color System Benefits**

```css
/* Tailwind CSS v4 with OKLCH provides perceptual uniformity */
:root {
  --background: oklch(100% 0 0); /* Pure white */
  --foreground: oklch(20% 0 0); /* Near black */
}

[data-theme='dark'] {
  --background: oklch(20% 0 0); /* Dark background */
  --foreground: oklch(95% 0 0); /* Light text */
}

/* Benefits: */
/* - Consistent perceived brightness across hues */
/* - Better color interpolation for gradients */
/* - Easier to create accessible contrast ratios */
```

**Dark Mode Best Practices:**

- Avoid pure black (#000000) - use oklch(15% 0 0) instead
- Avoid pure white (#FFFFFF) - use oklch(95% 0 0) instead
- Reduce contrast slightly (AA instead of AAA) to reduce eye strain
- Test with `prefers-contrast: high` for accessibility

### Typography and Readability

**Optimal Reading Settings:**

```css
.email-content {
  /* Font family */
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;

  /* Line height for readability */
  line-height: 1.6;

  /* Optimal line length (50-75 characters) */
  max-width: 65ch;

  /* Font size */
  font-size: 16px; /* Never go below 16px */

  /* Letter spacing for screen reading */
  letter-spacing: 0.01em;

  /* Paragraph spacing */
  p + p {
    margin-top: 1em;
  }
}

/* Responsive font scaling */
@media (max-width: 768px) {
  .email-content {
    font-size: 17px; /* Slightly larger on mobile */
  }
}
```

**Headings in Email Content:**

```css
.email-content {
  h1,
  h2,
  h3 {
    line-height: 1.2;
    font-weight: 600;
    margin-top: 1.5em;
    margin-bottom: 0.5em;
  }

  h1 {
    font-size: 1.875rem;
  }
  h2 {
    font-size: 1.5rem;
  }
  h3 {
    font-size: 1.25rem;
  }
}
```

### Attachment Previews

**Modern Attachment UI Patterns:**

```tsx
interface Attachment {
  id: string
  name: string
  size: number
  type: string
  url: string
  thumbnailUrl?: string
}

function AttachmentPreview({ attachment }: { attachment: Attachment }) {
  const { name, size, type, thumbnailUrl } = attachment

  // Determine icon based on MIME type
  const icon = getFileIcon(type)
  const isImage = type.startsWith('image/')
  const isPdf = type === 'application/pdf'
  const isPreviewable = isImage || isPdf

  return (
    <Card className="group hover:border-primary transition-colors cursor-pointer">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          {/* Thumbnail or icon */}
          <div className="shrink-0">
            {thumbnailUrl ? (
              <img src={thumbnailUrl} alt={name} className="w-12 h-12 rounded object-cover" />
            ) : (
              <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                {icon}
              </div>
            )}
          </div>

          {/* File info */}
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{name}</p>
            <p className="text-sm text-muted-foreground">{formatFileSize(size)}</p>
          </div>

          {/* Actions */}
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {isPreviewable && (
              <Button variant="ghost" size="icon" onClick={handlePreview}>
                <Eye className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={handleDownload}>
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Common file types with icons
function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return <ImageIcon className="h-6 w-6" />
  if (mimeType.startsWith('video/')) return <Video className="h-6 w-6" />
  if (mimeType === 'application/pdf') return <FileText className="h-6 w-6" />
  if (mimeType.includes('word')) return <FileText className="h-6 w-6" />
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return <Table className="h-6 w-6" />
  if (mimeType.includes('zip') || mimeType.includes('archive'))
    return <Archive className="h-6 w-6" />
  return <File className="h-6 w-6" />
}
```

**Drag & Drop Best Practices:**

- Show clear visual feedback on drag over
- Animate preview position as user drags
- Support multi-file selection
- Show progress during upload
- Allow removal before sending

---

## 4. Composition UI

### Modal vs Inline vs Full-Screen Composition

**Industry Patterns (2024):**

| Pattern             | Used By                     | Best For                               | Pros                                   | Cons                                |
| ------------------- | --------------------------- | -------------------------------------- | -------------------------------------- | ----------------------------------- |
| **Modal**           | Superhuman, Spark           | Quick replies, maintaining context     | Keeps inbox visible, easy to reference | Limited space, can feel cramped     |
| **Inline**          | Gmail (reply), Outlook      | Threading, conversational replies      | Clear connection to original, compact  | Only works for replies, not compose |
| **Full-Screen**     | Apple Mail, Gmail (compose) | Long-form emails, formal messages      | Maximum space, minimal distraction     | Loses inbox context                 |
| **Floating Window** | Gmail (popout), Outlook     | Multi-tasking, reference while writing | Can reference multiple emails          | Window management complexity        |

**Recommended Pattern for Claine v2:**

**Adaptive Modal with Expansion:**

```tsx
function ComposeModal({ isOpen, onClose, replyTo }: ComposeModalProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={cn(
          'transition-all duration-300',
          isExpanded ? 'max-w-screen h-screen m-0 rounded-none' : 'max-w-2xl'
        )}
      >
        <DialogHeader className="flex-row items-center justify-between space-y-0">
          <DialogTitle>{replyTo ? `Reply to ${replyTo.from}` : 'New Message'}</DialogTitle>

          <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={() => setIsExpanded(!isExpanded)}>
              {isExpanded ? <Minimize2 /> : <Maximize2 />}
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-4">
          {/* Compose form */}
          <ComposeForm replyTo={replyTo} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

**Keyboard Shortcut to Invoke:**

- `c` or `n` - New message
- `r` - Reply
- `a` - Reply all
- `f` - Forward
- `Esc` - Minimize (don't close, save as draft)
- `⌘+Shift+F` - Toggle full-screen

### Rich Text Editor Options

**Top Choices for React (2024):**

1. **TinyMCE** (Recommended for email)
   - Best for email composition
   - Built-in email-specific features
   - Inline CSS generation for email compatibility
   - Accessibility checking
   - Image compression and optimization
   - Template support

2. **Lexical** (Facebook/Meta)
   - Modern, extensible
   - Excellent performance
   - Collaborative editing ready
   - More complex to configure

3. **Tiptap** (Based on ProseMirror)
   - Great DX with React
   - Modular extensions
   - Good for custom needs
   - Headless (works well with Shadcn/UI)

**Example: Minimal Email Editor with Tiptap**

```tsx
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'

function EmailEditor({
  content,
  onChange,
  placeholder = 'Type your message...',
}: EmailEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
      }),
      Image.configure({
        inline: true,
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
  })

  if (!editor) return null

  return (
    <div className="border rounded-lg">
      {/* Toolbar */}
      <div className="flex gap-1 p-2 border-b bg-muted/30">
        <Toggle
          pressed={editor.isActive('bold')}
          onPressedChange={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </Toggle>
        <Toggle
          pressed={editor.isActive('italic')}
          onPressedChange={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </Toggle>
        <Toggle
          pressed={editor.isActive('bulletList')}
          onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-4 w-4" />
        </Toggle>
        <Toggle
          pressed={editor.isActive('orderedList')}
          onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-4 w-4" />
        </Toggle>

        <Separator orientation="vertical" className="mx-1" />

        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const url = window.prompt('Enter URL:')
            if (url) editor.chain().focus().setLink({ href: url }).run()
          }}
        >
          <Link2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={handleImageUpload}>
          <ImageIcon className="h-4 w-4" />
        </Button>
      </div>

      {/* Editor content */}
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none p-4 min-h-[200px] focus:outline-none"
      />
    </div>
  )
}
```

### Recipient Autocomplete

**Best Practice Pattern:**

```tsx
import { Command, CommandInput, CommandList, CommandItem } from '@/components/ui/command'
import { Badge } from '@/components/ui/badge'

interface Recipient {
  email: string
  name?: string
  avatarUrl?: string
}

function RecipientInput({ value, onChange, placeholder = 'To' }: RecipientInputProps) {
  const [inputValue, setInputValue] = useState('')
  const [suggestions, setSuggestions] = useState<Recipient[]>([])
  const [selectedRecipients, setSelectedRecipients] = useState<Recipient[]>(value || [])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (inputValue.length > 1) {
        const results = await searchContacts(inputValue)
        setSuggestions(results)
      } else {
        setSuggestions([])
      }
    }, 150)

    return () => clearTimeout(timer)
  }, [inputValue])

  const addRecipient = (recipient: Recipient) => {
    const updated = [...selectedRecipients, recipient]
    setSelectedRecipients(updated)
    onChange(updated)
    setInputValue('')
    setSuggestions([])
  }

  const removeRecipient = (index: number) => {
    const updated = selectedRecipients.filter((_, i) => i !== index)
    setSelectedRecipients(updated)
    onChange(updated)
  }

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-2 p-2 border rounded-md min-h-[42px]">
        {selectedRecipients.map((recipient, index) => (
          <Badge key={index} variant="secondary" className="gap-1">
            {recipient.name || recipient.email}
            <X className="h-3 w-3 cursor-pointer" onClick={() => removeRecipient(index)} />
          </Badge>
        ))}

        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder={selectedRecipients.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[120px] outline-none bg-transparent"
        />
      </div>

      {suggestions.length > 0 && (
        <Card className="absolute top-full left-0 right-0 mt-1 z-50 max-h-[300px] overflow-auto">
          <Command>
            <CommandList>
              {suggestions.map((suggestion) => (
                <CommandItem
                  key={suggestion.email}
                  onSelect={() => addRecipient(suggestion)}
                  className="flex items-center gap-2"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={suggestion.avatarUrl} />
                    <AvatarFallback>{suggestion.name?.[0] || suggestion.email[0]}</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{suggestion.name}</div>
                    <div className="text-sm text-muted-foreground">{suggestion.email}</div>
                  </div>
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </Card>
      )}
    </div>
  )
}
```

### Scheduling and Send Later

**UI Pattern (Superhuman/Gmail approach):**

```tsx
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

function SendLaterButton({ onSchedule }: { onSchedule: (date: Date) => void }) {
  const [date, setDate] = useState<Date>()
  const [time, setTime] = useState('09:00')

  const quickOptions = [
    { label: 'Tomorrow morning', hours: 24 + 9 },
    { label: 'Tomorrow afternoon', hours: 24 + 14 },
    {
      label: 'Monday morning',
      getDays: () => {
        const today = new Date().getDay()
        const daysUntilMonday = (8 - today) % 7 || 7
        return daysUntilMonday * 24 + 9
      },
    },
    { label: 'Next week', hours: 7 * 24 + 9 },
  ]

  const handleQuickSchedule = (hours: number) => {
    const scheduledDate = addHours(new Date(), hours)
    onSchedule(scheduledDate)
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Clock className="h-4 w-4" />
          Send Later
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-auto p-0" align="end">
        <div className="p-4 space-y-4">
          {/* Quick options */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Quick schedule</p>
            <div className="grid gap-2">
              {quickOptions.map((option) => (
                <Button
                  key={option.label}
                  variant="ghost"
                  className="justify-start"
                  onClick={() =>
                    handleQuickSchedule(
                      typeof option.hours === 'function' ? option.getDays() : option.hours
                    )
                  }
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Custom date/time */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Pick date and time</p>
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              disabled={(date) => date < new Date()}
            />
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            <Button
              className="w-full"
              onClick={() => {
                if (date) {
                  const [hours, minutes] = time.split(':')
                  const scheduledDate = new Date(date)
                  scheduledDate.setHours(parseInt(hours), parseInt(minutes))
                  onSchedule(scheduledDate)
                }
              }}
            >
              Schedule Send
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
```

---

## 5. Modern Features (2024-2025 Trends)

### AI Integration Patterns

**Key Insight**: AI should augment, not replace. Best implementations keep AI contextual and optional.

**AI Features by Maturity:**

| Feature             | Adoption                              | User Expectation     | Implementation Complexity |
| ------------------- | ------------------------------------- | -------------------- | ------------------------- |
| Smart Reply         | Universal (Gmail, Outlook, Apple)     | Expected             | Low                       |
| Email Summarization | High (Superhuman, Apple Intelligence) | Expected for premium | Medium                    |
| Smart Compose       | High (Gmail, Outlook)                 | Expected             | Medium                    |
| AI Search/Filters   | Medium (Superhuman, Gmail)            | Nice-to-have         | High                      |
| Auto-categorization | Medium (Spark, Hey.com)               | Nice-to-have         | High                      |
| Meeting Scheduling  | Low (x.ai, Clara)                     | Experimental         | Very High                 |

**UI Pattern: Sidebar AI Assistant (Recommended)**

Based on Google Gemini and Apple Intelligence patterns:

```tsx
function AIAssistantSidebar({ email }: { email: Email }) {
  const [isOpen, setIsOpen] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [response, setResponse] = useState('')

  return (
    <>
      {/* Trigger button in email header */}
      <Button variant="outline" size="sm" onClick={() => setIsOpen(true)} className="gap-2">
        <Sparkles className="h-4 w-4" />
        AI Assistant
      </Button>

      {/* Sidebar sheet */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent side="right" className="w-[400px] sm:w-[540px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              AI Assistant
            </SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            {/* Quick actions */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Quick actions</p>
              <div className="grid gap-2">
                <Button
                  variant="outline"
                  className="justify-start"
                  onClick={() => handleQuickAction('summarize')}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Summarize this email
                </Button>
                <Button
                  variant="outline"
                  className="justify-start"
                  onClick={() => handleQuickAction('reply')}
                >
                  <Mail className="mr-2 h-4 w-4" />
                  Draft a reply
                </Button>
                <Button
                  variant="outline"
                  className="justify-start"
                  onClick={() => handleQuickAction('action-items')}
                >
                  <CheckSquare className="mr-2 h-4 w-4" />
                  Extract action items
                </Button>
              </div>
            </div>

            <Separator />

            {/* Custom prompt */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Ask anything</p>
              <div className="flex gap-2">
                <Input
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Ask about this email..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCustomPrompt()
                  }}
                />
                <Button onClick={handleCustomPrompt}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Response area */}
            {response && (
              <Card>
                <CardContent className="pt-6">
                  <div className="prose prose-sm dark:prose-invert">{response}</div>
                  <div className="flex gap-2 mt-4">
                    <Button variant="outline" size="sm" onClick={() => copyToClipboard(response)}>
                      <Copy className="h-3 w-3 mr-2" />
                      Copy
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => insertIntoCompose(response)}>
                      <ArrowRight className="h-3 w-3 mr-2" />
                      Use in reply
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
```

**AI Summary at Thread Level (Superhuman Pattern):**

```tsx
// Show AI-generated summary at top of thread
function ThreadSummary({ threadId }: { threadId: string }) {
  const { data: summary, isLoading } = useQuery({
    queryKey: ['thread-summary', threadId],
    queryFn: () => generateThreadSummary(threadId),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  })

  if (isLoading) {
    return <Skeleton className="h-20 w-full" />
  }

  if (!summary) return null

  return (
    <Alert className="bg-primary/5 border-primary/20">
      <Sparkles className="h-4 w-4" />
      <AlertTitle>Thread Summary</AlertTitle>
      <AlertDescription className="mt-2">{summary}</AlertDescription>
    </Alert>
  )
}
```

### Snooze and Reminder Patterns

**Standard Snooze Options (2024):**

```tsx
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

function SnoozeButton({ emailId }: { emailId: string }) {
  const snoozeOptions = [
    { label: 'Later today', value: 'today', time: setHours(new Date(), 17) },
    { label: 'Tomorrow', value: 'tomorrow', time: addDays(setHours(new Date(), 9), 1) },
    { label: 'This weekend', value: 'weekend', time: nextSaturday(setHours(new Date(), 9)) },
    { label: 'Next week', value: 'nextweek', time: nextMonday(setHours(new Date(), 9)) },
    { label: 'In a month', value: 'month', time: addMonths(new Date(), 1) },
  ]

  const [customDate, setCustomDate] = useState<Date>()

  const handleSnooze = async (until: Date) => {
    await snoozeEmail(emailId, until)
    toast({
      title: 'Email snoozed',
      description: `This email will return ${formatDistanceToNow(until, { addSuffix: true })}`,
    })
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" title="Snooze">
          <Clock className="h-4 w-4" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-64 p-0" align="end">
        <div className="p-2">
          <div className="flex items-center gap-2 px-2 py-1.5 text-sm font-medium">
            <Clock className="h-4 w-4" />
            Snooze until...
          </div>

          <Separator className="my-2" />

          {snoozeOptions.map((option) => (
            <Button
              key={option.value}
              variant="ghost"
              className="w-full justify-start"
              onClick={() => handleSnooze(option.time)}
            >
              <span>{option.label}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {format(option.time, 'EEE, MMM d, h:mm a')}
              </span>
            </Button>
          ))}

          <Separator className="my-2" />

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" className="w-full justify-start">
                <Calendar className="mr-2 h-4 w-4" />
                Pick date & time...
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={customDate}
                onSelect={(date) => {
                  setCustomDate(date)
                  if (date) handleSnooze(date)
                }}
                disabled={(date) => date < new Date()}
              />
            </PopoverContent>
          </Popover>
        </div>
      </PopoverContent>
    </Popover>
  )
}
```

**Visual Feedback for Snoozed Emails:**

```tsx
function EmailListItem({ email }: { email: Email }) {
  const isSnoozed = email.snoozedUntil && email.snoozedUntil > new Date()

  return (
    <div className={cn('email-list-item', isSnoozed && 'opacity-60')}>
      {isSnoozed && (
        <Badge variant="secondary" className="gap-1">
          <Clock className="h-3 w-3" />
          Snoozed until {format(email.snoozedUntil, 'MMM d, h:mm a')}
        </Badge>
      )}
      {/* Rest of email item */}
    </div>
  )
}
```

### Inbox Zero Patterns

**Key Strategies from Industry Leaders:**

1. **Superhuman's Done/Not Done Philosophy**
   - Binary state: email is either done or not done
   - "Done" emails disappear from inbox
   - Celebration animation when hitting inbox zero

2. **Hey.com's Screening Approach**
   - Gatekeeper: Manually approve first-time senders
   - Imbox vs Feed vs Paper Trail auto-categorization
   - Reduces decision fatigue

3. **Spark's Smart Inbox**
   - Pinned important emails at top
   - Personal vs Notifications sections
   - Focus on "what needs attention now"

**Implementation: Inbox Zero Celebration**

```tsx
function InboxZeroCelebration() {
  const [show, setShow] = useState(false)
  const emailCount = useEmailCount()

  useEffect(() => {
    if (emailCount === 0) {
      setShow(true)
      setTimeout(() => setShow(false), 5000)
    }
  }, [emailCount])

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="fixed inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-50"
        >
          <Card className="p-8 text-center max-w-md">
            <CardContent>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', duration: 0.5 }}
              >
                <CheckCircle className="h-20 w-20 mx-auto text-green-500 mb-4" />
              </motion.div>
              <h2 className="text-2xl font-bold mb-2">Inbox Zero!</h2>
              <p className="text-muted-foreground">You've cleared your inbox. Time to celebrate!</p>

              {/* Beautiful background image (Superhuman style) */}
              <div className="mt-6 rounded-lg overflow-hidden">
                <img
                  src={getRandomCelebrationImage()}
                  alt="Celebration"
                  className="w-full h-48 object-cover"
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

---

## 6. Performance Optimizations

### Sub-Millisecond Navigation Goal

**Key Strategy**: Prefetch + Optimistic UI + Virtual Scrolling

**React Router 7 Prefetching:**

React Router 7.4.0 includes powerful prefetching capabilities:

```tsx
import { Link } from 'react-router-dom';

// Prefetch on hover (default: intent)
<Link to={`/email/${email.id}`} prefetch="intent">
  {email.subject}
</Link>

// Prefetch when link enters viewport
<Link to={`/email/${email.id}`} prefetch="viewport">
  {email.subject}
</Link>

// Always prefetch on render
<Link to={`/email/${email.id}`} prefetch="render">
  {email.subject}
</Link>
```

**Prefetch Strategy for Email Client:**

```tsx
// In email list, prefetch on hover with 100ms delay
function EmailListItem({ email }: { email: Email }) {
  const prefetchTimer = useRef<NodeJS.Timeout>()
  const prefetch = usePrefetch()

  const handleMouseEnter = () => {
    prefetchTimer.current = setTimeout(() => {
      prefetch(`/email/${email.id}`)
      // Also prefetch email body data
      queryClient.prefetchQuery({
        queryKey: ['email', email.id],
        queryFn: () => fetchEmailBody(email.id),
      })
    }, 100)
  }

  const handleMouseLeave = () => {
    if (prefetchTimer.current) {
      clearTimeout(prefetchTimer.current)
    }
  }

  return (
    <div onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <Link to={`/email/${email.id}`} prefetch="intent">
        {/* Email preview */}
      </Link>
    </div>
  )
}
```

### Virtual Scrolling with TanStack Virtual

**Problem**: Rendering 1000+ emails kills performance

**Solution**: Only render visible items + buffer

```tsx
import { useVirtualizer } from '@tanstack/react-virtual'

function EmailList({ emails }: { emails: Email[] }) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: emails.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72, // Estimated row height
    overscan: 5, // Render 5 extra items above/below viewport
  })

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const email = emails[virtualRow.index]

          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <EmailListItem email={email} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

**Performance Gain**: Rendering 10,000 emails goes from ~2000ms to ~50ms

### Optimistic UI Updates

**Pattern**: Update UI immediately, rollback on error

```tsx
function useOptimisticArchive() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: archiveEmail,

    onMutate: async (emailId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['emails'] })

      // Snapshot previous value
      const previousEmails = queryClient.getQueryData(['emails'])

      // Optimistically update
      queryClient.setQueryData(['emails'], (old: Email[]) =>
        old.filter((email) => email.id !== emailId)
      )

      // Return rollback function
      return { previousEmails }
    },

    onError: (err, emailId, context) => {
      // Rollback on error
      queryClient.setQueryData(['emails'], context.previousEmails)

      toast({
        title: 'Failed to archive',
        description: 'Please try again',
        variant: 'destructive',
      })
    },

    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ['emails'] })
    },
  })
}

// Usage
function EmailListItem({ email }: { email: Email }) {
  const archiveMutation = useOptimisticArchive()

  return (
    <Button onClick={() => archiveMutation.mutate(email.id)} disabled={archiveMutation.isPending}>
      Archive
    </Button>
  )
}
```

### Skeleton Loading Screens

**Best Practice**: Match skeleton to actual content layout

```tsx
function EmailListSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4">
          <Skeleton className="h-10 w-10 rounded-full" /> {/* Avatar */}
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-[200px]" /> {/* Sender name */}
            <Skeleton className="h-4 w-full" /> {/* Subject */}
            <Skeleton className="h-3 w-3/4" /> {/* Preview text */}
          </div>
          <Skeleton className="h-4 w-[60px]" /> {/* Timestamp */}
        </div>
      ))}
    </div>
  )
}

// Usage with React Query
function EmailList() {
  const { data: emails, isLoading } = useQuery({
    queryKey: ['emails'],
    queryFn: fetchEmails,
  })

  if (isLoading) return <EmailListSkeleton />

  return (
    <div>
      {emails.map((email) => (
        <EmailListItem key={email.id} email={email} />
      ))}
    </div>
  )
}
```

### Smooth Animations and Transitions

**Key Principle**: Respect `prefers-reduced-motion`

```css
/* Global animation defaults */
* {
  transition-duration: 150ms;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}

/* Respect user preference */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

**Framer Motion for Complex Animations:**

```tsx
import { motion, AnimatePresence } from 'framer-motion'

function EmailListItem({ email }: { email: Email }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ duration: 0.15 }}
    >
      {/* Email content */}
    </motion.div>
  )
}

// Usage with AnimatePresence for exit animations
function EmailList({ emails }: { emails: Email[] }) {
  return (
    <AnimatePresence>
      {emails.map((email) => (
        <EmailListItem key={email.id} email={email} />
      ))}
    </AnimatePresence>
  )
}
```

### Progressive Loading Strategy

**Pattern**: Load critical data first, defer non-critical

```tsx
function EmailView({ emailId }: { emailId: string }) {
  // Critical: Load email metadata immediately
  const { data: email } = useQuery({
    queryKey: ['email', emailId],
    queryFn: () => fetchEmailMetadata(emailId),
  })

  // Defer: Load email body 100ms later
  const { data: body } = useQuery({
    queryKey: ['email-body', emailId],
    queryFn: () => fetchEmailBody(emailId),
    enabled: !!email,
    staleTime: 5 * 60 * 1000,
  })

  // Defer: Load attachments on demand
  const { data: attachments } = useQuery({
    queryKey: ['attachments', emailId],
    queryFn: () => fetchAttachments(emailId),
    enabled: !!email && email.hasAttachments,
  })

  return (
    <div>
      {/* Show header immediately */}
      <EmailHeader email={email} />

      {/* Show body with skeleton */}
      {body ? <EmailBody content={body} /> : <Skeleton className="h-96" />}

      {/* Show attachments when loaded */}
      {attachments && <AttachmentList attachments={attachments} />}
    </div>
  )
}
```

### Caching Strategy

**Multi-Layer Caching for Speed:**

```tsx
// 1. React Query for API caching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 30 * 60 * 1000, // 30 minutes
      refetchOnWindowFocus: false,
    },
  },
})

// 2. IndexedDB for persistent caching
import { openDB } from 'idb'

const db = await openDB('email-cache', 1, {
  upgrade(db) {
    db.createObjectStore('emails', { keyPath: 'id' })
  },
})

// Save to IndexedDB
async function cacheEmail(email: Email) {
  await db.put('emails', email)
}

// Read from IndexedDB (hydrate on load)
async function getCachedEmail(id: string) {
  return await db.get('emails', id)
}

// 3. Service Worker for offline support
// sw.ts
const CACHE_NAME = 'claine-v2'

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request)
    })
  )
})
```

---

## 7. Accessibility

### WCAG 2.2 Compliance Checklist

**New Success Criteria (October 2024):**

#### 2.4.11 Focus Not Obscured (Minimum) - AA

**Requirement**: Focused elements must not be fully hidden by sticky headers/footers

```tsx
// Ensure reading pane doesn't obscure focused elements
function ReadingPane({ email }: { email: Email }) {
  const focusedElementRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement
      focusedElementRef.current = target

      // Scroll into view if obscured
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      })
    }

    document.addEventListener('focusin', handleFocus)
    return () => document.removeEventListener('focusin', handleFocus)
  }, [])

  return (
    <div className="relative">
      {/* Sticky header with proper z-index */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur">
        <EmailHeader email={email} />
      </div>

      {/* Ensure sufficient padding to prevent obscuring */}
      <div className="p-4 pb-20">
        <EmailBody email={email} />
      </div>
    </div>
  )
}
```

#### 2.4.12 Focus Appearance (Minimum) - AA

**Requirement**: Focus indicators must be visible and meet contrast requirements

```css
/* Enhanced focus indicators with Tailwind */
.focus-visible:focus-visible {
  @apply outline-none ring-2 ring-ring ring-offset-2 ring-offset-background;
}

/* For dark mode */
[data-theme='dark'] .focus-visible:focus-visible {
  @apply ring-offset-background;
}

/* Ensure focus is visible on all interactive elements */
button:focus-visible,
a:focus-visible,
input:focus-visible,
textarea:focus-visible,
select:focus-visible {
  @apply outline-none ring-2 ring-primary ring-offset-2;
}
```

#### 2.5.7 Dragging Movements - AA

**Requirement**: Provide alternative to drag-and-drop

```tsx
// Email list with both drag-to-reorder and button-based alternative
function EmailList({ emails }: { emails: Email[] }) {
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null)

  return (
    <div>
      {emails.map((email, index) => (
        <div key={email.id} className="group relative">
          {/* Drag handle (visible on hover) */}
          <button
            className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100"
            aria-label="Drag to reorder"
          >
            <GripVertical className="h-4 w-4" />
          </button>

          {/* Alternative: Move up/down buttons */}
          <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 flex gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => moveEmail(index, index - 1)}
              disabled={index === 0}
              aria-label="Move up"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => moveEmail(index, index + 1)}
              disabled={index === emails.length - 1}
              aria-label="Move down"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>

          <EmailListItem email={email} />
        </div>
      ))}
    </div>
  )
}
```

#### 3.2.6 Consistent Help - A

**Requirement**: Help mechanism must be in consistent location

```tsx
// Add consistent help button in app header
function AppHeader() {
  return (
    <header className="flex items-center justify-between p-4 border-b">
      <Logo />

      <div className="flex items-center gap-2">
        {/* Consistent help location */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => openHelpDialog()}
          aria-label="Help and keyboard shortcuts"
        >
          <HelpCircle className="h-5 w-5" />
        </Button>

        <UserMenu />
      </div>
    </header>
  )
}
```

#### 3.3.7 Redundant Entry - A

**Requirement**: Don't ask for same information twice

```tsx
// Auto-fill recipient from recent conversations
function ComposeForm({ replyTo }: { replyTo?: Email }) {
  const [to, setTo] = useState<string[]>(replyTo ? [replyTo.from.email] : [])

  // Remember recently used recipients
  const recentRecipients = useLocalStorage('recent-recipients', [])

  return (
    <form>
      <RecipientInput value={to} onChange={setTo} suggestions={recentRecipients} />
      {/* ... */}
    </form>
  )
}
```

### Screen Reader Support

**Semantic HTML and ARIA:**

```tsx
function EmailList({ emails }: { emails: Email[] }) {
  return (
    <div role="main" aria-label="Email list">
      {/* Status updates for screen readers */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {emails.length} emails in inbox
      </div>

      <ul>
        {emails.map((email) => (
          <li key={email.id}>
            <article aria-labelledby={`email-${email.id}-subject`}>
              <div className="flex items-center gap-4">
                <Checkbox aria-label={`Select email from ${email.from.name}`} />

                <div className="flex-1">
                  <h3 id={`email-${email.id}-subject`} className="font-semibold">
                    {email.subject}
                  </h3>
                  <p className="text-sm text-muted-foreground">From {email.from.name}</p>
                </div>

                <time dateTime={email.date.toISOString()}>{formatDistanceToNow(email.date)}</time>
              </div>
            </article>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

**Announce Dynamic Changes:**

```tsx
function useAriaLiveAnnouncement() {
  const [announcement, setAnnouncement] = useState('')

  const announce = (message: string) => {
    setAnnouncement(message)
    setTimeout(() => setAnnouncement(''), 1000)
  }

  return { announcement, announce }
}

// Usage
function EmailActions({ email }: { email: Email }) {
  const { announce } = useAriaLiveAnnouncement()
  const archiveMutation = useArchive()

  const handleArchive = async () => {
    await archiveMutation.mutateAsync(email.id)
    announce(`Email from ${email.from.name} archived`)
  }

  return (
    <>
      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>

      <Button onClick={handleArchive}>Archive</Button>
    </>
  )
}
```

### Keyboard Navigation

**Complete Keyboard Shortcuts Map:**

```tsx
const KEYBOARD_SHORTCUTS = {
  // Navigation
  j: 'Next email',
  k: 'Previous email',
  o: 'Open email',
  u: 'Return to list',
  'g i': 'Go to Inbox',
  'g s': 'Go to Sent',
  'g d': 'Go to Drafts',

  // Actions
  e: 'Archive',
  '#': 'Delete',
  r: 'Reply',
  a: 'Reply all',
  f: 'Forward',
  s: 'Star',
  v: 'Move to folder',
  l: 'Label',
  h: 'Snooze',

  // Composition
  c: 'Compose',
  'Cmd+Enter': 'Send',
  'Cmd+Shift+C': 'Add Cc',
  'Cmd+Shift+B': 'Add Bcc',

  // Selection
  x: 'Select',
  '*+a': 'Select all',
  '*+n': 'Select none',
  '*+r': 'Select read',
  '*+u': 'Select unread',

  // Interface
  'Cmd+K': 'Command palette',
  '/': 'Search',
  '?': 'Show keyboard shortcuts',
  'Cmd+/': 'Toggle sidebar',
  'Cmd+.': 'Toggle reading pane',
}

function KeyboardShortcutsDialog() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        setOpen(true)
      }
    }

    document.addEventListener('keydown', handleKeyPress)
    return () => document.removeEventListener('keydown', handleKeyPress)
  }, [])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>

        <div className="grid gap-6">
          {Object.entries(groupShortcutsByCategory(KEYBOARD_SHORTCUTS)).map(
            ([category, shortcuts]) => (
              <div key={category}>
                <h3 className="font-semibold mb-3">{category}</h3>
                <div className="grid gap-2">
                  {shortcuts.map(([key, description]) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{description}</span>
                      <kbd className="px-2 py-1 text-xs font-semibold bg-muted rounded">{key}</kbd>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

### Color Contrast

**WCAG AA Requirements:**

- Normal text: 4.5:1 contrast ratio
- Large text (18pt+): 3:1 contrast ratio
- Interactive components: 3:1 contrast ratio

**Shadcn/UI Default Tokens (Already Compliant):**

```css
:root {
  --background: oklch(100% 0 0);
  --foreground: oklch(9.82% 0 0);
  /* Contrast ratio: 19.56:1 ✓ */

  --muted: oklch(96.08% 0 0);
  --muted-foreground: oklch(45.57% 0 0);
  /* Contrast ratio: 7.31:1 ✓ */

  --accent: oklch(96.08% 0 0);
  --accent-foreground: oklch(15.15% 0 0);
  /* Contrast ratio: 14.02:1 ✓ */
}
```

**Testing Tool Integration:**

```tsx
// Development-only contrast checker
function ContrastChecker({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV !== 'development') {
    return <>{children}</>
  }

  const checkContrast = (element: HTMLElement) => {
    const fg = getComputedStyle(element).color
    const bg = getComputedStyle(element).backgroundColor
    const ratio = calculateContrastRatio(fg, bg)

    if (ratio < 4.5) {
      console.warn(`Low contrast detected: ${ratio.toFixed(2)}:1`, element)
    }
  }

  return <>{children}</>
}
```

### Reduced Motion Support

**Implementation:**

```tsx
// Hook to detect reduced motion preference
function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mediaQuery.matches)

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches)
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  return prefersReducedMotion
}

// Usage in components
function EmailList({ emails }: { emails: Email[] }) {
  const prefersReducedMotion = usePrefersReducedMotion()

  return (
    <motion.div
      initial={prefersReducedMotion ? {} : { opacity: 0 }}
      animate={prefersReducedMotion ? {} : { opacity: 1 }}
      transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.3 }}
    >
      {emails.map((email) => (
        <EmailListItem key={email.id} email={email} />
      ))}
    </motion.div>
  )
}
```

**CSS Approach:**

```css
/* Default animations */
.email-list-item {
  transition: all 0.2s ease;
}

.email-list-item:hover {
  transform: translateY(-2px);
}

/* Disable for users who prefer reduced motion */
@media (prefers-reduced-motion: reduce) {
  .email-list-item {
    transition: none;
  }

  .email-list-item:hover {
    transform: none;
  }

  /* Use fade instead of movement */
  .email-list-item:hover {
    opacity: 0.8;
  }
}
```

---

## 8. Dark Mode Best Practices

### Color System with OKLCH

**Benefits of OKLCH over HSL:**

1. **Perceptual Uniformity**: Colors with same L value appear equally bright
2. **Wider Gamut**: Access to more vibrant colors
3. **Better Interpolation**: Smooth gradients without muddy midpoints
4. **Consistent Contrast**: Easier to maintain accessibility

**Tailwind CSS v4 with OKLCH:**

```css
/* Define semantic color tokens */
@theme {
  --color-background: oklch(100% 0 0);
  --color-foreground: oklch(9.82% 0 0);
  --color-card: oklch(100% 0 0);
  --color-card-foreground: oklch(9.82% 0 0);
  --color-popover: oklch(100% 0 0);
  --color-popover-foreground: oklch(9.82% 0 0);
  --color-primary: oklch(47.64% 0.166 255.5);
  --color-primary-foreground: oklch(98.04% 0 0);
  --color-secondary: oklch(96.08% 0 0);
  --color-secondary-foreground: oklch(15.15% 0 0);
  --color-muted: oklch(96.08% 0 0);
  --color-muted-foreground: oklch(45.57% 0 0);
  --color-accent: oklch(96.08% 0 0);
  --color-accent-foreground: oklch(15.15% 0 0);
  --color-destructive: oklch(50% 0.2 0);
  --color-destructive-foreground: oklch(98.04% 0 0);
  --color-border: oklch(89.29% 0 0);
  --color-input: oklch(89.29% 0 0);
  --color-ring: oklch(47.64% 0.166 255.5);
}

/* Dark mode overrides */
[data-theme='dark'] {
  --color-background: oklch(15% 0 0);
  --color-foreground: oklch(98.04% 0 0);
  --color-card: oklch(15% 0 0);
  --color-card-foreground: oklch(98.04% 0 0);
  --color-popover: oklch(15% 0 0);
  --color-popover-foreground: oklch(98.04% 0 0);
  --color-primary: oklch(70.59% 0.199 255.5);
  --color-primary-foreground: oklch(15.15% 0 0);
  --color-secondary: oklch(22.19% 0 0);
  --color-secondary-foreground: oklch(98.04% 0 0);
  --color-muted: oklch(22.19% 0 0);
  --color-muted-foreground: oklch(64.88% 0 0);
  --color-accent: oklch(22.19% 0 0);
  --color-accent-foreground: oklch(98.04% 0 0);
  --color-destructive: oklch(60% 0.2 0);
  --color-destructive-foreground: oklch(98.04% 0 0);
  --color-border: oklch(22.19% 0 0);
  --color-input: oklch(22.19% 0 0);
  --color-ring: oklch(70.59% 0.199 255.5);
}
```

### Semantic Color Naming

**Don't use color names in token names:**

```css
/* ❌ Bad: Color-based names */
--blue-600: oklch(47.64% 0.166 255.5);
--gray-100: oklch(96.08% 0 0);

/* ✓ Good: Purpose-based names */
--primary: oklch(47.64% 0.166 255.5);
--muted: oklch(96.08% 0 0);
```

### Dark Mode Toggle

```tsx
function DarkModeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  useEffect(() => {
    // Initialize from user preference
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light')

    setTheme(initialTheme)
    document.documentElement.setAttribute('data-theme', initialTheme)
  }, [])

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
    localStorage.setItem('theme', newTheme)
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      {theme === 'light' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
    </Button>
  )
}
```

### Email Content in Dark Mode

**Challenge**: HTML emails have hardcoded colors

**Solutions:**

1. **Smart Inversion (Recommended)**

```tsx
function EmailContent({ html }: { html: string }) {
  const [theme] = useTheme()

  return (
    <div
      className={cn('email-content', theme === 'dark' && 'dark-mode-email')}
      dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
    />
  )
}
```

```css
.dark-mode-email {
  /* Invert colors but keep images natural */
  filter: invert(1) hue-rotate(180deg);
}

.dark-mode-email img {
  /* Re-invert images */
  filter: invert(1) hue-rotate(180deg);
}

.dark-mode-email [style*='background-color: #fff'],
.dark-mode-email [style*='background-color: #ffffff'],
.dark-mode-email [style*='background-color: white'] {
  /* Handle common white backgrounds */
  background-color: var(--background) !important;
}
```

2. **Parse and Rewrite (More Accurate)**

```tsx
function remapEmailColors(html: string, theme: 'light' | 'dark'): string {
  if (theme === 'light') return html

  const colorMap = {
    '#ffffff': 'var(--background)',
    '#fff': 'var(--background)',
    white: 'var(--background)',
    '#000000': 'var(--foreground)',
    '#000': 'var(--foreground)',
    black: 'var(--foreground)',
    // Add more mappings as needed
  }

  let modifiedHtml = html

  Object.entries(colorMap).forEach(([from, to]) => {
    // Replace inline styles
    modifiedHtml = modifiedHtml.replace(new RegExp(`color:\\s*${from}`, 'gi'), `color: ${to}`)
    modifiedHtml = modifiedHtml.replace(
      new RegExp(`background-color:\\s*${from}`, 'gi'),
      `background-color: ${to}`
    )
  })

  return modifiedHtml
}
```

### Testing Dark Mode

**Checklist:**

- [ ] All text meets contrast requirements (4.5:1 for normal, 3:1 for large)
- [ ] Interactive elements have visible focus indicators
- [ ] Images don't get double-inverted
- [ ] Brand colors remain recognizable
- [ ] Buttons and cards have appropriate elevation
- [ ] Syntax highlighting in code blocks is readable
- [ ] Charts and graphs use dark-mode appropriate colors
- [ ] Loading skeletons use appropriate muted colors

---

## 9. Recommendations for Claine v2 UI

### High-Priority Features (Must Have)

1. **Three-Pane Layout with User Customization**
   - Resizable panels with Shadcn/UI ResizablePanelGroup
   - Persist layout preferences to localStorage
   - Responsive breakpoints for tablet/mobile
   - Keyboard shortcuts to toggle panes

2. **Keyboard-First Navigation**
   - Implement Gmail-style j/k navigation
   - Command palette with ⌘K
   - Comprehensive shortcut coverage (30+ shortcuts)
   - Shortcut help dialog with `?`

3. **Virtual Scrolling**
   - TanStack Virtual for email lists
   - Maintain 60fps scrolling with 1000+ emails
   - Overscan buffer of 5 items

4. **Optimistic UI**
   - Instant feedback for archive, delete, star
   - Rollback on error with toast notification
   - React Query optimistic updates

5. **Prefetching Strategy**
   - React Router 7 `prefetch="intent"` on email links
   - Prefetch on hover with 100ms delay
   - Prefetch adjacent emails when reading

6. **Dark Mode**
   - OKLCH color system for consistency
   - Smart inversion for email content
   - Respect `prefers-color-scheme`
   - Toggle in header and settings

7. **Accessibility**
   - WCAG 2.2 AA compliance
   - Semantic HTML with ARIA labels
   - Screen reader announcements for actions
   - Keyboard navigation for all features
   - Reduced motion support

### Medium-Priority Features (Should Have)

8. **AI Integration**
   - Email summarization (one-line at thread level)
   - Sidebar AI assistant for contextual help
   - Smart reply suggestions
   - Action item extraction

9. **Snooze & Reminders**
   - Quick snooze options (later today, tomorrow, weekend)
   - Custom date/time picker
   - Visual indicators for snoozed emails
   - Return to inbox at scheduled time

10. **Thread Conversation View**
    - Collapsed older messages with expand
    - Auto-expand unread and latest
    - Smooth expand/collapse animations
    - AI summary at thread top

11. **Rich Compose Experience**
    - Modal with expand to full-screen
    - Tiptap or TinyMCE editor
    - Recipient autocomplete with avatars
    - Send later scheduling
    - Draft auto-save every 30s

12. **Attachment Handling**
    - Drag-and-drop upload
    - Preview for images/PDFs
    - Progress indicators
    - Inline image embedding

### Low-Priority Features (Nice to Have)

13. **Inbox Zero Celebration**
    - Animation when reaching zero
    - Beautiful background image
    - Motivational message
    - Share achievement option

14. **Email Templates**
    - Saved reply templates
    - Keyboard shortcut to insert
    - Variables for personalization
    - Template management UI

15. **Unified Inbox**
    - Multiple account support
    - Account switcher in sidebar
    - Color-coded accounts
    - Cross-account search

16. **Advanced Search**
    - Filter by sender, date range, labels
    - Saved searches
    - Search syntax help
    - Instant results with Algolia/Meilisearch

### Performance Targets

Based on industry benchmarks:

| Action              | Target     | Superhuman Benchmark | Implementation Strategy            |
| ------------------- | ---------- | -------------------- | ---------------------------------- |
| Initial load        | < 1s       | 800ms                | Code splitting, lazy routes        |
| Email navigation    | < 100ms    | 50ms                 | Prefetch + optimistic UI           |
| Search results      | < 200ms    | 150ms                | Indexed search, debounce input     |
| Compose open        | < 150ms    | 100ms                | Pre-render modal, lazy load editor |
| Keyboard shortcut   | < 50ms     | 30ms                 | Event listener on document         |
| List scroll (60fps) | 16ms/frame | 16ms/frame           | Virtual scrolling                  |

### Recommended Tech Stack

**Already Decided:**

- ✅ React 19
- ✅ React Router 7.4.0
- ✅ Shadcn/UI
- ✅ Tailwind CSS v4 with OKLCH

**Recommendations:**

**State Management:**

- TanStack Query (React Query) for server state
- Zustand for local UI state (panel sizes, preferences)

**Rich Text Editor:**

- Tiptap (headless, works well with Shadcn/UI)
- Alternative: TinyMCE (more features, less customizable)

**Virtual Scrolling:**

- TanStack Virtual (official recommendation)

**Animations:**

- Framer Motion for complex animations
- CSS transitions for simple state changes
- Respect `prefers-reduced-motion`

**Email Parsing:**

- DOMPurify for HTML sanitization
- `html-react-parser` for rendering

**Date Formatting:**

- date-fns (tree-shakeable)

**Forms:**

- React Hook Form + Zod validation

**Icons:**

- Lucide React (used by Shadcn/UI)

**Command Palette:**

- cmdk (used by Shadcn/UI)

**Drag and Drop:**

- dnd-kit (accessible, modern)

### Architecture Recommendations

**Route Structure:**

```
/                         # Redirect to /inbox
/inbox                    # Email list + reading pane
/inbox/:emailId           # Email list + specific email
/inbox/:emailId/full      # Full-screen email view (mobile)
/sent                     # Sent emails
/drafts                   # Draft emails
/starred                  # Starred emails
/trash                    # Trash
/label/:labelId           # Custom labels
/search                   # Search results
/compose                  # New email (modal overlay)
/settings                 # Settings page
/settings/accounts        # Account management
/settings/appearance      # Theme, density, layout
/settings/shortcuts       # Keyboard shortcuts
```

**Component Structure:**

```
src/
├── components/
│   ├── ui/                    # Shadcn/UI primitives
│   ├── email/
│   │   ├── EmailList.tsx
│   │   ├── EmailListItem.tsx
│   │   ├── EmailThread.tsx
│   │   ├── EmailHeader.tsx
│   │   └── EmailBody.tsx
│   ├── compose/
│   │   ├── ComposeModal.tsx
│   │   ├── RecipientInput.tsx
│   │   ├── RichTextEditor.tsx
│   │   └── AttachmentUploader.tsx
│   ├── layout/
│   │   ├── AppShell.tsx
│   │   ├── Sidebar.tsx
│   │   ├── ReadingPane.tsx
│   │   └── CommandPalette.tsx
│   └── ai/
│       ├── AIAssistant.tsx
│       ├── SmartReply.tsx
│       └── ThreadSummary.tsx
├── hooks/
│   ├── useKeyboardShortcuts.ts
│   ├── usePrefersReducedMotion.ts
│   ├── useEmailNavigation.ts
│   └── useOptimisticMutation.ts
├── lib/
│   ├── api/                   # API client functions
│   ├── utils/                 # Utility functions
│   └── constants.ts           # Constants and configs
└── routes/                    # React Router routes
```

### Implementation Roadmap

**Phase 1: Core Infrastructure (Weeks 1-2)**

- [ ] Three-pane layout with resizable panels
- [ ] Email list with virtual scrolling
- [ ] Basic email reading view
- [ ] Dark mode with OKLCH
- [ ] React Router 7 setup with prefetching

**Phase 2: Navigation & Interaction (Weeks 3-4)**

- [ ] Keyboard shortcuts (j/k navigation)
- [ ] Command palette (⌘K)
- [ ] Optimistic UI for actions
- [ ] Search functionality
- [ ] Mobile responsive layout

**Phase 3: Composition (Weeks 5-6)**

- [ ] Compose modal with rich text editor
- [ ] Recipient autocomplete
- [ ] Attachment handling
- [ ] Send later scheduling
- [ ] Draft auto-save

**Phase 4: Advanced Features (Weeks 7-8)**

- [ ] Thread conversation view
- [ ] AI summarization
- [ ] Smart replies
- [ ] Snooze & reminders
- [ ] Email templates

**Phase 5: Polish & Accessibility (Weeks 9-10)**

- [ ] WCAG 2.2 compliance audit
- [ ] Screen reader testing
- [ ] Keyboard navigation audit
- [ ] Performance optimization
- [ ] Animation polish

**Phase 6: Testing & Launch (Weeks 11-12)**

- [ ] User testing
- [ ] Bug fixes
- [ ] Performance benchmarking
- [ ] Documentation
- [ ] Deployment

---

## Conclusion

Modern email clients in 2024-2025 are defined by:

1. **Speed as a core UX principle**: Sub-100ms interactions through prefetching, optimistic UI, and virtual scrolling
2. **AI augmentation**: Contextual assistance that enhances rather than replaces human decision-making
3. **Keyboard-first design**: Comprehensive shortcuts with discoverable command palette
4. **Accessibility by default**: WCAG 2.2 compliance, screen reader support, and reduced motion
5. **Dark mode excellence**: Perceptually uniform colors with OKLCH, smart content adaptation
6. **Mobile-first reality**: Swipe gestures, responsive layouts, and touch-friendly interactions

For Claine v2, focus on:

- **Performance first**: Hit the sub-100ms navigation target with React Router 7 prefetching
- **Progressive enhancement**: Build core features solidly before adding AI bells and whistles
- **Accessibility**: Make it keyboard-navigable and screen-reader friendly from day one
- **User customization**: Let users adapt the interface to their workflow

The combination of React 19, React Router 7.4.0, Shadcn/UI, and Tailwind CSS v4 with OKLCH provides an excellent foundation for building a world-class email client that can compete with Superhuman and Gmail in both speed and user experience.

---

## References

### Email Clients Analyzed

- Gmail (Google)
- Superhuman
- Hey.com (Basecamp)
- Spark Mail
- Apple Mail
- Outlook (Microsoft)
- Fastmail
- Mailbird

### Key Articles & Resources

- WCAG 2.2 Guidelines (W3C, October 2023)
- React Router 7 Documentation
- Shadcn/UI Component Library
- TanStack Virtual Documentation
- Superhuman Blog: "How to Build a Remarkable Command Palette"
- Intercom: "Shortcuts to Superpowers" (Command Palette Design)
- MDN: `prefers-reduced-motion` Documentation
- Tailwind CSS v4 Documentation

### Design Pattern References

- Mobbin (Mobile & Web UI Patterns)
- Dribbble (Email Client Designs)
- UI Patterns (Command Palette, Drag and Drop)
- Smart Interface Design Patterns

### Performance Benchmarks

- Superhuman: 50ms average navigation time
- Gmail: 200-400ms navigation time
- Outlook Web: 300-600ms navigation time
- Apple Mail: 100-200ms navigation time (native)
