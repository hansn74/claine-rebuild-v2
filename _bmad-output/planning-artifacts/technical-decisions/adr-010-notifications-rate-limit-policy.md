# ADR-010: Notifications & Rate-Limit Policy

**Status:** Proposed
**Date:** 2025-10-29
**Deciders:** Architect, PM, UX Designer

## Context

Claine sends OS notifications for high-priority emails, but must avoid notification fatigue:

- FR014: Configurable notification rate limits, respect OS DND (Do Not Disturb)
- FR031: User can configure notification thresholds (what triggers notification)
- NFR010: Notification hygiene metrics (<10% notification dismissal rate)
- Balance: Useful alerts vs. annoying spam

**Requirement Mapping:** FR014 (rate limits, DND), FR031 (thresholds), NFR010 (hygiene)

## Decision

**To be determined by architecture workflow**

## Options Under Consideration

**Option A: Client-Side Rate Limiting (Simple Threshold)**

- **Pros:** Simple, no backend required, user configures max notifications/hour
- **Cons:** No adaptive learning, user must manually tune thresholds
- **Default:** Max 5 notifications/hour (configurable 1-20)
- **Best for:** MVP, straightforward implementation

**Option B: Adaptive Rate Limiting (AI-Driven)**

- **Pros:** Learns from user behavior (dismissal rate → reduce notifications), no manual config
- **Cons:** Requires AI feedback loop, more complex, cold start problem (needs data)
- **Best for:** Post-MVP, if notification fatigue becomes problem

**Option C: Priority-Based (Only notify for AI-scored high-priority emails)**

- **Pros:** Leverages existing AI triage (ADR-003), high signal-to-noise ratio
- **Cons:** Relies on AI accuracy, may miss important emails if AI wrong
- **Best for:** Paired with Option A or B, confidence threshold (e.g., only notify if AI confidence >0.8)

**Option D: Do Nothing / Defer**

- No rate limiting, notify for every high-priority email
- **When this makes sense:** Never - notification fatigue will occur
- **When this fails:** Always - poor UX, users disable notifications entirely

## Notification Threshold Configuration

**User-Configurable Settings (FR031):**

- **Priority Level:** Notify for "Critical" only, or "High + Critical"
- **Sender Whitelist:** Always notify from specific senders (e.g., boss, family)
- **Sender Blacklist:** Never notify from specific senders (e.g., newsletters)
- **Time Windows:** Only notify during work hours (9am-6pm) or custom schedule
- **Rate Limit:** Max N notifications per hour (default 5, range 1-20)

**Defaults:**

- Notify for AI-scored "Critical" priority emails only
- Respect OS DND (no notifications when DND enabled)
- Max 5 notifications/hour
- No notifications after 10pm local time (configurable)

## OS DND (Do Not Disturb) Integration

**Platform Support:**

- **macOS:** Check DND status via `NSUserNotificationCenter` (if Electron/native)
- **Windows:** Check Focus Assist status via Windows API
- **Linux:** Check DND status via libnotify (best effort, not all DEs support)

**Fallback:** If OS DND status unavailable, respect time-based policy (no notifications after 10pm)

## Notification Hygiene Metrics (NFR010)

**Track:**

- **Dismissal Rate:** % of notifications dismissed without action (target <10%)
- **Click-Through Rate:** % of notifications clicked (target >40%)
- **Action Rate:** % of clicked notifications resulting in reply/archive within 5 minutes (target >40% per PRD)
- **Time-to-Dismiss:** How quickly users dismiss notifications (proxy for annoyance)

**Feedback Loop:**

- If dismissal rate >10%: Prompt user to adjust notification settings, or trigger adaptive learning (Option B)

## Acceptance / Exit Criteria

ADR-010 is **Accepted** when:

- Rate limiting working: Max N notifications/hour enforced, excess queued or dropped with user setting
- DND integration tested: No notifications when OS DND enabled on all platforms (or time-based fallback)
- Threshold config UI implemented: User can set priority level, sender whitelist/blacklist, time windows, rate limit
- Notification hygiene metrics: Dismissal rate <10%, action rate >40% (per PRD) in beta testing
- Notification content tested: Subject + sender + snippet (50 chars) + action buttons (Reply, Archive, Undo)
- Telemetry working: Track dismissal rate, click-through rate, action rate, time-to-dismiss
- Owner sign-off: PM + UX Designer + Architect approval with beta user feedback

## Operational Considerations

- **Rollout:**
  - Phase 1: Launch with simple rate limiting (Option A) + DND integration
  - Phase 2: Monitor hygiene metrics; if dismissal rate >10%, consider adaptive learning (Option B)
  - Beta testing: A/B test default rate limits (3/hr vs. 5/hr vs. 10/hr), measure dismissal rate
- **Telemetry:** Track dismissal rate, click-through rate, action rate, rate limit hits, DND bypass requests
- **Observability:**
  - Dashboard: Notification metrics over time, per-user dismissal rate distribution
  - Alert on: Platform-wide dismissal rate >10%, click-through rate <20%
- **Fallback:**
  - If notifications broken (OS API failure): Fallback to in-app alerts (non-intrusive banner)
  - If hygiene metrics poor: Prompt user to adjust settings, suggest disabling notifications
- **Support Playbook:**
  - User complains "too many notifications": Guide to rate limit settings, sender blacklist
  - User complains "missing important emails": Check notification thresholds, sender whitelist
  - Notifications not respecting DND: Check OS DND settings, fallback to time-based policy

## Consequences

**To be determined post-decision**

## References

- macOS User Notifications: https://developer.apple.com/documentation/usernotifications
- Windows Notifications: https://docs.microsoft.com/en-us/windows/apps/design/shell/tiles-and-notifications/
- Linux libnotify: https://developer.gnome.org/libnotify/

---
