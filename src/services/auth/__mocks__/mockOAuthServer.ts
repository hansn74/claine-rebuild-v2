/**
 * Mock OAuth Server for CI Testing
 *
 * Simulates Google and Microsoft OAuth endpoints for testing OAuth flows
 * without making real API calls. Used in CI environments where real
 * credentials are not available.
 *
 * @tag @oauth
 */

import type { OAuthTokens } from '../types'

/**
 * Token configuration options for mock server
 */
export interface MockTokenConfig {
  /** Token expiry in seconds (default: 3600) */
  expiresIn?: number
  /** Whether to include refresh token (default: true) */
  includeRefreshToken?: boolean
  /** Whether to include ID token (default: true) */
  includeIdToken?: boolean
  /** Custom scopes to return */
  scopes?: string[]
  /** Simulate token refresh failure */
  failRefresh?: boolean
  /** Simulate authorization failure */
  failAuthorize?: boolean
  /** Custom error code for failures */
  errorCode?: string
  /** Custom error description */
  errorDescription?: string
}

/**
 * Token data stored in mock server
 */
interface TokenData {
  accessToken: string
  refreshToken: string
  expiresAt: number
  accountId: string
  provider: 'google' | 'microsoft'
}

/**
 * Mock OAuth Server
 *
 * Simulates OAuth 2.0 authorization code flow with PKCE for testing.
 * Supports both Google and Microsoft OAuth providers.
 *
 * @example
 * ```typescript
 * const mockServer = new MockOAuthServer()
 *
 * // Configure mock behavior
 * mockServer.configure({ expiresIn: 60 }) // Short expiry for testing refresh
 *
 * // Simulate authorization
 * const tokens = await mockServer.authorize('auth_code_123', 'verifier_123')
 *
 * // Simulate token refresh
 * const newTokens = await mockServer.refresh(tokens.refresh_token!)
 * ```
 */
export class MockOAuthServer {
  private tokens: Map<string, TokenData> = new Map()
  private config: MockTokenConfig = {}
  private tokenCounter = 0

  /**
   * Configure mock server behavior
   */
  configure(config: MockTokenConfig): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Reset server state and configuration
   */
  reset(): void {
    this.tokens.clear()
    this.config = {}
    this.tokenCounter = 0
  }

  /**
   * Simulate OAuth authorization code exchange
   *
   * @param code - Authorization code from redirect
   * @param codeVerifier - PKCE code verifier
   * @param provider - OAuth provider (google or microsoft)
   * @returns Token response
   */
  async authorize(
    code: string,
    codeVerifier: string,
    provider: 'google' | 'microsoft' = 'google'
  ): Promise<OAuthTokens> {
    // Simulate network delay
    await this.simulateDelay()

    // Check for configured failure
    if (this.config.failAuthorize) {
      throw new OAuthMockError(
        this.config.errorCode || 'invalid_grant',
        this.config.errorDescription || 'Authorization code has expired or is invalid'
      )
    }

    // Validate inputs (basic simulation)
    if (!code || !codeVerifier) {
      throw new OAuthMockError('invalid_request', 'Missing required parameters')
    }

    // Generate mock tokens
    const expiresIn = this.config.expiresIn ?? 3600
    const tokenId = ++this.tokenCounter
    const timestamp = Date.now()

    const accessToken = `mock_access_${provider}_${tokenId}_${timestamp}`
    const refreshToken = `mock_refresh_${provider}_${tokenId}_${timestamp}`
    const idToken =
      this.config.includeIdToken !== false ? this.generateMockIdToken(provider) : undefined

    // Store token data for refresh validation
    const tokenData: TokenData = {
      accessToken,
      refreshToken,
      expiresAt: timestamp + expiresIn * 1000,
      accountId: `mock-${provider}-account`,
      provider,
    }
    this.tokens.set(refreshToken, tokenData)

    const response: OAuthTokens = {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: expiresIn,
      scope: this.getScopes(provider),
    }

    if (this.config.includeRefreshToken !== false) {
      response.refresh_token = refreshToken
    }

    if (idToken) {
      response.id_token = idToken
    }

    return response
  }

  /**
   * Simulate OAuth token refresh
   *
   * @param refreshToken - Refresh token from previous authorization
   * @returns New token response
   */
  async refresh(refreshToken: string): Promise<OAuthTokens> {
    // Simulate network delay
    await this.simulateDelay()

    // Check for configured failure
    if (this.config.failRefresh) {
      throw new OAuthMockError(
        this.config.errorCode || 'invalid_grant',
        this.config.errorDescription || 'Refresh token has expired or been revoked'
      )
    }

    // Validate refresh token
    const tokenData = this.tokens.get(refreshToken)
    if (!tokenData) {
      throw new OAuthMockError('invalid_grant', 'Invalid refresh token')
    }

    // Generate new access token
    const expiresIn = this.config.expiresIn ?? 3600
    const tokenId = ++this.tokenCounter
    const timestamp = Date.now()
    const { provider } = tokenData

    const newAccessToken = `mock_access_${provider}_${tokenId}_${timestamp}`

    // Update stored token data
    tokenData.accessToken = newAccessToken
    tokenData.expiresAt = timestamp + expiresIn * 1000

    const response: OAuthTokens = {
      access_token: newAccessToken,
      token_type: 'Bearer',
      expires_in: expiresIn,
      scope: this.getScopes(provider),
    }

    // Optionally rotate refresh token
    if (this.shouldRotateRefreshToken()) {
      const newRefreshToken = `mock_refresh_${provider}_${tokenId}_${timestamp}`
      this.tokens.delete(refreshToken)
      this.tokens.set(newRefreshToken, tokenData)
      response.refresh_token = newRefreshToken
    }

    return response
  }

  /**
   * Validate an access token (for testing purposes)
   *
   * @param accessToken - Access token to validate
   * @returns Whether the token is valid and not expired
   */
  validateAccessToken(accessToken: string): boolean {
    for (const tokenData of this.tokens.values()) {
      if (tokenData.accessToken === accessToken) {
        return tokenData.expiresAt > Date.now()
      }
    }
    return false
  }

  /**
   * Revoke a refresh token (for testing logout flows)
   *
   * @param refreshToken - Refresh token to revoke
   */
  async revokeToken(refreshToken: string): Promise<void> {
    await this.simulateDelay()
    this.tokens.delete(refreshToken)
  }

  /**
   * Get the number of active tokens (for testing purposes)
   */
  getActiveTokenCount(): number {
    return this.tokens.size
  }

  /**
   * Force expire all tokens (for testing token refresh flows)
   */
  expireAllTokens(): void {
    for (const tokenData of this.tokens.values()) {
      tokenData.expiresAt = Date.now() - 1000
    }
  }

  /**
   * Generate a mock ID token (JWT-like string)
   */
  private generateMockIdToken(provider: 'google' | 'microsoft'): string {
    const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
    const payload = btoa(
      JSON.stringify({
        iss:
          provider === 'google'
            ? 'https://accounts.google.com'
            : 'https://login.microsoftonline.com',
        sub: `mock-subject-${Date.now()}`,
        email: `testuser@${provider === 'google' ? 'gmail.com' : 'outlook.com'}`,
        name: 'Test User',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      })
    )
    const signature = btoa('mock_signature')
    return `${header}.${payload}.${signature}`
  }

  /**
   * Get default scopes for provider
   */
  private getScopes(provider: 'google' | 'microsoft'): string {
    if (this.config.scopes) {
      return this.config.scopes.join(' ')
    }

    if (provider === 'google') {
      return 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send'
    }
    return 'Mail.Read Mail.Send offline_access'
  }

  /**
   * Simulate network delay for realistic testing
   */
  private async simulateDelay(): Promise<void> {
    const delay = Math.random() * 50 + 10 // 10-60ms delay
    await new Promise((resolve) => setTimeout(resolve, delay))
  }

  /**
   * Determine if refresh token should be rotated
   * Microsoft rotates refresh tokens, Google typically doesn't
   */
  private shouldRotateRefreshToken(): boolean {
    // 30% chance of rotation to simulate Microsoft behavior
    return Math.random() < 0.3
  }
}

/**
 * OAuth Mock Error for simulating error responses
 */
export class OAuthMockError extends Error {
  constructor(
    public readonly error: string,
    public readonly errorDescription: string
  ) {
    super(`${error}: ${errorDescription}`)
    this.name = 'OAuthMockError'
  }

  /**
   * Convert to OAuth error response format
   */
  toResponse(): { error: string; error_description: string } {
    return {
      error: this.error,
      error_description: this.errorDescription,
    }
  }
}

/**
 * Global mock server instance for use in tests
 */
export const mockOAuthServer = new MockOAuthServer()

/**
 * Helper to create mock tokens directly for unit tests
 * that don't need the full OAuth flow
 *
 * @param accountId - Account identifier
 * @param provider - OAuth provider
 * @param options - Token configuration
 */
export function createMockTokens(
  accountId: string,
  provider: 'google' | 'microsoft' = 'google',
  options: MockTokenConfig = {}
): OAuthTokens {
  const expiresIn = options.expiresIn ?? 3600
  const timestamp = Date.now()

  return {
    access_token: `mock_access_${provider}_${accountId}_${timestamp}`,
    token_type: 'Bearer',
    expires_in: expiresIn,
    refresh_token:
      options.includeRefreshToken !== false
        ? `mock_refresh_${provider}_${accountId}_${timestamp}`
        : undefined,
    scope:
      provider === 'google'
        ? 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send'
        : 'Mail.Read Mail.Send offline_access',
  }
}

/**
 * Helper to check if running in CI environment
 */
export function isCI(): boolean {
  return process.env.CI === 'true' || process.env.CI === '1' || !!process.env.GITHUB_ACTIONS
}
