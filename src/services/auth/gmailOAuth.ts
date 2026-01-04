/**
 * Gmail OAuth 2.0 Service with PKCE
 * Implements OAuth 2.0 Authorization Code Flow with PKCE for Gmail API access
 *
 * Flow:
 * 1. User clicks "Connect Gmail" → `initiateAuth()`
 * 2. Generate PKCE pair, store code_verifier
 * 3. Redirect to Google consent screen
 * 4. User authorizes → Google redirects back with authorization code
 * 5. Exchange code for tokens → `exchangeCodeForTokens()`
 * 6. Encrypt and store tokens in IndexedDB
 * 7. Token refresh happens automatically via TokenRefreshService
 */

import { generatePKCEPair } from './pkce'
import type { OAuthConfig, OAuthTokens, OAuthError, PKCEPair, AuthorizationParams } from './types'

/**
 * Google OAuth 2.0 endpoints
 */
const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'

/**
 * Gmail OAuth 2.0 Service
 * Manages OAuth 2.0 flow for Gmail API access
 */
export class GmailOAuthService {
  private config: OAuthConfig
  private activePKCE: Map<string, PKCEPair> = new Map() // Maps state → PKCE pair

  constructor() {
    // Load configuration from environment variables
    this.config = {
      clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
      clientSecret: import.meta.env.VITE_GOOGLE_CLIENT_SECRET || '',
      redirectUri: import.meta.env.VITE_GOOGLE_REDIRECT_URI || '',
      scopes: (import.meta.env.VITE_GOOGLE_SCOPES || '').split(' ').filter(Boolean),
      authorizationEndpoint: GOOGLE_AUTH_ENDPOINT,
      tokenEndpoint: GOOGLE_TOKEN_ENDPOINT,
    }

    this.validateConfig()
  }

  /**
   * Validates OAuth configuration
   * @throws Error if required configuration is missing
   */
  private validateConfig(): void {
    if (!this.config.clientId) {
      throw new Error('Missing VITE_GOOGLE_CLIENT_ID environment variable')
    }
    // clientSecret is optional for public clients using PKCE
    if (!this.config.redirectUri) {
      throw new Error('Missing VITE_GOOGLE_REDIRECT_URI environment variable')
    }
    if (this.config.scopes.length === 0) {
      throw new Error('Missing VITE_GOOGLE_SCOPES environment variable')
    }
  }

  /**
   * Initiates OAuth 2.0 authorization flow
   * Generates PKCE pair, creates authorization URL, and redirects user
   *
   * @returns Promise that resolves when redirect begins (never actually resolves due to redirect)
   * @throws Error if configuration is invalid or PKCE generation fails
   *
   * @example
   * ```typescript
   * await gmailOAuthService.initiateAuth()
   * // User will be redirected to Google consent screen
   * ```
   */
  async initiateAuth(): Promise<void> {
    // Generate PKCE pair
    const pkcePair = await generatePKCEPair()

    // Generate random state for CSRF protection
    const state = this.generateState()

    // Store PKCE pair associated with this state
    this.activePKCE.set(state, pkcePair)

    // Also store in sessionStorage for recovery after redirect
    sessionStorage.setItem(`pkce_${state}`, JSON.stringify(pkcePair))
    sessionStorage.setItem('oauth_state', state)

    // Build authorization URL
    const authUrl = this.buildAuthorizationUrl(pkcePair, state)

    // Redirect to Google consent screen
    window.location.href = authUrl
  }

  /**
   * Builds OAuth 2.0 authorization URL with PKCE parameters
   *
   * @param pkcePair - PKCE code verifier and challenge
   * @param state - Random state for CSRF protection
   * @returns Complete authorization URL
   */
  private buildAuthorizationUrl(pkcePair: PKCEPair, state: string): string {
    const params: AuthorizationParams = {
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: this.config.scopes.join(' '),
      code_challenge: pkcePair.code_challenge,
      code_challenge_method: 'S256',
      state,
      access_type: 'offline', // Request refresh token
      prompt: 'consent', // Force consent screen to ensure refresh token
    }

    const searchParams = new URLSearchParams(params as Record<string, string>)
    return `${this.config.authorizationEndpoint}?${searchParams.toString()}`
  }

  /**
   * Handles OAuth callback after user authorization
   * Extracts authorization code and state from URL parameters
   *
   * @param callbackUrl - Full callback URL with query parameters
   * @returns Authorization code and state
   * @throws Error if callback contains error or missing required parameters
   *
   * @example
   * ```typescript
   * // On redirect URI page (e.g., /auth/callback)
   * const { code, state } = gmailOAuthService.handleCallback(window.location.href)
   * await gmailOAuthService.exchangeCodeForTokens(code, state)
   * ```
   */
  handleCallback(callbackUrl: string): { code: string; state: string } {
    const url = new URL(callbackUrl)
    const params = url.searchParams

    // Check for errors
    const error = params.get('error')
    if (error) {
      const errorDescription = params.get('error_description') || 'Unknown error'
      throw new Error(`OAuth error: ${error} - ${errorDescription}`)
    }

    // Extract code and state
    const code = params.get('code')
    const state = params.get('state')

    if (!code) {
      throw new Error('Missing authorization code in callback')
    }
    if (!state) {
      throw new Error('Missing state parameter in callback')
    }

    return { code, state }
  }

  /**
   * Exchanges authorization code for OAuth tokens
   * Validates PKCE code verifier and exchanges code with Google
   *
   * @param code - Authorization code from callback
   * @param state - State parameter from callback (for CSRF protection)
   * @returns OAuth tokens (access_token, refresh_token, etc.)
   * @throws Error if state invalid, PKCE pair not found, or token exchange fails
   *
   * @example
   * ```typescript
   * const tokens = await gmailOAuthService.exchangeCodeForTokens(code, state)
   * // Store tokens securely in IndexedDB with encryption
   * ```
   */
  async exchangeCodeForTokens(code: string, state: string): Promise<OAuthTokens> {
    // Validate state (CSRF protection)
    const storedState = sessionStorage.getItem('oauth_state')
    if (state !== storedState) {
      throw new Error('Invalid state parameter (possible CSRF attack)')
    }

    // Retrieve PKCE pair
    const pkcePair = this.activePKCE.get(state)
    const storedPKCEStr = sessionStorage.getItem(`pkce_${state}`)
    const storedPKCE = storedPKCEStr ? (JSON.parse(storedPKCEStr) as PKCEPair) : null

    const codeVerifier = pkcePair?.code_verifier || storedPKCE?.code_verifier

    if (!codeVerifier) {
      throw new Error('PKCE code verifier not found (session may have expired)')
    }

    // Clean up stored PKCE and state
    this.activePKCE.delete(state)
    sessionStorage.removeItem(`pkce_${state}`)
    sessionStorage.removeItem('oauth_state')

    // Exchange code for tokens
    const tokens = await this.exchangeCode(code, codeVerifier)

    return tokens
  }

  /**
   * Exchanges authorization code for tokens using token endpoint
   *
   * @param code - Authorization code
   * @param codeVerifier - PKCE code verifier
   * @returns OAuth tokens
   * @throws Error if token exchange fails
   */
  private async exchangeCode(code: string, codeVerifier: string): Promise<OAuthTokens> {
    const params: Record<string, string> = {
      client_id: this.config.clientId,
      code,
      code_verifier: codeVerifier,
      redirect_uri: this.config.redirectUri,
      grant_type: 'authorization_code',
    }

    // Only include client_secret if provided (optional for public clients with PKCE)
    if (this.config.clientSecret) {
      params.client_secret = this.config.clientSecret
    }

    const response = await fetch(this.config.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params as Record<string, string>).toString(),
    })

    if (!response.ok) {
      const errorData: OAuthError = await response.json()
      throw new Error(
        `Token exchange failed: ${errorData.error} - ${errorData.error_description || 'Unknown error'}`
      )
    }

    const tokens: OAuthTokens = await response.json()
    return tokens
  }

  /**
   * Refreshes an access token using a refresh token
   *
   * @param refreshToken - Refresh token
   * @returns New OAuth tokens (access_token, possibly new refresh_token)
   * @throws Error if refresh fails
   *
   * @example
   * ```typescript
   * const newTokens = await gmailOAuthService.refreshAccessToken(oldRefreshToken)
   * // Update stored tokens with new values
   * ```
   */
  async refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
    const params: Record<string, string> = {
      client_id: this.config.clientId,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }

    // Only include client_secret if provided (optional for public clients with PKCE)
    if (this.config.clientSecret) {
      params.client_secret = this.config.clientSecret
    }

    const response = await fetch(this.config.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(params).toString(),
    })

    if (!response.ok) {
      const errorData: OAuthError = await response.json()

      // Handle specific error codes
      if (errorData.error === 'invalid_grant') {
        throw new Error('Refresh token expired. User must re-authenticate.')
      }

      throw new Error(
        `Token refresh failed: ${errorData.error} - ${errorData.error_description || 'Unknown error'}`
      )
    }

    const tokens: OAuthTokens = await response.json()
    return tokens
  }

  /**
   * Generates a cryptographically secure random state string
   * Used for CSRF protection in OAuth flow
   *
   * @returns Random state string (base64url-encoded)
   */
  private generateState(): string {
    const array = new Uint8Array(32) // 256 bits
    crypto.getRandomValues(array)

    // Convert to base64url
    const base64 = btoa(String.fromCharCode(...array))
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
  }

  /**
   * Gets the current OAuth configuration
   * Useful for debugging or UI display
   *
   * @returns OAuth configuration (client_secret redacted)
   */
  getConfig(): Omit<OAuthConfig, 'clientSecret'> {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { clientSecret, ...safeConfig } = this.config
    return safeConfig
  }
}

/**
 * Singleton instance of Gmail OAuth service
 * Use this instance throughout the application
 */
export const gmailOAuthService = new GmailOAuthService()
