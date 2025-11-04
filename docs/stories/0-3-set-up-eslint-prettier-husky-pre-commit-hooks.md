# Story 0.3: Set Up ESLint + Prettier + Husky Pre-commit Hooks

Status: ready-for-dev

## Story

As a developer,
I want automated code quality enforcement,
so that all code meets consistent standards before being committed.

## Acceptance Criteria

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

## Tasks / Subtasks

- [ ] Install and configure ESLint with TypeScript support (AC: 1)
  - [ ] Run `npm install eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin -D`
  - [ ] Create `.eslintrc.cjs` configuration file
  - [ ] Configure TypeScript parser and plugin
  - [ ] Set up parser options for TypeScript 5.9
  - [ ] Test: ESLint can parse TypeScript files without errors

- [ ] Configure ESLint rules for React 19.2 (AC: 2)
  - [ ] Run `npm install eslint-plugin-react eslint-plugin-react-hooks eslint-plugin-jsx-a11y -D`
  - [ ] Add React plugin to ESLint config
  - [ ] Configure React version detection (automatic)
  - [ ] Enable recommended React rules
  - [ ] Enable React Hooks rules
  - [ ] Enable JSX accessibility rules
  - [ ] Test: ESLint recognizes React components and hooks

- [ ] Install and configure Prettier (AC: 3)
  - [ ] Run `npm install prettier -D`
  - [ ] Create `.prettierrc` configuration file
  - [ ] Configure Prettier options (semi, singleQuote, tabWidth, etc.)
  - [ ] Create `.prettierignore` file
  - [ ] Test: Prettier can format files

- [ ] Integrate ESLint and Prettier (AC: 4)
  - [ ] Run `npm install eslint-config-prettier -D`
  - [ ] Add `eslint-config-prettier` to ESLint extends array (must be last)
  - [ ] Verify ESLint and Prettier rules don't conflict
  - [ ] Test: Both ESLint and Prettier work together without conflicts

- [ ] Install and configure Husky (AC: 5)
  - [ ] Run `npm install husky lint-staged -D`
  - [ ] Run `npx husky install`
  - [ ] Add `prepare` script to package.json: `"prepare": "husky install"`
  - [ ] Create `.husky/pre-commit` hook file
  - [ ] Make hook executable
  - [ ] Test: Husky hooks are installed

- [ ] Configure pre-commit hook to run linters (AC: 6)
  - [ ] Configure `lint-staged` in package.json
  - [ ] Set lint-staged to run ESLint on `*.{ts,tsx,js,jsx}` files
  - [ ] Set lint-staged to run Prettier on `*.{ts,tsx,js,jsx,json,css,md}` files
  - [ ] Update `.husky/pre-commit` to run `npx lint-staged`
  - [ ] Test: Pre-commit hook runs on staged files

- [ ] Verify pre-commit hook blocks bad commits (AC: 7)
  - [ ] Create intentional ESLint error in test file
  - [ ] Stage the file and attempt to commit
  - [ ] Verify commit is blocked with ESLint error message
  - [ ] Fix the error and verify commit succeeds
  - [ ] Test: Bad commits are blocked

- [ ] Add NPM scripts for manual linting and formatting (AC: 8)
  - [ ] Add `"lint": "eslint . --ext ts,tsx,js,jsx --report-unused-disable-directives --max-warnings 0"` to package.json scripts
  - [ ] Add `"lint:fix": "eslint . --ext ts,tsx,js,jsx --fix"` to package.json scripts
  - [ ] Add `"format": "prettier --write \"src/**/*.{ts,tsx,js,jsx,json,css,md}\""` to package.json scripts
  - [ ] Add `"format:check": "prettier --check \"src/**/*.{ts,tsx,js,jsx,json,css,md}\""` to package.json scripts
  - [ ] Test: All NPM scripts work correctly

- [ ] Test linting error detection (AC: 9, 10)
  - [ ] Run `npm run lint` on clean codebase - should pass
  - [ ] Introduce intentional ESLint errors:
    - Unused variable
    - Missing semicolon (if configured)
    - Incorrect React hook usage
  - [ ] Run `npm run lint` - should detect and report all issues
  - [ ] Try to commit with errors - should be blocked by pre-commit hook
  - [ ] Run `npm run lint:fix` - should fix auto-fixable issues
  - [ ] Clean up test errors
  - [ ] Test: Lint detection and blocking work correctly

- [ ] Verify integration and cleanup (AC: 1-10)
  - [ ] Run `npm run lint` on entire codebase - should pass
  - [ ] Run `npm run format:check` - should pass
  - [ ] Test commit with no issues - should succeed
  - [ ] Test commit with linting issues - should be blocked
  - [ ] Verify all NPM scripts work as expected
  - [ ] Clean up any test files created
  - [ ] Test: All acceptance criteria verified

## Dev Notes

### Architecture Patterns and Constraints

**Code Quality Standards (from architecture.md):**
- **ESLint Configuration:** TypeScript-first with React 19.2 support
- **Prettier Integration:** Consistent code formatting across team
- **Pre-commit Enforcement:** Prevent bad code from entering repository
- **Testing Integration:** Linting must work with Vitest and Playwright test files

**From Story 0.1 Prerequisites:**
- Vite 7.1.12 + React 19.2 + TypeScript 5.9 already installed
- Project structure established with `src/` directory
- Package.json scripts already configured for build and dev
- Must integrate with existing Vite configuration

**From Story 0.2 Learnings:**
- Path aliases configured: `@shared/*`, `@/`, `@features/*`
- TailwindCSS 4.0 installed - Prettier should handle CSS formatting
- shadcn/ui components at `src/shared/components/ui/` - ESLint should lint these
- Architecture compliance important - use `src/shared/` patterns

### Project Structure Notes

**File Locations:**
- ESLint config: `.eslintrc.cjs` (project root) - CJS format for compatibility
- Prettier config: `.prettierrc` (project root) - JSON format
- Prettier ignore: `.prettierignore` (project root)
- Husky hooks: `.husky/` directory (project root)
- Lint-staged config: `package.json` (lint-staged field)

**Files to Lint:**
- Source files: `src/**/*.{ts,tsx,js,jsx}`
- Test files: `tests/**/*.{ts,tsx}` (when created in Stories 0.4, 0.5)
- Config files: `*.config.{ts,js,cjs}`
- Ignore: `node_modules/`, `dist/`, `.husky/`

**Files to Format:**
- All source: `src/**/*.{ts,tsx,js,jsx,json,css,md}`
- Markdown: `*.md`, `docs/**/*.md`
- Config: `*.json`, `*.config.{ts,js,cjs}`
- CSS: `src/**/*.css`

### ESLint Configuration

**Recommended Configuration (.eslintrc.cjs):**
```javascript
module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime', // For React 17+ JSX transform
    'plugin:react-hooks/recommended',
    'plugin:jsx-a11y/recommended',
    'prettier', // Must be last to override conflicting rules
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: [
    '@typescript-eslint',
    'react',
    'react-hooks',
    'jsx-a11y',
  ],
  rules: {
    // TypeScript
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-module-boundary-types': 'off',

    // React
    'react/react-in-jsx-scope': 'off', // Not needed in React 17+
    'react/prop-types': 'off', // Using TypeScript for prop validation

    // General
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
  settings: {
    react: {
      version: 'detect', // Automatically detect React version
    },
  },
  ignorePatterns: ['dist', 'node_modules', '.husky'],
}
```

### Prettier Configuration

**Recommended Configuration (.prettierrc):**
```json
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

**Prettier Ignore (.prettierignore):**
```
# Build outputs
dist
build
coverage

# Dependencies
node_modules

# Husky
.husky

# Logs
*.log

# OS files
.DS_Store
```

### Husky and Lint-Staged Configuration

**Package.json additions:**
```json
{
  "scripts": {
    "prepare": "husky install",
    "lint": "eslint . --ext ts,tsx,js,jsx --report-unused-disable-directives --max-warnings 0",
    "lint:fix": "eslint . --ext ts,tsx,js,jsx --fix",
    "format": "prettier --write \"src/**/*.{ts,tsx,js,jsx,json,css,md}\"",
    "format:check": "prettier --check \"src/**/*.{ts,tsx,js,jsx,json,css,md}\""
  },
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,css,md}": [
      "prettier --write"
    ]
  }
}
```

**Pre-commit Hook (.husky/pre-commit):**
```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx lint-staged
```

### Testing Standards

**Manual Testing for Story 0.3:**
- Create intentional linting errors and verify detection
- Test pre-commit hook blocking with various error types
- Verify `npm run lint` detects all rule violations
- Verify `npm run format` formats all files consistently
- Test that clean code commits without issues

**Expected Outcomes:**
- ESLint detects TypeScript and React issues
- Prettier formats code consistently
- Pre-commit hook prevents bad code from being committed
- Manual scripts work for linting and formatting entire codebase
- No conflicts between ESLint and Prettier

### Learnings from Previous Story

**From Story 0.2 (Status: done)**

Story 0.2 successfully configured TailwindCSS 4.0 + shadcn/ui with architecture-compliant patterns:

**Files Created:**
- `tailwind.config.ts` - ESLint should lint this config file
- `postcss.config.js` - ESLint should lint this config file
- `components.json` - Prettier should format this JSON file
- `src/shared/components/ui/button.tsx` - ESLint must lint React components here
- `src/shared/utils/cn.ts` - ESLint must lint TypeScript utilities

**Files Modified:**
- `package.json` - Already has scripts section, will add lint/format scripts
- `tsconfig.json` - ESLint parser must respect this TypeScript config
- `src/index.css` - Prettier should format CSS files
- `src/App.tsx` - ESLint must lint React components with Tailwind classes

**Architectural Patterns to Maintain:**
- Architecture-compliant paths: `src/shared/components/ui/` for components
- Path aliases working: `@shared/*`, `@/`, `@features/*` - ESLint resolver must understand these
- TailwindCSS classes in JSX - ESLint should not flag string literals with Tailwind classes
- React 19.2 patterns - ESLint rules must support latest React features

**Key Lessons:**
- Documentation accuracy matters - ensure .eslintrc path matches what's created
- Architecture compliance - lint rules should enforce `src/shared/` patterns if possible
- Path alias support - ESLint may need `eslint-import-resolver-typescript` for alias resolution
- Build integration - ESLint errors should show in Vite dev server

**Review Findings from Story 0.2:**
- Documentation must match implementation (file paths, configuration)
- Architecture patterns must be consistently followed
- Testing must verify all acceptance criteria with evidence

[Source: stories/0-2-configure-tailwindcss-4-0-oxide-engine-shadcn-ui.md#Dev-Agent-Record, #Senior-Developer-Review]

### Performance Considerations

**ESLint Performance:**
- Use `--cache` flag for faster subsequent runs
- Limit linting to changed files in pre-commit hook (lint-staged handles this)
- Consider `.eslintignore` for large generated files

**Prettier Performance:**
- Prettier is fast by default
- Use `--cache` flag in scripts if needed
- lint-staged only formats staged files (optimal)

**Pre-commit Hook Speed:**
- Should complete in < 5 seconds for typical commits
- Only runs on staged files (not entire codebase)
- Auto-fixes applied before commit completes

### References

- [Source: docs/epics/epic-0-infrastructure-project-setup.md#Story-0.3] - Story acceptance criteria and prerequisites
- [Source: docs/architecture.md#Starter-Template-Decision] - Vite + React + TypeScript setup requirements
- [Source: stories/0-2-configure-tailwindcss-4-0-oxide-engine-shadcn-ui.md] - Previous story learnings (files created, patterns established)

## Dev Agent Record

### Context Reference

- [Story Context XML](./0-3-set-up-eslint-prettier-husky-pre-commit-hooks.context.xml) - Generated 2025-11-04

### Agent Model Used

Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)

### Debug Log References

### Completion Notes List

### File List

## Change Log

- 2025-11-04: Story created from Epic 0 (Infrastructure & Project Setup), follows Story 0.2
