/**
 * Mock OAuth Server Tests
 *
 * @tag @oauth
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  MockOAuthServer,
  OAuthMockError,
  createMockTokens,
  isCI,
  mockOAuthServer,
} from './mockOAuthServer'

describe('@oauth MockOAuthServer', () => {
  let server: MockOAuthServer

  beforeEach(() => {
    server = new MockOAuthServer()
    server.reset()
  })

  describe('authorize', () => {
    it('should return valid tokens for Google OAuth', async () => {
      const tokens = await server.authorize('auth_code', 'verifier', 'google')

      expect(tokens.access_token).toMatch(/^mock_access_google_/)
      expect(tokens.refresh_token).toMatch(/^mock_refresh_google_/)
      expect(tokens.token_type).toBe('Bearer')
      expect(tokens.expires_in).toBe(3600)
      expect(tokens.scope).toContain('gmail')
    })

    it('should return valid tokens for Microsoft OAuth', async () => {
      const tokens = await server.authorize('auth_code', 'verifier', 'microsoft')

      expect(tokens.access_token).toMatch(/^mock_access_microsoft_/)
      expect(tokens.refresh_token).toMatch(/^mock_refresh_microsoft_/)
      expect(tokens.scope).toContain('Mail.Read')
    })

    it('should respect configurable expiry', async () => {
      server.configure({ expiresIn: 60 })

      const tokens = await server.authorize('auth_code', 'verifier')

      expect(tokens.expires_in).toBe(60)
    })

    it('should exclude refresh token when configured', async () => {
      server.configure({ includeRefreshToken: false })

      const tokens = await server.authorize('auth_code', 'verifier')

      expect(tokens.refresh_token).toBeUndefined()
    })

    it('should include ID token by default', async () => {
      const tokens = await server.authorize('auth_code', 'verifier')

      expect(tokens.id_token).toBeDefined()
      expect(tokens.id_token).toContain('.')
    })

    it('should throw error when configured to fail', async () => {
      server.configure({ failAuthorize: true })

      await expect(server.authorize('auth_code', 'verifier')).rejects.toThrow(OAuthMockError)
    })

    it('should throw with custom error when configured', async () => {
      server.configure({
        failAuthorize: true,
        errorCode: 'access_denied',
        errorDescription: 'User denied access',
      })

      try {
        await server.authorize('auth_code', 'verifier')
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(OAuthMockError)
        const mockError = error as OAuthMockError
        expect(mockError.error).toBe('access_denied')
        expect(mockError.errorDescription).toBe('User denied access')
      }
    })

    it('should throw error for missing code', async () => {
      await expect(server.authorize('', 'verifier')).rejects.toThrow('Missing required parameters')
    })

    it('should throw error for missing verifier', async () => {
      await expect(server.authorize('code', '')).rejects.toThrow('Missing required parameters')
    })
  })

  describe('refresh', () => {
    it('should refresh tokens successfully', async () => {
      const initialTokens = await server.authorize('auth_code', 'verifier')
      const refreshedTokens = await server.refresh(initialTokens.refresh_token!)

      expect(refreshedTokens.access_token).toMatch(/^mock_access_/)
      expect(refreshedTokens.access_token).not.toBe(initialTokens.access_token)
      expect(refreshedTokens.token_type).toBe('Bearer')
    })

    it('should throw error for invalid refresh token', async () => {
      await expect(server.refresh('invalid_token')).rejects.toThrow('Invalid refresh token')
    })

    it('should throw error when configured to fail refresh', async () => {
      const initialTokens = await server.authorize('auth_code', 'verifier')

      server.configure({ failRefresh: true })

      await expect(server.refresh(initialTokens.refresh_token!)).rejects.toThrow(OAuthMockError)
    })
  })

  describe('validateAccessToken', () => {
    it('should validate valid tokens', async () => {
      const tokens = await server.authorize('auth_code', 'verifier')

      expect(server.validateAccessToken(tokens.access_token)).toBe(true)
    })

    it('should reject unknown tokens', () => {
      expect(server.validateAccessToken('unknown_token')).toBe(false)
    })

    it('should reject expired tokens', async () => {
      server.configure({ expiresIn: 1 })
      const tokens = await server.authorize('auth_code', 'verifier')

      // Wait for token to expire
      await new Promise((resolve) => setTimeout(resolve, 1100))

      expect(server.validateAccessToken(tokens.access_token)).toBe(false)
    })
  })

  describe('revokeToken', () => {
    it('should revoke refresh tokens', async () => {
      const tokens = await server.authorize('auth_code', 'verifier')

      expect(server.getActiveTokenCount()).toBe(1)

      await server.revokeToken(tokens.refresh_token!)

      expect(server.getActiveTokenCount()).toBe(0)
      await expect(server.refresh(tokens.refresh_token!)).rejects.toThrow('Invalid refresh token')
    })
  })

  describe('expireAllTokens', () => {
    it('should expire all tokens', async () => {
      const tokens = await server.authorize('auth_code', 'verifier')

      expect(server.validateAccessToken(tokens.access_token)).toBe(true)

      server.expireAllTokens()

      expect(server.validateAccessToken(tokens.access_token)).toBe(false)
    })
  })

  describe('reset', () => {
    it('should clear all state', async () => {
      server.configure({ expiresIn: 60 })
      await server.authorize('auth_code', 'verifier')

      server.reset()

      expect(server.getActiveTokenCount()).toBe(0)
    })
  })
})

describe('@oauth OAuthMockError', () => {
  it('should create error with code and description', () => {
    const error = new OAuthMockError('invalid_grant', 'Token expired')

    expect(error.error).toBe('invalid_grant')
    expect(error.errorDescription).toBe('Token expired')
    expect(error.message).toBe('invalid_grant: Token expired')
  })

  it('should convert to response format', () => {
    const error = new OAuthMockError('access_denied', 'User denied')
    const response = error.toResponse()

    expect(response.error).toBe('access_denied')
    expect(response.error_description).toBe('User denied')
  })
})

describe('@oauth createMockTokens helper', () => {
  it('should create mock tokens for Google', () => {
    const tokens = createMockTokens('account-1', 'google')

    expect(tokens.access_token).toContain('google')
    expect(tokens.access_token).toContain('account-1')
    expect(tokens.refresh_token).toContain('google')
    expect(tokens.scope).toContain('gmail')
  })

  it('should create mock tokens for Microsoft', () => {
    const tokens = createMockTokens('account-1', 'microsoft')

    expect(tokens.access_token).toContain('microsoft')
    expect(tokens.scope).toContain('Mail.Read')
  })

  it('should respect options', () => {
    const tokens = createMockTokens('account-1', 'google', {
      expiresIn: 60,
      includeRefreshToken: false,
    })

    expect(tokens.expires_in).toBe(60)
    expect(tokens.refresh_token).toBeUndefined()
  })
})

describe('@oauth isCI helper', () => {
  it('should detect CI environment', () => {
    // This test runs in the actual environment
    // Just verify it returns a boolean
    expect(typeof isCI()).toBe('boolean')
  })
})

describe('@oauth Global mockOAuthServer instance', () => {
  it('should be a MockOAuthServer instance', () => {
    expect(mockOAuthServer).toBeInstanceOf(MockOAuthServer)
  })

  it('should be reusable across tests', async () => {
    mockOAuthServer.reset()

    const tokens = await mockOAuthServer.authorize('code', 'verifier')
    expect(tokens.access_token).toBeDefined()

    mockOAuthServer.reset()
  })
})
