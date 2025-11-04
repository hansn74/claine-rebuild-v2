# claine-rebuild-v2 - Epic Breakdown

**Author:** Hans
**Date:** 2025-10-29 (Last Updated: 2025-11-03)
**Project Level:** 3
**Target Scale:** Complex system - subsystems, integrations, architectural decisions
**Total Epics:** 7 (Epic 0 + 6 feature epics)
**Total Stories:** 91-95 (including Epic 0 infrastructure stories and high-priority gap resolutions)

> **Note:** Implementation technologies in this file are subject to ADR governance and may evolve independently of the PRD. See [technical-decisions.md](./technical-decisions.md) for architecture rationale.

> **Gate-Check Update (2025-11-03):** Epic 0 added per solutioning-gate-check recommendations. This infrastructure epic is **mandatory** and must complete before Epic 1 begins. See [implementation-readiness-report-2025-11-03.md](./implementation-readiness-report-2025-11-03.md) for complete gate-check findings.

---

## Overview

This document provides the detailed epic breakdown for claine-rebuild-v2, expanding on the high-level epic list in the [PRD](./PRD.md).

Each epic includes:

- Expanded goal and value proposition
- Complete story breakdown with user stories
- Acceptance criteria for each story
- Story sequencing and dependencies
- Estimated effort per story

**Epic Sequencing Principles:**

- **Epic 0** establishes complete project infrastructure and development environment (MANDATORY FIRST)
- Epic 1 establishes foundational infrastructure and initial functionality
- Subsequent epics build progressively, each delivering significant end-to-end value
- Stories within epics are vertically sliced and sequentially ordered
- No forward dependencies - each story builds only on previous work

**Epic List:**
- **Epic 0:** Infrastructure & Project Setup (10 stories, 37 hours) - **NEW - BLOCKING** ✅
- **Epic 1:** Foundation & Core Infrastructure (14+ stories) - **EXPANDED** with 5 new stories (1.3B, 1.3C, 1.4 expanded, 1.9, 1.10, 1.11, 1.12) ✅
- **Epic 2:** Offline-First Email Client with Attributes (16 stories) - **EXPANDED** with Story 2.16 (lazy loading) ✅
- **Epic 3:** AI Triage & Attribute Suggestions (14+ stories) - **EXPANDED** with Story 3.2B (AI fallback) ✅
- **Epic 4:** AI-Powered Compose & Response (8-10 stories) - unchanged
- **Epic 5:** Visual Workflow Engine & Hybrid Automation (14 stories) - **EXPANDED** with Story 5.14 (accessibility audit) ✅
- **Epic 6:** Autonomous Action Engine & Trust Building (10-12 stories) - unchanged

**Total Stories:** 91-95 (was 73)
**Added Stories:** 18-22 stories per gate-check recommendations
**All 7 Gate-Check Issues Addressed:** ✅ COMPLETE

---

## Epic 0: Infrastructure & Project Setup

### Expanded Goal

Establish the complete project infrastructure and development environment for Claine v2 before any feature development begins. This epic creates the technical foundation using the validated architecture (Vite 7.0, React 19.2, TypeScript 5.9, PWA), sets up automated testing and deployment pipelines, configures code quality tools, and ensures the development team can start building features immediately after Epic 0 completes.

**Critical Note:** This is a **prerequisite epic** that must complete before Epic 1 begins. No feature stories can be implemented until the project foundation is ready.

### Value Delivery

By the end of this epic, the development team has:
- A fully configured Vite + React + TypeScript project running locally
- Automated testing infrastructure (Vitest unit tests + Playwright E2E tests)
- CI/CD pipeline (GitHub Actions) that runs tests and builds automatically
- Deployment pipeline (Vercel) that auto-deploys on merge to main
- Code quality enforcement (ESLint, Prettier, Husky pre-commit hooks)
- Bundle size monitoring to prevent performance regressions
- Environment variable management for secure configuration
- Complete setup documentation for new developers

**Success Criteria:**
- Developer can run `npm install && npm run dev` and start coding in <5 minutes
- `npm run test` runs unit tests with coverage reporting
- `npm run test:e2e` runs Playwright E2E tests
- `npm run build` creates production bundle <500 KB initial size
- GitHub Actions CI passes on every push
- Vercel auto-deploys main branch successfully

### Story Breakdown

**Story 0.1: Initialize Vite + React + TypeScript Project**

As a developer,
I want a Vite + React + TypeScript project initialized with the correct versions,
So that I have the foundational project structure to build upon.

**Acceptance Criteria:**
1. Project created using `npm create vite@latest claine-rebuild-v2 -- --template react-ts`
2. Vite version verified as 7.0.x (latest stable)
3. React version upgraded to 19.2.x (as specified in architecture.md)
4. TypeScript version set to 5.9.x (as specified in architecture.md)
5. Project structure follows architecture.md folder organization:
   - `src/features/` (email/, ai/, workflow/, auth/)
   - `src/components/` (shared components)
   - `src/lib/` (utilities)
   - `src/db/` (database schemas)
   - `src/services/` (business logic)
6. Basic App.tsx renders "Claine v2" successfully
7. Development server runs: `npm run dev` opens http://localhost:5173

**Prerequisites:** None (first story)

**Estimated Effort:** 4 hours

---

**Story 0.2: Configure TailwindCSS 4.0 Oxide Engine + shadcn/ui**

As a developer,
I want TailwindCSS 4.0 and shadcn/ui configured,
So that I can build UI components with the chosen styling framework.

**Acceptance Criteria:**
1. TailwindCSS 4.0.x installed with Oxide engine (Rust-based, 5x faster)
2. Tailwind configuration file created (tailwind.config.ts)
3. Global CSS file imports Tailwind directives (@tailwind base, components, utilities)
4. shadcn/ui CLI installed and initialized
5. shadcn/ui configuration set to use TailwindCSS 4.0 compatible settings
6. Test: Basic Tailwind classes work (bg-blue-500, text-white, etc.)
7. Test: Import and render shadcn/ui Button component successfully
8. PostCSS configured for Tailwind processing

**Prerequisites:** Story 0.1

**Estimated Effort:** 4 hours

---

**Story 0.3: Set Up ESLint + Prettier + Husky Pre-commit Hooks**

As a developer,
I want automated code quality enforcement,
So that all code meets consistent standards before being committed.

**Acceptance Criteria:**
1. ESLint configured with TypeScript support (@typescript-eslint/parser)
2. ESLint rules configured for React 19.2 (eslint-plugin-react)
3. Prettier installed and configured
4. ESLint + Prettier integration configured (eslint-config-prettier)
5. Husky installed and pre-commit hook configured
6. Pre-commit hook runs: ESLint + Prettier on staged files
7. Pre-commit hook blocks commit if linting errors exist
8. NPM scripts added: `npm run lint`, `npm run format`
9. Test: Intentional linting error blocks commit
10. Test: `npm run lint` detects and reports issues

**Prerequisites:** Story 0.1

**Estimated Effort:** 3 hours

---

**Story 0.4: Configure Vitest 4.0 Unit Testing Infrastructure**

As a developer,
I want Vitest unit testing configured,
So that I can write and run unit tests for all components and services.

**Acceptance Criteria:**
1. Vitest 4.0.x installed as dev dependency
2. vitest.config.ts created with correct settings
3. Test environment configured (jsdom for React component testing)
4. @testing-library/react installed for component testing
5. @testing-library/jest-dom installed for DOM assertions
6. Coverage reporting configured (v8 coverage provider)
7. NPM script added: `npm run test` runs Vitest
8. NPM script added: `npm run test:coverage` generates coverage report
9. Example test file created (App.test.tsx) that passes
10. Test: `npm run test` executes successfully
11. Test: Coverage report generated in coverage/ folder

**Prerequisites:** Story 0.1

**Estimated Effort:** 4 hours

---

**Story 0.5: Configure Playwright 1.56 E2E Testing Infrastructure**

As a developer,
I want Playwright E2E testing configured,
So that I can write and run end-to-end tests for user workflows.

**Acceptance Criteria:**
1. Playwright 1.56.x installed as dev dependency
2. Playwright configuration file created (playwright.config.ts)
3. Browsers installed (Chromium, Firefox, WebKit)
4. Test folder created (e2e/ or tests/)
5. Base URL configured to point to Vite dev server (http://localhost:5173)
6. NPM script added: `npm run test:e2e` runs Playwright tests
7. NPM script added: `npm run test:e2e:ui` opens Playwright UI mode
8. Example E2E test created (app.spec.ts) that passes
9. Test: `npm run test:e2e` executes successfully
10. Test: Playwright can launch dev server and run tests

**Prerequisites:** Story 0.1

**Estimated Effort:** 4 hours

---

**Story 0.6: Set Up GitHub Actions CI/CD Pipeline**

As a developer,
I want automated CI/CD pipeline,
So that tests and builds run automatically on every push.

**Acceptance Criteria:**
1. GitHub Actions workflow file created (.github/workflows/ci.yml)
2. Workflow triggers on push to main and pull requests
3. Workflow runs on Ubuntu latest
4. Workflow installs Node.js 20.x (LTS)
5. Workflow runs: `npm install`
6. Workflow runs: `npm run lint` (fails workflow if linting errors)
7. Workflow runs: `npm run test` (fails workflow if tests fail)
8. Workflow runs: `npm run test:e2e` (fails workflow if E2E tests fail)
9. Workflow runs: `npm run build` (fails workflow if build fails)
10. Workflow uploads build artifacts
11. Test: Push to branch triggers workflow successfully
12. Test: Workflow passes with clean code

**Prerequisites:** Story 0.3, 0.4, 0.5

**Estimated Effort:** 6 hours

---

**Story 0.7: Configure Vercel Deployment Pipeline**

As a developer,
I want automatic deployment to Vercel,
So that every merge to main deploys the latest version automatically.

**Acceptance Criteria:**
1. Vercel project created and linked to GitHub repository
2. Vercel deployment configured to build with Vite (`npm run build`)
3. Vercel preview deployments enabled for pull requests
4. Vercel production deployment configured for main branch
5. Environment variables configured in Vercel dashboard (if needed for Epic 0)
6. Build output directory set to `dist/` (Vite default)
7. Test: Merge to main triggers Vercel production deployment
8. Test: Pull request creates Vercel preview deployment
9. Test: Deployed app loads successfully at Vercel URL
10. Vercel deployment URL documented in README

**Prerequisites:** Story 0.1, 0.2 (needs buildable project)

**Estimated Effort:** 4 hours

---

**Story 0.8: Set Up Environment Variable Management**

As a developer,
I want secure environment variable management,
So that sensitive configuration is not committed to the repository.

**Acceptance Criteria:**
1. .env.example file created with all required environment variables (placeholders)
2. .env added to .gitignore (prevents accidental commit)
3. Environment variable validation created (src/lib/env.ts)
4. Vite environment variable loading configured (import.meta.env)
5. Type-safe environment variable access implemented
6. README documents how to set up .env from .env.example
7. GitHub Actions uses secrets for environment variables
8. Vercel environment variables documented in README
9. Test: Missing required environment variable throws clear error
10. Test: Environment variables accessible in app code

**Prerequisites:** Story 0.1

**Estimated Effort:** 3 hours

---

**Story 0.9: Create Project README with Setup Instructions**

As a developer,
I want comprehensive setup documentation,
So that new developers can start contributing quickly.

**Acceptance Criteria:**
1. README.md includes project description and goals
2. README includes technology stack list (Vite 7.0, React 19.2, TypeScript 5.9, etc.)
3. README includes prerequisites (Node.js 20.x, npm)
4. README includes step-by-step setup instructions:
   - Clone repository
   - Install dependencies (`npm install`)
   - Copy .env.example to .env
   - Run development server (`npm run dev`)
5. README includes NPM scripts documentation (dev, build, test, lint, etc.)
6. README includes project structure explanation
7. README includes link to architecture.md and PRD.md
8. README includes contribution guidelines
9. README includes deployment instructions (Vercel)
10. Test: New developer can follow README and start app successfully

**Prerequisites:** Story 0.1-0.8 (documents all setup)

**Estimated Effort:** 2 hours

---

**Story 0.10: Configure Bundle Analysis and Size Budgets**

As a developer,
I want bundle size monitoring and budgets,
So that we prevent performance regressions from oversized bundles.

**Acceptance Criteria:**
1. vite-plugin-visualizer installed for bundle analysis
2. vite.config.ts configured to generate bundle analysis report
3. Bundle analysis report generated on build (stats.html)
4. Size budgets defined in vite.config.ts:
   - Initial bundle: <500 KB
   - Email list chunk: <200 KB
   - AI chunk: <3 MB (for ONNX runtime)
5. Build warnings displayed if budgets exceeded
6. NPM script added: `npm run analyze` generates bundle report
7. README documents how to analyze bundle size
8. Test: `npm run build` generates stats.html
9. Test: `npm run analyze` opens bundle visualization
10. Test: Intentionally large import triggers budget warning

**Prerequisites:** Story 0.1

**Estimated Effort:** 3 hours

---

### Epic 0 Summary

**Total Stories:** 10
**Total Estimated Effort:** 37 hours (~1 sprint / 2 weeks for 1 developer)

**Epic 0 Completion Checklist:**
- ✅ Developer can clone repo and run app in <5 minutes
- ✅ All tests pass (unit + E2E)
- ✅ CI/CD pipeline passes on main branch
- ✅ Vercel deployment successful
- ✅ Code quality enforced on commit
- ✅ Bundle size monitored

**Dependencies:**
- **Blocks:** Epic 1 (cannot begin until Epic 0 complete)
- **Depends On:** None (Epic 0 is the starting point)

---

## Epic 1: Foundation & Core Infrastructure

### Expanded Goal

Establish the technical foundation for Claine v2, including project infrastructure, local-first data architecture using RxDB + IndexedDB, secure OAuth email account connectivity, basic email sync capability, and developer experience tooling (CI/CD, logging, error tracking). This epic delivers the first deployable increment: users can connect their email accounts and see messages syncing locally, while the development team has automated pipelines for rapid iteration.

### Value Delivery

By the end of this epic, users can:
- Securely connect Gmail or Outlook accounts via OAuth 2.0
- See their emails syncing to local storage
- Browse synced messages (basic list view)

Development team gains:
- Automated CI/CD pipeline for continuous deployment
- Structured logging for debugging
- Error tracking for production monitoring
- Solid foundation for subsequent feature development

### Story Breakdown

**Story 1.1: Project Setup & Repository Initialization**

As a developer,
I want a properly structured monorepo with modern tooling,
So that the team can develop efficiently with consistent standards.

**Acceptance Criteria:**
1. Repository initialized with Git, proper .gitignore, and README
2. Monorepo structure using Turborepo or pnpm workspaces
3. TypeScript configured with strict mode
4. ESLint and Prettier configured for code quality
5. Package.json scripts for common tasks (dev, build, test, lint)
6. Basic project documentation in README

**Prerequisites:** None (first story)

---

**Story 1.2: Electron Application Shell**

As a developer,
I want a basic Electron application shell running,
So that we have a desktop application foundation to build upon.

**Acceptance Criteria:**
1. Electron main process and renderer process configured
2. Basic window creation with proper dimensions (1440x900 minimum)
3. Security best practices implemented (contextIsolation, nodeIntegration disabled)
4. IPC communication channel established between main and renderer
5. Application launches successfully on macOS, Windows, Linux
6. Hot reload working in development mode

**Prerequisites:** Story 1.1

---

**Story 1.3: RxDB + IndexedDB Data Layer Setup**

As a developer,
I want RxDB integrated with IndexedDB storage,
So that we have offline-first local database capability.

**Acceptance Criteria:**
1. RxDB 16.20.0 installed and configured with IndexedDB adapter
2. Basic database initialization working
3. Basic CRUD operations working (create, read, update, delete)
4. Reactive queries functional (data changes trigger UI updates)
5. Database initialization on first app launch

**Prerequisites:** Story 1.2 (or Epic 0 if using PWA architecture)

**Estimated Effort:** 4 hours

---

**Story 1.3B: Design RxDB Schemas for Core Entities** *(NEW - Gate-Check High Priority)*

As a developer,
I want comprehensive RxDB schemas designed for all core entities,
So that data structures are consistent and optimized before Epic 2 depends on them.

**Acceptance Criteria:**
1. Email schema defined with all fields:
   - Core: id, threadId, from, to, cc, bcc, subject, body, timestamp
   - Metadata: labels, folder, read status, starred, importance
   - Custom: attributes (user-defined key-value pairs)
   - AI: aiMetadata (triageScore, priority, suggestedAttributes, confidence, reasoning)
2. Thread schema defined:
   - id, subject, participants, messageCount, lastMessageDate, snippet
3. Workflow schema defined:
   - id, name, description, nodes (array), edges (array), triggers (array), enabled, createdAt, updatedAt
4. AI metadata schema defined:
   - id, emailId, triageScore, priority, suggestedAttributes, confidence, reasoning, modelVersion, processedAt
5. Indexes specified for performance:
   - Email: timestamp (DESC), labels, attributes, aiMetadata.priority
   - Thread: lastMessageDate (DESC), participants
   - Workflow: enabled, triggers
6. Validation rules defined (required fields, data types, constraints)
7. All schemas documented in architecture.md
8. Schemas support 100K emails per account (NFR004 validation)
9. Query performance tested: <50ms for common queries (NFR001)

**Prerequisites:** Story 1.3

**Estimated Effort:** 6 hours

---

**Story 1.3C: Implement Schema Migration Strategy** *(NEW - Gate-Check High Priority)*

As a developer,
I want a schema migration system in place,
So that we can evolve database schemas safely without data loss.

**Acceptance Criteria:**
1. Schema version tracking implemented in RxDB
2. Migration runner created (runs migrations on schema version mismatch)
3. Migration files follow naming convention: YYYYMMDD_description.ts
4. Example migration created and tested (v1 → v2)
5. Rollback mechanism implemented and tested
6. Migration documentation created in docs/ folder
7. Migration creation process documented
8. Pre-migration backup strategy implemented
9. Migration status logged (success/failure with details)

**Prerequisites:** Story 1.3B

**Estimated Effort:** 6 hours

---

**Story 1.4: OAuth 2.0 PKCE Integration for Gmail** *(EXPANDED - Gate-Check High Priority)*

As a user,
I want to securely connect my Gmail account with industry-standard security,
So that Claine can access my emails without storing my password and my tokens are protected.

**Acceptance Criteria:**

**Core OAuth Flow:**
1. Gmail OAuth 2.0 PKCE flow implemented using Google APIs Client Library
2. User redirected to Google consent screen
3. Connection success confirmation shown to user

**PKCE Security (NEW - High Priority):**
4. PKCE code verifier generated using `crypto.randomUUID()` + SHA256 hash
5. Code challenge sent to Google authorization endpoint
6. Code verifier validated on token exchange
7. PKCE flow tested and verified secure

**Token Storage & Encryption (NEW - High Priority):**
8. OAuth tokens stored in IndexedDB with Web Crypto API encryption (AES-GCM 256-bit)
9. Token encryption key derived from user session
10. Encrypted tokens cannot be read without decryption key
11. Token encryption/decryption service created (src/services/auth/tokenEncryption.ts)

**Token Refresh Strategy (NEW - High Priority):**
12. Token refresh scheduler implemented (checks expiration every 1 minute)
13. Automatic token refresh triggered 5 minutes before expiration
14. Refresh token rotation implemented (new refresh token on each refresh)
15. Token expiration detection with automatic silent refresh
16. User prompted to re-authenticate ONLY if refresh token expired
17. Refresh failures logged for debugging

**Error Handling (NEW - High Priority):**
18. OAuth error handling covers all error codes:
    - invalid_grant (expired refresh token → re-auth)
    - authorization_pending (user hasn't completed auth)
    - slow_down (rate limited → exponential backoff)
    - access_denied (user cancelled → clear error message)
19. Network errors during OAuth handled gracefully
20. Token refresh failures trigger user notification

**Security Headers (NEW - High Priority):**
21. Content Security Policy (CSP) headers configured
22. HTTPS-only enforced for OAuth redirects
23. TLS 1.3 minimum for all API calls
24. Security audit: No token leakage in console/network logs

**Testing:**
25. Unit tests for PKCE code verifier generation
26. Unit tests for token encryption/decryption
27. Unit tests for token refresh logic
28. Integration test: Full OAuth flow with PKCE
29. Security test: Verify tokens encrypted at rest

**Prerequisites:** Story 1.3C (needs IndexedDB)

**Estimated Effort:** 10 hours (was ~4 hours, now 10 hours with security expansion)

---

**Story 1.5: OAuth 2.0 Integration for Outlook**

As a user,
I want to securely connect my Outlook account,
So that Claine can access my Microsoft emails.

**Acceptance Criteria:**
1. Outlook OAuth 2.0 flow implemented using Microsoft Graph SDK
2. User redirected to Microsoft consent screen
3. OAuth tokens stored securely in OS keychain
4. Token refresh mechanism implemented
5. Error handling for OAuth failures
6. Connection success confirmation shown to user

**Prerequisites:** Story 1.4 (reuse OAuth infrastructure)

---

**Story 1.6: Basic Email Sync Engine**

As a user,
I want my emails to sync from my connected account to local storage,
So that I can access them offline.

**Acceptance Criteria:**
1. Initial sync downloads last 90 days of emails (configurable)
2. Progress indicator shows sync status and estimated time (±10% accuracy)
3. Emails stored in RxDB with proper indexing
4. Incremental sync fetches new emails every 2-5 minutes when online
5. Sync respects API rate limits (Gmail: 250 quotas/day)
6. Graceful handling of network interruptions (resume sync when online)

**Prerequisites:** Story 1.4 or 1.5, Story 1.3

---

**Story 1.7: Basic Email List View UI**

As a user,
I want to see a list of my synced emails,
So that I can browse my messages.

**Acceptance Criteria:**
1. Email list displays sender, subject, date, read/unread status
2. List sorted by date (newest first)
3. Unread emails visually distinguished (bold text or indicator)
4. Clicking email opens it (basic detail view - Story 2.x)
5. Empty state shown when no emails synced yet
6. Loading state shown during initial sync

**Prerequisites:** Story 1.6

---

**Story 1.8: Multi-Account Management**

As a user,
I want to connect up to 3 email accounts,
So that I can manage multiple inboxes in one place.

**Acceptance Criteria:**
1. Account switcher UI implemented (dropdown or sidebar)
2. Each account syncs independently
3. RxDB collections properly scoped by account
4. User can switch between accounts seamlessly
5. Account connection limit enforced (max 3 accounts)
6. Clear indication of which account is currently active

**Prerequisites:** Story 1.5, 1.6, 1.7

**Estimated Effort:** 6 hours

---

**Story 1.9: Implement Sync Conflict Detection and Resolution** *(NEW - Gate-Check High Priority)*

As a user,
I want sync conflicts handled automatically when possible,
So that I don't lose data when local and server changes conflict.

**Acceptance Criteria:**

**Conflict Detection:**
1. Conflict detected when local change timestamp > server change timestamp
2. Conflict detection runs on every sync operation
3. Conflicts logged to RxDB audit table with details

**Conflict Resolution Strategies:**
4. Last-write-wins applied for metadata (read status, starred, archived)
5. Merge strategy applied for labels/attributes (union of both sets)
6. User prompted with diff view for body/subject conflicts
7. User can choose: Keep Local, Keep Server, or Merge manually

**User Experience:**
8. Conflict resolution UI shows:
   - Local version with timestamp
   - Server version with timestamp
   - Side-by-side diff highlighting changes
9. Conflict resolution decisions saved for similar future conflicts
10. User can review conflict history in settings

**Audit & Logging:**
11. All conflicts logged to RxDB with resolution strategy used
12. Conflict statistics displayed in settings (total, auto-resolved, manual)

**Testing:**
13. Test: Read status conflict → last-write-wins
14. Test: Labels conflict → merge (union)
15. Test: Body conflict → user prompt shown
16. Test: User resolves conflict → correct version saved

**Prerequisites:** Story 1.6 (Basic Email Sync)

**Estimated Effort:** 8 hours

---

**Story 1.10: Handle Partial Sync Failures with Retry Logic** *(NEW - Gate-Check High Priority)*

As a user,
I want sync to retry automatically when network issues occur,
So that temporary failures don't block my email access.

**Acceptance Criteria:**

**Exponential Backoff Retry:**
1. Failed sync operations retry with exponential backoff (1s, 2s, 4s, 8s, 16s)
2. Maximum 5 retry attempts before giving up
3. Retry logic applied to all network operations (fetch, send, delete)

**Sync Queue:**
4. Sync queue created in RxDB for failed operations
5. Queue persisted across app restarts
6. Queue processed on network reconnection
7. Queue displays in UI with status (pending, retrying, failed)

**User Notifications:**
8. User notified after 5 failed retry attempts with:
   - Clear error message
   - Manual retry button
   - Option to view sync queue
9. Success notification shown when retries succeed

**Network Handling:**
10. Network status detected (online/offline)
11. Sync paused when offline, resumed when online
12. Partial sync doesn't block full sync completion
13. User can manually trigger sync from UI

**Testing:**
14. Test: Network interruption during sync → retry with backoff
15. Test: 5 retries fail → user notification shown
16. Test: Network restored → queue processed successfully
17. Test: App restart → queue persists and resumes

**Prerequisites:** Story 1.6, 1.9

**Estimated Effort:** 8 hours

---

**Story 1.11: Implement Quota Management (IndexedDB + Gmail API)** *(NEW - Gate-Check High Priority)*

As a user,
I want to be warned before storage quotas are exceeded,
So that I can manage storage and avoid sync failures.

**Acceptance Criteria:**

**IndexedDB Quota Monitoring:**
1. StorageManager API used to monitor IndexedDB usage
2. Current usage and available quota displayed in settings
3. Usage percentage calculated and shown (e.g., "Using 45% of 2 GB")
4. Warning shown at 80% quota: "Storage almost full - cleanup recommended"
5. Cleanup flow triggered at 90% quota

**Email Cleanup Flow:**
6. Cleanup wizard shows storage breakdown by:
   - Account (which accounts use most storage)
   - Age (emails older than 1 year, 2 years, etc.)
   - Size (emails with large attachments)
7. User can select cleanup criteria (e.g., "Delete emails >2 years old")
8. Cleanup preview shows how much space will be freed
9. Cleanup executed with confirmation
10. Cleanup reduces storage by at least 20%

**Gmail API Rate Limit Handling:**
11. Gmail API quota tracked (250 quota units/user/second)
12. API calls throttled to stay under rate limits
13. Rate limit queue implemented (delays requests if limit approaching)
14. Rate limit errors (429) handled with exponential backoff

**User Experience:**
15. Storage widget in settings shows real-time usage
16. Rate limit status shown in settings (if applicable)
17. User can manually check storage/quota status

**Testing:**
18. Test: 80% quota reached → warning shown
19. Test: 90% quota reached → cleanup wizard shown
20. Test: Cleanup executed → storage reduced by 20%+
21. Test: Rate limit approached → requests throttled
22. Test: Rate limit error (429) → exponential backoff applied

**Prerequisites:** Story 1.6, 1.10

**Estimated Effort:** 10 hours

---

**Story 1.12: Configure Bundle Analysis and Size Budgets** *(NEW - Gate-Check Medium Priority)*

As a developer,
I want bundle size monitoring beyond Epic 0 basic setup,
So that we can track bundle growth as features are added.

**Acceptance Criteria:**
1. Bundle analysis integrated into Epic 1 build process
2. Per-feature bundle size tracked:
   - Auth module size
   - RxDB/database module size
   - Sync engine size
3. Bundle size trend chart generated (shows growth over time)
4. Automated alerts if any module exceeds budget
5. Bundle size documented in Epic 1 completion report

**Prerequisites:** Epic 0 Story 0.10 (basic bundle analysis)

**Estimated Effort:** 3 hours

---

**Story 1.13: CI/CD Pipeline Setup** *(RENUMBERED - was 1.9, NOTE: Epic 0 handles basic CI/CD)*

As a developer,
I want Epic 1-specific CI/CD enhancements,
So that Epic 1 features are tested automatically.

**Acceptance Criteria:**
1. Epic 0 CI/CD pipeline extended with Epic 1 tests
2. OAuth integration tests run in CI
3. RxDB schema validation tests run in CI
4. Sync engine tests run in CI with mock email server
5. Performance tests for sync (time to sync 1000 emails)

**Prerequisites:** Epic 0 Story 0.6, Story 1.6

**Estimated Effort:** 3 hours (reduced - Epic 0 handles base CI/CD)

---

**Story 1.14: Logging & Error Tracking Infrastructure** *(RENUMBERED - was 1.10)*

As a developer,
I want structured logging and error tracking,
So that I can debug issues and monitor production health.

**Acceptance Criteria:**
1. Winston or Pino configured for structured logging
2. Log levels properly configured (debug, info, warn, error)
3. Logs written to file in user's app data directory
4. Sentry integrated for error tracking (privacy-preserving mode)
5. Unhandled exceptions and promise rejections caught and reported
6. User-identifiable information sanitized from error reports

**Prerequisites:** Story 1.2

---

## Epic 2: Offline-First Email Client with Attributes

### Expanded Goal

Build a performant, fully-functional email client that works flawlessly offline, with virtualized inbox rendering, thread detail views, compose/reply functionality, custom attributes system for structured email organization, attribute-based filtering, and sub-50ms interaction performance. This epic proves the core email client viability AND establishes the v1-proven attributes foundation before adding AI capabilities. Custom attributes provide the structured data layer that AI suggestions and workflows will build upon in later epics.

### Value Delivery

By the end of this epic, users can:
- Read emails with full conversation threading
- Compose and send emails (queued when offline, sent when online)
- Create custom attributes (enum, text, date, boolean types) for domain-specific organization
- Apply attributes manually to emails (e.g., Project=Alpha, Status=To-Do, Priority=High)
- Filter and search emails by attribute combinations
- See attribute tags inline in inbox and thread views
- Search emails locally with instant results
- Archive, delete, and organize emails
- Experience sub-50ms performance for all interactions
- Work fully offline with zero feature loss (attributes work 100% offline)

### Story Breakdown

**Story 2.1: Virtualized Inbox Rendering**

As a user,
I want smooth, fast scrolling through large email lists,
So that I can quickly navigate my inbox without lag.

**Acceptance Criteria:**
1. React-window or tanstack-virtual implemented for inbox list
2. Only visible emails rendered in DOM (20-30 rows buffer)
3. Smooth 60 FPS scrolling with 10,000+ emails loaded
4. Dynamic row heights supported (varying email preview lengths)
5. Scroll position preserved when navigating back to inbox
6. Performance benchmarked: <50ms scroll interaction time

**Prerequisites:** Epic 1 complete (Story 1.7 basic list view)

---

**Story 2.2: Thread Detail View with Conversation History**

As a user,
I want to see full conversation threads,
So that I can understand email context and history.

**Acceptance Criteria:**
1. Thread detail view shows all messages in conversation order
2. Messages grouped by sender/time proximity
3. Quoted text collapsed by default with expand option
4. Attachments displayed with icons and download buttons
5. Inline images rendered (with lazy loading)
6. Email headers accessible (from, to, cc, bcc, date)

**Prerequisites:** Story 2.1

---

**Story 2.3: Compose & Reply Interface**

As a user,
I want to compose new emails and reply to existing ones,
So that I can communicate with others.

**Acceptance Criteria:**
1. Compose button opens new message editor
2. Reply/Reply-all/Forward actions available in thread view
3. Rich text editor implemented (basic formatting: bold, italic, lists)
4. To/Cc/Bcc fields with autocomplete from contacts
5. Subject line auto-populated for replies (Re: prefix)
6. Draft auto-save every 30 seconds to RxDB

**Prerequisites:** Story 2.2

---

**Story 2.4: Offline-First Send Queue**

As a user,
I want to send emails even when offline,
So that I don't have to wait for network connectivity.

**Acceptance Criteria:**
1. Send action queues email locally when offline
2. Optimistic UI shows "Sending..." then "Sent" immediately
3. Background sync sends queued emails when online
4. Failed sends show error notification with retry option
5. Queue status visible in UI (e.g., "3 emails waiting to send")
6. Emails sent in FIFO order when connectivity restored

**Prerequisites:** Story 2.3

---

**Story 2.5: Local Full-Text Search**

As a user,
I want to search my emails instantly,
So that I can find specific messages quickly.

**Acceptance Criteria:**
1. Search input in UI (keyboard shortcut: cmd/ctrl+k)
2. Full-text search across sender, subject, body
3. Results returned in <100ms for 10,000+ email database
4. Search highlights matching terms in results
5. Filters available: date range, sender, has attachment
6. IndexedDB indexes optimized for search performance

**Prerequisites:** Story 2.1, Story 2.2

---

**Story 2.6: Email Actions (Archive, Delete, Mark Read/Unread)**

As a user,
I want to organize my emails with basic actions,
So that I can keep my inbox manageable.

**Acceptance Criteria:**
1. Archive button removes email from inbox (moves to Archive folder)
2. Delete button moves email to Trash (soft delete)
3. Mark as read/unread toggles unread status
4. Keyboard shortcuts implemented (e for archive, # for delete)
5. Bulk actions available (select multiple, apply action)
6. Undo option for destructive actions (5-second toast)

**Prerequisites:** Story 2.2

---

**Story 2.7: Offline Mode Indicators & Conflict Resolution**

As a user,
I want clear indication when I'm offline,
So that I understand when my actions will sync.

**Acceptance Criteria:**
1. Offline indicator displayed in UI (icon in header)
2. Network status detection (online/offline events)
3. Queue status shown for pending actions
4. Conflict resolution for sync using last-write-wins strategy
5. User notified if action failed due to sync conflict
6. Manual sync trigger available in settings

**Prerequisites:** Story 2.4

---

**Story 2.8: Attachment Handling**

As a user,
I want to view and download email attachments,
So that I can access shared files.

**Acceptance Criteria:**
1. Attachments listed in thread view with icons and file sizes
2. Click to download attachment to user's Downloads folder
3. Lazy loading: attachments fetched on-demand, not during initial sync
4. Image attachments show inline preview
5. PDF/document attachments open in system default app
6. Compose interface supports drag-and-drop file attachment

**Prerequisites:** Story 2.2, Story 2.3

---

**Story 2.9: Email Folders & Labels**

As a user,
I want to organize emails with folders or labels,
So that I can categorize my messages.

**Acceptance Criteria:**
1. Sidebar shows standard folders (Inbox, Sent, Drafts, Archive, Trash)
2. Gmail labels synced and displayed
3. Outlook folders synced and displayed
4. User can move emails between folders/labels
5. Unread count displayed per folder
6. Folder selection persists across app restarts

**Prerequisites:** Story 2.6

---

**Story 2.10: Performance Optimization & Benchmarking**

As a developer,
I want comprehensive performance optimization,
So that we meet sub-50ms interaction targets.

**Acceptance Criteria:**
1. Performance benchmarks established for key interactions
2. React.memo and useMemo implemented for expensive components
3. IndexedDB queries optimized with proper indexes
4. Web Workers used for heavy computation (search, parsing)
5. Code splitting implemented for faster initial load
6. Performance monitoring dashboard (development tool)

**Prerequisites:** All Epic 2 stories (integration and optimization)

---

**Story 2.11: Keyboard Shortcuts & Power User Features**

As a power user,
I want comprehensive keyboard shortcuts,
So that I can navigate efficiently without mouse.

**Acceptance Criteria:**
1. Shortcut cheat sheet accessible (? key)
2. Navigation: j/k (up/down), enter (open), esc (back)
3. Actions: e (archive), # (delete), r (reply), f (forward)
4. Command palette (cmd/ctrl+k) for all actions
5. Vim-style navigation optional (configurable in settings)
6. Search: / to focus search, cmd/ctrl+f for in-email search

**Prerequisites:** Story 2.6, Story 2.5

---

**Story 2.12: Empty States & Onboarding UX**

As a new user,
I want clear guidance when getting started,
So that I understand how to use Claine.

**Acceptance Criteria:**
1. Welcome screen on first launch with "Connect Email" CTA
2. Empty inbox state: "You're all caught up" with calm affirmation
3. Empty search results: Helpful message with search tips
4. Loading states: Progress indicators with estimated time
5. Error states: Clear messages with actionable next steps
6. Tooltips for first-time interactions (dismissible)

**Prerequisites:** All Epic 2 core stories

---

**Story 2.13: Custom Attributes System - Data Model & CRUD**

As a power user,
I want to create and manage custom attributes for email organization,
So that I can structure my emails according to my domain-specific needs.

**Acceptance Criteria:**
1. RxDB schema extended with attributes collection (name, type, values, display settings)
2. Attributes types supported: enum (fixed value list), text (free form), date (picker), boolean (yes/no), number
3. Settings UI for attribute management: Create, Read, Update, Delete attributes
4. Built-in attribute presets available: Status (To-Do/In-Progress/Waiting/Done), Priority (High/Medium/Low), Context (Work/Personal/Projects)
5. User can enable/disable built-in presets
6. Validation: duplicate attribute names prevented, enum values validated
7. Attributes persist in RxDB and sync across app restarts

**Prerequisites:** Story 2.9 (Folders & Labels), Story 1.3 (RxDB)

---

**Story 2.14: Apply Attributes to Emails - UI & Interaction**

As a user,
I want to manually apply attributes to emails,
So that I can organize and categorize my messages.

**Acceptance Criteria:**
1. Attribute panel accessible from thread detail view (sidebar or dropdown)
2. User can select/apply multiple attributes to a single email
3. Enum attributes show dropdown with values
4. Text attributes show input field
5. Date attributes show date picker
6. Boolean attributes show checkbox
7. Attribute changes saved immediately to RxDB (email-attributes junction table)
8. Attribute tags displayed inline in inbox list (colored badges/pills)
9. Attribute tags displayed in thread detail view
10. User can remove attributes (click X on tag)

**Prerequisites:** Story 2.13

---

**Story 2.15: Attribute-Based Filtering & Search**

As a user,
I want to filter and search emails by attributes,
So that I can quickly find emails matching specific criteria.

**Acceptance Criteria:**
1. Filter panel in sidebar showing all available attributes
2. User can select attribute filters (e.g., Status=To-Do, Priority=High)
3. Multiple filters combined with AND logic (e.g., Status=To-Do AND Priority=High)
4. Filtered results update instantly (<100ms)
5. Active filters shown as chips with clear/remove option
6. Filter state persists during session (cleared on app restart unless saved)
7. Search enhanced to include attribute values (e.g., search "Project:Alpha" finds emails with Project=Alpha)
8. RxDB indexes optimized for attribute queries
9. Empty state when no emails match filters: "No emails found with these criteria"

**Prerequisites:** Story 2.14, Story 2.5 (Search)

**Estimated Effort:** 6 hours

---

**Story 2.16: Implement Lazy Loading for Email Threads and Large Lists** *(NEW - Gate-Check Medium Priority)*

As a user,
I want the app to load quickly even with large email lists,
So that I can start working immediately without waiting for everything to load.

**Acceptance Criteria:**

**Code Splitting:**
1. Email thread component lazy loaded (separate chunk)
2. Compose component lazy loaded (only loads when user clicks compose)
3. Settings component lazy loaded
4. Attribute management UI lazy loaded

**Virtualized Scrolling (Enhanced):**
5. React-window virtualization extended from Story 2.1
6. Email thread messages virtualized (only visible messages rendered)
7. Large attachment previews lazy loaded on scroll

**Performance Targets:**
8. Initial bundle size <500 KB (as per Epic 0 budget)
9. Email list chunk <200 KB
10. Each lazy-loaded chunk <150 KB
11. Lighthouse performance score >90
12. Time to Interactive (TTI) <3 seconds (NFR004)

**User Experience:**
13. Loading indicators shown for lazy-loaded components
14. Skeleton screens for email thread loading
15. No layout shift when components load

**Testing:**
16. Test: Initial load <3s with 100K emails in database
17. Test: Lighthouse performance score >90
18. Test: Bundle sizes meet budgets
19. Test: Lazy-loaded components load correctly

**Prerequisites:** Story 2.1 (Virtualized Inbox), Epic 0 Story 0.10 (Bundle analysis)

**Estimated Effort:** 4 hours

---

## Epic 3: AI Triage & Attribute Suggestions

### Expanded Goal

Implement local AI inference for intelligent email categorization, priority scoring, and AI-powered attribute suggestions with user confirmation. This epic introduces the **hybrid AI + manual control approach** where AI suggests, user decides, and AI learns from corrections. Must be fast (<200ms for triage, <500ms for attribute suggestions), explainable, and trustworthy. This epic establishes the foundation for all subsequent AI features by proving local AI performance, building trust through transparency, creating feedback loops for continuous improvement, and demonstrating that AI enhances (not replaces) user control.

### Value Delivery

By the end of this epic, users can:
- See their inbox automatically prioritized by AI (Urgent, Important, Updates, Low Priority)
- Receive AI attribute suggestions with confidence indicators (🟢 High, 🟡 Medium, 🔴 Low)
- Accept, reject, or modify AI attribute suggestions with one-click workflow
- Perform bulk attribute operations (AI suggests for 50 emails, user reviews and applies)
- Understand why each email was prioritized and why attributes were suggested (explainable scoring)
- Manually adjust priorities and attributes, training the AI through feedback
- See AI accuracy improve over time as it learns from corrections
- Experience smart notifications (only for truly important emails)
- Trust that all AI processing happens locally on their device

### Story Breakdown

**Story 3.1: Local LLM Integration (Ollama)**

As a developer,
I want Ollama integrated for local LLM inference,
So that we can run AI models on-device without cloud dependency.

**Acceptance Criteria:**
1. Ollama installed and configured (packaged with Electron app or external install)
2. Llama 3.1 8B model downloaded and verified
3. API wrapper created for inference requests
4. Latency benchmarked on target hardware (M1, Intel i7, AMD Ryzen)
5. Fallback mechanism to cloud API (OpenAI/Anthropic) configurable
6. Model loading happens in background (doesn't block UI)

**Prerequisites:** Epic 2 complete

---

**Story 3.2: Email Analysis Engine**

As a developer,
I want an email analysis engine that extracts features for AI scoring,
So that the AI can understand email context and importance.

**Acceptance Criteria:**
1. Feature extractor analyzes: sender, subject, body content, urgency keywords
2. Sender relationship scoring (frequency of communication, response rate)
3. Content analysis: detect deadlines, questions, requests vs. FYI
4. Thread context incorporated (conversation history)
5. Analysis runs in Web Worker (doesn't block main thread)
6. Features cached in RxDB for performance

**Prerequisites:** Story 3.1

**Estimated Effort:** 8 hours

---

**Story 3.2B: Implement AI Capability Detection and Graceful Degradation** *(NEW - Gate-Check Medium Priority)*

As a user,
I want the app to work even if my browser doesn't support local AI,
So that I can still use email features without AI enhancements.

**Acceptance Criteria:**

**Browser Capability Detection:**
1. WebAssembly support checked on app load
2. WebGPU availability checked (fallback to WebGL or CPU if unavailable)
3. Available memory detected for model loading (require 4 GB minimum)
4. Capability check results stored in app state

**Progressive Enhancement:**
5. AI features gracefully hidden if capabilities unavailable
6. Email client works fully without AI (manual priority assignment available)
7. Settings show AI capability status:
   - ✅ "AI features available (WebGPU accelerated)"
   - ⚠️ "AI features available (CPU only - slower)"
   - ❌ "AI features unavailable (browser not supported)"

**Fallback UI:**
8. Manual priority dropdown shown instead of AI priority (Urgent, Important, Updates, Low)
9. Manual attribute assignment UI available without AI suggestions
10. Clear user messaging: "AI features require a modern browser with WebGPU support"
11. Help link to browser compatibility page

**Model Download Handling:**
12. Model download failure shows error with retry button
13. Download progress shown (e.g., "Downloading AI model... 45%")
14. User can cancel model download
15. Partial downloads resumed on retry (not restarted)

**Testing:**
16. Test: App loads successfully on browsers without WebGPU (Chrome 94, Firefox 100)
17. Test: AI features hidden, manual controls shown
18. Test: User can use email client fully without AI
19. Test: Model download failure → retry works
20. Test: Capability status displayed correctly in settings

**Prerequisites:** Story 3.1 (Local LLM Integration)

**Estimated Effort:** 6 hours

---

**Story 3.3: Priority Scoring Model**

As a user,
I want emails automatically scored for priority,
So that important messages surface first.

**Acceptance Criteria:**
1. AI model assigns priority scores (0-100) to each email
2. Scoring completes in <200ms per email on average
3. Four priority categories: Urgent (80-100), Important (60-79), Updates (40-59), Low (0-39)
4. Scoring factors: sender relationship, urgency keywords, deadlines, questions
5. Batch processing for inbox backlog (prioritize visible emails first)
6. Scores stored in RxDB and updated on user feedback

**Prerequisites:** Story 3.2

---

**Story 3.4: Priority-Based Inbox View**

As a user,
I want my inbox organized by AI priority,
So that I focus on what matters most.

**Acceptance Criteria:**
1. Inbox grouped by priority: Urgent, Important, Updates, Low Priority
2. Visual indicators (🔴 🟡 🟢 ⚪) distinguish priority levels
3. Collapsible sections (e.g., collapse Low Priority)
4. Sort within section: newest first or highest confidence first
5. User can toggle between Priority View and Chronological View
6. Priority View preference persists across sessions

**Prerequisites:** Story 3.3

---

**Story 3.5: Explainability UI - "Why this priority?"**

As a user,
I want to understand why AI prioritized each email,
So that I can trust the AI's decisions.

**Acceptance Criteria:**
1. "Why?" button or icon next to each email
2. Explanation popup shows reasoning in plain language
3. Example: "Marked Urgent because: Client mentioned 'ASAP' and deadline is tomorrow"
4. Factors shown: sender relationship, keywords detected, urgency signals
5. AI confidence score displayed (e.g., "85% confident")
6. Explanation uses human-sounding language (not technical jargon)

**Prerequisites:** Story 3.4

---

**Story 3.6: Manual Priority Adjustment & Feedback Loop**

As a user,
I want to manually adjust email priorities,
So that the AI learns my preferences.

**Acceptance Criteria:**
1. User can drag-and-drop emails between priority sections
2. Right-click menu: "Set priority to..." with options
3. Feedback recorded: user adjustments stored in RxDB
4. AI model incorporates feedback in future scoring
5. Feedback effects visible within 24 hours (model retraining)
6. User notified when AI adapts: "AI learned from your feedback"

**Prerequisites:** Story 3.5

---

**Story 3.7: Smart Notifications (High-Priority Only)**

As a user,
I want notifications only for truly important emails,
So that I'm not overwhelmed by inbox noise.

**Acceptance Criteria:**
1. OS notifications triggered only for Urgent priority emails
2. Notification shows sender, subject, and priority reason
3. Notification click opens Claine and navigates to email
4. User can configure threshold (e.g., notify for Important+ or Urgent only)
5. Do Not Disturb mode: suppress all notifications
6. Notification rate-limiting: max 5 per hour to prevent spam

**Prerequisites:** Story 3.4

---

**Story 3.8: Batch Triage for Inbox Backlog**

As a user,
I want AI to quickly triage my entire inbox,
So that I can catch up on backlog efficiently.

**Acceptance Criteria:**
1. "AI Triage All" button triggers batch processing
2. Progress indicator shows triage status (e.g., "Analyzing 347 emails...")
3. Prioritizes visible emails first (above-the-fold), then background
4. Triage completes in <30 seconds for 500 emails
5. Results displayed progressively (updates as scoring completes)
6. User can cancel triage mid-process

**Prerequisites:** Story 3.3, Story 3.4

---

**Story 3.9: AI Performance Monitoring Dashboard (Dev Tool)**

As a developer,
I want monitoring for AI performance metrics,
So that I can ensure latency and accuracy targets are met.

**Acceptance Criteria:**
1. Dev dashboard shows: avg latency, P95 latency, throughput
2. Accuracy metrics: user feedback rate, adjustment frequency
3. Model version and configuration displayed
4. Performance breakdown: feature extraction time, inference time
5. Historical trends: performance over time
6. Alerts if latency exceeds 200ms threshold

**Prerequisites:** Story 3.3, Story 3.6

---

**Story 3.10: Privacy Dashboard - AI Processing Transparency**

As a user,
I want visibility into AI processing,
So that I trust my data stays local.

**Acceptance Criteria:**
1. Privacy dashboard accessible from settings
2. Shows: "All AI processing: Local (on-device)"
3. Model information: version, size, location
4. Cloud fallback status: enabled/disabled, usage count
5. Data visualization: "0 emails sent to cloud for processing"
6. Link to privacy policy and data handling documentation

**Prerequisites:** Story 3.1, Story 3.3

---

**Story 3.11: AI Attribute Suggestion Engine**

As a user,
I want AI to suggest attribute values for my emails,
So that I can quickly categorize emails without manual data entry.

**Acceptance Criteria:**
1. AI analyzes email content and suggests attribute values (uses attributes from Epic 2)
2. Suggestion engine analyzes: sender, subject, body, thread history
3. Generates suggestions for all user-defined attributes (built-in + custom)
4. Confidence score (0-100%) computed for each suggestion
5. Reasoning generated in plain language (e.g., "Project=Alpha because email is from alex@alpha.com and mentions Alpha milestone")
6. Suggestions complete in <500ms per email
7. Suggestions stored in RxDB with status: pending, accepted, rejected, modified
8. Batch processing supported (suggest attributes for 50+ emails at once)

**Prerequisites:** Story 3.2 (Email Analysis Engine), Story 2.13 (Attributes System)

---

**Story 3.12: AI Attribute Suggestions UI - Review & Apply Workflow**

As a user,
I want to review and apply AI attribute suggestions with one-click,
So that AI speeds up my workflow while I maintain control.

**Acceptance Criteria:**
1. "AI Suggestions" panel shows pending attribute suggestions
2. Badge indicator shows count (e.g., "🔔 28 suggestions pending")
3. Each suggestion displays: attribute name, suggested value, confidence indicator (🟢 90%+, 🟡 70-89%, 🔴 <70%)
4. One-click actions: Accept, Reject, Modify (change value before applying)
5. Bulk review mode: show all suggestions for multiple emails, select which to accept
6. "Accept All" button with confirmation dialog
7. Applied suggestions marked as "accepted" in database
8. Rejected suggestions marked as "rejected" for AI learning
9. Modified suggestions store both AI value and user value for learning

**Prerequisites:** Story 3.11, Story 2.14 (Apply Attributes UI)

---

**Story 3.13: AI Learning from Attribute Corrections**

As a user,
I want the AI to learn from my attribute corrections,
So that future suggestions become more accurate over time.

**Acceptance Criteria:**
1. Learning events stored in RxDB: email features, AI suggestion, user action (accepted/rejected/modified), user final value
2. Pattern detection: AI identifies when user consistently overrides specific suggestions
3. Example: User always changes Priority from High to Medium for newsletters → AI learns to suggest Medium for newsletters
4. Domain-specific learning: User creates custom attribute "Project-Alpha" and manually applies to 10 emails → AI learns pattern for future emails
5. Confidence scores adjust based on learning (increase for patterns AI learned, decrease for frequently corrected suggestions)
6. Learning dashboard shows improvement metrics: "AI accuracy improved from 75% to 94% over 30 days"
7. User can view learning insights: "AI learned: Emails from @domain.com always get Project=Beta"

**Prerequisites:** Story 3.12

---

## Epic 4: AI-Powered Compose & Response

### Expanded Goal

Enable AI to generate context-aware draft responses based on conversation history and user's writing style, providing one-click approve/edit/reject workflow. This epic builds on the AI triage infrastructure to deliver autonomous drafting capability, requiring sophisticated context analysis, style learning, and user feedback incorporation.

### Value Delivery

By the end of this epic, users can:
- Receive AI-generated draft responses for incoming emails
- Review drafts that match their personal writing style and tone
- Approve drafts with one click or make quick edits
- Train the AI by approving/rejecting/editing drafts
- Receive smart timing suggestions (send now vs. batch later)

### Story Breakdown

**Story 4.1: Conversation Context Analysis**

As a developer,
I want AI to extract conversation context from email threads,
So that draft responses are relevant and contextual.

**Acceptance Criteria:**
1. Thread history parser extracts: participants, subject, key points
2. Previous user responses analyzed for tone and style patterns
3. Unresolved questions identified in thread
4. Context window limited to last 5 messages (performance optimization)
5. Context stored in RxDB for reuse
6. Analysis completes in <500ms

**Prerequisites:** Epic 3 complete (AI infrastructure ready)

---

**Story 4.2: Writing Style Learning Engine**

As a developer,
I want AI to learn user's writing style from sent emails,
So that generated drafts match user's voice and tone.

**Acceptance Criteria:**
1. Sent emails analyzed for: tone (formal/casual), sentence length, vocabulary
2. Common phrases and sign-offs extracted
3. Greeting patterns identified (Hi/Hello/Hey)
4. Style profile stored and updated incrementally
5. Minimum 10 sent emails required before style application
6. User can trigger style re-learning from settings

**Prerequisites:** Epic 2 (sent emails available)

---

**Story 4.3: Draft Response Generation**

As a user,
I want AI to generate draft replies to my emails,
So that I can respond faster.

**Acceptance Criteria:**
1. "AI Draft" button appears for emails needing response
2. Draft generation triggered on button click or auto-suggested for Urgent emails
3. Draft generated in <2 seconds using local LLM
4. Draft matches user's writing style (from Story 4.2)
5. Draft addresses questions and context from email
6. Fallback skeleton placeholder shown if generation takes >3s (with silent retry)

**Prerequisites:** Story 4.1, Story 4.2

---

**Story 4.4: Draft Review UI with One-Click Workflow**

As a user,
I want to quickly review and approve AI drafts,
So that I can send responses efficiently.

**Acceptance Criteria:**
1. Draft displayed in expandable panel below email
2. Three action buttons: Approve, Edit, Reject
3. Approve: Immediately sends draft (or queues if offline)
4. Edit: Opens compose interface with draft pre-populated
5. Reject: Dismisses draft, logs feedback for AI learning
6. Keyboard shortcuts: cmd/ctrl+enter (approve), e (edit), esc (reject)

**Prerequisites:** Story 4.3

---

**Story 4.5: Inline Draft Editing**

As a user,
I want to make quick edits to AI drafts without opening full composer,
So that I can adjust small details efficiently.

**Acceptance Criteria:**
1. Click on draft text enters edit mode (inline editor)
2. Edit mode supports: text changes, formatting (bold/italic)
3. Changes auto-saved to draft state
4. Approve button sends edited version
5. Edit tracking: AI learns from user's modifications
6. Cancel option reverts to original draft

**Prerequisites:** Story 4.4

---

**Story 4.6: Draft Quality Confidence Scoring**

As a user,
I want to see how confident AI is about each draft,
So that I know which drafts need more review.

**Acceptance Criteria:**
1. Confidence score (0-100%) displayed with each draft
2. Visual indicator: green (>80%), yellow (60-80%), red (<60%)
3. Low confidence (<60%) shows warning: "Review carefully"
4. Confidence factors: context clarity, style match, complexity
5. User can set threshold: only show drafts above X% confidence
6. Confidence score helps prioritize which drafts to review first

**Prerequisites:** Story 4.3

---

**Story 4.7: Smart Timing Suggestions**

As a user,
I want AI to suggest optimal send timing,
So that my responses arrive at the right moment.

**Acceptance Criteria:**
1. AI analyzes: urgency, recipient time zone, user's send patterns
2. Suggestion displayed: "Send now" vs. "Send at 9am tomorrow"
3. User can override suggestion with custom time
4. Scheduled sends queued locally, sent at specified time
5. User can review/edit scheduled sends before they're sent
6. Suggestion reasoning explained: "Recipient typically responds in mornings"

**Prerequisites:** Story 4.4

---

**Story 4.8: Feedback Loop - Draft Learning**

As a developer,
I want AI to learn from user's draft approvals and edits,
So that future drafts improve in quality.

**Acceptance Criteria:**
1. Approved drafts stored as positive examples
2. Rejected drafts stored as negative examples
3. User edits analyzed: what changed and why
4. Style model updated incrementally (weekly batch retraining)
5. Confidence scoring adjusted based on feedback
6. User sees improvement message: "AI draft quality improving"

**Prerequisites:** Story 4.5

---

**Story 4.9: Multi-Response Scenarios (Reply, Reply-All, Forward)**

As a user,
I want AI drafts for all response types,
So that I can use AI assistance regardless of action.

**Acceptance Criteria:**
1. Reply: AI generates response to sender only
2. Reply-All: AI includes context for all recipients
3. Forward: AI drafts forwarding context (e.g., "FYI, see below")
4. Draft adapts to response type (tone, audience awareness)
5. User can switch response type after draft generated
6. Draft regenerates if response type changed

**Prerequisites:** Story 4.3

---

**Story 4.10: Draft Templates & Common Responses**

As a user,
I want AI to learn my common response patterns,
So that frequent replies are instantly available.

**Acceptance Criteria:**
1. AI identifies common response types: confirmation, decline, follow-up request
2. Templates auto-created from user's sent email patterns
3. Template suggestions shown for matching scenarios
4. User can manually create/edit templates
5. Templates integrated into draft generation (faster, more consistent)
6. Template library accessible in settings

**Prerequisites:** Story 4.2, Story 4.8

---

## Epic 5: Visual Workflow Engine & Hybrid Automation

### Expanded Goal

Implement visual workflow editor allowing users to create deterministic automation using attributes, with AI-enhanced decision nodes. This epic integrates attributes (Epic 2) and AI capabilities (Epics 3-4) into a powerful automation system. The workflow engine provides deterministic, user-controlled automation that power users demand, while AI suggestions make workflows accessible to casual users. Workflows execute using reliable attribute data (not AI predictions), ensuring reproducible and trustworthy behavior.

### Value Delivery

By the end of this epic, users can:
- Create workflows using drag-and-drop visual editor
- Define workflow triggers (email arrives, attribute changes, time-based)
- Set conditions using attribute values, sender rules, content analysis
- Execute actions (apply attributes, send email, archive, label)
- Use AI-enhanced decision nodes for intelligent branching
- Access workflow templates and AI-suggested workflows based on email patterns
- Execute workflows using deterministic attribute data (100% reliable, offline-capable)
- View workflow execution logs showing what executed, when, and why
- Debug and troubleshoot workflows with detailed execution history

### Story Breakdown

**Story 5.1: Workflow Data Model & Engine Core**

As a developer,
I want a workflow data model and execution engine,
So that users can define and execute automation rules.

**Acceptance Criteria:**
1. RxDB schema for workflows collection: id, name, enabled, triggers, nodes, variables
2. Workflow execution engine: reads workflow definition, evaluates conditions, executes actions
3. Node types defined: trigger, condition, action, decision, variable
4. Trigger types: email_arrives, attribute_changes, schedule (time-based)
5. Action types: apply_attribute, send_email, archive, delete, label, move_folder
6. Condition evaluation: attribute value matches, sender matches regex, content contains keywords
7. Workflow variables for data passing between nodes (e.g., extract subject, use in action)
8. Execution happens in background worker (doesn't block UI)

**Prerequisites:** Epic 2 complete (Attributes), Epic 3 complete (AI Triage)

---

**Story 5.2: Visual Workflow Editor - Canvas & Node Placement**

As a user,
I want a visual drag-and-drop editor to create workflows,
So that I can design automation without code.

**Acceptance Criteria:**
1. Workflow editor UI with canvas (using react-flow or similar library)
2. Node palette showing available node types (trigger, condition, action, decision)
3. Drag-and-drop nodes from palette to canvas
4. Connect nodes with arrows to define flow
5. Visual indicators: trigger (green), condition (yellow), action (blue), decision (purple)
6. Canvas pan and zoom (trackpad gestures, mouse wheel)
7. Node selection, move, delete operations
8. Grid snapping for clean alignment

**Prerequisites:** Story 5.1

---

**Story 6.3: Workflow Trigger Configuration**

As a user,
I want to configure when my workflow should run,
So that automation executes at the right time.

**Acceptance Criteria:**
1. Trigger node configuration panel
2. Email arrives trigger: select labels/folders to watch (e.g., "Run when email arrives in Inbox")
3. Attribute changes trigger: select attribute + value (e.g., "Run when Status changes to To-Do")
4. Schedule trigger: cron-like interface for time-based (e.g., "Every day at 9am")
5. Multiple triggers per workflow (OR logic: run if any trigger fires)
6. Test trigger button: simulate trigger to test workflow
7. Trigger event log: see when triggers fired

**Prerequisites:** Story 5.2

---

**Story 6.4: Workflow Condition Nodes - Attribute-Based Logic**

As a user,
I want to add conditional logic to my workflows,
So that actions execute only when conditions are met.

**Acceptance Criteria:**
1. Condition node configuration panel
2. Attribute-based conditions: attribute name + operator (equals, not equals, contains, greater than) + value
3. Multiple conditions with AND/OR logic
4. Example: "If Priority=High AND Project=Alpha"
5. Sender-based conditions: sender email/domain matches pattern
6. Content-based conditions: subject or body contains keywords
7. Visual branching: condition true → one path, condition false → another path
8. Test condition button: evaluate condition against sample email

**Prerequisites:** Story 5.3, Story 2.13 (Attributes)

---

**Story 6.5: Workflow Action Nodes - Apply Attributes, Archive, Label**

As a user,
I want to define actions my workflow should execute,
So that automation completes tasks for me.

**Acceptance Criteria:**
1. Action node configuration panel
2. Apply attribute action: select attribute + value to apply
3. Archive action: move email to Archive folder
4. Delete action: move email to Trash
5. Label action: apply Gmail label
6. Move folder action: move to specified folder
7. Mark read/unread action
8. Actions execute sequentially in workflow order
9. Action execution logged (timestamp, email ID, action taken)

**Prerequisites:** Story 5.4

---

**Story 6.6: AI-Enhanced Decision Nodes**

As a power user,
I want AI-powered decision nodes in my workflows,
So that automation can make intelligent decisions based on email content.

**Acceptance Criteria:**
1. AI decision node type added to palette
2. Decision node configuration: define question for AI (e.g., "Does this email need immediate response?")
3. AI analyzes email content and answers yes/no
4. Workflow branches based on AI response (yes path, no path)
5. AI confidence threshold configurable (e.g., only branch if confidence >80%)
6. Explainability: AI reasoning shown in workflow execution log
7. Fallback behavior if AI fails: default path (user-configured)
8. Example workflow: "If AI says urgent → notify, else → move to Updates folder"

**Prerequisites:** Story 5.5, Story 3.2 (Email Analysis Engine)

---

**Story 6.7: Workflow Variables & Data Passing**

As a power user,
I want to extract data from emails and use it in workflow actions,
So that automation can be dynamic and contextual.

**Acceptance Criteria:**
1. Variable nodes: extract data from email (sender, subject, body text, date)
2. Variable storage: temporary variables scoped to workflow execution
3. Variable usage in actions: insert variable into email template, attribute value
4. Example: Extract "deadline" from subject → Store as variable → Set Due-Date attribute to deadline value
5. Variable types: string, date, number, boolean
6. Variable transformations: uppercase, lowercase, substring, regex extract
7. Variable debugging: show variable values in execution log

**Prerequisites:** Story 5.5

---

**Story 6.8: Screen Flows - Multi-Step User Interaction**

As a user,
I want workflows that pause for my input,
So that I can confirm or provide data before automation continues.

**Acceptance Criteria:**
1. Screen flow node type: pauses workflow and shows UI modal
2. Modal displays: message, input fields, buttons (Continue, Cancel)
3. User input captured as variables and used in subsequent nodes
4. Example workflow: "Email arrives → Show modal: 'Which project is this?' → User selects → Apply Project attribute"
5. Timeout configuration: if user doesn't respond in N minutes, take default action
6. Screen flow history: see pending and completed screen flows
7. Screen flow notifications: notify user when input needed

**Prerequisites:** Story 5.7

---

**Story 6.9: Workflow Templates & AI-Suggested Workflows**

As a user,
I want pre-built workflow templates and AI suggestions,
So that I can quickly set up common automation patterns.

**Acceptance Criteria:**
1. Workflow template library in settings
2. Built-in templates: "Auto-archive newsletters", "Escalate urgent client emails", "Triage internal vs external"
3. Template import: one-click add template to user's workflows
4. AI workflow suggestions: AI analyzes user email patterns and suggests workflows
5. Example: "I notice you always archive emails from @newsletter.com after reading. Want me to create a workflow?"
6. Suggestion UI: shows suggested workflow diagram, accept/reject buttons
7. Accepted suggestions added to workflows, activated automatically
8. Suggestion dismissal: user can dismiss and won't see again

**Prerequisites:** Story 5.5, Story 3.13 (AI Learning)

---

**Story 6.10: Workflow Execution Engine - Trigger Processing & Action Queue**

As a developer,
I want reliable workflow execution with queuing and retry logic,
So that workflows run consistently even under load.

**Acceptance Criteria:**
1. Workflow execution triggered by events (email sync, attribute changes, schedule)
2. Execution queue: workflows queued for processing, processed sequentially
3. Parallel execution for independent workflows (multiple workflows can run simultaneously)
4. Retry logic for failed actions (e.g., send email fails due to network → retry 3 times)
5. Workflow timeout: abort if execution exceeds N minutes
6. Error handling: log errors, notify user, mark workflow as failed
7. Execution history: track all workflow runs (success, failure, duration)

**Prerequisites:** Story 5.1, Story 5.5

---

**Story 6.11: Workflow Execution Logs & Debugging**

As a user,
I want detailed logs of workflow executions,
So that I can understand what automation did and troubleshoot issues.

**Acceptance Criteria:**
1. Workflow execution log viewer in UI
2. Log entry shows: workflow name, trigger event, start time, duration, status (success/failed)
3. Detailed step-by-step log: each node execution, conditions evaluated, actions taken
4. Email context: link to email that triggered workflow
5. Variable values logged at each step
6. Error messages shown for failed steps
7. Filter logs: by workflow, by date range, by status
8. Export logs to JSON/CSV for analysis

**Prerequisites:** Story 5.10

---

**Story 6.12: Workflow Enable/Disable & Management**

As a user,
I want to manage my workflows (enable, disable, edit, delete),
So that I can control which automations are active.

**Acceptance Criteria:**
1. Workflows list view: shows all workflows with status (enabled/disabled)
2. Toggle switch to enable/disable workflow (disabling prevents trigger from firing)
3. Edit workflow: opens visual editor with existing workflow loaded
4. Duplicate workflow: create copy to modify
5. Delete workflow: soft delete with confirmation dialog
6. Workflow statistics: show execution count, success rate, last run time
7. Search/filter workflows by name, trigger type, status

**Prerequisites:** Story 5.11

---

**Story 5.13: Workflow Performance Optimization**

As a developer,
I want workflow execution to be fast and efficient,
So that automation doesn't impact user experience.

**Acceptance Criteria:**
1. Workflow execution completes in <500ms for simple workflows (3-5 nodes)
2. Complex workflows (10+ nodes) complete in <2 seconds
3. Workflows execute in Web Worker (doesn't block UI thread)
4. Workflow definitions cached in memory (loaded once, reused)
5. Attribute queries optimized (use RxDB indexes)
6. Batch execution: multiple emails triggering same workflow processed in batch
7. Performance monitoring: track execution times, identify slow workflows

**Prerequisites:** Story 5.10

**Estimated Effort:** 6 hours

---

**Story 5.14: Audit Workflow Editor for Keyboard Navigation and ARIA Compliance** *(NEW - Gate-Check Medium Priority)*

As a user with disabilities,
I want the workflow editor to be fully accessible via keyboard and screen reader,
So that I can create and edit workflows without using a mouse.

**Acceptance Criteria:**

**Keyboard Navigation:**
1. Full keyboard navigation for workflow editor:
   - Tab: Navigate between nodes, edges, toolbar buttons
   - Arrow keys: Move focus between connected nodes
   - Enter: Open node editor modal
   - Escape: Close modals, cancel drag operations
   - Space: Select/deselect nodes
   - Ctrl+C/V: Copy/paste nodes
   - Delete: Remove selected nodes/edges
2. Node editor modal fully keyboard accessible
3. Toolbar buttons keyboard accessible
4. Node palette keyboard accessible (Tab to select, Enter to add)

**ARIA Labels and Roles:**
5. ARIA roles assigned to all components:
   - Canvas: `role="region"` `aria-label="Workflow canvas"`
   - Nodes: `role="button"` `aria-label="Trigger Node: Email Arrives"`
   - Edges: `aria-label="Connection from node 1 to node 2"`
   - Toolbar: `role="toolbar"` `aria-label="Workflow tools"`
6. Node type announced by screen reader (e.g., "Trigger Node", "Condition Node")
7. Node connections announced (e.g., "Connected to Decision Node")
8. Workflow state changes announced (e.g., "Workflow enabled", "Node added")

**Focus Management:**
9. Focus indicator visible (2px blue outline) on all focusable elements
10. Focus trapped in modals (doesn't escape to background)
11. Focus restored to triggering element when modal closes
12. Skip links provided (e.g., "Skip to canvas", "Skip to toolbar")

**Screen Reader Support:**
13. Screen reader announces:
    - Node types when focused
    - Node connections when traversing
    - Validation errors when saving workflow
    - Success messages when workflow saved
14. ARIA live regions for dynamic updates
15. Workflow execution status announced (e.g., "Workflow running", "Workflow completed")

**Color Contrast:**
16. All text meets WCAG 2.1 AA: ≥4.5:1 contrast ratio
17. Node colors distinguishable (not relying on color alone)
18. Focus indicators meet 3:1 contrast ratio

**Testing:**
19. Playwright accessibility tests with axe-core run in CI
20. Manual testing with NVDA (Windows) and VoiceOver (macOS)
21. Manual keyboard-only testing (no mouse)
22. Test: All features accessible via keyboard
23. Test: Screen reader announces all important information
24. Test: No WCAG 2.1 AA violations

**Prerequisites:** Story 5.2 (Visual Workflow Editor)

**Estimated Effort:** 8 hours

---

## Epic 6: Autonomous Action Engine & Trust Building

### Expanded Goal

Implement permission-based autonomy system allowing AI to execute actions based on user-defined rules, with comprehensive action logging, rollback capability, and trust visualization. This epic represents the culmination of AI features, enabling full autonomous operation while maintaining user control and transparency. Trust Meter visualization is marked as optional stretch goal to de-risk MVP delivery.

### Value Delivery

By the end of this epic, users can:
- Define granular permissions for AI autonomy (message-level, domain-level)
- Create automation rules (if/then logic)
- Review comprehensive action logs showing all AI activity
- Undo any AI action instantly
- See Trust Meter visualization of their autonomy level (stretch goal)
- Experience true AI assistant partnership with transparent oversight

### Story Breakdown

**Story 6.1: Permission System Architecture**

As a developer,
I want a flexible permission system for AI autonomy,
So that users can grant fine-grained control.

**Acceptance Criteria:**
1. Permission data model: message-level, sender-level, domain-level
2. Default permissions: "Suggest only" (AI cannot act without approval)
3. Permission inheritance: domain rules override message rules
4. Permission storage in RxDB with fast lookup
5. Permission evaluation engine (check before each AI action)
6. API for querying permissions (canPerform(action, context))

**Prerequisites:** Epic 4 complete

---

**Story 6.2: Permission Settings UI**

As a user,
I want to configure AI permissions granularly,
So that I control exactly what AI can do autonomously.

**Acceptance Criteria:**
1. Settings UI shows permission matrix: action types × scope levels
2. Action types: Triage, Archive, Draft & Send, Schedule
3. Scope levels: All emails, Internal only, Specific domains, Never
4. Toggle switches for each permission combination
5. Permission presets: Conservative, Balanced, Autonomous
6. Changes take effect immediately (no restart required)

**Prerequisites:** Story 6.1

---

**Story 6.3: Automation Rule Builder**

As a user,
I want to create custom automation rules,
So that AI handles routine tasks my way.

**Acceptance Criteria:**
1. Rule builder UI: If [condition] Then [action]
2. Conditions: sender, subject contains, body contains, priority level
3. Actions: auto-archive, auto-respond (template), move to folder, mark read
4. Multiple conditions with AND/OR logic
5. Rule preview: "This rule will affect X emails in your inbox"
6. Rules stored in RxDB, evaluated during email processing

**Prerequisites:** Story 6.2

---

**Story 6.4: Autonomous Action Execution Engine**

As a developer,
I want AI to execute permitted actions autonomously,
So that users experience true automation.

**Acceptance Criteria:**
1. Action queue processes permitted actions automatically
2. Permission check before each action execution
3. Action batching: group similar actions for efficiency
4. Rollback capability: every action stores undo state
5. Failure handling: log errors, notify user, don't retry destructive actions
6. Performance: actions execute within <100ms

**Prerequisites:** Story 6.1, Story 6.3

---

**Story 6.5: Action Log & History**

As a user,
I want to review all AI actions taken on my behalf,
So that I maintain oversight and trust.

**Acceptance Criteria:**
1. Action log accessible from main menu or settings
2. Log entries show: timestamp, action type, affected email, reasoning
3. Filterable by: date range, action type, success/failure
4. Searchable by email subject or sender
5. Log retention: last 90 days, then archived
6. Export log to CSV for external review

**Prerequisites:** Story 6.4

---

**Story 6.6: Undo Capability for AI Actions**

As a user,
I want to undo any AI action instantly,
So that mistakes can be corrected easily.

**Acceptance Criteria:**
1. Undo button next to each action in log
2. Undo reverses action: restore archived email, unsend draft, etc.
3. Undo available for 30 days after action
4. Confirmation dialog for irreversible actions (e.g., permanent delete)
5. Undo triggers AI learning: "Don't do this again for similar emails"
6. Bulk undo: select multiple actions, undo all

**Prerequisites:** Story 6.5

---

**Story 6.7: Trust Meter Visualization (Optional Stretch Goal)**

As a user,
I want visual feedback on my AI autonomy level,
So that I understand my delegation settings at a glance.

**Acceptance Criteria:**
1. Trust Meter widget in main UI (0-100% autonomy scale)
2. Meter updates when permissions changed
3. Visual states: Maximum Control (0-20%), Selective (20-50%), Balanced (50-70%), Strategic (70-90%), Full Autonomy (90-100%)
4. Clicking meter opens permission settings
5. Subtle pulse animation when autonomy level changes
6. Meter tooltip explains current level and what AI can do

**Prerequisites:** Story 6.2
**Note:** Marked as optional stretch goal for MVP de-risking. Depends on telemetry infrastructure.

---

**Story 6.8: AI Confidence Thresholds**

As a user,
I want to set AI confidence thresholds for autonomous actions,
So that AI only acts when highly confident.

**Acceptance Criteria:**
1. Threshold slider in settings: "Act only if >X% confident"
2. Default threshold: 90% (conservative)
3. Actions below threshold flagged for user review
4. Review queue shows low-confidence suggested actions
5. User approval of low-confidence actions trains AI (increases confidence)
6. Per-action-type thresholds: stricter for "send" than "archive"

**Prerequisites:** Story 6.4

---

**Story 6.9: Autonomous Action Notifications**

As a user,
I want periodic summaries of AI actions,
So that I stay aware without being overwhelmed.

**Acceptance Criteria:**
1. Daily digest: "AI handled X emails today"
2. Digest shows breakdown: Y archived, Z responded, etc.
3. Click digest to open full action log
4. Real-time notification for high-impact actions (e.g., "AI sent reply to CEO")
5. Notification frequency configurable: real-time, daily, weekly
6. Quiet mode: no notifications, check log manually

**Prerequisites:** Story 6.5

---

**Story 6.10: Safety Rails & Action Limits**

As a developer,
I want safety mechanisms to prevent AI mistakes,
So that autonomous actions are trustworthy.

**Acceptance Criteria:**
1. Rate limiting: max 50 autonomous actions per hour
2. High-risk action detection: emails to VIPs require approval
3. Confirmation required for: permanent delete, mass archive (>10 emails)
4. Circuit breaker: if 3 consecutive undos, pause autonomy, notify user
5. Dry run mode: simulate actions without executing (for testing rules)
6. Emergency stop: user can pause all autonomy instantly

**Prerequisites:** Story 6.4, Story 6.6

---

**Story 6.11: Progressive Autonomy Onboarding**

As a new user,
I want guided onboarding for AI autonomy,
So that I trust the system gradually.

**Acceptance Criteria:**
1. First-time autonomy setup wizard
2. Week 1: Suggest only (no autonomous actions)
3. Week 2: Prompt to enable low-risk autonomy (e.g., newsletter auto-responses)
4. Week 3+: Suggest broader permissions based on AI accuracy
5. Onboarding respects user pace (can skip ahead or stay conservative)
6. Educational tooltips explain each permission level

**Prerequisites:** Story 6.2, Story 6.3

---

**Story 6.12: Autonomy Analytics & Insights**

As a user,
I want insights into AI autonomy effectiveness,
So that I can optimize my delegation.

**Acceptance Criteria:**
1. Analytics dashboard shows: time saved, actions taken, accuracy rate
2. Time saved calculation: estimated manual time vs. AI execution time
3. Accuracy: % of actions not undone
4. Recommendations: "Enable auto-archive for newsletters to save 15 min/week"
5. Trend charts: autonomy level over time, time savings over time
6. Shareable insights: export analytics for productivity tracking

**Prerequisites:** Story 6.5, Story 6.9

---

## Story Guidelines Reference

**Story Format:**

```
**Story [EPIC.N]: [Story Title]**

As a [user type],
I want [goal/desire],
So that [benefit/value].

**Acceptance Criteria:**
1. [Specific testable criterion]
2. [Another specific criterion]
3. [etc.]

**Prerequisites:** [Dependencies on previous stories, if any]
```

**Story Requirements:**

- **Vertical slices** - Complete, testable functionality delivery
- **Sequential ordering** - Logical progression within epic
- **No forward dependencies** - Only depend on previous work
- **AI-agent sized** - Completable in 2-4 hour focused session
- **Value-focused** - Integrate technical enablers into value-delivering stories

---

**For implementation:** Use the `create-story` workflow to generate individual story implementation plans from this epic breakdown.
