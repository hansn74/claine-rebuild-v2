# Story 3.7: Context-Aware Feedback Learning

## Status: Backlog

## Problem

Story 3.6 implemented sender-level priority learning: after 3 overrides for the same sender, the system "learns" that sender's preferred priority. This is too coarse — a single sender can send emails of varying importance:

- Google: security alerts (high), account changes (medium), marketing (none)
- A colleague: urgent requests (high), FYI updates (low), meeting invites (medium)
- Amazon: order confirmations (low), delivery issues (medium), marketing (none)

Learning "all Google emails = low" would misclassify security alerts.

## Proposed Improvement

Replace sender-only pattern matching with **sender + content signal** compound patterns:

- Track `(senderEmail, contentSignals[])` pairs in feedback records
- Learn patterns like: "emails from Google with `automated` + `newsletter` signals → none"
- But: "emails from Google with `approval` signal → medium"
- Confidence threshold should require signal overlap, not just sender match

## Acceptance Criteria

1. Feedback records include content signals from the original AI analysis
2. `getSenderPatterns()` factors in content signal similarity when computing preferred priority
3. `detectLearningInsights()` groups by sender + dominant signal combination
4. Toast message reflects the learned pattern (e.g., "AI learned: newsletters from Google are Low priority")
5. Existing sender-only patterns gracefully migrate or coexist

## Technical Notes

- `PriorityFeedbackDocument` schema needs a `contentSignals: string[]` field
- Pattern matching could use Jaccard similarity on signal sets
- Consider a fallback: if no signal-specific pattern exists, use sender-level pattern with lower confidence
