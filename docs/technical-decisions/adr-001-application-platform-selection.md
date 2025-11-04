# ADR-001: Application Platform Selection

**Status:** Accepted
**Date:** 2025-11-01
**Deciders:** Architect, Lead Engineer

## Context

Claine requires a cross-platform application that supports:
- Modern web rendering (HTML/CSS/JS) for UI
- Offline-first architecture with local data storage (100K emails per account)
- Performance targets: sub-50ms interactions, 60 FPS scrolling
- Security: sandboxing, CSP, secure credential storage
- Future mobile support (iOS/Android)
- CASA audit compliance for Gmail API access
- Low resource usage (memory, CPU, battery)

**Requirement Mapping:** NFR001 (Performance), NFR003 (Security), NFR004 (Scalability), UI Design Goals

## Decision

**Selected: Progressive Web App (PWA) with Service Workers**

Deploy Claine as a PWA using:
- **Framework:** Vite + React + TypeScript
- **Database:** RxDB v16 + IndexedDB (offline storage)
- **State Management:** Zustand v5
- **Styling:** TailwindCSS v4 + shadcn/ui
- **Service Workers:** Offline-first caching, background sync
- **Deployment:** Vercel with edge caching

## Rationale

After comprehensive analysis comparing PWA vs Electron:

**Pros:**
- **Lower Resource Usage:** 40-60% less memory than Electron (~60-80MB vs 100-200MB)
- **Faster Deployment:** No installers, no code signing ($200-300/year saved), instant updates
- **Easier CASA Audit:** Sandboxed by default (browser security model), no system-level access
- **Future Mobile Support:** Same codebase works on iOS/Android PWAs
- **Developer Experience:** Simpler architecture (no Electron IPC), faster builds (Vite), better debugging
- **Progressive Enhancement:** Works on any modern browser, installable as app
- **Security:** Browser sandbox by default, strict CSP, Web Crypto API for encryption

**Cons:**
- **Limited OS Integration:** No system tray (Phase 1), notifications via Web Notifications API only
- **Browser Dependency:** Requires modern browser (Chrome 90+, Safari 15+, Firefox 100+)
- **Storage Limits:** ~60% of disk quota (acceptable for 100K emails = 1.5 GB)
- **Offline Requires HTTPS:** Must be served over HTTPS for Service Workers

**Option B: Electron - REJECTED**
- **Pros:** Maximum OS integration, mature ecosystem, proven at scale (VS Code, Slack)
- **Cons:** 40-60% higher memory usage, code signing costs, complex CASA audit (system-level access), no mobile support
- **Rejected because:** Resource overhead, deployment complexity, CASA audit complexity, lack of mobile path

**Option C: Tauri - REJECTED**
- **Pros:** Low memory footprint, Rust safety, modern architecture
- **Cons:** Smaller ecosystem, team learning curve, no mobile support
- **Rejected because:** Team has no Rust experience, ecosystem less mature for RxDB/AI integration

## Consequences

**Positive:**
- ✅ **Lower TCO:** No code signing fees, no installer distribution costs
- ✅ **Faster iterations:** Deploy updates instantly via Vercel edge
- ✅ **Simpler codebase:** No Electron IPC, no main/renderer process split
- ✅ **Mobile-ready:** Same codebase can support iOS/Android PWAs in Phase 2+
- ✅ **Easier CASA audit:** Browser sandbox simplifies security assessment

**Negative:**
- ❌ **No system tray:** Phase 1 limitation (can be added via browser extensions or Electron wrapper later)
- ❌ **Browser requirement:** Users must have modern browser (not standalone executable)
- ❌ **Limited native features:** No deep OS integration (file system access limited to File System Access API)

**Mitigations:**
- **Escape hatch:** If OS integration becomes critical, wrap PWA in Electron/Tauri shell (same codebase)
- **Progressive enhancement:** Start with PWA, add native features incrementally
- **Browser compatibility:** Target Chrome 90+, Safari 15+, Firefox 100+ (covers 95%+ users)

## Acceptance Criteria

ADR-001 is **Accepted** (this decision is now validated):
- ✅ LCP (Largest Contentful Paint) < 2.5s
- ✅ FID (First Input Delay) < 100ms
- ✅ CLS (Cumulative Layout Shift) < 0.1
- ✅ Service Workers configured for offline-first
- ✅ IndexedDB storage tested for 100K emails (~1.5 GB)
- ✅ PWA manifest configured (installable)
- ✅ CSP configured (strict Content Security Policy)
- ✅ OAuth PKCE flow tested (no client secret required)

## Operational Considerations

- **Deployment:** Vercel with automatic edge caching
- **Updates:** Automatic via Service Worker update mechanism
- **Telemetry:** Web Vitals tracking (LCP, FID, CLS, TTI)
- **Monitoring:** Vercel Analytics + custom performance marks
- **Fallback:** If PWA proves insufficient, migrate to Electron wrapper (same React codebase)
- **Browser Support:** Chrome/Edge 90+, Safari 15+, Firefox 100+

## Alternatives Considered

- **Electron:** Initially considered, but rejected due to higher resource usage (40-60% more memory), code signing costs ($200-300/year), complex CASA audit (system-level access), and lack of mobile support
- **Qt/Flutter Desktop:** Rejected - not web-native, would require full UI rewrite, steeper learning curve
- **Do Nothing / Defer:** Not viable - application platform required for MVP

## References

- **Architecture Document:** `docs/architecture.md` (complete decision details)
- **PWA Best Practices:** https://web.dev/progressive-web-apps/
- **Service Worker Guide:** https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
- **IndexedDB Storage Limits:** https://web.dev/storage-for-the-web/
- **Web Vitals:** https://web.dev/vitals/
- **Vite PWA Plugin:** https://vite-pwa-org.netlify.app/
- **Research Analysis:** Internal comparison document (PWA vs Electron, 20K+ words)

---
