/**
 * Outlook OAuth Service Tests
 * Tests for Microsoft Graph OAuth 2.0 implementation with PKCE
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { OutlookOAuthService } from '../outlookOAuth'
import type { OAuthTokens, OAuthError } from '../types'

describe('OutlookOAuthService', () => {
  beforeEach(() => {
    // Mock sessionStorage
    global.sessionStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0,
    }

    // Mock window.location
    delete (window as { location?: Location }).location
    window.location = { href: '' } as Location
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Configuration', () => {
    it('should initialize with valid configuration', () => {
      const service = new OutlookOAuthService()
      const config = service.getConfig()

      expect(config.clientId).toBe('test-microsoft-client-id')
      expect(config.redirectUri).toBe('http://localhost:5173/auth/callback')
      expect(config.scopes).toEqual(['Mail.Read', 'Mail.Send', 'offline_access'])
      expect(config.authorizationEndpoint).toContain('login.microsoftonline.com')
      expect(config.tokenEndpoint).toContain('login.microsoftonline.com')
    })

    it('should not expose client secret in getConfig', () => {
      const service = new OutlookOAuthService()
      const config = service.getConfig()

      expect(config).not.toHaveProperty('clientSecret')
    })

    // Skipping environment validation tests as they require module-level mocking
    // The actual validation logic is tested through the constructor of the service above
  })

  describe('Authorization URL Generation', () => {
    it('should initiate auth and redirect to Microsoft consent screen', async () => {
      const service = new OutlookOAuthService()

      // Mock crypto and sessionStorage
      vi.spyOn(crypto, 'getRandomValues').mockImplementation((arr: Uint8Array) => {
        arr.fill(65) // Fill with 'A' character
        return arr
      })

      const setItemSpy = vi.spyOn(sessionStorage, 'setItem')

      // Prevent actual redirect
      const originalLocation = window.location.href
      Object.defineProperty(window.location, 'href', {
        writable: true,
        value: originalLocation,
      })

      let redirectUrl = ''
      Object.defineProperty(window.location, 'href', {
        set: (url: string) => {
          redirectUrl = url
        },
        get: () => redirectUrl,
      })

      await service.initiateAuth()

      // Verify redirect URL structure
      expect(redirectUrl).toContain('login.microsoftonline.com')
      expect(redirectUrl).toContain('client_id=test-microsoft-client-id')
      expect(redirectUrl).toContain('redirect_uri=')
      expect(redirectUrl).toContain('response_type=code')
      // URL encoding can use either + or %20 for spaces, both are valid
      expect(
        redirectUrl.includes('scope=Mail.Read+Mail.Send+offline_access') ||
          redirectUrl.includes('scope=Mail.Read%20Mail.Send%20offline_access')
      ).toBe(true)
      expect(redirectUrl).toContain('code_challenge=')
      expect(redirectUrl).toContain('code_challenge_method=S256')
      expect(redirectUrl).toContain('state=')
      expect(redirectUrl).toContain('response_mode=query')
      expect(redirectUrl).toContain('prompt=consent')

      // Verify sessionStorage was used
      expect(setItemSpy).toHaveBeenCalled()
    })
  })

  describe('Callback Handling', () => {
    it('should handle successful callback with code and state', () => {
      const service = new OutlookOAuthService()
      const callbackUrl = 'http://localhost:5173/auth/callback?code=test-code&state=test-state'

      const result = service.handleCallback(callbackUrl)

      expect(result.code).toBe('test-code')
      expect(result.state).toBe('test-state')
    })

    it('should throw error when authorization code is missing', () => {
      const service = new OutlookOAuthService()
      const callbackUrl = 'http://localhost:5173/auth/callback?state=test-state'

      expect(() => service.handleCallback(callbackUrl)).toThrow(
        'Missing authorization code in callback'
      )
    })

    it('should throw error when state is missing', () => {
      const service = new OutlookOAuthService()
      const callbackUrl = 'http://localhost:5173/auth/callback?code=test-code'

      expect(() => service.handleCallback(callbackUrl)).toThrow(
        'Missing state parameter in callback'
      )
    })

    it('should handle consent_required error', () => {
      const service = new OutlookOAuthService()
      const callbackUrl =
        'http://localhost:5173/auth/callback?error=consent_required&error_description=User+consent+required'

      expect(() => service.handleCallback(callbackUrl)).toThrow(
        'User consent required. Please authorize the application.'
      )
    })

    it('should handle interaction_required error', () => {
      const service = new OutlookOAuthService()
      const callbackUrl =
        'http://localhost:5173/auth/callback?error=interaction_required&error_description=MFA+required'

      expect(() => service.handleCallback(callbackUrl)).toThrow(
        'Additional authentication required (MFA or conditional access policy)'
      )
    })

    it('should handle invalid_client error', () => {
      const service = new OutlookOAuthService()
      const callbackUrl =
        'http://localhost:5173/auth/callback?error=invalid_client&error_description=Invalid+client'

      expect(() => service.handleCallback(callbackUrl)).toThrow(
        'Invalid client configuration. Please check your Microsoft Graph credentials.'
      )
    })

    it('should handle generic OAuth errors', () => {
      const service = new OutlookOAuthService()
      const callbackUrl =
        'http://localhost:5173/auth/callback?error=server_error&error_description=Internal+server+error'

      expect(() => service.handleCallback(callbackUrl)).toThrow(
        'OAuth error: server_error - Internal server error'
      )
    })
  })

  describe('Token Exchange', () => {
    it('should exchange code for tokens successfully', async () => {
      const service = new OutlookOAuthService()

      // Mock sessionStorage
      vi.spyOn(sessionStorage, 'getItem').mockImplementation((key: string) => {
        if (key === 'oauth_state') return 'test-state'
        if (key === 'pkce_test-state')
          return JSON.stringify({
            code_verifier: 'test-verifier',
            code_challenge: 'test-challenge',
            code_challenge_method: 'S256',
          })
        return null
      })

      const mockTokens: OAuthTokens = {
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'Mail.Read Mail.Send',
      }

      // Mock fetch
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockTokens,
      })

      const tokens = await service.exchangeCodeForTokens('test-code', 'test-state')

      expect(tokens).toEqual(mockTokens)
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('login.microsoftonline.com'),
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        })
      )
    })

    it('should throw error on invalid state (CSRF protection)', async () => {
      const service = new OutlookOAuthService()

      vi.spyOn(sessionStorage, 'getItem').mockImplementation((key: string) => {
        if (key === 'oauth_state') return 'correct-state'
        return null
      })

      await expect(service.exchangeCodeForTokens('test-code', 'wrong-state')).rejects.toThrow(
        'Invalid state parameter (possible CSRF attack)'
      )
    })

    it('should throw error when PKCE verifier not found', async () => {
      const service = new OutlookOAuthService()

      vi.spyOn(sessionStorage, 'getItem').mockImplementation((key: string) => {
        if (key === 'oauth_state') return 'test-state'
        return null // No PKCE pair
      })

      await expect(service.exchangeCodeForTokens('test-code', 'test-state')).rejects.toThrow(
        'PKCE code verifier not found (session may have expired)'
      )
    })

    it('should handle invalid_grant error during token exchange', async () => {
      const service = new OutlookOAuthService()

      vi.spyOn(sessionStorage, 'getItem').mockImplementation((key: string) => {
        if (key === 'oauth_state') return 'test-state'
        if (key === 'pkce_test-state')
          return JSON.stringify({
            code_verifier: 'test-verifier',
            code_challenge: 'test-challenge',
            code_challenge_method: 'S256',
          })
        return null
      })

      const mockError: OAuthError = {
        error: 'invalid_grant',
        error_description: 'Authorization code expired',
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => mockError,
      })

      await expect(service.exchangeCodeForTokens('test-code', 'test-state')).rejects.toThrow(
        'Authorization code expired or invalid. Please try again.'
      )
    })

    it('should handle invalid_client error during token exchange', async () => {
      const service = new OutlookOAuthService()

      vi.spyOn(sessionStorage, 'getItem').mockImplementation((key: string) => {
        if (key === 'oauth_state') return 'test-state'
        if (key === 'pkce_test-state')
          return JSON.stringify({
            code_verifier: 'test-verifier',
            code_challenge: 'test-challenge',
            code_challenge_method: 'S256',
          })
        return null
      })

      const mockError: OAuthError = {
        error: 'invalid_client',
        error_description: 'Client authentication failed',
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => mockError,
      })

      await expect(service.exchangeCodeForTokens('test-code', 'test-state')).rejects.toThrow(
        'Invalid client credentials. Please check your Microsoft Graph configuration.'
      )
    })

    it('should handle network errors during token exchange', async () => {
      const service = new OutlookOAuthService()

      vi.spyOn(sessionStorage, 'getItem').mockImplementation((key: string) => {
        if (key === 'oauth_state') return 'test-state'
        if (key === 'pkce_test-state')
          return JSON.stringify({
            code_verifier: 'test-verifier',
            code_challenge: 'test-challenge',
            code_challenge_method: 'S256',
          })
        return null
      })

      global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))

      await expect(service.exchangeCodeForTokens('test-code', 'test-state')).rejects.toThrow(
        'Network error during token exchange. Please check your connection.'
      )
    })
  })

  describe('Token Refresh', () => {
    it('should refresh access token successfully', async () => {
      const service = new OutlookOAuthService()

      const mockTokens: OAuthTokens = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'Mail.Read Mail.Send',
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockTokens,
      })

      const tokens = await service.refreshAccessToken('old-refresh-token')

      expect(tokens).toEqual(mockTokens)
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('login.microsoftonline.com'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('refresh_token=old-refresh-token'),
        })
      )
    })

    it('should handle invalid_grant error during token refresh', async () => {
      const service = new OutlookOAuthService()

      const mockError: OAuthError = {
        error: 'invalid_grant',
        error_description: 'Refresh token expired',
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => mockError,
      })

      await expect(service.refreshAccessToken('expired-refresh-token')).rejects.toThrow(
        'Refresh token expired. User must re-authenticate.'
      )
    })

    it('should handle consent_required error during token refresh', async () => {
      const service = new OutlookOAuthService()

      const mockError: OAuthError = {
        error: 'consent_required',
        error_description: 'Consent revoked',
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => mockError,
      })

      await expect(service.refreshAccessToken('old-refresh-token')).rejects.toThrow(
        'User consent expired. Re-authentication required.'
      )
    })

    it('should handle interaction_required error during token refresh', async () => {
      const service = new OutlookOAuthService()

      const mockError: OAuthError = {
        error: 'interaction_required',
        error_description: 'MFA required',
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: async () => mockError,
      })

      await expect(service.refreshAccessToken('old-refresh-token')).rejects.toThrow(
        'Additional authentication required. User must re-authenticate.'
      )
    })

    it('should handle network errors during token refresh', async () => {
      const service = new OutlookOAuthService()

      global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))

      await expect(service.refreshAccessToken('old-refresh-token')).rejects.toThrow(
        'Network error during token refresh. Please check your connection.'
      )
    })
  })

  describe('Security', () => {
    it('should use PKCE (code_challenge_method=S256)', async () => {
      const service = new OutlookOAuthService()

      let redirectUrl = ''
      Object.defineProperty(window.location, 'href', {
        set: (url: string) => {
          redirectUrl = url
        },
        get: () => redirectUrl,
      })

      await service.initiateAuth()

      expect(redirectUrl).toContain('code_challenge_method=S256')
      expect(redirectUrl).toContain('code_challenge=')
    })

    it('should generate cryptographically secure state', async () => {
      const service = new OutlookOAuthService()

      let redirectUrl = ''
      Object.defineProperty(window.location, 'href', {
        set: (url: string) => {
          redirectUrl = url
        },
        get: () => redirectUrl,
      })

      await service.initiateAuth()

      const url = new URL(redirectUrl)
      const state = url.searchParams.get('state')

      expect(state).toBeTruthy()
      expect(state?.length).toBeGreaterThan(40) // 256 bits base64url encoded
    })

    it('should force consent screen to ensure refresh token', async () => {
      const service = new OutlookOAuthService()

      let redirectUrl = ''
      Object.defineProperty(window.location, 'href', {
        set: (url: string) => {
          redirectUrl = url
        },
        get: () => redirectUrl,
      })

      await service.initiateAuth()

      expect(redirectUrl).toContain('prompt=consent')
    })
  })
})
