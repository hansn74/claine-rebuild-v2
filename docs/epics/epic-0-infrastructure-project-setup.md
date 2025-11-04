# Epic 0: Infrastructure & Project Setup

## Expanded Goal

Establish the complete project infrastructure and development environment for Claine v2 before any feature development begins. This epic creates the technical foundation using the validated architecture (Vite 7.0, React 19.2, TypeScript 5.9, PWA), sets up automated testing and deployment pipelines, configures code quality tools, and ensures the development team can start building features immediately after Epic 0 completes.

**Critical Note:** This is a **prerequisite epic** that must complete before Epic 1 begins. No feature stories can be implemented until the project foundation is ready.

## Value Delivery

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

## Story Breakdown

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

## Epic 0 Summary

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
