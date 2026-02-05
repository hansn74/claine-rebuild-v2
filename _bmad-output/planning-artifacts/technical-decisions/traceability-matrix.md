# Traceability Matrix

**Purpose:** Map PRD requirements → ADRs → Epics to prevent orphaned decisions and ensure coverage.

| PRD Requirement                         | Relevant ADR(s)           | Epic(s)        | Notes                                      |
| --------------------------------------- | ------------------------- | -------------- | ------------------------------------------ |
| FR001-FR005 (Email Integration & Sync)  | ADR-004, ADR-007          | Epic 1         | OAuth, token storage, sync protocols       |
| FR006-FR010 (Offline-First Storage)     | ADR-002, ADR-008          | Epic 1, Epic 2 | Local store, search, conflict resolution   |
| FR011-FR014 (AI Triage & Notifications) | ADR-003, ADR-010          | Epic 3         | Local AI, notification policy              |
| FR015-FR018 (AI Compose & Response)     | ADR-003                   | Epic 4         | Draft generation, style learning           |
| FR019-FR023 (Autonomous Actions)        | ADR-009, ADR-010          | Epic 5         | Action logging, undo, permissions          |
| FR024-FR027 (Privacy & Trust)           | ADR-005, ADR-007, ADR-011 | Epic 1, Epic 5 | Cloud fallback, key management, sandbox    |
| FR028-FR032 (Performance & UX)          | ADR-001, ADR-002          | Epic 2         | Desktop shell, virtualization              |
| FR033-FR034 (Data Rights & Retention)   | ADR-002, ADR-007          | Epic 1, Epic 5 | Export/import, local retention             |
| NFR001 (Performance)                    | ADR-001, ADR-002, ADR-012 | Epic 1, Epic 2 | Shell, store, benchmarking                 |
| NFR002 (Reliability)                    | ADR-004, ADR-009          | Epic 1, Epic 2 | Sync resilience, undo reliability          |
| NFR003 (Security)                       | ADR-005, ADR-007, ADR-011 | Epic 1, Epic 5 | Privacy, secrets, sandboxing               |
| NFR004 (Scalability)                    | ADR-002, ADR-008          | Epic 1, Epic 2 | Storage limits, search performance         |
| NFR005 (AI Performance & Quality)       | ADR-003, ADR-012          | Epic 3, Epic 4 | Local inference, quality targets           |
| NFR006 (Usability)                      | ADR-001, ADR-012, ADR-013 | Epic 1, Epic 2 | Cold start, onboarding flow, accessibility |
| NFR007 (Maintainability)                | ADR-012                   | All Epics      | Test coverage, CI/CD                       |
| NFR008 (Accessibility)                  | ADR-001, ADR-013          | Epic 2         | WCAG compliance, keyboard nav              |
| NFR009 (Privacy-Preserving Telemetry)   | ADR-005, ADR-011          | Epic 1, Epic 5 | Telemetry design, opt-in                   |
| NFR010 (Notification Hygiene)           | ADR-010                   | Epic 3         | Rate limiting, DND compliance              |

---
