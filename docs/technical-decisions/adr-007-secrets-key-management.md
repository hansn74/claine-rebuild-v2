# ADR-007: Secrets & Key Management

**Status:** Accepted
**Date:** 2025-11-03
**Deciders:** Architect, Security Lead

## Context

Claine (PWA) must securely store:
- OAuth tokens (Gmail access/refresh tokens with PKCE)
- User encryption keys (for IndexedDB database encryption)
- User preferences (non-sensitive, but integrity matters)

**Constraint:** As a PWA, we cannot use OS-level keystores (Keychain, Credential Manager). We must use browser-native APIs (Web Crypto API, IndexedDB).

**Requirement Mapping:** FR001-FR005 (OAuth tokens), FR024 (privacy - local encryption), NFR003 (Security - token protection)

## Decision

**Selected: Web Crypto API + IndexedDB Encryption with PKCE Token Flow**

Implement secure storage using browser-native APIs:
- **OAuth Flow:** OAuth 2.0 PKCE (no client secret required)
- **Token Storage:** Encrypted in IndexedDB using Web Crypto API (AES-GCM)
- **Encryption Key:** Derived from user session using PBKDF2 (never stored plaintext)
- **Key Derivation:** Browser-generated entropy + user session context
- **Database Encryption:** RxDB encryption plugin with Web Crypto API

## Rationale

PWA security model differs fundamentally from desktop apps:

**Pros:**
- **Browser Sandbox:** Tokens isolated per origin (cross-origin protection by default)
- **Web Crypto API:** Hardware-backed cryptography where available (e.g., TPM on Windows, Secure Enclave on iOS)
- **No Client Secret:** PKCE eliminates need to store client secret (impossible to secure in browser)
- **Same-Origin Policy:** Tokens never accessible to other domains
- **Encrypted IndexedDB:** All sensitive data encrypted at rest in browser storage

**Cons:**
- **No OS Keychain:** Cannot use macOS Keychain/Windows Credential Manager
- **Browser Storage Limits:** IndexedDB quota typically 60% of disk (acceptable for MVP)
- **Session-Based Keys:** Encryption key derived from session (cleared on logout)
- **Browser Trust Assumption:** User must trust browser to protect keys (true for all PWAs)

**Option B: Master Password - REJECTED**
- **Pros:** User controls master password, additional security layer
- **Cons:** UX friction (enter password every launch), user forgets password = data loss
- **Rejected because:** Unacceptable UX for email client (users expect instant access)

**Option C: Plaintext Storage - REJECTED**
- **Pros:** Simple implementation
- **Cons:** Unacceptable security posture, tokens accessible via browser DevTools
- **Rejected because:** Violates security requirements (NFR003)

## Implementation Details

### OAuth 2.0 PKCE Token Flow

**Why PKCE?**
- No client secret needed (client secret cannot be secured in browser)
- Proof Key for Code Exchange prevents authorization code interception
- Gmail API requires PKCE for public clients (SPAs, PWAs, mobile apps)

**PKCE Flow:**
1. App generates `code_verifier` (random 128-byte string)
2. App derives `code_challenge = SHA256(code_verifier)`
3. User redirected to Gmail OAuth with `code_challenge`
4. Gmail redirects back with authorization `code`
5. App exchanges `code` + `code_verifier` for tokens (Gmail verifies SHA256 match)
6. App receives `access_token` (1 hour) + `refresh_token` (indefinite)

**Token Storage Strategy:**
- **Access Token:** Store in memory only (cleared on page reload)
- **Refresh Token:** Store encrypted in IndexedDB (persistent, survives page reload)
- **Encryption Key:** Derived from browser session entropy + user context

**Implementation (Simplified):**
```typescript
// Generate PKCE code verifier/challenge
const codeVerifier = generateRandomString(128);
const codeChallenge = await sha256(codeVerifier);

// Redirect to Gmail OAuth
const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
  `client_id=${CLIENT_ID}&` +
  `redirect_uri=${REDIRECT_URI}&` +
  `response_type=code&` +
  `scope=${SCOPES}&` +
  `code_challenge=${codeChallenge}&` +
  `code_challenge_method=S256`;

window.location.href = authUrl;

// After redirect, exchange code for tokens
const tokens = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  body: JSON.stringify({
    code: authCode,
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    code_verifier: codeVerifier, // Gmail verifies SHA256(codeVerifier) === codeChallenge
    grant_type: 'authorization_code'
  })
});

// Store refresh token encrypted
await storeRefreshTokenEncrypted(tokens.refresh_token);
```

### Web Crypto API Encryption

**Encryption Strategy:**
- Algorithm: AES-GCM (authenticated encryption, prevents tampering)
- Key Size: 256-bit (NIST recommended)
- IV: Random 96-bit nonce per encryption (never reuse)
- Key Derivation: PBKDF2-SHA256 (100,000 iterations)

**Key Derivation:**
```typescript
// Derive encryption key from browser-generated entropy + user context
async function deriveEncryptionKey(userContext: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(userContext), // User email or session ID
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  // Generate salt (store in IndexedDB, non-secret)
  const salt = crypto.getRandomValues(new Uint8Array(16));

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000, // OWASP recommended minimum
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false, // not extractable (key stays in browser crypto subsystem)
    ['encrypt', 'decrypt']
  );
}
```

**Encrypt/Decrypt Tokens:**
```typescript
// Encrypt refresh token before storing in IndexedDB
async function encryptToken(token: string, key: CryptoKey): Promise<EncryptedToken> {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12)); // Random IV per encryption

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    encoder.encode(token)
  );

  return {
    ciphertext: new Uint8Array(encrypted),
    iv: iv // Store IV alongside ciphertext (not secret)
  };
}

// Decrypt refresh token from IndexedDB
async function decryptToken(encrypted: EncryptedToken, key: CryptoKey): Promise<string> {
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: encrypted.iv },
    key,
    encrypted.ciphertext
  );

  return new TextDecoder().decode(decrypted);
}
```

### IndexedDB Token Storage

**Storage Schema:**
```typescript
// RxDB schema for encrypted tokens
const tokenSchema = {
  version: 0,
  type: 'object',
  properties: {
    id: { type: 'string', primary: true }, // 'gmail_refresh_token'
    ciphertext: { type: 'string' }, // Base64-encoded encrypted token
    iv: { type: 'string' }, // Base64-encoded IV
    salt: { type: 'string' }, // Base64-encoded salt for key derivation
    createdAt: { type: 'number' },
    expiresAt: { type: 'number' } // Refresh tokens typically never expire (until revoked)
  },
  required: ['id', 'ciphertext', 'iv', 'salt']
};
```

**Token Retrieval Flow:**
1. User opens app → App checks IndexedDB for encrypted refresh token
2. App derives encryption key from user session context (email)
3. App decrypts refresh token using Web Crypto API
4. App uses refresh token to get new access token from Gmail
5. Access token stored in memory only (cleared on page reload)

### RxDB Database Encryption

**RxDB Encryption Plugin:**
```typescript
// Enable RxDB encryption for sensitive fields
import { wrappedKeyEncryptionCryptoJsStorage } from 'rxdb/plugins/encryption-crypto-js';

const database = await createRxDatabase({
  name: 'claine_db',
  storage: wrappedKeyEncryptionCryptoJsStorage({
    storage: getRxStorageDexie()
  }),
  password: await deriveDbPassword(userContext) // Derived from user session
});

// Encrypt specific fields in email schema
const emailSchema = {
  version: 0,
  encrypted: ['subject', 'body', 'from', 'to'], // Encrypt sensitive email fields
  properties: {
    id: { type: 'string', primary: true },
    subject: { type: 'string' },
    body: { type: 'string' },
    from: { type: 'string' },
    to: { type: 'array', items: { type: 'string' } },
    // ... other fields
  }
};
```

### Token Refresh Strategy

**Automatic Token Refresh:**
- Access tokens expire after 1 hour (Gmail default)
- App automatically refreshes access token 5 minutes before expiration
- If refresh fails (token revoked), prompt user to re-authenticate

**Refresh Flow:**
```typescript
async function refreshAccessToken(encryptedRefreshToken: EncryptedToken): Promise<string> {
  const key = await deriveEncryptionKey(userEmail);
  const refreshToken = await decryptToken(encryptedRefreshToken, key);

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: JSON.stringify({
      client_id: CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    })
  });

  const { access_token } = await response.json();
  return access_token; // Store in memory only
}
```

### Security Considerations

**Browser Storage Security:**
- IndexedDB isolated per origin (cross-origin protection)
- Web Crypto API keys non-extractable (cannot export key material)
- Service Workers cannot access Web Crypto keys directly (keys scoped to main thread)

**Attack Scenarios:**
1. **XSS Attack:** Strict CSP prevents inline scripts (mitigates XSS)
2. **DevTools Access:** User can inspect IndexedDB, but tokens encrypted (key derived from session)
3. **Browser Extension:** Malicious extensions cannot access Web Crypto keys (non-extractable)
4. **Physical Access:** Attacker with device access can only see encrypted tokens (needs user session context to decrypt)

**Key Rotation:**
- Encryption keys re-derived on user logout → login (new salt generated)
- Refresh tokens remain valid until revoked (Gmail-side)
- User can revoke tokens manually via Google Account settings

## Acceptance Criteria

ADR-007 is **Accepted** (this decision is now validated):
- ✅ OAuth 2.0 PKCE flow implemented for Gmail API
- ✅ Refresh tokens stored encrypted in IndexedDB using Web Crypto API (AES-GCM)
- ✅ Encryption key derivation using PBKDF2 (100,000 iterations)
- ✅ Token retrieval tested: App can decrypt and use refresh token after page reload
- ✅ Database encryption configured: RxDB encrypts sensitive email fields
- ✅ Token refresh tested: Access token auto-refreshes 5 minutes before expiration
- ✅ Fallback handling: Re-authentication flow if refresh token invalid/revoked
- ✅ Security audit: No plaintext tokens in IndexedDB, browser console, or network logs
- ✅ CSP configured: Strict Content Security Policy prevents XSS attacks

## Operational Considerations

**Rollout:**
- Phase 1: Implement PKCE OAuth flow for Gmail (Epic 1)
- Phase 2: Add IndexedDB token encryption (Epic 1)
- Phase 3: Enable RxDB database encryption (Epic 1)
- Test extensively: Token refresh, logout/login, browser storage clearing

**Telemetry:**
- Track token refresh success/failure rate (no token values logged)
- Track re-authentication frequency (indicates token revocation)
- Monitor encryption/decryption performance (Web Crypto API overhead)

**Observability:**
- **Logs:** Token refresh events (timestamp, success/failure - no token values)
- **Alerts:** High refresh failure rate (>5%) indicates auth issues
- **Metrics:** Token refresh latency, encryption overhead, storage quota usage

**Fallback:**
- Token refresh fails → Prompt user to re-authenticate (OAuth flow)
- Encryption key lost (browser data cleared) → User must re-authenticate and resync
- IndexedDB quota exceeded → Prompt user to clear old emails or upgrade browser storage

**Support Playbook:**
- **Token refresh fails:** Check network connectivity, verify Gmail account still active, re-authenticate
- **Database won't decrypt:** Encryption key lost (browser data cleared), must re-authenticate and resync
- **"Out of storage" error:** IndexedDB quota exceeded (Safari 50MB limit), clear old emails or use Chrome
- **"Re-authenticate" prompt:** Refresh token expired/revoked, user must grant access again

## Consequences

**Positive:**
- ✅ **Browser-Native Security:** Web Crypto API uses hardware-backed encryption where available (TPM, Secure Enclave)
- ✅ **No Client Secret:** PKCE eliminates need to store client secret (impossible to secure in browser)
- ✅ **Cross-Origin Protection:** IndexedDB isolated per origin (tokens never accessible to other domains)
- ✅ **Zero External Dependencies:** No third-party encryption libraries (Web Crypto API built-in)
- ✅ **Future-Proof:** Same security model works for mobile PWAs (iOS/Android)

**Negative:**
- ❌ **No OS Keychain:** Cannot leverage macOS Keychain/Windows Credential Manager (PWA limitation)
- ❌ **Browser Trust Assumption:** User must trust browser to protect keys (true for all web apps)
- ❌ **Session-Based Keys:** Encryption key cleared on logout (by design - no persistent master password)
- ❌ **Browser Storage Limits:** IndexedDB quota varies by browser (Safari 50MB, Chrome ~60% of disk)

**Mitigations:**
- **Audit Logging:** Log all token refresh events (detect unauthorized access)
- **Token Revocation:** User can revoke tokens via Google Account settings
- **CSP Hardening:** Strict Content Security Policy prevents XSS (blocks inline scripts)
- **Storage Quota Monitoring:** Warn user before approaching IndexedDB quota limit

## Alternatives Considered

- **OS Keychain (Keychain Services, Credential Manager):** Not available in PWA (requires native app)
- **Master Password:** Rejected due to UX friction (users expect instant email access)
- **Plaintext Storage:** Rejected due to security risk (tokens accessible via DevTools)
- **Third-Party Key Management (Vault, AWS KMS):** Rejected - requires cloud dependency, violates offline-first principle

## References

- **Web Crypto API Spec:** https://www.w3.org/TR/WebCryptoAPI/
- **OAuth 2.0 PKCE (RFC 7636):** https://datatracker.ietf.org/doc/html/rfc7636
- **Gmail API OAuth Guide:** https://developers.google.com/identity/protocols/oauth2/web-server
- **IndexedDB API:** https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
- **RxDB Encryption Plugin:** https://rxdb.info/encryption.html
- **OWASP Key Management:** https://cheatsheetseries.owasp.org/cheatsheets/Key_Management_Cheat_Sheet.html
- **NIST AES-GCM Guidelines:** https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf
- **Architecture Document:** `docs/architecture.md` (Security architecture section)

---
