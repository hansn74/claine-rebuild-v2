# Claine Rebuild v2 - Documentation Index

**Project:** Offline-first AI-powered email client
**Status:** Phase 4 - Implementation Ready
**Last Updated:** 2025-11-03

---

## 📋 Core Planning Documents

### Product Requirements & Planning
- **[PRD.md](./PRD.md)** - Product Requirements Document with 34 functional and 10 non-functional requirements
- **[product-brief-claine-rebuild-v2-2025-10-29.md](./product-brief-claine-rebuild-v2-2025-10-29.md)** - Strategic product vision and market positioning
- **[feature-parity-v1-to-v2.md](./feature-parity-v1-to-v2.md)** - V1 to V2 migration strategy and hybrid approach analysis

### Implementation Planning
- **[bmm-workflow-status.md](./bmm-workflow-status.md)** - Current workflow status and phase tracking
- **Epic Breakdown** - See [Sharded Epic Files](#epic-files-individual-epics---recommended) below (original moved to `/.ignore/original-docs/epics.md`)

### Architecture & Technical Decisions
- **[architecture.md](./architecture.md)** - Complete system architecture with validated technology stack
- **[ux-design-specification.md](./ux-design-specification.md)** - Comprehensive UX/UI design specification (89KB)
- **Architecture Decision Records** - See [Sharded ADR Files](#architecture-decision-records-individual-adrs---recommended) below (original moved to `/.ignore/original-docs/technical-decisions.md`)

### Assessment & Readiness
- **[implementation-readiness-report-2025-11-03.md](./implementation-readiness-report-2025-11-03.md)** - Gate-check assessment with gap analysis and recommendations

---

## 📦 Sharded Documentation (Optimized for AI Agents)

### Epic Files (Individual Epics - Recommended)
- **[epics/overview.md](./epics/overview.md)** - Epic sequencing principles and project context
- **[epics/epic-0-infrastructure-project-setup.md](./epics/epic-0-infrastructure-project-setup.md)** - 10 stories for project foundation (37 hours)
- **[epics/epic-1-foundation-core-infrastructure.md](./epics/epic-1-foundation-core-infrastructure.md)** - 14+ stories for OAuth, RxDB, sync (51 hours added)
- **[epics/epic-2-offline-first-email-client-with-attributes.md](./epics/epic-2-offline-first-email-client-with-attributes.md)** - 16 stories for email client features
- **[epics/epic-3-ai-triage-attribute-suggestions.md](./epics/epic-3-ai-triage-attribute-suggestions.md)** - 14+ stories for local AI inference
- **[epics/epic-4-ai-powered-compose-response.md](./epics/epic-4-ai-powered-compose-response.md)** - 8-10 stories for AI drafts
- **[epics/epic-5-visual-workflow-engine-hybrid-automation.md](./epics/epic-5-visual-workflow-engine-hybrid-automation.md)** - 14 stories for workflow automation
- **[epics/epic-6-autonomous-action-engine-trust-building.md](./epics/epic-6-autonomous-action-engine-trust-building.md)** - 10-12 stories for autonomous features
- **[epics/story-guidelines-reference.md](./epics/story-guidelines-reference.md)** - Story format and acceptance criteria guidelines
- **[epics/index.md](./epics/index.md)** - Table of contents for all epic files

### Architecture Decision Records (Individual ADRs - Recommended)
- **[technical-decisions/adr-001-application-platform-selection.md](./technical-decisions/adr-001-application-platform-selection.md)** - PWA platform decision (Vite + React)
- **[technical-decisions/adr-002-local-data-store-indexing-strategy.md](./technical-decisions/adr-002-local-data-store-indexing-strategy.md)** - RxDB + IndexedDB decision
- **[technical-decisions/adr-003-local-ai-inference-engine.md](./technical-decisions/adr-003-local-ai-inference-engine.md)** - ONNX Runtime Web + Llama 3.1 8B
- **[technical-decisions/adr-004-sync-protocols-api-strategy.md](./technical-decisions/adr-004-sync-protocols-api-strategy.md)** - Gmail API OAuth 2.0 PKCE
- **[technical-decisions/adr-005-privacy-posture-cloud-fallback-policy.md](./technical-decisions/adr-005-privacy-posture-cloud-fallback-policy.md)** - Privacy-first local processing
- **[technical-decisions/adr-006-updatedistribution-auto-update.md](./technical-decisions/adr-006-updatedistribution-auto-update.md)** - Update and distribution strategy
- **[technical-decisions/adr-007-secrets-key-management.md](./technical-decisions/adr-007-secrets-key-management.md)** - Web Crypto API token encryption
- **[technical-decisions/adr-008-search-architecture.md](./technical-decisions/adr-008-search-architecture.md)** - Local search with RxDB queries
- **[technical-decisions/adr-009-undoaction-log-architecture.md](./technical-decisions/adr-009-undoaction-log-architecture.md)** - Action logging and undo system
- **[technical-decisions/adr-010-notifications-rate-limit-policy.md](./technical-decisions/adr-010-notifications-rate-limit-policy.md)** - Smart notifications strategy
- **[technical-decisions/adr-011-packaging-sandboxing-permissions.md](./technical-decisions/adr-011-packaging-sandboxing-permissions.md)** - Security and sandboxing approach
- **[technical-decisions/adr-012-test-strategy-benchmark-harness.md](./technical-decisions/adr-012-test-strategy-benchmark-harness.md)** - Vitest + Playwright testing
- **[technical-decisions/adr-013-accessibility-engineering-plan.md](./technical-decisions/adr-013-accessibility-engineering-plan.md)** - WCAG 2.1 AA compliance plan
- **[technical-decisions/adr-index.md](./technical-decisions/adr-index.md)** - Summary of all architecture decisions
- **[technical-decisions/overview.md](./technical-decisions/overview.md)** - ADR overview and status
- **[technical-decisions/traceability-matrix.md](./technical-decisions/traceability-matrix.md)** - Requirements to ADR mapping
- **[technical-decisions/common-benchmark-plan.md](./technical-decisions/common-benchmark-plan.md)** - Performance benchmarking approach
- **[technical-decisions/document-maintenance.md](./technical-decisions/document-maintenance.md)** - ADR maintenance guidelines
- **[technical-decisions/index.md](./technical-decisions/index.md)** - Table of contents for all ADR files

---

## 🔬 Research Documents

### Competitive Analysis
- **[research/ai-email-competitors-deep-dive-2025-10-29.md](./research/ai-email-competitors-deep-dive-2025-10-29.md)** - Analysis of AI email tools
- **[research/competitive-intelligence-claine-ai-clone-2025-10-29.md](./research/competitive-intelligence-claine-ai-clone-2025-10-29.md)** - Market positioning research

### Technical Research
- **[research/email-client-architectures-research.md](./research/email-client-architectures-research.md)** - Email client architecture patterns
- **[research/email-protocols-comparison-research.md](./research/email-protocols-comparison-research.md)** - IMAP vs Gmail API comparison
- **[research/rxdb-alternatives-research.md](./research/rxdb-alternatives-research.md)** - Local database options analysis
- **[research/state-management-comparison-research.md](./research/state-management-comparison-research.md)** - Zustand vs Redux vs Jotai

### Performance Research
- **[research/virtual-scrolling-research.md](./research/virtual-scrolling-research.md)** - react-window vs tanstack-virtual
- **[research/optimistic-ui-patterns-research.md](./research/optimistic-ui-patterns-research.md)** - Optimistic UI implementation
- **[research/react-query-patterns-research.md](./research/react-query-patterns-research.md)** - React Query for data sync
- **[research/incremental-sync-optimization-research.md](./research/incremental-sync-optimization-research.md)** - Email sync optimization strategies
- **[research/caching-strategies-research.md](./research/caching-strategies-research.md)** - Browser caching approaches

### Offline & Workers Research
- **[research/service-workers-offline-research.md](./research/service-workers-offline-research.md)** - Service Worker strategies
- **[research/background-sync-push-research.md](./research/background-sync-push-research.md)** - Background sync patterns
- **[research/web-workers-threading-research.md](./research/web-workers-threading-research.md)** - Web Workers for AI inference

### UI/UX Research
- **[research/modern-email-client-ui-patterns-research.md](./research/modern-email-client-ui-patterns-research.md)** - Modern email UI patterns
- **[research/workflow-designer-research.md](./research/workflow-designer-research.md)** - React Flow workflow editor research
- **[research/rich-text-editors-research.md](./research/rich-text-editors-research.md)** - Email compose editor options
- **[research/keyboard-shortcuts-research.md](./research/keyboard-shortcuts-research.md)** - Keyboard navigation patterns

### Security Research
- **[research/email-xss-prevention-research.md](./research/email-xss-prevention-research.md)** - XSS prevention in email bodies

### Testing Research
- **[research/e2e-testing-frameworks-research.md](./research/e2e-testing-frameworks-research.md)** - Playwright vs Cypress comparison

---

## 🧪 Brownfield Analysis (Reference Only)

**Note:** These documents analyzed the V1 codebase and informed the hybrid approach. Not required for V2 implementation.

- **[brownfield/brownfield-architecture.md](./brownfield/brownfield-architecture.md)** - V1 architecture analysis
- **[brownfield/api-integration-guide.md](./brownfield/api-integration-guide.md)** - V1 API integration patterns
- **[brownfield/component-library-ui-patterns.md](./brownfield/component-library-ui-patterns.md)** - V1 UI component analysis
- **[brownfield/domain-model-deep-dive.md](./brownfield/domain-model-deep-dive.md)** - V1 domain model
- **[brownfield/security-privacy-architecture.md](./brownfield/security-privacy-architecture.md)** - V1 security architecture

---

## 💭 Brainstorming Sessions

- **[brainstorm/brainstorming-session-results-2025-10-29.md](./brainstorm/brainstorming-session-results-2025-10-29.md)** - Strategic brainstorming session results

---

## 📊 Project Metrics

**Total Documentation:** ~600KB across 70+ files
**Sharded Files:** 29 files (epics + ADRs) for optimized context loading
**Total Stories:** 91-95 stories across 7 epics
**Estimated Timeline:** 15 sprints (~7.5 months)
**Current Phase:** Phase 4 - Implementation Ready

---

## 🎯 Quick Start for AI Agents

### For Story Development:
1. Load **epic-{n}.md** for the epic you're working on
2. Load **adr-{xxx}.md** for relevant architecture decisions
3. Reference **architecture.md** for implementation patterns

### For Architecture Questions:
1. Check **technical-decisions/adr-index.md** first
2. Load specific ADR files as needed
3. Reference **architecture.md** for complete context

### For Requirements:
1. Start with **PRD.md** for requirements
2. Cross-reference with **epics.md** or sharded epic files
3. Check **implementation-readiness-report-2025-11-03.md** for gap analysis

---

## 📝 Document Maintenance

- **Sharded documents** are auto-generated from source files
- **Source files** (epics.md, technical-decisions.md) retained for reference
- **Always use sharded versions** when loading into AI context
- **Update source files** and re-shard when making changes

---

_Last generated: 2025-11-03 by BMad Master_
_Generator: BMad Core index-docs task_
