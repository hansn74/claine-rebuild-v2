# ADR-011: Packaging, Sandboxing & Permissions

**Status:** Accepted
**Date:** 2025-11-03
**Deciders:** Architect, Security Lead

## Context

Claine (PWA) requires browser-level permissions for:

- Persistent storage (IndexedDB for local database, 100K+ emails)
- Network access (OAuth, Gmail API sync, optional cloud fallback)
- Web Notifications (triage alerts, email notifications)
- File System Access API (attachment downloads, email export)
- Service Workers (offline-first functionality)

Must balance functionality with security:

- Leverage browser sandbox by default (no system-level access)
- Request minimal permissions (principle of least privilege)
- Transparent permission requests (explain why permissions needed)
- PWA installability (manifest + HTTPS + Service Worker)

**Requirement Mapping:** NFR002 (reliability - sandboxing), NFR003 (security), ADR-007 (token security), ADR-006 (PWA deployment)

## Decision

**Selected: Browser Sandbox + Web Permissions API**

Deploy Claine as a sandboxed PWA using browser-native security:

- **Sandboxing:** Automatic via browser same-origin policy (no system-level access)
- **Permissions:** Web Permissions API for notifications, storage, clipboard
- **Storage:** Persistent Storage API for IndexedDB (prevents eviction)
- **File Access:** File System Access API for user-selected files only
- **Distribution:** HTTPS URL (no installers, no app stores)
- **Installation:** PWA manifest (user can install to desktop/mobile)

## Rationale

PWA browser sandbox provides security by default:

**Pros:**

- **Automatic Sandboxing:** Browser enforces same-origin policy (no system-level access possible)
- **No Installer Required:** HTTPS URL only (no code signing, no app store approval)
- **Minimal Permissions:** Only request storage, notifications, file access (user grants explicitly)
- **Cross-Platform Security:** Same security model on all platforms (macOS, Windows, Linux, iOS, Android)
- **Browser Updates:** Security patches delivered by browser vendor (no app-level patching needed)
- **CSP Hardening:** Content Security Policy prevents XSS attacks (inline scripts blocked)

**Cons:**

- **Limited OS Integration:** No system tray, no deep file system access (PWA limitation)
- **Browser Dependency:** Security relies on browser sandbox (user must trust browser)
- **Storage Quota:** IndexedDB quota varies by browser (Safari 50MB, Chrome ~60% of disk)
- **No App Store Distribution:** Cannot distribute via Mac App Store or Microsoft Store (not native apps)

**Option B: Electron contextIsolation - REJECTED**

- **Pros:** Full system access, app store distribution possible
- **Cons:** Complex IPC security, code signing required, no mobile support
- **Rejected because:** PWA browser sandbox eliminates need for custom sandboxing

**Option C: No Sandboxing - REJECTED**

- **Pros:** Maximum flexibility
- **Cons:** Unacceptable security posture
- **Rejected because:** Browser sandbox provides security by default (no reason to disable)

## Implementation Details

### Browser Sandbox Security Model

**Same-Origin Policy:**

- PWA can only access resources from same origin (https://claine.app)
- Cross-origin requests blocked by default (CORS must be enabled server-side)
- IndexedDB isolated per origin (other sites cannot access Claine's database)
- Service Workers scoped to origin (cannot intercept requests to other domains)

**Content Security Policy (CSP):**

```html
<meta
  http-equiv="Content-Security-Policy"
  content="
    default-src 'self';
    script-src 'self' 'wasm-unsafe-eval';
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: https:;
    connect-src 'self' https://www.googleapis.com https://oauth2.googleapis.com;
    font-src 'self' data:;
    frame-ancestors 'none';
    base-uri 'self';
    form-action 'self';
  "
/>
```

**CSP Explanation:**

- `default-src 'self'` - Only load resources from same origin
- `script-src 'self' 'wasm-unsafe-eval'` - Allow WASM for AI inference (ONNX Runtime)
- `style-src 'self' 'unsafe-inline'` - Allow inline styles (required by TailwindCSS)
- `connect-src` - Allow Gmail API and OAuth endpoints only
- `frame-ancestors 'none'` - Prevent clickjacking attacks
- `form-action 'self'` - Prevent form submission to external sites

### Required Permissions (Web Permissions API)

**1. Persistent Storage (`persistent-storage`)**

- **Why:** Prevent browser from evicting IndexedDB when storage quota exceeded
- **When Requested:** On first app launch after user authenticates
- **User Prompt:** "Claine wants to store email data on this device"
- **Fallback:** If denied, email data may be evicted when browser needs space (show warning)

```typescript
// Request persistent storage permission
async function requestPersistentStorage(): Promise<boolean> {
  if (navigator.storage && navigator.storage.persist) {
    const isPersisted = await navigator.storage.persisted()
    if (!isPersisted) {
      const granted = await navigator.storage.persist()
      return granted
    }
    return true
  }
  return false
}
```

**2. Notifications (`notifications`)**

- **Why:** Show triage alerts, new email notifications
- **When Requested:** User enables notifications in settings (opt-in)
- **User Prompt:** "Claine wants to send you notifications"
- **Fallback:** If denied, no notifications (user must check app manually)

```typescript
// Request notification permission
async function requestNotificationPermission(): Promise<boolean> {
  if ('Notification' in window && Notification.permission === 'default') {
    const permission = await Notification.requestPermission()
    return permission === 'granted'
  }
  return Notification.permission === 'granted'
}
```

**3. Clipboard (`clipboard-write`)**

- **Why:** Copy email content, workflow snippets to clipboard
- **When Requested:** User clicks "Copy" button in email viewer
- **User Prompt:** (No prompt - granted by default for user-initiated actions)
- **Fallback:** Use legacy document.execCommand('copy') if API unavailable

```typescript
// Write to clipboard (no explicit permission needed for user-initiated actions)
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (err) {
    // Fallback to legacy API
    const textarea = document.createElement('textarea')
    textarea.value = text
    document.body.appendChild(textarea)
    textarea.select()
    const success = document.execCommand('copy')
    document.body.removeChild(textarea)
    return success
  }
}
```

**4. File System Access API (user-selected files only)**

- **Why:** Download email attachments, export email archive
- **When Requested:** User clicks "Download attachment" or "Export emails"
- **User Prompt:** Native OS file picker (user explicitly selects location)
- **Fallback:** Use `<a download>` if API unavailable (downloads to default folder)

```typescript
// Save file using File System Access API
async function saveFile(filename: string, content: Blob): Promise<void> {
  if ('showSaveFilePicker' in window) {
    // Modern API - user chooses location
    const handle = await (window as any).showSaveFilePicker({
      suggestedName: filename,
    })
    const writable = await handle.createWritable()
    await writable.write(content)
    await writable.close()
  } else {
    // Fallback - download to default folder
    const url = URL.createObjectURL(content)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }
}
```

### PWA Installation (Progressive Enhancement)

**PWA Manifest (manifest.json):**

```json
{
  "name": "Claine - AI Email Assistant",
  "short_name": "Claine",
  "description": "Offline-first AI-powered email client with privacy-first local processing",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#3b82f6",
  "orientation": "any",
  "scope": "/",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "categories": ["productivity", "email"],
  "screenshots": [
    {
      "src": "/screenshot-wide.png",
      "sizes": "1280x720",
      "type": "image/png",
      "form_factor": "wide"
    },
    {
      "src": "/screenshot-narrow.png",
      "sizes": "750x1334",
      "type": "image/png",
      "form_factor": "narrow"
    }
  ]
}
```

**Installation Criteria:**

- ✅ Served over HTTPS (Vercel provides automatically)
- ✅ Has valid Web App Manifest (manifest.json)
- ✅ Has Service Worker registered
- ✅ User has visited site at least once
- ✅ User has engaged with site (30+ seconds on page)

**Installation Flow:**

1. User visits https://claine.app
2. After 30 seconds, browser shows "Install Claine" prompt (Chrome, Edge)
3. User clicks "Install" → PWA added to desktop/home screen
4. Installed PWA opens in standalone window (no browser chrome)
5. PWA behaves like native app (taskbar/dock icon, Alt+Tab switching)

### Storage Quota Management

**Browser Storage Limits:**

- **Chrome/Edge:** ~60% of available disk space
- **Firefox:** ~50% of available disk space
- **Safari:** 1GB maximum (quota increase possible via prompt)

**Quota Strategy:**

- Request persistent storage on first launch (prevents eviction)
- Monitor quota usage (warn user at 80% capacity)
- Provide "Clear old emails" option if quota exceeded

```typescript
// Check storage quota
async function checkStorageQuota(): Promise<{ used: number; available: number }> {
  if (navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate()
    return {
      used: estimate.usage || 0,
      available: estimate.quota || 0,
    }
  }
  return { used: 0, available: 0 }
}

// Warn user if approaching quota limit
async function monitorStorageQuota() {
  const { used, available } = await checkStorageQuota()
  const percentUsed = (used / available) * 100

  if (percentUsed > 80) {
    showWarning('Storage almost full. Consider archiving old emails.')
  }
}
```

## Acceptance Criteria

ADR-011 is **Accepted** (this decision is now validated):

- ✅ PWA served over HTTPS (Vercel deployment)
- ✅ Content Security Policy configured (blocks inline scripts, XSS attacks)
- ✅ Service Worker registered (offline-first functionality)
- ✅ PWA manifest configured (installable on desktop/mobile)
- ✅ Persistent storage requested (prevents IndexedDB eviction)
- ✅ Notification permission requested (opt-in only)
- ✅ File System Access API implemented (attachment downloads)
- ✅ Storage quota monitoring implemented (warn at 80% capacity)
- ✅ Browser compatibility tested (Chrome 90+, Safari 15+, Firefox 100+)

## Operational Considerations

**Rollout:**

- Phase 1: Deploy PWA to Vercel (HTTPS enabled automatically)
- Phase 2: Enable PWA installation prompt (manifest + Service Worker)
- Phase 3: Request persistent storage on first launch
- Phase 4: Add notification permission request in settings (opt-in)

**Telemetry:**

- Track PWA installation rate (how many users install vs browse)
- Track permission grant/deny rate (persistent storage, notifications)
- Track storage quota usage (average per user, percentage approaching limit)
- Monitor quota eviction rate (IndexedDB cleared by browser due to space)

**Observability:**

- **Metrics:** Installation rate, permission grant rate, storage quota usage
- **Alerts:** High permission denial rate (UX issue), storage quota exceeded (data loss risk)
- **Logs:** Permission requests, quota warnings, CSP violations

**Fallback:**

- Persistent storage denied → Show warning "Email data may be deleted if browser needs space"
- Notifications denied → Disable notification features (user must check app manually)
- File System Access API unavailable → Use legacy `<a download>` (downloads to default folder)
- Storage quota exceeded → Prompt user to clear old emails or use different browser

**Support Playbook:**

- **"Install" button not showing:** Check HTTPS enabled, Service Worker registered, user visited site long enough
- **Storage quota exceeded:** Clear old emails, use Chrome (Safari has 1GB limit), request quota increase
- **Notifications not working:** Check browser permission settings, verify notification permission granted
- **CSP violation errors:** Check browser console, verify no inline scripts (use external .js files)

## Consequences

**Positive:**

- ✅ **Automatic Sandboxing:** Browser enforces same-origin policy (no system-level access possible)
- ✅ **Zero Distribution Costs:** No code signing, no app stores, no installer hosting
- ✅ **Cross-Platform Consistency:** Same security model on all platforms (macOS, Windows, Linux, iOS, Android)
- ✅ **Browser Security Updates:** Browser vendor handles security patches (no app-level patching)
- ✅ **CSP Hardening:** Strict Content Security Policy prevents XSS attacks

**Negative:**

- ❌ **No App Store Distribution:** Cannot distribute via Mac App Store or Microsoft Store (not native apps)
- ❌ **Limited OS Integration:** No system tray, no deep file system access (PWA limitation)
- ❌ **Browser Dependency:** Security relies on browser sandbox (user must trust browser)
- ❌ **Storage Quota Limits:** IndexedDB quota varies by browser (Safari 1GB limit problematic)

**Mitigations:**

- **Escape Hatch:** If app store distribution becomes critical, wrap PWA in Electron/Tauri shell (same codebase)
- **Storage Monitoring:** Warn user before approaching quota limit (archive old emails)
- **Progressive Enhancement:** Core features work without installation (PWA installation optional)
- **Browser Compatibility:** Target Chrome 90+, Safari 15+, Firefox 100+ (covers 95%+ of users)

## Alternatives Considered

- **Electron contextIsolation + IPC security:** Rejected due to complexity, code signing costs, no mobile support
- **Full macOS App Sandbox:** Not applicable (PWA runs in browser sandbox, not native app)
- **No Sandboxing:** Rejected - browser sandbox provides security by default (no reason to disable)
- **App Store Distribution (Mac App Store, Microsoft Store):** Not viable - PWA not native app (cannot submit)

## References

- **Web Permissions API:** https://developer.mozilla.org/en-US/docs/Web/API/Permissions_API
- **Persistent Storage API:** https://developer.mozilla.org/en-US/docs/Web/API/Storage_API
- **File System Access API:** https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API
- **Content Security Policy (CSP):** https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP
- **Web App Manifest:** https://developer.mozilla.org/en-US/docs/Web/Manifest
- **PWA Installation Criteria:** https://web.dev/install-criteria/
- **Same-Origin Policy:** https://developer.mozilla.org/en-US/docs/Web/Security/Same-origin_policy
- **Service Workers Security:** https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers
- **Architecture Document:** `docs/architecture.md` (Security architecture section)

---
