# ADR-013: Accessibility Engineering Plan

**Status:** Proposed
**Date:** 2025-10-29
**Deciders:** Architect, UX Designer, Accessibility Specialist (if available)

## Context

Claine must meet WCAG 2.1 AA accessibility standards (NFR008):

- Keyboard navigation (no mouse required for all features)
- Screen reader support (NVDA, JAWS, VoiceOver)
- Color contrast (4.5:1 for text, 3:1 for UI elements)
- Focus management (visible focus indicators, logical tab order)
- ARIA labels for custom components

**Requirement Mapping:** NFR008 (Accessibility - WCAG 2.1 AA), FR006 (Usability - keyboard shortcuts)

## Decision

**To be determined by architecture workflow**

## Options Under Consideration

**Option A: Accessibility-First Development**

- **Pros:** Accessibility built-in from day 1, easier to maintain, aligns with best practices
- **Cons:** Requires upfront investment, team training, slower initial development
- **Best for:** If accessibility is regulatory requirement or core value

**Option B: Retrofit Post-MVP**

- **Pros:** Faster MVP delivery, focus on core features first
- **Cons:** Expensive to retrofit, technical debt, may miss critical accessibility issues
- **Best for:** Time-constrained MVP, plan to address before GA

**Option C: Minimum Viable Accessibility (Keyboard + Screen Reader Basics)**

- **Pros:** Balance speed with accessibility, covers most common needs
- **Cons:** May not meet full WCAG 2.1 AA, requires iteration
- **Best for:** MVP with commitment to expand post-launch

**Option D: Do Nothing / Defer**

- Launch without accessibility considerations
- **When this makes sense:** Never - excludes disabled users, legal risk (ADA)
- **When this fails:** Always - unacceptable ethical and legal posture

## Accessibility Features

**Keyboard Navigation (NFR008):**

- All features accessible via keyboard (no mouse required)
- Logical tab order (top-to-bottom, left-to-right)
- Keyboard shortcuts for common actions:
  - `Cmd/Ctrl + N`: Compose new email
  - `Cmd/Ctrl + R`: Reply
  - `Cmd/Ctrl + D`: Delete/Archive
  - `Cmd/Ctrl + Z`: Undo AI action
  - `Cmd/Ctrl + F`: Search
  - `Arrow keys`: Navigate inbox, threads

**Screen Reader Support (NFR008):**

- Semantic HTML (use `<button>`, `<nav>`, `<main>`, not generic `<div>`)
- ARIA labels for custom components (e.g., `aria-label="AI confidence: 85%"`)
- Live regions for dynamic updates (e.g., `aria-live="polite"` for notification toasts)
- Test with: NVDA (Windows), JAWS (Windows), VoiceOver (macOS)

**Color Contrast (NFR008):**

- Text contrast: 4.5:1 (normal text), 3:1 (large text 18pt+)
- UI element contrast: 3:1 (buttons, borders)
- Tools: Use Axe DevTools, Lighthouse to validate contrast

**Focus Management:**

- Visible focus indicators (outline or ring around focused element)
- Focus trapped in modals (can't tab out to background)
- Focus restored after modal closes (return to triggering element)

## Testing & Validation

**Automated Testing:**

- Axe DevTools: Run on every page, catch common issues (missing alt text, low contrast)
- Lighthouse CI: Automated accessibility audits in CI/CD
- Pa11y: Automated WCAG 2.1 AA validation

**Manual Testing:**

- Keyboard navigation: Complete critical workflows (compose, reply, search) without mouse
- Screen reader testing: Test with NVDA, JAWS, VoiceOver on all platforms
- User testing: Recruit users with disabilities for beta testing

**Compliance Checklist:**

- [ ] All interactive elements keyboard accessible
- [ ] All images have alt text (or `alt=""` if decorative)
- [ ] All form inputs have labels
- [ ] Color contrast meets WCAG 2.1 AA (4.5:1 text, 3:1 UI)
- [ ] Focus indicators visible on all interactive elements
- [ ] Screen reader announces page title, headings, button labels
- [ ] Dynamic content updates announced (aria-live)
- [ ] Modals trap focus, restore focus on close
- [ ] No keyboard traps (can escape all UI with keyboard)

## Acceptance / Exit Criteria

ADR-013 is **Accepted** when:

- Keyboard navigation working: All features accessible without mouse (tested manually)
- Screen reader support: VoiceOver (macOS), NVDA (Windows) can navigate all core workflows
- Color contrast validated: Axe DevTools reports 0 contrast violations
- Automated tests passing: Lighthouse accessibility score ≥90, Pa11y reports 0 WCAG 2.1 AA violations
- Accessibility audit complete: External audit (if budget allows) or internal checklist 100% complete
- User testing: ≥5 users with disabilities test beta, report no blocking issues
- Owner sign-off: UX Designer + Accessibility Specialist (if available) + Architect approval

## Operational Considerations

- **Rollout:**
  - Phase 1: Implement keyboard navigation + basic screen reader support for MVP
  - Phase 2: Full WCAG 2.1 AA compliance before GA (color contrast, ARIA labels, focus management)
  - Phase 3: Recruit users with disabilities for ongoing feedback
- **Telemetry:** Track keyboard shortcut usage, screen reader usage (via user agent), accessibility setting toggles
- **Observability:**
  - Dashboard: Accessibility issue reports over time, Lighthouse scores per release
  - Alert on: Lighthouse score drops below 90, user reports blocking accessibility issue
- **Fallback:**
  - If accessibility issue blocks user: Provide workaround, prioritize fix
  - If full WCAG compliance delayed: Ship with "Beta" label, commit to GA compliance timeline
- **Support Playbook:**
  - User reports accessibility issue: Reproduce with screen reader/keyboard, file bug, prioritize high
  - Lighthouse score drops: Review recent changes, fix violations, re-test
  - Screen reader not working: Check ARIA labels, semantic HTML, test with actual screen reader

## Consequences

**To be determined post-decision**

## References

- WCAG 2.1 Guidelines: https://www.w3.org/WAI/WCAG21/quickref/
- Axe DevTools: https://www.deque.com/axe/devtools/
- Pa11y: https://pa11y.org/
- WebAIM Contrast Checker: https://webaim.org/resources/contrastchecker/
- Inclusive Components: https://inclusive-components.design/

---
