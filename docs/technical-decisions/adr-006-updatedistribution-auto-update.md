# ADR-006: Update/Distribution & Auto-Update

**Status:** Accepted
**Date:** 2025-11-03
**Deciders:** Architect, DevOps Lead

## Context

Claine requires secure, reliable distribution and auto-update mechanism for a PWA (Progressive Web App):
- Zero-friction deployment (no installers, no app stores)
- Automatic updates without user intervention
- Offline-first capability with Service Workers
- Instant rollback if update fails
- Minimize update payload size
- PWA installability for desktop/mobile experience

**Requirement Mapping:** NFR002 (Reliability), NFR006 (Usability - seamless updates)

## Decision

**Selected: Vercel Deployment + Service Worker Auto-Updates**

Deploy Claine as a PWA using:
- **Hosting:** Vercel with edge CDN (global distribution)
- **Auto-Update:** Service Worker lifecycle with automatic background updates
- **Distribution:** Direct HTTPS URL (installable as PWA via browser prompt)
- **Rollback:** Service Worker skipWaiting() control + version pinning
- **Caching Strategy:** Workbox v7 for static assets + runtime caching

## Rationale

PWA deployment eliminates traditional distribution challenges:

**Pros:**
- **Zero Distribution Friction:** No installers, no code signing ($200-300/year saved), no app store approval
- **Instant Updates:** Service Worker updates automatically in background, activates on next visit
- **Global CDN:** Vercel Edge Network serves assets from nearest location (sub-100ms latency worldwide)
- **Automatic Rollback:** Failed updates don't activate, previous version continues working
- **Progressive Enhancement:** Works in browser immediately, installable as app when ready
- **Mobile Support:** Same codebase works as iOS/Android PWA (no separate builds)
- **Cost Efficiency:** Vercel free tier supports 100GB bandwidth/month (sufficient for MVP)

**Cons:**
- **Browser Requirement:** Users must have modern browser (Chrome 90+, Safari 15+, Firefox 100+)
- **No System Tray:** Phase 1 limitation (can be added via browser extensions later)
- **Update Control:** Less granular than Electron (no "check for updates" button by default)
- **HTTPS Requirement:** Service Workers require HTTPS (Vercel provides automatically)

**Option B: Electron Builder + electron-updater - REJECTED**
- **Pros:** Full OS integration, auto-update control, system tray
- **Cons:** Requires installers, code signing costs, no mobile support, complex deployment pipeline
- **Rejected because:** PWA eliminates distribution complexity, costs, and provides mobile path

**Option C: Manual Distribution (GitHub Releases) - REJECTED**
- **Pros:** Simple, no infrastructure
- **Cons:** Poor update adoption, user friction, security risk for critical patches
- **Rejected because:** Auto-updates critical for security and user experience

## Implementation Details

### Service Worker Update Strategy

**Update Lifecycle:**
1. User visits app → Service Worker checks for updates in background
2. New version detected → Download new assets in background
3. New Service Worker installed but waits (old version continues running)
4. User closes all app tabs → New Service Worker activates on next visit
5. If update fails → Old Service Worker continues, no disruption

**Configuration (Workbox 7):**
```typescript
// vite.config.ts with vite-plugin-pwa
VitePWA({
  registerType: 'autoUpdate', // Auto-update on page reload
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'google-fonts-cache',
          expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }
        }
      }
    ]
  }
})
```

### Deployment Pipeline (Vercel)

**CI/CD Workflow:**
1. Push to `main` branch → GitHub Actions runs tests + build
2. Build passes → Vercel deploys to production automatically
3. Vercel assigns immutable deployment URL + updates production domain
4. Edge CDN invalidation automatic (new version available globally in ~60s)

**Preview Deployments:**
- Every pull request gets unique preview URL
- QA can test changes before merge to main
- No impact on production until PR merged

### Version Management

**Versioning Strategy:**
- Use semantic versioning in `package.json` (1.0.0 → 1.1.0)
- Service Worker detects version mismatch → triggers update
- Version displayed in app UI (Help → About)

**Rollback Strategy:**
- Critical issue detected → Revert Git commit → Vercel redeploys previous version
- Service Worker updates automatically to previous version
- Rollback time: <5 minutes (Git revert + Vercel deploy)

### Update Frequency

**Automatic Updates:**
- Service Worker checks for updates every 24 hours (configurable)
- Update downloads in background (no user interruption)
- New version activates on next page load/reload
- No "update available" prompt (seamless)

**Critical Security Patches:**
- Deploy to Vercel immediately
- Service Worker detects update within 24 hours
- Option to add "New version available - Reload now" banner for urgent updates

### PWA Installation

**Installation Prompt:**
- Browser shows "Install Claine" prompt after 30 seconds of usage
- User can install to desktop/home screen (feels like native app)
- Installed PWA runs in standalone window (no browser chrome)
- Updates still automatic via Service Worker

**PWA Manifest:**
```json
{
  "name": "Claine - AI Email Assistant",
  "short_name": "Claine",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#3b82f6",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

## Acceptance Criteria

ADR-006 is **Accepted** (this decision is now validated):
- ✅ Vercel project configured and linked to GitHub repository
- ✅ Service Worker registered and caching static assets
- ✅ Auto-update tested: Deploy new version → Old client updates within 24 hours
- ✅ Rollback tested: Revert Git commit → Vercel redeploys previous version successfully
- ✅ PWA manifest configured (installable on desktop/mobile)
- ✅ Update UI tested: New version activates on page reload without errors
- ✅ CI/CD pipeline: GitHub Actions builds → Vercel deploys automatically
- ✅ Performance: Deployment time <3 minutes, CDN propagation <60 seconds globally
- ✅ Edge caching: Static assets served from nearest edge location (verified with Vercel Analytics)

## Operational Considerations

**Rollout:**
- Phase 1: Deploy to Vercel preview URL for internal testing
- Phase 2: Deploy to production domain for private beta (claine.app)
- Phase 3: Enable PWA installation prompt for public waitlist users
- Phase 4: Full GA with automatic updates enabled

**Telemetry:**
- Track via Vercel Analytics: Deployment frequency, build time, bandwidth usage
- Track via app: Service Worker update success rate, installation rate, version adoption
- Monitor: Update failures, cache size, offline usage patterns

**Observability:**
- **Dashboard:** Vercel deployment history, bandwidth usage, edge cache hit rate
- **Alerts:** Deploy failure (GitHub Actions + Vercel webhook), high error rate (Sentry)
- **Metrics:** Time-to-update (Service Worker activation lag), installation conversion rate

**Fallback:**
- Service Worker update fails → Old version continues working (no disruption)
- Vercel deployment fails → Previous version remains live (zero downtime)
- Critical bug deployed → Git revert + redeploy (<5 minutes to rollback)
- CDN issues → Vercel automatically routes to healthy edge nodes

**Support Playbook:**
- **User sees old version:** Clear browser cache, hard reload (Cmd+Shift+R / Ctrl+Shift+R)
- **PWA won't install:** Check browser support (Chrome 90+, Safari 15+, Firefox 100+), verify HTTPS
- **Service Worker not updating:** Check Vercel deployment status, verify Service Worker registered in DevTools
- **Offline mode broken:** Check IndexedDB quota (Safari has 50MB limit), verify Service Worker caching strategy

## Consequences

**Positive:**
- ✅ **Zero Distribution Costs:** No code signing, no app stores, no installer CDN
- ✅ **Instant Global Updates:** Vercel edge network + Service Worker = updates propagate in <1 hour worldwide
- ✅ **Mobile-Ready:** Same deployment supports iOS/Android PWAs (no separate builds)
- ✅ **Developer Velocity:** Deploy to production in <3 minutes (git push → automatic deploy)
- ✅ **Simplified Testing:** Preview deployments for every PR (QA tests real builds, not localhost)

**Negative:**
- ❌ **No System Tray:** PWA limitation (can be added via browser extensions in Phase 2+)
- ❌ **Browser Dependency:** Users must have modern browser (not standalone executable)
- ❌ **Limited Update Control:** No manual "check for updates" button by default (can be added)

**Mitigations:**
- **Escape Hatch:** If OS integration becomes critical, wrap PWA in Electron/Tauri shell (same codebase)
- **Update Visibility:** Add "Check for updates" button in Help menu (forces Service Worker update check)
- **Browser Compatibility:** Target Chrome 90+, Safari 15+, Firefox 100+ (covers 95%+ of users)

## Alternatives Considered

- **Electron Builder + electron-updater:** Rejected due to distribution complexity, code signing costs, no mobile support
- **Tauri + tauri-update:** Rejected due to ecosystem maturity, team learning curve, no mobile support
- **Manual Distribution (GitHub Releases):** Rejected due to poor update adoption and security risk
- **Do Nothing / Defer:** Not viable - auto-updates critical for security patches and user experience

## References

- **Vercel Deployment Docs:** https://vercel.com/docs/deployments/overview
- **Service Worker API:** https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
- **Workbox (Google's Service Worker Library):** https://developer.chrome.com/docs/workbox/
- **vite-plugin-pwa:** https://vite-pwa-org.netlify.app/
- **PWA Installation Criteria:** https://web.dev/install-criteria/
- **Web App Manifest:** https://developer.mozilla.org/en-US/docs/Web/Manifest
- **Architecture Document:** `docs/architecture.md` (PWA deployment strategy)

---
