/**
 * Token Encryption Service
 * Provides AES-GCM 256-bit encryption for OAuth tokens stored in IndexedDB
 *
 * Security Features:
 * - AES-GCM 256-bit encryption (authenticated encryption)
 * - Unique initialization vector (IV) for each encryption operation
 * - Key derivation from user session data using PBKDF2
 * - Prevents token theft even if IndexedDB is compromised
 *
 * Never store tokens in localStorage (vulnerable to XSS attacks)
 * Always encrypt tokens at rest in IndexedDB
 */

import type { StoredTokens, EncryptedTokenData } from './types'

/**
 * Salt for key derivation (stored in code, not secret)
 * In production, consider deriving from user-specific data
 */
const KEY_DERIVATION_SALT = 'claine-v2-token-encryption-salt'

/**
 * Number of PBKDF2 iterations (100,000 is recommended minimum)
 */
const PBKDF2_ITERATIONS = 100_000

/**
 * Encryption algorithm parameters
 */
const ENCRYPTION_ALGORITHM = 'AES-GCM'
const KEY_LENGTH = 256 // 256-bit key
const IV_LENGTH = 12 // 96-bit IV (recommended for AES-GCM)

/**
 * Token Encryption Service
 * Handles encryption and decryption of OAuth tokens using Web Crypto API
 */
export class TokenEncryptionService {
  private encryptionKey: CryptoKey | null = null

  /**
   * Initializes the encryption service with a key derivation password
   * The password should be derived from user session data
   *
   * @param password - Password for key derivation (e.g., session ID + user ID)
   * @throws Error if password is empty
   */
  async initialize(password: string): Promise<void> {
    if (!password || password.trim().length === 0) {
      throw new Error('Encryption password cannot be empty')
    }

    this.encryptionKey = await this.deriveEncryptionKey(password)
  }

  /**
   * Derives an AES-GCM encryption key from a password using PBKDF2
   *
   * PBKDF2 (Password-Based Key Derivation Function 2):
   * - Applies a pseudorandom function (SHA-256) to the password
   * - Uses a salt to prevent rainbow table attacks
   * - Iterates 100,000 times to slow down brute force attacks
   *
   * @param password - Password to derive key from
   * @returns CryptoKey for AES-GCM encryption/decryption
   */
  private async deriveEncryptionKey(password: string): Promise<CryptoKey> {
    // Convert password to bytes
    const encoder = new TextEncoder()
    const passwordBytes = encoder.encode(password)

    // Import password as PBKDF2 key material
    const keyMaterial = await crypto.subtle.importKey('raw', passwordBytes, 'PBKDF2', false, [
      'deriveKey',
    ])

    // Convert salt to bytes
    const saltBytes = encoder.encode(KEY_DERIVATION_SALT)

    // Derive AES-GCM key using PBKDF2
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: saltBytes,
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256',
      },
      keyMaterial,
      {
        name: ENCRYPTION_ALGORITHM,
        length: KEY_LENGTH,
      },
      false, // Key not extractable (more secure)
      ['encrypt', 'decrypt']
    )

    return key
  }

  /**
   * Encrypts OAuth tokens using AES-GCM
   *
   * Process:
   * 1. Generate random IV (initialization vector)
   * 2. Serialize tokens to JSON
   * 3. Encrypt using AES-GCM (provides authentication + confidentiality)
   * 4. Return ciphertext, IV, and metadata
   *
   * @param tokens - OAuth tokens to encrypt
   * @returns Encrypted token data with IV
   * @throws Error if service not initialized or encryption fails
   */
  async encrypt(tokens: StoredTokens): Promise<EncryptedTokenData> {
    if (!this.encryptionKey) {
      throw new Error('Encryption service not initialized. Call initialize() first.')
    }

    // Generate random IV (must be unique for each encryption)
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))

    // Serialize tokens to JSON
    const encoder = new TextEncoder()
    const plaintext = encoder.encode(JSON.stringify(tokens))

    // Encrypt using AES-GCM
    // AES-GCM provides both confidentiality and authenticity
    // The authentication tag is automatically appended to ciphertext
    const ciphertext = await crypto.subtle.encrypt(
      {
        name: ENCRYPTION_ALGORITHM,
        iv,
      },
      this.encryptionKey,
      plaintext
    )

    // Convert to base64 for storage
    const ciphertextArray = new Uint8Array(ciphertext)
    const ciphertextBase64 = arrayBufferToBase64(ciphertextArray)
    const ivBase64 = arrayBufferToBase64(iv)

    return {
      ciphertext: ciphertextBase64,
      iv: ivBase64,
      tag: '', // AES-GCM includes tag in ciphertext
      account_id: tokens.account_id,
      encrypted_at: new Date().toISOString(),
    }
  }

  /**
   * Decrypts OAuth tokens using AES-GCM
   *
   * Process:
   * 1. Decode ciphertext and IV from base64
   * 2. Decrypt using AES-GCM (verifies authentication tag)
   * 3. Deserialize JSON to tokens object
   * 4. Return tokens
   *
   * @param encryptedData - Encrypted token data with IV
   * @returns Decrypted OAuth tokens
   * @throws Error if service not initialized, decryption fails, or authentication fails
   */
  async decrypt(encryptedData: EncryptedTokenData): Promise<StoredTokens> {
    if (!this.encryptionKey) {
      throw new Error('Encryption service not initialized. Call initialize() first.')
    }

    // Decode from base64
    const ciphertext = base64ToArrayBuffer(encryptedData.ciphertext)
    const iv = base64ToArrayBuffer(encryptedData.iv)

    try {
      // Decrypt using AES-GCM
      // Will throw if authentication tag verification fails (tampered data)
      const plaintext = await crypto.subtle.decrypt(
        {
          name: ENCRYPTION_ALGORITHM,
          iv,
        },
        this.encryptionKey,
        ciphertext
      )

      // Decode plaintext
      const decoder = new TextDecoder()
      const json = decoder.decode(plaintext)

      // Parse and return tokens
      return JSON.parse(json) as StoredTokens
    } catch {
      // Decryption failed (wrong key or tampered data)
      throw new Error(
        'Failed to decrypt tokens. Data may be corrupted or encryption key is incorrect.'
      )
    }
  }

  /**
   * Checks if the service is initialized and ready to use
   */
  isInitialized(): boolean {
    return this.encryptionKey !== null
  }

  /**
   * Clears the encryption key from memory
   * Should be called on logout or when encryption is no longer needed
   */
  clear(): void {
    this.encryptionKey = null
  }
}

/**
 * Converts an ArrayBuffer or Uint8Array to base64 string
 * @param buffer - Buffer to convert
 * @returns Base64-encoded string
 */
function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/**
 * Converts a base64 string to Uint8Array
 * @param base64 - Base64-encoded string
 * @returns Decoded byte array
 */
function base64ToArrayBuffer(base64: string): Uint8Array {
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
}

/**
 * Singleton instance of the encryption service
 * Use this instance throughout the application
 */
export const tokenEncryptionService = new TokenEncryptionService()
