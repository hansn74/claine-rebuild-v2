/**
 * Token Storage Service
 * Manages encrypted OAuth token storage in IndexedDB via RxDB
 *
 * Flow:
 * 1. Token received from OAuth → encrypt using tokenEncryptionService
 * 2. Store encrypted token in RxDB (IndexedDB)
 * 3. Retrieve encrypted token → decrypt using tokenEncryptionService
 * 4. Return plaintext tokens for API use
 *
 * Security:
 * - All tokens encrypted at rest using AES-GCM 256-bit
 * - Encryption key derived from user session
 * - Never store plaintext tokens in storage
 */

import { getDatabase } from '../database/init'
import { authTokenSchema, type AuthTokenDocument } from '../database/schemas/authToken.schema'
import { tokenEncryptionService } from './tokenEncryption'
import type { StoredTokens, EncryptedTokenData, OAuthTokens } from './types'

/**
 * Token Storage Service
 * Handles secure storage and retrieval of OAuth tokens
 */
export class TokenStorageService {
  private collectionInitialized = false

  /**
   * Initializes the auth tokens collection if it doesn't exist
   * Should be called once during app initialization
   */
  async initialize(): Promise<void> {
    if (this.collectionInitialized) {
      return
    }

    try {
      const db = getDatabase()

      // Add auth tokens collection if it doesn't exist
      if (!db.authTokens) {
        await db.addCollections({
          authTokens: {
            schema: authTokenSchema,
          },
        })
      }

      this.collectionInitialized = true
    } catch (error) {
      throw new Error(
        `Failed to initialize token storage: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Stores OAuth tokens securely
   * Encrypts tokens and saves to IndexedDB
   *
   * @param accountId - Account email address
   * @param tokens - OAuth tokens to store
   * @throws Error if encryption service not initialized or storage fails
   *
   * @example
   * ```typescript
   * await tokenStorageService.storeTokens('user@gmail.com', {
   *   access_token: '...',
   *   refresh_token: '...',
   *   expires_in: 3600,
   *   token_type: 'Bearer'
   * })
   * ```
   */
  async storeTokens(accountId: string, tokens: OAuthTokens): Promise<void> {
    await this.initialize()

    // Calculate expiration time
    const obtainedAt = new Date()
    const expiresAt = new Date(obtainedAt.getTime() + tokens.expires_in * 1000)

    // Create stored tokens with metadata
    const storedTokens: StoredTokens = {
      ...tokens,
      account_id: accountId,
      obtained_at: obtainedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
    }

    // Encrypt tokens
    const encryptedData = await tokenEncryptionService.encrypt(storedTokens)

    // Store in database
    const db = getDatabase()
    const collection = db.authTokens

    if (!collection) {
      throw new Error('Auth tokens collection not initialized')
    }

    // Upsert (insert or update)
    const existing = await collection.findOne(accountId).exec()

    if (existing) {
      // Update existing document
      await existing.update({
        $set: {
          ciphertext: encryptedData.ciphertext,
          iv: encryptedData.iv,
          tag: encryptedData.tag,
          encrypted_at: encryptedData.encrypted_at,
          updated_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
        },
      })
    } else {
      // Insert new document
      const doc: AuthTokenDocument = {
        id: accountId,
        account_id: accountId,
        ciphertext: encryptedData.ciphertext,
        iv: encryptedData.iv,
        tag: encryptedData.tag,
        encrypted_at: encryptedData.encrypted_at,
        updated_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      }

      await collection.insert(doc)
    }
  }

  /**
   * Retrieves OAuth tokens for an account
   * Decrypts tokens from IndexedDB
   *
   * @param accountId - Account email address
   * @returns Decrypted OAuth tokens, or null if not found
   * @throws Error if decryption fails
   *
   * @example
   * ```typescript
   * const tokens = await tokenStorageService.getTokens('user@gmail.com')
   * if (tokens) {
   *   // Use tokens.access_token for API calls
   * }
   * ```
   */
  async getTokens(accountId: string): Promise<StoredTokens | null> {
    await this.initialize()

    const db = getDatabase()
    const collection = db.authTokens

    if (!collection) {
      throw new Error('Auth tokens collection not initialized')
    }

    // Find encrypted token document
    const doc = await collection.findOne(accountId).exec()

    if (!doc) {
      return null
    }

    // Reconstruct encrypted data
    const encryptedData: EncryptedTokenData = {
      ciphertext: doc.ciphertext,
      iv: doc.iv,
      tag: doc.tag,
      account_id: doc.account_id,
      encrypted_at: doc.encrypted_at,
    }

    // Decrypt and return tokens
    try {
      const tokens = await tokenEncryptionService.decrypt(encryptedData)
      return tokens
    } catch (error) {
      throw new Error(
        `Failed to decrypt tokens for ${accountId}: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  /**
   * Checks if tokens exist for an account
   *
   * @param accountId - Account email address
   * @returns true if tokens exist, false otherwise
   */
  async hasTokens(accountId: string): Promise<boolean> {
    await this.initialize()

    const db = getDatabase()
    const collection = db.authTokens

    if (!collection) {
      return false
    }

    const doc = await collection.findOne(accountId).exec()
    return doc !== null
  }

  /**
   * Deletes tokens for an account
   * Used on logout or account removal
   *
   * @param accountId - Account email address
   */
  async deleteTokens(accountId: string): Promise<void> {
    await this.initialize()

    const db = getDatabase()
    const collection = db.authTokens

    if (!collection) {
      return
    }

    const doc = await collection.findOne(accountId).exec()

    if (doc) {
      await doc.remove()
    }
  }

  /**
   * Gets all stored account IDs
   * Useful for listing connected accounts
   *
   * @returns Array of account email addresses
   */
  async getAllAccountIds(): Promise<string[]> {
    await this.initialize()

    const db = getDatabase()
    const collection = db.authTokens

    if (!collection) {
      return []
    }

    const docs = await collection.find().exec()
    return docs.map((doc) => doc.account_id)
  }

  /**
   * Gets accounts with tokens expiring soon
   * Used by token refresh scheduler
   *
   * @param thresholdMinutes - Minutes before expiration (default: 5)
   * @returns Array of account IDs needing refresh
   */
  async getAccountsNeedingRefresh(thresholdMinutes: number = 5): Promise<string[]> {
    await this.initialize()

    const db = getDatabase()
    const collection = db.authTokens

    if (!collection) {
      return []
    }

    // Calculate threshold time
    const thresholdTime = new Date(Date.now() + thresholdMinutes * 60 * 1000)

    // Query for tokens expiring before threshold
    const docs = await collection
      .find({
        selector: {
          expires_at: {
            $lt: thresholdTime.toISOString(),
          },
        },
      })
      .exec()

    return docs.map((doc) => doc.account_id)
  }

  /**
   * Checks if service is initialized
   */
  isInitialized(): boolean {
    return this.collectionInitialized
  }
}

/**
 * Singleton instance of token storage service
 * Use this instance throughout the application
 */
export const tokenStorageService = new TokenStorageService()
