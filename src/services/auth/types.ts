/**
 * OAuth 2.0 and Authentication Type Definitions
 * Defines interfaces for OAuth tokens, PKCE pairs, and authentication state
 */

/**
 * OAuth 2.0 tokens returned from Google's token endpoint
 */
export interface OAuthTokens {
  /** Access token for API requests */
  access_token: string
  /** Token type (usually "Bearer") */
  token_type: string
  /** Expiration time in seconds from now */
  expires_in: number
  /** Refresh token for obtaining new access tokens */
  refresh_token?: string
  /** ID token containing user information */
  id_token?: string
  /** Scopes granted to this token */
  scope?: string
}

/**
 * Stored token information with metadata
 */
export interface StoredTokens extends OAuthTokens {
  /** ISO timestamp when tokens were obtained */
  obtained_at: string
  /** ISO timestamp when access token expires */
  expires_at: string
  /** Account identifier (email) */
  account_id: string
  /** Email provider (gmail or outlook) */
  provider?: 'gmail' | 'outlook'
}

/**
 * Encrypted token storage format
 */
export interface EncryptedTokenData {
  /** Base64-encoded encrypted data */
  ciphertext: string
  /** Base64-encoded initialization vector */
  iv: string
  /** Base64-encoded auth tag (included in ciphertext for AES-GCM) */
  tag: string
  /** Account identifier */
  account_id: string
  /** ISO timestamp when encrypted */
  encrypted_at: string
}

/**
 * PKCE (Proof Key for Code Exchange) code verifier and challenge pair
 */
export interface PKCEPair {
  /** Code verifier (random string, 128 characters) */
  code_verifier: string
  /** Code challenge (SHA-256 hash of verifier, base64url-encoded) */
  code_challenge: string
  /** Challenge method (always "S256" for SHA-256) */
  code_challenge_method: 'S256'
}

/**
 * OAuth error response from Google
 */
export interface OAuthError {
  /** Error code */
  error: string
  /** Human-readable error description */
  error_description?: string
  /** URI with more information about the error */
  error_uri?: string
}

/**
 * OAuth authorization request parameters
 */
export interface AuthorizationParams {
  /** OAuth client ID */
  client_id: string
  /** Redirect URI (must match registered URI) */
  redirect_uri: string
  /** Response type (always "code" for authorization code flow) */
  response_type: 'code'
  /** Requested scopes (space-separated) */
  scope: string
  /** PKCE code challenge */
  code_challenge: string
  /** PKCE code challenge method */
  code_challenge_method: 'S256'
  /** Random state for CSRF protection */
  state: string
  /** Access type ("offline" to get refresh token) */
  access_type: 'offline'
  /** Prompt type (controls consent screen) */
  prompt?: 'none' | 'consent' | 'select_account'
}

/**
 * OAuth token refresh request parameters
 */
export interface TokenRefreshParams {
  /** OAuth client ID */
  client_id: string
  /** OAuth client secret */
  client_secret: string
  /** Refresh token */
  refresh_token: string
  /** Grant type (always "refresh_token") */
  grant_type: 'refresh_token'
}

/**
 * OAuth token exchange request parameters
 */
export interface TokenExchangeParams {
  /** OAuth client ID */
  client_id: string
  /** OAuth client secret */
  client_secret: string
  /** Authorization code from redirect */
  code: string
  /** PKCE code verifier */
  code_verifier: string
  /** Redirect URI (must match authorization request) */
  redirect_uri: string
  /** Grant type (always "authorization_code") */
  grant_type: 'authorization_code'
}

/**
 * Authentication state for UI components
 */
export interface AuthState {
  /** Whether user is authenticated */
  isAuthenticated: boolean
  /** Whether authentication is in progress */
  isLoading: boolean
  /** Current authenticated user email */
  userEmail?: string
  /** Authentication error if any */
  error?: string
}

/**
 * Configuration for OAuth service
 */
export interface OAuthConfig {
  /** Google OAuth client ID */
  clientId: string
  /** Google OAuth client secret */
  clientSecret: string
  /** Redirect URI */
  redirectUri: string
  /** Requested scopes (array) */
  scopes: string[]
  /** Google authorization endpoint */
  authorizationEndpoint: string
  /** Google token endpoint */
  tokenEndpoint: string
}
