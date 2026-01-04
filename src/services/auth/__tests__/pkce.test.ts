/**
 * PKCE Utilities Tests
 * Tests for RFC 7636 PKCE implementation
 */

import { describe, it, expect } from 'vitest'
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generatePKCEPair,
  isValidCodeVerifier,
  base64UrlDecode,
} from '../pkce'

describe('PKCE Utilities', () => {
  describe('generateCodeVerifier', () => {
    it('should generate a code verifier with correct length', () => {
      const verifier = generateCodeVerifier()
      expect(verifier.length).toBeGreaterThanOrEqual(43)
      expect(verifier.length).toBeLessThanOrEqual(128)
    })

    it('should generate unique code verifiers', () => {
      const verifier1 = generateCodeVerifier()
      const verifier2 = generateCodeVerifier()
      expect(verifier1).not.toBe(verifier2)
    })

    it('should generate code verifier with valid characters', () => {
      const verifier = generateCodeVerifier()
      const validChars = /^[A-Za-z0-9\-._~]+$/
      expect(validChars.test(verifier)).toBe(true)
    })

    it('should pass RFC 7636 validation', () => {
      const verifier = generateCodeVerifier()
      expect(isValidCodeVerifier(verifier)).toBe(true)
    })
  })

  describe('generateCodeChallenge', () => {
    it('should generate a consistent challenge for the same verifier', async () => {
      const verifier = 'test-verifier-123'
      const challenge1 = await generateCodeChallenge(verifier)
      const challenge2 = await generateCodeChallenge(verifier)
      expect(challenge1).toBe(challenge2)
    })

    it('should generate different challenges for different verifiers', async () => {
      const verifier1 = 'test-verifier-123'
      const verifier2 = 'test-verifier-456'
      const challenge1 = await generateCodeChallenge(verifier1)
      const challenge2 = await generateCodeChallenge(verifier2)
      expect(challenge1).not.toBe(challenge2)
    })

    it('should generate base64url-encoded challenge', async () => {
      const verifier = 'test-verifier-123'
      const challenge = await generateCodeChallenge(verifier)

      // Base64url should not contain +, /, or =
      expect(challenge).not.toMatch(/[+/=]/)

      // Should contain valid base64url characters
      const validChars = /^[A-Za-z0-9\-_]+$/
      expect(validChars.test(challenge)).toBe(true)
    })

    it('should generate SHA-256 hash (32 bytes = ~43 chars base64url)', async () => {
      const verifier = 'test-verifier-123'
      const challenge = await generateCodeChallenge(verifier)

      // SHA-256 produces 32 bytes, base64url encodes to ~43 characters
      expect(challenge.length).toBe(43)
    })
  })

  describe('generatePKCEPair', () => {
    it('should generate a valid PKCE pair', async () => {
      const pair = await generatePKCEPair()

      expect(pair).toHaveProperty('code_verifier')
      expect(pair).toHaveProperty('code_challenge')
      expect(pair).toHaveProperty('code_challenge_method')
      expect(pair.code_challenge_method).toBe('S256')
    })

    it('should generate valid code verifier', async () => {
      const pair = await generatePKCEPair()
      expect(isValidCodeVerifier(pair.code_verifier)).toBe(true)
    })

    it('should generate code challenge from verifier', async () => {
      const pair = await generatePKCEPair()

      // Verify challenge matches verifier
      const expectedChallenge = await generateCodeChallenge(pair.code_verifier)
      expect(pair.code_challenge).toBe(expectedChallenge)
    })

    it('should generate unique pairs', async () => {
      const pair1 = await generatePKCEPair()
      const pair2 = await generatePKCEPair()

      expect(pair1.code_verifier).not.toBe(pair2.code_verifier)
      expect(pair1.code_challenge).not.toBe(pair2.code_challenge)
    })
  })

  describe('isValidCodeVerifier', () => {
    it('should validate correct length verifiers', () => {
      const validVerifier = 'a'.repeat(43) // Minimum length
      expect(isValidCodeVerifier(validVerifier)).toBe(true)

      const maxVerifier = 'a'.repeat(128) // Maximum length
      expect(isValidCodeVerifier(maxVerifier)).toBe(true)
    })

    it('should reject too short verifiers', () => {
      const shortVerifier = 'a'.repeat(42) // Too short
      expect(isValidCodeVerifier(shortVerifier)).toBe(false)
    })

    it('should reject too long verifiers', () => {
      const longVerifier = 'a'.repeat(129) // Too long
      expect(isValidCodeVerifier(longVerifier)).toBe(false)
    })

    it('should reject verifiers with invalid characters', () => {
      const invalidVerifier = 'test+verifier/with=invalid'
      expect(isValidCodeVerifier(invalidVerifier)).toBe(false)
    })

    it('should accept verifiers with valid characters', () => {
      const validVerifier = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
      expect(isValidCodeVerifier(validVerifier)).toBe(true)
    })
  })

  describe('base64UrlDecode', () => {
    it('should decode base64url strings', () => {
      const original = 'Hello, World!'
      const encoder = new TextEncoder()
      const bytes = encoder.encode(original)

      // Manual base64url encoding
      const base64 = btoa(String.fromCharCode(...bytes))
      const base64url = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')

      // Decode
      const decoded = base64UrlDecode(base64url)
      const decoder = new TextDecoder()
      const result = decoder.decode(decoded)

      expect(result).toBe(original)
    })

    it('should handle base64url without padding', () => {
      const base64url = 'SGVsbG8' // "Hello" in base64url (no padding)
      const decoded = base64UrlDecode(base64url)
      const decoder = new TextDecoder()
      const result = decoder.decode(decoded)

      expect(result).toBe('Hello')
    })
  })

  describe('End-to-End PKCE Flow', () => {
    it('should complete a full PKCE flow simulation', async () => {
      // 1. Client generates PKCE pair
      const pkcePair = await generatePKCEPair()

      // 2. Client sends code_challenge to authorization server
      expect(pkcePair.code_challenge).toBeTruthy()
      expect(pkcePair.code_challenge_method).toBe('S256')

      // 3. Authorization server would verify code_challenge
      // (simulated here by regenerating and comparing)
      const verifiedChallenge = await generateCodeChallenge(pkcePair.code_verifier)
      expect(verifiedChallenge).toBe(pkcePair.code_challenge)

      // 4. Client sends code_verifier to token endpoint
      // Server validates verifier matches original challenge
      expect(isValidCodeVerifier(pkcePair.code_verifier)).toBe(true)
    })
  })
})
