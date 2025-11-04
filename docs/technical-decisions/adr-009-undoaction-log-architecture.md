# ADR-009: Undo/Action Log Architecture

**Status:** Proposed
**Date:** 2025-10-29
**Deciders:** Architect, Lead Engineer

## Context

Claine's AI autonomously acts on emails (archive, snooze, categorize). Users must trust this, requiring:
- Undo any AI action (FR022 - all AI actions reversible within 30 days)
- Action log/audit trail (FR023 - user can review AI decisions)
- Undo must be fast (<1s) and reliable (FR022 - <5% undo rate target)
- Action log queryable (filter by action type, date, email)

**Requirement Mapping:** FR022 (undo), FR023 (audit log), NFR006 (usability - trust)

## Decision

**To be determined by architecture workflow**

## Options Under Consideration

**Option A: Event Sourcing (All actions stored as immutable events)**
- **Pros:** Complete audit trail, undo = apply inverse event, replays for debugging
- **Cons:** Storage overhead (every action stored forever), complexity of event replay
- **Best for:** If audit trail is regulatory requirement, high-trust use case

**Option B: Command Pattern with Action Log**
- **Pros:** Simple undo (store inverse command), lighter weight than event sourcing
- **Cons:** Action log may not capture all state changes (if external state mutated)
- **Best for:** MVP, pragmatic undo without event sourcing overhead

**Option C: Snapshot + Delta Log**
- **Pros:** Fast undo (revert to snapshot), efficient storage (deltas only)
- **Cons:** Complexity of managing snapshots, may lose granularity
- **Best for:** If undo performance critical, storage constrained

**Option D: Do Nothing / Defer**
- No undo, user manually reverts AI actions
- **When this makes sense:** Never - core trust feature
- **When this fails:** Always - unacceptable UX for autonomous AI

## Action Log Schema

**Stored for Each Action:**
- `action_id` (UUID)
- `timestamp` (ISO 8601)
- `action_type` (archive, snooze, categorize, reply, etc.)
- `email_id` (target email)
- `previous_state` (for undo: e.g., previous labels, previous folder)
- `new_state` (after action)
- `ai_confidence` (0.0-1.0)
- `ai_reasoning` (explainability: "Archived because...")
- `user_feedback` (if user undoes or approves)

**Storage:**
- Store in local database (same store as emails, see ADR-002)
- Retention: 30 days (FR022), then purge or archive
- User can export action log (JSON/CSV)

## Undo Implementation

**Undo Flow:**
1. User clicks "Undo" on notification or in action log UI
2. Lookup action in log by `action_id`
3. Apply inverse action: Restore `previous_state`
4. Mark action as undone in log (`status: undone`)
5. Record user feedback: `user_feedback: undone`

**Undo Constraints:**
- Undo within 30 days (after that, action log may be purged)
- Some actions may be irreversible (e.g., sent emails - can't unsend)
- Display clear warnings for irreversible actions (FR022)

## Acceptance / Exit Criteria

ADR-009 is **Accepted** when:
- Undo latency P95 <1s for all reversible actions (archive, snooze, categorize)
- Undo coverage: 100% of AI actions logged and reversible (except irreversible actions like send)
- Action log queryable: User can filter by date, action type, email with <100ms query latency
- Action log UI implemented: Displays all AI actions with reasoning, undo button, user feedback
- Retention working: Actions older than 30 days automatically purged (configurable)
- Export working: User can export action log (JSON/CSV) for all time or date range
- Undo rate tracked: Telemetry confirms undo rate <5% (success metric from PRD)
- Owner sign-off: Architect + Lead Engineer approval with UX review

## Operational Considerations

- **Rollout:**
  - Phase 1: Launch with action log + undo for core actions (archive, snooze, categorize)
  - Phase 2: Expand to draft generation (undo = delete draft), notifications (undo = dismiss)
  - Monitor undo rate: If >5%, investigate AI quality issues
- **Telemetry:** Track undo rate by action type, AI confidence correlation with undo rate, action log export frequency
- **Observability:**
  - Dashboard: Undo rate over time, action type breakdown, AI confidence distribution
  - Alert on: Undo rate >5% (indicates AI quality problem), action log corruption
- **Fallback:**
  - If undo fails: Log error, display message to user, escalate to support
  - If action log corrupted: Offer partial undo (best effort), alert engineering
- **Support Playbook:**
  - User can't undo: Check action age (<30 days?), action type (irreversible?), logs
  - Action log missing entries: Check database, potential sync issue, trigger resync
  - High undo rate: Review AI model quality, retrain if necessary

## Consequences

**To be determined post-decision**

## References

- Event Sourcing Pattern: https://martinfowler.com/eaaDev/EventSourcing.html
- Command Pattern: https://refactoring.guru/design-patterns/command
- GDPR Right to Explanation: https://gdpr-info.eu/art-22-gdpr/ (for AI reasoning)

---
