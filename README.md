# Claine v2

[![CI](https://github.com/hansnieuwenhuis/claine-rebuild-v2/actions/workflows/ci.yml/badge.svg)](https://github.com/hansnieuwenhuis/claine-rebuild-v2/actions/workflows/ci.yml)
[![Deployment](https://img.shields.io/badge/deployment-vercel-black)](https://claine-rebuild-v2.vercel.app)

> AI-powered, offline-first email client with visual workflow automation

## Overview

Claine v2 is an intelligent email client that combines the power of local AI with a privacy-first, offline-capable architecture. Built as a Progressive Web App, Claine helps you manage your inbox through automated triage, smart workflows, and AI-assisted responses—all while keeping your data under your control.

**Key Features:**

- **Offline-First Architecture**: Full functionality without an internet connection using IndexedDB and service workers
- **Local AI Integration**: Privacy-preserving email triage and response generation using local LLMs (Ollama)
- **Visual Workflow Builder**: Create custom automation workflows with a drag-and-drop interface
- **Multi-Account Support**: Manage Gmail and Outlook accounts in one unified inbox
- **Custom Attributes**: Tag and organize emails with flexible, user-defined attributes

The project is currently in active development (Epic 0: Infrastructure & Project Setup complete).

## Technology Stack

Claine v2 is built with modern web technologies optimized for performance, developer experience, and user privacy:

| Category             | Technology        | Version      | Purpose                               |
| -------------------- | ----------------- | ------------ | ------------------------------------- |
| **Framework**        | React             | 19.2         | UI library with concurrent features   |
| **Build Tool**       | Vite              | 7.1+         | Fast development and optimized builds |
| **Language**         | TypeScript        | 5.9          | Type-safe development                 |
| **Runtime**          | Node.js           | 22.x LTS     | Development environment               |
| **Styling**          | TailwindCSS       | 4.1+         | Utility-first CSS with Oxide engine   |
| **UI Components**    | shadcn/ui         | Latest       | Accessible, customizable components   |
| **Database**         | RxDB + IndexedDB  | 16.20+       | Offline-first reactive database       |
| **State Management** | Zustand           | 5.0+         | Lightweight state management          |
| **Testing - Unit**   | Vitest            | 4.0+         | Fast unit test runner                 |
| **Testing - E2E**    | Playwright        | 1.56+        | Cross-browser end-to-end testing      |
| **Code Quality**     | ESLint + Prettier | 9.39+ / 3.6+ | Linting and formatting                |
| **Git Hooks**        | Husky             | 9.1+         | Pre-commit quality checks             |
| **Deployment**       | Vercel            | Latest       | Serverless deployment platform        |

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: Version 22.x LTS (minimum 22.0.0, required by Vite 7.0)
  - Check version: `node --version`
  - Download: [nodejs.org](https://nodejs.org/)
- **npm**: Version 10.0.0 or higher (comes with Node.js)
  - Check version: `npm --version`
- **Git**: For version control
  - Check version: `git --version`
  - Download: [git-scm.com](https://git-scm.com/)

## Quick Start

Get up and running in under 5 minutes:

### 1. Clone the Repository

```bash
git clone https://github.com/hansnieuwenhuis/claine-rebuild-v2.git
cd claine-rebuild-v2
```

### 2. Install Dependencies

```bash
npm install
```

This will install all required dependencies and set up Husky pre-commit hooks automatically.

### 3. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` and set your environment variables:

```env
VITE_APP_NAME=Claine (Dev)
VITE_API_URL=https://gmail.googleapis.com
```

For detailed environment variable configuration, see [ENV_SETUP.md](ENV_SETUP.md).

### 4. Start Development Server

```bash
npm run dev
```

The app will be available at [http://localhost:5154](http://localhost:5154)

That's it! You're ready to start developing.

## Available Scripts

### Development

- **`npm run dev`** - Start Vite development server with hot module replacement (port 5154)
- **`npm run build`** - Build production bundle (TypeScript compilation + Vite build)
- **`npm run preview`** - Preview production build locally
- **`npm run analyze`** - Build and visualize bundle size with interactive chart

### Testing

- **`npm run test`** - Run Vitest unit tests in watch mode
- **`npm run test:run`** - Run unit tests once (CI mode, no watch)
- **`npm run test:coverage`** - Run tests with coverage report
- **`npm run test:ui`** - Run tests with Vitest UI dashboard
- **`npm run test:e2e`** - Run Playwright E2E tests (headless)
- **`npm run test:e2e:ui`** - Run E2E tests with Playwright UI
- **`npm run test:e2e:debug`** - Debug E2E tests in Playwright inspector
- **`npm run test:e2e:report`** - Show last E2E test report

### Code Quality

- **`npm run lint`** - Lint code with ESLint
- **`npm run lint:fix`** - Auto-fix ESLint issues
- **`npm run format`** - Format code with Prettier
- **`npm run format:check`** - Check Prettier formatting without modifying files

### Hooks

- **`npm run prepare`** - Set up Husky git hooks (runs automatically after install)

## Project Structure

```
claine-rebuild-v2/
├── .github/
│   └── workflows/
│       └── ci.yml              # GitHub Actions CI/CD pipeline
├── docs/                       # Project documentation
│   ├── architecture.md         # Architecture decisions and patterns
│   ├── PRD.md                  # Product requirements document
│   ├── epics/                  # Epic breakdown and story definitions
│   └── stories/                # Detailed user story documentation
├── public/                     # Static assets (served as-is)
├── src/
│   ├── features/               # Feature modules (organized by domain)
│   │   ├── email/              # Email management features
│   │   ├── ai/                 # AI triage and automation
│   │   ├── workflow/           # Visual workflow builder
│   │   └── auth/               # OAuth authentication
│   ├── shared/                 # Shared code across features
│   │   ├── components/         # Reusable UI components
│   │   ├── hooks/              # Custom React hooks
│   │   ├── services/           # Business logic and API clients
│   │   ├── store/              # State management (Zustand)
│   │   ├── types/              # TypeScript type definitions
│   │   └── utils/              # Utility functions
│   ├── lib/                    # Third-party library configurations
│   │   └── env.ts              # Environment variable validation
│   ├── db/                     # Database layer (RxDB)
│   │   ├── schemas/            # Database schemas
│   │   └── migrations/         # Schema migrations
│   ├── workers/                # Service workers for offline support
│   ├── routes/                 # Route definitions
│   ├── test/                   # Test utilities and setup
│   ├── App.tsx                 # Root application component
│   ├── main.tsx                # Application entry point
│   └── index.css               # Global styles
├── tests/                      # E2E test specs (Playwright)
├── .env.example                # Environment variable template
├── ENV_SETUP.md                # Environment setup guide
├── package.json                # Project dependencies and scripts
├── tsconfig.json               # TypeScript configuration (base)
├── tsconfig.app.json           # TypeScript config for app code
├── tsconfig.node.json          # TypeScript config for build tools
├── vite.config.ts              # Vite build configuration
├── vitest.config.ts            # Vitest test configuration
├── playwright.config.ts        # Playwright E2E test configuration
├── tailwind.config.ts          # TailwindCSS configuration
├── postcss.config.js           # PostCSS configuration
├── vercel.json                 # Vercel deployment configuration
└── README.md                   # This file
```

### Key Configuration Files

- **`vite.config.ts`** - Vite build tool configuration (plugins, aliases, dev server)
- **`tsconfig.json`** - TypeScript compiler options and path mappings
- **`tailwind.config.ts`** - TailwindCSS theme, plugins, and content paths
- **`playwright.config.ts`** - E2E test configuration (browsers, timeouts, reporters)
- **`vitest.config.ts`** - Unit test configuration (environment, coverage)
- **`vercel.json`** - Vercel deployment settings (headers, redirects, build config)
- **`components.json`** - shadcn/ui component configuration

For detailed architectural patterns and decisions, see [docs/architecture.md](docs/architecture.md).

## Documentation

### Project Documentation

- **[Architecture Decision Document](docs/architecture.md)** - Technology choices, patterns, and architectural decisions
- **[Product Requirements Document](docs/PRD.md)** - Product vision, features, and requirements
- **[Environment Setup Guide](ENV_SETUP.md)** - Detailed environment variable configuration
- **[Epic 0 Documentation](docs/epics/epic-0-infrastructure-project-setup.md)** - Infrastructure and project setup epic

### Development Resources

- **[Story Documentation](docs/stories/)** - Detailed user stories with acceptance criteria and implementation notes
- **[Epic Breakdown](docs/epics/)** - Feature epics and story definitions

## Contributing

We welcome contributions! Please follow these guidelines:

### Branch Naming

Use descriptive branch names with the following prefixes:

- `feature/` - New features (e.g., `feature/email-sync-engine`)
- `fix/` - Bug fixes (e.g., `fix/login-redirect-loop`)
- `refactor/` - Code refactoring (e.g., `refactor/database-layer`)
- `docs/` - Documentation updates (e.g., `docs/architecture-decisions`)
- `test/` - Test additions or fixes (e.g., `test/email-list-e2e`)
- `chore/` - Maintenance tasks (e.g., `chore/update-dependencies`)

### Commit Message Format

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
type(scope): brief description

Detailed explanation of changes (optional)

Fixes #123
```

**Types:**

- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Code style changes (formatting, no logic changes)
- `refactor` - Code refactoring
- `test` - Test additions or modifications
- `chore` - Build process or tooling changes

**Examples:**

```
feat(email): add offline sync queue for Gmail API
fix(auth): resolve OAuth token refresh race condition
docs(readme): update setup instructions for Node.js 22
test(workflow): add E2E tests for visual workflow builder
```

### Pull Request Process

1. **Create a feature branch** from `main`
2. **Make your changes** following the project's coding standards
3. **Write tests** for new functionality
4. **Ensure all tests pass** locally:
   ```bash
   npm run lint
   npm run test:run
   npm run test:e2e
   ```
5. **Commit your changes** with descriptive commit messages
6. **Push to your fork** and create a pull request
7. **Wait for code review** - at least one approval required
8. **Address feedback** if any changes are requested
9. **Merge** once approved and all CI checks pass

### Pre-commit Hooks

The project uses Husky and lint-staged to automatically run quality checks before commits:

- **ESLint** - Lints and auto-fixes TypeScript/JavaScript files
- **Prettier** - Formats all code and config files
- **Type checking** - Validates TypeScript types

If pre-commit checks fail, fix the issues before committing. You can run checks manually:

```bash
npm run lint:fix
npm run format
```

### Code Review Requirements

- All pull requests require at least **one approval** from a maintainer
- All **CI checks must pass** (lint, tests, build)
- **Coverage should not decrease** for new code
- **Documentation must be updated** for API changes or new features

## Deployment

### Production Deployment (Vercel)

The main branch is automatically deployed to production on every push:

- **Production URL**: [https://claine-rebuild-v2.vercel.app](https://claine-rebuild-v2.vercel.app)
- **Automatic deployments** on push to `main` branch
- **Build command**: `npm run build`
- **Output directory**: `dist/`

### Preview Deployments

Every pull request gets an automatic preview deployment:

- **Preview URL**: `claine-rebuild-v2-{pr-number}.vercel.app`
- **Updated automatically** on every push to the PR branch
- **Deleted automatically** when PR is closed

### Environment Variables in Vercel

Configure environment variables in the Vercel dashboard:

1. Go to **Project Settings** → **Environment Variables**
2. Add variables for each environment:
   - **Production**: Live deployment on main branch
   - **Preview**: Pull request deployments

Required variables:

- `VITE_APP_NAME` - Application name (e.g., "Claine")

See [ENV_SETUP.md](ENV_SETUP.md) for detailed configuration instructions.

### CI/CD Pipeline (GitHub Actions)

The CI pipeline runs on every push and pull request:

1. **Lint** - ESLint code quality checks
2. **Unit Tests** - Vitest test suite with coverage
3. **E2E Tests** - Playwright cross-browser testing
4. **Build** - Production build verification
5. **Bundle Size Check** - Ensure bundle stays under 500 KB

View pipeline configuration: [`.github/workflows/ci.yml`](.github/workflows/ci.yml)

## Performance Metrics

Current bundle size (as of Epic 0 completion):

- **Initial bundle**: ~224 KB (gzipped)
- **Budget**: 500 KB (well under target)
- **Build time**: <10 seconds with Vite 7.0

### Bundle Analysis

Claine v2 uses `rollup-plugin-visualizer` to monitor bundle size and prevent performance regressions:

**Analyzing Bundle Size:**

```bash
npm run analyze
```

This command:

1. Builds the production bundle with TypeScript compilation
2. Generates an interactive visualization at `stats.html`
3. Opens the visualization in your default browser

**Bundle Size Budgets:**

The project enforces size budgets to maintain fast load times:

- **Initial bundle**: <500 KB (enforced via build warnings)
- **Email chunk**: <200 KB (future Epic 1-2)
- **AI chunk**: <3 MB (future Epic 3-4, includes ONNX Runtime)

**Understanding the Visualization:**

- **Sunburst chart** shows bundle composition by module
- **Click segments** to drill down into dependencies
- **Hover** to see module sizes (uncompressed, gzipped, brotli)
- **Search** to find specific modules or dependencies

**Budget Warnings:**

If a chunk exceeds the size budget, Vite will display a warning during build:

```
(!) Some chunks are larger than 500 KB after minification.
```

This helps catch performance regressions before they reach production.

## License

This project is private and proprietary. All rights reserved.

## Support

For questions or issues:

1. Check the [documentation](docs/)
2. Review [existing issues](https://github.com/hansnieuwenhuis/claine-rebuild-v2/issues)
3. Create a [new issue](https://github.com/hansnieuwenhuis/claine-rebuild-v2/issues/new) if needed

---

Built with Vite + React + TypeScript | Deployed on Vercel
