# ADR-005: Privacy Posture & Cloud Fallback Policy

**Status:** Accepted
**Date:** 2025-11-03
**Deciders:** Architect, Security Lead, PM

## Context

Claine's core differentiation is privacy-first, offline-first AI. Cloud fallback undermines this but may be necessary for:

- Users with insufficient hardware (< 16GB RAM, older CPUs)
- Model quality improvements (larger cloud models)
- Feature parity fallback if local inference unavailable

**Requirement Mapping:** FR024-FR025 (Privacy & Trust), NFR005 (AI Performance), NFR009 (Privacy-Preserving Telemetry)

## Decision

**Selected: Strict Local-Only (No Cloud Fallback for MVP)**

Implement privacy-first architecture:

- **Default:** All AI processing on-device (ONNX Runtime Web + Llama 3.1)
- **Cloud Fallback:** Disabled for MVP (deferred to post-MVP based on user demand)
- **Telemetry:** Default OFF, opt-in only with explicit consent
- **Data Storage:** All email data encrypted in IndexedDB (never leaves device)
- **Rationale:** Maximize privacy differentiation, validate local-only approach first

## Privacy Principles (Non-Negotiable)

1. **Local by Default:** All AI processing happens on-device unless user explicitly enables cloud fallback
2. **Informed Consent:** User must opt-in with clear explanation of trade-offs
3. **Data Minimization:** If cloud used, redact all PII locally before sending
4. **Transparency:** Every cloud invocation logged and auditable by user
5. **User Control:** User can disable cloud fallback at any time; can export/delete audit logs

## Cloud Fallback Redaction Strategy

**What gets redacted before cloud send:**

- Email addresses (sender, recipient, CC, BCC) → replaced with tokens
- Names (sender, recipient) → replaced with "Person A", "Person B"
- Message bodies → summarized locally, only summary sent
- Attachments → never sent to cloud
- Calendar data → never sent to cloud

**What gets sent:**

- Anonymized conversation structure ("Person A asked Person B a question")
- Semantic summary of content (not verbatim text)
- User's writing style profile (tone, formality - no identifying info)

## Options Under Consideration

**Option A: Strict Local-Only (No Cloud Fallback)**

- **Pros:** Maximum privacy, no external dependencies, no data egress
- **Cons:** Users with weak hardware cannot use AI features
- **Best for:** Privacy-maximalist positioning, security-sensitive user base

**Option B: Optional Cloud Fallback with Aggressive Redaction**

- **Pros:** Feature parity for all users, graceful degradation for weak hardware
- **Cons:** Redaction complexity, trust erosion if misconfigured
- **Best for:** Broader market reach while maintaining privacy differentiation

**Option C: Cloud-First with Privacy Theater**

- **Pros:** Simplest implementation, no local AI complexity
- **Cons:** Defeats core value proposition, unacceptable privacy trade-off
- **Decision:** Rejected - not aligned with product vision

**Option D: Do Nothing / Defer**

- Launch without cloud fallback, add later if user demand emerges
- **When this makes sense:** MVP with target users all having capable hardware
- **When this fails:** Negative reviews from users with weak hardware

## Cloud Provider Selection (If Option B Chosen)

**Criteria:**

- **Privacy Policy:** No training on user data
- **Data Retention:** Zero retention after response (ephemeral processing)
- **Compliance:** SOC 2, GDPR compliant
- **API:** Supports structured prompts, low latency

**Options:**

- OpenAI API (gpt-4o-mini for cost/latency balance)
- Anthropic Claude API (strong privacy stance)
- Azure OpenAI (enterprise compliance)

**Decision:** To be finalized in architecture workflow based on pricing, latency benchmarks, privacy policy review

## Telemetry & Diagnostics

**Default: OFF (Opt-in only)**

When enabled:

- **Collect:** App crashes, performance metrics (latency distributions, not individual events), feature usage (aggregate counts)
- **Exclude:** Email content, addresses, names, message bodies, AI prompts/responses
- **Storage:** Local only (30 days retention)
- **Export:** User can export telemetry data (JSON format)
- **Delete:** User can delete telemetry data at any time

**Privacy-Preserving Analytics:**

- Aggregate metrics only (e.g., "Average draft generation latency: 1.8s" not "User X generated draft in 1.8s")
- No unique user identifiers sent to analytics backend
- Local processing of telemetry, only summaries uploaded (if user consents to usage statistics)

## Incident Response & Security Disclosure

**User-Facing:**

- Security & Incidents page accessible in-app
- In-app notifications for critical security issues
- 72-hour communication playbook for breach scenarios

**Handling:**

- Zero-tolerance for privacy incidents
- Post-mortem published publicly for any breach
- User notification within 72 hours of discovery

## Threat Model & Security Checklist

**Data Flow Diagram:**

- [ ] Map all data flows: Email provider → Local storage → AI inference → UI
- [ ] Identify all IPC boundaries: Main process ↔ Renderer process ↔ Background workers
- [ ] Document all external network calls: OAuth, sync APIs, (optional) cloud fallback

**IPC Surface Audit (Electron/Desktop Shell):**

- [ ] Context isolation enabled (no shared context between main/renderer)
- [ ] Node integration disabled in renderer processes
- [ ] IPC handlers whitelist validated (no arbitrary code execution via IPC)
- [ ] Preload scripts audited for safe API exposure

**Content Security Policy (CSP):**

- [ ] CSP configured to block inline scripts, eval(), external resources
- [ ] Review exceptions: Are they truly necessary? Documented?
- [ ] Test CSP violations don't break core features

**PII Redaction Test Vectors:**

- [ ] Test email addresses: john.doe@example.com → TOKEN_1
- [ ] Test names in various formats: "John Doe", "Doe, John", "john.doe"
- [ ] Test phone numbers, addresses, SSNs (if applicable)
- [ ] Test false positives: Don't redact technical terms, code snippets
- [ ] Automated test suite with 50+ PII variations

**Offline Mode Abuse Cases:**

- [ ] Can attacker with physical access extract email data from disk?
  - Mitigation: Encrypt local database with OS keychain-derived key
- [ ] Can malicious extension/process read Claine's memory/storage?
  - Mitigation: Sandboxing, OS-level permissions, principle of least privilege
- [ ] Can user export data and accidentally leak PII?
  - Mitigation: Export warns user, redacts sensitive fields by default

**Log Hygiene:**

- [ ] Audit all logging statements: No email content, addresses, message bodies
- [ ] Acceptable: Log metadata (timestamp, sender hash, message ID - not verbatim)
- [ ] Test logs with real email corpus: Manual review for PII leakage
- [ ] Automated log scrubbing: Regex to catch accidental PII logging

**Cloud Fallback Attack Surface (If Enabled):**

- [ ] TLS 1.3 enforced for all cloud API calls
- [ ] Certificate pinning considered (document decision)
- [ ] Timeout & retry limits prevent DoS via cloud API
- [ ] User audit log tamper-proof (append-only, checksummed)

## Acceptance Criteria

ADR-005 is **Accepted** (this decision is now validated):

- Privacy posture decision finalized: Local-only (Option A) OR cloud fallback (Option B) with redaction
- If cloud fallback chosen:
  - Cloud provider selected with signed BAA (Business Associate Agreement) or equivalent
  - PII redaction tested: 100% pass rate on test vectors (50+ PII variations)
  - Cloud audit log implemented: All invocations logged with timestamp, redacted prompt, user consent
  - Per-event banner implemented: "Processed in cloud (redacted)" visible to user
- Threat model checklist: 100% items reviewed and mitigated or risk-accepted
- IPC audit complete: All Electron IPC handlers reviewed, whitelist validated
- CSP configured and tested: No inline scripts, no external resources (except approved CDNs)
- Log hygiene validated: Automated scan + manual review confirms no PII in logs
- Telemetry default OFF: User must explicitly opt-in, with clear explanation
- GDPR/CCPA compliance: Data export, deletion, portability features implemented (FR033)
- Incident response playbook documented: 72-hour notification, public post-mortem
- Owner sign-off: Security Lead + Architect + PM approval with threat model review

## Operational Considerations

- **Rollout:**
  - Phase 1: Launch with local-only (Option A), gather user feedback on performance
  - Phase 2: If user demand for cloud fallback, introduce Option B with extensive user education
  - Security audit: External pentest before GA launch
- **Telemetry:** Track cloud fallback usage rate, PII redaction failures (alerting), audit log export rate
- **Observability:**
  - Security dashboard: Monitor cloud API calls, redaction failures, auth anomalies
  - Alert on: Unexpected external network calls, IPC violations, CSP violations
- **Fallback:**
  - If PII leakage discovered: Immediate disable cloud fallback, user notification, incident response
  - Emergency kill switch: Remotely disable cloud fallback if security issue detected
- **Support Playbook:**
  - User reports privacy concern: Escalate to Security Lead immediately
  - PII in logs discovered: Purge logs, notify affected users, root cause analysis
  - Cloud provider incident: Assess impact, user notification if data exposed

## Consequences

**Positive:**

- ✅ **Maximum Privacy:** No email data ever leaves device (strongest privacy positioning)
- ✅ **No Cloud Costs:** Zero cloud API fees (reduces operating costs)
- ✅ **Offline-First:** Works completely offline (no internet dependency for core features)
- ✅ **Trust Building:** Simplifies privacy messaging (no "but sometimes cloud" asterisks)

**Negative:**

- ❌ **Hardware Requirements:** Requires capable hardware (16GB+ RAM, modern GPU for WebGPU)
- ❌ **No Fallback:** Users with weak hardware cannot use AI features
- ❌ **Model Size:** 5.5 GB models = long initial download

**Mitigations:**

- **Hardware Check:** Detect insufficient hardware, show clear messaging before download
- **Post-MVP Opt-In Cloud:** If user demand emerges, add cloud fallback with PII redaction (Story 3.2B)
- **Progressive Download:** Download triage model first (1.5 GB), compose model later (4 GB)

## References

- GDPR Article 5 (Data Minimization): https://gdpr-info.eu/art-5-gdpr/
- OpenAI Privacy Policy: https://openai.com/privacy/
- Anthropic Privacy & Security: https://www.anthropic.com/privacy
- OWASP Desktop App Security: https://owasp.org/www-project-desktop-app-security-top-10/

---
