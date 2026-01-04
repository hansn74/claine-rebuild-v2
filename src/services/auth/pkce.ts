/**
 * PKCE (Proof Key for Code Exchange) Utilities
 * Implements RFC 7636 for OAuth 2.0 security in public clients
 *
 * PKCE adds security to OAuth 2.0 authorization code flow by:
 * 1. Generating a random code verifier (128 characters, high entropy)
 * 2. Creating a code challenge (SHA-256 hash of verifier)
 * 3. Sending challenge to authorization endpoint
 * 4. Sending verifier to token endpoint
 * 5. Server validates verifier matches original challenge
 *
 * This prevents authorization code interception attacks in public clients (SPAs, mobile apps)
 */

import type { PKCEPair } from './types'

/**
 * Generates a cryptographically secure random string for PKCE code verifier
 * Uses crypto.randomUUID() + additional random bytes for 128-bit entropy
 *
 * Per RFC 7636:
 * - code_verifier = high-entropy cryptographic random STRING using [A-Z] / [a-z] / [0-9] / "-" / "." / "_" / "~"
 * - Minimum length: 43 characters
 * - Maximum length: 128 characters
 *
 * @returns Random string suitable for PKCE code verifier (128 characters)
 */
export function generateCodeVerifier(): string {
  // Generate 96 random bytes (768 bits) for high entropy
  // Base64url encoding will produce ~128 characters
  const array = new Uint8Array(96)
  crypto.getRandomValues(array)

  // Convert to base64url format (URL-safe base64)
  // Base64url uses [A-Z][a-z][0-9]-_ (no +/= characters)
  return base64UrlEncode(array)
}

/**
 * Creates a PKCE code challenge from a code verifier
 * Uses SHA-256 hashing per RFC 7636
 *
 * Process:
 * 1. Hash the code verifier using SHA-256
 * 2. Base64url-encode the hash
 *
 * @param codeVerifier - The code verifier to hash
 * @returns Promise resolving to the base64url-encoded code challenge
 */
export async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  // Encode the code verifier as UTF-8 bytes
  const encoder = new TextEncoder()
  const data = encoder.encode(codeVerifier)

  // Hash using SHA-256 (produces 32 bytes)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)

  // Convert hash to base64url format
  const hashArray = new Uint8Array(hashBuffer)
  return base64UrlEncode(hashArray)
}

/**
 * Generates a complete PKCE pair (code verifier + code challenge)
 * This is the main function to use when starting an OAuth flow
 *
 * @returns Promise resolving to PKCEPair containing verifier, challenge, and method
 * @example
 * ```typescript
 * const pkcePair = await generatePKCEPair()
 * // Store pkcePair.code_verifier securely for token exchange
 * // Send pkcePair.code_challenge to authorization endpoint
 * ```
 */
export async function generatePKCEPair(): Promise<PKCEPair> {
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = await generateCodeChallenge(codeVerifier)

  return {
    code_verifier: codeVerifier,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256', // SHA-256 method
  }
}

/**
 * Converts a byte array to base64url encoding (URL-safe base64)
 * Base64url replaces + with -, / with _, and removes padding =
 *
 * @param buffer - Byte array to encode
 * @returns Base64url-encoded string
 */
function base64UrlEncode(buffer: Uint8Array): string {
  // Convert bytes to base64
  const base64 = btoa(String.fromCharCode(...buffer))

  // Convert to base64url format
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

/**
 * Decodes a base64url string to a byte array
 * Used for testing and verification
 *
 * @param base64url - Base64url-encoded string
 * @returns Byte array
 */
export function base64UrlDecode(base64url: string): Uint8Array {
  // Convert base64url to standard base64
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/')

  // Add padding if needed
  const padding = base64.length % 4
  if (padding > 0) {
    base64 += '='.repeat(4 - padding)
  }

  // Decode base64 to bytes
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }

  return bytes
}

/**
 * Validates a code verifier meets RFC 7636 requirements
 * Used for testing and validation
 *
 * @param codeVerifier - Code verifier to validate
 * @returns true if valid, false otherwise
 */
export function isValidCodeVerifier(codeVerifier: string): boolean {
  // Check length (43-128 characters)
  if (codeVerifier.length < 43 || codeVerifier.length > 128) {
    return false
  }

  // Check character set: [A-Za-z0-9\-._~]
  const validChars = /^[A-Za-z0-9\-._~]+$/
  return validChars.test(codeVerifier)
}
