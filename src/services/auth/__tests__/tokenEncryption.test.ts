/**
 * Token Encryption Service Tests
 * Tests for AES-GCM 256-bit encryption/decryption
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { TokenEncryptionService } from '../tokenEncryption'
import type { StoredTokens } from '../types'

describe('TokenEncryptionService', () => {
  let service: TokenEncryptionService
  const testPassword = 'test-encryption-password-12345'

  const mockTokens: StoredTokens = {
    access_token: 'ya29.test_access_token_1234567890',
    token_type: 'Bearer',
    expires_in: 3600,
    refresh_token: 'rt_1234567890_refresh_token',
    id_token: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjEifQ.test_id_token',
    scope: 'https://www.googleapis.com/auth/gmail.readonly',
    account_id: 'test@gmail.com',
    obtained_at: '2025-11-20T10:00:00.000Z',
    expires_at: '2025-11-20T11:00:00.000Z',
  }

  beforeEach(() => {
    service = new TokenEncryptionService()
  })

  describe('initialization', () => {
    it('should not be initialized by default', () => {
      expect(service.isInitialized()).toBe(false)
    })

    it('should initialize with a password', async () => {
      await service.initialize(testPassword)
      expect(service.isInitialized()).toBe(true)
    })

    it('should reject empty password', async () => {
      await expect(service.initialize('')).rejects.toThrow('Encryption password cannot be empty')
    })

    it('should reject whitespace-only password', async () => {
      await expect(service.initialize('   ')).rejects.toThrow('Encryption password cannot be empty')
    })

    it('should reinitialize with new password', async () => {
      await service.initialize(testPassword)
      expect(service.isInitialized()).toBe(true)

      await service.initialize('new-password-67890')
      expect(service.isInitialized()).toBe(true)
    })
  })

  describe('encrypt', () => {
    beforeEach(async () => {
      await service.initialize(testPassword)
    })

    it('should throw if not initialized', async () => {
      const uninitializedService = new TokenEncryptionService()
      await expect(uninitializedService.encrypt(mockTokens)).rejects.toThrow(
        'Encryption service not initialized'
      )
    })

    it('should encrypt tokens', async () => {
      const encrypted = await service.encrypt(mockTokens)

      expect(encrypted).toHaveProperty('ciphertext')
      expect(encrypted).toHaveProperty('iv')
      expect(encrypted).toHaveProperty('tag')
      expect(encrypted).toHaveProperty('account_id')
      expect(encrypted).toHaveProperty('encrypted_at')
    })

    it('should produce different ciphertext for same tokens (unique IV)', async () => {
      const encrypted1 = await service.encrypt(mockTokens)
      const encrypted2 = await service.encrypt(mockTokens)

      // Different IV should produce different ciphertext
      expect(encrypted1.iv).not.toBe(encrypted2.iv)
      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext)
    })

    it('should include account_id in encrypted data', async () => {
      const encrypted = await service.encrypt(mockTokens)
      expect(encrypted.account_id).toBe(mockTokens.account_id)
    })

    it('should include encrypted_at timestamp', async () => {
      const encrypted = await service.encrypt(mockTokens)
      const encryptedDate = new Date(encrypted.encrypted_at)
      expect(encryptedDate.getTime()).toBeGreaterThan(Date.now() - 5000) // Within 5 seconds
    })

    it('should produce base64-encoded ciphertext', async () => {
      const encrypted = await service.encrypt(mockTokens)

      // Base64 regex
      const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/
      expect(base64Regex.test(encrypted.ciphertext)).toBe(true)
      expect(base64Regex.test(encrypted.iv)).toBe(true)
    })
  })

  describe('decrypt', () => {
    beforeEach(async () => {
      await service.initialize(testPassword)
    })

    it('should throw if not initialized', async () => {
      const uninitializedService = new TokenEncryptionService()
      const encrypted = await service.encrypt(mockTokens)

      await expect(uninitializedService.decrypt(encrypted)).rejects.toThrow(
        'Encryption service not initialized'
      )
    })

    it('should decrypt encrypted tokens', async () => {
      const encrypted = await service.encrypt(mockTokens)
      const decrypted = await service.decrypt(encrypted)

      expect(decrypted).toEqual(mockTokens)
    })

    it('should preserve all token fields', async () => {
      const encrypted = await service.encrypt(mockTokens)
      const decrypted = await service.decrypt(encrypted)

      expect(decrypted.access_token).toBe(mockTokens.access_token)
      expect(decrypted.refresh_token).toBe(mockTokens.refresh_token)
      expect(decrypted.token_type).toBe(mockTokens.token_type)
      expect(decrypted.expires_in).toBe(mockTokens.expires_in)
      expect(decrypted.id_token).toBe(mockTokens.id_token)
      expect(decrypted.scope).toBe(mockTokens.scope)
      expect(decrypted.account_id).toBe(mockTokens.account_id)
      expect(decrypted.obtained_at).toBe(mockTokens.obtained_at)
      expect(decrypted.expires_at).toBe(mockTokens.expires_at)
    })

    it('should fail with wrong encryption key', async () => {
      const encrypted = await service.encrypt(mockTokens)

      // Reinitialize with different password
      await service.initialize('wrong-password-54321')

      await expect(service.decrypt(encrypted)).rejects.toThrow(
        'Failed to decrypt tokens. Data may be corrupted or encryption key is incorrect.'
      )
    })

    it('should fail with tampered ciphertext', async () => {
      const encrypted = await service.encrypt(mockTokens)

      // Tamper with ciphertext
      const tamperedEncrypted = {
        ...encrypted,
        ciphertext: encrypted.ciphertext.slice(0, -5) + 'XXXXX',
      }

      await expect(service.decrypt(tamperedEncrypted)).rejects.toThrow()
    })

    it('should fail with tampered IV', async () => {
      const encrypted = await service.encrypt(mockTokens)

      // Tamper with IV
      const tamperedEncrypted = {
        ...encrypted,
        iv: encrypted.iv.slice(0, -5) + 'XXXXX',
      }

      await expect(service.decrypt(tamperedEncrypted)).rejects.toThrow()
    })
  })

  describe('clear', () => {
    beforeEach(async () => {
      await service.initialize(testPassword)
    })

    it('should clear encryption key from memory', () => {
      service.clear()
      expect(service.isInitialized()).toBe(false)
    })

    it('should require reinitialization after clear', async () => {
      service.clear()

      await expect(service.encrypt(mockTokens)).rejects.toThrow(
        'Encryption service not initialized'
      )

      // Should work again after reinitialize
      await service.initialize(testPassword)
      await expect(service.encrypt(mockTokens)).resolves.toBeTruthy()
    })
  })

  describe('End-to-End Encryption Flow', () => {
    it('should complete full encrypt-decrypt cycle', async () => {
      // 1. Initialize service
      await service.initialize(testPassword)

      // 2. Encrypt tokens
      const encrypted = await service.encrypt(mockTokens)

      // 3. Verify encrypted data structure
      expect(encrypted.ciphertext).toBeTruthy()
      expect(encrypted.iv).toBeTruthy()
      expect(encrypted.account_id).toBe(mockTokens.account_id)

      // 4. Decrypt tokens
      const decrypted = await service.decrypt(encrypted)

      // 5. Verify decrypted matches original
      expect(decrypted).toEqual(mockTokens)
    })

    it('should handle multiple accounts independently', async () => {
      await service.initialize(testPassword)

      const tokens1 = { ...mockTokens, account_id: 'user1@gmail.com' }
      const tokens2 = { ...mockTokens, account_id: 'user2@gmail.com' }

      const encrypted1 = await service.encrypt(tokens1)
      const encrypted2 = await service.encrypt(tokens2)

      const decrypted1 = await service.decrypt(encrypted1)
      const decrypted2 = await service.decrypt(encrypted2)

      expect(decrypted1.account_id).toBe('user1@gmail.com')
      expect(decrypted2.account_id).toBe('user2@gmail.com')
    })
  })

  describe('Security Properties', () => {
    beforeEach(async () => {
      await service.initialize(testPassword)
    })

    it('should use unique IV for each encryption', async () => {
      const encrypted1 = await service.encrypt(mockTokens)
      const encrypted2 = await service.encrypt(mockTokens)

      expect(encrypted1.iv).not.toBe(encrypted2.iv)
    })

    it('should produce authenticated encryption (tampering detectable)', async () => {
      const encrypted = await service.encrypt(mockTokens)

      // Tamper with ciphertext
      const tampered = {
        ...encrypted,
        ciphertext: encrypted.ciphertext + 'tampered',
      }

      // AES-GCM should detect tampering
      await expect(service.decrypt(tampered)).rejects.toThrow()
    })

    it('should not expose plaintext in encrypted data', async () => {
      const encrypted = await service.encrypt(mockTokens)

      // Encrypted data should not contain plaintext token values
      const encryptedString = JSON.stringify(encrypted)
      expect(encryptedString).not.toContain(mockTokens.access_token)
      expect(encryptedString).not.toContain(mockTokens.refresh_token)
    })
  })
})
