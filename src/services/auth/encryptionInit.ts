/**
 * Encryption Initialization
 * Handles initialization of the token encryption service with a device-specific key
 *
 * For this local-first SPA, we use a device-specific encryption key that:
 * - Is generated once per device/browser
 * - Is stored in localStorage (not the tokens themselves)
 * - Provides encryption at rest for tokens stored in IndexedDB
 *
 * This protects against:
 * - XSS attacks that read IndexedDB directly
 * - Data theft if someone accesses browser storage files
 */

import { tokenEncryptionService } from './tokenEncryption'

const ENCRYPTION_KEY_STORAGE_KEY = 'claine-device-encryption-key'

/**
 * Generates a cryptographically secure random key
 * Uses Web Crypto API for secure random generation
 *
 * @returns Base64-encoded random key
 */
function generateDeviceKey(): string {
  const randomBytes = new Uint8Array(32) // 256 bits
  crypto.getRandomValues(randomBytes)

  // Convert to base64 for storage
  let binary = ''
  for (let i = 0; i < randomBytes.length; i++) {
    binary += String.fromCharCode(randomBytes[i])
  }
  return btoa(binary)
}

/**
 * Gets or generates a device-specific encryption key
 * The key is stored in localStorage and persists across sessions
 *
 * @returns Device-specific encryption key
 */
function getOrCreateDeviceKey(): string {
  let deviceKey = localStorage.getItem(ENCRYPTION_KEY_STORAGE_KEY)

  if (!deviceKey) {
    deviceKey = generateDeviceKey()
    localStorage.setItem(ENCRYPTION_KEY_STORAGE_KEY, deviceKey)
  }

  return deviceKey
}

/**
 * Initializes the token encryption service with a device-specific key
 * Should be called early in the app lifecycle, before any token operations
 *
 * This function is idempotent - calling it multiple times is safe
 *
 * @returns Promise that resolves when encryption is ready
 */
export async function initializeEncryption(): Promise<void> {
  // Skip if already initialized
  if (tokenEncryptionService.isInitialized()) {
    return
  }

  const deviceKey = getOrCreateDeviceKey()
  await tokenEncryptionService.initialize(deviceKey)
}
