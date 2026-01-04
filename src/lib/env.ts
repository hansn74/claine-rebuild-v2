/**
 * Environment Variable Validation and Type-Safe Access
 *
 * This module provides runtime validation and type-safe access to environment variables.
 * All client-side environment variables must use the VITE_ prefix to be exposed to the browser.
 *
 * Usage:
 *   import { validateEnv, getEnv } from '@/lib/env'
 *
 *   // Validate on app initialization
 *   validateEnv()
 *
 *   // Access environment variables with type safety
 *   const appName = getEnv('VITE_APP_NAME')
 *   const apiUrl = getEnv('VITE_API_URL', 'https://gmail.googleapis.com')
 */

/**
 * List of required environment variables that must be defined
 * Missing required variables will cause validateEnv() to throw an error
 */
const REQUIRED_ENV_VARS = ['VITE_APP_NAME'] as const

/**
 * List of optional environment variables with their default values
 * Optional variables will use defaults if not defined
 */
const OPTIONAL_ENV_VARS = {
  VITE_API_URL: 'https://gmail.googleapis.com',
} as const

/**
 * Union type of all environment variable keys (required + optional)
 */
type EnvKey = (typeof REQUIRED_ENV_VARS)[number] | keyof typeof OPTIONAL_ENV_VARS

/**
 * Validates that all required environment variables are defined
 *
 * @throws {Error} If any required environment variable is missing
 *
 * @example
 * ```ts
 * // Call early in app initialization (e.g., in main.tsx)
 * validateEnv()
 * ```
 */
export function validateEnv(): void {
  const missing: string[] = []

  for (const key of REQUIRED_ENV_VARS) {
    if (!import.meta.env[key]) {
      missing.push(key)
    }
  }

  if (missing.length > 0) {
    const errorMessage = [
      `Missing required environment variable${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`,
      '',
      'To fix this:',
      '1. Copy .env.example to .env in the project root',
      '2. Set values for all required variables',
      '3. Restart the development server',
      '',
      'For deployment platforms:',
      '- GitHub Actions: Set secrets in Repository Settings → Secrets and variables → Actions',
      '- Vercel: Set environment variables in Project Settings → Environment Variables',
      '',
      'See docs/stories/0-8-set-up-environment-variable-management.md for details.',
    ].join('\n')

    throw new Error(errorMessage)
  }
}

/**
 * Type-safe accessor for environment variables with optional default values
 *
 * Provides autocomplete support and compile-time type checking for environment variable access.
 * For required variables, throws an error if undefined (after validateEnv() has passed).
 * For optional variables, returns the default value if undefined.
 *
 * @param key - Environment variable key (must be a valid key from VITE_ prefixed vars)
 * @param defaultValue - Optional default value to return if variable is undefined
 * @returns The environment variable value or default value
 *
 * @example
 * ```ts
 * // Required variable (will throw if missing and validateEnv() wasn't called)
 * const appName = getEnv('VITE_APP_NAME')
 *
 * // Optional variable with default
 * const apiUrl = getEnv('VITE_API_URL', 'https://gmail.googleapis.com')
 *
 * // Using the default from OPTIONAL_ENV_VARS
 * const apiUrl = getEnv('VITE_API_URL')
 * ```
 */

export function getEnv(key: EnvKey): string
// eslint-disable-next-line no-redeclare
export function getEnv(key: EnvKey, defaultValue: string): string
// eslint-disable-next-line no-redeclare
export function getEnv(key: EnvKey, defaultValue?: string): string {
  const value = import.meta.env[key]

  // If value exists, return it
  if (value !== undefined && value !== '') {
    return value as string
  }

  // If a default value was provided as parameter, use it (highest priority for defaults)
  if (defaultValue !== undefined) {
    return defaultValue
  }

  // Check if there's a default value in OPTIONAL_ENV_VARS (fallback default)
  if (key in OPTIONAL_ENV_VARS) {
    return OPTIONAL_ENV_VARS[key as keyof typeof OPTIONAL_ENV_VARS]
  }

  // If we get here, it's a required variable that's missing
  // This should have been caught by validateEnv(), but throw a clear error anyway
  throw new Error(
    `Environment variable ${key} is not defined and no default value was provided. ` +
      `Call validateEnv() early in your app initialization to catch this earlier.`
  )
}

/**
 * Returns all environment variables as a read-only object
 * Useful for debugging or logging (be careful not to log sensitive values)
 *
 * @returns Read-only object containing all environment variables
 *
 * @example
 * ```ts
 * const env = getAllEnv()
 * console.log('App Name:', env.VITE_APP_NAME)
 * ```
 */
// eslint-disable-next-line no-undef
export function getAllEnv(): Readonly<ImportMetaEnv> {
  return import.meta.env
}

/**
 * Checks if the app is running in development mode
 * @returns true if in development mode, false otherwise
 */
export function isDevelopment(): boolean {
  return import.meta.env.DEV
}

/**
 * Checks if the app is running in production mode
 * @returns true if in production mode, false otherwise
 */
export function isProduction(): boolean {
  return import.meta.env.PROD
}
