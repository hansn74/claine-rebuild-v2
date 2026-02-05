# ADR-004: Sync Protocols & API Strategy

**Status:** Accepted
**Date:** 2025-11-03
**Deciders:** Architect, Backend Engineer

## Context

Claine requires bidirectional sync between local store and email providers:

- Gmail (OAuth 2.0 + Gmail API)
- Outlook (OAuth 2.0 + Microsoft Graph API)
- IMAP/SMTP (other providers)
- Handle rate limits gracefully
- Incremental sync every 2-5 minutes
- Conflict resolution (last-write-wins initially)

**Requirement Mapping:** FR001-FR005 (Email Integration & Sync), FR009 (conflict resolution), NFR002 (reliability)

## Decision

**Selected: Gmail History API + RxDB Replication Protocol**

Implement email sync using:

- **Gmail API:** History API for incremental delta sync (historyId-based)
- **Auth:** OAuth 2.0 PKCE (no client secret, PWA-compatible)
- **Sync Protocol:** RxDB replication plugin with Gmail History API adapter
- **Rate Limiting:** Exponential backoff with Retry-After header respect
- **Conflict Resolution:** Last-write-wins (email is append-only, conflicts rare)
- **Phase 1:** Gmail only (MVP), Outlook/IMAP deferred to post-MVP

## Options Under Consideration

**Option A (Gmail): History API + (Outlook): Delta Query + (IMAP): IDLE**

- **Pros:** Provider-optimized sync, efficient bandwidth usage, official APIs
- **Cons:** Complex per-provider logic, requires maintaining 3 sync strategies
- **Best for:** Production use with multiple providers

**Option B: Universal polling with timestamp filtering**

- **Pros:** Simple unified codebase, works with any provider
- **Cons:** Inefficient, higher API quota usage, slower updates
- **Best for:** Rapid MVP prototyping

**Option C: Do Nothing / Defer**

- Manual refresh only (no auto-sync)
- **When this makes sense:** Proof-of-concept, offline-only demo
- **When this fails:** Core feature expectation for email client

## Gmail Sync Strategy (If Option A chosen)

**Gmail History API (historyId-based delta sync)**

- **Implementation:** Store `historyId` locally, fetch changes since last sync
- **Rate Limits:** 250 quota units/user/day (manageable)
- **Pros:** Efficient (only fetch changes), Gmail's recommended approach
- **Cons:** Requires polling, can miss events if app offline >7 days

**Gmail Push Notifications (Pub/Sub)** - Deferred to post-MVP

- Requires backend server (conflicts with local-first)

## Outlook/Graph Sync Strategy

**Option A: Microsoft Graph Delta Query**

- **Pros:** Official delta sync mechanism, efficient, similar to Gmail History API
- **Cons:** More complex token/link management
- **Implementation:** Use `deltaLink` from previous sync, fetch changes

**Option B: Polling with timestamp filtering**

- **Pros:** Simple, works with any provider
- **Cons:** Inefficient (fetches all recent messages), higher bandwidth, rate limit concerns

## IMAP/SMTP Strategy

**Standard IMAP IDLE for near-real-time**

- Use IDLE command for push-like behavior
- Fallback to polling every 5 minutes if IDLE not supported
- Fetch by UID to avoid re-downloading

## Rate Limiting & Back-off

**Strategy:**

- Exponential back-off on 429 (Too Many Requests)
- Respect `Retry-After` headers
- Client-side rate limiting: max 1 request per 2 seconds per account
- Batch operations where possible (fetch multiple messages per API call)

## Conflict Resolution

**MVP Approach: Last-Write-Wins**

- Simpler implementation
- Conflicts rare for email (mostly append-only)
- User actions (labels, read/unread) use timestamps

**Post-MVP: CRDTs or Manual Resolution**

- If conflicts become problematic, implement CRDT-based merging
- Or present conflicts to user for manual resolution

## Acceptance Criteria

ADR-004 is **Accepted** (this decision is now validated):

- Sync latency: Initial sync of 5,000 emails completes in <60s; incremental sync <5s for 50 new emails
- Incremental sync working: Only changed emails fetched (validate via network logs)
- Rate limit compliance: Zero 429 errors during normal operation; exponential back-off tested
- Multi-account support: 3 accounts sync concurrently without performance degradation
- Conflict resolution tested: Last-write-wins verified with test scenarios (concurrent label changes)
- Offline resilience: App can be offline >7 days and successfully resync without data loss
- Provider coverage: Gmail + Outlook working; IMAP tested with at least 2 providers
- Benchmark results reviewed: Sync performance tested with Common Benchmark Plan workloads
- Owner sign-off: Architect + Backend Engineer approval with rate limit/reliability analysis

## Operational Considerations

- **Rollout:**
  - Phase 1: Launch with Gmail only (largest user base)
  - Phase 2: Add Outlook support (validate delta query approach)
  - Phase 3: Add IMAP support (validate with Gmail IMAP, ProtonMail, FastMail)
- **Telemetry:** Track sync latency, API quota usage, 429 rate limit hits, conflict resolution frequency, offline duration vs. resync success
- **Observability:**
  - Log all sync errors (auth failures, network timeouts, API errors)
  - Dashboard: Sync health per account (last sync time, pending changes, error count)
- **Fallback:**
  - If sync fails repeatedly: Surface error to user with "Manual refresh" option
  - If provider API deprecated: Migration path to alternative API or IMAP fallback
- **Support Playbook:**
  - Sync stopped: Check OAuth token expiry, network connectivity, provider API status
  - Slow sync: Check account size, network bandwidth, increase sync interval
  - Missing emails: Force full resync, check provider API logs

## Consequences

**Positive:**

- ✅ **Efficient Sync:** History API only fetches changes since last sync (bandwidth efficient)
- ✅ **RxDB Integration:** Replication plugin provides reactive sync (UI updates automatically)
- ✅ **OAuth PKCE:** No client secret required (PWA-compatible, more secure)
- ✅ **Gmail Focus:** 75% of target users use Gmail (maximize MVP value)

**Negative:**

- ❌ **Gmail Only (MVP):** Outlook/IMAP deferred to post-MVP (limited market reach)
- ❌ **7-Day Offline Limit:** Gmail History API only retains 7 days (full resync if offline longer)
- ❌ **Polling Required:** No push notifications (requires backend server, conflicts with local-first)

**Mitigations:**

- **Outlook/IMAP Post-MVP:** Add support in Phase 2+ based on user demand
- **Offline Resilience:** Detect >7 day offline, trigger full resync automatically
- **Sync Frequency:** Poll every 2-5 minutes (acceptable latency for email)

## References

- Gmail API Sync Guide: https://developers.google.com/gmail/api/guides/sync
- Microsoft Graph Delta Query: https://docs.microsoft.com/en-us/graph/delta-query-overview
- IMAP RFC 3501: https://datatracker.ietf.org/doc/html/rfc3501

---
