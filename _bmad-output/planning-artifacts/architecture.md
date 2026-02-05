# Architecture Decision Document

**Project:** Claine - Offline-First AI Email Client
**Version:** 1.1
**Date:** 2025-11-01 (Updated: 2025-11-05)
**Status:** Approved

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Starter Template Decision](#starter-template-decision)
3. [Critical Architectural Decisions](#critical-architectural-decisions)
4. [Cross-Cutting Concerns](#cross-cutting-concerns)
5. [Project Structure](#project-structure)
6. [Implementation Patterns](#implementation-patterns)
7. [Decision Rationale](#decision-rationale)

---

## Executive Summary

This document captures all architectural decisions for Claine, an offline-first AI-powered email client. The architecture is designed to:

- **Support offline-first email management** for 100K emails per account
- **Enable local AI processing** for privacy-preserving email triage and composition
- **Deliver sub-50ms UI performance** through optimized caching and rendering
- **Provide PWA-native experience** with future mobile support
- **Ensure AI agent consistency** through explicit patterns and conventions

### Key Decisions

| Category             | Decision                        | Version                      | Rationale                                                                                                                                       |
| -------------------- | ------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Platform**         | Progressive Web App (PWA)       | -                            | Lower resource usage (40-60% less memory), faster deployment (no installers/code signing), easier CASA audit (sandboxed), future mobile support |
| **Framework**        | Vite + React + TypeScript       | Vite 7.0, React 19.2, TS 5.9 | Vite 7: Fastest builds (ESM-only). React 19.2: Latest stable with improved hooks. TS 5.9: Deferred imports support                              |
| **Database**         | RxDB + IndexedDB                | RxDB 16.20.0                 | Offline-first reactive database, handles 100K emails (~1.5GB) within browser quota, automatic migrations                                        |
| **State Management** | Zustand                         | 5.0.8                        | Simpler than Redux (no boilerplate), no Electron IPC complexity, excellent TypeScript support, 3KB bundle                                       |
| **Styling**          | TailwindCSS + shadcn/ui         | TailwindCSS 4.0.0            | TailwindCSS 4: 5x faster builds (Rust Oxide engine), CSS-first config. shadcn/ui: Accessible Radix components                                   |
| **Email API**        | Gmail API (Phase 1)             | v1                           | Better performance than IMAP (history API for delta sync), CASA audit required for both, native Gmail features                                  |
| **Local AI**         | ONNX Runtime Web + Llama 3.1 8B | ONNX 1.23.0, Llama 3.1 8B Q4 | Browser-compatible inference, WebGPU acceleration, quantized for performance (~4GB), privacy-preserving                                         |
| **Testing**          | Vitest + Playwright             | Vitest 4.0, Playwright 1.56  | Vitest 4: Vite-native, browser mode support. Playwright 1.56: Best PWA E2E testing, visual regression                                           |
| **Deployment**       | Vercel + Service Workers        | -                            | Optimal for PWAs (edge caching), automatic HTTPS, instant deployments, Web Vitals monitoring                                                    |
| **Runtime**          | Node.js                         | 22.x (LTS)                   | Vercel default, standardized across local/CI/deployment environments (updated 2025-11-05)                                                       |

---

## Starter Template Decision

### Selected Template

**Vite + React + TypeScript**

```bash
npm create vite@latest claine-rebuild-v2 -- --template react-ts
```

### Template Provides

- ✅ Vite bundler (fast HMR, optimized builds)
- ✅ React 18+ with TypeScript
- ✅ ESLint configuration
- ✅ Basic project structure

### Additional Setup Required

```bash
# Install PWA plugin
npm install vite-plugin-pwa@latest -D

# Install UI dependencies (TailwindCSS 4.0 stable)
npm install tailwindcss@4.0.0 -D
npm install @tailwindcss/postcss@next -D

# Install state management
npm install zustand@5.0.8

# Install database
npm install rxdb@16.20.0 rxjs@latest

# Install AI runtime
npm install onnxruntime-web@1.23.0

# Install Gmail API client
npm install @googleapis/gmail@latest

# Install utilities
npm install date-fns@latest html-to-text@latest dompurify@latest lunr@latest
npm install @types/dompurify@latest @types/lunr@latest -D

# Install shadcn/ui (interactive setup)
npx shadcn@latest init
```

**Version Notes (verified 2025-11-01, updated 2025-11-05):**

- Vite 7.0 requires Node.js 22.12+ (project standardized on Node.js 22.x)
- React 19.2 is latest stable with new hooks API
- TailwindCSS 4.0.0 stable released January 2025
- RxDB 16.20.0 published October 2025
- Node.js 22.x is Vercel's default and latest LTS

### Rationale

- **Vite over Create React App:** 10-100x faster dev server, native ES modules, better tree-shaking
- **React over Vue/Svelte:** Larger ecosystem for shadcn/ui, better AI/ML library support, team familiarity
- **TypeScript required:** Type safety critical for multi-agent development, catches errors early

---

## Critical Architectural Decisions

### Decision 1: Database (RxDB + IndexedDB)

**Decision:** Use RxDB v16.20.0 with IndexedDB adapter for offline data storage.

**Context:**

- Need to store 100K emails locally (target)
- Offline-first architecture required
- Reactive queries for real-time UI updates
- Browser storage limits (~60% of available disk space)

**Options Considered:**

- **RxDB + IndexedDB** ✅ Selected
- Dexie.js + IndexedDB (simpler, but not reactive)
- LocalForage (too basic, no query engine)
- In-memory only (not offline-first)

**Implementation:**

```typescript
// src/db/index.ts
import { createRxDatabase, addRxPlugin } from 'rxdb'
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie'

export const db = await createRxDatabase({
  name: 'claine-db',
  storage: getRxStorageDexie(),
})

// Collections
await db.addCollections({
  emails: { schema: emailSchema },
  threads: { schema: threadSchema },
  contacts: { schema: contactSchema },
  workflows: { schema: workflowSchema },
})
```

**Storage Estimates:**

- Average email size: 15 KB (with metadata)
- 100K emails = ~1.5 GB
- Chrome quota: ~60% of disk (20 GB disk → 12 GB quota)
- **Conclusion:** Well within browser limits

**Migration Strategy:**

- RxDB handles schema migrations automatically
- Version bump triggers migration hooks
- Migration files in `src/db/migrations/`

**RxDB Schema Definitions:**

All schemas are defined in `src/services/database/schemas/` and follow RxDB JSON Schema specification (draft-07 compatible).

**Schema Design Philosophy:**

- **Store PARSED data, not raw API responses** - Provider adapters transform API responses into schema format
- **Provider-agnostic** - Works with Gmail, Outlook, IMAP after adapter layer parsing
- **Structured types** - EmailAddress `{ name, email }`, EmailBody `{ html?, text? }`, Attachment metadata
- **Aligns with standards** - RFC 5322 email format, DefinitelyTyped patterns, industry best practices

_Email Schema (`email.schema.ts`)_ - **Enhanced with Structured Types**

- **Core Fields (Structured):**
  - `from: EmailAddress` - Sender with display name and email (RFC 5322 compliant)
  - `to: EmailAddress[]` - Recipients with names and emails
  - `cc/bcc: EmailAddress[]` - Optional CC/BCC with structured addresses
  - `body: EmailBody` - Dual format: `{ html?: string, text?: string }` for accessibility
  - `attachments: Attachment[]` - Full MIME metadata: id, filename, mimeType, size, isInline, contentId
- **Other Fields:** id, threadId, subject, timestamp, accountId, snippet (200 char preview)
- **Metadata:** labels[], folder, read, starred, importance (high/normal/low)
- **Custom Attributes:** Flexible `{ [key: string]: string | number | boolean | null }` for user tags (FR024)
- **AI Metadata (optional):** triageScore, priority, suggestedAttributes with confidence, reasoning (FR025)
- **Provider-Specific:** historyId (for Gmail delta sync optimization)
- **Indexes:** timestamp, folder, [accountId+timestamp], threadId
- **Storage:** ~20 KB average per email (updated estimate with structured data)

_Thread Schema (`thread.schema.ts`)_ - **Enhanced with EmailAddress**

- **Core Fields:** id, subject, messageCount, lastMessageDate, snippet, read, accountId
- **Participants:** `EmailAddress[]` - All thread participants with names (not just email strings)
- **Provider-Specific:** historyId (for Gmail delta sync)
- **Indexes:** lastMessageDate, [accountId+lastMessageDate]
- **Purpose:** Groups related emails into conversations for efficient threading UI

_Workflow Schema (`workflow.schema.ts`)_

- **Metadata:** id, name, description, enabled, createdAt, updatedAt, executionCount, lastExecutedAt
- **Nodes:** Array of workflow nodes with `{ id, type, position: { x, y }, data: {} }`
  - Node types: trigger, condition, action, decision, variable, screen-flow
- **Edges:** Array of connections with `{ id, source, target, sourceHandle?, targetHandle? }`
- **Triggers:** Array of trigger configurations with `{ type, config: {} }`
- **Indexes:** enabled (for querying active workflows)
- **Purpose:** Visual workflow engine for email automation with AI-enhanced decisions

_AI Metadata Schema (`aiMetadata.schema.ts`)_

- **Fields:** id, emailId (foreign key), triageScore, priority, suggestedAttributes, confidence, reasoning, modelVersion, processedAt
- **Indexes:** emailId, processedAt, modelVersion
- **Purpose:** Detailed AI processing history separate from emails for analytics and evolution tracking
- **Note:** Emails have embedded aiMetadata for convenience; this collection stores comprehensive processing history

**Adapter Pattern for Provider Integration:**

Schemas store PARSED data. Provider adapters (Gmail, Outlook, IMAP) must transform API responses:

_Gmail API Adapter Flow (Story 1.4):_

```
1. Fetch: threads.get(id, format='FULL')
2. Parse headers: "Jules Wilcke <jules@example.com>" → { name: "Jules Wilcke", email: "jules@example.com" }
3. Extract body: multipart/alternative parts → { html: "...", text: "..." }
4. Decode: Base64 body.data → UTF-8 strings
5. Map attachments: parts with filename → Attachment[]
6. Insert: Parsed EmailDocument → RxDB
```

_Libraries for Parsing:_

- Email addresses: `email-addresses` or `addressparser` (RFC 5322 parser)
- MIME parts: Built-in Gmail API structure traversal
- Base64 decode: `atob()` (browser native)

**Gmail API Compatibility (Validated 2025-11-10):**

- ✅ `threads.list()` → Thread metadata (need `threads.get()` for full data)
- ✅ `threads.get(METADATA)` → Email headers (need `FULL` for body)
- ✅ `threads.get(FULL)` → Complete email with body and attachments
- ✅ `historyId` field → Direct mapping for delta sync
- ✅ `internalDate` → timestamp (already Unix ms)
- ✅ `labelIds` → labels array
- ✅ Multipart MIME → EmailBody { html, text }
- ✅ Attachment parts → Attachment metadata

**Index Strategy Notes:**

- Array fields (labels, participants, triggers) cannot be directly indexed in RxDB
- Optional nested fields (aiMetadata.priority) cannot be indexed
- Application-level filtering used for these cases
- All indexed number fields require minimum/maximum constraints per RxDB validation

**Performance Validation (NFR001):**

- Common queries (<50ms target with 100K emails):
  - Inbox view by timestamp: ✓ Indexed
  - Filter by folder: ✓ Indexed
  - Thread grouping: ✓ Indexed
  - Multi-account filtering: ✓ Compound indexes
- Label/participant filtering: Application-level (no native array indexing)

**Storage Validation (NFR004):**

- Average email size: ~20 KB (with structured EmailAddress, dual body format, attachment metadata)
- 100K emails: ~2 GB total
- Browser IndexedDB quota: ~60% of disk space (typically 12+ GB on 20 GB disk)
- Conclusion: Well within browser storage limits

---

### Decision 2: State Management (Zustand)

**Decision:** Use Zustand v5.x for global state management.

**Context:**

- Need reactive state updates across components
- PWA architecture (no Electron IPC complexity)
- TypeScript support required
- Prefer simple, lightweight solution

**Options Considered:**

- **Zustand** ✅ Selected (simple, TypeScript-first, no boilerplate)
- Redux Toolkit (too complex for PWA)
- Jotai (atom-based, prefer unified store)
- Context API only (too manual, no devtools)

**Implementation:**

```typescript
// src/features/email/store/email.store.ts
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface EmailStore {
  emails: Email[]
  selectedId: string | null
  isLoading: boolean
  setEmails: (emails: Email[]) => void
  setSelectedId: (id: string | null) => void
}

export const useEmailStore = create<EmailStore>()(
  devtools(
    (set) => ({
      emails: [],
      selectedId: null,
      isLoading: false,
      setEmails: (emails) => set({ emails }),
      setSelectedId: (selectedId) => set({ selectedId }),
    }),
    { name: 'email-store' }
  )
)
```

**Store Organization:**

- Feature-based slices (`email.store.ts`, `ai.store.ts`, `workflow.store.ts`)
- No combined root store (each feature manages its own)
- DevTools enabled for debugging

---

### Decision 3: UI Styling (TailwindCSS v4 + shadcn/ui)

**Decision:** Use TailwindCSS v4.0 (Oxide engine) with shadcn/ui components.

**Context:**

- Need fast builds (sub-50ms UI requirement)
- Accessible components required
- Consistent design system
- TypeScript-native component library

**Options Considered:**

- **TailwindCSS v4 + shadcn/ui** ✅ Selected
- Chakra UI (slower builds, more runtime overhead)
- Material UI (too opinionated, heavy)
- Plain CSS Modules (too manual, no design system)

**Implementation:**

```bash
# Install Tailwind v4
npm install tailwindcss@next @tailwindcss/postcss@next -D

# Initialize shadcn/ui
npx shadcn@latest init

# Add components as needed
npx shadcn@latest add button
npx shadcn@latest add input
npx shadcn@latest add dialog
```

**TailwindCSS v4 Benefits:**

- **5x faster builds** (Rust Oxide engine vs JavaScript v3)
- **Smaller bundle size** (no PurgeCSS needed)
- **CSS-first config** (migrate from `tailwind.config.js` to `@theme` in CSS)

**shadcn/ui Benefits:**

- Components copied to project (not npm dependency)
- Full customization control
- Built on Radix UI (ARIA-compliant)
- TypeScript-native

---

### Decision 4: Local AI (ONNX Runtime Web + Llama 3.1 8B)

**Decision:** Use ONNX Runtime Web with Llama 3.1 8B quantized model for local AI inference.

**Context:**

- Privacy-first requirement (no cloud AI)
- Browser-compatible local inference
- Acceptable performance for triage/compose
- Model size constraints (~4 GB quantized)

**Options Considered:**

- **ONNX Runtime Web + Llama 3.1 8B** ✅ Selected
- TensorFlow.js (less efficient for LLMs)
- WebGPU + custom inference (too complex)
- Cloud API only (violates privacy requirement)

**Implementation:**

```typescript
// src/features/ai/services/onnx-inference.service.ts
import * as ort from 'onnxruntime-web'

class OnnxInferenceService {
  private session: ort.InferenceSession | null = null

  async loadModel(modelPath: string) {
    this.session = await ort.InferenceSession.create(modelPath, {
      executionProviders: ['webgpu', 'wasm'],
    })
  }

  async infer(inputText: string): Promise<string> {
    // Tokenize, run inference, decode
    // Implementation details in Phase 3
  }
}
```

**Model Caching:**

- Store model in Cache Storage API (`claine-models-v1`)
- Load on first use, cache indefinitely
- Lazy loading (not on app startup)

**Performance Expectations:**

- Model load: ~5-10 seconds (first time)
- Inference: ~500ms-2s per email (acceptable for background triage)
- WebGPU acceleration where available

---

### Decision 5: Email Sync (Gmail API)

**Decision:** Use Gmail API with OAuth 2.0 PKCE for email synchronization (Phase 1: Gmail only).

**Context:**

- Gmail-focused initially (highest market share)
- CASA audit required for both Gmail API and IMAP (no cost advantage)
- Gmail API provides better performance and native features
- Phase 2 will add Outlook and IMAP

**Options Considered:**

- **Gmail API** ✅ Selected (Phase 1)
- IMAP (no performance advantage, CASA audit still required)
- Outlook Graph API (Phase 2)
- JMAP (Phase 2+ for generic IMAP)

**Implementation:**

```typescript
// src/features/email/services/gmail-api.service.ts
import { gmail_v1, google } from '@googleapis/gmail'

class GmailApiService {
  private client: gmail_v1.Gmail

  async syncMessages(historyId?: string): Promise<Email[]> {
    if (historyId) {
      // Delta sync using history API
      return this.syncDelta(historyId)
    } else {
      // Initial full sync
      return this.syncFull()
    }
  }

  private async syncDelta(historyId: string): Promise<Email[]> {
    const response = await this.client.users.history.list({
      userId: 'me',
      startHistoryId: historyId,
    })
    // Process incremental changes
  }

  private async syncFull(): Promise<Email[]> {
    const response = await this.client.users.messages.list({
      userId: 'me',
      maxResults: 500,
    })
    // Fetch full messages in batches
  }
}
```

**Sync Strategy:**

- **Initial sync:** Full message list + batch fetch (500 messages at a time)
- **Delta sync:** History API every 2 minutes (incremental changes only)
- **Background sync:** Service Worker sync when offline
- **Conflict resolution:** Server wins (Gmail API is source of truth)

**OAuth PKCE Flow:**

```typescript
// src/features/auth/services/gmail-oauth.service.ts
class GmailOauthService {
  async startAuthFlow() {
    const codeVerifier = this.generateCodeVerifier()
    const codeChallenge = await this.generateCodeChallenge(codeVerifier)

    // Store verifier for later
    sessionStorage.setItem('pkce_verifier', codeVerifier)

    // Redirect to Google OAuth
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`
    window.location.href = authUrl
  }

  async handleCallback(code: string) {
    const codeVerifier = sessionStorage.getItem('pkce_verifier')
    const tokens = await this.exchangeCodeForTokens(code, codeVerifier)

    // Encrypt and store tokens in IndexedDB
    await this.storeTokens(tokens)
  }
}
```

**CASA Audit Considerations:**

- Required for Gmail API restricted scopes (`gmail.modify`, `gmail.readonly`)
- Annual cost: $540 minimum
- Sandboxed PWA architecture simplifies audit
- Phase 1 only (Gmail), Phase 2 adds Outlook/IMAP

---

### Decision 6: Deployment (Vercel)

**Decision:** Deploy as PWA on Vercel with Service Workers for offline capability.

**Context:**

- PWA-first architecture
- Need edge caching for optimal performance
- Service Workers required for offline support
- Automatic HTTPS required for PWA

**Options Considered:**

- **Vercel** ✅ Selected (optimal for PWAs, edge caching, free tier)
- Netlify (similar, but Vercel has better React/Vite integration)
- AWS Amplify (overkill, more complex)
- Self-hosted (more work, no edge caching)

**Implementation:**

```javascript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt', 'icons/*.png'],
      manifest: {
        name: 'Claine - AI Email Client',
        short_name: 'Claine',
        theme_color: '#000000',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/www\.googleapis\.com\/gmail\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'gmail-api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
            },
          },
        ],
      },
    }),
  ],
})
```

**Service Worker Strategy:**

- **Static assets:** Cache-first (app shell)
- **Gmail API:** Network-first with fallback (fresh data priority)
- **Attachments:** Cache-first (large files)
- **AI models:** Cache-only (too large to refetch)

**Vercel Configuration:**

```json
// vercel.json
{
  "headers": [
    {
      "source": "/sw.js",
      "headers": [
        {
          "key": "Service-Worker-Allowed",
          "value": "/"
        }
      ]
    }
  ]
}
```

---

### Decision 7: Testing Strategy

**Decision:** Use Vitest for unit tests and Playwright for E2E tests.

**Context:**

- Vite-native test runner preferred
- PWA E2E testing required
- Fast test execution for CI/CD
- TypeScript support required

**Options Considered:**

- **Vitest + Playwright** ✅ Selected
- Jest + Cypress (slower, not Vite-native)
- Vitest + Puppeteer (Playwright has better PWA support)

**Implementation:**

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './tests/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['**/node_modules/**', '**/tests/**'],
    },
  },
})
```

```typescript
// tests/e2e/email-list.spec.ts
import { test, expect } from '@playwright/test'

test('loads inbox and displays emails', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.email-list')).toBeVisible()
  await expect(page.locator('.email-item')).toHaveCount(20)
})
```

**Test Coverage Targets:**

- Unit tests: 80% coverage
- E2E tests: Critical user paths (login, read email, compose, send)
- Integration tests: Service Worker, RxDB, Gmail API mocks

---

## Cross-Cutting Concerns

### Error Handling

**Strategy:** Consistent error handling with user-friendly messages and logging.

**Implementation:**

```typescript
// src/shared/types/result.types.ts
export type Result<T, E = Error> = { success: true; data: T } | { success: false; error: E }

// src/shared/services/logger.service.ts
class Logger {
  error(message: string, error: unknown) {
    console.error(message, error)
    // In production: send to Sentry
  }
}

export const logger = new Logger()
```

**Error Display:**

- Toast notifications for user-facing errors
- Console logging for development
- Error tracking service (Sentry) for production

### Performance Monitoring

**Strategy:** Track key performance metrics and optimize bottlenecks.

**Metrics:**

- **LCP (Largest Contentful Paint):** < 2.5s
- **FID (First Input Delay):** < 100ms
- **CLS (Cumulative Layout Shift):** < 0.1
- **Email list render time:** < 50ms

**Implementation:**

```typescript
// src/shared/services/performance.service.ts
class PerformanceService {
  measureRender(name: string) {
    performance.mark(`${name}-start`)

    return () => {
      performance.mark(`${name}-end`)
      performance.measure(name, `${name}-start`, `${name}-end`)
      const measure = performance.getEntriesByName(name)[0]
      logger.debug(`${name} took ${measure.duration}ms`)
    }
  }
}
```

**Optimization Techniques:**

- Virtual scrolling for email lists (React Virtual)
- Lazy loading for routes and components
- Code splitting for AI models
- Memoization for expensive computations

### Security

**Strategy:** Defense in depth with encryption, sanitization, and CSP.

**Token Security:**

```typescript
// src/features/auth/services/token-storage.service.ts
import { encrypt, decrypt } from '@shared/utils/crypto.util'

class TokenStorageService {
  async storeTokens(tokens: OAuthTokens) {
    const encrypted = await encrypt(JSON.stringify(tokens))
    await db.settings.upsert({
      id: 'auth_tokens',
      value: encrypted,
    })
  }

  async getTokens(): Promise<OAuthTokens | null> {
    const doc = await db.settings.findOne('auth_tokens').exec()
    if (!doc) return null
    const decrypted = await decrypt(doc.value)
    return JSON.parse(decrypted)
  }
}
```

**HTML Sanitization:**

```typescript
// src/features/email/utils/sanitize-html.util.ts
import DOMPurify from 'dompurify'

export function sanitizeEmailHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'a', 'img'],
    ALLOWED_ATTR: ['href', 'src', 'alt'],
  })
}
```

**Content Security Policy:**

```html
<!-- index.html -->
<meta
  http-equiv="Content-Security-Policy"
  content="default-src 'self';
               script-src 'self' 'wasm-unsafe-eval';
               style-src 'self' 'unsafe-inline';
               img-src 'self' data: https:;
               connect-src 'self' https://www.googleapis.com;"
/>
```

### Caching Strategy

**Layers:**

1. **Memory Cache (Zustand):** Current session state
2. **IndexedDB (RxDB):** Persistent email/thread storage
3. **Cache Storage:** Static assets, attachments, AI models
4. **Service Worker:** Offline-first network requests

**Cache Invalidation:**

- Gmail API: Delta sync every 2 minutes (history API)
- Static assets: Version-based (`claine-v1`, `claine-v2`)
- Attachments: Never expire (immutable)
- AI models: Never expire (user-initiated update)

### Attachment Handling

**Storage:**

```typescript
// src/features/email/services/attachment-cache.service.ts
class AttachmentCacheService {
  async cacheAttachment(id: string, blob: Blob) {
    const cache = await caches.open('claine-attachments-v1')
    await cache.put(`/attachments/${id}`, new Response(blob))
  }

  async getAttachment(id: string): Promise<Blob | null> {
    const cache = await caches.open('claine-attachments-v1')
    const response = await cache.match(`/attachments/${id}`)
    return response ? await response.blob() : null
  }
}
```

**Size Limits:**

- Individual attachment: 25 MB (Gmail limit)
- Total cache: 5 GB (conservative estimate)
- Lazy loading: Download on demand, not on sync

### Search Implementation

**Strategy:** Client-side full-text search using Lunr.js.

**Implementation:**

```typescript
// src/features/email/services/email-search.service.ts
import lunr from 'lunr'

class EmailSearchService {
  private index: lunr.Index | null = null

  buildIndex(emails: Email[]) {
    this.index = lunr(function () {
      this.ref('id')
      this.field('subject')
      this.field('from')
      this.field('body')

      emails.forEach((email) => this.add(email))
    })
  }

  search(query: string): Email[] {
    if (!this.index) return []
    const results = this.index.search(query)
    return results.map((r) => emails.find((e) => e.id === r.ref))
  }
}
```

**Index Management:**

- Build index on initial sync
- Incremental updates on new emails
- Rebuild weekly (background task)
- Store index in IndexedDB for persistence

---

## Project Structure

### Folder Organization

```
claine-rebuild-v2/
├── public/                          # Static assets, PWA manifest
│   ├── manifest.json               # PWA manifest
│   ├── icons/                      # App icons (192x192, 512x512)
│   └── models/                     # Cached AI models (ONNX)
├── src/
│   ├── features/                   # Feature-based organization
│   │   ├── email/                  # Email domain
│   │   │   ├── components/         # Email UI components
│   │   │   ├── hooks/              # Email-specific hooks
│   │   │   ├── services/           # Email business logic
│   │   │   ├── store/              # Email Zustand slices
│   │   │   ├── types/              # Email TypeScript types
│   │   │   └── utils/              # Email utilities
│   │   ├── ai/                     # AI domain
│   │   │   ├── components/         # AI UI components
│   │   │   ├── services/           # AI inference, triage
│   │   │   ├── store/              # AI state slices
│   │   │   ├── types/              # AI types
│   │   │   └── utils/              # AI utilities
│   │   ├── workflow/               # Workflow engine domain
│   │   │   ├── components/         # Workflow UI
│   │   │   ├── engine/             # Workflow execution
│   │   │   ├── store/              # Workflow state
│   │   │   ├── types/              # Workflow types
│   │   │   └── utils/              # Workflow utilities
│   │   └── auth/                   # Authentication domain
│   │       ├── components/         # Auth UI
│   │       ├── services/           # OAuth, token management
│   │       ├── store/              # Auth state
│   │       └── types/              # Auth types
│   ├── shared/                     # Shared across features
│   │   ├── components/             # UI components (Button, Input)
│   │   ├── hooks/                  # Shared hooks
│   │   ├── services/               # Shared services
│   │   ├── store/                  # Root Zustand store
│   │   ├── types/                  # Global types
│   │   └── utils/                  # Global utilities
│   ├── workers/                    # Service Workers
│   │   ├── sw.ts                   # Main service worker
│   │   ├── sync-worker.ts          # Background sync worker
│   │   └── ai-worker.ts            # AI inference worker (if needed)
│   ├── db/                         # RxDB schemas and migrations
│   │   ├── schemas/                # RxDB schemas
│   │   │   ├── email.schema.ts
│   │   │   ├── thread.schema.ts
│   │   │   ├── contact.schema.ts
│   │   │   └── workflow.schema.ts
│   │   ├── migrations/             # Schema migrations
│   │   └── index.ts                # Database initialization
│   ├── routes/                     # React Router routes
│   │   ├── index.tsx               # Route definitions
│   │   └── guards/                 # Route guards (auth)
│   ├── App.tsx                     # Root component
│   ├── main.tsx                    # App entry point
│   └── vite-env.d.ts               # Vite types
├── tests/
│   ├── unit/                       # Vitest unit tests
│   ├── e2e/                        # Playwright E2E tests
│   └── fixtures/                   # Test fixtures
├── vite.config.ts                  # Vite configuration
├── tailwind.config.ts              # Tailwind configuration
├── tsconfig.json                   # TypeScript configuration
└── package.json                    # Dependencies
```

### Module Boundaries

**Rule 1: Feature Isolation**

- Features are self-contained domains (`email/`, `ai/`, `workflow/`, `auth/`)
- Features can import from `shared/` but NOT from other features
- Cross-feature communication ONLY through Zustand store or events

**Rule 2: Layer Dependencies**

- Components can import: hooks, services, store, types, utils (same feature)
- Services can import: store, types, utils (same feature)
- Store can import: types (same feature)
- Types and utils are leaf nodes (no internal imports)

**Rule 3: Database Access**

- ONLY services can access RxDB collections
- Components access data through Zustand store or hooks
- No direct RxDB queries in components

### Import Conventions

**TypeScript Path Aliases:**

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@features/*": ["./src/features/*"],
      "@shared/*": ["./src/shared/*"],
      "@db/*": ["./src/db/*"],
      "@workers/*": ["./src/workers/*"]
    }
  }
}
```

**Import Examples:**

```typescript
// Components
import { Button } from '@shared/components/Button'
import { EmailList } from '@features/email/components/EmailList'

// Services
import { gmailSyncService } from '@features/email/services/gmail-sync.service'

// Hooks
import { useEmailSync } from '@features/email/hooks/use-email-sync'

// Store
import { useEmailStore } from '@features/email/store/email.store'

// Types
import type { Email, Thread } from '@features/email/types/email.types'

// Database
import { emailSchema } from '@db/schemas/email.schema'
```

---

## Implementation Patterns

These patterns prevent AI agents from making inconsistent decisions during development.

### 1. Naming Patterns

**React Components:**

- Component files: `PascalCase.tsx` (e.g., `EmailList.tsx`)
- Component props: `{ComponentName}Props` (e.g., `EmailListProps`)
- Event handlers: `handle{Action}` (e.g., `handleSendEmail`)
- Boolean props: `is{State}`, `has{Feature}`, `should{Action}`

**Services:**

- Service files: `{domain}-{purpose}.service.ts` (e.g., `gmail-sync.service.ts`)
- Service exports: `{domain}{Purpose}Service` (e.g., `gmailSyncService`)

**Zustand Stores:**

- Store hooks: `use{Domain}Store` (e.g., `useEmailStore`)
- Store files: `{domain}.store.ts` (e.g., `email.store.ts`)
- Store actions: imperative verbs (e.g., `setEmails`, `addEmail`)

**Database:**

- Collections: plural lowercase (e.g., `emails`, `threads`)
- Schemas: `{entity}.schema.ts` (e.g., `email.schema.ts`)
- Migrations: `YYYYMMDD-{description}.migration.ts`

**Hooks:**

- Custom hooks: `use{Purpose}` (e.g., `useEmailSync`)
- Hook files: `use-{purpose}.ts` (e.g., `use-email-sync.ts`)

**Constants:**

- Global constants: `SCREAMING_SNAKE_CASE` (e.g., `MAX_ATTACHMENT_SIZE`)

### 2. Structure Patterns

**Feature Organization:**

```
src/features/{domain}/
├── components/        # UI components
├── hooks/            # Custom hooks
├── services/         # Business logic
├── store/            # State management
├── types/            # TypeScript types
└── utils/            # Domain utilities
```

**Shared Code:**

- Shared components → `src/shared/components/`
- Shared hooks → `src/shared/hooks/`
- Shared services → `src/shared/services/`

### 3. Format Patterns

**API Responses:**

```typescript
type Result<T, E = Error> = { success: true; data: T } | { success: false; error: E }
```

**Dates:**

- Store as Unix timestamps (milliseconds)
- Format with `date-fns`
- Always UTC in database, local for display

**Errors:**

```typescript
interface AppError {
  code: string // e.g., 'SYNC_FAILED'
  message: string // User-friendly
  details?: unknown // Technical details
  timestamp: number // Unix timestamp
  retryable: boolean // Can retry?
}
```

### 4. Communication Patterns

**Component → Store:**

- Components call store actions directly
- Store actions are synchronous
- No business logic in actions

**Component → Service:**

- Components use custom hooks
- Hooks wrap service calls
- Hooks update store with results

**Service → Database:**

- Services access RxDB directly
- No direct DB access from components

**Cross-Feature:**

- Only through Zustand or custom events
- No direct imports between features

### 5. Lifecycle Patterns

**Component Lifecycle:**

```typescript
export const Component = () => {
  // 1. Store hooks
  const { state } = useStore()

  // 2. Custom hooks
  const { action } = useCustomHook()

  // 3. React hooks
  useEffect(() => {}, [])

  // 4. Event handlers
  const handleClick = () => {}

  // 5. Render
  return <div />
}
```

**Service Worker Lifecycle:**

- Install: Cache static assets
- Activate: Clean old caches
- Fetch: Cache-first or network-first
- Sync: Background sync events

**OAuth Token Lifecycle:**

- Refresh 5 minutes before expiry
- Handle failures → re-auth
- Store encrypted in IndexedDB

### 6. Location Patterns

**Routes:**

- `/` → Inbox (default)
- `/inbox` → Inbox view
- `/sent` → Sent view
- `/drafts` → Drafts view
- `/search` → Search results
- `/email/:id` → Email detail
- `/compose` → New email
- `/settings` → Settings
- `/auth/callback` → OAuth callback

**Local Storage:**

- Prefix all keys: `claine_{key}`
- `claine_auth_tokens` → OAuth tokens
- `claine_user_profile` → User profile
- `claine_settings` → App settings

**IndexedDB:**

- Database: `claine-db`
- Collections: `emails`, `threads`, `contacts`, `workflows`

**Cache Storage:**

- Static: `claine-v{version}`
- Attachments: `claine-attachments-v{version}`
- Models: `claine-models-v{version}`

### 7. Consistency Patterns

**Error Handling:**

```typescript
try {
  const result = await service.action()
  if (!result.success) {
    logger.error('Action failed', result.error)
    toast.error(result.error.message)
  }
} catch (error) {
  logger.error('Unexpected error', error)
  toast.error('An unexpected error occurred')
}
```

**Loading States:**

- Always show loading indicators
- Skeleton screens for initial load
- Spinners for user actions
- Progress bars for long operations

**Empty States:**

- Show message when no data
- Provide action to resolve

**Optimistic Updates:**

- Update UI immediately
- Revert if server fails

**Date Formatting:**

- Today: "9:32 AM"
- This week: "Monday 9:32 AM"
- This year: "Jan 15 9:32 AM"
- Older: "Jan 15, 2024"

---

## Novel Patterns

This section documents unique architectural patterns for features that don't have standard solutions. These patterns are designed specifically for Claine's Visual Workflow Engine (Epic 5).

### Visual Workflow Engine Pattern

**Context:**
Epic 5 requires a visual drag-and-drop workflow builder for email automation. This is a novel feature combining:

- Node-based visual editor (like Zapier, n8n)
- Deterministic execution using email attributes
- AI-enhanced decision nodes
- Offline-first execution (no cloud dependency)

**Pattern Purpose:**
Provide a clear architectural pattern for implementing the workflow engine so AI agents building different stories (5.1-5.12) create compatible, coherent components.

### Workflow Data Model

**RxDB Schema:**

```typescript
// src/db/schemas/workflow.schema.ts
export const workflowSchema: RxJsonSchema<Workflow> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    name: { type: 'string' },
    description: { type: 'string' },
    enabled: { type: 'boolean' },
    createdAt: { type: 'number' },
    updatedAt: { type: 'number' },

    // Visual editor state
    nodes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          type: { type: 'string' }, // 'trigger' | 'condition' | 'action' | 'decision' | 'variable'
          position: {
            type: 'object',
            properties: {
              x: { type: 'number' },
              y: { type: 'number' },
            },
          },
          data: { type: 'object' }, // Node-specific configuration
        },
      },
    },

    edges: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          source: { type: 'string' }, // Source node ID
          target: { type: 'string' }, // Target node ID
          sourceHandle: { type: 'string' }, // For branching (true/false)
          targetHandle: { type: 'string' },
        },
      },
    },

    // Execution metadata
    lastExecutedAt: { type: 'number' },
    executionCount: { type: 'number' },
  },
  required: ['id', 'name', 'enabled', 'nodes', 'edges'],
  indexes: ['enabled', 'updatedAt'],
}
```

**Workflow Execution Log Schema:**

```typescript
// src/db/schemas/workflow-execution.schema.ts
export const workflowExecutionSchema: RxJsonSchema<WorkflowExecution> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string' },
    workflowId: { type: 'string' },
    emailId: { type: 'string' },
    startedAt: { type: 'number' },
    completedAt: { type: 'number' },
    status: { type: 'string' }, // 'success' | 'failed' | 'running'

    // Execution trace (for debugging)
    nodeExecutions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          nodeId: { type: 'string' },
          nodeType: { type: 'string' },
          executedAt: { type: 'number' },
          result: { type: 'string' }, // 'passed' | 'failed' | 'skipped'
          output: { type: 'object' }, // Node output data
          error: { type: 'string' }, // Error message if failed
        },
      },
    },

    error: { type: 'string' },
  },
  required: ['id', 'workflowId', 'emailId', 'startedAt', 'status'],
  indexes: ['workflowId', 'emailId', 'startedAt'],
}
```

### Workflow Node Types

**Node Type Definitions:**

```typescript
// src/features/workflow/types/workflow.types.ts

export type WorkflowNodeType = 'trigger' | 'condition' | 'action' | 'decision' | 'variable'

export interface BaseNode {
  id: string
  type: WorkflowNodeType
  position: { x: number; y: number }
}

// Trigger Node (green) - Entry point
export interface TriggerNode extends BaseNode {
  type: 'trigger'
  data: {
    triggerType: 'email_arrives' | 'attribute_changes' | 'schedule'
    config: EmailArrivesTrigger | AttributeChangesTrigger | ScheduleTrigger
  }
}

export interface EmailArrivesTrigger {
  labels?: string[] // Watch specific Gmail labels
  folders?: string[] // Watch specific folders
  senders?: string[] // Filter by sender email/domain
}

export interface AttributeChangesTrigger {
  attributeName: string // e.g., 'Status'
  fromValue?: string // Optional: only trigger if changing FROM this value
  toValue?: string // Optional: only trigger if changing TO this value
}

export interface ScheduleTrigger {
  cron: string // Cron expression (e.g., '0 9 * * *' for 9am daily)
  timezone: string // User timezone
}

// Condition Node (yellow) - Branching logic
export interface ConditionNode extends BaseNode {
  type: 'condition'
  data: {
    conditions: Condition[]
    logic: 'AND' | 'OR' // How to combine multiple conditions
  }
}

export interface Condition {
  type: 'attribute' | 'sender' | 'content'
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than'
  value: string
  // For attribute type:
  attributeName?: string
  // For content type:
  contentField?: 'subject' | 'body'
}

// Action Node (blue) - Execute task
export interface ActionNode extends BaseNode {
  type: 'action'
  data: {
    actionType:
      | 'apply_attribute'
      | 'archive'
      | 'delete'
      | 'label'
      | 'move_folder'
      | 'mark_read'
      | 'mark_unread'
    config:
      | ApplyAttributeAction
      | ArchiveAction
      | DeleteAction
      | LabelAction
      | MoveFolderAction
      | MarkReadAction
  }
}

export interface ApplyAttributeAction {
  attributeName: string
  attributeValue: string
}

export interface LabelAction {
  labelName: string
}

export interface MoveFolderAction {
  folderName: string
}

// Decision Node (purple) - AI-powered branching
export interface DecisionNode extends BaseNode {
  type: 'decision'
  data: {
    question: string // AI prompt (e.g., "Does this email need immediate response?")
    confidenceThreshold: number // Minimum confidence to execute (0-1)
    defaultPath: 'true' | 'false' // Fallback if AI fails or low confidence
  }
}

// Variable Node (gray) - Extract data
export interface VariableNode extends BaseNode {
  type: 'variable'
  data: {
    variableName: string // e.g., 'senderName', 'subject'
    source: 'sender' | 'subject' | 'body' | 'date' | 'custom'
    extractionPattern?: string // Regex pattern for custom extraction
  }
}

export type WorkflowNode = TriggerNode | ConditionNode | ActionNode | DecisionNode | VariableNode
```

### Workflow Execution Engine

**Execution Service Pattern:**

```typescript
// src/features/workflow/services/workflow-execution.service.ts

class WorkflowExecutionService {
  // Entry point: Execute workflow for an email
  async executeWorkflow(workflowId: string, emailId: string): Promise<WorkflowExecution> {
    const workflow = await db.workflows.findOne(workflowId).exec()
    const email = await db.emails.findOne(emailId).exec()

    // Create execution record
    const execution = await this.createExecution(workflowId, emailId)

    try {
      // Find trigger node (entry point)
      const triggerNode = workflow.nodes.find((n) => n.type === 'trigger')
      if (!triggerNode) throw new Error('No trigger node found')

      // Execute workflow graph starting from trigger
      await this.executeNode(triggerNode, workflow, email, execution)

      // Mark execution as complete
      await this.completeExecution(execution.id, 'success')
    } catch (error) {
      await this.completeExecution(execution.id, 'failed', error.message)
    }

    return execution
  }

  // Recursive node execution
  private async executeNode(
    node: WorkflowNode,
    workflow: Workflow,
    email: Email,
    execution: WorkflowExecution,
    variables: Map<string, any> = new Map()
  ): Promise<void> {
    // Log node execution start
    await this.logNodeExecution(execution.id, node.id, 'running')

    try {
      switch (node.type) {
        case 'trigger':
          // Trigger nodes don't execute, they just define entry point
          break

        case 'condition':
          const conditionResult = await this.evaluateCondition(node, email, variables)
          await this.logNodeExecution(execution.id, node.id, conditionResult ? 'passed' : 'failed')

          // Follow appropriate edge based on condition result
          const nextEdge = workflow.edges.find(
            (e) => e.source === node.id && e.sourceHandle === (conditionResult ? 'true' : 'false')
          )
          if (nextEdge) {
            const nextNode = workflow.nodes.find((n) => n.id === nextEdge.target)
            if (nextNode) await this.executeNode(nextNode, workflow, email, execution, variables)
          }
          return

        case 'action':
          await this.executeAction(node, email, variables)
          await this.logNodeExecution(execution.id, node.id, 'passed')
          break

        case 'decision':
          const aiDecision = await this.evaluateAiDecision(node, email)
          await this.logNodeExecution(execution.id, node.id, 'passed', { decision: aiDecision })

          // Follow appropriate edge based on AI decision
          const decisionEdge = workflow.edges.find(
            (e) => e.source === node.id && e.sourceHandle === (aiDecision ? 'true' : 'false')
          )
          if (decisionEdge) {
            const nextNode = workflow.nodes.find((n) => n.id === decisionEdge.target)
            if (nextNode) await this.executeNode(nextNode, workflow, email, execution, variables)
          }
          return

        case 'variable':
          const value = await this.extractVariable(node, email)
          variables.set(node.data.variableName, value)
          await this.logNodeExecution(execution.id, node.id, 'passed', { value })
          break
      }

      // Find next node(s) and execute
      const outgoingEdges = workflow.edges.filter((e) => e.source === node.id)
      for (const edge of outgoingEdges) {
        const nextNode = workflow.nodes.find((n) => n.id === edge.target)
        if (nextNode) {
          await this.executeNode(nextNode, workflow, email, execution, variables)
        }
      }
    } catch (error) {
      await this.logNodeExecution(execution.id, node.id, 'failed', { error: error.message })
      throw error
    }
  }

  // Condition evaluation
  private async evaluateCondition(
    node: ConditionNode,
    email: Email,
    variables: Map<string, any>
  ): Promise<boolean> {
    const results = await Promise.all(
      node.data.conditions.map((c) => this.evaluateSingleCondition(c, email, variables))
    )

    return node.data.logic === 'AND' ? results.every((r) => r) : results.some((r) => r)
  }

  private async evaluateSingleCondition(
    condition: Condition,
    email: Email,
    variables: Map<string, any>
  ): Promise<boolean> {
    let actualValue: string

    switch (condition.type) {
      case 'attribute':
        // Get attribute value from email attributes
        actualValue = email.attributes?.[condition.attributeName] || ''
        break
      case 'sender':
        actualValue = email.from
        break
      case 'content':
        actualValue = condition.contentField === 'subject' ? email.subject : email.body
        break
    }

    // Apply operator
    switch (condition.operator) {
      case 'equals':
        return actualValue === condition.value
      case 'not_equals':
        return actualValue !== condition.value
      case 'contains':
        return actualValue.includes(condition.value)
      case 'greater_than':
        return actualValue > condition.value
      case 'less_than':
        return actualValue < condition.value
      default:
        return false
    }
  }

  // Action execution
  private async executeAction(
    node: ActionNode,
    email: Email,
    variables: Map<string, any>
  ): Promise<void> {
    switch (node.data.actionType) {
      case 'apply_attribute':
        const config = node.data.config as ApplyAttributeAction
        await emailAttributeService.setEmailAttribute(
          email.id,
          config.attributeName,
          config.attributeValue
        )
        break

      case 'archive':
        await gmailSyncService.archiveEmail(email.id)
        break

      case 'delete':
        await gmailSyncService.deleteEmail(email.id)
        break

      case 'label':
        const labelConfig = node.data.config as LabelAction
        await gmailSyncService.applyLabel(email.id, labelConfig.labelName)
        break

      case 'move_folder':
        const folderConfig = node.data.config as MoveFolderAction
        await gmailSyncService.moveToFolder(email.id, folderConfig.folderName)
        break

      case 'mark_read':
        await gmailSyncService.markAsRead(email.id)
        break

      case 'mark_unread':
        await gmailSyncService.markAsUnread(email.id)
        break
    }
  }

  // AI decision evaluation
  private async evaluateAiDecision(node: DecisionNode, email: Email): Promise<boolean> {
    try {
      const result = await aiDecisionService.evaluateDecision(email, node.data.question)

      // Check confidence threshold
      if (result.confidence < node.data.confidenceThreshold) {
        // Use default path if confidence too low
        return node.data.defaultPath === 'true'
      }

      return result.decision
    } catch (error) {
      // Use default path if AI fails
      logger.error('AI decision failed, using default path', error)
      return node.data.defaultPath === 'true'
    }
  }

  // Variable extraction
  private async extractVariable(node: VariableNode, email: Email): Promise<string> {
    switch (node.data.source) {
      case 'sender':
        return email.from
      case 'subject':
        return email.subject
      case 'body':
        return email.body
      case 'date':
        return new Date(email.date).toISOString()
      case 'custom':
        // Use regex pattern to extract
        if (node.data.extractionPattern) {
          const regex = new RegExp(node.data.extractionPattern)
          const match = email.body.match(regex)
          return match ? match[1] : ''
        }
        return ''
      default:
        return ''
    }
  }
}

export const workflowExecutionService = new WorkflowExecutionService()
```

### Visual Workflow Editor

**React Flow Integration:**

```typescript
// src/features/workflow/components/WorkflowEditor.tsx
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from 'reactflow'
import 'reactflow/dist/style.css'

export const WorkflowEditor = ({ workflowId }: { workflowId: string }) => {
  const { workflow, updateWorkflow } = useWorkflowStore()
  const [nodes, setNodes] = useState<Node[]>([])
  const [edges, setEdges] = useState<Edge[]>([])

  // Load workflow from RxDB
  useEffect(() => {
    const subscription = db.workflows
      .findOne(workflowId)
      .$.subscribe(wf => {
        if (wf) {
          // Convert workflow nodes to React Flow nodes
          setNodes(wf.nodes.map(convertToReactFlowNode))
          setEdges(wf.edges.map(convertToReactFlowEdge))
        }
      })

    return () => subscription.unsubscribe()
  }, [workflowId])

  // Node palette component types
  const nodeTypes = useMemo(() => ({
    trigger: TriggerNodeComponent,
    condition: ConditionNodeComponent,
    action: ActionNodeComponent,
    decision: DecisionNodeComponent,
    variable: VariableNodeComponent,
  }), [])

  // Handle node changes (move, delete)
  const onNodesChange = useCallback((changes) => {
    setNodes((nds) => applyNodeChanges(changes, nds))
    // Sync to RxDB
    updateWorkflow(workflowId, { nodes })
  }, [nodes, workflowId])

  // Handle edge changes (connect, delete)
  const onEdgesChange = useCallback((changes) => {
    setEdges((eds) => applyEdgeChanges(changes, eds))
    // Sync to RxDB
    updateWorkflow(workflowId, { edges })
  }, [edges, workflowId])

  // Handle new connections
  const onConnect = useCallback((params) => {
    setEdges((eds) => addEdge(params, eds))
    // Sync to RxDB
    updateWorkflow(workflowId, { edges })
  }, [edges, workflowId])

  return (
    <div className="workflow-editor h-screen">
      <NodePalette />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  )
}
```

**Node Components:**

```typescript
// src/features/workflow/components/nodes/TriggerNodeComponent.tsx
export const TriggerNodeComponent = ({ data }: { data: TriggerNode['data'] }) => {
  return (
    <div className="workflow-node trigger-node border-2 border-green-500 bg-green-50 p-4 rounded-lg">
      <div className="font-semibold text-green-700">Trigger</div>
      <div className="text-sm text-gray-600">{data.triggerType}</div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  )
}

// Similar components for condition, action, decision, variable nodes
```

### Workflow Trigger System

**Background Trigger Monitoring:**

```typescript
// src/features/workflow/services/workflow-trigger.service.ts

class WorkflowTriggerService {
  // Monitor for email_arrives triggers
  async monitorEmailArrivals() {
    // Subscribe to new emails from RxDB
    db.emails.find().$.subscribe(async (emails) => {
      // Find all enabled workflows with email_arrives trigger
      const workflows = await db.workflows
        .find({
          enabled: true,
          'nodes.type': 'trigger',
          'nodes.data.triggerType': 'email_arrives',
        })
        .exec()

      for (const workflow of workflows) {
        const triggerNode = workflow.nodes.find((n) => n.type === 'trigger') as TriggerNode
        const config = triggerNode.data.config as EmailArrivesTrigger

        // Check if any new email matches trigger criteria
        for (const email of emails) {
          if (this.emailMatchesTrigger(email, config)) {
            // Execute workflow for this email
            await workflowExecutionService.executeWorkflow(workflow.id, email.id)
          }
        }
      }
    })
  }

  // Monitor for attribute_changes triggers
  async monitorAttributeChanges() {
    // Subscribe to email attribute changes
    db.emails.find().$.subscribe(async (emails) => {
      // Similar logic for attribute changes
    })
  }

  // Monitor for schedule triggers (cron)
  async monitorScheduleTriggers() {
    // Use node-cron or similar library
    // Execute workflows at scheduled times
  }

  private emailMatchesTrigger(email: Email, config: EmailArrivesTrigger): boolean {
    // Check if email matches trigger criteria
    if (config.labels && config.labels.length > 0) {
      if (!email.labels.some((l) => config.labels!.includes(l))) return false
    }
    if (config.senders && config.senders.length > 0) {
      if (!config.senders.includes(email.from)) return false
    }
    return true
  }
}

export const workflowTriggerService = new WorkflowTriggerService()
```

### Integration Points

**1. With Email Attributes (Epic 2):**

- Condition nodes read from `email.attributes` object
- Action nodes write to `email.attributes` via `emailAttributeService`
- Workflows execute based on deterministic attribute values (not AI predictions)

**2. With AI Triage (Epic 3):**

- Decision nodes use `aiDecisionService.evaluateDecision(email, question)`
- AI confidence threshold prevents unreliable branching
- Execution logs capture AI reasoning for transparency

**3. With Workflow Storage:**

- All workflows stored in RxDB `workflows` collection
- Execution logs stored in RxDB `workflow_executions` collection
- Offline-first: workflows execute even without internet

**4. With Background Workers:**

- Workflow execution runs in Web Worker (non-blocking)
- Trigger monitoring runs in Service Worker (background)
- Prevents UI freezing during complex workflow execution

### Implementation Guidelines for AI Agents

**When implementing Story 5.1 (Workflow Data Model):**

1. Create RxDB schemas exactly as defined above
2. Create TypeScript types in `src/features/workflow/types/workflow.types.ts`
3. No deviations from schema structure (ensures Story 5.2-5.12 compatibility)

**When implementing Story 5.2 (Visual Editor):**

1. Use `reactflow` library (version 11.x)
2. Store React Flow state in component, sync to RxDB on change
3. Node palette must include all 5 node types (trigger, condition, action, decision, variable)

**When implementing Story 5.3-5.7 (Nodes):**

1. Each node type gets its own component in `src/features/workflow/components/nodes/`
2. Node configuration panels use shadcn/ui Dialog components
3. All node data stored in `node.data` object (follows React Flow convention)

**When implementing Story 5.8 (Execution Engine):**

1. Use WorkflowExecutionService pattern defined above
2. Execution must be recursive (handles branching correctly)
3. All executions logged to `workflow_executions` collection

**When implementing Story 5.9-5.12 (Triggers, Templates, UI):**

1. Trigger monitoring runs in Service Worker (`src/workers/workflow-trigger-worker.ts`)
2. Workflow templates stored as JSON files in `public/workflow-templates/`
3. Execution logs displayed in reverse chronological order

### Error Handling

**Workflow Execution Errors:**

- If node execution fails: log error, stop workflow, mark execution as 'failed'
- If AI decision fails: use default path (don't fail entire workflow)
- If attribute missing: treat as empty string (don't fail)

**Editor Errors:**

- If invalid node connection: show toast error, prevent connection
- If circular dependency detected: show warning, allow but warn in execution
- If no trigger node: show error, prevent workflow enable

---

## Decision Rationale

### Why PWA over Electron?

**Analysis:**

After comprehensive comparison, PWA was selected for:

1. **Lower Resource Usage**
   - PWAs use 40-60% less memory than Electron
   - No Chromium + Node.js overhead
   - Better battery life on laptops

2. **Faster Deployment**
   - No installers required (direct URL access)
   - No code signing ($200-300/year saved)
   - Instant updates (no user download)

3. **Easier CASA Audit**
   - Sandboxed by default (browser security model)
   - No system-level access to audit
   - Lower security risk profile

4. **Future Mobile Support**
   - Same codebase works on mobile
   - iOS/Android PWA support improving
   - No separate native app needed

5. **Developer Experience**
   - Simpler architecture (no IPC complexity)
   - Faster builds (Vite optimized for web)
   - Better debugging (browser DevTools)

**Trade-offs:**

- ❌ No OS-level integrations (limited for Phase 1)
- ❌ No system tray support (use notifications)
- ✅ Can add Electron wrapper later if needed (escape hatch)

### Why Gmail API over IMAP?

**Analysis:**

Gmail API selected for Phase 1 because:

1. **CASA Audit Required for Both**
   - IMAP with OAuth requires CASA audit ($540/year)
   - Gmail API requires CASA audit ($540/year)
   - No cost advantage to IMAP

2. **Better Performance**
   - History API for delta sync (efficient)
   - Batch operations (500 messages/request)
   - Native Gmail features (labels, threads)

3. **Reliability**
   - Google-maintained SDK
   - Better error handling
   - Automatic retry logic

4. **Phase 1 Focus**
   - Gmail only for MVP
   - Phase 2 adds Outlook (Graph API) and IMAP
   - Simplifies initial implementation

### Why RxDB over Dexie?

**Analysis:**

RxDB selected for:

1. **Reactive Queries**
   - Observable-based (automatic UI updates)
   - No manual polling required
   - Better UX (real-time updates)

2. **Built-in Features**
   - Schema validation
   - Automatic migrations
   - Replication support (future)

3. **Developer Experience**
   - TypeScript-first
   - Excellent documentation
   - Active maintenance

**Trade-off:**

- Slightly larger bundle (+50 KB vs Dexie)
- Acceptable for improved DX and UX

### Why Zustand over Redux?

**Analysis:**

Zustand selected for:

1. **Simplicity**
   - No boilerplate (actions, reducers, dispatch)
   - Direct state updates
   - Easier for AI agents to understand

2. **PWA Architecture**
   - No Electron IPC complexity
   - Single-threaded (main thread only)
   - No need for Redux middleware

3. **TypeScript Support**
   - TypeScript-first design
   - Better type inference
   - Fewer type annotations needed

4. **Bundle Size**
   - ~3 KB (vs 20+ KB for Redux)
   - Important for PWA performance

### Why TailwindCSS v4?

**Analysis:**

TailwindCSS v4 selected for:

1. **Build Performance**
   - Rust Oxide engine (5x faster than v3)
   - Critical for sub-50ms UI requirement
   - Faster dev server startup

2. **Bundle Size**
   - Smaller output (no PurgeCSS needed)
   - Important for PWA load time

3. **Developer Experience**
   - CSS-first config (better IDE support)
   - Automatic CSS optimization
   - Better with Vite

4. **shadcn/ui Compatibility**
   - Fully compatible with v4
   - Future-proof choice

### Why ONNX Runtime over TensorFlow.js?

**Analysis:**

ONNX Runtime selected for:

1. **LLM Optimization**
   - Better for transformer models
   - More efficient quantization
   - WebGPU support

2. **Model Portability**
   - Standard format (ONNX)
   - Easy to swap models
   - Python → ONNX conversion well-supported

3. **Performance**
   - ~2x faster inference than TF.js
   - Lower memory usage
   - Better WebAssembly fallback

---

## Next Steps

### Immediate Actions

1. ✅ **Update technical-decisions.md**
   - Change ADR-001 from "PWA: Rejected" to "PWA: Accepted"
   - Update rationale to reflect research findings

2. ✅ **Initialize project with Vite**

   ```bash
   npm create vite@latest claine-rebuild-v2 -- --template react-ts
   ```

3. ✅ **Install dependencies**

   ```bash
   npm install rxdb zustand tailwindcss@next onnxruntime-web @googleapis/gmail
   ```

4. ✅ **Configure PWA**

   ```bash
   npm install vite-plugin-pwa -D
   ```

5. ✅ **Set up project structure**
   - Create `src/features/` folders
   - Create `src/shared/` folders
   - Create `src/db/` folders

### Phase 1 Epic Breakdown

- Epic 1: Foundation & Core Infrastructure
- Epic 2: Offline-First Email Client
- Epic 3: AI Triage & Attribute Suggestions
- Epic 4: AI-Powered Compose & Response
- Epic 5: Visual Workflow Engine
- Epic 6: Autonomous Action Engine

Refer to `docs/epics.md` for detailed stories (62-76 total).

---

## Appendix

### Technology Stack Summary

| Category       | Technology              | Version                     | Verified Date |
| -------------- | ----------------------- | --------------------------- | ------------- |
| **Platform**   | Progressive Web App     | -                           | 2025-11-01    |
| **Framework**  | Vite + React            | Vite 7.0, React 19.2        | 2025-11-01    |
| **Language**   | TypeScript              | 5.9                         | 2025-11-01    |
| **Database**   | RxDB + IndexedDB        | RxDB 16.20.0                | 2025-11-01    |
| **State**      | Zustand                 | 5.0.8                       | 2025-11-01    |
| **Styling**    | TailwindCSS + shadcn/ui | TailwindCSS 4.0.0 (stable)  | 2025-11-01    |
| **Email API**  | Gmail API               | v1                          | 2025-11-01    |
| **AI Runtime** | ONNX Runtime Web        | 1.23.0                      | 2025-11-01    |
| **AI Model**   | Llama 3.1 8B            | Quantized (Q4)              | 2025-11-01    |
| **Auth**       | OAuth 2.0 PKCE          | -                           | 2025-11-01    |
| **Testing**    | Vitest + Playwright     | Vitest 4.0, Playwright 1.56 | 2025-11-01    |
| **Deployment** | Vercel                  | -                           | 2025-11-01    |

### Key Performance Targets

- **LCP:** < 2.5s
- **FID:** < 100ms
- **CLS:** < 0.1
- **Email list render:** < 50ms
- **Email storage:** 100K emails (~1.5 GB)
- **AI inference:** 500ms-2s per email

### Compliance Requirements

- **CASA Audit:** Required for Gmail API ($540/year minimum)
- **OAuth PKCE:** Required for public PWA clients
- **CSP:** Strict Content Security Policy
- **HTTPS:** Required for PWA and Service Workers

---

**Document Version:** 1.0
**Last Updated:** 2025-11-01
**Status:** Approved

This document serves as the single source of truth for all architectural decisions. All AI agents and developers must follow these patterns to ensure consistency.
