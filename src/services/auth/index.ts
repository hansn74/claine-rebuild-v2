/**
 * OAuth 2.0 Authentication Services
 * Entry point for all authentication-related functionality
 *
 * Features:
 * - OAuth 2.0 Authorization Code Flow with PKCE
 * - AES-GCM 256-bit token encryption
 * - Automatic token refresh
 * - Secure token storage in IndexedDB (RxDB)
 *
 * Usage:
 * ```typescript
 * import { gmailOAuthService, tokenEncryptionService, tokenRefreshService } from '@/services/auth'
 *
 * // Initialize encryption
 * await tokenEncryptionService.initialize('user-session-password')
 *
 * // Start OAuth flow
 * await gmailOAuthService.initiateAuth()
 *
 * // Handle callback
 * const { code, state } = gmailOAuthService.handleCallback(window.location.href)
 * const tokens = await gmailOAuthService.exchangeCodeForTokens(code, state)
 *
 * // Store tokens securely
 * await tokenStorageService.storeTokens('user@gmail.com', tokens)
 *
 * // Start auto-refresh
 * tokenRefreshService.startScheduler()
 * ```
 */

// Core OAuth services
export { gmailOAuthService, GmailOAuthService } from './gmailOAuth'
export { outlookOAuthService, OutlookOAuthService } from './outlookOAuth'
export { tokenEncryptionService, TokenEncryptionService } from './tokenEncryption'
export { tokenStorageService, TokenStorageService } from './tokenStorage'
export { tokenRefreshService, TokenRefreshService } from './tokenRefresh'

// PKCE utilities
export { generatePKCEPair, generateCodeVerifier, generateCodeChallenge } from './pkce'

// Account management (with limit enforcement)
export {
  AccountLimitError,
  canAddAccount,
  connectGmailAccount,
  connectOutlookAccount,
  completeAccountConnection,
  disconnectAccount,
  getOAuthProvider,
  clearOAuthProvider,
} from './accountManager'

// Account loader
export { loadAccountsFromStorage } from './accountLoader'

// Types
export type {
  OAuthTokens,
  StoredTokens,
  EncryptedTokenData,
  PKCEPair,
  OAuthError,
  OAuthConfig,
  AuthState,
  AuthorizationParams,
  TokenRefreshParams,
  TokenExchangeParams,
} from './types'

// Re-export callback type
export type { TokenRefreshCallback } from './tokenRefresh'
