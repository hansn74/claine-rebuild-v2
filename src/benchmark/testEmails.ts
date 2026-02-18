/**
 * Test Email Dataset for Model Comparison Benchmark
 *
 * 20 labeled test emails covering all priority levels (5 each).
 * Uses EmailDocument type from email.schema.ts.
 */

import type { EmailDocument } from '@/services/database/schemas/email.schema'

export interface LabeledEmail {
  email: EmailDocument
  expected: {
    priority: 'high' | 'medium' | 'low' | 'none'
    score: number
  }
}

function makeEmail(
  overrides: Partial<EmailDocument> & Pick<EmailDocument, 'id' | 'from' | 'subject' | 'body'>
): EmailDocument {
  return {
    threadId: overrides.id,
    to: [{ name: 'Me', email: 'me@company.com' }],
    timestamp: Date.now(),
    accountId: 'benchmark-account',
    attachments: [],
    snippet: '',
    labels: ['INBOX'],
    folder: 'inbox',
    read: false,
    starred: false,
    importance: 'normal',
    attributes: {},
    ...overrides,
  }
}

export const TEST_EMAILS: LabeledEmail[] = [
  // ============================================================
  // NONE priority (score 0-20) — 5 emails
  // ============================================================
  {
    expected: { priority: 'none', score: 5 },
    email: makeEmail({
      id: 'bench-none-1',
      from: { name: 'GitHub', email: 'noreply@github.com' },
      subject: '[myorg/api-service] Run failed: CI / build (pull_request)',
      body: {
        text: `Run failed: CI / build (pull_request)

myorg/api-service (pull_request)
Commit: abc1234
Branch: feature/update-deps

1 failure:
- build (ubuntu-latest): Process completed with exit code 1.

You are receiving this because you are subscribed to this repository.
Reply to this email directly or view it on GitHub.
Unsubscribe from these notifications.`,
      },
    }),
  },
  {
    expected: { priority: 'none', score: 5 },
    email: makeEmail({
      id: 'bench-none-2',
      from: { name: 'Acme Store', email: 'deals@promo.acmestore.com' },
      subject: '🎉 Flash Sale! 50% Off Everything This Weekend Only',
      body: {
        text: `Hi there!

This weekend only — get 50% off EVERYTHING in our store!

Use code FLASH50 at checkout.

Shop now: https://acmestore.com/sale

Hurry, offer ends Sunday at midnight!

You're receiving this email because you signed up for Acme Store promotions.
Unsubscribe | Update email preferences`,
      },
    }),
  },
  {
    expected: { priority: 'none', score: 10 },
    email: makeEmail({
      id: 'bench-none-3',
      from: { name: 'LinkedIn', email: 'notifications-noreply@linkedin.com' },
      subject: '5 people viewed your profile this week',
      body: {
        text: `Your weekly profile stats

5 people viewed your profile this week, up from 3 last week.

Top viewers:
- Someone at Google
- Someone at Meta
- 3 others

See all views: https://linkedin.com/me/profile-views

You are receiving LinkedIn notification emails.
Unsubscribe`,
      },
    }),
  },
  {
    expected: { priority: 'none', score: 10 },
    email: makeEmail({
      id: 'bench-none-4',
      from: { name: 'TechDigest Weekly', email: 'newsletter@techdigest.io' },
      subject: 'This Week in Tech: AI Breakthroughs, Chip Wars, and More',
      body: {
        text: `TechDigest Weekly - Issue #247

Top Stories:
1. New AI model breaks benchmarks
2. EU passes landmark tech regulation
3. Apple announces new chip architecture
4. Open source LLM landscape shifts
5. Startup raises $100M for robot delivery

Read full digest: https://techdigest.io/issue-247

You received this newsletter because you subscribed at techdigest.io.
Manage your subscription | Unsubscribe | View in browser`,
      },
    }),
  },
  {
    expected: { priority: 'none', score: 15 },
    email: makeEmail({
      id: 'bench-none-5',
      from: { name: 'App Store Connect', email: 'no_reply@email.apple.com' },
      subject: 'A new review is available for Claine Mail',
      body: {
        text: `A new review has been submitted for Claine Mail.

Rating: ★★★★☆ (4 stars)
Title: "Pretty good email client"
Review: "I've been using this for a few weeks now. The offline mode is great but wish it had better search."

Region: United States
Date: February 10, 2026

View in App Store Connect: https://appstoreconnect.apple.com

This is an automated message from App Store Connect.`,
      },
    }),
  },

  // ============================================================
  // LOW priority (score 21-40) — 5 emails
  // ============================================================
  {
    expected: { priority: 'low', score: 25 },
    email: makeEmail({
      id: 'bench-low-1',
      from: { name: 'Amazon.com', email: 'shipment-tracking@amazon.com' },
      subject: 'Your Amazon order has shipped! Arriving Wednesday',
      body: {
        text: `Your order has shipped!

Order #112-3456789-0123456
Arriving: Wednesday, Feb 12

Items:
- Logitech MX Keys S Keyboard (1)
- USB-C Hub Adapter (1)

Track your package: https://amazon.com/track/TBA123456789

Delivery address: 123 Main St, San Francisco, CA 94105

This is an automated shipping notification.`,
      },
    }),
  },
  {
    expected: { priority: 'low', score: 30 },
    email: makeEmail({
      id: 'bench-low-2',
      from: { name: 'Google', email: 'no-reply@accounts.google.com' },
      subject: 'Your password was recently changed',
      body: {
        text: `Hi,

Your Google Account password was recently changed. If you made this change, no further action is needed.

If you didn't make this change, your account may have been compromised. Please secure your account immediately.

Changed on: February 11, 2026, 3:42 PM PST
Device: MacBook Pro, Chrome browser
Location: San Francisco, CA

If this wasn't you: https://accounts.google.com/security

The Google Accounts team`,
      },
    }),
  },
  {
    expected: { priority: 'low', score: 30 },
    email: makeEmail({
      id: 'bench-low-3',
      from: { name: 'Google Drive', email: 'drive-shares-dm-noreply@google.com' },
      subject: 'Sarah Chen shared "Q1 Marketing Plan" with you',
      body: {
        text: `Sarah Chen (sarah.chen@company.com) has shared the following document with you:

Q1 Marketing Plan

"Here's the marketing plan for next quarter. Take a look when you get a chance."

Open in Google Drive: https://drive.google.com/doc/abc123

You can also find this file in your "Shared with me" section.`,
      },
    }),
  },
  {
    expected: { priority: 'low', score: 35 },
    email: makeEmail({
      id: 'bench-low-4',
      from: { name: 'Slack', email: 'notification@slack.com' },
      subject: 'Your weekly Slack summary for Engineering workspace',
      body: {
        text: `Your weekly summary for Engineering

Channels with activity:
#general - 42 messages
#dev-frontend - 28 messages
#random - 15 messages
#deploys - 8 messages

You were mentioned 3 times this week.
You have 5 unread direct messages.

Catch up in Slack: https://engineering.slack.com

This is an automated weekly summary. Manage notification settings.`,
      },
    }),
  },
  {
    expected: { priority: 'low', score: 35 },
    email: makeEmail({
      id: 'bench-low-5',
      from: { name: 'Google Calendar', email: 'calendar-notification@google.com' },
      subject: 'Cancelled: Team Standup - Wednesday Feb 12',
      body: {
        text: `This event has been cancelled.

Team Standup
Wednesday, February 12, 2026 · 9:30 – 9:45am PST

Cancelled by: Mike Johnson (mike.j@company.com)
Note: "Skipping standup this week — will do async updates in Slack instead."

This event was on your calendar. It has been removed.`,
      },
    }),
  },

  // ============================================================
  // MEDIUM priority (score 41-70) — 5 emails
  // ============================================================
  {
    expected: { priority: 'medium', score: 50 },
    email: makeEmail({
      id: 'bench-medium-1',
      from: { name: 'David Park', email: 'david.park@company.com' },
      subject: 'Quick question about the API refactor',
      body: {
        text: `Hey,

I was looking at the API refactor you started last sprint. I'm working on the auth module and wanted to make sure our changes don't conflict.

Can you give me a quick update on where things stand? Specifically:
- Are you still planning to change the middleware structure?
- Should I wait on you for the auth endpoints or go ahead?

No rush, just want to coordinate before I go too deep.

Thanks,
David`,
      },
    }),
  },
  {
    expected: { priority: 'medium', score: 55 },
    email: makeEmail({
      id: 'bench-medium-2',
      from: { name: 'Lisa Wang', email: 'lisa.wang@company.com' },
      subject: 'Team sync moved to Thursday 2pm',
      body: {
        text: `Hi team,

I need to reschedule our weekly sync from Wednesday to Thursday this week. Please accept the updated calendar invite.

Thursday Feb 13, 2:00 - 2:30 PM PST
Zoom link: https://zoom.us/j/123456789

Agenda:
1. Sprint review
2. Q1 planning discussion
3. New hire onboarding updates

Let me know if Thursday doesn't work for you.

Best,
Lisa Wang
Engineering Manager`,
      },
    }),
  },
  {
    expected: { priority: 'medium', score: 55 },
    email: makeEmail({
      id: 'bench-medium-3',
      from: { name: 'Alex Rivera', email: 'alex.r@company.com' },
      subject: 'PR #487: Refactor email parser — ready for review',
      body: {
        text: `Hey,

PR #487 is ready for review. It refactors the email parser to handle edge cases we found in production:
- Malformed headers from Outlook clients
- UTF-8 encoding issues in subject lines
- Inline attachment detection

Changes: 12 files, +340/-180 lines

I'd appreciate a review when you get a chance — it's blocking the next sprint story.

https://github.com/myorg/claine/pull/487

Thanks!
Alex`,
      },
    }),
  },
  {
    expected: { priority: 'medium', score: 60 },
    email: makeEmail({
      id: 'bench-medium-4',
      from: { name: 'Rachel Kim', email: 'rachel.kim@company.com' },
      subject: 'Re: Architecture decision for caching layer',
      body: {
        text: `Team,

Following up on yesterday's discussion about the caching layer. I've put together a comparison doc for the three approaches we discussed:

1. Redis (hosted) — most flexible, but adds infra dependency
2. In-memory LRU — simplest, but no persistence across restarts
3. IndexedDB cache — works offline, aligns with our PWA approach

I'm leaning toward option 3 but want everyone's input before we commit. Can you review the doc and add your thoughts?

Doc: https://docs.google.com/doc/caching-comparison

Would like to finalize by end of week so we can start implementation next sprint.

Rachel`,
      },
    }),
  },
  {
    expected: { priority: 'medium', score: 65 },
    email: makeEmail({
      id: 'bench-medium-5',
      from: { name: 'James Whitfield', email: 'j.whitfield@clientcorp.com' },
      subject: 'Re: Proposal for Phase 2 development',
      body: {
        text: `Hi,

Thanks for sending over the Phase 2 proposal. We've reviewed it internally and have a few questions:

1. The timeline shows 8 weeks — is there flexibility to accelerate to 6?
2. Can you break down the cost for the AI features separately?
3. We'd like to add SSO integration — can you include that in the scope?

We're meeting with our board on Friday to discuss vendor selection, so it would be great to have your responses by Thursday if possible.

Best regards,
James Whitfield
VP of Engineering, ClientCorp`,
      },
    }),
  },

  // ============================================================
  // HIGH priority (score 71-100) — 5 emails
  // ============================================================
  {
    expected: { priority: 'high', score: 75 },
    email: makeEmail({
      id: 'bench-high-1',
      from: { name: 'Lisa Wang', email: 'lisa.wang@company.com' },
      subject: 'Need the quarterly report by EOD',
      body: {
        text: `Hi,

Finance is asking for the engineering quarterly report for the board meeting tomorrow morning. I need it by end of day today.

Please include:
- Sprint velocity trends
- Bug fix rate
- Infrastructure costs breakdown
- Team capacity for Q2

I know it's short notice but this is coming from the CFO. Let me know if you need help pulling any of the data.

Thanks,
Lisa`,
      },
    }),
  },
  {
    expected: { priority: 'high', score: 80 },
    email: makeEmail({
      id: 'bench-high-2',
      from: { name: 'Tom Bradley', email: 'tom.bradley@company.com' },
      subject: 'Approve this ASAP — vendor contract expiring',
      body: {
        text: `Hey,

I need your approval on the DataDog contract renewal. The current contract expires tomorrow and if we lapse we lose our historical data and negotiated rate.

Contract details:
- Vendor: DataDog
- Annual cost: $45,000 (same as last year)
- Term: 12 months
- Change: Added APM tier for backend services

The approval form is in the procurement system — should take 2 minutes.

Please approve this ASAP. I've already got VP sign-off, just need your technical approval.

Thanks,
Tom
DevOps Lead`,
      },
    }),
  },
  {
    expected: { priority: 'high', score: 85 },
    email: makeEmail({
      id: 'bench-high-3',
      from: { name: 'James Whitfield', email: 'j.whitfield@clientcorp.com' },
      subject: 'URGENT: Production environment is returning 500 errors',
      body: {
        text: `Hi team,

Our production environment using your API has been returning 500 errors for the past 20 minutes. This is affecting all of our customer-facing applications.

Error details:
- Endpoint: POST /api/v2/sync
- Response: 500 Internal Server Error
- Error body: {"error": "database connection timeout"}
- Started: 2:15 PM PST

This is critical — we have 10,000+ active users being impacted right now. We need someone to look at this immediately.

Please call me at 555-0147 if you need more details.

James Whitfield
VP of Engineering, ClientCorp`,
      },
    }),
  },
  {
    expected: { priority: 'high', score: 90 },
    email: makeEmail({
      id: 'bench-high-4',
      from: { name: 'Sarah Mitchell', email: 's.mitchell@company.com' },
      subject: 'Call me immediately — board decision',
      body: {
        text: `I just got out of the board meeting. They approved the Series B but with conditions that affect our engineering roadmap.

We need to discuss before I respond to the investors. Call me as soon as you see this — I'm available for the next hour.

This is time-sensitive, they need our response today.

Sarah Mitchell
CEO`,
      },
    }),
  },
  {
    expected: { priority: 'high', score: 95 },
    email: makeEmail({
      id: 'bench-high-5',
      from: { name: 'PagerDuty Alert', email: 'alert@pagerduty.com' },
      subject: '[CRITICAL] Production DB Primary - Connection Pool Exhausted',
      body: {
        text: `CRITICAL ALERT — Immediate action required

Service: Production Database Primary
Alert: Connection pool exhausted (500/500 connections in use)
Severity: Critical
Triggered: 2026-02-12 14:30:00 UTC

Impact:
- All write operations failing
- API response times > 30s
- Multiple services degraded

Runbook: https://wiki.internal/runbooks/db-connection-pool
On-call: You are the primary on-call engineer

Escalation: If not acknowledged within 15 minutes, this will escalate to VP of Engineering.

Acknowledge: https://pagerduty.com/alert/ack/abc123
Resolve: https://pagerduty.com/alert/resolve/abc123`,
      },
    }),
  },
]
